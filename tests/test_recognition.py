"""Regression tests for matching decisions and durable automatic attendance."""
from datetime import datetime, timezone
import sys
from pathlib import Path
from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.main import app
from app.attendance.engine import AttendanceEngine
from app.database.session import Base, get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import Admin, UserRole
from app.models.student import Student, StudentFaceProfile
from app.models.attendance import AttendanceSession, AttendanceEvent
from app.api import recognition
from app.face_recognition.engine import FaceRecognitionEngine, MODEL_VERSION, MODEL_DIR, ModelUnavailable

@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr(AttendanceEngine, "server_now", staticmethod(lambda: datetime(2026, 10, 2, 4, 0, tzinfo=timezone.utc)))
    engine = create_engine(f"sqlite:///{tmp_path / 'attendance.db'}", connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add(Admin(email='camera@test.com', full_name='Operator', hashed_password='unused', role=UserRole.ADMIN, is_active=True))
        db.add(Student(student_id='REAL001', full_name='Enrolled Student', email='student@test.com', status='Active'))
        db.commit()
        db.add(StudentFaceProfile(student_id=1, embedding_vector={'model': MODEL_VERSION, 'vector': [1.0] + [0.0]*127}, reference_image_path='/uploads/profile.jpg'))
        db.commit()
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    recognition.observations.clear()
    headers = {'Authorization': f"Bearer {create_access_token({'sub': 'camera@test.com'})}"}
    with TestClient(app) as client:
        yield client, factory, headers
    app.dependency_overrides.clear()
    engine.dispose()


def observation(vector=None, quality='OK'):
    return np.zeros((480,640,3), np.uint8), [{'bbox':[100,100,120,120], 'embedding':vector, 'quality':quality}]


def send(client, headers, camera='test-camera'):
    return client.post('/api/recognition/frame', headers=headers, data={'camera_id':camera}, files={'file':('frame.jpg', b'frame', 'image/jpeg')})


def test_requires_authentication_and_disables_forged_identity(setup):
    client, factory, headers = setup
    assert send(client, {}).status_code == 401
    assert send(client, {'X-Face-Service-Token':'invalid'}).status_code == 401
    assert client.post('/api/attendance/events', headers=headers, json={'student_id':1, 'confidence':1, 'camera_id':'test-camera'}).status_code == 410


def test_continuous_match_and_reentry_preserve_original_attendance(setup, monkeypatch):
    client, factory, headers = setup
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: observation([1.0]+[0.0]*127))
    for _ in range(settings.FACE_CONFIRM_FRAMES-1):
        assert send(client, headers).json()['state'] == 'VERIFYING'
    result = send(client, headers).json()
    assert result['attendance']['action'] == 'CHECK_IN'
    assert result['attendance']['student']['full_name'] == 'Enrolled Student'
    assert result['attendance']['timestamp'].endswith('+00:00')
    for _ in range(8):
        assert send(client, headers).json()['attendance']['action'] == 'ALREADY_RECORDED'
    recognition.observations.clear()  # Process/monitor restart still consults durable DB.
    for _ in range(settings.FACE_CONFIRM_FRAMES):
        result = send(client, headers, 'another-camera').json()
    assert result['attendance']['action'] == 'ALREADY_RECORDED'
    with factory() as db:
        assert db.query(AttendanceSession).count() == 1
        assert db.query(AttendanceEvent).count() == 1
        assert db.query(AttendanceSession).first().check_out_time is None

    # A verified re-entry must preserve the original attendance too.
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: (np.zeros((480, 640, 3), np.uint8), []))
    assert send(client, headers).json()['state'] == 'NO_FACE'
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: observation([1.0]+[0.0]*127))
    for _ in range(settings.FACE_CONFIRM_FRAMES - 1):
        assert send(client, headers).json()['state'] == 'VERIFYING'
    result = send(client, headers).json()
    assert result['attendance']['action'] == 'ALREADY_RECORDED'
    with factory() as db:
        session = db.query(AttendanceSession).one()
        assert session.check_out_time is None
        assert db.query(AttendanceEvent).count() == 1


