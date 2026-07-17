from typing import Literal

from pydantic import BaseModel, Field


class DashboardCopilotMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class DashboardCopilotChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[DashboardCopilotMessage] = Field(default_factory=list)


class DashboardCopilotBootstrap(BaseModel):
    doctor_name: str
    suggested_queries: list[str]
