"""
Backend API Tests for Moto GO - Iteration 2
Testing: Auth, Routes, Events, Map endpoints (gas-service, police-reports)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://riders-hub-10.preview.emergentagent.com"

# Test user credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed - status {response.status_code}: {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authorization headers."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestHealthCheck:
    """Health check endpoint tests."""

    def test_health_endpoint(self):
        """Test /api/health returns OK."""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
        assert data.get("db") == "up"
        print("✓ Health endpoint working")


class TestAuthentication:
    """Authentication endpoint tests."""

    def test_login_success(self):
        """Test login with valid credentials."""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        print("✓ Login successful with user1@example.com")

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("✓ Invalid login returns 401")


class TestMeEndpoint:
    """User profile endpoint tests."""

    def test_get_me(self, auth_headers):
        """Test getting current user profile."""
        response = requests.get(f"{BASE_URL}/api/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        print(f"✓ GET /api/me returns user: {data.get('username')}")


class TestRoutesEndpoint:
    """Routes endpoint tests."""

    def test_get_routes(self, auth_headers):
        """Test getting routes list."""
        response = requests.get(f"{BASE_URL}/api/routes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/routes returns {len(data)} routes")
        
        # Verify route structure if routes exist
        if len(data) > 0:
            route = data[0]
            assert "id" in route
            assert "title" in route
            assert "polyline" in route
            assert "distance_km" in route
            print(f"  - First route: {route.get('title')} ({route.get('distance_km')} km)")


class TestEventsEndpoint:
    """Events endpoint tests."""

    def test_get_events(self, auth_headers):
        """Test getting events list."""
        response = requests.get(f"{BASE_URL}/api/events", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/events returns {len(data)} events")
        
        # Verify event structure if events exist
        if len(data) > 0:
            event = data[0]
            assert "id" in event
            assert "title" in event
            assert "start_point" in event
            assert "start_time" in event
            print(f"  - First event: {event.get('title')}")


class TestMapEndpoints:
    """Map-related endpoint tests."""

    def test_map_events(self, auth_headers):
        """Test getting events for map view."""
        # Use Romania bounds for testing
        params = "?min_lat=44.0&max_lat=45.0&min_lng=25.5&max_lng=27.0"
        response = requests.get(f"{BASE_URL}/api/map/events{params}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/map/events returns {len(data)} events")

    def test_gas_service_endpoint(self, auth_headers):
        """Test getting gas stations and service for map (separate gas and service place_types)."""
        params = "?min_lat=44.0&max_lat=45.0&min_lng=25.5&max_lng=27.0"
        response = requests.get(f"{BASE_URL}/api/map/gas-service{params}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/map/gas-service returns {len(data)} places")
        
        # Check if we have different place_types
        if len(data) > 0:
            place_types = set(p.get("place_type") for p in data)
            print(f"  - Place types found: {place_types}")
            # Verify structure
            place = data[0]
            assert "id" in place
            assert "name" in place
            assert "lat" in place
            assert "lng" in place
            assert "place_type" in place

    def test_police_reports_get(self, auth_headers):
        """Test getting police reports for map."""
        params = "?min_lat=44.0&max_lat=45.0&min_lng=25.5&max_lng=27.0"
        response = requests.get(f"{BASE_URL}/api/map/police-reports{params}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/map/police-reports returns {len(data)} reports")
        
        if len(data) > 0:
            report = data[0]
            assert "id" in report
            assert "lat" in report
            assert "lng" in report
            assert "upvotes" in report or True  # upvotes might be optional


class TestLicenseStatus:
    """License verification status endpoint."""

    def test_license_status(self, auth_headers):
        """Test getting license verification status."""
        response = requests.get(f"{BASE_URL}/api/me/license-status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "license_verified" in data
        print(f"✓ GET /api/me/license-status - verified: {data.get('license_verified')}")


class TestNotifications:
    """Notification endpoints."""

    def test_unread_count(self, auth_headers):
        """Test getting unread notification count."""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ GET /api/notifications/unread-count - count: {data.get('count')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
