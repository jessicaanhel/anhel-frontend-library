"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the to-do list of
// the panel's private boards (one per team): checkboxes, deadlines and who
// it is for, with a small inline "Add" form.
// ============================================================================

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Clock, Plus, X } from "../../icons";
import { useConfirm } from "../confirm-dialog";
import { emptyTask, isIsoDate, sameUser, sortTasks, type Task } from "./task";
import { useSharedList } from "./useSharedList";
import styles from "./TaskList.module.css";

// Adapted from angela-simon-wedding/components/panel/BoardTasks.tsx.
//
// A smaller, self-contained task list: it loads and saves through its own
// list endpoint (see createTaskListHandlers) and has no filters or pages.

export type TaskChecklistTexts = {
  heading: string;
  summary: (open: number) => string;
  add: string;
  titlePlaceholder: string;
  deadline: string;
  unassigned: string;
  youSuffix: string;
  complete: (title: string) => string;
  reopen: (title: string) => string;
  assignedTo: (title: string) => string;
  deadlineFor: (title: string) => string;
  remove: (title: string) => string;
  confirmRemove: (title: string) => string;
  removeNote: string;
  empty: string;
};

const DEFAULT_TEXTS: TaskChecklistTexts = {
  heading: "To-do",
  summary: (open) => `${open} to do.`,
  add: "Add",
  titlePlaceholder: "What needs doing?",
  deadline: "Deadline",
  unassigned: "Unassigned",
  youSuffix: " (you)",
  complete: (title) => `Complete ${title}`,
  reopen: (title) => `Reopen ${title}`,
  assignedTo: (title) => `Assigned to, ${title}`,
  deadlineFor: (title) => `Deadline for ${title}`,
  remove: (title) => `Remove ${title}`,
  confirmRemove: (title) => `Remove “${title}”?`,
  removeNote: "It is deleted for good.",
  empty: "Nothing yet. Add the first thing to do.",
};

export type TaskChecklistProps = {
  // The list endpoint (GET / PUT / DELETE), e.g. "/api/team/tasks".
  endpoint: string;
  // Usernames a task can be assigned to.
  people: string[];
  currentUser?: string;
  // Shown until the first load finishes.
  initialTasks?: Task[];
  // Colour of the dot in front of every task.
  dotColour?: string;
  texts?: Partial<TaskChecklistTexts>;
  className?: string;
};

export default function TaskChecklist({
  endpoint,
  people,
  currentUser = "",
  initialTasks = [],
  dotColour = "#d9758a",
  texts,
  className,
}: TaskChecklistProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const list = useSharedList<Task>(endpoint, initialTasks);
  const { ask, dialog } = useConfirm();
  const [adding, setAdding] = useState(false);
  const { refresh } = list;

  useEffect(() => {
    refresh();
  }, [refresh]);

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return;
    list.save(emptyTask({ title, due: String(data.get("due") ?? ""), assigned: String(data.get("assigned") ?? "") }));
    form.reset();
    setAdding(false);
  }

  // The person already assigned stays in the menu even when no longer in `people`.
  function peopleFor(task?: Task) {
    const names = [...people];
    if (task && task.assigned && !names.some((name) => sameUser(name, task.assigned))) names.push(task.assigned);
    return names;
  }

  function personLabel(person: string) {
    return currentUser && sameUser(person, currentUser) ? `${person}${t.youSuffix}` : person;
  }

  async function handleRemove(task: Task) {
    if (await ask(t.confirmRemove(task.title), { note: t.removeNote })) list.remove(task.id);
  }

  const openCount = list.items.filter((task) => !task.completed).length;

  return (
    <section className={className ? `${styles.panel} ${className}` : styles.panel}>
      {dialog}
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h3>{t.heading}</h3>
          <p>{t.summary(openCount)}</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setAdding(!adding)}>
          <Plus size={16} />
          {t.add}
        </button>
      </div>

      {adding ? (
        <form className={styles.inlineForm} onSubmit={addItem}>
          <input name="title" placeholder={t.titlePlaceholder} required autoFocus />
          <input name="due" type="date" aria-label={t.deadline} />
          <select name="assigned" defaultValue={currentUser}>
            <option value="">{t.unassigned}</option>
            {peopleFor().map((person) => (
              <option key={person} value={person}>
                {personLabel(person)}
              </option>
            ))}
          </select>
          <button className={styles.primaryButton} type="submit">
            {t.add}
          </button>
        </form>
      ) : null}
      {list.error ? <p className={styles.error}>{list.error}</p> : null}

      <div className={styles.list}>
        {sortTasks(list.items).map((task) => (
          <div className={task.completed ? `${styles.row} ${styles.rowSimple} ${styles.rowDone}` : `${styles.row} ${styles.rowSimple}`} key={task.id || task.title}>
            <button
              type="button"
              className={styles.check}
              aria-label={task.completed ? t.reopen(task.title) : t.complete(task.title)}
              onClick={() => list.save({ ...task, completed: !task.completed })}
            >
              {task.completed ? <Check size={13} strokeWidth={3} /> : null}
            </button>
            <span className={styles.dot} style={{ background: dotColour }} />
            <div className={styles.copy}>
              <strong>{task.title}</strong>
            </div>
            <select
              className={styles.assignee}
              aria-label={t.assignedTo(task.title)}
              value={task.assigned}
              onChange={(event) => list.save({ ...task, assigned: event.target.value })}
            >
              <option value="">{t.unassigned}</option>
              {peopleFor(task).map((person) => (
                <option key={person} value={person}>
                  {personLabel(person)}
                </option>
              ))}
            </select>
            <label className={styles.due} title={t.deadline}>
              <Clock size={14} />
              <input
                type="date"
                className={styles.dueInput}
                value={isIsoDate(task.due) ? task.due : ""}
                aria-label={t.deadlineFor(task.title)}
                onChange={(event) => list.save({ ...task, due: event.target.value })}
              />
            </label>
            <button type="button" className={styles.remove} aria-label={t.remove(task.title)} onClick={() => handleRemove(task)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {list.items.length === 0 ? <div className={styles.empty}>{t.empty}</div> : null}
      </div>
    </section>
  );
}
