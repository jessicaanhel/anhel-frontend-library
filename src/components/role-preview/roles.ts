// Who sees what in the role preview. No React runtime and no Node imports.
// Adapted from wedding-panel-portfolio/script.js (menuRow, MENU, ROLES).

import type { ReactNode } from "react";

// A page in the preview menu. Without a `permission` it is open to every role.
export type RolePreviewPage = { title: string; permission?: string };

export type RolePreviewGroup = { group: string; pages: RolePreviewPage[] };

export type RolePreviewMenuNode = RolePreviewPage | RolePreviewGroup;

export type RolePreviewRole = {
  id: string;
  label: string;
  // A sentence about what this role is for.
  story: ReactNode;
  // The permission keys this role has.
  permissions: string[];
  // Shown instead of the usual "no access" next to a page this role can't
  // open, by permission key (e.g. "even for the admin").
  hiddenNotes?: Record<string, string>;
  // Extra abilities: `true` = can, `false` = can't, text = can, in a way
  // (e.g. "view only", "Groom mate only").
  can: [label: string, value: boolean | string][];
};

export function isPreviewGroup(node: RolePreviewMenuNode): node is RolePreviewGroup {
  return "group" in node;
}

// Can this role open the page?
export function roleCanOpen(role: RolePreviewRole, page: RolePreviewPage) {
  return !page.permission || role.permissions.includes(page.permission);
}
