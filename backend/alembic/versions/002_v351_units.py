"""V3.5.1: unit-based exam paper structure

Revision ID: 002_v351_units
Revises: 001_v22_initial
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = '002_v351_units'
down_revision = '001_v22_initial'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Drop old association table
    op.drop_table('exam_paper_questions')

    # 2. Create exam_paper_units
    op.create_table('exam_paper_units',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('exam_paper_id', sa.UUID(), sa.ForeignKey('exam_papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('question_config', JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('total_score', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_units_paper', 'exam_paper_units', ['exam_paper_id', 'position'])

    # 3. Create exam_paper_unit_questions
    op.create_table('exam_paper_unit_questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('unit_id', sa.UUID(), sa.ForeignKey('exam_paper_units.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('question_type', sa.String(20), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('score', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('unit_id', 'question_id', name='uq_unit_question'),
    )
    op.create_index('idx_upq_unit', 'exam_paper_unit_questions', ['unit_id', 'position'])

    # 4. Add unit_id to answer_submissions (submitted_at already exists)
    op.add_column('answer_submissions', sa.Column('unit_id', sa.UUID(), sa.ForeignKey('exam_paper_units.id'), nullable=True))
    op.create_index('idx_answer_sub_unit', 'answer_submissions', ['unit_id'])


def downgrade():
    # Reverse operations
    op.drop_index('idx_answer_sub_unit', table_name='answer_submissions')
    op.drop_column('answer_submissions', 'unit_id')
    op.drop_index('idx_upq_unit', table_name='exam_paper_unit_questions')
    op.drop_table('exam_paper_unit_questions')
    op.drop_index('idx_units_paper', table_name='exam_paper_units')
    op.drop_table('exam_paper_units')
    # Recreate old association table
    op.create_table('exam_paper_questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('exam_paper_id', sa.UUID(), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('score', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('position >= 0', name='check_exam_paper_questions_position_non_negative'),
        sa.CheckConstraint('score >= 0', name='check_exam_paper_questions_score_non_negative'),
    )
