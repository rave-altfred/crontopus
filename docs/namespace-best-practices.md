# Namespace Best Practices for Crontopus

## Overview

Crontopus uses a **flexible namespace system** to organize jobs. Namespaces are simply directories in your Git repository that group related jobs together.

## System Namespaces

There are two **system-managed namespaces** that cannot be deleted:

### `discovered/`
- **Purpose**: Auto-populated by agent discovery
- **Management**: System-managed, read-only
- **Usage**: When agents discover existing cron jobs on endpoints, they create manifests here
- **Adoption**: You can "adopt" discovered jobs to take full control (moves to your namespace)

### `default/`
- **Purpose**: Fallback namespace for jobs without explicit namespace
- **Management**: User-managed
- **Usage**: Good for simple setups or jobs that don't fit other categories

## User Namespaces

You can create **any number of custom namespaces** to organize jobs. Here are common patterns:

### By Environment
```
production/
staging/
development/
qa/
```
**Use when**: You have identical jobs across multiple environments

### By Team
```
team-platform/
team-data/
team-security/
team-devops/
```
**Use when**: Different teams manage different jobs

### By Service
```
api-service/
database-service/
frontend-service/
```
**Use when**: Jobs are tied to specific services or applications

### By Function
```
backups/
monitoring/
maintenance/
reporting/
```
**Use when**: Organizing by job purpose makes sense

### By Customer (Multi-Tenant SaaS)
```
customer-acme/
customer-globex/
customer-initech/
```
**Use when**: Running per-customer scheduled tasks

## Naming Rules

Namespace names must follow Kubernetes-style naming:
- **Pattern**: `^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
- **Max length**: 63 characters
- **Allowed**: Lowercase letters, numbers, hyphens
- **Not allowed**: Uppercase, underscores, spaces, special characters
- **Start/End**: Must start and end with alphanumeric character

**Good Examples**:
- `production`
- `team-platform`
- `backup-jobs`
- `customer-abc123`

**Bad Examples**:
- `Production` (uppercase)
- `team_platform` (underscore)
- `backup jobs` (space)
- `-backups` (starts with hyphen)
- `backups-` (ends with hyphen)

## Reserved Names

The following namespace names are **reserved** and cannot be created:
- `discovered` (system namespace)
- `default` (system namespace)
- `system` (reserved for future use)

## Best Practices

### 1. Start Simple
Don't over-organize initially. Start with just a few namespaces:
```
default/        # Most jobs
production/     # Critical production jobs
staging/        # Testing
```

Add more namespaces as you grow.

### 2. Document Your Strategy
Add a README to your job manifest repository explaining your namespace strategy:

```markdown
# Job Namespace Organization

