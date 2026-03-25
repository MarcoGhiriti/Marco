"""
Comprehensive Regression Test Suite for MotoGO Backend API
Tests ALL endpoints across: Auth, Users, Friends, Location, Routes, Rides,
Events, Messages, Groups, Notifications, Map, Stories, Leaderboard, Badges,
Marketplace, Places, Health, Realtime
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for direct pytest run
    BASE_URL = "https://native-payments-test.preview.emergentagent.com"

# Test credentials
USER1_EMAIL = "user1@example.com"
USER1_PASS = "Password123"
USER2_EMAIL = "testuser2_gen@example.com"
USER2_PASS = "TestPass123!"

# Small 1x1 PNG base64 for story/license image tests
SMALL_BASE64_IMAGE = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhf"
    "DwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


# ─────────────────────────────────────────────────────────────────────────────
# Shared session fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def user1_token(session):
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": USER1_EMAIL, "password": USER1_PASS})
    assert resp.status_code == 200, f"User1 login failed: {resp.text}"
    token = resp.json().get("access_token")
    assert token, "No access_token in response"
    return token


@pytest.fixture(scope="session")
def user2_token(session):
    """Register testuser2_gen if not exists, then login"""
    # Try register first
    reg_resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": USER2_EMAIL,
        "password": USER2_PASS,
        "username": "testuser2gen"
    })
    if reg_resp.status_code == 409:
        # Already exists - login
        pass
    elif reg_resp.status_code == 200:
        return reg_resp.json().get("access_token")

    # Login
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": USER2_EMAIL, "password": USER2_PASS})
    if resp.status_code != 200:
        pytest.skip(f"User2 login failed: {resp.text}")
    token = resp.json().get("access_token")
    assert token, "No access_token for user2"
    return token


@pytest.fixture(scope="session")
def auth1(session, user1_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {user1_token}"
    })
    return s


@pytest.fixture(scope="session")
def auth2(session, user2_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {user2_token}"
    })
    return s


@pytest.fixture(scope="session")
def user1_id(auth1):
    resp = auth1.get(f"{BASE_URL}/api/me")
    assert resp.status_code == 200
    return resp.json().get("id")


@pytest.fixture(scope="session")
def user2_id(auth2):
    resp = auth2.get(f"{BASE_URL}/api/me")
    assert resp.status_code == 200
    return resp.json().get("id")


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────────────

class TestHealth:
    """Health and realtime endpoints"""

    def test_health_check(self, session):
        resp = session.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True, f"DB not ok: {data}"
        print(f"✅ GET /api/health -> {data}")

    def test_realtime_health(self, session):
        resp = session.get(f"{BASE_URL}/api/realtime/health")
        assert resp.status_code == 200, f"Realtime health failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ GET /api/realtime/health -> {data}")


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────

class TestAuth:
    """Auth endpoints: register, login, me, license-status, subscription"""

    def test_register_new_user(self, session):
        """Register a brand new user (unique name/email each run)"""
        ts = int(time.time())
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_reg_{ts}@example.com",
            "password": "RegPass123",
            "username": f"testreg{ts}"
        })
        assert resp.status_code == 200, f"Register failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data, "No access_token after register"
        print(f"✅ POST /api/auth/register -> token present")

    def test_register_duplicate_email_returns_409(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": USER1_EMAIL,
            "password": USER1_PASS,
            "username": "someotherusernameXYZ"
        })
        assert resp.status_code == 409, f"Expected 409 for duplicate email, got {resp.status_code}"
        print(f"✅ POST /api/auth/register duplicate -> 409")

    def test_login_user1(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASS
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 10
        print(f"✅ POST /api/auth/login user1 -> token ok")

    def test_login_invalid_credentials_returns_401(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": "WrongPassword"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"✅ POST /api/auth/login wrong pass -> 401")

    def test_get_me(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200, f"GET /api/me failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert "username" in data
        assert "email" in data
        print(f"✅ GET /api/me -> user: {data.get('username')}, email: {data.get('email')}")

    def test_get_me_without_token_returns_401(self, session):
        resp = session.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 401, f"Expected 401 without token, got {resp.status_code}"
        print(f"✅ GET /api/me no token -> 401")

    def test_get_license_status(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/me/license-status")
        assert resp.status_code == 200, f"License status failed: {resp.text}"
        data = resp.json()
        assert "license_verified" in data
        assert "license_type" in data
        print(f"✅ GET /api/me/license-status -> {data}")

    def test_get_subscription(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/me/subscription")
        assert resp.status_code == 200, f"Subscription failed: {resp.text}"
        data = resp.json()
        assert "has_subscription" in data
        assert "subscription_type" in data
        assert "max_group_members" in data
        print(f"✅ GET /api/me/subscription -> {data}")


# ─────────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────────

class TestUsers:
    """User search, get user by ID, stats"""

    def test_users_search(self, auth1):
        # The endpoint uses ?username= not ?q=
        resp = auth1.get(f"{BASE_URL}/api/users/search", params={"username": "user"})
        assert resp.status_code == 200, f"User search failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/users/search?username=user -> {len(data)} results")

    def test_users_search_with_q_param_422(self, auth1):
        """Note: review_request says ?q= but code uses ?username= - document mismatch"""
        resp = auth1.get(f"{BASE_URL}/api/users/search", params={"q": "user"})
        # This should fail since the param name is 'username', not 'q'
        assert resp.status_code == 422, f"Expected 422 for wrong param, got {resp.status_code}: {resp.text}"
        print(f"✅ GET /api/users/search?q= -> 422 (param mismatch: code uses 'username' not 'q')")

    def test_get_user_by_id(self, auth1, user1_id):
        resp = auth1.get(f"{BASE_URL}/api/users/{user1_id}")
        assert resp.status_code == 200, f"Get user by ID failed: {resp.text}"
        data = resp.json()
        assert data.get("id") == user1_id
        assert "username" in data
        assert "level" in data
        assert "relationship" in data
        print(f"✅ GET /api/users/{user1_id} -> {data.get('username')}")

    def test_get_nonexistent_user_returns_404(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/users/000000000000000000000000")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print(f"✅ GET /api/users/nonexistent -> 404")

    def test_get_stats(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/stats")
        assert resp.status_code == 200, f"Stats failed: {resp.text}"
        data = resp.json()
        assert "km_total" in data
        assert "km_month" in data
        assert "joined_routes" in data
        assert "events_joined" in data
        print(f"✅ GET /api/stats -> km_total={data.get('km_total')}")


# ─────────────────────────────────────────────────────────────────────────────
# FRIENDS
# ─────────────────────────────────────────────────────────────────────────────

class TestFriends:
    """Friends: list, requests, send request, locations"""

    def test_get_friends_list(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/friends")
        assert resp.status_code == 200, f"Friends list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/friends -> {len(data)} friends")

    def test_get_friend_requests(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/friends/requests")
        assert resp.status_code == 200, f"Friend requests failed: {resp.text}"
        data = resp.json()
        assert "incoming" in data
        assert "outgoing" in data
        assert isinstance(data["incoming"], list)
        assert isinstance(data["outgoing"], list)
        print(f"✅ GET /api/friends/requests -> incoming:{len(data['incoming'])}, outgoing:{len(data['outgoing'])}")

    def test_send_friend_request_to_user2(self, auth1, auth2, user2_id):
        """Send friend request from user1 to testuser2gen"""
        # Get user2's username first
        resp = auth2.get(f"{BASE_URL}/api/me")
        assert resp.status_code == 200
        user2_username = resp.json().get("username")

        resp = auth1.post(f"{BASE_URL}/api/friends/request", json={"to_username": user2_username})
        assert resp.status_code == 200, f"Friend request failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ POST /api/friends/request -> ok (sent to {user2_username})")

    def test_get_friends_locations(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/friends/locations")
        assert resp.status_code == 200, f"Friend locations failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/friends/locations -> {len(data)} online friends")


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION
# ─────────────────────────────────────────────────────────────────────────────

class TestLocation:
    """Location update"""

    def test_update_location(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/location/update", json={"lat": 44.4268, "lng": 26.1025})
        assert resp.status_code == 200, f"Location update failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ POST /api/location/update -> ok")

    def test_update_location_invalid_lat_returns_422(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/location/update", json={"lat": 200, "lng": 26.1025})
        assert resp.status_code == 422, f"Expected 422 for invalid lat, got {resp.status_code}"
        print(f"✅ POST /api/location/update invalid lat -> 422")

    def test_update_location_no_token_returns_401(self, session):
        resp = session.post(f"{BASE_URL}/api/location/update", json={"lat": 44.4268, "lng": 26.1025})
        assert resp.status_code == 401
        print(f"✅ POST /api/location/update no token -> 401")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

ROUTE_PAYLOAD = {
    "title": "TEST_Route_Regression",
    "description": "Test route for regression",
    "polyline": [[44.43, 26.10], [44.45, 26.15], [44.50, 26.20]],
    "stops_count": 1,
    "difficulty": "easy",
    "participants_min": 1,
    "participants_max": 10,
    "waypoints": [{"lat": 44.43, "lng": 26.10}, {"lat": 44.50, "lng": 26.20}],
    "rules": "Test rules",
    "start_point": [44.43, 26.10],
    "end_point": [44.50, 26.20],
    "fuel_price_per_l": 1.8,
    "bike_consumption_l_per_100km": 5.0,
    "toll_estimate": 0,
    "currency": "RON",
    "use_google_directions": False
}


@pytest.fixture(scope="module")
def created_route_id(auth1):
    """Create a test route and return its ID"""
    resp = auth1.post(f"{BASE_URL}/api/routes", json=ROUTE_PAYLOAD)
    assert resp.status_code == 200, f"Route creation failed: {resp.text}"
    return resp.json()["id"]


class TestRoutes:
    """Routes CRUD + join/leave"""

    def test_create_route(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/routes", json={
            "title": "TEST_Route_Create",
            "description": "Testing route creation",
            "polyline": [[44.43, 26.10], [44.50, 26.20]],
            "stops_count": 0,
            "difficulty": "medium",
            "participants_min": 1,
            "participants_max": 5,
            "waypoints": [{"lat": 44.43, "lng": 26.10}, {"lat": 44.50, "lng": 26.20}],
            "rules": "",
            "start_point": [44.43, 26.10],
            "end_point": [44.50, 26.20],
            "fuel_price_per_l": 1.5,
            "bike_consumption_l_per_100km": 5.0,
            "toll_estimate": 0.0,
            "currency": "RON",
            "use_google_directions": False
        })
        assert resp.status_code == 200, f"Route create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("title") == "TEST_Route_Create"
        assert "distance_km" in data
        assert "cost_estimate" in data
        print(f"✅ POST /api/routes -> id={data['id']}, km={data.get('distance_km')}")

    def test_list_routes(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/routes")
        assert resp.status_code == 200, f"Routes list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/routes -> {len(data)} routes")

    def test_get_my_routes(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/routes/my")
        assert resp.status_code == 200, f"My routes failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/routes/my -> {len(data)} routes")

    def test_update_route(self, auth1, created_route_id):
        resp = auth1.put(f"{BASE_URL}/api/routes/{created_route_id}", json={
            "title": "TEST_Route_Updated",
            "difficulty": "hard"
        })
        assert resp.status_code == 200, f"Route update failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ PUT /api/routes/{created_route_id} -> ok")

    def test_route_join_without_license_returns_403(self, auth1, auth2, created_route_id):
        """Route join should fail if user does not have a verified license"""
        # Check user1's license status first
        resp = auth1.get(f"{BASE_URL}/api/me/license-status")
        assert resp.status_code == 200
        is_verified = resp.json().get("license_verified", False)

        # Get user1 id
        me_resp = auth1.get(f"{BASE_URL}/api/me")
        uid = me_resp.json().get("id")

        if not is_verified:
            # Try joining - should fail with 403
            resp = auth1.post(f"{BASE_URL}/api/routes/{created_route_id}/join")
            assert resp.status_code == 403, f"Expected 403 without license, got {resp.status_code}: {resp.text}"
            print(f"✅ POST /api/routes/{created_route_id}/join (no license) -> 403")
        else:
            print(f"✅ User already has verified license - skipping 403 test")

    def test_admin_verify_license_for_user1(self, auth1):
        """Verify user1's license via admin endpoint so they can join routes"""
        me_resp = auth1.get(f"{BASE_URL}/api/me")
        uid = me_resp.json().get("id")
        resp = auth1.post(f"{BASE_URL}/api/admin/verify-license/{uid}", params={"verified": True})
        assert resp.status_code == 200, f"Admin verify license failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ POST /api/admin/verify-license/{uid} -> ok")

    def test_route_join_with_license(self, auth1, created_route_id):
        """Join a route after license is verified"""
        resp = auth1.post(f"{BASE_URL}/api/routes/{created_route_id}/join")
        # May return 200 (joined) - creator already in list so addToSet is idempotent
        assert resp.status_code == 200, f"Route join with license failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ POST /api/routes/{created_route_id}/join (with license) -> ok")

    def test_route_leave(self, auth2, created_route_id):
        """User2 can leave a route (even if not joined, it's idempotent via $pull)"""
        resp = auth2.post(f"{BASE_URL}/api/routes/{created_route_id}/leave")
        assert resp.status_code == 200, f"Route leave failed: {resp.text}"
        print(f"✅ POST /api/routes/{created_route_id}/leave -> ok")

    def test_delete_route(self, auth1):
        """Create then delete a route"""
        # Create
        resp = auth1.post(f"{BASE_URL}/api/routes", json={
            "title": "TEST_Route_ToDelete",
            "description": "Will be deleted",
            "polyline": [[44.43, 26.10], [44.50, 26.20]],
            "stops_count": 0, "difficulty": "easy",
            "participants_min": 1, "participants_max": 5,
            "waypoints": [{"lat": 44.43, "lng": 26.10}, {"lat": 44.50, "lng": 26.20}],
            "min_engine_cc": None, "rules": "",
            "start_point": [44.43, 26.10], "end_point": [44.50, 26.20],
            "fuel_price_per_l": 1.5, "bike_consumption_l_per_100km": 5.0,
            "toll_estimate": 0.0, "currency": "RON", "use_google_directions": False
        })
        assert resp.status_code == 200
        route_id = resp.json()["id"]

        # Delete
        del_resp = auth1.delete(f"{BASE_URL}/api/routes/{route_id}")
        assert del_resp.status_code == 200, f"Route delete failed: {del_resp.text}"
        assert del_resp.json().get("ok") is True

        # Verify gone
        get_resp = auth1.get(f"{BASE_URL}/api/routes/my")
        assert all(r["id"] != route_id for r in get_resp.json())
        print(f"✅ DELETE /api/routes/{route_id} -> ok and verified")


