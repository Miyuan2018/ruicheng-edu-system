"""add parent encouragement domain tables

Revision ID: 009
Revises: 008
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # ── parents ──────────────────────────────────────────────────────────────
    # Table already exists but id is native UUID — convert to VARCHAR(36)
    # to match the model and be consistent with other tables
    op.alter_column(
        'parents', 'id',
        type_=sa.String(36),
        existing_type=sa.UUID(),
        postgresql_using='id::text',
    )

    # ── parent_student_links ─────────────────────────────────────────────────
    op.create_table(
        'parent_student_links',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('parent_id', sa.String(36),
                  sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('student_id', sa.String(36),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('relationship', sa.String(20), nullable=True),
        sa.Column('invite_code_used', sa.String(6), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.true()),
        sa.Column('linked_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('unlinked_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parent_id', 'student_id',
                            name='uq_parent_student_link'),
    )
    op.create_index('ix_parent_student_links_parent_id',
                    'parent_student_links', ['parent_id'])
    op.create_index('ix_parent_student_links_student_id',
                    'parent_student_links', ['student_id'])

    # ── encouragement_templates ──────────────────────────────────────────────
    op.create_table(
        'encouragement_templates',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('message_template', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.true()),
        sa.Column('usage_count', sa.Integer(), nullable=False,
                  server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "category IN ('EFFORT','PROGRESS','PERSISTENCE','COMPLETION','GENERAL')",
            name='check_template_category',
        ),
    )

    # ── celebration_events (must precede encouragements — FK reference) ──────
    op.create_table(
        'celebration_events',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('student_id', sa.String(36),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('event_type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('metric_value', sa.Integer(), nullable=True),
        sa.Column('parent_notified', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column('parent_acknowledged', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column('encouragement_sent', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "event_type IN ('PAPER_COMPLETED','STREAK_MILESTONE','ACCURACY_IMPROVED','ERRORS_CLEARED','SUBJECT_MASTERY')",
            name='check_celebration_event_type',
        ),
    )
    op.create_index('ix_celebration_events_student_id',
                    'celebration_events', ['student_id'])

    # ── encouragements ───────────────────────────────────────────────────────
    op.create_table(
        'encouragements',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('parent_id', sa.String(36),
                  sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('student_id', sa.String(36),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('encouragement_type', sa.String(20), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('template_id', sa.String(36),
                  sa.ForeignKey('encouragement_templates.id'), nullable=True),
        sa.Column('celebration_event_id', sa.String(36),
                  sa.ForeignKey('celebration_events.id'), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "encouragement_type IN ('TEMPLATE','CUSTOM','CELEBRATION','REWARD_COMPLETE')",
            name='check_encouragement_type',
        ),
    )
    op.create_index('ix_encouragements_parent_id',
                    'encouragements', ['parent_id'])
    op.create_index('ix_encouragements_student_read',
                    'encouragements', ['student_id', 'is_read'])

    # ── reward_goals ─────────────────────────────────────────────────────────
    op.create_table(
        'reward_goals',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('parent_id', sa.String(36),
                  sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('student_id', sa.String(36),
                  sa.ForeignKey('students.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reward_description', sa.String(500), nullable=False),
        sa.Column('metric_type', sa.String(30), nullable=False),
        sa.Column('target_value', sa.Integer(), nullable=False),
        sa.Column('current_value', sa.Integer(), nullable=False,
                  server_default=sa.text('0')),
        sa.Column('status', sa.String(20), nullable=False,
                  server_default=sa.text("'ACTIVE'")),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_reward_claimed', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "metric_type IN ('PAPERS_COMPLETED','PRACTICE_SESSIONS','STREAK_DAYS','ERRORS_CLEARED','ACCURACY_IMPROVEMENT')",
            name='check_reward_metric_type',
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE','COMPLETED','CANCELLED','EXPIRED')",
            name='check_reward_status',
        ),
        sa.CheckConstraint('target_value > 0',
                           name='check_reward_target_positive'),
        sa.CheckConstraint('current_value >= 0',
                           name='check_reward_current_nonneg'),
    )
    op.create_index('ix_reward_goals_parent_id',
                    'reward_goals', ['parent_id'])
    op.create_index('ix_reward_goals_student_status',
                    'reward_goals', ['student_id', 'status'])

    # ── students: add invite_code columns ────────────────────────────────────
    op.add_column('students',
                  sa.Column('invite_code', sa.String(6), nullable=True))
    op.add_column('students',
                  sa.Column('invite_code_expires_at',
                            sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint('uq_students_invite_code',
                                'students', ['invite_code'])

    # ── notifications: add type check to include parent types ─────────────
    op.create_check_constraint(
        'check_notifications_notification_type',
        'notifications',
        "notification_type IN ('EXAM_REMINDER','GRADING_COMPLETE',"
        "'ERROR_NOTEBOOK_READY','SYSTEM_UPDATE','WELCOME','PASSWORD_RESET',"
        "'ENCOURAGEMENT_RECEIVED','CELEBRATION_EVENT','REWARD_GOAL_UPDATE')",
    )


def downgrade():
    # notifications constraint
    op.drop_constraint('check_notifications_notification_type',
                       'notifications', type_='check')

    # students invite_code
    op.drop_constraint('uq_students_invite_code', 'students')
    op.drop_column('students', 'invite_code_expires_at')
    op.drop_column('students', 'invite_code')

    op.drop_table('reward_goals')
    op.drop_table('encouragements')
    op.drop_table('celebration_events')
    op.drop_table('encouragement_templates')
    op.drop_table('parent_student_links')
    # parents table was pre-existing — restore id to UUID
    op.alter_column(
        'parents', 'id',
        type_=sa.UUID(),
        existing_type=sa.String(36),
        postgresql_using='id::uuid',
    )
