"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the panel's "Mind
// Board" page: a FigJam planning board shown inside the panel.
// ============================================================================

import type { ReactNode } from "react";
import { ArrowUpRight } from "../../icons";
import { figmaEmbedUrl, isFigmaLink } from "./figma";
import styles from "./FigmaBoard.module.css";

// Adapted from angela-simon-wedding/components/panel/FigmaBoard.tsx. The board
// link is a prop instead of a constant in the app.
//
// Shows a Figma / FigJam file with Figma's own embed, plus an "Open in Figma"
// link. An empty link shows an empty state. A link that is not on figma.com is
// not embedded: only the "Open" link is shown.

export type FigmaBoardTexts = {
  open: string;
  empty: string;
  notFigma: string;
};

const DEFAULT_TEXTS: FigmaBoardTexts = {
  open: "Open in Figma",
  empty: "No board yet.",
  notFigma: "This link can't be shown here.",
};

export type FigmaBoardProps = {
  // The shared Figma link; "" shows the empty state.
  link: string;
  title: ReactNode;
  description?: ReactNode;
  // Used as the iframe's accessible name. Default: `title` when it is text, otherwise "Figma board".
  frameTitle?: string;
  // CSS height of the embed.
  height?: string;
  texts?: Partial<FigmaBoardTexts>;
  className?: string;
};

export default function FigmaBoard({
  link,
  title,
  description,
  frameTitle,
  height = "74vh",
  texts,
  className,
}: FigmaBoardProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const trimmed = link.trim();
  const accessibleName = frameTitle ?? (typeof title === "string" ? title : "Figma board");

  let body: ReactNode;
  if (!trimmed) {
    body = <div className={styles.empty}>{t.empty}</div>;
  } else if (!isFigmaLink(trimmed)) {
    body = <div className={styles.empty}>{t.notFigma}</div>;
  } else {
    body = <iframe className={styles.frame} style={{ height }} title={accessibleName} src={figmaEmbedUrl(trimmed)} allowFullScreen />;
  }

  return (
    <section className={className ? `${styles.board} ${className}` : styles.board}>
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {trimmed ? (
          <a className={styles.openLink} href={trimmed} target="_blank" rel="noopener noreferrer">
            {t.open} <ArrowUpRight size={14} />
          </a>
        ) : null}
      </div>
      {body}
    </section>
  );
}
