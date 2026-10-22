import type { StorageBackend } from "./types";

// Picks one storage backend by name, usually from a setting:
//
//   const storage = selectStorage(process.env.MY_APP_STORAGE, {
//     memory: () => createMemoryStorage(),
//     file: () => createJsonFileStorage({ filePath: ".data/store.json" }),
//   }, "memory");
//
// Only the chosen factory is called, so the other backends are never set up
// (and need no settings). An unknown name is an error rather than a silent
// fallback, so a typo can't send data to the wrong place.
// (The names are taken from `factories`, so `fallback` must be one of them.)
export function selectStorage<Factories extends Record<string, () => StorageBackend>>(
  source: string | undefined,
  factories: Factories,
  fallback: keyof Factories & string
): StorageBackend {
  const name = source && source.trim() ? source.trim() : fallback;
  if (!Object.prototype.hasOwnProperty.call(factories, name)) {
    const known = Object.keys(factories).join(", ");
    throw new Error(`Unknown storage "${name}". Use one of: ${known}.`);
  }
  return factories[name]();
}
