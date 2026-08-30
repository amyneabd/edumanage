import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Clock, GraduationCap, Users2, Wallet } from "lucide-react";
import { approveTeacher, fetchAllTeachers, rejectTeacher } from "../../api/admin";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/Badge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState, Spinner } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { formatCurrency } from "../../lib/currency";
import type { AdminTeacherSummary, UserStatus } from "../../api/types";

const PAGE_SIZE = 20;
type SortKey = "name" | "status" | "classCount" | "pupilCount" | "collected" | "createdAt";

const STATUS_FILTERS: (UserStatus | "ALL")[] = ["ALL", "PENDING", "ACTIVE", "REJECTED"];

function compareRows(a: AdminTeacherSummary, b: AdminTeacherSummary, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "status":
      return a.status.localeCompare(b.status);
    case "classCount":
      return a.classCount - b.classCount;
    case "pupilCount":
      return a.pupilCount - b.pupilCount;
    case "collected":
      return a.collected - b.collected;
    case "createdAt":
    default:
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }
}

function SortHeader({
  label,
  sortKeyValue,
  activeSortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortKeyValue: SortKey;
  activeSortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (key: SortKey) => void;
}) {
  const active = activeSortKey === sortKeyValue;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className="pb-2 pr-4 font-medium text-ink-400 hover:text-ink-700"
    >
      <button
        type="button"
        onClick={() => onToggle(sortKeyValue)}
        className="cursor-pointer select-none inline-flex items-center gap-0.5"
      >
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "teachers"], queryFn: fetchAllTeachers });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
  const approveMutation = useMutation({
    mutationFn: approveTeacher,
    onSuccess: () => {
      toast.success("Teacher approved.");
      invalidate();
    },
  });
  const rejectMutation = useMutation({
    mutationFn: rejectTeacher,
    onSuccess: () => {
      toast.success("Teacher application rejected.");
      invalidate();
      setRejectTarget(null);
    },
  });

  const [rejectTarget, setRejectTarget] = useState<AdminTeacherSummary | null>(null);

  const teachers = useMemo(() => data ?? [], [data]);

  const kpis = useMemo(() => {
    const active = teachers.filter((t) => t.status === "ACTIVE").length;
    const pending = teachers.filter((t) => t.status === "PENDING").length;
    const pupils = teachers.reduce((sum, t) => sum + t.pupilCount, 0);
    const collected = teachers.reduce((sum, t) => sum + t.collected, 0);
    const outstanding = teachers.reduce((sum, t) => sum + t.outstanding, 0);
    return { total: teachers.length, active, pending, pupils, collected, outstanding };
  }, [teachers]);

  const rows = useMemo(() => {
    let list = teachers;
    if (statusFilter !== "ALL") list = list.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => compareRows(a, b, sortKey) * dir);
  }, [teachers, statusFilter, search, sortKey, sortDir]);

  const { page, setPage, totalPages, pageRows } = usePagination(rows, PAGE_SIZE, `${statusFilter}|${search}|${sortKey}|${sortDir}`);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Admin</h1>
      <p className="mt-1 text-sm text-ink-500">Every teacher account on the platform, at a glance.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Teachers"
          value={kpis.total}
          hint={`${kpis.active} active`}
          icon={<Users2 className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
        <StatCard
          label="Pending approvals"
          value={kpis.pending}
          hint={kpis.pending > 0 ? "Waiting on you" : "All caught up"}
          icon={<Clock className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
        <StatCard
          label="Total pupils"
          value={kpis.pupils}
          icon={<GraduationCap className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
        <StatCard
          label="Collected this month"
          value={formatCurrency(kpis.collected)}
          hint={`${formatCurrency(kpis.outstanding)} outstanding`}
          icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-success-50 text-success-600"
        />
      </div>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink-700">Teacher directory</h2>
          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              aria-label="Search teachers"
              className="focus-ring w-56 rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | "ALL")}
              aria-label="Filter by status"
              className="focus-ring rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState title="No teachers match these filters" />
          ) : (
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <SortHeader label="Teacher" sortKeyValue="name" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Status" sortKeyValue="status" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Classes" sortKeyValue="classCount" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Pupils" sortKeyValue="pupilCount" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Collected / Expected" sortKeyValue="collected" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortHeader label="Joined" sortKeyValue="createdAt" activeSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <th scope="col" className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/admin/teachers/${t.id}`)}
                    className="cursor-pointer hover:bg-canvas"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-900">{t.name}</p>
                      <p className="text-xs text-ink-500">{t.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={t.status} />
                      {t.pendingPupilRequests > 0 && (
                        <p className="mt-1 text-[11px] font-medium text-accent-600">
                          {t.pendingPupilRequests} pupil request{t.pendingPupilRequests === 1 ? "" : "s"}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink-500">{t.classCount}</td>
                    <td className="py-3 pr-4 text-ink-500">{t.pupilCount}</td>
                    <td className="py-3 pr-4 text-ink-500">
                      {formatCurrency(t.collected)} / {formatCurrency(t.expected)}
                      {t.overdueCount > 0 && (
                        <p className="text-[11px] font-medium text-danger-600">{t.overdueCount} overdue</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ink-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {t.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setRejectTarget(t)}>
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => approveMutation.mutate(t.id)}>
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-accent-600">View →</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </Card>

      <ConfirmDialog
        open={!!rejectTarget}
        title="Reject this teacher?"
        description={
          rejectTarget
            ? `${rejectTarget.name} (${rejectTarget.email}) will be denied access to the platform.`
            : undefined
        }
        confirmLabel="Reject"
        isPending={rejectMutation.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && rejectMutation.mutate(rejectTarget.id)}
      />
    </div>
  );
}
