import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CheckCircle2, ChevronLeft, ChevronRight, Hourglass, AlertTriangle, Sigma } from "lucide-react";
import { fetchClasses, fetchLedger, fetchLedgerSummary, updatePaymentStatus } from "../../api/teacher";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { PaymentBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { StatCard } from "../../components/StatCard";
import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { currentPeriod, formatPeriodLabel, shiftPeriod } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import type { LedgerRow, PaymentStatus } from "../../api/types";

const PAGE_SIZE = 20;
const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "INCOMPLETE"];
// Display-only labels for chart legend/tooltip text — presentation string, not a status-logic change.
const STATUS_LABELS: Record<PaymentStatus, string> = { PAID: "Paid", UNPAID: "Unpaid", INCOMPLETE: "Incomplete" };
// success-600 / danger-600 / warning-700 — exact hex match to Badge.tsx's paymentColors
// (warning uses the -700 text tier there, not -600, for contrast against bg-warning-100).
const STATUS_COLORS: Record<PaymentStatus, string> = { PAID: "#20B26B", UNPAID: "#DC2626", INCOMPLETE: "#B45309" };

// Shared chart chrome — token hex values only (recharts props can't take Tailwind classes).
const CHART_GRID_STROKE = "#E5EAF0"; // border
const CHART_TICK_STYLE = { fontSize: 12, fill: "#98A2B3" }; // ink-400 / text muted
const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF", // surface
  border: "1px solid #CBD5E1", // border-strong
  borderRadius: 12, // radius-sm
  fontSize: 12,
  color: "#172033", // text primary
};
const CHART_LEGEND_STYLE = { fontSize: 12, color: "#667085" }; // text secondary
const CHART_CURSOR_FILL = { fill: "rgba(23, 32, 51, 0.04)" }; // text primary @ 4%

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86_400_000));
}

function sortRows(rows: LedgerRow[]): LedgerRow[] {
  return [...rows].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.status === "PAID" && b.status !== "PAID") return 1;
    if (b.status === "PAID" && a.status !== "PAID") return -1;
    return a.name.localeCompare(b.name);
  });
}

