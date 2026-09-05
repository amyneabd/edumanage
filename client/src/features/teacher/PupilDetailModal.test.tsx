import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PupilDetailModal } from "./PupilDetailModal.js";

const { fetchAttendanceCalendar, fetchPupilDetail, fetchPupilPayments } = vi.hoisted(() => ({
  fetchAttendanceCalendar: vi.fn(),
  fetchPupilDetail: vi.fn(),
  fetchPupilPayments: vi.fn(),
}));

vi.mock("../../api/teacher.js", async (importActual) => ({
  ...(await importActual<typeof import("../../api/teacher.js")>()),
  fetchAttendanceCalendar,
  fetchPupilDetail,
  fetchPupilPayments,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PupilDetailModal attendance calendar", () => {
  it("renders an EXCUSED day with its own label", async () => {
    fetchPupilDetail.mockResolvedValue({
      id: "pupil-1",
      name: "Test Pupil",
      email: "test@example.com",
      classId: "class-1",
      className: "Math",
      classType: "MATH",
    });

    fetchAttendanceCalendar.mockResolvedValue({
      period: "2026-09",
      className: "Math",
      classType: "MATH",
      days: [
        { date: "2026-09-07", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", display: "EXCUSED", record: "EXCUSED" },
      ],
    });

    fetchPupilPayments.mockResolvedValue([]);

    renderWithClient(<PupilDetailModal pupilId="pupil-1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/excused/i)).toBeInTheDocument());
  });
});
