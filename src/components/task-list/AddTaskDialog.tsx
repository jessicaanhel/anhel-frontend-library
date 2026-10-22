"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the "Add a planning
// task" pop-up of the planning panel (name, deadline, important, assignee).
// ============================================================================

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { X } from "../../icons";
import { emptyTask, sameUser, type Task } from "./task";
import styles from "./TaskList.module.css";

// Adapted from the add-task modal in angela-simon-wedding/components/panel/PanelApp.tsx.

export type AddTaskTexts = {
  eyebrow: string;
  heading: string;
  intro: string;
  title: string;
  titlePlaceholder: string;
  deadline: string;
  important: string;
  assignedTo: string;
  unassigned: string;
  youSuffix: string;
  submit: string;
  close: string;
};

const DEFAULT_TEXTS: AddTaskTexts = {
  eyebrow: "NEW TASK",
  heading: "Add a task",
  intro: "",
  title: "Task name",
  titlePlaceholder: "e.g. Call the venue",
  deadline: "Deadline",
  important: "Important",
  assignedTo: "Assigned to",
  unassigned: "Unassigned",
  youSuffix: " (you)",
  submit: "Add to the list",
  close: "Close",
};

export type AddTaskDialogProps = {
  open: boolean;
  onClose: () => void;
  // Gets a new task with id "" (the server gives it an id), e.g. useSharedList's save.
  onAdd: (task: Task) => void;
  people: string[];
  // Pre-selected as the assignee. Default: unassigned.
  currentUser?: string;
  defaultCategory?: string;
  icon?: ReactNode;
  texts?: Partial<AddTaskTexts>;
};

export default function AddTaskDialog({
  open,
  onClose,
  onAdd,
  people,
  currentUser = "",
  defaultCategory = "",
  icon,
  texts,
}: AddTaskDialogProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [important, setImportant] = useState(false);
  const [assigned, setAssigned] = useState(currentUser);

  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(emptyTask({ title: trimmed, category: defaultCategory, due, assigned, important }));
    // The assignee is kept for the next task; the rest starts empty again.
    setTitle("");
    setDue("");
    setImportant(false);
    onClose();
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <form className={styles.dialog} onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={styles.dialogClose} onClick={onClose} aria-label={t.close}>
          <X size={19} />
        </button>
        {icon ? <span className={styles.dialogIcon}>{icon}</span> : null}
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h2 className={styles.dialogHeading}>{t.heading}</h2>
        {t.intro ? <p className={styles.dialogIntro}>{t.intro}</p> : null}
        <label className={styles.field}>
          {t.title}
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
        </label>
        <label className={styles.field}>
          {t.deadline}
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </label>
        <label className={styles.checkField}>
          <input type="checkbox" checked={important} onChange={(event) => setImportant(event.target.checked)} /> {t.important}
        </label>
        <label className={styles.field}>
          {t.assignedTo}
          <select value={assigned} onChange={(event) => setAssigned(event.target.value)}>
            <option value="">{t.unassigned}</option>
            {people.map((person) => (
              <option key={person} value={person}>
                {currentUser && sameUser(person, currentUser) ? `${person}${t.youSuffix}` : person}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.submit} type="submit">
          {t.submit}
        </button>
      </form>
    </div>
  );
}
