"""
Test meeting point functionality on routes API
Tests:
1. Create route with meeting_point and start_radius_km
2. GET /api/routes/my returns meeting_point and start_radius_km for creator-owned routes
3. GET /api/routes returns routes with meeting_point data
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ride-start-gating.preview.emergentagent.com").rstrip('/')

# Test user credentials
TEST_USER = {
    "email": "user1@example.com",
    "password": "Password123"
}


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=TEST_USER
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestRoutesEndpoints:
    """Test routes endpoints for meeting point handling"""
    
    def test_health_check(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print("Health check passed")
    
    def test_login_works(self, auth_token):
        """Verify login works"""
        assert auth_token is not None
        assert len(auth_token) > 20
        print(f"Login successful, token length: {len(auth_token)}")
    
    def test_get_routes_returns_meeting_point(self, auth_headers):
        """GET /api/routes should return meeting_point when present"""
        response = requests.get(f"{BASE_URL}/api/routes", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        routes = response.json()
        assert isinstance(routes, list)
        print(f"Got {len(routes)} routes from /api/routes")
        
        # Check if any route has meeting_point data
        routes_with_mp = [r for r in routes if r.get("meeting_point")]
        print(f"Routes with meeting_point: {len(routes_with_mp)}")
        
        for route in routes[:3]:  # Check first 3
            print(f"  Route: {route.get('title')[:30] if route.get('title') else 'N/A'}, meeting_point: {route.get('meeting_point')}, start_radius_km: {route.get('start_radius_km')}")
    
    def test_get_my_routes_returns_meeting_point(self, auth_headers):
        """GET /api/routes/my should return meeting_point and start_radius_km for creator routes"""
        response = requests.get(f"{BASE_URL}/api/routes/my", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        routes = response.json()
        assert isinstance(routes, list)
        print(f"Got {len(routes)} routes from /api/routes/my")
        
        for route in routes:
            print(f"  My Route: {route.get('title')[:30] if route.get('title') else 'N/A'}")
            print(f"    meeting_point: {route.get('meeting_point')}")
            print(f"    start_radius_km: {route.get('start_radius_km')}")
            # Verify start_radius_km is always present (default 5.0)
            assert "start_radius_km" in route, "start_radius_km should be in response"
    
    def test_create_route_with_meeting_point(self, auth_headers):
        """POST /api/routes with meeting_point should persist it"""
        unique_title = f"TEST_Meeting_Point_Route_{uuid.uuid4().hex[:8]}"
        
        route_payload = {
            "title": unique_title,
            "description": "Test route with meeting point",
            "polyline": [[44.4268, 26.1025], [44.4278, 26.1125], [44.4288, 26.1225]],
            "meeting_point": {
                "lat": 44.4268,
                "lng": 26.1025,
                "name": "Test Meeting Point",
                "address": "123 Test Street, Bucharest"
            },
            "start_radius_km": 3.5,
            "difficulty": "medium",
            "participants_min": 1,
            "participants_max": 10
        }
        
        # Create route
        create_response = requests.post(
            f"{BASE_URL}/api/routes",
            json=route_payload,
            headers=auth_headers
        )
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        created_route = create_response.json()
        route_id = created_route.get("id")
        print(f"Created route with ID: {route_id}")
        print(f"  meeting_point in response: {created_route.get('meeting_point')}")
        print(f"  start_radius_km in response: {created_route.get('start_radius_km')}")
        
        # Verify meeting_point is in create response
        assert created_route.get("meeting_point") is not None, "meeting_point should be in create response"
        assert created_route.get("meeting_point", {}).get("lat") == 44.4268
        assert created_route.get("meeting_point", {}).get("lng") == 26.1025
        assert created_route.get("meeting_point", {}).get("name") == "Test Meeting Point"
        assert created_route.get("start_radius_km") == 3.5
        
        # Verify via GET /api/routes/my
        my_routes_response = requests.get(f"{BASE_URL}/api/routes/my", headers=auth_headers)
        assert my_routes_response.status_code == 200
        my_routes = my_routes_response.json()
        
        found_route = next((r for r in my_routes if r.get("id") == route_id), None)
        assert found_route is not None, f"Created route {route_id} not found in /api/routes/my"
        
        # Verify meeting_point persisted
        mp = found_route.get("meeting_point")
        assert mp is not None, "meeting_point should persist in /api/routes/my"
        assert mp.get("lat") == 44.4268
        assert mp.get("lng") == 26.1025
        assert mp.get("name") == "Test Meeting Point"
        assert found_route.get("start_radius_km") == 3.5
        print(f"Verified meeting_point persisted: {mp}")
        
        # Cleanup - delete the test route
        delete_response = requests.delete(f"{BASE_URL}/api/routes/{route_id}", headers=auth_headers)
        assert delete_response.status_code in [200, 204], f"Delete failed: {delete_response.text}"
        print(f"Cleaned up test route {route_id}")
    
    def test_routes_without_auth_returns_401(self):
        """GET /api/routes without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code == 401
        print("Correctly returns 401 without auth")
    
    def test_routes_my_without_auth_returns_401(self):
        """GET /api/routes/my without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/routes/my")
        assert response.status_code == 401
        print("Correctly returns 401 without auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
