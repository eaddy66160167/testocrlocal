from pydantic import Field, SecretStr, model_validator
from pydantic_settings import SettingsConfigDict
from app.core.config import Settings

class LocalSettings(Settings):
    # Deliberately do not load the parent workspace's production dotenv files.
    model_config = SettingsConfigDict(env_file=None, extra="ignore", env_prefix="LOCAL_")
    database_url: SecretStr = SecretStr("")
    admin_token: SecretStr = SecretStr("")
    cors_origins: str = "https://testocrlocal.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
    cache_ttl_seconds: float = Field(default=60, gt=0, le=3600)
    pool_size: int = Field(default=2, ge=1, le=10)
    pool_overflow: int = Field(default=1, ge=0, le=5)
    ocr_concurrency: int = Field(default=2, ge=1, le=10)
    requests_per_minute: int = Field(default=60, ge=1, le=1000)
    transfer_warning_mb: str = "250,400,500"
    model_gateway_base_url: str = ""

    @model_validator(mode="after")
    def isolated(self):
        if not self.database_url.get_secret_value().strip():
            raise ValueError("LOCAL_DATABASE_URL must explicitly identify the separate testing database")
        if "*" in self.cors_origins.split(","):
            raise ValueError("Wildcard CORS is not allowed")
        return self
