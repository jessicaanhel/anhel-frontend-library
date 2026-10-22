"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Permissions page
// of the planning panel: a grid of every tab and action against every role.
// ============================================================================

import { Fragment, useEffect, useState } from "react";
import type { PermissionModel, Permissions } from "../../permissions";
import styles from "./Accounts.module.css";

// Adapted from angela-simon-wedding/components/panel/PermissionsPanel.tsx.
//
// A grid of the permissions (rows, grouped) against the roles (columns). Tick
// a box and that role may do that from then on; the change is saved at once
// and shown at once. The admin role has no column: it can always do
// everything, so nobody can lock themselves out. With `canEdit` off the grid is
// read-only. Secret permissions are not shown. The server checks the same
// rules on every call (see createPermissionsHandlers).
//   GET  endpoint        -> { permissions }
//   PUT  endpoint { key, roles } -> { permissions }

export type PermissionsPanelTexts = {
  heading: string;
  descriptionEditable: (saving: boolean, adminLabel: string) => string;
  descriptionReadOnly: string;
  loadFailed: string;
  saveFailed: string;
  tickLabel: (roleLabel: string, permissionLabel: string) => string;
};

const DEFAULT_TEXTS: PermissionsPanelTexts = {
  heading: "Permissions",
  descriptionEditable: (saving, adminLabel) =>
    `Tick the roles that may use each permission. Changes apply at once${saving ? " (saving…)" : ""}. ${adminLabel} can always do everything.`,
  descriptionReadOnly: "Which roles may use each permission. Only the admin can change this.",
  loadFailed: "Could not load the permissions.",
  saveFailed: "Could not save.",
  tickLabel: (roleLabel, permissionLabel) => `${roleLabel}: ${permissionLabel}`,
};

export type PermissionsPanelProps<Role extends string> = {
  // The roles, permissions and admin role (see createPermissionModel).
  model: PermissionModel<Role>;
  canEdit: boolean;
  // Default "/api/permissions".
  endpoint?: string;
  texts?: Partial<PermissionsPanelTexts>;
  className?: string;
};

export default function PermissionsPanel<Role extends string>({ model, canEdit, endpoint = "/api/permissions", texts, className }: PermissionsPanelProps<Role>) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [permissions, setPermissions] = useState<Permissions<Role> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // The columns: every role except the admin role. The rows: every permission
  // that is not secret, grouped in the order the groups first appear.
  const columns = model.assignableRoles;
  const rows = model.permissions.filter((permission) => !permission.secret);
  const groups = [...new Set(rows.map((permission) => permission.group))];

  useEffect(() => {
    fetch(endpoint)
      .then((response) => response.json())
      .then((body: { permissions?: Permissions<Role>; error?: string }) => {
        if (body.permissions) setPermissions(body.permissions);
        else setError(body.error ?? t.loadFailed);
      })
      .catch(() => setError(t.loadFailed));
    // Loaded once per endpoint; the texts are only used for a failure message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function toggle(key: string, role: Role) {
    if (!permissions || !canEdit) return;
    const current = permissions[key] ?? [];
    const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
    setPermissions({ ...permissions, [key]: next }); // shown at once, confirmed by the server's answer
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, roles: next }),
      });
      const body = (await response.json().catch(() => null)) as { permissions?: Permissions<Role>; error?: string } | null;
      if (!response.ok || !body || !body.permissions) throw new Error(body && body.error ? body.error : t.saveFailed);
      setPermissions(body.permissions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.saveFailed);
      setPermissions({ ...permissions, [key]: current });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={className ? `${styles.card} ${className}` : styles.card}>
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h3>{t.heading}</h3>
          <p>{canEdit ? t.descriptionEditable(saving, model.roleLabel(model.adminRole)) : t.descriptionReadOnly}</p>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      {permissions && (
        <div className={styles.permissionsGrid}>
          <table className={styles.permissionsTable}>
            <thead>
              <tr>
                <th />
                {columns.map((role) => (
                  <th key={role.key}>{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group}>
                  <tr className={styles.groupRow}>
                    <td colSpan={columns.length + 1}>{group}</td>
                  </tr>
                  {rows
                    .filter((permission) => permission.group === group)
                    .map((permission) => (
                      <tr key={permission.key}>
                        <td>{permission.label}</td>
                        {columns.map((role) => (
                          <td key={role.key}>
                            <input
                              type="checkbox"
                              aria-label={t.tickLabel(role.label, permission.label)}
                              checked={(permissions[permission.key] ?? []).includes(role.key)}
                              disabled={!canEdit}
                              onChange={() => toggle(permission.key, role.key)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
