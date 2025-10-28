# Agent Testing Guide

This guide walks through testing the Crontopus agent with the full backend integration.

## Test Repository

Job manifests are stored in: https://github.com/rave-altfred/crontopus-test-jobs

The repository contains:
- **3 active jobs** that should be scheduled:
  - `daily-cleanup`: Runs at 2:00 AM daily
  - `hourly-healthcheck`: Runs every hour
  - `frequent-logs`: Runs every 5 minutes
  - `staging-test`: Runs every minute (staging)
- **1 paused job** that should NOT be scheduled:
  - `paused-backup`: Paused, should be ignored

## Prerequisites

1. **Backend running**:
   ```bash
   cd backend
   uvicorn crontopus_api.main:app --reload
   ```

2. **User authenticated**:
   ```bash
   cd cli
   python3 -m main auth login
   # Follow prompts to create user and login
   ```

## Quick Test

```bash
cd agent
./test-agent.sh
```

This script will:
1. Verify backend is running
2. Check CLI authentication
3. Configure agent with your enrollment token
4. Clean up any existing test data
5. Build and start the agent
6. Watch agent sync jobs from Git and schedule them

## Manual Testing Steps

### 1. Configure Agent

Edit `config-test.yaml` and add your enrollment token from CLI login:

```yaml
backend:
  api_url: http://localhost:8000
  enrollment_token: "YOUR_TOKEN_HERE"  # From ~/.crontopus/token
```

### 2. Start Agent

```bash
go build -o build/crontopus-agent ./cmd/crontopus-agent
./build/crontopus-agent --config config-test.yaml
```

### 3. Verify Jobs Scheduled

Check crontab to verify 4 jobs were added (3 production + 1 staging):

```bash
crontab -l | grep CRONTOPUS
```

Expected output:
```
0 2 * * * /bin/bash -c echo "Running daily cleanup at $(date)" && sleep 2 && echo "Cleanup complete" # CRONTOPUS:daily-cleanup
0 * * * * /usr/bin/curl -s -o /dev/null -w "%{http_code}" https://example.com/health # CRONTOPUS:hourly-healthcheck
*/5 * * * * /bin/echo "Log rotation check at $(date)" # CRONTOPUS:frequent-logs
* * * * * /bin/date # CRONTOPUS:staging-test
```

Note: `paused-backup` should NOT appear (it's paused).

### 4. Test Git Sync and Reconciliation

#### Add a New Job

```bash
cd /tmp/crontopus-test-jobs

cat > production/new-job.yaml <<EOF
apiVersion: v1
kind: Job
metadata:
  name: test-new-job
  tenant: test-tenant
spec:
  schedule: "*/2 * * * *"
  command: /bin/echo
  args:
    - "New job running"
  enabled: true
EOF

git add production/new-job.yaml
git commit -m "Add new test job"
git push
```

Wait 10 seconds (sync interval), then verify:
```bash
crontab -l | grep test-new-job
```

#### Modify Existing Job

```bash
cd /tmp/crontopus-test-jobs

# Change frequent-logs from */5 to */10
sed -i '' 's/\*\/5/\*\/10/' production/frequent-logs.yaml
git commit -am "Change frequency of log job"
git push
```

Wait 10 seconds, then verify:
```bash
crontab -l | grep frequent-logs
# Should show */10 now
```

#### Remove a Job

```bash
cd /tmp/crontopus-test-jobs

git rm production/hourly-healthcheck.yaml
git commit -m "Remove healthcheck job"
git push
```

Wait 10 seconds, then verify:
```bash
crontab -l | grep hourly-healthcheck
# Should return nothing
```

### 5. Monitor Agent Logs

Watch the agent output to see:
- Git sync every 10 seconds
- Drift detection
- Reconciliation when changes detected
- Changes applied

## Verify Backend Integration

### Check Agent Enrollment

```bash
cd cli
python3 -m main agents list
```

Should show your test agent.

### Check Heartbeats

The agent sends heartbeats every 30 seconds. Check the backend logs to see heartbeat requests.

## Cleanup

Remove all test jobs from crontab:

```bash
crontab -l | grep -v "# CRONTOPUS:" | crontab -
```

Remove agent data:

```bash
rm -rf .crontopus/
```

## Troubleshooting

### Agent fails to enroll
- Verify backend is running: `curl http://localhost:8000/health`
- Verify enrollment token is correct: `cat ~/.crontopus/token`
- Check backend logs for enrollment errors

### Jobs not appearing in crontab
- Check agent logs for parsing errors
- Verify job manifests are valid YAML
- Check that jobs are `enabled: true` and not `paused: true`

### Git sync fails
- Verify repository URL is accessible: `git ls-remote https://github.com/rave-altfred/crontopus-test-jobs.git`
- Check agent has write permissions to local_path directory
- Review agent logs for Git errors

## Next Steps

After successful testing:
1. Test on Linux with different cron implementations
2. Test on Windows with Task Scheduler
3. Test multi-tenant job isolation
4. Test job check-in functionality
5. Add CI/CD for job manifest validation
