"""fix_endpoint_table_rename

Revision ID: 15f02fc423e9
Revises: 6e6023d3e120
Create Date: 2025-11-09 13:08:08.390274

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15f02fc423e9'
down_revision: Union[str, None] = '6e6023d3e120'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if we need to rename agent -> endpoint
    # This migration handles the case where the database was at rev 6e6023d3e120
    # but the rename didn't actually happen
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    # Handle various historical table names and rename to singular 'endpoint'
    if 'endpoint' not in tables:
        if 'agent' in tables:
            op.rename_table('agent', 'endpoint')
        elif 'agents' in tables:
            op.rename_table('agents', 'endpoint')
        elif 'endpoints' in tables:
            op.rename_table('endpoints', 'endpoint')
    
    # Refresh tables after potential rename
    tables = sa.inspect(conn).get_table_names()
    
    # Ensure job_instances table exists
    if 'job_instances' not in tables:
        op.create_table(
            'job_instances',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('tenant_id', sa.String(length=255), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('job_name', sa.String(length=255), nullable=False),
            sa.Column('namespace', sa.String(length=255), nullable=False),
            sa.Column('endpoint_id', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=False),
            sa.Column('source', sa.String(length=50), nullable=False),
            sa.Column('original_command', sa.Text(), nullable=True),
            sa.Column('last_seen', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['endpoint_id'], ['endpoint.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        
        # Create indexes
        op.create_index('ix_job_instances_job_name', 'job_instances', ['job_name'])
        op.create_index('ix_job_instances_namespace', 'job_instances', ['namespace'])
        op.create_index('ix_job_instances_endpoint_id', 'job_instances', ['endpoint_id'])
        op.create_index('ix_job_instances_status', 'job_instances', ['status'])
        op.create_index('ix_job_instances_source', 'job_instances', ['source'])
        op.create_index('ix_job_instances_tenant_id', 'job_instances', ['tenant_id'])


def downgrade() -> None:
    # Drop job_instances if exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'job_instances' in tables:
        op.drop_index('ix_job_instances_tenant_id', 'job_instances')
        op.drop_index('ix_job_instances_source', 'job_instances')
        op.drop_index('ix_job_instances_status', 'job_instances')
        op.drop_index('ix_job_instances_endpoint_id', 'job_instances')
        op.drop_index('ix_job_instances_namespace', 'job_instances')
        op.drop_index('ix_job_instances_job_name', 'job_instances')
        op.drop_table('job_instances')
    
    if 'endpoint' in tables and 'agent' not in tables:
        op.rename_table('endpoint', 'agent')
