from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.user import Admin, UserRole
from app.models.student import Student

# Password context supporting argon2 and bcrypt
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Admin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        subject: str = payload.get("sub")
        role: str = payload.get("role")
        if subject is None or role == UserRole.STUDENT.value:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(Admin).filter(Admin.email == subject, Admin.is_active == True).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_student(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Student:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate student credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        subject = payload.get("sub")
        if payload.get("role") != UserRole.STUDENT.value or not subject:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    student = db.query(Student).filter(
        (Student.email == subject) | (Student.student_id == subject),
        Student.status == "Active",
    ).first()
    if student is None:
        raise credentials_exception
    return student


def get_current_principal(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Return either Admin or Student for shared endpoints such as logout."""
    credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        subject, role = payload.get("sub"), payload.get("role")
    except JWTError:
        raise credentials_exception
    if role == UserRole.STUDENT.value:
        principal = db.query(Student).filter(
            (Student.email == subject) | (Student.student_id == subject), Student.status == "Active"
        ).first()
    else:
        principal = db.query(Admin).filter(Admin.email == subject, Admin.is_active == True).first()
    if principal is None:
        raise credentials_exception
    return principal

def require_admin(current_user: Admin = Depends(get_current_user)) -> Admin:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action"
        )
    return current_user
