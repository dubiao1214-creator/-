from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Direction(str, Enum):
    pm_to_dev = "pm_to_dev"
    dev_to_pm = "dev_to_pm"


class SceneType(str, Enum):
    requirement = "需求讨论"
    technical = "技术方案"
    unknown = "待判断"


class TranslationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    direction: Direction
    text: str = Field(..., min_length=1)
    auto_detect: bool = True

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value
