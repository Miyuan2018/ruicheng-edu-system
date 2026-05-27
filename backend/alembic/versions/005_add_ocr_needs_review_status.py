"""add ocr needs_review status

Revision ID: 005
Revises: 004_simplify_submission_status
Create Date: 2026-05-25
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # Drop old check constraint and add new one with NEEDS_REVIEW
    op.execute("ALTER TABLE ocr_uploads DROP CONSTRAINT IF EXISTS check_ocr_uploads_status")
    op.create_check_constraint(
        'check_ocr_uploads_status',
        'ocr_uploads',
        "status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW')"
    )


def downgrade():
    op.execute("ALTER TABLE ocr_uploads DROP CONSTRAINT IF EXISTS check_ocr_uploads_status")
    op.create_check_constraint(
        'check_ocr_uploads_status',
        'ocr_uploads',
        "status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')"
    )
