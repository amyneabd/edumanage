import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PupilSchedulePage } from "./SchedulePage.js";

const { fetchOtherClasses, fetchOwnSwapRequests, createSwapRequest, cancelSwapRequest, fetchPupilSchedule } = vi.hoisted(() => ({
  fetchOtherClasses: vi.fn(),
  fetchOwnSwapRequests: vi.fn(),
  createSwapRequest: vi.fn(),
  cancelSwapRequest: vi.fn(),
  fetchPupilSchedule: vi.fn(),
}));

vi.mock("../../api/pupil.js", async (importActual) => ({
  ...(await importActual<typeof import("../../api/pupil.js")>()),
  fetchOtherClasses,
  fetchOwnSwapRequests,
  createSwapRequest,
  cancelSwapRequest,
  fetchPupilSchedule,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PupilSchedulePage", () => {
  it("submits a swap request with origin date, target class, and target date", async () => {
    fetchPupilSchedule.mockResolvedValue({ className: "My Class", mode: "weekly", slots: [] });
    fetchOtherClasses.mockResolvedValue([{ id: "class-2", name: "Other Class", type: "MATH", scheduleSlots: [] }]);
    fetchOwnSwapRequests.mockResolvedValue([]);
    createSwapRequest.mockResolvedValue({
      id: "req-1",
      originClassId: "class-1",
      originClassName: "My Class",
      originDate: "2026-09-07",
      targetClassId: "class-2",
      targetClassName: "Other Class",
      targetDate: "2026-09-09",
      reason: null,
      status: "PENDING",
      createdAt: "2026-09-04T00:00:00.000Z",
    });

    const user = userEvent.setup();
    renderWithClient(<PupilSchedulePage />);

    await waitFor(() => expect(screen.getByText(/Other Class/)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/session you'll miss/i), "2026-09-07");
    await user.selectOptions(screen.getByLabelText(/class to join/i), "class-2");
    await user.type(screen.getByLabelText(/date to attend/i), "2026-09-09");
    await user.click(screen.getByRole("button", { name: /request swap/i }));

    await waitFor(() =>
      expect(createSwapRequest).toHaveBeenCalledWith({
        originDate: "2026-09-07",
        targetClassId: "class-2",
        targetDate: "2026-09-09",
        reason: undefined,
      })
    );
  });

  it("lists the pupil's own swap requests with their status", async () => {
    fetchPupilSchedule.mockResolvedValue({ className: "My Class", mode: "weekly", slots: [] });
    fetchOtherClasses.mockResolvedValue([]);
    fetchOwnSwapRequests.mockResolvedValue([
      {
        id: "req-1",
        originClassId: "class-1",
        originClassName: "My Class",
        originDate: "2026-09-07",
        targetClassId: "class-2",
        targetClassName: "Other Class",
        targetDate: "2026-09-09",
        reason: null,
        status: "PENDING",
        createdAt: "2026-09-04T00:00:00.000Z",
      },
    ]);

    renderWithClient(<PupilSchedulePage />);

    await waitFor(() => expect(screen.getByText("Other Class")).toBeInTheDocument());
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
