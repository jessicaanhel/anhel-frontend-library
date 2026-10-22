// Pure helpers for saved Pinterest boards: checking and cleaning a link, the
// tags, and which links Pinterest's board embed can show. No React and no
// Node imports, so both the browser and the server (the list endpoint's
// `clean`) can use them.
// Adapted from angela-simon-wedding/lib/panel/pinterest.ts,
// lib/panel/inspirationTags.ts and components/panel/PinterestBoard.tsx.

// A saved board: a link to a public Pinterest board, with a title and tags.
export type PinterestBoardItem = {
  id: string;
  title: string;
  link: string;
  tags: string[];
};

const PINTEREST_HOST = /(^|\.)pinterest\.[a-z.]+$/;

// The link as a normalised https URL when it points at Pinterest (any
// country domain, or the short pin.it links), otherwise null.
export function pinterestLink(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isPinterest = PINTEREST_HOST.test(host) || host === "pin.it";
    return url.protocol === "https:" && isPinterest ? url.toString() : null;
  } catch {
    return null;
  }
}

// Only a full board link (pinterest.<tld>/<user>/<board>/) can be embedded.
// Short pin.it links, single pins and profiles are shown as a plain link.
export function isEmbeddableBoard(link: string) {
  try {
    const url = new URL(link);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return PINTEREST_HOST.test(url.hostname.toLowerCase()) && pathParts.length === 2;
  } catch {
    return false;
  }
}

export type CleanTagsOptions = { maxTags?: number; maxLength?: number };

// "Flowers, Decor" or ["Flowers", "Decor"] -> ["Flowers", "Decor"]: trimmed,
// no repeats (ignoring case), at most `maxTags` (8) tags of `maxLength` (30) characters.
export function cleanTags(value: unknown, options: CleanTagsOptions = {}): string[] {
  const maxTags = options.maxTags ?? 8;
  const maxLength = options.maxLength ?? 30;
  let list: unknown[] = [];
  if (Array.isArray(value)) list = value;
  else if (typeof value === "string") list = value.split(/[,;]+/);

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of list) {
    const tag = typeof entry === "string" ? entry.trim().slice(0, maxLength) : "";
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  return tags.slice(0, maxTags);
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type CleanBoardOptions = {
  // The title when none is given and none can be read from the link.
  fallbackTitle?: string;
};

// The board fields from what the browser sent, or null when the link is not a
// Pinterest link. Without a title, the board's name is taken from the link
// (…/user/board-name/ -> "board name").
export function cleanBoard(input: unknown, options: CleanBoardOptions = {}): Omit<PinterestBoardItem, "id"> | null {
  const raw = (input ?? {}) as { title?: unknown; link?: unknown; tags?: unknown };
  const link = pinterestLink(text(raw.link, 300));
  if (!link) return null;

  let fromLink = "";
  const boardSlug = new URL(link).pathname.split("/").filter(Boolean)[1];
  if (boardSlug) {
    try {
      fromLink = decodeURIComponent(boardSlug).replace(/-/g, " ");
    } catch {
      fromLink = boardSlug.replace(/-/g, " "); // a broken %-escape: keep it as typed
    }
  }

  const title = text(raw.title, 80) || fromLink || (options.fallbackTitle ?? "Pinterest board");
  return { title, link, tags: cleanTags(raw.tags) };
}

// Every distinct tag used on the boards, with how many boards have it, most
// used first (then alphabetical). Tags differing only in case count as one;
// the first spelling seen is kept.
export function tagCounts(boards: { tags?: string[] }[]) {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const board of boards) {
    for (const tag of board.tags ?? []) {
      const key = tag.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

// The boards that carry `tag` (ignoring case); all boards for "".
export function boardsWithTag<T extends { tags?: string[] }>(boards: T[], tag: string) {
  if (!tag) return boards;
  const wanted = tag.toLowerCase();
  return boards.filter((board) => (board.tags ?? []).some((candidate) => candidate.toLowerCase() === wanted));
}
