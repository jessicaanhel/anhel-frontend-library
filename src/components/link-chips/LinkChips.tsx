"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the "where to buy"
// links under each budget item: a few chips named after the shop, and a field
// to add another.
// ============================================================================

import { useState } from "react";
import { ArrowUpRight, X } from "../../icons";
import { addLink, hostOf } from "./links";
import styles from "./LinkChips.module.css";

// Adapted from WhereToBuy in angela-simon-wedding/components/panel/BudgetPanel.tsx.
//
// Controlled: shows `links` and reports the new list through onChange. Press
// Enter or leave the field to add what was typed ("www.shop.com" gets https://
// added). Text that is not a web address stays in the field, marked as
// invalid, so it can be fixed.

export type LinkChipsTexts = {
  placeholderFirst: string;
  placeholderMore: string;
  invalid: string;
  addLabel: (itemLabel: string) => string;
  removeLabel: (host: string) => string;
};

const DEFAULT_TEXTS: LinkChipsTexts = {
  placeholderFirst: "+ add a link",
  placeholderMore: "+ another link",
  invalid: "That is not a web address.",
  addLabel: (itemLabel) => (itemLabel ? `${itemLabel}: add a link` : "Add a link"),
  removeLabel: (host) => `Remove the link ${host}`,
};

export type LinkChipsProps = {
  links: string[];
  onChange: (links: string[]) => void;
  // The most links. The field disappears when it is reached. Default 8.
  max?: number;
  // What the links belong to, for the field's accessible name (e.g. the item's name).
  itemLabel?: string;
  texts?: Partial<LinkChipsTexts>;
  className?: string;
};

export default function LinkChips({ links, onChange, max = 8, itemLabel = "", texts, className }: LinkChipsProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [invalid, setInvalid] = useState(false);

  function add(input: HTMLInputElement) {
    const result = addLink(links, input.value, max);
    setInvalid(result.invalid);
    if (result.invalid) return; // the text stays in the field so it can be fixed
    if (result.added) onChange(result.links);
    input.value = "";
  }

  return (
    <span className={className ? `${styles.chips} ${className}` : styles.chips}>
      {links.map((link) => (
        <span className={styles.chip} key={link}>
          <a href={link} target="_blank" rel="noopener noreferrer" title={link}>
            {hostOf(link)} <ArrowUpRight size={10} />
          </a>
          <button type="button" aria-label={t.removeLabel(hostOf(link))} onClick={() => onChange(links.filter((other) => other !== link))}>
            <X size={10} />
          </button>
        </span>
      ))}
      {links.length < max && (
        <input
          className={styles.input}
          placeholder={links.length ? t.placeholderMore : t.placeholderFirst}
          aria-label={t.addLabel(itemLabel)}
          aria-invalid={invalid}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(event.currentTarget);
            }
          }}
          onBlur={(event) => add(event.target)}
        />
      )}
      {invalid && <small className={styles.error}>{t.invalid}</small>}
    </span>
  );
}
