"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the "Wedding favors"
// page of the planning panel: a wishlist of presents for each group of people
// (guests, bridesmaids, groomsmen, family, the groom).
// ============================================================================

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowUpRight, ImageIcon, LinkIcon, Pencil, Plus, Trash } from "../../icons";
import { useConfirm } from "../confirm-dialog";
import { asWebAddress, hostOf } from "../link-chips";
import {
  WISHLIST_LIMITS,
  emptyWishlistItem,
  fillFromPreview,
  itemsOfCategory,
  prepareWishlistItem,
  type WishlistCategory,
  type WishlistItem,
  type WishlistPreview,
} from "./wishlistItems";
import styles from "./Wishlist.module.css";

// Adapted from angela-simon-wedding/components/panel/FavorsPanel.tsx.
//
// Controlled: shows `items` and reports changes through onSave / onRemove
// (e.g. useSharedList's save and remove). The items are grouped in
// `categories`, one tab each; pass only the categories this person may see,
// and items of any other category are not shown. A new item is sent with
// id "" and the category it was added under; the category of an item can be
// changed when it is edited.
//
// Pasting a link fills in the fields that are still empty from
// `fetchPreview(url)` (the title, description, picture and price of the
// page), so the component needs no server of its own: the app decides which
// endpoint reads the page. Without `fetchPreview` nothing is read, and every
// field is typed by hand. Everything can always be typed or changed by hand.

export type WishlistTexts = {
  heading: string;
  description: string;
  tabsLabel: string;
  add: string;
  linkLabel: string;
  linkPlaceholder: string;
  reading: string;
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  priceLabel: string;
  pricePlaceholder: string;
  categoryLabel: string;
  pictureLabel: string;
  picturePlaceholder: string;
  pictureAlt: string;
  noPrice: string;
  readFailed: string;
  linkInvalid: string;
  pictureInvalid: string;
  submitNew: string;
  submitChanges: string;
  cancel: string;
  edit: (title: string) => string;
  remove: (title: string) => string;
  confirmRemove: (title: string) => string;
  removeConfirm: string;
  removeNote: string;
  empty: string;
  noCategories: string;
};

const DEFAULT_TEXTS: WishlistTexts = {
  heading: "Wishlist",
  description: "One list for each group.",
  tabsLabel: "Lists",
  add: "Add an item",
  linkLabel: "Link",
  linkPlaceholder: "https://… (paste it here)",
  reading: "Reading the page…",
  titleLabel: "Title",
  titlePlaceholder: "What is it?",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Colour, size, notes…",
  priceLabel: "Price",
  pricePlaceholder: "24.90",
  categoryLabel: "List",
  pictureLabel: "Picture address",
  picturePlaceholder: "https://… .jpg",
  pictureAlt: "Preview of the picture",
  noPrice: "The page did not show a price. Type it in if you want it here.",
  readFailed: "Could not read that page. Fill in the details by hand.",
  linkInvalid: "The link is not a web address.",
  pictureInvalid: "The picture address is not a web address.",
  submitNew: "Add to the list",
  submitChanges: "Save changes",
  cancel: "Cancel",
  edit: (title) => `Edit ${title}`,
  remove: (title) => `Remove ${title}`,
  confirmRemove: (title) => `Remove “${title}”?`,
  removeConfirm: "Yes, remove",
  removeNote: "",
  empty: "Nothing on this list yet. Add the first item.",
  noCategories: "No lists are available to you.",
};

export type WishlistProps = {
  // The lists this person may see (key and label), in tab order.
  categories: WishlistCategory[];
  items: WishlistItem[];
  // Gets a new item with id "" or a changed one.
  onSave: (item: WishlistItem) => void;
  onRemove: (id: string) => void;
  // Reads the page behind a pasted link. Throw an Error to show its message
  // (the form then stays usable by hand). Leave out for no "paste a link" help.
  fetchPreview?: (url: string) => Promise<WishlistPreview>;
  error?: string;
  // Shown at the right of the heading.
  icon?: ReactNode;
  texts?: Partial<WishlistTexts>;
  className?: string;
};

