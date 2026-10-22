import { newId } from "../storage/ids";
import type { ListStorage } from "../storage/types";

// Adapted from angela-simon-wedding/lib/panel/trash.ts.
//
// Removing an item from a list with a trash does not delete it: it is kept
// here for `keepDays` days, so it can be looked at and restored. Older entries
// are dropped whenever the trash is read or added to.

export type TrashEntry = {
  id: string; // the entry's own id (not the removed item's)
  kind: string; // which list it came from, e.g. "task"
  title: string;
  removedBy: string;
  removedAt: string; // ISO timestamp
  data: string; // the removed item as JSON
};

export type Trash = ReturnType<typeof createTrash>;

export function createTrash(storage: ListStorage<TrashEntry>, options: { keepDays?: number } = {}) {
  const maxAgeMs = (options.keepDays ?? 7) * 24 * 60 * 60 * 1000;

  // Entries still within their time; older ones are dropped and the list saved.
  async function list(): Promise<TrashEntry[]> {
    const entries = await storage.loadAll();
    const fresh = entries.filter((entry) => Date.now() - new Date(entry.removedAt).getTime() < maxAgeMs);
    if (fresh.length !== entries.length) await storage.saveAll(fresh);
    return fresh;
  }

  async function put(kind: string, title: string, removedBy: string, item: unknown) {
    const entries = await list();
    entries.unshift({ id: newId(), kind, title, removedBy, removedAt: new Date().toISOString(), data: JSON.stringify(item) });
    await storage.saveAll(entries);
  }

  // Takes an entry out of the trash and returns the removed item, for the
  // caller to put back into its list. Null when there is no such entry.
  async function take(entryId: string): Promise<{ entry: TrashEntry; item: unknown } | null> {
    const entries = await list();
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (!entry) return null;
    await storage.saveAll(entries.filter((candidate) => candidate.id !== entryId));
    return { entry, item: JSON.parse(entry.data) as unknown };
  }

  // Puts a removed item back at the top of `target`, unless an item with the
  // same id is already there. False when there is no such entry. The entry
  // leaves the trash only AFTER the item is back in its list, so a failed
  // save can't lose it.
  async function restore<T extends { id: string }>(entryId: string, target: ListStorage<T>) {
    const entry = (await list()).find((candidate) => candidate.id === entryId);
    if (!entry) return false;
    const item = JSON.parse(entry.data) as T;
    const items = await target.loadAll();
    if (!items.some((existing) => existing.id === item.id)) await target.saveAll([item, ...items]);
    await take(entryId);
    return true;
  }

  return { list, put, take, restore };
}
