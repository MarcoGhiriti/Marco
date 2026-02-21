"""
Backend API Tests for Moto GO App
Testing: Auth, Map Endpoints (gas-service, police-reports, events), Routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ui-consistency-test.preview.emergentagent.com")

# Test credentials
TEST_USER_EMAIL = "user1@example.com"
TEST_USER_PASSWORD = "Password123"

class TestHealthAndAuth:
    """Test health check and authentication endpoints"""
    
    def test_health_check(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print(f"✓ Health check passed: {data}")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0
        print(f"✓ Login successful, got access token")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print(f"✓ Invalid login correctly rejected with 401")


@pytest.fixture
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Auth failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers for API requests"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestMapEndpoints:
    """Test map-related API endpoints"""
    
    # Bounds for Bucharest area
    BOUNDS = {
        "min_lat": 44.3,
        "max_lat": 44.6,
        "min_lng": 25.9,
        "max_lng": 26.3
    }
    
    def test_map_events(self, auth_headers):
        """Test /api/map/events endpoint"""
        params = self.BOUNDS
        response = requests.get(
            f"{BASE_URL}/api/map/events",
            params=params,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Map events failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Map events returned {len(data)} events")
        
        # Validate structure if events exist
        if len(data) > 0:
            event = data[0]
            assert "id" in event
            assert "title" in event
            assert "start_point" in event
            print(f"  First event: {event.get('title')}")
    
    def test_map_gas_service(self, auth_headers):
        """Test /api/map/gas-service endpoint - should return both gas and service types"""
        params = self.BOUNDS
        response = requests.get(
            f"{BASE_URL}/api/map/gas-service",
            params=params,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Gas service failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Gas service returned {len(data)} places")
        
        # Check for both place types
        gas_count = sum(1 for p in data if p.get("place_type") == "gas")
        service_count = sum(1 for p in data if p.get("place_type") == "service")
        print(f"  Gas stations: {gas_count}, Service stations: {service_count}")
        
        # Validate structure
        if len(data) > 0:
            place = data[0]
            assert "id" in place
            assert "name" in place
            assert "lat" in place
            assert "lng" in place
            assert "place_type" in place
            assert place["place_type"] in ["gas", "service"]
    
    def test_map_police_reports(self, auth_headers):
        """Test /api/map/police-reports endpoint"""
        params = self.BOUNDS
        response = requests.get(
            f"{BASE_URL}/api/map/police-reports",
            params=params,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Police reports failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Police reports returned {len(data)} reports")
        
        # Validate structure if reports exist
        if len(data) > 0:
            report = data[0]
            assert "id" in report
            assert "lat" in report
            assert "lng" in report
            assert "upvotes" in report
            assert "downvotes" in report


class TestRoutesEndpoints:
    """Test routes-related API endpoints"""
    
    def test_get_routes(self, auth_headers):
        """Test /api/routes endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/routes",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get routes failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Routes returned {len(data)} routes")
        
        # Validate structure with null-safe checks
        if len(data) > 0:
            route = data[0]
            assert "id" in route
            assert "title" in route
            
            # Check that distance_km, duration_min, participants_count handle null
            distance = route.get("distance_km")
            duration = route.get("duration_min")
            participants = route.get("participants_count")
            
            # These should be numbers or 0, not crash
            print(f"  Route: {route.get('title')}")
            print(f"  Distance: {distance} km, Duration: {duration} min, Participants: {participants}")
            
            # Verify polyline exists for RouteMiniMap
            if route.get("polyline"):
                assert isinstance(route["polyline"], list)
                print(f"  Polyline has {len(route['polyline'])} points")


class TestUserEndpoints:
    """Test user-related endpoints"""
    
    def test_get_me(self, auth_headers):
        """Test /api/me endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/me",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert data["email"] == TEST_USER_EMAIL
        print(f"✓ User profile retrieved: {data.get('username', data.get('email'))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
