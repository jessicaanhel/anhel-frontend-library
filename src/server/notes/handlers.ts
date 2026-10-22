// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the notes endpoint of
// the private Bride Board and Groom Board (one route per board, same code).
// ============================================================================

import {
  MAX_NOTE_CHARS,
  NOTE_COLOURS,
  cleanNoteDoc,
  previewOf,
  type NoteDoc,
  type NoteRecord,
  type NoteSummary,
  type PreviewLabels,
} from "../../components/notes-pad/notes";
import { jsonResponse, readJson } from "../http";
import { newId } from "../storage/ids";
import type { HistoryStorage, ListStorage } from "../storage/types";

// Adapted from angela-simon-wedding/lib/panel/boardRoutes.ts (boardNotesHandlers).
//
// A note can be big (drawings, pictures), so the endpoint is not a plain list:
//   GET           -> { notes }  a short summary of every note (no content), newest first
//   GET ?id=...   -> { note }   one whole note
//   PUT { note }  -> { note }   create (no id) or save; returns the saved note
//   DELETE { id } -> { ok }     delete a note for good
// The notes live in a ListStorage, so any storage backend works. Use
// `noteSheetTable` for Google Sheets: it splits the content over several cells.

export type NotesSession = { username: string };

export type NotesMessages = {
  notSignedIn: string;
  forbidden: string;
  invalidRequest: string;
  tooBig: (maxChars: number) => string;
  full: (maxNotes: number) => string;
  notFound: string;
  loadFailed: string;
  saveFailed: string;
  removeFailed: string;
};

const DEFAULT_MESSAGES: NotesMessages = {
  notSignedIn: "Not signed in.",
  forbidden: "This is not available to you.",
  invalidRequest: "Invalid request.",
  tooBig: (maxChars) => `This note is too big or not valid (the limit is about ${Math.round(maxChars / 1000)} KB). Try fewer or smaller pictures.`,
  full: (maxNotes) => `You can keep up to ${maxNotes} notes.`,
  notFound: "Not found.",
  loadFailed: "Could not load the notes.",
  saveFailed: "Could not save the note.",
  removeFailed: "Could not delete the note.",
};

export type NotesHandlerConfig<S extends NotesSession = NotesSession> = {
  storage: ListStorage<NoteRecord>;
  // The signed-in person for this request, or null (-> 401).
  getSession: (request: Request) => Promise<S | null>;
  // Who may use the notes at all (default: everyone signed in). Others get 403.
  authorize?: (session: S) => boolean;
  // Notes are started and deleted under the person's name. Leave out for no history.
  history?: HistoryStorage;
  describeCreate?: (note: NoteRecord) => string;
  describeRemove?: (note: NoteRecord) => string;
  // Default 40.
  maxNotes?: number;
  // Characters of one note's saved JSON. Default MAX_NOTE_CHARS. Lower it for
  // a database with a smaller record limit (and pass the same to NotesPad).
  maxChars?: number;
  // Allowed paper colours (default NOTE_COLOURS). Anything else becomes the first one.
  colours?: string[];
  // Shown for a note without a title. Default "Untitled".
  untitled?: string;
  // The list line of a note that has only a drawing or a picture.
  previewLabels?: Partial<PreviewLabels>;
  messages?: Partial<NotesMessages>;
  // Where unexpected failures are reported. Default: console.error.
  logError?: (message: string, error: unknown) => void;
};

