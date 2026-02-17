#!/usr/bin/env python3
"""
Backend API Testing for Stories Feature
Tests the new Stories feature API endpoints with authentication.
"""

import json
import requests
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://profile-sync-14.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"

class StoriesAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token: Optional[str] = None
        self.headers: Dict[str, str] = {}
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate(self) -> bool:
        """Get JWT token using test credentials"""
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.headers = {"Authorization": f"Bearer {self.token}"}
                self.log_test("Authentication", True, f"Got JWT token")
                return True
            else:
                self.log_test("Authentication", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_create_story(self, caption: str = "Test story caption") -> Optional[str]:
        """Test POST /api/stories - Create a new story"""
        try:
            payload = {
                "media_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
                "media_type": "image",
                "caption": caption
            }
            
            response = requests.post(
                f"{self.base_url}/stories",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "owner_id", "owner_username", "media_base64", "media_type", "caption", "created_at", "expires_at"]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log_test("Create Story", False, f"Missing fields: {missing_fields}")
                    return None
                
                # Verify data types and values
                if data["media_type"] != "image":
                    self.log_test("Create Story", False, f"Wrong media_type: {data['media_type']}")
                    return None
                    
                if data["caption"] != caption:
                    self.log_test("Create Story", False, f"Wrong caption: {data['caption']}")
                    return None
                
                self.log_test("Create Story", True, f"Story created with ID: {data['id']}")
                return data["id"]
            else:
                self.log_test("Create Story", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Story", False, f"Exception: {str(e)}")
            return None
    
    def test_get_stories(self) -> bool:
        """Test GET /api/stories - Get all active stories"""
        try:
            response = requests.get(
                f"{self.base_url}/stories",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_test("Get Stories", False, f"Response is not a list: {type(data)}")
                    return False
                
                if len(data) == 0:
                    self.log_test("Get Stories", True, "No stories found (empty list)")
                    return True
                
                # Verify StoryOwner structure
                for story_owner in data:
                    required_owner_fields = ["user_id", "username", "profile_photo", "stories"]
                    missing_fields = [field for field in required_owner_fields if field not in story_owner]
                    if missing_fields:
                        self.log_test("Get Stories", False, f"Missing StoryOwner fields: {missing_fields}")
                        return False
                    
                    # Verify stories array
                    stories = story_owner["stories"]
                    if not isinstance(stories, list):
                        self.log_test("Get Stories", False, f"Stories is not a list: {type(stories)}")
                        return False
                    
                    # Verify individual story structure
                    for story in stories:
                        required_story_fields = ["id", "owner_id", "owner_username", "media_base64", "media_type", "caption", "created_at", "expires_at"]
                        missing_story_fields = [field for field in required_story_fields if field not in story]
                        if missing_story_fields:
                            self.log_test("Get Stories", False, f"Missing story fields: {missing_story_fields}")
                            return False
                
                self.log_test("Get Stories", True, f"Found {len(data)} story owners with proper structure")
                return True
            else:
                self.log_test("Get Stories", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Stories", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_story(self, story_id: str) -> bool:
        """Test DELETE /api/stories/{id} - Delete own story"""
        try:
            response = requests.delete(
                f"{self.base_url}/stories/{story_id}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") == True:
                    self.log_test("Delete Story", True, f"Story {story_id} deleted successfully")
                    return True
                else:
                    self.log_test("Delete Story", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Delete Story", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Story", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_invalid_story(self) -> bool:
        """Test DELETE /api/stories/{id} with invalid ID - Expect 404"""
        try:
            invalid_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
            response = requests.delete(
                f"{self.base_url}/stories/{invalid_id}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 404:
                self.log_test("Delete Invalid Story", True, "Got expected 404 for non-existent story")
                return True
            else:
                self.log_test("Delete Invalid Story", False, f"Expected 404, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Invalid Story", False, f"Exception: {str(e)}")
            return False
    
    def test_regression_endpoints(self) -> bool:
        """Test existing endpoints to ensure they still work"""
        endpoints_to_test = [
            ("/", "GET", "Root endpoint"),
            ("/health", "GET", "Health check"),
            ("/routes", "GET", "Routes list"),
            ("/events", "GET", "Events list"),
            ("/me", "GET", "User profile")
        ]
        
        all_passed = True
        
        for endpoint, method, description in endpoints_to_test:
            try:
                if method == "GET":
                    # Use auth headers for protected endpoints
                    headers = self.headers if endpoint in ["/routes", "/events", "/me"] else {}
                    response = requests.get(f"{self.base_url}{endpoint}", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    self.log_test(f"Regression - {description}", True, f"Status: {response.status_code}")
                else:
                    self.log_test(f"Regression - {description}", False, f"Status: {response.status_code}, Response: {response.text}")
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"Regression - {description}", False, f"Exception: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self):
        """Run all Stories API tests"""
        print("🚀 Starting Stories Feature API Testing")
        print("=" * 50)
        
        # Step 1: Authentication
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Create first story
        print("\n📝 Testing Story Creation...")
        story_id_1 = self.test_create_story("Test story caption")
        if not story_id_1:
            print("❌ First story creation failed. Cannot proceed with remaining tests.")
            return False
        
        # Step 3: Get stories (should show 1 story)
        print("\n📖 Testing Get Stories...")
        self.test_get_stories()
        
        # Step 4: Create second story
        print("\n📝 Testing Second Story Creation...")
        story_id_2 = self.test_create_story("Second test story")
        
        # Step 5: Get stories again (should show 2 stories for same owner)
        print("\n📖 Testing Get Stories (after second story)...")
        self.test_get_stories()
        
        # Step 6: Delete first story
        print("\n🗑️ Testing Story Deletion...")
        if story_id_1:
            self.test_delete_story(story_id_1)
        
        # Step 7: Verify story no longer appears
        print("\n📖 Testing Get Stories (after deletion)...")
        self.test_get_stories()
        
        # Step 8: Test delete with invalid ID
        print("\n🗑️ Testing Delete Invalid Story...")
        self.test_delete_invalid_story()
        
        # Step 9: Regression tests
        print("\n🔄 Running Regression Tests...")
        self.test_regression_endpoints()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Stories feature is working correctly.")
            return True
        else:
            print(f"\n⚠️ {total - passed} tests failed. Please check the issues above.")
            return False

def main():
    """Main test runner"""
    tester = StoriesAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()