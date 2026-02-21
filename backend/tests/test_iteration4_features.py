"""
Test iteration 4 features:
- Enhanced /api/users/{id} with relationship status and counts
- /api/friends/remove endpoint
- Privacy settings in /api/me
- GET /api/notifications, /api/friends/requests, /api/marketplace/listings
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://layout-bug-fixes.preview.emergentagent.com")
if BASE_URL.endswith("/"):
    BASE_URL = BASE_URL.rstrip("/")

# Test credentials
USER1_EMAIL = "user1@example.com"
USER1_PASS = "Password123"
USER2_EMAIL = "user2@example.com"
USER2_PASS = "Password123"


@pytest.fixture(scope="module")
def auth_token_user1():
    """Login as user1 and get token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER1_EMAIL,
        "password": USER1_PASS
    })
    if resp.status_code != 200:
        pytest.skip(f"Cannot login user1: {resp.status_code} - {resp.text}")
    data = resp.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def auth_token_user2():
    """Login as user2 and get token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER2_EMAIL,
        "password": USER2_PASS
    })
    if resp.status_code != 200:
        pytest.skip(f"Cannot login user2: {resp.status_code} - {resp.text}")
    data = resp.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def user1_headers(auth_token_user1):
    """Headers for user1."""
    return {"Authorization": f"Bearer {auth_token_user1}"}


@pytest.fixture(scope="module")
def user2_headers(auth_token_user2):
    """Headers for user2."""
    return {"Authorization": f"Bearer {auth_token_user2}"}


@pytest.fixture(scope="module")
def user1_id(user1_headers):
    """Get user1's ID from /api/me."""
    resp = requests.get(f"{BASE_URL}/api/me", headers=user1_headers)
    assert resp.status_code == 200, f"Failed to get user1 me: {resp.text}"
    return resp.json()["id"]


@pytest.fixture(scope="module")
def user2_id(user2_headers):
    """Get user2's ID from /api/me."""
    resp = requests.get(f"{BASE_URL}/api/me", headers=user2_headers)
    assert resp.status_code == 200, f"Failed to get user2 me: {resp.text}"
    return resp.json()["id"]


class TestHealthAndBasicEndpoints:
    """Test basic endpoints first."""
    
    def test_health_endpoint(self):
        """Health endpoint should return 200."""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        print("✓ Health endpoint working")


