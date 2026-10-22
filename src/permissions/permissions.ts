// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the roles and
// permissions of the planning panel (which role may open which tab and use
// which special action, set on its Permissions page).
// ============================================================================

// Adapted from angela-simon-wedding/lib/panel/permissions.ts. The roles,
// permission keys and defaults are passed in instead of being fixed.
//
// Pure functions, no Node or React imports: the same model is used in the
// browser (a permissions page, the menu) and on the server (which enforces it
// on every call).
//
// A person has one or more ROLES. One role is the ADMIN role: it may do
// everything (so nobody can lock themselves out), except "secret" permissions.
// A secret permission is not even open to the admin role and is meant to be
// left off any permissions page (for example a surprise board the admin must
// not see). It always follows its default roles; saved values are ignored.

export type RoleDefinition<Role extends string> = { key: Role; label: string };

export type PermissionDefinition = {
  key: string; // e.g. "tab:tasks" or "action:export"
  label: string;
  group: string; // e.g. "Tabs" or "Actions", for grouping on a permissions page
  secret?: boolean;
};

// Which roles may do each permission key.
export type Permissions<Role extends string = string> = Record<string, Role[]>;

export type PermissionModelConfig<Role extends string> = {
  roles: RoleDefinition<Role>[];
  // The role that may do everything except secret permissions. It is never
  // handed out from the accounts page (see assignableRoles).
  adminRole: Role;
  permissions: PermissionDefinition[];
  // What applies until something is saved. Keys missing here allow nobody
  // (apart from the admin role).
  defaults: Permissions<Role>;
  // Which roles a person with `roles` may give to other accounts. Default:
  // the admin role may give every assignable role, everyone else none.
  grantableRoles?: (roles: Role[]) => Role[];
};

export type PermissionModel<Role extends string> = ReturnType<typeof createPermissionModel<Role>>;

export function createPermissionModel<Role extends string>(config: PermissionModelConfig<Role>) {
  const { roles, adminRole, permissions, defaults } = config;

  // The roles that accounts can be given (every role except the admin role).
  const assignableRoles = roles.filter((role) => role.key !== adminRole);

  function roleLabel(key: string) {
    const role = roles.find((candidate) => candidate.key === key);
    return role ? role.label : key;
  }

  function isRoleKey(value: string): value is Role {
    return roles.some((role) => role.key === value);
  }

  function isSecret(key: string) {
    return permissions.some((permission) => permission.key === key && permission.secret === true);
  }

  function grantableRoles(personRoles: Role[]): Role[] {
    if (config.grantableRoles) return config.grantableRoles(personRoles);
    if (personRoles.includes(adminRole)) return assignableRoles.map((role) => role.key);
    return [];
  }

  // Can a person with these roles do `key`? `saved` is what was saved on a
  // permissions page (use withDefaults to fill in the gaps).
  function isAllowed(saved: Permissions<Role>, key: string, personRoles: Role[]) {
    if (isSecret(key)) {
      // Not even the admin role: only the default roles, and only through a
      // role other than the admin one.
      const allowed = defaults[key] ?? [];
      return personRoles.some((role) => role !== adminRole && allowed.includes(role));
    }
    if (personRoles.includes(adminRole)) return true;
    const allowedRoles = saved[key] ?? defaults[key] ?? [];
    return personRoles.some((role) => allowedRoles.includes(role));
  }

  // The saved permissions on top of the defaults (a key that was never saved
  // uses its default). Secret permissions always keep their defaults.
  function withDefaults(saved: Permissions<Role>): Permissions<Role> {
    const merged: Permissions<Role> = { ...defaults, ...saved };
    for (const permission of permissions) {
      if (permission.secret) merged[permission.key] = defaults[permission.key] ?? [];
    }
    return merged;
  }

  // "editor, viewer" -> ["editor", "viewer"]: for permissions or roles stored
  // as text (a spreadsheet cell, a form field). Unknown words are dropped,
  // `aliases` maps older role names to current ones.
  function parseRoles(value: string, aliases: Record<string, string> = {}): Role[] {
    const keys: Role[] = [];
    for (const word of value.toLowerCase().split(/[\s,;]+/)) {
      const key = aliases[word] ?? word;
      if (isRoleKey(key) && !keys.includes(key)) keys.push(key);
    }
    return keys;
  }

  return {
    roles,
    adminRole,
    permissions,
    defaults,
    assignableRoles,
    roleLabel,
    isRoleKey,
    isSecret,
    grantableRoles,
    isAllowed,
    withDefaults,
    parseRoles,
  };
}
