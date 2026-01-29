#!/usr/bin/env python3
"""
Backend API Testing for Events Join/Leave functionality
Tests the new Events join/leave changes as requested in the review.
"""

import asyncio
import json
import random
import string
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import httpx


class BackendTester:
    def __init__(self, base_url: str = "https://riderzone-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.event_id: Optional[str] = None

    async def close(self):
        await self.client.aclose()

    def generate_random_email(self) -> str:
        """Generate a random email for testing"""
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"testuser_{random_str}@example.com"

    def generate_random_username(self) -> str:
        """Generate a random username for testing"""
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"user{random_str}"

    async def register_user(self) -> Dict[str, Any]:
        """Step 1: Register a random user and get token"""
        print("🔐 Step 1: Registering new user...")
        
        email = self.generate_random_email()
        username = self.generate_random_username()
        password = "TestPassword123"
        
        payload = {
            "email": email,
            "username": username,
            "password": password
        }
        
        response = await self.client.post(f"{self.base_url}/auth/register", json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Registration failed: {response.status_code} - {response.text}")
        
        data = response.json()
        self.token = data["access_token"]
        
        print(f"✅ User registered successfully: {email}")
        print(f"✅ Token obtained: {self.token[:20]}...")
        
        # Get user info to get user_id
        headers = {"Authorization": f"Bearer {self.token}"}
        me_response = await self.client.get(f"{self.base_url}/me", headers=headers)
        if me_response.status_code == 200:
            user_data = me_response.json()
            self.user_id = user_data["id"]
            print(f"✅ User ID: {self.user_id}")
        
        return data

    async def create_event(self) -> Dict[str, Any]:
        """Step 2: Create an event via POST /api/events (no auth required for create currently)"""
        print("\n📅 Step 2: Creating an event...")
        
        # Create event in the future
        start_time = datetime.utcnow() + timedelta(days=7)
        
        payload = {
            "title": "Test Motorcycle Ride",
            "description": "A test event for join/leave functionality",
            "start_point": [44.4268, 26.1025],  # Bucharest coordinates
            "start_time": start_time.isoformat() + "Z"
        }
        
        response = await self.client.post(f"{self.base_url}/events", json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Event creation failed: {response.status_code} - {response.text}")
        
        data = response.json()
        self.event_id = data["id"]
        
        print(f"✅ Event created successfully: {data['title']}")
        print(f"✅ Event ID: {self.event_id}")
        
        return data

    async def test_events_without_auth(self) -> None:
        """Step 3: GET /api/events without token should now return 401"""
        print("\n🚫 Step 3: Testing GET /api/events without authentication...")
        
        response = await self.client.get(f"{self.base_url}/events")
        
        if response.status_code != 401:
            raise Exception(f"Expected 401 Unauthorized, got {response.status_code} - {response.text}")
        
        print("✅ GET /api/events correctly returns 401 without authentication")

    async def test_events_with_auth(self) -> Dict[str, Any]:
        """Step 4: GET /api/events with token should return list with participants_count and is_joined"""
        print("\n📋 Step 4: Testing GET /api/events with authentication...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = await self.client.get(f"{self.base_url}/events", headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"GET /api/events with auth failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        if not isinstance(data, list):
            raise Exception(f"Expected list response, got {type(data)}")
        
        if len(data) == 0:
            raise Exception("No events found in response")
        
        # Find our created event
        our_event = None
        for event in data:
            if event["id"] == self.event_id:
                our_event = event
                break
        
        if not our_event:
            raise Exception(f"Created event {self.event_id} not found in events list")
        
        # Verify EventOut schema includes required fields
        required_fields = ["participants_count", "is_joined"]
        for field in required_fields:
            if field not in our_event:
                raise Exception(f"Missing required field '{field}' in EventOut response")
        
        print(f"✅ GET /api/events with auth successful")
        print(f"✅ Event found with participants_count: {our_event['participants_count']}")
        print(f"✅ Event found with is_joined: {our_event['is_joined']}")
        
        # Initially should not be joined
        if our_event["is_joined"] != False:
            raise Exception(f"Expected is_joined=false initially, got {our_event['is_joined']}")
        
        if our_event["participants_count"] != 0:
            raise Exception(f"Expected participants_count=0 initially, got {our_event['participants_count']}")
        
        return data

    async def test_join_event(self) -> Dict[str, Any]:
        """Step 5: POST /api/events/{id}/join with token -> ok true"""
        print(f"\n➕ Step 5: Testing POST /api/events/{self.event_id}/join...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = await self.client.post(f"{self.base_url}/events/{self.event_id}/join", headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Event join failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        if data.get("ok") != True:
            raise Exception(f"Expected ok=true, got {data}")
        
        print("✅ Successfully joined event")
        
        return data

    async def test_events_after_join(self) -> Dict[str, Any]:
        """Step 6: GET /api/events with token shows is_joined true and participants_count incremented"""
        print("\n📈 Step 6: Testing GET /api/events after joining...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = await self.client.get(f"{self.base_url}/events", headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"GET /api/events after join failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        # Find our event
        our_event = None
        for event in data:
            if event["id"] == self.event_id:
                our_event = event
                break
        
        if not our_event:
            raise Exception(f"Event {self.event_id} not found after join")
        
        # Verify is_joined is now true
        if our_event["is_joined"] != True:
            raise Exception(f"Expected is_joined=true after join, got {our_event['is_joined']}")
        
        # Verify participants_count is incremented
        if our_event["participants_count"] != 1:
            raise Exception(f"Expected participants_count=1 after join, got {our_event['participants_count']}")
        
        print(f"✅ After join: is_joined={our_event['is_joined']}, participants_count={our_event['participants_count']}")
        
        return data

    async def test_leave_event(self) -> Dict[str, Any]:
        """Step 7: POST /api/events/{id}/leave -> ok true"""
        print(f"\n➖ Step 7: Testing POST /api/events/{self.event_id}/leave...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = await self.client.post(f"{self.base_url}/events/{self.event_id}/leave", headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Event leave failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        if data.get("ok") != True:
            raise Exception(f"Expected ok=true, got {data}")
        
        print("✅ Successfully left event")
        
        return data

    async def test_events_after_leave(self) -> Dict[str, Any]:
        """Step 8: GET /api/events shows is_joined false and participants_count decremented"""
        print("\n📉 Step 8: Testing GET /api/events after leaving...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = await self.client.get(f"{self.base_url}/events", headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"GET /api/events after leave failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        # Find our event
        our_event = None
        for event in data:
            if event["id"] == self.event_id:
                our_event = event
                break
        
        if not our_event:
            raise Exception(f"Event {self.event_id} not found after leave")
        
        # Verify is_joined is now false
        if our_event["is_joined"] != False:
            raise Exception(f"Expected is_joined=false after leave, got {our_event['is_joined']}")
        
        # Verify participants_count is decremented
        if our_event["participants_count"] != 0:
            raise Exception(f"Expected participants_count=0 after leave, got {our_event['participants_count']}")
        
        print(f"✅ After leave: is_joined={our_event['is_joined']}, participants_count={our_event['participants_count']}")
        
        return data

    async def test_routes_regression(self) -> None:
        """Regression test: /api/routes still OK"""
        print("\n🔄 Regression Test: Testing /api/routes still works...")
        
        response = await self.client.get(f"{self.base_url}/routes")
        
        if response.status_code != 200:
            raise Exception(f"Routes regression test failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        if not isinstance(data, list):
            raise Exception(f"Expected list response for routes, got {type(data)}")
        
        print(f"✅ Routes endpoint working correctly, returned {len(data)} routes")

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests in sequence"""
        print("🚀 Starting Events Join/Leave Backend Testing...")
        print("=" * 60)
        
        results = {}
        
        try:
            # Step 1: Register user and get token
            results["register"] = await self.register_user()
            
            # Step 2: Create event (no auth required)
            results["create_event"] = await self.create_event()
            
            # Step 3: Test events without auth (should return 401)
            await self.test_events_without_auth()
            results["events_no_auth"] = "401 as expected"
            
            # Step 4: Test events with auth (should return EventOut with participants_count and is_joined)
            results["events_with_auth"] = await self.test_events_with_auth()
            
            # Step 5: Join event
            results["join_event"] = await self.test_join_event()
            
            # Step 6: Verify join worked
            results["events_after_join"] = await self.test_events_after_join()
            
            # Step 7: Leave event
            results["leave_event"] = await self.test_leave_event()
            
            # Step 8: Verify leave worked
            results["events_after_leave"] = await self.test_events_after_leave()
            
            # Regression: Test routes still work
            await self.test_routes_regression()
            results["routes_regression"] = "OK"
            
            print("\n" + "=" * 60)
            print("🎉 ALL TESTS PASSED! Events Join/Leave functionality working correctly.")
            
            return results
            
        except Exception as e:
            print(f"\n❌ TEST FAILED: {str(e)}")
            raise


async def main():
    """Main test runner"""
    tester = BackendTester()
    
    try:
        results = await tester.run_all_tests()
        return True
    except Exception as e:
        print(f"Testing failed: {e}")
        return False
    finally:
        await tester.close()


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)