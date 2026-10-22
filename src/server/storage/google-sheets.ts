import { newId, newestForUser } from "./ids";
import { historySheetTable, type SheetTable } from "./sheet-tables";
import type { HistoryStorage, ListStorage, StorageBackend, WithId } from "./types";

// Adapted from angela-simon-wedding/lib/panel/sheetsStore.ts.
//
// Google Sheets backend: each list is a tab of one spreadsheet, created on
// first use with a header row (see sheet-tables.ts for the columns). The
// sheet can also be edited by hand; rows added by hand get an id the next
// time the list is read.
//
// The app creates the Sheets client with its own credentials and passes it
// in, e.g. `google.sheets({ version: "v4", auth })` from the googleapis
// package. This file only describes the few calls it makes (SheetsClient),
// so it has no package dependency of its own.

type CellValue = string | number;

// The part of the googleapis Sheets v4 client that is used here.
export type SheetsClient = {
  spreadsheets: {
    get(params: { spreadsheetId: string; fields?: string }): Promise<{
      data: { sheets?: { properties?: { title?: string | null } | null }[] | null };
    }>;
    batchUpdate(params: { spreadsheetId: string; requestBody: { requests: object[] } }): Promise<unknown>;
    values: {
      get(params: { spreadsheetId: string; range: string }): Promise<{ data: { values?: unknown[][] | null } }>;
      update(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        requestBody: { values: CellValue[][] };
      }): Promise<unknown>;
      clear(params: { spreadsheetId: string; range: string }): Promise<unknown>;
      append(params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        requestBody: { values: CellValue[][] };
      }): Promise<unknown>;
    };
  };
};

export type SheetsStorageOptions = {
  sheets: SheetsClient;
  // A function, so a missing setting fails on first use, not on import.
  spreadsheetId: string | (() => string | undefined);
  // The tab layout of each list, by list name: { tasks: taskSheetTable() }.
  // `list(name)` fails for a name that has no table here. (`any`: each list
  // has its own item type, and `list<T>(name)` is where the type is chosen.)
  tables: Record<string, SheetTable<any>>;
  // Spreadsheets this storage must never write to, e.g. one that a public
  // form fills in. Using one of them as `spreadsheetId` is an error, so a
  // mix-up of settings can't put data there.
  protectedSpreadsheetIds?: () => (string | undefined)[];
  // The last column that is read. Default "Z".
  lastColumn?: string;
};

// 'My tab'!A1 (quotes doubled inside the name, as A1 notation wants).
function rangeIn(tab: string, cells: string) {
  return `'${tab.replace(/'/g, "''")}'!${cells}`;
}

export function createSheetsStorage(options: SheetsStorageOptions): StorageBackend {
  const { sheets } = options;
  const lastColumn = options.lastColumn ?? "Z";

  function spreadsheetId() {
    const id = typeof options.spreadsheetId === "function" ? options.spreadsheetId() : options.spreadsheetId;
    if (!id) throw new Error("The spreadsheet id is not configured.");
    const protectedIds = options.protectedSpreadsheetIds ? options.protectedSpreadsheetIds() : [];
    if (protectedIds.includes(id)) {
      throw new Error("The spreadsheet id points at a protected spreadsheet; use a separate one for this data.");
    }
    return id;
  }

  // Tabs already checked or created by this server, so the check runs once per tab.
  const knownTabs = new Set<string>();

  async function ensureTab(table: { tab: string; headers: string[] }) {
    if (knownTabs.has(table.tab)) return;
    const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId(), fields: "sheets.properties.title" });
    const existing = meta.data.sheets ?? [];
    const exists = existing.some((sheet) => sheet.properties?.title === table.tab);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId(),
        requestBody: { requests: [{ addSheet: { properties: { title: table.tab } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId(),
        range: rangeIn(table.tab, "A1"),
        valueInputOption: "RAW",
        requestBody: { values: [table.headers] },
      });
    }
    knownTabs.add(table.tab);
  }

  // Rows below the header, skipping completely empty ones.
  async function readRows<T>(table: SheetTable<T>): Promise<string[][]> {
    await ensureTab(table);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: rangeIn(table.tab, `A:${lastColumn}`),
    });
    const rows = (response.data.values ?? []).map((row) => row.map((value) => (value === null || value === undefined ? "" : String(value))));
    return rows.slice(1).filter((row) => row.some((value) => value.trim() !== ""));
  }

  // Replaces the whole list. The new rows are written first and the leftover
  // old rows cleared afterwards, so an interrupted save can't leave the tab empty.
  async function writeRows<T>(table: SheetTable<T>, items: T[]) {
    await ensureTab(table);
    const values: CellValue[][] = [table.headers];
    for (const item of items) values.push(table.toRow(item));
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: rangeIn(table.tab, "A1"),
      valueInputOption: "RAW", // keep text exactly as typed (no formulas, no number guessing)
      requestBody: { values },
    });
    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId(),
      range: rangeIn(table.tab, `A${values.length + 1}:${lastColumn}`),
    });
  }

  function tableFor(name: string) {
    const table = options.tables[name];
    if (!table) throw new Error(`No sheet table is set up for the list "${name}".`);
    return table;
  }

  function list<T extends WithId>(name: string): ListStorage<T> {
    return {
      // Rows someone added by hand get an id here, and are written back so the
      // id stays the same next time.
      async loadAll() {
        const table = tableFor(name) as SheetTable<T>;
        const items = (await readRows(table)).map((row) => table.fromRow(row));
        let filledIn = false;
        for (const item of items) {
          if (!item.id) {
            item.id = newId();
            filledIn = true;
          }
        }
        if (filledIn) await writeRows(table, items);
        return items;
      },
      async saveAll(items) {
        await writeRows(tableFor(name) as SheetTable<T>, items);
      },
    };
  }

  function history(name = "History"): HistoryStorage {
    const table = historySheetTable(name);
    return {
      // Appended, not rewritten: the history only grows.
      async append(event) {
        await ensureTab(table);
        await sheets.spreadsheets.values.append({
          spreadsheetId: spreadsheetId(),
          range: rangeIn(table.tab, "A:C"),
          valueInputOption: "RAW",
          requestBody: { values: [table.toRow(event)] },
        });
      },
      async readForUser(username, limit) {
        const events = (await readRows(table)).map((row) => table.fromRow(row));
        return newestForUser(events, username, limit);
      },
    };
  }

  return { list, history };
}

export {
  accountSheetTable,
  boardItemSheetTable,
  cell,
  historySheetTable,
  isYes,
  noteSheetTable,
  taskSheetTable,
  toNumber,
  trashSheetTable,
  wishlistSheetTable,
} from "./sheet-tables";
export type { SheetTable } from "./sheet-tables";