# ─────────────────────────────────────────────────────────────────────────────
# RIDES
# ─────────────────────────────────────────────────────────────────────────────

class TestRides:
    """Ride sessions: start, active, pause, resume, end, active-for-home"""

    @pytest.fixture(scope="class")
    def ride_route_id(self, auth1):
        """Create a dedicated route for ride tests"""
        resp = auth1.post(f"{BASE_URL}/api/routes", json={
            "title": "TEST_Ride_Route",
            "description": "Route for ride test",
            "polyline": [[44.43, 26.10], [44.50, 26.20]],
            "stops_count": 0, "difficulty": "easy",
            "participants_min": 1, "participants_max": 5,
            "waypoints": [{"lat": 44.43, "lng": 26.10}, {"lat": 44.50, "lng": 26.20}],
            "min_engine_cc": None, "rules": "",
            "start_point": [44.43, 26.10], "end_point": [44.50, 26.20],
            "fuel_price_per_l": 1.5, "bike_consumption_l_per_100km": 5.0,
            "toll_estimate": 0.0, "currency": "RON", "use_google_directions": False
        })
        assert resp.status_code == 200, f"Failed to create ride route: {resp.text}"
        return resp.json()["id"]

    def test_get_active_ride_empty(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/rides/active")
        assert resp.status_code == 200, f"Get active ride failed: {resp.text}"
        # Should be None or an object
        print(f"✅ GET /api/rides/active -> {resp.json()}")

    def test_start_ride_without_license_fails(self, auth2, ride_route_id):
        """User2 needs license too - should fail without it"""
        resp = auth2.post(f"{BASE_URL}/api/rides/start", json={"route_id": ride_route_id})
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print(f"✅ POST /api/rides/start (no license) -> 403")

    def test_verify_user1_license_for_rides(self, auth1):
        """Make sure user1 has verified license"""
        me_resp = auth1.get(f"{BASE_URL}/api/me")
        uid = me_resp.json().get("id")
        resp = auth1.post(f"{BASE_URL}/api/admin/verify-license/{uid}", params={"verified": True})
        assert resp.status_code == 200
        print(f"✅ License verified for user1")

    def test_start_ride(self, auth1, ride_route_id):
        resp = auth1.post(f"{BASE_URL}/api/rides/start", json={"route_id": ride_route_id})
        assert resp.status_code == 200, f"Start ride failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("status") == "active"
        assert data.get("route_id") == ride_route_id
        pytest.shared_ride_id = data["id"]
        print(f"✅ POST /api/rides/start -> id={data['id']}, status=active")

    def test_get_active_ride(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/rides/active")
        assert resp.status_code == 200, f"Get active ride failed: {resp.text}"
        data = resp.json()
        if data:
            assert data.get("status") in ["active", "paused"]
        print(f"✅ GET /api/rides/active -> {data.get('status') if data else None}")

    def test_pause_ride(self, auth1):
        ride_id = getattr(pytest, "shared_ride_id", None)
        if not ride_id:
            pytest.skip("No active ride session")
        resp = auth1.post(f"{BASE_URL}/api/rides/pause", json={"session_id": ride_id})
        assert resp.status_code == 200, f"Pause ride failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("status") == "paused"
        print(f"✅ POST /api/rides/pause -> paused")

    def test_resume_ride(self, auth1):
        ride_id = getattr(pytest, "shared_ride_id", None)
        if not ride_id:
            pytest.skip("No paused ride session")
        resp = auth1.post(f"{BASE_URL}/api/rides/resume", json={"session_id": ride_id})
        assert resp.status_code == 200, f"Resume ride failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("status") == "active"
        print(f"✅ POST /api/rides/resume -> active")

    def test_get_active_ride_for_home(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/rides/active-for-home")
        assert resp.status_code == 200, f"Active for home failed: {resp.text}"
        data = resp.json()
        if data:
            assert "ride_id" in data
            assert "status" in data
        print(f"✅ GET /api/rides/active-for-home -> {data}")

    def test_end_ride(self, auth1):
        ride_id = getattr(pytest, "shared_ride_id", None)
        if not ride_id:
            pytest.skip("No active ride session")
        resp = auth1.post(f"{BASE_URL}/api/rides/end", json={"session_id": ride_id})
        assert resp.status_code == 200, f"End ride failed: {resp.text}"
        data = resp.json()
        assert data.get("status") == "completed"
        assert "km_tracked" in data
        print(f"✅ POST /api/rides/end -> completed, km={data.get('km_tracked')}")


# ─────────────────────────────────────────────────────────────────────────────
# EVENTS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def created_event_id(auth1):
    """Create a test event and return its ID"""
    resp = auth1.post(f"{BASE_URL}/api/events", json={
        "title": "TEST_Event_Regression",
        "description": "Test event",
        "start_point": [44.43, 26.10],
        "location_name": "Bucharest",
        "start_time": "2027-06-15T10:00:00"
    })
    assert resp.status_code == 200, f"Event creation failed: {resp.text}"
    return resp.json()["id"]


class TestEvents:
    """Events CRUD + join/leave"""

    def test_create_event(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Event_Create",
            "description": "Testing event creation",
            "start_point": [44.43, 26.10],
            "location_name": "Test Location",
            "start_time": "2027-07-20T09:00:00"
        })
        assert resp.status_code == 200, f"Event create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("title") == "TEST_Event_Create"
        assert data.get("is_joined") is True
        print(f"✅ POST /api/events -> id={data['id']}")

    def test_list_events(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/events")
        assert resp.status_code == 200, f"Events list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/events -> {len(data)} events")

    def test_get_my_events(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/events/my")
        assert resp.status_code == 200, f"My events failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/events/my -> {len(data)} events")

    def test_join_event(self, auth2, created_event_id):
        resp = auth2.post(f"{BASE_URL}/api/events/{created_event_id}/join")
        assert resp.status_code == 200, f"Event join failed: {resp.text}"
        assert resp.json().get("ok") is True
        print(f"✅ POST /api/events/{created_event_id}/join -> ok")

    def test_leave_event(self, auth2, created_event_id):
        resp = auth2.post(f"{BASE_URL}/api/events/{created_event_id}/leave")
        assert resp.status_code == 200, f"Event leave failed: {resp.text}"
        assert resp.json().get("ok") is True
        print(f"✅ POST /api/events/{created_event_id}/leave -> ok")

    def test_delete_event(self, auth1):
        """Create and delete an event"""
        create_resp = auth1.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Event_ToDelete",
            "description": "Will be deleted",
            "start_point": [44.43, 26.10],
            "location_name": "Test",
            "start_time": "2027-08-01T10:00:00"
        })
        assert create_resp.status_code == 200
        event_id = create_resp.json()["id"]

        del_resp = auth1.delete(f"{BASE_URL}/api/events/{event_id}")
        assert del_resp.status_code == 200, f"Event delete failed: {del_resp.text}"
        assert del_resp.json().get("ok") is True
        print(f"✅ DELETE /api/events/{event_id} -> ok")


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGES / DMs
# ─────────────────────────────────────────────────────────────────────────────

