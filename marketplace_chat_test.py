#!/usr/bin/env python3
"""
Marketplace Chat Backend Test for Moto GO API
Tests the specific marketplace chat flow requested in the review:

1. Login as seller user1@example.com / Password123
2. Create a temporary marketplace listing  
3. Register/login a temporary buyer
4. Buyer sends first message to POST /api/marketplace/chat/listing/{listing_id}/send
5. Seller can retrieve listing conversations via GET /api/marketplace/chat/listing/{listing_id}/conversations
6. Buyer can retrieve their conversations via GET /api/marketplace/chat/conversations
7. Seller replies via POST /api/marketplace/chat/{chat_id}/send
8. Buyer can load full thread via GET /api/marketplace/chat/{chat_id}/messages and should see both messages
9. Cleanup the temporary listing
"""

import json
import requests
import sys
import uuid
from datetime import datetime
from typing import Dict, Any

# API Base URL from frontend .env
BASE_URL = "https://ride-start-gating.preview.emergentagent.com/api"

# Test credentials  
SELLER_EMAIL = "user1@example.com"
SELLER_PASSWORD = "Password123"

# Generate unique buyer credentials for this test
BUYER_EMAIL = f"testbuyer{uuid.uuid4().hex[:8]}@example.com"
BUYER_PASSWORD = "TestPassword123"
BUYER_USERNAME = f"testbuyer{uuid.uuid4().hex[:8]}"

class MarketplaceChatTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.seller_token = None
        self.buyer_token = None
        self.headers = {"Content-Type": "application/json"}
        self.listing_id = None
        self.chat_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None, token: str = None, expected_status: int = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
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

    def test_seller_login(self) -> bool:
        """Test 1: Login as seller user1@example.com / Password123"""
        self.log("🔐 Testing seller login...")
        
        login_data = {
            "email": SELLER_EMAIL,
            "password": SELLER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Seller login failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if "access_token" not in data:
                self.log("❌ Seller login response missing access_token", "ERROR")
                return False
                
            self.seller_token = data["access_token"]
            self.log(f"✅ Seller login successful - token: {self.seller_token[:20]}...")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Seller login response not valid JSON", "ERROR")
            return False

    def test_create_marketplace_listing(self) -> bool:
        """Test 2: Create a temporary marketplace listing"""
        self.log("🏪 Testing marketplace listing creation...")
        
        listing_data = {
            "title": f"Test Marketplace Listing {uuid.uuid4().hex[:8]}",
            "description": "Test listing for marketplace chat testing",
            "category": "motorcycle",
            "price": 5000.0,
            "currency": "RON",
            "location": "Bucuresti, Romania",
            "kilometers": 25000,
            "year": 2019,
            "phone": "+40721234567",
            "images": ["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="]
        }
        
        response = self.make_request("POST", "/marketplace/listings", listing_data, self.seller_token)
        
        if response.status_code not in [200, 201]:
            self.log("❌ Listing creation failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if "id" not in data:
                self.log("❌ Listing creation response missing id", "ERROR")
                return False
                
            self.listing_id = data["id"]
            self.log(f"✅ Listing created successfully - ID: {self.listing_id}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Listing creation response not valid JSON", "ERROR")
            return False

    def test_buyer_registration_and_login(self) -> bool:
        """Test 3: Register/login a temporary buyer"""
        self.log("👤 Testing buyer registration and login...")
        
        # Register buyer
        register_data = {
            "email": BUYER_EMAIL,
            "username": BUYER_USERNAME,
            "password": BUYER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/register", register_data, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Buyer registration failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if "access_token" not in data:
                self.log("❌ Buyer registration response missing access_token", "ERROR")
                return False
                
            self.buyer_token = data["access_token"]
            self.log(f"✅ Buyer registered and logged in - token: {self.buyer_token[:20]}...")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Buyer registration response not valid JSON", "ERROR")
            return False

    def test_buyer_send_first_message(self) -> bool:
        """Test 4: Buyer sends first message to POST /api/marketplace/chat/listing/{listing_id}/send"""
        self.log("💬 Testing buyer sending first message...")
        
        if not self.listing_id:
            self.log("❌ No listing ID available for messaging", "ERROR")
            return False
            
        message_data = {
            "text": "Hello! I'm interested in this listing. Is it still available?"
        }
        
        response = self.make_request("POST", f"/marketplace/chat/listing/{self.listing_id}/send", 
                                    message_data, self.buyer_token, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Buyer first message failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            required_fields = ["id", "chat_id", "text", "sender_id", "created_at"]
            
            for field in required_fields:
                if field not in data:
                    self.log(f"❌ Message response missing field: {field}", "ERROR")
                    return False
                    
            self.chat_id = data["chat_id"]
            self.log(f"✅ Buyer first message sent successfully - Chat ID: {self.chat_id}")
            self.log(f"   Message: {data['text']}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Buyer message response not valid JSON", "ERROR")
            return False

    def test_seller_retrieve_listing_conversations(self) -> bool:
        """Test 5: Seller can retrieve listing conversations via GET /api/marketplace/chat/listing/{listing_id}/conversations"""
        self.log("📋 Testing seller retrieving listing conversations...")
        
        if not self.listing_id:
            self.log("❌ No listing ID available", "ERROR")
            return False
            
        response = self.make_request("GET", f"/marketplace/chat/listing/{self.listing_id}/conversations", 
                                    token=self.seller_token, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Seller get listing conversations failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if not isinstance(data, list):
                self.log("❌ Listing conversations response not a list", "ERROR")
                return False
                
            if len(data) == 0:
                self.log("❌ No conversations found for listing", "ERROR")
                return False
                
            # Find our chat
            found_chat = None
            for convo in data:
                if convo.get("id") == self.chat_id:
                    found_chat = convo
                    break
                    
            if not found_chat:
                self.log("❌ Our chat not found in seller's listing conversations", "ERROR")
                return False
                
            # Verify conversation structure
            required_fields = ["id", "listing_id", "buyer_id", "seller_id", "last_message", "created_at"]
            for field in required_fields:
                if field not in found_chat:
                    self.log(f"❌ Conversation missing field: {field}", "ERROR")
                    return False
                    
            self.log(f"✅ Seller retrieved listing conversations - found {len(data)} conversation(s)")
            self.log(f"   Last message: {found_chat['last_message']}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Listing conversations response not valid JSON", "ERROR")
            return False

    def test_buyer_retrieve_conversations(self) -> bool:
        """Test 6: Buyer can retrieve their conversations via GET /api/marketplace/chat/conversations"""
        self.log("📋 Testing buyer retrieving their conversations...")
        
        response = self.make_request("GET", "/marketplace/chat/conversations", 
                                    token=self.buyer_token, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Buyer get conversations failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if not isinstance(data, list):
                self.log("❌ Buyer conversations response not a list", "ERROR")
                return False
                
            if len(data) == 0:
                self.log("❌ No conversations found for buyer", "ERROR")
                return False
                
            # Find our chat
            found_chat = None
            for convo in data:
                if convo.get("id") == self.chat_id:
                    found_chat = convo
                    break
                    
            if not found_chat:
                self.log("❌ Our chat not found in buyer's conversations", "ERROR")
                return False
                
            self.log(f"✅ Buyer retrieved conversations - found {len(data)} conversation(s)")
            self.log(f"   Listing: {found_chat.get('listing_title', 'N/A')}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Buyer conversations response not valid JSON", "ERROR")
            return False

    def test_seller_reply_to_chat(self) -> bool:
        """Test 7: Seller replies via POST /api/marketplace/chat/{chat_id}/send"""
        self.log("💬 Testing seller replying to chat...")
        
        if not self.chat_id:
            self.log("❌ No chat ID available for reply", "ERROR")
            return False
            
        reply_data = {
            "text": "Yes, it's still available! Would you like to arrange a viewing?"
        }
        
        response = self.make_request("POST", f"/marketplace/chat/{self.chat_id}/send", 
                                    reply_data, self.seller_token, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Seller reply failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            required_fields = ["id", "chat_id", "text", "sender_id", "created_at"]
            
            for field in required_fields:
                if field not in data:
                    self.log(f"❌ Seller reply response missing field: {field}", "ERROR")
                    return False
                    
            if data["chat_id"] != self.chat_id:
                self.log(f"❌ Reply chat_id mismatch: expected {self.chat_id}, got {data['chat_id']}", "ERROR")
                return False
                
            self.log(f"✅ Seller reply sent successfully")
            self.log(f"   Reply: {data['text']}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Seller reply response not valid JSON", "ERROR")
            return False

    def test_buyer_load_full_thread(self) -> bool:
        """Test 8: Buyer can load full thread via GET /api/marketplace/chat/{chat_id}/messages and should see both messages"""
        self.log("📖 Testing buyer loading full thread...")
        
        if not self.chat_id:
            self.log("❌ No chat ID available for loading messages", "ERROR")
            return False
            
        response = self.make_request("GET", f"/marketplace/chat/{self.chat_id}/messages", 
                                    token=self.buyer_token, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Buyer load messages failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            
            # Verify response structure
            required_fields = ["chat_id", "listing_id", "messages"]
            for field in required_fields:
                if field not in data:
                    self.log(f"❌ Messages response missing field: {field}", "ERROR")
                    return False
                    
            if data["chat_id"] != self.chat_id:
                self.log(f"❌ Messages chat_id mismatch: expected {self.chat_id}, got {data['chat_id']}", "ERROR")
                return False
                
            messages = data["messages"]
            if not isinstance(messages, list):
                self.log("❌ Messages field is not a list", "ERROR")
                return False
                
            if len(messages) != 2:
                self.log(f"❌ Expected 2 messages, got {len(messages)}", "ERROR")
                return False
                
            # Verify both messages are present
            buyer_message_found = False
            seller_message_found = False
            
            for msg in messages:
                if "Hello! I'm interested" in msg.get("text", ""):
                    buyer_message_found = True
                if "Yes, it's still available" in msg.get("text", ""):
                    seller_message_found = True
                    
            if not buyer_message_found:
                self.log("❌ Buyer's initial message not found in thread", "ERROR")
                return False
                
            if not seller_message_found:
                self.log("❌ Seller's reply not found in thread", "ERROR")
                return False
                
            self.log(f"✅ Full thread loaded successfully - {len(messages)} messages")
            self.log(f"   ✅ Buyer message: Found")
            self.log(f"   ✅ Seller reply: Found")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Messages response not valid JSON", "ERROR")
            return False

    def test_cleanup_listing(self) -> bool:
        """Test 9: Cleanup the temporary listing"""
        self.log("🗑️ Testing listing cleanup...")
        
        if not self.listing_id:
            self.log("❌ No listing ID to cleanup", "ERROR")
            return False
            
        response = self.make_request("DELETE", f"/marketplace/listings/{self.listing_id}", 
                                    token=self.seller_token, expected_status=200)
        
        if response.status_code != 200:
            self.log("❌ Listing cleanup failed - incorrect status code", "ERROR")
            return False
            
        try:
            data = response.json()
            if not data.get("status") == "deleted":
                self.log("❌ Listing cleanup response not indicating success", "ERROR")
                return False
                
            self.log(f"✅ Listing cleaned up successfully - ID: {self.listing_id}")
            return True
            
        except json.JSONDecodeError:
            self.log("❌ Listing cleanup response not valid JSON", "ERROR")
            return False

    def run_all_tests(self) -> bool:
        """Run all marketplace chat tests in order"""
        self.log("🚀 Starting Marketplace Chat Backend Tests")
        self.log(f"🔗 API Base URL: {self.base_url}")
        self.log(f"👤 Seller: {SELLER_EMAIL}")
        self.log(f"👤 Buyer: {BUYER_EMAIL}")
        
        tests = [
            ("Seller Login", self.test_seller_login),
            ("Create Marketplace Listing", self.test_create_marketplace_listing),
            ("Buyer Registration & Login", self.test_buyer_registration_and_login),
            ("Buyer Send First Message", self.test_buyer_send_first_message),
            ("Seller Retrieve Listing Conversations", self.test_seller_retrieve_listing_conversations),
            ("Buyer Retrieve Conversations", self.test_buyer_retrieve_conversations),
            ("Seller Reply to Chat", self.test_seller_reply_to_chat),
            ("Buyer Load Full Thread", self.test_buyer_load_full_thread),
            ("Cleanup Listing", self.test_cleanup_listing),
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
        self.log("\n" + "="*60)
        self.log("📊 MARKETPLACE CHAT TEST SUMMARY")
        self.log("="*60)
        
        passed = 0
        total = len(tests)
        
        for test_name, passed_test in results.items():
            status = "✅ PASS" if passed_test else "❌ FAIL"
            self.log(f"{status}: {test_name}")
            if passed_test:
                passed += 1
                
        self.log(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All marketplace chat tests passed! 2-way messaging works correctly.")
            return True
        else:
            self.log(f"⚠️  {total - passed} test(s) failed. Check logs above for details.")
            return False

def main():
    """Main entry point"""
    tester = MarketplaceChatTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()