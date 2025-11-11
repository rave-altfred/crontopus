"""rename_job_source_git_to_crontopus

Revision ID: 413a1f19e5de
Revises: ce60163757c5
Create Date: 2025-11-11 10:33:05.356812

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '413a1f19e5de'
down_revision: Union[str, None] = 'ce60163757c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add 'crontopus' to enum (if not exists)
    op.execute("ALTER TYPE jobinstancesource ADD VALUE IF NOT EXISTS 'crontopus'")
    
    # Step 2: Update existing 'git' values to 'crontopus'
    op.execute("UPDATE job_instances SET source = 'crontopus' WHERE source = 'git'")
    
    # Step 3: Remove 'git' from enum by recreating it
    # Create new enum without 'git'
    op.execute("CREATE TYPE jobinstancesource_new AS ENUM ('crontopus', 'discovered')")
    
    # Alter column to use new type
    op.execute("""
        ALTER TABLE job_instances 
        ALTER COLUMN source TYPE jobinstancesource_new 
        USING source::text::jobinstancesource_new
    """)
    
    # Drop old enum and rename new one
    op.execute("DROP TYPE jobinstancesource")
    op.execute("ALTER TYPE jobinstancesource_new RENAME TO jobinstancesource")


def downgrade() -> None:
    # Recreate enum with 'git'
    op.execute("CREATE TYPE jobinstancesource_old AS ENUM ('git', 'discovered')")
    
    # Alter column to use old type
    op.execute("""
        ALTER TABLE job_instances 
        ALTER COLUMN source TYPE jobinstancesource_old 
        USING CASE 
            WHEN source::text = 'crontopus' THEN 'git'::jobinstancesource_old 
            ELSE source::text::jobinstancesource_old 
        END
    """)
    
    # Drop new enum and rename old one
    op.execute("DROP TYPE jobinstancesource")
    op.execute("ALTER TYPE jobinstancesource_old RENAME TO jobinstancesource")
