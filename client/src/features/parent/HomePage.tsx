import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, CalendarDays, ClipboardList, Wallet } from "lucide-react";
import { fetchChildHome } from "../../api/parent";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { ClassTypeBadge, PaymentBadge } from "../../components/Badge";
import { Spinner, EmptyState } from "../../components/Feedback";
import { DAY_NAMES, formatDate } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import { PAYMENT_STATUS_LABELS } from "../../lib/labels";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";

const TYPE_LABELS: Record<string, string> = { TEXT: "Publication", FILE: "Fichier", EXAM: "Examen" };

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
      <h1 className="text-2xl font-semibold text-ink-900">Vos enfants</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="Aucun enfant associé pour le moment" description="Ajoutez un enfant à l'aide de son code parent pour commencer." />
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
                  {selectedChild?.name} · {data.className} avec {data.teacherName}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Taux de présence"
                  value={attendance.rate !== null ? `${attendance.rate}%` : "—"}
                  hint={`${attendance.present} présent · ${attendance.absent} absent ce mois-ci`}
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
                  label="Prochaine séance"
                  value={nextSession ? DAY_NAMES[nextSession.dayOfWeek]! : "—"}
                  hint={
                    nextSession
                      ? `${
                          nextSession.daysUntil === 0
                            ? "Aujourd'hui"
                            : nextSession.daysUntil === 1
                              ? "Demain"
                              : `Dans ${nextSession.daysUntil} jours`
                        } · ${nextSession.startTime}–${nextSession.endTime}`
                      : "Aucun horaire défini pour le moment"
                  }
                  icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                />
                <StatCard
                  label="Examens en attente"
                  value={upcomingExams.length}
                  hint={overdueCount > 0 ? `${overdueCount} en retard` : upcomingExams.length > 0 ? "À rendre bientôt" : "Tout est à jour"}
                  icon={<ClipboardList className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                  accent={overdueCount > 0 ? "bg-danger-50 text-danger-600" : "bg-accent-50 text-accent-600"}
                />
                <StatCard
                  label="Statut de paiement"
                  value={PAYMENT_STATUS_LABELS[payment.status]}
                  hint={
                    payment.status === "PAID"
                      ? `${formatCurrency(payment.amountPaid)} réglé`
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
                    <h2 className="text-sm font-medium text-ink-700">Action requise</h2>
                    <Link to="/parent/feed" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                      Aller aux publications →
                    </Link>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {upcomingExams.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 rounded-sm bg-canvas px-3 py-2"
                      >
                        <span className="truncate text-sm text-ink-700">{e.content || "Soumission d'examen"}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.isOverdue ? "bg-danger-50 text-danger-600" : "bg-accent-100 text-accent-600"
                          }`}
                        >
                          {e.dueDate ? (e.isOverdue ? "En retard" : `Échéance ${formatDate(e.dueDate)}`) : "Aucune date d'échéance"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-ink-700">Paiement ({payment.period})</h2>
                    <Link to="/parent/payments" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                      Voir l'historique →
                    </Link>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <PaymentBadge status={payment.status} />
                    {payment.dueDate && (
                      <span className="text-xs text-ink-500">Échéance {formatDate(payment.dueDate)}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink-700">
                    {formatCurrency(payment.amountPaid)} payé sur {formatCurrency(payment.amountDue)}
                  </p>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-ink-700">Présences</h2>
                    <Link to="/parent/attendance" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                      Voir le calendrier →
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-ink-700">
                    {attendance.present} présent, {attendance.absent} absent, {attendance.unmarked} non marqué ce mois-ci.
                  </p>
                </Card>
              </div>

              <Card className="mt-4 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-ink-700">Dernières publications de la classe</h2>
                  <Link to="/parent/feed" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                    Voir tout →
                  </Link>
                </div>
                {data.recentPosts.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState title="Aucune publication pour le moment" />
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    {data.recentPosts.map((p) => (
                      <div key={p.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            {TYPE_LABELS[p.type] ?? p.type}
                          </p>
                          <span className="text-xs text-ink-400">{formatDate(p.createdAt)}</span>
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
