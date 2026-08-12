// Calendar DATE handling (D8): YYYY-MM-DD naive values end-to-end.
// No timezone profiles/libraries; no UTC instant conversion of habit dates.
// The backend never derives "today" from a server clock (D8; human-review
// correction 2026-08-12): the client supplies refDate for current-day checks.

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

// Shift a YYYY-MM-DD calendar date by whole days. Pure arithmetic on the
// naive DATE string — no Date object, no timezone, no DST.
export function shiftDate(date: string, days: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Monday of the week containing `date` (week = Monday..Sunday calendar
// dates, D3). Pure naive-DATE arithmetic on the UTC day number — the day
// number is only a calendar index, never a time instant (D8, no clock).
export function mondayOfWeek(date: string): string {
  const dayNum = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))).getUTCDay();
  // getUTCDay: 0=Sun..6=Sat → shift back to Monday (Mon=0..Sun=6).
  const daysSinceMonday = (dayNum + 6) % 7;
  return shiftDate(date, -daysSinceMonday);
}
