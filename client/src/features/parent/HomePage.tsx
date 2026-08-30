import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, CalendarDays, ClipboardList, Wallet } from "lucide-react";
import { fetchChildHome } from "../../api/parent";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { ClassTypeBadge, PaymentBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Feedback";
import { DAY_NAMES } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";

const TYPE_LABELS: Record<string, string> = { TEXT: "Post", FILE: "File", EXAM: "Exam" };

export function ParentHomePage() {
  const { pupilId, selectedChild, isLoading: childrenLoading } = useSelectedChild();
  const homeQuery = useQuery({
    queryKey: ["parent", "home", pupilId],
    queryFn: () => fetchChildHome(pupilId!),
    enabled: !!pupilId,
  });

  if (childrenLoading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Your children</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started." />
        </Card>
      ) : homeQuery.isLoading || !homeQuery.data ? (
        <Spinner />
      ) : (
        (() => {
          const data = homeQuery.data;
          const { nextSession, attendance, payment, upcomingExams } = data;
          const overdueCount = upcomingExams.filter((e) => e.isOverdue).length;

          return (
            <div className="mt-6">
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <ClassTypeBadge type={data.classType} />
                <span>
                  {selectedChild?.name} · {data.className} with {data.teacherName}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Attendance rate"
                  value={attendance.rate !== null ? `${attendance.rate}%` : "—"}
                  hint={`${attendance.present} present · ${attendance.absent} absent this month`}
                  icon={<ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                  accent={
                    attendance.rate === null
                      ? "bg-canvas text-ink-500"
                      : attendance.rate >= 90
                        ? "bg-success-50 text-success-600"
                        : attendance.rate >= 75
                          ? "bg-accent-50 text-accent-600"
                          : "bg-danger-50 text-danger-600"
                  }
                />
                <StatCard
                  label="Next session"
                  value={nextSession ? DAY_NAMES[nextSession.dayOfWeek]! : "—"}
                  hint={
                    nextSession
                      ? `${
                          nextSession.daysUntil === 0
                            ? "Today"
                            : nextSession.daysUntil === 1
                              ? "Tomorrow"
                              : `In ${nextSession.daysUntil} days`
                        } · ${nextSession.startTime}–${nextSession.endTime}`
                      : "No schedule set yet"
                  }
                  icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                />
                <StatCard
                  label="Pending exams"
                  value={upcomingExams.length}
                  hint={overdueCount > 0 ? `${overdueCount} overdue` : upcomingExams.length > 0 ? "Due soon" : "All caught up"}
                  icon={<ClipboardList className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                  accent={overdueCount > 0 ? "bg-danger-50 text-danger-600" : "bg-accent-50 text-accent-600"}
                />
                <StatCard
                  label="Payment status"
                  value={payment.status === "PAID" ? "Paid" : payment.status === "INCOMPLETE" ? "Partial" : "Unpaid"}
                  hint={
                    payment.status === "PAID"
                      ? `${formatCurrency(payment.amountPaid)} settled`
                      : `${formatCurrency(payment.amountPaid)} / ${formatCurrency(payment.amountDue)}`
                  }
                  icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                  accent={
                    payment.status === "PAID"
                      ? "bg-success-50 text-success-600"
                      : payment.status === "INCOMPLETE"
                        ? "bg-accent-50 text-accent-600"
                        : "bg-danger-50 text-danger-600"
                  }
                />
              </div>

              {upcomingExams.length > 0 && (
                <Card className="mt-4 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-ink-700">Action needed</h2>
                    <Link to="/parent/feed" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                      Go to feed →
                    </Link>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {upcomingExams.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 rounded-sm bg-canvas px-3 py-2"
                      >
                        <span className="truncate text-sm text-ink-700">{e.content || "Exam submission"}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.isOverdue ? "bg-danger-50 text-danger-600" : "bg-accent-100 text-accent-600"
                          }`}
                        >
                          {e.dueDate ? (e.isOverdue ? "Overdue" : `Due ${new Date(e.dueDate).toLocaleDateString()}`) : "No due date"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-ink-700">Payment ({payment.period})</h2>
                    <Link to="/parent/payments" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                      View history →
                    </Link>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <PaymentBadge status={payment.status} />
                    {payment.dueDate && (
                      <span className="text-xs text-ink-500">Due {new Date(payment.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink-700">
                    {formatCurrency(payment.amountPaid)} paid of {formatCurrency(payment.amountDue)}
                  </p>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-ink-700">Attendance</h2>
                    <Link to="/parent/attendance" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                      View calendar →
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-ink-700">
                    {attendance.present} present, {attendance.absent} absent, {attendance.unmarked} not yet marked this month.
                  </p>
                </Card>
              </div>

              <Card className="mt-4 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-ink-700">Latest from the class</h2>
                  <Link to="/parent/feed" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                    View all →
                  </Link>
                </div>
                {data.recentPosts.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState title="No posts yet" />
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    {data.recentPosts.map((p) => (
                      <div key={p.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            {TYPE_LABELS[p.type] ?? p.type}
                          </p>
                          <span className="text-xs text-ink-400">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        {p.content && <p className="mt-1 line-clamp-2 text-sm text-ink-900">{p.content}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          );
        })()
      )}
    </div>
  );
}
