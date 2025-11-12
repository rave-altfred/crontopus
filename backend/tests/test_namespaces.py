"""
Tests for namespace CRUD operations.

Tests the flexible namespace system including:
- Listing namespaces
- Creating namespaces with validation
- Deleting namespaces with constraints
- System namespace protection
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException


class TestListNamespaces:
    """Test namespace listing functionality."""
    
    @pytest.mark.asyncio
    async def test_list_namespaces_success(self, client, auth_headers):
        """Test listing namespaces returns discovered and default."""
        mock_tree = [
            {"name": "discovered", "type": "dir"},
            {"name": "default", "type": "dir"},
            {"name": "production", "type": "dir"}
        ]
        
        mock_job_contents = [
            {"name": "job1.yaml", "type": "file"},
            {"name": "job2.yaml", "type": "file"}
        ]
        
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(side_effect=[
                mock_tree,  # Root directory
                mock_job_contents,  # discovered/ contents
                mock_job_contents,  # default/ contents
                mock_job_contents   # production/ contents
            ])
            
            response = client.get("/api/namespaces/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        
        # System namespaces should come first
        assert data[0]["name"] in ["discovered", "default"]
        assert data[0]["is_system"] is True
        assert data[1]["name"] in ["discovered", "default"]
        assert data[1]["is_system"] is True
        
        # User namespace
        assert data[2]["name"] == "production"
        assert data[2]["is_system"] is False
        assert data[2]["job_count"] == 2
    
    @pytest.mark.asyncio
    async def test_list_namespaces_empty_repository(self, client, auth_headers):
        """Test listing namespaces when repository is empty."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(return_value=[])
            
            response = client.get("/api/namespaces/", headers=auth_headers)
        
        assert response.status_code == 200
        assert response.json() == []
    
    @pytest.mark.asyncio
    async def test_list_namespaces_forgejo_error(self, client, auth_headers):
        """Test namespace listing handles Forgejo errors."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(side_effect=Exception("Git error"))
            
            response = client.get("/api/namespaces/", headers=auth_headers)
        
        assert response.status_code == 500
        assert "Failed to list namespaces" in response.json()["detail"]


class TestCreateNamespace:
    """Test namespace creation functionality."""
    
    @pytest.mark.asyncio
    async def test_create_namespace_success(self, client, auth_headers):
        """Test creating a valid namespace."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            # First call checks if exists (returns exception), second creates
            mock_instance.get_repository_tree = AsyncMock(side_effect=Exception("Not found"))
            mock_instance.create_or_update_file = AsyncMock(return_value={"commit": "abc123"})
            
            response = client.post(
                "/api/namespaces/",
                json={"name": "team-platform"},
                headers=auth_headers
            )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "team-platform"
        assert data["is_system"] is False
        assert data["job_count"] == 0
    
    @pytest.mark.asyncio
    async def test_create_namespace_already_exists(self, client, auth_headers):
        """Test creating a namespace that already exists."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(return_value=[
                {"name": ".gitkeep", "type": "file"}
            ])
            
            response = client.post(
                "/api/namespaces/",
                json={"name": "production"},
                headers=auth_headers
            )
        
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]
    
    def test_create_namespace_system_namespace(self, client, auth_headers):
        """Test cannot create system namespaces."""
        response = client.post(
            "/api/namespaces/",
            json={"name": "discovered"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
        assert "system namespace" in response.json()["detail"][0]["msg"]
    
    def test_create_namespace_invalid_name_uppercase(self, client, auth_headers):
        """Test namespace name validation rejects uppercase."""
        response = client.post(
            "/api/namespaces/",
            json={"name": "Production"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
        assert "lowercase" in response.json()["detail"][0]["msg"]
    
    def test_create_namespace_invalid_name_underscore(self, client, auth_headers):
        """Test namespace name validation rejects underscores."""
        response = client.post(
            "/api/namespaces/",
            json={"name": "team_platform"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_create_namespace_invalid_name_space(self, client, auth_headers):
        """Test namespace name validation rejects spaces."""
        response = client.post(
            "/api/namespaces/",
            json={"name": "team platform"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_create_namespace_invalid_name_starts_with_hyphen(self, client, auth_headers):
        """Test namespace name cannot start with hyphen."""
        response = client.post(
            "/api/namespaces/",
            json={"name": "-production"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_create_namespace_invalid_name_ends_with_hyphen(self, client, auth_headers):
        """Test namespace name cannot end with hyphen."""
        response = client.post(
            "/api/namespaces/",
            json={"name": "production-"},
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_create_namespace_invalid_name_too_long(self, client, auth_headers):
        """Test namespace name length limit (63 chars)."""
        long_name = "a" * 64  # 64 chars, over the limit
        response = client.post(
            "/api/namespaces/",
            json={"name": long_name},
            headers=auth_headers
        )
        
        assert response.status_code == 422
        assert "63 characters" in response.json()["detail"][0]["msg"]
    
    def test_create_namespace_valid_names(self, client, auth_headers):
        """Test various valid namespace names."""
        valid_names = [
            "production",
            "team-platform",
            "api-service",
            "backup-jobs",
            "db-maintenance",
            "customer-abc123",
            "prod",
            "dev",
            "qa",
            "staging"
        ]
        
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(side_effect=Exception("Not found"))
            mock_instance.create_or_update_file = AsyncMock(return_value={"commit": "abc123"})
            
            for name in valid_names:
                response = client.post(
                    "/api/namespaces/",
                    json={"name": name},
                    headers=auth_headers
                )
                assert response.status_code == 201, f"Failed for name: {name}"


class TestDeleteNamespace:
    """Test namespace deletion functionality."""
    
    @pytest.mark.asyncio
    async def test_delete_namespace_success(self, client, auth_headers):
        """Test deleting an empty namespace."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            # Namespace exists but is empty (only .gitkeep)
            mock_instance.get_repository_tree = AsyncMock(return_value=[
                {"name": ".gitkeep", "type": "file"}
            ])
            mock_instance.delete_file = AsyncMock(return_value={"commit": "xyz789"})
            
            response = client.delete("/api/namespaces/old-namespace", headers=auth_headers)
        
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
    
    def test_delete_namespace_system_discovered(self, client, auth_headers):
        """Test cannot delete discovered system namespace."""
        response = client.delete("/api/namespaces/discovered", headers=auth_headers)
        
        assert response.status_code == 400
        assert "Cannot delete system namespace" in response.json()["detail"]
    
    def test_delete_namespace_system_default(self, client, auth_headers):
        """Test cannot delete default system namespace."""
        response = client.delete("/api/namespaces/default", headers=auth_headers)
        
        assert response.status_code == 400
        assert "Cannot delete system namespace" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_delete_namespace_not_found(self, client, auth_headers):
        """Test deleting non-existent namespace."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(side_effect=Exception("Not found"))
            
            response = client.delete("/api/namespaces/nonexistent", headers=auth_headers)
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_delete_namespace_with_jobs(self, client, auth_headers):
        """Test cannot delete namespace containing jobs."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            # Namespace has jobs
            mock_instance.get_repository_tree = AsyncMock(return_value=[
                {"name": ".gitkeep", "type": "file"},
                {"name": "job1.yaml", "type": "file"},
                {"name": "job2.yaml", "type": "file"}
            ])
            
            response = client.delete("/api/namespaces/production", headers=auth_headers)
        
        assert response.status_code == 400
        assert "Cannot delete namespace with" in response.json()["detail"]
        assert "2 jobs" in response.json()["detail"]


