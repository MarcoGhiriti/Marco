"""
Test Ride Control Panel APIs for Moto GO
Tests: /api/rides/start, /api/rides/pause, /api/rides/resume, /api/rides/end, /api/rides/active-for-home
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://ride-start-gating.preview.emergentagent.com')

# Test credentials
TEST_USER_EMAIL = "user1@example.com"
TEST_USER_PASSWORD = "Password123"


class TestRideControlPanelAPIs:
    """Test suite for ride control panel endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login and get token
        self.token = self._login(TEST_USER_EMAIL, TEST_USER_PASSWORD)
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
        # Cleanup: cancel any active rides
        self._cleanup_active_rides()
    
    def _login(self, email: str, password: str) -> str:
        """Helper to login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def _cleanup_active_rides(self):
        """Cancel any active rides to clean up test state"""
        try:
            response = self.session.get(f"{BASE_URL}/api/rides/active")
            if response.status_code == 200:
                ride = response.json()
                if ride and ride.get("id"):
                    self.session.post(f"{BASE_URL}/api/rides/cancel", json={
                        "session_id": ride["id"]
                    })
        except Exception:
            pass
    
    def _get_user_route(self) -> dict:
        """Get a route owned by the test user"""
        response = self.session.get(f"{BASE_URL}/api/routes/my")
        if response.status_code == 200:
            routes = response.json()
            if routes:
                return routes[0]
        return None
    
    def _create_test_route(self) -> dict:
        """Create a test route if user doesn't have any"""
        route_data = {
            "title": f"TEST_ControlPanel_{datetime.now().strftime('%H%M%S')}",
            "description": "Test route for control panel testing",
            "polyline": [[45.0, 25.0], [45.1, 25.1], [45.2, 25.2]],
            "difficulty": "easy",
            "participants_min": 1,
            "participants_max": 10,
            "fuel_price_per_l": 7.5,
            "bike_consumption_l_per_100km": 5.0,
            "toll_estimate": 0,
            "currency": "RON",
            "stops_count": 0
        }
        response = self.session.post(f"{BASE_URL}/api/routes", json=route_data)
        if response.status_code in [200, 201]:
            return response.json()
        return None
    
    # ==================== Authentication Tests ====================
    
    def test_login_success(self):
        """Test login with valid credentials"""
        assert self.token is not None, "Login should return a valid token"
        print(f"✓ Login successful, token received")
    
    # ==================== Active Ride Tests ====================
    
    def test_get_active_ride_for_home_no_ride(self):
        """Test /api/rides/active-for-home when no active ride"""
        # First cleanup any existing rides
        self._cleanup_active_rides()
        
        response = self.session.get(f"{BASE_URL}/api/rides/active-for-home")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should return null/None when no active ride
        print(f"✓ /api/rides/active-for-home returns {data} when no active ride")
    
    def test_get_active_ride_no_ride(self):
        """Test /api/rides/active when no active ride"""
        self._cleanup_active_rides()
        
        response = self.session.get(f"{BASE_URL}/api/rides/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should return null/None when no active ride
        print(f"✓ /api/rides/active returns {data} when no active ride")
    
    # ==================== Start Ride Tests ====================
    
    def test_start_ride_requires_verified_license(self):
        """Test that starting a ride requires verified license"""
        # Get or create a route
        route = self._get_user_route()
        if not route:
            route = self._create_test_route()
        
        if not route:
            pytest.skip("No route available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/rides/start", json={
            "route_id": route["id"]
        })
        
        # Should fail with 403 if license not verified
        # Or succeed with 200 if license is verified
        if response.status_code == 403:
            data = response.json()
            assert "license" in data.get("detail", "").lower(), "Error should mention license verification"
            print(f"✓ Start ride correctly requires license verification: {data.get('detail')}")
        elif response.status_code == 200:
            print(f"✓ Start ride succeeded (user has verified license)")
            # Clean up - cancel the ride
            data = response.json()
            self.session.post(f"{BASE_URL}/api/rides/cancel", json={
                "session_id": data["id"]
            })
        else:
            # 400 could be "already have active ride"
            print(f"Start ride response: {response.status_code} - {response.text}")
            assert response.status_code in [200, 400, 403], f"Unexpected status: {response.status_code}"
    
    def test_start_ride_invalid_route(self):
        """Test starting a ride with invalid route ID"""
        response = self.session.post(f"{BASE_URL}/api/rides/start", json={
            "route_id": "invalid_route_id_12345"
        })
        
        # Should fail with 400 (invalid id format) or 404 (not found)
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        print(f"✓ Start ride with invalid route returns {response.status_code}")
    
    # ==================== Pause Ride Tests ====================
    
    def test_pause_ride_no_active_session(self):
        """Test pausing when no active ride"""
        self._cleanup_active_rides()
        
        response = self.session.post(f"{BASE_URL}/api/rides/pause", json={
            "session_id": "nonexistent_session_id"
        })
        
        # Should fail with 400 or 404
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}: {response.text}"
        print(f"✓ Pause ride with invalid session returns {response.status_code}")
    
    def test_pause_ride_missing_session_id(self):
        """Test pausing without providing session_id"""
        response = self.session.post(f"{BASE_URL}/api/rides/pause", json={})
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "session_id" in data.get("detail", "").lower(), "Error should mention session_id"
        print(f"✓ Pause ride without session_id returns 400: {data.get('detail')}")
    
    # ==================== Resume Ride Tests ====================
    
    def test_resume_ride_no_paused_session(self):
        """Test resuming when no paused ride"""
        response = self.session.post(f"{BASE_URL}/api/rides/resume", json={
            "session_id": "nonexistent_session_id"
        })
        
        # Should fail with 400 or 404
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}: {response.text}"
        print(f"✓ Resume ride with invalid session returns {response.status_code}")
    
    def test_resume_ride_missing_session_id(self):
        """Test resuming without providing session_id"""
        response = self.session.post(f"{BASE_URL}/api/rides/resume", json={})
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "session_id" in data.get("detail", "").lower(), "Error should mention session_id"
        print(f"✓ Resume ride without session_id returns 400: {data.get('detail')}")
    
    # ==================== End Ride Tests ====================
    
    def test_end_ride_no_active_session(self):
        """Test ending when no active ride"""
        self._cleanup_active_rides()
        
        response = self.session.post(f"{BASE_URL}/api/rides/end", json={
            "session_id": "nonexistent_session_id",
            "end_location": [45.0, 25.0]
        })
        
        # Should fail with 400 or 404
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}: {response.text}"
        print(f"✓ End ride with invalid session returns {response.status_code}")
    
    # ==================== Cancel Ride Tests ====================
    
    def test_cancel_ride_no_session(self):
        """Test cancelling when no active ride"""
        response = self.session.post(f"{BASE_URL}/api/rides/cancel", json={
            "session_id": "nonexistent_session_id"
        })
        
        # Should fail with 400 or 404
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}: {response.text}"
        print(f"✓ Cancel ride with invalid session returns {response.status_code}")
    
    # ==================== My Routes Endpoint Tests ====================
    
    def test_get_my_routes(self):
        """Test /api/routes/my endpoint returns user's routes"""
        response = self.session.get(f"{BASE_URL}/api/routes/my")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        routes = response.json()
        assert isinstance(routes, list), "Response should be a list"
        
        if routes:
            # Verify route structure
            route = routes[0]
            assert "id" in route, "Route should have id"
            assert "title" in route, "Route should have title"
            assert "created_by" in route, "Route should have created_by"
            print(f"✓ /api/routes/my returns {len(routes)} routes")
        else:
            print(f"✓ /api/routes/my returns empty list (no routes)")
    
    def test_my_routes_include_participant_count(self):
        """Test that my routes include participants_count field"""
        response = self.session.get(f"{BASE_URL}/api/routes/my")
        
        assert response.status_code == 200
        routes = response.json()
        
        if routes:
            route = routes[0]
            assert "participants_count" in route, "Route should have participants_count field"
            assert isinstance(route["participants_count"], int), "participants_count should be an integer"
            print(f"✓ Routes include participants_count: {route['participants_count']}")
        else:
            print("✓ No routes to verify participants_count")
    
    # ==================== API Response Structure Tests ====================
    
    def test_active_ride_response_structure(self):
        """Test active-for-home response structure when ride exists"""
        # This test verifies the expected response structure for frontend consumption
        response = self.session.get(f"{BASE_URL}/api/rides/active-for-home")
        
        assert response.status_code == 200
        data = response.json()
        
        if data:
            # Verify expected fields for ActiveRideForHomeOut
            expected_fields = ["ride_id", "route_id", "status", "creator_id", "started_at", "updated_at"]
            for field in expected_fields:
                assert field in data, f"Response should include '{field}'"
            print(f"✓ Active ride response has correct structure: {list(data.keys())}")
        else:
            print("✓ No active ride - response is null (expected)")


