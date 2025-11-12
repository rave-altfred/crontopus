#!/usr/bin/env python3
"""
Namespace Migration Script for Crontopus

This script migrates existing tenant repositories from the old hardcoded
production/staging structure to the flexible namespace system with
discovered/ and default/ system namespaces.

Usage:
    python scripts/migrate_namespaces.py --dry-run  # Preview changes
    python scripts/migrate_namespaces.py            # Apply migration
    python scripts/migrate_namespaces.py --tenant ravemen15  # Migrate specific tenant
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from crontopus_api.config import SessionLocal, settings
from crontopus_api.models import Tenant, User
from crontopus_api.services.forgejo import ForgejoClient
import httpx

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def check_directory_exists(forgejo: ForgejoClient, owner: str, repo: str, path: str) -> bool:
    """Check if a directory exists in the repository."""
    try:
        # Check if .gitkeep file exists in directory
        content = await forgejo.get_file_content(owner, repo, f"{path}/.gitkeep")
        return content is not None
    except:
        return False


async def list_repository_directories(owner: str, repo: str) -> list[str]:
    """List all top-level directories in a repository."""
    try:
        url = f"{settings.forgejo_url}/api/v1/repos/{owner}/{repo}/contents"
        headers = {
            "Authorization": f"token {settings.forgejo_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=10.0)
            
            if response.status_code == 200:
                contents = response.json()
                directories = [
                    item["name"] 
                    for item in contents 
                    if item.get("type") == "dir"
                ]
                return directories
            else:
                logger.warning(f"Failed to list repository contents: {response.status_code}")
                return []
    except Exception as e:
        logger.error(f"Error listing repository directories: {e}")
        return []


async def migrate_tenant_repository(tenant_id: str, username: str, dry_run: bool = False) -> dict:
    """
    Migrate a single tenant repository.
    
    Returns dict with migration results:
    - discovered_created: bool
    - default_created: bool
    - existing_namespaces: list[str]
    - skipped: bool (if already migrated)
    """
    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Migrating tenant: {tenant_id}")
    
    result = {
        "tenant_id": tenant_id,
        "discovered_created": False,
        "default_created": False,
        "existing_namespaces": [],
        "skipped": False,
        "error": None
    }
    
    try:
        forgejo = ForgejoClient(
            base_url=settings.forgejo_url,
            username=settings.forgejo_username,
            token=settings.forgejo_token
        )
        
        repo_name = f"job-manifests-{tenant_id}"
        
        # Check if repository exists
        try:
            # List existing directories
            existing_dirs = await list_repository_directories("crontopus", repo_name)
            result["existing_namespaces"] = existing_dirs
            logger.info(f"  Existing directories: {existing_dirs}")
            
            # Check if already migrated
            if "discovered" in existing_dirs and "default" in existing_dirs:
                logger.info(f"  ✓ Already migrated (has discovered/ and default/)")
                result["skipped"] = True
                return result
            
            # Create discovered/ directory
            if "discovered" not in existing_dirs:
                logger.info(f"  Creating discovered/ directory...")
                if not dry_run:
                    await forgejo.create_or_update_file(
                        owner="crontopus",
                        repo=repo_name,
                        file_path="discovered/.gitkeep",
                        content="# System-managed namespace\n# Jobs discovered by agent will appear here\n",
                        message="Migration: Add discovered/ system namespace",
                        author_name="Crontopus Migration",
                        author_email="bot@crontopus.io"
                    )
                result["discovered_created"] = True
                logger.info(f"  ✓ Created discovered/")
            else:
                logger.info(f"  ✓ discovered/ already exists")
            
            # Create default/ directory
            if "default" not in existing_dirs:
                logger.info(f"  Creating default/ directory...")
                if not dry_run:
                    await forgejo.create_or_update_file(
                        owner="crontopus",
                        repo=repo_name,
                        file_path="default/.gitkeep",
                        content="# Default namespace for jobs\n# Jobs without explicit namespace go here\n",
                        message="Migration: Add default/ system namespace",
                        author_name="Crontopus Migration",
                        author_email="bot@crontopus.io"
                    )
                result["default_created"] = True
                logger.info(f"  ✓ Created default/")
            else:
                logger.info(f"  ✓ default/ already exists")
            
            # Note about existing production/staging
            if "production" in existing_dirs or "staging" in existing_dirs:
                logger.info(f"  → Keeping existing production/ and staging/ as custom namespaces")
                logger.info(f"     (Users can keep them or migrate jobs to default/ manually)")
            
            logger.info(f"  ✅ Migration complete for {tenant_id}")
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"  ⚠️  Repository not found: {repo_name}")
                result["error"] = "Repository not found"
            else:
                raise
        
    except Exception as e:
        logger.error(f"  ❌ Error migrating {tenant_id}: {e}")
        result["error"] = str(e)
    
    return result


async def migrate_all_tenants(dry_run: bool = False, specific_tenant: str = None):
    """Migrate all tenant repositories or a specific tenant."""
    db: Session = SessionLocal()
    
    try:
        if specific_tenant:
            tenants = db.query(Tenant).filter(Tenant.id == specific_tenant).all()
            if not tenants:
                logger.error(f"Tenant not found: {specific_tenant}")
                return
        else:
            tenants = db.query(Tenant).all()
        
        logger.info(f"Found {len(tenants)} tenant(s) to migrate")
        logger.info("=" * 60)
        
        results = []
        for tenant in tenants:
            # Get a user for this tenant (for username)
            user = db.query(User).filter(User.tenant_id == tenant.id).first()
            if not user:
                logger.warning(f"No user found for tenant {tenant.id}, skipping")
                continue
            
            result = await migrate_tenant_repository(
                tenant.id,
                user.username,
                dry_run=dry_run
            )
            results.append(result)
            logger.info("")  # Empty line between tenants
        
        # Summary
        logger.info("=" * 60)
        logger.info("MIGRATION SUMMARY")
        logger.info("=" * 60)
        
        total = len(results)
        skipped = sum(1 for r in results if r["skipped"])
        discovered_created = sum(1 for r in results if r["discovered_created"])
        default_created = sum(1 for r in results if r["default_created"])
        errors = sum(1 for r in results if r["error"])
        
        logger.info(f"Total tenants: {total}")
        logger.info(f"Already migrated: {skipped}")
        logger.info(f"Discovered/ created: {discovered_created}")
        logger.info(f"Default/ created: {default_created}")
        logger.info(f"Errors: {errors}")
        
        if dry_run:
            logger.info("")
            logger.info("🔍 DRY RUN MODE - No changes were made")
            logger.info("   Run without --dry-run to apply migration")
        else:
            logger.info("")
            logger.info("✅ Migration complete!")
        
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate Crontopus tenant repositories to flexible namespace system"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without applying them"
    )
    parser.add_argument(
        "--tenant",
        type=str,
        help="Migrate specific tenant only (tenant_id)"
    )
    
    args = parser.parse_args()
    
    logger.info("Crontopus Namespace Migration")
    logger.info("=" * 60)
    
    if args.dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    
    if args.tenant:
        logger.info(f"Target: Single tenant ({args.tenant})")
    else:
        logger.info("Target: All tenants")
    
    logger.info("")
    
    # Check Forgejo credentials
    if not settings.forgejo_url or not settings.forgejo_token:
        logger.error("ERROR: Forgejo credentials not configured")
        logger.error("Set FORGEJO_URL and FORGEJO_TOKEN environment variables")
        sys.exit(1)
    
    # Run migration
    asyncio.run(migrate_all_tenants(
        dry_run=args.dry_run,
        specific_tenant=args.tenant
    ))


if __name__ == "__main__":
    main()