class TestNamespaceAuth:
    """Test namespace authorization and tenant isolation."""
    
    def test_namespace_requires_auth(self, client):
        """Test namespace endpoints require authentication."""
        # List
        response = client.get("/api/namespaces/")
        assert response.status_code == 401
        
        # Create
        response = client.post("/api/namespaces/", json={"name": "test"})
        assert response.status_code == 401
        
        # Delete
        response = client.delete("/api/namespaces/test")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_namespace_tenant_isolation(self, client, test_user, test_tenant, db):
        """Test namespaces are tenant-isolated."""
        from crontopus_api.models import Tenant, User
        from crontopus_api.security.jwt import create_access_token
        from crontopus_api.security.password import get_password_hash
        
        # Create second tenant and user
        tenant2 = Tenant(id="tenant-2", name="Tenant 2", is_active=True)
        db.add(tenant2)
        db.commit()
        
        user2 = User(
            email="user2@example.com",
            username="user2",
            hashed_password=get_password_hash("password"),
            tenant_id=tenant2.id,
            is_active=True
        )
        db.add(user2)
        db.commit()
        
        token2 = create_access_token({
            "sub": str(user2.id),
            "user_id": user2.id,
            "tenant_id": user2.tenant_id
        })
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            mock_instance.get_repository_tree = AsyncMock(return_value=[
                {"name": "discovered", "type": "dir"},
                {"name": "default", "type": "dir"}
            ])
            
            # User 1's namespaces
            response1 = client.get("/api/namespaces/", headers={"Authorization": f"Bearer {create_access_token({'sub': str(test_user.id), 'user_id': test_user.id, 'tenant_id': test_user.tenant_id})}"})
            
            # User 2's namespaces
            response2 = client.get("/api/namespaces/", headers=headers2)
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Both should call get_repository_tree with their respective tenant repos
        calls = mock_instance.get_repository_tree.call_args_list
        
        # Verify correct repo names were used (tenant-specific)
        assert any("test-tenant" in str(call) for call in calls)
        assert any("tenant-2" in str(call) for call in calls)


class TestNamespaceIntegration:
    """Integration tests for namespace workflows."""
    
    @pytest.mark.asyncio
    async def test_namespace_lifecycle(self, client, auth_headers):
        """Test complete namespace lifecycle: create, use, delete."""
        with patch('crontopus_api.routes.namespaces.ForgejoClient') as mock_forgejo:
            mock_instance = mock_forgejo.return_value
            
            # Step 1: Create namespace
            mock_instance.get_repository_tree = AsyncMock(side_effect=Exception("Not found"))
            mock_instance.create_or_update_file = AsyncMock(return_value={"commit": "abc123"})
            
            create_response = client.post(
                "/api/namespaces/",
                json={"name": "test-namespace"},
                headers=auth_headers
            )
            assert create_response.status_code == 201
            
            # Step 2: List namespaces (should include new one)
            mock_instance.get_repository_tree = AsyncMock(return_value=[
                {"name": "discovered", "type": "dir"},
                {"name": "default", "type": "dir"},
                {"name": "test-namespace", "type": "dir"}
            ])
            
            list_response = client.get("/api/namespaces/", headers=auth_headers)
            assert list_response.status_code == 200
            names = [ns["name"] for ns in list_response.json()]
            assert "test-namespace" in names
            
            # Step 3: Delete namespace (empty)
            mock_instance.get_repository_tree = AsyncMock(return_value=[
                {"name": ".gitkeep", "type": "file"}
            ])
            mock_instance.delete_file = AsyncMock(return_value={"commit": "xyz789"})
            
            delete_response = client.delete("/api/namespaces/test-namespace", headers=auth_headers)
            assert delete_response.status_code == 200
