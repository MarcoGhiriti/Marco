#!/usr/bin/env python3
"""
Backend API Testing for Moto GO App
Tests all backend endpoints according to the review request
"""

import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any

# Use the backend URL from frontend .env
BASE_URL = "https://riderzone-1.preview.emergentagent.com/api"

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

def main():
    """Run all backend tests"""
    print("🚀 Starting Moto GO Backend API Tests")
    print(f"Testing against: {BASE_URL}")
    print("=" * 60)
    
    results = {}
    
    # Test all endpoints
    results["health"] = test_health_endpoint()
    results["root"] = test_root_endpoint()
    results["create_route"] = test_create_route()[0]
    results["route_validation"] = test_route_validation()
    results["list_routes"] = test_list_routes()
    results["create_event"] = test_create_event()[0]
    results["list_events"] = test_list_events()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.upper():<20} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print("⚠️  Some backend tests FAILED!")
        return False

if __name__ == "__main__":
    main()