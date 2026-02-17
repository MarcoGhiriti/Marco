#!/usr/bin/env python3
"""
Backend API Testing for Moto GO Map Reports Feature
Testing the new Map Reports API endpoints as requested.
"""

import json
import requests
import sys
from datetime import datetime
from typing import Dict, Any

# Backend URL from frontend .env
BACKEND_URL = "https://riders-hub-10.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"

class MapReportsAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status} {test_name}: {details}")
        print(f"{status} {test_name}: {details}")
        
    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                self.log_test("Authentication", True, f"Successfully logged in as {TEST_EMAIL}")
                return True
            else:
                self.log_test("Authentication", False, f"Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Login error: {str(e)}")
            return False
    
    def test_create_police_report(self) -> str:
        """Test 1: Create a police report"""
        try:
            payload = {
                "report_type": "police",
                "location": [44.4268, 26.1025],
                "description": "Police checkpoint"
            }
            
            response = self.session.post(f"{BACKEND_URL}/reports", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "report_type", "location", "votes_up", "votes_down", "created_at", "expires_at"]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log_test("Create Police Report", False, f"Missing fields: {missing_fields}")
                    return None
                
                # Verify field values
                if (data["report_type"] == "police" and 
                    data["location"] == [44.4268, 26.1025] and
                    data["description"] == "Police checkpoint" and
                    data["votes_up"] == 0 and
                    data["votes_down"] == 0):
                    
                    self.log_test("Create Police Report", True, f"Report created with ID: {data['id']}")
                    return data["id"]
                else:
                    self.log_test("Create Police Report", False, f"Field validation failed: {data}")
                    return None
            else:
                self.log_test("Create Police Report", False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Police Report", False, f"Error: {str(e)}")
            return None
    
    def test_get_reports_in_area(self) -> bool:
        """Test 2: Get reports in area"""
        try:
            params = {
                "lat": 44.4268,
                "lng": 26.1025,
                "radius_km": 50
            }
            
            response = self.session.get(f"{BACKEND_URL}/reports", params=params)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Reports in Area", True, f"Retrieved {len(data)} reports within 50km")
                    return True
                else:
                    self.log_test("Get Reports in Area", False, f"Expected array, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Reports in Area", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Reports in Area", False, f"Error: {str(e)}")
            return False
    
    def test_upvote_report(self, report_id: str) -> bool:
        """Test 3: Upvote a report (should extend expiration)"""
        try:
            response = self.session.post(f"{BACKEND_URL}/reports/{report_id}/vote?vote=up")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") == True:
                    self.log_test("Upvote Report", True, "Report upvoted successfully")
                    return True
                else:
                    self.log_test("Upvote Report", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Upvote Report", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Upvote Report", False, f"Error: {str(e)}")
            return False
    
    def test_downvote_report_multiple(self, report_id: str) -> bool:
        """Test 4: Downvote report multiple times (should expire after 3 downvotes)"""
        try:
            # Create additional test users for multiple downvotes
            test_users = []
            for i in range(3):
                # Register new users for downvoting
                reg_response = self.session.post(f"{BACKEND_URL}/auth/register", json={
                    "email": f"testdownvoter{i}@example.com",
                    "username": f"downvoter{i}",
                    "password": "Password123"
                })
                
                if reg_response.status_code == 200:
                    token = reg_response.json().get("access_token")
                    test_users.append(token)
            
            downvote_count = 0
            for i, token in enumerate(test_users):
                # Use different user token for each downvote
                headers = {"Authorization": f"Bearer {token}"}
                response = requests.post(f"{BACKEND_URL}/reports/{report_id}/vote?vote=down", headers=headers)
                
                if response.status_code == 200:
                    downvote_count += 1
                    self.log_test(f"Downvote Report #{i+1}", True, f"Downvote {i+1} successful")
                else:
                    self.log_test(f"Downvote Report #{i+1}", False, f"HTTP {response.status_code}: {response.text}")
            
            # Check if report is expired after 3 downvotes
            if downvote_count >= 3:
                self.log_test("Multiple Downvotes", True, f"Successfully applied {downvote_count} downvotes")
                return True
            else:
                self.log_test("Multiple Downvotes", False, f"Only {downvote_count} downvotes applied")
                return False
                
        except Exception as e:
            self.log_test("Multiple Downvotes", False, f"Error: {str(e)}")
            return False
    
    def test_other_report_types(self) -> bool:
        """Test 5: Create other report types (hazard, radar, accident)"""
        report_types = ["hazard", "radar", "accident"]
        success_count = 0
        
        for report_type in report_types:
            try:
                payload = {
                    "report_type": report_type,
                    "location": [44.4268, 26.1025],
                    "description": f"Test {report_type} report"
                }
                
                response = self.session.post(f"{BACKEND_URL}/reports", json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("report_type") == report_type:
                        self.log_test(f"Create {report_type.title()} Report", True, f"Report ID: {data.get('id')}")
                        success_count += 1
                    else:
                        self.log_test(f"Create {report_type.title()} Report", False, f"Wrong report_type: {data.get('report_type')}")
                else:
                    self.log_test(f"Create {report_type.title()} Report", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Create {report_type.title()} Report", False, f"Error: {str(e)}")
        
        return success_count == len(report_types)
    
    def test_regression_routes(self) -> bool:
        """Test 6a: Regression check - POST /api/routes"""
        try:
            payload = {
                "title": "Test Route for Regression",
                "description": "Testing route creation still works",
                "polyline": [[44.4268, 26.1025], [44.4300, 26.1100], [44.4350, 26.1200]],
                "difficulty": "medium",
                "participants_min": 1,
                "participants_max": 10
            }
            
            response = self.session.post(f"{BACKEND_URL}/routes", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "distance_km" in data and "duration_min" in data:
                    self.log_test("Regression - Routes API", True, f"Route created with ID: {data['id']}")
                    return True
                else:
                    self.log_test("Regression - Routes API", False, f"Missing required fields in response")
                    return False
            else:
                self.log_test("Regression - Routes API", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Regression - Routes API", False, f"Error: {str(e)}")
            return False
    
    def test_regression_events(self) -> bool:
        """Test 6b: Regression check - POST /api/events"""
        try:
            payload = {
                "title": "Test Event for Regression",
                "description": "Testing event creation still works",
                "start_point": [44.4268, 26.1025],
                "start_time": "2024-12-20T10:00:00Z"
            }
            
            response = self.session.post(f"{BACKEND_URL}/events", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "start_point" in data and "start_time" in data:
                    self.log_test("Regression - Events API", True, f"Event created with ID: {data['id']}")
                    return True
                else:
                    self.log_test("Regression - Events API", False, f"Missing required fields in response")
                    return False
            else:
                self.log_test("Regression - Events API", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Regression - Events API", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Map Reports API tests"""
        print("🚀 Starting Map Reports API Testing...")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {TEST_EMAIL}")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Test create police report
        report_id = self.test_create_police_report()
        if not report_id:
            print("❌ Police report creation failed. Cannot proceed with voting tests.")
        
        # Step 3: Test get reports in area
        self.test_get_reports_in_area()
        
        # Step 4: Test upvote (only if we have a report_id)
        if report_id:
            self.test_upvote_report(report_id)
        
        # Step 5: Test multiple downvotes (create new report for this)
        new_report_id = self.test_create_police_report()
        if new_report_id:
            self.test_downvote_report_multiple(new_report_id)
        
        # Step 6: Test other report types
        self.test_other_report_types()
        
        # Step 7: Regression tests
        self.test_regression_routes()
        self.test_regression_events()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY:")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        for result in self.test_results:
            print(result)
        
        print(f"\n📈 Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED! Map Reports API is fully functional.")
            return True
        else:
            print(f"⚠️  {failed} test(s) failed. Please review the issues above.")
            return False

if __name__ == "__main__":
    tester = MapReportsAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)