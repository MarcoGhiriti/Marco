"""
Iteration 7 - i18n Implementation, Marketplace, Backend Refactoring Tests
Tests backend APIs after database.py module refactoring
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER1_EMAIL = "user1@example.com"
TEST_USER1_PASSWORD = "Password123"
TEST_USER2_EMAIL = "user2@example.com"
TEST_USER2_PASSWORD = "Password123"


class TestHealthEndpoint:
    """Test backend health check after refactoring"""
    
    def test_health_check(self):
        """Test /api/health returns 200 with database status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert "ok" in data
        assert data["ok"] == True
        assert "db" in data
        print(f"Health check passed: {data}")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_login_user1_success(self):
        """Test login with valid credentials for user1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        print(f"Login successful, token obtained")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print(f"Invalid login correctly rejected")


class TestMeEndpoint:
    """Test /api/me endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for user1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_me(self, auth_token):
        """Test GET /api/me returns user profile"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/me", headers=headers)
        assert response.status_code == 200, f"GET /api/me failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "username" in data
        assert data["email"] == TEST_USER1_EMAIL
        print(f"User profile fetched: {data.get('username')}")
    
    def test_get_me_no_auth(self):
        """Test GET /api/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"
        print(f"Unauthenticated access correctly rejected")


class TestRoutesEndpoint:
    """Test /api/routes endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_routes(self, auth_token):
        """Test GET /api/routes returns list of routes"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/routes", headers=headers)
        assert response.status_code == 200, f"GET /api/routes failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Routes fetched: {len(data)} routes")
    
    def test_routes_requires_auth(self):
        """Test /api/routes requires authentication"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"


class TestEventsEndpoint:
    """Test /api/events endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_events(self, auth_token):
        """Test GET /api/events returns list of events"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert response.status_code == 200, f"GET /api/events failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Events fetched: {len(data)} events")
    
    def test_events_requires_auth(self):
        """Test /api/events requires authentication"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"


class TestMarketplaceEndpoint:
    """Test /api/marketplace/listings endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_marketplace_listings(self, auth_token):
        """Test GET /api/marketplace/listings returns list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/marketplace/listings", headers=headers)
        assert response.status_code == 200, f"GET /api/marketplace/listings failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Marketplace listings fetched: {len(data)} items")
    
    def test_marketplace_requires_auth(self):
        """Test /api/marketplace/listings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code in [401, 403], f"Expected 401/403, got: {response.status_code}"


class TestStatsEndpoint:
    """Test /api/stats endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_stats(self, auth_token):
        """Test GET /api/stats returns user stats"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/stats", headers=headers)
        assert response.status_code == 200, f"GET /api/stats failed: {response.text}"
        data = response.json()
        assert "km_total" in data or "total_km" in data or isinstance(data, dict)
        print(f"Stats fetched: {data}")


class TestFriendsEndpoint:
    """Test /api/friends endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_friends(self, auth_token):
        """Test GET /api/friends returns friends list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/friends", headers=headers)
        assert response.status_code == 200, f"GET /api/friends failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Friends fetched: {len(data)} friends")


class TestMapEndpoint:
    """Test /api/map/static-image endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER1_EMAIL, "password": TEST_USER1_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_static_map_image(self, auth_token):
        """Test GET /api/map/static-image returns image"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            headers=headers,
            params={"lat": 44.4, "lng": 26.1, "zoom": 14}
        )
        assert response.status_code == 200, f"GET /api/map/static-image failed: {response.status_code}"
        # Should return image content
        assert len(response.content) > 1000, "Image content too small"
        print(f"Static map image fetched: {len(response.content)} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
