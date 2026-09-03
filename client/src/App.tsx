import { lazy, Suspense, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  Wallet,
  GraduationCap,
  MessageSquare,
  UserCog,
  CalendarDays,
  ClipboardCheck,
  Receipt,
} from "lucide-react";
import { AppLayout } from "./components/AppLayout";
import { Spinner } from "./components/Feedback";
import { RequireAuth, RequireRole } from "./routes/guards";

const LoginPage = lazy(() => import("./features/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import("./features/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const PendingPage = lazy(() => import("./features/auth/PendingPage").then((m) => ({ default: m.PendingPage })));
const ForgotPasswordPage = lazy(() =>
  import("./features/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("./features/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import("./features/auth/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })),
);
const SettingsPage = lazy(() =>
  import("./features/account/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const AdminPage = lazy(() => import("./features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const TeacherDetailPage = lazy(() =>
  import("./features/admin/TeacherDetailPage").then((m) => ({ default: m.TeacherDetailPage })),
);
const OverviewPage = lazy(() =>
  import("./features/teacher/OverviewPage").then((m) => ({ default: m.OverviewPage })),
);
const ClassesPage = lazy(() =>
  import("./features/teacher/ClassesPage").then((m) => ({ default: m.ClassesPage })),
);
const ClassDetailPage = lazy(() =>
  import("./features/teacher/ClassDetailPage").then((m) => ({ default: m.ClassDetailPage })),
);
const LedgerPage = lazy(() => import("./features/teacher/LedgerPage").then((m) => ({ default: m.LedgerPage })));
const FeedPage = lazy(() => import("./features/teacher/FeedPage").then((m) => ({ default: m.FeedPage })));
const GradebookPage = lazy(() =>
  import("./features/teacher/GradebookPage").then((m) => ({ default: m.GradebookPage })),
);
const PupilHomePage = lazy(() => import("./features/pupil/HomePage").then((m) => ({ default: m.PupilHomePage })));
const PupilSchedulePage = lazy(() =>
  import("./features/pupil/SchedulePage").then((m) => ({ default: m.PupilSchedulePage })),
);
const PupilAttendancePage = lazy(() =>
  import("./features/pupil/AttendancePage").then((m) => ({ default: m.PupilAttendancePage })),
);
const PupilPaymentsPage = lazy(() =>
  import("./features/pupil/PaymentsPage").then((m) => ({ default: m.PupilPaymentsPage })),
);
const PupilGradesPage = lazy(() =>
  import("./features/pupil/GradesPage").then((m) => ({ default: m.PupilGradesPage })),
);
const PupilFeedPage = lazy(() => import("./features/pupil/FeedPage").then((m) => ({ default: m.PupilFeedPage })));
const ParentHomePage = lazy(() =>
  import("./features/parent/HomePage").then((m) => ({ default: m.ParentHomePage })),
);
const ParentSchedulePage = lazy(() =>
  import("./features/parent/SchedulePage").then((m) => ({ default: m.ParentSchedulePage })),
);
const ParentAttendancePage = lazy(() =>
  import("./features/parent/AttendancePage").then((m) => ({ default: m.ParentAttendancePage })),
);
const ParentPaymentsPage = lazy(() =>
  import("./features/parent/PaymentsPage").then((m) => ({ default: m.ParentPaymentsPage })),
);
const ParentLedgerPage = lazy(() =>
  import("./features/parent/LedgerPage").then((m) => ({ default: m.ParentLedgerPage })),
);
const ParentGradesPage = lazy(() =>
  import("./features/parent/GradesPage").then((m) => ({ default: m.ParentGradesPage })),
);
const ParentFeedPage = lazy(() =>
  import("./features/parent/FeedPage").then((m) => ({ default: m.ParentFeedPage })),
);

const adminNav = [{ to: "/admin", label: "Teachers", icon: UserCog }];

const teacherNav = [
  { to: "/teacher/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/teacher/classes", label: "Class Management", icon: Users2 },
  { to: "/teacher/ledger", label: "Ledger", icon: Wallet },
  { to: "/teacher/gradebook", label: "Gradebook", icon: GraduationCap },
  { to: "/teacher/feed", label: "Communication", icon: MessageSquare },
];

const pupilNav = [
  { to: "/pupil/home", label: "Home", icon: LayoutDashboard },
  { to: "/pupil/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/pupil/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/pupil/payments", label: "Payments", icon: Wallet },
  { to: "/pupil/grades", label: "Grades", icon: GraduationCap },
  { to: "/pupil/feed", label: "Class Feed", icon: MessageSquare },
];

const parentNav = [
  { to: "/parent/home", label: "Home", icon: LayoutDashboard },
  { to: "/parent/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/parent/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/parent/payments", label: "Payments", icon: Wallet },
  { to: "/parent/ledger", label: "Ledger", icon: Receipt },
  { to: "/parent/grades", label: "Grades", icon: GraduationCap },
  { to: "/parent/feed", label: "Class Feed", icon: MessageSquare },
];

function withSuspense(element: ReactElement) {
  return <Suspense fallback={<Spinner />}>{element}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={withSuspense(<LoginPage />)} />
        <Route path="/register" element={withSuspense(<RegisterPage />)} />
        <Route path="/forgot-password" element={withSuspense(<ForgotPasswordPage />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPasswordPage />)} />
        <Route path="/verify-email" element={withSuspense(<VerifyEmailPage />)} />

        <Route element={<RequireAuth />}>
          <Route path="/pending" element={withSuspense(<PendingPage />)} />

          <Route element={<RequireRole role="ADMIN" />}>
            <Route element={<AppLayout navItems={adminNav} brand="Admin" />}>
              <Route path="/admin" element={withSuspense(<AdminPage />)} />
              <Route path="/admin/teachers/:id" element={withSuspense(<TeacherDetailPage />)} />
              <Route path="/admin/settings" element={withSuspense(<SettingsPage />)} />
            </Route>
          </Route>

          <Route element={<RequireRole role="TEACHER" />}>
            <Route element={<AppLayout navItems={teacherNav} brand="Teacher" notifications="teacher" />}>
              <Route path="/teacher/overview" element={withSuspense(<OverviewPage />)} />
              <Route path="/teacher/classes" element={withSuspense(<ClassesPage />)} />
              <Route path="/teacher/classes/:id" element={withSuspense(<ClassDetailPage />)} />
              <Route path="/teacher/ledger" element={withSuspense(<LedgerPage />)} />
              <Route path="/teacher/gradebook" element={withSuspense(<GradebookPage />)} />
              <Route path="/teacher/feed" element={withSuspense(<FeedPage />)} />
              <Route path="/teacher/settings" element={withSuspense(<SettingsPage />)} />
            </Route>
          </Route>

          <Route element={<RequireRole role="PUPIL" />}>
            <Route element={<AppLayout navItems={pupilNav} brand="Pupil" />}>
              <Route path="/pupil/home" element={withSuspense(<PupilHomePage />)} />
              <Route path="/pupil/schedule" element={withSuspense(<PupilSchedulePage />)} />
              <Route path="/pupil/attendance" element={withSuspense(<PupilAttendancePage />)} />
              <Route path="/pupil/payments" element={withSuspense(<PupilPaymentsPage />)} />
              <Route path="/pupil/grades" element={withSuspense(<PupilGradesPage />)} />
              <Route path="/pupil/feed" element={withSuspense(<PupilFeedPage />)} />
              <Route path="/pupil/settings" element={withSuspense(<SettingsPage />)} />
            </Route>
          </Route>

          <Route element={<RequireRole role="PARENT" />}>
            <Route element={<AppLayout navItems={parentNav} brand="Parent" notifications="parent" />}>
              <Route path="/parent/home" element={withSuspense(<ParentHomePage />)} />
              <Route path="/parent/schedule" element={withSuspense(<ParentSchedulePage />)} />
              <Route path="/parent/attendance" element={withSuspense(<ParentAttendancePage />)} />
              <Route path="/parent/payments" element={withSuspense(<ParentPaymentsPage />)} />
              <Route path="/parent/ledger" element={withSuspense(<ParentLedgerPage />)} />
              <Route path="/parent/grades" element={withSuspense(<ParentGradesPage />)} />
              <Route path="/parent/feed" element={withSuspense(<ParentFeedPage />)} />
              <Route path="/parent/settings" element={withSuspense(<SettingsPage />)} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
