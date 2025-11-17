#!/usr/bin/env python3
"""
Test script for check-in endpoint authentication.

Tests:
1. Check-in without token (backward compatibility)
2. Check-in with valid token (should succeed)
3. Check-in with invalid token (should fail)
"""
import requests
import sys

# Configuration
BACKEND_URL = "http://localhost:8080"  # Local dev server
CHECKIN_URL = f"{BACKEND_URL}/api/runs/check-in"

def test_checkin_without_token(endpoint_id: int):
    """Test check-in without Authorization header (backward compatibility)."""
    print("\n[TEST 1] Check-in without token (backward compatibility)...")
    
    payload = {
        "endpoint_id": endpoint_id,
        "job_name": "test-job",
        "namespace": "production",
        "status": "success",
        "exit_code": 0,
        "duration": 10
    }
    
    response = requests.post(CHECKIN_URL, json=payload)
    
    if response.status_code == 201:
        print("✓ PASS: Check-in accepted without token (backward compatibility working)")
        return True
    else:
        print(f"✗ FAIL: Expected 201, got {response.status_code}: {response.text}")
        return False


def test_checkin_with_valid_token(endpoint_id: int, token: str):
    """Test check-in with valid token."""
    print("\n[TEST 2] Check-in with valid token...")
    
    payload = {
        "endpoint_id": endpoint_id,
        "job_name": "test-job",
        "namespace": "production",
        "status": "success",
        "exit_code": 0,
        "duration": 10
    }
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.post(CHECKIN_URL, json=payload, headers=headers)
    
    if response.status_code == 201:
        print("✓ PASS: Check-in accepted with valid token")
        return True
    else:
        print(f"✗ FAIL: Expected 201, got {response.status_code}: {response.text}")
        return False


def test_checkin_with_invalid_token(endpoint_id: int):
    """Test check-in with invalid token."""
    print("\n[TEST 3] Check-in with invalid token...")
    
    payload = {
        "endpoint_id": endpoint_id,
        "job_name": "test-job",
        "namespace": "production",
        "status": "success",
        "exit_code": 0,
        "duration": 10
    }
    
    headers = {
        "Authorization": "Bearer invalid_token_12345"
    }
    
    response = requests.post(CHECKIN_URL, json=payload, headers=headers)
    
    if response.status_code == 401:
        print("✓ PASS: Check-in rejected with invalid token (401 Unauthorized)")
        return True
    else:
        print(f"✗ FAIL: Expected 401, got {response.status_code}: {response.text}")
        return False


def test_checkin_with_malformed_header(endpoint_id: int):
    """Test check-in with malformed Authorization header."""
    print("\n[TEST 4] Check-in with malformed Authorization header...")
    
    payload = {
        "endpoint_id": endpoint_id,
        "job_name": "test-job",
        "namespace": "production",
        "status": "success",
        "exit_code": 0,
        "duration": 10
    }
    
    headers = {
        "Authorization": "InvalidFormat token123"
    }
    
    response = requests.post(CHECKIN_URL, json=payload, headers=headers)
    
    if response.status_code == 401:
        print("✓ PASS: Check-in rejected with malformed header (401 Unauthorized)")
        return True
    else:
        print(f"✗ FAIL: Expected 401, got {response.status_code}: {response.text}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Check-in Authentication Test Suite")
    print("=" * 60)
    
    # Check if backend is running
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        if response.status_code != 200:
            print(f"\n✗ Backend is not healthy: {response.status_code}")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"\n✗ Cannot connect to backend at {BACKEND_URL}")
        print("Please start the backend server first:")
        print("  cd backend && source venv/bin/activate && uvicorn crontopus_api.main:app --reload --port 8080")
        sys.exit(1)
    
    print(f"✓ Backend is running at {BACKEND_URL}")
    
    # For testing, we need an endpoint_id and token
    # In a real scenario, you would:
    # 1. Create a test user
    # 2. Enroll an endpoint
    # 3. Use the returned endpoint_id and token
    
    print("\n" + "=" * 60)
    print("MANUAL TESTING INSTRUCTIONS:")
    print("=" * 60)
    print("\n1. Create a test user and login to get JWT token")
    print("2. Enroll an endpoint to get endpoint_id and token")
    print("3. Run this script with: python test_checkin_auth.py <endpoint_id> <token>")
    print("\nExample:")
    print("  python test_checkin_auth.py 1 your_token_here")
    
    if len(sys.argv) == 3:
        endpoint_id = int(sys.argv[1])
        token = sys.argv[2]
        
        print(f"\nTesting with endpoint_id={endpoint_id}")
        print("=" * 60)
        
        results = [
            test_checkin_without_token(endpoint_id),
            test_checkin_with_valid_token(endpoint_id, token),
            test_checkin_with_invalid_token(endpoint_id),
            test_checkin_with_malformed_header(endpoint_id)
        ]
        
        print("\n" + "=" * 60)
        print("Test Results Summary")
        print("=" * 60)
        passed = sum(results)
        total = len(results)
        print(f"Passed: {passed}/{total}")
        
        if passed == total:
            print("\n✓ All tests passed!")
            sys.exit(0)
        else:
            print(f"\n✗ {total - passed} test(s) failed")
            sys.exit(1)
