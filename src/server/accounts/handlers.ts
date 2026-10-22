// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Accounts page's
// endpoint of the planning panel (create a login, give roles, new password,
// remove) with the rules of who may give which role.
// ============================================================================

import type { PermissionModel } from "../../permissions";
import type { StoredAccount } from "../auth";
import { generatePassword, hashPassword } from "../auth";
import { jsonResponse, readJson } from "../http";
import { newId } from "../storage/ids";
import type { ListStorage } from "../storage/types";

// Adapted from angela-simon-wedding/app/api/panel/accounts/route.ts.
//
//   GET     -> the accounts this person may manage, and the roles they may give ({ grantable })
//   POST    -> create an account ({ username?, roles? }); the username and password are
//              generated when not given. The password is returned ONCE: only its hash is kept.
//   PUT     -> set an account's roles ({ username, roles })
//   PATCH   -> new password for an account ({ username }); returned once
//   DELETE  -> remove an account ({ username })
//
// Who may give which role comes from the permission model (`grantableRoles`):
// by default the admin role gives every other role and nobody else gives any.
// A person who may give only some roles sees and manages only the accounts
// whose roles are all among them, and an account they create always gets at
// least one role (otherwise they could not see it again). Nobody can give the
// admin role: it comes from the server settings.

// An account as stored: what createAuth's `listAccounts` needs, plus an id
// (every stored list item has one) and the creation time.
export type AccountRecord<Role extends string = string> = StoredAccount<Role> & { id: string; createdAt: string };

// What is sent to the browser: never the hash.
export type PublicAccount<Role extends string = string> = { username: string; createdAt: string; roles: Role[] };

export type AccountsSession<Role extends string = string> = { username: string; roles: Role[] };

export type AccountsMessages = {
  forbidden: string;
  cannotCreate: string;
  full: (max: number) => string;
  usernameInvalid: string;
  usernameTaken: string;
  notFound: string;
  failed: string;
};

const DEFAULT_MESSAGES: AccountsMessages = {
  forbidden: "You do not have access to the accounts.",
  cannotCreate: "You cannot create accounts.",
  full: (max) => `There can be up to ${max} accounts.`,
  usernameInvalid: "Use 3-24 letters, numbers, dots, dashes or underscores.",
  usernameTaken: "That username is already taken.",
  notFound: "No such account.",
  failed: "Something went wrong.",
};

export type AccountsHandlerConfig<Role extends string, S extends AccountsSession<Role> = AccountsSession<Role>> = {
  model: PermissionModel<Role>;
  storage: ListStorage<AccountRecord<Role>>;
  // The signed-in person for this request, or null (-> 403). With createAuth:
  // (request) => auth.getSession(request).
  getSession: (request: Request) => Promise<S | null>;
  // Who may open the accounts page at all, e.g. (session) => auth.can(session, "tab:accounts").
  authorize: (session: S) => boolean;
  // The most accounts there can be (counted over all of them, also the ones
  // this person does not see).
  maxAccounts: number;
  // Names that are not free: the accounts from the server settings.
  isReservedName?: (username: string) => boolean;
  // Default: 3-24 letters, numbers, dots, dashes and underscores.
  usernamePattern?: RegExp;
  // A username for a new account when none was typed. Default: "user" and three digits.
  generateUsername?: () => string;
  messages?: Partial<AccountsMessages>;
  // Where unexpected failures are reported. Default: console.error.
  logError?: (message: string, error: unknown) => void;
};

