from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    ENVIRONMENT: str = Field(...)
    DEBUG: bool = Field(...)

    database_url: str = Field(...)
    
    secret_key: str = Field(...)
    algorithm: str = Field(...)
    access_token_expire_minutes: int = Field(...)
    
    MIN_PASSWORD_LENGTH: int = Field(...)
    MAX_PASSWORD_LENGTH: int = Field(...)
    
    allowed_origins: List[str] = Field(...)
    allowed_methods: List[str] = Field(...)
    allowed_headers: List[str] = Field(...)
    
    MAIL_USERNAME: str = Field(...)
    MAIL_PASSWORD: str = Field(...)
    MAIL_FROM: str = Field(...)
    MAIL_PORT: int = Field(...)
    MAIL_SERVER: str = Field(...)
    MAIL_FROM_NAME: str = Field(...)
    MAIL_STARTTLS: bool = Field(...)
    MAIL_SSL_TLS: bool = Field(...)
    
    ENABLE_EMAIL_VERIFICATION: bool = Field(...)
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = Field(...)
    
    FRONTEND_URL: str = Field(...)
    
    MAX_LOGIN_ATTEMPTS: int = Field(...)
    LOGIN_ATTEMPT_WINDOW_MINUTES: int = Field(...)
    
    API_V1_PREFIX: str = Field(...)
    PROJECT_NAME: str = Field(...)
    VERSION: str = Field(...)
    
    MAX_REQUEST_SIZE: int = Field(...)
    
    LOG_LEVEL: str = Field(...)
    LOG_FILE: str = Field(...)
    ENABLE_FILE_LOGGING: bool = Field(...)
    
    ENABLE_REGISTRATION: bool = Field(...)
    ENABLE_PASSWORD_RESET: bool = Field(...)
    ENABLE_SOCIAL_LOGIN: bool = Field(...)
    
    MAX_SYNC_ITEMS_PER_REQUEST: int = Field(...)
    SYNC_BATCH_SIZE: int = Field(...)
    SYNC_DEBOUNCE_SECONDS: int = Field(...)

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()