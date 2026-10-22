import type { Task } from "../../components/task-list/task";
import { isoDate, listChanges, text } from "./clean";
import { createListHandlers, type ListConfig, type ListSession } from "./handlers";

// Adapted from angela-simon-wedding/app/api/panel/tasks/route.ts and
// lib/panel/boardRoutes.ts (boardTaskHandlers): the task list endpoint.

export type CleanTaskOptions = {
  // Used when a task comes without a category. Default "".
  defaultCategory?: string;
};

// The task fields from what the browser sent, or null without a title.
export function cleanTask(input: unknown, options: CleanTaskOptions = {}): Omit<Task, "id"> | null {
  const raw = (input ?? {}) as Partial<Record<keyof Task, unknown>>;
  const title = text(raw.title, 200);
  if (!title) return null;
  return {
    title,
    category: text(raw.category, 40) || (options.defaultCategory ?? ""),
    due: isoDate(raw.due),
    assigned: text(raw.assigned, 40),
    notes: text(raw.notes, 400),
    completed: raw.completed === true,
    important: raw.important === true,
  };
}

// The history lines for task changes. `noun` names the item ("task", or e.g.
// "to-do item" on a smaller board).
export function describeTasks(noun = "task") {
  return {
    describeCreate: (task: Task) => `Added ${noun} “${task.title}”${task.assigned ? ` for ${task.assigned}` : ""}`,
    describeUpdate(before: Task, after: Task) {
      if (before.completed !== after.completed) {
        return `${after.completed ? "Completed" : "Reopened"} “${after.title}”`;
      }
      if (before.important !== after.important) {
        return `${after.important ? "Marked as important" : "Removed the important mark from"} “${after.title}”`;
      }
      const changes = listChanges([
        ["title", before.title, after.title],
        ["category", before.category, after.category],
        ["deadline", before.due, after.due],
        ["assigned to", before.assigned, after.assigned],
        ["notes", before.notes, after.notes],
      ]);
      return changes ? `Edited ${noun} “${after.title}”: ${changes}` : null;
    },
    describeRemove: (task: Task) => `Removed ${noun} “${task.title}”`,
  };
}

export type TaskListHandlerOptions<S extends ListSession> = Omit<ListConfig<Task, S>, "clean" | "maxItems"> & {
  // Default 300.
  maxItems?: number;
  defaultCategory?: string;
  // The word used in history lines. Default "task".
  noun?: string;
};

// GET / PUT / DELETE for a task list. Everything except the task fields can be
// changed through the options (storage, session, history, trash, permissions).
export function createTaskListHandlers<S extends ListSession = ListSession>(options: TaskListHandlerOptions<S>) {
  const { maxItems, defaultCategory, noun, ...rest } = options;
  return createListHandlers<Task, S>({
    ...describeTasks(noun),
    ...rest,
    maxItems: maxItems ?? 300,
    clean: (input) => cleanTask(input, { defaultCategory }),
  });
}
