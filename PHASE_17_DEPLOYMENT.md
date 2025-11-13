# Phase 17: Rate Limiting - Production Deployment

## Configuration

### Valkey Database Assignment
- **Database Index**: `3` (empty, reserved for Crontopus rate limiting)
- **Connection String**: Stored in DigitalOcean App Platform environment variables
- **Other databases in use**: 
  - db0: 1 key
  - db1: 44 keys (other services)
  - db2: 8 keys (other services)

### Environment Variables for App Platform

Add these environment variables to the Crontopus backend service:

```bash
REDIS_URL=<Valkey private connection string from DO dashboard>
REDIS_DATABASE=3
```

**Note**: Connection string contains sensitive credentials and should only be added via DigitalOcean console or secure deployment scripts.

## Deployment Steps

### 1. Update requirements.txt
Already committed with slowapi and redis dependencies.

### 2. Add Environment Variables to App Platform

Via DigitalOcean Console:
1. Go to Apps → crontopus-app
2. Select backend component
3. Add environment variables:
   - `REDIS_URL` = (private connection string above)
   - `REDIS_DATABASE` = `3`
4. Save and trigger deployment

Via `doctl` CLI:
```bash
# Update app spec with environment variables
doctl apps update 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --spec app.yaml

# Create new deployment
doctl apps create-deployment 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --wait
```

### 3. Verify Deployment

After deployment completes:

```bash
# Test health endpoint (no rate limit)
curl https://crontopus.com/health

# Test rate limiting on login (5 attempts allowed)
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST https://crontopus.com/api/auth/login \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=test&password=test" \
    -w "\nHTTP: %{http_code}\n"
  sleep 1
done
# Should see 401 for first 5, then 429 on 6th
```

## Rate Limits

| Endpoint | Limit | Reasoning |
|----------|-------|-----------|
| POST /auth/login | 5/minute per IP | Prevent brute force |
| POST /auth/register | 3/hour per IP | Prevent spam accounts |
| POST /runs/check-in | 100/minute per endpoint | Support high-frequency jobs |
| GET /api/* (authenticated) | 60/minute per user | Standard API usage |
| GET /api/* (unauthenticated) | 10/minute per IP | Prevent enumeration |
| GET /health | unlimited | Monitoring needs |

## Monitoring

Rate limit metrics are stored in Valkey database 3:
- Keys follow pattern: `LIMITER:<endpoint>:<identifier>`
- TTL matches rate limit window (60 seconds for /minute, 3600 for /hour)
- Can monitor with: `redis-cli -u <connection> -n 3 KEYS "LIMITER:*"`

## Rollback Plan

If rate limiting causes issues:

1. Remove environment variables:
   ```bash
   # Remove REDIS_URL and REDIS_DATABASE from App Platform
   ```

2. Revert to previous deployment:
   ```bash
   # Code still works without Redis - will fail gracefully
   # Or revert commits:
   git revert HEAD~3..HEAD
   git push origin main
   ```

## Security Benefits

✅ **DDoS Protection**: Rate limits prevent overwhelming the API  
✅ **Brute Force Prevention**: Login limited to 5 attempts/minute  
✅ **Spam Prevention**: Registration limited to 3/hour  
✅ **Resource Protection**: All endpoints have reasonable limits  
✅ **Graceful Degradation**: Returns 429 with Retry-After header  

## Next Steps (Phase 17.1 & 17.2)

After rate limiting is stable:
1. **Phase 17.1**: Add endpoint token authentication to check-in endpoint
2. **Phase 17.2**: Implement user API tokens for programmatic access
