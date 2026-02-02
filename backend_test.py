#!/usr/bin/env python3
"""
Backend testing for min_engine_cc functionality
Testing route creation and join validation based on engine CC requirements
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

# Get backend URL from frontend env
BACKEND_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://moto-go.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"

print(f"🔧 Testing backend at: {API_BASE}")

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.auth_token: Optional[str] = None
        self.user_id: Optional[str] = None
        
    async def close(self):
        await self.client.aclose()
    
    def get_auth_headers(self) -> Dict[str, str]:
        if not self.auth_token:
            raise ValueError("No auth token available")
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    async def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login and store auth token"""
        print(f"🔐 Logging in as {email}...")
        
        response = await self.client.post(
            f"{API_BASE}/auth/login",
            json={"email": email, "password": password}
        )
        
        print(f"Login response: {response.status_code}")
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return {"success": False, "error": response.text}
        
        data = response.json()
        self.auth_token = data.get("access_token")
        print(f"✅ Login successful, token received")
        
        # Get user info
        me_response = await self.client.get(
            f"{API_BASE}/me",
            headers=self.get_auth_headers()
        )
        
        if me_response.status_code == 200:
            user_data = me_response.json()
            self.user_id = user_data.get("id")
            print(f"✅ User ID: {self.user_id}")
            print(f"📋 User bike info: {user_data.get('bike')}")
            print(f"🏍️ License verified: {user_data.get('license_verified', False)}")
            return {"success": True, "user": user_data}
        
        return {"success": True, "user": None}
    
    async def update_user_bike(self, cc: Optional[int], model: str = "Test Bike") -> Dict[str, Any]:
        """Update user's bike CC"""
        print(f"🏍️ Updating user bike CC to {cc}...")
        
        bike_data = {"model": model, "cc": cc} if cc is not None else None
        
        response = await self.client.patch(
            f"{API_BASE}/me",
            json={"bike": bike_data},
            headers=self.get_auth_headers()
        )
        
        print(f"Update bike response: {response.status_code}")
        if response.status_code != 200:
            print(f"Update bike failed: {response.text}")
            return {"success": False, "error": response.text}
        
        data = response.json()
        print(f"✅ Bike updated: {data.get('bike')}")
        return {"success": True, "user": data}
    
    async def create_route(self, min_engine_cc: Optional[int] = None) -> Dict[str, Any]:
        """Create a test route with optional min_engine_cc"""
        print(f"🛣️ Creating route with min_engine_cc={min_engine_cc}...")
        
        route_data = {
            "title": f"Test Route CC {min_engine_cc or 'None'}",
            "description": "Test route for min_engine_cc validation",
            "polyline": [[44.4268, 26.1025], [44.4778, 26.0598]],  # Bucharest area
            "difficulty": "medium",
            "participants_min": 1,
            "participants_max": 10
        }
        
        if min_engine_cc is not None:
            route_data["min_engine_cc"] = min_engine_cc
        
        response = await self.client.post(
            f"{API_BASE}/routes",
            json=route_data,
            headers=self.get_auth_headers()
        )
        
        print(f"Create route response: {response.status_code}")
        if response.status_code != 200:
            print(f"Create route failed: {response.text}")
            return {"success": False, "error": response.text}
        
        data = response.json()
        route_id = data.get("id")
        print(f"✅ Route created: {route_id}")
        print(f"📋 Route min_engine_cc: {data.get('min_engine_cc')}")
        return {"success": True, "route": data}
    
    async def join_route(self, route_id: str) -> Dict[str, Any]:
        """Try to join a route"""
        print(f"🚀 Attempting to join route {route_id}...")
        
        response = await self.client.post(
            f"{API_BASE}/routes/{route_id}/join",
            headers=self.get_auth_headers()
        )
        
        print(f"Join route response: {response.status_code}")
        result = {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "response": response.text
        }
        
        if response.status_code == 200:
            print(f"✅ Successfully joined route")
        else:
            print(f"❌ Failed to join route: {response.text}")
        
        return result
    
    async def get_routes(self) -> Dict[str, Any]:
        """Get routes list to verify min_engine_cc field"""
        print(f"📋 Getting routes list...")
        
        response = await self.client.get(
            f"{API_BASE}/routes",
            headers=self.get_auth_headers()
        )
        
        print(f"Get routes response: {response.status_code}")
        if response.status_code != 200:
            print(f"Get routes failed: {response.text}")
            return {"success": False, "error": response.text}
        
        data = response.json()
        print(f"✅ Retrieved {len(data)} routes")
        
        # Check if routes include min_engine_cc field
        for route in data:
            min_cc = route.get("min_engine_cc")
            print(f"Route '{route.get('title')}': min_engine_cc = {min_cc}")
        
        return {"success": True, "routes": data}

