"""Add template_type column to exam_papers

Revision ID: 005_add_template_type
Revises: 006_v43_drafts
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa


revision = '005_add_template_type'
down_revision = '006_v43_drafts'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('exam_papers',
        sa.Column('template_type', sa.String(30), nullable=False,
                  server_default='generic'))
    # 存量数据: show_units=false 的试卷 → 'question_type'
    op.execute(
        "UPDATE exam_papers SET template_type = 'question_type' WHERE show_units = false"
    )


def downgrade():
    op.drop_column('exam_papers', 'template_type')
