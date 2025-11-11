"""add_namespace_and_endpoint_id_to_job_run

Revision ID: c9854406760d
Revises: d702f8760baf
Create Date: 2025-11-11 11:52:09.293424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9854406760d'
down_revision: Union[str, None] = 'd702f8760baf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add namespace column to job_run (nullable for backward compatibility)
    op.add_column('job_run', sa.Column('namespace', sa.String(length=255), nullable=True))
    
    # Add endpoint_id column to job_run (nullable for backward compatibility)
    op.add_column('job_run', sa.Column('endpoint_id', sa.Integer(), nullable=True))
    
    # Create indexes for better query performance
    op.create_index('ix_job_run_namespace', 'job_run', ['namespace'])
    op.create_index('ix_job_run_endpoint_id', 'job_run', ['endpoint_id'])
    
    # Add foreign key constraint to endpoint table (if it exists)
    # Note: This will fail if job_run has endpoint_id values that don't exist in endpoint table
    # In production, clean up orphaned records first
    try:
        op.create_foreign_key(
            'fk_job_run_endpoint_id',
            'job_run', 'endpoint',
            ['endpoint_id'], ['id'],
            ondelete='SET NULL'  # Set to NULL if endpoint is deleted
        )
    except Exception as e:
        print(f"Warning: Could not create foreign key constraint: {e}")
        print("This is okay - constraint can be added later after cleanup")


def downgrade() -> None:
    # Drop foreign key constraint
    try:
        op.drop_constraint('fk_job_run_endpoint_id', 'job_run', type_='foreignkey')
    except Exception:
        pass  # Constraint might not exist
    
    # Drop indexes
    op.drop_index('ix_job_run_endpoint_id', 'job_run')
    op.drop_index('ix_job_run_namespace', 'job_run')
    
    # Drop columns
    op.drop_column('job_run', 'endpoint_id')
    op.drop_column('job_run', 'namespace')