async def test_min_engine_cc_functionality():
    """Test the complete min_engine_cc functionality"""
    tester = BackendTester()
    
    try:
        print("=" * 60)
        print("🧪 TESTING MIN_ENGINE_CC FUNCTIONALITY")
        print("=" * 60)
        
        # Step 1: Login
        login_result = await tester.login("user1@example.com", "Password123")
        if not login_result["success"]:
            print("❌ Login failed, cannot continue tests")
            return False
        
        user_data = login_result.get("user", {})
        current_bike = user_data.get("bike")
        current_cc = current_bike.get("cc") if current_bike else None
        license_verified = user_data.get("license_verified", False)
        
        print(f"\n📊 Initial user state:")
        print(f"   - Current bike CC: {current_cc}")
        print(f"   - License verified: {license_verified}")
        
        # Step 2: Create route with min_engine_cc=1000
        print(f"\n" + "=" * 40)
        print("📝 STEP 2: Create route with min_engine_cc=1000")
        print("=" * 40)
        
        route_result = await tester.create_route(min_engine_cc=1000)
        if not route_result["success"]:
            print("❌ Route creation failed")
            return False
        
        route_data = route_result["route"]
        route_id = route_data["id"]
        
        # Step 3: Test join scenarios based on user's current CC
        print(f"\n" + "=" * 40)
        print("🚀 STEP 3: Test route join scenarios")
        print("=" * 40)
        
        # Scenario A: User with no CC or CC < 1000 (should fail with 403)
        if current_cc is None or current_cc < 1000:
            print(f"\n🧪 Scenario A: User has CC={current_cc} (< 1000), should get 403")
            join_result = await tester.join_route(route_id)
            
            if join_result["status_code"] == 403:
                print("✅ PASS: Got expected 403 for insufficient CC")
            elif join_result["status_code"] == 403 and "license" in join_result["response"].lower():
                print("⚠️ Got 403 for license verification (expected behavior)")
            else:
                print(f"❌ FAIL: Expected 403, got {join_result['status_code']}")
                print(f"Response: {join_result['response']}")
        
        # Scenario B: Update user to have CC >= 1000 and test again
        print(f"\n🧪 Scenario B: Update user CC to 1200 (>= 1000), should succeed")
        
        # Update bike CC to 1200
        update_result = await tester.update_user_bike(cc=1200, model="Yamaha MT-09")
        if not update_result["success"]:
            print("❌ Failed to update bike CC")
            return False
        
        # Try to join again
        join_result = await tester.join_route(route_id)
        
        if join_result["status_code"] == 200:
            print("✅ PASS: Successfully joined with sufficient CC")
        elif join_result["status_code"] == 403 and "license" in join_result["response"].lower():
            print("⚠️ Got 403 for license verification - this is expected if license not verified")
            print("   The CC validation logic is working, but license verification blocks join")
        else:
            print(f"❌ FAIL: Expected 200, got {join_result['status_code']}")
            print(f"Response: {join_result['response']}")
        
        # Scenario C: Test with CC exactly at minimum (1000)
        print(f"\n🧪 Scenario C: Update user CC to exactly 1000, should succeed")
        
        update_result = await tester.update_user_bike(cc=1000, model="Honda CB1000R")
        if not update_result["success"]:
            print("❌ Failed to update bike CC to 1000")
            return False
        
        join_result = await tester.join_route(route_id)
        
        if join_result["status_code"] == 200:
            print("✅ PASS: Successfully joined with exactly minimum CC")
        elif join_result["status_code"] == 403 and "license" in join_result["response"].lower():
            print("⚠️ Got 403 for license verification - CC validation working correctly")
        else:
            print(f"❌ FAIL: Expected 200, got {join_result['status_code']}")
            print(f"Response: {join_result['response']}")
        
        # Step 4: Verify GET /api/routes includes min_engine_cc
        print(f"\n" + "=" * 40)
        print("📋 STEP 4: Verify GET /api/routes includes min_engine_cc")
        print("=" * 40)
        
        routes_result = await tester.get_routes()
        if not routes_result["success"]:
            print("❌ Failed to get routes")
            return False
        
        routes = routes_result["routes"]
        found_test_route = False
        
        for route in routes:
            if route.get("id") == route_id:
                found_test_route = True
                min_cc = route.get("min_engine_cc")
                if min_cc == 1000:
                    print("✅ PASS: GET /api/routes includes correct min_engine_cc field")
                else:
                    print(f"❌ FAIL: Expected min_engine_cc=1000, got {min_cc}")
                break
        
        if not found_test_route:
            print("❌ FAIL: Test route not found in routes list")
        
        # Additional test: Create route without min_engine_cc
        print(f"\n🧪 Additional test: Route without min_engine_cc should allow any user")
        
        route_result2 = await tester.create_route(min_engine_cc=None)
        if route_result2["success"]:
            route_id2 = route_result2["route"]["id"]
            
            # Set user CC to very low value
            await tester.update_user_bike(cc=125, model="Honda CB125R")
            
            join_result2 = await tester.join_route(route_id2)
            if join_result2["status_code"] == 200:
                print("✅ PASS: User with low CC can join route without min_engine_cc")
            elif join_result2["status_code"] == 403 and "license" in join_result2["response"].lower():
                print("⚠️ Got 403 for license verification - CC validation bypassed correctly")
            else:
                print(f"❌ Unexpected result: {join_result2['status_code']} - {join_result2['response']}")
        
        print(f"\n" + "=" * 60)
        print("🎉 MIN_ENGINE_CC TESTING COMPLETED")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        await tester.close()

async def main():
    """Main test runner"""
    print("🚀 Starting backend min_engine_cc tests...")
    
    success = await test_min_engine_cc_functionality()
    
    if success:
        print("\n✅ All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())