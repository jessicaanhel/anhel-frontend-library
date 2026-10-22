// Per-person access with an optional deadline, on top of the role model: a
// role says what a group of people may open, a grant gives one person one
// extra key (a course, a lesson, a page) until a date. Pure helpers, no React
// and no Node imports, so a page can also use them to show "3 days left".
//
// Dates are plain "YYYY-MM-DD" strings and `today` is passed in, so the
// result does not depend on the server's time zone: the app decides which
// day it is (see `today` in createGrantHandlers).

export type Grant = {
  id: string;
  username: string;
  // What the grant opens, e.g. a course or lesson id. Compared exactly.
  key: string;
  // The last day the grant is active (YYYY-MM-DD), or "" for no deadline.
  expiresAt: string;
  grantedBy: string;
  createdAt: string; // ISO timestamp
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

// True for a real calendar date written as YYYY-MM-DD ("2026-02-30" is not).
export function isGrantDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Usernames are compared without case, like the login does.
function sameUser(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Active on `today` (YYYY-MM-DD): no deadline, or the deadline is today or
// later. The deadline is inclusive: a grant until 2026-12-01 still opens on
// that day. A deadline that is not a valid date (typed by hand in a
// spreadsheet, say) counts as expired: a typo must never give access forever.
export function isGrantActive(grant: Grant, today: string) {
  if (grant.expiresAt === "") return true;
  // ISO dates compare correctly as text.
  return isGrantDate(grant.expiresAt) && today <= grant.expiresAt;
}

// The person's grants that are active on `today`.
export function activeGrantsFor(grants: Grant[], username: string, today: string) {
  return grants.filter((grant) => sameUser(grant.username, username) && isGrantActive(grant, today));
}

// Whether the person has an active grant for `key` on `today`.
export function hasGrant(grants: Grant[], username: string, key: string, today: string) {
  return activeGrantsFor(grants, username, today).some((grant) => grant.key === key);
}

// The days the grant still opens, today included: 1 on the last day, 0 once
// it has expired, null when it has no deadline.
export function daysLeft(grant: Grant, today: string): number | null {
  if (grant.expiresAt === "") return null;
  if (!isGrantDate(grant.expiresAt) || !isGrantDate(today)) return 0;
  // Both dates at midnight UTC, so a daylight saving change can't make a day 23 hours long.
  const days = (Date.parse(`${grant.expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS;
  return Math.max(0, days + 1);
}
