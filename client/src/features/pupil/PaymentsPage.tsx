import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, AlertTriangle } from "lucide-react";
import { fetchPupilPayments } from "../../api/pupil";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { PaymentBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { currentPeriod, formatPeriodLabel, formatDate } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";

export function PupilPaymentsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pupil", "payments"], queryFn: fetchPupilPayments });

  const stats = useMemo(() => {
    const records = data ?? [];
    const current = records.find((r) => r.period === currentPeriod()) ?? null;
    const totalPaid = records.reduce((sum, r) => sum + r.amountPaid, 0);
    const overdueCount = records.filter((r) => r.isOverdue).length;
    return { current, totalPaid, overdueCount };
  }, [data]);

  if (isLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Paiements</h1>
      <p className="mt-1 text-sm text-ink-500">Le statut et l'historique de vos paiements de scolarité.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Ce mois-ci</p>
          {stats.current ? (
            <div className="mt-2">
              <PaymentBadge status={stats.current.status} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-700">Aucun enregistrement pour le moment</p>
          )}
        </Card>
        <StatCard
          label="Total payé"
          value={formatCurrency(stats.totalPaid)}
          icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-success-50 text-success-600"
        />
        <StatCard
          label="Périodes en retard"
          value={stats.overdueCount}
          icon={<AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent={stats.overdueCount > 0 ? "bg-danger-50 text-danger-600" : "bg-accent-50 text-accent-600"}
        />
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-medium text-ink-700">Historique</h2>
        {!data || data.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Aucun paiement enregistré" description="Votre enseignant n'a encore enregistré aucun paiement." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="pb-1.5 font-medium">Période</th>
                  <th scope="col" className="pb-1.5 font-medium">Statut</th>
                  <th scope="col" className="pb-1.5 font-medium">Payé / Dû</th>
                  <th scope="col" className="pb-1.5 font-medium">Date d'échéance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((entry) => (
                  <tr key={entry.period}>
                    <td className="py-2 font-medium text-ink-700">{formatPeriodLabel(entry.period)}</td>
                    <td className="py-2">
                      <PaymentBadge status={entry.status} />
                      {entry.isOverdue && <span className="ml-1.5 text-[11px] font-medium text-danger-600">en retard</span>}
                    </td>
                    <td className="py-2 text-ink-700">
                      {formatCurrency(entry.amountPaid)} / {formatCurrency(entry.amountDue)}
                    </td>
                    <td className="py-2 text-ink-500">{entry.dueDate ? formatDate(entry.dueDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
