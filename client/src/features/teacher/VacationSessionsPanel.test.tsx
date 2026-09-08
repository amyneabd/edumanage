import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { VacationSessionsPanel } from "./ClassDetailPage";
import type { VacationPeriod, VacationSessionEntry } from "../../api/types";

const { fetchCurrentVacationMock, fetchVacationSessionsMock, addVacationSessionMock } = vi.hoisted(() => ({
  fetchCurrentVacationMock: vi.fn(),
  fetchVacationSessionsMock: vi.fn(),
  addVacationSessionMock: vi.fn(),
}));

vi.mock("../../api/teacher", async () => {
  const actual = await vi.importActual<typeof import("../../api/teacher")>("../../api/teacher");
  return {
    ...actual,
    fetchCurrentVacation: fetchCurrentVacationMock,
    fetchVacationSessions: fetchVacationSessionsMock,
    addVacationSession: addVacationSessionMock,
  };
});

afterEach(() => {
  cleanup();
  addVacationSessionMock.mockReset();
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
    expect(await screen.findByText("Aucune séance ponctuelle ajoutée pour le moment.")).toBeInTheDocument();
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

  it("renders a clickable calendar day for each day in the vacation period", async () => {
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    fetchVacationSessionsMock.mockResolvedValue([]);
    renderWithClient(<VacationSessionsPanel classId="c1" />);
    const day = await screen.findByRole("button", { name: "10 septembre" });
    expect(day).toBeEnabled();
    const outOfRangeDay = screen.getByRole("button", { name: "21 septembre" });
    expect(outOfRangeDay).toBeDisabled();
  });

  it("selecting a day adds a draft row with default start/end times", async () => {
    const user = userEvent.setup();
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    fetchVacationSessionsMock.mockResolvedValue([]);
    renderWithClient(<VacationSessionsPanel classId="c1" />);
    const day = await screen.findByRole("button", { name: "10 septembre" });
    await user.click(day);

    expect(await screen.findByText("Ajouter les 1 séance")).toBeInTheDocument();
    const startInput = screen.getByDisplayValue("16:00");
    const endInput = screen.getByDisplayValue("17:00");
    expect(startInput).toBeInTheDocument();
    expect(endInput).toBeInTheDocument();
  });

  it("disables days that already have a booked session", async () => {
    const user = userEvent.setup();
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

    const bookedDay = await screen.findByRole("button", { name: "12 septembre (déjà programmée)" });
    expect(bookedDay).toBeDisabled();

    await user.click(bookedDay);
    expect(screen.queryByText(/Ajouter les \d+ séance/)).not.toBeInTheDocument();
  });

  it("submits all drafted sessions in one batch and clears the draft list on success", async () => {
    const user = userEvent.setup();
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    fetchVacationSessionsMock.mockResolvedValue([]);
    addVacationSessionMock.mockResolvedValue({});
    renderWithClient(<VacationSessionsPanel classId="c1" />);

    const firstDay = await screen.findByRole("button", { name: "10 septembre" });
    const secondDay = screen.getByRole("button", { name: "11 septembre" });
    await user.click(firstDay);
    await user.click(secondDay);

    const submitButton = await screen.findByText("Ajouter les 2 séances");
    await user.click(submitButton);

    await waitFor(() => expect(addVacationSessionMock).toHaveBeenCalledTimes(2));
    expect(addVacationSessionMock).toHaveBeenCalledWith("c1", { date: "2026-09-10", startTime: "16:00", endTime: "17:00" });
    expect(addVacationSessionMock).toHaveBeenCalledWith("c1", { date: "2026-09-11", startTime: "16:00", endTime: "17:00" });

    await waitFor(() => expect(screen.queryByText(/Ajouter les \d+ séance/)).not.toBeInTheDocument());
  });
});
