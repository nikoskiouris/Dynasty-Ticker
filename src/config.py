from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    sleeper_base_url: str = os.getenv("SLEEPER_BASE_URL", "https://api.sleeper.app/v1")
    request_timeout: int = int(os.getenv("REQUEST_TIMEOUT", "20"))


settings = Settings()
