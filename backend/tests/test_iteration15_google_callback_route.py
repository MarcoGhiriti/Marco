"""
Iteration 15: Frontend Google Callback Route Tests
Tests the new dedicated frontend callback route at /auth/google-callback.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestFrontendGoogleCallbackRoute:
    """Tests for the new frontend /auth/google-callback route."""

    def test_frontend_callback_route_exists(self):
        """Frontend /auth/google-callback should return 200 (not 404)."""
        response = requests.get(f"{BASE_URL}/auth/google-callback")
        
        # Should return 200 (frontend route exists)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Should be HTML content (React app)
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML content-type, got {content_type}"

    def test_frontend_callback_with_invalid_session_id(self):
        """Frontend /auth/google-callback#session_id=invalid should return 200."""
        # Note: The hash fragment is not sent to server, but the route should still work
        response = requests.get(f"{BASE_URL}/auth/google-callback")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


class TestBackendGoogleCallbackCompatibility:
    """Tests for backend /api/auth/google-callback compatibility page."""

    def test_backend_callback_returns_html(self):
        """GET /api/auth/google-callback should return HTML page."""
        response = requests.get(f"{BASE_URL}/api/auth/google-callback")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML, got {content_type}"
        
        # Should contain MotoGO branding
        assert "MotoGO" in response.text, "Should contain MotoGO branding"

    def test_backend_callback_has_deep_link(self):
        """Backend callback page should have motogo:// deep link."""
        response = requests.get(f"{BASE_URL}/api/auth/google-callback")
        assert response.status_code == 200
        assert "motogo://" in response.text, "Should have motogo:// deep link"


class TestAuthLoginAndWelcomePages:
    """Tests for auth login and welcome pages."""

    def test_login_page_loads(self):
        """GET /auth/login should return 200."""
        response = requests.get(f"{BASE_URL}/auth/login")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML, got {content_type}"

    def test_welcome_page_loads(self):
        """GET /auth/welcome should return 200."""
        response = requests.get(f"{BASE_URL}/auth/welcome")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML, got {content_type}"


class TestGoogleAuthEndpoints:
    """Tests for Google auth API endpoints."""

    def test_google_auth_endpoint_exists(self):
        """POST /api/auth/google should exist and return 401 for invalid session."""
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": "test_invalid_session"}
        )
        # 401 means endpoint exists and validates session
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_google_pending_session_endpoint_exists(self):
        """POST /api/auth/google/pending-session should exist."""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/pending-session",
            json={"session_id": "test_invalid_session"}
        )
        # 401 means endpoint exists and validates session
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestHealthAndBasicEndpoints:
    """Basic health and API tests."""

    def test_health_endpoint(self):
        """GET /api/health should return ok."""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True

    def test_login_with_valid_credentials(self):
        """POST /api/auth/login should work with valid credentials."""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "Password123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
