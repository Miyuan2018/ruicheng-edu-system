"""restructure self_study_tasks for student self-study

Revision ID: 007
Revises: 006
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # Drop old FK constraint (exists)
    op.drop_constraint('fk_self_study_tasks_assigned_to_admins', 'self_study_tasks', type_='foreignkey')

    # Drop old columns
    op.drop_column('self_study_tasks', 'task_type')
    op.drop_column('self_study_tasks', 'assigned_to')
    op.drop_column('self_study_tasks', 'parameters')
    op.drop_column('self_study_tasks', 'result_data')
    op.drop_column('self_study_tasks', 'started_at')

    # Add new columns
    op.add_column('self_study_tasks', sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id'), nullable=False, server_default=''))
    op.add_column('self_study_tasks', sa.Column('subject', sa.String(50), nullable=True))
    op.add_column('self_study_tasks', sa.Column('grade_level', sa.String(20), nullable=True))
    op.add_column('self_study_tasks', sa.Column('scheduled_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('self_study_tasks', sa.Column('completed_time', sa.DateTime(timezone=True), nullable=True))

    # Make priority have a default of 1
    op.alter_column('self_study_tasks', 'priority', server_default='1')

    # Create index on student_id
    op.create_index('ix_self_study_tasks_student_id', 'self_study_tasks', ['student_id'])

    # Add new constraints
    op.create_check_constraint(
        'check_self_study_tasks_status',
        'self_study_tasks',
        "status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')"
    )
    op.create_check_constraint(
        'check_self_study_tasks_priority',
        'self_study_tasks',
        "priority >= 1 AND priority <= 5"
    )


def downgrade():
    op.drop_constraint('check_self_study_tasks_status', 'self_study_tasks', type_='check')
    op.drop_constraint('check_self_study_tasks_priority', 'self_study_tasks', type_='check')
    op.drop_index('ix_self_study_tasks_student_id', 'self_study_tasks')

    op.drop_column('self_study_tasks', 'completed_time')
    op.drop_column('self_study_tasks', 'scheduled_time')
    op.drop_column('self_study_tasks', 'grade_level')
    op.drop_column('self_study_tasks', 'subject')
    op.drop_column('self_study_tasks', 'student_id')

    op.add_column('self_study_tasks', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('self_study_tasks', sa.Column('result_data', sa.JSON(), nullable=True))
    op.add_column('self_study_tasks', sa.Column('parameters', sa.JSON(), nullable=True))
    op.add_column('self_study_tasks', sa.Column('assigned_to', sa.String(36), sa.ForeignKey('students.id'), nullable=True))
    op.add_column('self_study_tasks', sa.Column('task_type', sa.String(30), nullable=False, server_default='KNOWLEDGE_EXTRACTION'))

    op.create_check_constraint(
        'check_self_study_tasks_task_type',
        'self_study_tasks',
        "task_type IN ('KNOWLEDGE_EXTRACTION', 'QUESTION_GENERATION', 'MODEL_TRAINING', 'DATA_SYNC')"
    )
    op.create_check_constraint(
        'check_self_study_tasks_status',
        'self_study_tasks',
        "status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')"
    )
    op.create_check_constraint(
        'check_self_study_tasks_priority',
        'self_study_tasks',
        "priority >= 1 AND priority <= 10"
    )
