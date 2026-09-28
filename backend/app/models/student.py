from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String(50), unique=True, index=True, nullable=False) # Roll Number
    full_name = Column(String(120), nullable=False, index=True)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    dob = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    date_of_joining = Column(Date, nullable=True)
    address = Column(Text, nullable=True)
    profile_photo_path = Column(String(255), nullable=True)
    status = Column(String(20), default="Active", nullable=False) # Active / Inactive
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("Department", back_populates="students")
    course = relationship("Course", back_populates="students")
    face_profile = relationship("StudentFaceProfile", back_populates="student", uselist=False, cascade="all, delete-orphan")
    attendance_sessions = relationship("AttendanceSession", back_populates="student", cascade="all, delete-orphan")
    book_issues = relationship("BookIssue", back_populates="student")

class StudentFaceProfile(Base):
    __tablename__ = "student_face_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), unique=True, nullable=False)
    embedding_vector = Column(JSON, nullable=False) # 128-d or 512-d list of floats
    face_bounding_box = Column(JSON, nullable=True) # {x, y, w, h}
    reference_image_path = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("Student", back_populates="face_profile")