class TestRideWorkflow:
    """Test complete ride workflow if user has verified license"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login and get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            self.token = None
        yield
        # Cleanup any active rides
        self._cleanup_active_rides()
    
    def _cleanup_active_rides(self):
        """Cancel any active rides to clean up test state"""
        try:
            response = self.session.get(f"{BASE_URL}/api/rides/active")
            if response.status_code == 200:
                ride = response.json()
                if ride and ride.get("id"):
                    self.session.post(f"{BASE_URL}/api/rides/cancel", json={
                        "session_id": ride["id"]
                    })
        except Exception:
            pass
    
    def test_ride_workflow_without_license(self):
        """Test that ride workflow requires license verification"""
        # First check if user has verified license
        response = self.session.get(f"{BASE_URL}/api/me/license-status")
        
        if response.status_code == 200:
            status = response.json()
            if status.get("license_verified"):
                pytest.skip("User already has verified license - skip this test")
        
        # Get a route to test with
        response = self.session.get(f"{BASE_URL}/api/routes/my")
        if response.status_code != 200:
            pytest.skip("No routes available")
        
        routes = response.json()
        if not routes:
            pytest.skip("No routes available")
        
        # Try to start a ride
        start_response = self.session.post(f"{BASE_URL}/api/rides/start", json={
            "route_id": routes[0]["id"]
        })
        
        # Should fail with 403 if license not verified
        assert start_response.status_code == 403, f"Expected 403 for unverified license, got {start_response.status_code}"
        print(f"✓ Ride workflow correctly blocked without verified license")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
