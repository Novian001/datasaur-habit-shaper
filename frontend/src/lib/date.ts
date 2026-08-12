// Local calendar date helper (D8, architecture.md §4b). The browser's LOCAL
// calendar date is the single source of the client-supplied date for habit
// business rules — never new Date().toISOString().slice(0,10) (UTC-shifted).
export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
