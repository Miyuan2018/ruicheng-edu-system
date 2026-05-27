"""add content_hash to questions

Revision ID: 006
Revises: 005
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('questions', sa.Column('content_hash', sa.String(64), nullable=True))
    op.create_index('ix_questions_content_hash', 'questions', ['content_hash'], unique=False)


def downgrade():
    op.drop_index('ix_questions_content_hash', table_name='questions')
    op.drop_column('questions', 'content_hash')
