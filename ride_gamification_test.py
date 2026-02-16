#!/usr/bin/env python3
"""
Backend Testing for Ride Sessions and Gamification endpoints
Testing scenarios from review request:
1. GET /api/rides/active - Check if there's an active ride (should be null initially)
2. POST /api/rides/start - Start a ride session
3. GET /api/rides/active - Verify active ride is returned
4. POST /api/rides/end - End the ride
5. GET /api/badges - Get user's badges
6. GET /api/badges/all - Get all available badges
7. GET /api/leaderboard?limit=10 - Get leaderboard
8. Verify existing endpoints still work: GET /api/routes, GET /api/events, GET /api/stats
"""

import json
import requests
import sys
from datetime import datetime, timedelta

# Get backend URL from frontend .env
BACKEND_URL = "https://map-v2-fix.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def make_request(method, endpoint, headers=None, json_data=None, params=None):
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def authenticate():
    """Authenticate and get JWT token"""
    print("🔐 Authenticating...")
    
    # Login with test credentials
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    response = make_request("POST", "/auth/login", json_data=login_data)
    if not response or response.status_code != 200:
        log_test("Authentication", "FAIL", f"Login failed: {response.status_code if response else 'No response'}")
        return None
    
    token_data = response.json()
    token = token_data.get("access_token")
    if not token:
        log_test("Authentication", "FAIL", "No access token in response")
        return None
    
    log_test("Authentication", "PASS", f"Successfully logged in as {TEST_EMAIL}")
    return {"Authorization": f"Bearer {token}"}