- **production/**: Production jobs (critical, monitored 24/7)
- **staging/**: Pre-production testing
- **default/**: Non-critical utility jobs
- **team-data/**: ETL and data processing jobs
```

### 3. Use Consistent Patterns
Pick one organizational strategy and stick to it:
- ✅ All by environment OR all by team
- ❌ Mix of patterns (confusing)

### 4. Keep Names Short
Shorter names are easier to type and read:
- ✅ `prod` instead of `production-environment`
- ✅ `db` instead of `database-related-jobs`

### 5. Use Labels for Additional Metadata
Instead of encoding everything in the namespace, use labels:

```yaml
apiVersion: v1
kind: Job
metadata:
  name: backup-postgres
  namespace: backups
  labels:
    env: production          # Environment
    team: platform           # Owning team
    criticality: high        # Priority level
    database: postgres       # Related service
spec:
  schedule: "0 2 * * *"
  command: /scripts/backup.sh
```

This gives you flexible filtering without namespace proliferation.

### 6. Namespace vs Labels: When to Use Each

**Use Namespaces for**:
- Physical separation (different environments)
- Clear ownership boundaries (different teams)
- Major categories (backups vs monitoring)

**Use Labels for**:
- Cross-cutting concerns (all critical jobs)
- Metadata (owner, oncall, docs links)
- Filtering and searching

### 7. Migration Strategy
If migrating from old `production/` and `staging/`:

**Option A: Keep Them** (easiest)
- Production/staging become custom namespaces
- Add discovered/ and default/ alongside them
- No job migration needed

**Option B: Consolidate** (cleaner)
- Move all jobs to `default/`
- Use labels to indicate environment: `env: production`
- Remove empty production/ and staging/ directories

**Option C: Reorganize** (best long-term)
- Create namespaces matching your strategy
- Move jobs systematically
- Document changes in commit messages

## Repository Structure Example

```
job-manifests-{username}/
├── discovered/              # System: Auto-populated by agent
│   └── legacy-cron-job.yaml
├── default/                 # System: Fallback namespace
│   └── utility-cleanup.yaml
├── production/              # User: Production environment
│   ├── api-health-check.yaml
│   ├── database-backup.yaml
│   └── cache-warmup.yaml
├── staging/                 # User: Staging environment
│   └── test-job.yaml
├── team-data/               # User: Data team jobs
│   ├── etl-pipeline.yaml
│   └── report-generator.yaml
└── backups/                 # User: All backup jobs
    ├── backup-postgres.yaml
    ├── backup-redis.yaml
    └── backup-files.yaml
```

## Viewing Namespaces

### Web UI
Jobs page has namespace filter dropdown showing all available namespaces.

### CLI
```bash
# List jobs in specific namespace
crontopus jobs list --namespace production

# List all namespaces
crontopus namespaces list
```

### API
```bash
# List namespaces
GET /api/namespaces

# List jobs in namespace
GET /api/jobs/?namespace=production
```

## Creating Namespaces

### Via Web UI
1. Go to Jobs page
2. Click "Create Job"
3. Enter new namespace name in namespace field
4. Namespace created automatically when job is saved

### Via Git
Just create a directory and commit:
```bash
mkdir -p job-manifests/my-namespace
git add job-manifests/my-namespace
git commit -m "Add my-namespace"
git push
```

### Via API
```bash
POST /api/namespaces
{
  "name": "my-namespace"
}
```

## Deleting Namespaces

**Requirements**:
- Namespace must be empty (no jobs)
- Cannot delete system namespaces (discovered/, default/)

### Via Web UI
1. Go to Namespaces page
2. Select namespace
3. Click "Delete" (only enabled if empty)

### Via API
```bash
DELETE /api/namespaces/my-namespace
```

## Discovered Jobs Workflow

When agent discovers existing cron jobs:

1. **Discovery**: Agent finds job in system crontab
2. **Import**: Creates manifest in `discovered/` namespace
3. **Visibility**: Job appears in UI with purple "Discovered" badge
4. **Decision Time**:
   - **Keep External**: Do nothing, job remains in `discovered/`
   - **Adopt**: Move to managed namespace (production, default, etc.)

### Adopting Discovered Jobs

**Why adopt?**
- Full Crontopus management (wrapping, monitoring, callbacks)
- Modify schedule/command through UI
- Include in alerting and reporting

**How to adopt:**

**Via Web UI** (Coming Soon):
1. View job in Jobs page (discovered namespace)
2. Click "Adopt Job"
3. Choose target namespace (production, default, etc.)
4. Confirm

**Via API**:
```bash
POST /api/jobs/discovered/legacy-job/adopt
{
  "target_namespace": "production"
}
```

After adoption:
- Job moves from `discovered/` to target namespace
- `source: discovered` label removed
- Agent wraps job with callbacks on next sync
- Job becomes fully managed by Crontopus

## Common Scenarios

### Scenario 1: Small Team, Simple Setup
```
discovered/     # External jobs
default/        # Everything else
```

### Scenario 2: Multi-Environment
```
discovered/
default/
production/
staging/
development/
```

### Scenario 3: Large Organization
```
discovered/
default/
team-platform/
team-data/
team-security/
team-devops/
customer-ops/
```

### Scenario 4: Service-Oriented
```
discovered/
default/
api-service/
database-service/
cache-service/
frontend-service/
monitoring/
```

## Migration Checklist

When migrating existing repositories to flexible namespaces:

- [ ] Run migration script: `python scripts/migrate_namespaces.py --dry-run`
- [ ] Review changes
- [ ] Apply migration: `python scripts/migrate_namespaces.py`
- [ ] Verify `discovered/` and `default/` directories exist
- [ ] Decide whether to keep or reorganize production/staging
- [ ] Update agent configurations (if needed)
- [ ] Test job creation in new namespaces
- [ ] Document namespace strategy in repository README

## FAQ

**Q: Can I rename a namespace?**  
A: Not directly. Move all jobs to new namespace, then delete old one.

**Q: What happens to production/staging directories?**  
A: They become custom namespaces. You can keep them or migrate jobs.

**Q: How many namespaces can I have?**  
A: No limit, but keep it manageable (typically 5-15 is reasonable).

**Q: Can namespaces have subdirectories?**  
A: No, flat structure only. Use labels for sub-categorization.

**Q: What if two teams want the same namespace name?**  
A: Use prefixes: `team-platform-prod`, `team-data-prod`

**Q: Can I nest namespaces?**  
A: No. Namespaces are flat. Use naming conventions: `platform-api`, `platform-db`

**Q: Do agents see all namespaces?**  
A: Yes, agents sync entire repository and reconcile all namespaces.

## Further Reading

- [Job Manifest Specification](job-manifest-spec.md)
- [API Reference](api-reference.md)
- [Development Plan: Phase 11](development-plan.md#phase-11)
