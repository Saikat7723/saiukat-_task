"""YuNet detection and aligned SFace embeddings. No synthetic fallback."""
import os
from pathlib import Path
from threading import RLock
import cv2
import numpy as np

MODEL_VERSION = "sface-2021dec-v1"
MODEL_DIR = Path(os.getenv("FACE_MODEL_DIR", str(Path(__file__).resolve().parents[2] / "models")))

class ModelUnavailable(RuntimeError):
    pass

class FaceRecognitionEngine:
    def __init__(self):
        self.lock = RLock()
        self.detector = self.recognizer = None

    def load(self):
        with self.lock:
            if self.detector is not None:
                return
            detection = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
            recognition = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
            if not detection.exists() or not recognition.exists():
                raise ModelUnavailable("Face models missing. Run: python download_models.py in backend.")
            try:
                detector = cv2.FaceDetectorYN.create(str(detection), "", (320, 320), 0.9)
                recognizer = cv2.FaceRecognizerSF.create(str(recognition), "")
            except cv2.error as exc:
                raise ModelUnavailable("Face models could not be loaded; check model files and OpenCV version.") from exc
            self.detector, self.recognizer = detector, recognizer

    @staticmethod
    def decode(source):
        if isinstance(source, bytes):
            if not source or len(source) > 5 * 1024 * 1024:
                raise ValueError("Image must be between 1 byte and 5 MB.")
            source = cv2.imdecode(np.frombuffer(source, dtype=np.uint8), cv2.IMREAD_COLOR)
        if source is None or not isinstance(source, np.ndarray) or source.ndim != 3:
            raise ValueError("Invalid image. Upload a JPEG or PNG photo.")
        if source.shape[0] * source.shape[1] > 16_000_000:
            raise ValueError("Image exceeds 16 megapixels.")
        return source

    def analyze(self, source):
        image = self.decode(source)
        with self.lock:
            self.load()
            height, width = image.shape[:2]
            scale = min(1.0, 960 / max(height, width))
            small = cv2.resize(image, (round(width * scale), round(height * scale))) if scale < 1 else image
            self.detector.setInputSize((small.shape[1], small.shape[0]))
            _, detected = self.detector.detect(small)
            result = []
            for row in ([] if detected is None else detected):
                row = row.copy()
                row[:14] /= scale
                x, y, w, h = row[:4]
                entry = {"bbox": [int(x), int(y), int(w), int(h)], "embedding": None, "quality": "Move closer and face the camera"}
                if min(w, h) >= 70 and x >= 0 and y >= 0 and x + w <= width and y + h <= height:
                    aligned = self.recognizer.alignCrop(image, row)
                    sharpness = cv2.Laplacian(cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
                    if sharpness >= 25:
                        vector = self.recognizer.feature(aligned).flatten()
                        vector /= max(float(np.linalg.norm(vector)), 1e-12)
                        entry.update(embedding=vector.tolist(), quality="OK")
                    else:
                        entry["quality"] = "Photo is blurred; hold still in good light"
                result.append(entry)
            return image, result

    def detect_faces(self, source):
        return [tuple(face["bbox"]) for face in self.analyze(source)[1]]

    def extract_embedding(self, source, face_bbox=None):
        _, faces = self.analyze(source)
        if len(faces) != 1:
            raise ValueError("Exactly one visible face is required.")
        if faces[0]["embedding"] is None:
            raise ValueError(faces[0]["quality"])
        return {"model": MODEL_VERSION, "vector": faces[0]["embedding"]}

    @staticmethod
    def valid_profile(profile):
        if not profile or not profile.is_active:
            return False
        data = profile.embedding_vector
        if not isinstance(data, dict) or data.get("model") != MODEL_VERSION:
            return False
        try:
            vector = np.asarray(data.get("vector", []), dtype=np.float32)
        except (TypeError, ValueError):
            return False
        return vector.shape == (128,) and bool(np.isfinite(vector).all()) and float(np.linalg.norm(vector)) > 0

    @staticmethod
    def compare_embeddings(first, second):
        a, b = np.asarray(first, dtype=np.float32), np.asarray(second, dtype=np.float32)
        return float(np.clip(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)), -1, 1))

face_engine = FaceRecognitionEngine()

def get_match_threshold(db):
    from app.core.config import settings
    from app.models.attendance import AttendanceSetting
    row = db.query(AttendanceSetting).filter(AttendanceSetting.setting_key == "FACE_RECOGNITION_THRESHOLD").first()
    try:
        value = float(row.setting_value) if row else settings.FACE_RECOGNITION_THRESHOLD
        if not 0.363 <= value <= 1:
            raise ValueError()
        return value
    except (ValueError, TypeError):
        raise ModelUnavailable("Invalid recognition threshold. Set a value between 0.363 and 1 in settings.")
