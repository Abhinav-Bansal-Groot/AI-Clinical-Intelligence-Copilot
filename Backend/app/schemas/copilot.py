from pydantic import BaseModel, Field


class CopilotChatRequest(BaseModel):
    patient_id: int = Field(gt=0)
    message: str = Field(min_length=1, max_length=4000)
