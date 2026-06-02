"""V3.6: 知识树统一清理

- 删除旧 knowledge_points 表及连接表
- 删除 knowledge_point_models 表
- 删除 syllabi.knowledge_tree 旧JSON列
- 新增 question_knowledge_nodes 结构化关联表

Revision ID: 003_cleanup_knowledge_tree
Revises: 002_v351_units
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = '003_cleanup_knowledge_tree'
down_revision = '002_v351_units'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 删除旧表
    op.execute('DROP TABLE IF EXISTS question_knowledge_points CASCADE')
    op.execute('DROP TABLE IF EXISTS knowledge_points CASCADE')
    op.execute('DROP TABLE IF EXISTS knowledge_point_models CASCADE')

    # 2. 删除 syllabi 旧 JSON 列
    op.drop_column('syllabi', 'knowledge_tree')

    # 3. 新增题目-知识点结构化关联表
    op.create_table(
        'question_knowledge_nodes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('question_id', UUID(as_uuid=True),
                  sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('knowledge_node_id', UUID(as_uuid=True),
                  sa.ForeignKey('knowledge_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('question_id', 'knowledge_node_id', name='uq_question_knowledge_node'),
    )
    op.create_index('ix_question_knowledge_nodes_question_id', 'question_knowledge_nodes', ['question_id'])
    op.create_index('ix_question_knowledge_nodes_knowledge_node_id', 'question_knowledge_nodes', ['knowledge_node_id'])


def downgrade():
    op.drop_index('ix_question_knowledge_nodes_knowledge_node_id', table_name='question_knowledge_nodes')
    op.drop_index('ix_question_knowledge_nodes_question_id', table_name='question_knowledge_nodes')
    op.drop_table('question_knowledge_nodes')
    op.add_column('syllabi', sa.Column('knowledge_tree', sa.types.JSON(), nullable=True))
