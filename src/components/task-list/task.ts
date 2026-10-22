// The task (to-do item) shared by the task list UI and the server, plus the
// pure filtering and sorting the list uses. No React and no Node imports, so
// both sides can use it.
// Adapted from angela-simon-wedding/lib/panel/types.ts (Task) and
// components/panel/PanelApp.tsx (filters, order, category colours).

export type Task = {
  id: string; // "" for a task that has not been saved yet
  title: string;
  category: string;
  due: string; // YYYY-MM-DD, or ""
  // The one person responsible for it (a username), or "" when nobody yet.
  assigned: string;
  // A longer description, shown under the title.
  notes: string;
  completed: boolean;
  // Marked with a star (e.g. shown in red in a calendar).
  important: boolean;
};

export type TaskStatusFilter = "all" | "open" | "done";

// A time window: always together with the overdue open tasks, except "nodate"
// (only tasks without a deadline) and "all".
export type TaskPeriod = "next3" | "month" | "nodate" | "all";

// The assignee filter: everyone, nobody, or one username.
export type TaskAssigneeFilter = { kind: "everyone" } | { kind: "unassigned" } | { kind: "person"; username: string };

export type TaskFilters = {
  status: TaskStatusFilter;
  assignee: TaskAssigneeFilter;
  period: TaskPeriod;
};

// A new task with every field filled in.
export function emptyTask(fields: Partial<Task> = {}): Task {
  return {
    id: "",
    title: "",
    category: "",
    due: "",
    assigned: "",
    notes: "",
    completed: false,
    important: false,
    ...fields,
  };
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// YYYY-MM-DD of a date in the local time zone.
export function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sameUser(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

// Is the task inside the time window? `today` is YYYY-MM-DD; without it
// (e.g. during server rendering, before the browser's date is known) every
// task counts as inside.
export function isInPeriod(task: Task, period: TaskPeriod, today: string) {
  if (period === "all" || !today) return true;
  if (period === "nodate") return !task.due;
  if (!task.due) return false;
  if (!task.completed && task.due < today) return true; // overdue
  const [year, month, day] = today.split("-").map(Number);
  // "month": up to the last day of this month (day 0 of next month);
  // "next3": up to the same day three months from now.
  const last = period === "month" ? new Date(year, month, 0) : new Date(year, month - 1 + 3, day);
  return task.due >= today && task.due <= toIsoDate(last);
}

// Open tasks with the nearest deadline first, then open tasks without one,
// then the completed ones (in the same order). Returns a new array.
export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;
    if (left.due && right.due) return left.due.localeCompare(right.due);
    if (left.due) return -1;
    if (right.due) return 1;
    return 0;
  });
}

export function filterTasks(tasks: Task[], filters: TaskFilters, today: string) {
  const shown = tasks.filter((task) => {
    if (!isInPeriod(task, filters.period, today)) return false;
    if (filters.status === "open" && task.completed) return false;
    if (filters.status === "done" && !task.completed) return false;
    if (filters.assignee.kind === "unassigned") return !task.assigned;
    if (filters.assignee.kind === "person") return sameUser(task.assigned, filters.assignee.username);
    return true;
  });
  return sortTasks(shown);
}

export function isOverdue(task: Task, today: string) {
  return Boolean(today && task.due && !task.completed && task.due < today);
}

// A task's coloured dot comes from its category, so equal categories match.
export const DEFAULT_DOT_COLOURS = ["#b66a4f", "#82917a", "#b19a78", "#9a7590", "#7b8f71", "#6f8aa0"];

export function categoryColour(category: string, colours: string[] = DEFAULT_DOT_COLOURS) {
  let hash = 0;
  for (const character of category) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colours[hash % colours.length];
}
