"""add_job_id_uuid_to_job_instance

Revision ID: 451843dd10b1
Revises: c9854406760d
Create Date: 2025-11-11 19:00:22.233975

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '451843dd10b1'
down_revision: Union[str, None] = 'c9854406760d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add job_id column (nullable initially for migration)
    op.add_column('job_instances', sa.Column('job_id', sa.String(36), nullable=True))
    
    # Add index on job_id for faster lookups
    op.create_index('ix_job_instances_job_id', 'job_instances', ['job_id'])
    
    # Note: We don't drop the old unique constraint yet
    # It will be replaced after data migration in a follow-up migration


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_job_instances_job_id', table_name='job_instances')
    
    # Drop column
    op.drop_column('job_instances', 'job_id')
