from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, ForeignKey

from app.database.session import Base


class PasswordResetToken(Base):
    """Single-use password reset tokens for admins and students."""

    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    owner_type = Column(String(20), nullable=False)  # admin | student
    owner_id = Column(Integer, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
