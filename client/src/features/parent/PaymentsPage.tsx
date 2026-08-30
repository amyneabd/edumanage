import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, AlertTriangle } from "lucide-react";
import { fetchChildPayments } from "../../api/parent";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { PaymentBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { currentPeriod, formatPeriodLabel } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";

export function ParentPaymentsPage() {
  const { pupilId, isLoading: childrenLoading } = useSelectedChild();
  const { data, isLoading } = useQuery({
    queryKey: ["parent", "payments", pupilId],
    queryFn: () => fetchChildPayments(pupilId!),
    enabled: !!pupilId,
  });

  const stats = useMemo(() => {
    const records = data ?? [];
    const current = records.find((r) => r.period === currentPeriod()) ?? null;
    const totalPaid = records.reduce((sum, r) => sum + r.amountPaid, 0);
    const overdueCount = records.filter((r) => r.isOverdue).length;
    return { current, totalPaid, overdueCount };
  }, [data]);

  if (childrenLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Payments</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started." />
        </Card>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-500">Tuition payment status and history.</p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-500">This month</p>
              {stats.current ? (
                <div className="mt-2">
                  <PaymentBadge status={stats.current.status} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-700">No record yet</p>
              )}
            </Card>
            <StatCard
              label="Total paid"
              value={formatCurrency(stats.totalPaid)}
              icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.8} />}
              accent="bg-success-50 text-success-600"
            />
            <StatCard
              label="Overdue periods"
              value={stats.overdueCount}
              icon={<AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.8} />}
              accent={stats.overdueCount > 0 ? "bg-danger-50 text-danger-600" : "bg-accent-50 text-accent-600"}
            />
          </div>

          <Card className="mt-4 p-5">
            <h2 className="text-sm font-medium text-ink-700">History</h2>
            {!data || data.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No payment records yet" description="The teacher hasn't recorded any payments yet." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th scope="col" className="pb-1.5 font-medium">Period</th>
                      <th scope="col" className="pb-1.5 font-medium">Status</th>
                      <th scope="col" className="pb-1.5 font-medium">Paid / Due</th>
                      <th scope="col" className="pb-1.5 font-medium">Due date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.map((entry) => (
                      <tr key={entry.period}>
                        <td className="py-2 font-medium text-ink-700">{formatPeriodLabel(entry.period)}</td>
                        <td className="py-2">
                          <PaymentBadge status={entry.status} />
                          {entry.isOverdue && <span className="ml-1.5 text-[11px] font-medium text-danger-600">overdue</span>}
                        </td>
                        <td className="py-2 text-ink-700">
                          {formatCurrency(entry.amountPaid)} / {formatCurrency(entry.amountDue)}
                        </td>
                        <td className="py-2 text-ink-500">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "—"}</td>
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
