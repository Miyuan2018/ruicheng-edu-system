"""V4: 添加 show_units 和 per_unit_timer 字段

Revision ID: 004_v4_show_units_timer
Revises: 003_cleanup_knowledge_tree
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = '004_v4_show_units_timer'
down_revision = '003_cleanup_knowledge_tree'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('exam_papers', sa.Column('show_units', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')))
    op.add_column('exam_papers', sa.Column('per_unit_timer', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))


def downgrade():
    op.drop_column('exam_papers', 'per_unit_timer')
    op.drop_column('exam_papers', 'show_units')
