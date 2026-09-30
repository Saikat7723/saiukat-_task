from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.attendance import Camera, AttendanceSetting
from app.models.academic import Department, Course
from app.models.system import AuditLog
from app.core.security import get_current_user, require_admin, Admin

router = APIRouter(prefix="/admin", tags=["Admin & System Settings"])

@router.get("/departments")
def list_departments(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(require_admin),
):
    """Return the institution's configured departments for admin forms."""
    return db.query(Department).order_by(Department.name.asc()).all()

@router.get("/courses")
def list_courses(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(require_admin),
):
    """Return real courses, optionally limited to the selected department."""
    query = db.query(Course)
    if department_id:
        query = query.filter(Course.department_id == department_id)
    return query.order_by(Course.name.asc()).all()

@router.get("/cameras")
def list_cameras(db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    return db.query(Camera).all()

@router.post("/cameras")
def add_camera(
    camera_code: str,
    name: str,
    location: str,
    stream_url: str,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(require_admin)
):
    camera = Camera(
        camera_code=camera_code,
        name=name,
        location=location,
        stream_url_or_index=stream_url,
        status="Active"
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera

@router.get("/settings")
def get_attendance_settings(db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    settings_list = db.query(AttendanceSetting).all()
    return {s.setting_key: s.setting_value for s in settings_list}

@router.put("/settings")
def update_attendance_settings(
    settings_data: dict,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(require_admin)
):
    for key, val in settings_data.items():
        setting = db.query(AttendanceSetting).filter(AttendanceSetting.setting_key == key).first()
        if setting:
            setting.setting_value = str(val)
        else:
            setting = AttendanceSetting(setting_key=key, setting_value=str(val))
            db.add(setting)
    db.commit()

    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="UPDATE_ATTENDANCE_SETTINGS",
        target_type="AttendanceSetting",
        details=f"Updated attendance settings: {settings_data}"
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Settings updated successfully"}

@router.get("/audit-logs")
def list_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return logs