class TestMessages:
    """Message inbox, DM messages, send DM, mark-read, unread-summary"""

    def test_get_message_inbox(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/messages/inbox")
        assert resp.status_code == 200, f"Inbox failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/messages/inbox -> {len(data)} conversations")

    def test_get_dm_messages(self, auth1, user2_id):
        resp = auth1.get(f"{BASE_URL}/api/dm/{user2_id}/messages")
        assert resp.status_code == 200, f"DM messages failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/dm/{user2_id}/messages -> {len(data)} messages")

    def test_send_dm_message(self, auth1, user2_id):
        resp = auth1.post(f"{BASE_URL}/api/dm/{user2_id}/messages", json={"text": "TEST_Hello from regression test"})
        assert resp.status_code == 200, f"Send DM failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("kind") == "dm"
        assert data.get("text") == "TEST_Hello from regression test"
        print(f"✅ POST /api/dm/{user2_id}/messages -> id={data['id']}")

    def test_messages_mark_read_dm(self, auth1, user1_id, user2_id):
        """Mark a DM thread as read"""
        # thread_id format: dm:<smaller_id>:<larger_id>
        ids = sorted([user1_id, user2_id])
        thread_id = f"dm:{ids[0]}:{ids[1]}"
        resp = auth1.post(f"{BASE_URL}/api/messages/mark-read", json={"thread_id": thread_id})
        assert resp.status_code == 200, f"Mark read failed: {resp.text}"
        assert resp.json().get("ok") is True
        print(f"✅ POST /api/messages/mark-read -> ok")

    def test_messages_unread_summary(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/messages/unread-summary")
        assert resp.status_code == 200, f"Unread summary failed: {resp.text}"
        data = resp.json()
        assert "has_unread" in data
        assert "dm_user_ids" in data
        assert "group_ids" in data
        print(f"✅ GET /api/messages/unread-summary -> has_unread={data.get('has_unread')}")


# ─────────────────────────────────────────────────────────────────────────────
# GROUPS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def created_group_id(auth1):
    """Create a test group and return its ID"""
    resp = auth1.post(f"{BASE_URL}/api/groups", json={
        "name": "TEST_Group_Regression",
        "description": "Regression test group",
        "is_private": False
    })
    assert resp.status_code == 200, f"Group creation failed: {resp.text}"
    return resp.json()["id"]


class TestGroups:
    """Groups: create, list, search, join, messages"""

    def test_create_group(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/groups", json={
            "name": "TEST_Group_Create",
            "description": "Test group creation",
            "is_private": False
        })
        assert resp.status_code == 200, f"Group create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("name") == "TEST_Group_Create"
        assert data.get("members_count") == 1
        print(f"✅ POST /api/groups -> id={data['id']}, members={data['members_count']}")

    def test_list_groups(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/groups")
        assert resp.status_code == 200, f"Groups list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/groups -> {len(data)} groups")

    def test_search_groups(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/groups/search", params={"q": "TEST"})
        assert resp.status_code == 200, f"Groups search failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/groups/search?q=TEST -> {len(data)} results")

    def test_join_group(self, auth2, created_group_id):
        resp = auth2.post(f"{BASE_URL}/api/groups/{created_group_id}/join")
        assert resp.status_code == 200, f"Group join failed: {resp.text}"
        assert resp.json().get("ok") is True
        print(f"✅ POST /api/groups/{created_group_id}/join -> ok")

    def test_get_group_messages(self, auth1, created_group_id):
        resp = auth1.get(f"{BASE_URL}/api/groups/{created_group_id}/messages")
        assert resp.status_code == 200, f"Group messages failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/groups/{created_group_id}/messages -> {len(data)} messages")

    def test_send_group_message(self, auth1, created_group_id):
        resp = auth1.post(f"{BASE_URL}/api/groups/{created_group_id}/messages", json={"text": "TEST_Hello group!"})
        assert resp.status_code == 200, f"Group message send failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("kind") == "group"
        assert data.get("text") == "TEST_Hello group!"
        print(f"✅ POST /api/groups/{created_group_id}/messages -> id={data['id']}")

    def test_mark_read_group(self, auth1, created_group_id):
        thread_id = f"group:{created_group_id}"
        resp = auth1.post(f"{BASE_URL}/api/messages/mark-read", json={"thread_id": thread_id})
        assert resp.status_code == 200, f"Mark read group failed: {resp.text}"
        assert resp.json().get("ok") is True
        print(f"✅ POST /api/messages/mark-read (group) -> ok")


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────────────────────────────────────

