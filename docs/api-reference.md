# Crontopus API Reference

## Base URL

- **Production**: `https://crontopus.com/api`
- **Local Development**: `http://localhost:8000/api`

## Authentication

Crontopus supports **three authentication methods** depending on the use case:

### 1. JWT Tokens (Web UI & CLI)

**Use Case**: Interactive sessions (web browser, CLI tool)

**How It Works**:
1. User logs in with username/password
2. Backend returns short-lived JWT token (7 days expiry)
3. Token included in `Authorization: Bearer <jwt>` header
4. Token stored in browser localStorage or CLI config file

**Example**:
```bash
# Login
curl -X POST https://crontopus.com/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=alice&password=secret123"

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}

# Use token
curl -X GET https://crontopus.com/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. API Tokens (Programmatic Access)

**Use Case**: CI/CD pipelines, automation scripts, third-party integrations

**Token Format**: `ctp_<random_string>` (like GitHub Personal Access Tokens)

**How It Works**:
1. User creates API token via web UI or API
2. Token shown **once** in plaintext (SHA256 hash stored in database)
3. Token included in `Authorization: Bearer <ctp_token>` header
4. Token can have expiration (90 days, 1 year, never)
5. Backend automatically tracks `last_used_at` for audit trail

**Scopes** (Phase 19 - enforcement planned):
- `read:runs` - Read job run history
- `write:jobs` - Create/update/delete jobs
- `read:agents` - List agents/endpoints
- `write:agents` - Enroll/manage agents
- `read:tokens` - List API tokens
- `write:tokens` - Create/revoke API tokens
- `admin:*` - Full access (all operations)

**Example**:
```bash
# Create API token
curl -X POST https://crontopus.com/api/tokens \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "scopes": ["read:runs", "write:jobs"],
    "expires_in_days": 90
  }'

# Response (plaintext shown ONCE)
{
  "id": 123,
  "name": "CI/CD Pipeline",
  "token": "ctp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789",
  "scopes": ["read:runs", "write:jobs"],
  "expires_at": "2026-02-15T10:30:00Z",
  "created_at": "2025-11-17T10:30:00Z"
}

# Use API token
curl -X GET https://crontopus.com/api/runs \
  -H "Authorization: Bearer ctp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789"
```

### 3. Endpoint Tokens (Agent Authentication)

**Use Case**: Agent enrollment, heartbeats, job check-ins

**How It Works**:
1. Agent enrolls using enrollment token (long-lived)
2. Backend generates unique endpoint token (bcrypt hash stored)
3. Token saved to `~/.crontopus/agent-token` (file permissions 0600)
4. Agent includes token in all API calls
5. Job check-ins validate endpoint token to prevent fake submissions

**Example**:
```bash
# Agent enrollment
curl -X POST https://crontopus.com/api/endpoints/enroll \
  -H "Authorization: Bearer <enrollment_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-server-01",
    "hostname": "web-01.example.com",
    "platform": "linux",
    "git_repo_url": "https://git.crontopus.com/crontopus/job-manifests-alice.git"
  }'

# Response
{
  "id": 456,
  "name": "web-server-01",
  "token": "ep_aBcDeFgHiJkLmNoPqRsTuVwXyZ987654321",
  "git_repo_url": "https://git.crontopus.com/crontopus/job-manifests-alice.git"
}

# Job check-in with endpoint token
curl -X POST https://crontopus.com/api/checkins \
  -H "Authorization: Bearer ep_aBcDeFgHiJkLmNoPqRsTuVwXyZ987654321" \
  -H "Content-Type: application/json" \
  -d '{
    "job_name": "backup-database",
    "namespace": "production",
    "endpoint_id": 456,
    "status": "success",
    "output": "Backup completed successfully",
    "duration": 45.2
  }'