@pytest.mark.parametrize('kind', ['blank', 'unknown', 'multiple', 'blurred', 'legacy', 'inactive', 'ambiguous'])
def test_unverified_faces_never_record_attendance(setup, monkeypatch, kind):
    client, factory, headers = setup
    image, faces = observation([1.0]+[0.0]*127)
    if kind == 'blank': faces = []
    if kind == 'unknown': faces[0]['embedding'] = [0.0,1.0]+[0.0]*126
    if kind == 'multiple': faces = faces * 2
    if kind == 'blurred': faces[0].update(embedding=None, quality='Blurred')
    with factory() as db:
        if kind == 'legacy': db.query(StudentFaceProfile).first().embedding_vector = [1.0]+[0.0]*127
        if kind == 'inactive': db.query(Student).first().status = 'Inactive'
        if kind == 'ambiguous':
            db.add(Student(student_id='SECOND', full_name='Second', email='second@test.com', status='Active'))
            db.flush()
            db.add(StudentFaceProfile(student_id=2, embedding_vector={'model':MODEL_VERSION,'vector':[1.0]+[0.0]*127}, reference_image_path='second.jpg'))
        db.commit()
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: (image, faces))
    for _ in range(5):
        result = send(client, headers).json()
        assert result['attendance'] is None
    with factory() as db:
        assert db.query(AttendanceSession).count() == 0


def test_no_face_breaks_confirmation_streak(setup, monkeypatch):
    client, factory, headers = setup
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: observation([1.0]+[0.0]*127))
    send(client, headers)
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: (np.zeros((480,640,3), np.uint8), []))
    send(client, headers)
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: observation([1.0]+[0.0]*127))
    assert send(client, headers).json()['state'] == 'VERIFYING'


def test_missing_model_fails_closed(setup, monkeypatch):
    client, factory, headers = setup
    def unavailable(data): raise ModelUnavailable('Models unavailable')
    monkeypatch.setattr(recognition.face_engine, 'analyze', unavailable)
    assert send(client, headers).status_code == 503


def test_concurrent_cameras_write_once(setup):
    _, factory, _ = setup
    def record(_):
        with factory() as db:
            return recognition.record_daily_attendance(db, 1, .8, 'camera')['action']
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(record, range(8)))
    assert results.count('CHECK_IN') == 1


def test_real_detector_rejects_blank_and_invalid_image():
    if not (MODEL_DIR / 'face_detection_yunet_2023mar.onnx').exists():
        pytest.skip('Run backend/download_models.py for model integration test')
    engine = FaceRecognitionEngine()
    assert engine.analyze(np.zeros((480,640,3), np.uint8))[1] == []
    with pytest.raises(ValueError): engine.analyze(b'not an image')
    with pytest.raises(ValueError): engine.extract_embedding(np.zeros((480,640,3), np.uint8))


