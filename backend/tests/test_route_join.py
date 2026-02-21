"""
Test route join functionality including CC restrictions
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bike-buddy-tracker.preview.emergentagent.com")

class TestRouteJoin:
    """Test route join/leave functionality including CC restrictions"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for user1 (has 125cc bike)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "Password123"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def user_info(self, auth_headers):
        """Get current user info"""
        response = requests.get(f"{BASE_URL}/api/me", headers=auth_headers)
        assert response.status_code == 200
        return response.json()
    
    def test_user_has_125cc_bike(self, user_info):
        """Verify user1 has 125cc bike"""
        bike = user_info.get("bike")
        assert bike is not None, "User should have bike info"
        assert bike.get("cc") == 125, f"Expected 125cc but got {bike.get('cc')}"
        print(f"User1 has bike with {bike.get('cc')}cc")
    
    def test_user_license_verified(self, user_info):
        """Verify user1 has verified license"""
        assert user_info.get("license_verified") == True, "User should have verified license"
        print(f"User1 license verified: {user_info.get('license_verified')}")
    
    def test_get_routes_with_min_cc(self, auth_headers):
        """Find routes with min_engine_cc requirement"""
        response = requests.get(f"{BASE_URL}/api/routes", headers=auth_headers)
        assert response.status_code == 200
        routes = response.json()
        
        routes_with_cc = [r for r in routes if r.get("min_engine_cc")]
        print(f"Found {len(routes_with_cc)} routes with min_engine_cc requirement")
        
        for r in routes_with_cc:
            print(f"  - Route '{r['title']}' requires {r['min_engine_cc']}cc, is_joined: {r.get('is_joined')}")
        
        return routes_with_cc
    
    def test_join_route_with_insufficient_cc(self, auth_headers):
        """Test joining a route that requires more CC than user has"""
        # First, find a route with CC requirement higher than 125
        response = requests.get(f"{BASE_URL}/api/routes", headers=auth_headers)
        assert response.status_code == 200
        routes = response.json()
        
        # Find route with min_engine_cc > 125
        route_with_high_cc = None
        for r in routes:
            min_cc = r.get("min_engine_cc")
            if min_cc and min_cc > 125 and not r.get("is_joined"):
                route_with_high_cc = r
                break
        
        if not route_with_high_cc:
            pytest.skip("No route found with CC requirement > 125cc")
        
        route_id = route_with_high_cc["id"]
        min_cc = route_with_high_cc["min_engine_cc"]
        print(f"Attempting to join route '{route_with_high_cc['title']}' which requires {min_cc}cc")
        
        # Try to join - should fail with 403
        join_response = requests.post(
            f"{BASE_URL}/api/routes/{route_id}/join",
            headers=auth_headers,
            json={}
        )
        
        assert join_response.status_code == 403, f"Expected 403 but got {join_response.status_code}"
        
        error_detail = join_response.json()
        print(f"Join response: {error_detail}")
        
        # Verify the error message contains CC requirement info
        assert "detail" in error_detail, "Response should have 'detail' field"
        detail_msg = error_detail["detail"]
        assert "Minimum" in detail_msg or "cc" in detail_msg.lower(), \
            f"Error message should mention CC requirement, got: {detail_msg}"
        
        print(f"✓ Correctly rejected with message: {detail_msg}")
    
    def test_routes_feed_loads_correctly(self, auth_headers):
        """Verify routes feed loads without errors"""
        response = requests.get(f"{BASE_URL}/api/routes", headers=auth_headers)
        assert response.status_code == 200
        routes = response.json()
        assert isinstance(routes, list), "Routes should be a list"
        assert len(routes) > 0, "Should have at least one route"
        print(f"✓ Routes feed loaded successfully with {len(routes)} routes")
    
    def test_route_join_without_cc_restriction(self, auth_headers):
        """Test joining a route without CC restriction works"""
        response = requests.get(f"{BASE_URL}/api/routes", headers=auth_headers)
        assert response.status_code == 200
        routes = response.json()
        
        # Find route without CC restriction that user hasn't joined
        route_without_cc = None
        for r in routes:
            if not r.get("min_engine_cc") and not r.get("is_joined"):
                route_without_cc = r
                break
        
        if not route_without_cc:
            pytest.skip("No route found without CC restriction that user hasn't joined")
        
        route_id = route_without_cc["id"]
        print(f"Attempting to join route '{route_without_cc['title']}' (no CC requirement)")
        
        # Try to join
        join_response = requests.post(
            f"{BASE_URL}/api/routes/{route_id}/join",
            headers=auth_headers,
            json={}
        )
        
        print(f"Join response status: {join_response.status_code}")
        print(f"Join response body: {join_response.json()}")
        
        # Should succeed
        assert join_response.status_code == 200, f"Expected 200 but got {join_response.status_code}"
        print(f"✓ Successfully joined route without CC restriction")
        
        # Leave the route to clean up
        leave_response = requests.post(
            f"{BASE_URL}/api/routes/{route_id}/leave",
            headers=auth_headers,
            json={}
        )
        print(f"Left route: {leave_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
