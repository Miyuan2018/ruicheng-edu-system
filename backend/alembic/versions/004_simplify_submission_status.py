"""simplify submission status to Chinese values

Revision ID: 004
Revises: 003_add_is_typical
Create Date: 2026-05-24

将 answer_submissions.status 从英文4值简化为中文3值:
  SUBMITTED/GRADING/GRADED/RETURNED → 已判分/已生成/重新判
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, None] = '003_add_is_typical'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop old constraint first so UPDATE can write new values
    op.drop_constraint('check_answer_submissions_status', 'answer_submissions', type_='check')

    # 2. Map all existing status values to '已判分'
    op.execute("UPDATE answer_submissions SET status = '已判分'")

    # 3. Create new constraint
    op.create_check_constraint(
        'check_answer_submissions_status',
        'answer_submissions',
        "status IN ('已判分', '已生成', '重新判')"
    )


def downgrade() -> None:
    op.drop_constraint('check_answer_submissions_status', 'answer_submissions', type_='check')
    op.create_check_constraint(
        'check_answer_submissions_status',
        'answer_submissions',
        "status IN ('SUBMITTED', 'GRADING', 'GRADED', 'RETURNED')"
    )
    op.execute("UPDATE answer_submissions SET status = 'GRADED' WHERE status IN ('已判分', '已生成', '重新判')")
