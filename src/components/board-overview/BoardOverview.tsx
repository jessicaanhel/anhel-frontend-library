"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Overview page of
// the private Bride Board and Groom Board: flight tickets, Google Docs and
// Sheets, a Figma mind board, pictures and files, kept in categories.
// ============================================================================

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowUpRight, FileIcon, ImageIcon, LinkIcon, Plane, Plus, Trash, X } from "../../icons";
import { shrinkPicture } from "../../shrinkPicture";
import { useConfirm } from "../confirm-dialog";
import { figmaEmbedUrl, isFigmaLink } from "../figma-board";
import { useSharedList } from "../task-list";
import { categoriesOf, emptyBoardItem, formatItemDate, groupItemsByCategory, linkSource, type BoardItem } from "./boardItem";
import styles from "./BoardOverview.module.css";

// Adapted from angela-simon-wedding/components/panel/BoardOverview.tsx.
//
// Links, tickets, pictures and files kept together, each with a category to
// group and reorganise them (change the category on the card to move it).
// A Figma link can be opened right inside its card. Files are kept as LINKS:
// a spreadsheet cell or a small database record can't hold a file, so a PDF
// lives in a drive and its link is added here. A picture is shrunk in the
// browser first (see shrinkPicture).
//
// It loads and saves through a list endpoint (see createBoardItemHandlers),
// and shows `children` (e.g. a to-do list and notes) under the items.

export type BoardItemType = {
  key: string; // saved in the item's `type`
  label: string; // "Ticket"
  plural: string; // "Tickets", for the filter
  icon?: ReactNode;
  titlePlaceholder?: string;
  linkPlaceholder?: string;
  // The link must be filled in.
  linkRequired?: boolean;
  // Show a date field (e.g. for tickets).
  withDate?: boolean;
  // "main": the item IS a picture (a chosen picture or a link is needed).
  // "optional": a picture (e.g. a screenshot) can be added. Left out: no picture.
  picture?: "main" | "optional";
};

export const DEFAULT_BOARD_ITEM_TYPES: BoardItemType[] = [
  { key: "link", label: "Link", plural: "Links", icon: <LinkIcon size={15} />, titlePlaceholder: "e.g. Seating plan (Google Sheet)", linkPlaceholder: "https://…", linkRequired: true },
  { key: "ticket", label: "Ticket", plural: "Tickets", icon: <Plane size={15} />, titlePlaceholder: "e.g. Flight to Pisa, 11 June", linkPlaceholder: "https://…", withDate: true, picture: "optional" },
  { key: "picture", label: "Picture", plural: "Pictures", icon: <ImageIcon size={15} />, titlePlaceholder: "Title", picture: "main" },
  { key: "file", label: "File", plural: "Files", icon: <FileIcon size={15} />, titlePlaceholder: "Title", linkPlaceholder: "Link to the file (Drive, Dropbox…)", linkRequired: true },
];

export type BoardOverviewTexts = {
  heading: string;
  description: string;
  addGroupLabel: string;
  add: string;
  dateLabel: string;
  categoryPlaceholder: string; // in the add form (can give examples)
  categoryShort: string; // on each card
  notePlaceholder: string;
  categoryLabel: (title: string) => string;
  pictureLinkPlaceholder: string; // for a picture: the link instead of a file
  linkOptionalPlaceholder: string; // once a picture is chosen
  choosePicture: string;
  changePicture: string;
  addScreenshot: string; // an optional picture, e.g. on a ticket
  chosenPictureAlt: string;
  pictureFailed: string;
  pictureRequired: string;
  filterLabel: string;
  all: string;
  unsorted: string;
  open: (source: string) => string;
  figmaLabel: string; // the card's type label for a Figma link
  showBoard: string;
  hideBoard: string;
  remove: (title: string) => string;
  confirmRemove: (title: string) => string;
  confirmRemoveYes: string;
  confirmRemoveNote: string;
  empty: string;
  emptyType: string;
  showAll: string;
};

