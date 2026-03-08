"""
Iteration 6 Backend Tests - Testing:
1. GET /api/map/static-image returns 200 with image/png content (NOT 302 redirect)
2. GET /api/me returns privacy field with location_visible, km_visible, last_active_visible, routes_visible
3. PATCH /api/me with privacy body saves and returns updated user
4. POST /api/friends/remove returns 200 ok
5. GET /api/users/{user_id} returns relationship field
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ride-start-gating.preview.emergentagent.com")

# Test credentials
USER1_EMAIL = "user1@example.com"
USER1_PASSWORD = "Password123"
USER2_EMAIL = "user2@example.com"
USER2_PASSWORD = "Password123"


@pytest.fixture(scope="module")
def user1_token():
    """Get authentication token for user1"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER1_EMAIL,
        "password": USER1_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"User1 authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def user2_token():
    """Get authentication token for user2"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER2_EMAIL,
        "password": USER2_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"User2 authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def user1_id(user1_token):
    """Get user1's ID"""
    headers = {"Authorization": f"Bearer {user1_token}"}
    response = requests.get(f"{BASE_URL}/api/me", headers=headers)
    if response.status_code == 200:
        return response.json().get("id")
    pytest.skip(f"Failed to get user1 ID: {response.status_code}")


@pytest.fixture(scope="module")
def user2_id(user2_token):
    """Get user2's ID"""
    headers = {"Authorization": f"Bearer {user2_token}"}
    response = requests.get(f"{BASE_URL}/api/me", headers=headers)
    if response.status_code == 200:
        return response.json().get("id")
    pytest.skip(f"Failed to get user2 ID: {response.status_code}")


