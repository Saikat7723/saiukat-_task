from fastapi.responses import JSONResponse
import csv
import io
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.database.session import get_db
from app.models.attendance import AttendanceSession, AttendanceEvent, AttendanceSetting, Holiday
from app.models.student import Student
from app.models.academic import Department, Course
from app.models.system import AuditLog
from app.schemas.attendance import (
    AttendanceSessionResponse,
    AttendanceEventCreate,
    ManualAttendanceCreate,
    AttendanceSummaryStats
)
from app.attendance.engine import AttendanceEngine
from app.core.security import get_current_user, Admin

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.get("", response_model=List[AttendanceSessionResponse])
def list_attendance_sessions(
    search: Optional[str] = Query(None),
    student_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    query = db.query(AttendanceSession).join(Student)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Student.full_name.ilike(term),
                Student.student_id.ilike(term)
            )
        )
    if student_id:
        query = query.filter(AttendanceSession.student_id == student_id)
    if department_id:
        query = query.filter(Student.department_id == department_id)
    if course_id:
        query = query.filter(Student.course_id == course_id)
    if status_filter:
        query = query.filter(AttendanceSession.status == status_filter)
    if date_from:
        query = query.filter(AttendanceSession.session_date >= date_from)
    if date_to:
        query = query.filter(AttendanceSession.session_date <= date_to)

    sessions = query.order_by(AttendanceSession.check_in_time.desc()).offset(skip).limit(limit).all()

    # Format student simple info
    results = []
    for sess in sessions:
        stu = sess.student
        dept_name = stu.department.name if stu and stu.department else None
        res = AttendanceSessionResponse.model_validate(sess)
        if stu:
            res.student = {
                "id": stu.id,
                "student_id": stu.student_id,
                "full_name": stu.full_name,
                "email": stu.email,
                "profile_photo_path": stu.profile_photo_path,
                "department_name": dept_name
            }
        results.append(res)

    return results

