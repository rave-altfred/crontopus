#!/usr/bin/env python3
"""
Test script for API token operations.

Tests:
1. Create API token
2. List tokens
3. Use token to authenticate API requests
4. Update token
5. Revoke token
"""
import requests
import sys
import json

# Configuration
BACKEND_URL = "http://localhost:8080"
API_BASE = f"{BACKEND_URL}/api"

def print_step(step_num, description):
    print(f"\n{'='*60}")
    print(f"[STEP {step_num}] {description}")
    print('='*60)

def print_result(success, message):
    icon = "✓" if success else "✗"
    print(f"{icon} {message}")

def login_user(username, password):
    """Login and get JWT token."""
    response = requests.post(
        f"{API_BASE}/auth/login",
        data={"username": username, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        return data["access_token"]
    return None

def create_api_token(jwt_token, name, scopes, expires_days=None):
    """Create a new API token."""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    payload = {
        "name": name,
        "scopes": scopes
    }
    if expires_days:
        payload["expires_days"] = expires_days
    
    response = requests.post(
        f"{API_BASE}/tokens",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 201:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

def list_api_tokens(jwt_token):
    """List all API tokens."""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = requests.get(
        f"{API_BASE}/tokens",
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

def test_api_token_auth(api_token):
    """Test authenticating with API token."""
    headers = {"Authorization": f"Bearer {api_token}"}
    response = requests.get(
        f"{API_BASE}/auth/me",
        headers=headers
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

def test_api_token_permissions(api_token):
    """Test API token can access protected endpoints."""
    headers = {"Authorization": f"Bearer {api_token}"}
    
    # Test runs endpoint
    response = requests.get(
        f"{API_BASE}/runs",
        headers=headers
    )
    
    return response.status_code == 200

def update_api_token(jwt_token, token_id, new_name):
    """Update an API token."""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    payload = {"name": new_name}
    
    response = requests.patch(
        f"{API_BASE}/tokens/{token_id}",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

def revoke_api_token(jwt_token, token_id):
    """Revoke an API token."""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = requests.delete(
        f"{API_BASE}/tokens/{token_id}",
        headers=headers
    )
    
    return response.status_code == 204

def main():
    print("="*60)
    print("API Token Test Suite")
    print("="*60)
    
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
    
    print_result(True, f"Backend is running at {BACKEND_URL}")
    
    # Get credentials
    if len(sys.argv) != 3:
        print("\nUsage: python test_api_tokens.py <username> <password>")
        print("\nExample:")
        print("  python test_api_tokens.py testuser testpassword")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    # Step 1: Login and get JWT token
    print_step(1, "Login with username/password")
    jwt_token = login_user(username, password)
    if not jwt_token:
        print_result(False, "Failed to login")
        sys.exit(1)
    print_result(True, f"Logged in successfully (JWT token: {jwt_token[:20]}...)")
    
    # Step 2: Create API token
    print_step(2, "Create API token")
    token_data = create_api_token(
        jwt_token,
        name="Test Token",
        scopes=["read:runs", "read:agents", "write:jobs"],
        expires_days=90
    )
    if not token_data:
        print_result(False, "Failed to create API token")
        sys.exit(1)
    
    api_token = token_data["token"]
    token_id = token_data["id"]
    print_result(True, f"Created API token: {api_token[:20]}...")
    print(f"   Token ID: {token_id}")
    print(f"   Name: {token_data['name']}")
    print(f"   Scopes: {', '.join(token_data['scopes'])}")
    print(f"   Expires: {token_data.get('expires_at', 'Never')}")
    
    # Step 3: List tokens
    print_step(3, "List API tokens")
    tokens_list = list_api_tokens(jwt_token)
    if not tokens_list:
        print_result(False, "Failed to list tokens")
        sys.exit(1)
    print_result(True, f"Found {tokens_list['total']} token(s)")
    for token in tokens_list['tokens']:
        print(f"   - {token['name']} (ID: {token['id']}, Scopes: {', '.join(token['scopes'])})")
    
    # Step 4: Authenticate with API token
    print_step(4, "Authenticate with API token")
    user_data = test_api_token_auth(api_token)
    if not user_data:
        print_result(False, "Failed to authenticate with API token")
        sys.exit(1)
    print_result(True, f"Authenticated as: {user_data['username']}")
    print(f"   User ID: {user_data['id']}")
    print(f"   Tenant: {user_data['tenant_id']}")
    
    # Step 5: Test API access with token
    print_step(5, "Test API access with token")
    has_access = test_api_token_permissions(api_token)
    if not has_access:
        print_result(False, "Failed to access protected endpoints")
        sys.exit(1)
    print_result(True, "Successfully accessed protected endpoints (/api/runs)")
    
    # Step 6: Update token name
    print_step(6, "Update API token name")
    updated_token = update_api_token(jwt_token, token_id, "Updated Test Token")
    if not updated_token:
        print_result(False, "Failed to update token")
        sys.exit(1)
    print_result(True, f"Updated token name to: {updated_token['name']}")
    
    # Step 7: Revoke token
    print_step(7, "Revoke API token")
    revoked = revoke_api_token(jwt_token, token_id)
    if not revoked:
        print_result(False, "Failed to revoke token")
        sys.exit(1)
    print_result(True, "Token revoked successfully")
    
    # Step 8: Verify token no longer works
    print_step(8, "Verify revoked token doesn't work")
    user_data = test_api_token_auth(api_token)
    if user_data:
        print_result(False, "Revoked token still works!")
        sys.exit(1)
    print_result(True, "Revoked token correctly rejected (401 Unauthorized)")
    
    print("\n" + "="*60)
    print("✓ All tests passed!")
    print("="*60)

if __name__ == "__main__":
    main()
