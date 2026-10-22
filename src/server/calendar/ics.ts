// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the calendar of a
// person's task deadlines (plus the wedding day) that phones subscribe to.
// ============================================================================

import type { Task } from "../../components/task-list/task";

// Adapted from angela-simon-wedding/lib/panel/calendar.ts.
//
// Builds an iCalendar (.ics, RFC 5545) file of all-day events. Phones
// subscribe to it by link and refresh it on their own, so a new or changed
// event shows up without anything being downloaded again.

export type CalendarEvent = {
  // Stays the same for the same event, so a refresh updates it instead of
  // adding a copy: e.g. "task-12@example.com".
  uid: string;
  date: string; // YYYY-MM-DD
  summary: string;
  description?: string;
  location?: string;
  // A reminder before the event. `hoursBefore` counts from the start of the
  // day (midnight), so the default 15 means 09:00 on the day before.
  reminder?: { text: string; hoursBefore?: number };
  // Show the day as free (a deadline should not make the person "busy").
  // Default false.
  free?: boolean;
};

export type CalendarOptions = {
  // The calendar's name in the phone's calendar app.
  name: string;
  // Identifies the producing software, e.g. "-//My app//Tasks//EN".
  prodId: string;
  events: CalendarEvent[];
  // How often calendar apps should look for changes. Default 1.
  refreshHours?: number;
  // The "created" time of the events. Default: now (a parameter for tests).
  now?: Date;
};

const pad = (value: number) => String(value).padStart(2, "0");

// "2027-06-12" -> "20270612".
function icsDate(iso: string) {
  return iso.replace(/-/g, "");
}

// The day after `iso`, as "20270613". An all-day event ends on the next day.
function nextDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

// Text values: escape \ ; , and newlines (RFC 5545).
export function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 bytes are folded onto continuation lines that start
// with a space. Cut between characters, never inside one (an emoji or an
// accented letter takes several bytes).
export function foldIcsLine(line: string) {
  const lines: string[] = [];
  let current = "";
  for (const character of line) {
    if (Buffer.byteLength(current + character) > 75) {
      lines.push(current);
      current = ` ${character}`; // the leading space counts towards the 75 bytes
    } else {
      current += character;
    }
  }
  lines.push(current);
  return lines.join("\r\n");
}

// The reminder as a duration before the start, "-PT15H".
function reminderTrigger(hoursBefore: number) {
  return `-PT${Math.max(0, Math.round(hoursBefore))}H`;
}

export function buildCalendar(options: CalendarOptions) {
  const now = options.now ?? new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const refresh = `PT${options.refreshHours ?? 1}H`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${options.prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.name)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
    `X-PUBLISHED-TTL:${refresh}`,
  ];

  for (const event of options.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.free) lines.push("TRANSP:TRANSPARENT");
    if (event.reminder) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcsText(event.reminder.text)}`,
        `TRIGGER:${reminderTrigger(event.reminder.hoursBefore ?? 15)}`,
        "END:VALARM"
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export type TaskEventOptions = {
  // The person the deadlines are for (named in the description).
  username: string;
  // The part after the @ in each event's uid, e.g. "my-app". Default "tasks".
  uidDomain?: string;
  // "Deadline: " + the task's title is the event's title. Default "Deadline: ".
  summaryPrefix?: string;
  // The reminder's text. Default: "Tomorrow: " + the title.
  reminderText?: (task: Task) => string;
  // Hours before midnight on the deadline. Default 15 (09:00 the day before). null: no reminder.
  reminderHoursBefore?: number | null;
  // The event's description. Default: the category and "assigned to <username>".
  describe?: (task: Task, username: string) => string;
};

// An event for each open task that has a deadline. Done tasks and tasks
// without a date (or with a date that is not YYYY-MM-DD) are left out.
export function taskCalendarEvents(tasks: Task[], options: TaskEventOptions): CalendarEvent[] {
  const domain = options.uidDomain ?? "tasks";
  const prefix = options.summaryPrefix ?? "Deadline: ";
  const hoursBefore = options.reminderHoursBefore === undefined ? 15 : options.reminderHoursBefore;

  return tasks
    .filter((task) => !task.completed && /^\d{4}-\d{2}-\d{2}$/.test(task.due))
    .map((task) => ({
      uid: `task-${task.id}@${domain}`,
      date: task.due,
      summary: `${prefix}${task.title}`,
      description: options.describe
        ? options.describe(task, options.username)
        : task.category
          ? `${task.category} · assigned to ${options.username}`
          : `Assigned to ${options.username}`,
      free: true,
      ...(hoursBefore === null
        ? {}
        : { reminder: { text: options.reminderText ? options.reminderText(task) : `Tomorrow: ${task.title}`, hoursBefore } }),
    }));
}
