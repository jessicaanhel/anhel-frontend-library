// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the login of the
// planning panel (username + password, a signed session cookie, and the roles
// and permissions of the signed-in person checked on every request).
// ============================================================================

import { createHmac } from "node:crypto";
import type { PermissionModel, Permissions } from "../../permissions";
import { readCookie, serializeCookie, type CookieOptions, type CookieReader } from "./cookies";
import { safeEqual, verifyPassword } from "./passwords";

// Adapted from angela-simon-wedding/lib/panel/auth.ts and
// app/api/auth/login|logout/route.ts. Server only (node:crypto).
//
// Simple login meant to keep each person's changes apart, not bank-grade
// security:
//   - CONFIGURED accounts come from the server settings (passed in by the app,
//     e.g. read from its environment), compared in constant time;
//   - STORED accounts are kept by the app with a scrypt hash (hashPassword);
//   - a login sets an HMAC-signed cookie: no server-side sessions. The
//     roles are NOT in the cookie: they are looked up on every request, so a
//     removed account or a changed role takes effect at once.

export type ConfiguredAccount<Role extends string> = { username: string; password: string; roles: Role[] };
export type StoredAccount<Role extends string> = { username: string; passwordHash: string; roles: Role[] };

// "configured": an account from the server settings; "stored": an account the app keeps.
export type SessionKind = "configured" | "stored";

export type Session<Role extends string = string> = {
  username: string;
  kind: SessionKind;
  roles: Role[];
  permissions: Permissions<Role>;
};

export type LoginMessages = {
  invalidRequest: string;
  missingFields: string;
  wrongCredentials: string;
  failed: string;
};

const DEFAULT_MESSAGES: LoginMessages = {
  invalidRequest: "Invalid request.",
  missingFields: "Enter your username and password.",
  wrongCredentials: "Wrong username or password.",
  failed: "Could not log in right now.",
};

