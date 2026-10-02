import os
from sqlalchemy import inspect, text
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database.session import engine, Base, SessionLocal
from app.core.academic_catalog import ensure_academic_catalog
from app.attendance.engine import AttendanceEngine
from app.api.auth import router as auth_router
from app.api.students import router as student_router
from app.api.attendance import router as attendance_router
from app.api.books import router as book_router
from app.api.book_issues import router as book_issue_router
from app.api.dashboard import router as dashboard_router
from app.api.admin import router as admin_router
from app.api.recognition import router as recognition_router
from app.api.student_portal import router as student_portal_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to trusted frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads directory for profile photos
os.makedirs(settings.PROFILES_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIRECTORY), name="uploads")

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(student_router, prefix=settings.API_V1_STR)
app.include_router(attendance_router, prefix=settings.API_V1_STR)
app.include_router(book_router, prefix=settings.API_V1_STR)
app.include_router(book_issue_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(recognition_router, prefix=settings.API_V1_STR)
app.include_router(student_portal_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def startup_event():
    # Ensure database tables exist
    Base.metadata.create_all(bind=engine)
    # Development databases created before student login was introduced need this additive column.
    if "hashed_password" not in {column["name"] for column in inspect(engine).get_columns("students")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE students ADD COLUMN hashed_password VARCHAR(255)"))
    student_columns = {column["name"] for column in inspect(engine).get_columns("students")}
    missing_student_columns = {
        "semester": "VARCHAR(50)",
        "enrollment_year": "INTEGER",
        "emergency_phone": "VARCHAR(20)",
        "remarks": "TEXT",
        "library_member": "BOOLEAN NOT NULL DEFAULT 1",
    }
    with engine.begin() as connection:
        for column_name, column_type in missing_student_columns.items():
            if column_name not in student_columns:
                connection.execute(text(f"ALTER TABLE students ADD COLUMN {column_name} {column_type}"))
    with SessionLocal() as db:
        ensure_academic_catalog(db)
        AttendanceEngine.ensure_settings(db)

@app.get("/")
def root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get(settings.API_V1_STR)
def api_root():
    """Expose a useful response for the API base URL used by the frontend."""
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "documentation": "/docs",
        "openapi": f"{settings.API_V1_STR}/openapi.json",
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": f"Internal Server Error: {str(exc)}",
            "error_code": "INTERNAL_SERVER_ERROR"
        }
    )
