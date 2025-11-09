"""add_enrollment_tokens_table

Revision ID: e3f87db142ee
Revises: 15f02fc423e9
Create Date: 2025-11-09 15:23:49.608734

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f87db142ee'
down_revision: Union[str, None] = '15f02fc423e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only create enrollment_tokens table
    op.create_table('enrollment_token',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('token_hash', sa.String(length=255), nullable=False),
    sa.Column('used_count', sa.Integer(), nullable=False),
    sa.Column('max_uses', sa.Integer(), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_enrollment_token_id'), 'enrollment_token', ['id'], unique=False)
    op.create_index(op.f('ix_enrollment_token_tenant_id'), 'enrollment_token', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_enrollment_token_token_hash'), 'enrollment_token', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_enrollment_token_token_hash'), table_name='enrollment_token')
    op.drop_index(op.f('ix_enrollment_token_tenant_id'), table_name='enrollment_token')
    op.drop_index(op.f('ix_enrollment_token_id'), table_name='enrollment_token')
    op.drop_table('enrollment_token')
