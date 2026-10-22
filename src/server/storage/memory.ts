import { newestForUser } from "./ids";
import type { HistoryEvent, HistoryStorage, ListStorage, StorageBackend, WithId } from "./types";

// In-memory backend: for tests, demos and local development without any
// setup. Everything is lost when the server restarts, and every server
// instance has its own copy.
//
// Items are copied on the way in and out, so a caller that changes a loaded
// array (the list handlers do) can't change the stored list without saving it.

export type MemoryStorageOptions = {
  // Starting content per list name, e.g. { tasks: [...] }.
  initial?: Record<string, WithId[]>;
  initialHistory?: HistoryEvent[];
};

export function createMemoryStorage(options: MemoryStorageOptions = {}): StorageBackend {
  const lists = new Map<string, WithId[]>();
  for (const [name, items] of Object.entries(options.initial ?? {})) {
    lists.set(name, structuredClone(items));
  }
  const histories = new Map<string, HistoryEvent[]>();
  histories.set("history", structuredClone(options.initialHistory ?? []));

  function list<T extends WithId>(name: string): ListStorage<T> {
    return {
      async loadAll() {
        return structuredClone((lists.get(name) ?? []) as T[]);
      },
      async saveAll(items) {
        lists.set(name, structuredClone(items));
      },
    };
  }

  function history(name = "history"): HistoryStorage {
    return {
      async append(event) {
        const events = histories.get(name) ?? [];
        events.push({ ...event });
        histories.set(name, events);
      },
      async readForUser(username, limit) {
        return structuredClone(newestForUser(histories.get(name) ?? [], username, limit));
      },
    };
  }

  return { list, history };
}
