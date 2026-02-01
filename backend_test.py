#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Moto GO Release Readiness
Tests all backend APIs according to review request specifications
"""

import asyncio
import json
import random
import string
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import httpx
import socketio


class BackendTester:
    def __init__(self):
        # Use the production URL from frontend/.env
        self.base_url = "https://motogo-dash.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.socket_url = self.base_url
        
        # Test data storage
        self.user1_token: Optional[str] = None
        self.user2_token: Optional[str] = None
        self.user1_id: Optional[str] = None
        self.user2_id: Optional[str] = None
        self.user1_email: Optional[str] = None
        self.user2_email: Optional[str] = None
        self.test_route_id: Optional[str] = None
        self.test_event_id: Optional[str] = None
        self.test_group_id: Optional[str] = None
        
        # Test results
        self.results: Dict[str, Any] = {}
        self.failed_tests: list = []

    def generate_random_email(self) -> str:
        """Generate a random email for testing"""
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"testuser_{random_str}@example.com"

    def generate_random_username(self) -> str:
        """Generate a random username for testing"""
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))

    async def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        
        self.results[test_name] = {
            "success": success,
            "details": details
        }
        
        if not success:
            self.failed_tests.append(test_name)

    async def test_auth_profile(self):
        """A) Auth/Profile Tests"""
        print("\n=== A) AUTH/PROFILE TESTS ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 1) Register random user 1
            self.user1_email = self.generate_random_email()
            user1_username = self.generate_random_username()
            
            register_data = {
                "email": self.user1_email,
                "username": user1_username,
                "password": "TestPassword123!"
            }
            
            try:
                resp = await client.post(f"{self.api_url}/auth/register", json=register_data)
                if resp.status_code == 200:
                    token_data = resp.json()
                    self.user1_token = token_data.get("access_token")
                    await self.log_test("Register User 1", True, f"Email: {self.user1_email}")
                else:
                    await self.log_test("Register User 1", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return
            except Exception as e:
                await self.log_test("Register User 1", False, f"Exception: {str(e)}")
                return

            # 2) Login with user 1
            login_data = {
                "email": self.user1_email,
                "password": "TestPassword123!"
            }
            
            try:
                resp = await client.post(f"{self.api_url}/auth/login", json=login_data)
                if resp.status_code == 200:
                    token_data = resp.json()
                    self.user1_token = token_data.get("access_token")
                    await self.log_test("Login User 1", True, "Token received")
                else:
                    await self.log_test("Login User 1", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return
            except Exception as e:
                await self.log_test("Login User 1", False, f"Exception: {str(e)}")
                return

            # 3) GET /api/me
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            try:
                resp = await client.get(f"{self.api_url}/me", headers=headers)
                if resp.status_code == 200:
                    user_data = resp.json()
                    self.user1_id = user_data.get("id")
                    await self.log_test("GET /api/me", True, f"User ID: {self.user1_id}")
                else:
                    await self.log_test("GET /api/me", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return
            except Exception as e:
                await self.log_test("GET /api/me", False, f"Exception: {str(e)}")
                return

            # 4) PATCH /api/me to set bio + bike model/cc
            update_data = {
                "bio": "Test rider bio for comprehensive testing",
                "bike": {
                    "model": "Yamaha MT-07",
                    "cc": 689
                }
            }
            
            try:
                resp = await client.patch(f"{self.api_url}/me", json=update_data, headers=headers)
                if resp.status_code == 200:
                    await self.log_test("PATCH /api/me (bio + bike)", True, "Profile updated")
                else:
                    await self.log_test("PATCH /api/me (bio + bike)", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("PATCH /api/me (bio + bike)", False, f"Exception: {str(e)}")

            # 5) Verify GET /api/me returns updated data
            try:
                resp = await client.get(f"{self.api_url}/me", headers=headers)
                if resp.status_code == 200:
                    user_data = resp.json()
                    bio = user_data.get("bio", "")
                    bike = user_data.get("bike", {})
                    
                    if "Test rider bio" in bio and bike.get("model") == "Yamaha MT-07" and bike.get("cc") == 689:
                        await self.log_test("Verify updated profile", True, "Bio and bike info updated correctly")
                    else:
                        await self.log_test("Verify updated profile", False, f"Data not updated correctly: bio='{bio}', bike={bike}")
                else:
                    await self.log_test("Verify updated profile", False, f"Status: {resp.status_code}")
            except Exception as e:
                await self.log_test("Verify updated profile", False, f"Exception: {str(e)}")

    async def test_routes(self):
        """B) Routes Tests"""
        print("\n=== B) ROUTES TESTS ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            
            # 3) POST /api/routes create route
            route_data = {
                "title": "Test Mountain Route",
                "description": "Comprehensive test route for backend verification",
                "polyline": [
                    [45.7489, 21.2087],  # Timisoara
                    [45.7500, 21.2200],  # Waypoint 1
                    [45.7600, 21.2300],  # Waypoint 2
                    [45.7700, 21.2400]   # End point
                ],
                "difficulty": "medium",
                "participants_min": 2,
                "participants_max": 8,
                "fuel_price_per_l": 7.5,
                "bike_consumption_l_per_100km": 5.0,
                "toll_estimate": 15.0,
                "currency": "RON",
                "stops_count": 2
            }
            
            try:
                resp = await client.post(f"{self.api_url}/routes", json=route_data)
                if resp.status_code == 200:
                    route_response = resp.json()
                    self.test_route_id = route_response.get("id")
                    
                    # Verify participants fields exist
                    if "participants_count" in route_response and "is_joined" in route_response:
                        await self.log_test("POST /api/routes (create)", True, f"Route ID: {self.test_route_id}, has participants fields")
                    else:
                        await self.log_test("POST /api/routes (create)", False, "Missing participants_count or is_joined fields")
                else:
                    await self.log_test("POST /api/routes (create)", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return
            except Exception as e:
                await self.log_test("POST /api/routes (create)", False, f"Exception: {str(e)}")
                return

            # 4) GET /api/routes without token should be 401
            try:
                resp = await client.get(f"{self.api_url}/routes")
                if resp.status_code == 401:
                    await self.log_test("GET /api/routes (no token)", True, "Correctly returns 401")
                else:
                    await self.log_test("GET /api/routes (no token)", False, f"Expected 401, got {resp.status_code}")
            except Exception as e:
                await self.log_test("GET /api/routes (no token)", False, f"Exception: {str(e)}")

            # 5) GET /api/routes with token returns is_joined=false, participants_count
            try:
                resp = await client.get(f"{self.api_url}/routes", headers=headers)
                if resp.status_code == 200:
                    routes = resp.json()
                    if routes and len(routes) > 0:
                        route = routes[0]  # Check first route
                        if "is_joined" in route and "participants_count" in route:
                            await self.log_test("GET /api/routes (with token)", True, f"is_joined={route['is_joined']}, participants_count={route['participants_count']}")
                        else:
                            await self.log_test("GET /api/routes (with token)", False, "Missing is_joined or participants_count fields")
                    else:
                        await self.log_test("GET /api/routes (with token)", False, "No routes returned")
                else:
                    await self.log_test("GET /api/routes (with token)", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("GET /api/routes (with token)", False, f"Exception: {str(e)}")

            # 6) POST /api/routes/{id}/join
            if self.test_route_id:
                try:
                    resp = await client.post(f"{self.api_url}/routes/{self.test_route_id}/join", headers=headers)
                    if resp.status_code == 200:
                        await self.log_test("POST /api/routes/{id}/join", True, "Successfully joined route")
                    else:
                        await self.log_test("POST /api/routes/{id}/join", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("POST /api/routes/{id}/join", False, f"Exception: {str(e)}")

                # 7) Verify GET /api/routes shows is_joined=true
                try:
                    resp = await client.get(f"{self.api_url}/routes", headers=headers)
                    if resp.status_code == 200:
                        routes = resp.json()
                        joined_route = None
                        for route in routes:
                            if route.get("id") == self.test_route_id:
                                joined_route = route
                                break
                        
                        if joined_route and joined_route.get("is_joined") == True:
                            await self.log_test("Verify route join (is_joined=true)", True, f"participants_count={joined_route.get('participants_count')}")
                        else:
                            await self.log_test("Verify route join (is_joined=true)", False, f"is_joined not true or route not found")
                    else:
                        await self.log_test("Verify route join (is_joined=true)", False, f"Status: {resp.status_code}")
                except Exception as e:
                    await self.log_test("Verify route join (is_joined=true)", False, f"Exception: {str(e)}")

                # 8) POST /api/routes/{id}/leave
                try:
                    resp = await client.post(f"{self.api_url}/routes/{self.test_route_id}/leave", headers=headers)
                    if resp.status_code == 200:
                        await self.log_test("POST /api/routes/{id}/leave", True, "Successfully left route")
                    else:
                        await self.log_test("POST /api/routes/{id}/leave", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("POST /api/routes/{id}/leave", False, f"Exception: {str(e)}")

                # 9) Verify GET /api/routes shows is_joined=false
                try:
                    resp = await client.get(f"{self.api_url}/routes", headers=headers)
                    if resp.status_code == 200:
                        routes = resp.json()
                        left_route = None
                        for route in routes:
                            if route.get("id") == self.test_route_id:
                                left_route = route
                                break
                        
                        if left_route and left_route.get("is_joined") == False:
                            await self.log_test("Verify route leave (is_joined=false)", True, f"participants_count={left_route.get('participants_count')}")
                        else:
                            await self.log_test("Verify route leave (is_joined=false)", False, f"is_joined not false or route not found")
                    else:
                        await self.log_test("Verify route leave (is_joined=false)", False, f"Status: {resp.status_code}")
                except Exception as e:
                    await self.log_test("Verify route leave (is_joined=false)", False, f"Exception: {str(e)}")

    async def test_events(self):
        """C) Events Tests"""
        print("\n=== C) EVENTS TESTS ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            
            # 8) POST /api/events create event
            event_data = {
                "title": "Test Motorcycle Meetup",
                "description": "Comprehensive test event for backend verification",
                "start_point": [45.7489, 21.2087],  # Timisoara coordinates
                "start_time": (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
            }
            
            try:
                resp = await client.post(f"{self.api_url}/events", json=event_data)
                if resp.status_code == 200:
                    event_response = resp.json()
                    self.test_event_id = event_response.get("id")
                    await self.log_test("POST /api/events (create)", True, f"Event ID: {self.test_event_id}")
                else:
                    await self.log_test("POST /api/events (create)", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return
            except Exception as e:
                await self.log_test("POST /api/events (create)", False, f"Exception: {str(e)}")
                return

            # 9) GET /api/events with token returns participants_count/is_joined
            try:
                resp = await client.get(f"{self.api_url}/events", headers=headers)
                if resp.status_code == 200:
                    events = resp.json()
                    if events and len(events) > 0:
                        event = events[0]  # Check first event
                        if "is_joined" in event and "participants_count" in event:
                            await self.log_test("GET /api/events (with token)", True, f"is_joined={event['is_joined']}, participants_count={event['participants_count']}")
                        else:
                            await self.log_test("GET /api/events (with token)", False, "Missing is_joined or participants_count fields")
                    else:
                        await self.log_test("GET /api/events (with token)", False, "No events returned")
                else:
                    await self.log_test("GET /api/events (with token)", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("GET /api/events (with token)", False, f"Exception: {str(e)}")

            # 10) POST /api/events/{id}/join and /leave toggles
            if self.test_event_id:
                # Join event
                try:
                    resp = await client.post(f"{self.api_url}/events/{self.test_event_id}/join", headers=headers)
                    if resp.status_code == 200:
                        await self.log_test("POST /api/events/{id}/join", True, "Successfully joined event")
                    else:
                        await self.log_test("POST /api/events/{id}/join", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("POST /api/events/{id}/join", False, f"Exception: {str(e)}")

                # Verify join
                try:
                    resp = await client.get(f"{self.api_url}/events", headers=headers)
                    if resp.status_code == 200:
                        events = resp.json()
                        joined_event = None
                        for event in events:
                            if event.get("id") == self.test_event_id:
                                joined_event = event
                                break
                        
                        if joined_event and joined_event.get("is_joined") == True:
                            await self.log_test("Verify event join (is_joined=true)", True, f"participants_count={joined_event.get('participants_count')}")
                        else:
                            await self.log_test("Verify event join (is_joined=true)", False, f"is_joined not true or event not found")
                    else:
                        await self.log_test("Verify event join (is_joined=true)", False, f"Status: {resp.status_code}")
                except Exception as e:
                    await self.log_test("Verify event join (is_joined=true)", False, f"Exception: {str(e)}")

                # Leave event
                try:
                    resp = await client.post(f"{self.api_url}/events/{self.test_event_id}/leave", headers=headers)
                    if resp.status_code == 200:
                        await self.log_test("POST /api/events/{id}/leave", True, "Successfully left event")
                    else:
                        await self.log_test("POST /api/events/{id}/leave", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("POST /api/events/{id}/leave", False, f"Exception: {str(e)}")

                # Verify leave
                try:
                    resp = await client.get(f"{self.api_url}/events", headers=headers)
                    if resp.status_code == 200:
                        events = resp.json()
                        left_event = None
                        for event in events:
                            if event.get("id") == self.test_event_id:
                                left_event = event
                                break
                        
                        if left_event and left_event.get("is_joined") == False:
                            await self.log_test("Verify event leave (is_joined=false)", True, f"participants_count={left_event.get('participants_count')}")
                        else:
                            await self.log_test("Verify event leave (is_joined=false)", False, f"is_joined not false or event not found")
                    else:
                        await self.log_test("Verify event leave (is_joined=false)", False, f"Status: {resp.status_code}")
                except Exception as e:
                    await self.log_test("Verify event leave (is_joined=false)", False, f"Exception: {str(e)}")

    async def test_realtime(self):
        """D) Realtime Tests"""
        print("\n=== D) REALTIME TESTS ===")
        
        # 11) Socket.IO connect using socketio_path='api/socket.io' and JWT token
        try:
            sio = socketio.AsyncClient()
            
            # Set up event handlers
            ping_received = False
            
            @sio.event
            async def pong_test(data):
                nonlocal ping_received
                ping_received = True
                print(f"    Received pong_test: {data}")
            
            # Connect with JWT token
            await sio.connect(
                self.socket_url,
                socketio_path='api/socket.io',
                auth={'token': self.user1_token}
            )
            
            await self.log_test("Socket.IO connect with JWT", True, "Connected successfully")
            
            # Emit ping_test and expect pong_test
            await sio.emit('ping_test', {'test_data': 'comprehensive_test'})
            
            # Wait for response
            await asyncio.sleep(2)
            
            if ping_received:
                await self.log_test("Socket.IO ping_test -> pong_test", True, "Ping-pong working correctly")
            else:
                await self.log_test("Socket.IO ping_test -> pong_test", False, "No pong_test response received")
            
            await sio.disconnect()
            
        except Exception as e:
            await self.log_test("Socket.IO connect with JWT", False, f"Exception: {str(e)}")
            await self.log_test("Socket.IO ping_test -> pong_test", False, f"Exception: {str(e)}")

    async def test_friends_groups_chat(self):
        """E) Friends/Groups/Chat Tests"""
        print("\n=== E) FRIENDS/GROUPS/CHAT TESTS ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 12) Register 2nd user
            self.user2_email = self.generate_random_email()
            user2_username = self.generate_random_username()
            
            register_data = {
                "email": self.user2_email,
                "username": user2_username,
                "password": "TestPassword123!"
            }
            
            try:
                resp = await client.post(f"{self.api_url}/auth/register", json=register_data)
                if resp.status_code == 200:
                    token_data = resp.json()
                    self.user2_token = token_data.get("access_token")
                    await self.log_test("Register User 2", True, f"Email: {self.user2_email}")
                else:
                    await self.log_test("Register User 2", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return
            except Exception as e:
                await self.log_test("Register User 2", False, f"Exception: {str(e)}")
                return

            # Get user2 ID
            headers2 = {"Authorization": f"Bearer {self.user2_token}"}
            try:
                resp = await client.get(f"{self.api_url}/me", headers=headers2)
                if resp.status_code == 200:
                    user_data = resp.json()
                    self.user2_id = user_data.get("id")
                    await self.log_test("Get User 2 ID", True, f"User 2 ID: {self.user2_id}")
                else:
                    await self.log_test("Get User 2 ID", False, f"Status: {resp.status_code}")
                    return
            except Exception as e:
                await self.log_test("Get User 2 ID", False, f"Exception: {str(e)}")
                return

            headers1 = {"Authorization": f"Bearer {self.user1_token}"}
            
            # Friend request + accept
            try:
                # User 1 sends friend request to User 2
                friend_request_data = {"to_username": user2_username}
                resp = await client.post(f"{self.api_url}/friends/request", json=friend_request_data, headers=headers1)
                if resp.status_code == 200:
                    await self.log_test("Send friend request", True, f"User 1 -> User 2")
                else:
                    await self.log_test("Send friend request", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("Send friend request", False, f"Exception: {str(e)}")

            try:
                # User 2 accepts friend request from User 1
                accept_data = {"from_user_id": self.user1_id}
                resp = await client.post(f"{self.api_url}/friends/accept", json=accept_data, headers=headers2)
                if resp.status_code == 200:
                    await self.log_test("Accept friend request", True, f"User 2 accepts User 1")
                else:
                    await self.log_test("Accept friend request", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("Accept friend request", False, f"Exception: {str(e)}")

            # 13) Create group, join group
            try:
                group_data = {
                    "name": "Test Riders Group",
                    "description": "Comprehensive test group for backend verification",
                    "is_private": False
                }
                resp = await client.post(f"{self.api_url}/groups", json=group_data, headers=headers1)
                if resp.status_code == 200:
                    group_response = resp.json()
                    self.test_group_id = group_response.get("id")
                    await self.log_test("Create group", True, f"Group ID: {self.test_group_id}")
                else:
                    await self.log_test("Create group", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("Create group", False, f"Exception: {str(e)}")

            if self.test_group_id:
                try:
                    # User 2 joins the group
                    resp = await client.post(f"{self.api_url}/groups/{self.test_group_id}/join", headers=headers2)
                    if resp.status_code == 200:
                        await self.log_test("Join group", True, f"User 2 joined group")
                    else:
                        await self.log_test("Join group", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("Join group", False, f"Exception: {str(e)}")

            # 14) DM send via REST and ensure history returns
            try:
                dm_data = {"text": "Hello from User 1! This is a comprehensive test message."}
                resp = await client.post(f"{self.api_url}/dm/{self.user2_id}/messages", json=dm_data, headers=headers1)
                if resp.status_code == 200:
                    await self.log_test("Send DM via REST", True, f"User 1 -> User 2")
                else:
                    await self.log_test("Send DM via REST", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("Send DM via REST", False, f"Exception: {str(e)}")

            try:
                # Check DM history
                resp = await client.get(f"{self.api_url}/dm/{self.user2_id}/messages", headers=headers1)
                if resp.status_code == 200:
                    messages = resp.json()
                    if messages and len(messages) > 0:
                        await self.log_test("DM history retrieval", True, f"Found {len(messages)} messages")
                    else:
                        await self.log_test("DM history retrieval", False, "No messages in history")
                else:
                    await self.log_test("DM history retrieval", False, f"Status: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                await self.log_test("DM history retrieval", False, f"Exception: {str(e)}")

            # 15) Group message via REST and ensure history returns
            if self.test_group_id:
                try:
                    group_msg_data = {"text": "Hello group! This is a comprehensive test group message."}
                    resp = await client.post(f"{self.api_url}/groups/{self.test_group_id}/messages", json=group_msg_data, headers=headers1)
                    if resp.status_code == 200:
                        await self.log_test("Send group message via REST", True, f"User 1 -> Group")
                    else:
                        await self.log_test("Send group message via REST", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("Send group message via REST", False, f"Exception: {str(e)}")

                try:
                    # Check group message history
                    resp = await client.get(f"{self.api_url}/groups/{self.test_group_id}/messages", headers=headers1)
                    if resp.status_code == 200:
                        messages = resp.json()
                        if messages and len(messages) > 0:
                            await self.log_test("Group message history retrieval", True, f"Found {len(messages)} messages")
                        else:
                            await self.log_test("Group message history retrieval", False, "No messages in group history")
                    else:
                        await self.log_test("Group message history retrieval", False, f"Status: {resp.status_code}, Response: {resp.text}")
                except Exception as e:
                    await self.log_test("Group message history retrieval", False, f"Exception: {str(e)}")

    async def run_comprehensive_tests(self):
        """Run all comprehensive backend tests"""
        print("🚀 Starting Comprehensive Backend Verification for Release Readiness")
        print(f"Testing against: {self.api_url}")
        print("=" * 80)
        
        # Run all test suites
        await self.test_auth_profile()
        await self.test_routes()
        await self.test_events()
        await self.test_realtime()
        await self.test_friends_groups_chat()
        
        # Print summary
        print("\n" + "=" * 80)
        print("🏁 COMPREHENSIVE TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        if failed_tests > 0:
            print(f"\n🚨 FAILED TESTS ({failed_tests}):")
            for test_name in self.failed_tests:
                result = self.results[test_name]
                print(f"  ❌ {test_name}: {result['details']}")
        
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 RELEASE READY - Backend verification successful!")
        elif success_rate >= 75:
            print("⚠️  MOSTLY READY - Minor issues need attention")
        else:
            print("🚨 NOT READY - Critical issues need resolution")
        
        return success_rate >= 90


async def test_profile_settings_readiness():
    """Test backend updates for profile/settings readiness as per review request"""
    print("🧪 Testing Backend Profile/Settings Readiness")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # 1) Register/login random user
        print("\n1️⃣ Testing User Registration and Login")
        
        # Generate random credentials
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        email = f"testuser_{random_str}@example.com"
        username = f"user{random.randint(1000, 9999)}"
        password = "TestPassword123"
        
        print(f"   📧 Email: {email}")
        print(f"   👤 Username: {username}")
        
        # Register user
        register_payload = {
            "email": email,
            "username": username,
            "password": password
        }
        
        try:
            register_response = await client.post("https://motogo-dash.preview.emergentagent.com/api/auth/register", json=register_payload)
            print(f"   ✅ Register Status: {register_response.status_code}")
            
            if register_response.status_code != 200:
                print(f"   ❌ Register failed: {register_response.text}")
                return False
                
            register_data = register_response.json()
            token = register_data.get("access_token")
            
            if not token:
                print("   ❌ No access token received from registration")
                return False
                
            print(f"   🔑 Token received: {token[:20]}...")
            
        except Exception as e:
            print(f"   ❌ Registration failed with exception: {e}")
            return False
        
        # Test login with same credentials
        login_payload = {
            "email": email,
            "password": password
        }
        
        try:
            login_response = await client.post("https://motogo-dash.preview.emergentagent.com/api/auth/login", json=login_payload)
            print(f"   ✅ Login Status: {login_response.status_code}")
            
            if login_response.status_code != 200:
                print(f"   ❌ Login failed: {login_response.text}")
                return False
                
            login_data = login_response.json()
            login_token = login_data.get("access_token")
            
            if not login_token:
                print("   ❌ No access token received from login")
                return False
                
            print(f"   🔑 Login token received: {login_token[:20]}...")
            
        except Exception as e:
            print(f"   ❌ Login failed with exception: {e}")
            return False
        
        # Use the login token for subsequent requests
        headers = {"Authorization": f"Bearer {login_token}"}
        
        # 2) PATCH /api/me with bio, bike, country, privacy
        print("\n2️⃣ Testing Profile Update (PATCH /api/me)")
        
        update_payload = {
            "bio": "Passionate motorcycle rider exploring scenic routes across Romania",
            "bike": {
                "model": "Yamaha MT-07",
                "cc": 689
            },
            "country": "RO",
            "privacy": {
                "location_visible": True,
                "routes_visible": "friends"
            }
        }
        
        try:
            patch_response = await client.patch("https://motogo-dash.preview.emergentagent.com/api/me", json=update_payload, headers=headers)
            print(f"   ✅ PATCH /api/me Status: {patch_response.status_code}")
            
            if patch_response.status_code != 200:
                print(f"   ❌ Profile update failed: {patch_response.text}")
                return False
                
            patch_data = patch_response.json()
            print(f"   ✅ Profile updated successfully")
            print(f"   📝 Bio: {patch_data.get('bio', 'N/A')}")
            print(f"   🏍️ Bike: {patch_data.get('bike', 'N/A')}")
            print(f"   🌍 Country: {patch_data.get('country', 'N/A')}")
            print(f"   🔒 Privacy: {patch_data.get('privacy', 'N/A')}")
            
        except Exception as e:
            print(f"   ❌ Profile update failed with exception: {e}")
            return False
        
        # 3) GET /api/me returns these fields
        print("\n3️⃣ Testing Profile Retrieval (GET /api/me)")
        
        try:
            get_me_response = await client.get("https://motogo-dash.preview.emergentagent.com/api/me", headers=headers)
            print(f"   ✅ GET /api/me Status: {get_me_response.status_code}")
            
            if get_me_response.status_code != 200:
                print(f"   ❌ Profile retrieval failed: {get_me_response.text}")
                return False
                
            me_data = get_me_response.json()
            
            # Verify all required fields are present and match
            required_fields = ["bio", "bike", "country", "privacy"]
            missing_fields = []
            
            for field in required_fields:
                if field not in me_data:
                    missing_fields.append(field)
                else:
                    print(f"   ✅ {field}: {me_data[field]}")
            
            if missing_fields:
                print(f"   ❌ Missing fields in GET /api/me: {missing_fields}")
                return False
            
            # Verify specific values match what we set
            if me_data.get("bio") != update_payload["bio"]:
                print(f"   ❌ Bio mismatch: expected '{update_payload['bio']}', got '{me_data.get('bio')}'")
                return False
                
            if me_data.get("country") != update_payload["country"]:
                print(f"   ❌ Country mismatch: expected '{update_payload['country']}', got '{me_data.get('country')}'")
                return False
                
            bike_data = me_data.get("bike", {})
            expected_bike = update_payload["bike"]
            if bike_data.get("model") != expected_bike["model"] or bike_data.get("cc") != expected_bike["cc"]:
                print(f"   ❌ Bike mismatch: expected {expected_bike}, got {bike_data}")
                return False
                
            privacy_data = me_data.get("privacy", {})
            expected_privacy = update_payload["privacy"]
            if (privacy_data.get("location_visible") != expected_privacy["location_visible"] or 
                privacy_data.get("routes_visible") != expected_privacy["routes_visible"]):
                print(f"   ❌ Privacy mismatch: expected {expected_privacy}, got {privacy_data}")
                return False
                
            print(f"   ✅ All profile fields verified successfully")
            
        except Exception as e:
            print(f"   ❌ Profile retrieval failed with exception: {e}")
            return False
        
        # 4) GET /api/stats returns required keys
        print("\n4️⃣ Testing Stats Endpoint (GET /api/stats)")
        
        try:
            stats_response = await client.get("https://motogo-dash.preview.emergentagent.com/api/stats", headers=headers)
            print(f"   ✅ GET /api/stats Status: {stats_response.status_code}")
            
            if stats_response.status_code != 200:
                print(f"   ❌ Stats retrieval failed: {stats_response.text}")
                return False
                
            stats_data = stats_response.json()
            
            # Verify all required keys are present
            required_keys = ["km_total", "km_month", "joined_routes", "events_joined", "completed_routes"]
            missing_keys = []
            
            for key in required_keys:
                if key not in stats_data:
                    missing_keys.append(key)
                else:
                    print(f"   ✅ {key}: {stats_data[key]}")
            
            if missing_keys:
                print(f"   ❌ Missing keys in GET /api/stats: {missing_keys}")
                return False
                
            # Verify data types
            numeric_keys = ["km_total", "km_month", "joined_routes", "events_joined", "completed_routes"]
            for key in numeric_keys:
                value = stats_data.get(key)
                if not isinstance(value, (int, float)):
                    print(f"   ❌ {key} should be numeric, got {type(value)}: {value}")
                    return False
                    
            print(f"   ✅ All stats keys verified successfully")
            
        except Exception as e:
            print(f"   ❌ Stats retrieval failed with exception: {e}")
            return False
        
        print("\n🎉 ALL PROFILE/SETTINGS TESTS PASSED!")
        print("=" * 60)
        return True

async def test_group_search_join():
    """Test Group Search + Join feature as per Romanian review request"""
    print("🔍 Testing Group Search + Join Feature")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # 1) Login with user1@example.com / Password123
        print("\n1️⃣ Testing Login with user1@example.com")
        
        login_payload = {
            "email": "user1@example.com",
            "password": "Password123"
        }
        
        try:
            login_response = await client.post("https://motogo-dash.preview.emergentagent.com/api/auth/login", json=login_payload)
            print(f"   Status: {login_response.status_code}")
            
            if login_response.status_code != 200:
                print(f"   ❌ Login failed: {login_response.text}")
                return False
                
            login_data = login_response.json()
            token = login_data.get("access_token")
            
            if not token:
                print("   ❌ No access token received from login")
                return False
                
            print(f"   ✅ Login successful, token received")
            
        except Exception as e:
            print(f"   ❌ Login failed with exception: {e}")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2) Create Group A: name="Moto GO Public Test", is_private=false
        print("\n2️⃣ Creating Group A (Public)")
        
        group_a_payload = {
            "name": "Moto GO Public Test",
            "description": "Test group for Group Search + Join feature testing",
            "is_private": False
        }
        
        try:
            group_a_response = await client.post("https://motogo-dash.preview.emergentagent.com/api/groups", json=group_a_payload, headers=headers)
            print(f"   Status: {group_a_response.status_code}")
            
            if group_a_response.status_code != 200:
                print(f"   ❌ Group A creation failed: {group_a_response.text}")
                return False
                
            group_a_data = group_a_response.json()
            group_a_id = group_a_data.get("id")
            
            print(f"   ✅ Group A created successfully")
            print(f"   ID: {group_a_id}")
            print(f"   Name: {group_a_data.get('name')}")
            print(f"   Private: {group_a_data.get('is_private')}")
            
        except Exception as e:
            print(f"   ❌ Group A creation failed with exception: {e}")
            return False
        
        # 3) Create Group B: name="Moto GO Private Test", is_private=true
        print("\n3️⃣ Creating Group B (Private)")
        
        group_b_payload = {
            "name": "Moto GO Private Test",
            "description": "Private test group for Group Search + Join feature testing",
            "is_private": True
        }
        
        try:
            group_b_response = await client.post("https://motogo-dash.preview.emergentagent.com/api/groups", json=group_b_payload, headers=headers)
            print(f"   Status: {group_b_response.status_code}")
            
            if group_b_response.status_code != 200:
                print(f"   ❌ Group B creation failed: {group_b_response.text}")
                return False
                
            group_b_data = group_b_response.json()
            group_b_id = group_b_data.get("id")
            
            print(f"   ✅ Group B created successfully")
            print(f"   ID: {group_b_id}")
            print(f"   Name: {group_b_data.get('name')}")
            print(f"   Private: {group_b_data.get('is_private')}")
            
        except Exception as e:
            print(f"   ❌ Group B creation failed with exception: {e}")
            return False
        
        # 4) Test GET /api/groups/search?q=Moto (limit 20)
        print("\n4️⃣ Testing Group Search with 'Moto'")
        
        search_params = {
            "q": "Moto",
            "limit": 20
        }
        
        try:
            search_response = await client.get("https://motogo-dash.preview.emergentagent.com/api/groups/search", params=search_params, headers=headers)
            print(f"   Status: {search_response.status_code}")
            
            if search_response.status_code != 200:
                print(f"   ❌ Group search failed: {search_response.text}")
                return False
                
            search_results = search_response.json()
            print(f"   ✅ Search successful, found {len(search_results)} groups")
            
            # Check if Group A (public) is in results
            group_a_found = False
            group_b_found = False
            
            for group in search_results:
                print(f"   Found group: {group.get('name')} (ID: {group.get('id')}, Private: {group.get('is_private')})")
                
                if group.get("id") == group_a_id:
                    group_a_found = True
                elif group.get("id") == group_b_id:
                    group_b_found = True
            
            # Verify search results
            print(f"\n   🔍 Search Results Verification:")
            if group_a_found:
                print(f"   ✅ Group A (public) found in search results - CORRECT")
            else:
                print(f"   ❌ Group A (public) NOT found in search results - INCORRECT")
                return False
            
            if not group_b_found:
                print(f"   ✅ Group B (private) NOT found in search results - CORRECT")
            else:
                print(f"   ❌ Group B (private) found in search results - INCORRECT (private groups should not appear)")
                return False
            
        except Exception as e:
            print(f"   ❌ Group search failed with exception: {e}")
            return False
        
        # 5) Test join on Group A with POST /api/groups/{id}/join
        print("\n5️⃣ Testing Join Group A")
        
        try:
            join_response = await client.post(f"https://motogo-dash.preview.emergentagent.com/api/groups/{group_a_id}/join", headers=headers)
            print(f"   Status: {join_response.status_code}")
            
            if join_response.status_code != 200:
                print(f"   ❌ Join Group A failed: {join_response.text}")
                return False
                
            join_data = join_response.json()
            print(f"   ✅ Successfully joined Group A")
            print(f"   Response: {join_data}")
            
        except Exception as e:
            print(f"   ❌ Join Group A failed with exception: {e}")
            return False
        
        # 6) Verify GET /api/groups shows Group A in user1's list
        print("\n6️⃣ Verifying Group A appears in user's groups")
        
        try:
            user_groups_response = await client.get("https://motogo-dash.preview.emergentagent.com/api/groups", headers=headers)
            print(f"   Status: {user_groups_response.status_code}")
            
            if user_groups_response.status_code != 200:
                print(f"   ❌ Get user groups failed: {user_groups_response.text}")
                return False
                
            user_groups = user_groups_response.json()
            print(f"   ✅ Retrieved {len(user_groups)} user groups")
            
            # Check if Group A is in user's groups
            group_a_in_list = False
            for group in user_groups:
                print(f"   User group: {group.get('name')} (ID: {group.get('id')})")
                if group.get("id") == group_a_id:
                    group_a_in_list = True
            
            if group_a_in_list:
                print(f"   ✅ Group A found in user's groups list - CORRECT")
            else:
                print(f"   ❌ Group A NOT found in user's groups list - INCORRECT")
                return False
            
        except Exception as e:
            print(f"   ❌ Get user groups failed with exception: {e}")
            return False
        
        print("\n🎉 ALL GROUP SEARCH + JOIN TESTS PASSED!")
        print("=" * 60)
        print("✅ Group A (public) correctly appears in search")
        print("✅ Group B (private) correctly does NOT appear in search")
        print("✅ Join Group A functionality working")
        print("✅ Group A appears in user's groups after joining")
        print("=" * 60)
        return True

async def main():
    """Main test execution"""
    print("🚀 Starting Group Search + Join Feature Testing")
    print("Testing specific Romanian review request scenarios")
    print("=" * 80)
    
    success = await test_group_search_join()
    
    if success:
        print("\n✅ Group Search + Join Feature: PASSED")
        return 0
    else:
        print("\n❌ Group Search + Join Feature: FAILED")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)