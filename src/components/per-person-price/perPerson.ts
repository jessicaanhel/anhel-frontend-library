// Pure helpers for items priced per person: the item's total is its price
// times the number of guests. No React and no Node imports.
// Adapted from angela-simon-wedding/lib/panel/budgetGuests.ts and
// EstimateCell in components/panel/BudgetPanel.tsx.

// Money rounded to cents (avoids 0.1 + 0.2 = 0.30000000000000004 on screen).
export const round2 = (value: number) => Math.round(value * 100) / 100;

// The total of an item priced per person.
export const perPersonTotal = (perPerson: number, guests: number) => round2(perPerson * guests);

// The number of guests the per-person prices are multiplied by. A saved
// number above 0 is used as it is (`auto: false`). Until someone sets one
// (0, or nothing saved) it follows `followCount` (e.g. the guests who have not
// declined), and never goes below 1, so a total can't drop to zero by accident.
export function effectiveGuestCount(saved: number, followCount: number): { count: number; auto: boolean } {
  if (saved > 0) return { count: saved, auto: false };
  return { count: Math.max(1, followCount), auto: true };
}

// The items with their totals brought up to date: an item with a per-person
// price (above 0) gets that price times `guests` in `totalKey`; the others are
// left as they are. Returns the same array when no item is priced per person.
export function withPerPersonTotals<T extends { perPerson?: number }>(items: T[], guests: number, totalKey: keyof T & string): T[] {
  if (!items.some((item) => (item.perPerson ?? 0) > 0)) return items;
  return items.map((item) => ((item.perPerson ?? 0) > 0 ? { ...item, [totalKey]: perPersonTotal(item.perPerson ?? 0, guests) } : item));
}
