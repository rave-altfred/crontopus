"""update_job_source_enum_git_to_crontopus

Revision ID: d702f8760baf
Revises: 413a1f19e5de
Create Date: 2025-11-11 10:42:35.840936

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'd702f8760baf'
down_revision: Union[str, None] = '413a1f19e5de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if enum already has only crontopus/discovered (migration already ran)
    result = op.get_bind().execute(text("""
        SELECT enumlabel FROM pg_enum 
        WHERE enumtypid = 'jobinstancesource'::regtype 
        ORDER BY enumlabel
    """)).fetchall()
    
    enum_values = [row[0] for row in result]
    
    # If enum already correct, skip
    if enum_values == ['crontopus', 'discovered']:
        return
    
    # Step 1: Add 'crontopus' if not exists
    if 'crontopus' not in enum_values:
        op.execute("ALTER TYPE jobinstancesource ADD VALUE 'crontopus'")
    
    # Step 2: Update all existing 'git' values to 'crontopus'
    op.execute("UPDATE job_instances SET source = 'crontopus' WHERE source = 'git'")
    
    # Step 3: Create new enum type without 'git'
    op.execute("DROP TYPE IF EXISTS jobinstancesource_new CASCADE")
    op.execute("CREATE TYPE jobinstancesource_new AS ENUM ('crontopus', 'discovered')")
    
    # Step 4: Alter column to use new type
    op.execute("""
        ALTER TABLE job_instances 
        ALTER COLUMN source TYPE jobinstancesource_new 
        USING source::text::jobinstancesource_new
    """)
    
    # Step 5: Drop old enum type and rename new one
    op.execute("DROP TYPE IF EXISTS jobinstancesource CASCADE")
    op.execute("ALTER TYPE jobinstancesource_new RENAME TO jobinstancesource")


def downgrade() -> None:
    # Step 1: Create old enum type with 'git'
    op.execute("""
        CREATE TYPE jobinstancesource_old AS ENUM ('git', 'discovered');
    """)
    
    # Step 2: Alter column to use old type (convert crontopus back to git)
    op.execute("""
        ALTER TABLE job_instances 
        ALTER COLUMN source TYPE jobinstancesource_old 
        USING CASE WHEN source::text = 'crontopus' THEN 'git'::jobinstancesource_old ELSE source::text::jobinstancesource_old END;
    """)
    
    # Step 3: Drop new enum type and rename old one
    op.execute("DROP TYPE jobinstancesource;")
    op.execute("ALTER TYPE jobinstancesource_old RENAME TO jobinstancesource;")
