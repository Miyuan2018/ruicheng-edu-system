"""Add provinces reference table and add code column to subjects."""
from alembic import op
import sqlalchemy as sa

revision = '002_add_provinces'
down_revision = '001_v22_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('provinces',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )
    try:
        op.add_column('subjects', sa.Column('code', sa.String(30), nullable=True))
        op.create_unique_constraint('uq_subjects_code', 'subjects', ['code'])
    except Exception:
        pass


def downgrade():
    try:
        op.drop_constraint('uq_subjects_code', 'subjects', type_='unique')
        op.drop_column('subjects', 'code')
    except Exception:
        pass
    op.drop_table('provinces')