// A picture from the web. It is replaced by `fallback` (nothing, by default)
// when it cannot be loaded. Give it a `key` of its address, so a new address
// is tried again.
function Picture({ src, alt, className, fallback = null }: { src: string; alt: string; className: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // Plain <img>: the pictures come from any web address, so an image optimiser would need every domain listed.
    // The referrer is not sent, because some shops refuse pictures that are shown on other sites.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

export default function Wishlist({ categories, items, onSave, onRemove, fetchPreview, error, icon, texts, className }: WishlistProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [activeChoice, setActiveChoice] = useState("");
  const [draft, setDraft] = useState<WishlistItem | null>(null); // the item being added or changed
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState(""); // a hint, for example "no price on that page"
  const [problem, setProblem] = useState(""); // something that needs fixing
  const { ask, dialog } = useConfirm({ confirm: t.removeConfirm });
  // Which pasted link is being or was read, so the same link is not read twice, and which
  // read is the latest (an older answer that arrives late is ignored).
  const lastReadLink = useRef("");
  const readCount = useRef(0);

  // The chosen tab, or the first one when it is gone (the categories can change).
  const active = categories.some((category) => category.key === activeChoice) ? activeChoice : categories[0]?.key ?? "";
  const shown = itemsOfCategory(items, active);

  function change(next: Partial<WishlistItem>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  function closeForm() {
    readCount.current += 1; // an answer that is still on its way is no longer wanted
    lastReadLink.current = "";
    setReading(false);
    setDraft(null);
    setNote("");
    setProblem("");
  }

  function openForm(item: WishlistItem) {
    closeForm();
    setDraft(item);
  }

  // Reads the pasted link and fills in what the page tells (only the empty fields, so nothing typed is lost).
  async function readLink(value: string) {
    const link = asWebAddress(value);
    if (!fetchPreview || !link) return;
    change({ link });
    if (link === lastReadLink.current) return;
    lastReadLink.current = link;
    const thisRead = (readCount.current += 1);
    setReading(true);
    setNote("");
    setProblem("");
    try {
      const preview = await fetchPreview(link);
      if (thisRead !== readCount.current) return;
      setDraft((current) => (current && current.link === link ? fillFromPreview(current, preview) : current));
      if (!preview.price) setNote(t.noPrice);
    } catch (caught) {
      if (thisRead !== readCount.current) return;
      lastReadLink.current = ""; // so pasting the same link again tries again
      setProblem(caught instanceof Error && caught.message ? caught.message : t.readFailed);
    } finally {
      if (thisRead === readCount.current) setReading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !draft.title.trim()) return;
    const prepared = prepareWishlistItem(draft);
    if ("problem" in prepared) return setProblem(prepared.problem === "link" ? t.linkInvalid : t.pictureInvalid);
    onSave(prepared.item);
    setActiveChoice(prepared.item.category);
    closeForm();
  }

  async function handleRemove(item: WishlistItem) {
    if (await ask(t.confirmRemove(item.title), { note: t.removeNote })) onRemove(item.id);
  }

  const picturePreview = draft ? asWebAddress(draft.image) : "";

  return (
    <section className={className ? `${styles.page} ${className}` : styles.page}>
      {dialog}
      <article className={styles.card}>
        <div className={styles.heading}>
          <div className={styles.headingText}>
            <h3>{t.heading}</h3>
            <p>{t.description}</p>
          </div>
          {icon ? <span className={styles.icon}>{icon}</span> : null}
        </div>

        {categories.length > 0 ? (
          <div className={styles.tabs} role="tablist" aria-label={t.tabsLabel}>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                role="tab"
                aria-selected={active === category.key}
                className={active === category.key ? styles.on : ""}
                onClick={() => setActiveChoice(category.key)}
              >
                {category.label} <span>{itemsOfCategory(items, category.key).length}</span>
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {categories.length > 0 ? (
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={() => (draft ? closeForm() : openForm(emptyWishlistItem({ category: active })))}>
              <Plus size={16} />
              {t.add}
            </button>
          </div>
        ) : null}

        {draft ? (
          <form className={styles.form} onSubmit={submit}>
            <label>
              {t.linkLabel}
              <input
                type="text"
                inputMode="url"
                value={draft.link}
                maxLength={WISHLIST_LIMITS.link}
                placeholder={t.linkPlaceholder}
                onChange={(event) => change({ link: event.target.value })}
                onPaste={(event) => {
                  if (!fetchPreview) return; // nothing to read: the browser's own paste is enough
                  event.preventDefault();
                  const pasted = event.clipboardData.getData("text").trim();
                  change({ link: pasted });
                  readLink(pasted);
                }}
                onBlur={(event) => event.target.value.trim() && !draft.title && readLink(event.target.value)}
              />
            </label>
            {reading ? <p className={styles.fieldNote}>{t.reading}</p> : null}
            <label>
              {t.titleLabel}
              <input value={draft.title} maxLength={WISHLIST_LIMITS.title} required placeholder={t.titlePlaceholder} onChange={(event) => change({ title: event.target.value })} />
            </label>
            <label>
              {t.descriptionLabel}
              <textarea
                value={draft.description}
                maxLength={WISHLIST_LIMITS.description}
                rows={2}
                placeholder={t.descriptionPlaceholder}
                onChange={(event) => change({ description: event.target.value })}
              />
            </label>
            <div className={styles.formRow}>
              <label>
                {t.priceLabel}
                <input value={draft.price} maxLength={WISHLIST_LIMITS.price} placeholder={t.pricePlaceholder} onChange={(event) => change({ price: event.target.value })} />
              </label>
              <label>
                {t.categoryLabel}
                <select value={draft.category} onChange={(event) => change({ category: event.target.value })}>
                  {categories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {t.pictureLabel}
              <input value={draft.image} maxLength={WISHLIST_LIMITS.image} placeholder={t.picturePlaceholder} onChange={(event) => change({ image: event.target.value })} />
            </label>
            {picturePreview ? <Picture key={picturePreview} src={picturePreview} alt={t.pictureAlt} className={styles.preview} /> : null}
            {note ? <p className={styles.fieldNote}>{note}</p> : null}
            {problem ? <p className={styles.error}>{problem}</p> : null}
            <div className={styles.formButtons}>
              <button className={styles.primaryButton} type="submit" disabled={reading}>
                {draft.id ? t.submitChanges : t.submitNew}
              </button>
              <button type="button" className={styles.textButton} onClick={closeForm}>
                {t.cancel}
              </button>
            </div>
          </form>
        ) : null}
      </article>

      <div className={styles.grid}>
        {shown.map((item) => (
          <article className={styles.item} key={item.id || item.link || item.title}>
            {item.image ? (
              <Picture
                key={item.image}
                src={item.image}
                alt={item.title}
                className={styles.image}
                fallback={
                  <div className={`${styles.image} ${styles.placeholder}`} aria-hidden="true">
                    <ImageIcon size={28} />
                  </div>
                }
              />
            ) : (
              <div className={`${styles.image} ${styles.placeholder}`} aria-hidden="true">
                <ImageIcon size={28} />
              </div>
            )}
            <div className={styles.body}>
              <div className={styles.itemHead}>
                <strong>{item.title}</strong>
                {item.price ? <span className={styles.price}>{item.price}</span> : null}
              </div>
              {item.description ? <p>{item.description}</p> : null}
              {item.link ? (
                <a className={styles.linkChip} href={item.link} target="_blank" rel="noopener noreferrer" title={item.link}>
                  <LinkIcon size={11} /> {hostOf(item.link)} <ArrowUpRight size={10} />
                </a>
              ) : null}
            </div>
            <div className={styles.tools}>
              <button type="button" aria-label={t.edit(item.title)} title={t.edit(item.title)} onClick={() => openForm({ ...item })}>
                <Pencil size={13} />
              </button>
              <button type="button" aria-label={t.remove(item.title)} title={t.remove(item.title)} onClick={() => handleRemove(item)}>
                <Trash size={14} />
              </button>
            </div>
          </article>
        ))}
        {shown.length === 0 ? <div className={styles.empty}>{categories.length === 0 ? t.noCategories : t.empty}</div> : null}
      </div>
    </section>
  );
}
