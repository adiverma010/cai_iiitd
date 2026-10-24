from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CareType(str, Enum):
    PARAMEDIC_HOME_VISIT = "paramedic_home_visit"
    HOME_NURSING = "home_nursing"
    LAB_TEST_HOME = "lab_test_home"
    TELECONSULTATION = "teleconsultation"
    EMERGENCY_112 = "emergency_112"


class Urgency(str, Enum):
    EMERGENCY = "emergency"
    SAME_DAY = "same_day"
    SCHEDULED = "scheduled"


class RedFlag(str, Enum):
    CHEST_PAIN = "chest_pain"
    BREATHLESSNESS = "breathlessness"
    UNCONSCIOUSNESS = "unconsciousness"
    SEVERE_BLEEDING = "severe_bleeding"
    STROKE_SYMPTOMS = "stroke_symptoms"
    SEIZURE = "seizure"
    HIGH_FEVER_INFANT = "high_fever_infant"
    SUICIDAL_IDEATION = "suicidal_ideation"
    SEVERE_DEHYDRATION = "severe_dehydration"


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class TriageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_input: str
    language: str
    location: Location
    conversation_history: list[dict[str, Any]]

    @field_validator("user_input", "language")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class CaregiverMatch(BaseModel):
    caregiver_id: str
    score: float = Field(ge=0, le=1)
    reason: str


class TriageResponse(BaseModel):
    follow_up_question: str | None
    care_type: CareType | None
    urgency: Urgency | None
    red_flags: list[RedFlag]
    reasoning: str
    matched_caregivers: list[CaregiverMatch]
