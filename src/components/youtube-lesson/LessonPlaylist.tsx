"use client";

import { useRef, type KeyboardEvent } from "react";
import { BookOpen, Play } from "../../icons";
import styles from "./YouTubeLesson.module.css";

// The list of a course's parts for a column next to the player: videos and
// readings in order, the open one highlighted. Each part is a button, so it
// works with Tab and Enter; the arrow keys (and Home, End) move between the
// parts too. The page keeps which part is open (`activeId`, `onSelect`).

export type LessonPlaylistItem = {
  id: string;
  title: string;
  kind: "video" | "reading";
  // Shown as given, e.g. "12:30" or "5 min".
  duration?: string;
};

export type LessonPlaylistTexts = {
  // The accessible name of the list.
  label: string;
  video: string;
  reading: string;
  empty: string;
};

const DEFAULT_TEXTS: LessonPlaylistTexts = {
  label: "Lessons",
  video: "Video",
  reading: "Reading",
  empty: "Nothing here yet.",
};

export type LessonPlaylistProps = {
  items: LessonPlaylistItem[];
  activeId: string;
  onSelect: (id: string) => void;
  texts?: Partial<LessonPlaylistTexts>;
  className?: string;
};

export default function LessonPlaylist({ items, activeId, onSelect, texts, className }: LessonPlaylistProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const list = useRef<HTMLOListElement>(null);

  // Up and Down go to the part before and after, Home and End to the first
  // and last. Only the focus moves: Enter or Space opens the part.
  function moveFocus(event: KeyboardEvent<HTMLOListElement>) {
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    let target = -1;
    if (event.key === "ArrowDown") target = Math.min(buttons.length - 1, index + 1);
    else if (event.key === "ArrowUp") target = Math.max(0, index - 1);
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = buttons.length - 1;
    if (target === -1) return;
    event.preventDefault();
    buttons[target].focus();
  }

  return (
    <nav className={className ? `${styles.playlist} ${className}` : styles.playlist} aria-label={t.label}>
      {items.length === 0 && <p className={styles.empty}>{t.empty}</p>}
      <ol ref={list} className={styles.items} onKeyDown={moveFocus}>
        {items.map((item, index) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`${styles.item} ${active ? styles.active : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span className={styles.number}>{index + 1}</span>
                <span className={styles.itemText}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemMeta}>
                    {item.kind === "video" ? <Play size={12} /> : <BookOpen size={12} />}
                    {item.kind === "video" ? t.video : t.reading}
                    {item.duration ? ` · ${item.duration}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
