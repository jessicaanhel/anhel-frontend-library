"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

// Adapted from the account menu's close handling in
// angela-simon-wedding/components/panel/PanelApp.tsx.
//
// While `open`, calls `onClose` when the mouse is pressed outside `ref`'s
// element or Escape is pressed. For dropdowns and menus. Put the button that
// opens the dropdown inside the same element, otherwise its own click
// would close the dropdown that it is about to open.
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref, onClose]);
}
