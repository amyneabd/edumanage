export function currentPeriod(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year!, month! - 1 + delta, 1);
  return currentPeriod(d);
}

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year!, month! - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("fr-FR", options);
}

export const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
