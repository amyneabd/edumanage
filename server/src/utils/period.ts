export function currentPeriod(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function previousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year!, month! - 2, 1);
  return currentPeriod(d);
}
