"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Trash page of the
// planning panel (admins only): everything removed in the last 7 days, to
// restore or delete for good.
// ============================================================================

import { useEffect, useState } from "react";
import { RefreshCw, Trash } from "../../icons";
import { useConfirm } from "../confirm-dialog";
import { trashDaysLeft } from "./trash";
import styles from "./TrashPanel.module.css";

// Adapted from angela-simon-wedding/components/panel/TrashPanel.tsx.
//
// Talks to a trash endpoint (see createTrashHandlers):
//   GET             -> { entries }
//   POST   { id }   -> { entries }   restore (the item goes back to its list)
//   DELETE { id }   -> { entries }   delete for good

// What the list needs of an entry (createTrash's TrashEntry has more).
export type TrashPanelEntry = {
  id: string;
  kind: string;
  title: string;
  removedBy: string;
  removedAt: string; // ISO timestamp
};

export type TrashPanelTexts = {
  heading: string;
  description: (keepDays: number) => string;
  empty: string;
  loadFailed: string;
  failed: string;
  // The grey line under an entry's title.
  entryLine: (kind: string, removedBy: string, date: string, daysLeft: number) => string;
  restoreTitle: string;
  restoreLabel: (title: string) => string;
  deleteTitle: string;
  deleteLabel: (title: string) => string;
  confirmDelete: (title: string) => string;
  confirmDeleteYes: string;
  confirmDeleteNote: string;
};

const DEFAULT_TEXTS: TrashPanelTexts = {
  heading: "Trash",
  description: (keepDays) => `Removed items are kept for ${keepDays} days, then deleted for good.`,
  empty: "The trash is empty.",
  loadFailed: "Could not load the trash.",
  failed: "Something went wrong.",
  entryLine: (kind, removedBy, date, daysLeft) => `${kind} · removed by ${removedBy} · ${date} · ${daysLeft} days left`,
  restoreTitle: "Restore",
  restoreLabel: (title) => `Restore ${title}`,
  deleteTitle: "Delete for good",
  deleteLabel: (title) => `Delete ${title} for good`,
  confirmDelete: (title) => `Delete “${title}” for good?`,
  confirmDeleteYes: "Yes, delete for good",
  confirmDeleteNote: "It can't be restored after this.",
};

export type TrashPanelProps = {
  // Default "/api/trash".
  endpoint?: string;
  // Called after an item was restored, e.g. to re-read the lists it went back to.
  onRestored?: (entry: TrashPanelEntry) => void;
  // How long entries are kept: only used for the "days left" text. Use the
  // same value as createTrash's `keepDays`. Default 7.
  keepDays?: number;
  // The name shown for each kind of entry ({ task: "Task" }). A kind without
  // a name is shown as it is.
  kindLabels?: Record<string, string>;
  // For the removal date. Default "en-GB".
  locale?: string;
  texts?: Partial<TrashPanelTexts>;
  className?: string;
};

export default function TrashPanel({ endpoint = "/api/trash", onRestored, keepDays = 7, kindLabels = {}, locale = "en-GB", texts, className }: TrashPanelProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [entries, setEntries] = useState<TrashPanelEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  useEffect(() => {
    fetch(endpoint)
      .then((response) => response.json())
      .then((body) => setEntries(body.entries ?? []))
      .catch(() => setError(t.loadFailed))
      .finally(() => setLoaded(true));
    // Loaded once per endpoint; the texts are only used for a failure message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function call(method: "POST" | "DELETE", id: string) {
    setError("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || t.failed);
      setEntries(body.entries);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.failed);
      return false;
    }
  }

  return (
    <section className={className ? `${styles.panel} ${className}` : styles.panel}>
      {dialog}
      <div className={styles.heading}>
        <h3>{t.heading}</h3>
        <p>{t.description(keepDays)}</p>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.list}>
        {entries.map((entry) => (
          <div className={styles.row} key={entry.id}>
            <div className={styles.copy}>
              <strong>{entry.title}</strong>
              <span>
                {t.entryLine(
                  kindLabels[entry.kind] ?? entry.kind,
                  entry.removedBy,
                  new Date(entry.removedAt).toLocaleDateString(locale, { day: "numeric", month: "short" }),
                  trashDaysLeft(entry.removedAt, keepDays)
                )}
              </span>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              title={t.restoreTitle}
              aria-label={t.restoreLabel(entry.title)}
              onClick={async () => (await call("POST", entry.id)) && onRestored?.(entry)}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              title={t.deleteTitle}
              aria-label={t.deleteLabel(entry.title)}
              onClick={async () =>
                (await ask(t.confirmDelete(entry.title), { confirmLabel: t.confirmDeleteYes, note: t.confirmDeleteNote })) && call("DELETE", entry.id)
              }
            >
              <Trash size={15} />
            </button>
          </div>
        ))}
        {loaded && entries.length === 0 && <div className={styles.empty}>{t.empty}</div>}
      </div>
    </section>
  );
}
