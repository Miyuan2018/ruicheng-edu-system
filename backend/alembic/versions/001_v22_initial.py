"""V2.2 Initial Schema - complete rebuild"""
from alembic import op
import sqlalchemy as sa

revision = '001_v22_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # sys_admins
    op.create_table('sys_admins',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('avatar_url', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('username')
    )
    
    # admins
    op.create_table('admins',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('admin_type', sa.String(20), nullable=False),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('sys_admins.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('username')
    )
    
    # students
    op.create_table('students',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('grade', sa.String(20), nullable=True),
        sa.Column('school', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('username')
    )
    
    # classes
    op.create_table('classes',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('teacher_id', sa.String(36), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # knowledge_points
    op.create_table('knowledge_points',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_id', sa.String(36), sa.ForeignKey('knowledge_points.id'), nullable=True),
        sa.Column('subject', sa.String(50), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('difficulty_level', sa.String(10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('code')
    )
    
    # questions
    op.create_table('questions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('question_type', sa.String(20), nullable=False),
        sa.Column('difficulty', sa.String(10), nullable=False),
        sa.Column('subject', sa.String(50), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('correct_answer', sa.Text(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(20), nullable=True, server_default='MANUAL'),
        sa.Column('review_status', sa.String(20), nullable=True, server_default='APPROVED'),
        sa.Column('reviewed_by', sa.String(36), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source_task_id', sa.String(36), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # exam_papers
    op.create_table('exam_papers',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='DRAFT'),
        sa.Column('total_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # exam_paper_questions
    op.create_table('exam_paper_questions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('exam_paper_id', sa.String(36), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('question_id', sa.String(36), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('score', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # class_students
    op.create_table('class_students',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('class_id', sa.String(36), sa.ForeignKey('classes.id'), nullable=False),
        sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('class_id', 'student_id')
    )
    
    # question_knowledge_points
    op.create_table('question_knowledge_points',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('question_id', sa.String(36), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('knowledge_point_id', sa.String(36), sa.ForeignKey('knowledge_points.id'), nullable=False),
        sa.Column('weight', sa.Numeric(3,2), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('question_id', 'knowledge_point_id')
    )
    
    # ocr_uploads
    op.create_table('ocr_uploads',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('exam_paper_id', sa.String(36), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('ocr_engine', sa.String(50), nullable=True),
        sa.Column('confidence_score', sa.Numeric(5,4), nullable=True),
        sa.Column('processed_text', sa.Text(), nullable=True),
        sa.Column('structured_data', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # answer_submissions
    op.create_table('answer_submissions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('exam_paper_id', sa.String(36), sa.ForeignKey('exam_papers.id'), nullable=False),
        sa.Column('submission_type', sa.String(20), nullable=False),
        sa.Column('ocr_upload_id', sa.String(36), sa.ForeignKey('ocr_uploads.id'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('graded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_score', sa.Numeric(5,2), nullable=True),
        sa.Column('percentage', sa.Numeric(5,2), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # answer_details
    op.create_table('answer_details',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('answer_submission_id', sa.String(36), sa.ForeignKey('answer_submissions.id'), nullable=False),
        sa.Column('question_id', sa.String(36), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('student_answer', sa.Text(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('score_obtained', sa.Numeric(5,2), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('answer_submission_id', 'question_id')
    )
    
    # grading_records
    op.create_table('grading_records',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('answer_submission_id', sa.String(36), sa.ForeignKey('answer_submissions.id'), nullable=False),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('model_version', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_score', sa.Numeric(5,2), nullable=True),
        sa.Column('percentage', sa.Numeric(5,2), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # error_notebooks
    op.create_table('error_notebooks',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('exam_paper_id', sa.String(36), sa.ForeignKey('exam_papers.id'), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('question_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # error_notebook_questions
    op.create_table('error_notebook_questions',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('error_notebook_id', sa.String(36), sa.ForeignKey('error_notebooks.id'), nullable=False),
        sa.Column('original_question_id', sa.String(36), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('practice_question_id', sa.String(36), sa.ForeignKey('questions.id'), nullable=True),
        sa.Column('error_type', sa.String(50), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('error_notebook_id', 'original_question_id')
    )
    
    # notifications
    op.create_table('notifications',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('recipient_id', sa.String(36), nullable=False),
        sa.Column('sender_id', sa.String(36), nullable=True),
        sa.Column('notification_type', sa.String(30), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('channel', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('related_entity_type', sa.String(30), nullable=True),
        sa.Column('related_entity_id', sa.String(36), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # llm_configs
    op.create_table('llm_configs',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('endpoint', sa.String(500), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('is_local', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # syllabi
    op.create_table('syllabi',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('province', sa.String(50), nullable=True),
        sa.Column('subject', sa.String(50), nullable=True),
        sa.Column('content', sa.JSON(), nullable=True),
        sa.Column('knowledge_tree', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='DRAFT'),
        sa.Column('version', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('is_current', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('parent_syllabus_id', sa.String(36), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # question_tasks
    op.create_table('question_tasks',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('task_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=True, server_default='PENDING'),
        sa.Column('progress', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_items', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('completed_items', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('result_summary', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # knowledge_nodes
    op.create_table('knowledge_nodes',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('syllabus_id', sa.String(36), sa.ForeignKey('syllabi.id'), nullable=False),
        sa.Column('parent_id', sa.String(36), sa.ForeignKey('knowledge_nodes.id'), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('node_type', sa.String(20), nullable=False, server_default='POINT'),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('version', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('invalid_reason', sa.String(30), nullable=True),
        sa.Column('is_modified', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # knowledge_point_models (phase 2)
    op.create_table('knowledge_point_models',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('source_url', sa.String(500), nullable=False),
        sa.Column('source_title', sa.String(200), nullable=True),
        sa.Column('content_hash', sa.String(64), nullable=False),
        sa.Column('extracted_knowledge_points', sa.JSON(), nullable=False),
        sa.Column('confidence_score', sa.Numeric(5,4), nullable=True),
        sa.Column('subject', sa.String(50), nullable=False),
        sa.Column('grade_level', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('content_hash')
    )
    
    # ml_models
    op.create_table('ml_models',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('model_type', sa.String(30), nullable=False),
        sa.Column('framework', sa.String(30), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('hash_sha256', sa.String(64), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_deprecated', sa.Boolean(), nullable=False),
        sa.Column('performance_metrics', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('admins.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deployed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('name', 'version')
    )
    
    # self_study_tasks
    op.create_table('self_study_tasks',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('task_type', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('assigned_to', sa.String(36), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('result_data', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    for table in ['self_study_tasks','ml_models','knowledge_point_models','knowledge_nodes',
                   'question_tasks','syllabi','llm_configs','notifications',
                   'error_notebook_questions','error_notebooks','grading_records',
                   'answer_details','answer_submissions','ocr_uploads',
                   'question_knowledge_points','class_students','exam_paper_questions',
                   'exam_papers','questions','knowledge_points','classes',
                   'students','admins','sys_admins']:
        op.drop_table(table)
