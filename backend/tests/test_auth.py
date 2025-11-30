"""
Tests for authentication endpoints.
"""
import pytest
from crontopus_api.models import User


class TestRegister:
    """Tests for user registration."""
    
    def test_register_new_user(self, client, test_tenant):
        """Test successful user registration."""
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "new@example.com"
        assert data["tenant_id"] == "newuser"  # Tenant ID matches username
        assert data["is_active"] is True
        assert "password" not in data
        assert "hashed_password" not in data
    
    def test_register_creates_tenant_if_not_exists(self, client):
        """Test that registration creates tenant if it doesn't exist."""
        user_data = {
            "username": "newuser2",
            "email": "new2@example.com",
            "password": "password123"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["tenant_id"] == "newuser2"
    
    def test_register_duplicate_username(self, client, test_user):
        """Test registration with duplicate username fails."""
        user_data = {
            "username": test_user.username,
            "email": "different@example.com",
            "password": "password123"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_register_duplicate_email(self, client, test_user):
        """Test registration with duplicate email fails."""
        user_data = {
            "username": "differentuser",
            "email": test_user.email,
            "password": "password123"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_register_short_password(self, client, test_tenant):
        """Test registration with password < 8 chars fails."""
        user_data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "short"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 422
    
    def test_register_missing_fields(self, client):
        """Test registration with missing required fields."""
        user_data = {
            "username": "newuser"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        
        assert response.status_code == 422


class TestLogin:
    """Tests for user login."""
    
    def test_login_success(self, client, test_user):
        """Test successful login returns token."""
        credentials = {
            "username": test_user.username,
            "password": "testpassword"
        }
        
        response = client.post("/api/auth/login", data=credentials)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0
    
    def test_login_wrong_password(self, client, test_user):
        """Test login with wrong password fails."""
        credentials = {
            "username": test_user.username,
            "password": "wrongpassword"
        }
        
        response = client.post("/api/auth/login", data=credentials)
        
        assert response.status_code == 401
        assert "Incorrect" in response.json()["detail"]
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user fails."""
        credentials = {
            "username": "nonexistent",
            "password": "password"
        }
        
        response = client.post("/api/auth/login", data=credentials)
        
        assert response.status_code == 401
        assert "Incorrect" in response.json()["detail"]
    
    def test_login_inactive_user(self, client, db, test_user):
        """Test login with inactive user fails."""
        # Deactivate user
        test_user.is_active = False
        db.commit()
        
        credentials = {
            "username": test_user.username,
            "password": "testpassword"
        }
        
        response = client.post("/api/auth/login", data=credentials)
        
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()
    
    def test_login_missing_fields(self, client):
        """Test login with missing fields."""
        credentials = {
            "username": "testuser"
        }
        
        response = client.post("/api/auth/login", data=credentials)
        
        assert response.status_code == 422


class TestAuthentication:
    """Tests for authentication middleware."""
    
    def test_protected_endpoint_with_valid_token(self, client, auth_headers):
        """Test accessing protected endpoint with valid token."""
        response = client.get("/api/runs", headers=auth_headers)
        
        assert response.status_code == 200
    
    def test_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without token."""
        response = client.get("/api/runs")
        
        assert response.status_code == 403
    
    def test_protected_endpoint_with_invalid_token(self, client):
        """Test accessing protected endpoint with invalid token."""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = client.get("/api/runs", headers=headers)
        
        assert response.status_code == 401