const DEFAULT_TEXTS: BoardOverviewTexts = {
  heading: "Links, tickets and files",
  description: "Tickets, documents, a Figma board, pictures. Give each a category to keep things sorted.",
  addGroupLabel: "Add to the board",
  add: "Add",
  dateLabel: "Date",
  categoryPlaceholder: "Category (e.g. Flights, Speeches)",
  categoryShort: "Category",
  notePlaceholder: "Note (optional)",
  categoryLabel: (title) => `Category of ${title}`,
  pictureLinkPlaceholder: "Picture link (or choose a file below)",
  linkOptionalPlaceholder: "Link (optional)",
  choosePicture: "Choose a picture",
  changePicture: "Change picture",
  addScreenshot: "Add a screenshot (optional)",
  chosenPictureAlt: "Chosen",
  pictureFailed: "That picture could not be read. Try a JPG or PNG.",
  pictureRequired: "Choose a picture or paste its link.",
  filterLabel: "Filter by type",
  all: "All",
  unsorted: "Not sorted yet",
  open: (source) => `Open ${source}`,
  figmaLabel: "Mind board",
  showBoard: "Show board here",
  hideBoard: "Hide board",
  remove: (title) => `Remove ${title}`,
  confirmRemove: (title) => `Remove “${title}”?`,
  confirmRemoveYes: "Yes, remove",
  confirmRemoveNote: "It is deleted for good.",
  empty: "Nothing here yet. Add the first ticket, link, picture or file.",
  emptyType: "Nothing of this type.",
  showAll: "Show all",
};

export type BoardOverviewProps = {
  // The list endpoint of the items (see createBoardItemHandlers).
  endpoint: string;
  // The kinds of item. Default: link, ticket, picture, file.
  types?: BoardItemType[];
  // Shown until the first load.
  initialItems?: BoardItem[];
  // A short name for where a link goes, shown as "Open <name>". Default: linkSource.
  describeLink?: (link: string) => string;
  // For dates on the cards. Default "en-GB".
  locale?: string;
  // Shown below the items, e.g. a to-do list and a notes pad.
  children?: ReactNode;
  texts?: Partial<BoardOverviewTexts>;
  className?: string;
};

