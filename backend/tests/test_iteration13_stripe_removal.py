"""
Iteration 13 Tests: Stripe Removal, Google Auth, Premium Payments Status
Tests for:
- Email login with user1@example.com / Password123
- POST /api/auth/google returns 401 for invalid session_id
- Premium payments status endpoint returns Stripe removed state
- POST /api/premium/checkout returns 410 (Stripe removed)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://native-payments-test.preview.emergentagent.com")


class TestEmailLogin:
    """Test email/password login flow"""
    
    def test_login_success_with_test_user(self):
        """Email login works with user1@example.com / Password123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "Password123"},
            timeout=15
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert len(data["access_token"]) > 10, "Token too short"
        print(f"PASS: Email login works, token length: {len(data['access_token'])}")
    
    def test_login_invalid_credentials(self):
        """Login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "WrongPassword"},
            timeout=15
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Invalid credentials returns 401")


class TestGoogleAuth:
    """Test Google OAuth endpoint"""
    
    def test_google_auth_invalid_session_id(self):
        """POST /api/auth/google returns 401 for invalid session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": "invalid_session_id_12345"},
            timeout=15
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: Google auth returns 401 for invalid session_id")
    
    def test_google_auth_empty_session_id(self):
        """POST /api/auth/google returns error for empty session_id"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": ""},
            timeout=15
        )
        # Should return 401 or 422 for empty/invalid session
        assert response.status_code in [401, 422], f"Expected 401/422, got {response.status_code}"
        print(f"PASS: Google auth returns {response.status_code} for empty session_id")
    
    def test_google_auth_endpoint_exists(self):
        """POST /api/auth/google endpoint is alive (not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": "test"},
            timeout=15
        )
        assert response.status_code != 404, "Google auth endpoint not found (404)"
        print(f"PASS: Google auth endpoint exists, returns {response.status_code}")


class TestPremiumPaymentsStatus:
    """Test premium payments status after Stripe removal"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "Password123"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not authenticate")
    
    def test_payments_status_stripe_removed(self, auth_token):
        """GET /api/premium/payments/status returns stripe_removed: true"""
        response = requests.get(
            f"{BASE_URL}/api/premium/payments/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify stripe_removed is true
        assert data.get("stripe_removed") == True, f"stripe_removed should be True, got: {data}"
        
        # Verify structure
        assert "apple_pay_ready" in data, "Missing apple_pay_ready field"
        assert "google_pay_ready" in data, "Missing google_pay_ready field"
        assert "message" in data, "Missing message field"
        
        print(f"PASS: Payments status shows stripe_removed=True")
        print(f"  apple_pay_ready: {data.get('apple_pay_ready')}")
        print(f"  google_pay_ready: {data.get('google_pay_ready')}")
        print(f"  message: {data.get('message')}")
    
    def test_payments_status_requires_auth(self):
        """GET /api/premium/payments/status requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/premium/payments/status",
            timeout=15
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("PASS: Payments status requires authentication")


class TestStripeCheckoutRemoved:
    """Test that Stripe checkout is removed"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "Password123"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not authenticate")
    
    def test_checkout_returns_410(self, auth_token):
        """POST /api/premium/checkout returns 410 (Gone - Stripe removed)"""
        response = requests.post(
            f"{BASE_URL}/api/premium/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"origin_url": "https://example.com"},
            timeout=15
        )
        assert response.status_code == 410, f"Expected 410, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Stripe" in data.get("detail", ""), f"Expected Stripe mention in detail: {data}"
        print(f"PASS: Checkout returns 410 with message: {data.get('detail')}")
    
    def test_checkout_status_returns_410(self, auth_token):
        """GET /api/premium/checkout/status/{session_id} returns 410"""
        response = requests.get(
            f"{BASE_URL}/api/premium/checkout/status/test_session_123",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=15
        )
        assert response.status_code == 410, f"Expected 410, got {response.status_code}: {response.text}"
        print("PASS: Checkout status returns 410")
    
    def test_stripe_webhook_returns_410(self):
        """POST /api/webhook/stripe returns 410"""
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            timeout=15
        )
        assert response.status_code == 410, f"Expected 410, got {response.status_code}: {response.text}"
        print("PASS: Stripe webhook returns 410")


class TestPremiumStatus:
    """Test premium status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "user1@example.com", "password": "Password123"},
            timeout=15
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not authenticate")
    
    def test_premium_status_returns_correct_structure(self, auth_token):
        """GET /api/premium/status returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/premium/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "is_premium" in data, "Missing is_premium field"
        assert "premium_until" in data, "Missing premium_until field"
        assert "plan" in data, "Missing plan field"
        assert "price" in data, "Missing price field"
        
        print(f"PASS: Premium status structure correct")
        print(f"  is_premium: {data.get('is_premium')}")
        print(f"  price: {data.get('price')}")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_health_endpoint(self):
        """Health endpoint returns ok"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("ok") == True, f"Health not ok: {data}"
        print("PASS: Health endpoint returns ok")
    
    def test_root_endpoint(self):
        """Root API endpoint returns message"""
        response = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert response.status_code == 200, f"Root endpoint failed: {response.text}"
        print("PASS: Root endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
