"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the bell dropdown in
// the top bar of the planning panel.
// ============================================================================

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bell } from "../../icons";
import { useDismiss } from "../../useDismiss";
import type { NotificationItem } from "./notifications";
import styles from "./NotificationBell.module.css";

// Adapted from the bell in angela-simon-wedding/components/panel/PanelApp.tsx.
//
// A round bell button with a count of the unread ones, and a dropdown that
// lists them. It opens and closes itself (outside click, Escape). Feed it from
// useNotifications.

export type NotificationBellTexts = {
  label: string; // the button
  labelWithCount: (unread: number) => string;
  heading: string;
  markAllRead: string;
  empty: string;
};

const DEFAULT_TEXTS: NotificationBellTexts = {
  label: "Notifications",
  labelWithCount: (unread) => `Notifications, ${unread} new`,
  heading: "Notifications",
  markAllRead: "Mark all as read",
  empty: "Nothing new.",
};

export type NotificationBellProps = {
  notifications: NotificationItem[];
  // Keys of the notifications that were read: shown faded and not counted.
  read: ReadonlySet<string>;
  // Called when a notification is clicked (the dropdown closes). Typically it
  // marks it as read and opens the page it is about.
  onSelect: (notification: NotificationItem) => void;
  onMarkAllRead: () => void;
  icon?: ReactNode;
  texts?: Partial<NotificationBellTexts>;
  className?: string;
};

export default function NotificationBell({ notifications, read, onSelect, onMarkAllRead, icon, texts, className }: NotificationBellProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, wrap, () => setOpen(false));

  const unread = notifications.filter((note) => !read.has(note.key)).length;
  const dotClass = (kind: NotificationItem["kind"]) => (kind === "overdue" ? styles.dotOverdue : kind === "due" ? styles.dotDue : styles.dot);

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap} ref={wrap}>
      <button type="button" className={styles.button} aria-label={unread ? t.labelWithCount(unread) : t.label} aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon ?? <Bell size={19} />}
        {unread > 0 && <b className={styles.count}>{unread}</b>}
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label={t.heading}>
          <div className={styles.head}>
            <strong>{t.heading}</strong>
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead}>
                {t.markAllRead}
              </button>
            )}
          </div>
          {notifications.map((note) => (
            <button
              type="button"
              className={`${styles.item} ${read.has(note.key) ? styles.read : ""}`}
              key={note.key}
              onClick={() => {
                onSelect(note);
                setOpen(false);
              }}
            >
              <span className={dotClass(note.kind)} />
              <span>
                <strong>{note.title}</strong>
                <em>{note.text}</em>
              </span>
            </button>
          ))}
          {notifications.length === 0 && <div className={styles.empty}>{t.empty}</div>}
        </div>
      )}
    </div>
  );
}
