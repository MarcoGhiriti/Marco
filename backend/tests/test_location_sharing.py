"""
Test Location Sharing and Friends Locations APIs for MotoGO
Tests for:
- POST /api/location/update - Update user's live location
- GET /api/friends/locations - Get friends' locations shared in last 30 min
"""

import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://mobile-app-polish.preview.emergentagent.com').rstrip('/')


class TestLocationSharing:
    """Test location sharing feature APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email: str, password: str) -> str:
        """Login and return auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_health_endpoint(self):
        """Test health endpoint is available"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("db") == "up"
        print("✓ Health endpoint working")
    
    def test_location_update_requires_auth(self):
        """Test that location update requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 47.165,
            "lng": 23.452
        })
        assert response.status_code in [401, 403]  # No auth header - both codes are valid
        print("✓ Location update requires auth")
    
    def test_location_update_success(self):
        """Test POST /api/location/update returns {ok: true}"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 47.165,
            "lng": 23.452
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print(f"✓ Location update successful: {data}")
    
    def test_location_update_validates_lat_bounds(self):
        """Test that lat is validated to be within -90 to 90"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test invalid latitude > 90
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 95.0,
            "lng": 23.452
        })
        assert response.status_code == 422  # Validation error
        print("✓ Location update validates lat bounds (>90 rejected)")
        
        # Test invalid latitude < -90
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": -95.0,
            "lng": 23.452
        })
        assert response.status_code == 422  # Validation error
        print("✓ Location update validates lat bounds (<-90 rejected)")
    
    def test_location_update_validates_lng_bounds(self):
        """Test that lng is validated to be within -180 to 180"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test invalid longitude > 180
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 47.0,
            "lng": 185.0
        })
        assert response.status_code == 422  # Validation error
        print("✓ Location update validates lng bounds (>180 rejected)")
        
        # Test invalid longitude < -180
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 47.0,
            "lng": -185.0
        })
        assert response.status_code == 422  # Validation error
        print("✓ Location update validates lng bounds (<-180 rejected)")
    
    def test_friends_locations_requires_auth(self):
        """Test that friends locations requires authentication"""
        # Clear any auth headers
        self.session.headers.pop("Authorization", None)
        
        response = self.session.get(f"{BASE_URL}/api/friends/locations")
        assert response.status_code in [401, 403]  # No auth header - both codes are valid
        print("✓ Friends locations requires auth")
    
    def test_friends_locations_returns_array(self):
        """Test GET /api/friends/locations returns an array"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/friends/locations")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected array response"
        print(f"✓ Friends locations returns array (length: {len(data)})")
    
    def test_friends_locations_structure(self):
        """Test that friends locations has correct structure when friends exist"""
        # Login as user2 and update location
        token2 = self.get_auth_token("user2@example.com", "Password123")
        if token2:
            self.session.headers.update({"Authorization": f"Bearer {token2}"})
            self.session.post(f"{BASE_URL}/api/location/update", json={
                "lat": 44.4268,
                "lng": 26.1025
            })
            print("✓ Updated user2 location")
        
        # Login as user1 and check friends locations
        token1 = self.get_auth_token("user1@example.com", "Password123")
        assert token1 is not None, "Failed to login as user1"
        
        self.session.headers.update({"Authorization": f"Bearer {token1}"})
        
        response = self.session.get(f"{BASE_URL}/api/friends/locations")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected array response"
        
        # If there are friends with location, check structure
        if len(data) > 0:
            friend = data[0]
            assert "id" in friend, "Missing 'id' field"
            assert "username" in friend, "Missing 'username' field"
            assert "lat" in friend, "Missing 'lat' field"
            assert "lng" in friend, "Missing 'lng' field"
            assert "updated_at" in friend, "Missing 'updated_at' field"
            print(f"✓ Friends locations has correct structure: {list(friend.keys())}")
        else:
            print("✓ Friends locations returns empty array (no friends with recent location)")


class TestLocationSharingEdgeCases:
    """Test edge cases for location sharing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, email: str, password: str) -> str:
        """Login and return auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_location_update_missing_lat(self):
        """Test location update with missing lat field"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lng": 23.452
        })
        
        assert response.status_code == 422  # Validation error - missing required field
        print("✓ Location update validates missing lat field")
    
    def test_location_update_missing_lng(self):
        """Test location update with missing lng field"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 47.165
        })
        
        assert response.status_code == 422  # Validation error - missing required field
        print("✓ Location update validates missing lng field")
    
    def test_location_update_empty_body(self):
        """Test location update with empty body"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/location/update", json={})
        
        assert response.status_code == 422  # Validation error
        print("✓ Location update rejects empty body")
    
    def test_location_update_boundary_values(self):
        """Test location update with boundary lat/lng values"""
        token = self.get_auth_token("user1@example.com", "Password123")
        assert token is not None, "Failed to login"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test max lat (90)
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 90.0,
            "lng": 0.0
        })
        assert response.status_code == 200
        print("✓ Location update accepts lat=90 (North Pole)")
        
        # Test min lat (-90)
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": -90.0,
            "lng": 0.0
        })
        assert response.status_code == 200
        print("✓ Location update accepts lat=-90 (South Pole)")
        
        # Test max lng (180)
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 0.0,
            "lng": 180.0
        })
        assert response.status_code == 200
        print("✓ Location update accepts lng=180")
        
        # Test min lng (-180)
        response = self.session.post(f"{BASE_URL}/api/location/update", json={
            "lat": 0.0,
            "lng": -180.0
        })
        assert response.status_code == 200
        print("✓ Location update accepts lng=-180")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
