// Runs the same storage contract against every backend, so they stay
// interchangeable: memory, JSON file, Google Sheets (with an in-memory fake of
// the Sheets client) and DynamoDB (with a fake DynamoDB client, in both key
// layouts). No network and no credentials are used.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Task } from "../src/components/task-list";
import { createJsonFileStorage, createMemoryStorage, selectStorage, type StorageBackend } from "../src/server/storage";
import { createDynamoDbStorage, type DynamoDbSender } from "../src/server/storage/dynamodb";
import {
  accountSheetTable,
  boardItemSheetTable,
  createSheetsStorage,
  noteSheetTable,
  taskSheetTable,
  trashSheetTable,
  wishlistSheetTable,
  type SheetsClient,
} from "../src/server/storage/google-sheets";
import type { NoteRecord } from "../src/components/notes-pad";
import type { BoardItem } from "../src/components/board-overview";
import type { WishlistItem } from "../src/components/wishlist";
import type { AccountRecord } from "../src/server/accounts";

const results: string[] = [];

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { id, title, category: "", due: "", assigned: "", notes: "", completed: false, important: false, ...extra };
}

// ---- the contract ---------------------------------------------------------------

async function runContract(name: string, makeBackend: () => StorageBackend | Promise<StorageBackend>) {
  const backend = await makeBackend();
  const tasks = backend.list<Task>("tasks");

  assert.deepEqual(await tasks.loadAll(), [], `${name}: a new list is empty`);

  const first = [
    task("a1", "Book the venue", { due: "2027-01-10", assigned: "sam", important: true }),
    task("b2", "Order flowers", { category: "Decor", notes: "White and green" }),
    task("c3", "Send invitations", { completed: true }),
  ];
  await tasks.saveAll(first);
  assert.deepEqual(await tasks.loadAll(), first, `${name}: saved items come back equal and in order`);

  // A new item at the top, one updated, one removed: the order must follow.
  const second = [task("d4", "Taste the cake"), { ...first[0], completed: true }, first[2]];
  await tasks.saveAll(second);
  assert.deepEqual(await tasks.loadAll(), second, `${name}: a second save replaces the list (order, update, removal)`);

  await tasks.saveAll([]);
  assert.deepEqual(await tasks.loadAll(), [], `${name}: saving an empty list empties it`);

  // Lists with different names don't see each other.
  const other = backend.list<Task>("trash");
  await tasks.saveAll([task("e5", "Only in tasks")]);
  assert.deepEqual(await other.loadAll(), [], `${name}: lists are separate`);

  const history = backend.history();
  await history.append({ at: "2027-01-01T10:00:00.000Z", username: "sam", text: "one" });
  await history.append({ at: "2027-01-01T11:00:00.000Z", username: "alex", text: "other person" });
  await history.append({ at: "2027-01-01T12:00:00.000Z", username: "sam", text: "two" });
  await history.append({ at: "2027-01-01T13:00:00.000Z", username: "sam", text: "three" });
  const mine = await history.readForUser("sam", 2);
  assert.deepEqual(
    mine.map((event) => event.text),
    ["three", "two"],
    `${name}: history is per person, newest first, limited`
  );
  assert.deepEqual(await history.readForUser("nobody", 10), [], `${name}: no history for an unknown person`);

  results.push(`${name}: storage contract ok`);
}

// ---- a fake Google Sheets client ----------------------------------------------------

function tabOf(range: string) {
  const match = /^'((?:[^']|'')*)'!/.exec(range);
  if (!match) throw new Error(`Unexpected range ${range}`);
  return match[1].replace(/''/g, "'");
}

function createFakeSheets() {
  const tabs = new Map<string, string[][]>();
  const calls: string[] = [];

  function rowsOf(range: string) {
    const tab = tabOf(range);
    const rows = tabs.get(tab);
    if (!rows) throw new Error(`No tab ${tab}`);
    return rows;
  }

  const client: SheetsClient = {
    spreadsheets: {
      async get() {
        calls.push("get");
        return { data: { sheets: [...tabs.keys()].map((title) => ({ properties: { title } })) } };
      },
      async batchUpdate(params) {
        calls.push("batchUpdate");
        for (const request of params.requestBody.requests as { addSheet?: { properties: { title: string } } }[]) {
          if (request.addSheet) tabs.set(request.addSheet.properties.title, []);
        }
        return {};
      },
      values: {
        async get(params) {
          calls.push(`get ${params.range}`);
          return { data: { values: rowsOf(params.range).map((row) => [...row]) } };
        },
        async update(params) {
          calls.push(`update ${params.range}`);
          const rows = rowsOf(params.range);
          const start = Number(/![A-Z]+(\d+)$/.exec(params.range)?.[1] ?? "1") - 1;
          params.requestBody.values.forEach((row, index) => {
            rows[start + index] = row.map(String);
          });
          return {};
        },
        async clear(params) {
          calls.push(`clear ${params.range}`);
          const rows = rowsOf(params.range);
          const from = Number(/![A-Z]+(\d+):/.exec(params.range)?.[1] ?? "1") - 1;
          rows.length = Math.min(rows.length, from);
          return {};
        },
        async append(params) {
          calls.push(`append ${params.range}`);
          rowsOf(params.range).push(...params.requestBody.values.map((row) => row.map(String)));
          return {};
        },
      },
    },
  };
  return { client, tabs, calls };
}

