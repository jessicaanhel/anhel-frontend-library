// The storage contract behind the shared lists (the task list and any other
// list with ids). Every backend (memory, JSON file, Google Sheets, DynamoDB)
// implements the same small interface, so the route handlers and the UI never
// change when the backend does.
//
// Lists are loaded and saved WHOLE: the handlers read the list, change one
// item and save the list again. That keeps every backend simple and the order
// of the list (newest first) is part of what is saved.

export type WithId = { id: string };

export interface ListStorage<T extends WithId> {
  // Every item, in list order. An empty or missing list is [].
  loadAll(): Promise<T[]>;
  // Replaces the whole list with `items` (in this order).
  saveAll(items: T[]): Promise<void>;
}

// One line in the change history: who did what, when.
export type HistoryEvent = {
  at: string; // ISO timestamp
  username: string;
  text: string;
};

export interface HistoryStorage {
  append(event: HistoryEvent): Promise<void>;
  // This person's events, newest first, at most `limit`.
  readForUser(username: string, limit: number): Promise<HistoryEvent[]>;
}

// One storage backend: hands out named lists and a history. The same names
// work on every backend ("tasks", "trash", ...), which is what makes the
// backend swappable.
export interface StorageBackend {
  list<T extends WithId>(name: string): ListStorage<T>;
  history(name?: string): HistoryStorage;
}
