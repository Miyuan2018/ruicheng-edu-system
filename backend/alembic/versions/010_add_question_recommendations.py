"""add question_recommendations table

Revision ID: 010
Revises: 009
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'question_recommendations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('question_id', sa.String(36), nullable=False),
        sa.Column('student_id', sa.String(36), nullable=False),
        sa.Column('recommended_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.ForeignKeyConstraint(['recommended_by'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('question_id', 'student_id', name='uq_recommendation_question_student'),
    )
    op.create_index('ix_question_recommendations_question_id', 'question_recommendations', ['question_id'])
    op.create_index('ix_question_recommendations_student_id', 'question_recommendations', ['student_id'])


def downgrade() -> None:
    op.drop_index('ix_question_recommendations_student_id', table_name='question_recommendations')
    op.drop_index('ix_question_recommendations_question_id', table_name='question_recommendations')
    op.drop_table('question_recommendations')
