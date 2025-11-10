"""add_unique_constraint_to_job_instances

Revision ID: ce60163757c5
Revises: efa1a3d79845
Create Date: 2025-11-10 18:10:16.026888

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce60163757c5'
down_revision: Union[str, None] = 'efa1a3d79845'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add unique constraint to prevent duplicate job instances on same endpoint
    op.create_unique_constraint(
        'uq_job_instance_endpoint',
        'job_instances',
        ['tenant_id', 'endpoint_id', 'namespace', 'job_name']
    )


def downgrade() -> None:
    # Remove unique constraint
    op.drop_constraint('uq_job_instance_endpoint', 'job_instances', type_='unique')
