import os
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Library Management & Student Attendance System"
    API_V1_STR: str = "/api"
    
    # Database configuration
    # Default to MySQL, fallback to SQLite if needed for local testing
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:rootpassword@localhost:3306/library_db"
    )
    SQLITE_FALLBACK_URL: str = "sqlite:///./library_system.db"
    USE_SQLITE_FALLBACK_IF_MYSQL_UNAVAILABLE: bool = True
    
    # JWT security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "SUPER_SECRET_JWT_KEY_987654321_LIBRARY_SYSTEM_2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Face Recognition & Attendance Settings
    FACE_RECOGNITION_THRESHOLD: float = Field(default=0.60, ge=0.363, le=1.0)
    ATTENDANCE_COOLDOWN_SECONDS: int = int(os.getenv("ATTENDANCE_COOLDOWN_SECONDS", "300")) # 5 mins default
    AUTO_CHECKOUT_HOURS: int = 8
    OVERDUE_FINE_PER_DAY: float = float((os.getenv("OVERDUE_FINE_PER_DAY") or "0").strip() or "0")
    FACE_MATCH_MARGIN: float = Field(default=0.08, ge=0.01, le=1)
    FACE_CONFIRM_FRAMES: int = Field(default=3, ge=2, le=10)
    FACE_SERVICE_TOKEN: str = ""
    ATTENDANCE_TIMEZONE: str = "Asia/Kolkata"

    # Password reset delivery. Configure SMTP in production; local development
    # returns a one-time reset URL so the flow remains usable without a mail server.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    PASSWORD_RESET_EXPIRE_MINUTES: int = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
    SMTP_HOST: str = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "").strip()
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "").strip()
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
    
    # Storage
    UPLOAD_DIRECTORY: str = os.getenv("UPLOAD_DIRECTORY", "uploads")
    PROFILES_DIR: str = os.path.join("uploads", "profiles")
    
    # Camera
    # Optional persistent camera identifier. Browser monitors generate an id when this is blank.
    CAMERA_ID: str = os.getenv("CAMERA_ID", "").strip()
    
    class Config:
        case_sensitive = True

settings = Settings()
