import { useQuery } from "@tanstack/react-query";
import { fetchChildLedger } from "../../api/parent";
import { Card } from "../../components/Card";
import { PaymentBadge } from "../../components/Badge";
import { EmptyState, Spinner } from "../../components/Feedback";
import { formatPeriodLabel, formatDate } from "../../lib/period";
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
      <h1 className="text-2xl font-semibold text-ink-900">Registre</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="Aucun enfant associé pour le moment" description="Ajoutez un enfant à l'aide de son code parent pour commencer." />
        </Card>
      ) : isLoading || !ledger ? (
        <Spinner />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-500">Historique complet des présences et paiements, période par période.</p>

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
              ? `Doit ${formatCurrency(balance)} au total`
              : balance < 0
                ? `${formatCurrency(Math.abs(balance))} de crédit (payé d'avance)` +
                  (sessionsInAdvance > 0
                    ? ` — environ ${sessionsInAdvance} séance${sessionsInAdvance === 1 ? "" : "s"} d'avance`
                    : "")
                : "Tout est réglé"}
          </div>

          <Card className="mt-4 p-5">
            <h2 className="text-sm font-medium text-ink-700">Historique</h2>
            {ledger.rows.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="Aucun enregistrement dans le registre pour le moment" description="L'enseignant n'a encore enregistré aucune présence ni aucun paiement." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th scope="col" className="pb-1.5 font-medium">Période</th>
                      <th scope="col" className="pb-1.5 font-medium">Présent</th>
                      <th scope="col" className="pb-1.5 font-medium">Absent</th>
                      <th scope="col" className="pb-1.5 font-medium">Statut</th>
                      <th scope="col" className="pb-1.5 font-medium">Payé / Dû</th>
                      <th scope="col" className="pb-1.5 font-medium">Date d'échéance</th>
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
                          {row.dueDate ? formatDate(row.dueDate) : "—"}
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