```

---

## Rate Limiting

### Overview

All API endpoints are protected with rate limiting to prevent abuse and DDoS attacks.

**Implementation**: `fastapi-limiter` with Valkey (Redis fork) backend

**Rate Limit Headers**:
```
X-RateLimit-Limit: 60          # Maximum requests allowed in window
X-RateLimit-Remaining: 42      # Requests remaining
X-RateLimit-Reset: 1700000000  # Unix timestamp when limit resets
```

**429 Too Many Requests Response**:
```json
{
  "detail": "Rate limit exceeded: 60 per 1 minute"
}
```

### Rate Limit Table

| Endpoint Type | Limit | Window | Identifier | Reasoning |
|--------------|-------|--------|-----------|-----------||
| `POST /auth/login` | 5 req/min | 1 minute | IP address | Prevent credential stuffing |
| `POST /auth/register` | 3 req/hour | 1 hour | IP address | Prevent spam accounts |
| `GET /auth/me` | 60 req/min | 1 minute | User ID | Standard API usage |
| `POST /checkins` | 100 req/min | 1 minute | Endpoint ID | Support high-frequency jobs |
| `POST /api/jobs` | 30 req/min | 1 minute | User ID | Job creation rate |
| `PUT /api/jobs/{ns}/{name}` | 30 req/min | 1 minute | User ID | Job updates |
| `DELETE /api/jobs/{ns}/{name}` | 30 req/min | 1 minute | User ID | Job deletion |
| `GET /api/runs` | 60 req/min | 1 minute | User ID | Run history queries |
| `GET /api/runs/by-job` | 60 req/min | 1 minute | User ID | Aggregated reports |
| `GET /api/runs/by-endpoint` | 60 req/min | 1 minute | User ID | Aggregated reports |
| `POST /api/endpoints/enroll` | 10 req/min | 1 minute | IP address | Agent enrollment |
| `POST /api/endpoints/{id}/heartbeat` | 120 req/min | 1 minute | Endpoint ID | 2Hz max heartbeat |
| `POST /api/tokens` | 10 req/min | 1 minute | User ID | Token creation |
| `GET /api/tokens` | 60 req/min | 1 minute | User ID | Token listing |
| `POST /api/enrollment-tokens` | 10 req/min | 1 minute | User ID | Enrollment token creation |
| `GET /health` | Unlimited | - | N/A | Monitoring needs |

### Smart Identifier Logic

Rate limits are applied based on the **most specific identifier available**:

1. **User ID** (authenticated requests with JWT or API token)
2. **Endpoint ID** (agent requests with endpoint token)
3. **IP Address** (unauthenticated requests or fallback)

This ensures fair rate limiting per entity while preventing IP-based bypasses.

### Handling Rate Limits

**Best Practices**:

1. **Respect Retry-After Header**:
```bash
# Check Retry-After header in 429 response
curl -i https://crontopus.com/api/runs
# HTTP/1.1 429 Too Many Requests
# Retry-After: 30
```

2. **Implement Exponential Backoff**:
```python
import time
import requests

def call_api_with_backoff(url, headers, max_retries=5):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            wait_time = retry_after * (2 ** attempt)  # Exponential backoff
            print(f"Rate limited. Waiting {wait_time}s...")
            time.sleep(wait_time)
            continue
            
        return response
    
    raise Exception("Max retries exceeded")
```

3. **Monitor Rate Limit Headers**:
```python
response = requests.get(url, headers=headers)
remaining = int(response.headers.get('X-RateLimit-Remaining', 0))

if remaining < 10:
    print(f"Warning: Only {remaining} requests remaining in window")
```

4. **Batch Operations**:
```bash
# Bad: 100 individual API calls
for job in jobs:
    curl https://crontopus.com/api/jobs/$job

# Good: Use list endpoints with filtering
curl "https://crontopus.com/api/runs?limit=100&namespace=production"
```

---

## Security Best Practices

### Token Management

1. **Never Commit Tokens to Git**:
```bash
# Bad
git add config.yaml  # Contains API token

# Good
echo "*.token" >> .gitignore
echo "config.yaml" >> .gitignore
```

2. **Use Environment Variables**:
```bash
# Export token
export CRONTOPUS_API_TOKEN="ctp_aBcDeFgHiJkLmNoPqRsTuVwXyZ"

