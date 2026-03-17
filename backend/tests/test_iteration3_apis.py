"""
Test iteration 3 - Testing specific features:
1. Notifications APIs: GET /api/notifications, GET /api/notifications/unread-count, GET /api/friends/requests
2. Map static image API: GET /api/map/static-image with polyline and lat/lng modes
3. Routes API: GET /api/routes returns routes with polyline data
4. Marketplace API: GET /api/marketplace/listings
5. Auth API: POST /api/auth/login
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://search-suggestions.preview.emergentagent.com").rstrip('/')

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login returns access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert isinstance(data["access_token"], str), "access_token should be a string"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        print(f"✓ Login successful, got access_token")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected with 401")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for subsequent tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestNotifications:
    """Notifications API tests"""
    
    def test_get_notifications_returns_200(self, auth_headers):
        """Test GET /api/notifications returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/notifications returned 200 with {len(data)} notifications")
    
    def test_get_unread_count_returns_200_with_count(self, auth_headers):
        """Test GET /api/notifications/unread-count returns 200 with count field"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "count" in data, "Response should contain 'count' field"
        assert isinstance(data["count"], int), "count should be an integer"
        print(f"✓ GET /api/notifications/unread-count returned count: {data['count']}")


class TestFriendRequests:
    """Friend requests API tests"""
    
    def test_get_friend_requests_returns_200(self, auth_headers):
        """Test GET /api/friends/requests returns 200 with incoming/outgoing arrays"""
        response = requests.get(
            f"{BASE_URL}/api/friends/requests",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "incoming" in data, "Response should contain 'incoming' field"
        assert "outgoing" in data, "Response should contain 'outgoing' field"
        assert isinstance(data["incoming"], list), "incoming should be a list"
        assert isinstance(data["outgoing"], list), "outgoing should be a list"
        print(f"✓ GET /api/friends/requests returned incoming: {len(data['incoming'])}, outgoing: {len(data['outgoing'])}")


class TestMapStaticImage:
    """Map static image proxy API tests"""
    
    def test_static_image_with_lat_lng_returns_302(self):
        """Test GET /api/map/static-image with lat/lng returns 302 redirect"""
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            params={"lat": 44.4, "lng": 26.1, "zoom": 14},
            allow_redirects=False
        )
        assert response.status_code == 302, f"Expected 302 redirect, got {response.status_code}: {response.text}"
        assert "Location" in response.headers, "Response should have Location header for redirect"
        location = response.headers["Location"]
        assert "maps.googleapis.com" in location, "Redirect should point to Google Maps"
        print(f"✓ GET /api/map/static-image (lat/lng mode) returned 302 redirect to Google Maps")
    
    def test_static_image_with_polyline_returns_302(self):
        """Test GET /api/map/static-image with polyline params returns 302 redirect"""
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            params={
                "polyline_str": "test",
                "start_lat": 44.4,
                "start_lng": 26.1,
                "end_lat": 44.5,
                "end_lng": 26.2
            },
            allow_redirects=False
        )
        assert response.status_code == 302, f"Expected 302 redirect, got {response.status_code}: {response.text}"
        location = response.headers.get("Location", "")
        assert "maps.googleapis.com" in location, "Redirect should point to Google Maps"
        assert "enc:test" in location, "Redirect URL should contain encoded polyline"
        print(f"✓ GET /api/map/static-image (polyline mode) returned 302 redirect to Google Maps")
    
    def test_static_image_missing_params_returns_400(self):
        """Test GET /api/map/static-image without required params returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            allow_redirects=False
        )
        assert response.status_code == 400, f"Expected 400 for missing params, got {response.status_code}"
        print(f"✓ GET /api/map/static-image without params correctly returned 400")


class TestRoutes:
    """Routes API tests"""
    
    def test_get_routes_returns_200(self, auth_headers):
        """Test GET /api/routes returns 200 with routes containing polyline data"""
        response = requests.get(
            f"{BASE_URL}/api/routes",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if routes have polyline data (if any routes exist)
        if len(data) > 0:
            route = data[0]
            assert "polyline" in route, "Route should contain 'polyline' field"
            assert isinstance(route["polyline"], list), "polyline should be a list"
            print(f"✓ GET /api/routes returned {len(data)} routes with polyline data")
        else:
            print(f"✓ GET /api/routes returned 200 with empty list (no routes)")


class TestMarketplace:
    """Marketplace API tests"""
    
    def test_get_listings_returns_200(self, auth_headers):
        """Test GET /api/marketplace/listings returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/listings",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/marketplace/listings returned {len(data)} listings")


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Health check should return ok: true"
        print(f"✓ Health check passed")
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Root endpoint failed: {response.text}"
        print(f"✓ Root endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
