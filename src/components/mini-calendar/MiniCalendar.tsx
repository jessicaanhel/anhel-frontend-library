"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the small calendar in
// the planning panel's right column: dots on the days with my deadlines, a red
// round number on the days with important tasks.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { monthCells, weekdayLabels } from "./calendar";
import styles from "./MiniCalendar.module.css";

// Adapted from MiniCalendar in angela-simon-wedding/components/panel/PanelApp.tsx.
//
// A month view with arrows to move between months. `marked` days get a dot,
// and `counts` puts a red round badge with a number on a day.

export type MiniCalendarTexts = {
  previousMonth: string;
  nextMonth: string;
  // The letters above the columns, starting on Sunday (rotated when the week starts on Monday).
  weekdays: string[];
  badgeTitle: (count: number) => string;
};

const DEFAULT_TEXTS: MiniCalendarTexts = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  weekdays: ["S", "M", "T", "W", "T", "F", "S"],
  badgeTitle: (count) => `${count} ${count === 1 ? "item" : "items"}`,
};

export type MiniCalendarProps = {
  // Days (YYYY-MM-DD) that get a dot, e.g. my deadlines.
  marked?: Iterable<string>;
  // Per day (YYYY-MM-DD), the number shown in a red round badge, e.g. the
  // important tasks due. Days with 0 or nothing have no badge.
  counts?: Record<string, number> | ReadonlyMap<string, number>;
  // The day that is marked as today (YYYY-MM-DD). Default: the browser's date,
  // read after the first render so the server and the browser can't disagree
  // (until then the calendar is an empty box).
  today?: string;
  // 0 = Sunday, 1 = Monday. Default 0.
  weekStartsOn?: 0 | 1;
  // For the month name. Default "en-GB".
  locale?: string;
  texts?: Partial<MiniCalendarTexts>;
  className?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

export default function MiniCalendar({ marked, counts, today, weekStartsOn = 0, locale = "en-GB", texts, className }: MiniCalendarProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [browserToday, setBrowserToday] = useState<Date | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    // A timer, so the state is set after the first render (not during it).
    const timer = setTimeout(() => setBrowserToday(new Date()), 0);
    return () => clearTimeout(timer);
  }, []);

  const markedSet = useMemo(() => new Set(marked ?? []), [marked]);
  const countMap = useMemo(() => (counts instanceof Map ? counts : new Map(Object.entries(counts ?? {}))), [counts]);

  // The date the calendar is based on: the `today` prop, or the browser's.
  let base: Date | null = null;
  if (today) {
    const [year, month, day] = today.split("-").map(Number);
    base = new Date(year, month - 1, day);
  } else if (browserToday) {
    base = browserToday;
  }

  const rootClass = className ? `${styles.calendar} ${className}` : styles.calendar;
  if (!base) return <div className={rootClass} />;

  const shown = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const todayIso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
  const cells = monthCells({ year: shown.getFullYear(), month: shown.getMonth(), todayIso, marked: markedSet, counts: countMap, weekStartsOn });

  return (
    <div className={rootClass}>
      <div className={styles.head}>
        <button type="button" aria-label={t.previousMonth} onClick={() => setMonthOffset(monthOffset - 1)}>
          ‹
        </button>
        <strong>{shown.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
        <button type="button" aria-label={t.nextMonth} onClick={() => setMonthOffset(monthOffset + 1)}>
          ›
        </button>
      </div>
      <div className={`${styles.grid} ${styles.weekdays}`}>
        {weekdayLabels(t.weekdays, weekStartsOn).map((letter, index) => (
          <span key={`${letter}-${index}`}>{letter}</span>
        ))}
      </div>
      <div className={`${styles.grid} ${styles.days}`}>
        {cells.map((cell, index) => (
          <span
            className={[cell.outside ? styles.outside : "", cell.today ? styles.today : "", cell.marked ? styles.marked : ""].join(" ").trim()}
            key={index}
          >
            {cell.day}
            {cell.count > 0 && (
              <b className={styles.badge} title={t.badgeTitle(cell.count)}>
                {cell.count}
              </b>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
