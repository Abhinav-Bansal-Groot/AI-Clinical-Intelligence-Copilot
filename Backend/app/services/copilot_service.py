import json
from collections.abc import Iterator

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories.patient_repository import PatientRepository
from app.schemas.patient import PatientDetail
from app.services.copilot_prompts import (
    SYSTEM_PROMPT,
    build_patient_context,
    build_practice_context,
)
from app.services.patient_service import PatientNotFoundError


class CopilotConfigurationError(Exception):
    pass


class CopilotService:
    def __init__(self, db: Session) -> None:
        self.settings = get_settings()
        self.patient_repository = PatientRepository(db)

    def prepare_chat(
        self,
        patient_id: int,
        message: str,
        *,
        doctor_name: str,
        doctor_role: str,
        doctor_email: str,
    ) -> list[BaseMessage]:
        if not self.settings.openai_api_key:
            raise CopilotConfigurationError("OpenAI API key is not configured")

        patient = self.patient_repository.get_by_id(patient_id)
        if patient is None:
            raise PatientNotFoundError("Patient not found")

        patient_detail = PatientDetail.model_validate(patient)
        patient_context = build_patient_context(patient_detail)
        practice_context = build_practice_context(
            doctor_name=doctor_name,
            doctor_role=doctor_role,
            doctor_email=doctor_email,
        )

        return [
            SystemMessage(
                content=f"{SYSTEM_PROMPT}\n\n{practice_context}\n\n{patient_context}"
            ),
            HumanMessage(content=message.strip()),
        ]

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

    @staticmethod
    def _extract_chunk_content(content: str | list) -> str:
        if not content:
            return ""

        if isinstance(content, list):
            text_parts = [part.get("text", "") for part in content if isinstance(part, dict)]
            return "".join(part for part in text_parts if part)

        return str(content)
