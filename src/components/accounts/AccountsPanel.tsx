"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Accounts page of
// the planning panel: create a login for a helper, give it roles, issue a new
// password, remove it.
// ============================================================================

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Copy, Plus, RefreshCw, Trash } from "../../icons";
import type { PermissionModel } from "../../permissions";
import { useConfirm } from "../confirm-dialog";
import styles from "./Accounts.module.css";

// Adapted from angela-simon-wedding/components/panel/AccountsPanel.tsx.
//
// Talks to an accounts endpoint (see createAccountHandlers):
//   GET                       -> { users, count, max, grantable }
//   POST   { username?, roles }-> { username, password, users, count, ... }
//   PUT    { username, roles } -> { users, ... }
//   PATCH  { username }        -> { username, password }
//   DELETE { username }        -> { users, count, ... }
// A password is shown exactly once (when it is created or reset), because
// only a hash is kept. `grantable` says which roles THIS person may give, so
// someone with fewer rights sees only those role boxes; the server enforces it.

type Issued = { username: string; password: string };
type User<Role extends string> = { username: string; createdAt: string; roles: Role[] };

export type AccountsPanelTexts = {
  heading: string;
  summary: (count: number, max: number) => string;
  noAccounts: string;
  created: (date: string) => string;
  newPassword: (username: string) => string;
  removeAccount: (username: string) => string;
  newLoginHeading: string;
  newLoginHint: string;
  usernamePlaceholder: string;
  generate: string;
  limitReached: string;
  issuedHeading: string;
  usernameLabel: string;
  passwordLabel: string;
  copyBoth: string;
  // The text copied by "Copy both".
  copiedText: (username: string, password: string) => string;
  confirmRemove: (username: string) => string;
  confirmRemoveYes: string;
  confirmRemoveNote: string;
  loadFailed: string;
  failed: string;
};

const DEFAULT_TEXTS: AccountsPanelTexts = {
  heading: "Accounts",
  summary: (count, max) => `${count} of ${max} created. Each person has their own login and history.`,
  noAccounts: "No accounts yet.",
  created: (date) => `Created ${date}`,
  newPassword: (username) => `New password for ${username}`,
  removeAccount: (username) => `Remove ${username}`,
  newLoginHeading: "New login",
  newLoginHint: "Leave the username empty to generate one, and pick the roles.",
  usernamePlaceholder: "Username (optional)",
  generate: "Generate login",
  limitReached: "Limit reached",
  issuedHeading: "SHARE THIS NOW — IT IS SHOWN ONCE",
  usernameLabel: "Username",
  passwordLabel: "Password",
  copyBoth: "Copy both",
  copiedText: (username, password) => `Username: ${username}\nPassword: ${password}`,
  confirmRemove: (username) => `Remove the account “${username}”?`,
  confirmRemoveYes: "Yes, remove the account",
  confirmRemoveNote: "They will no longer be able to log in.",
  loadFailed: "Could not load the accounts.",
  failed: "Something went wrong.",
};

export type AccountsPanelProps<Role extends string> = {
  // The roles that can be given (its assignable roles, see createPermissionModel).
  model: PermissionModel<Role>;
  // Default "/api/accounts".
  endpoint?: string;
  // Shown at the top right of the list card, e.g. a small icon.
  icon?: ReactNode;
  // For the creation date. Default "en-GB".
  locale?: string;
  texts?: Partial<AccountsPanelTexts>;
  className?: string;
};

