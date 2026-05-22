"""MinIO / local file storage service."""
import os
import uuid
from datetime import timedelta
from app.core.config import settings

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Try MinIO, fall back to local filesystem
try:
    from minio import Minio
    _minio_client = Minio(
        os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        secure=False,
    )
    _use_minio = True
except Exception:
    _minio_client = None
    _use_minio = False


def save_file(file_data: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """Save file and return the storage path."""
    ext = os.path.splitext(filename)[1] or ".jpg"
    stored_name = f"{uuid.uuid4().hex}{ext}"

    if _use_minio:
        bucket = "ocr-uploads"
        if not _minio_client.bucket_exists(bucket):
            _minio_client.make_bucket(bucket)
        import io
        _minio_client.put_object(
            bucket, stored_name,
            io.BytesIO(file_data), len(file_data),
            content_type=content_type,
        )
        return f"minio://{bucket}/{stored_name}"
    else:
        filepath = os.path.join(UPLOAD_DIR, stored_name)
        with open(filepath, "wb") as f:
            f.write(file_data)
        return filepath


def get_file_url(path: str, expires: int = 3600) -> str:
    """Get a presigned URL for the file."""
    if path.startswith("minio://"):
        bucket, key = path[8:].split("/", 1)
        if _minio_client:
            return _minio_client.presigned_get_object(bucket, key, expires=timedelta(seconds=expires))
    return f"/uploads/{os.path.basename(path)}"
