// The quiz questions and their scoring. Pure: no React and no Node imports,
// so the page (to show the result) and the server (to keep a score) agree.

export type QuizQuestion = {
  id: string;
  prompt: string;
  // "text": the person types an answer; "choice": they pick one of `options`.
  kind: "text" | "choice";
  options?: string[];
  // The expected answer. Leave it out (or empty) for an open question that
  // has no right answer, e.g. "What did you take from this lesson?".
  answer?: string;
};

// Answers by question id.
export type QuizAnswers = Record<string, string>;

export type QuizScore = {
  // Questions answered as expected.
  correct: number;
  // Questions that have an expected answer; open questions are not counted.
  total: number;
  // Per question: true or false, or null for an open question.
  results: Record<string, boolean | null>;
};

// An answer made comparable: no case, no spaces at the ends, and any run of
// spaces, tabs or line breaks inside counted as one space. NFC so that a
// letter typed as one character or as a letter plus an accent compares equal.
export function normaliseAnswer(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

// Whether a question has an expected answer to check against.
export function hasExpectedAnswer(question: QuizQuestion) {
  return typeof question.answer === "string" && question.answer.trim() !== "";
}

// true or false for a question with an expected answer, null for an open one.
export function isAnswerCorrect(question: QuizQuestion, given: string | undefined): boolean | null {
  if (!hasExpectedAnswer(question)) return null;
  return normaliseAnswer(given ?? "") === normaliseAnswer(question.answer as string);
}

export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswers): QuizScore {
  const results: Record<string, boolean | null> = {};
  let correct = 0;
  let total = 0;
  for (const question of questions) {
    const result = isAnswerCorrect(question, answers[question.id]);
    results[question.id] = result;
    if (result === null) continue;
    total += 1;
    if (result) correct += 1;
  }
  return { correct, total, results };
}

// The options worth showing: without empty ones (a half-filled editor row).
export function choiceOptions(question: QuizQuestion) {
  return (question.options ?? []).filter((option) => option.trim() !== "");
}

// A new, empty question for the editor.
export function emptyQuizQuestion(kind: QuizQuestion["kind"] = "text"): QuizQuestion {
  const id = Math.random().toString(36).slice(2, 10);
  return kind === "choice" ? { id, prompt: "", kind, options: ["", ""], answer: "" } : { id, prompt: "", kind, answer: "" };
}
