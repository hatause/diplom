import { useEffect, lazy, Suspense } from "react";
import { PracticePage } from "@/pages/companion/PracticePage";
import { NotesPage } from "@/pages/companion/NotesPage";
import { PlannerPage } from "@/pages/companion/PlannerPage";
import { ProgressPage } from "@/pages/companion/ProgressPage";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useThemeStore } from "@/store/theme.store";
import { MainLayout } from "@/layouts/MainLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import { SubjectsPage } from "@/pages/SubjectsPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { LecturesPage } from "@/pages/LecturesPage";
import { MessagesPage } from "@/pages/MessagesPage";
const TestGeneratePage = lazy(() =>
  import("@/pages/TestGeneratePage").then((m) => ({
    default: m.TestGeneratePage,
  })),
);
const TestPlayerPage = lazy(() =>
  import("@/pages/TestPlayerPage").then((m) => ({ default: m.TestPlayerPage })),
);
const TestResultPage = lazy(() =>
  import("@/pages/TestResultPage").then((m) => ({ default: m.TestResultPage })),
);
import { HistoryPage } from "@/pages/HistoryPage";
const AnalyticsPage = lazy(() =>
  import("@/pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);
import { ReviewPage } from "@/pages/ReviewPage";
const AchievementsPage = lazy(() =>
  import("@/pages/AchievementsPage").then((m) => ({
    default: m.AchievementsPage,
  })),
);
import { AITutorPage } from "@/pages/AITutorPage";
import { ProfilePage } from "@/pages/ProfilePage";
const TeacherDashboardPage = lazy(() =>
  import("@/pages/teacher/TeacherDashboardPage").then((m) => ({
    default: m.TeacherDashboardPage,
  })),
);
const LecturePage = lazy(() =>
  import("@/pages/teacher/LecturePage").then((m) => ({
    default: m.LecturePage,
  })),
);
const GroupsPage = lazy(() => import("@/pages/teacher/GroupsPage"));
const AdminDashboardPage = lazy(() =>
  import("@/pages/admin/AdminDashboardPage").then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const FeynmanPage = lazy(() =>
  import("@/pages/FeynmanPage").then((m) => ({ default: m.FeynmanPage })),
);
const DebatePage = lazy(() =>
  import("@/pages/DebatePage").then((m) => ({ default: m.DebatePage })),
);
import { ClassroomSearchPage } from "@/pages/ClassroomSearchPage";
import { LandingPage } from "@/pages/landing/LandingPage";

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 border-4 rounded-full animate-spin"
          style={{
            borderColor: "var(--border-subtle)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p
          style={{ color: "var(--text-secondary)" }}
          className="text-sm font-medium"
        >
          Загрузка AI Tutor...
        </p>
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
            background: "var(--bg-glass-strong)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border-glass)",
            color: "var(--text-primary)",
          },
        }}
      />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Main app */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/lectures" element={<LecturesPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/classroom" element={<ClassroomSearchPage />} />
            <Route path="/test/generate" element={<TestGeneratePage />} />
            <Route path="/test/:attemptId/play" element={<TestPlayerPage />} />
            <Route
              path="/test/:attemptId/result"
              element={<TestResultPage />}
            />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/ai-tutor" element={<AITutorPage key="tutor" />} />
            <Route
              path="/homework"
              element={<AITutorPage key="homework" mode="homework" />}
            />
            <Route
              path="/study"
              element={<AITutorPage key="study" mode="study" />}
            />
            <Route
              path="/term"
              element={<AITutorPage key="term" mode="term" />}
            />
            <Route
              path="/flashcards"
              element={<PracticePage key="decks" kind="decks" />}
            />
            <Route
              path="/quiz"
              element={<PracticePage key="quizzes" kind="quizzes" />}
            />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/feynman" element={<FeynmanPage />} />
            <Route path="/debate" element={<DebatePage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Teacher */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute roles={["TEACHER", "ADMIN"]}>
                  <TeacherDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/lectures/:id"
              element={
                <ProtectedRoute roles={["TEACHER", "ADMIN"]}>
                  <LecturePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/groups"
              element={
                <ProtectedRoute roles={["TEACHER", "ADMIN"]}>
                  <GroupsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
