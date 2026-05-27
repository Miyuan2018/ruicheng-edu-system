"""add CLASS_ANNOUNCEMENT and TEACHER_FEEDBACK notification types

Revision ID: 011
Revises: 010
Create Date: 2026-05-26
"""
from alembic import op

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('check_notifications_notification_type',
                       'notifications', type_='check')
    op.create_check_constraint(
        'check_notifications_notification_type',
        'notifications',
        "notification_type IN ('EXAM_REMINDER','GRADING_COMPLETE',"
        "'ERROR_NOTEBOOK_READY','SYSTEM_UPDATE','WELCOME','PASSWORD_RESET',"
        "'ENCOURAGEMENT_RECEIVED','CELEBRATION_EVENT','REWARD_GOAL_UPDATE',"
        "'TEACHER_FEEDBACK','CLASS_ANNOUNCEMENT')",
    )


def downgrade() -> None:
    op.drop_constraint('check_notifications_notification_type',
                       'notifications', type_='check')
    op.create_check_constraint(
        'check_notifications_notification_type',
        'notifications',
        "notification_type IN ('EXAM_REMINDER','GRADING_COMPLETE',"
        "'ERROR_NOTEBOOK_READY','SYSTEM_UPDATE','WELCOME','PASSWORD_RESET',"
        "'ENCOURAGEMENT_RECEIVED','CELEBRATION_EVENT','REWARD_GOAL_UPDATE')",
    )
