"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, Plus, Trash, X } from "../../icons";
import { useConfirm } from "../confirm-dialog";
import { emptyQuizQuestion, type QuizQuestion } from "./quizQuestions";
import styles from "./Quiz.module.css";

// The questions of a quiz, for the person who writes it: add, change, move
// and remove questions, a typed or a multiple-choice answer, and the expected
// answer (optional). Controlled and without network, like NoteEditor: it
// shows `value` and reports every change with `onChange`; the page saves.

export type QuizEditorTexts = {
  empty: string;
  questionLabel: (number: number) => string;
  promptPlaceholder: string;
  kind: string;
  kindText: string;
  kindChoice: string;
  options: string;
  optionPlaceholder: (number: number) => string;
  addOption: string;
  removeOption: string;
  expected: string;
  expectedPlaceholder: string;
  noExpected: string;
  moveUp: string;
  moveDown: string;
  removeQuestion: string;
  addQuestion: string;
  confirmRemove: string;
  confirmRemoveYes: string;
};

const DEFAULT_TEXTS: QuizEditorTexts = {
  empty: "No questions yet. Add the first one.",
  questionLabel: (number) => `Question ${number}`,
  promptPlaceholder: "The question",
  kind: "Answer",
  kindText: "Typed",
  kindChoice: "One of several options",
  options: "Options",
  optionPlaceholder: (number) => `Option ${number}`,
  addOption: "Add an option",
  removeOption: "Remove this option",
  expected: "Expected answer (optional)",
  expectedPlaceholder: "Leave empty for an open question",
  noExpected: "None (open question)",
  moveUp: "Move up",
  moveDown: "Move down",
  removeQuestion: "Remove the question",
  addQuestion: "Add a question",
  confirmRemove: "Remove this question?",
  confirmRemoveYes: "Yes, remove",
};

export type QuizEditorProps = {
  value: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  texts?: Partial<QuizEditorTexts>;
  className?: string;
};

export default function QuizEditor({ value, onChange, texts, className }: QuizEditorProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const { ask, dialog } = useConfirm();
  // The newest list, for the removal that waits for "are you sure?".
  const latest = useRef(value);
  latest.current = value;

  function update(index: number, next: QuizQuestion) {
    onChange(value.map((question, position) => (position === index ? next : question)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  async function remove(question: QuizQuestion) {
    // An untouched question goes without asking.
    const untouched = !question.prompt.trim() && !(question.options ?? []).some((option) => option.trim());
    if (!untouched && !(await ask(t.confirmRemove, { confirmLabel: t.confirmRemoveYes }))) return;
    // By id and from the newest list: it may have changed while the question was open.
    onChange(latest.current.filter((candidate) => candidate.id !== question.id));
  }

  // Switching to choice starts with two empty options; switching to typed
  // drops the options, and an expected answer that was an option stays as text.
  function changeKind(index: number, question: QuizQuestion, kind: QuizQuestion["kind"]) {
    if (kind === question.kind) return;
    if (kind === "choice") {
      update(index, { ...question, kind, options: question.options?.length ? question.options : ["", ""], answer: "" });
    } else {
      const { options: _dropped, ...rest } = question;
      update(index, { ...rest, kind });
    }
  }

  // Renaming the option that is the expected answer renames the answer too,
  // so it does not silently stop matching.
  function changeOption(index: number, question: QuizQuestion, optionIndex: number, text: string) {
    const options = [...(question.options ?? [])];
    const before = options[optionIndex];
    options[optionIndex] = text;
    const answer = question.answer && question.answer === before ? text : question.answer;
    update(index, { ...question, options, answer });
  }

  function removeOption(index: number, question: QuizQuestion, optionIndex: number) {
    const options = (question.options ?? []).filter((_, position) => position !== optionIndex);
    const removed = (question.options ?? [])[optionIndex];
    update(index, { ...question, options, answer: question.answer === removed ? "" : question.answer });
  }

  return (
    <div className={className ? `${styles.editor} ${className}` : styles.editor}>
      {dialog}
      {value.length === 0 && <p className={styles.empty}>{t.empty}</p>}

      <ol className={styles.questions}>
        {value.map((question, index) => {
          const options = question.options ?? [];
          // The options that can be the expected answer: filled in, and each once.
          const answerChoices = Array.from(new Set(options.filter((option) => option.trim() !== "")));
          return (
            <li className={styles.editQuestion} key={question.id}>
              <div className={styles.editHeading}>
                <strong>{t.questionLabel(index + 1)}</strong>
                <div className={styles.editControls}>
                  <button type="button" aria-label={t.moveUp} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={t.moveDown} disabled={index === value.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" aria-label={t.removeQuestion} onClick={() => remove(question)}>
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              <textarea
                className={styles.field}
                aria-label={t.questionLabel(index + 1)}
                value={question.prompt}
                placeholder={t.promptPlaceholder}
                rows={2}
                onChange={(event) => update(index, { ...question, prompt: event.target.value })}
              />

              <label className={styles.fieldLabel}>
                {t.kind}
                <select className={styles.field} value={question.kind} onChange={(event) => changeKind(index, question, event.target.value as QuizQuestion["kind"])}>
                  <option value="text">{t.kindText}</option>
                  <option value="choice">{t.kindChoice}</option>
                </select>
              </label>

              {question.kind === "choice" && (
                <fieldset className={styles.optionList}>
                  <legend>{t.options}</legend>
                  {options.map((option, optionIndex) => (
                    // Options can repeat while being typed, so the position is the key.
                    <div className={styles.optionRow} key={optionIndex}>
                      <input
                        className={styles.field}
                        value={option}
                        placeholder={t.optionPlaceholder(optionIndex + 1)}
                        aria-label={t.optionPlaceholder(optionIndex + 1)}
                        onChange={(event) => changeOption(index, question, optionIndex, event.target.value)}
                      />
                      <button type="button" className={styles.iconButton} aria-label={t.removeOption} onClick={() => removeOption(index, question, optionIndex)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.textButton} onClick={() => update(index, { ...question, options: [...options, ""] })}>
                    <Plus size={14} /> {t.addOption}
                  </button>
                </fieldset>
              )}

              <label className={styles.fieldLabel}>
                {t.expected}
                {question.kind === "choice" ? (
                  <select className={styles.field} value={question.answer ?? ""} onChange={(event) => update(index, { ...question, answer: event.target.value })}>
                    <option value="">{t.noExpected}</option>
                    {answerChoices.map((option) => (
                      <option value={option} key={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={styles.field}
                    value={question.answer ?? ""}
                    placeholder={t.expectedPlaceholder}
                    onChange={(event) => update(index, { ...question, answer: event.target.value })}
                  />
                )}
              </label>
            </li>
          );
        })}
      </ol>

      <button type="button" className={styles.primaryButton} onClick={() => onChange([...value, emptyQuizQuestion()])}>
        <Plus size={16} /> {t.addQuestion}
      </button>
    </div>
  );
}
