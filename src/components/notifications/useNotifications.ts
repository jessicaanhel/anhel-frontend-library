"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the bell in the top
// bar of the planning panel (my new tasks, deadlines that are close or past).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "../task-list/task";
import { buildNotifications, myOpenTasks, type NotificationTexts } from "./notifications";

// Adapted from angela-simon-wedding/components/panel/useNotifications.ts.
//
// The notifications themselves are worked out from the task list (see
// buildNotifications). What THIS browser has already seen and read is kept in
// localStorage, per person, so nothing extra is stored on the server.

type Stored = {
  // Ids of my tasks I have seen. null until the first visit has been recorded.
  seen: string[] | null;
  // Keys of the notifications I have read.
  read: string[];
};

export type UseNotificationsOptions = {
  // localStorage key = `${storagePrefix}-${username in lower case}`. Default "notifications".
  storagePrefix?: string;
  // Deadlines this many days away or less are announced. Default 3.
  dueSoonDays?: number;
  texts?: Partial<NotificationTexts>;
};

function loadStored(key: string): Stored {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as Stored | null;
    if (parsed) return { seen: parsed.seen ?? null, read: parsed.read ?? [] };
  } catch {
    // private browsing: start fresh each time
  }
  return { seen: null, read: [] };
}

function saveStored(key: string, stored: Stored) {
  try {
    window.localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // not saved: the bell still works for this visit
  }
}

// `todayIso` (YYYY-MM-DD) comes from the caller, read in the browser after
// the first render ("" until then: no notifications), so the server and the
// browser can't disagree about the date.
export function useNotifications(tasks: Task[], username: string, todayIso: string, options: UseNotificationsOptions = {}) {
  const { storagePrefix = "notifications", dueSoonDays, texts } = options;
  const storageKey = `${storagePrefix}-${username.toLowerCase()}`;
  const [stored, setStored] = useState<Stored | null>(null);

  // Read what this browser remembers (after the first render, so the server
  // and the browser agree on what is drawn first).
  useEffect(() => {
    const timer = setTimeout(() => setStored(loadStored(storageKey)), 0);
    return () => clearTimeout(timer);
  }, [storageKey]);

  const mine = useMemo(() => myOpenTasks(tasks, username), [tasks, username]);

  // First visit ever: everything already assigned to me counts as seen, so
  // the bell doesn't start with a pile of "new" tasks. Only later assignments
  // are announced.
  useEffect(() => {
    if (!stored || stored.seen !== null) return;
    const timer = setTimeout(() => {
      const next = { ...stored, seen: mine.map((task) => task.id) };
      saveStored(storageKey, next);
      setStored(next);
    }, 0);
    return () => clearTimeout(timer);
  }, [stored, mine, storageKey]);

  const notifications = useMemo(() => {
    if (!stored || stored.seen === null || !todayIso) return [];
    return buildNotifications({ tasks, username, todayIso, seen: new Set(stored.seen), dueSoonDays, texts });
    // `texts` is usually a new object on every render; its content rarely changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, tasks, username, todayIso, dueSoonDays]);

  const read = useMemo(() => new Set(stored?.read ?? []), [stored]);
  const unread = notifications.filter((note) => !read.has(note.key));

  const update = useCallback(
    (change: (current: Stored) => Stored) => {
      setStored((current) => {
        if (!current) return current;
        const next = change(current);
        saveStored(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  // Tasks I assign to myself are not "news": call this with their ids.
  const markSeen = useCallback(
    (ids: string[]) => update((current) => ({ ...current, seen: [...new Set([...(current.seen ?? []), ...ids])] })),
    [update]
  );

  const markAllRead = () =>
    update((current) => ({
      seen: [...new Set([...(current.seen ?? []), ...mine.map((task) => task.id)])],
      read: [...new Set([...current.read, ...notifications.map((note) => note.key)])],
    }));

  const markRead = (key: string) => update((current) => ({ ...current, read: [...new Set([...current.read, key])] }));

  return { notifications, unread, read, markSeen, markAllRead, markRead };
}
