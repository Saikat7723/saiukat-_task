import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import Admin
from app.models.student import Student
from app.models.password_reset import PasswordResetToken
from app.schemas.auth import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest, TokenResponse, UserResponse
from app.core.config import settings
from app.core.security import verify_password, create_access_token, get_current_principal, get_password_hash

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _reset_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _send_reset_email(recipient: str, reset_url: str, expires_at: datetime) -> bool:
    """Send a reset email when SMTP is configured; return False for local link mode."""
    if not settings.SMTP_HOST:
        return False
    message = EmailMessage()
    message["Subject"] = "Reset your Library & Attendance password"
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER
    message["To"] = recipient
    message.set_content(
        "We received a request to reset your Library & Attendance password.\n\n"
        f"Use this one-time link before {expires_at.isoformat(timespec='minutes')} UTC:\n{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email."
    )
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(message)
    return True

@router.post("/login", response_model=TokenResponse)
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    identifier = login_req.username_or_email.strip()
    user = db.query(Admin).filter(Admin.email == identifier).first()
    is_student = False
    if not user:
        user = db.query(Student).filter(
            (Student.email == identifier) | (Student.student_id == identifier),
            Student.status == "Active",
        ).first()
        is_student = user is not None

    if not user or not user.hashed_password or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password"
        )

    if not is_student and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    role = "student" if is_student else user.role.value
    token = create_access_token(data={"sub": user.email if is_student else user.email, "role": role, "id": user.id})
    user_payload = {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": role,
        "is_active": True,
        "student_id": user.student_id if is_student else None,
        "profile_photo_path": user.profile_photo_path if is_student else None,
    }
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_payload
    }


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Create a short-lived, single-use reset token for a real account."""
    email = str(payload.email).strip().lower()
    if payload.account_type == "admin":
        account = db.query(Admin).filter(Admin.email == email, Admin.is_active == True).first()
    else:
        account = db.query(Student).filter(Student.email == email, Student.status == "Active").first()

    # Always return the same generic response for unknown addresses.
    if account is None:
        return {"success": True, "message": "If that email is registered, a password reset link has been sent."}

    now = datetime.utcnow()
    owner_type = payload.account_type
    previous_tokens = db.query(PasswordResetToken).filter(
        PasswordResetToken.owner_type == owner_type,
        PasswordResetToken.owner_id == account.id,
        PasswordResetToken.used_at.is_(None),
    ).all()
    for previous in previous_tokens:
        previous.used_at = now

    raw_token = secrets.token_urlsafe(48)
    expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    db.add(PasswordResetToken(
        token_hash=_reset_token_hash(raw_token),
        owner_type=owner_type,
        owner_id=account.id,
        expires_at=expires_at,
    ))
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={quote(raw_token)}"
    try:
        delivered_by_email = _send_reset_email(account.email, reset_url, expires_at)
        db.commit()
    except (OSError, smtplib.SMTPException) as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Password reset email could not be sent. Please try again later.") from exc

    response = {
        "success": True,
        "message": "If that email is registered, a password reset link has been sent.",
        "delivery": "email" if delivered_by_email else "link",
        "expires_in_minutes": settings.PASSWORD_RESET_EXPIRE_MINUTES,
    }
    # SMTP is the production delivery path. The local link makes the same flow
    # testable when no mail server is configured, without inventing a password.
    if not delivered_by_email:
        response["reset_url"] = reset_url
    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == _reset_token_hash(payload.token),
        PasswordResetToken.used_at.is_(None),
    ).first()
    now = datetime.utcnow()
    if token_record is None or token_record.expires_at <= now:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    if token_record.owner_type == "admin":
        account = db.query(Admin).filter(Admin.id == token_record.owner_id, Admin.is_active == True).first()
    else:
        account = db.query(Student).filter(Student.id == token_record.owner_id, Student.status == "Active").first()
    if account is None:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    account.hashed_password = get_password_hash(payload.new_password)
    token_record.used_at = now
    db.query(PasswordResetToken).filter(
        PasswordResetToken.owner_type == token_record.owner_type,
        PasswordResetToken.owner_id == token_record.owner_id,
        PasswordResetToken.id != token_record.id,
        PasswordResetToken.used_at.is_(None),
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
    db.commit()
    return {"success": True, "message": "Your password has been reset. You can now sign in."}

@router.post("/logout")
def logout(current_user = Depends(get_current_principal)):
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user = Depends(get_current_principal)):
    if isinstance(current_user, Student):
        return {
            "id": current_user.id, "full_name": current_user.full_name, "email": current_user.email,
            "role": "student", "is_active": current_user.status == "Active",
            "student_id": current_user.student_id, "profile_photo_path": current_user.profile_photo_path,
        }
    return current_user