class TestStaticMapImage:
    """Test /api/map/static-image endpoint returns 200 with image bytes (not 302 redirect)"""

    def test_static_image_with_lat_lng_returns_200(self):
        """GET /api/map/static-image?lat=44.4&lng=26.1&zoom=14 returns 200 with image/png"""
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            params={"lat": 44.4, "lng": 26.1, "zoom": 14},
            allow_redirects=False  # Important: don't follow redirects to verify 200 response
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - should NOT be 302"
        content_type = response.headers.get("content-type", "")
        assert "image" in content_type.lower(), f"Expected image content-type, got {content_type}"
        assert len(response.content) > 10000, f"Expected substantial image data, got {len(response.content)} bytes"
        print(f"Static image returned 200 with {len(response.content)} bytes of {content_type}")

    def test_static_image_with_polyline_returns_200(self):
        """GET /api/map/static-image with polyline params returns 200 with image"""
        # Simple encoded polyline for testing
        response = requests.get(
            f"{BASE_URL}/api/map/static-image",
            params={
                "polyline_str": "_p~iF~ps|U_ulLnnqC",  # Simple test polyline
                "start_lat": 38.5,
                "start_lng": -120.2,
                "end_lat": 40.7,
                "end_lng": -120.95
            },
            allow_redirects=False
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert len(response.content) > 5000, f"Expected image data, got {len(response.content)} bytes"
        print(f"Polyline static image returned 200 with {len(response.content)} bytes")

    def test_static_image_no_params_returns_400(self):
        """GET /api/map/static-image without required params returns 400"""
        response = requests.get(f"{BASE_URL}/api/map/static-image")
        
        assert response.status_code == 400, f"Expected 400 for missing params, got {response.status_code}"
        print("Missing params correctly returns 400")


class TestMeEndpointPrivacy:
    """Test /api/me endpoint returns and accepts privacy settings"""

    def test_get_me_returns_privacy_field(self, user1_token):
        """GET /api/me returns privacy field with all visibility settings"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "privacy" in data, "Response should contain 'privacy' field"
        privacy = data["privacy"]
        
        # Verify all required privacy fields exist
        assert "location_visible" in privacy, "Privacy should have 'location_visible'"
        assert "km_visible" in privacy, "Privacy should have 'km_visible'"
        assert "last_active_visible" in privacy, "Privacy should have 'last_active_visible'"
        assert "routes_visible" in privacy, "Privacy should have 'routes_visible'"
        
        print(f"Privacy settings returned: {privacy}")

    def test_patch_me_with_privacy_saves_settings(self, user1_token):
        """PATCH /api/me with privacy body saves and returns updated user"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        
        # Set specific privacy settings
        new_privacy = {
            "location_visible": True,
            "km_visible": False,
            "last_active_visible": True,
            "routes_visible": "friends"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/me",
            headers=headers,
            json={"privacy": new_privacy}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify the returned privacy matches what we sent
        returned_privacy = data.get("privacy", {})
        assert returned_privacy.get("location_visible") == True, "location_visible should be True"
        assert returned_privacy.get("km_visible") == False, "km_visible should be False"
        assert returned_privacy.get("last_active_visible") == True, "last_active_visible should be True"
        assert returned_privacy.get("routes_visible") == "friends", "routes_visible should be 'friends'"
        
        print(f"Privacy updated successfully: {returned_privacy}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/me", headers=headers)
        assert get_response.status_code == 200
        get_privacy = get_response.json().get("privacy", {})
        assert get_privacy.get("location_visible") == True, "Persisted location_visible should be True"
        assert get_privacy.get("routes_visible") == "friends", "Persisted routes_visible should be 'friends'"
        
        # Reset to default values
        reset_privacy = {
            "location_visible": False,
            "km_visible": True,
            "last_active_visible": True,
            "routes_visible": "public"
        }
        requests.patch(f"{BASE_URL}/api/me", headers=headers, json={"privacy": reset_privacy})
        print("Privacy settings persisted and verified via GET")


class TestUserProfileRelationship:
    """Test /api/users/{user_id} returns relationship field"""

    def test_get_user_returns_relationship_self(self, user1_token, user1_id):
        """GET /api/users/{own_id} returns relationship: 'self'"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/users/{user1_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "relationship" in data, "Response should contain 'relationship' field"
        assert data["relationship"] == "self", f"Expected 'self' for own profile, got {data['relationship']}"
        print(f"Own profile relationship: {data['relationship']}")

    def test_get_other_user_returns_relationship(self, user1_token, user2_id):
        """GET /api/users/{other_id} returns relationship field"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "relationship" in data, "Response should contain 'relationship' field"
        # Relationship can be: not_friends, friends, request_sent, request_received
        valid_relationships = ["not_friends", "friends", "request_sent", "request_received"]
        assert data["relationship"] in valid_relationships, f"Invalid relationship: {data['relationship']}"
        print(f"Other user relationship: {data['relationship']}")


class TestFriendsRemove:
    """Test POST /api/friends/remove endpoint"""

    def test_friends_remove_success(self, user1_token, user2_token, user1_id, user2_id):
        """POST /api/friends/remove returns 200 ok when users are friends"""
        headers1 = {"Authorization": f"Bearer {user1_token}"}
        headers2 = {"Authorization": f"Bearer {user2_token}"}
        
        # First check the current relationship between users
        rel_response = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=headers1)
        current_rel = rel_response.json().get("relationship", "not_friends")
        print(f"Current relationship: {current_rel}")
        
        if current_rel == "friends":
            # Test removing friend
            response = requests.post(
                f"{BASE_URL}/api/friends/remove",
                headers=headers1,
                json={"from_user_id": user2_id}
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
            data = response.json()
            assert data.get("ok") == True, f"Expected ok: true, got {data}"
            print("Friend removal successful")
            
            # Re-add friend for other tests by sending request from user2
            requests.post(
                f"{BASE_URL}/api/friends/request",
                headers=headers2,
                json={"username": "user1"}  # Assuming user1's username
            )
            # Accept from user1
            requests.post(
                f"{BASE_URL}/api/friends/accept",
                headers=headers1,
                json={"from_user_id": user2_id}
            )
        elif current_rel == "not_friends":
            # Need to make them friends first, then test remove
            # Send request from user1 to user2
            req_response = requests.post(
                f"{BASE_URL}/api/friends/request",
                headers=headers1,
                json={"username": "user2"}  # Assuming user2's username
            )
            print(f"Friend request sent: {req_response.status_code}")
            
            # Accept from user2
            acc_response = requests.post(
                f"{BASE_URL}/api/friends/accept",
                headers=headers2,
                json={"from_user_id": user1_id}
            )
            print(f"Friend request accepted: {acc_response.status_code}")
            
            # Now remove
            response = requests.post(
                f"{BASE_URL}/api/friends/remove",
                headers=headers1,
                json={"from_user_id": user2_id}
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code} - {response.text}"
            data = response.json()
            assert data.get("ok") == True, f"Expected ok: true, got {data}"
            print("Friend removal successful after adding")
        else:
            # request_sent or request_received - cancel/reject first
            print(f"Skipping remove test - relationship is '{current_rel}', need to handle pending requests")
            pytest.skip(f"Cannot test remove - relationship is {current_rel}")

    def test_friends_remove_not_friend_returns_400(self, user1_token, user2_id):
        """POST /api/friends/remove returns 400 when users are not friends"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        
        # Check if they are not friends
        rel_response = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=headers)
        current_rel = rel_response.json().get("relationship", "not_friends")
        
        if current_rel != "friends":
            response = requests.post(
                f"{BASE_URL}/api/friends/remove",
                headers=headers,
                json={"from_user_id": user2_id}
            )
            
            assert response.status_code == 400, f"Expected 400 for non-friend, got {response.status_code}"
            print("Correctly returns 400 when not friends")
        else:
            pytest.skip("Users are friends, cannot test non-friend removal error")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
