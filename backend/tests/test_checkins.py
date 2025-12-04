"""
Tests for check-in and run history endpoints.
"""
import pytest
from datetime import datetime, timedelta

from crontopus_api.models import JobRun, JobStatus, Tenant
from crontopus_api.security.jwt import create_access_token


class TestCheckIn:
    """Tests for POST /api/checkins endpoint."""
    
    def test_successful_checkin(self, client, test_tenant):
        """Test successful job check-in."""
        checkin_data = {
            "job_name": "backup-db",
            "tenant": test_tenant.id,
            "status": "success",
            "started_at": "2024-01-15T10:00:00",
            "finished_at": "2024-01-15T10:05:00",
            "duration": 300,
            "output": "Backup completed successfully",
            "exit_code": 0,
            "agent_id": "agent-001"
        }
        
        response = client.post("/api/checkins", json=checkin_data)
        
        assert response.status_code == 201
        data = response.json()
        assert "run_id" in data
        assert data["message"] == "Check-in recorded successfully"
    
    def test_minimal_checkin(self, client, test_tenant):
        """Test check-in with only required fields."""
        checkin_data = {
            "job_name": "minimal-job",
            "tenant": test_tenant.id,
            "status": "running",
            "started_at": "2024-01-15T10:00:00"
        }
        
        response = client.post("/api/checkins", json=checkin_data)
        
        if response.status_code != 201:
            print("Validation error:", response.json())
        
        assert response.status_code == 201
        data = response.json()
        assert "run_id" in data
    
    def test_failed_checkin(self, client, test_tenant):
        """Test check-in for failed job."""
        checkin_data = {
            "job_name": "failing-job",
            "tenant": test_tenant.id,
            "status": "failure",
            "error_message": "Connection timeout",
            "exit_code": 1,
            "started_at": "2024-01-15T10:00:00",
            "finished_at": "2024-01-15T10:00:30",
            "duration": 30
        }
        
        response = client.post("/api/checkins", json=checkin_data)
        
        assert response.status_code == 201
        data = response.json()
        assert "run_id" in data
    
    def test_invalid_status(self, client, test_tenant):
        """Test check-in with invalid status."""
        checkin_data = {
            "job_name": "test-job",
            "tenant": test_tenant.id,
            "status": "invalid-status"
        }
        
        response = client.post("/api/checkins", json=checkin_data)
        
        assert response.status_code == 422  # Validation error
    
    def test_missing_required_fields(self, client):
        """Test check-in with missing required fields."""
        checkin_data = {
            "job_name": "test-job"
        }
        
        response = client.post("/api/checkins", json=checkin_data)
        
        assert response.status_code == 422


class TestRunHistory:
    """Tests for run history endpoints."""
    
    @pytest.fixture
    def sample_runs(self, db, test_tenant):
        """Create sample job runs for testing."""
        runs = []
        statuses = [JobStatus.SUCCESS, JobStatus.FAILURE, JobStatus.RUNNING]
        
        for i in range(10):
            run = JobRun(
                tenant_id=test_tenant.id,
                job_name=f"job-{i % 3}",  # 3 different jobs
                status=statuses[i % 3],
                started_at=datetime.utcnow() - timedelta(hours=i),
                finished_at=datetime.utcnow() - timedelta(hours=i) + timedelta(minutes=5),
                duration=300,
                output=f"Output for run {i}",
                exit_code=0 if i % 3 == 0 else 1,
                agent_id="agent-001"
            )
            db.add(run)
            runs.append(run)
        
        db.commit()
        for run in runs:
            db.refresh(run)
        
        return runs
    
    def test_list_all_runs(self, client, auth_headers, sample_runs):
        """Test listing all runs for tenant."""
        response = client.get("/api/runs", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "runs" in data
        assert "total" in data
        assert data["total"] == 10
        assert data["page"] == 1
        assert data["page_size"] == 100  # Default limit is 100
        assert len(data["runs"]) == 10
    
    def test_list_runs_limit(self, client, auth_headers, sample_runs):
        """Test limiting run list size."""
        response = client.get(
            "/api/runs?limit=5",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["runs"]) == 5
        assert data["total"] == 10
        assert data["page"] == 1
        assert data["page_size"] == 5
    
    def test_filter_runs_by_job_name(self, client, auth_headers, sample_runs):
        """Test filtering runs by job name."""
        response = client.get(
            "/api/runs?job_name=job-0",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # job-0, job-3, job-6, job-9 = 4 runs
        assert data["total"] == 4
        for run in data["runs"]:
            assert run["job_name"] == "job-0"
    
    def test_filter_runs_by_status(self, client, auth_headers, sample_runs):
        """Test filtering runs by status."""
        response = client.get(
            "/api/runs?status=success",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Every 3rd run is success (0, 3, 6, 9)
        assert data["total"] == 4
        for run in data["runs"]:
            assert run["status"] == "success"
    
    def test_get_specific_run(self, client, auth_headers, sample_runs):
        """Test getting details of a specific run."""
        run_id = sample_runs[0].id
        
        response = client.get(f"/api/runs/{run_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == run_id
        assert data["job_name"] == sample_runs[0].job_name
        assert data["status"] == sample_runs[0].status.value
    
    def test_get_nonexistent_run(self, client, auth_headers):
        """Test getting a run that doesn't exist."""
        response = client.get("/api/runs/99999", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_tenant_isolation(self, client, db, test_user):
        """Test that users can only see runs from their own tenant."""
        # Create another tenant and run
        other_tenant = Tenant(
            id="other-tenant",
            name="Other Tenant",
            is_active=True
        )
        db.add(other_tenant)
        db.commit()
        
        other_run = JobRun(
            tenant_id=other_tenant.id,
            job_name="other-job",
            status=JobStatus.SUCCESS,
            started_at=datetime.utcnow(),
            duration=100
        )
        db.add(other_run)
        db.commit()
        db.refresh(other_run)
        
        # Try to access other tenant's run
        token = create_access_token({
            "sub": str(test_user.id),
            "user_id": test_user.id,
            "tenant_id": test_user.tenant_id
        })
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(f"/api/runs/{other_run.id}", headers=headers)
        
        assert response.status_code == 404
    
    def test_unauthorized_access(self, client):
        """Test accessing runs without authentication."""
        response = client.get("/api/runs")
        
        # HTTPBearer returns 403 when no credentials provided
        assert response.status_code == 403
