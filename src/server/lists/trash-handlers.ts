// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Trash page's
// endpoint of the planning panel (what was removed in the last days, restore
// it or delete it for good).
// ============================================================================

import { jsonResponse, readJson } from "../http";
import type { ListStorage } from "../storage/types";
import type { Trash } from "./trash";

// Adapted from angela-simon-wedding/app/api/panel/trash/route.ts and
// lib/panel/trash.ts (restoreFromTrash, deleteForever), on top of createTrash.
//
//   GET     -> { entries }
//   POST    -> restore one ({ id }): the item goes back to the top of its own list -> { entries }
//   DELETE  -> delete one for good ({ id }) -> { entries }

export type TrashSession = { username: string };

export type TrashMessages = {
  notSignedIn: string;
  forbidden: string;
  invalidRequest: string;
  notFound: string;
  failed: string;
};

const DEFAULT_MESSAGES: TrashMessages = {
  notSignedIn: "Not signed in.",
  forbidden: "You do not have access to the trash.",
  invalidRequest: "Invalid request.",
  notFound: "Not found.",
  failed: "Something went wrong.",
};

export type TrashHandlerConfig<S extends TrashSession = TrashSession> = {
  trash: Trash;
  // Where each kind of removed item goes back to: the same names that were
  // given to `trash.put(kind, ...)` / createListHandlers' `trash.kind`.
  // An entry of a kind that is not listed here can only be deleted for good.
  targets: Record<string, ListStorage<any>>;
  getSession: (request: Request) => Promise<S | null>;
  // Who may use the trash (default: everyone signed in), e.g. admins only.
  authorize?: (session: S) => boolean;
  messages?: Partial<TrashMessages>;
  logError?: (message: string, error: unknown) => void;
};

export function createTrashHandlers<S extends TrashSession = TrashSession>(config: TrashHandlerConfig<S>) {
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  // The session when this person may use the trash, otherwise the error Response.
  async function allowed(request: Request): Promise<S | Response> {
    const session = await config.getSession(request);
    if (!session) return jsonResponse({ error: messages.notSignedIn }, 401);
    if (config.authorize && !config.authorize(session)) return jsonResponse({ error: messages.forbidden }, 403);
    return session;
  }

  async function GET(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    try {
      return jsonResponse({ entries: await config.trash.list() });
    } catch (error) {
      logError("Failed to read the trash", error);
      return jsonResponse({ error: messages.failed }, 502);
    }
  }

  // The id in the request body, or null when the body is missing or has no id.
  async function readId(request: Request) {
    const body = await readJson(request);
    return body && typeof body.id === "string" ? body.id : null;
  }

  async function POST(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    const id = await readId(request);
    if (id === null) return jsonResponse({ error: messages.invalidRequest }, 400);

    try {
      const entry = (await config.trash.list()).find((candidate) => candidate.id === id);
      const target = entry ? config.targets[entry.kind] : undefined;
      if (!entry || !target) return jsonResponse({ error: messages.notFound }, 404);
      await config.trash.restore(entry.id, target);
      return jsonResponse({ entries: await config.trash.list() });
    } catch (error) {
      logError("Failed to restore from the trash", error);
      return jsonResponse({ error: messages.failed }, 502);
    }
  }

  async function DELETE(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    const id = await readId(request);
    if (id === null) return jsonResponse({ error: messages.invalidRequest }, 400);

    try {
      const taken = await config.trash.take(id);
      if (!taken) return jsonResponse({ error: messages.notFound }, 404);
      return jsonResponse({ entries: await config.trash.list() });
    } catch (error) {
      logError("Failed to delete from the trash", error);
      return jsonResponse({ error: messages.failed }, 502);
    }
  }

  return { GET, POST, DELETE };
}
