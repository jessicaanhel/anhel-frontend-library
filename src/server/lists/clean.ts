// Adapted from angela-simon-wedding/lib/panel/lists.ts (the helpers for the
// `clean` functions). Small, forgiving converters for what a browser sends.

// Trimmed text cut to `max` characters, or "" for anything that isn't text.
export function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// A date as YYYY-MM-DD, or "" when it isn't a usable date. Accepts what a date
// field sends and what people type into a spreadsheet ("2026-12-01", "1 Dec 2026").
export function isoDate(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

// A non-negative amount rounded to cents; 0 for anything else.
export function amount(value: unknown) {
  const number = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

// "title → New name, deadline → empty" from [label, before, after] triples.
// Unchanged values are left out; "" and false read as "empty", true as "yes".
export function listChanges(changes: [label: string, before: unknown, after: unknown][]) {
  const parts: string[] = [];
  for (const [label, before, after] of changes) {
    if (before === after) continue;
    let shown: unknown = after;
    if (after === "" || after === false) shown = "empty";
    else if (after === true) shown = "yes";
    parts.push(`${label} → ${shown}`);
  }
  return parts.join(", ");
}
