import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { VacationBanner } from "./ClassesPage";
import type { VacationPeriod } from "../../api/types";

const { fetchCurrentVacationMock } = vi.hoisted(() => ({
  fetchCurrentVacationMock: vi.fn(),
}));

vi.mock("../../api/teacher", async () => {
  const actual = await vi.importActual<typeof import("../../api/teacher")>("../../api/teacher");
  return { ...actual, fetchCurrentVacation: fetchCurrentVacationMock };
});

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("VacationBanner", () => {
  it("shows the start button when no vacation period is active", async () => {
    fetchCurrentVacationMock.mockResolvedValue(null);
    renderWithClient(<VacationBanner />);
    expect(await screen.findByText("Start vacation mode")).toBeInTheDocument();
  });

  it("opens the date-range form when Start vacation mode is clicked", async () => {
    fetchCurrentVacationMock.mockResolvedValue(null);
    renderWithClient(<VacationBanner />);
    fireEvent.click(await screen.findByText("Start vacation mode"));
    expect(await screen.findByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
  });

  it("shows the active range and an End button when a period is active", async () => {
    const period: VacationPeriod = {
      id: "vp1",
      teacherId: "t1",
      startDate: "2026-09-10",
      endDate: "2026-09-20",
      status: "ACTIVE",
      createdAt: "2026-09-01",
    };
    fetchCurrentVacationMock.mockResolvedValue(period);
    renderWithClient(<VacationBanner />);
    expect(await screen.findByText("Vacation mode is active")).toBeInTheDocument();
    expect(screen.getByText("End vacation mode")).toBeInTheDocument();
  });
});
