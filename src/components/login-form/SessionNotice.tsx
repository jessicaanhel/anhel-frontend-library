"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the two full-page
// cards of the planning panel that always offer a way out: "Signed in as ..."
// on /login, and "The panel can't load" when its data can't be read.
// ============================================================================

import type { ReactNode } from "react";
import styles from "./LoginCard.module.css";

// Adapted from angela-simon-wedding/components/panel/SessionNotice.tsx.
//
// Both cards have a Log out button, so a person is never stuck on a page that
// redirects or fails:
//   - without `problem`: already signed in (show it on the login page instead
//     of redirecting; if the app can't load, a redirect would trap the person);
//   - with `problem`: the app couldn't load; "Try again" and "Log out".

export type SessionNoticeTexts = {
  eyebrow: string;
  signedIn: (username: string) => string;
  alreadySignedIn: string;
  problemHeading: string;
  open: string;
  retry: string;
  logOut: string;
};

const DEFAULT_TEXTS: SessionNoticeTexts = {
  eyebrow: "",
  signedIn: (username) => `Signed in as ${username}`,
  alreadySignedIn: "You are already logged in on this device.",
  problemHeading: "This page can't load",
  open: "Continue",
  retry: "Try again",
  logOut: "Log out",
};

export type SessionNoticeProps = {
  username: string;
  // Set: the app couldn't load (shown as the message). Unset: just signed in.
  problem?: string;
  // Where "Continue" leads. Default "/".
  continueHref?: string;
  // Default "/api/auth/logout" (see createAuth's handleLogout).
  logoutEndpoint?: string;
  // Where to go after logging out. Default "/login".
  loginPath?: string;
  // How to go there. Default: a full page load (window.location.assign).
  navigate?: (path: string) => void;
  // "Try again". Default: reload the page. In Next.js: () => router.refresh().
  onRetry?: () => void;
  icon?: ReactNode;
  texts?: Partial<SessionNoticeTexts>;
  className?: string;
};

function defaultNavigate(path: string) {
  window.location.assign(path);
}

function defaultRetry() {
  window.location.reload();
}

export default function SessionNotice({
  username,
  problem,
  continueHref = "/",
  logoutEndpoint = "/api/auth/logout",
  loginPath = "/login",
  navigate = defaultNavigate,
  onRetry = defaultRetry,
  icon,
  texts,
  className,
}: SessionNoticeProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };

  async function logOut() {
    try {
      await fetch(logoutEndpoint, { method: "POST" });
    } finally {
      // Even when the request fails, the login page is the way forward.
      navigate(loginPath);
    }
  }

  return (
    <div className={className ? `${styles.screen} ${className}` : styles.screen}>
      <div className={styles.card}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {t.eyebrow ? <p className={styles.eyebrow}>{t.eyebrow}</p> : null}
        <h2 className={styles.heading}>{problem ? t.problemHeading : t.signedIn(username)}</h2>
        {problem ? <p className={styles.error}>{problem}</p> : <p className={styles.intro}>{t.alreadySignedIn}</p>}

        <div className={styles.actions}>
          {problem ? (
            <button type="button" className={styles.submit} onClick={onRetry}>
              {t.retry}
            </button>
          ) : (
            <a className={styles.submit} href={continueHref}>
              {t.open}
            </a>
          )}
          <button type="button" className={`${styles.submit} ${styles.secondary}`} onClick={logOut}>
            {t.logOut}
          </button>
        </div>
      </div>
    </div>
  );
}
