#!/usr/bin/env python3
"""
Test script to verify Forgejo API for user and token creation.
"""
import httpx
import os
import sys
from pathlib import Path

# Forgejo credentials (from app.yaml)
FORGEJO_URL = "https://git.crontopus.com"
FORGEJO_USERNAME = "rave"
FORGEJO_TOKEN = "86ad49195a56408030042b3ec71eb66932659a23"

print(f"Forgejo URL: {FORGEJO_URL}")
print(f"Admin User: {FORGEJO_USERNAME}")
print(f"Token: {FORGEJO_TOKEN[:20]}...")
print()

# Test user details
TEST_USERNAME = "testuser999"
TEST_EMAIL = "testuser999@test.com"
TEST_PASSWORD = "TestPassword123!"

headers = {
    "Authorization": f"token {FORGEJO_TOKEN}",
    "Content-Type": "application/json"
}


async def test_create_user():
    """Test creating a user via admin API."""
    print("=" * 60)
    print("TEST 1: Create User via Admin API")
    print("=" * 60)
    
    url = f"{FORGEJO_URL}/api/v1/admin/users"
    payload = {
        "username": TEST_USERNAME,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "must_change_password": False,
        "send_notify": False
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code in (201, 422):  # 422 = already exists
                print("✓ User creation successful (or already exists)")
                return True
            else:
                print("✗ User creation failed")
                return False
        except Exception as e:
            print(f"✗ Exception: {e}")
            return False


async def test_list_tokens_admin_api():
    """Test listing tokens via admin API."""
    print("\n" + "=" * 60)
    print("TEST 2A: List Tokens via Admin API (GET)")
    print("=" * 60)
    
    url = f"{FORGEJO_URL}/api/v1/admin/users/{TEST_USERNAME}/tokens"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                print("✓ Admin can LIST tokens")
                return response.json()
            else:
                print("✗ Admin CANNOT list tokens")
                return None
        except Exception as e:
            print(f"✗ Exception: {e}")
            return None


async def test_create_token_admin_api():
    """Test creating a token via admin API (if it exists)."""
    print("\n" + "=" * 60)
    print("TEST 2B: Create Token via Admin API (POST)")
    print("=" * 60)
    
    url = f"{FORGEJO_URL}/api/v1/admin/users/{TEST_USERNAME}/tokens"
    payload = {
        "name": "test-admin-token",
        "scopes": ["read:repository", "write:repository"]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 201:
                result = response.json()
                token = result.get('sha1', '')
                print(f"✓ Admin can CREATE tokens: {token[:20]}...")
                return token
            else:
                print("✗ Admin CANNOT create tokens")
                return None
        except Exception as e:
            print(f"✗ Exception: {e}")
            return None


async def test_create_token_user_api():
    """Test creating a token via user API with user credentials."""
    print("\n" + "=" * 60)
    print("TEST 3: Create Token via User API (Basic Auth)")
    print("=" * 60)
    
    url = f"{FORGEJO_URL}/api/v1/users/{TEST_USERNAME}/tokens"
    payload = {
        "name": "test-user-token",
        "scopes": ["read:repository", "write:repository"]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                auth=(TEST_USERNAME, TEST_PASSWORD),  # Basic auth
                json=payload,
                timeout=30.0
            )
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 201:
                result = response.json()
                token = result.get('sha1', '')
                print(f"✓ Token created successfully: {token[:20]}...")
                return token
            else:
                print("✗ Token creation failed")
                return None
        except Exception as e:
            print(f"✗ Exception: {e}")
            return None


async def test_verify_token(token: str):
    """Test if the token works."""
    print("\n" + "=" * 60)
    print("TEST 4: Verify Token Works")
    print("=" * 60)
    
    url = f"{FORGEJO_URL}/api/v1/user"
    token_headers = {
        "Authorization": f"token {token}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=token_headers, timeout=30.0)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✓ Token verified for user: {result.get('login')}")
                return True
            else:
                print("✗ Token verification failed")
                return False
        except Exception as e:
            print(f"✗ Exception: {e}")
            return False


async def test_delete_user():
    """Clean up: delete the test user."""
    print("\n" + "=" * 60)
    print("CLEANUP: Delete Test User")
    print("=" * 60)
    
    url = f"{FORGEJO_URL}/api/v1/admin/users/{TEST_USERNAME}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(url, headers=headers, timeout=30.0)
            print(f"Status: {response.status_code}")
            
            if response.status_code in (204, 404):
                print("✓ User deleted successfully")
                return True
            else:
                print(f"✗ User deletion failed: {response.text}")
                return False
        except Exception as e:
            print(f"✗ Exception: {e}")
            return False


async def main():
    """Run all tests."""
    print("Testing Forgejo API for User and Token Creation")
    print()
    
    # Create user
    if not await test_create_user():
        print("\n⚠ Could not create user, stopping tests")
        return
    
    # Test if admin can list tokens (before creating any)
    await test_list_tokens_admin_api()
    
    # Try admin API for token creation
    admin_token = await test_create_token_admin_api()
    
    # If admin API doesn't work, try user API
    user_token = None
    if not admin_token:
        print("\n⚠ Admin API failed, trying user API...")
        user_token = await test_create_token_user_api()
    
    # Use whichever token we got
    token = admin_token or user_token
    
    # Verify token if we got one
    if token:
        await test_verify_token(token)
    else:
        print("\n✗ No token was created successfully")
    
    # Test if admin can list tokens AFTER creating one
    if token:
        print("\n" + "=" * 60)
        print("Checking if admin can list the created token...")
        print("=" * 60)
        tokens = await test_list_tokens_admin_api()
        if tokens:
            print(f"Found {len(tokens)} token(s)")
    
    # Cleanup
    await test_delete_user()
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if admin_token:
        print("✓ Admin API works! No password needed.")
        print("  - Admin can CREATE tokens via POST")
    elif user_token:
        print("✗ Admin API doesn't work - must use user password")
        print("  - Need User API (Basic Auth) to create tokens")
    else:
        print("✗ Neither method worked for token creation")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
