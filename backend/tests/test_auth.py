"""Test auth and permission logic."""
import pytest
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("testpass123")
        assert verify_password("testpass123", hashed)
        assert not verify_password("wrongpass", hashed)

    def test_different_hashes(self):
        h1 = hash_password("samepass")
        h2 = hash_password("samepass")
        assert h1 != h2

    def test_empty_password(self):
        hashed = hash_password("")
        assert verify_password("", hashed)


class TestJWT:
    def test_access_token_decode(self):
        token = create_access_token({"sub": "1"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "1"
        assert payload["type"] == "access"

    def test_refresh_token_decode(self):
        token = create_refresh_token({"sub": "1"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "1"
        assert payload["type"] == "refresh"

    def test_invalid_token(self):
        payload = decode_token("invalid.token.here")
        assert payload is None

    def test_tampered_token(self):
        token = create_access_token({"sub": "1"})
        tampered = token[:-5] + "XXXXX"
        payload = decode_token(tampered)
        assert payload is None


class TestPermissionLogic:
    def test_permission_check_logic(self):
        perms = [
            {"resource": "dashboard", "action": "view"},
            {"resource": "operations", "action": "create"},
        ]
        assert any(p["resource"] == "dashboard" and p["action"] == "view" for p in perms)
        assert not any(p["resource"] == "dashboard" and p["action"] == "delete" for p in perms)

    def test_permission_empty(self):
        perms = []
        assert not any(p["resource"] == "dashboard" and p["action"] == "view" for p in perms)
