#!/usr/bin/env python3
"""
Backend testing for Moto GO ride session bugfixes.
Tests the specific scenarios mentioned in the Romanian review request.
"""

import asyncio
import json
import random
import string
from datetime import datetime
from typing import Optional

import httpx

# Backend URL from frontend environment
BACKEND_URL = "https://motogo-dash.preview.emergentagent.com/api"

class MotoGoTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        
    async def close(self):
        await self.client.aclose()
    
    def _auth_headers(self) -> dict:
        if not self.token:
            raise ValueError("No authentication token available")
        return {"Authorization": f"Bearer {self.token}"}
    
    async def login(self, email: str, password: str) -> dict:
        """Login and store token for subsequent requests."""
        print(f"🔐 Logging in with {email}...")
        
        response = await self.client.post(
            f"{BACKEND_URL}/auth/login",
            json={"email": email, "password": password}
        )
        
        print(f"Login response: {response.status_code}")
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return {"success": False, "error": response.text}
        
        data = response.json()
        self.token = data.get("access_token")
        
        # Get user info
        me_response = await self.client.get(
            f"{BACKEND_URL}/me",
            headers=self._auth_headers()
        )
        
        if me_response.status_code == 200:
            user_data = me_response.json()
            self.user_id = user_data.get("id")
            print(f"✅ Login successful! User ID: {self.user_id}")
            return {"success": True, "user_id": self.user_id, "token": self.token}
        else:
            print(f"❌ Failed to get user info: {me_response.text}")
            return {"success": False, "error": "Failed to get user info"}
    
    async def test_invalid_login(self) -> dict:
        """Test login with invalid credentials should return 401 with 'Invalid credentials'."""
        print("\n🔐 Testing invalid login credentials...")
        
        response = await self.client.post(
            f"{BACKEND_URL}/auth/login",
            json={"email": "user1@example.com", "password": "WrongPassword"}
        )
        
        print(f"Invalid login response: {response.status_code}")
        
        if response.status_code == 401:
            data = response.json()
            detail = data.get("detail", "")
            if detail == "Invalid credentials":
                print("✅ Invalid login correctly returns 401 with 'Invalid credentials'")
                return {"success": True, "detail": detail}
            else:
                print(f"❌ Invalid login returns 401 but wrong detail: '{detail}'")
                return {"success": False, "error": f"Wrong detail message: '{detail}'"}
        else:
            print(f"❌ Invalid login should return 401, got {response.status_code}: {response.text}")
            return {"success": False, "error": f"Expected 401, got {response.status_code}"}
    
    async def get_active_ride(self) -> dict:
        """Get current active ride session."""
        print("🏍️ Getting active ride...")
        
        response = await self.client.get(
            f"{BACKEND_URL}/rides/active",
            headers=self._auth_headers()
        )
        
        print(f"GET /api/rides/active response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Active ride data: {data}")
            return {"success": True, "data": data}
        else:
            print(f"❌ Failed to get active ride: {response.text}")
            return {"success": False, "error": response.text}
    
    async def get_routes(self) -> dict:
        """Get available routes to use for testing."""
        print("🗺️ Getting available routes...")
        
        response = await self.client.get(
            f"{BACKEND_URL}/routes",
            headers=self._auth_headers()
        )
        
        print(f"GET /api/routes response: {response.status_code}")
        
        if response.status_code == 200:
            routes = response.json()
            print(f"Found {len(routes)} routes")
            return {"success": True, "routes": routes}
        else:
            print(f"❌ Failed to get routes: {response.text}")
            return {"success": False, "error": response.text}
    
    async def create_test_route(self) -> dict:
        """Create a test route for ride testing."""
        print("🗺️ Creating test route...")
        
        route_data = {
            "title": f"Test Route {random.randint(1000, 9999)}",
            "description": "Test route for ride session testing",
            "polyline": [
                [44.4268, 26.1025],  # Bucharest coordinates
                [44.4778, 26.0598]   # Nearby point
            ],
            "difficulty": "medium",
            "participants_min": 1,
            "participants_max": 10
        }
        
        response = await self.client.post(
            f"{BACKEND_URL}/routes",
            json=route_data,
            headers=self._auth_headers()
        )
        
        print(f"POST /api/routes response: {response.status_code}")
        
        if response.status_code == 200:
            route = response.json()
            route_id = route.get("id")
            print(f"✅ Created test route with ID: {route_id}")
            return {"success": True, "route_id": route_id, "route": route}
        else:
            print(f"❌ Failed to create route: {response.text}")
            return {"success": False, "error": response.text}
    
    async def start_ride(self, route_id: str) -> dict:
        """Start a ride session on the given route."""
        print(f"🏁 Starting ride on route {route_id}...")
        
        response = await self.client.post(
            f"{BACKEND_URL}/rides/start",
            json={"route_id": route_id},
            headers=self._auth_headers()
        )
        
        print(f"POST /api/rides/start response: {response.status_code}")
        
        if response.status_code == 200:
            ride_data = response.json()
            session_id = ride_data.get("id")
            print(f"✅ Started ride session with ID: {session_id}")
            return {"success": True, "session_id": session_id, "ride_data": ride_data}
        else:
            print(f"❌ Failed to start ride: {response.text}")
            return {"success": False, "error": response.text}
    
    async def test_ride_start_without_license(self) -> dict:
        """Test that starting a ride without verified license returns 403."""
        print("🚫 Testing ride start without verified license...")
        
        # Create a test route first
        route_data = {
            "title": f"License Test Route {random.randint(1000, 9999)}",
            "description": "Test route for license verification",
            "polyline": [
                [44.4268, 26.1025],  # Bucharest coordinates
                [44.4778, 26.0598]   # Nearby point
            ],
            "difficulty": "medium",
            "participants_min": 1,
            "participants_max": 10
        }
        
        route_response = await self.client.post(
            f"{BACKEND_URL}/routes",
            json=route_data,
            headers=self._auth_headers()
        )
        
        if route_response.status_code != 200:
            return {"success": False, "error": f"Failed to create test route: {route_response.text}"}
        
        route_id = route_response.json().get("id")
        
        # Try to start ride (should fail if no license)
        response = await self.client.post(
            f"{BACKEND_URL}/rides/start",
            json={"route_id": route_id},
            headers=self._auth_headers()
        )
        
        print(f"POST /api/rides/start (no license) response: {response.status_code}")
        
        if response.status_code == 403:
            data = response.json()
            detail = data.get("detail", "")
            if "license" in detail.lower():
                print(f"✅ Ride start correctly blocked without license: {detail}")
                return {"success": True, "blocked": True, "detail": detail}
            else:
                print(f"❌ 403 returned but wrong detail: {detail}")
                return {"success": False, "error": f"Wrong 403 detail: {detail}"}
        elif response.status_code == 200:
            print("ℹ️ Ride start succeeded - user has verified license")
            return {"success": True, "blocked": False, "detail": "User has verified license"}
        else:
            print(f"❌ Unexpected response: {response.status_code}: {response.text}")
            return {"success": False, "error": f"Unexpected status {response.status_code}"}
    
        """Cancel an active ride session."""
        print(f"❌ Cancelling ride session {session_id}...")
        
        response = await self.client.post(
            f"{BACKEND_URL}/rides/cancel",
            json={"session_id": session_id},
            headers=self._auth_headers()
        )
        
        print(f"POST /api/rides/cancel response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Ride cancelled successfully: {data}")
            return {"success": True, "data": data}
        else:
            print(f"❌ Failed to cancel ride: {response.text}")
            return {"success": False, "error": response.text}

