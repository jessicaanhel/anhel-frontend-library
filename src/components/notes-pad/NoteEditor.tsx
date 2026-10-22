"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Smile, TypeIcon, X } from "../../icons";
import { shrinkPicture } from "../../shrinkPicture";
import { useConfirm } from "../confirm-dialog";
import DrawPad, { type DrawPadTexts } from "./DrawPad";
import { DEFAULT_STICKERS, MAX_NOTE_CHARS, noteFillPercent, type Block, type NoteDoc } from "./notes";
import styles from "./NotesPad.module.css";

// The editing part of a note on its own: the blocks (text, a drawing pad, a
// picture, a sticker), moving and removing them, and the toolbar that adds
// them. Controlled and without network: it shows `value` and reports every
// change with `onChange`, so a page decides when and where the note is saved
// (e.g. one note under a lesson video). NotesPad uses it inside its editor.

export type NoteEditorTexts = {
  textPlaceholder: string;
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
  // The small print of the "remove this part?" question.
  deleteNote: string;
};

const DEFAULT_TEXTS: NoteEditorTexts = {
  textPlaceholder: "Write something…",
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
  deleteNote: "It is deleted for good and can't be restored.",
};

export type NoteEditorProps = {
  value: NoteDoc;
  onChange: (doc: NoteDoc) => void;
  stickers?: string[];
  // The most characters the note may hold (for the "almost full" hint). Use
  // the same value as where the note is saved. Default MAX_NOTE_CHARS.
  maxChars?: number;
  texts?: Partial<NoteEditorTexts>;
  drawTexts?: Partial<DrawPadTexts>;
  className?: string;
};

const blockId = () => Math.random().toString(36).slice(2, 10);
export const newTextBlock = (): Block => ({ id: blockId(), type: "text", text: "" });

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

export default function NoteEditor({ value, onChange, stickers = DEFAULT_STICKERS, maxChars = MAX_NOTE_CHARS, texts, drawTexts, className }: NoteEditorProps) {
  const t = { ...DEFAULT_TEXTS, ...texts };
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"" | "stickers" | "link">("");
  const files = useRef<HTMLInputElement>(null);
  const { ask, dialog } = useConfirm();

  // The newest blocks. Adding a picture and removing a block wait (for the
  // picture to shrink, for the "are you sure?"), and by then `value` from
  // that render may be old, so changes start from this instead.
  const latest = useRef(value.blocks);
  latest.current = value.blocks;
  const setBlocks = (update: (current: Block[]) => Block[]) => {
    const next = update(latest.current);
    latest.current = next;
    onChange({ blocks: next });
  };

  const blocks = value.blocks;
  const add = (block: Block) => setBlocks((current) => [...current, block]);
  const patch = (idToChange: string, next: Partial<Block>) =>
    setBlocks((current) => current.map((block) => (block.id === idToChange ? ({ ...block, ...next } as Block) : block)));
  const move = (index: number, direction: -1 | 1) =>
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const remove = async (block: Block) => {
    const empty = block.type === "text" && !block.text.trim();
    if (empty || (await ask(t.confirmRemoveBlock, { confirmLabel: t.confirmRemoveBlockYes, note: t.deleteNote }))) {
      setBlocks((current) => current.filter((candidate) => candidate.id !== block.id));
    }
  };

  async function addPicture(file: File | undefined) {
    if (!file) return;
    try {
      add({ id: blockId(), type: "image", src: await shrinkPicture(file) });
      setMessage("");
    } catch {
      setMessage(t.pictureFailed);
    }
  }

  const fillPercent = noteFillPercent(blocks, maxChars);

  return (
    <div className={className}>
      {dialog}
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
            if (/^https:\/\/\S+$/.test(src)) {
              add({ id: blockId(), type: "image", src });
              setMessage("");
            } else setMessage(t.pictureLinkInvalid);
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
    </div>
  );
}
