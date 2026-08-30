import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { roleHome, RequireRole } from "./guards";
import type { Me } from "../api/types";

const baseUser: Me = {
  id: "u1",
  name: "Pat",
  email: "pat@test.com",
  role: "PUPIL",
  status: "ACTIVE",
  emailVerified: false,
  emailVerificationRequired: true,
  teacherCode: null,
  parentCode: null,
};

describe("roleHome", () => {
  it("sends an unverified user to /verify-email when verification is required", () => {
    expect(roleHome({ ...baseUser, emailVerified: false, emailVerificationRequired: true })).toBe("/verify-email");
  });

  it("skips the verify-email redirect when verification is not required", () => {
    expect(roleHome({ ...baseUser, emailVerified: false, emailVerificationRequired: false })).toBe("/pupil/home");
  });

  it("still honors emailVerified=true regardless of the requirement flag", () => {
    expect(roleHome({ ...baseUser, emailVerified: true, emailVerificationRequired: true })).toBe("/pupil/home");
  });
});

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../hooks/useAuth", () => ({ useAuth: useAuthMock }));

function renderRequireRole() {
  return render(
    <MemoryRouter initialEntries={["/pupil"]}>
      <Routes>
        <Route element={<RequireRole role="PUPIL" />}>
          <Route path="/pupil" element={<div>pupil area</div>} />
        </Route>
        <Route path="/verify-email" element={<div>verify email page</div>} />
        <Route path="/pending" element={<div>pending page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRole", () => {
  it("redirects to /verify-email when unverified and verification is required", () => {
    useAuthMock.mockReturnValue({ user: { ...baseUser, emailVerified: false, emailVerificationRequired: true }, isLoading: false });
    renderRequireRole();
    expect(screen.getByText("verify email page")).toBeInTheDocument();
  });

  it("renders the protected route when unverified but verification is not required", () => {
    useAuthMock.mockReturnValue({ user: { ...baseUser, emailVerified: false, emailVerificationRequired: false }, isLoading: false });
    renderRequireRole();
    expect(screen.getByText("pupil area")).toBeInTheDocument();
  });
});
