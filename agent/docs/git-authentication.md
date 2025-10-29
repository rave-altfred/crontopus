# Agent Git Authentication

The Crontopus agent syncs job manifests from a Git repository (Forgejo). This document explains authentication options.

## Configuration

Add Git settings to your `config.yaml`:

```yaml
git:
  url: "https://git.crontopus.com/crontopus/job-manifests.git"
  branch: "main"
  sync_interval: 30  # seconds
  auth:
    type: "basic"  # basic, ssh, or token
    username: "your-username"
    password: "your-password-or-token"
  local_path: "~/.crontopus/job-manifests"
```

## Authentication Methods

### Option 1: Basic Authentication (Username + Password)

**Pros**: Simple to set up  
**Cons**: Less secure, password in config file

```yaml
git:
  auth:
    type: "basic"
    username: "rave"
    password: "your-password"
```

### Option 2: Access Token (Recommended)

**Pros**: More secure, can be revoked  
**Cons**: Requires token generation

1. In Forgejo: Settings → Applications → Generate New Token
2. Select scope: `read:repository`
3. Use token as password:

```yaml
git:
  auth:
    type: "basic"
    username: "rave"
    password: "ghp_your_access_token_here"
```

### Option 3: SSH Keys (Most Secure)

**Pros**: Most secure, no password storage  
**Cons**: Requires SSH key setup

1. Generate SSH key on agent machine:
```bash
ssh-keygen -t ed25519 -C "crontopus-agent-prod" -f ~/.ssh/crontopus_agent
```

2. Add public key to Forgejo:
   - Go to repository: Settings → Deploy Keys
   - Add: `~/.ssh/crontopus_agent.pub`
   - Read-only access is sufficient

3. Configure agent:
```yaml
git:
  url: "git@git.crontopus.com:crontopus/job-manifests.git"  # Note: SSH URL
  auth:
    type: "ssh"
    key_path: "~/.ssh/crontopus_agent"
```

## Security Best Practices

### For Production Agents

1. **Use Access Tokens or SSH Keys** - Never use password authentication
2. **Read-only Access** - Agents only need to pull, not push
3. **Separate Keys per Agent** - Each agent should have its own deploy key
4. **Rotate Tokens Regularly** - Set up token rotation policy
5. **Secure Config Files** - Set proper permissions:
   ```bash
   chmod 600 ~/.crontopus/config.yaml
   chmod 600 ~/.ssh/crontopus_agent
   ```

### For Development/Testing

Basic authentication is acceptable for local testing:
```yaml
git:
  url: "https://git.crontopus.com/crontopus/job-manifests.git"
  auth:
    type: "basic"
    username: "dev-user"
    password: "dev-password"
```

## Troubleshooting

### Authentication Failed

```
Error: authentication required
```

**Solution**: Verify credentials in config.yaml

### Permission Denied (SSH)

```
Error: permission denied (publickey)
```

**Solution**: 
1. Verify SSH key is added to Forgejo
2. Test SSH connection: `ssh -T git@git.crontopus.com`
3. Check key path in config

### Repository Not Found

```
Error: repository not found
```

**Solution**:
1. Verify repository URL
2. Check repository is accessible (not private without auth)
3. Ensure user has access to repository

## Testing Git Sync

After configuration, test the sync:

```bash
# Start agent
./crontopus-agent --config config.yaml

# Check logs for sync messages
# Should see: "Git sync completed" every 30 seconds

# Verify manifests downloaded
ls ~/.crontopus/job-manifests/production/
```

## Multi-Tenant Configuration

Each tenant can have a separate repository:

```yaml
git:
  url: "https://git.crontopus.com/tenant-name/job-manifests.git"
  branch: "main"
```

Or use branches for environments:
- `production` branch → production agents
- `staging` branch → staging agents

## Advanced: Private Repository Access

For private repositories, the agent needs authentication. Recommended approach:

1. Create a machine user in Forgejo: `crontopus-agent-bot`
2. Generate an access token for this user
3. Add user to repository with read-only access
4. Configure agents with this token

This allows centralized access management and easy revocation.