export default function BoardOverview({
  endpoint,
  types = DEFAULT_BOARD_ITEM_TYPES,
  initialItems = [],
  describeLink = linkSource,
  locale = "en-GB",
  children,
  texts,
  className,
}: BoardOverviewProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const list = useSharedList<BoardItem>(endpoint, initialItems);
  const { refresh } = list;
  const { ask, dialog } = useConfirm();
  const categoriesId = useId();
  const [adding, setAdding] = useState<BoardItemType | null>(null);
  const [picture, setPicture] = useState("");
  const [pictureError, setPictureError] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<Set<string>>(new Set()); // Figma boards shown inline
  const files = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const typeOf = (key: string) => types.find((type) => type.key === key) ?? types[0];
  const categories = useMemo(() => categoriesOf(list.items), [list.items]);
  const shown = list.items.filter((item) => filter === "all" || item.type === filter);
  const groups = useMemo(() => groupItemsByCategory(shown, t.unsorted), [shown, t.unsorted]);

  function startAdding(type: BoardItemType) {
    setAdding(adding?.key === type.key ? null : type);
    setPicture("");
    setPictureError("");
  }

  async function choosePicture(file: File | undefined) {
    if (!file) return;
    setPictureError("");
    try {
      setPicture(await shrinkPicture(file));
    } catch {
      setPictureError(t.pictureFailed);
    }
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adding) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const link = String(data.get("link") ?? "").trim();
    if (!title) return;
    if (adding.picture === "main" && !picture && !link) {
      setPictureError(t.pictureRequired);
      return;
    }
    list.save(
      emptyBoardItem({
        type: adding.key,
        title,
        link,
        category: String(data.get("category") ?? "").trim(),
        date: String(data.get("date") ?? ""),
        note: String(data.get("note") ?? "").trim(),
        image: picture,
      })
    );
    event.currentTarget.reset();
    setPicture("");
    setAdding(null);
  }

  const toggleFigma = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // The link field: what it asks for depends on the kind of item.
  function linkField(type: BoardItemType) {
    if (type.picture === "main") {
      return <input name="link" type="url" placeholder={picture ? t.linkOptionalPlaceholder : t.pictureLinkPlaceholder} />;
    }
    return <input name="link" type="url" placeholder={type.linkPlaceholder ?? "https://…"} required={type.linkRequired} />;
  }

  return (
    <div className={className ? `${styles.overview} ${className}` : styles.overview}>
      {dialog}
      <section className={styles.card}>
        <div className={styles.heading}>
          <h3>{t.heading}</h3>
          {t.description ? <p>{t.description}</p> : null}
        </div>

        <div className={styles.addRow} role="group" aria-label={t.addGroupLabel}>
          {types.map((type) => (
            <button type="button" key={type.key} className={`${styles.addButton} ${adding?.key === type.key ? styles.on : ""}`} onClick={() => startAdding(type)}>
              <Plus size={14} />
              {type.icon} {type.label}
            </button>
          ))}
        </div>

        {adding && (
          <form className={styles.form} onSubmit={addItem}>
            <input name="title" placeholder={adding.titlePlaceholder ?? ""} required autoFocus />
            {linkField(adding)}
            {adding.withDate && <input name="date" type="date" aria-label={t.dateLabel} />}
            <input name="category" placeholder={t.categoryPlaceholder} list={categoriesId} />
            <input name="note" placeholder={t.notePlaceholder} />
            {adding.picture && (
              <div className={styles.picturePick}>
                <input ref={files} type="file" accept="image/*" hidden onChange={(event) => choosePicture(event.target.files?.[0])} />
                <button type="button" className={styles.textButton} onClick={() => files.current?.click()}>
                  <ImageIcon size={14} /> {picture ? t.changePicture : adding.picture === "optional" ? t.addScreenshot : t.choosePicture}
                </button>
                {picture && (
                  // A data URL: an image optimiser can't help here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={picture} alt={t.chosenPictureAlt} className={styles.picturePreview} />
                )}
              </div>
            )}
            {pictureError && <p className={styles.error}>{pictureError}</p>}
            <button className={styles.primaryButton} type="submit">
              {t.add}
            </button>
          </form>
        )}
        {list.error && <p className={styles.error}>{list.error}</p>}

        {list.items.length > 0 && (
          <div className={styles.filter} role="group" aria-label={t.filterLabel}>
            <button type="button" className={filter === "all" ? styles.on : ""} onClick={() => setFilter("all")}>
              {t.all} <span>{list.items.length}</span>
            </button>
            {types
              .filter((type) => list.items.some((item) => item.type === type.key))
              .map((type) => (
                <button type="button" key={type.key} className={filter === type.key ? styles.on : ""} onClick={() => setFilter(filter === type.key ? "all" : type.key)}>
                  {type.plural} <span>{list.items.filter((item) => item.type === type.key).length}</span>
                </button>
              ))}
          </div>
        )}
        <datalist id={categoriesId}>
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        {groups.map((group) => (
          <div className={styles.group} key={group.name}>
            <h4>
              {group.name} <span>{group.items.length}</span>
            </h4>
            <div className={styles.cards}>
              {group.items.map((item) => {
                const type = typeOf(item.type);
                const figma = isFigmaLink(item.link);
                const inline = figma && open.has(item.id);
                return (
                  <article className={`${styles.itemCard} ${inline ? styles.wide : ""}`} key={item.id}>
                    <div className={styles.itemHead}>
                      <span className={styles.itemType}>
                        {type.icon} {figma ? t.figmaLabel : type.label}
                      </span>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={t.remove(item.title)}
                        onClick={async () => (await ask(t.confirmRemove(item.title), { confirmLabel: t.confirmRemoveYes, note: t.confirmRemoveNote })) && list.remove(item.id)}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.title} className={styles.itemImage} />
                    )}
                    <strong>{item.title}</strong>
                    {item.date && <span className={styles.itemDate}>{formatItemDate(item.date, locale)}</span>}
                    {item.note && <span className={styles.itemNote}>{item.note}</span>}
                    {item.link && (
                      <span className={styles.itemLinks}>
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.openLink}>
                          {t.open(describeLink(item.link))} <ArrowUpRight size={12} />
                        </a>
                        {figma && (
                          <button type="button" className={styles.textButton} onClick={() => toggleFigma(item.id)}>
                            {inline ? t.hideBoard : t.showBoard}
                          </button>
                        )}
                      </span>
                    )}
                    {inline && <iframe className={styles.figmaFrame} title={item.title} src={figmaEmbedUrl(item.link)} allowFullScreen />}
                    <input
                      className={styles.categoryField}
                      // A new key when the saved category changes, so the field shows it.
                      key={`category-${item.category}`}
                      defaultValue={item.category}
                      placeholder={t.categoryShort}
                      list={categoriesId}
                      aria-label={t.categoryLabel(item.title)}
                      onBlur={(event) => event.target.value.trim() !== item.category && list.save({ ...item, category: event.target.value.trim() })}
                    />
                  </article>
                );
              })}
            </div>
          </div>
        ))}
        {list.items.length === 0 && <div className={styles.empty}>{t.empty}</div>}
        {list.items.length > 0 && shown.length === 0 && (
          <div className={styles.empty}>
            {t.emptyType}{" "}
            <button type="button" className={styles.textButton} onClick={() => setFilter("all")}>
              <X size={11} /> {t.showAll}
            </button>
          </div>
        )}
      </section>

      {children}
    </div>
  );
}
