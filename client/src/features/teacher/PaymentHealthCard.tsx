import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import type { PaymentStatus } from "../../api/types";

const SEGMENT_COLORS: Record<PaymentStatus, string> = {
  PAID: "bg-success-600",
  INCOMPLETE: "bg-accent-600",
  UNPAID: "bg-danger-600",
};

const LABELS: Record<PaymentStatus, string> = {
  PAID: "Paid",
  INCOMPLETE: "Incomplete",
  UNPAID: "Unpaid",
};

export function PaymentHealthCard({ summary }: { summary: Record<PaymentStatus, number> }) {
  const total = summary.PAID + summary.UNPAID + summary.INCOMPLETE;
  const percentPaid = total === 0 ? 0 : Math.round((summary.PAID / total) * 100);
  const order: PaymentStatus[] = ["PAID", "INCOMPLETE", "UNPAID"];

  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink-700">Payment health this month</h2>
        <Link
          to="/teacher/ledger"
          className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700"
        >
          View ledger
        </Link>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-400">No active pupils to bill yet.</p>
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
            {percentPaid}%
            <span className="ml-2 text-sm font-normal text-ink-400">paid up</span>
          </p>

          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-border">
            {order.map((status) =>
              summary[status] > 0 ? (
                <div
                  key={status}
                  className={SEGMENT_COLORS[status]}
                  style={{ width: `${(summary[status] / total) * 100}%` }}
                  title={`${LABELS[status]}: ${summary[status]}`}
                />
              ) : null
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {order.map((status) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-ink-500">
                <span className={`h-2 w-2 rounded-full ${SEGMENT_COLORS[status]}`} />
                {LABELS[status]} · {summary[status]}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
