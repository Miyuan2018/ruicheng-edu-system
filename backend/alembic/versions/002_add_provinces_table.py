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
    # 检查 subjects 表是否已有 code 列，避免重复添加
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT count(*) FROM information_schema.columns "
        "WHERE table_name='subjects' AND column_name='code'"
    ))
    if result.scalar() == 0:
        op.add_column('subjects', sa.Column('code', sa.String(30), nullable=True))
        op.create_unique_constraint('uq_subjects_code', 'subjects', ['code'])


def downgrade():
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT count(*) FROM information_schema.columns "
        "WHERE table_name='subjects' AND column_name='code'"
    ))
    if result.scalar() > 0:
        op.drop_constraint('uq_subjects_code', 'subjects', type_='unique')
        op.drop_column('subjects', 'code')
    op.drop_table('provinces')