def test_real_photo_enrollment_to_attendance(setup, monkeypatch, tmp_path):
    import os
    source = os.getenv('FACE_TEST_IMAGE')
    other_source = os.getenv('FACE_TEST_OTHER_IMAGE')
    if not source or not other_source:
        pytest.skip('Set FACE_TEST_IMAGE and FACE_TEST_OTHER_IMAGE to run real-photo integration test')
    client, factory, headers = setup
    monkeypatch.setattr(settings, 'PROFILES_DIR', str(tmp_path / 'profiles'))
    photo = Path(source).read_bytes()
    blank = cv2.imencode('.jpg', np.zeros((480,640,3), np.uint8))[1].tobytes()
    assert client.post('/api/students/1/photo', headers=headers, files={'file':('blank.jpg',blank)}).status_code == 400
    uploaded = client.post('/api/students/1/photo', headers=headers, files={'file':('profile.jpg',photo)})
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()['has_face_profile'] is True
    with factory() as db:
        db.add(Student(student_id='DUPLICATE',full_name='Other Student',email='other@test.com',status='Active'))
        db.commit()
    duplicate = client.post('/api/students/2/photo',headers=headers,files={'file':('same.jpg',photo)})
    assert duplicate.status_code == 409
    changed = cv2.convertScaleAbs(cv2.imdecode(np.frombuffer(photo,np.uint8),cv2.IMREAD_COLOR),alpha=.9,beta=12)
    changed_bytes = cv2.imencode('.jpg', changed)[1].tobytes()
    for _ in range(settings.FACE_CONFIRM_FRAMES):
        result = client.post('/api/recognition/frame',headers=headers,data={'camera_id':'real-model-test'},files={'file':('frame.jpg',changed_bytes)})
        assert result.status_code == 200, result.text
    assert result.json()['attendance']['action'] == 'CHECK_IN'
    different = cv2.resize(cv2.imread(other_source),None,fx=3,fy=3)
    other_bytes = cv2.imencode('.jpg', different)[1].tobytes()
    for _ in range(3):
        result = client.post('/api/recognition/frame',headers=headers,data={'camera_id':'real-model-test'},files={'file':('frame.jpg',other_bytes)})
        assert result.json()['state'] == 'UNKNOWN', result.text
        assert result.json()['attendance'] is None
    with factory() as db:
        assert db.query(AttendanceSession).count() == 1


@pytest.mark.parametrize('clock,accepted', [('09:30:00', True), ('09:59:59', True), ('10:00:00', False), ('10:15:00', False)])
def test_cutoff_direct_camera_api_and_database(setup, monkeypatch, clock, accepted):
    client, factory, headers = setup
    now = datetime.fromisoformat(f'2026-10-02T{clock}+05:30')
    monkeypatch.setattr(AttendanceEngine, 'server_now', staticmethod(lambda: now))
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: observation([1.0]+[0.0]*127))
    for _ in range(settings.FACE_CONFIRM_FRAMES):
        response = send(client, headers)
    assert response.status_code == 200
    result = response.json()
    attendance = result['attendance']
    assert attendance['success'] is accepted
    assert attendance['student']['id'] == 1
    if not accepted:
        assert attendance['code'] == 'ATTENDANCE_CUTOFF_PASSED'
        assert attendance['cutoffTime'] == '10:00 AM'
        assert attendance['currentTime'] == now.isoformat()
        assert result['faces'][0]['label'] == 'Student verified — attendance deadline passed'
        # Camera keeps recognizing; repeated calls cannot insert either sessions or events.
        assert send(client, headers).json()['attendance']['code'] == 'ATTENDANCE_CUTOFF_PASSED'
    with factory() as db:
        assert db.query(AttendanceSession).count() == int(accepted)
        assert db.query(AttendanceEvent).count() == int(accepted)
        if accepted:
            assert db.query(AttendanceSession).one().check_in_time == now.astimezone(timezone.utc).replace(tzinfo=None)


def test_original_0920_attendance_survives_1030_detection(setup, monkeypatch):
    client, factory, headers = setup
    monkeypatch.setattr(recognition.face_engine, 'analyze', lambda data: observation([1.0]+[0.0]*127))
    now = datetime.fromisoformat('2026-10-02T09:20:00+05:30')
    monkeypatch.setattr(AttendanceEngine, 'server_now', staticmethod(lambda: now))
    for _ in range(settings.FACE_CONFIRM_FRAMES):
        first = send(client, headers).json()['attendance']
    now = datetime.fromisoformat('2026-10-02T10:30:00+05:30')
    again = send(client, headers).json()['attendance']
    assert again['action'] == 'ALREADY_RECORDED'
    assert again['check_in_time'] == first['check_in_time']
    assert again['status'] == 'Present'
    with factory() as db:
        row = db.query(AttendanceSession).one()
        assert row.check_in_time == datetime(2026, 10, 2, 3, 50)
        assert row.check_out_time is None
        assert db.query(AttendanceEvent).count() == 1
        # Even a previously closed session counts as today's recorded attendance.
        row.check_out_time = datetime(2026, 10, 2, 4, 0)
        db.commit()
    assert send(client, headers).json()['attendance']['action'] == 'ALREADY_RECORDED'
    with factory() as db:
        assert db.query(AttendanceSession).count() == 1
        assert db.query(AttendanceSession).one().check_out_time == datetime(2026, 10, 2, 4, 0)


