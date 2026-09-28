# Setup & Installation Guide

Production-Ready **Library Management + Student Attendance System** with OpenCV Face Recognition.

---

## 1. Quick Start with Docker Compose (Recommended)

Run the complete multi-container system (MySQL, FastAPI Backend, Face Recognition Service, React Frontend):

```bash
docker-compose -f docker/docker-compose.yml up --build
```

Access Services:
- **Frontend SaaS UI**: [http://localhost:3000](http://localhost:3000)
- **FastAPI REST API**: [http://localhost:8000](http://localhost:8000)
- **Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Face Recognition Microservice**: [http://localhost:8001](http://localhost:8001)

---

## 2. Local Manual Setup

### Prerequisites
- Python 3.12+
- Node.js v18+ & npm
- MySQL Server (Optional - automatic SQLite fallback included for instant local testing)

### Step A: Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt

# Create the admin account and empty operational configuration (no demo students, books, or attendance):
python seed.py

# Start FastAPI server:
uvicorn app.main:app --reload --port 8000
```

### Step B: Face Recognition Microservice Setup
```bash
cd face_service
python main.py
```
Leave `CAMERA_ID` empty when using the authenticated browser monitor. Set `CAMERA_ID`, `CAMERA_NAME`, `CAMERA_LOCATION`, and `CAMERA_SOURCE` only for a separately configured USB/IP camera agent.

### Step C: Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 3. Seed Credentials

Development environment credentials initialized by `python seed.py`:

| Role | Email | Password | Access Rights |
| ---- | ----- | -------- | ------------- |
| **System Admin** | `admin@library.com` | `admin123` | Full privileges (Students, Books, System Settings, Audit Logs) |
| **Librarian** | `librarian@library.com` | `lib123` | Book management, Issue/Return, Attendance views |

Students do not share the admin credentials. An administrator creates each student from **Add Student**, sets the student portal password, and captures one clear profile photo. The student then signs in from the same page with the roll number or email and that password. The student dashboard reads only that student's profile, verified attendance, and library records.

The live monitor sends camera frames to the backend. It requires a real enrolled face profile; an unknown face, blurred frame, missing model, or multiple faces never creates attendance. The system confirms the same match across consecutive frames and records one attendance session per student per local day.

---

## 4. Running Tests

Execute backend API and business logic unit tests:

```bash
pytest tests/test_api.py
```
