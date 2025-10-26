# Crontopus Job Manifests

This repository contains job definitions for Crontopus scheduled jobs.

## Structure

```
.
├── production/          # Production jobs
│   ├── backups/        # Backup jobs
│   ├── maintenance/    # Cleanup and maintenance
│   └── monitoring/     # Health checks and monitoring
├── staging/            # Staging environment jobs
└── README.md
```

## Adding a New Job

1. Create a YAML file in the appropriate directory
2. Follow the [Job Manifest Specification](https://github.com/your-org/crontopus/blob/main/docs/job-manifest-spec.md)
3. Test in staging first
4. Create a Pull Request
5. Get approval from team lead
6. Merge to main

## Job Manifest Example

```yaml
apiVersion: v1
kind: Job
metadata:
  name: my-job
  tenant: my-tenant
  labels:
    env: production
    team: platform
spec:
  schedule: "0 2 * * *"
  command: /path/to/script.sh
  checkin:
    enabled: true
    secret: ${MY_JOB_SECRET}
```

## Environment Variables

Jobs can reference environment variables using `${VAR_NAME}` syntax. These should be:
- Configured on the agent host
- Never committed to Git (use secrets management)
- Documented in team wiki

## Best Practices

1. **Test in staging** - Always test jobs in staging before production
2. **Use labels** - Tag jobs with env, team, criticality
3. **Document ownership** - Include owner and oncall in annotations
4. **Set timeouts** - Configure realistic check-in timeouts
5. **Handle failures** - Include retry policies for critical jobs
6. **Version control** - Write meaningful commit messages

## Validation

Validate your job manifests before committing:

```bash
crontopus jobs validate my-job.yaml
```

## Support

- **Documentation:** https://docs.crontopus.example.com
- **Slack:** #crontopus-support
- **Email:** ops-team@acme.com
