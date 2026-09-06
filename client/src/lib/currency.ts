const formatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${formatter.format(amount)} TND`;
}
