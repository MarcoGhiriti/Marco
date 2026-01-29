#!/usr/bin/env python3
"""
Backend test for Friends + Groups + Chat (REST history + Socket.IO realtime)
Tests the complete flow as specified in the review request.
"""

import asyncio
import json
import random
import string
import time
from datetime import datetime

import httpx
import socketio


# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return "https://riderzone-1.preview.emergentagent.com"


BASE_URL = get_backend_url()
API_URL = f"{BASE_URL}/api"

print(f"Testing backend at: {API_URL}")


def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


class TestUser:
    def __init__(self, username_prefix="testuser"):
        self.username = f"{username_prefix}{random_string()}"
        self.email = f"{self.username}@test.com"
        self.password = "testpass123"
        self.token = None
        self.user_id = None
        self.user_data = None

    async def register_and_login(self, client: httpx.AsyncClient):
        """Register and login user, store token and user data"""
        # Register
        register_data = {
            "email": self.email,
            "username": self.username,
            "password": self.password
        }
        
        resp = await client.post(f"{API_URL}/auth/register", json=register_data)
        if resp.status_code != 200:
            raise Exception(f"Registration failed: {resp.status_code} - {resp.text}")
        
        token_data = resp.json()
        self.token = token_data["access_token"]
        
        # Get user data
        headers = {"Authorization": f"Bearer {self.token}"}
        me_resp = await client.get(f"{API_URL}/me", headers=headers)
        if me_resp.status_code != 200:
            raise Exception(f"Get /me failed: {me_resp.status_code} - {me_resp.text}")
        
        self.user_data = me_resp.json()
        self.user_id = self.user_data["id"]
        
        print(f"✅ User {self.username} registered and logged in (ID: {self.user_id})")
        return self

    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}


