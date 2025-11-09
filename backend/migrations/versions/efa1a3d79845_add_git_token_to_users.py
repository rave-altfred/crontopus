"""add_git_token_to_users

Revision ID: efa1a3d79845
Revises: 8572de0ee777
Create Date: 2025-11-09 20:37:43.030641

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efa1a3d79845'
down_revision: Union[str, None] = '8572de0ee777'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add git_token column to users table
    op.add_column('users', sa.Column('git_token', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove git_token column from users table
    op.drop_column('users', 'git_token')
