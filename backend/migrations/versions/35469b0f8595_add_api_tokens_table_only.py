"""add_api_tokens_table_only

Revision ID: 35469b0f8595
Revises: 451843dd10b1
Create Date: 2025-11-17 17:45:29.359172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '35469b0f8595'
down_revision: Union[str, None] = '451843dd10b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create api_tokens table
    op.create_table('api_tokens',
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('scopes', sa.Text(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_api_tokens_tenant_hash', 'api_tokens', ['tenant_id', 'token_hash'], unique=False)
    op.create_index('idx_api_tokens_user_tenant', 'api_tokens', ['user_id', 'tenant_id'], unique=False)
    op.create_index(op.f('ix_api_tokens_id'), 'api_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_api_tokens_tenant_id'), 'api_tokens', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_api_tokens_token_hash'), 'api_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_api_tokens_user_id'), 'api_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_api_tokens_user_id'), table_name='api_tokens')
    op.drop_index(op.f('ix_api_tokens_token_hash'), table_name='api_tokens')
    op.drop_index(op.f('ix_api_tokens_tenant_id'), table_name='api_tokens')
    op.drop_index(op.f('ix_api_tokens_id'), table_name='api_tokens')
    op.drop_index('idx_api_tokens_user_tenant', table_name='api_tokens')
    op.drop_index('idx_api_tokens_tenant_hash', table_name='api_tokens')
    
    # Drop table
    op.drop_table('api_tokens')