async def test_friends_flow():
    """Test the complete friends flow: search, request, accept, list"""
    print("\n🔍 Testing Friends Flow...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1) Register uA and uB, login both, get /api/me
        user_a = await TestUser("usera").register_and_login(client)
        user_b = await TestUser("userb").register_and_login(client)
        
        # 2) User search: GET /api/users/search?username=<prefix> returns other user
        search_resp = await client.get(
            f"{API_URL}/users/search?username={user_b.username[:5]}", 
            headers=user_a.get_headers()
        )
        if search_resp.status_code != 200:
            raise Exception(f"User search failed: {search_resp.status_code} - {search_resp.text}")
        
        search_results = search_resp.json()
        found_user_b = None
        for user in search_results:
            if user["username"] == user_b.username:
                found_user_b = user
                break
        
        if not found_user_b:
            raise Exception(f"User B ({user_b.username}) not found in search results")
        
        print(f"✅ User search found {user_b.username}")
        
        # 3) Friend request: POST /api/friends/request {to_username} by uA
        friend_request_data = {"to_username": user_b.username}
        req_resp = await client.post(
            f"{API_URL}/friends/request", 
            json=friend_request_data,
            headers=user_a.get_headers()
        )
        if req_resp.status_code != 200:
            raise Exception(f"Friend request failed: {req_resp.status_code} - {req_resp.text}")
        
        print(f"✅ Friend request sent from {user_a.username} to {user_b.username}")
        
        # 4) Friend requests list: GET /api/friends/requests for uB shows incoming with uA
        requests_resp = await client.get(
            f"{API_URL}/friends/requests",
            headers=user_b.get_headers()
        )
        if requests_resp.status_code != 200:
            raise Exception(f"Get friend requests failed: {requests_resp.status_code} - {requests_resp.text}")
        
        requests_data = requests_resp.json()
        incoming_requests = requests_data.get("incoming", [])
        
        found_request = None
        for req in incoming_requests:
            if req["id"] == user_a.user_id:
                found_request = req
                break
        
        if not found_request:
            raise Exception(f"Friend request from {user_a.username} not found in incoming requests")
        
        print(f"✅ Friend request from {user_a.username} found in {user_b.username}'s incoming requests")
        
        # 5) Accept: POST /api/friends/accept {from_user_id:uA_id} by uB
        accept_data = {"from_user_id": user_a.user_id}
        accept_resp = await client.post(
            f"{API_URL}/friends/accept",
            json=accept_data,
            headers=user_b.get_headers()
        )
        if accept_resp.status_code != 200:
            raise Exception(f"Friend accept failed: {accept_resp.status_code} - {accept_resp.text}")
        
        print(f"✅ Friend request accepted by {user_b.username}")
        
        # 6) Friends list: GET /api/friends for both shows each other
        # Check user A's friends list
        friends_a_resp = await client.get(f"{API_URL}/friends", headers=user_a.get_headers())
        if friends_a_resp.status_code != 200:
            raise Exception(f"Get friends for A failed: {friends_a_resp.status_code} - {friends_a_resp.text}")
        
        friends_a = friends_a_resp.json()
        found_b_in_a = any(friend["id"] == user_b.user_id for friend in friends_a)
        
        # Check user B's friends list
        friends_b_resp = await client.get(f"{API_URL}/friends", headers=user_b.get_headers())
        if friends_b_resp.status_code != 200:
            raise Exception(f"Get friends for B failed: {friends_b_resp.status_code} - {friends_b_resp.text}")
        
        friends_b = friends_b_resp.json()
        found_a_in_b = any(friend["id"] == user_a.user_id for friend in friends_b)
        
        if not found_b_in_a:
            raise Exception(f"User B not found in User A's friends list")
        if not found_a_in_b:
            raise Exception(f"User A not found in User B's friends list")
        
        print(f"✅ Both users appear in each other's friends lists")
        
        return user_a, user_b


async def test_groups_flow(user_a: TestUser, user_b: TestUser):
    """Test groups: create, join, list"""
    print("\n👥 Testing Groups Flow...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 7) Groups: uA creates group POST /api/groups
        group_data = {
            "name": f"Test Group {random_string()}",
            "description": "A test group for motorcycle enthusiasts",
            "is_private": False
        }
        
        create_resp = await client.post(
            f"{API_URL}/groups",
            json=group_data,
            headers=user_a.get_headers()
        )
        if create_resp.status_code != 200:
            raise Exception(f"Group creation failed: {create_resp.status_code} - {create_resp.text}")
        
        group = create_resp.json()
        group_id = group["id"]
        
        print(f"✅ Group '{group['name']}' created by {user_a.username} (ID: {group_id})")
        
        # uB joins POST /api/groups/{id}/join
        join_resp = await client.post(
            f"{API_URL}/groups/{group_id}/join",
            headers=user_b.get_headers()
        )
        if join_resp.status_code != 200:
            raise Exception(f"Group join failed: {join_resp.status_code} - {join_resp.text}")
        
        print(f"✅ {user_b.username} joined the group")
        
        # both list GET /api/groups
        # Check user A's groups
        groups_a_resp = await client.get(f"{API_URL}/groups", headers=user_a.get_headers())
        if groups_a_resp.status_code != 200:
            raise Exception(f"Get groups for A failed: {groups_a_resp.status_code} - {groups_a_resp.text}")
        
        groups_a = groups_a_resp.json()
        found_group_a = any(g["id"] == group_id for g in groups_a)
        
        # Check user B's groups
        groups_b_resp = await client.get(f"{API_URL}/groups", headers=user_b.get_headers())
        if groups_b_resp.status_code != 200:
            raise Exception(f"Get groups for B failed: {groups_b_resp.status_code} - {groups_b_resp.text}")
        
        groups_b = groups_b_resp.json()
        found_group_b = any(g["id"] == group_id for g in groups_b)
        
        if not found_group_a:
            raise Exception("Group not found in user A's groups list")
        if not found_group_b:
            raise Exception("Group not found in user B's groups list")
        
        print(f"✅ Group appears in both users' groups lists")
        
        return group_id


async def test_rest_chat_history(user_a: TestUser, user_b: TestUser, group_id: str):
    """Test REST chat history for DM and group messages"""
    print("\n💬 Testing REST Chat History...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 8) REST chat history: POST /api/dm/{uB_id}/messages by uA then GET /api/dm/{uB_id}/messages by uB sees it
        dm_message_data = {"text": f"Hello {user_b.username}! This is a DM from {user_a.username}"}
        
        # Send DM from A to B
        send_dm_resp = await client.post(
            f"{API_URL}/dm/{user_b.user_id}/messages",
            json=dm_message_data,
            headers=user_a.get_headers()
        )
        if send_dm_resp.status_code != 200:
            raise Exception(f"Send DM failed: {send_dm_resp.status_code} - {send_dm_resp.text}")
        
        sent_message = send_dm_resp.json()
        print(f"✅ DM sent from {user_a.username} to {user_b.username}")
        
        # Get DM history from B's perspective
        get_dm_resp = await client.get(
            f"{API_URL}/dm/{user_a.user_id}/messages",
            headers=user_b.get_headers()
        )
        if get_dm_resp.status_code != 200:
            raise Exception(f"Get DM history failed: {get_dm_resp.status_code} - {get_dm_resp.text}")
        
        dm_history = get_dm_resp.json()
        found_message = any(
            msg["id"] == sent_message["id"] and msg["text"] == dm_message_data["text"]
            for msg in dm_history
        )
        
        if not found_message:
            raise Exception("Sent DM not found in message history")
        
        print(f"✅ DM appears in message history for {user_b.username}")
        
        # 9) REST group messages: POST /api/groups/{gid}/messages by uA then GET /api/groups/{gid}/messages by uB sees it
        group_message_data = {"text": f"Hello group! This is {user_a.username} speaking."}
        
        # Send group message from A
        send_group_resp = await client.post(
            f"{API_URL}/groups/{group_id}/messages",
            json=group_message_data,
            headers=user_a.get_headers()
        )
        if send_group_resp.status_code != 200:
            raise Exception(f"Send group message failed: {send_group_resp.status_code} - {send_group_resp.text}")
        
        sent_group_message = send_group_resp.json()
        print(f"✅ Group message sent by {user_a.username}")
        
        # Get group message history from B's perspective
        get_group_resp = await client.get(
            f"{API_URL}/groups/{group_id}/messages",
            headers=user_b.get_headers()
        )
        if get_group_resp.status_code != 200:
            raise Exception(f"Get group messages failed: {get_group_resp.status_code} - {get_group_resp.text}")
        
        group_history = get_group_resp.json()
        found_group_message = any(
            msg["id"] == sent_group_message["id"] and msg["text"] == group_message_data["text"]
            for msg in group_history
        )
        
        if not found_group_message:
            raise Exception("Sent group message not found in message history")
        
        print(f"✅ Group message appears in message history for {user_b.username}")


async def test_socketio_realtime(user_a: TestUser, user_b: TestUser, group_id: str):
    """Test Socket.IO realtime messaging"""
    print("\n🔌 Testing Socket.IO Realtime...")
    
    # 10) Socket.IO path: connect using socketio_path='api/socket.io'
    socketio_url = BASE_URL
    
    # Create socket clients for both users
    sio_a = socketio.AsyncClient()
    sio_b = socketio.AsyncClient()
    
    # Track received messages
    received_messages = {
        'user_a': [],
        'user_b': []
    }
    
    # Track connection events
    connection_events = {
        'user_a': {'connected': False, 'error': None},
        'user_b': {'connected': False, 'error': None}
    }
    
    @sio_a.event
    async def connect():
        connection_events['user_a']['connected'] = True
        print(f"🔗 User A Socket.IO connected")
    
    @sio_a.event
    async def connect_error(data):
        connection_events['user_a']['error'] = data
        print(f"❌ User A Socket.IO connection error: {data}")
    
    @sio_a.event
    async def dm_new(data):
        received_messages['user_a'].append(('dm:new', data))
        print(f"🔔 User A received dm:new: {data.get('text', 'N/A')[:50]}...")
    
    @sio_a.event
    async def group_new(data):
        received_messages['user_a'].append(('group:new', data))
        print(f"🔔 User A received group:new: {data.get('text', 'N/A')[:50]}...")
    
    @sio_b.event
    async def connect():
        connection_events['user_b']['connected'] = True
        print(f"🔗 User B Socket.IO connected")
    
    @sio_b.event
    async def connect_error(data):
        connection_events['user_b']['error'] = data
        print(f"❌ User B Socket.IO connection error: {data}")
    
    @sio_b.event
    async def dm_new(data):
        received_messages['user_b'].append(('dm:new', data))
        print(f"🔔 User B received dm:new: {data.get('text', 'N/A')[:50]}...")
    
    @sio_b.event
    async def group_new(data):
        received_messages['user_b'].append(('group:new', data))
        print(f"🔔 User B received group:new: {data.get('text', 'N/A')[:50]}...")
    
    try:
        # Connect both users with JWT auth
        print(f"🔌 Connecting User A to {socketio_url} with token {user_a.token[:20]}...")
        await sio_a.connect(
            socketio_url, 
            socketio_path='api/socket.io',
            auth={'token': user_a.token}
        )
        
        print(f"🔌 Connecting User B to {socketio_url} with token {user_b.token[:20]}...")
        await sio_b.connect(
            socketio_url, 
            socketio_path='api/socket.io',
            auth={'token': user_b.token}
        )
        
        # Wait for connections to stabilize
        await asyncio.sleep(2)
        
        # Check connection status
        if not connection_events['user_a']['connected']:
            raise Exception(f"User A failed to connect: {connection_events['user_a']['error']}")
        if not connection_events['user_b']['connected']:
            raise Exception(f"User B failed to connect: {connection_events['user_b']['error']}")
        
        print(f"✅ Both users connected to Socket.IO")
        
        # Test DM: verify dm:send produces dm:new to both
        dm_test_message = f"Socket.IO DM test from {user_a.username} at {datetime.now().isoformat()}"
        print(f"📤 Sending DM: {dm_test_message}")
        
        await sio_a.emit('dm:send', {
            'to_user_id': user_b.user_id,
            'text': dm_test_message
        })
        
        # Wait for message propagation
        await asyncio.sleep(3)
        
        print(f"📊 Messages received by User A: {len(received_messages['user_a'])}")
        print(f"📊 Messages received by User B: {len(received_messages['user_b'])}")
        
        # Check if both users received the DM
        user_a_got_dm = any(
            event == 'dm:new' and dm_test_message in data.get('text', '')
            for event, data in received_messages['user_a']
        )
        user_b_got_dm = any(
            event == 'dm:new' and dm_test_message in data.get('text', '')
            for event, data in received_messages['user_b']
        )
        
        if not user_a_got_dm:
            print(f"❌ User A messages: {received_messages['user_a']}")
            raise Exception("User A did not receive dm:new event for sent message")
        if not user_b_got_dm:
            print(f"❌ User B messages: {received_messages['user_b']}")
            raise Exception("User B did not receive dm:new event")
        
        print(f"✅ DM Socket.IO events working - both users received dm:new")
        
        # Test Group: verify group:join then group:send produces group:new to room
        # First, join the group room
        print(f"🏠 Joining group rooms for group {group_id}")
        await sio_a.emit('group:join', {'group_id': group_id})
        await sio_b.emit('group:join', {'group_id': group_id})
        
        # Wait for room joins
        await asyncio.sleep(2)
        
        # Send group message
        group_test_message = f"Socket.IO group test from {user_a.username} at {datetime.now().isoformat()}"
        print(f"📤 Sending group message: {group_test_message}")
        
        await sio_a.emit('group:send', {
            'group_id': group_id,
            'text': group_test_message
        })
        
        # Wait for message propagation
        await asyncio.sleep(3)
        
        # Check if both users received the group message
        user_a_got_group = any(
            event == 'group:new' and group_test_message in data.get('text', '')
            for event, data in received_messages['user_a']
        )
        user_b_got_group = any(
            event == 'group:new' and group_test_message in data.get('text', '')
            for event, data in received_messages['user_b']
        )
        
        if not user_a_got_group:
            print(f"❌ User A group messages: {[msg for msg in received_messages['user_a'] if msg[0] == 'group:new']}")
            raise Exception("User A did not receive group:new event for sent message")
        if not user_b_got_group:
            print(f"❌ User B group messages: {[msg for msg in received_messages['user_b'] if msg[0] == 'group:new']}")
            raise Exception("User B did not receive group:new event")
        
        print(f"✅ Group Socket.IO events working - both users received group:new")
        
    finally:
        # Clean up connections
        if sio_a.connected:
            await sio_a.disconnect()
        if sio_b.connected:
            await sio_b.disconnect()
        print("🔌 Socket.IO connections closed")


async def main():
    """Run all tests in sequence"""
    print("🚀 Starting Friends + Groups + Chat Backend Tests")
    print("=" * 60)
    
    try:
        # Test friends flow and get users
        user_a, user_b = await test_friends_flow()
        
        # Test groups flow and get group ID
        group_id = await test_groups_flow(user_a, user_b)
        
        # Test REST chat history
        await test_rest_chat_history(user_a, user_b, group_id)
        
        # Test Socket.IO realtime
        await test_socketio_realtime(user_a, user_b, group_id)
        
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED! Friends + Groups + Chat functionality is working correctly.")
        print("✅ User search, friend requests, acceptance, and friends list")
        print("✅ Group creation, joining, and listing")
        print("✅ REST DM and group message history")
        print("✅ Socket.IO realtime DM and group messaging")
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)