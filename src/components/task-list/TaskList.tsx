"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the shared to-do list
// of the planning panel ("Upcoming tasks" on the Overview and the Tasks page):
// tick off, star as important, assign, set a deadline, filter and page.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, Clock, Star, X } from "../../icons";
import { useConfirm } from "../confirm-dialog";
import {
  categoryColour,
  filterTasks,
  isIsoDate,
  isOverdue,
  sameUser,
  toIsoDate,
  type Task,
  type TaskAssigneeFilter,
  type TaskFilters,
  type TaskPeriod,
  type TaskStatusFilter,
} from "./task";
import styles from "./TaskList.module.css";

// Adapted from the task pieces of angela-simon-wedding/components/panel/PanelApp.tsx.
//
// Controlled: the list shows `tasks` and reports changes through onSave /
// onRemove. Wire it to useSharedList for a server-backed list (see README).

export type TaskListTexts = {
  heading: string;
  summary: (open: number, mine: number) => string;
  everyone: string;
  unassigned: string;
  meSuffix: string; // after your own name in the person filter
  youSuffix: string; // after your own name in the assignee menus
  statusLabels: Record<TaskStatusFilter, string>;
  periodLabels: Record<TaskPeriod, string>;
  filterByPerson: string;
  filterByStatus: string;
  filterByTime: string;
  myTasks: string;
  complete: (title: string) => string;
  reopen: (title: string) => string;
  markImportant: (title: string) => string;
  unmarkImportant: (title: string) => string;
  importantHint: string;
  notImportantHint: string;
  assignedTo: (title: string) => string;
  deadline: string;
  deadlineFor: (title: string) => string;
  remove: (title: string) => string;
  confirmRemove: (title: string) => string;
  removeNote: string;
  emptyList: string;
  emptyView: string;
  showMore: (count: number) => string;
  showFewer: string;
  viewAll: string;
  previous: string;
  next: string;
  page: (page: number, pages: number, total: number) => string;
};

const DEFAULT_TEXTS: TaskListTexts = {
  heading: "Tasks",
  summary: (open, mine) => `${open} still need attention · ${mine} yours`,
  everyone: "Everyone",
  unassigned: "Unassigned",
  meSuffix: " (me)",
  youSuffix: " (you)",
  statusLabels: { all: "All", open: "Open", done: "Done" },
  periodLabels: {
    next3: "Next 3 months and overdue",
    month: "This month and overdue",
    nodate: "No deadline",
    all: "All tasks",
  },
  filterByPerson: "Filter by person",
  filterByStatus: "Filter by status",
  filterByTime: "Filter by time",
  myTasks: "My tasks",
  complete: (title) => `Complete ${title}`,
  reopen: (title) => `Reopen ${title}`,
  markImportant: (title) => `Mark as important: ${title}`,
  unmarkImportant: (title) => `Remove the important mark from ${title}`,
  importantHint: "Important",
  notImportantHint: "Mark as important",
  assignedTo: (title) => `Assigned to, ${title}`,
  deadline: "Deadline",
  deadlineFor: (title) => `Deadline for ${title}`,
  remove: (title) => `Remove ${title}`,
  confirmRemove: (title) => `Remove the task “${title}”?`,
  removeNote: "",
  emptyList: "No tasks yet. Add the first one.",
  emptyView: "No tasks in this view.",
  showMore: (count) => `Show ${count} more`,
  showFewer: "Show fewer",
  viewAll: "View all tasks",
  previous: "← Previous",
  next: "Next →",
  page: (page, pages, total) => `Page ${page} of ${pages} · ${total} ${total === 1 ? "task" : "tasks"}`,
};

export type TaskListProps = {
  tasks: Task[];
  // Called with the whole changed task (completed, important, assigned, due).
  onSave: (task: Task) => void;
  // Called after the removal was confirmed.
  onRemove: (task: Task) => void;
  // Usernames a task can be assigned to.
  people: string[];
  // The signed-in person: "My tasks", "(you)" and the "yours" count.
  currentUser?: string;
  // "compact": the first `compactStep` tasks with "show more"; "paged": pages
  // of `pageSize` with a time filter. Default "paged".
  mode?: "compact" | "paged";
  pageSize?: number;
  compactStep?: number;
  initialFilters?: Partial<TaskFilters>;
  showFilters?: boolean;
  // Compact mode: shows a "View all tasks" button.
  onViewAll?: () => void;
  // Shown in the heading, e.g. an "Add task" button.
  headerAction?: ReactNode;
  // Extra buttons next to "My tasks".
  tools?: ReactNode;
  error?: string;
  // false: remove without asking. A function: your own confirmation.
  confirmRemove?: boolean | ((task: Task) => Promise<boolean>);
  // YYYY-MM-DD. Default: the browser's date, set after mounting (so server
  // and browser render the same markup).
  today?: string;
  dotColours?: string[];
  texts?: Partial<TaskListTexts>;
  className?: string;
};

