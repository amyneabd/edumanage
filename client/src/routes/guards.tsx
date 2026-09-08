import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "../components/Feedback";
import type { Me, Role } from "../api/types";

export function roleHome(user: Me): string {
  if (user.role === "ADMIN") return "/admin";
  if (user.status !== "ACTIVE") return "/pending";
  if (user.role === "TEACHER") return "/teacher/overview";
  if (user.role === "PARENT") return "/parent/home";
  return "/pupil/home";
}

export function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

// Guards the logged-out-only pages (/login, /register): if the visitor
// already has a valid session, send them to their dashboard instead of
// showing the login/register form again. Without this, a session cookie
// that's still perfectly valid gets masked by the form on every visit to
// these routes, which looks exactly like being signed out.
export function RedirectIfAuthenticated() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <Spinner />;
  if (isAuthenticated && user) return <Navigate to={roleHome(user)} replace />;

  return <Outlet />;
}

// Used for "/" and any unmatched path. Previously these routes redirected
// unconditionally to /login regardless of auth state, so visiting the bare
// domain (exactly what happens when you reopen a closed tab/browser and
// type the site's URL) always showed the login form even with a fully
// valid session. Route to the right place based on actual auth state
// instead.
export function RootRedirect() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <Spinner />;
  if (isAuthenticated && user) return <Navigate to={roleHome(user)} replace />;

  return <Navigate to="/login" replace />;
}

export function RequireRole({ role }: { role: Role }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={roleHome(user)} replace />;
  if (user.role !== "ADMIN" && user.status !== "ACTIVE") return <Navigate to="/pending" replace />;

  return <Outlet />;
}
