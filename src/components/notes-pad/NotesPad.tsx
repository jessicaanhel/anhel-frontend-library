"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the Notes section of
// the private Bride Board and Groom Board: pages like a notes app with text, a
// drawing pad, pictures and stickers, saved by itself.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ImageIcon, Pencil, Plus, Share, Smile, Trash, TypeIcon, X } from "../../icons";
import { shrinkPicture } from "../../shrinkPicture";
import { useConfirm } from "../confirm-dialog";
import DrawPad, { type DrawPadTexts } from "./DrawPad";
import {
  DEFAULT_STICKERS,
  MAX_NOTE_CHARS,
  NOTE_COLOURS,
  noteFillPercent,
  noteToPlainText,
  type Block,
  type NoteDoc,
  type NoteSummary,
} from "./notes";
import styles from "./NotesPad.module.css";

// Adapted from angela-simon-wedding/components/panel/NotesPanel.tsx.
//
// Talks to a notes endpoint (see createNotesHandlers):
//   GET           -> { notes: NoteSummary[] }  (no content)
//   GET ?id=...   -> { note }                  (one whole note)
//   PUT { note }  -> { note }                  (create without id, or save)
//   DELETE { id } -> { ok }
// A note is a list of blocks (text, a drawing pad, a picture, a sticker) that
// can be moved up and down. It saves by itself a moment after every change.
// Pictures are shrunk in the browser first, and a note has a size limit.

export type NotesPadTexts = {
  heading: string;
  description: string;
  newNote: string;
  emptyList: string;
  emptyNote: string;
  untitled: string;
  loadFailed: string;
  back: string;
  backLabel: string;
  saved: string;
  saving: string;
  notSaved: string;
  notSavedLeave: string;
  saveFailed: string;
  openFailed: string;
  opening: string;
  titlePlaceholder: string;
  textPlaceholder: string;
  paperColour: (colour: string) => string;
  shareLabel: string;
  shareHint: string;
  copied: string;
  shareFailed: string;
  deleteLabel: string;
  moveUp: string;
  moveDown: string;
  removeBlock: string;
  addText: string;
  addDrawing: string;
  addPicture: string;
  addLink: string;
  addSticker: string;
  stickers: string;
  pictureLinkPlaceholder: string;
  pictureLinkAdd: string;
  pictureLinkInvalid: string;
  pictureFailed: string;
  almostFull: (percent: number) => string;
  confirmRemoveBlock: string;
  confirmRemoveBlockYes: string;
  confirmDelete: (title: string) => string;
  confirmDeleteYes: string;
  deleteNote: string;
  deleteFailed: string;
  // Words for a note without text, used in the copy-as-text export.
  pictureWord: string;
  drawingWord: string;
};

const DEFAULT_TEXTS: NotesPadTexts = {
  heading: "Notes",
  description: "Write, draw, add pictures and stickers.",
  newNote: "New note",
  emptyList: "No notes yet. Start the first one.",
  emptyNote: "Empty note",
  untitled: "Untitled",
  loadFailed: "Could not load the notes.",
  back: "Notes",
  backLabel: "Back to the notes",
  saved: "Saved",
  saving: "Saving…",
  notSaved: "Not saved",
  notSavedLeave: "This note is not saved yet. Press back again to leave without saving.",
  saveFailed: "Could not save.",
  openFailed: "Could not open this note.",
  opening: "Opening…",
  titlePlaceholder: "Title",
  textPlaceholder: "Write something…",
  paperColour: (colour) => `Paper colour ${colour}`,
  shareLabel: "Share or copy the note as text",
  shareHint: "Send to another app / copy as text",
  copied: "Copied as text.",
  shareFailed: "Could not share this note.",
  deleteLabel: "Delete the note",
  moveUp: "Move up",
  moveDown: "Move down",
  removeBlock: "Remove",
  addText: "Text",
  addDrawing: "Drawing",
  addPicture: "Picture",
  addLink: "Link",
  addSticker: "Sticker",
  stickers: "Stickers",
  pictureLinkPlaceholder: "https://… picture link",
  pictureLinkAdd: "Add",
  pictureLinkInvalid: "Paste a picture link that starts with https://",
  pictureFailed: "That picture could not be added.",
  almostFull: (percent) => `This note is almost full (${percent}%). Remove a picture before adding more.`,
  confirmRemoveBlock: "Remove this part of the note?",
  confirmRemoveBlockYes: "Yes, remove",
  confirmDelete: (title) => `Delete the note “${title}”?`,
  confirmDeleteYes: "Yes, delete it",
  deleteNote: "It is deleted for good and can't be restored.",
  deleteFailed: "Could not delete the note.",
  pictureWord: "(picture)",
  drawingWord: "(drawing)",
};

