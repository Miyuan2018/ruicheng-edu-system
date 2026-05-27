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
import MyPapersPage from './pages/papers/MyPapersPage';
import TypicalQuestionsPage from './pages/TypicalQuestionsPage';
import MistakeBookPage from './pages/mistake-book/MistakeBookPage';
import SelfStudyPage from './pages/self-study/SelfStudyPage';
import TopicBoardPage from './pages/topic-board/TopicBoardPage';
import ParentLoginPage from './pages/auth/ParentLoginPage';
import ParentEncouragePage from './pages/parent/ParentEncouragePage';
import ParentRewardGoalsPage from './pages/parent/ParentRewardGoalsPage';
import ParentCelebrationsPage from './pages/parent/ParentCelebrationsPage';
import TeacherClassesPage from './pages/teacher/TeacherClassesPage';
import PaperStatsPage from './pages/teacher/PaperStatsPage';
import QuestionStatsPage from './pages/teacher/QuestionStatsPage';

import AdminConfigPage from './pages/admin/AdminConfigPage';
import BasicConfigPage from './pages/admin/BasicConfigPage';
import QuestionAdminPage from './pages/admin/QuestionAdminPage';
import SyllabusPage from './pages/admin/SyllabusPage';
import SysAdminPage from './pages/admin/SysAdminPage';
import PrintPreviewPage from './pages/papers/PrintPreviewPage';
import { getAccessToken, getUserType } from './store/auth';

function isAuth() { return !!getAccessToken(); }

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuth()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  if (isAuth()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PapersPage() {
  const userType = getUserType();
  if (userType === 'STUDENT') return <MyPapersPage />;
  return <PaperListPage />;
}

export default function AppRouter() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#667eea', borderRadius: 6 } }}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/parent/login" element={<PublicRoute><ParentLoginPage /></PublicRoute>} />
            <Route path="/admin/login" element={<PublicRoute><AdminLoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="questions" element={<QuestionListPage />} />
              <Route path="papers" element={<PapersPage />} />
              <Route path="my-papers" element={<MyPapersPage />} />
              <Route path="typical-questions" element={<TypicalQuestionsPage />} />
              <Route path="mistake-book" element={<MistakeBookPage />} />
              <Route path="self-study" element={<SelfStudyPage />} />
              <Route path="topic-board" element={<TopicBoardPage />} />
              <Route path="teacher/classes" element={<TeacherClassesPage />} />
              <Route path="teacher/stats/paper" element={<PaperStatsPage />} />
              <Route path="teacher/stats/question" element={<QuestionStatsPage />} />

              <Route path="admin/basic-config" element={<BasicConfigPage />} />
              <Route path="admin/config" element={<AdminConfigPage />} />
              <Route path="admin/sys-admin" element={<SysAdminPage />} />
              <Route path="question-admin" element={<QuestionAdminPage />} />
              <Route path="syllabus" element={<SyllabusPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="parent/encourage" element={<ParentEncouragePage />} />
              <Route path="parent/reward-goals" element={<ParentRewardGoalsPage />} />
              <Route path="parent/celebrations" element={<ParentCelebrationsPage />} />
            </Route>
            <Route path="/print-preview" element={<PrintPreviewPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
