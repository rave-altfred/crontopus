# Job Manifest Specification

## Overview

Job manifests are YAML files stored in Git (Forgejo) that define scheduled jobs. The agent reads these manifests, parses them, and creates corresponding entries in the native OS scheduler (cron/Task Scheduler).

**Key Principles:**
- Jobs are defined as code (YAML)
- All changes go through Git workflow (commits, PRs, reviews)
- Agent pulls manifests from Git repository
- No job CRUD API endpoints (jobs are NOT in database)

---

## Manifest Structure

### Minimal Example

```yaml
apiVersion: v1
kind: Job
metadata:
  name: daily-backup
  tenant: acme-corp
spec:
  schedule: "0 2 * * *"
  command: /opt/scripts/backup.sh
```

### Complete Example

```yaml
apiVersion: v1
kind: Job
metadata:
  name: daily-backup
  tenant: acme-corp
  labels:
    env: production
    team: platform
    criticality: high
  annotations:
    owner: ops-team@acme.com
    oncall: https://pagerduty.com/...
    docs: https://wiki.acme.com/backups
spec:
  # Schedule (cron expression)
  schedule: "0 2 * * *"
  timezone: America/New_York
  
  # Execution
  command: /opt/scripts/backup.sh
  args:
    - --database=prod
    - --retention=30d
  workingDir: /opt/backups
  
  # Environment variables
  env:
    BACKUP_TARGET: s3://backups-prod
    NOTIFY_EMAIL: ops@acme.com
  
  # Check-in configuration (for run tracking)
  checkin:
    enabled: true
    secret: ${CHECKIN_SECRET}  # from environment or secret manager
    timeout: 3600  # seconds (1 hour)
  
  # Retry policy
  retry:
    enabled: true
    attempts: 3
    backoff: exponential
  
  # Agent assignment (optional)
  agent:
    selector:
      hostname: backup-server-01
      # or labels:
      #   role: backup
  
  # Control flags
  enabled: true
  paused: false
```

---

## Field Reference

### `apiVersion` (required)
- **Type:** string
- **Values:** `v1`
- **Description:** Manifest schema version

### `kind` (required)
- **Type:** string
- **Values:** `Job`
- **Description:** Resource type

### `metadata` (required)

