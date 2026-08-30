import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "../components/Feedback";
import type { Me, Role } from "../api/types";

export function roleHome(user: Me): string {
  if (user.role === "ADMIN") return "/admin";
  if (!user.emailVerified) return "/verify-email";
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

export function RequireRole({ role }: { role: Role }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={roleHome(user)} replace />;
  if (user.role !== "ADMIN" && !user.emailVerified) return <Navigate to="/verify-email" replace />;
  if (user.role !== "ADMIN" && user.status !== "ACTIVE") return <Navigate to="/pending" replace />;

  return <Outlet />;
}