def test_manual_api_cannot_backdate_after_cutoff(setup, monkeypatch):
    client, factory, headers = setup
    monkeypatch.setattr(AttendanceEngine, 'server_now', staticmethod(lambda: datetime.fromisoformat('2026-10-02T10:15:00+05:30')))
    response = client.post('/api/attendance/manual', headers=headers, json={
        'student_id': 1, 'session_date': '2026-10-01', 'check_in_time': '2026-10-01T09:20:00+05:30'})
    assert response.status_code == 403
    assert response.json()['code'] == 'ATTENDANCE_CUTOFF_PASSED'
    with factory() as db:
        assert db.query(AttendanceSession).count() == 0
        assert db.query(AttendanceEvent).count() == 0
        result = AttendanceEngine.process_recognition_event(db, 1, .9, 'legacy', timestamp=datetime(2026, 10, 1, 3, 0))
        assert result['code'] == 'ATTENDANCE_CUTOFF_PASSED'
        assert db.query(AttendanceSession).count() == 0


def test_saved_settings_and_timezone_drive_cutoff(setup, monkeypatch):
    client, factory, headers = setup
    monkeypatch.setattr(settings, 'ATTENDANCE_TIMEZONE', 'America/New_York')
    monkeypatch.setattr(AttendanceEngine, 'server_now', staticmethod(lambda: datetime.fromisoformat('2026-10-03T00:30:00+00:00')))
    assert client.put('/api/admin/settings', headers=headers, json={'attendance_start_time':'08:00', 'attendance_cutoff_time':'20:31'}).status_code == 200
    saved = client.get('/api/admin/settings', headers=headers).json()
    assert saved['attendance_cutoff_time'] == '20:31'
    with factory() as db:
        result = recognition.record_daily_attendance(db, 1, .9, 'timezone-camera')
        assert result['action'] == 'CHECK_IN'
        assert result['session_date'] == '2026-10-02'
        row = db.query(AttendanceSession).one()
        assert str(row.session_date) == '2026-10-02'
    for invalid in ['25:00', '10:60', '9:00', '', None]:
        assert client.put('/api/admin/settings', headers=headers, json={'attendance_cutoff_time':invalid}).status_code == 422
    assert client.put('/api/admin/settings', headers=headers, json={'attendance_start_time':'21:00'}).status_code == 422


def test_configured_cutoff_boundary_and_start(setup, monkeypatch):
    client, factory, headers = setup
    assert client.put('/api/admin/settings', headers=headers, json={'attendance_start_time':'08:00', 'attendance_cutoff_time':'09:00'}).status_code == 200
    for clock, code in [('07:59:59', 'ATTENDANCE_NOT_STARTED'), ('09:00:00', 'ATTENDANCE_CUTOFF_PASSED')]:
        monkeypatch.setattr(AttendanceEngine, 'server_now', staticmethod(lambda: datetime.fromisoformat(f'2026-10-02T{clock}+05:30')))
        with factory() as db:
            assert recognition.record_daily_attendance(db, 1, .9, 'camera')['code'] == code
            assert db.query(AttendanceSession).count() == 0
    monkeypatch.setattr(AttendanceEngine, 'server_now', staticmethod(lambda: datetime.fromisoformat('2026-10-02T08:00:00+05:30')))
    with factory() as db:
        assert recognition.record_daily_attendance(db, 1, .9, 'camera')['action'] == 'CHECK_IN'
