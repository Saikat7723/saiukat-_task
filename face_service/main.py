"""Optional unattended USB/IP camera agent. Recognition stays in the main API.
For a browser camera, use Live Attendance instead; do not open the same USB camera twice.
"""
import asyncio
import os
from contextlib import asynccontextmanager
import cv2
import httpx
from fastapi import FastAPI

API = os.getenv("MAIN_API_URL", "http://127.0.0.1:8000/api").rstrip('/')
TOKEN = os.getenv("FACE_SERVICE_TOKEN", "")
SOURCE = os.getenv("CAMERA_SOURCE", os.getenv("CAMERA_INDEX", "0"))
CAMERA_ID = os.getenv("CAMERA_ID", "")
state = {"status": "OFFLINE", "message": "Camera agent not started", "camera_id": CAMERA_ID}

async def run_camera():
    if not TOKEN:
        state.update(status="NOT_CONFIGURED", message="Set FACE_SERVICE_TOKEN on backend and camera agent, or use the browser Live Attendance monitor.")
        return
    capture = None
    try:
        async with httpx.AsyncClient(timeout=20, headers={"X-Face-Service-Token": TOKEN}) as client:
            while True:
                try:
                    if capture is None:
                        capture = await asyncio.to_thread(cv2.VideoCapture, int(SOURCE) if SOURCE.isdigit() else SOURCE)
                    ok, frame = await asyncio.to_thread(capture.read)
                    if not ok:
                        state.update(status="OFFLINE", message="Camera unavailable; reconnecting")
                        capture.release(); capture = None
                        await asyncio.sleep(3)
                        continue
                    height, width = frame.shape[:2]
                    if width > 960:
                        frame = cv2.resize(frame, (960, round(height * 960 / width)))
                    ok, jpeg = cv2.imencode('.jpg', frame)
                    if not ok:
                        raise ValueError("Could not encode camera frame")
                    response = await client.post(f"{API}/recognition/frame", files={"file": ("frame.jpg", jpeg.tobytes(), "image/jpeg")}, data={"camera_id": CAMERA_ID})
                    response.raise_for_status()
                    result = response.json()
                    # No images, embeddings or student identities on the unauthenticated status endpoint.
                    state.update(status="ONLINE", message=result["message"], detected_faces_count=len(result["faces"]))
                except (httpx.HTTPError, ValueError, cv2.error) as exc:
                    state.update(status="ERROR", message=f"Camera/API error: {type(exc).__name__}")
                    await asyncio.sleep(3)
                await asyncio.sleep(0.45)
    finally:
        if capture is not None:
            capture.release()
        state.update(status="OFFLINE", message="Camera agent stopped")

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(run_camera())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="Attendance camera agent", lifespan=lifespan)

@app.get('/status')
def status():
    return state

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001)
