import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPupilLedger, updatePaymentStatus } from "../../api/teacher";
import { Modal } from "../../components/Modal";
import { PaymentBadge } from "../../components/Badge";
import { Spinner } from "../../components/Feedback";
import { formatPeriodLabel } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import { PAYMENT_STATUS_LABELS } from "../../lib/labels";
import type { PaymentStatus, PupilLedgerRow } from "../../api/types";

const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "INCOMPLETE"];

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

interface RowEdit {
  status?: PaymentStatus;
  amountDue?: number | null;
  amountPaid?: number;
  dueDate?: string | null;
}

export function PupilLedgerModal({
  pupilId,
  pupilName,
  onClose,
}: {
  pupilId: string | null;
  pupilName: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const ledgerQuery = useQuery({
    queryKey: ["teacher", "pupil-ledger", pupilId],
    queryFn: () => fetchPupilLedger(pupilId!),
    enabled: !!pupilId,
  });

  const paymentMutation = useMutation({
    mutationFn: (input: RowEdit & { period: string }) => updatePaymentStatus(pupilId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "pupil-ledger", pupilId] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "pupil-payments", pupilId] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "ledger"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "ledger-summary"] });
    },
  });

  const ledger = ledgerQuery.data;
  const balance = ledger?.balance ?? 0;
  const sessionsInAdvance = ledger?.sessionsInAdvance ?? 0;

  return (
    <Modal
      open={!!pupilId}
      onClose={onClose}
      title={pupilName ? `${pupilName} — Registre complet` : "Registre complet"}
      maxWidthClassName="max-w-2xl"
    >
      {ledgerQuery.isLoading || !ledger ? (
        <Spinner />
      ) : (
        <div>
          <div
            className={
              "rounded-sm border px-4 py-3 text-sm font-medium " +
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
                ? `${formatCurrency(Math.abs(balance))} de crédit (payé en avance)` +
                  (sessionsInAdvance > 0
                    ? ` — soit environ ${sessionsInAdvance} séance${sessionsInAdvance === 1 ? "" : "s"} d'avance`
                    : "")
                : "Tout est réglé"}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="pb-2 font-medium">Période</th>
                  <th scope="col" className="pb-2 font-medium">Présent</th>
                  <th scope="col" className="pb-2 font-medium">Absent</th>
                  <th scope="col" className="pb-2 font-medium">Statut</th>
                  <th scope="col" className="pb-2 font-medium">Montant dû</th>
                  <th scope="col" className="pb-2 font-medium">Montant payé</th>
                  <th scope="col" className="pb-2 font-medium">Date d'échéance</th>
                  <th scope="col" className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.rows.map((row) => (
                  <LedgerRowView
                    key={row.period}
                    row={row}
                    onChange={(edit) => paymentMutation.mutate({ period: row.period, ...edit })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function LedgerRowView({ row, onChange }: { row: PupilLedgerRow; onChange: (edit: RowEdit) => void }) {
  const periodLabel = formatPeriodLabel(row.period);
  return (
    <tr>
      <td className="py-3 font-medium text-ink-700">{periodLabel}</td>
      <td className="py-3 text-ink-500">{row.present}</td>
      <td className="py-3 text-ink-500">{row.absent}</td>
      <td className="py-3">
        <PaymentBadge status={row.status} />
      </td>
      <td className="py-3">
        <input
          type="number"
          min={0}
          key={`due-${row.period}-${row.amountDue}`}
          defaultValue={row.amountDue ?? ""}
          placeholder="—"
          aria-label={`Montant dû pour ${periodLabel}`}
          onBlur={(e) => {
            const val = e.target.value === "" ? null : Number(e.target.value);
            if (val !== row.amountDue) onChange({ amountDue: val });
          }}
          className="focus-ring w-20 rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
        />
      </td>
      <td className="py-3">
        <input
          type="number"
          min={0}
          key={`paid-${row.period}-${row.amountPaid}`}
          defaultValue={row.amountPaid}
          aria-label={`Montant payé pour ${periodLabel}`}
          onBlur={(e) => {
            const val = Number(e.target.value || 0);
            if (val !== row.amountPaid) onChange({ amountPaid: val });
          }}
          className="focus-ring w-20 rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
        />
      </td>
      <td className="py-3">
        <input
          type="date"
          key={`dd-${row.period}-${row.dueDate}`}
          defaultValue={toDateInputValue(row.dueDate)}
          aria-label={`Date d'échéance pour ${periodLabel}`}
          onBlur={(e) => {
            const val = e.target.value || null;
            if (val !== toDateInputValue(row.dueDate)) onChange({ dueDate: val });
          }}
          className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
        />
      </td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {row.status !== "PAID" && (
            <button
              type="button"
              onClick={() => onChange({ status: "PAID", amountPaid: row.amountDue ?? row.amountPaid })}
              className="focus-ring rounded-sm text-xs font-medium text-success-600 hover:text-success-700"
              title="Marquer comme payé intégralement"
            >
              Marquer payé
            </button>
          )}
          <select
            value={row.status}
            aria-label={`Statut pour ${periodLabel}`}
            onChange={(e) => onChange({ status: e.target.value as PaymentStatus })}
            className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-900"
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </td>
    </tr>
  );
}
