// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the shared plumbing
// behind the planning panel's list endpoints (tasks, guests, budget,
// inspiration boards and the private boards' to-do lists).
// ============================================================================

import { newId } from "../storage/ids";
import type { HistoryStorage, ListStorage, WithId } from "../storage/types";
import type { Trash } from "./trash";

// Adapted from angela-simon-wedding/lib/panel/lists.ts.
//
// One list endpoint = three route handlers that take a web Request and return
// a Response (Next.js route handlers, or any fetch-style server):
//   GET     -> { items }
//   PUT     { item }  creates (no id) or updates (id) one item -> { items }
//   DELETE  { id }    removes one item -> { items }
// Each endpoint says where its list is stored, who may use it, how to clean
// what the browser sent and how to describe a change for the history; this
// file does the rest.

// What the handlers need to know about the signed-in person.
export type ListSession = { username: string };

export type ListMessages = {
  notSignedIn: string;
  forbidden: string;
  invalidRequest: string;
  missingFields: string;
  cannotCreate: string;
  notAllowed: string;
  full: string;
  notFound: string;
  loadFailed: string;
  saveFailed: string;
  removeFailed: string;
};

const DEFAULT_MESSAGES: ListMessages = {
  notSignedIn: "Not signed in.",
  forbidden: "This list is not available to you.",
  invalidRequest: "Invalid request.",
  missingFields: "Please fill in the required fields.",
  cannotCreate: "You can't add items to this list.",
  notAllowed: "You may not do that.",
  full: "This list is full.",
  notFound: "Not found.",
  loadFailed: "Could not load the list.",
  saveFailed: "Could not save your change.",
  removeFailed: "Could not remove it.",
};

