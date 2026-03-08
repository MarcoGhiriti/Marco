#!/usr/bin/env python3
"""
Backend API Testing for Moto GO - Places Autocomplete and Directions API
Testing the new Google Places integration endpoints as requested.
"""

import asyncio
import json
import os
from datetime import datetime

import httpx

# Get backend URL from frontend env
BACKEND_URL = "https://ride-start-gating.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def add_result(self, test_name: str, success: bool, details: str = ""):
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        if success:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        print(f"{'='*60}")
        
        if self.failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")


async def test_places_autocomplete_and_directions():
    """Test the new Places Autocomplete and Directions API endpoints."""
    results = TestResults()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Test 1: Login to get auth token
        print("🔐 Testing authentication...")
        try:
            login_response = await client.post(f"{BACKEND_URL}/auth/login", json={
                "email": "user1@example.com",
                "password": "Password123"
            })
            
            if login_response.status_code == 200:
                token_data = login_response.json()
                auth_token = token_data.get("access_token")
                if auth_token:
                    results.add_result("POST /api/auth/login", True, f"Got token: {auth_token[:20]}...")
                    headers = {"Authorization": f"Bearer {auth_token}"}
                else:
                    results.add_result("POST /api/auth/login", False, "No access_token in response")
                    return results
            else:
                results.add_result("POST /api/auth/login", False, f"Status {login_response.status_code}: {login_response.text}")
                return results
                
        except Exception as e:
            results.add_result("POST /api/auth/login", False, f"Exception: {str(e)}")
            return results
        
        # Test 2: Places Autocomplete
        print("\n🗺️  Testing Places Autocomplete...")
        try:
            autocomplete_response = await client.get(
                f"{BACKEND_URL}/places/autocomplete",
                params={"query": "Bucuresti"},
                headers=headers
            )
            
            if autocomplete_response.status_code == 200:
                autocomplete_data = autocomplete_response.json()
                if isinstance(autocomplete_data, list) and len(autocomplete_data) > 0:
                    first_result = autocomplete_data[0]
                    required_fields = ["place_id", "description", "main_text", "secondary_text"]
                    
                    if all(field in first_result for field in required_fields):
                        place_id = first_result["place_id"]
                        results.add_result("GET /api/places/autocomplete", True, 
                                         f"Found {len(autocomplete_data)} results, first place_id: {place_id}")
                    else:
                        missing = [f for f in required_fields if f not in first_result]
                        results.add_result("GET /api/places/autocomplete", False, 
                                         f"Missing fields in response: {missing}")
                        place_id = None
                else:
                    results.add_result("GET /api/places/autocomplete", False, 
                                     f"Expected non-empty list, got: {type(autocomplete_data)}")
                    place_id = None
            else:
                results.add_result("GET /api/places/autocomplete", False, 
                                 f"Status {autocomplete_response.status_code}: {autocomplete_response.text}")
                place_id = None
                
        except Exception as e:
            results.add_result("GET /api/places/autocomplete", False, f"Exception: {str(e)}")
            place_id = None
        
        # Test 3: Place Details (if we got a place_id)
        print("\n📍 Testing Place Details...")
        if place_id:
            try:
                details_response = await client.get(
                    f"{BACKEND_URL}/places/details",
                    params={"place_id": place_id},
                    headers=headers
                )
                
                if details_response.status_code == 200:
                    details_data = details_response.json()
                    required_fields = ["place_id", "name", "address", "lat", "lng"]
                    
                    if all(field in details_data for field in required_fields):
                        lat, lng = details_data["lat"], details_data["lng"]
                        results.add_result("GET /api/places/details", True, 
                                         f"Got coordinates: lat={lat}, lng={lng}, name='{details_data['name']}'")
                    else:
                        missing = [f for f in required_fields if f not in details_data]
                        results.add_result("GET /api/places/details", False, 
                                         f"Missing fields in response: {missing}")
                else:
                    results.add_result("GET /api/places/details", False, 
                                     f"Status {details_response.status_code}: {details_response.text}")
                    
            except Exception as e:
                results.add_result("GET /api/places/details", False, f"Exception: {str(e)}")
        else:
            results.add_result("GET /api/places/details", False, "Skipped - no place_id from autocomplete")
        
        # Test 4: Directions Route
        print("\n🛣️  Testing Directions Route...")
        try:
            directions_response = await client.get(
                f"{BACKEND_URL}/directions/route",
                params={
                    "origin_lat": 44.4268,
                    "origin_lng": 26.1025,
                    "dest_lat": 45.7489,
                    "dest_lng": 21.2087
                },
                headers=headers
            )
            
            if directions_response.status_code == 200:
                directions_data = directions_response.json()
                required_fields = ["polyline", "distance_km", "duration_min"]
                
                if all(field in directions_data for field in required_fields):
                    polyline = directions_data["polyline"]
                    distance = directions_data["distance_km"]
                    duration = directions_data["duration_min"]
                    
                    if isinstance(polyline, list) and len(polyline) > 0 and distance > 0:
                        results.add_result("GET /api/directions/route", True, 
                                         f"Got route: {len(polyline)} points, {distance}km, {duration}min")
                    else:
                        results.add_result("GET /api/directions/route", False, 
                                         f"Invalid data: polyline={len(polyline) if isinstance(polyline, list) else 'not list'}, distance={distance}")
                else:
                    missing = [f for f in required_fields if f not in directions_data]
                    results.add_result("GET /api/directions/route", False, 
                                     f"Missing fields in response: {missing}")
            else:
                results.add_result("GET /api/directions/route", False, 
                                 f"Status {directions_response.status_code}: {directions_response.text}")
                
        except Exception as e:
            results.add_result("GET /api/directions/route", False, f"Exception: {str(e)}")
        
        # Test 5: Route Creation with created_by field
        print("\n🛤️  Testing Route Creation...")
        try:
            route_payload = {
                "title": "Test Route from Places API",
                "description": "Testing route creation with polyline from directions",
                "polyline": [[44.4268, 26.1025], [45.7489, 21.2087]],
                "difficulty": "medium"
            }
            
            route_response = await client.post(
                f"{BACKEND_URL}/routes",
                json=route_payload,
                headers=headers
            )
            
            if route_response.status_code == 200:
                route_data = route_response.json()
                
                if "created_by" in route_data and route_data["created_by"]:
                    results.add_result("POST /api/routes", True, 
                                     f"Route created with created_by: {route_data['created_by']}, id: {route_data.get('id', 'N/A')}")
                else:
                    results.add_result("POST /api/routes", False, 
                                     "Route created but missing or empty created_by field")
            else:
                results.add_result("POST /api/routes", False, 
                                 f"Status {route_response.status_code}: {route_response.text}")
                
        except Exception as e:
            results.add_result("POST /api/routes", False, f"Exception: {str(e)}")
        
        # Test 6: Event Creation with created_by field
        print("\n🎉 Testing Event Creation...")
        try:
            event_payload = {
                "title": "Test Event from Places API",
                "description": "Testing event creation with start_point",
                "start_point": [44.4268, 26.1025],
                "start_time": "2025-07-01T10:00:00"
            }
            
            event_response = await client.post(
                f"{BACKEND_URL}/events",
                json=event_payload,
                headers=headers
            )
            
            if event_response.status_code == 200:
                event_data = event_response.json()
                
                if "created_by" in event_data and event_data["created_by"]:
                    results.add_result("POST /api/events", True, 
                                     f"Event created with created_by: {event_data['created_by']}, id: {event_data.get('id', 'N/A')}")
                else:
                    results.add_result("POST /api/events", False, 
                                     "Event created but missing or empty created_by field")
            else:
                results.add_result("POST /api/events", False, 
                                 f"Status {event_response.status_code}: {event_response.text}")
                
        except Exception as e:
            results.add_result("POST /api/events", False, f"Exception: {str(e)}")
    
    return results


async def main():
    """Run all tests and display results."""
    print("🚀 Starting Moto GO Places Autocomplete and Directions API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*60)
    
    results = await test_places_autocomplete_and_directions()
    results.summary()
    
    # Save detailed results
    with open("/app/test_results_places_api.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": results.passed + results.failed,
                "passed": results.passed,
                "failed": results.failed,
                "success_rate": f"{(results.passed / (results.passed + results.failed) * 100):.1f}%"
            },
            "results": results.results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/test_results_places_api.json")
    
    return results.failed == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)