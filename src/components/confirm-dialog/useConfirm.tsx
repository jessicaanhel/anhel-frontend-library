"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the "Are you sure?"
// dialog of the planning panel, shown before a task, board or other item is
// removed.
// ============================================================================

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "../../icons";
import styles from "./ConfirmDialog.module.css";

// Adapted from angela-simon-wedding/components/panel/useConfirm.tsx.
//
// An in-page confirmation dialog, used instead of window.confirm (which some
// browsers block and which looks out of place):
//   const { ask, dialog } = useConfirm();
//   if (await ask("Remove “Photographer”?")) ...   // and render {dialog} once

export type ConfirmTexts = {
  eyebrow: string;
  cancel: string;
  confirm: string;
  close: string;
};

export type ConfirmOptions = {
  // Label of the confirming button, e.g. "Yes, remove".
  confirmLabel?: string;
  // A short line under the question, e.g. where removed items go.
  note?: string;
};

const DEFAULT_TEXTS: ConfirmTexts = {
  eyebrow: "ARE YOU SURE?",
  cancel: "Cancel",
  confirm: "Yes, remove",
  close: "Close",
};

type Pending = { message: string; confirmLabel: string; note: string };

export function useConfirm(texts?: Partial<ConfirmTexts>) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [pending, setPending] = useState<Pending | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  function ask(message: string, options: ConfirmOptions = {}) {
    // A second question while one is open answers the first with "no", so its
    // promise never hangs.
    resolver.current?.(false);
    setPending({ message, confirmLabel: options.confirmLabel ?? t.confirm, note: options.note ?? "" });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }

  function answer(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setPending(null);
  }

  let dialog: ReactNode = null;
  if (pending) {
    dialog = (
      <div className={styles.backdrop} onMouseDown={() => answer(false)}>
        <div
          className={styles.card}
          role="alertdialog"
          aria-modal="true"
          aria-label={pending.message}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" className={styles.close} onClick={() => answer(false)} aria-label={t.close}>
            <X size={19} />
          </button>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h2 className={styles.question}>{pending.message}</h2>
          {pending.note ? <p className={styles.note}>{pending.note}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={() => answer(false)}>
              {t.cancel}
            </button>
            <button type="button" className={styles.confirm} onClick={() => answer(true)} autoFocus>
              {pending.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { ask, dialog };
}
