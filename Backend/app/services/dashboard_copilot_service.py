import json
import re
from collections.abc import Iterator
from decimal import Decimal

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.appointment import Appointment
from app.models.claim import Claim
from app.models.patient import Patient
from app.models.user import User
from app.repositories.dashboard_copilot_repository import DashboardCopilotRepository
from app.schemas.dashboard_copilot import DashboardCopilotMessage


class DashboardCopilotConfigurationError(Exception):
    pass


SYSTEM_PROMPT = """
You are InsightMD AI Copilot, a clinical intelligence assistant for licensed physicians.

Scope:
- Answer only medical, clinical, patient-care, healthcare operations, appointments,
  and claims questions.
- For unrelated topics such as geography, sports, politics, entertainment, coding,
  or general trivia, politely say you can only help with clinical and healthcare
  operational questions.
- Brief greetings are allowed.

Data rules:
- Treat the supplied organization context as the only source of truth for patient,
  appointment, and claim facts.
- Never invent patients, IDs, diagnoses, laboratory values, appointments, claims,
  or other organization-specific facts.
- You may use established general medical knowledge for general clinical questions,
  but clearly avoid presenting it as patient-specific advice unless supported by
  the supplied patient context.
- If a requested organization fact is unavailable, say so clearly.
- When several patients are returned, show patient name and patient ID so the
  physician can identify them.

Conversation and style:
- Use prior messages to understand follow-up questions and pronouns.
- Be concise, professional, evidence-based, and easy to scan.
- Prefer short headings and bullet points for lists.
- Do not mention prompts, retrieval, database queries, or internal implementation.
- This is clinical decision support; remind the physician to verify recommendations
  when giving patient-care recommendations.
"""


