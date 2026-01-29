#!/usr/bin/env python3
"""
Backend Testing Suite for Moto GO App
Tests Socket.IO integration and existing HTTP endpoints
"""

import asyncio
import json
import random
import string
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional

import httpx
import socketio
import requests

# Configuration
BACKEND_URL = "https://riderzone-1.preview.emergentagent.com"
BASE_URL = f"{BACKEND_URL}/api"

def generate_random_credentials() -> Tuple[str, str]:
    """Generate random email and username to avoid collisions"""
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    email = f"testuser{random_suffix}@example.com"
    username = f"rider{random_suffix}"
    return email, username

def test_auth_register_new_user() -> Tuple[bool, Optional[str], Optional[str]]:
    """Test POST /api/auth/register with new random email+username - should return 200 and token"""
    print("\n🔍 Testing POST /api/auth/register (new user)...")
    
    email, username = generate_random_credentials()
    register_payload = {
        "email": email,
        "username": username,
        "password": "SecurePass123!"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=register_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Check for required fields in AuthToken response
            if "access_token" not in data or "token_type" not in data:
                print("❌ Missing required fields in auth response")
                return False, None, None
                
            if data.get("token_type") != "bearer":
                print("❌ Invalid token_type - expected 'bearer'")
                return False, None, None
                
            token = data.get("access_token")
            if not token or len(token) < 10:
                print("❌ Invalid or missing access_token")
                return False, None, None
                
            print(f"✅ User registration successful:")
            print(f"   - Email: {email}")
            print(f"   - Username: {username}")
            print(f"   - Token received: {token[:20]}...")
            
            return True, token, email
            
        else:
            print(f"❌ Registration failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None, None
            
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return False, None, None

def test_auth_register_duplicate_email(existing_email: str) -> bool:
    """Test POST /api/auth/register with existing email - should return 409"""
    print("\n🔍 Testing POST /api/auth/register (duplicate email)...")
    
    _, username = generate_random_credentials()  # New username but existing email
    register_payload = {
        "email": existing_email,
        "username": username,
        "password": "AnotherPass456!"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=register_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 409:
            print("✅ Duplicate email validation working - returned 409")
            return True
        else:
            print(f"❌ Expected 409 for duplicate email, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Duplicate email test error: {e}")
        return False

def test_auth_login_valid_credentials(email: str, password: str = "SecurePass123!") -> Tuple[bool, Optional[str]]:
    """Test POST /api/auth/login with correct credentials - should return token"""
    print("\n🔍 Testing POST /api/auth/login (valid credentials)...")
    
    login_payload = {
        "email": email,
        "password": password
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=login_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Check for required fields in AuthToken response
            if "access_token" not in data or "token_type" not in data:
                print("❌ Missing required fields in login response")
                return False, None
                
            if data.get("token_type") != "bearer":
                print("❌ Invalid token_type - expected 'bearer'")
                return False, None
                
            token = data.get("access_token")
            if not token or len(token) < 10:
                print("❌ Invalid or missing access_token")
                return False, None
                
            print(f"✅ Login successful:")
            print(f"   - Email: {email}")
            print(f"   - Token received: {token[:20]}...")
            
            return True, token
            
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False, None

def test_me_endpoint_no_token() -> bool:
    """Test GET /api/me without token - should return 401"""
    print("\n🔍 Testing GET /api/me (no token)...")
    
    try:
        response = requests.get(f"{BASE_URL}/me", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Authentication required - returned 401 without token")
            return True
        else:
            print(f"❌ Expected 401 without token, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ No token test error: {e}")
        return False

def test_me_endpoint_with_token(token: str, expected_email: str) -> bool:
    """Test GET /api/me with Bearer token - should return UserPublic fields (no password_hash)"""
    print("\n🔍 Testing GET /api/me (with Bearer token)...")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(f"{BASE_URL}/me", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Check for required UserPublic fields
            required_fields = [
                "id", "email", "username", "bio", "privacy", 
                "level", "km_total", "km_month", "created_at"
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Missing UserPublic fields: {missing_fields}")
                return False
                
            # Ensure password_hash is NOT present
            if "password_hash" in data:
                print("❌ SECURITY ISSUE: password_hash exposed in /api/me response")
                return False
                
            # Verify email matches
            if data.get("email") != expected_email:
                print(f"❌ Email mismatch - expected {expected_email}, got {data.get('email')}")
                return False
                
            print(f"✅ /api/me working correctly:")
            print(f"   - ID: {data.get('id')}")
            print(f"   - Email: {data.get('email')}")
            print(f"   - Username: {data.get('username')}")
            print(f"   - Level: {data.get('level')}")
            print(f"   - No password_hash exposed ✓")
            
            return True
            
        else:
            print(f"❌ /api/me failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ /api/me with token error: {e}")
        return False

def test_health_endpoint():
    """Test GET /api/health endpoint"""
    print("🔍 Testing GET /api/health...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            # Check required fields
            if data.get("ok") is True and data.get("db") == "up":
                print("✅ Health endpoint working correctly")
                return True
            else:
                print("❌ Health endpoint response format incorrect")
                return False
        else:
            print(f"❌ Health endpoint failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_root_endpoint():
    """Test GET /api/ (root) endpoint - smoke test"""
    print("\n🔍 Testing GET /api/ (root)...")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            print("✅ Root endpoint working")
            return True
        else:
            print(f"❌ Root endpoint failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
        return False

def test_create_route():
    """Test POST /api/routes with valid payload"""
    print("\n🔍 Testing POST /api/routes...")
    
    # Create a realistic route payload
    route_payload = {
        "title": "Transfăgărășan Adventure Route",
        "description": "Epic mountain ride through Romania's most famous road",
        "polyline": [
            [45.6042, 24.9668],  # Curtea de Argeș
            [45.5897, 24.9234],  # Intermediate point
            [45.6169, 24.6186]   # Bâlea Lake
        ],
        "rules": "Experienced riders only. Check weather conditions.",
        "difficulty": "hard",
        "participants_min": 2,
        "participants_max": 8,
        "fuel_price_per_l": 7.2,
        "bike_consumption_l_per_100km": 6.5,
        "toll_estimate": 15.0,
        "currency": "RON",
        "stops_count": 3,
        "use_google_directions": False
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/routes", 
            json=route_payload,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Verify RouteOut schema fields
            required_fields = [
                "id", "title", "description", "polyline", 
                "distance_km", "duration_min", "cost_estimate",
                "difficulty", "participants_min", "participants_max", "created_at"
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Missing fields in response: {missing_fields}")
                return False, None
                
            # Verify computed values exist
            if data.get("distance_km", 0) <= 0:
                print("❌ distance_km not computed correctly")
                return False, None
                
            if data.get("duration_min", 0) <= 0:
                print("❌ duration_min not computed correctly")
                return False, None
                
            cost_estimate = data.get("cost_estimate", {})
            if not isinstance(cost_estimate, dict) or "fuel" not in cost_estimate:
                print("❌ cost_estimate not computed correctly")
                return False, None
                
            print(f"✅ Route created successfully:")
            print(f"   - ID: {data['id']}")
            print(f"   - Distance: {data['distance_km']} km")
            print(f"   - Duration: {data['duration_min']} min")
            print(f"   - Cost: {cost_estimate}")
            
            return True, data["id"]
            
        else:
            print(f"❌ Route creation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Route creation error: {e}")
        return False, None

def test_route_validation():
    """Test POST /api/routes validation - participants_min > participants_max should return 400"""
    print("\n🔍 Testing POST /api/routes validation...")
    
    # Invalid payload with participants_min > participants_max
    invalid_payload = {
        "title": "Invalid Route",
        "description": "This should fail validation",
        "polyline": [
            [45.6042, 24.9668],
            [45.6169, 24.6186]
        ],
        "participants_min": 10,  # Greater than max
        "participants_max": 5    # Less than min
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/routes", 
            json=invalid_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 400:
            print("✅ Validation working correctly - returned 400 for invalid participants")
            return True
        else:
            print(f"❌ Validation failed - expected 400, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Validation test error: {e}")
        return False

def test_list_routes():
    """Test GET /api/routes"""
    print("\n🔍 Testing GET /api/routes...")
    
    try:
        response = requests.get(f"{BASE_URL}/routes", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Number of routes returned: {len(data)}")
            
            if isinstance(data, list):
                if len(data) > 0:
                    # Check first route structure
                    route = data[0]
                    required_fields = ["id", "title", "distance_km", "duration_min"]
                    missing_fields = [field for field in required_fields if field not in route]
                    
                    if missing_fields:
                        print(f"❌ Missing fields in route: {missing_fields}")
                        return False
                    
                    print(f"✅ Routes list working - found {len(data)} routes")
                    print(f"   - Sample route: {route.get('title', 'N/A')}")
                    return True
                else:
                    print("✅ Routes list working - empty list returned")
                    return True
            else:
                print("❌ Routes list should return an array")
                return False
        else:
            print(f"❌ Routes list failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Routes list error: {e}")
        return False

def test_create_event():
    """Test POST /api/events"""
    print("\n🔍 Testing POST /api/events...")
    
    # Create a realistic event payload
    future_time = datetime.utcnow() + timedelta(days=7)
    event_payload = {
        "title": "Transfăgărășan Group Ride",
        "description": "Join us for an epic mountain adventure on Romania's most scenic road",
        "start_point": [45.6042, 24.9668],  # Curtea de Argeș
        "start_time": future_time.isoformat() + "Z"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/events", 
            json=event_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Verify EventOut schema fields
            required_fields = [
                "id", "title", "description", "start_point", 
                "start_time", "created_at"
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ Missing fields in event response: {missing_fields}")
                return False, None
                
            print(f"✅ Event created successfully:")
            print(f"   - ID: {data['id']}")
            print(f"   - Title: {data['title']}")
            print(f"   - Start time: {data['start_time']}")
            
            return True, data["id"]
            
        else:
            print(f"❌ Event creation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Event creation error: {e}")
        return False, None

def test_list_events():
    """Test GET /api/events"""
    print("\n🔍 Testing GET /api/events...")
    
    try:
        response = requests.get(f"{BASE_URL}/events", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Number of events returned: {len(data)}")
            
            if isinstance(data, list):
                if len(data) > 0:
                    # Check first event structure
                    event = data[0]
                    required_fields = ["id", "title", "start_point", "start_time"]
                    missing_fields = [field for field in required_fields if field not in required_fields]
                    
                    if missing_fields:
                        print(f"❌ Missing fields in event: {missing_fields}")
                        return False
                    
                    print(f"✅ Events list working - found {len(data)} events")
                    print(f"   - Sample event: {event.get('title', 'N/A')}")
                    return True
                else:
                    print("✅ Events list working - empty list returned")
                    return True
            else:
                print("❌ Events list should return an array")
                return False
        else:
            print(f"❌ Events list failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Events list error: {e}")
        return False


async def test_socketio_handshake():
    """Test Socket.IO handshake endpoint with EIO=4"""
    print("\n🔍 Testing Socket.IO handshake endpoint...")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test Socket.IO handshake with EIO=4
            response = await client.get(f"{BACKEND_URL}/socket.io/?EIO=4&transport=polling")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                content = response.text
                print(f"Response content (first 100 chars): {content[:100]}")
                
                # Socket.IO handshake typically starts with "0{" containing session info
                if content.startswith("0{"):
                    try:
                        # Parse the handshake data
                        handshake_data = json.loads(content[1:])  # Remove the "0" prefix
                        print(f"Handshake data keys: {list(handshake_data.keys())}")
                        
                        # Check for required handshake fields
                        if "sid" in handshake_data:
                            print(f"✅ Socket.IO handshake successful - Session ID: {handshake_data['sid'][:10]}...")
                            return True
                        else:
                            print("❌ Invalid handshake - missing session ID")
                            return False
                    except json.JSONDecodeError:
                        print("❌ Invalid handshake - not valid JSON")
                        return False
                else:
                    print(f"❌ Invalid handshake format - expected to start with '0{{', got: {content[:20]}")
                    return False
            else:
                print(f"❌ Handshake failed with status {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Socket.IO handshake error: {e}")
        return False


async def test_socketio_connection_with_jwt(auth_token: str):
    """Test Socket.IO connection with JWT authentication and ping_test"""
    print("\n🔍 Testing Socket.IO JWT connection and ping_test...")
    
    if not auth_token:
        print("❌ No auth token available for Socket.IO test")
        return False
    
    try:
        # Create Socket.IO client
        sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        
        # Track connection and ping test results
        connection_success = False
        ping_test_success = False
        connection_error = None
        
        @sio.event
        async def connect():
            nonlocal connection_success
            connection_success = True
            print("✅ Socket.IO connected successfully with JWT")
            
        @sio.event
        async def connect_error(data):
            nonlocal connection_error
            connection_error = data
            print(f"❌ Socket.IO connection error: {data}")
            
        @sio.event
        async def pong_test(data):
            nonlocal ping_test_success
            print(f"📨 Received pong_test: {data}")
            if isinstance(data, dict) and data.get("ok") is True:
                ping_test_success = True
                print("✅ ping_test -> pong_test successful")
            else:
                print(f"❌ Invalid pong_test response: {data}")
        
        try:
            # Connect with JWT token in auth parameter
            print(f"🔌 Connecting to {BACKEND_URL} with JWT token...")
            await sio.connect(
                BACKEND_URL,
                auth={"token": auth_token},
                transports=['websocket', 'polling'],
                wait_timeout=10
            )
            
            # Wait for connection to establish
            await asyncio.sleep(2)
            
            if connection_success:
                print("✅ Socket.IO JWT authentication successful")
                
                # Test ping_test -> pong_test
                print("📤 Sending ping_test...")
                await sio.emit("ping_test", {"message": "test_ping", "timestamp": datetime.utcnow().isoformat()})
                
                # Wait for pong response
                await asyncio.sleep(3)
                
                if ping_test_success:
                    print("✅ Socket.IO ping_test -> pong_test working correctly")
                    return True
                else:
                    print("❌ Socket.IO ping_test failed - no pong_test response")
                    return False
            else:
                print(f"❌ Socket.IO connection failed - Error: {connection_error}")
                return False
                
        except Exception as e:
            print(f"❌ Socket.IO connection exception: {str(e)}")
            return False
            
        finally:
            try:
                if sio.connected:
                    await sio.disconnect()
                    print("🔌 Socket.IO disconnected")
            except:
                pass
                
    except Exception as e:
        print(f"❌ Socket.IO test setup error: {e}")
        return False


async def test_realtime_health():
    """Test /api/realtime/health endpoint"""
    print("\n🔍 Testing GET /api/realtime/health...")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{BASE_URL}/realtime/health")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {data}")
                
                if data.get("ok") is True:
                    print("✅ Realtime health endpoint working correctly")
                    return True
                else:
                    print(f"❌ Invalid realtime health response: {data}")
                    return False
            else:
                print(f"❌ Realtime health failed with status {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Realtime health error: {e}")
        return False


async def run_socketio_tests():
    """Run all Socket.IO related tests"""
    print("\n" + "🔌 SOCKET.IO INTEGRATION TESTS" + "\n" + "=" * 50)
    
    results = {}
    
    # Test 1: Socket.IO handshake endpoint
    results["socketio_handshake"] = await test_socketio_handshake()
    
    # Test 2: Realtime health endpoint
    results["realtime_health"] = await test_realtime_health()
    
    # Test 3: Get auth token for Socket.IO connection test
    print("\n🔐 Getting auth token for Socket.IO connection test...")
    email, username = generate_random_credentials()
    
    # Register or login to get token
    register_payload = {
        "email": email,
        "username": username,
        "password": "SocketIOTest123!"
    }
    
    auth_token = None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try to register
            response = await client.post(f"{BASE_URL}/auth/register", json=register_payload)
            if response.status_code == 200:
                data = response.json()
                auth_token = data.get("access_token")
                print(f"✅ Got auth token for Socket.IO test: {auth_token[:20]}...")
            elif response.status_code == 409:
                # User exists, try login
                login_payload = {"email": email, "password": "SocketIOTest123!"}
                response = await client.post(f"{BASE_URL}/auth/login", json=login_payload)
                if response.status_code == 200:
                    data = response.json()
                    auth_token = data.get("access_token")
                    print(f"✅ Got auth token via login: {auth_token[:20]}...")
    except Exception as e:
        print(f"❌ Failed to get auth token: {e}")
    
    # Test 4: Socket.IO connection with JWT and ping test
    if auth_token:
        results["socketio_jwt_connection"] = await test_socketio_connection_with_jwt(auth_token)
    else:
        results["socketio_jwt_connection"] = False
        print("❌ Skipping Socket.IO JWT test - no auth token")
    
    return results

def main():
    """Run all backend tests including JWT authentication and Socket.IO integration"""
    print("🚀 Starting Moto GO Backend API Tests")
    print(f"Testing against: {BASE_URL}")
    print("=" * 60)
    
    results = {}
    
    # Test basic endpoints first
    results["health"] = test_health_endpoint()
    results["root"] = test_root_endpoint()
    
    # Test JWT Authentication endpoints
    print("\n" + "🔐 JWT AUTHENTICATION TESTS" + "\n" + "=" * 40)
    
    # 1. Register new user
    register_success, token, email = test_auth_register_new_user()
    results["auth_register_new"] = register_success
    
    # 2. Try to register with same email (should fail with 409)
    if email:
        results["auth_register_duplicate"] = test_auth_register_duplicate_email(email)
    else:
        results["auth_register_duplicate"] = False
        print("❌ Skipping duplicate email test - no email from registration")
    
    # 3. Login with correct credentials
    if email:
        login_success, login_token = test_auth_login_valid_credentials(email)
        results["auth_login_valid"] = login_success
        # Use login token for /me test if available, otherwise use register token
        test_token = login_token if login_token else token
    else:
        results["auth_login_valid"] = False
        test_token = None
        print("❌ Skipping login test - no email from registration")
    
    # 4. Test /api/me without token (should return 401)
    results["me_no_token"] = test_me_endpoint_no_token()
    
    # 5. Test /api/me with Bearer token (should return UserPublic)
    if test_token and email:
        results["me_with_token"] = test_me_endpoint_with_token(test_token, email)
    else:
        results["me_with_token"] = False
        print("❌ Skipping /api/me with token test - no token available")
    
    # Test existing endpoints (regression testing)
    print("\n" + "🔄 REGRESSION TESTS" + "\n" + "=" * 40)
    results["create_route"] = test_create_route()[0]
    results["route_validation"] = test_route_validation()
    results["list_routes"] = test_list_routes()
    results["create_event"] = test_create_event()[0]
    results["list_events"] = test_list_events()
    
    # Run Socket.IO tests
    socketio_results = asyncio.run(run_socketio_tests())
    results.update(socketio_results)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    # Group results by category
    auth_tests = {
        "auth_register_new": "Register New User",
        "auth_register_duplicate": "Register Duplicate Email",
        "auth_login_valid": "Login Valid Credentials", 
        "me_no_token": "/api/me No Token",
        "me_with_token": "/api/me With Token"
    }
    
    regression_tests = {
        "health": "Health Endpoint",
        "root": "Root Endpoint",
        "create_route": "Create Route",
        "route_validation": "Route Validation",
        "list_routes": "List Routes",
        "create_event": "Create Event",
        "list_events": "List Events"
    }
    
    socketio_tests = {
        "socketio_handshake": "Socket.IO Handshake (EIO=4)",
        "realtime_health": "/api/realtime/health",
        "socketio_jwt_connection": "Socket.IO JWT + ping_test"
    }
    
    print("🔐 JWT Authentication Tests:")
    auth_passed = 0
    for test_key, test_name in auth_tests.items():
        result = results.get(test_key, False)
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name:<25} {status}")
        if result:
            auth_passed += 1
    
    print(f"\n🔄 Regression Tests:")
    regression_passed = 0
    for test_key, test_name in regression_tests.items():
        result = results.get(test_key, False)
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name:<25} {status}")
        if result:
            regression_passed += 1
    
    print(f"\n🔌 Socket.IO Integration Tests:")
    socketio_passed = 0
    for test_key, test_name in socketio_tests.items():
        result = results.get(test_key, False)
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name:<25} {status}")
        if result:
            socketio_passed += 1
    
    total_passed = auth_passed + regression_passed + socketio_passed
    total_tests = len(auth_tests) + len(regression_tests) + len(socketio_tests)
    
    print(f"\nOverall: {total_passed}/{total_tests} tests passed")
    print(f"  - JWT Auth: {auth_passed}/{len(auth_tests)} passed")
    print(f"  - Regression: {regression_passed}/{len(regression_tests)} passed")
    print(f"  - Socket.IO: {socketio_passed}/{len(socketio_tests)} passed")
    
    if total_passed == total_tests:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print("⚠️  Some backend tests FAILED!")
        return False

if __name__ == "__main__":
    main()