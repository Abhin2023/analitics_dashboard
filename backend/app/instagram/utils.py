import os
import hmac
import hashlib
from cryptography.fernet import Fernet

from ..core.config import settings

WEBHOOK_VERIFY_TOKEN = os.getenv("IG_WEBHOOK_VERIFY_TOKEN", "")
APP_SECRET = os.getenv("IG_APP_SECRET", "")


def _get_fernet():
    # Reads from the shared Settings object (which loads from .env directly
    # via pydantic-settings), not os.getenv() — a value can be correctly
    # set in .env and used everywhere else in the app (JWT auth, etc.) while
    # still being invisible to os.getenv(), which only sees real OS process
    # environment variables. That mismatch was silently breaking this
    # encryption every time, independent of whether .env was actually
    # configured correctly.
    key = settings.TOKEN_ENCRYPTION_KEY or settings.JWT_SECRET_KEY
    if not key:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY or JWT_SECRET_KEY must be set for token encryption")
    derived = hashlib.sha256(key.encode()).digest()
    fernet_key = __import__("base64").urlsafe_b64encode(derived)
    return Fernet(fernet_key)


def encrypt_token(token: str) -> str:
    return _get_fernet().encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


def verify_webhook_signature(payload: bytes, signature_header: str) -> bool:
    if not APP_SECRET:
        return False
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(APP_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
