// Which notifications a person has, worked out from the shared task list.
// No React and no Node imports.
// Adapted from angela-simon-wedding/components/panel/useNotifications.ts.
//
// Notifications are about MY tasks (assigned to me, not done):
//   - assigned: a task was given to me that I have not seen before;
//   - due:      a deadline is close (today, or within `dueSoonDays`);
//   - overdue:  a deadline has passed.
// Nothing extra is stored on the server: they follow from the task list.

import { isIsoDate, sameUser, type Task } from "../task-list/task";

export type NotificationKind = "assigned" | "overdue" | "due";

export type NotificationItem = {
  // Stays the same while the news is the same, so it can be marked as read.
  // It changes when the deadline moves or the number of days left changes.
  key: string;
  kind: NotificationKind;
  title: string;
  text: string;
};

export type NotificationTexts = {
  assigned: string; // the title of "a task was given to you"
  overdue: string;
  overdueText: (taskTitle: string, due: string) => string;
  // The title of a deadline that is close: 0 days = today.
  due: (days: number) => string;
};

export const DEFAULT_NOTIFICATION_TEXTS: NotificationTexts = {
  assigned: "New task for you",
  overdue: "Overdue",
  overdueText: (taskTitle, due) => `${taskTitle} (was due ${due})`,
  due: (days) => {
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  },
};

// Whole days from `today` to `due` (both YYYY-MM-DD): negative = already past.
export function daysUntil(today: string, due: string) {
  const parse = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(due) - parse(today)) / 86_400_000);
}

export type BuildNotificationsOptions = {
  tasks: Task[];
  username: string;
  todayIso: string; // YYYY-MM-DD
  // The ids of my tasks that I have already seen. Those are not "new".
  seen: ReadonlySet<string>;
  // Deadlines this many days away or less are announced. Default 3.
  dueSoonDays?: number;
  texts?: Partial<NotificationTexts>;
};

// The open tasks that are assigned to this person.
export function myOpenTasks(tasks: Task[], username: string) {
  return tasks.filter((task) => sameUser(task.assigned, username) && !task.completed);
}

export function buildNotifications(options: BuildNotificationsOptions): NotificationItem[] {
  const { tasks, username, todayIso, seen } = options;
  const dueSoonDays = options.dueSoonDays ?? 3;
  const texts = { ...DEFAULT_NOTIFICATION_TEXTS, ...options.texts };
  const list: NotificationItem[] = [];

  for (const task of myOpenTasks(tasks, username)) {
    if (!seen.has(task.id)) {
      list.push({ key: `assigned:${task.id}`, kind: "assigned", title: texts.assigned, text: task.title });
    }
    if (isIsoDate(task.due)) {
      const days = daysUntil(todayIso, task.due);
      if (days < 0) {
        list.push({ key: `due:${task.id}:${task.due}:overdue`, kind: "overdue", title: texts.overdue, text: texts.overdueText(task.title, task.due) });
      } else if (days <= dueSoonDays) {
        list.push({ key: `due:${task.id}:${task.due}:${days}`, kind: "due", title: texts.due(days), text: task.title });
      }
    }
  }

  // Newest news first: new assignments, then overdue, then the soonest deadlines.
  const rank: Record<NotificationKind, number> = { assigned: 0, overdue: 1, due: 2 };
  return list.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
