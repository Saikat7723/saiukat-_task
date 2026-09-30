from pydantic import BaseModel, field_serializer
from typing import Optional, List, Any
from datetime import date, datetime, timezone

class StudentSimpleInfo(BaseModel):
    id: int
    student_id: str
    full_name: str
    email: str
    profile_photo_path: Optional[str] = None
    department_name: Optional[str] = None

    class Config:
        from_attributes = True

class AttendanceSessionResponse(BaseModel):
    id: int
    student_id: int
    session_date: date
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    duration_minutes: int
    status: str
    confidence: Optional[float] = None
    camera_id: Optional[str] = None
    notes: Optional[str] = None
    student: Optional[StudentSimpleInfo] = None

    @field_serializer("check_in_time", "check_out_time", when_used="json")
    def serialize_utc_time(self, value: Optional[datetime]):
        """Database timestamps are UTC; keep that fact when sending them to browsers."""
        return value.replace(tzinfo=timezone.utc).isoformat() if value else None

    class Config:
        from_attributes = True

class AttendanceEventCreate(BaseModel):
    student_id: int
    confidence: float
    camera_id: str
    timestamp: Optional[datetime] = None

class ManualAttendanceCreate(BaseModel):
    student_id: int
    session_date: date
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    status: str = "Present"
    notes: Optional[str] = None

class AttendanceSummaryStats(BaseModel):
    total_working_days: int
    present_days: int
    absent_days: int
    attendance_percentage: float
    avg_duration_minutes: float
