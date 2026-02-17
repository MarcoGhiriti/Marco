"""
Iteration 5 Testing - Map V2 Bug Fixes & Features

Tests:
1. GET /api/map/static-image with lat/lng returns 200 with image/png content-type (not 302)
2. GET /api/map/static-image with polyline_str returns 200 with image content
3. GET /api/map/static-image without params returns 400
4. GET /api/routes returns 200 with routes having polyline data
5. GET /api/events returns 200
6. GET /api/map/events returns 200 with bounds query params

Frontend Code Verification:
- PlaceSearchInput.tsx does NOT import FlatList (uses ScrollView instead)
- MapCanvas.native.tsx has userDotOuter, userDotInner, eventLocationText, openDirections
- MapCanvas.web.tsx has userLocation and onEventPress in type definition
- MapScreen.tsx passes userLocation and onEventPress to MapCanvas
"""

import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://riders-hub-10.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"


@pytest.fixture(scope="module")
def auth_token():
    """Login and get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestStaticMapImage:
    """Test /api/map/static-image endpoint - Now returns 200 with image bytes (not 302 redirect)"""

    def test_static_image_with_lat_lng_returns_200_with_image(self, auth_headers):
        """GET /api/map/static-image?lat=44.4&lng=26.1&zoom=14 returns 200 with image/png"""
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            params={"lat": 44.4, "lng": 26.1, "zoom": 14},
            headers=auth_headers,
            allow_redirects=False  # Important: we want to verify no redirect
        )
        
        # Status should be 200 (not 302 redirect)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Content-Type should be image
        content_type = response.headers.get("content-type", "")
        assert "image" in content_type, f"Expected image content-type, got: {content_type}"
        
        # Should have actual image content
        assert len(response.content) > 1000, "Response should contain image data"
        print(f"✓ Static map image (lat/lng) returned 200 with {len(response.content)} bytes of {content_type}")

    def test_static_image_with_polyline_returns_200(self, auth_headers):
        """GET /api/map/static-image with polyline_str returns 200 with image content"""
        # Use a simple test polyline string
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            params={
                "polyline_str": "test",  # May cause Google to return error image, but should still be 200
                "start_lat": 44.4,
                "start_lng": 26.1,
                "end_lat": 44.5,
                "end_lng": 26.2
            },
            headers=auth_headers,
            allow_redirects=False
        )
        
        # Should return 200 (proxy returns the response, even if Google returns error image)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Should have content
        assert len(response.content) > 0, "Response should have content"
        print(f"✓ Static map image (polyline) returned 200 with {len(response.content)} bytes")

    def test_static_image_without_params_returns_400(self, auth_headers):
        """GET /api/map/static-image without required params returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            headers=auth_headers,
            allow_redirects=False
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Static map image without params returns 400 as expected")


class TestMapAPIs:
    """Test other map-related API endpoints"""

    def test_routes_endpoint_returns_200(self, auth_headers):
        """GET /api/routes returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/routes",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Routes should be a list"
        
        # If there are routes, check they have polyline data
        if data:
            route = data[0]
            assert "polyline" in route, "Route should have polyline field"
            print(f"✓ Routes endpoint returned {len(data)} routes with polyline data")
        else:
            print("✓ Routes endpoint returned 200 (empty list)")

    def test_events_endpoint_returns_200(self, auth_headers):
        """GET /api/events returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Events should be a list"
        print(f"✓ Events endpoint returned {len(data)} events")

    def test_map_events_with_bounds_returns_200(self, auth_headers):
        """GET /api/map/events with bounds query params returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/map/events",
            params={
                "min_lat": 44.0,
                "max_lat": 45.0,
                "min_lng": 25.0,
                "max_lng": 27.0
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Map events should be a list"
        print(f"✓ Map events endpoint returned {len(data)} events within bounds")


class TestFrontendCodeStructure:
    """Verify frontend code changes for Map V2 features"""

    def test_place_search_input_no_flatlist_import(self):
        """PlaceSearchInput.tsx should NOT import FlatList (replaced with ScrollView)"""
        filepath = "/app/frontend/src/components/PlaceSearchInput.tsx"
        
        with open(filepath, "r") as f:
            content = f.read()
        
        # Check that FlatList is NOT imported (look for FlatList anywhere in imports)
        assert "FlatList" not in content, "PlaceSearchInput should NOT have FlatList"
        
        # Check that ScrollView IS imported (multiline import block)
        assert "ScrollView" in content, "PlaceSearchInput should import ScrollView"
        
        # Check that ScrollView is used for results
        scrollview_usage = re.search(r'<ScrollView', content)
        assert scrollview_usage is not None, "PlaceSearchInput should use ScrollView component"
        
        # Check results.map() pattern (not FlatList renderItem)
        map_pattern = re.search(r'results\.map\(', content)
        assert map_pattern is not None, "PlaceSearchInput should use results.map() instead of FlatList"
        
        print("✓ PlaceSearchInput.tsx correctly uses ScrollView+map instead of FlatList")

    def test_map_canvas_native_has_user_location_marker_styles(self):
        """MapCanvas.native.tsx should have userDotOuter and userDotInner styles"""
        filepath = "/app/frontend/src/components/MapCanvas.native.tsx"
        
        with open(filepath, "r") as f:
            content = f.read()
        
        # Check for user location marker styles
        assert "userDotOuter" in content, "MapCanvas.native.tsx should have userDotOuter style"
        assert "userDotInner" in content, "MapCanvas.native.tsx should have userDotInner style"
        
        # Check for openDirections function
        assert "openDirections" in content, "MapCanvas.native.tsx should have openDirections function"
        
        # Check for eventLocationText style (for event callouts)
        assert "eventLocationText" in content, "MapCanvas.native.tsx should have eventLocationText style"
        
        # Check for onEventPress prop
        assert "onEventPress" in content, "MapCanvas.native.tsx should have onEventPress prop"
        
        # Check for userLocation prop in type definition
        assert "userLocation" in content, "MapCanvas.native.tsx should have userLocation prop"
        
        print("✓ MapCanvas.native.tsx has all required user location marker and event callout features")

    def test_map_canvas_web_has_new_props_in_type(self):
        """MapCanvas.web.tsx should have userLocation and onEventPress in type definition"""
        filepath = "/app/frontend/src/components/MapCanvas.web.tsx"
        
        with open(filepath, "r") as f:
            content = f.read()
        
        # Check for userLocation in type definition
        assert "userLocation" in content, "MapCanvas.web.tsx should have userLocation prop"
        
        # Check for onEventPress in type definition
        assert "onEventPress" in content, "MapCanvas.web.tsx should have onEventPress prop"
        
        print("✓ MapCanvas.web.tsx has userLocation and onEventPress in type definition")

    def test_map_screen_passes_props_to_canvas(self):
        """MapScreen.tsx should pass userLocation and onEventPress props to MapCanvas"""
        filepath = "/app/frontend/src/screens/MapScreen.tsx"
        
        with open(filepath, "r") as f:
            content = f.read()
        
        # Check userLocation state exists
        assert "userLocation" in content, "MapScreen should have userLocation state"
        
        # Check props are passed to MapCanvas
        assert "userLocation={" in content, "MapScreen should pass userLocation prop to MapCanvas"
        assert "onEventPress=" in content, "MapScreen should pass onEventPress prop to MapCanvas"
        
        print("✓ MapScreen.tsx passes userLocation and onEventPress props to MapCanvas")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