function assigneeToValue(filter: TaskAssigneeFilter) {
  if (filter.kind === "everyone") return "*everyone";
  if (filter.kind === "unassigned") return "*unassigned";
  return `user:${filter.username}`;
}

// The <select> values are prefixed, so a username can never be mistaken for
// "everyone" or "unassigned".
function valueToAssignee(value: string): TaskAssigneeFilter {
  if (value === "*unassigned") return { kind: "unassigned" };
  if (value.startsWith("user:")) return { kind: "person", username: value.slice(5) };
  return { kind: "everyone" };
}

export default function TaskList({
  tasks,
  onSave,
  onRemove,
  people,
  currentUser = "",
  mode = "paged",
  pageSize = 12,
  compactStep = 5,
  initialFilters,
  showFilters = true,
  onViewAll,
  headerAction,
  tools,
  error,
  confirmRemove = true,
  today: todayProp,
  dotColours,
  texts,
  className,
}: TaskListProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const { ask, dialog } = useConfirm();

  const [status, setStatus] = useState<TaskStatusFilter>(initialFilters?.status ?? "all");
  const [assignee, setAssignee] = useState<TaskAssigneeFilter>(initialFilters?.assignee ?? { kind: "everyone" });
  const [period, setPeriod] = useState<TaskPeriod>(initialFilters?.period ?? (mode === "paged" ? "next3" : "all"));
  const [page, setPage] = useState(0);
  const [compactShown, setCompactShown] = useState(compactStep);

  const [browserToday, setBrowserToday] = useState("");
  useEffect(() => {
    if (!todayProp) setBrowserToday(toIsoDate(new Date()));
  }, [todayProp]);
  const today = todayProp ?? browserToday;

  // The time filter only applies to the paged list.
  const activePeriod: TaskPeriod = mode === "paged" ? period : "all";
  const filtered = useMemo(
    () => filterTasks(tasks, { status, assignee, period: activePeriod }, today),
    [tasks, status, assignee, activePeriod, today]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  let shown: Task[];
  if (mode === "compact") shown = filtered.slice(0, compactShown);
  else shown = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const openCount = tasks.filter((task) => !task.completed).length;
  const mineCount = currentUser
    ? tasks.filter((task) => !task.completed && sameUser(task.assigned, currentUser)).length
    : 0;

  function personLabel(person: string, suffix: string) {
    return currentUser && sameUser(person, currentUser) ? `${person}${suffix}` : person;
  }

  // The person already assigned stays in the menu even when no longer in `people`.
  function peopleFor(task: Task) {
    const names = [...people];
    if (task.assigned && !names.some((name) => sameUser(name, task.assigned))) names.push(task.assigned);
    return names;
  }

  async function handleRemove(task: Task) {
    let confirmed = true;
    if (typeof confirmRemove === "function") confirmed = await confirmRemove(task);
    else if (confirmRemove) confirmed = await ask(t.confirmRemove(task.title), { note: t.removeNote });
    if (confirmed) onRemove(task);
  }

  function changeFilter(change: () => void) {
    change();
    setPage(0);
  }

  return (
    <article className={className ? `${styles.panel} ${className}` : styles.panel}>
      {dialog}
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h3>{t.heading}</h3>
          <p>{t.summary(openCount, mineCount)}</p>
        </div>
        {showFilters ? (
          <div className={styles.filters}>
            <div className={styles.filterControl}>
              <select
                aria-label={t.filterByPerson}
                value={assigneeToValue(assignee)}
                onChange={(event) => changeFilter(() => setAssignee(valueToAssignee(event.target.value)))}
              >
                <option value="*everyone">{t.everyone}</option>
                {people.map((person) => (
                  <option key={person} value={`user:${person}`}>
                    {personLabel(person, t.meSuffix)}
                  </option>
                ))}
                <option value="*unassigned">{t.unassigned}</option>
              </select>
              <ChevronDown size={14} />
            </div>
            <div className={styles.filterControl}>
              <select
                aria-label={t.filterByStatus}
                value={status}
                onChange={(event) => changeFilter(() => setStatus(event.target.value as TaskStatusFilter))}
              >
                {(Object.keys(t.statusLabels) as TaskStatusFilter[]).map((key) => (
                  <option key={key} value={key}>
                    {t.statusLabels[key]}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            {mode === "paged" ? (
              <div className={styles.filterControl}>
                <select
                  aria-label={t.filterByTime}
                  value={period}
                  onChange={(event) => changeFilter(() => setPeriod(event.target.value as TaskPeriod))}
                >
                  {(Object.keys(t.periodLabels) as TaskPeriod[]).map((key) => (
                    <option key={key} value={key}>
                      {t.periodLabels[key]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            ) : null}
          </div>
        ) : null}
        {headerAction}
      </div>

      {currentUser || tools ? (
        <div className={styles.tools}>
          {currentUser ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => changeFilter(() => setAssignee({ kind: "person", username: currentUser }))}
            >
              {t.myTasks}
            </button>
          ) : null}
          {tools}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.list}>
        {shown.map((task) => (
          <div className={task.completed ? `${styles.row} ${styles.rowDone}` : styles.row} key={task.id || task.title}>
            <button
              type="button"
              className={styles.check}
              onClick={() => onSave({ ...task, completed: !task.completed })}
              aria-label={task.completed ? t.reopen(task.title) : t.complete(task.title)}
            >
              {task.completed ? <Check size={13} strokeWidth={3} /> : null}
            </button>
            <button
              type="button"
              className={task.important ? `${styles.star} ${styles.starOn}` : styles.star}
              aria-pressed={task.important}
              aria-label={task.important ? t.unmarkImportant(task.title) : t.markImportant(task.title)}
              title={task.important ? t.importantHint : t.notImportantHint}
              onClick={() => onSave({ ...task, important: !task.important })}
            >
              <Star size={15} />
            </button>
            <span className={styles.dot} style={{ background: categoryColour(task.category, dotColours) }} />
            <div className={styles.copy} title={task.notes || undefined}>
              <strong>{task.title}</strong>
              {task.category ? <span>{task.category}</span> : null}
              {task.notes ? <span className={styles.notes}>{task.notes}</span> : null}
            </div>
            <select
              className={styles.assignee}
              aria-label={t.assignedTo(task.title)}
              value={task.assigned}
              onChange={(event) => onSave({ ...task, assigned: event.target.value })}
            >
              <option value="">{t.unassigned}</option>
              {peopleFor(task).map((person) => (
                <option key={person} value={person}>
                  {personLabel(person, t.youSuffix)}
                </option>
              ))}
            </select>
            <label className={isOverdue(task, today) ? `${styles.due} ${styles.dueOverdue}` : styles.due} title={t.deadline}>
              <Clock size={14} />
              <input
                type="date"
                className={styles.dueInput}
                // Only a real YYYY-MM-DD can be shown in a date field; anything
                // typed by hand elsewhere shows as empty.
                value={isIsoDate(task.due) ? task.due : ""}
                aria-label={t.deadlineFor(task.title)}
                onChange={(event) => onSave({ ...task, due: event.target.value })}
              />
            </label>
            <button type="button" className={styles.remove} onClick={() => handleRemove(task)} aria-label={t.remove(task.title)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {filtered.length === 0 ? <div className={styles.empty}>{tasks.length === 0 ? t.emptyList : t.emptyView}</div> : null}
      </div>

      {mode === "compact" ? (
        <div className={styles.more}>
          {filtered.length > compactShown ? (
            <button type="button" className={styles.textButton} onClick={() => setCompactShown(compactShown + compactStep)}>
              <ChevronDown size={14} /> {t.showMore(Math.min(compactStep, filtered.length - compactShown))}
            </button>
          ) : null}
          {compactShown > compactStep ? (
            <button type="button" className={styles.textButton} onClick={() => setCompactShown(compactStep)}>
              {t.showFewer}
            </button>
          ) : null}
          {onViewAll ? (
            <button type="button" className={styles.textButton} onClick={onViewAll}>
              {t.viewAll} <ArrowUpRight size={15} />
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.pager}>
          <button type="button" className={styles.textButton} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            {t.previous}
          </button>
          <span>{t.page(currentPage + 1, pageCount, filtered.length)}</span>
          <button
            type="button"
            className={styles.textButton}
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            {t.next}
          </button>
        </div>
      )}
    </article>
  );
}
