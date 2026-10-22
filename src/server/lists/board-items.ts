import { DEFAULT_ITEM_TYPES, type BoardItem } from "../../components/board-overview/boardItem";
import { isoDate, listChanges, text } from "./clean";
import { createListHandlers, type ListConfig, type ListSession } from "./handlers";

// Adapted from angela-simon-wedding/lib/panel/boardRoutes.ts (boardItemHandlers):
// the endpoint behind BoardOverview.

export type CleanBoardItemOptions = {
  // The item types that are accepted (default: link, ticket, picture, file).
  // Another type becomes the first one in the list.
  types?: string[];
  // The longest picture (a data URL) that is kept. Default 140,000 characters,
  // a little more than shrinkPicture's 110,000, so its result always fits.
  maxImageChars?: number;
};

// The item fields from what the browser sent, or null when something is
// wrong: no title, a link that is not a web address (http or https), or a
// picture that is not a small image data URL.
export function cleanBoardItem(input: unknown, options: CleanBoardItemOptions = {}): Omit<BoardItem, "id"> | null {
  const types = options.types ?? DEFAULT_ITEM_TYPES;
  const maxImageChars = options.maxImageChars ?? 140_000;
  const raw = (input ?? {}) as Partial<Record<keyof BoardItem, unknown>>;

  const title = text(raw.title, 120);
  if (!title) return null;
  const type = types.includes(String(raw.type)) ? String(raw.type) : types[0];
  const link = text(raw.link, 600);
  if (link && !/^https?:\/\/\S+$/i.test(link)) return null;
  const image = typeof raw.image === "string" ? raw.image.trim() : "";
  if (image && (image.length > maxImageChars || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) return null;

  return { type, title, link, category: text(raw.category, 40), date: isoDate(raw.date), note: text(raw.note, 500), image };
}

export type BoardItemHandlerOptions<S extends ListSession> = Omit<ListConfig<BoardItem, S>, "clean" | "maxItems"> & {
  // Default 300.
  maxItems?: number;
  types?: string[];
  maxImageChars?: number;
  // How the board is called in history lines ("Added a ticket “…” to the
  // {boardName}"). Default "board".
  boardName?: string;
};

// GET / PUT / DELETE for a board overview's items. The storage, session,
// history, trash and permissions are options, like for any list.
export function createBoardItemHandlers<S extends ListSession = ListSession>(options: BoardItemHandlerOptions<S>) {
  const { maxItems, types, maxImageChars, boardName = "board", ...rest } = options;
  return createListHandlers<BoardItem, S>({
    describeCreate: (item) => `Added ${item.type === "picture" ? "a picture" : `a ${item.type}`} “${item.title}” to the ${boardName}`,
    describeUpdate(before, after) {
      const changes = listChanges([
        ["title", before.title, after.title],
        ["link", before.link, after.link],
        ["category", before.category, after.category],
        ["date", before.date, after.date],
        ["note", before.note, after.note],
      ]);
      return changes ? `Edited “${after.title}” on the ${boardName}: ${changes}` : null;
    },
    describeRemove: (item) => `Removed “${item.title}” from the ${boardName}`,
    ...rest,
    maxItems: maxItems ?? 300,
    clean: (input) => cleanBoardItem(input, { types, maxImageChars }),
  });
}
