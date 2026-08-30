import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { logout } from "../api/auth";
import { NotificationBell } from "./NotificationBell";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
}

export function AppLayout({
  navItems,
  brand,
  notifications,
}: {
  navItems: NavItem[];
  brand: string;
  notifications?: "teacher" | "parent";
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const roleBase = location.pathname.split("/")[1] || "";
  const settingsPath = `/${roleBase}/settings`;

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  // Close the off-canvas sidebar whenever the route changes (mobile nav click).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Keep the browser tab title in sync with the active section instead of a
  // static "client" title on every page.
  useEffect(() => {
    const active = navItems.find(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
    const title = active
      ? active.label
      : location.pathname.endsWith("/settings")
        ? "Account settings"
        : brand;
    document.title = `${title} · EduManage`;
  }, [location.pathname, navItems, brand]);

  return (
    <div className="flex min-h-svh">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-navy-800 bg-navy transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:w-60 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-navy-800 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">EduManage</p>
              <p className="text-xs text-white/50">{brand}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-sm text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "focus-ring flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.icon && (
                    <item.icon
                      className={clsx("h-4 w-4 shrink-0", isActive ? "text-accent-600" : "text-white/50")}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  )}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-navy-800 p-4">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate text-xs text-white/50">{user?.email}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              to={settingsPath}
              className="focus-ring rounded-sm text-xs font-medium text-white/60 hover:text-white"
            >
              Account settings
            </Link>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="focus-ring rounded-sm text-xs font-medium text-white/60 hover:text-danger-600"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas">
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="focus-ring flex min-h-11 items-center gap-2 rounded-sm px-1.5 text-ink-700 hover:bg-canvas"
            aria-label="Open menu, EduManage"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            <span className="text-sm font-semibold text-ink-900">EduManage</span>
          </button>
          {notifications && <NotificationBell role={notifications} />}
        </div>

        {notifications && (
          <div className="hidden items-center justify-end border-b border-border bg-surface px-8 py-3 lg:flex">
            <NotificationBell role={notifications} />
          </div>
        )}
        <div className="flex-1 p-5 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
