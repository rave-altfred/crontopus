"""Phase 10.1: Rename agents to endpoints and add job_instances

Revision ID: 6e6023d3e120
Revises: 0b673b449723
Create Date: 2025-11-09 10:34:56.361677

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e6023d3e120'
down_revision: Union[str, None] = '0b673b449723'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename agent table to endpoint (singular)
    op.rename_table('agent', 'endpoint')
    
    # Create job_instances table
    op.create_table(
        'job_instances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('job_name', sa.String(length=255), nullable=False),
        sa.Column('namespace', sa.String(length=255), nullable=False),
        sa.Column('endpoint_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('source', sa.String(length=10), nullable=False),
        sa.Column('original_command', sa.Text(), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['endpoint_id'], ['endpoint.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes on job_instances
    op.create_index('ix_job_instances_job_name', 'job_instances', ['job_name'])
    op.create_index('ix_job_instances_namespace', 'job_instances', ['namespace'])
    op.create_index('ix_job_instances_endpoint_id', 'job_instances', ['endpoint_id'])
    op.create_index('ix_job_instances_status', 'job_instances', ['status'])
    op.create_index('ix_job_instances_source', 'job_instances', ['source'])
    op.create_index('ix_job_instances_tenant_id', 'job_instances', ['tenant_id'])


def downgrade() -> None:
    # Drop job_instances table
    op.drop_index('ix_job_instances_tenant_id', 'job_instances')
    op.drop_index('ix_job_instances_source', 'job_instances')
    op.drop_index('ix_job_instances_status', 'job_instances')
    op.drop_index('ix_job_instances_endpoint_id', 'job_instances')
    op.drop_index('ix_job_instances_namespace', 'job_instances')
    op.drop_index('ix_job_instances_job_name', 'job_instances')
    op.drop_table('job_instances')
    
    # Rename endpoint back to agent
    op.rename_table('endpoint', 'agent')
