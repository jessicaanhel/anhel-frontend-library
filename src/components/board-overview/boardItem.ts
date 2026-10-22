// The items of a board overview (links, tickets, pictures, files) and the
// pure helpers its component uses. No React and no Node imports, so the
// server can share the type.
// Adapted from angela-simon-wedding/lib/panel/types.ts (BoardItem) and
// components/panel/BoardOverview.tsx.

export type BoardItem = {
  id: string; // "" for an item that has not been saved yet
  // One of the overview's item types (default: link, ticket, picture, file).
  type: string;
  title: string;
  link: string; // a web address, or ""
  category: string; // the group it is shown in, or ""
  date: string; // YYYY-MM-DD, mostly for tickets, or ""
  note: string;
  // A small picture as a data URL (see shrinkPicture), or "".
  image: string;
};

export const DEFAULT_ITEM_TYPES = ["link", "ticket", "picture", "file"];

// A new item with every field filled in.
export function emptyBoardItem(fields: Partial<BoardItem> = {}): BoardItem {
  return { id: "", type: "link", title: "", link: "", category: "", date: "", note: "", image: "", ...fields };
}

// A short name for where a link goes, so a card says "Open Google Sheet"
// instead of showing the whole address: well-known Google and Figma links by
// their product, anything else by its host name. "" for something that is not a link.
export function linkSource(link: string) {
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "docs.google.com") {
      if (url.pathname.startsWith("/spreadsheets")) return "Google Sheet";
      if (url.pathname.startsWith("/presentation")) return "Google Slides";
      if (url.pathname.startsWith("/forms")) return "Google Form";
      return "Google Doc";
    }
    if (host === "drive.google.com") return "Google Drive";
    if (host.endsWith("figma.com")) return "Figma";
    return host;
  } catch {
    return "";
  }
}

// "Sat, 11 Jun 2027" from "2027-06-11"; "" for anything else. Noon is used so
// the day can't shift with the time zone.
export function formatItemDate(iso: string, locale = "en-GB") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export type ItemGroup = { name: string; items: BoardItem[] };

// The items grouped by category. Within a group, dated items come first
// (soonest first), then the rest by title. Groups are sorted by name, with the
// items that have no category last under `unsortedName`.
export function groupItemsByCategory(items: BoardItem[], unsortedName: string): ItemGroup[] {
  const byCategory = new Map<string, BoardItem[]>();
  for (const item of items) {
    const name = item.category || unsortedName;
    byCategory.set(name, [...(byCategory.get(name) ?? []), item]);
  }

  const order = (a: BoardItem, b: BoardItem) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  };

  return [...byCategory.entries()]
    .map(([name, groupItems]) => ({ name, items: [...groupItems].sort(order) }))
    .sort((a, b) => {
      if (a.name === unsortedName) return 1;
      if (b.name === unsortedName) return -1;
      return a.name.localeCompare(b.name);
    });
}

// The distinct categories in use, sorted (for the category suggestions).
export function categoriesOf(items: BoardItem[]) {
  return [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
