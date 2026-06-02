"""V3.5 Initial Schema — complete from all models, single migration."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '001_v22_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ═══════════════════════════════════════════════════════════════════════════
    # 参考数据表 (7 类)
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('question_types',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    op.create_table('difficulty_levels',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    op.create_table('grade_levels',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    op.create_table('paper_statuses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    op.create_table('error_types',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    op.create_table('question_sources',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    op.create_table('provinces',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # 角色表
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('roles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # 用户表
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('sys_admins',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('avatar_url', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('username')
    )

    op.create_table('admins',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('qualification', sa.String(50), nullable=True),
        sa.Column('admin_type', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('subjects', JSONB(), nullable=True),
        sa.Column('grade_level', JSONB(), nullable=True),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('sys_admins.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('username')
    )

    op.create_table('students',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('grade', sa.String(20), nullable=True),
        sa.Column('school', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('invite_code', sa.String(6), nullable=True),
        sa.Column('invite_code_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('invite_code')
    )

    op.create_table('parents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('student_ids', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('username')
    )

    op.create_table('parent_student_links',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('parent_id', sa.UUID(), sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('relationship', sa.String(20), nullable=True),
        sa.Column('invite_code_used', sa.String(6), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('linked_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('unlinked_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parent_id', 'student_id', name='uq_parent_student_link')
    )
    op.create_index('ix_parent_student_links_parent_id', 'parent_student_links', ['parent_id'])
    op.create_index('ix_parent_student_links_student_id', 'parent_student_links', ['student_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 科目
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('subjects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(30), nullable=True),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('category', sa.String(30), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.UniqueConstraint('name')
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # 知识点
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('knowledge_points',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_id', sa.UUID(), sa.ForeignKey('knowledge_points.id'), nullable=True),
        sa.Column('subject', sa.String(50), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('difficulty_level', sa.String(10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_knowledge_points_code', 'knowledge_points', ['code'])
    op.create_index('ix_knowledge_points_subject', 'knowledge_points', ['subject'])
    op.create_index('ix_knowledge_points_grade_level', 'knowledge_points', ['grade_level'])
    op.create_index('ix_knowledge_points_parent_id', 'knowledge_points', ['parent_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 题目
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('question_type', sa.String(20), nullable=False),
        sa.Column('difficulty', sa.String(10), nullable=False),
        sa.Column('subject', sa.String(50), nullable=False),
        sa.Column('grade_level', JSONB(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('correct_answer', sa.Text(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(20), nullable=False, server_default=sa.text("'MANUAL'")),
        sa.Column('review_status', sa.String(20), nullable=False, server_default=sa.text("'APPROVED'")),
        sa.Column('reviewed_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source_task_id', sa.UUID(), nullable=True),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_typical', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('content_hash', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'SUBJECTIVE')", name='check_question_type'),
        sa.CheckConstraint("difficulty IN ('EASY', 'MEDIUM', 'HARD')", name='check_difficulty'),
        sa.CheckConstraint('score > 0', name='check_score_positive'),
    )
    op.create_index('ix_questions_subject', 'questions', ['subject'])
    op.create_index('ix_questions_created_by', 'questions', ['created_by'])
    op.create_index('ix_questions_is_active', 'questions', ['is_active'])
    op.create_index('ix_questions_is_typical', 'questions', ['is_typical'])
    op.create_index('ix_questions_content_hash', 'questions', ['content_hash'])

    # 题目-知识点关联 (question_knowledge_points 已弃用，保留兼容)
    op.create_table('question_knowledge_points',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('knowledge_point_id', sa.UUID(), sa.ForeignKey('knowledge_points.id'), nullable=False),
        sa.Column('weight', sa.Numeric(3, 2), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('question_id', 'knowledge_point_id')
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # 课纲 & 知识点树
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('syllabi',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('grade_level', sa.JSON(), nullable=True),
        sa.Column('province', sa.String(50), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('content', sa.JSON(), nullable=True),
        sa.Column('knowledge_tree', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default=sa.text("'DRAFT'")),
        sa.Column('version', sa.Integer(), nullable=True, server_default=sa.text('1')),
        sa.Column('is_current', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('parent_syllabus_id', sa.UUID(), nullable=True),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('knowledge_nodes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('syllabus_id', sa.UUID(), sa.ForeignKey('syllabi.id'), nullable=False),
        sa.Column('parent_id', sa.UUID(), sa.ForeignKey('knowledge_nodes.id'), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('node_type', sa.String(20), nullable=False, server_default=sa.text("'POINT'")),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('version', sa.Integer(), nullable=True, server_default=sa.text('1')),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('invalid_reason', sa.String(30), nullable=True),
        sa.Column('is_modified', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_knowledge_nodes_syllabus_id', 'knowledge_nodes', ['syllabus_id'])
    op.create_index('ix_knowledge_nodes_parent_id', 'knowledge_nodes', ['parent_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 试卷
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('exam_papers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('grade_level', JSONB(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'DRAFT'")),
        sa.Column('total_score', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('subtitle', sa.String(200), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('total_score >= 0', name='check_exam_papers_total_score_non_negative'),
        sa.CheckConstraint("duration_minutes IS NULL OR duration_minutes >= 0", name='check_exam_papers_duration_non_negative'),
        sa.CheckConstraint("status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')", name='check_exam_papers_status'),
    )
    op.create_index('ix_exam_papers_subject', 'exam_papers', ['subject'])
    op.create_index('ix_exam_papers_created_by', 'exam_papers', ['created_by'])

    # 试卷-题目关联
    op.create_table('exam_paper_questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('exam_paper_id', sa.UUID(), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('score', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('position >= 0', name='check_exam_paper_questions_position_non_negative'),
        sa.CheckConstraint('score >= 0', name='check_exam_paper_questions_score_non_negative'),
    )
    op.create_index('ix_exam_paper_questions_exam_paper_id', 'exam_paper_questions', ['exam_paper_id'])
    op.create_index('ix_exam_paper_questions_question_id', 'exam_paper_questions', ['question_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 班级
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('classes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('teacher_id', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_classes_teacher_id', 'classes', ['teacher_id'])
    op.create_index('ix_classes_is_active', 'classes', ['is_active'])

    op.create_table('class_students',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('class_id', sa.UUID(), sa.ForeignKey('classes.id'), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_class_students_class_id', 'class_students', ['class_id'])
    op.create_index('ix_class_students_student_id', 'class_students', ['student_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 答题 & 评分
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('ocr_uploads',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('exam_paper_id', sa.UUID(), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('ocr_engine', sa.String(50), nullable=True),
        sa.Column('confidence_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('processed_text', sa.Text(), nullable=True),
        sa.Column('structured_data', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('file_size > 0', name='check_ocr_uploads_file_size_positive'),
        sa.CheckConstraint("status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW')", name='check_ocr_uploads_status'),
    )
    op.create_index('ix_ocr_uploads_student_id', 'ocr_uploads', ['student_id'])
    op.create_index('ix_ocr_uploads_exam_paper_id', 'ocr_uploads', ['exam_paper_id'])

    op.create_table('answer_submissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('exam_paper_id', sa.UUID(), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('submission_type', sa.String(20), nullable=False),
        sa.Column('ocr_upload_id', sa.UUID(), sa.ForeignKey('ocr_uploads.id'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('graded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('percentage', sa.Numeric(5, 2), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("submission_type IN ('ONLINE', 'OCR')", name='check_answer_submissions_submission_type'),
        sa.CheckConstraint("status IN ('GRADED', 'GENERATED', 'RE_GRADED')", name='check_answer_submissions_status'),
    )
    op.create_index('ix_answer_submissions_student_id', 'answer_submissions', ['student_id'])
    op.create_index('ix_answer_submissions_exam_paper_id', 'answer_submissions', ['exam_paper_id'])

    op.create_table('answer_details',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('answer_submission_id', sa.UUID(), sa.ForeignKey('answer_submissions.id'), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('student_answer', sa.Text(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('score_obtained', sa.Numeric(5, 2), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('score_obtained >= 0', name='check_answer_details_score_obtained_non_negative'),
        sa.UniqueConstraint('answer_submission_id', 'question_id', name='uq_answer_details_answer_submission_id_question_id'),
    )
    op.create_index('ix_answer_details_answer_submission_id', 'answer_details', ['answer_submission_id'])
    op.create_index('ix_answer_details_question_id', 'answer_details', ['question_id'])

    op.create_table('grading_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('answer_submission_id', sa.UUID(), sa.ForeignKey('answer_submissions.id'), nullable=False),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('model_version', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('percentage', sa.Numeric(5, 2), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')", name='check_grading_records_status'),
    )
    op.create_index('ix_grading_records_answer_submission_id', 'grading_records', ['answer_submission_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 错题本
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('error_notebooks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('exam_paper_id', sa.UUID(), sa.ForeignKey('exam_papers.id'), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('question_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('question_count >= 0', name='check_error_notebooks_question_count_non_negative'),
        sa.CheckConstraint("status IN ('DRAFT', 'GENERATED', 'EXPORTED')", name='check_error_notebooks_status'),
    )
    op.create_index('ix_error_notebooks_student_id', 'error_notebooks', ['student_id'])
    op.create_index('ix_error_notebooks_exam_paper_id', 'error_notebooks', ['exam_paper_id'])

    op.create_table('error_notebook_questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('error_notebook_id', sa.UUID(), sa.ForeignKey('error_notebooks.id'), nullable=False),
        sa.Column('original_question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('practice_question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=True),
        sa.Column('error_type', sa.String(50), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('explanation IS NOT NULL', name='check_error_notebook_questions_explanation_not_null'),
        sa.UniqueConstraint('error_notebook_id', 'original_question_id', name='uq_enq_notebook_orig_qid'),
    )
    op.create_index('ix_error_notebook_questions_error_notebook_id', 'error_notebook_questions', ['error_notebook_id'])
    op.create_index('ix_error_notebook_questions_original_question_id', 'error_notebook_questions', ['original_question_id'])
    op.create_index('ix_error_notebook_questions_practice_question_id', 'error_notebook_questions', ['practice_question_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 自学任务
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('self_study_tasks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'PENDING'")),
        sa.Column('priority', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('scheduled_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')", name='check_self_study_tasks_status'),
        sa.CheckConstraint('priority >= 1 AND priority <= 5', name='check_self_study_tasks_priority'),
    )
    op.create_index('ix_self_study_tasks_student_id', 'self_study_tasks', ['student_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 通知
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=True),
        sa.Column('notification_type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('channel', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('related_entity_type', sa.String(30), nullable=True),
        sa.Column('related_entity_id', sa.UUID(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "notification_type IN ('EXAM_REMINDER','GRADING_COMPLETE','ERROR_NOTEBOOK_READY',"
            "'SYSTEM_UPDATE','WELCOME','PASSWORD_RESET','ENCOURAGEMENT_RECEIVED',"
            "'CELEBRATION_EVENT','REWARD_GOAL_UPDATE','TEACHER_FEEDBACK','CLASS_ANNOUNCEMENT')",
            name='check_notifications_notification_type',
        ),
        sa.CheckConstraint("channel IN ('EMAIL', 'WECHAT', 'DINGTALK', 'IN_APP')", name='check_notifications_channel'),
        sa.CheckConstraint("status IN ('PENDING', 'SENT', 'FAILED', 'READ')", name='check_notifications_status'),
    )
    op.create_index('ix_notifications_recipient_id', 'notifications', ['recipient_id'])
    op.create_index('ix_notifications_sender_id', 'notifications', ['sender_id'])
    op.create_index('ix_notifications_related_entity_id', 'notifications', ['related_entity_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # LLM & 任务
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('llm_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('endpoint', sa.String(500), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('is_local', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('question_tasks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('task_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=True, server_default=sa.text("'PENDING'")),
        sa.Column('progress', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('total_items', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('completed_items', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('result_summary', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # 知识图谱模型 (KnowledgePointModel & MlModel)
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('knowledge_point_models',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_url', sa.String(500), nullable=False),
        sa.Column('source_title', sa.String(200), nullable=True),
        sa.Column('content_hash', sa.String(64), nullable=False),
        sa.Column('extracted_knowledge_points', sa.JSON(), nullable=False),
        sa.Column('confidence_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('subject', sa.String(50), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('confidence_score >= 0 AND confidence_score <= 1', name='check_knowledge_point_models_confidence_score_range'),
        sa.UniqueConstraint('content_hash', name='uq_knowledge_point_models_content_hash'),
    )
    op.create_index('ix_knowledge_point_models_subject', 'knowledge_point_models', ['subject'])
    op.create_index('ix_knowledge_point_models_grade_level', 'knowledge_point_models', ['grade_level'])

    op.create_table('ml_models',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('model_type', sa.String(30), nullable=False),
        sa.Column('framework', sa.String(30), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('hash_sha256', sa.String(64), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_deprecated', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('performance_metrics', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deployed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("model_type IN ('GRADING', 'OCR', 'QUESTION_GEN', 'KNOWLEDGE_EXT')", name='check_ml_models_model_type'),
        sa.CheckConstraint('size_bytes > 0', name='check_ml_models_size_bytes_positive'),
        sa.UniqueConstraint('name', 'version', name='uq_ml_models_name_version'),
    )
    op.create_index('ix_ml_models_created_by', 'ml_models', ['created_by'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 讲解板
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('explanation_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('topic', sa.String(100), nullable=True),
        sa.Column('difficulty_label', sa.String(50), nullable=True),
        sa.Column('problem_statement', sa.Text(), nullable=True),
        sa.Column('graph_config', JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('question_id', name='uq_explanation_sessions_question_id'),
    )
    op.create_index('ix_explanation_sessions_question_id', 'explanation_sessions', ['question_id', 'is_active'])

    op.create_table('explanation_steps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), sa.ForeignKey('explanation_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('panda_emotion', sa.String(20), nullable=False, server_default=sa.text("'explaining'")),
        sa.Column('board_line', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("panda_emotion IN ('idle','thinking','explaining','satisfied')", name='check_steps_emotion'),
        sa.UniqueConstraint('session_id', 'step_order', name='uq_steps_session_order'),
    )
    op.create_index('ix_explanation_steps_session_id', 'explanation_steps', ['session_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 题目推荐
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('question_recommendations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('recommended_by', sa.UUID(), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('question_id', 'student_id', name='uq_recommendation_question_student'),
    )
    op.create_index('ix_question_recommendations_question_id', 'question_recommendations', ['question_id'])
    op.create_index('ix_question_recommendations_student_id', 'question_recommendations', ['student_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 家长模块
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table('encouragement_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('message_template', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "category IN ('EFFORT','PROGRESS','PERSISTENCE','COMPLETION','GENERAL')",
            name='check_template_category',
        ),
    )

    op.create_table('celebration_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('event_type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('metric_value', sa.Integer(), nullable=True),
        sa.Column('parent_notified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('parent_acknowledged', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('encouragement_sent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "event_type IN ('PAPER_COMPLETED','STREAK_MILESTONE','ACCURACY_IMPROVED','ERRORS_CLEARED','SUBJECT_MASTERY')",
            name='check_celebration_event_type',
        ),
    )
    op.create_index('ix_celebration_events_student_id', 'celebration_events', ['student_id'])

    op.create_table('encouragements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('parent_id', sa.UUID(), sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('encouragement_type', sa.String(20), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('template_id', sa.UUID(), sa.ForeignKey('encouragement_templates.id'), nullable=True),
        sa.Column('celebration_event_id', sa.UUID(), sa.ForeignKey('celebration_events.id'), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "encouragement_type IN ('TEMPLATE','CUSTOM','CELEBRATION','REWARD_COMPLETE')",
            name='check_encouragement_type',
        ),
    )
    op.create_index('ix_encouragements_parent_id', 'encouragements', ['parent_id'])
    op.create_index('ix_encouragements_student_read', 'encouragements', ['student_id', 'is_read'])

    op.create_table('reward_goals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('parent_id', sa.UUID(), sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('student_id', sa.UUID(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reward_description', sa.String(500), nullable=False),
        sa.Column('metric_type', sa.String(30), nullable=False),
        sa.Column('target_value', sa.Integer(), nullable=False),
        sa.Column('current_value', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_reward_claimed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "metric_type IN ('PAPERS_COMPLETED','PRACTICE_SESSIONS','STREAK_DAYS','ERRORS_CLEARED','ACCURACY_IMPROVEMENT')",
            name='check_reward_metric_type',
        ),
        sa.CheckConstraint("status IN ('ACTIVE','COMPLETED','CANCELLED','EXPIRED')", name='check_reward_status'),
        sa.CheckConstraint('target_value > 0', name='check_reward_target_positive'),
        sa.CheckConstraint('current_value >= 0', name='check_reward_current_nonneg'),
    )
    op.create_index('ix_reward_goals_parent_id', 'reward_goals', ['parent_id'])
    op.create_index('ix_reward_goals_student_status', 'reward_goals', ['student_id', 'status'])


def downgrade():
    tables = [
        'reward_goals', 'encouragements', 'celebration_events', 'encouragement_templates',
        'question_recommendations',
        'explanation_steps', 'explanation_sessions',
        'ml_models', 'knowledge_point_models',
        'question_tasks', 'llm_configs',
        'notifications',
        'self_study_tasks',
        'error_notebook_questions', 'error_notebooks',
        'grading_records', 'answer_details', 'answer_submissions', 'ocr_uploads',
        'class_students', 'classes',
        'exam_paper_questions', 'exam_papers',
        'knowledge_nodes', 'syllabi',
        'question_knowledge_points', 'questions',
        'knowledge_points', 'subjects',
        'parent_student_links', 'parents', 'students', 'admins', 'sys_admins',
        'roles',
        'provinces', 'question_sources', 'error_types',
        'paper_statuses', 'grade_levels', 'difficulty_levels', 'question_types',
    ]
    for table in tables:
        op.drop_table(table)
