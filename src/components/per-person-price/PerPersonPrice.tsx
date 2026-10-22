"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the "Estimated" cell
// of a budget item: a total typed in, or a price per guest that the panel
// multiplies by the number of guests.
// ============================================================================

import { useState } from "react";
import { perPersonTotal, round2 } from "./perPerson";
import styles from "./PerPersonPrice.module.css";

// Adapted from EstimateCell in angela-simon-wedding/components/panel/BudgetPanel.tsx.
//
// Controlled: it shows `total` and `perPerson` and reports changes through
// onChange; the caller saves them. The small link under the field switches
// between the two ways of pricing. A `perPerson` above 0 means "priced per
// person", and then `total` is that price times `guests`. Edit a value and
// leave the field to save it.

export type PerPersonPriceTexts = {
  totalLabel: (itemLabel: string) => string;
  perPersonLabel: (itemLabel: string) => string;
  totalPlaceholder: string;
  perPersonPlaceholder: string;
  switchToPerPerson: string;
  switchToPerPersonTitle: string;
  switchToTotal: string;
  switchToTotalTitle: string;
  calculation: (guests: number, total: string) => string;
  // Shown after switching to per person, before a price is typed.
  waitingForPrice: (total: string) => string;
};

const DEFAULT_TEXTS: PerPersonPriceTexts = {
  totalLabel: (itemLabel) => (itemLabel ? `Total for ${itemLabel}` : "Total"),
  perPersonLabel: (itemLabel) => (itemLabel ? `Price per person for ${itemLabel}` : "Price per person"),
  totalPlaceholder: "0",
  perPersonPlaceholder: "per guest",
  switchToPerPerson: "per person",
  switchToPerPersonTitle: "Price it per guest",
  switchToTotal: "enter total",
  switchToTotalTitle: "Type the total yourself",
  calculation: (guests, total) => `× ${guests} = ${total}`,
  waitingForPrice: (total) => `type a price (was ${total})`,
};

export type PerPersonPriceProps = {
  total: number;
  perPerson: number; // 0 = priced as a total
  guests: number;
  onChange: (change: { total: number; perPerson: number }) => void;
  // What is priced, for the fields' accessible names.
  itemLabel?: string;
  // How money is written, e.g. (value) => `€${value}`. Default: a rounded number.
  formatMoney?: (value: number) => string;
  texts?: Partial<PerPersonPriceTexts>;
  className?: string;
};

const defaultMoney = (value: number) => Math.round(value).toLocaleString("en-GB");

export default function PerPersonPrice({ total, perPerson, guests, onChange, itemLabel = "", formatMoney = defaultMoney, texts, className }: PerPersonPriceProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const pricedPerPerson = perPerson > 0;
  // Switched to per person, but no price typed yet (so nothing is saved yet).
  const [chosenPerPerson, setChosenPerPerson] = useState(false);
  const rootClass = className ? `${styles.cell} ${className}` : styles.cell;

  if (!pricedPerPerson && !chosenPerPerson) {
    return (
      <span className={rootClass}>
        <input
          // A new key when the saved value changes, so the field shows it.
          key={`total-${total}`}
          type="number"
          min="0"
          step="0.01"
          defaultValue={total || ""}
          placeholder={t.totalPlaceholder}
          aria-label={t.totalLabel(itemLabel)}
          onBlur={(event) => {
            const value = parseFloat(event.target.value) || 0;
            if (value !== total) onChange({ total: value, perPerson: 0 });
          }}
        />
        <button
          type="button"
          className={styles.switch}
          title={t.switchToPerPersonTitle}
          onClick={() => setChosenPerPerson(true)} // the total stays as it is until a price is typed
        >
          {t.switchToPerPerson}
        </button>
      </span>
    );
  }

  return (
    <span className={rootClass}>
      <input
        key={`per-person-${perPerson}`}
        type="number"
        min="0"
        step="0.01"
        defaultValue={perPerson || ""}
        placeholder={t.perPersonPlaceholder}
        aria-label={t.perPersonLabel(itemLabel)}
        onBlur={(event) => {
          const value = parseFloat(event.target.value) || 0;
          if (value === perPerson) return;
          if (value === 0) setChosenPerPerson(false); // an empty price: back to a plain total
          onChange({ perPerson: value, total: perPersonTotal(value, guests) });
        }}
      />
      <small className={styles.calculation}>
        {pricedPerPerson ? t.calculation(guests, formatMoney(round2(perPerson * guests))) : t.waitingForPrice(formatMoney(total))}
      </small>
      <button
        type="button"
        className={styles.switch}
        title={t.switchToTotalTitle}
        onClick={() => {
          setChosenPerPerson(false);
          onChange({ total, perPerson: 0 });
        }}
      >
        {t.switchToTotal}
      </button>
    </span>
  );
}
