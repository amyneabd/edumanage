import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { VacationSessionsPanel } from "./ClassDetailPage";
import type { VacationPeriod, VacationSessionEntry } from "../../api/types";

const { fetchCurrentVacationMock, fetchVacationSessionsMock } = vi.hoisted(() => ({
  fetchCurrentVacationMock: vi.fn(),
  fetchVacationSessionsMock: vi.fn(),
}));

vi.mock("../../api/teacher", async () => {
  const actual = await vi.importActual<typeof import("../../api/teacher")>("../../api/teacher");
  return {
    ...actual,
    fetchCurrentVacation: fetchCurrentVacationMock,
    fetchVacationSessions: fetchVacationSessionsMock,
  };
});

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const activePeriod: VacationPeriod = {
  id: "vp1",
  teacherId: "t1",
  startDate: "2026-09-10",
  endDate: "2026-09-20",
  status: "ACTIVE",
  createdAt: "2026-09-01",
};

describe("VacationSessionsPanel", () => {
  it("renders nothing when no vacation period is active", async () => {
    fetchCurrentVacationMock.mockResolvedValue(null);
    const { container } = renderWithClient(<VacationSessionsPanel classId="c1" />);
    await waitFor(() => expect(fetchCurrentVacationMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an empty-list message when a period is active with no sessions yet", async () => {
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    fetchVacationSessionsMock.mockResolvedValue([]);
    renderWithClient(<VacationSessionsPanel classId="c1" />);
    expect(await screen.findByText("No ad-hoc sessions added yet.")).toBeInTheDocument();
  });

  it("lists existing ad-hoc sessions for the class", async () => {
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    const session: VacationSessionEntry = {
      id: "s1",
      vacationPeriodId: "vp1",
      classId: "c1",
      date: "2026-09-12",
      startTime: "10:00",
      endTime: "11:00",
    };
    fetchVacationSessionsMock.mockResolvedValue([session]);
    renderWithClient(<VacationSessionsPanel classId="c1" />);
    expect(await screen.findByText("10:00–11:00")).toBeInTheDocument();
  });
});
