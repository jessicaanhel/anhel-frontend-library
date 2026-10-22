import type { BoardItem } from "../../components/board-overview/boardItem";
import type { NoteRecord } from "../../components/notes-pad/notes";
import type { WishlistItem } from "../../components/wishlist/wishlistItems";
import type { Task } from "../../components/task-list/task";
import type { AccountRecord } from "../accounts/handlers";
import type { TrashEntry } from "../lists/trash";
import type { HistoryEvent } from "./types";

// Adapted from angela-simon-wedding/lib/panel/tables.ts.
//
// How a list is laid out as a Google Sheet tab: the header row, and how a row
// becomes an item and back. Columns are POSITIONAL: a new field always gets a
// new column at the END, so rows saved before it existed still read correctly
// (their missing cells read as ""). Never insert a column in the middle.
//
// The sheet can be edited by hand, so reading is forgiving: short rows,
// "yes"/"Yes"/"TRUE"/"x", "1,200.50".

export type SheetTable<T> = {
  tab: string;
  headers: string[];
  fromRow: (row: string[]) => T;
  toRow: (item: T) => (string | number)[];
};

// The trimmed text of one cell ("" when the row is shorter).
export function cell(row: string[], index: number) {
  const value = row[index];
  return value === undefined || value === null ? "" : String(value).trim();
}

export function isYes(value: string) {
  return ["yes", "y", "true", "1", "x", "✓"].includes(value.trim().toLowerCase());
}

