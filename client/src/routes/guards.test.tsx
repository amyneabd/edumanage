import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { roleHome, RequireRole, RedirectIfAuthenticated, RootRedirect } from "./guards";
import type { Me } from "../api/types";

const baseUser: Me = {
  id: "u1",
  name: "Pat",
  email: "pat@test.com",
  role: "PUPIL",
  status: "ACTIVE",
  teacherCode: null,
  parentCode: null,
};

describe("roleHome", () => {
  it("routes ADMIN to /admin regardless of status", () => {
    expect(roleHome({ ...baseUser, role: "ADMIN", status: "PENDING" })).toBe("/admin");
  });

  it("routes any non-ACTIVE non-admin user to /pending", () => {
    expect(roleHome({ ...baseUser, role: "TEACHER", status: "PENDING" })).toBe("/pending");
  });

  it("routes an ACTIVE TEACHER to /teacher/overview", () => {
    expect(roleHome({ ...baseUser, role: "TEACHER", status: "ACTIVE" })).toBe("/teacher/overview");
  });

  it("routes an ACTIVE PARENT to /parent/home", () => {
    expect(roleHome({ ...baseUser, role: "PARENT", status: "ACTIVE" })).toBe("/parent/home");
  });

  it("routes an ACTIVE PUPIL to /pupil/home", () => {
    expect(roleHome({ ...baseUser, role: "PUPIL", status: "ACTIVE" })).toBe("/pupil/home");
  });
});

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../hooks/useAuth", () => ({ useAuth: useAuthMock }));

afterEach(cleanup);

function renderRequireRole(guardRole: Me["role"] = "PUPIL") {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route element={<RequireRole role={guardRole} />}>
          <Route path="/protected" element={<div>protected area</div>} />
        </Route>
        <Route path="/pending" element={<div>pending page</div>} />
        <Route path="/teacher/overview" element={<div>teacher overview page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRole", () => {
  it("renders the outlet for an ADMIN user, bypassing the status check", () => {
    useAuthMock.mockReturnValue({ user: { ...baseUser, role: "ADMIN", status: "PENDING" }, isLoading: false });
    renderRequireRole("ADMIN");
    expect(screen.getByText("protected area")).toBeInTheDocument();
  });

  it("redirects a non-ACTIVE (pending) non-admin user to /pending", () => {
    useAuthMock.mockReturnValue({ user: { ...baseUser, role: "PUPIL", status: "PENDING" }, isLoading: false });
    renderRequireRole("PUPIL");
    expect(screen.getByText("pending page")).toBeInTheDocument();
  });

  it("renders the outlet when the user's role matches and status is ACTIVE", () => {
    useAuthMock.mockReturnValue({ user: { ...baseUser, role: "PUPIL", status: "ACTIVE" }, isLoading: false });
    renderRequireRole("PUPIL");
    expect(screen.getByText("protected area")).toBeInTheDocument();
  });

  it("redirects to the user's role home when the role doesn't match", () => {
    useAuthMock.mockReturnValue({ user: { ...baseUser, role: "TEACHER", status: "ACTIVE" }, isLoading: false });
    renderRequireRole("PUPIL");
    expect(screen.getByText("teacher overview page")).toBeInTheDocument();
  });
});

function renderRedirectIfAuthenticated() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="/login" element={<div>login form</div>} />
        </Route>
        <Route path="/teacher/overview" element={<div>teacher overview page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RedirectIfAuthenticated", () => {
  it("shows the login form when there is no valid session", () => {
    useAuthMock.mockReturnValue({ user: undefined, isAuthenticated: false, isLoading: false });
    renderRedirectIfAuthenticated();
    expect(screen.getByText("login form")).toBeInTheDocument();
  });

  it("redirects an already-authenticated visitor away from /login to their dashboard", () => {
    // Regression test: this is the exact scenario a user hits after closing
    // and reopening a tab with a still-valid session cookie — landing on
    // /login must not show the form again, it must bounce them onward.
    useAuthMock.mockReturnValue({
      user: { ...baseUser, role: "TEACHER", status: "ACTIVE" },
      isAuthenticated: true,
      isLoading: false,
    });
    renderRedirectIfAuthenticated();
    expect(screen.getByText("teacher overview page")).toBeInTheDocument();
  });
});

function renderRootRedirect() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<div>login form</div>} />
        <Route path="/teacher/overview" element={<div>teacher overview page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RootRedirect", () => {
  it("sends an unauthenticated visitor to /login", () => {
    useAuthMock.mockReturnValue({ user: undefined, isAuthenticated: false, isLoading: false });
    renderRootRedirect();
    expect(screen.getByText("login form")).toBeInTheDocument();
  });

  it("sends an authenticated visitor to their role home instead of /login", () => {
    // Regression test for the bug where visiting the bare domain (e.g.
    // reopening a closed tab and typing the site URL) always landed on the
    // login form even with a fully valid session, because "/" redirected to
    // /login unconditionally without checking auth state.
    useAuthMock.mockReturnValue({
      user: { ...baseUser, role: "TEACHER", status: "ACTIVE" },
      isAuthenticated: true,
      isLoading: false,
    });
    renderRootRedirect();
    expect(screen.getByText("teacher overview page")).toBeInTheDocument();
  });
});
