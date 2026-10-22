"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: "Search anything" in
// the planning panel (Ctrl/⌘ K): one box over tasks, guests, vendors, budget
// items and Pinterest boards.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "../../icons";
import { searchSections, type FoundHit, type SearchSection } from "./search";
import styles from "./SearchDialog.module.css";

// Adapted from angela-simon-wedding/components/panel/SearchDialog.tsx.
//
// One search box over any number of sections of results that the app passes
// in. Picking a result (click, or Enter for the first one) reports it with the
// `data` the app gave it, so the app can open the right page. Render it only
// while it is open (`{open && <SearchDialog … />}`), so it starts empty each
// time. Pair it with useSearchShortcut for Ctrl/⌘ K.

export type SearchDialogTexts = {
  label: string; // accessible name of the dialog
  placeholder: string;
  hint: string; // shown before anything is typed
  nothingFound: (query: string) => string;
};

const DEFAULT_TEXTS: SearchDialogTexts = {
  label: "Search",
  placeholder: "Search…",
  hint: "Type to search.",
  nothingFound: (query) => `Nothing found for “${query}”.`,
};

export type SearchDialogProps<T = unknown> = {
  sections: SearchSection<T>[];
  onPick: (hit: FoundHit<T>) => void;
  onClose: () => void;
  // The most results shown. Default 15.
  limit?: number;
  texts?: Partial<SearchDialogTexts>;
  className?: string;
};

export default function SearchDialog<T = unknown>({ sections, onPick, onClose, limit = 15, texts, className }: SearchDialogProps<T>) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const hits = useMemo(() => searchSections(sections, query, limit), [sections, query, limit]);
  const trimmed = query.trim();

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={className ? `${styles.dialog} ${className}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t.label}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Enter" && hits[0]) onPick(hits[0]);
        }}
      >
        <label className={styles.field}>
          <Search size={18} />
          <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} />
        </label>

        <div className={styles.results}>
          {hits.map((hit) => (
            <button type="button" className={styles.hit} key={`${hit.section}-${hit.id}`} onClick={() => onPick(hit)}>
              <strong>{hit.label}</strong>
              <span>{[hit.section, hit.detail].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          {trimmed && hits.length === 0 && <div className={styles.empty}>{t.nothingFound(trimmed)}</div>}
          {!trimmed && <div className={styles.empty}>{t.hint}</div>}
        </div>
      </div>
    </div>
  );
}
