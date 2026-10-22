import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { newestForUser } from "./ids";
import type { HistoryEvent, HistoryStorage, ListStorage, StorageBackend, WithId } from "./types";

// Adapted from angela-simon-wedding/lib/panel/fileStore.ts.
//
// Local development backend: every list in one JSON file
// ({ "tasks": [...], "history": [...] }). Keep the file out of git (e.g. in a
// .data/ folder listed in .gitignore). Fine for one server process; not for
// several servers sharing data.

export type JsonFileStorageOptions = {
  // Absolute path, or relative to the current working directory.
  filePath: string;
};

type FileShape = Record<string, unknown[]>;

export function createJsonFileStorage(options: JsonFileStorageOptions): StorageBackend {
  const filePath = path.resolve(options.filePath);

  async function read(): Promise<FileShape> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch {
      return {}; // no file yet: every list is empty
    }
    const parsed = JSON.parse(raw) as unknown;
    // Anything that isn't an object of arrays is treated as empty, list by list.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as FileShape;
  }

  // Writes are chained one after the other: two quick saves in the same
  // process would otherwise both read the old file and the second would
  // overwrite the first one's change.
  let queue: Promise<unknown> = Promise.resolve();

  function update(change: (data: FileShape) => void): Promise<void> {
    const run = queue.then(async () => {
      const data = await read();
      change(data);
      await mkdir(path.dirname(filePath), { recursive: true });
      // Written to a temporary file first and then renamed, so an interrupted
      // write can't leave half a JSON file behind.
      const temporary = `${filePath}.tmp`;
      await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
      await rename(temporary, filePath);
    });
    // The queue carries on after a failed write; the caller still sees the error.
    queue = run.catch(() => undefined);
    return run;
  }

  function list<T extends WithId>(name: string): ListStorage<T> {
    return {
      async loadAll() {
        const items = (await read())[name];
        return Array.isArray(items) ? (items as T[]) : [];
      },
      saveAll(items) {
        return update((data) => {
          data[name] = items;
        });
      },
    };
  }

  function history(name = "history"): HistoryStorage {
    return {
      append(event) {
        return update((data) => {
          const events = Array.isArray(data[name]) ? data[name] : [];
          events.push(event);
          data[name] = events;
        });
      },
      async readForUser(username, limit) {
        const events = (await read())[name];
        return newestForUser(Array.isArray(events) ? (events as HistoryEvent[]) : [], username, limit);
      },
    };
  }

  return { list, history };
}
