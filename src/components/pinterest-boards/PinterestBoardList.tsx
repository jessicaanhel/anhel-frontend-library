"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the panel's
// Inspiration pages: saved public Pinterest boards, added by pasting a link,
// with tags to filter them.
// ============================================================================

import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Plus, Trash, X } from "../../icons";
import { useConfirm } from "../confirm-dialog";
import PinterestBoard from "./PinterestBoard";
import { boardsWithTag, isEmbeddableBoard, tagCounts, type PinterestBoardItem } from "./pinterest";
import styles from "./PinterestBoards.module.css";

// Adapted from angela-simon-wedding/components/panel/InspirationPanel.tsx.
//
// Controlled: shows `items` and reports changes through onSave / onRemove
// (e.g. useSharedList's save and remove). A board is added by pasting its
// link; the server is expected to check it (cleanBoard). Every board can have
// tags: add them with the link or later with "+ tag", and click a tag to see
// only the boards with it. Short pin.it links, and anything else Pinterest
// can't embed, show as a plain link only.

export type PinterestBoardListTexts = {
  heading: string;
  description: string;
  addBoard: string;
  add: string;
  linkPlaceholder: string;
  titlePlaceholder: string;
  tagsPlaceholder: string;
  filterLabel: string;
  all: string;
  openOnPinterest: string;
  showOnly: (tag: string) => string;
  removeTag: (tag: string, title: string) => string;
  addTagPlaceholder: string;
  addTagLabel: (title: string) => string;
  remove: (title: string) => string;
  confirmRemove: (title: string) => string;
  removeNote: string;
  empty: string;
  emptyTag: (tag: string) => string;
};

const DEFAULT_TEXTS: PinterestBoardListTexts = {
  heading: "Inspiration",
  description: "Public Pinterest boards. Paste a board link to add one.",
  addBoard: "Add board",
  add: "Add",
  linkPlaceholder: "https://www.pinterest.com/name/board/",
  titlePlaceholder: "Title (optional)",
  tagsPlaceholder: "Tags, e.g. flowers, colours",
  filterLabel: "Filter boards by tag",
  all: "All",
  openOnPinterest: "Open on Pinterest",
  showOnly: (tag) => `Show only “${tag}” boards`,
  removeTag: (tag, title) => `Remove the tag ${tag} from ${title}`,
  addTagPlaceholder: "+ tag",
  addTagLabel: (title) => `Add a tag to ${title}`,
  remove: (title) => `Remove ${title}`,
  confirmRemove: (title) => `Remove “${title}”?`,
  removeNote: "",
  empty: "No boards yet. Add the link to a public Pinterest board.",
  emptyTag: (tag) => `No boards tagged “${tag}”.`,
};

export type PinterestBoardListProps = {
  items: PinterestBoardItem[];
  // Gets a new board with id "" or a changed one (title, tags).
  onSave: (item: PinterestBoardItem) => void;
  onRemove: (id: string) => void;
  error?: string;
  // false: hide the add form (read-only list).
  canAdd?: boolean;
  texts?: Partial<PinterestBoardListTexts>;
  className?: string;
};

function splitTags(value: string) {
  const tags: string[] = [];
  for (const part of value.split(/[,;]+/)) {
    const tag = part.trim();
    if (tag) tags.push(tag);
  }
  return tags;
}