// ---- a fake DynamoDB document client --------------------------------------------------

type DynamoRecord = Record<string, unknown>;

function createFakeDynamo(keySchema: { partitionKey: string; sortKey?: string }) {
  const records = new Map<string, DynamoRecord>();
  const keyOf = (record: DynamoRecord) =>
    JSON.stringify([record[keySchema.partitionKey], keySchema.sortKey ? record[keySchema.sortKey] : null]);
  let batchCalls = 0;
  const PAGE = 2; // small pages, so the paging code is exercised

  // The key attributes of a record, as DynamoDB returns them in LastEvaluatedKey.
  function keyAttributes(record: DynamoRecord): DynamoRecord {
    const key: DynamoRecord = { [keySchema.partitionKey]: record[keySchema.partitionKey] };
    if (keySchema.sortKey) key[keySchema.sortKey] = record[keySchema.sortKey];
    return key;
  }

  function page(matching: DynamoRecord[], startKey: DynamoRecord | undefined) {
    const start = startKey ? matching.findIndex((record) => keyOf(record) === keyOf(startKey)) + 1 : 0;
    const items = matching.slice(start, start + PAGE);
    const more = start + PAGE < matching.length;
    return {
      Items: items.map((record) => structuredClone(record)),
      LastEvaluatedKey: more ? keyAttributes(items[items.length - 1]) : undefined,
    };
  }

  const client: DynamoDbSender = {
    async send(command) {
      if (command instanceof QueryCommand) {
        const input = command.input;
        const wanted = input.ExpressionAttributeValues?.[":name"];
        const matching = [...records.values()].filter((record) => record[keySchema.partitionKey] === wanted);
        const sortKey = keySchema.sortKey as string;
        matching.sort((left, right) => String(left[sortKey]).localeCompare(String(right[sortKey])));
        if (input.ScanIndexForward === false) matching.reverse();
        return page(matching, input.ExclusiveStartKey);
      }
      if (command instanceof ScanCommand) {
        const input = command.input;
        const wanted = input.ExpressionAttributeValues?.[":name"];
        const matching = [...records.values()].filter((record) => record.list === wanted);
        return page(matching, input.ExclusiveStartKey);
      }
      if (command instanceof BatchWriteCommand) {
        batchCalls += 1;
        const requests = Object.values(command.input.RequestItems ?? {})[0] ?? [];
        assert.ok(requests.length <= 25, "never more than 25 writes per batch");
        // The first batch hands one request back as unprocessed, like a busy table would.
        const unprocessed = batchCalls === 1 && requests.length > 1 ? [requests[requests.length - 1]] : [];
        for (const request of requests) {
          if (unprocessed.includes(request)) continue;
          if (request.PutRequest?.Item) records.set(keyOf(request.PutRequest.Item), structuredClone(request.PutRequest.Item));
          if (request.DeleteRequest?.Key) records.delete(keyOf(request.DeleteRequest.Key));
        }
        return { UnprocessedItems: unprocessed.length ? { [Object.keys(command.input.RequestItems ?? {})[0]]: unprocessed } : {} };
      }
      if (command instanceof PutCommand) {
        const item = command.input.Item as DynamoRecord;
        records.set(keyOf(item), structuredClone(item));
        return {};
      }
      throw new Error("Unexpected command");
    },
  };
  return { client, records };
}

// ---- run it --------------------------------------------------------------------------

await runContract("memory", () => createMemoryStorage());

