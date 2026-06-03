"""V4.3: exam_paper_drafts table + DRAFT to READY status

Revision ID: 006_v43_drafts
Revises: 98ef1419364d
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '006_v43_drafts'
down_revision = '98ef1419364d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'exam_paper_drafts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('paper_id', UUID(as_uuid=True),
                  sa.ForeignKey('exam_papers.id'), nullable=True),
        sa.Column('data', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'paper_id', name='uq_user_paper_draft'),
    )
    # Migrate existing DRAFT papers to READY
    op.execute("UPDATE exam_papers SET status = 'READY' WHERE status = 'DRAFT'")
    # Update CHECK constraint
    op.execute("ALTER TABLE exam_papers DROP CONSTRAINT IF EXISTS check_exam_papers_status")
    op.execute("ALTER TABLE exam_papers ADD CONSTRAINT check_exam_papers_status "
               "CHECK (status IN ('READY', 'PUBLISHED', 'ARCHIVED'))")


def downgrade():
    op.execute("ALTER TABLE exam_papers DROP CONSTRAINT IF EXISTS check_exam_papers_status")
    op.execute("ALTER TABLE exam_papers ADD CONSTRAINT check_exam_papers_status "
               "CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))")
    op.execute("UPDATE exam_papers SET status = 'DRAFT' WHERE status = 'READY'")
    op.drop_table('exam_paper_drafts')