// "1,200.50" -> 1200.5, "12,5" -> 12.5, "€ 30" -> 30; anything else -> 0.
export function toNumber(value: string) {
  let digits = value.replace(/[^0-9.,-]/g, "");
  if (digits.includes(",") && digits.includes(".")) digits = digits.replace(/,/g, "");
  else if (digits.includes(",")) digits = digits.replace(",", ".");
  const parsed = parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

// The task list. The column order is the original one; "Important" was added
// later and therefore sits after "ID".
export function taskSheetTable(tab = "Tasks"): SheetTable<Task> {
  return {
    tab,
    headers: ["Task", "Category", "Due", "Assigned", "Notes", "Done", "ID", "Important"],
    fromRow: (row) => ({
      title: cell(row, 0),
      category: cell(row, 1),
      due: cell(row, 2),
      assigned: cell(row, 3),
      notes: cell(row, 4),
      completed: isYes(cell(row, 5)),
      id: cell(row, 6),
      important: isYes(cell(row, 7)),
    }),
    toRow: (task) => [
      task.title,
      task.category,
      task.due,
      task.assigned,
      task.notes,
      task.completed ? "Yes" : "",
      task.id,
      task.important ? "Yes" : "",
    ],
  };
}

// Removed items waiting in the trash (see server/lists/trash.ts).
export function trashSheetTable(tab = "Trash"): SheetTable<TrashEntry> {
  return {
    tab,
    headers: ["Type", "Name", "Removed by", "Removed at", "Data", "ID"],
    fromRow: (row) => ({
      kind: cell(row, 0),
      title: cell(row, 1),
      removedBy: cell(row, 2),
      removedAt: cell(row, 3),
      // Not trimmed: it is JSON written by the app.
      data: row[4] === undefined || row[4] === null ? "" : String(row[4]),
      id: cell(row, 5),
    }),
    toRow: (entry) => [entry.kind, entry.title, entry.removedBy, entry.removedAt, entry.data, entry.id],
  };
}

export function historySheetTable(tab = "History"): SheetTable<HistoryEvent> {
  return {
    tab,
    headers: ["When", "User", "What"],
    fromRow: (row) => ({ at: cell(row, 0), username: cell(row, 1), text: cell(row, 2) }),
    toRow: (event) => [event.at, event.username, event.text],
  };
}

// A Google Sheet cell holds at most 50,000 characters, so a long text (a
// note's JSON, a picture) is cut into pieces over the columns to the right of
// the fixed ones. The sheet is read up to column Z (see `lastColumn`), which
// leaves room for 22 pieces after four fixed columns: about 990,000 characters.
const CELL_CHUNK = 45_000;

function splitIntoCells(value: string) {
  const pieces: string[] = [];
  for (let at = 0; at < value.length; at += CELL_CHUNK) pieces.push(value.slice(at, at + CELL_CHUNK));
  return pieces;
}

// The pieces from column `from` onwards, joined again. Not trimmed: it is
// text written by the app.
function joinCells(row: string[], from: number) {
  return row
    .slice(from)
    .map((piece) => String(piece ?? ""))
    .join("");
}

// Notes (see server/notes): Title, Colour, Updated, ID, then the content
// split over the columns to the right.
export function noteSheetTable(tab = "Notes"): SheetTable<NoteRecord> {
  return {
    tab,
    headers: ["Title", "Color", "Updated", "ID", "Content (split over the columns to the right)"],
    fromRow: (row) => ({
      title: cell(row, 0),
      color: cell(row, 1),
      updatedAt: cell(row, 2),
      id: cell(row, 3),
      doc: joinCells(row, 4),
    }),
    toRow: (note) => [note.title, note.color, note.updatedAt, note.id, ...splitIntoCells(note.doc)],
  };
}

// The items of a board overview (see BoardOverview and createBoardItemHandlers).
// A picture is a long text, so it is split over the columns to the right.
// `types` are the accepted item types; an unknown one reads as the first.
export function boardItemSheetTable(tab = "BoardItems", types: string[] = ["link", "ticket", "picture", "file"]): SheetTable<BoardItem> {
  return {
    tab,
    headers: ["Type", "Title", "Link", "Category", "Date", "Note", "ID", "Picture (split over the columns to the right)"],
    fromRow: (row) => {
      const type = cell(row, 0).toLowerCase();
      return {
        type: types.includes(type) ? type : types[0],
        title: cell(row, 1),
        link: cell(row, 2),
        category: cell(row, 3),
        date: cell(row, 4),
        note: cell(row, 5),
        id: cell(row, 6),
        image: joinCells(row, 7),
      };
    },
    toRow: (item) => [item.type, item.title, item.link, item.category, item.date, item.note, item.id, ...splitIntoCells(item.image)],
  };
}

// The stored accounts (see server/accounts). `parseRoles` turns the roles
// cell back into roles: pass the permission model's own `parseRoles`. The
// password column holds the hash, never the password.
export function accountSheetTable<Role extends string>(
  parseRoles: (text: string) => Role[],
  tab = "Accounts"
): SheetTable<AccountRecord<Role>> {
  return {
    tab,
    headers: ["Username", "Password hash", "Created", "Roles", "ID"],
    fromRow: (row) => ({
      username: cell(row, 0),
      passwordHash: cell(row, 1),
      createdAt: cell(row, 2),
      roles: parseRoles(cell(row, 3)),
      id: cell(row, 4),
    }),
    toRow: (account) => [account.username, account.passwordHash, account.createdAt, account.roles.join(","), account.id],
  };
}

// The items of a wishlist (see Wishlist and createWishlistHandlers), one row
// per item. `categoryKeys` are the categories that exist: a category typed by
// hand in any case ("guests", "Guests") reads as the key, and an unknown one
// is kept as typed. A link or picture cell that is not a web address reads as
// empty (the picture has to be https once it goes through the handlers).
export function wishlistSheetTable(tab = "Wishlist", categoryKeys: string[] = []): SheetTable<WishlistItem> {
  const webAddress = (value: string) => (/^https?:\/\/\S+$/i.test(value) ? value : "");
  return {
    tab,
    headers: ["Category", "Title", "Description", "Link", "Price", "Picture", "ID"],
    fromRow: (row) => {
      const typed = cell(row, 0);
      return {
        category: categoryKeys.find((key) => key.toLowerCase() === typed.toLowerCase()) ?? typed,
        title: cell(row, 1),
        description: cell(row, 2),
        link: webAddress(cell(row, 3)),
        price: cell(row, 4),
        image: webAddress(cell(row, 5)),
        id: cell(row, 6),
      };
    },
    toRow: (item) => [item.category, item.title, item.description, item.link, item.price, item.image, item.id],
  };
}
