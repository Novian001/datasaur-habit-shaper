// Calendar DATE handling (D8): YYYY-MM-DD naive values end-to-end.
// No timezone profiles/libraries; no UTC instant conversion of habit dates.

// Strict calendar-date validator: rejects 2026-02-30, 2026-13-01, abcd-ef-gh.
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

// Current date in UTC (YYYY-MM-DD). The backend clock is authoritative for the
// "not in the future" rule (api-contract.md §3/§4); D8 keeps the backend
// stateless about the user's local calendar.
export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