export type ListConfig<T extends WithId, S extends ListSession = ListSession> = {
  storage: ListStorage<T>;
  // The signed-in person for this request, or null (-> 401). With createAuth:
  // (request) => auth.getSession(request).
  getSession: (request: Request) => Promise<S | null>;
  // Returns the cleaned fields (without the id), or null when the input is unusable.
  clean: (input: unknown) => Omit<T, "id"> | null;
  maxItems: number;
  // Each change is written here under the person's name. Leave out for no history.
  history?: HistoryStorage;
  // History lines. A missing one (or null from describeUpdate) writes no line.
  describeCreate?: (item: T) => string;
  describeUpdate?: (before: T, after: T) => string | null;
  describeRemove?: (item: T) => string;
  // Applied to the list after a create/update, before it is saved and returned
  // (e.g. a field the server works out itself instead of trusting the browser).
  normalize?: (items: T[]) => Promise<T[]>;
  // Removed items go to this trash under `kind` and `title(item)`. Leave out
  // and removing deletes for good.
  trash?: { trash: Trash; kind: string; title: (item: T) => string };
  // A reason to refuse a NEW item (e.g. a duplicate), or null.
  beforeCreate?: (fields: Omit<T, "id">, items: T[]) => string | null;
  // Who may use this list at all (default: everyone signed in). Others get 403 on every call.
  authorize?: (session: S) => boolean;
  // Who may add a NEW item (default: everyone allowed in). Updating and removing stay open.
  canCreate?: (session: S) => boolean;
  // Who may see one item (default: everyone allowed in). An item a person may not see is left out of what
  // they read and answers "not found" when they try to change or remove it. They also cannot create such
  // an item, or change a visible one into it (403, `messages.notAllowed`). Use it when one list holds the
  // items of several groups and each group has its own permission.
  visible?: (item: T, session: S) => boolean;
  messages?: Partial<ListMessages>;
  // Where unexpected failures are reported. Default: console.error.
  logError?: (message: string, error: unknown) => void;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function createListHandlers<T extends WithId, S extends ListSession = ListSession>(config: ListConfig<T, S>) {
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  // The session when this person may use the list, otherwise the error Response.
  async function signedIn(request: Request): Promise<S | Response> {
    const session = await config.getSession(request);
    if (!session) return jsonResponse({ error: messages.notSignedIn }, 401);
    if (config.authorize && !config.authorize(session)) return jsonResponse({ error: messages.forbidden }, 403);
    return session;
  }

  // What this person may see of a list (all of it when the list has no visibility rule).
  function seenBy(session: S, items: T[]) {
    const isVisible = config.visible;
    return isVisible ? items.filter((item) => isVisible(item, session)) : items;
  }

  async function writeHistory(username: string, line: string | null | undefined) {
    if (!config.history || !line) return;
    await config.history.append({ at: new Date().toISOString(), username, text: line });
  }

  async function GET(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;
    try {
      return jsonResponse({ items: seenBy(session, await config.storage.loadAll()) });
    } catch (error) {
      logError("Failed to load list", error);
      return jsonResponse({ error: messages.loadFailed }, 502);
    }
  }

  async function PUT(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;

    let body: { item?: unknown };
    try {
      body = (await request.json()) as { item?: unknown };
    } catch {
      return jsonResponse({ error: messages.invalidRequest }, 400);
    }

    const fields = config.clean(body.item);
    if (!fields) return jsonResponse({ error: messages.missingFields }, 400);
    const sentId = (body.item as { id?: unknown } | null | undefined)?.id;
    const id = typeof sentId === "string" ? sentId : "";
    // Nobody can create an item, or change one into an item, that they could not see themselves.
    if (config.visible && !config.visible({ ...fields, id } as T, session)) {
      return jsonResponse({ error: messages.notAllowed }, 403);
    }

    try {
      const items = await config.storage.loadAll();
      const index = id ? items.findIndex((item) => item.id === id) : -1;
      // An existing item this person may not see does not exist for them.
      if (index !== -1 && config.visible && !config.visible(items[index], session)) {
        return jsonResponse({ error: messages.notFound }, 404);
      }
      let line: string | null | undefined;

      if (index === -1) {
        // No id, or an id that is no longer in the list (e.g. removed by
        // someone else meanwhile): it is saved as a new item.
        if (config.canCreate && !config.canCreate(session)) return jsonResponse({ error: messages.cannotCreate }, 403);
        const refusal = config.beforeCreate ? config.beforeCreate(fields, items) : null;
        if (refusal) return jsonResponse({ error: refusal }, 400);
        if (items.length >= config.maxItems) return jsonResponse({ error: messages.full }, 400);
        const created = { ...fields, id: newId() } as T;
        items.unshift(created); // newest first
        line = config.describeCreate?.(created);
      } else {
        const updated = { ...fields, id } as T;
        line = config.describeUpdate ? config.describeUpdate(items[index], updated) : null;
        items[index] = updated;
      }

      const finalItems = config.normalize ? await config.normalize(items) : items;
      await config.storage.saveAll(finalItems);
      await writeHistory(session.username, line);
      return jsonResponse({ items: seenBy(session, finalItems) });
    } catch (error) {
      logError("Failed to save list", error);
      return jsonResponse({ error: messages.saveFailed }, 502);
    }
  }

  async function DELETE(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;

    let id = "";
    try {
      const body = (await request.json()) as { id?: unknown };
      id = typeof body.id === "string" ? body.id : "";
    } catch {
      return jsonResponse({ error: messages.invalidRequest }, 400);
    }

    try {
      const items = await config.storage.loadAll();
      const removed = items.find((item) => item.id === id);
      if (!removed || (config.visible && !config.visible(removed, session))) {
        return jsonResponse({ error: messages.notFound }, 404);
      }

      const remaining = items.filter((item) => item.id !== id);
      await config.storage.saveAll(remaining);
      if (config.trash) {
        await config.trash.trash.put(config.trash.kind, config.trash.title(removed), session.username, removed);
      }
      await writeHistory(session.username, config.describeRemove?.(removed));
      return jsonResponse({ items: seenBy(session, remaining) });
    } catch (error) {
      logError("Failed to remove from list", error);
      return jsonResponse({ error: messages.removeFailed }, 502);
    }
  }

  return { GET, PUT, DELETE };
}
