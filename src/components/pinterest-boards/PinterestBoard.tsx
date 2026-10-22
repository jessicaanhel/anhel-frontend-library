"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the live Pinterest
// boards on the panel's Inspiration pages (and a short strip of pins in the
// Overview preview).
// ============================================================================

import { useEffect, useRef } from "react";
import styles from "./PinterestBoards.module.css";

// Adapted from angela-simon-wedding/components/panel/PinterestBoard.tsx.
//
// Pinterest's own board embed, which stays up to date by itself. Only a full
// board link can be embedded (see isEmbeddableBoard); show anything else as a
// plain link. PinterestBoardList does that already.

type PinUtilsWindow = Window & { PinUtils?: { build: (element?: Element) => void } };

const PINTEREST_SCRIPT = "https://assets.pinterest.com/js/pinit.js";

let pinterestScript: Promise<void> | null = null;

// Loads Pinterest's widget script once, the first time a board is shown.
function loadPinterestScript() {
  if (!pinterestScript) {
    pinterestScript = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = PINTEREST_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => resolve(); // offline or blocked: the link next to the board still works
      document.body.appendChild(script);
    });
  }
  return pinterestScript;
}

export type PinterestBoardProps = {
  link: string;
  // A short strip of pins (e.g. for an overview preview).
  compact?: boolean;
  className?: string;
};

export default function PinterestBoard({ link, compact = false, className }: PinterestBoardProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    // Pinterest replaces this link with its own iframe, outside React's control,
    // so the link is created by hand inside an element React never renders into.
    const anchor = document.createElement("a");
    anchor.setAttribute("data-pin-do", "embedBoard");
    anchor.setAttribute("data-pin-board-width", String(Math.max(240, Math.min(element.clientWidth, 900))));
    anchor.setAttribute("data-pin-scale-height", compact ? "110" : "300");
    anchor.setAttribute("data-pin-scale-width", compact ? "60" : "80");
    anchor.href = link;
    element.replaceChildren(anchor);

    let cancelled = false;
    loadPinterestScript().then(() => {
      if (!cancelled) (window as PinUtilsWindow).PinUtils?.build(element);
    });
    return () => {
      cancelled = true;
      element.replaceChildren();
    };
  }, [link, compact]);

  const classes = [styles.embed, compact ? styles.embedCompact : "", className ?? ""].filter(Boolean).join(" ");
  return <div className={classes} ref={container} />;
}
