/** Balance to one decimal, rounded down so it never shows more than you can spend. */
export function formatBalance(value: number): string {
  const floored = Math.floor(value * 10 + 1e-9) / 10;
  return floored.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Costs are exact (0.125 stays 0.125). */
export function formatCost(value: number): string {
  return (Math.round(value * 1000) / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "October 10, 2026 at 10:22 PM" */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

/** Seconds as m:ss. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
