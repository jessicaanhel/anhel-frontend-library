"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Adapted from angela-simon-wedding/components/panel/useSharedList.ts.
//
// Client side of one shared list endpoint (see createListHandlers): GET for
// the list, PUT { item } to create or update, DELETE { id } to remove.
// The list is the same for everyone signed in, so it is re-read every
// `pollMs` and when the tab regains focus, which also picks up edits made
// elsewhere (another person, or by hand in a spreadsheet).
// Changes are applied on screen at once (optimistic), then replaced by the
// server's reply; on an error the list goes back to what the server has.

export type SharedListOptions = {
  // Called after every confirmed change (e.g. to reload a history panel).
  onChanged?: () => void;
  // How often the list is re-read while the tab is visible. 0 = never. Default 20 s.
  pollMs?: number;
  // Shown when a change fails without a message from the server.
  saveError?: string;
};

type WithId = { id: string };

export function useSharedList<T extends WithId>(endpoint: string, initial: T[] = [], options: SharedListOptions = {}) {
  const { onChanged, pollMs = 20_000, saveError = "Could not save." } = options;
  const [items, setItems] = useState<T[]>(initial);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  // A ref as well as state: the polling callback must see the current count
  // without being recreated on every change.
  const pendingRef = useRef(0);

  const refresh = useCallback(async () => {
    if (pendingRef.current > 0) return; // don't overwrite a change that is still being saved
    try {
      const response = await fetch(endpoint);
      if (!response.ok) return;
      const body = (await response.json()) as { items: T[] };
      if (pendingRef.current === 0) setItems(body.items);
    } catch {
      // offline: keep what is on screen
    }
  }, [endpoint]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollMs > 0) {
      timer = setInterval(() => {
        if (!document.hidden) refresh();
      }, pollMs);
    }
    window.addEventListener("focus", refresh);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, pollMs]);

  function changePending(step: number) {
    pendingRef.current += step;
    setPending(pendingRef.current);
  }

  async function send(method: "PUT" | "DELETE", payload: unknown, optimistic: (current: T[]) => T[]) {
    changePending(1);
    setError("");
    setItems(optimistic);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { items?: T[]; error?: string } | null;
      if (!response.ok || !body || !Array.isArray(body.items)) {
        throw new Error(body && body.error ? body.error : saveError);
      }
      setItems(body.items);
      changePending(-1);
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : saveError);
      changePending(-1);
      await refresh(); // go back to what the server has
    }
  }

  // An item with an empty id is a new one: shown at the top until the
  // server's reply (with its real id) replaces the list.
  function save(item: T) {
    return send("PUT", { item }, (current) => {
      const exists = item.id !== "" && current.some((existing) => existing.id === item.id);
      if (exists) return current.map((existing) => (existing.id === item.id ? item : existing));
      return [item, ...current];
    });
  }

  function remove(id: string) {
    return send("DELETE", { id }, (current) => current.filter((item) => item.id !== id));
  }

  return { items, save, remove, saving: pending > 0, error, refresh };
}

export type SharedList<T extends WithId> = ReturnType<typeof useSharedList<T>>;