export function createAccountHandlers<Role extends string, S extends AccountsSession<Role> = AccountsSession<Role>>(
  config: AccountsHandlerConfig<Role, S>
) {
  const { model, storage } = config;
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const usernamePattern = config.usernamePattern ?? /^[a-z0-9._-]{3,24}$/i;
  const generateUsername = config.generateUsername ?? (() => `user${Math.floor(100 + Math.random() * 900)}`);
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  const isAdmin = (session: S) => session.roles.includes(model.adminRole);
  const grantableFor = (session: S) => model.grantableRoles(session.roles);

  // The roles from the browser that this person may give.
  function cleanRoles(value: unknown, session: S): Role[] {
    const list = Array.isArray(value) ? value : [];
    const grantable = grantableFor(session);
    const assignable = model.assignableRoles.map((role) => role.key);
    const allowed = list.filter(
      (item): item is Role => typeof item === "string" && model.isRoleKey(item) && assignable.includes(item) && grantable.includes(item)
    );
    return [...new Set(allowed)];
  }

  // The admin role manages everyone; others only accounts whose every role
  // they could have given (and at least one role).
  function manageable(account: AccountRecord<Role>, session: S) {
    if (isAdmin(session)) return true;
    const grantable = grantableFor(session);
    return account.roles.length > 0 && account.roles.every((role) => grantable.includes(role));
  }

  function answer(accounts: AccountRecord<Role>[], session: S) {
    const users: PublicAccount<Role>[] = accounts
      .filter((account) => manageable(account, session))
      .map(({ username, createdAt, roles }) => ({ username, createdAt, roles }));
    return {
      users,
      count: accounts.length, // every account: the limit is for all of them
      max: config.maxAccounts,
      grantable: grantableFor(session),
    };
  }

  // Roles for a create or change: the admin role may leave them empty,
  // everyone else always ends up with at least one.
  function rolesFor(value: unknown, session: S): Role[] {
    const roles = cleanRoles(value, session);
    if (roles.length === 0 && !isAdmin(session)) return grantableFor(session).slice(0, 1);
    return roles;
  }

  // The session when this person may use the page, otherwise the error Response.
  async function allowed(request: Request): Promise<S | Response> {
    const session = await config.getSession(request);
    if (!session || !config.authorize(session)) return jsonResponse({ error: messages.forbidden }, 403);
    return session;
  }

  // Runs the storage work of one call; an unexpected failure becomes a 502.
  async function guarded(work: () => Promise<Response>): Promise<Response> {
    try {
      return await work();
    } catch (error) {
      logError("Accounts request failed", error);
      return jsonResponse({ error: messages.failed }, 502);
    }
  }

  async function GET(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    return guarded(async () => jsonResponse(answer(await storage.loadAll(), session)));
  }

  async function POST(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    if (grantableFor(session).length === 0) return jsonResponse({ error: messages.cannotCreate }, 403);

    const body = (await readJson(request)) ?? {};
    return guarded(async () => {
      const accounts = await storage.loadAll();
      if (accounts.length >= config.maxAccounts) return jsonResponse({ error: messages.full(config.maxAccounts) }, 400);

      const taken = (name: string) =>
        (config.isReservedName ? config.isReservedName(name) : false) ||
        accounts.some((account) => account.username.toLowerCase() === name.toLowerCase());

      let username = typeof body.username === "string" ? body.username.trim() : "";
      if (username) {
        if (!usernamePattern.test(username)) return jsonResponse({ error: messages.usernameInvalid }, 400);
        if (taken(username)) return jsonResponse({ error: messages.usernameTaken }, 400);
      } else {
        // A generated name can already exist; try again (a few times at most,
        // so a badly chosen generator can't loop forever).
        let attempts = 0;
        do {
          username = generateUsername();
          attempts += 1;
        } while (taken(username) && attempts < 50);
        if (taken(username)) return jsonResponse({ error: messages.failed }, 500);
      }

      const password = generatePassword();
      accounts.push({
        id: newId(),
        username,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        roles: rolesFor(body.roles, session),
      });
      await storage.saveAll(accounts);
      return jsonResponse({ username, password, ...answer(accounts, session) });
    });
  }

  // The account named in the request that this person may manage, or the error Response.
  async function target(request: Request, session: S) {
    const body = (await readJson(request)) ?? {};
    const accounts = await storage.loadAll();
    const account = accounts.find((candidate) => candidate.username === body.username);
    if (!account || !manageable(account, session)) return jsonResponse({ error: messages.notFound }, 404);
    return { body, accounts, account };
  }

  async function PUT(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    return guarded(async () => {
      const found = await target(request, session);
      if (found instanceof Response) return found;
      found.account.roles = rolesFor(found.body.roles, session);
      await storage.saveAll(found.accounts);
      return jsonResponse(answer(found.accounts, session));
    });
  }

  async function PATCH(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    return guarded(async () => {
      const found = await target(request, session);
      if (found instanceof Response) return found;
      const password = generatePassword();
      found.account.passwordHash = hashPassword(password);
      await storage.saveAll(found.accounts);
      return jsonResponse({ username: found.account.username, password });
    });
  }

  async function DELETE(request: Request) {
    const session = await allowed(request);
    if (session instanceof Response) return session;
    return guarded(async () => {
      const found = await target(request, session);
      if (found instanceof Response) return found;
      const remaining = found.accounts.filter((candidate) => candidate !== found.account);
      await storage.saveAll(remaining);
      return jsonResponse(answer(remaining, session));
    });
  }

  return { GET, POST, PUT, PATCH, DELETE };
}
