"""add explanation_sessions and explanation_steps tables

Revision ID: 008
Revises: 007
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # ── explanation_sessions ──────────────────────────────────────────────────
    op.create_table(
        'explanation_sessions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('question_id', sa.String(36),
                  sa.ForeignKey('questions.id'), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('topic', sa.String(100), nullable=True),
        sa.Column('difficulty_label', sa.String(50), nullable=True),
        sa.Column('problem_statement', sa.Text(), nullable=True),
        sa.Column('graph_config', JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.true()),
        sa.Column('created_by', sa.String(36),
                  sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('question_id',
                            name='uq_explanation_sessions_question_id'),
    )
    op.create_index(
        'ix_explanation_sessions_question_id',
        'explanation_sessions',
        ['question_id', 'is_active'],
    )

    # ── explanation_steps ─────────────────────────────────────────────────────
    op.create_table(
        'explanation_steps',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(36),
                  sa.ForeignKey('explanation_sessions.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('panda_emotion', sa.String(20), nullable=False,
                  server_default='explaining'),
        sa.Column('board_line', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "panda_emotion IN ('idle','thinking','explaining','satisfied')",
            name='check_steps_emotion',
        ),
        sa.UniqueConstraint('session_id', 'step_order',
                            name='uq_steps_session_order'),
    )
    op.create_index(
        'ix_explanation_steps_session_id',
        'explanation_steps',
        ['session_id'],
    )


def downgrade():
    op.drop_table('explanation_steps')
    op.drop_table('explanation_sessions')
