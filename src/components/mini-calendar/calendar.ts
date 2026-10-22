// The days of one month for a small calendar. No React and no Node imports.
// Adapted from MiniCalendar in angela-simon-wedding/components/panel/PanelApp.tsx.

export type CalendarCell = {
  day: number; // the number shown
  iso: string; // YYYY-MM-DD, "" for a day of the neighbouring month
  outside: boolean; // a day of the previous or next month, shown faint
  today: boolean;
  marked: boolean; // gets a dot
  count: number; // gets a round badge with this number (0: none)
};

export type MonthCellsOptions = {
  year: number;
  month: number; // 0-11, like Date
  todayIso?: string; // YYYY-MM-DD, "" or left out: no day is today
  marked?: ReadonlySet<string>;
  counts?: ReadonlyMap<string, number>;
  weekStartsOn?: 0 | 1; // 0 = Sunday (default), 1 = Monday
};

const pad = (value: number) => String(value).padStart(2, "0");

// Always 42 cells (six weeks), so the calendar keeps the same height from
// month to month. Days of the neighbouring months fill the gaps; they never
// have a dot, a badge or the "today" mark.
export function monthCells(options: MonthCellsOptions): CalendarCell[] {
  const { year, month, todayIso = "", marked = new Set<string>(), counts = new Map<string, number>(), weekStartsOn = 0 } = options;

  const firstOfMonth = new Date(year, month, 1);
  // How many days of the previous month come before the 1st in the first row.
  const leading = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - leading + 1;
    if (day < 1) return { day: daysInPreviousMonth + day, iso: "", outside: true, today: false, marked: false, count: 0 };
    if (day > daysInMonth) return { day: day - daysInMonth, iso: "", outside: true, today: false, marked: false, count: 0 };
    const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    return { day, iso, outside: false, today: iso === todayIso, marked: marked.has(iso), count: counts.get(iso) ?? 0 };
  });
}

// Weekday letters starting on `weekStartsOn`, from a list that starts on Sunday.
export function weekdayLabels(sundayFirst: string[], weekStartsOn: 0 | 1 = 0) {
  return [...sundayFirst.slice(weekStartsOn), ...sundayFirst.slice(0, weekStartsOn)];
}