const tempDir = await mkdtemp(path.join(os.tmpdir(), "anhel-storage-"));
try {
  const filePath = path.join(tempDir, "nested", "store.json");
  await runContract("json file", () => createJsonFileStorage({ filePath }));
  const onDisk = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown[]>;
  assert.ok(Array.isArray(onDisk.tasks) && Array.isArray(onDisk.history), "json file: lists are keys of one file");

  // Quick saves in a row must all land (the writes are queued).
  const queued = createJsonFileStorage({ filePath: path.join(tempDir, "queued.json") }).history();
  await Promise.all(
    Array.from({ length: 10 }, (_, index) => queued.append({ at: `2027-01-01T00:00:0${index}.000Z`, username: "sam", text: `n${index}` }))
  );
  assert.equal((await queued.readForUser("sam", 100)).length, 10, "json file: parallel writes are not lost");
  results.push("json file: queued writes ok");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

{
  const fake = createFakeSheets();
  await runContract("google sheets", () =>
    createSheetsStorage({
      sheets: fake.client,
      spreadsheetId: "test-spreadsheet",
      tables: { tasks: taskSheetTable("Task list"), trash: trashSheetTable() },
    })
  );
  assert.deepEqual(fake.tabs.get("Task list")?.[0], taskSheetTable().headers, "google sheets: header row written");
  assert.ok(fake.calls.includes("update 'Task list'!A1"), "google sheets: tab names are quoted in ranges");

  // Rows typed by hand: short rows, "x" for done, no id. They get an id that is written back.
  fake.tabs.set("Task list", [taskSheetTable().headers, ["Hand-made row", "", "", "", "", "x"], [], ["   "]]);
  const storage = createSheetsStorage({ sheets: fake.client, spreadsheetId: "test-spreadsheet", tables: { tasks: taskSheetTable("Task list") } });
  const loaded = await storage.list<Task>("tasks").loadAll();
  assert.equal(loaded.length, 1, "google sheets: empty rows are skipped");
  assert.equal(loaded[0].completed, true, "google sheets: 'x' reads as done");
  assert.match(loaded[0].id, /^[0-9a-f]{8}$/, "google sheets: a missing id is filled in");
  assert.equal(fake.tabs.get("Task list")?.[1][6], loaded[0].id, "google sheets: the new id is written back");

  // Positional columns: a row saved before "Important" existed still reads.
  fake.tabs.set("Task list", [taskSheetTable().headers, ["Old row", "Venue", "2027-02-01", "sam", "", "", "abc12345"]]);
  const oldRow = (await storage.list<Task>("tasks").loadAll())[0];
  assert.equal(oldRow.important, false, "google sheets: a missing later column reads as empty");
  assert.equal(oldRow.id, "abc12345", "google sheets: columns are read by position");

  const guarded = createSheetsStorage({
    sheets: fake.client,
    spreadsheetId: "public-form-sheet",
    protectedSpreadsheetIds: () => ["public-form-sheet"],
    tables: { tasks: taskSheetTable() },
  });
  await assert.rejects(guarded.list<Task>("tasks").loadAll(), /protected/, "google sheets: protected spreadsheets are refused");
  await assert.rejects(storage.list<Task>("unknown").loadAll(), /No sheet table/, "google sheets: unknown list names are refused");
  results.push("google sheets: hand-edited rows, positional columns and guards ok");
}

// The notes, board items and accounts layouts through the Sheets storage: long
// texts are split over several cells, and the sheet is read back as one item.
{
  const fake = createFakeSheets();
  const storage = createSheetsStorage({
    sheets: fake.client,
    spreadsheetId: "test-spreadsheet",
    tables: {
      notes: noteSheetTable(),
      items: boardItemSheetTable(),
      accounts: accountSheetTable<string>((text) => text.split(",").filter(Boolean)),
      wishlist: wishlistSheetTable("Favors", ["guests", "family"]),
    },
  });

  const bigNote: NoteRecord = {
    id: "n1",
    title: "Big",
    color: "#fff3d6",
    updatedAt: "2027-01-01T00:00:00.000Z",
    doc: JSON.stringify({ blocks: [{ id: "a", type: "text", text: "x".repeat(120_000) }] }),
  };
  await storage.list<NoteRecord>("notes").saveAll([bigNote, { ...bigNote, id: "n2", doc: "{}" }]);
  assert.ok((fake.tabs.get("Notes")?.[1].length ?? 0) > 6, "sheets: a long note takes several cells");
  assert.deepEqual(await storage.list<NoteRecord>("notes").loadAll(), [bigNote, { ...bigNote, id: "n2", doc: "{}" }], "sheets: notes come back whole");

  const item: BoardItem = { id: "i1", type: "picture", title: "Cake", link: "", category: "Food", date: "", note: "", image: `data:image/jpeg;base64,${"A".repeat(100_000)}` };
  await storage.list<BoardItem>("items").saveAll([item]);
  assert.deepEqual(await storage.list<BoardItem>("items").loadAll(), [item], "sheets: a picture split over cells comes back whole");

  const account: AccountRecord<string> = { id: "a1", username: "vera", passwordHash: "salt:hash", createdAt: "2027-01-01T00:00:00.000Z", roles: ["viewer", "team"] };
  await storage.list<AccountRecord<string>>("accounts").saveAll([account]);
  assert.deepEqual(await storage.list<AccountRecord<string>>("accounts").loadAll(), [account], "sheets: accounts round-trip");
  const presents: WishlistItem[] = [
    { id: "w1", category: "guests", title: "Candle", description: "Vanilla", link: "https://shop.test/candle", price: "€5", image: "https://cdn.test/candle.jpg" },
    { id: "w2", category: "family", title: "Photo album", description: "", link: "", price: "", image: "" },
  ];
  await storage.list<WishlistItem>("wishlist").saveAll(presents);
  assert.deepEqual(fake.tabs.get("Favors")?.[0], ["Category", "Title", "Description", "Link", "Price", "Picture", "ID"], "sheets: the wishlist tab has its header row");
  assert.deepEqual(fake.tabs.get("Favors")?.[1], ["guests", "Candle", "Vanilla", "https://shop.test/candle", "€5", "https://cdn.test/candle.jpg", "w1"], "sheets: one row per present, in column order");
  assert.deepEqual(await storage.list<WishlistItem>("wishlist").loadAll(), presents, "sheets: the wishlist round-trips");

  // A row typed by hand: the category in any case, and a missing id that is filled in and written back.
  fake.tabs.set("Favors", [fake.tabs.get("Favors")?.[0] ?? [], ["Guests", "Hand-made present"]]);
  const byHand = await storage.list<WishlistItem>("wishlist").loadAll();
  assert.equal(byHand[0].category, "guests", "sheets: a category typed in any case reads as its key");
  assert.match(byHand[0].id, /^[0-9a-f]{8}$/, "sheets: a present without an id gets one");
  assert.equal(fake.tabs.get("Favors")?.[1][6], byHand[0].id, "sheets: the new id is written back");
  results.push("google sheets: notes, board items, accounts and wishlist ok");
}

{
  const fake = createFakeDynamo({ partitionKey: "pk", sortKey: "sk" });
  await runContract("dynamodb (pk + sk, Query)", () => createDynamoDbStorage({ tableName: "app-data", client: fake.client }));
  const stored = [...fake.records.values()].find((record) => record.pk === "tasks");
  assert.ok(stored && stored.sk === "e5" && typeof stored.item === "object", "dynamodb: one record per item, fields under `item`");

  // Many items: more than one batch of 25, plus the retry of an unprocessed write.
  const backend = createDynamoDbStorage({ tableName: "app-data", client: fake.client });
  const many = Array.from({ length: 60 }, (_, index) => task(`t${String(index).padStart(2, "0")}`, `Task ${index}`));
  await backend.list<Task>("big").saveAll(many);
  assert.deepEqual(await backend.list<Task>("big").loadAll(), many, "dynamodb: 60 items in batches, order kept");
  await assert.rejects(backend.list<Task>("big").saveAll([task("", "No id")]), /needs an id/, "dynamodb: items without an id are refused");
  results.push("dynamodb: batches, retries and paging ok");
}

{
  const fake = createFakeDynamo({ partitionKey: "id" });
  await runContract("dynamodb (pk only, Scan)", () =>
    createDynamoDbStorage({ tableName: "app-data", client: fake.client, keySchema: { partitionKey: "id" } })
  );
  assert.ok(fake.records.has(JSON.stringify(["tasks#e5", null])), "dynamodb (scan): key is <list>#<id>");
}

// The real document client fits the adapter's client type (nothing is sent).
const realClient: DynamoDbSender = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-1" }));
assert.equal(typeof realClient.send, "function");

// selectStorage: only the chosen factory runs; unknown names fail loudly.
{
  let fileFactoryCalls = 0;
  const factories = {
    memory: () => createMemoryStorage(),
    file: () => {
      fileFactoryCalls += 1;
      return createMemoryStorage();
    },
  };
  selectStorage(undefined, factories, "memory");
  selectStorage("  ", factories, "memory");
  assert.equal(fileFactoryCalls, 0, "selectStorage: fallback used, other factories untouched");
  selectStorage("file", factories, "memory");
  assert.equal(fileFactoryCalls, 1, "selectStorage: the chosen factory runs");
  assert.throws(() => selectStorage("dynamo", factories, "memory"), /Unknown storage "dynamo"/);
  results.push("selectStorage ok");
}

console.log(results.join("\n"));
