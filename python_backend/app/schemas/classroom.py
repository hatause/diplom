from pydantic import BaseModel, StrictInt, StrictStr, field_validator

# Must match LOCATION_TO_CORPUS in the Java BotBridgeService
LOCATIONS = [
    {"id": "corp_a", "name": "Корпус А", "corpus": "А"},
    {"id": "corp_b", "name": "Корпус Б", "corpus": "Б"},
    {"id": "corp_d", "name": "Корпус Д", "corpus": "Д"},
]
LOCATION_IDS = {loc["id"] for loc in LOCATIONS}
DURATION_MIN_MINUTES = 15
DURATION_MAX_MINUTES = 240


class ClassroomSearchRequest(BaseModel):
    locationId: StrictStr
    durationMinutes: StrictInt

    @field_validator("locationId")
    @classmethod
    def validate_location(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in LOCATION_IDS:
            raise ValueError("Выберите корпус из списка")
        return value

    @field_validator("durationMinutes")
    @classmethod
    def validate_duration(cls, value: int) -> int:
        if not DURATION_MIN_MINUTES <= value <= DURATION_MAX_MINUTES:
            raise ValueError(
                f"Длительность должна быть от {DURATION_MIN_MINUTES} до {DURATION_MAX_MINUTES} минут"
            )
        return value