function exportCsv(rows: LedgerRow[], period: string) {
  const header = ["Name", "Email", "Class", "Status", "Amount due", "Amount paid", "Due date", "Overdue"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.className ?? "",
      r.status,
      r.amountDue ?? "",
      r.amountPaid,
      r.dueDate ? toDateInputValue(r.dueDate) : "",
      r.isOverdue ? "Yes" : "No",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LedgerPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [classId, setClassId] = useState("");

  const isCurrentPeriod = period === currentPeriod();

  const classesQuery = useQuery({ queryKey: ["teacher", "classes"], queryFn: fetchClasses });
  const ledgerQuery = useQuery({
    queryKey: ["teacher", "ledger", { period, search, status, classId }],
    queryFn: () =>
      fetchLedger({ period, search: search || undefined, status: status || undefined, classId: classId || undefined }),
  });
  const summaryQuery = useQuery({
    queryKey: ["teacher", "ledger-summary", period],
    queryFn: () => fetchLedgerSummary(period),
  });

  const paymentMutation = useMutation({
    mutationFn: (input: { pupilId: string; status?: PaymentStatus; amountDue?: number | null; amountPaid?: number; dueDate?: string | null }) =>
      updatePaymentStatus(input.pupilId, { ...input, period }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "ledger"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "ledger-summary"] });
    },
  });

  const rows = useMemo(() => sortRows(ledgerQuery.data ?? []), [ledgerQuery.data]);
  const summary = summaryQuery.data;

  // Charts/summary below are computed from the full filtered `rows` set;
  // only the table itself is paginated.
  const { page, setPage, totalPages, pageRows } = usePagination(rows, PAGE_SIZE, `${period}|${search}|${status}|${classId}`);

  const statusBreakdown = useMemo(() => {
    const counts: Record<PaymentStatus, number> = { PAID: 0, UNPAID: 0, INCOMPLETE: 0 };
    for (const r of rows) counts[r.status] += 1;
    return PAYMENT_STATUSES.map((s) => ({ status: s, name: STATUS_LABELS[s], value: counts[s] }));
  }, [rows]);

  const byClass = useMemo(() => {
    const map = new Map<string, { name: string; PAID: number; UNPAID: number; INCOMPLETE: number }>();
    for (const r of rows) {
      const key = r.className ?? "Unassigned";
      if (!map.has(key)) map.set(key, { name: key, PAID: 0, UNPAID: 0, INCOMPLETE: 0 });
      map.get(key)![r.status] += 1;
    }
    return Array.from(map.values());
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Ledger</h1>
          <p className="mt-1 text-sm text-ink-500">Every pupil, their class, and payment status by month.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPeriod(shiftPeriod(period, -1))}
            aria-label="Previous month"
            title="Previous month"
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-ink-500 hover:bg-canvas"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <span className="w-32 text-center text-sm font-medium text-ink-700">
            {formatPeriodLabel(period)}
            {isCurrentPeriod && <span className="ml-1.5 text-xs font-normal text-accent-600">(current)</span>}
          </span>
          <button
            type="button"
            onClick={() => setPeriod(shiftPeriod(period, 1))}
            aria-label="Next month"
            title="Next month"
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-ink-500 hover:bg-canvas"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={() => setPeriod(currentPeriod())}
              className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={formatCurrency(summary?.collected ?? 0)}
          hint={`${summary?.counts.PAID ?? 0} paid this month`}
          icon={<CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary?.outstanding ?? 0)}
          hint={`${(summary?.counts.UNPAID ?? 0) + (summary?.counts.INCOMPLETE ?? 0)} not yet paid`}
          icon={<Hourglass className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(summary?.overdueAmount ?? 0)}
          hint={`${summary?.overdueCount ?? 0} pupil${(summary?.overdueCount ?? 0) === 1 ? "" : "s"} past due date`}
          icon={<AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        />
        <StatCard
          label="Expected this month"
          value={formatCurrency(summary?.expected ?? 0)}
          hint={`${summary?.pupilCount ?? 0} pupils billed`}
          icon={<Sigma className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">Payment status breakdown</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {statusBreakdown.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">By class</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
                <XAxis dataKey="name" tick={CHART_TICK_STYLE} />
                <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR_FILL} />
                <Bar dataKey="PAID" stackId="a" fill={STATUS_COLORS.PAID} />
                <Bar dataKey="UNPAID" stackId="a" fill={STATUS_COLORS.UNPAID} />
                <Bar dataKey="INCOMPLETE" stackId="a" fill={STATUS_COLORS.INCOMPLETE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pupil name…"
            aria-label="Search pupil name"
            className="focus-ring w-56 rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}
            aria-label="Filter by payment status"
            className="focus-ring rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
          >
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            aria-label="Filter by class"
            className="focus-ring rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
          >
            <option value="">All classes</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => exportCsv(rows, period)} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>

      <Card className="mt-4 overflow-x-auto p-5">
        {ledgerQuery.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState title="No pupils match these filters" />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th scope="col" className="pb-2 font-medium">Pupil</th>
                <th scope="col" className="pb-2 font-medium">Class</th>
                <th scope="col" className="pb-2 font-medium">Status</th>
                <th scope="col" className="pb-2 font-medium">Amount due</th>
                <th scope="col" className="pb-2 font-medium">Amount paid</th>
                <th scope="col" className="pb-2 font-medium">Due date</th>
                <th scope="col" className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((r) => (
                <tr key={r.pupilId} className={r.isOverdue ? "bg-danger-50/60" : undefined}>
                  <td className="py-3 pl-3" style={r.isOverdue ? { boxShadow: "inset 3px 0 0 #DC2626" } : undefined}>
                    <p className="font-medium text-ink-900">{r.name}</p>
                    <p className="text-xs text-ink-500">{r.email}</p>
                  </td>
                  <td className="py-3 text-ink-500">{r.className ?? "—"}</td>
                  <td className="py-3">
                    <PaymentBadge status={r.status} />
                    {r.isOverdue && (
                      <p className="mt-1 text-[11px] font-medium text-danger-600">
                        {daysOverdue(r.dueDate)} day{daysOverdue(r.dueDate) === 1 ? "" : "s"} overdue
                      </p>
                    )}
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min={0}
                      key={`due-${r.pupilId}-${r.amountDue}`}
                      defaultValue={r.amountDue ?? ""}
                      placeholder="—"
                      onBlur={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        if (val !== r.amountDue) paymentMutation.mutate({ pupilId: r.pupilId, amountDue: val });
                      }}
                      className="focus-ring w-20 rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min={0}
                      key={`paid-${r.pupilId}-${r.amountPaid}`}
                      defaultValue={r.amountPaid}
                      onBlur={(e) => {
                        const val = Number(e.target.value || 0);
                        if (val !== r.amountPaid) paymentMutation.mutate({ pupilId: r.pupilId, amountPaid: val });
                      }}
                      className="focus-ring w-20 rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="date"
                      key={`dd-${r.pupilId}-${r.dueDate}`}
                      defaultValue={toDateInputValue(r.dueDate)}
                      onBlur={(e) => {
                        const val = e.target.value || null;
                        if (val !== toDateInputValue(r.dueDate)) paymentMutation.mutate({ pupilId: r.pupilId, dueDate: val });
                      }}
                      className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
                    />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status !== "PAID" && (
                        <button
                          onClick={() =>
                            paymentMutation.mutate({
                              pupilId: r.pupilId,
                              status: "PAID",
                              amountPaid: r.amountDue ?? r.amountPaid,
                            })
                          }
                          className="focus-ring rounded-sm text-xs font-medium text-success-600 hover:text-success-700"
                          title="Mark as paid in full"
                        >
                          Mark paid
                        </button>
                      )}
                      <select
                        value={r.status}
                        onChange={(e) => paymentMutation.mutate({ pupilId: r.pupilId, status: e.target.value as PaymentStatus })}
                        className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
                      >
                        {PAYMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>
    </div>
  );
}