export default function AccountsPanel<Role extends string>({ model, endpoint = "/api/accounts", icon, locale = "en-GB", texts, className }: AccountsPanelProps<Role>) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [users, setUsers] = useState<User<Role>[]>([]);
  const [max, setMax] = useState(5);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState("");
  const [grantable, setGrantable] = useState<Role[]>(model.assignableRoles.map((role) => role.key));
  const [newRoles, setNewRoles] = useState<Role[]>([]);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();

  // The role boxes: the roles that can be given, limited to what this person may give.
  const roleChoices = model.assignableRoles.filter((role) => grantable.includes(role.key));

  useEffect(() => {
    fetch(endpoint)
      .then((response) => response.json())
      .then((body) => {
        setUsers(body.users ?? []);
        setMax(body.max ?? 5);
        setCount(body.count ?? 0);
        if (Array.isArray(body.grantable)) {
          setGrantable(body.grantable);
          // When only one role can be given, it is already chosen.
          if (body.grantable.length === 1) setNewRoles(body.grantable);
        }
      })
      .catch(() => setError(t.loadFailed))
      .finally(() => setLoaded(true));
    // Loaded once per endpoint; the texts are only used for a failure message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function call(method: "POST" | "PUT" | "PATCH" | "DELETE", payload: Record<string, string | string[]>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || t.failed);
      return body;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.failed);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const body = await call("POST", { username: username.trim(), roles: newRoles });
    if (!body) return;
    setUsers(body.users);
    setCount(body.count);
    setIssued({ username: body.username, password: body.password });
    setUsername("");
    if (grantable.length !== 1) setNewRoles([]);
  }

  async function reset(name: string) {
    const body = await call("PATCH", { username: name });
    if (body) setIssued({ username: body.username, password: body.password });
  }

  async function setRoles(name: string, roles: Role[]) {
    const body = await call("PUT", { username: name, roles });
    if (body) setUsers(body.users);
  }

  async function remove(name: string) {
    if (!(await ask(t.confirmRemove(name), { confirmLabel: t.confirmRemoveYes, note: t.confirmRemoveNote }))) return;
    const body = await call("DELETE", { username: name });
    if (body) {
      setUsers(body.users);
      setCount(body.count);
      if (issued?.username === name) setIssued(null);
    }
  }

  const full = count >= max;

  return (
    <section className={className ? `${styles.accounts} ${className}` : styles.accounts}>
      {dialog}
      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.heading}>
            <div className={styles.headingText}>
              <h3>{t.heading}</h3>
              <p>{t.summary(count, max)}</p>
            </div>
            {icon ? <span className={styles.icon}>{icon}</span> : null}
          </div>

          <div className={styles.accountList}>
            {users.map((user) => (
              <div className={styles.accountRow} key={user.username}>
                <div className={styles.accountCopy}>
                  <strong>{user.username}</strong>
                  <span>{t.created(new Date(user.createdAt).toLocaleDateString(locale))}</span>
                  <span className={styles.rolePicks}>
                    {roleChoices.map((role) => {
                      const has = user.roles.includes(role.key);
                      return (
                        <label className={`${styles.rolePick} ${has ? styles.on : ""}`} key={role.key}>
                          <input
                            type="checkbox"
                            checked={has}
                            disabled={busy}
                            onChange={() => setRoles(user.username, has ? user.roles.filter((item) => item !== role.key) : [...user.roles, role.key])}
                          />
                          {role.label}
                        </label>
                      );
                    })}
                  </span>
                </div>
                <button type="button" className={styles.iconButton} title={t.newPassword(user.username)} aria-label={t.newPassword(user.username)} disabled={busy} onClick={() => reset(user.username)}>
                  <RefreshCw size={15} />
                </button>
                <button type="button" className={styles.iconButton} title={t.removeAccount(user.username)} aria-label={t.removeAccount(user.username)} disabled={busy} onClick={() => remove(user.username)}>
                  <Trash size={15} />
                </button>
              </div>
            ))}
            {loaded && users.length === 0 && <div className={styles.empty}>{t.noAccounts}</div>}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.heading}>
            <div className={styles.headingText}>
              <h3>{t.newLoginHeading}</h3>
              <p>{t.newLoginHint}</p>
            </div>
          </div>

          <form className={styles.accountForm} onSubmit={create}>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.usernamePlaceholder} autoCapitalize="none" disabled={full} />
            <span className={styles.rolePicks}>
              {roleChoices.map((role) => {
                const has = newRoles.includes(role.key);
                return (
                  <label className={`${styles.rolePick} ${has ? styles.on : ""}`} key={role.key}>
                    <input type="checkbox" checked={has} disabled={full} onChange={() => setNewRoles(has ? newRoles.filter((item) => item !== role.key) : [...newRoles, role.key])} />
                    {role.label}
                  </label>
                );
              })}
            </span>
            <button className={styles.primaryButton} type="submit" disabled={busy || full}>
              <Plus size={16} />
              {full ? t.limitReached : t.generate}
            </button>
          </form>

          {error && <p className={styles.error}>{error}</p>}

          {issued && (
            <div className={styles.issued}>
              <p className={styles.issuedHeading}>{t.issuedHeading}</p>
              <p>
                {t.usernameLabel}: <strong>{issued.username}</strong>
              </p>
              <p>
                {t.passwordLabel}: <strong>{issued.password}</strong>
              </p>
              <button type="button" className={styles.textButton} onClick={() => navigator.clipboard?.writeText(t.copiedText(issued.username, issued.password))}>
                <Copy size={14} /> {t.copyBoth}
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
