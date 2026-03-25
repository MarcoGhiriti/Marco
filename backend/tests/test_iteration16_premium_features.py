"""
Iteration 16: Premium Features Testing
Tests for:
1. /api/premium/bike - Bike data endpoint
2. /api/premium/history/routes - Route history with polyline
3. /api/premium/history/free-rides - Free ride history with polyline and stop_checkpoints
4. /api/premium/free-ride/* - Free ride endpoints
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://android-subs.preview.emergentagent.com").rstrip("/")

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"


class TestPremiumAuth:
    """Test authentication for premium user"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for premium user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self, auth_token):
        """Test that login works for premium user"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, token length: {len(auth_token)}")


class TestPremiumBike:
    """Test /api/premium/bike endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_bike_data(self, auth_headers):
        """Test GET /api/premium/bike returns bike data"""
        response = requests.get(f"{BASE_URL}/api/premium/bike", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response is a dict (bike data object)
        assert isinstance(data, dict), "Response should be a dict"
        
        # Check for some common fields (may or may not be present depending on user data)
        print(f"✓ Bike data retrieved: bike_name={data.get('bike_name')}, plate={data.get('plate_number')}, km={data.get('current_km')}")
    
    def test_update_bike_data(self, auth_headers):
        """Test PUT /api/premium/bike updates bike data"""
        update_data = {
            "bike_name": "Test Motorcycle",
            "plate_number": "TEST-123",
            "current_km": 5000,
            "next_service_km": 6000
        }
        response = requests.put(
            f"{BASE_URL}/api/premium/bike",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify update was applied
        assert data.get("bike_name") == "Test Motorcycle"
        assert data.get("plate_number") == "TEST-123"
        assert data.get("current_km") == 5000
        assert data.get("next_service_km") == 6000
        
        print(f"✓ Bike data updated successfully")


class TestPremiumHistoryRoutes:
    """Test /api/premium/history/routes endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_route_history(self, auth_headers):
        """Test GET /api/premium/history/routes returns route history"""
        response = requests.get(f"{BASE_URL}/api/premium/history/routes", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are routes, verify structure
        if len(data) > 0:
            route_ride = data[0]
            assert "id" in route_ride, "Missing id field"
            assert "route_id" in route_ride, "Missing route_id field"
            assert "route" in route_ride, "Missing route field"
            
            # Check if route has polyline when route data exists
            if route_ride.get("route"):
                route = route_ride["route"]
                assert "id" in route, "Route missing id"
                assert "title" in route, "Route missing title"
                assert "polyline" in route, "Route missing polyline field"
                print(f"✓ Route history has polyline data: {len(route.get('polyline', []))} points")
        else:
            print("✓ Route history is empty (no rides yet)")
        
        print(f"✓ Route history retrieved: {len(data)} rides")


class TestPremiumHistoryFreeRides:
    """Test /api/premium/history/free-rides endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_free_ride_history(self, auth_headers):
        """Test GET /api/premium/history/free-rides returns free ride history with polyline and stop_checkpoints"""
        response = requests.get(f"{BASE_URL}/api/premium/history/free-rides", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are free rides, verify structure
        if len(data) > 0:
            free_ride = data[0]
            assert "id" in free_ride, "Missing id field"
            assert "distance_km" in free_ride, "Missing distance_km field"
            assert "max_speed_kmh" in free_ride, "Missing max_speed_kmh field"
            assert "duration_seconds" in free_ride, "Missing duration_seconds field"
            assert "stops_count" in free_ride, "Missing stops_count field"
            assert "polyline" in free_ride, "Missing polyline field"
            assert "stop_checkpoints" in free_ride, "Missing stop_checkpoints field"
            
            print(f"✓ Free ride has polyline: {len(free_ride.get('polyline', []))} points")
            print(f"✓ Free ride has stop_checkpoints: {len(free_ride.get('stop_checkpoints', []))} stops")
        else:
            print("✓ Free ride history is empty (no rides yet)")
        
        print(f"✓ Free ride history retrieved: {len(data)} rides")


class TestPremiumFreeRideFlow:
    """Test free ride start/pause/resume/end flow"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_check_active_free_ride(self, auth_headers):
        """Test GET /api/premium/free-ride/active"""
        response = requests.get(f"{BASE_URL}/api/premium/free-ride/active", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "active" in data, "Missing active field"
        print(f"✓ Active free ride check: active={data.get('active')}")
    
    def test_start_free_ride(self, auth_headers):
        """Test POST /api/premium/free-ride/start"""
        response = requests.post(f"{BASE_URL}/api/premium/free-ride/start", json={}, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "id" in data, "Missing id field"
        assert "status" in data, "Missing status field"
        assert "started_at" in data, "Missing started_at field"
        
        ride_id = data["id"]
        print(f"✓ Free ride started: id={ride_id}, status={data.get('status')}")
        
        # End the ride to clean up
        end_response = requests.post(
            f"{BASE_URL}/api/premium/free-ride/{ride_id}/end",
            json={
                "polyline": [[44.4268, 26.1025], [44.4278, 26.1035]],
                "distance_km": 0.5,
                "max_speed_kmh": 30,
                "duration_seconds": 60,
                "stops_count": 0
            },
            headers=auth_headers
        )
        assert end_response.status_code == 200, f"Failed to end ride: {end_response.text}"
        print(f"✓ Free ride ended successfully")


class TestPremiumStatus:
    """Test premium status endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_premium_status(self, auth_headers):
        """Test GET /api/premium/status"""
        response = requests.get(f"{BASE_URL}/api/premium/status", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "is_premium" in data, "Missing is_premium field"
        assert "price" in data, "Missing price field"
        
        print(f"✓ Premium status: is_premium={data.get('is_premium')}, price={data.get('price')}")


class TestMaintenanceTips:
    """Test maintenance tips endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_maintenance_tips(self, auth_headers):
        """Test GET /api/premium/maintenance-tips"""
        response = requests.get(f"{BASE_URL}/api/premium/maintenance-tips", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have maintenance tips"
        
        tip = data[0]
        assert "id" in tip, "Missing id field"
        assert "title" in tip, "Missing title field"
        assert "description" in tip, "Missing description field"
        
        print(f"✓ Maintenance tips retrieved: {len(data)} tips")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
