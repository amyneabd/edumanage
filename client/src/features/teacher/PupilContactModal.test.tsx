import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PupilContactModal } from "./PupilContactModal";
import type { PupilDetail } from "../../api/types";

const pupil: PupilDetail = {
  userId: "p1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "12345678",
  parentPhone: "87654321",
  parentName: "Byron Lovelace",
  status: "ACTIVE",
  classId: "c1",
  className: "Advanced Math",
  classType: "MATH",
  scheduleSlots: [],
};

afterEach(() => cleanup());

describe("PupilContactModal", () => {
  it("renders nothing when no pupil is selected", () => {
    const { container } = render(<PupilContactModal pupil={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the pupil's full name, class, email, and phone number", () => {
    render(<PupilContactModal pupil={pupil} onClose={() => {}} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Advanced Math")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("12345678")).toBeInTheDocument();
  });

  it("shows the linked parent's name and phone number", () => {
    render(<PupilContactModal pupil={pupil} onClose={() => {}} />);
    expect(screen.getByText("Byron Lovelace")).toBeInTheDocument();
    expect(screen.getByText("87654321")).toBeInTheDocument();
  });

  it("falls back to a 'no linked parent account' message with just the phone when unlinked", () => {
    render(<PupilContactModal pupil={{ ...pupil, parentName: null }} onClose={() => {}} />);
    expect(screen.getByText("No linked parent account")).toBeInTheDocument();
    expect(screen.getByText("87654321")).toBeInTheDocument();
  });
});
