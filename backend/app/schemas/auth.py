from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
from app.models.user import UserRole

class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    account_type: Optional[Literal["student", "admin"]] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    account_type: Literal["student", "admin"] = "student"


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    student_id: Optional[str] = None
    profile_photo_path: Optional[str] = None

    class Config:
        from_attributes = True

TokenResponse.model_rebuild()
