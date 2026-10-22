// Pure helper for the trash list. No React and no Node imports.
// Adapted from daysLeft in angela-simon-wedding/components/panel/TrashPanel.tsx.

// Whole days a removed item stays in the trash, counting up: the day it is
// removed it has `keepDays`, and it never shows less than 0.
export function trashDaysLeft(removedAt: string, keepDays: number, now = Date.now()) {
  const ageMs = now - new Date(removedAt).getTime();
  return Math.max(0, Math.ceil(keepDays - ageMs / 86_400_000));
}