#### `metadata.name` (required)
- **Type:** string
- **Pattern:** `^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
- **Max length:** 63 characters
- **Description:** Unique job identifier (within tenant)
- **Examples:** `daily-backup`, `hourly-cleanup`, `weekly-report`

#### `metadata.tenant` (required)
- **Type:** string
- **Description:** Tenant identifier (for multi-tenancy)
- **Example:** `acme-corp`, `contoso-ltd`

#### `metadata.labels` (optional)
- **Type:** map[string]string
- **Description:** Key-value pairs for categorization and filtering
- **Common labels:**
  - `env`: `production`, `staging`, `development`
  - `team`: `platform`, `data`, `security`
  - `criticality`: `high`, `medium`, `low`

#### `metadata.annotations` (optional)
- **Type:** map[string]string
- **Description:** Non-identifying metadata (documentation, contact info)

### `spec` (required)

#### `spec.schedule` (required)
- **Type:** string
- **Format:** 5-field cron expression: `minute hour day month weekday`
- **Description:** When the job should run
- **Examples:**
  - `0 * * * *` - Every hour at minute 0
  - `0 2 * * *` - Every day at 2:00 AM
  - `0 0 * * 0` - Every Sunday at midnight
  - `*/15 * * * *` - Every 15 minutes
  - `0 9-17 * * 1-5` - Every hour from 9 AM to 5 PM, Monday-Friday

#### `spec.timezone` (optional)
- **Type:** string
- **Default:** `UTC`
- **Description:** Timezone for schedule evaluation
- **Examples:** `UTC`, `America/New_York`, `Europe/London`, `Asia/Tokyo`

#### `spec.command` (required)
- **Type:** string
- **Description:** Command or script to execute
- **Examples:**
  - `/opt/scripts/backup.sh`
  - `/usr/bin/python3 /app/process.py`
  - `docker run --rm myimage:latest`

#### `spec.args` (optional)
- **Type:** array[string]
- **Description:** Arguments passed to the command
- **Example:**
  ```yaml
  args:
    - --config=/etc/app/config.yaml
    - --verbose
  ```

#### `spec.workingDir` (optional)
- **Type:** string
- **Default:** User's home directory
- **Description:** Working directory for command execution

#### `spec.env` (optional)
- **Type:** map[string]string
- **Description:** Environment variables for the job
- **Example:**
  ```yaml
  env:
    LOG_LEVEL: debug
    API_URL: https://api.example.com
  ```

#### `spec.checkin` (optional)

##### `spec.checkin.enabled`
- **Type:** boolean
- **Default:** `true`
- **Description:** Whether job reports execution results

##### `spec.checkin.secret`
- **Type:** string
- **Description:** Secret token for authenticated check-ins
- **Note:** Can use `${VAR}` syntax for environment variable substitution

##### `spec.checkin.timeout`
- **Type:** integer
- **Default:** `3600` (1 hour)
- **Description:** Maximum expected runtime (seconds)

#### `spec.retry` (optional)

##### `spec.retry.enabled`
- **Type:** boolean
- **Default:** `false`
- **Description:** Whether to retry failed executions

##### `spec.retry.attempts`
- **Type:** integer
- **Default:** `3`
- **Description:** Maximum retry attempts

##### `spec.retry.backoff`
- **Type:** string
- **Values:** `fixed`, `exponential`
- **Default:** `exponential`

#### `spec.agent` (optional)

##### `spec.agent.selector`
- **Type:** map[string]string
- **Description:** Agent selection criteria
- **Examples:**
  ```yaml
  selector:
    hostname: backup-server-01
  ```
  or
  ```yaml
  selector:
    role: database
    region: us-west
  ```

#### `spec.enabled` (optional)
- **Type:** boolean
- **Default:** `true`
- **Description:** Whether job is active

#### `spec.paused` (optional)
- **Type:** boolean
- **Default:** `false`
- **Description:** Temporarily suspend execution (keeps scheduler entry)

---

## Repository Structure

```
job-manifests/
├── production/
│   ├── backups/
│   │   ├── daily-db-backup.yaml
│   │   ├── hourly-incremental.yaml
│   │   └── weekly-full-backup.yaml
│   ├── maintenance/
│   │   ├── cleanup-logs.yaml
│   │   └── rotate-certificates.yaml
│   └── monitoring/
│       ├── health-check.yaml
│       └── metrics-export.yaml
├── staging/
│   └── test-jobs/
│       └── sample-job.yaml
└── README.md
```

---

## Validation Rules

1. **Name uniqueness:** Job names must be unique within a tenant
2. **Cron validation:** Schedule must be valid 5-field cron expression
3. **Command existence:** Command path should be absolute or in PATH
4. **Tenant isolation:** Jobs can only be assigned to agents in same tenant
5. **Schema version:** Only `v1` currently supported

---

## Check-in Integration

Jobs should include check-in logic at the end of execution:

```bash
#!/bin/bash
# /opt/scripts/backup.sh

set -e

# Your backup logic here
echo "Running backup..."
perform_backup

# Report success
curl -X POST "https://api.crontopus.example.com/api/checkins" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CHECKIN_SECRET}" \
  -d '{
    "job_name": "daily-backup",
    "tenant": "acme-corp",
    "status": "success",
    "output": "Backup completed successfully",
    "duration": 120
  }'
```

---

## Best Practices

1. **Use labels:** Tag jobs with environment, team, and criticality
2. **Document ownership:** Use annotations for contact info and docs
3. **Version control:** Commit messages should explain job changes
4. **Test in staging:** Create staging versions of production jobs
5. **Set timeouts:** Configure realistic check-in timeouts
6. **Handle errors:** Include check-in calls in error handlers
7. **Use secrets safely:** Never commit secrets; use environment variables

---

## Future Enhancements

- Job dependencies (`spec.dependsOn`)
- Concurrency policies (`spec.concurrency`)
- Success/failure hooks (`spec.hooks`)
- Resource limits (`spec.resources`)
- Notification rules (`spec.alerts`)
