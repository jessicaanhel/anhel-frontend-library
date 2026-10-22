"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the "My information"
// page of the planning panel: who I am, my roles, and what they let me open
// and do.
// ============================================================================

import type { PermissionModel } from "../../permissions";
import styles from "./Accounts.module.css";

// Adapted from angela-simon-wedding/components/panel/MyInformation.tsx.

export type MyInformationTexts = {
  noRole: string;
  // The small heading above each group of permissions (the group names of the
  // permission definitions are the keys). A group without an entry is shown
  // under its own name in capitals.
  groupHeadings: Record<string, string>;
};

const DEFAULT_TEXTS: MyInformationTexts = {
  noRole: "No role yet",
  groupHeadings: {},
};

export type MyInformationProps<Role extends string> = {
  username: string;
  roles: Role[];
  // Each permission key -> whether this person may do it (e.g. built with auth.can).
  access: Record<string, boolean>;
  model: PermissionModel<Role>;
  texts?: Partial<MyInformationTexts>;
  className?: string;
};

export default function MyInformation<Role extends string>({ username, roles, access, model, texts, className }: MyInformationProps<Role>) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  // A secret permission is only listed to the people who have it, so its
  // existence isn't given away to everyone else.
  const listed = model.permissions.filter((permission) => !permission.secret || access[permission.key]);
  const groups = [...new Set(listed.map((permission) => permission.group))];

  return (
    <section className={className ? `${styles.card} ${className}` : styles.card}>
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h3>{username}</h3>
          <p>{roles.length ? roles.map((role) => model.roleLabel(role)).join(" · ") : t.noRole}</p>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group}>
          <p className={styles.groupHeading}>{t.groupHeadings[group] ?? group.toUpperCase()}</p>
          <ul className={styles.accessList}>
            {listed
              .filter((permission) => permission.group === group)
              .map((permission) => (
                <li key={permission.key} className={access[permission.key] ? undefined : styles.no}>
                  <span>{access[permission.key] ? "✓" : "–"}</span> {permission.label}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
