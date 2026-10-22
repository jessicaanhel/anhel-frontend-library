"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE'S PORTFOLIO PAGE (wedding-panel-portfolio) AS:
// the "Log in as…" demo: pick a role and see the panel's menu as that role
// sees it, with what it can also do.
// ============================================================================

import { useState } from "react";
import { isPreviewGroup, roleCanOpen, type RolePreviewMenuNode, type RolePreviewPage, type RolePreviewRole } from "./roles";
import styles from "./RolePreview.module.css";

// Adapted from the role picker in wedding-panel-portfolio/script.js.
//
// A row of role buttons. The chosen role's menu is drawn below: pages it can
// open are plain, pages it can't are struck through with a short note. Next to
// it come a sentence about the role and a list of what it can also do. It is
// a picture of the permissions, not a login: nothing is checked on a server.

export type RolePreviewTexts = {
  pickerLabel: string;
  noAccess: string;
  canHeading: string;
};

const DEFAULT_TEXTS: RolePreviewTexts = {
  pickerLabel: "Choose a role",
  noAccess: "no access",
  canHeading: "Can also",
};

export type RolePreviewProps = {
  roles: RolePreviewRole[];
  // The side menu: pages and groups of pages.
  menu: RolePreviewMenuNode[];
  // A second menu below the first, e.g. the pages under the account icon.
  extraMenu?: { heading: string; pages: RolePreviewPage[] };
  // The role shown first (its id). Default: the first role.
  initialRoleId?: string;
  texts?: Partial<RolePreviewTexts>;
  className?: string;
};

export default function RolePreview({ roles, menu, extraMenu, initialRoleId, texts, className }: RolePreviewProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [roleId, setRoleId] = useState(initialRoleId ?? roles[0]?.id ?? "");
  const role = roles.find((candidate) => candidate.id === roleId) ?? roles[0];
  if (!role) return null;

  function pageRow(page: RolePreviewPage, inGroup: boolean) {
    const open = roleCanOpen(role, page);
    const note = page.permission ? role.hiddenNotes?.[page.permission] : undefined;
    return (
      <div className={[styles.page, inGroup ? styles.sub : "", open ? styles.open : styles.locked].join(" ").trim()} key={`${page.title}-${page.permission ?? ""}`}>
        <span>{page.title}</span>
        {!open && <small>{note ?? t.noAccess}</small>}
      </div>
    );
  }

  return (
    <div className={className ? `${styles.preview} ${className}` : styles.preview}>
      <div className={styles.picker} role="group" aria-label={t.pickerLabel}>
        {roles.map((candidate) => (
          <button type="button" key={candidate.id} aria-pressed={candidate.id === role.id} onClick={() => setRoleId(candidate.id)}>
            {candidate.label}
          </button>
        ))}
      </div>

      <div className={styles.view}>
        <div className={styles.menu} aria-live="polite">
          {menu.map((node, index) =>
            isPreviewGroup(node) ? (
              <div key={`${node.group}-${index}`} className={styles.menuGroup}>
                <p className={styles.group}>{node.group}</p>
                {node.pages.map((page) => pageRow(page, true))}
              </div>
            ) : (
              pageRow(node, false)
            )
          )}
          {extraMenu && (
            <div className={styles.extra}>
              <p className={styles.group}>{extraMenu.heading}</p>
              {extraMenu.pages.map((page) => pageRow(page, false))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <p className={styles.story}>{role.story}</p>
          <h3>{t.canHeading}</h3>
          <ul className={styles.canList}>
            {role.can.map(([label, value]) => (
              <li key={label} className={value === false ? styles.no : ""}>
                <span className={styles.mark}>{value === false ? "–" : "✓"}</span>
                <span>{typeof value === "string" ? `${label}: ${value}` : label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