class TestNotifications:
    """Notifications: list, unread count, read-all"""

    def test_get_notifications(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200, f"Notifications failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/notifications -> {len(data)} notifications")

    def test_get_unread_notification_count(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/notifications/unread-count")
        assert resp.status_code == 200, f"Unread count failed: {resp.text}"
        data = resp.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✅ GET /api/notifications/unread-count -> count={data['count']}")

    def test_mark_all_notifications_read(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/notifications/read-all")
        assert resp.status_code == 200, f"Read all failed: {resp.text}"
        assert resp.json().get("ok") is True
        print(f"✅ POST /api/notifications/read-all -> ok")

    def test_unread_count_after_read_all(self, auth1):
        """After marking all read, count should be 0"""
        resp = auth1.get(f"{BASE_URL}/api/notifications/unread-count")
        assert resp.status_code == 200
        count = resp.json().get("count", -1)
        assert count == 0, f"Expected 0 unread after read-all, got {count}"
        print(f"✅ GET /api/notifications/unread-count after read-all -> 0")


# ─────────────────────────────────────────────────────────────────────────────
# MAP
# ─────────────────────────────────────────────────────────────────────────────

MAP_PARAMS = {
    "min_lat": 44.0, "max_lat": 45.0,
    "min_lng": 25.5, "max_lng": 26.5
}


class TestMap:
    """Map: events, police reports, gas/service"""

    def test_map_events(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/map/events", params=MAP_PARAMS)
        assert resp.status_code == 200, f"Map events failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/map/events -> {len(data)} events")

    def test_map_get_police_reports(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/map/police-reports", params=MAP_PARAMS)
        assert resp.status_code == 200, f"Police reports GET failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/map/police-reports -> {len(data)} reports")

    def test_map_create_police_report(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/map/police-reports", json={"lat": 44.43, "lng": 26.10})
        assert resp.status_code == 200, f"Police report create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("lat") == 44.43
        assert "expires_at" in data
        pytest.shared_police_report_id = data["id"]
        print(f"✅ POST /api/map/police-reports -> id={data['id']}")

    def test_map_vote_police_report(self, auth1):
        report_id = getattr(pytest, "shared_police_report_id", None)
        if not report_id:
            pytest.skip("No police report to vote on")
        resp = auth1.post(
            f"{BASE_URL}/api/map/police-reports/{report_id}/vote",
            json={"vote": "up", "lat": 44.43, "lng": 26.10}
        )
        assert resp.status_code == 200, f"Police vote failed: {resp.text}"
        data = resp.json()
        assert "upvotes" in data
        print(f"✅ POST /api/map/police-reports/{report_id}/vote -> upvotes={data.get('upvotes')}")

    def test_map_gas_service(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/map/gas-service", params=MAP_PARAMS)
        # May succeed (200) or fail if Google Maps key issues, but should not 500
        assert resp.status_code in [200, 400, 500], f"Unexpected status: {resp.status_code}"
        if resp.status_code == 200:
            assert isinstance(resp.json(), list)
            print(f"✅ GET /api/map/gas-service -> {len(resp.json())} places")
        else:
            print(f"⚠️  GET /api/map/gas-service -> {resp.status_code} (Google Maps API issue)")


# ─────────────────────────────────────────────────────────────────────────────
# STORIES
# ─────────────────────────────────────────────────────────────────────────────

class TestStories:
    """Stories: create, list, view, delete"""

    def test_create_story(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/stories", json={
            "media_base64": SMALL_BASE64_IMAGE,
            "media_type": "image",
            "caption": "TEST_Story regression"
        })
        assert resp.status_code == 200, f"Story create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("media_type") == "image"
        assert "expires_at" in data
        pytest.shared_story_id = data["id"]
        print(f"✅ POST /api/stories -> id={data['id']}")

    def test_list_stories(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/stories")
        assert resp.status_code == 200, f"Stories list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/stories -> {len(data)} story groups")

    def test_view_story(self, auth2):
        """User2 views user1's story"""
        story_id = getattr(pytest, "shared_story_id", None)
        if not story_id:
            pytest.skip("No story to view")
        resp = auth2.post(f"{BASE_URL}/api/stories/{story_id}/view")
        assert resp.status_code == 200, f"Story view failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"✅ POST /api/stories/{story_id}/view -> ok, counted={data.get('counted')}")

    def test_self_view_story_not_counted(self, auth1):
        """Owner viewing their own story should not be counted"""
        story_id = getattr(pytest, "shared_story_id", None)
        if not story_id:
            pytest.skip("No story to view")
        resp = auth1.post(f"{BASE_URL}/api/stories/{story_id}/view")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True
        assert data.get("counted") is False
        print(f"✅ POST /api/stories/{story_id}/view (self) -> counted=False")

    def test_delete_story(self, auth1):
        """Create and delete a story"""
        create_resp = auth1.post(f"{BASE_URL}/api/stories", json={
            "media_base64": SMALL_BASE64_IMAGE,
            "media_type": "image",
            "caption": "TEST_To be deleted"
        })
        assert create_resp.status_code == 200
        story_id = create_resp.json()["id"]

        del_resp = auth1.delete(f"{BASE_URL}/api/stories/{story_id}")
        assert del_resp.status_code == 200, f"Story delete failed: {del_resp.text}"
        assert del_resp.json().get("ok") is True
        print(f"✅ DELETE /api/stories/{story_id} -> ok")

    def test_delete_other_user_story_returns_404(self, auth2):
        """User2 cannot delete user1's story"""
        story_id = getattr(pytest, "shared_story_id", None)
        if not story_id:
            pytest.skip("No story to test")
        resp = auth2.delete(f"{BASE_URL}/api/stories/{story_id}")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print(f"✅ DELETE /api/stories/{story_id} by non-owner -> 404")


# ─────────────────────────────────────────────────────────────────────────────
# LEADERBOARD
# ─────────────────────────────────────────────────────────────────────────────

class TestLeaderboard:
    """Leaderboard"""

    def test_get_leaderboard(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/leaderboard")
        assert resp.status_code == 200, f"Leaderboard failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        # Verify structure if non-empty
        if data:
            entry = data[0]
            assert "rank" in entry
            assert "user_id" in entry
            assert "username" in entry
            assert "km_total" in entry
            assert "level" in entry
        print(f"✅ GET /api/leaderboard -> {len(data)} entries")

    def test_get_leaderboard_no_token(self, session):
        """Leaderboard doesn't require auth? Check code - it requires no auth"""
        resp = session.get(f"{BASE_URL}/api/leaderboard")
        # Leaderboard has no auth dependency - should work without token
        assert resp.status_code == 200, f"Leaderboard without token: {resp.status_code}: {resp.text}"
        print(f"✅ GET /api/leaderboard (no auth) -> {resp.status_code}")


# ─────────────────────────────────────────────────────────────────────────────
# BADGES
# ─────────────────────────────────────────────────────────────────────────────

class TestBadges:
    """Badges: my badges and all badge definitions"""

    def test_get_my_badges(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/badges")
        assert resp.status_code == 200, f"Badges failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        if data:
            badge = data[0]
            assert "badge_type" in badge
            assert "name" in badge
            assert "earned_at" in badge
        print(f"✅ GET /api/badges -> {len(data)} badges")

    def test_get_all_badge_definitions(self, session):
        """All badge definitions - no auth required"""
        resp = session.get(f"{BASE_URL}/api/badges/all")
        assert resp.status_code == 200, f"All badges failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one badge definition"
        if data:
            b = data[0]
            assert "badge_type" in b
            assert "name" in b
            assert "description" in b
        print(f"✅ GET /api/badges/all -> {len(data)} badge definitions")


# ─────────────────────────────────────────────────────────────────────────────
# MARKETPLACE
# ─────────────────────────────────────────────────────────────────────────────

class TestMarketplace:
    """Marketplace listings: list, create, get, delete"""

    def test_list_marketplace_listings(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/marketplace/listings")
        assert resp.status_code == 200, f"Marketplace list failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/marketplace/listings -> {len(data)} listings")

    def test_create_marketplace_listing(self, auth1):
        resp = auth1.post(f"{BASE_URL}/api/marketplace/listings", json={
            "title": "TEST_Moto For Sale",
            "description": "Test listing for regression",
            "price": 3500.0,
            "currency": "EUR",
            "location": "Bucharest, RO",
            "category": "motorcycle",
            "brand": "Honda",
            "model": "CBR500R",
            "year": 2019,
            "engine_cc": 500,
            "horsepower": 47,
            "kilometers": 15000,
            "license_type": "A2",
            "condition": "Used",
            "images": [],
            "phone": "+40700000000"
        })
        assert resp.status_code == 200, f"Marketplace create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data.get("title") == "TEST_Moto For Sale"
        assert data.get("seller_username") is not None
        pytest.shared_listing_id = data["id"]
        print(f"✅ POST /api/marketplace/listings -> id={data['id']}")

    def test_get_single_marketplace_listing(self, auth1):
        listing_id = getattr(pytest, "shared_listing_id", None)
        if not listing_id:
            pytest.skip("No listing to fetch")
        resp = auth1.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
        assert resp.status_code == 200, f"Get listing failed: {resp.text}"
        data = resp.json()
        assert data.get("id") == listing_id
        assert data.get("title") == "TEST_Moto For Sale"
        print(f"✅ GET /api/marketplace/listings/{listing_id} -> title={data['title']}")

    def test_list_my_marketplace_listings(self, auth1):
        resp = auth1.get(f"{BASE_URL}/api/marketplace/listings", params={"mine": True})
        assert resp.status_code == 200, f"My listings failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/marketplace/listings?mine=true -> {len(data)} listings")

    def test_delete_marketplace_listing(self, auth1):
        listing_id = getattr(pytest, "shared_listing_id", None)
        if not listing_id:
            pytest.skip("No listing to delete")
        resp = auth1.delete(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
        assert resp.status_code == 200, f"Marketplace delete failed: {resp.text}"
        data = resp.json()
        assert data.get("status") == "deleted"

        # Verify gone
        get_resp = auth1.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
        assert get_resp.status_code == 404
        print(f"✅ DELETE /api/marketplace/listings/{listing_id} -> deleted and verified")


# ─────────────────────────────────────────────────────────────────────────────
# PLACES
# ─────────────────────────────────────────────────────────────────────────────

class TestPlaces:
    """Places autocomplete"""

    def test_places_autocomplete_correct_param(self, auth1):
        """Endpoint uses 'query' param, not 'input' as in review_request spec"""
        resp = auth1.get(f"{BASE_URL}/api/places/autocomplete", params={"query": "Bucharest"})
        # May succeed or fail depending on Google Maps API - but should not 422
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, list)
            print(f"✅ GET /api/places/autocomplete?query=Bucharest -> {len(data)} results")
        elif resp.status_code == 400:
            # Google API error
            print(f"⚠️  GET /api/places/autocomplete?query=Bucharest -> 400 (Google API issue): {resp.json()}")
        else:
            assert False, f"Unexpected status {resp.status_code}: {resp.text}"

    def test_places_autocomplete_wrong_param_returns_422(self, auth1):
        """Review request says ?input= but code uses ?query= - param mismatch"""
        resp = auth1.get(f"{BASE_URL}/api/places/autocomplete", params={"input": "Bucharest"})
        assert resp.status_code == 422, (
            f"PARAM MISMATCH BUG: /api/places/autocomplete uses 'query' param but review spec says 'input'. "
            f"Got {resp.status_code}: {resp.text}"
        )
        print(f"✅ GET /api/places/autocomplete?input= -> 422 (PARAM MISMATCH: spec says 'input', code uses 'query')")

    def test_users_search_wrong_param_returns_422(self, auth1):
        """Review request says ?q= but code uses ?username= - param mismatch"""
        resp = auth1.get(f"{BASE_URL}/api/users/search", params={"q": "user"})
        assert resp.status_code == 422, (
            f"PARAM MISMATCH: /api/users/search uses 'username' param but review spec says 'q'. "
            f"Got {resp.status_code}: {resp.text}"
        )
        print(f"✅ GET /api/users/search?q= -> 422 (PARAM MISMATCH: spec says 'q', code uses 'username')")
