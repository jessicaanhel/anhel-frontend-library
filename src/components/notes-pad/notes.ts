// The notes document shared by the notes editor (browser) and the notes
// handlers (server): pages made of blocks, like a notes app. No React and no
// Node imports, so both sides can use it.
// Adapted from angela-simon-wedding/lib/panel/notes.ts and types.ts (Note).
//
//   text     a paragraph (emoji work in it)
//   draw     a drawing pad (pen, colours, eraser), stored as strokes
//   image    a picture (shrunk in the browser before saving, or a link)
//   sticker  one big emoji
//
// A note is saved as JSON text (`NoteRecord.doc`). Storage that limits the
// size of a value needs a layout that fits it: the Google Sheets table
// (`noteSheetTable`) splits the JSON over several cells.

export type Stroke = {
  c: string; // colour, #rrggbb
  w: number; // pen width, in drawing units
  e?: 1; // an eraser stroke
  p: number[]; // x1, y1, x2, y2, ... in drawing units (the pad is DRAW_WIDTH wide)
};

export type Block =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "draw"; strokes: Stroke[] }
  | { id: string; type: "image"; src: string }
  | { id: string; type: "sticker"; emoji: string };

export type NoteDoc = { blocks: Block[] };

// A note as stored. `doc` is the NoteDoc as JSON text.
export type NoteRecord = {
  id: string;
  title: string;
  // One of the paper colours. The field keeps the wedding site's spelling, so
  // notes saved there (a "Color" column in the sheet) are read as they are.
  color: string;
  updatedAt: string; // ISO timestamp
  doc: string;
};

// What the notes list shows for a note (no content).
export type NoteSummary = {
  id: string;
  title: string;
  color: string;
  updatedAt: string;
  preview: string;
};

// The drawing pad has a fixed size in "drawing units"; it is scaled to the screen.
export const DRAW_WIDTH = 1000;
export const DRAW_HEIGHT = 600;

// The saved JSON of one note, in characters. The default fits a few dozen
// Google Sheet cells. A database with a smaller record limit (DynamoDB: 400 KB
// per item) needs a lower value, on the editor and on the handlers alike.
export const MAX_NOTE_CHARS = 400_000;
export const MAX_BLOCKS = 60;

export const NOTE_COLOURS = ["#fffdf6", "#fff3d6", "#fde6e6", "#e8f0e4", "#e6edf7", "#efe6f5"];

export const DEFAULT_STICKERS = ["💐", "💍", "🥂", "🎀", "✨", "💖", "🌸", "🍾", "🎉", "🦋", "🌷", "👑", "📸", "⭐", "🔥", "✅"];

// Colours of the pen, and the default drawing colour for a bad value.
export const DEFAULT_PEN_COLOR = "#2d302b";

export type CleanNoteDocOptions = {
  maxChars?: number;
  maxBlocks?: number;
};

const IMAGE_SOURCE = /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|https:\/\/\S+)$/;

// Checks a note document sent from the browser and returns a clean copy, or
// null when it is not valid or too big.
export function cleanNoteDoc(input: unknown, options: CleanNoteDocOptions = {}): NoteDoc | null {
  const maxChars = options.maxChars ?? MAX_NOTE_CHARS;
  const maxBlocks = options.maxBlocks ?? MAX_BLOCKS;

  if (!input || typeof input !== "object") return null;
  const raw = (input as { blocks?: unknown }).blocks;
  if (!Array.isArray(raw) || raw.length > maxBlocks) return null;

  const blocks: Block[] = [];
  for (const item of raw) {
    const block = (item ?? {}) as Record<string, unknown>;
    const id = typeof block.id === "string" ? block.id.slice(0, 20) : "";
    if (!id) return null;

    if (block.type === "text") {
      blocks.push({ id, type: "text", text: typeof block.text === "string" ? block.text.slice(0, 20_000) : "" });
    } else if (block.type === "draw") {
      const strokes = Array.isArray(block.strokes) ? block.strokes.slice(0, 600) : [];
      blocks.push({ id, type: "draw", strokes: strokes.flatMap(cleanStroke) });
    } else if (block.type === "image") {
      const src = typeof block.src === "string" ? block.src : "";
      if (!IMAGE_SOURCE.test(src)) return null;
      blocks.push({ id, type: "image", src });
    } else if (block.type === "sticker") {
      blocks.push({ id, type: "sticker", emoji: typeof block.emoji === "string" ? block.emoji.slice(0, 16) : "✨" });
    } else {
      return null;
    }
  }

  const doc = { blocks };
  return JSON.stringify(doc).length <= maxChars ? doc : null;
}

// One stroke, or none when it has no usable points.
function cleanStroke(stroke: unknown): Stroke[] {
  const candidate = (stroke ?? {}) as Partial<Stroke>;
  if (!Array.isArray(candidate.p) || candidate.p.length < 2 || candidate.p.length > 4000) return [];
  const points = candidate.p.map((value) => Math.round(Number(value))).filter((value) => Number.isFinite(value));
  // An odd number of coordinates would leave a point without a y.
  if (points.length < 2 || points.length % 2 !== 0) return [];
  return [
    {
      c: /^#[0-9a-fA-F]{6}$/.test(candidate.c ?? "") ? (candidate.c as string) : DEFAULT_PEN_COLOR,
      w: Math.min(60, Math.max(1, Math.round(Number(candidate.w) || 4))),
      ...(candidate.e ? { e: 1 as const } : {}),
      p: points,
    },
  ];
}

export type PreviewLabels = { drawing: string; picture: string };

const DEFAULT_PREVIEW_LABELS: PreviewLabels = { drawing: "Drawing", picture: "Picture" };

// A short line for the notes list: the first words of the first text block,
// or a label for a note that has only a drawing or a picture.
export function previewOf(doc: NoteDoc, labels: Partial<PreviewLabels> = {}) {
  const words = { ...DEFAULT_PREVIEW_LABELS, ...labels };
  const textBlock = doc.blocks.find((block) => block.type === "text" && block.text.trim());
  if (textBlock && textBlock.type === "text") return textBlock.text.trim().replace(/\s+/g, " ").slice(0, 90);
  if (doc.blocks.some((block) => block.type === "draw")) return words.drawing;
  if (doc.blocks.some((block) => block.type === "image")) return words.picture;
  return "";
}

export type PlainTextLabels = { untitled: string; picture: string; drawing: string };

const DEFAULT_PLAIN_TEXT_LABELS: PlainTextLabels = { untitled: "Untitled", picture: "(picture)", drawing: "(drawing)" };

// The note as plain text, to copy or send to another notes app: the title,
// the text, the stickers and picture links. Drawings and uploaded pictures
// can't go into plain text, so they become a short label.
export function noteToPlainText(title: string, blocks: Block[], labels: Partial<PlainTextLabels> = {}) {
  const words = { ...DEFAULT_PLAIN_TEXT_LABELS, ...labels };
  const lines = blocks.flatMap((block) => {
    if (block.type === "text") return [block.text];
    if (block.type === "sticker") return [block.emoji];
    if (block.type === "image") return block.src.startsWith("http") ? [block.src] : [words.picture];
    return [words.drawing];
  });
  return [title || words.untitled, ...lines].join("\n\n").trim();
}

// How full a note is, 0-100 (for a "this note is almost full" hint).
export function noteFillPercent(blocks: Block[], maxChars = MAX_NOTE_CHARS) {
  return Math.round((JSON.stringify({ blocks }).length / maxChars) * 100);
}