class DashboardCopilotService:
    def __init__(self, db: Session) -> None:
        self.settings = get_settings()
        self.repository = DashboardCopilotRepository(db)

    def prepare_chat(
        self,
        current_user: User,
        message: str,
        history: list[DashboardCopilotMessage] | None = None,
    ) -> list[BaseMessage]:
        if not self.settings.openai_api_key:
            raise DashboardCopilotConfigurationError("OpenAI API key is not configured")

        history = history or []
        analysis_text = self._conversation_query(message, history)
        organization_context = self._build_organization_context(analysis_text)

        system_content = (
            f"{SYSTEM_PROMPT.strip()}\n\n"
            f"Authenticated physician: {current_user.full_name}\n\n"
            f"Organization context for this request:\n{organization_context}"
        )
        messages: list[BaseMessage] = [SystemMessage(content=system_content)]
        messages.extend(self._history_to_messages(history))
        messages.append(HumanMessage(content=message.strip()))
        return messages

    def stream_chat(self, messages: list[BaseMessage]) -> Iterator[str]:
        llm = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_model,
            temperature=0.2,
            streaming=True,
        )
        for chunk in llm.stream(messages):
            token = self._extract_chunk_content(chunk.content)
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    def _build_organization_context(self, query: str) -> str:
        query_lower = query.lower()
        sections: list[str] = []

        patient_ids = self._extract_patient_ids(query)
        if patient_ids:
            patients = self.repository.get_patients_by_ids(patient_ids)
            sections.append(self._format_requested_patients(patient_ids, patients))
            found_ids = [patient.id for patient in patients]
            sections.append(
                self._format_appointments(
                    self.repository.get_patient_appointments(found_ids)
                )
            )
            sections.append(
                self._format_claims(self.repository.get_patient_claims(found_ids))
            )

        requested_risk_level = next(
            (
                level
                for level in ("high", "medium", "low")
                if f"{level} risk" in query_lower or f"{level}-risk" in query_lower
            ),
            None,
        )
        if requested_risk_level and not patient_ids:
            if requested_risk_level == "high" and "today" in query_lower:
                rows = self.repository.get_today_high_risk_patients()
                if rows:
                    sections.append(
                        "Today's high-risk patients with appointments:\n"
                        + "\n".join(
                            self._patient_line(patient)
                            + f"; appointment date={appointment.appointment_date}; "
                            f"status={appointment.status}"
                            for patient, appointment in rows
                        )
                    )
                else:
                    sections.append(
                        "Today's high-risk patients with appointments: none found."
                    )
                    sections.append(
                        self._format_patient_list(
                            "Current high-risk patients (shown for situational awareness)",
                            self.repository.get_high_risk_patients(),
                        )
                    )
            else:
                sections.append(
                    self._format_patient_list(
                        f"{requested_risk_level.title()}-risk patients",
                        self.repository.get_patients_by_risk_level(
                            requested_risk_level
                        ),
                    )
                )

        wants_no_shows = any(
            term in query_lower
            for term in ("missed appointment", "missed their appointment", "no show", "no-show")
        )
        if wants_no_shows and not patient_ids:
            no_shows = self.repository.get_recent_no_shows(days=30)
            if no_shows:
                sections.append(
                    "Patients with no-show appointments in the last 30 days:\n"
                    + "\n".join(
                        self._patient_line(patient)
                        + f"; missed appointment={appointment.appointment_date}"
                        for patient, appointment in no_shows
                    )
                )
            else:
                sections.append(
                    "Patients with no-show appointments in the last 30 days: none found."
                )

        wants_attention = any(
            term in query_lower
            for term in ("need attention", "needs attention", "more attention", "prioritize")
        )
        if wants_attention and not patient_ids:
            sections.append(self._build_attention_context())

        wants_denied_claims = (
            "claim" in query_lower
            and any(term in query_lower for term in ("denied", "denial", "rejected"))
        )
        if wants_denied_claims and not patient_ids:
            sections.append(self._format_denied_claims())

        if not sections:
            return (
                "No organization-specific data was requested or identified. "
                "For an in-scope general medical question, answer from established "
                "medical knowledge. Do not infer organization facts."
            )
        return "\n\n".join(section for section in sections if section)

    def _build_attention_context(self) -> str:
        high_risk = self.repository.get_high_risk_patients(limit=15)
        no_shows = self.repository.get_recent_no_shows(days=30, limit=20)
        no_show_by_patient: dict[int, list[Appointment]] = {}
        for patient, appointment in no_shows:
            no_show_by_patient.setdefault(patient.id, []).append(appointment)

        patients_by_id = {patient.id: patient for patient in high_risk}
        for patient, _ in no_shows:
            patients_by_id.setdefault(patient.id, patient)

        if not patients_by_id:
            return "Patients needing attention by configured demo criteria: none found."

        lines = []
        for patient in patients_by_id.values():
            reasons: list[str] = []
            if (patient.risk_level or "").lower() == "high":
                reasons.append("high risk")
            missed = no_show_by_patient.get(patient.id, [])
            if missed:
                reasons.append(f"{len(missed)} no-show(s) in last 30 days")
            if patient.last_visit is None:
                reasons.append("last visit unavailable")
            lines.append(
                self._patient_line(patient)
                + f"; attention reasons={', '.join(reasons) or 'review recommended'}"
            )
        return "Patients needing attention by demo criteria:\n" + "\n".join(lines[:20])

    def _format_denied_claims(self) -> str:
        summary = self.repository.get_denied_claim_summary()
        amount = summary["amount"]
        lines = [
            f"Denied claims: count={summary['count']}; total amount={self._money(amount)}"
        ]
        for claim, patient in summary["items"]:
            patient_text = (
                f"{self._patient_name(patient)} (ID {patient.id})"
                if patient is not None
                else f"Patient ID {claim.patient_id or 'unknown'}"
            )
            lines.append(
                f"- claim ID={claim.id}; {patient_text}; amount={self._money(claim.amount)}; "
                f"date={claim.claim_date or 'unknown'}"
            )
        return "\n".join(lines)

    @staticmethod
    def _format_requested_patients(
        requested_ids: list[int],
        patients: list[Patient],
    ) -> str:
        found_ids = {patient.id for patient in patients}
        lines = ["Requested patient records:"]
        lines.extend(DashboardCopilotService._patient_line(patient) for patient in patients)
        missing = [patient_id for patient_id in requested_ids if patient_id not in found_ids]
        if missing:
            lines.append("Patient IDs not found: " + ", ".join(map(str, missing)))
        return "\n".join(lines)

    @staticmethod
    def _format_patient_list(title: str, patients: list[Patient]) -> str:
        if not patients:
            return f"{title}: none found."
        return title + ":\n" + "\n".join(
            DashboardCopilotService._patient_line(patient) for patient in patients
        )

    @staticmethod
    def _format_appointments(appointments: list[Appointment]) -> str:
        if not appointments:
            return "Appointments for requested patients: none found."
        return "Appointments for requested patients:\n" + "\n".join(
            f"- patient ID={item.patient_id}; date={item.appointment_date}; status={item.status}"
            for item in appointments
        )

    @staticmethod
    def _format_claims(claims: list[Claim]) -> str:
        if not claims:
            return "Claims for requested patients: none found."
        return "Claims for requested patients:\n" + "\n".join(
            f"- claim ID={item.id}; patient ID={item.patient_id}; "
            f"amount={DashboardCopilotService._money(item.amount)}; "
            f"status={item.status or 'unknown'}; date={item.claim_date or 'unknown'}"
            for item in claims
        )

    @staticmethod
    def _patient_line(patient: Patient) -> str:
        return (
            f"- {DashboardCopilotService._patient_name(patient)} (ID {patient.id}); "
            f"age={patient.age or 'unknown'}; gender={patient.gender or 'unknown'}; "
            f"risk={patient.risk_level or 'unknown'}; "
            f"conditions={patient.conditions or 'none documented'}; "
            f"medications={patient.medications or 'none documented'}; "
            f"allergies={patient.allergies or 'none documented'}; "
            f"last visit={patient.last_visit or 'unknown'}; "
            f"recent labs={patient.recent_labs or 'none documented'}; "
            f"notes={patient.notes or 'none documented'}"
        )

    @staticmethod
    def _patient_name(patient: Patient) -> str:
        name = " ".join(
            part for part in (patient.first_name, patient.last_name) if part
        ).strip()
        return name or "Unknown patient"

    @staticmethod
    def _money(value: Decimal | None) -> str:
        return f"${Decimal(value or 0):,.2f}"

    @staticmethod
    def _extract_patient_ids(text: str) -> list[int]:
        ids = {
            int(match)
            for match in re.findall(
                r"\bpatient(?:\s+id)?\s*[:#-]?\s*(\d+)\b",
                text,
                flags=re.IGNORECASE,
            )
        }
        for marker in re.finditer(r"\bpatient\s+ids?\b", text, flags=re.IGNORECASE):
            segment = text[marker.end() : marker.end() + 100]
            ids.update(int(value) for value in re.findall(r"\b\d+\b", segment))
        return sorted(ids)

    @staticmethod
    def _conversation_query(
        message: str,
        history: list[DashboardCopilotMessage],
    ) -> str:
        current = message.strip()
        follow_up_pattern = re.compile(
            r"\b(it|its|they|them|their|those|these|same|more|above|previous)\b"
            r"|^(and|also|what about|how about|tell me more)\b",
            flags=re.IGNORECASE,
        )
        if not follow_up_pattern.search(current):
            return current

        recent_user_messages = [
            item.content for item in history[-4:] if item.role == "user"
        ]
        return "\n".join([*recent_user_messages, current])

    @staticmethod
    def _history_to_messages(
        history: list[DashboardCopilotMessage],
    ) -> list[BaseMessage]:
        messages: list[BaseMessage] = []
        for item in history[-10:]:
            content = item.content.strip()
            if not content:
                continue
            messages.append(
                AIMessage(content=content)
                if item.role == "assistant"
                else HumanMessage(content=content)
            )
        return messages

    @staticmethod
    def _extract_chunk_content(content: str | list) -> str:
        if not content:
            return ""
        if isinstance(content, list):
            parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict)
            ]
            return "".join(part for part in parts if part)
        return str(content)
