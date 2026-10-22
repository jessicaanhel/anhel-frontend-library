// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Permissions page's
// endpoint (which roles may open each tab and use each action).
// ============================================================================

import type { PermissionModel, Permissions } from "../../permissions";
import { jsonResponse, readJson } from "../http";
import type { HistoryStorage } from "../storage/types";
import type { AccountsSession } from "./handlers";

// Adapted from angela-simon-wedding/app/api/panel/permissions/route.ts.
//
//   GET -> { permissions }          every permission with its roles (the saved ones on top of the defaults)
//   PUT -> { key, roles }           set the roles of one permission; answers like GET
//
// Whoever `canView` allows can read it; only the admin role can change it.
// Secret permissions are never sent and can't be changed. The admin role is
// never stored: it can always do everything.

export type PermissionsMessages = {
  forbidden: string;
  invalidRequest: string;
  unknownPermission: string;
  failed: string;
};

const DEFAULT_MESSAGES: PermissionsMessages = {
  forbidden: "Only the admin can change permissions.",
  invalidRequest: "Invalid request.",
  unknownPermission: "Unknown permission.",
  failed: "Could not save the permissions.",
};

export type PermissionsHandlerConfig<Role extends string, S extends AccountsSession<Role> = AccountsSession<Role>> = {
  model: PermissionModel<Role>;
  getSession: (request: Request) => Promise<S | null>;
  // Who may read the page, e.g. (session) => auth.can(session, "tab:permissions").
  canView: (session: S) => boolean;
  // What was saved so far (only what was changed on the page).
  loadSaved: () => Promise<Permissions<Role>>;
  save: (permissions: Permissions<Role>) => Promise<void>;
  // Called after a save, e.g. auth.forgetPermissions, so this server uses the change at once.
  onChanged?: () => void;
  // Each change is written here under the person's name. Leave out for no history.
  history?: HistoryStorage;
  messages?: Partial<PermissionsMessages>;
  logError?: (message: string, error: unknown) => void;
};

export function createPermissionsHandlers<Role extends string, S extends AccountsSession<Role> = AccountsSession<Role>>(
  config: PermissionsHandlerConfig<Role, S>
) {
  const { model } = config;
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  // Everything except the secret permissions.
  async function visible() {
    const merged = model.withDefaults(await config.loadSaved());
    return Object.fromEntries(Object.entries(merged).filter(([key]) => !model.isSecret(key)));
  }

  async function GET(request: Request) {
    const session = await config.getSession(request);
    if (!session || !config.canView(session)) return jsonResponse({ error: messages.forbidden }, 403);
    try {
      return jsonResponse({ permissions: await visible() });
    } catch (error) {
      logError("Failed to read the permissions", error);
      return jsonResponse({ error: messages.failed }, 502);
    }
  }

  async function PUT(request: Request) {
    const session = await config.getSession(request);
    if (!session || !session.roles.includes(model.adminRole)) return jsonResponse({ error: messages.forbidden }, 403);

    const body = await readJson(request);
    if (!body) return jsonResponse({ error: messages.invalidRequest }, 400);

    const key = typeof body.key === "string" ? body.key : "";
    const definition = model.permissions.find((permission) => permission.key === key && !permission.secret);
    if (!definition) return jsonResponse({ error: messages.unknownPermission }, 400);

    const given = Array.isArray(body.roles) ? body.roles : [];
    const roles = [
      ...new Set(given.filter((role): role is Role => typeof role === "string" && model.isRoleKey(role) && role !== model.adminRole)),
    ];

    try {
      await config.save({ ...(await config.loadSaved()), [key]: roles });
      config.onChanged?.();
      if (config.history) {
        const who = roles.length ? roles.join(", ") : "admin only";
        await config.history.append({ at: new Date().toISOString(), username: session.username, text: `Permission “${definition.label}”: ${who}` });
      }
      return jsonResponse({ permissions: await visible() });
    } catch (error) {
      logError("Failed to save the permissions", error);
      return jsonResponse({ error: messages.failed }, 502);
    }
  }

  return { GET, PUT };
}