async def run_ride_session_tests():
    """Run the complete ride session test suite as specified in the review request."""
    tester = MotoGoTester()
    
    try:
        print("=" * 60)
        print("🏍️ MOTO GO RIDE SESSION BUGFIX TESTING")
        print("=" * 60)
        
        # Test 1: Invalid login credentials
        print("\n" + "=" * 50)
        print("TEST 1: Invalid Login Credentials")
        print("=" * 50)
        
        invalid_login_result = await tester.test_invalid_login()
        if not invalid_login_result["success"]:
            print(f"❌ CRITICAL: Invalid login test failed: {invalid_login_result['error']}")
            return False
        
        # Test 2: Valid login with user1@example.com / Password123
        print("\n" + "=" * 50)
        print("TEST 2: Valid Login")
        print("=" * 50)
        
        login_result = await tester.login("user1@example.com", "Password123")
        if not login_result["success"]:
            print(f"❌ CRITICAL: Login failed: {login_result['error']}")
            return False
        
        # Test 3: GET /api/rides/active should return 200 and null initially
        print("\n" + "=" * 50)
        print("TEST 3: GET /api/rides/active (cleanup existing rides)")
        print("=" * 50)
        
        active_ride_result = await tester.get_active_ride()
        if not active_ride_result["success"]:
            print(f"❌ CRITICAL: Failed to get active ride: {active_ride_result['error']}")
            return False
        
        # If there's an existing active/paused ride, cancel it first
        if active_ride_result["data"] is not None:
            existing_ride = active_ride_result["data"]
            existing_session_id = existing_ride.get("id")
            print(f"⚠️ Found existing ride session {existing_session_id} with status '{existing_ride.get('status')}', cancelling it first...")
            
            cancel_existing_result = await tester.cancel_ride(existing_session_id)
            if not cancel_existing_result["success"]:
                print(f"❌ CRITICAL: Failed to cancel existing ride: {cancel_existing_result['error']}")
                return False
            
            # Verify it's now null
            active_ride_result = await tester.get_active_ride()
            if not active_ride_result["success"]:
                print(f"❌ CRITICAL: Failed to get active ride after cleanup: {active_ride_result['error']}")
                return False
            
            if active_ride_result["data"] is not None:
                print(f"❌ CRITICAL: Expected null after cleanup, got: {active_ride_result['data']}")
                return False
        
        print("✅ GET /api/rides/active correctly returns null (no active ride)")
        
        # Test 4: Get or create a route for testing
        print("\n" + "=" * 50)
        print("TEST 4: Get/Create Route for Testing")
        print("=" * 50)
        
        routes_result = await tester.get_routes()
        route_id = None
        
        if routes_result["success"] and routes_result["routes"]:
            # Use existing route
            route_id = routes_result["routes"][0]["id"]
            print(f"✅ Using existing route: {route_id}")
        else:
            # Create new route
            create_route_result = await tester.create_test_route()
            if not create_route_result["success"]:
                print(f"❌ CRITICAL: Failed to create test route: {create_route_result['error']}")
                return False
            route_id = create_route_result["route_id"]
        
        # Test 5: Start ride on the route
        print("\n" + "=" * 50)
        print("TEST 5: Start Ride Session")
        print("=" * 50)
        
        start_ride_result = await tester.start_ride(route_id)
        if not start_ride_result["success"]:
            print(f"❌ CRITICAL: Failed to start ride: {start_ride_result['error']}")
            return False
        
        session_id = start_ride_result["session_id"]
        
        # Test 6: GET /api/rides/active should now return the active ride
        print("\n" + "=" * 50)
        print("TEST 6: GET /api/rides/active (should return active ride)")
        print("=" * 50)
        
        active_ride_result2 = await tester.get_active_ride()
        if not active_ride_result2["success"]:
            print(f"❌ CRITICAL: Failed to get active ride after start: {active_ride_result2['error']}")
            return False
        
        if active_ride_result2["data"] is None:
            print("❌ CRITICAL: Expected active ride, got null")
            return False
        
        active_ride_data = active_ride_result2["data"]
        if active_ride_data.get("status") != "active":
            print(f"❌ CRITICAL: Expected status 'active', got '{active_ride_data.get('status')}'")
            return False
        
        print(f"✅ GET /api/rides/active correctly returns active ride with status: {active_ride_data.get('status')}")
        
        # Test 7: Cancel the ride
        print("\n" + "=" * 50)
        print("TEST 7: Cancel Ride Session")
        print("=" * 50)
        
        cancel_result = await tester.cancel_ride(session_id)
        if not cancel_result["success"]:
            print(f"❌ CRITICAL: Failed to cancel ride: {cancel_result['error']}")
            return False
        
        # Test 8: GET /api/rides/active should return null after cancellation
        print("\n" + "=" * 50)
        print("TEST 8: GET /api/rides/active (should be null after cancel)")
        print("=" * 50)
        
        active_ride_result3 = await tester.get_active_ride()
        if not active_ride_result3["success"]:
            print(f"❌ CRITICAL: Failed to get active ride after cancel: {active_ride_result3['error']}")
            return False
        
        if active_ride_result3["data"] is not None:
            print(f"❌ CRITICAL: Expected null after cancel, got: {active_ride_result3['data']}")
            return False
        
        print("✅ GET /api/rides/active correctly returns null after cancellation")
        
        print("\n" + "=" * 60)
        print("🎉 ALL RIDE SESSION BUGFIX TESTS PASSED!")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"❌ CRITICAL ERROR during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        await tester.close()

if __name__ == "__main__":
    success = asyncio.run(run_ride_session_tests())
    exit(0 if success else 1)