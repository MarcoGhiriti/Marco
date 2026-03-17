#!/usr/bin/env python3
"""
Backend Smoke Test for Moto GO API
Tests the specific API behaviors requested in the review:
1. POST /api/auth/login returns access token
2. POST /api/routes with meeting_point payload succeeds and returns HTTP 201
3. GET /api/routes/my includes meeting_point and start_radius_km
4. DELETE /api/routes/{id} cleans up the temporary route
5. Confirm no regression in GET /api/routes
"""

import json
import requests
import sys
from datetime import datetime
from typing import Dict, Any

# API Base URL from frontend .env
BASE_URL = "https://search-suggestions.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"

class MotoGoTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.access_token = None
        self.headers = {"Content-Type": "application/json"}
        self.created_route_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None, expected_status: int = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"{method.upper()} {endpoint} -> {response.status_code}")
            
            if expected_status and response.status_code != expected_status:
                self.log(f"Expected status {expected_status}, got {response.status_code}", "ERROR")
                self.log(f"Response: {response.text[:500]}", "ERROR")
                
            return response
            
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}", "ERROR")
            raise
            
    def test_login(self) -> bool:
        """Test 1: POST /api/auth/login returns access token"""
        self.log("🔐 Testing login endpoint...")
        
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Login failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if "access_token" not in data:
                self.log("❌ Login response missing access_token", "ERROR")
                return False
                
            self.access_token = data["access_token"]
            self.log(f"✅ Login successful - token: {self.access_token[:20]}...")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Login response not valid JSON", "ERROR")
            return False
            
    def test_create_route_with_meeting_point(self) -> bool:
        """Test 2: POST /api/routes with meeting_point payload succeeds and returns HTTP 201"""
        self.log("🛣️  Testing route creation with meeting point...")
        
        # Create a test route with meeting point and polyline
        route_data = {
            "title": "Test Route with Meeting Point",
            "description": "Backend smoke test route with meeting point",
            "polyline": [
                [44.4268, 26.1025],  # Bucharest start
                [44.4500, 26.1200],  # Intermediate point
                [44.4800, 26.1500]   # End point
            ],
            "meeting_point": {
                "lat": 44.4268,
                "lng": 26.1025,
                "name": "Central Meeting Point",
                "address": "Piața Universității, București, Romania"
            },
            "start_radius_km": 3.5,
            "difficulty": "medium",
            "participants_min": 2,
            "participants_max": 8,
            "fuel_price_per_l": 7.2,
            "bike_consumption_l_per_100km": 5.5,
            "toll_estimate": 0.0,
            "currency": "RON"
        }
        
        response = self.make_request("POST", "/routes", route_data, expected_status=201)
        
        if response.status_code != 201:
            self.log("❌ Route creation failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if "id" not in data:
                self.log("❌ Route creation response missing id", "ERROR")
                return False
                
            self.created_route_id = data["id"]
            
            # Verify meeting_point is in response
            if "meeting_point" not in data or not data["meeting_point"]:
                self.log("❌ Route response missing meeting_point", "ERROR")
                return False
                
            meeting_point = data["meeting_point"]
            if not all(key in meeting_point for key in ["lat", "lng", "name", "address"]):
                self.log("❌ Meeting point missing required fields", "ERROR")
                return False
                
            # Verify start_radius_km is in response
            if "start_radius_km" not in data:
                self.log("❌ Route response missing start_radius_km", "ERROR")
                return False
                
            if data["start_radius_km"] != 3.5:
                self.log(f"❌ start_radius_km mismatch: expected 3.5, got {data['start_radius_km']}", "ERROR")
                return False
                
            self.log(f"✅ Route created successfully - ID: {self.created_route_id}")
            self.log(f"✅ Meeting point verified: {meeting_point['name']} at ({meeting_point['lat']}, {meeting_point['lng']})")
            self.log(f"✅ Start radius verified: {data['start_radius_km']} km")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Route creation response not valid JSON", "ERROR")
            return False
            
    def test_get_my_routes(self) -> bool:
        """Test 3: GET /api/routes/my includes meeting_point and start_radius_km"""
        self.log("📋 Testing get my routes endpoint...")
        
        response = self.make_request("GET", "/routes/my", expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Get my routes failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if not isinstance(data, list):
                self.log("❌ My routes response not a list", "ERROR")
                return False
                
            # Find our created route
            created_route = None
            for route in data:
                if route.get("id") == self.created_route_id:
                    created_route = route
                    break
                    
            if not created_route:
                self.log("❌ Created route not found in my routes", "ERROR")
                return False
                
            # Verify meeting_point is present and populated
            if "meeting_point" not in created_route or not created_route["meeting_point"]:
                self.log("❌ Meeting point missing from my routes response", "ERROR")
                return False
                
            meeting_point = created_route["meeting_point"]
            expected_fields = ["lat", "lng", "name", "address"]
            if not all(key in meeting_point for key in expected_fields):
                self.log(f"❌ Meeting point missing fields: {expected_fields}", "ERROR")
                return False
                
            # Verify start_radius_km is present
            if "start_radius_km" not in created_route:
                self.log("❌ start_radius_km missing from my routes response", "ERROR")
                return False
                
            if created_route["start_radius_km"] != 3.5:
                self.log(f"❌ start_radius_km mismatch in my routes: expected 3.5, got {created_route['start_radius_km']}", "ERROR")
                return False
                
            self.log(f"✅ My routes endpoint working - found route: {created_route['title']}")
            self.log(f"✅ Meeting point present: {meeting_point['name']}")
            self.log(f"✅ Start radius present: {created_route['start_radius_km']} km")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ My routes response not valid JSON", "ERROR")
            return False
            
    def test_get_all_routes(self) -> bool:
        """Test 5: Confirm no regression in GET /api/routes"""
        self.log("🌍 Testing get all routes endpoint...")
        
        response = self.make_request("GET", "/routes", expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Get all routes failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if not isinstance(data, list):
                self.log("❌ All routes response not a list", "ERROR")
                return False
                
            # Find our created route in the list
            found_route = None
            for route in data:
                if route.get("id") == self.created_route_id:
                    found_route = route
                    break
                    
            if not found_route:
                self.log("❌ Created route not visible in all routes", "ERROR")
                return False
                
            # Verify basic route structure
            required_fields = [
                "id", "title", "description", "polyline", 
                "meeting_point", "start_radius_km", "distance_km", 
                "duration_min", "participants_count", "created_by"
            ]
            
            for field in required_fields:
                if field not in found_route:
                    self.log(f"❌ Route missing required field: {field}", "ERROR")
                    return False
                    
            # Verify meeting_point structure
            meeting_point = found_route["meeting_point"]
            if not meeting_point or not isinstance(meeting_point, dict):
                self.log("❌ Meeting point not properly structured in all routes", "ERROR")
                return False
                
            self.log(f"✅ All routes endpoint working - found {len(data)} routes")
            self.log(f"✅ Created route visible with meeting point: {meeting_point.get('name', 'N/A')}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ All routes response not valid JSON", "ERROR")
            return False
            
    def test_delete_route(self) -> bool:
        """Test 4: DELETE /api/routes/{id} cleans up the temporary route"""
        self.log("🗑️  Testing route deletion...")
        
        if not self.created_route_id:
            self.log("❌ No route ID to delete", "ERROR")
            return False
            
        response = self.make_request("DELETE", f"/routes/{self.created_route_id}", expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Route deletion failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if not data.get("ok"):
                self.log("❌ Route deletion response not indicating success", "ERROR")
                return False
                
            # Verify route is actually deleted by trying to fetch it in my routes
            verify_response = self.make_request("GET", "/routes/my")
            if verify_response.status_code == 200:
                routes = verify_response.json()
                for route in routes:
                    if route.get("id") == self.created_route_id:
                        self.log("❌ Route still exists after deletion", "ERROR")
                        return False
                        
            self.log(f"✅ Route deleted successfully - ID: {self.created_route_id}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Route deletion response not valid JSON", "ERROR")
            return False
            
    def run_all_tests(self) -> bool:
        """Run all smoke tests in order"""
        self.log("🚀 Starting Moto GO Backend Smoke Tests")
        self.log(f"🔗 API Base URL: {self.base_url}")
        
        tests = [
            ("Login", self.test_login),
            ("Create Route with Meeting Point", self.test_create_route_with_meeting_point),
            ("Get My Routes", self.test_get_my_routes),
            ("Get All Routes", self.test_get_all_routes),
            ("Delete Route", self.test_delete_route),
        ]
        
        results = {}
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            try:
                results[test_name] = test_func()
            except Exception as e:
                self.log(f"❌ {test_name} failed with exception: {e}", "ERROR")
                results[test_name] = False
                
        # Summary
        self.log("\n" + "="*50)
        self.log("📊 TEST SUMMARY")
        self.log("="*50)
        
        passed = 0
        total = len(tests)
        
        for test_name, passed_test in results.items():
            status = "✅ PASS" if passed_test else "❌ FAIL"
            self.log(f"{status}: {test_name}")
            if passed_test:
                passed += 1
                
        self.log(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All tests passed! Backend API is working correctly.")
            return True
        else:
            self.log(f"⚠️  {total - passed} test(s) failed. Check logs above.")
            return False

def main():
    """Main entry point"""
    tester = MotoGoTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()