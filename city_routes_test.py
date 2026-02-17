#!/usr/bin/env python3
"""
Test backend after city changes for routes.

Scope:
1) Authentication with user1@example.com / Password123.
2) Create a NEW route via POST /api/routes with 2-point polyline (in Romania, e.g., Bucharest) and confirm response contains start_city and end_city (string, not null), or at least one of them.
3) Check GET /api/routes (list) and confirm the same route has start_city/end_city populated.
4) Check GET /api/routes/my as well.

Note: Old routes can remain with start_city/end_city null (as per requirement).

Please report clearly: endpoints OK/Fail, and examples of start_city/end_city fields in response.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import httpx


class CityRoutesBackendTester:
    def __init__(self):
        # Use the production URL from frontend/.env
        self.base_url = "https://riders-hub-10.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        
        # Test data storage
        self.user_token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.new_route_id: Optional[str] = None
        
        # Test results
        self.results: Dict[str, Any] = {}
        self.failed_tests: list = []

    async def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ OK" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        
        self.results[test_name] = {
            "success": success,
            "details": details
        }
        
        if not success:
            self.failed_tests.append(test_name)

    async def test_authentication(self):
        """1) Authentication with user1@example.com / Password123"""
        print("\n=== 1) AUTHENTICATION TEST ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            login_data = {
                "email": "user1@example.com",
                "password": "Password123"
            }
            
            try:
                resp = await client.post(f"{self.api_url}/auth/login", json=login_data)
                if resp.status_code == 200:
                    token_data = resp.json()
                    self.user_token = token_data.get("access_token")
                    await self.log_test("Authentication", True, f"Token received: {self.user_token[:20]}...")
                    
                    # Get user ID
                    headers = {"Authorization": f"Bearer {self.user_token}"}
                    me_resp = await client.get(f"{self.api_url}/me", headers=headers)
                    if me_resp.status_code == 200:
                        user_data = me_resp.json()
                        self.user_id = user_data.get("id")
                        await self.log_test("Get User ID", True, f"User ID: {self.user_id}")
                    else:
                        await self.log_test("Get User ID", False, f"Status: {me_resp.status_code}")
                        return False
                        
                else:
                    await self.log_test("Authentication", False, f"Status: {resp.status_code}, Response: {resp.text}")
                    return False
            except Exception as e:
                await self.log_test("Authentication", False, f"Exception: {str(e)}")
                return False
                
        return True

    async def test_create_route_with_cities(self):
        """2) Create NEW route with 2-point polyline in Romania (Bucharest area)"""
        print("\n=== 2) CREATE NEW ROUTE WITH CITY DETECTION ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Create route with 2 points in Bucharest area
            route_data = {
                "title": "Test Bucharest City Route",
                "description": "Test route for city detection in Bucharest area",
                "polyline": [
                    [44.4268, 26.1025],  # Bucharest center (Piața Universității)
                    [44.4778, 26.0598]   # Bucharest north (Herastrau area)
                ],
                "difficulty": "easy",
                "participants_min": 1,
                "participants_max": 5,
                "fuel_price_per_l": 7.5,
                "bike_consumption_l_per_100km": 5.0,
                "toll_estimate": 0.0,
                "currency": "RON",
                "stops_count": 0
            }
            
            try:
                resp = await client.post(f"{self.api_url}/routes", json=route_data, headers=headers)
                if resp.status_code == 200:
                    route_response = resp.json()
                    self.new_route_id = route_response.get("id")
                    
                    # Check for start_city and end_city fields
                    start_city = route_response.get("start_city")
                    end_city = route_response.get("end_city")
                    
                    print(f"    Route ID: {self.new_route_id}")
                    print(f"    start_city: {start_city}")
                    print(f"    end_city: {end_city}")
                    
                    # Check if at least one city is populated (string, not null)
                    has_start_city = isinstance(start_city, str) and start_city.strip()
                    has_end_city = isinstance(end_city, str) and end_city.strip()
                    
                    if has_start_city or has_end_city:
                        city_info = []
                        if has_start_city:
                            city_info.append(f"start_city='{start_city}'")
                        if has_end_city:
                            city_info.append(f"end_city='{end_city}'")
                        
                        await self.log_test("POST /api/routes (city detection)", True, 
                                          f"Route created with cities: {', '.join(city_info)}")
                    else:
                        await self.log_test("POST /api/routes (city detection)", False, 
                                          f"No city detected: start_city={start_city}, end_city={end_city}")
                        return False
                        
                else:
                    await self.log_test("POST /api/routes (city detection)", False, 
                                      f"Status: {resp.status_code}, Response: {resp.text}")
                    return False
            except Exception as e:
                await self.log_test("POST /api/routes (city detection)", False, f"Exception: {str(e)}")
                return False
                
        return True

    async def test_get_routes_list(self):
        """3) Check GET /api/routes (list) for city fields"""
        print("\n=== 3) GET /api/routes (LIST) CITY CHECK ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            try:
                resp = await client.get(f"{self.api_url}/routes", headers=headers)
                if resp.status_code == 200:
                    routes = resp.json()
                    
                    # Find our newly created route
                    new_route = None
                    for route in routes:
                        if route.get("id") == self.new_route_id:
                            new_route = route
                            break
                    
                    if new_route:
                        start_city = new_route.get("start_city")
                        end_city = new_route.get("end_city")
                        
                        print(f"    Found route ID: {self.new_route_id}")
                        print(f"    start_city: {start_city}")
                        print(f"    end_city: {end_city}")
                        
                        # Check if at least one city is populated
                        has_start_city = isinstance(start_city, str) and start_city.strip()
                        has_end_city = isinstance(end_city, str) and end_city.strip()
                        
                        if has_start_city or has_end_city:
                            city_info = []
                            if has_start_city:
                                city_info.append(f"start_city='{start_city}'")
                            if has_end_city:
                                city_info.append(f"end_city='{end_city}'")
                            
                            await self.log_test("GET /api/routes (city fields)", True, 
                                              f"Cities populated: {', '.join(city_info)}")
                        else:
                            await self.log_test("GET /api/routes (city fields)", False, 
                                              f"No cities in list: start_city={start_city}, end_city={end_city}")
                            return False
                    else:
                        await self.log_test("GET /api/routes (city fields)", False, 
                                          f"New route {self.new_route_id} not found in list")
                        return False
                        
                else:
                    await self.log_test("GET /api/routes (city fields)", False, 
                                      f"Status: {resp.status_code}, Response: {resp.text}")
                    return False
            except Exception as e:
                await self.log_test("GET /api/routes (city fields)", False, f"Exception: {str(e)}")
                return False
                
        return True

    async def test_get_my_routes(self):
        """4) Check GET /api/routes/my for city fields"""
        print("\n=== 4) GET /api/routes/my CITY CHECK ===")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            try:
                resp = await client.get(f"{self.api_url}/routes/my", headers=headers)
                if resp.status_code == 200:
                    my_routes = resp.json()
                    
                    # Find our newly created route
                    new_route = None
                    for route in my_routes:
                        if route.get("id") == self.new_route_id:
                            new_route = route
                            break
                    
                    if new_route:
                        start_city = new_route.get("start_city")
                        end_city = new_route.get("end_city")
                        
                        print(f"    Found route ID: {self.new_route_id}")
                        print(f"    start_city: {start_city}")
                        print(f"    end_city: {end_city}")
                        
                        # Check if at least one city is populated
                        has_start_city = isinstance(start_city, str) and start_city.strip()
                        has_end_city = isinstance(end_city, str) and end_city.strip()
                        
                        if has_start_city or has_end_city:
                            city_info = []
                            if has_start_city:
                                city_info.append(f"start_city='{start_city}'")
                            if has_end_city:
                                city_info.append(f"end_city='{end_city}'")
                            
                            await self.log_test("GET /api/routes/my (city fields)", True, 
                                              f"Cities populated: {', '.join(city_info)}")
                        else:
                            await self.log_test("GET /api/routes/my (city fields)", False, 
                                              f"No cities in my routes: start_city={start_city}, end_city={end_city}")
                            return False
                    else:
                        await self.log_test("GET /api/routes/my (city fields)", False, 
                                          f"New route {self.new_route_id} not found in my routes")
                        return False
                        
                else:
                    await self.log_test("GET /api/routes/my (city fields)", False, 
                                      f"Status: {resp.status_code}, Response: {resp.text}")
                    return False
            except Exception as e:
                await self.log_test("GET /api/routes/my (city fields)", False, f"Exception: {str(e)}")
                return False
                
        return True

    async def run_city_routes_tests(self):
        """Run all city routes tests"""
        print("🚀 Testing Backend City Routes Feature")
        print(f"Testing against: {self.api_url}")
        print("=" * 80)
        
        # Run tests in sequence
        if not await self.test_authentication():
            print("❌ Authentication failed, stopping tests")
            return False
            
        if not await self.test_create_route_with_cities():
            print("❌ Route creation failed, stopping tests")
            return False
            
        if not await self.test_get_routes_list():
            print("❌ Routes list check failed")
            return False
            
        if not await self.test_get_my_routes():
            print("❌ My routes check failed")
            return False
        
        # Print summary
        print("\n" + "=" * 80)
        print("🏁 CITY ROUTES TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        
        if failed_tests > 0:
            print(f"\n🚨 FAILED TESTS ({failed_tests}):")
            for test_name in self.failed_tests:
                result = self.results[test_name]
                print(f"  ❌ {test_name}: {result['details']}")
        
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        if success_rate == 100:
            print("🎉 ALL TESTS PASSED - City routes feature working correctly!")
        elif success_rate >= 75:
            print("⚠️  MOSTLY WORKING - Minor issues detected")
        else:
            print("🚨 CRITICAL ISSUES - City routes feature needs attention")
        
        return success_rate == 100


async def main():
    """Main test execution"""
    tester = CityRoutesBackendTester()
    success = await tester.run_city_routes_tests()
    
    if success:
        print("\n✅ City Routes Backend Testing: PASSED")
        return 0
    else:
        print("\n❌ City Routes Backend Testing: FAILED")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)