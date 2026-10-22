"use client";

import { useEffect } from "react";

// Adapted from the Ctrl/⌘ + K listener in angela-simon-wedding/components/panel/PanelApp.tsx.
//
// Calls `onOpen` when Ctrl (or ⌘ on a Mac) and the key are pressed together
// (default K), and keeps the browser from also handling the shortcut.
export function useSearchShortcut(onOpen: () => void, key = "k") {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen, key]);
}