def test_ride_sessions(auth_headers):
    """Test ride session endpoints"""
    print("\n🚴 Testing Ride Sessions...")
    
    # 1. GET /api/rides/active - Check if there's an active ride (should be null initially)
    response = make_request("GET", "/rides/active", headers=auth_headers)
    if response and response.status_code == 200:
        active_ride = response.json()
        if active_ride is None:
            log_test("GET /api/rides/active (initial)", "PASS", "No active ride as expected")
        else:
            log_test("GET /api/rides/active (initial)", "FAIL", f"Expected null, got: {active_ride}")
            return None
    else:
        log_test("GET /api/rides/active (initial)", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return None
    
    # Get a valid route_id first
    routes_response = make_request("GET", "/routes", headers=auth_headers)
    if not routes_response or routes_response.status_code != 200:
        log_test("Get routes for ride session", "FAIL", "Could not fetch routes")
        return None
    
    routes = routes_response.json()
    if not routes:
        log_test("Get routes for ride session", "FAIL", "No routes available")
        return None
    
    route_id = routes[0]["id"]
    log_test("Get valid route_id", "PASS", f"Using route_id: {route_id}")
    
    # 2. POST /api/rides/start - Start a ride session
    start_data = {"route_id": route_id}
    response = make_request("POST", "/rides/start", headers=auth_headers, json_data=start_data)
    if response and response.status_code == 200:
        ride_session = response.json()
        session_id = ride_session.get("id")
        if ride_session.get("status") == "active" and session_id:
            log_test("POST /api/rides/start", "PASS", f"Started ride session: {session_id}")
        else:
            log_test("POST /api/rides/start", "FAIL", f"Invalid response: {ride_session}")
            return None
    else:
        log_test("POST /api/rides/start", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return None
    
    # 3. GET /api/rides/active - Verify active ride is returned
    response = make_request("GET", "/rides/active", headers=auth_headers)
    if response and response.status_code == 200:
        active_ride = response.json()
        if active_ride and active_ride.get("status") == "active" and active_ride.get("id") == session_id:
            log_test("GET /api/rides/active (after start)", "PASS", f"Active ride returned: {active_ride['id']}")
        else:
            log_test("GET /api/rides/active (after start)", "FAIL", f"Expected active ride, got: {active_ride}")
            return None
    else:
        log_test("GET /api/rides/active (after start)", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return None
    
    # 4. POST /api/rides/end - End the ride
    end_data = {
        "session_id": session_id,
        "end_location": [44.4268, 26.1025]  # Bucharest coordinates as specified
    }
    response = make_request("POST", "/rides/end", headers=auth_headers, json_data=end_data)
    if response and response.status_code == 200:
        completed_ride = response.json()
        if completed_ride.get("status") == "completed":
            log_test("POST /api/rides/end", "PASS", f"Ride completed: {completed_ride.get('km_tracked', 0)} km tracked")
        else:
            log_test("POST /api/rides/end", "FAIL", f"Invalid response: {completed_ride}")
            return None
    else:
        log_test("POST /api/rides/end", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return None
    
    return True

def test_gamification(auth_headers):
    """Test gamification endpoints"""
    print("\n🏆 Testing Gamification...")
    
    # 5. GET /api/badges - Get user's badges
    response = make_request("GET", "/badges", headers=auth_headers)
    if response and response.status_code == 200:
        badges = response.json()
        if isinstance(badges, list):
            log_test("GET /api/badges", "PASS", f"Retrieved {len(badges)} badges")
            for badge in badges[:3]:  # Show first 3 badges
                print(f"    Badge: {badge.get('name', 'Unknown')} - {badge.get('description', 'No description')}")
        else:
            log_test("GET /api/badges", "FAIL", f"Expected list, got: {type(badges)}")
            return False
    else:
        log_test("GET /api/badges", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # 6. GET /api/badges/all - Get all available badges
    response = make_request("GET", "/badges/all", headers=auth_headers)
    if response and response.status_code == 200:
        all_badges = response.json()
        if isinstance(all_badges, list) and len(all_badges) > 0:
            log_test("GET /api/badges/all", "PASS", f"Retrieved {len(all_badges)} available badge types")
            for badge in all_badges[:3]:  # Show first 3 badge types
                print(f"    Available: {badge.get('name', 'Unknown')} - {badge.get('description', 'No description')}")
        else:
            log_test("GET /api/badges/all", "FAIL", f"Expected non-empty list, got: {all_badges}")
            return False
    else:
        log_test("GET /api/badges/all", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # 7. GET /api/leaderboard?limit=10 - Get leaderboard
    response = make_request("GET", "/leaderboard", headers=auth_headers, params={"limit": 10})
    if response and response.status_code == 200:
        leaderboard = response.json()
        if isinstance(leaderboard, list):
            log_test("GET /api/leaderboard", "PASS", f"Retrieved leaderboard with {len(leaderboard)} entries")
            for entry in leaderboard[:3]:  # Show top 3 entries
                print(f"    Rank {entry.get('rank', '?')}: {entry.get('username', 'Unknown')} - {entry.get('km_total', 0)} km, Level {entry.get('level', 1)}, {entry.get('badges_count', 0)} badges")
        else:
            log_test("GET /api/leaderboard", "FAIL", f"Expected list, got: {type(leaderboard)}")
            return False
    else:
        log_test("GET /api/leaderboard", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    return True

def test_existing_endpoints(auth_headers):
    """Test existing endpoints still work"""
    print("\n🔄 Testing Existing Endpoints...")
    
    # GET /api/routes
    response = make_request("GET", "/routes", headers=auth_headers)
    if response and response.status_code == 200:
        routes = response.json()
        if isinstance(routes, list):
            log_test("GET /api/routes", "PASS", f"Retrieved {len(routes)} routes")
        else:
            log_test("GET /api/routes", "FAIL", f"Expected list, got: {type(routes)}")
            return False
    else:
        log_test("GET /api/routes", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # GET /api/events
    response = make_request("GET", "/events", headers=auth_headers)
    if response and response.status_code == 200:
        events = response.json()
        if isinstance(events, list):
            log_test("GET /api/events", "PASS", f"Retrieved {len(events)} events")
        else:
            log_test("GET /api/events", "FAIL", f"Expected list, got: {type(events)}")
            return False
    else:
        log_test("GET /api/events", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    # GET /api/stats
    response = make_request("GET", "/stats", headers=auth_headers)
    if response and response.status_code == 200:
        stats = response.json()
        if isinstance(stats, dict) and "km_total" in stats:
            log_test("GET /api/stats", "PASS", f"Stats: {stats.get('km_total', 0)} km total, {stats.get('completed_routes', 0)} completed routes")
        else:
            log_test("GET /api/stats", "FAIL", f"Invalid stats format: {stats}")
            return False
    else:
        log_test("GET /api/stats", "FAIL", f"Status: {response.status_code if response else 'No response'}")
        return False
    
    return True

def main():
    """Main test execution"""
    print("🧪 Starting Ride Sessions and Gamification Backend Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    # Authenticate
    auth_headers = authenticate()
    if not auth_headers:
        print("❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests
    tests_passed = 0
    total_tests = 3
    
    if test_ride_sessions(auth_headers):
        tests_passed += 1
    
    if test_gamification(auth_headers):
        tests_passed += 1
    
    if test_existing_endpoints(auth_headers):
        tests_passed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print(f"🏁 Testing Complete: {tests_passed}/{total_tests} test suites passed")
    
    if tests_passed == total_tests:
        print("✅ All tests passed! Ride Sessions and Gamification endpoints are working correctly.")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()