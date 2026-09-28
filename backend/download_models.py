"""Download official OpenCV Zoo models; validate against Git LFS SHA-256."""
import hashlib
import re
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent / "models"
MODELS = ["face_detection_yunet/face_detection_yunet_2023mar.onnx",
          "face_recognition_sface/face_recognition_sface_2021dec.onnx"]

def main():
    ROOT.mkdir(exist_ok=True)
    for model in MODELS:
        pointer_url = f"https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/{model}"
        with urlopen(pointer_url, timeout=60) as response:
            pointer = response.read().decode()
        checksum = re.search(r"oid sha256:([0-9a-f]{64})", pointer).group(1)
        destination = ROOT / Path(model).name
        if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == checksum:
            print(f"Verified {destination.name}")
            continue
        url = f"https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/{model}"
        with urlopen(url, timeout=180) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != checksum:
            raise RuntimeError(f"Model checksum mismatch: {model}")
        temporary = destination.with_suffix(".tmp")
        temporary.write_bytes(data)
        temporary.replace(destination)
        print(f"Downloaded and verified {destination.name}")

if __name__ == "__main__":
    main()
