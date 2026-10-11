/** Balance to one decimal, rounded down so it never shows more than you can spend. */
export function formatBalance(value: number): string {
  return (Math.floor(value * 10 + 1e-9) / 10).toFixed(1);
}

/** Costs are exact (0.125 stays 0.125). */
export function formatCost(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
