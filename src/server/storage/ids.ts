import { randomBytes } from "node:crypto";

// Adapted from angela-simon-wedding/lib/panel/tables.ts (newId).
// 8 hex characters: short enough to read in a spreadsheet cell, and with about
// 4 billion values, collisions within one list of a few hundred items are not
// a practical concern.
export function newId() {
  return randomBytes(4).toString("hex");
}

// Newest-first slice of one person's history events, shared by the backends
// that read the whole history and filter it in code.
export function newestForUser<E extends { username: string }>(events: E[], username: string, limit: number) {
  const mine = events.filter((event) => event.username === username);
  mine.reverse();
  return mine.slice(0, limit);
}
