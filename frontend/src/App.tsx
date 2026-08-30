import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import { SubjectsPage } from '@/pages/SubjectsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { LecturesPage } from '@/pages/LecturesPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { TestGeneratePage } from '@/pages/TestGeneratePage';
import { TestPlayerPage } from '@/pages/TestPlayerPage';
import { TestResultPage } from '@/pages/TestResultPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import { AITutorPage } from '@/pages/AITutorPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TeacherDashboardPage } from '@/pages/teacher/TeacherDashboardPage';
import { LecturePage } from '@/pages/teacher/LecturePage';
import GroupsPage from '@/pages/teacher/GroupsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { FeynmanPage } from '@/pages/FeynmanPage';
import { DebatePage } from '@/pages/DebatePage';
import { LandingPage } from '@/pages/landing/LandingPage';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent)' }} />
        <p style={{ color: 'var(--text-secondary)' }} className="text-sm font-medium">Загрузка AI Tutor...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { fetchMe, isLoading } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-glass-strong)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
          },
        }}
      />
      <Routes>
        {/* Auth */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Main app */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/lectures" element={<LecturesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/test/generate" element={<TestGeneratePage />} />
          <Route path="/test/:attemptId/play" element={<TestPlayerPage />} />
          <Route path="/test/:attemptId/result" element={<TestResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/ai-tutor" element={<AITutorPage />} />
          <Route path="/feynman" element={<FeynmanPage />} />
          <Route path="/debate" element={<DebatePage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Teacher */}
          <Route path="/teacher" element={
            <ProtectedRoute roles={['TEACHER', 'ADMIN']}><TeacherDashboardPage /></ProtectedRoute>
          } />
          <Route path="/teacher/lectures/:id" element={
            <ProtectedRoute roles={['TEACHER', 'ADMIN']}><LecturePage /></ProtectedRoute>
          } />
          <Route path="/teacher/groups" element={
            <ProtectedRoute roles={['TEACHER', 'ADMIN']}><GroupsPage /></ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['ADMIN']}><AdminDashboardPage /></ProtectedRoute>
          } />
        </Route>

        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