class TestGetMeWithPrivacySettings:
    """Test GET /api/me returns privacy field."""
    
    def test_get_me_returns_privacy(self, user1_headers):
        """GET /api/me should return privacy settings."""
        resp = requests.get(f"{BASE_URL}/api/me", headers=user1_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Must have id, email, username
        assert "id" in data
        assert "email" in data
        assert "username" in data
        
        # Must have privacy field
        assert "privacy" in data, "GET /api/me should return privacy field"
        privacy = data["privacy"]
        
        # Check privacy has expected keys
        assert "location_visible" in privacy, "Privacy should have location_visible"
        assert "routes_visible" in privacy, "Privacy should have routes_visible"
        assert "km_visible" in privacy, "Privacy should have km_visible"
        
        print(f"✓ GET /api/me returns privacy: {privacy}")


class TestPatchMePrivacySettings:
    """Test PATCH /api/me with privacy settings."""
    
    def test_patch_me_privacy_settings(self, user1_headers):
        """PATCH /api/me should save privacy settings correctly."""
        # First get current state
        resp = requests.get(f"{BASE_URL}/api/me", headers=user1_headers)
        assert resp.status_code == 200
        original_privacy = resp.json().get("privacy", {})
        
        # Toggle privacy settings
        new_privacy = {
            "location_visible": not original_privacy.get("location_visible", False),
            "routes_visible": "friends" if original_privacy.get("routes_visible") == "public" else "public",
            "km_visible": not original_privacy.get("km_visible", True),
            "last_active_visible": not original_privacy.get("last_active_visible", True)
        }
        
        # PATCH with new privacy
        resp = requests.patch(f"{BASE_URL}/api/me", 
                              json={"privacy": new_privacy},
                              headers=user1_headers)
        assert resp.status_code == 200, f"PATCH /api/me failed: {resp.text}"
        data = resp.json()
        
        # Verify privacy was updated
        assert "privacy" in data
        updated_privacy = data["privacy"]
        
        assert updated_privacy.get("location_visible") == new_privacy["location_visible"], \
            f"location_visible not saved: expected {new_privacy['location_visible']}, got {updated_privacy.get('location_visible')}"
        assert updated_privacy.get("routes_visible") == new_privacy["routes_visible"], \
            f"routes_visible not saved: expected {new_privacy['routes_visible']}, got {updated_privacy.get('routes_visible')}"
        assert updated_privacy.get("km_visible") == new_privacy["km_visible"], \
            f"km_visible not saved: expected {new_privacy['km_visible']}, got {updated_privacy.get('km_visible')}"
        assert updated_privacy.get("last_active_visible") == new_privacy["last_active_visible"], \
            f"last_active_visible not saved: expected {new_privacy['last_active_visible']}, got {updated_privacy.get('last_active_visible')}"
        
        print(f"✓ PATCH /api/me privacy settings saved correctly")
        
        # Verify by GET
        resp = requests.get(f"{BASE_URL}/api/me", headers=user1_headers)
        assert resp.status_code == 200
        verify_privacy = resp.json().get("privacy", {})
        assert verify_privacy.get("location_visible") == new_privacy["location_visible"]
        print(f"✓ Privacy settings persisted and verified via GET")


class TestGetUserWithRelationship:
    """Test GET /api/users/{id} with relationship status."""
    
    def test_get_own_user_returns_self_relationship(self, user1_headers, user1_id):
        """GET /api/users/{id} for own user should return relationship='self'."""
        resp = requests.get(f"{BASE_URL}/api/users/{user1_id}", headers=user1_headers)
        assert resp.status_code == 200, f"GET user failed: {resp.text}"
        data = resp.json()
        
        # Must have basic fields
        assert data.get("id") == user1_id
        assert "username" in data
        assert "level" in data
        
        # Must have relationship = self
        assert "relationship" in data, "Response should have relationship field"
        assert data["relationship"] == "self", f"Own profile should have relationship='self', got '{data['relationship']}'"
        
        print(f"✓ GET /api/users/{user1_id} returns relationship='self' for own profile")
    
    def test_get_other_user_returns_relationship_status(self, user1_headers, user2_id):
        """GET /api/users/{id} for other user should return relationship status."""
        resp = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=user1_headers)
        assert resp.status_code == 200, f"GET user failed: {resp.text}"
        data = resp.json()
        
        assert data.get("id") == user2_id
        assert "relationship" in data, "Response should have relationship field"
        
        # relationship should be one of: friends, not_friends, request_sent, request_received
        valid_relationships = ["friends", "not_friends", "request_sent", "request_received"]
        assert data["relationship"] in valid_relationships, \
            f"Invalid relationship: {data['relationship']}, expected one of {valid_relationships}"
        
        print(f"✓ GET /api/users/{user2_id} returns relationship='{data['relationship']}'")
    
    def test_get_user_returns_joined_routes_and_events(self, user1_headers, user1_id):
        """GET /api/users/{id} should return joined_routes and joined_events counts."""
        resp = requests.get(f"{BASE_URL}/api/users/{user1_id}", headers=user1_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # For own profile, should include stats (depending on privacy settings)
        # Since it's self, stats should be visible
        if "joined_routes" in data:
            assert isinstance(data["joined_routes"], int), "joined_routes should be int"
            print(f"✓ joined_routes count: {data['joined_routes']}")
        else:
            print("ℹ joined_routes not present (may be privacy controlled)")
            
        if "joined_events" in data:
            assert isinstance(data["joined_events"], int), "joined_events should be int"
            print(f"✓ joined_events count: {data['joined_events']}")
        else:
            print("ℹ joined_events not present (may be privacy controlled)")


class TestFriendsEndpoints:
    """Test friends-related endpoints."""
    
    def test_get_friends_requests_returns_200(self, user1_headers):
        """GET /api/friends/requests should return 200."""
        resp = requests.get(f"{BASE_URL}/api/friends/requests", headers=user1_headers)
        assert resp.status_code == 200, f"GET friends/requests failed: {resp.text}"
        data = resp.json()
        
        # Should have incoming and outgoing arrays
        assert "incoming" in data, "Response should have 'incoming' field"
        assert "outgoing" in data, "Response should have 'outgoing' field"
        assert isinstance(data["incoming"], list)
        assert isinstance(data["outgoing"], list)
        
        print(f"✓ GET /api/friends/requests: incoming={len(data['incoming'])}, outgoing={len(data['outgoing'])}")
    
    def test_get_friends_list_returns_200(self, user1_headers):
        """GET /api/friends should return 200."""
        resp = requests.get(f"{BASE_URL}/api/friends", headers=user1_headers)
        assert resp.status_code == 200, f"GET friends failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        print(f"✓ GET /api/friends: {len(data)} friends")


class TestFriendsRemoveEndpoint:
    """Test POST /api/friends/remove endpoint."""
    
    def test_friends_remove_not_in_list(self, user1_headers):
        """POST /api/friends/remove with non-friend should return 400."""
        # Use a fake user ID that's unlikely to be a friend
        fake_id = "000000000000000000000000"
        resp = requests.post(f"{BASE_URL}/api/friends/remove",
                             json={"from_user_id": fake_id},
                             headers=user1_headers)
        # Should return 400 "Not in friends list"
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print(f"✓ POST /api/friends/remove returns 400 for non-friend")
    
    def test_friends_remove_endpoint_exists(self, user1_headers, user2_id):
        """Test that /api/friends/remove endpoint exists and accepts valid request format."""
        # This test checks the endpoint exists - actual remove tested if they're friends
        resp = requests.post(f"{BASE_URL}/api/friends/remove",
                             json={"from_user_id": user2_id},
                             headers=user1_headers)
        # Either 200 (success) or 400 (not friends) are valid - just checking endpoint exists
        assert resp.status_code in [200, 400], f"Unexpected status: {resp.status_code}: {resp.text}"
        print(f"✓ POST /api/friends/remove endpoint exists, status={resp.status_code}")


class TestNotificationsEndpoint:
    """Test GET /api/notifications endpoint."""
    
    def test_get_notifications_returns_200(self, user1_headers):
        """GET /api/notifications should return 200."""
        resp = requests.get(f"{BASE_URL}/api/notifications", headers=user1_headers)
        assert resp.status_code == 200, f"GET notifications failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        
        # Verify notification structure if any exist
        if len(data) > 0:
            notif = data[0]
            assert "id" in notif
            assert "type" in notif
            assert "title" in notif
            assert "message" in notif
            assert "read" in notif
            print(f"✓ GET /api/notifications: {len(data)} notifications, first type: {notif['type']}")
        else:
            print(f"✓ GET /api/notifications: 0 notifications (empty list)")


class TestMarketplaceEndpoint:
    """Test GET /api/marketplace/listings endpoint."""
    
    def test_get_marketplace_listings_returns_200(self, user1_headers):
        """GET /api/marketplace/listings should return 200."""
        resp = requests.get(f"{BASE_URL}/api/marketplace/listings", headers=user1_headers)
        assert resp.status_code == 200, f"GET marketplace/listings failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        
        # Verify listing structure if any exist
        if len(data) > 0:
            listing = data[0]
            assert "id" in listing
            assert "title" in listing
            assert "price" in listing
            assert "seller_username" in listing
            print(f"✓ GET /api/marketplace/listings: {len(data)} listings")
        else:
            print(f"✓ GET /api/marketplace/listings: 0 listings (empty list)")


class TestFriendshipFlow:
    """Test friendship flow - request, accept, remove."""
    
    def test_friendship_flow(self, user1_headers, user2_headers, user1_id, user2_id):
        """Test complete friendship flow."""
        print("\n--- Friendship Flow Test ---")
        
        # Check current relationship
        resp = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=user1_headers)
        assert resp.status_code == 200
        initial_rel = resp.json().get("relationship")
        print(f"Initial relationship: {initial_rel}")
        
        if initial_rel == "friends":
            # They're already friends - test remove
            resp = requests.post(f"{BASE_URL}/api/friends/remove",
                                json={"from_user_id": user2_id},
                                headers=user1_headers)
            assert resp.status_code == 200, f"Remove friend failed: {resp.text}"
            print(f"✓ Removed friend successfully")
            
            # Verify relationship changed
            resp = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=user1_headers)
            assert resp.status_code == 200
            new_rel = resp.json().get("relationship")
            assert new_rel == "not_friends", f"After remove, expected not_friends, got {new_rel}"
            print(f"✓ Relationship changed to: {new_rel}")
            
            # Re-add friend request to restore state
            resp = requests.post(f"{BASE_URL}/api/friends/request",
                                json={"to_username": "user2"},  # assuming username is user2
                                headers=user1_headers)
            print(f"Sent friend request to restore state")
            
        elif initial_rel == "not_friends":
            # Send friend request
            resp = requests.post(f"{BASE_URL}/api/friends/request",
                                json={"to_username": "user2"},
                                headers=user1_headers)
            if resp.status_code == 200:
                print(f"✓ Sent friend request")
                
                # Verify relationship changed to request_sent
                resp = requests.get(f"{BASE_URL}/api/users/{user2_id}", headers=user1_headers)
                assert resp.status_code == 200
                new_rel = resp.json().get("relationship")
                # Could be request_sent or friends if auto-accepted
                assert new_rel in ["request_sent", "friends"], f"Expected request_sent, got {new_rel}"
                print(f"✓ Relationship changed to: {new_rel}")
        else:
            print(f"Current relationship is '{initial_rel}' - skipping flow test")
        
        print("--- Friendship Flow Test Complete ---\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
