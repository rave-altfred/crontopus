# Forgejo Token Setup

The backend needs a Forgejo access token to fetch job manifests from Git.

## 1. Create Forgejo Access Token

1. Visit https://git.crontopus.com and login
2. Click your profile (top right) → **Settings**
3. Go to **Applications** tab
4. Under "Generate New Token":
   - **Token Name**: `crontopus-backend-api`
   - **Select Scopes**: 
     - ✓ `read:repository` (required)
     - ✓ `read:organization` (optional, for private repos)
   - Click **Generate Token**
5. **Copy the token immediately** (you won't see it again!)

## 2. Update App Platform Configuration

### Option A: Update app.yaml (Recommended for GitOps)

```bash
cd infra/app-platform

# Edit app.yaml (this file is gitignored)
nano app.yaml

# Update these values in the backend service envs section:
# - key: FORGEJO_USERNAME
#   scope: RUN_TIME
#   value: "your-actual-username"
#
# - key: FORGEJO_TOKEN
#   scope: RUN_TIME
#   type: SECRET
#   value: "your-actual-token-here"

# Deploy the update
./deploy-app-platform.sh
```

### Option B: Update via Dashboard (Quick)

1. Go to: https://cloud.digitalocean.com/apps/934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f/settings
2. Click on **backend** component
3. Scroll to **Environment Variables**
4. Add/Update:
   - **FORGEJO_USERNAME**: `your-username`
   - **FORGEJO_TOKEN**: `your-token` (mark as Secret)
5. Click **Save**
6. App will automatically redeploy

### Option C: Update via doctl CLI

```bash
# Get current app spec
doctl apps spec get 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f > app.yaml

# Edit the file to add/update Forgejo credentials
# Then update:
doctl apps update 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f --spec app.yaml
```

## 3. Verify Configuration

After updating, check the backend logs:

```bash
# View backend logs
doctl apps logs 934e7b77-38da-49bb-bfcf-0ab6d7b8fa2f backend --follow

# Test the jobs endpoint
curl -H "Authorization: Bearer YOUR_USER_TOKEN" \
  https://crontopus.com/api/jobs
```

## 4. Local Development

For local development, use `.env` file (gitignored):

```bash
cd backend

# Add to .env
echo "FORGEJO_URL=https://git.crontopus.com" >> .env
echo "FORGEJO_USERNAME=your-username" >> .env
echo "FORGEJO_TOKEN=your-token" >> .env
```

## Security Notes

- ✅ Tokens are marked as `type: SECRET` in app.yaml (encrypted at rest)
- ✅ `app.yaml` is in `.gitignore` (never committed)
- ✅ Use `app.yaml.example` as template (without secrets)
- ✅ Tokens have minimal scopes (`read:repository` only)
- ⚠️  Rotate tokens periodically
- ⚠️  Never log or expose tokens in application code

## Token Rotation

To rotate the token:

1. Generate new token in Forgejo (same steps as above)
2. Update app.yaml or dashboard with new token
3. Redeploy
4. Delete old token in Forgejo