@router.post("/events")
def receive_attendance_event(
    event_in: AttendanceEventCreate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    """
    Receives face recognition events sent by the standalone camera / face recognition microservice.
    """
    raise HTTPException(status_code=410, detail="Client-supplied matches are disabled. Submit a camera image to /recognition/frame.")

@router.post("/manual", response_model=AttendanceSessionResponse)
def create_manual_attendance(
    manual_in: ManualAttendanceCreate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    # Manual submissions must not bypass the server clock by supplying an old date/time.
    result = AttendanceEngine.record_daily_attendance(db, manual_in.student_id, 1.0, "MANUAL_OVERRIDE")
    if not result["success"]:
        return JSONResponse(status_code=403, content=result)
    session = db.get(AttendanceSession, result["session_id"])
    if result["action"] == "CHECK_IN":
        session.notes = manual_in.notes
        db.add(AuditLog(admin_id=current_user.id, admin_email=current_user.email,
            action="ATTENDANCE_MANUAL_CREATE", target_type="AttendanceSession",
            target_id=str(session.id), details="Manual attendance validated against server time"))
        db.commit()
        db.refresh(session)
    res = AttendanceSessionResponse.model_validate(session)
    res.student = result["student"]
    return res


@router.post("/{session_id}/checkout")
def check_out_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    """Close an active verified session after the operator confirms departure."""
    session = db.query(AttendanceSession).join(Student).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")
    if session.check_out_time:
        raise HTTPException(status_code=409, detail="This attendance session has already been checked out")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if now < session.check_in_time:
        raise HTTPException(status_code=400, detail="Check-out cannot be earlier than check-in")

    session.check_out_time = now
    session.duration_minutes = max(0, int((now - session.check_in_time).total_seconds() // 60))
    db.add(AttendanceEvent(
        student_id=session.student_id,
        event_type="CHECK_OUT",
        timestamp=now,
        confidence=session.confidence,
        camera_id=session.camera_id,
        raw_info="Operator confirmed check-out from the live attendance monitor"
    ))
    db.add(AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="ATTENDANCE_CHECK_OUT",
        target_type="AttendanceSession",
        target_id=str(session.id),
        details=f"Checked out {session.student.full_name} from attendance session {session.id}"
    ))
    db.commit()
    db.refresh(session)

    return {
        "success": True,
        "action": "CHECK_OUT",
        "session_id": session.id,
        "timestamp": session.check_out_time.replace(tzinfo=timezone.utc).isoformat(),
        "check_in_time": session.check_in_time.replace(tzinfo=timezone.utc).isoformat(),
        "check_out_time": session.check_out_time.replace(tzinfo=timezone.utc).isoformat(),
        "duration_minutes": session.duration_minutes,
        "student": {
            "id": session.student.id,
            "student_id": session.student.student_id,
            "full_name": session.student.full_name,
            "email": session.student.email,
            "profile_photo_path": session.student.profile_photo_path,
            "department_name": session.student.department.name if session.student.department else None,
            "course_name": session.student.course.name if session.student.course else None,
        },
    }

@router.get("/student/{student_id}/summary", response_model=AttendanceSummaryStats)
def get_student_attendance_summary(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    sessions = db.query(AttendanceSession).filter(AttendanceSession.student_id == student_id).all()
    
    start_date = student.date_of_joining or (date.today() - timedelta(days=30))
    total_working_days = max(1, (date.today() - start_date).days + 1)
    
    present_days = len(set(s.session_date for s in sessions if s.status in ["Present", "Late"]))
    absent_days = max(0, total_working_days - present_days)
    attendance_pct = round((present_days / total_working_days) * 100, 1) if total_working_days > 0 else 0.0
    
    total_duration = sum(s.duration_minutes for s in sessions)
    avg_duration = round(total_duration / len(sessions), 1) if len(sessions) > 0 else 0.0

    return {
        "total_working_days": total_working_days,
        "present_days": present_days,
        "absent_days": absent_days,
        "attendance_percentage": attendance_pct,
        "avg_duration_minutes": avg_duration
    }

@router.get("/student/{student_id}/calendar")
def get_student_attendance_calendar(
    student_id: int,
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    """
    Returns calendar data for a specific student for a given year & month.
    Visual states: Present, Absent, Holiday, Leave, No Data
    """
    today = date.today()
    year = year or today.year
    month = month or today.month
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.student_id == student_id,
        func.extract('year', AttendanceSession.session_date) == year,
        func.extract('month', AttendanceSession.session_date) == month
    ).all()

    holidays = db.query(Holiday).filter(
        func.extract('year', Holiday.holiday_date) == year,
        func.extract('month', Holiday.holiday_date) == month
    ).all()

    holiday_map = {h.holiday_date.isoformat(): h.title for h in holidays}
    session_map = {}
    for s in sessions:
        d_str = s.session_date.isoformat()
        session_map[d_str] = {
            "status": s.status,
            "check_in": s.check_in_time.strftime("%I:%M %p"),
            "check_out": s.check_out_time.strftime("%I:%M %p") if s.check_out_time else None,
            "duration_minutes": s.duration_minutes
        }

    return {
        "year": year,
        "month": month,
        "sessions": session_map,
        "holidays": holiday_map
    }

@router.get("/export/csv")
def export_attendance_csv(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    query = db.query(AttendanceSession).join(Student)
    if date_from:
        query = query.filter(AttendanceSession.session_date >= date_from)
    if date_to:
        query = query.filter(AttendanceSession.session_date <= date_to)
    if department_id:
        query = query.filter(Student.department_id == department_id)

    sessions = query.order_by(AttendanceSession.session_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Session ID", "Student ID", "Student Name", "Department", "Date", "Check In", "Check Out", "Duration (mins)", "Status", "Confidence"])

    for s in sessions:
        writer.writerow([
            s.id,
            s.student.student_id if s.student else "",
            s.student.full_name if s.student else "",
            s.student.department.name if s.student and s.student.department else "",
            s.session_date.isoformat(),
            s.check_in_time.strftime("%Y-%m-%d %H:%M:%S"),
            s.check_out_time.strftime("%Y-%m-%d %H:%M:%S") if s.check_out_time else "N/A",
            s.duration_minutes,
            s.status,
            f"{s.confidence:.2f}" if s.confidence else "N/A"
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_report_{date.today().isoformat()}.csv"}
    )
