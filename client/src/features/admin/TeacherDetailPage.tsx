import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, CalendarDays, GraduationCap, Wallet } from "lucide-react";
import { approveTeacher, fetchTeacherDetail, rejectTeacher } from "../../api/admin";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { StatCard } from "../../components/StatCard";
import { ClassTypeBadge, PaymentBadge, StatusBadge } from "../../components/Badge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState, ErrorState, Spinner } from "../../components/Feedback";
import { formatCurrency } from "../../lib/currency";
import { DAY_NAMES } from "../../lib/period";
import type { PostType } from "../../api/types";

const POST_TYPE_LABELS: Record<PostType, string> = { TEXT: "Note", FILE: "File", EXAM: "Exam" };

function formatSchedule(slots: { dayOfWeek: number; startTime: string; endTime: string }[]): string {
  if (slots.length === 0) return "No schedule set";
  return slots
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}–${s.endTime}`)
    .join(" · ");
}

export function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "teacher", id],
    queryFn: () => fetchTeacherDetail(id as string),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "teacher", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
  };
  const approveMutation = useMutation({
    mutationFn: () => approveTeacher(id as string),
    onSuccess: () => {
      toast.success("Teacher approved.");
      invalidate();
    },
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectTeacher(id as string),
    onSuccess: () => {
      toast.success("Teacher application rejected.");
      invalidate();
      navigate("/admin");
    },
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorState message="Couldn't load this teacher." />;

  return (
    <div>
      <Link
        to="/admin"
        className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        Back to directory
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink-900">{data.name}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">{data.email}</p>
          <p className="mt-1 text-xs text-ink-400">Joined {new Date(data.createdAt).toLocaleDateString()}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-sm bg-canvas px-3 py-1.5 font-mono text-sm tracking-widest text-ink-900">
              {data.teacherCode}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(data.teacherCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700"
            >
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
        </div>

        {data.status === "PENDING" && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
            <Button onClick={() => approveMutation.mutate()}>Approve</Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={rejectOpen}
        title="Reject this teacher?"
        description={`${data.name} (${data.email}) will be denied access to the platform.`}
        confirmLabel="Reject"
        isPending={rejectMutation.isPending}
        onClose={() => setRejectOpen(false)}
        onConfirm={() => rejectMutation.mutate()}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Classes"
          value={data.classes.length}
          icon={<BookOpen className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
        <StatCard
          label="Pupils"
          value={data.ledgerSummary.pupilCount}
          hint={
            data.pendingPupilRequests > 0
              ? `${data.pendingPupilRequests} pending request${data.pendingPupilRequests === 1 ? "" : "s"}`
              : undefined
          }
          icon={<GraduationCap className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
        <StatCard
          label="Collected this month"
          value={formatCurrency(data.ledgerSummary.collected)}
          hint={`${formatCurrency(data.ledgerSummary.outstanding)} outstanding`}
          icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-success-50 text-success-600"
        />
        <StatCard
          label="Attendance rate"
          value={data.attendance.rate !== null ? `${Math.round(data.attendance.rate)}%` : "—"}
          hint={`${data.attendance.present}/${data.attendance.total} this month`}
          icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-accent-50 text-accent-600"
        />
      </div>

      {data.pendingSwapRequests > 0 && (
        <p className="mt-3 text-xs font-medium text-accent-600">
          {data.pendingSwapRequests} pending swap request{data.pendingSwapRequests === 1 ? "" : "s"}
        </p>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-medium text-ink-700">Classes</h2>
        {data.classes.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No classes yet" />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.classes.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink-900">{c.name}</p>
                  <ClassTypeBadge type={c.type} />
                </div>
                <p className="mt-2 text-sm text-ink-500">{c._count?.pupils ?? c.pupils.length} pupils</p>
                <p className="mt-1 text-xs text-ink-400">{formatSchedule(c.scheduleSlots)}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {c.monthlyFee !== null ? `${formatCurrency(c.monthlyFee)}/month` : "No fee set"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-ink-700">Ledger — {data.ledgerSummary.period}</h2>
        <Card className="mt-3 overflow-x-auto p-5">
          {data.ledger.length === 0 ? (
            <EmptyState title="No pupils billed this period" />
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="pb-2 pr-4 font-medium">Pupil</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Class</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Due</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Paid</th>
                  <th scope="col" className="pb-2 font-medium">Due date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.ledger.map((r) => (
                  <tr key={r.pupilId} className={r.isOverdue ? "bg-danger-50/60" : undefined}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-900">{r.name}</p>
                      <p className="text-xs text-ink-500">{r.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-500">{r.className ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <PaymentBadge status={r.status} />
                    </td>
                    <td className="py-3 pr-4 text-ink-500">{formatCurrency(r.amountDue)}</td>
                    <td className="py-3 pr-4 text-ink-500">{formatCurrency(r.amountPaid)}</td>
                    <td className="py-3 text-ink-500">
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-ink-700">Recent feed activity</h2>
        {data.posts.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No posts yet" />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {data.posts.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                      {POST_TYPE_LABELS[p.type]}
                    </span>
                    {p.class && <span className="text-xs text-ink-400">{p.class.name}</span>}
                  </div>
                  <span className="text-xs text-ink-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                {p.content && <p className="mt-2 text-sm text-ink-900">{p.content}</p>}
                {p.type === "EXAM" && (
                  <p className="mt-2 text-xs text-ink-500">
                    {p.submissions?.length ?? 0} submission{(p.submissions?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                    {p.submissions?.filter((s) => s.grade !== null).length ?? 0} graded
                    {p.dueDate && ` · due ${new Date(p.dueDate).toLocaleDateString()}`}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
