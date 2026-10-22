"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the /login page of
// the planning panel (username, password, Login).
// ============================================================================

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import styles from "./LoginCard.module.css";

// Adapted from angela-simon-wedding/components/panel/LoginForm.tsx.
//
// Posts { username, password } as JSON to `endpoint` (see createAuth's
// handleLogin) and goes to `redirectTo` once the cookie is set. Accounts are
// made by an admin, so there is no sign-up here.

export type LoginFormTexts = {
  eyebrow: string;
  heading: string;
  intro: string;
  username: string;
  password: string;
  submit: string;
  submitting: string;
  failed: string;
};

const DEFAULT_TEXTS: LoginFormTexts = {
  eyebrow: "",
  heading: "Log in",
  intro: "Use the username and password you were given.",
  username: "Username",
  password: "Password",
  submit: "Log in",
  submitting: "Logging in…",
  failed: "Could not log in.",
};

export type LoginFormProps = {
  // Default "/api/auth/login".
  endpoint?: string;
  // Where to go after logging in. Default "/".
  redirectTo?: string;
  // How to go there. Default: a full page load (window.location.assign). In
  // Next.js, pass (path) => { router.replace(path); router.refresh(); } so the
  // server components see the new cookie without a full reload.
  navigate?: (path: string) => void;
  icon?: ReactNode;
  texts?: Partial<LoginFormTexts>;
  className?: string;
};

function defaultNavigate(path: string) {
  window.location.assign(path);
}

export default function LoginForm({
  endpoint = "/api/auth/login",
  redirectTo = "/",
  navigate = defaultNavigate,
  icon,
  texts,
  className,
}: LoginFormProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(data.get("username") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body && body.error ? body.error : t.failed);
      // The cookie is set by the response; the button stays disabled while
      // the next page loads.
      navigate(redirectTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.failed);
      setSubmitting(false);
    }
  }

  return (
    <div className={className ? `${styles.screen} ${className}` : styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {t.eyebrow ? <p className={styles.eyebrow}>{t.eyebrow}</p> : null}
        <h2 className={styles.heading}>{t.heading}</h2>
        {t.intro ? <p className={styles.intro}>{t.intro}</p> : null}

        <label className={styles.field}>
          {t.username}
          <input name="username" type="text" autoComplete="username" autoCapitalize="none" autoFocus required />
        </label>
        <label className={styles.field}>
          {t.password}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
