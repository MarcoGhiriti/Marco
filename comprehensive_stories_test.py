#!/usr/bin/env python3
"""
Comprehensive Stories Feature Testing - Exact Review Request Scenarios
Tests all scenarios mentioned in the review request with detailed verification.
"""

import json
import requests
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://map-ui-refresh-1.preview.emergentagent.com/api"

# Test credentials from review request
TEST_EMAIL = "user1@example.com"
TEST_PASSWORD = "Password123"

class ComprehensiveStoriesTester:
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
            print(f"   {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate(self) -> bool:
        """Get JWT token using exact credentials from review request"""
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
                self.log_test("Authentication with user1@example.com / Password123", True, f"JWT token acquired")
                return True
            else:
                self.log_test("Authentication with user1@example.com / Password123", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication with user1@example.com / Password123", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_1_create_story(self) -> Optional[str]:
        """
        Scenario 1: POST /api/stories - Create a new story with:
        - media_base64: "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
        - media_type: "image"
        - caption: "Test story caption"
        Expect: 200 with story object containing id, owner_id, owner_username, media_base64, media_type, caption, created_at, expires_at
        """
        try:
            payload = {
                "media_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
                "media_type": "image",
                "caption": "Test story caption"
            }
            
            response = requests.post(
                f"{self.base_url}/stories",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check all required fields from review request
                required_fields = ["id", "owner_id", "owner_username", "media_base64", "media_type", "caption", "created_at", "expires_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Scenario 1: POST /api/stories", False, f"Missing required fields: {missing_fields}")
                    return None
                
                # Verify exact values match request
                if data["media_base64"] != payload["media_base64"]:
                    self.log_test("Scenario 1: POST /api/stories", False, f"media_base64 mismatch")
                    return None
                    
                if data["media_type"] != payload["media_type"]:
                    self.log_test("Scenario 1: POST /api/stories", False, f"media_type mismatch: expected '{payload['media_type']}', got '{data['media_type']}'")
                    return None
                    
                if data["caption"] != payload["caption"]:
                    self.log_test("Scenario 1: POST /api/stories", False, f"caption mismatch: expected '{payload['caption']}', got '{data['caption']}'")
                    return None
                
                # Verify data types
                if not isinstance(data["id"], str) or not data["id"]:
                    self.log_test("Scenario 1: POST /api/stories", False, f"Invalid id field: {data['id']}")
                    return None
                
                if not isinstance(data["owner_id"], str) or not data["owner_id"]:
                    self.log_test("Scenario 1: POST /api/stories", False, f"Invalid owner_id field: {data['owner_id']}")
                    return None
                
                if not isinstance(data["owner_username"], str) or not data["owner_username"]:
                    self.log_test("Scenario 1: POST /api/stories", False, f"Invalid owner_username field: {data['owner_username']}")
                    return None
                
                # Verify datetime fields
                try:
                    datetime.fromisoformat(data["created_at"].replace('Z', '+00:00'))
                    datetime.fromisoformat(data["expires_at"].replace('Z', '+00:00'))
                except ValueError as e:
                    self.log_test("Scenario 1: POST /api/stories", False, f"Invalid datetime format: {e}")
                    return None
                
                self.log_test("Scenario 1: POST /api/stories", True, f"Story created successfully with ID: {data['id']}, owner: {data['owner_username']}")
                return data["id"]
            else:
                self.log_test("Scenario 1: POST /api/stories", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Scenario 1: POST /api/stories", False, f"Exception: {str(e)}")
            return None
    
    def test_scenario_2_get_stories(self) -> bool:
        """
        Scenario 2: GET /api/stories - Get all active stories
        Should return array of StoryOwner objects
        Each StoryOwner has: user_id, username, profile_photo, stories[]
        stories[] contains individual story objects with full details
        Own stories should appear first
        """
        try:
            response = requests.get(
                f"{self.base_url}/stories",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_test("Scenario 2: GET /api/stories", False, f"Response is not an array: {type(data)}")
                    return False
                
                if len(data) == 0:
                    self.log_test("Scenario 2: GET /api/stories", True, "No stories found (empty array)")
                    return True
                
                # Verify StoryOwner structure
                for i, story_owner in enumerate(data):
                    # Check required StoryOwner fields
                    required_owner_fields = ["user_id", "username", "profile_photo", "stories"]
                    missing_fields = [field for field in required_owner_fields if field not in story_owner]
                    if missing_fields:
                        self.log_test("Scenario 2: GET /api/stories", False, f"StoryOwner {i} missing fields: {missing_fields}")
                        return False
                    
                    # Verify stories array
                    stories = story_owner["stories"]
                    if not isinstance(stories, list):
                        self.log_test("Scenario 2: GET /api/stories", False, f"StoryOwner {i} stories is not an array: {type(stories)}")
                        return False
                    
                    # Verify individual story structure
                    for j, story in enumerate(stories):
                        required_story_fields = ["id", "owner_id", "owner_username", "media_base64", "media_type", "caption", "created_at", "expires_at"]
                        missing_story_fields = [field for field in required_story_fields if field not in story]
                        if missing_story_fields:
                            self.log_test("Scenario 2: GET /api/stories", False, f"Story {j} in StoryOwner {i} missing fields: {missing_story_fields}")
                            return False
                
                # Check if own stories appear first (if we have multiple owners)
                if len(data) > 1:
                    # Get current user info to verify own stories are first
                    me_response = requests.get(f"{self.base_url}/me", headers=self.headers)
                    if me_response.status_code == 200:
                        me_data = me_response.json()
                        my_user_id = me_data.get("id")
                        
                        first_owner = data[0]
                        if first_owner["user_id"] == my_user_id:
                            self.log_test("Scenario 2: GET /api/stories", True, f"Own stories appear first. Found {len(data)} story owners with proper StoryOwner structure")
                        else:
                            self.log_test("Scenario 2: GET /api/stories", False, f"Own stories should appear first, but first owner is {first_owner['user_id']} (expected {my_user_id})")
                            return False
                    else:
                        self.log_test("Scenario 2: GET /api/stories", True, f"Found {len(data)} story owners with proper StoryOwner structure (couldn't verify order)")
                else:
                    self.log_test("Scenario 2: GET /api/stories", True, f"Found {len(data)} story owner with proper StoryOwner structure")
                
                return True
            else:
                self.log_test("Scenario 2: GET /api/stories", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 2: GET /api/stories", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_3_create_second_story(self) -> Optional[str]:
        """
        Scenario 3: POST /api/stories again - Create a second story
        Different caption
        Verify GET /api/stories returns 2 stories for the same owner
        """
        try:
            payload = {
                "media_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
                "media_type": "image",
                "caption": "Second test story with different caption"
            }
            
            response = requests.post(
                f"{self.base_url}/stories",
                json=payload,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                story_id = data.get("id")
                
                # Now verify GET /api/stories returns 2 stories for same owner
                get_response = requests.get(f"{self.base_url}/stories", headers=self.headers, timeout=10)
                if get_response.status_code == 200:
                    stories_data = get_response.json()
                    
                    if len(stories_data) >= 1:
                        # Find our stories (should be first owner since it's our own stories)
                        our_story_owner = stories_data[0]
                        our_stories = our_story_owner["stories"]
                        
                        if len(our_stories) >= 2:
                            # Verify we have both captions
                            captions = [story["caption"] for story in our_stories]
                            if "Test story caption" in captions and "Second test story with different caption" in captions:
                                self.log_test("Scenario 3: Create second story + verify 2 stories", True, f"Successfully created second story. Owner now has {len(our_stories)} stories")
                                return story_id
                            else:
                                self.log_test("Scenario 3: Create second story + verify 2 stories", False, f"Expected both captions, got: {captions}")
                                return None
                        else:
                            self.log_test("Scenario 3: Create second story + verify 2 stories", False, f"Expected 2+ stories for owner, got {len(our_stories)}")
                            return None
                    else:
                        self.log_test("Scenario 3: Create second story + verify 2 stories", False, f"No story owners found after creating second story")
                        return None
                else:
                    self.log_test("Scenario 3: Create second story + verify 2 stories", False, f"Failed to get stories after creation: {get_response.status_code}")
                    return None
            else:
                self.log_test("Scenario 3: Create second story + verify 2 stories", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Scenario 3: Create second story + verify 2 stories", False, f"Exception: {str(e)}")
            return None
    
    def test_scenario_4_delete_story(self, story_id: str) -> bool:
        """
        Scenario 4: DELETE /api/stories/{id} - Delete own story
        Use story ID from step 1
        Expect: {"ok": true}
        Verify story no longer appears in GET /api/stories
        """
        try:
            # First, get current story count
            get_before = requests.get(f"{self.base_url}/stories", headers=self.headers, timeout=10)
            stories_before = 0
            if get_before.status_code == 200:
                data_before = get_before.json()
                if len(data_before) > 0:
                    stories_before = len(data_before[0]["stories"])
            
            # Delete the story
            response = requests.delete(
                f"{self.base_url}/stories/{story_id}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") == True:
                    # Verify story no longer appears
                    get_after = requests.get(f"{self.base_url}/stories", headers=self.headers, timeout=10)
                    if get_after.status_code == 200:
                        data_after = get_after.json()
                        
                        # Check if story count decreased
                        stories_after = 0
                        if len(data_after) > 0:
                            stories_after = len(data_after[0]["stories"])
                        
                        if stories_after == stories_before - 1:
                            self.log_test("Scenario 4: DELETE /api/stories/{id}", True, f"Story deleted successfully. Count: {stories_before} -> {stories_after}")
                            return True
                        else:
                            # Check if the specific story ID is gone
                            found_deleted_story = False
                            for owner in data_after:
                                for story in owner["stories"]:
                                    if story["id"] == story_id:
                                        found_deleted_story = True
                                        break
                            
                            if not found_deleted_story:
                                self.log_test("Scenario 4: DELETE /api/stories/{id}", True, f"Story {story_id} successfully removed from stories list")
                                return True
                            else:
                                self.log_test("Scenario 4: DELETE /api/stories/{id}", False, f"Story {story_id} still appears in stories list")
                                return False
                    else:
                        self.log_test("Scenario 4: DELETE /api/stories/{id}", False, f"Failed to verify deletion: GET stories returned {get_after.status_code}")
                        return False
                else:
                    self.log_test("Scenario 4: DELETE /api/stories/{id}", False, f"Expected {{\"ok\": true}}, got: {data}")
                    return False
            else:
                self.log_test("Scenario 4: DELETE /api/stories/{id}", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 4: DELETE /api/stories/{id}", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_5_delete_invalid_story(self) -> bool:
        """
        Scenario 5: DELETE /api/stories/{id} with invalid ID
        Try deleting non-existent story
        Expect: 404
        """
        try:
            invalid_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
            response = requests.delete(
                f"{self.base_url}/stories/{invalid_id}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 404:
                self.log_test("Scenario 5: DELETE /api/stories/{invalid_id}", True, f"Correctly returned 404 for non-existent story {invalid_id}")
                return True
            else:
                self.log_test("Scenario 5: DELETE /api/stories/{invalid_id}", False, f"Expected 404, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Scenario 5: DELETE /api/stories/{invalid_id}", False, f"Exception: {str(e)}")
            return False
    
    def test_scenario_6_regression_check(self) -> bool:
        """
        Scenario 6: Regression check: Verify existing endpoints still work:
        - GET /api/routes
        - GET /api/events  
        - GET /api/me
        """
        endpoints = [
            ("/routes", "Routes endpoint"),
            ("/events", "Events endpoint"),
            ("/me", "User profile endpoint")
        ]
        
        all_passed = True
        
        for endpoint, description in endpoints:
            try:
                response = requests.get(f"{self.base_url}{endpoint}", headers=self.headers, timeout=10)
                
                if response.status_code == 200:
                    self.log_test(f"Scenario 6: Regression - {description}", True, f"Status: {response.status_code}")
                else:
                    self.log_test(f"Scenario 6: Regression - {description}", False, f"Status: {response.status_code}, Response: {response.text}")
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"Scenario 6: Regression - {description}", False, f"Exception: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def run_comprehensive_test(self):
        """Run all test scenarios from the review request"""
        print("🚀 Starting Comprehensive Stories Feature Testing")
        print("Testing exact scenarios from review request")
        print("=" * 60)
        
        # Authentication
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Scenario 1: Create first story
        print("\n📝 Scenario 1: POST /api/stories (Create new story)")
        story_id_1 = self.test_scenario_1_create_story()
        if not story_id_1:
            print("❌ Scenario 1 failed. Cannot proceed with remaining tests.")
            return False
        
        # Scenario 2: Get all stories
        print("\n📖 Scenario 2: GET /api/stories (Get all active stories)")
        self.test_scenario_2_get_stories()
        
        # Scenario 3: Create second story and verify
        print("\n📝 Scenario 3: POST /api/stories again (Create second story)")
        story_id_2 = self.test_scenario_3_create_second_story()
        
        # Scenario 4: Delete first story
        print("\n🗑️ Scenario 4: DELETE /api/stories/{id} (Delete own story)")
        if story_id_1:
            self.test_scenario_4_delete_story(story_id_1)
        
        # Scenario 5: Delete with invalid ID
        print("\n🗑️ Scenario 5: DELETE /api/stories/{invalid_id} (Test 404)")
        self.test_scenario_5_delete_invalid_story()
        
        # Scenario 6: Regression check
        print("\n🔄 Scenario 6: Regression check (Existing endpoints)")
        self.test_scenario_6_regression_check()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print(f"\n🚨 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        if passed == total:
            print("\n🎉 ALL SCENARIOS PASSED! Stories feature fully functional.")
            return True
        else:
            print(f"\n⚠️ {total - passed} scenarios failed. Please review the issues above.")
            return False

def main():
    """Main test runner"""
    tester = ComprehensiveStoriesTester()
    success = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()