from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime

class StudentBase(BaseModel):
    student_id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    department_id: Optional[int] = None
    course_id: Optional[int] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    date_of_joining: Optional[date] = None
    address: Optional[str] = None
    status: str = "Active"

class StudentCreate(StudentBase):
    password: str = Field(min_length=8, max_length=128)

class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    course_id: Optional[int] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    date_of_joining: Optional[date] = None
    address: Optional[str] = None
    status: Optional[str] = None

class DepartmentSimple(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True

class CourseSimple(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True

class StudentResponse(StudentBase):
    id: int
    profile_photo_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    department: Optional[DepartmentSimple] = None
    course: Optional[CourseSimple] = None
    has_face_profile: bool = False

    class Config:
        from_attributes = True
