"""Add is_typical column to questions table."""
from alembic import op
import sqlalchemy as sa

revision = '003_add_is_typical'
down_revision = '002_add_provinces'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('questions', sa.Column('is_typical', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('questions', 'is_typical')
