import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';
import ProfilePage from './pages/auth/ProfilePage';
import DashboardPage from './pages/dashboard/DashboardPage';
import QuestionListPage from './pages/questions/QuestionListPage';
import PaperListPage from './pages/papers/PaperListPage';
import StudentPapersPage from './pages/papers/StudentPapersPage';
import MistakeBookPage from './pages/mistake-book/MistakeBookPage';
import TeacherClassesPage from './pages/teacher/TeacherClassesPage';
import PaperStatsPage from './pages/teacher/PaperStatsPage';
import QuestionStatsPage from './pages/teacher/QuestionStatsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminConfigPage from './pages/admin/AdminConfigPage';
import QuestionAdminPage from './pages/admin/QuestionAdminPage';
import KnowledgeTreePage from './pages/admin/KnowledgeTreePage';
import SyllabusPage from './pages/admin/SyllabusPage';
import SysAdminPage from './pages/admin/SysAdminPage';
import PrintPreviewPage from './pages/papers/PrintPreviewPage';

function isAuth() { return !!localStorage.getItem('access_token'); }

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuth()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  if (isAuth()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PapersPage() {
  var userType = localStorage.getItem('user_type') || 'STUDENT';
  if (userType === 'STUDENT') return <StudentPapersPage />;
  return <PaperListPage />;
}

export default function AppRouter() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#667eea', borderRadius: 6 } }}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/admin/login" element={<PublicRoute><AdminLoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="questions" element={<QuestionListPage />} />
              <Route path="papers" element={<PapersPage />} />
              <Route path="mistake-book" element={<MistakeBookPage />} />
              <Route path="teacher/classes" element={<TeacherClassesPage />} />
              <Route path="teacher/stats/paper" element={<PaperStatsPage />} />
              <Route path="teacher/stats/question" element={<QuestionStatsPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/config" element={<AdminConfigPage />} />
              <Route path="admin/sys-admin" element={<SysAdminPage />} />
              <Route path="question-admin" element={<QuestionAdminPage />} />
              <Route path="knowledge-tree" element={<KnowledgeTreePage />} />
              <Route path="syllabus" element={<SyllabusPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path="/print-preview" element={<PrintPreviewPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
