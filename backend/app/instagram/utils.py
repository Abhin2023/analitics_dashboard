import hashlib
import hmac
import base64
import os


WEBHOOK_VERIFY_TOKEN = os.getenv("IG_WEBHOOK_VERIFY_TOKEN", "bp-ig-verify-token-change-me")
APP_SECRET = os.getenv("IG_APP_SECRET", "")


def encrypt_token(token: str) -> str:
    key = os.getenv("TOKEN_ENCRYPTION_KEY", os.getenv("JWT_SECRET_KEY", "default-key"))
    signature = hmac.new(key.encode(), token.encode(), hashlib.sha256).hexdigest()[:16]
    encoded = base64.b64encode(token.encode()).decode()
    return f"{signature}:{encoded}"


def decrypt_token(encrypted: str) -> str:
    if ":" not in encrypted:
        return encrypted
    _, encoded = encrypted.split(":", 1)
    return base64.b64decode(encoded.encode()).decode()


def verify_webhook_signature(payload: bytes, signature_header: str) -> bool:
    if not APP_SECRET:
        return True
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(APP_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
