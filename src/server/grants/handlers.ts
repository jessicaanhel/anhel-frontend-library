import { jsonResponse, readJson } from "../http";
import { text } from "../lists/clean";
import { newId } from "../storage/ids";
import type { HistoryStorage, ListStorage } from "../storage/types";
import { activeGrantsFor, isGrantDate, type Grant } from "./grants";

// The grants endpoint, on any ListStorage:
//   GET              -> { grants }  every grant for a manager; for anyone else
//                                   only their own grants that are active today
//   POST { username, key, expiresAt }
//                    -> { grant, grants }  managers only. expiresAt is
//                       YYYY-MM-DD or "" (no deadline). A person who already
//                       has a grant for the key gets that grant changed (new
//                       deadline, granted by and created), not a second one.
//   DELETE { id }    -> { ok, grants }     managers only
//
// The handlers only keep the list. Whether a page or a file opens is checked
// where it is served, with `hasGrant(await storage.loadAll(), ...)`.

export type GrantsSession = { username: string };

export type GrantsMessages = {
  notSignedIn: string;
  forbidden: string;
  invalidRequest: string;
  missingFields: string;
  invalidDate: string;
  notFound: string;
  loadFailed: string;
  saveFailed: string;
};

const DEFAULT_MESSAGES: GrantsMessages = {
  notSignedIn: "Not signed in.",
  forbidden: "Only a manager can do this.",
  invalidRequest: "Invalid request.",
  missingFields: "Enter a username and what the access is for.",
  invalidDate: "The deadline must be a date (YYYY-MM-DD), or empty for no deadline.",
  notFound: "Not found.",
  loadFailed: "Could not load the access list.",
  saveFailed: "Could not save the access list.",
};

export type GrantHandlerConfig<S extends GrantsSession = GrantsSession> = {
  storage: ListStorage<Grant>;
  // The signed-in person for this request, or null (-> 401).
  getSession: (request: Request) => Promise<S | null>;
  // Who may see every grant, give and take away access.
  canManage: (session: S) => boolean;
  // How grants are called in history lines and error logs ("Gave “vera”
  // access to “course-1”"). Default "access".
  listName?: string;
  // Giving and taking away access is written under the manager's name.
  // Leave out for no history.
  history?: HistoryStorage;
  // Today as YYYY-MM-DD, for "active". Default: the date in UTC. Pass the
  // date in the site's own time zone when the deadline should end at its
  // midnight instead.
  today?: () => string;
  messages?: Partial<GrantsMessages>;
  // Where unexpected failures are reported. Default: console.error.
  logError?: (message: string, error: unknown) => void;
};

export function createGrantHandlers<S extends GrantsSession = GrantsSession>(config: GrantHandlerConfig<S>) {
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const listName = config.listName ?? "access";
  const today = config.today ?? (() => new Date().toISOString().slice(0, 10));
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  async function signedIn(request: Request): Promise<S | Response> {
    const session = await config.getSession(request);
    return session ?? jsonResponse({ error: messages.notSignedIn }, 401);
  }

  async function asManager(request: Request): Promise<S | Response> {
    const session = await signedIn(request);
    if (session instanceof Response) return session;
    return config.canManage(session) ? session : jsonResponse({ error: messages.forbidden }, 403);
  }

  async function writeHistory(username: string, line: string) {
    if (!config.history) return;
    await config.history.append({ at: new Date().toISOString(), username, text: line });
  }

  async function GET(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;

    try {
      const grants = await config.storage.loadAll();
      if (config.canManage(session)) return jsonResponse({ grants });
      return jsonResponse({ grants: activeGrantsFor(grants, session.username, today()) });
    } catch (error) {
      logError(`Failed to load the ${listName} list`, error);
      return jsonResponse({ error: messages.loadFailed }, 502);
    }
  }

  async function POST(request: Request) {
    const session = await asManager(request);
    if (session instanceof Response) return session;

    const body = await readJson(request);
    if (!body) return jsonResponse({ error: messages.invalidRequest }, 400);
    const username = text(body.username, 100);
    const key = text(body.key, 200);
    const expiresAt = text(body.expiresAt, 10);
    if (!username || !key) return jsonResponse({ error: messages.missingFields }, 400);
    if (expiresAt !== "" && !isGrantDate(expiresAt)) return jsonResponse({ error: messages.invalidDate }, 400);

    try {
      const grants = await config.storage.loadAll();
      const lower = username.toLowerCase();
      const index = grants.findIndex((grant) => grant.username.toLowerCase() === lower && grant.key === key);
      const grant: Grant = {
        id: index === -1 ? newId() : grants[index].id,
        username,
        key,
        expiresAt,
        grantedBy: session.username,
        createdAt: new Date().toISOString(),
      };
      if (index === -1) grants.unshift(grant);
      else grants[index] = grant;

      await config.storage.saveAll(grants);
      const until = expiresAt ? ` until ${expiresAt}` : "";
      await writeHistory(session.username, `Gave “${username}” ${listName} to “${key}”${until}`);
      return jsonResponse({ grant, grants });
    } catch (error) {
      logError(`Failed to save the ${listName} list`, error);
      return jsonResponse({ error: messages.saveFailed }, 502);
    }
  }

  async function DELETE(request: Request) {
    const session = await asManager(request);
    if (session instanceof Response) return session;

    const body = await readJson(request);
    if (!body) return jsonResponse({ error: messages.invalidRequest }, 400);
    const id = String(body.id ?? "");

    try {
      const grants = await config.storage.loadAll();
      const removed = grants.find((grant) => grant.id === id);
      if (!removed) return jsonResponse({ error: messages.notFound }, 404);

      const rest = grants.filter((grant) => grant.id !== id);
      await config.storage.saveAll(rest);
      await writeHistory(session.username, `Took away ${listName} to “${removed.key}” from “${removed.username}”`);
      return jsonResponse({ ok: true, grants: rest });
    } catch (error) {
      logError(`Failed to save the ${listName} list`, error);
      return jsonResponse({ error: messages.saveFailed }, 502);
    }
  }

  return { GET, POST, DELETE };
}
