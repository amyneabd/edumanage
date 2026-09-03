import { useQuery } from "@tanstack/react-query";
import { fetchChildLedger } from "../../api/parent";
import { Card } from "../../components/Card";
import { PaymentBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { formatPeriodLabel } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";

export function ParentLedgerPage() {
  const { pupilId, isLoading: childrenLoading } = useSelectedChild();
  const { data: ledger, isLoading } = useQuery({
    queryKey: ["parent", "ledger", pupilId],
    queryFn: () => fetchChildLedger(pupilId!),
    enabled: !!pupilId,
  });

  if (childrenLoading) return <Spinner />;

  const balance = ledger?.balance ?? 0;
  const sessionsInAdvance = ledger?.sessionsInAdvance ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Ledger</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started." />
        </Card>
      ) : isLoading || !ledger ? (
        <Spinner />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-500">Full attendance and payment history, period by period.</p>

          <div
            className={
              "mt-4 rounded-sm border px-4 py-3 text-sm font-medium " +
              (balance > 0
                ? "border-danger-200 bg-danger-50 text-danger-700"
                : balance < 0
                  ? "border-success-200 bg-success-50 text-success-700"
                  : "border-border-strong bg-canvas text-ink-700")
            }
          >
            {balance > 0
              ? `Owes ${formatCurrency(balance)} overall`
              : balance < 0
                ? `${formatCurrency(Math.abs(balance))} credit (paid in advance)` +
                  (sessionsInAdvance > 0
                    ? ` — about ${sessionsInAdvance} session${sessionsInAdvance === 1 ? "" : "s"} ahead`
                    : "")
                : "All settled"}
          </div>

          <Card className="mt-4 p-5">
            <h2 className="text-sm font-medium text-ink-700">History</h2>
            {ledger.rows.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No ledger records yet" description="The teacher hasn't recorded any attendance or payments yet." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th scope="col" className="pb-1.5 font-medium">Period</th>
                      <th scope="col" className="pb-1.5 font-medium">Present</th>
                      <th scope="col" className="pb-1.5 font-medium">Absent</th>
                      <th scope="col" className="pb-1.5 font-medium">Status</th>
                      <th scope="col" className="pb-1.5 font-medium">Paid / Due</th>
                      <th scope="col" className="pb-1.5 font-medium">Due date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledger.rows.map((row) => (
                      <tr key={row.period}>
                        <td className="py-2 font-medium text-ink-700">{formatPeriodLabel(row.period)}</td>
                        <td className="py-2 text-ink-500">{row.present}</td>
                        <td className="py-2 text-ink-500">{row.absent}</td>
                        <td className="py-2">
                          <PaymentBadge status={row.status} />
                        </td>
                        <td className="py-2 text-ink-700">
                          {formatCurrency(row.amountPaid)} / {formatCurrency(row.amountDue)}
                        </td>
                        <td className="py-2 text-ink-500">
                          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