export type NotesPadProps = {
  // The notes route (see createNotesHandlers).
  endpoint: string;
  // Paper colours. They must be the same as the handlers' `colours`
  // (default NOTE_COLOURS), otherwise the server falls back to the first one.
  colours?: string[];
  stickers?: string[];
  // The most characters one note may hold (for the "almost full" hint). Use
  // the same value as the handlers' `maxChars`. Default MAX_NOTE_CHARS.
  maxChars?: number;
  // Wait after the last change before saving. Default 900 ms.
  saveDelayMs?: number;
  // For the date on each note card. Default "en-GB".
  locale?: string;
  texts?: Partial<NotesPadTexts>;
  drawTexts?: Partial<DrawPadTexts>;
  className?: string;
};

type EditorProps = Required<Pick<NotesPadProps, "endpoint" | "colours" | "stickers" | "maxChars" | "saveDelayMs">> & {
  noteId: string | null;
  texts: NotesPadTexts;
  drawTexts?: Partial<DrawPadTexts>;
  onClose: () => void;
};

const blockId = () => Math.random().toString(36).slice(2, 10);
const newTextBlock = (): Block => ({ id: blockId(), type: "text", text: "" });

// A textarea that is always as tall as its text (no scrollbar inside the note).
function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!field.current) return;
    field.current.style.height = "auto";
    field.current.style.height = `${field.current.scrollHeight}px`;
  }, [value]);
  return <textarea ref={field} className={styles.noteText} value={value} placeholder={placeholder} rows={3} onChange={(event) => onChange(event.target.value)} />;
}