export type AuthConfig<Role extends string> = {
  // The HMAC key for the session cookie. A function, so a missing setting
  // fails on the first request instead of when the module is imported.
  secret: string | (() => string | undefined);
  model: PermissionModel<Role>;
  // Accounts from the server settings. Called on every login and session
  // check, so a removed account is signed out.
  configuredAccounts?: () => ConfiguredAccount<Role>[];
  // Accounts the app keeps (password stored as hashPassword's output).
  listAccounts?: () => Promise<StoredAccount<Role>[]>;
  // What was saved on a permissions page. Missing keys use the model's defaults.
  loadPermissions?: () => Promise<Permissions<Role>>;
  // The saved permissions are kept this long, because they are needed on every
  // call: a change applies at once on the server that saved it (forgetPermissions)
  // and within this time anywhere else.
  permissionsCacheMs?: number;
  cookieName?: string;
  sessionDays?: number;
  // Default: true when NODE_ENV is "production".
  secureCookie?: boolean;
  messages?: Partial<LoginMessages>;
  // Turns an unexpected failure (e.g. the account store can't be reached) into
  // a short sentence for the login form. Default: messages.failed.
  describeError?: (error: unknown) => string;
  // Where unexpected failures are reported. Default: console.error.
  logError?: (message: string, error: unknown) => void;
};

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function createAuth<Role extends string>(config: AuthConfig<Role>) {
  const cookieName = config.cookieName ?? "session";
  const sessionDays = config.sessionDays ?? 30;
  const cacheMs = config.permissionsCacheMs ?? 10_000;
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie ?? process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDays * 24 * 60 * 60,
  };

  function secret() {
    const value = typeof config.secret === "function" ? config.secret() : config.secret;
    if (!value) throw new Error("The session secret is not configured.");
    return value;
  }

  function sign(payload: string) {
    return createHmac("sha256", secret()).update(payload).digest("base64url");
  }

  function configuredAccounts() {
    return config.configuredAccounts ? config.configuredAccounts() : [];
  }

  function findConfiguredAccount(username: string) {
    const lower = username.toLowerCase();
    return configuredAccounts().find((account) => account.username.toLowerCase() === lower);
  }

  // The configured account's own spelling of the name when these are its
  // credentials (compared in constant time), otherwise null.
  function matchConfiguredLogin(username: string, password: string): string | null {
    for (const account of configuredAccounts()) {
      const usernameMatches = safeEqual(username.toLowerCase(), account.username.toLowerCase());
      const passwordMatches = safeEqual(password, account.password);
      if (usernameMatches && passwordMatches) return account.username;
    }
    return null;
  }

  // ---- session token ---------------------------------------------------------

  function createSessionToken(username: string, kind: SessionKind) {
    const expires = Date.now() + sessionDays * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, k: kind, e: expires })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function readSessionToken(token: string | undefined): { username: string; kind: SessionKind } | null {
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u: unknown; k: unknown; e: unknown };
      if (typeof data.u !== "string" || typeof data.e !== "number" || data.e < Date.now()) return null;
      if (data.k !== "configured" && data.k !== "stored") return null;
      return { username: data.u, kind: data.k };
    } catch {
      return null;
    }
  }

  // ---- permissions -------------------------------------------------------------

  let permissionsCache: { at: number; value: Permissions<Role> } | null = null;

  async function loadPermissions(): Promise<Permissions<Role>> {
    if (permissionsCache && Date.now() - permissionsCache.at < cacheMs) return permissionsCache.value;
    let saved: Permissions<Role> = {};
    if (config.loadPermissions) {
      try {
        saved = await config.loadPermissions();
      } catch (error) {
        logError("Could not read the permissions; using the defaults", error);
      }
    }
    permissionsCache = { at: Date.now(), value: config.model.withDefaults(saved) };
    return permissionsCache.value;
  }

  // Call after saving new permissions, so this server uses them at once.
  function forgetPermissions() {
    permissionsCache = null;
  }

  // ---- sessions ------------------------------------------------------------------

  // The signed-in person for this request, or null. Pass the Request (route
  // handlers), Next.js's `await cookies()` (server components) or the token.
  // An account that was removed is signed out automatically.
  async function getSession(source: Request | CookieReader | string | null | undefined): Promise<Session<Role> | null> {
    let token: string | undefined;
    if (typeof source === "string") token = source;
    else if (source instanceof Request) token = readCookie(source, cookieName);
    else if (source) token = source.get(cookieName)?.value;

    const signedIn = readSessionToken(token);
    if (!signedIn) return null;

    let roles: Role[] | null = null;
    if (signedIn.kind === "configured") {
      const account = findConfiguredAccount(signedIn.username);
      roles = account ? account.roles : null;
    } else if (config.listAccounts) {
      const account = (await config.listAccounts()).find((candidate) => candidate.username === signedIn.username);
      roles = account ? account.roles : null;
    }
    if (!roles) return null;

    return { username: signedIn.username, kind: signedIn.kind, roles, permissions: await loadPermissions() };
  }

  // Can this person do `key` (a permission key from the model)?
  function can(session: Session<Role>, key: string) {
    return config.model.isAllowed(session.permissions, key, session.roles);
  }

  function hasRole(session: Session<Role>, role: Role) {
    return session.roles.includes(role);
  }

  // The signed-in person if they may do `key`, otherwise null.
  async function requirePermission(source: Request | CookieReader | string | null | undefined, key: string) {
    const session = await getSession(source);
    return session && can(session, key) ? session : null;
  }

  // The signed-in person if they have `role` (e.g. the admin role for a
  // permissions page), otherwise null.
  async function requireRole(source: Request | CookieReader | string | null | undefined, role: Role) {
    const session = await getSession(source);
    return session && hasRole(session, role) ? session : null;
  }

  // ---- route handlers ----------------------------------------------------------------

  // POST { username, password } -> { ok, kind } and the signed session cookie.
  async function handleLogin(request: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: messages.invalidRequest }, 400);
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return jsonResponse({ error: messages.missingFields }, 400);

    try {
      let signedIn: { username: string; kind: SessionKind } | null = null;

      const configuredName = matchConfiguredLogin(username, password);
      if (configuredName) {
        signedIn = { username: configuredName, kind: "configured" };
      } else if (findConfiguredAccount(username)) {
        // A configured name with a wrong password: answer now, without
        // looking at the stored accounts.
        return jsonResponse({ error: messages.wrongCredentials }, 401);
      } else if (config.listAccounts) {
        const lower = username.toLowerCase();
        const account = (await config.listAccounts()).find((candidate) => candidate.username.toLowerCase() === lower);
        if (account && verifyPassword(password, account.passwordHash)) {
          signedIn = { username: account.username, kind: "stored" };
        }
      }

      if (!signedIn) return jsonResponse({ error: messages.wrongCredentials }, 401);

      const cookie = serializeCookie(cookieName, createSessionToken(signedIn.username, signedIn.kind), cookieOptions);
      return jsonResponse({ ok: true, kind: signedIn.kind }, 200, { "Set-Cookie": cookie });
    } catch (error) {
      logError("Login failed", error);
      const message = config.describeError ? config.describeError(error) : messages.failed;
      return jsonResponse({ error: message }, 500);
    }
  }

  // POST -> clears the session cookie.
  function handleLogout(): Response {
    const cookie = serializeCookie(cookieName, "", { path: "/", maxAge: 0 });
    return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
  }

  return {
    cookieName,
    cookieOptions,
    createSessionToken,
    getSession,
    can,
    hasRole,
    requirePermission,
    requireRole,
    loadPermissions,
    forgetPermissions,
    handleLogin,
    handleLogout,
  };
}

export type Auth<Role extends string> = ReturnType<typeof createAuth<Role>>;