# Use in scripts
curl -H "Authorization: Bearer $CRONTOPUS_API_TOKEN" ...
```

3. **Rotate Tokens Regularly**:
```bash
# Create new token
NEW_TOKEN=$(curl -X POST https://crontopus.com/api/tokens \
  -H "Authorization: Bearer <jwt>" \
  -d '{"name": "CI/CD", "expires_in_days": 90}' | jq -r '.token')

# Update CI/CD secrets
# ...

# Revoke old token
curl -X DELETE https://crontopus.com/api/tokens/123 \
  -H "Authorization: Bearer <jwt>"
```

4. **Principle of Least Privilege**:
```bash
# Bad: admin:* scope for CI/CD
{
  "scopes": ["admin:*"]
}

# Good: Only required scopes
{
  "scopes": ["read:runs", "write:jobs"]
}
```

### HTTPS Enforcement

**Always use HTTPS in production**:
```bash
# Bad
curl http://crontopus.com/api/auth/login

# Good
curl https://crontopus.com/api/auth/login
```

### Error Handling

**Never log tokens**:
```python
# Bad
logging.info(f"Using token: {token}")

# Good
logging.info("Authenticating with API token")
```

---

## Integration Examples

### GitHub Actions CI/CD

```yaml
name: Deploy Jobs
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Crontopus
        env:
          CRONTOPUS_TOKEN: ${{ secrets.CRONTOPUS_API_TOKEN }}
        run: |
          curl -X POST https://crontopus.com/api/jobs \
            -H "Authorization: Bearer $CRONTOPUS_TOKEN" \
            -H "Content-Type: application/json" \
            -d @job-manifest.json
```

### Python Script

```python
import requests
import os

API_URL = "https://crontopus.com/api"
API_TOKEN = os.environ["CRONTOPUS_API_TOKEN"]

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Create job
response = requests.post(
    f"{API_URL}/jobs",
    headers=headers,
    json={
        "name": "cleanup-logs",
        "namespace": "production",
        "schedule": "0 3 * * *",
        "command": "/opt/scripts/cleanup.sh"
    }
)

if response.status_code == 201:
    print("Job created successfully")
elif response.status_code == 429:
    retry_after = response.headers.get('Retry-After', 60)
    print(f"Rate limited. Retry after {retry_after} seconds")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

### Bash Script with Error Handling

```bash
#!/bin/bash

API_URL="https://crontopus.com/api"
TOKEN="${CRONTOPUS_API_TOKEN}"

# Function to call API with retry
call_api() {
    local endpoint=$1
    local max_retries=5
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        response=$(curl -s -w "\n%{http_code}" \
            -H "Authorization: Bearer $TOKEN" \
            "${API_URL}${endpoint}")
        
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "200" ]; then
            echo "$body"
            return 0
        elif [ "$http_code" = "429" ]; then
            retry_after=$(echo "$body" | jq -r '.retry_after // 60')
            echo "Rate limited. Waiting ${retry_after}s..." >&2
            sleep "$retry_after"
            ((retry_count++))
        else
            echo "Error: HTTP $http_code - $body" >&2
            return 1
        fi
    done
    
    echo "Max retries exceeded" >&2
    return 1
}

# Use function
call_api "/runs?limit=10"
```

---

## Error Codes

| Code | Meaning | Example |
|------|---------|---------||
| 200 | OK | Successful GET request |
| 201 | Created | Job created successfully |
| 204 | No Content | Token revoked successfully |
| 400 | Bad Request | Invalid JSON or missing required fields |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions (e.g., trying to access another tenant's data) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (e.g., duplicate job name) |
| 422 | Unprocessable Entity | Invalid data (e.g., invalid cron expression) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error (contact support) |

---

## Support

- **Documentation**: https://docs.crontopus.com
- **Issues**: https://github.com/crontopus/crontopus/issues
- **API Status**: https://status.crontopus.com