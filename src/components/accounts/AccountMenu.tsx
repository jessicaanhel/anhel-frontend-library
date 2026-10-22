"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the round avatar at
// the top right of the planning panel, with a menu (My information, Accounts,
// Permissions, Trash, Log out).
// ============================================================================

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { LogOut } from "../../icons";
import { useDismiss } from "../../useDismiss";
import styles from "./Accounts.module.css";

// Adapted from the avatar and account menu in angela-simon-wedding/components/panel/PanelApp.tsx.
//
// A round button showing the person's initials; it opens a menu with their
// name and roles, the items the app passes in, and "Log out". It opens and
// closes itself (outside click, Escape).

export type AccountMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
};

export type AccountMenuTexts = {
  label: string; // the avatar button and the menu
  noRole: string;
  logOut: string;
};

const DEFAULT_TEXTS: AccountMenuTexts = {
  label: "Account menu",
  noRole: "No role yet",
  logOut: "Log out",
};

export type AccountMenuProps = {
  username: string;
  // The names of the person's roles, e.g. roles.map(model.roleLabel).
  roleLabels: string[];
  items: AccountMenuItem[];
  onLogOut: () => void;
  // Default: the first two letters of the username, in capitals.
  initials?: string;
  texts?: Partial<AccountMenuTexts>;
  className?: string;
};

export default function AccountMenu({ username, roleLabels, items, onLogOut, initials, texts, className }: AccountMenuProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, wrap, () => setOpen(false));

  return (
    <div className={className ? `${styles.menuWrap} ${className}` : styles.menuWrap} ref={wrap}>
      <button type="button" className={styles.avatar} aria-label={t.label} aria-expanded={open} onClick={() => setOpen(!open)}>
        {initials ?? username.slice(0, 2).toUpperCase()}
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t.label}>
          <div className={styles.menuHead}>
            <strong>{username}</strong>
            <span>{roleLabels.length ? roleLabels.join(" · ") : t.noRole}</span>
          </div>
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.key}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <button type="button" role="menuitem" className={styles.menuLogout} onClick={onLogOut}>
            <LogOut size={16} strokeWidth={1.7} /> {t.logOut}
          </button>
        </div>
      )}
    </div>
  );
}
