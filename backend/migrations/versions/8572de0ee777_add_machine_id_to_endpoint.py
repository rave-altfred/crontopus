"""add_machine_id_to_endpoint

Revision ID: 8572de0ee777
Revises: e3f87db142ee
Create Date: 2025-11-09 18:02:34.037317

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8572de0ee777'
down_revision: Union[str, None] = 'e3f87db142ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add machine_id column to endpoint table
    op.add_column('endpoint', sa.Column('machine_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_endpoint_machine_id'), 'endpoint', ['machine_id'], unique=False)


def downgrade() -> None:
    # Remove machine_id column
    op.drop_index(op.f('ix_endpoint_machine_id'), table_name='endpoint')
    op.drop_column('endpoint', 'machine_id')
