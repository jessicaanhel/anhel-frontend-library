import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
  type BatchWriteCommandOutput,
  type QueryCommandOutput,
  type ScanCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { newId } from "./ids";
import type { HistoryEvent, HistoryStorage, ListStorage, StorageBackend, WithId } from "./types";

// DynamoDB backend (new; the wedding site used Google Sheets). Needs the
// packages @aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb. Credentials
// come from the usual AWS sources (environment, profile, role); none are
// set here.
//
// Every list item is its own DynamoDB record. Two table layouts are supported,
// chosen by `keySchema`:
//
//   partition key + sort key (default "pk" + "sk"): one partition per list.
//     record = { pk: "<list>", sk: "<item id>", position, item }
//     loading a list is a Query on pk = "<list>".
//
//   partition key only (keySchema: { partitionKey: "id" }):
//     record = { id: "<list>#<item id>", list: "<list>", position, item }
//     loading a list is a Scan filtered on list = "<list>" (reads the whole
//     table, so best for small tables).
//
// `item` holds the item's own fields as a map, so they never clash with the
// key attributes. `position` keeps the list order (DynamoDB has none).
// History events are records in the same table, under the history's name.

export type DynamoDbKeySchema = {
  partitionKey: string;
  // Leave out for a table with only a partition key (Scan layout).
  sortKey?: string;
};

// The part of DynamoDBDocumentClient that is used (also easy to fake in tests).
export type DynamoDbSender = {
  send(command: QueryCommand | ScanCommand | BatchWriteCommand | PutCommand): Promise<unknown>;
};

export type DynamoDbStorageOptions = {
  tableName: string;
  // Used when no `client` is passed. Default: the AWS SDK's own lookup (AWS_REGION...).
  region?: string;
  // A ready DynamoDBDocumentClient (custom endpoint, credentials, or a fake in tests).
  client?: DynamoDbSender;
  // Default { partitionKey: "pk", sortKey: "sk" }. Must match the table.
  keySchema?: DynamoDbKeySchema;
};

type StoredRecord = Record<string, unknown> & { position?: number; item?: unknown; event?: unknown };

// BatchWriteItem takes at most 25 requests at a time.
const BATCH_SIZE = 25;
const MAX_BATCH_ATTEMPTS = 5;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createDynamoDbStorage(options: DynamoDbStorageOptions): StorageBackend {
  const tableName = options.tableName;
  const keySchema = options.keySchema ?? { partitionKey: "pk", sortKey: "sk" };
  const usesSortKey = Boolean(keySchema.sortKey);

  // Created on first use, so importing this file never touches AWS.
  let client: DynamoDbSender | null = options.client ?? null;
  function getClient(): DynamoDbSender {
    if (!client) {
      const base = new DynamoDBClient(options.region ? { region: options.region } : {});
      client = DynamoDBDocumentClient.from(base, { marshallOptions: { removeUndefinedValues: true } });
    }
    return client;
  }

  // The key attributes of one record in a list (or history) called `name`.
  function keyFor(name: string, recordId: string): Record<string, string> {
    if (keySchema.sortKey) return { [keySchema.partitionKey]: name, [keySchema.sortKey]: recordId };
    return { [keySchema.partitionKey]: `${name}#${recordId}` };
  }

  // Every record of the list (or history) called `name`, all pages.
  async function readRecords(name: string, newestFirst = false): Promise<StoredRecord[]> {
    const records: StoredRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      let page: QueryCommandOutput | ScanCommandOutput;
      if (usesSortKey) {
        page = (await getClient().send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "#pk = :name",
            ExpressionAttributeNames: { "#pk": keySchema.partitionKey },
            ExpressionAttributeValues: { ":name": name },
            ScanIndexForward: !newestFirst,
            ExclusiveStartKey: startKey,
          })
        )) as QueryCommandOutput;
      } else {
        page = (await getClient().send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "#list = :name",
            ExpressionAttributeNames: { "#list": "list" },
            ExpressionAttributeValues: { ":name": name },
            ExclusiveStartKey: startKey,
          })
        )) as ScanCommandOutput;
      }
      for (const record of page.Items ?? []) records.push(record as StoredRecord);
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return records;
  }

  // Sends write requests 25 at a time. DynamoDB may hand back some requests
  // as "unprocessed" when it is busy; those are retried with a growing pause.
  async function batchWrite(requests: Record<string, unknown>[]) {
    for (let start = 0; start < requests.length; start += BATCH_SIZE) {
      let pending = requests.slice(start, start + BATCH_SIZE);
      for (let attempt = 1; pending.length > 0; attempt += 1) {
        if (attempt > MAX_BATCH_ATTEMPTS) throw new Error("DynamoDB kept refusing some writes; try again later.");
        const result = (await getClient().send(
          new BatchWriteCommand({ RequestItems: { [tableName]: pending } })
        )) as BatchWriteCommandOutput;
        pending = (result.UnprocessedItems?.[tableName] ?? []) as Record<string, unknown>[];
        if (pending.length > 0) await wait(100 * 2 ** attempt);
      }
    }
  }

  // The item id stored in a record's key.
  function recordId(record: StoredRecord, name: string) {
    if (keySchema.sortKey) return String(record[keySchema.sortKey] ?? "");
    return String(record[keySchema.partitionKey] ?? "").slice(name.length + 1);
  }

  function list<T extends WithId>(name: string): ListStorage<T> {
    return {
      async loadAll() {
        const records = await readRecords(name);
        records.sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0));
        const items: T[] = [];
        for (const record of records) {
          if (record.item && typeof record.item === "object") items.push(record.item as T);
        }
        return items;
      },

      // Every item is written (its position may have changed), then the
      // records of items that are no longer in the list are deleted. Writing
      // first means an interrupted save can't lose items, at worst it leaves
      // a removed one behind.
      async saveAll(items) {
        // The id is part of the record key, and DynamoDB refuses empty keys.
        if (items.some((item) => !item.id)) throw new Error(`Every item in "${name}" needs an id before it is saved.`);
        const existing = await readRecords(name);
        const keep = new Set(items.map((item) => item.id));

        const puts = items.map((item, position) => ({
          PutRequest: {
            Item: {
              ...keyFor(name, item.id),
              ...(usesSortKey ? {} : { list: name }),
              position,
              item,
            },
          },
        }));
        await batchWrite(puts);

        const deletes: Record<string, unknown>[] = [];
        for (const record of existing) {
          const id = recordId(record, name);
          if (!keep.has(id)) deletes.push({ DeleteRequest: { Key: keyFor(name, id) } });
        }
        await batchWrite(deletes);
      },
    };
  }

  function history(name = "history"): HistoryStorage {
    return {
      async append(event) {
        // The record id starts with the time, so a Query on the partition
        // returns events in time order; the random part keeps two events in
        // the same millisecond apart.
        await getClient().send(
          new PutCommand({
            TableName: tableName,
            Item: { ...keyFor(name, `${event.at}#${newId()}`), ...(usesSortKey ? {} : { list: name }), event },
          })
        );
      },
      async readForUser(username, limit) {
        const records = await readRecords(name, true);
        const events: HistoryEvent[] = [];
        for (const record of records) {
          if (record.event && typeof record.event === "object") events.push(record.event as HistoryEvent);
        }
        // Newest first. A Query already returns them that way; a Scan does not.
        events.sort((left, right) => right.at.localeCompare(left.at));
        return events.filter((event) => event.username === username).slice(0, limit);
      },
    };
  }

  return { list, history };
}
