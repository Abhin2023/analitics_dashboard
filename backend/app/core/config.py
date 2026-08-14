import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

    DATABASE_URL: str = "mysql+aiomysql://root@localhost:3306/bp_analytics"
    JWT_SECRET_KEY: str = "change-me-to-a-random-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_SERVICE_ACCOUNT_JSON_PATH: str = ""
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:8001"
    BASE_REPORTING_CURRENCY: str = "INR"
    SMARTSERVICE_MCP_URL: str = "https://smartserviceapitemp.azurewebsites.net/mcp"
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