export default function PinterestBoardList({
  items,
  onSave,
  onRemove,
  error,
  canAdd = true,
  texts,
  className,
}: PinterestBoardListProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [adding, setAdding] = useState(false);
  const [activeTag, setActiveTag] = useState("");
  const { ask, dialog } = useConfirm();
  // The <datalist> of tag ideas needs a page-unique id (there can be several lists).
  const tagIdeasId = `pinterest-tags-${useId().replace(/:/g, "")}`;

  const counts = useMemo(() => tagCounts(items), [items]);
  const shown = boardsWithTag(items, activeTag);

  function addBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const link = String(data.get("link") ?? "").trim();
    if (!link) return;
    onSave({
      id: "",
      title: String(data.get("title") ?? "").trim(),
      link,
      tags: splitTags(String(data.get("tags") ?? "")),
    });
    form.reset();
    setAdding(false);
  }

  function addTag(item: PinterestBoardItem, value: string) {
    const tag = value.trim();
    const tags = item.tags ?? [];
    if (!tag || tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    onSave({ ...item, tags: [...tags, tag] });
  }

  async function handleRemove(item: PinterestBoardItem) {
    if (await ask(t.confirmRemove(item.title), { note: t.removeNote })) onRemove(item.id);
  }

  return (
    <section className={className ? `${styles.page} ${className}` : styles.page}>
      {dialog}
      <article className={styles.card}>
        <div className={styles.heading}>
          <div className={styles.headingText}>
            <h3>{t.heading}</h3>
            <p>{t.description}</p>
          </div>
          {canAdd ? (
            <button type="button" className={styles.primaryButton} onClick={() => setAdding(!adding)}>
              <Plus size={16} />
              {t.addBoard}
            </button>
          ) : null}
        </div>

        {adding ? (
          <form className={styles.inlineForm} onSubmit={addBoard}>
            <input name="link" type="url" placeholder={t.linkPlaceholder} required autoFocus />
            <input name="title" placeholder={t.titlePlaceholder} />
            <input name="tags" placeholder={t.tagsPlaceholder} list={tagIdeasId} />
            <button className={styles.primaryButton} type="submit">
              {t.add}
            </button>
          </form>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {counts.length > 0 ? (
          <div className={styles.tagFilter} role="group" aria-label={t.filterLabel}>
            <button type="button" className={activeTag === "" ? styles.on : ""} onClick={() => setActiveTag("")}>
              {t.all} <span>{items.length}</span>
            </button>
            {counts.map(({ tag, count }) => {
              const isActive = activeTag.toLowerCase() === tag.toLowerCase();
              return (
                <button key={tag} type="button" className={isActive ? styles.on : ""} onClick={() => setActiveTag(isActive ? "" : tag)}>
                  {tag} <span>{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {/* While typing a tag, the tags already used are offered. */}
        <datalist id={tagIdeasId}>
          {counts.map((entry) => (
            <option key={entry.tag} value={entry.tag} />
          ))}
        </datalist>
      </article>

      {shown.map((item) => (
        <article className={styles.card} key={item.id || item.link}>
          <div className={styles.heading}>
            <div className={styles.headingText}>
              <h3>{item.title}</h3>
              <p>
                <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.boardLink}>
                  {t.openOnPinterest} <ArrowUpRight size={12} />
                </a>
              </p>
            </div>
            <button type="button" className={styles.remove} aria-label={t.remove(item.title)} onClick={() => handleRemove(item)}>
              <Trash size={14} />
            </button>
          </div>

          <div className={styles.boardTags}>
            {(item.tags ?? []).map((tag) => (
              <span className={styles.tagChip} key={tag}>
                <button type="button" onClick={() => setActiveTag(tag)} title={t.showOnly(tag)}>
                  {tag}
                </button>
                <button
                  type="button"
                  className={styles.tagRemove}
                  aria-label={t.removeTag(tag, item.title)}
                  onClick={() => onSave({ ...item, tags: (item.tags ?? []).filter((existing) => existing !== tag) })}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              className={styles.tagInput}
              placeholder={t.addTagPlaceholder}
              list={tagIdeasId}
              aria-label={t.addTagLabel(item.title)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(item, event.currentTarget.value);
                  event.currentTarget.value = "";
                }
              }}
              onBlur={(event) => {
                addTag(item, event.target.value);
                event.target.value = "";
              }}
            />
          </div>

          {isEmbeddableBoard(item.link) ? <PinterestBoard link={item.link} /> : null}
        </article>
      ))}

      {shown.length === 0 ? (
        <article className={styles.card}>
          <div className={styles.empty}>{items.length === 0 ? t.empty : t.emptyTag(activeTag)}</div>
        </article>
      ) : null}
    </section>
  );
}
