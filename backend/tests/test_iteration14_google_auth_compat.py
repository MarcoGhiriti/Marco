"""
Iteration 14: Google Auth Compatibility Tests
Tests the backward-compatibility routes for the previous Google auth flow.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestGoogleAuthCompatibility:
    """Tests for Google auth backward-compatibility endpoints."""

    def test_google_callback_returns_html_not_404(self):
        """GET /api/auth/google-callback should return HTML page, not 404 JSON."""
        response = requests.get(f"{BASE_URL}/api/auth/google-callback")
        
        # Should return 200 with HTML content
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Should be HTML, not JSON
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML content-type, got {content_type}"
        
        # Should contain MotoGO branding
        assert "MotoGO" in response.text, "HTML should contain MotoGO branding"
        assert "Google" in response.text, "HTML should reference Google login"
        
        # Should NOT be a JSON 404 error
        assert '{"detail":"Not Found"}' not in response.text, "Should not return JSON 404"

    def test_google_pending_returns_404_not_route_not_found(self):
        """GET /api/auth/google-pending should return 404 with proper message when empty."""
        response = requests.get(f"{BASE_URL}/api/auth/google-pending")
        
        # Should return 404 (no pending session)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        # Should have proper error message, not generic "Not Found"
        data = response.json()
        assert "detail" in data, "Response should have detail field"
        assert "pending" in data["detail"].lower() or "session" in data["detail"].lower(), \
            f"Error should mention pending/session, got: {data['detail']}"
        
        # Should NOT be generic route-not-found
        assert data["detail"] != "Not Found", "Should not be generic 'Not Found'"

    def test_google_pending_session_returns_401_for_invalid_session(self):
        """POST /api/auth/google/pending-session should return 401 for invalid session_id."""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/pending-session",
            json={"session_id": "invalid_test_session_12345"}
        )
        
        # Should return 401 (invalid session)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Should have error detail
        data = response.json()
        assert "detail" in data, "Response should have detail field"

    def test_google_auth_returns_401_for_invalid_session(self):
        """POST /api/auth/google should return 401 for invalid session_id."""
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": "invalid_test_session_67890"}
        )
        
        # Should return 401 (invalid session)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Should have error detail
        data = response.json()
        assert "detail" in data, "Response should have detail field"


class TestExistingAuthEndpoints:
    """Verify existing auth endpoints still work."""

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
        assert "access_token" in data, "Should return access_token"

    def test_login_with_invalid_credentials(self):
        """POST /api/auth/login should return 401 for invalid credentials."""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401


class TestGoogleCallbackPageContent:
    """Detailed tests for the Google callback HTML page content."""

    def test_callback_page_has_deep_link(self):
        """The callback page should have a deep link back to the app."""
        response = requests.get(f"{BASE_URL}/api/auth/google-callback")
        assert response.status_code == 200
        
        # Should have motogo:// deep link
        assert "motogo://" in response.text, "Should have motogo:// deep link"

    def test_callback_page_has_pending_session_call(self):
        """The callback page should call /api/auth/google/pending-session."""
        response = requests.get(f"{BASE_URL}/api/auth/google-callback")
        assert response.status_code == 200
        
        # Should reference the pending-session endpoint
        assert "/api/auth/google/pending-session" in response.text, \
            "Should call /api/auth/google/pending-session endpoint"

    def test_callback_page_parses_session_id(self):
        """The callback page should parse session_id from URL fragment."""
        response = requests.get(f"{BASE_URL}/api/auth/google-callback")
        assert response.status_code == 200
        
        # Should parse session_id from hash
        assert "session_id" in response.text, "Should reference session_id"
        assert "URLSearchParams" in response.text or "hash" in response.text, \
            "Should parse URL hash/fragment"
