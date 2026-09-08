import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { roleHome, RequireRole } from "./guards";
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