export function createNotesHandlers<S extends NotesSession = NotesSession>(config: NotesHandlerConfig<S>) {
  const messages = { ...DEFAULT_MESSAGES, ...config.messages };
  const maxNotes = config.maxNotes ?? 40;
  const maxChars = config.maxChars ?? MAX_NOTE_CHARS;
  const colours = config.colours ?? NOTE_COLOURS;
  const untitled = config.untitled ?? "Untitled";
  const logError = config.logError ?? ((message: string, error: unknown) => console.error(message, error));

  function summary(note: NoteRecord): NoteSummary {
    let preview = "";
    try {
      preview = previewOf(JSON.parse(note.doc) as NoteDoc, config.previewLabels);
    } catch {
      // unreadable content: no preview
    }
    return { id: note.id, title: note.title, color: note.color, updatedAt: note.updatedAt, preview };
  }

  // The session when this person may use the notes, otherwise the error Response.
  async function signedIn(request: Request): Promise<S | Response> {
    const session = await config.getSession(request);
    if (!session) return jsonResponse({ error: messages.notSignedIn }, 401);
    if (config.authorize && !config.authorize(session)) return jsonResponse({ error: messages.forbidden }, 403);
    return session;
  }

  async function writeHistory(username: string, at: string, line: string | undefined) {
    if (!config.history || !line) return;
    await config.history.append({ at, username, text: line });
  }

  async function GET(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;

    try {
      const notes = await config.storage.loadAll();
      const id = new URL(request.url).searchParams.get("id");
      if (id) {
        const note = notes.find((candidate) => candidate.id === id);
        return note ? jsonResponse({ note }) : jsonResponse({ error: messages.notFound }, 404);
      }
      return jsonResponse({ notes: notes.map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    } catch (error) {
      logError("Failed to load notes", error);
      return jsonResponse({ error: messages.loadFailed }, 502);
    }
  }

  async function PUT(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;

    const body = await readJson(request);
    if (!body) return jsonResponse({ error: messages.invalidRequest }, 400);

    const raw = (body.note ?? {}) as { id?: unknown; title?: unknown; color?: unknown; doc?: unknown };
    const doc = cleanNoteDoc(raw.doc, { maxChars });
    if (!doc) return jsonResponse({ error: messages.tooBig(maxChars) }, 400);

    try {
      const notes = await config.storage.loadAll();
      const id = typeof raw.id === "string" ? raw.id : "";
      const index = id ? notes.findIndex((note) => note.id === id) : -1;
      if (index === -1 && notes.length >= maxNotes) return jsonResponse({ error: messages.full(maxNotes) }, 400);

      const saved: NoteRecord = {
        id: index === -1 ? newId() : id,
        title: (typeof raw.title === "string" ? raw.title.trim().slice(0, 100) : "") || untitled,
        color: colours.includes(String(raw.color)) ? String(raw.color) : colours[0],
        updatedAt: new Date().toISOString(),
        doc: JSON.stringify(doc),
      };
      if (index === -1) notes.unshift(saved);
      else notes[index] = saved;

      await config.storage.saveAll(notes);
      if (index === -1) {
        const line = config.describeCreate ? config.describeCreate(saved) : `Started the note “${saved.title}”`;
        await writeHistory(session.username, saved.updatedAt, line);
      }
      return jsonResponse({ note: saved });
    } catch (error) {
      logError("Failed to save a note", error);
      return jsonResponse({ error: messages.saveFailed }, 502);
    }
  }

  async function DELETE(request: Request) {
    const session = await signedIn(request);
    if (session instanceof Response) return session;

    const body = await readJson(request);
    if (!body) return jsonResponse({ error: messages.invalidRequest }, 400);
    const id = String(body.id ?? "");

    try {
      const notes = await config.storage.loadAll();
      const removed = notes.find((note) => note.id === id);
      if (!removed) return jsonResponse({ error: messages.notFound }, 404);

      await config.storage.saveAll(notes.filter((note) => note.id !== id));
      const line = config.describeRemove ? config.describeRemove(removed) : `Deleted the note “${removed.title}”`;
      await writeHistory(session.username, new Date().toISOString(), line);
      return jsonResponse({ ok: true });
    } catch (error) {
      logError("Failed to delete a note", error);
      return jsonResponse({ error: messages.removeFailed }, 502);
    }
  }

  return { GET, PUT, DELETE };
}
