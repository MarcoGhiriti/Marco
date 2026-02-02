#!/usr/bin/env python3
"""
Backend testing for Moto GO - Active Ride for Home Banner endpoint
Testing the new GET /api/rides/active-for-home endpoint functionality
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv("/app/frontend/.env")
BASE_URL = os.getenv("EXPO_PUBLIC_BACKEND_URL", "https://moto-go.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"

class TestUser:
    def __init__(self, email: str, username: str, password: str):
        self.email = email
        self.username = username
        self.password = password
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        
    def headers(self) -> dict:
        if not self.token:
            raise ValueError(f"User {self.username} not logged in")
        return {"Authorization": f"Bearer {self.token}"}

class MotoGoTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.user1 = TestUser("creator@test.com", "creator_user", "password123")
        self.user2 = TestUser("participant@test.com", "participant_user", "password123")
        self.user3 = TestUser("outsider@test.com", "outsider_user", "password123")
        self.route_id: Optional[str] = None
        self.ride_session_id: Optional[str] = None
        
    async def cleanup_and_setup(self):
        """Clean up any existing test data and setup fresh users"""
        print("🧹 Cleaning up and setting up test environment...")
        
        # Try to login existing users first to get their IDs for cleanup
        for user in [self.user1, self.user2, self.user3]:
            try:
                await self.login_user(user)
            except:
                pass  # User might not exist yet
        
        # Register all users (will fail if they exist, which is fine)
        for user in [self.user1, self.user2, self.user3]:
            try:
                await self.register_user(user)
            except:
                pass  # User already exists
            
            # Ensure we're logged in
            await self.login_user(user)
            
            # Verify license for all users (required for rides)
            await self.verify_license(user)
    
    async def register_user(self, user: TestUser):
        """Register a new user"""
        payload = {
            "email": user.email,
            "username": user.username,
            "password": user.password
        }
        
        response = await self.client.post(f"{API_BASE}/auth/register", json=payload)
        if response.status_code == 201:
            data = response.json()
            user.token = data["access_token"]
            print(f"✅ Registered user: {user.username}")
        elif response.status_code == 409:
            print(f"ℹ️  User {user.username} already exists")
        else:
            print(f"❌ Failed to register {user.username}: {response.status_code} - {response.text}")
            raise Exception(f"Registration failed for {user.username}")
    
    async def login_user(self, user: TestUser):
        """Login user and get token"""
        payload = {
            "email": user.email,
            "password": user.password
        }
        
        response = await self.client.post(f"{API_BASE}/auth/login", json=payload)
        if response.status_code == 200:
            data = response.json()
            user.token = data["access_token"]
            
            # Get user ID
            me_response = await self.client.get(f"{API_BASE}/me", headers=user.headers())
            if me_response.status_code == 200:
                user_data = me_response.json()
                user.user_id = user_data["id"]
                print(f"✅ Logged in user: {user.username} (ID: {user.user_id})")
            else:
                raise Exception(f"Failed to get user info for {user.username}")
        else:
            print(f"❌ Failed to login {user.username}: {response.status_code} - {response.text}")
            raise Exception(f"Login failed for {user.username}")
    
    async def verify_license(self, user: TestUser):
        """Verify motorcycle license for user (required for rides)"""
        # Create a simple base64 image (1x1 pixel PNG)
        fake_license_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        payload = {
            "license_type": "A",
            "license_photo_base64": fake_license_base64
        }
        
        response = await self.client.post(f"{API_BASE}/me/license", json=payload, headers=user.headers())
        if response.status_code == 200:
            print(f"✅ License verified for {user.username}")
        else:
            print(f"⚠️  License verification failed for {user.username}: {response.status_code} - {response.text}")
            # Continue anyway, might already be verified
    
    async def create_route(self, creator: TestUser) -> str:
        """Create a test route"""
        payload = {
            "title": "Test Route for Active Ride Banner",
            "description": "Test route to verify active ride banner functionality",
            "polyline": [
                [44.4268, 26.1025],  # Bucharest start
                [44.4378, 26.1125],  # Some middle point
                [44.4478, 26.1225]   # End point
            ],
            "difficulty": "medium",
            "participants_min": 1,
            "participants_max": 10,
            "fuel_price_per_l": 7.5,
            "bike_consumption_l_per_100km": 5.0,
            "toll_estimate": 0.0,
            "currency": "RON"
        }
        
        response = await self.client.post(f"{API_BASE}/routes", json=payload, headers=creator.headers())
        if response.status_code == 201:
            data = response.json()
            route_id = data["id"]
            print(f"✅ Created route: {route_id}")
            return route_id
        else:
            print(f"❌ Failed to create route: {response.status_code} - {response.text}")
            raise Exception("Route creation failed")
    
    async def join_route(self, user: TestUser, route_id: str):
        """Join a route as participant"""
        response = await self.client.post(f"{API_BASE}/routes/{route_id}/join", headers=user.headers())
        if response.status_code == 200:
            print(f"✅ User {user.username} joined route {route_id}")
        else:
            print(f"❌ Failed to join route: {response.status_code} - {response.text}")
            raise Exception(f"Route join failed for {user.username}")
    
    async def start_ride(self, user: TestUser, route_id: str) -> str:
        """Start a ride session"""
        payload = {"route_id": route_id}
        
        response = await self.client.post(f"{API_BASE}/rides/start", json=payload, headers=user.headers())
        if response.status_code == 201:
            data = response.json()
            session_id = data["id"]
            print(f"✅ Started ride session: {session_id} for user {user.username}")
            return session_id
        else:
            print(f"❌ Failed to start ride: {response.status_code} - {response.text}")
            raise Exception(f"Ride start failed for {user.username}")
    
    async def pause_ride(self, user: TestUser, session_id: str):
        """Pause a ride session"""
        payload = {"session_id": session_id}
        
        response = await self.client.post(f"{API_BASE}/rides/pause", json=payload, headers=user.headers())
        if response.status_code == 200:
            print(f"✅ Paused ride session: {session_id}")
        else:
            print(f"❌ Failed to pause ride: {response.status_code} - {response.text}")
            raise Exception("Ride pause failed")
    
    async def get_active_ride_for_home(self, user: TestUser) -> Optional[dict]:
        """Get active ride for home banner"""
        response = await self.client.get(f"{API_BASE}/rides/active-for-home", headers=user.headers())
        if response.status_code == 200:
            data = response.json()
            if data is None:
                print(f"ℹ️  No active ride for {user.username}")
                return None
            else:
                print(f"✅ Active ride for {user.username}: {data}")
                return data
        else:
            print(f"❌ Failed to get active ride: {response.status_code} - {response.text}")
            raise Exception(f"Get active ride failed for {user.username}")
    
    async def test_active_ride_banner_flow(self):
        """Test the complete active ride banner flow as specified in the review request"""
        print("\n🚀 Starting Active Ride Banner Test Flow")
        print("=" * 60)
        
        try:
            # Step 1: Setup users
            await self.cleanup_and_setup()
            
            # Step 2: User1 creates a route, User2 joins route
            print("\n📍 Step 2: Creating route and adding participant")
            self.route_id = await self.create_route(self.user1)
            await self.join_route(self.user2, self.route_id)
            
            # Step 3: User1 starts ride
            print("\n🏁 Step 3: Starting ride session")
            self.ride_session_id = await self.start_ride(self.user1, self.route_id)
            
            # Step 4: User1 checks active-for-home -> should return status active
            print("\n🔍 Step 4: Checking User1 (creator) active ride status")
            user1_active = await self.get_active_ride_for_home(self.user1)
            
            if not user1_active:
                raise Exception("❌ User1 should have active ride but got None")
            
            if user1_active["status"] != "active":
                raise Exception(f"❌ User1 ride status should be 'active' but got '{user1_active['status']}'")
            
            if user1_active["creator_id"] != self.user1.user_id:
                raise Exception(f"❌ Creator ID should be {self.user1.user_id} but got {user1_active['creator_id']}")
            
            if user1_active["route_id"] != self.route_id:
                raise Exception(f"❌ Route ID should be {self.route_id} but got {user1_active['route_id']}")
            
            print("✅ User1 active ride status correct!")
            
            # Step 5: User2 checks active-for-home -> should return same route_id, status active, creator_id=user1
            print("\n🔍 Step 5: Checking User2 (participant) active ride status")
            user2_active = await self.get_active_ride_for_home(self.user2)
            
            if not user2_active:
                raise Exception("❌ User2 should see active ride but got None")
            
            if user2_active["status"] != "active":
                raise Exception(f"❌ User2 should see 'active' status but got '{user2_active['status']}'")
            
            if user2_active["creator_id"] != self.user1.user_id:
                raise Exception(f"❌ User2 should see creator_id {self.user1.user_id} but got {user2_active['creator_id']}")
            
            if user2_active["route_id"] != self.route_id:
                raise Exception(f"❌ User2 should see route_id {self.route_id} but got {user2_active['route_id']}")
            
            print("✅ User2 participant view correct!")
            
            # Step 6: User1 pauses ride, then both check status -> should be paused
            print("\n⏸️  Step 6: Pausing ride and checking both users")
            await self.pause_ride(self.user1, self.ride_session_id)
            
            # Check User1 after pause
            user1_paused = await self.get_active_ride_for_home(self.user1)
            if not user1_paused or user1_paused["status"] != "paused":
                raise Exception(f"❌ User1 should have 'paused' status but got {user1_paused}")
            
            # Check User2 after pause
            user2_paused = await self.get_active_ride_for_home(self.user2)
            if not user2_paused or user2_paused["status"] != "paused":
                raise Exception(f"❌ User2 should see 'paused' status but got {user2_paused}")
            
            print("✅ Both users see paused status correctly!")
            
            # Step 7: User3 (outsider) checks -> should return null
            print("\n🚫 Step 7: Checking User3 (outsider) - should have no active ride")
            user3_active = await self.get_active_ride_for_home(self.user3)
            
            if user3_active is not None:
                raise Exception(f"❌ User3 (outsider) should have no active ride but got {user3_active}")
            
            print("✅ User3 (outsider) correctly has no active ride!")
            
            print("\n🎉 ALL TESTS PASSED! Active ride banner functionality working correctly!")
            return True
            
        except Exception as e:
            print(f"\n💥 TEST FAILED: {str(e)}")
            return False
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

async def main():
    """Main test function"""
    print("🏍️  Moto GO - Active Ride Banner Testing")
    print("Testing GET /api/rides/active-for-home endpoint")
    print("=" * 60)
    
    tester = MotoGoTester()
    
    try:
        success = await tester.test_active_ride_banner_flow()
        
        if success:
            print("\n✅ BACKEND TESTING COMPLETE - ALL TESTS PASSED")
            print("The active ride banner endpoint is working correctly!")
            return 0
        else:
            print("\n❌ BACKEND TESTING FAILED")
            print("Issues found with active ride banner endpoint!")
            return 1
            
    except Exception as e:
        print(f"\n💥 CRITICAL ERROR: {str(e)}")
        return 1
    finally:
        await tester.close()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)