function Editor({ endpoint, noteId, colours, stickers, maxChars, saveDelayMs, texts: t, drawTexts, onClose }: EditorProps) {
  const [id, setId] = useState<string | null>(noteId);
  const [title, setTitle] = useState("");
  const [colour, setColour] = useState(colours[0]);
  const [blocks, setBlocks] = useState<Block[]>([newTextBlock()]);
  const [loaded, setLoaded] = useState(noteId === null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"" | "stickers" | "link">("");
  const files = useRef<HTMLInputElement>(null);
  const { ask, dialog } = useConfirm();

  // What is on screen, for the save that runs after a pause.
  const latest = useRef({ title, colour, blocks });
  latest.current = { title, colour, blocks };
  // True while there are changes that have not been sent to the server.
  const unsaved = useRef(false);
  // The id of a note that was just created: the first save returns it, and
  // every later save must use it (otherwise each save would create a new note).
  const savingId = useRef<string | null>(noteId);
  // Saves run one after another. A slow first save of a new note must finish
  // (and hand out the id) before the next one starts.
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  // After a failed save on "back", the second press leaves anyway.
  const leaveAnyway = useRef(false);

  // Open an existing note.
  useEffect(() => {
    if (!noteId) return;
    fetch(`${endpoint}?id=${encodeURIComponent(noteId)}`)
      .then((response) => response.json())
      .then((body: { note?: { title: string; color: string; doc: string } }) => {
        if (!body.note) return;
        setTitle(body.note.title);
        setColour(body.note.color);
        try {
          const doc = JSON.parse(body.note.doc) as NoteDoc;
          setBlocks(doc.blocks.length ? doc.blocks : [newTextBlock()]);
        } catch {
          // unreadable content: start with an empty page
        }
      })
      .catch(() => setMessage(t.openFailed))
      .finally(() => setLoaded(true));
  }, [endpoint, noteId, t.openFailed]);

  function save(): Promise<void> {
    saveChain.current = saveChain.current.then(async () => {
      if (!unsaved.current) return; // an earlier save in the chain already sent everything
      unsaved.current = false;
      const { title: currentTitle, colour: currentColour, blocks: currentBlocks } = latest.current;
      setSaveState("saving");
      try {
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: { id: savingId.current ?? undefined, title: currentTitle, color: currentColour, doc: { blocks: currentBlocks } } }),
        });
        const body = (await response.json().catch(() => null)) as { note?: { id: string }; error?: string } | null;
        if (!response.ok || !body || !body.note) throw new Error(body && body.error ? body.error : t.saveFailed);
        savingId.current = body.note.id; // a new note now has its id
        setId(body.note.id);
        setMessage("");
        setSaveState(unsaved.current ? "saving" : "saved");
      } catch (caught) {
        unsaved.current = true; // still to be saved
        setMessage(caught instanceof Error ? caught.message : t.saveFailed);
        setSaveState("error");
      }
    });
    return saveChain.current;
  }

  // Save a moment after the last change.
  useEffect(() => {
    if (!loaded || !unsaved.current) return;
    const timer = setTimeout(save, saveDelayMs);
    return () => clearTimeout(timer);
    // `save` only reads refs, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, colour, blocks, loaded, saveDelayMs]);

  const change = useCallback((update: () => void) => {
    unsaved.current = true;
    leaveAnyway.current = false;
    update();
  }, []);

  const add = (block: Block) => change(() => setBlocks((current) => [...current, block]));
  const patch = (idToChange: string, next: Partial<Block>) =>
    change(() => setBlocks((current) => current.map((block) => (block.id === idToChange ? ({ ...block, ...next } as Block) : block))));
  const move = (index: number, direction: -1 | 1) =>
    change(() =>
      setBlocks((current) => {
        const target = index + direction;
        if (target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      })
    );
  const remove = async (block: Block) => {
    const empty = block.type === "text" && !block.text.trim();
    if (empty || (await ask(t.confirmRemoveBlock, { confirmLabel: t.confirmRemoveBlockYes, note: t.deleteNote }))) {
      change(() => setBlocks((current) => current.filter((candidate) => candidate.id !== block.id)));
    }
  };

  async function addPicture(file: File | undefined) {
    if (!file) return;
    try {
      add({ id: blockId(), type: "image", src: await shrinkPicture(file) });
    } catch {
      setMessage(t.pictureFailed);
    }
  }

  // On a phone this opens the share sheet (the app can then save a copy into
  // a notes app: there is no way to keep the two in sync, so it is a copy).
  // Elsewhere the text is copied to the clipboard.
  async function shareNote() {
    const text = noteToPlainText(title, blocks, { untitled: t.untitled, picture: t.pictureWord, drawing: t.drawingWord });
    try {
      if (navigator.share) await navigator.share({ title: title || t.untitled, text });
      else {
        await navigator.clipboard.writeText(text);
        setMessage(t.copied);
      }
    } catch (caught) {
      // Closing the share sheet is not an error.
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setMessage(t.shareFailed);
    }
  }

  async function goBack() {
    if (unsaved.current && !leaveAnyway.current) {
      await save();
      if (unsaved.current) {
        leaveAnyway.current = true;
        setMessage(t.notSavedLeave);
        return;
      }
    }
    onClose();
  }

  async function deleteNote() {
    if (!id) return onClose();
    if (!(await ask(t.confirmDelete(title || t.untitled), { confirmLabel: t.confirmDeleteYes, note: t.deleteNote }))) return;
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("delete failed");
      unsaved.current = false; // nothing left to save
      onClose();
    } catch {
      setMessage(t.deleteFailed);
    }
  }

  const fillPercent = noteFillPercent(blocks, maxChars);

  return (
    <div className={styles.editor} style={{ background: colour }}>
      {dialog}
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={goBack} aria-label={t.backLabel}>
          <ArrowLeft size={18} /> {t.back}
        </button>
        <span className={styles.state}>{saveState === "saving" ? t.saving : saveState === "error" ? t.notSaved : t.saved}</span>
        <div className={styles.colours}>
          {colours.map((value) => (
            <button
              type="button"
              key={value}
              className={`${styles.colour} ${colour === value ? styles.on : ""}`}
              style={{ background: value }}
              aria-label={t.paperColour(value)}
              onClick={() => change(() => setColour(value))}
            />
          ))}
        </div>
        <button type="button" className={styles.share} onClick={shareNote} aria-label={t.shareLabel} title={t.shareHint}>
          <Share size={16} />
        </button>
        <button type="button" className={styles.deleteNote} onClick={deleteNote} aria-label={t.deleteLabel}>
          <Trash size={16} />
        </button>
      </div>

      {!loaded ? (
        <p className={styles.loading}>{t.opening}</p>
      ) : (
        <>
          <input className={styles.title} value={title} placeholder={t.titlePlaceholder} maxLength={100} onChange={(event) => change(() => setTitle(event.target.value))} />

          <div className={styles.blocks}>
            {blocks.map((block, index) => (
              <div className={styles.block} key={block.id}>
                <div className={styles.blockControls}>
                  <button type="button" aria-label={t.moveUp} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" aria-label={t.moveDown} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown size={13} />
                  </button>
                  <button type="button" aria-label={t.removeBlock} onClick={() => remove(block)}>
                    <X size={13} />
                  </button>
                </div>

                {block.type === "text" && <AutoTextarea value={block.text} placeholder={t.textPlaceholder} onChange={(text) => patch(block.id, { text })} />}
                {block.type === "draw" && <DrawPad strokes={block.strokes} texts={drawTexts} onChange={(strokes) => patch(block.id, { strokes })} />}
                {block.type === "image" && (
                  // A plain <img>: the source is a data URL or a link, which an image optimiser can't help with.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.image} src={block.src} alt="" />
                )}
                {block.type === "sticker" && <div className={styles.sticker}>{block.emoji}</div>}
              </div>
            ))}
          </div>

          {panel === "stickers" && (
            <div className={styles.stickerGrid} role="group" aria-label={t.stickers}>
              {stickers.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => {
                    add({ id: blockId(), type: "sticker", emoji });
                    setPanel("");
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {panel === "link" && (
            <form
              className={styles.linkForm}
              onSubmit={(event) => {
                event.preventDefault();
                const src = String(new FormData(event.currentTarget).get("src") ?? "").trim();
                if (/^https:\/\/\S+$/.test(src)) add({ id: blockId(), type: "image", src });
                else setMessage(t.pictureLinkInvalid);
                setPanel("");
              }}
            >
              <input name="src" placeholder={t.pictureLinkPlaceholder} autoFocus />
              <button className={styles.primaryButton} type="submit">
                {t.pictureLinkAdd}
              </button>
            </form>
          )}
          {message && <p className={styles.error}>{message}</p>}

          <div className={styles.toolbar}>
            <button type="button" onClick={() => add(newTextBlock())}>
              <TypeIcon size={16} /> {t.addText}
            </button>
            <button type="button" onClick={() => add({ id: blockId(), type: "draw", strokes: [] })}>
              <Pencil size={16} /> {t.addDrawing}
            </button>
            <button type="button" onClick={() => files.current?.click()}>
              <ImageIcon size={16} /> {t.addPicture}
            </button>
            <button type="button" onClick={() => setPanel(panel === "link" ? "" : "link")}>
              {t.addLink}
            </button>
            <button type="button" onClick={() => setPanel(panel === "stickers" ? "" : "stickers")}>
              <Smile size={16} /> {t.addSticker}
            </button>
            <input
              ref={files}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                addPicture(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <p className={styles.size}>{fillPercent > 80 ? t.almostFull(fillPercent) : ""}</p>
        </>
      )}
    </div>
  );
}

export default function NotesPad({
  endpoint,
  colours = NOTE_COLOURS,
  stickers = DEFAULT_STICKERS,
  maxChars = MAX_NOTE_CHARS,
  saveDelayMs = 900,
  locale = "en-GB",
  texts,
  drawTexts,
  className,
}: NotesPadProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [error, setError] = useState("");

  // A string, so `load` keeps its identity between renders (texts is a new object each time).
  const loadFailed = t.loadFailed;
  const load = useCallback(() => {
    fetch(endpoint)
      .then((response) => response.json())
      .then((body: { notes?: NoteSummary[]; error?: string }) => {
        if (body.notes) {
          setNotes(body.notes);
          setError("");
        } else setError(body.error ?? loadFailed);
      })
      .catch(() => setError(loadFailed));
  }, [endpoint, loadFailed]);

  useEffect(load, [load]);

  if (editing) {
    return (
      <Editor
        endpoint={endpoint}
        key={editing.id ?? "new"}
        noteId={editing.id}
        colours={colours}
        stickers={stickers}
        maxChars={maxChars}
        saveDelayMs={saveDelayMs}
        texts={t}
        drawTexts={drawTexts}
        onClose={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <section className={className ? `${styles.pad} ${className}` : styles.pad}>
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <h3>{t.heading}</h3>
          {t.description ? <p>{t.description}</p> : null}
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setEditing({ id: null })}>
          <Plus size={16} />
          {t.newNote}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.grid}>
        {(notes ?? []).map((note) => (
          <button type="button" className={styles.card} key={note.id} style={{ background: note.color }} onClick={() => setEditing({ id: note.id })}>
            <strong>{note.title}</strong>
            <span>{note.preview || t.emptyNote}</span>
            <em>{new Date(note.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}</em>
          </button>
        ))}
        {notes && notes.length === 0 && <div className={styles.empty}>{t.emptyList}</div>}
      </div>
    </section>
  );
}
