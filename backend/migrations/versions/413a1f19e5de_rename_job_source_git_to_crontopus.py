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
    # Update existing 'git' source values to 'crontopus'
    op.execute(
        "UPDATE job_instances SET source = 'crontopus' WHERE source = 'git'"
    )


def downgrade() -> None:
    # Revert 'crontopus' back to 'git'
    op.execute(
        "UPDATE job_instances SET source = 'git' WHERE source = 'crontopus'"
    )
