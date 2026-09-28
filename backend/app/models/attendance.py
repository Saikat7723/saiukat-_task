from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Float, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database.session import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    camera_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    location = Column(String(100), nullable=False)
    stream_url_or_index = Column(String(255), nullable=False)
    status = Column(String(20), default="Active", nullable=False) # Active / Offline / Maintenance
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    session_date = Column(Date, default=date.today, nullable=False, index=True)
    check_in_time = Column(DateTime, nullable=False, index=True)
    check_out_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="Present", nullable=False) # Present / Late / Early Exit / Manual
    confidence = Column(Float, nullable=True)
    camera_id = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("Student", back_populates="attendance_sessions")

    __table_args__ = (
        # Note: multiple sessions per day are permitted if check-out occurred, but typically tracked per session
    )

class AttendanceEvent(Base):
    __tablename__ = "attendance_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String(30), nullable=False) # CHECK_IN, CHECK_OUT, COOLDOWN_SKIPPED, UNKNOWN_FACE, LOW_CONFIDENCE
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    confidence = Column(Float, nullable=True)
    camera_id = Column(String(50), nullable=True)
    raw_info = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class AttendanceSetting(Base):
    __tablename__ = "attendance_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    setting_key = Column(String(50), unique=True, index=True, nullable=False)
    setting_value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(100), nullable=False)
    holiday_date = Column(Date, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
