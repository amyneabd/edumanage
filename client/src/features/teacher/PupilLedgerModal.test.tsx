import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { PupilLedgerModal } from "./PupilLedgerModal";
import type { PupilLedger } from "../../api/types";

const { fetchPupilLedgerMock, updatePaymentStatusMock } = vi.hoisted(() => ({
  fetchPupilLedgerMock: vi.fn(),
  updatePaymentStatusMock: vi.fn(),
}));

vi.mock("../../api/teacher", async () => {
  const actual = await vi.importActual<typeof import("../../api/teacher")>("../../api/teacher");
  return {
    ...actual,
    fetchPupilLedger: fetchPupilLedgerMock,
    updatePaymentStatus: updatePaymentStatusMock,
  };
});

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const ledger: PupilLedger = {
  balance: 50,
  sessionsInAdvance: 0,
  rows: [
    { period: "2026-09", status: "UNPAID", amountDue: 100, amountPaid: 0, dueDate: null, present: 3, absent: 1 },
    { period: "2026-08", status: "PAID", amountDue: 100, amountPaid: 150, dueDate: "2026-08-05T00:00:00.000Z", present: 4, absent: 0 },
  ],
};

afterEach(() => cleanup());

describe("PupilLedgerModal", () => {
  it("renders nothing when no pupil is selected", () => {
    const { container } = renderWithClient(<PupilLedgerModal pupilId={null} pupilName={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a row per period with attendance counts and an all-time balance owed", async () => {
    fetchPupilLedgerMock.mockResolvedValue(ledger);
    renderWithClient(<PupilLedgerModal pupilId="p1" pupilName="Ada" onClose={() => {}} />);

    expect(await screen.findByText(/owes \$50 overall/i)).toBeInTheDocument();

    const septRow = screen.getByText("September 2026").closest("tr")!;
    expect(within(septRow).getByText("3")).toBeInTheDocument();
    expect(within(septRow).getByText("1")).toBeInTheDocument();

    const augRow = screen.getByText("August 2026").closest("tr")!;
    expect(within(augRow).getByText("4")).toBeInTheDocument();
  });

  it("shows a credit message when the pupil has paid in advance", async () => {
    fetchPupilLedgerMock.mockResolvedValue({ ...ledger, balance: -25, sessionsInAdvance: 3 });
    renderWithClient(<PupilLedgerModal pupilId="p1" pupilName="Ada" onClose={() => {}} />);
    expect(await screen.findByText(/\$25 credit \(paid in advance\) — about 3 sessions ahead/i)).toBeInTheDocument();
  });

  it("commits an edited amount-paid value for the correct period on blur", async () => {
    fetchPupilLedgerMock.mockResolvedValue(ledger);
    updatePaymentStatusMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithClient(<PupilLedgerModal pupilId="p1" pupilName="Ada" onClose={() => {}} />);

    const input = await screen.findByLabelText("Amount paid for September 2026");
    await user.clear(input);
    await user.type(input, "80");
    await user.tab();

    await waitFor(() =>
      expect(updatePaymentStatusMock).toHaveBeenCalledWith("p1", { period: "2026-09", amountPaid: 80 })
    );
  });
});
