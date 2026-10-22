"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, X } from "../../icons";
import { choiceOptions, scoreQuiz, type QuizAnswers, type QuizQuestion, type QuizScore } from "./quizQuestions";
import styles from "./Quiz.module.css";

// A quiz to fill in: a numbered list of questions, each answered by typing
// or by picking one option, and one button that hands the answers to
// `onSubmit`. The component does not save anything itself.
//
// With `showResult`, a successful submit marks every question that has an
// expected answer as right or not (no case, extra spaces ignored, see
// scoreQuiz) and shows the score. Changing an answer afterwards takes the
// marks away again, so they always belong to what was sent.

export type QuizTexts = {
  submit: string;
  submitting: string;
  saved: string;
  submitFailed: string;
  textPlaceholder: string;
  empty: string;
  right: string;
  wrong: string;
  score: (correct: number, total: number) => string;
};

const DEFAULT_TEXTS: QuizTexts = {
  submit: "Send answers",
  submitting: "Sending…",
  saved: "Your answers are saved.",
  submitFailed: "Could not send the answers. Try again.",
  textPlaceholder: "Your answer",
  empty: "There are no questions yet.",
  right: "Right",
  wrong: "Not quite",
  score: (correct, total) => `${correct} of ${total} right`,
};

export type QuizProps = {
  questions: QuizQuestion[];
  // Answers given before (e.g. loaded from the server), by question id.
  initialAnswers?: QuizAnswers;
  // Gets every answer by question id (an unanswered question is ""). Throw an
  // Error (or reject) to show its message instead of "saved".
  onSubmit: (answers: QuizAnswers) => Promise<void> | void;
  // Mark the answers right or wrong after a submit. Default false.
  showResult?: boolean;
  texts?: Partial<QuizTexts>;
  className?: string;
};

export default function Quiz({ questions, initialAnswers = {}, onSubmit, showResult = false, texts, className }: QuizProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  // Prefix of the element ids and radio group names, so two quizzes on one
  // page (or question ids with spaces) never clash.
  const formId = useId();
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  // The score of the last successful submit; null while there is none to show.
  const [score, setScore] = useState<QuizScore | null>(null);

  function answer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setScore(null);
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    // Every question gets an entry, so the receiver can tell "not answered" apart from "not asked".
    const sent: QuizAnswers = {};
    for (const question of questions) sent[question.id] = (answers[question.id] ?? "").trim();
    setSending(true);
    setMessage(null);
    try {
      await onSubmit(sent);
      setMessage({ text: t.saved, failed: false });
      setScore(showResult ? scoreQuiz(questions, sent) : null);
    } catch (caught) {
      setMessage({ text: caught instanceof Error && caught.message ? caught.message : t.submitFailed, failed: true });
    } finally {
      setSending(false);
    }
  }

  if (questions.length === 0) return <p className={styles.empty}>{t.empty}</p>;

  return (
    <form className={className ? `${styles.quiz} ${className}` : styles.quiz} onSubmit={submit}>
      <ol className={styles.questions}>
        {questions.map((question, index) => {
          const result = score ? score.results[question.id] : null;
          const promptId = `${formId}-prompt-${index}`;
          return (
            <li className={`${styles.question} ${result === true ? styles.right : ""} ${result === false ? styles.wrong : ""}`} key={question.id}>
              <p className={styles.prompt} id={promptId}>
                {question.prompt}
              </p>

              {question.kind === "choice" ? (
                <div className={styles.options} role="radiogroup" aria-labelledby={promptId}>
                  {choiceOptions(question).map((option, optionIndex) => (
                    // By position: two options may have the same text.
                    <label className={styles.option} key={optionIndex}>
                      <input
                        type="radio"
                        name={`${formId}-answer-${index}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() => answer(question.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className={styles.textAnswer}
                  aria-labelledby={promptId}
                  value={answers[question.id] ?? ""}
                  placeholder={t.textPlaceholder}
                  rows={2}
                  maxLength={2000}
                  onChange={(event) => answer(question.id, event.target.value)}
                />
              )}

              {result !== null && (
                <p className={styles.result}>
                  {result ? <Check size={14} /> : <X size={14} />} {result ? t.right : t.wrong}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.footer}>
        <button type="submit" className={styles.primaryButton} disabled={sending}>
          {sending ? t.submitting : t.submit}
        </button>
        {score && score.total > 0 && <strong className={styles.score}>{t.score(score.correct, score.total)}</strong>}
        <span className={message?.failed ? styles.error : styles.note} role="status">
          {message?.text ?? ""}
        </span>
      </div>
    </form>
  );
}
