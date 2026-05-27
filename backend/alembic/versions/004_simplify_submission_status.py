"""simplify submission status to English enum values

Revision ID: 004
Revises: 003_add_is_typical
Create Date: 2026-05-24

将 answer_submissions.status 统一为英文枚举值:
  SUBMITTED/GRADING/GRADED/RETURNED/已判分/已生成/重新判 → GRADED/GENERATED/RE_GRADED
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, None] = '003_add_is_typical'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 检查旧约束是否存在
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT count(*) FROM information_schema.table_constraints "
        "WHERE table_name='answer_submissions' AND constraint_name='check_answer_submissions_status'"
    ))
    has_old_constraint = result.scalar() > 0

    if has_old_constraint:
        op.drop_constraint('check_answer_submissions_status', 'answer_submissions', type_='check')

    # 将所有现有状态值映射为英文枚举
    op.execute("UPDATE answer_submissions SET status = 'GRADED' WHERE status IN ('SUBMITTED', 'GRADING', 'GRADED', 'RETURNED', '已判分')")
    op.execute("UPDATE answer_submissions SET status = 'GENERATED' WHERE status = '已生成'")
    op.execute("UPDATE answer_submissions SET status = 'RE_GRADED' WHERE status = '重新判'")

    # 创建新约束
    op.create_check_constraint(
        'check_answer_submissions_status',
        'answer_submissions',
        "status IN ('GRADED', 'GENERATED', 'RE_GRADED')"
    )


def downgrade() -> None:
    op.drop_constraint('check_answer_submissions_status', 'answer_submissions', type_='check')
    op.create_check_constraint(
        'check_answer_submissions_status',
        'answer_submissions',
        "status IN ('SUBMITTED', 'GRADING', 'GRADED', 'RETURNED')"
    )
    op.execute("UPDATE answer_submissions SET status = 'GRADED' WHERE status IN ('GRADED', 'GENERATED', 'RE_GRADED')")
