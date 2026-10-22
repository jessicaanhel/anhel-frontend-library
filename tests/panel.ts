// Checks the pure logic and the server handlers behind the planning-panel
// components: notes, picture sizes, the pyramid, the month calendar, search,
// notifications, per-person prices, links, the menu tree, the calendar feed,
// accounts and permissions, the trash and the board items. Everything runs in
// Node with plain web Request/Response objects and the in-memory storage; no
// framework, no network.
import assert from "node:assert/strict";
import { verifyPassword } from "../src/server/auth";
import { categoriesOf, emptyBoardItem, formatItemDate, groupItemsByCategory, linkSource, type BoardItem } from "../src/components/board-overview";
import { monthCells, weekdayLabels } from "../src/components/mini-calendar";
import { firstNavPage, navPageTitle, visibleNavTree, type NavNode } from "../src/components/grouped-nav";
import { addLink, asWebAddress, hostOf } from "../src/components/link-chips";
import { buildNotifications, daysUntil } from "../src/components/notifications";
import { DRAW_HEIGHT, MAX_NOTE_CHARS, cleanNoteDoc, noteFillPercent, noteToPlainText, previewOf, type NoteRecord } from "../src/components/notes-pad";
import { effectiveGuestCount, perPersonTotal, round2, withPerPersonTotals } from "../src/components/per-person-price";
import { pyramidLayers } from "../src/components/pyramid-chart";
import { choiceOptions, emptyQuizQuestion, normaliseAnswer, scoreQuiz, type QuizQuestion } from "../src/components/quiz";
import { roleCanOpen, type RolePreviewRole } from "../src/components/role-preview";
import { searchSections } from "../src/components/search-dialog";
import type { Task } from "../src/components/task-list";
import { trashDaysLeft } from "../src/components/trash-panel";
import { WISHLIST_LIMITS, emptyWishlistItem, fillFromPreview, itemsOfCategory, prepareWishlistItem, type WishlistItem } from "../src/components/wishlist";
import { createPermissionModel, type Permissions } from "../src/permissions";
import { nextAttempt, scaledSize } from "../src/shrinkPicture";
import { createAccountHandlers, createPermissionsHandlers, type AccountRecord } from "../src/server/accounts";
import { buildCalendar, createCalendarFeed, escapeIcsText, foldIcsLine, taskCalendarEvents } from "../src/server/calendar";
import { cleanBoardItem, createBoardItemHandlers, createTrash, createTrashHandlers, type TrashEntry } from "../src/server/lists";
import { activeGrantsFor, createGrantHandlers, daysLeft, hasGrant, isGrantActive, isGrantDate, type Grant } from "../src/server/grants";
import { fetchLinkPreview, isPrivateAddress, parsePreview } from "../src/server/link-preview";
import { createNotesHandlers } from "../src/server/notes";
import { createMemoryStorage } from "../src/server/storage";
import { accountSheetTable, boardItemSheetTable, grantSheetTable, noteSheetTable, wishlistSheetTable } from "../src/server/storage/google-sheets";
import { cleanWishlistItem, createWishlistHandlers } from "../src/server/wishlist";

const results: string[] = [];

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { id, title, category: "", due: "", assigned: "", notes: "", completed: false, important: false, ...extra };
}

// A request from a fake signed-in person: the header says who. The handlers
// only see the session that `getSession` returns, so no login is needed here.
function asPerson(name: string, roles: string[], body?: unknown, method = "GET", url = "http://localhost/api/x") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", "x-user": name, "x-roles": roles.join(",") },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function fakeSession(request: Request) {
  const name = request.headers.get("x-user");
  return name ? { username: name, roles: (request.headers.get("x-roles") ?? "").split(",").filter(Boolean) } : null;
}

// ---- notes ----------------------------------------------------------------------------------

{
  const doc = cleanNoteDoc({
    blocks: [
      { id: "a", type: "text", text: "Hello" },
      { id: "b", type: "draw", strokes: [{ c: "#112233", w: 999, p: [1.4, 2.6, 30, 40] }, { c: "nope", w: 0, e: 1, p: [5, 5] }, { p: [1] }, { p: [1, 2, 3] }] },
      { id: "c", type: "image", src: "data:image/png;base64,AAAA" },
      { id: "d", type: "sticker", emoji: "🎉" },
    ],
  });
  assert.ok(doc, "a valid document is accepted");
  assert.equal(doc.blocks.length, 4);
  const strokes = (doc.blocks[1] as { strokes: { c: string; w: number; e?: number; p: number[] }[] }).strokes;
  assert.equal(strokes.length, 2, "strokes without points, or with an odd number of coordinates, are dropped");
  assert.deepEqual(strokes[0], { c: "#112233", w: 60, p: [1, 3, 30, 40] }, "width capped, points rounded");
  assert.deepEqual(strokes[1], { c: "#2d302b", w: 4, e: 1, p: [5, 5] }, "bad colour and width get defaults, eraser kept");

  assert.equal(cleanNoteDoc({ blocks: [{ id: "a", type: "script" }] }), null, "unknown block types are refused");
  assert.equal(cleanNoteDoc({ blocks: [{ type: "text", text: "no id" }] }), null, "a block needs an id");
  assert.equal(cleanNoteDoc({ blocks: [{ id: "a", type: "image", src: "javascript:alert(1)" }] }), null, "only data images and https links");
  assert.equal(cleanNoteDoc({ blocks: [{ id: "a", type: "image", src: "http://example.com/a.png" }] }), null, "https only");
  assert.equal(cleanNoteDoc({ blocks: Array.from({ length: 61 }, (_, index) => ({ id: String(index), type: "text", text: "" })) }), null, "too many blocks");
  assert.equal(cleanNoteDoc({ blocks: [{ id: "a", type: "text", text: "x".repeat(5000) }] }, { maxChars: 1000 }), null, "too big for the limit");
  assert.equal(cleanNoteDoc(null), null);

  assert.equal(previewOf({ blocks: [{ id: "1", type: "text", text: "  Buy   the\nribbons " }] }), "Buy the ribbons");
  assert.equal(previewOf({ blocks: [{ id: "1", type: "draw", strokes: [] }] }), "Drawing");
  assert.equal(previewOf({ blocks: [{ id: "1", type: "image", src: "https://x.test/a.png" }] }, { picture: "Foto" }), "Foto");
  assert.equal(previewOf({ blocks: [] }), "");

  const plain = noteToPlainText("Plan", [
    { id: "1", type: "text", text: "First" },
    { id: "2", type: "sticker", emoji: "✨" },
    { id: "3", type: "image", src: "https://x.test/a.png" },
    { id: "4", type: "image", src: "data:image/png;base64,AAAA" },
    { id: "5", type: "draw", strokes: [] },
  ]);
  assert.equal(plain, "Plan\n\nFirst\n\n✨\n\nhttps://x.test/a.png\n\n(picture)\n\n(drawing)");
  assert.equal(noteToPlainText("", []), "Untitled");
  assert.equal(noteFillPercent([{ id: "1", type: "text", text: "x".repeat(1000) }], 2000) >= 50, true);
  assert.equal(DRAW_HEIGHT, 600);
  results.push("notes document ok");
}

{
  const backend = createMemoryStorage();
  const history = backend.history();
  const handlers = createNotesHandlers({
    storage: backend.list<NoteRecord>("notes"),
    getSession: fakeSession,
    authorize: (session) => session.username !== "blocked",
    history,
    maxNotes: 2,
    maxChars: 5000,
  });
  const put = (note: unknown, name = "sam") => handlers.PUT(asPerson(name, [], { note }, "PUT"));

  assert.equal((await handlers.GET(new Request("http://localhost/api/notes"))).status, 401, "notes: not signed in");
  assert.equal((await handlers.GET(asPerson("blocked", []))).status, 403, "notes: authorize");

  const created = (await (await put({ title: "  Ideas ", color: "#fff3d6", doc: { blocks: [{ id: "a", type: "text", text: "Roses" }] } })).json()) as { note: NoteRecord };
  assert.equal(created.note.title, "Ideas");
  assert.equal(created.note.color, "#fff3d6");
  assert.match(created.note.id, /^[0-9a-f]{8}$/, "the server gives the id");

  const second = (await (await put({ title: "", color: "red", doc: { blocks: [] } })).json()) as { note: NoteRecord };
  assert.equal(second.note.title, "Untitled", "no title: the default one");
  assert.equal(second.note.color, "#fffdf6", "a colour that is not offered becomes the first one");
  assert.equal((await put({ title: "Third", doc: { blocks: [] } })).status, 400, "maxNotes is enforced for new notes");

  const bigDoc = { blocks: [{ id: "a", type: "text", text: "y".repeat(6000) }] };
  const tooBig = await put({ id: created.note.id, title: "Ideas", doc: bigDoc });
  assert.equal(tooBig.status, 400, "a note over maxChars is refused");
  assert.match(((await tooBig.json()) as { error: string }).error, /too big/);

  // The list is sorted by the time of the last save, so give the clock a moment to move on.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await put({ id: created.note.id, title: "Ideas 2", doc: { blocks: [{ id: "a", type: "text", text: "Roses and peonies" }] } });
  const listed = (await (await handlers.GET(asPerson("sam", []))).json()) as { notes: { id: string; title: string; preview: string }[] };
  assert.equal(listed.notes.length, 2, "saving with an id updates instead of adding");
  assert.equal(listed.notes[0].id, created.note.id, "newest first");
  assert.equal(listed.notes[0].preview, "Roses and peonies", "the list has a preview, not the content");
  assert.ok(!("doc" in listed.notes[0]), "the list has no content");

  const whole = (await (await handlers.GET(asPerson("sam", [], undefined, "GET", `http://localhost/api/notes?id=${created.note.id}`))).json()) as { note: NoteRecord };
  assert.equal(JSON.parse(whole.note.doc).blocks[0].text, "Roses and peonies", "?id= returns the whole note");
  assert.equal((await handlers.GET(asPerson("sam", [], undefined, "GET", "http://localhost/api/notes?id=nope"))).status, 404);

  assert.equal((await handlers.DELETE(asPerson("sam", [], { id: "nope" }, "DELETE"))).status, 404);
  assert.equal((await handlers.DELETE(asPerson("sam", [], { id: second.note.id }, "DELETE"))).status, 200);
  assert.equal((await backend.list<NoteRecord>("notes").loadAll()).length, 1, "deleted for good");

  const lines = (await history.readForUser("sam", 10)).map((event) => event.text).reverse();
  assert.deepEqual(lines, ["Started the note “Ideas”", "Started the note “Untitled”", "Deleted the note “Untitled”"]);
  assert.equal(MAX_NOTE_CHARS, 400_000);
  results.push("notes handlers ok");
}

// ---- picture sizes ----------------------------------------------------------------------------

{
  assert.deepEqual(scaledSize(4000, 2000, 640), { width: 640, height: 320 });
  assert.deepEqual(scaledSize(300, 200, 640), { width: 300, height: 200 }, "a small picture is never enlarged");
  assert.deepEqual(scaledSize(1, 5000, 640), { width: 1, height: 640 }, "never below one pixel");
  assert.deepEqual(nextAttempt({ longestSide: 640, quality: 0.7 }), { longestSide: 512, quality: 0.6 });
  assert.equal(nextAttempt({ longestSide: 100, quality: 0.35 }).quality, 0.3, "quality stops at 0.3");
  results.push("picture sizes ok");
}

// ---- pyramid ------------------------------------------------------------------------------------

{
  const layers = pyramidLayers([
    { label: "Venue", value: 10 },
    { label: "Food", value: 30 },
    { label: "venue", value: 20 },
    { label: " ", value: 10 },
    { label: "Music", value: 0 },
    { label: "Broken", value: Number.NaN },
  ]);
  assert.deepEqual(layers.map((layer) => layer.label), ["Other", "Food", "Venue"], "from the tip down: the biggest ends up at the bottom");
  assert.equal(layers[2].total, 30, "the same label, in any case, is added up");
  assert.deepEqual(layers.map((layer) => layer.colourIndex), [2, 1, 0], "the biggest layer gets the first colour");
  assert.equal(layers[0].top, 0, "the first layer starts at the tip");
  assert.equal(layers[2].bottom, 1, "the last layer ends at the base");
  for (const layer of layers) {
    // The area of a layer is its share: depth squared is proportional to area.
    assert.ok(Math.abs(layer.bottom ** 2 - layer.top ** 2 - layer.share) < 1e-9, `${layer.label}: area equals share`);
  }
  assert.deepEqual(pyramidLayers([]), []);
  assert.deepEqual(pyramidLayers([{ label: "A", value: 0 }]), [], "nothing to add up: no layers");
  assert.equal(pyramidLayers([{ label: "", value: 5 }], "Rest")[0].label, "Rest", "the label for items without one");
  results.push("pyramid ok");
}

// ---- month calendar ----------------------------------------------------------------------------------

{
  // 1 June 2027 is a Tuesday.
  const sundayFirst = monthCells({
    year: 2027,
    month: 5,
    todayIso: "2027-06-12",
    marked: new Set(["2027-06-12", "2027-06-20"]),
    counts: new Map([["2027-06-20", 3]]),
  });
  assert.equal(sundayFirst.length, 42, "always six weeks");
  assert.deepEqual(sundayFirst.slice(0, 3).map((cell) => [cell.day, cell.outside]), [[30, true], [31, true], [1, false]]);
  assert.equal(sundayFirst[2].iso, "2027-06-01");
  const twelfth = sundayFirst.find((cell) => cell.iso === "2027-06-12");
  assert.ok(twelfth?.today && twelfth.marked, "today and marked");
  assert.equal(sundayFirst.find((cell) => cell.iso === "2027-06-20")?.count, 3, "count badge");
  assert.equal(sundayFirst.filter((cell) => cell.outside && (cell.marked || cell.count || cell.today)).length, 0, "days of other months carry no marks");
  assert.equal(sundayFirst[41].day, 10, "the last cell is 10 July (2 + 30 + 10 = 42 cells)");

  const mondayFirst = monthCells({ year: 2027, month: 5, weekStartsOn: 1 });
  assert.equal(mondayFirst[1].day, 1, "with Monday first, the 1st is in the second column");
  assert.deepEqual(weekdayLabels(["S", "M", "T", "W", "T", "F", "S"], 1), ["M", "T", "W", "T", "F", "S", "S"]);
  assert.equal(monthCells({ year: 2027, month: 1 }).filter((cell) => !cell.outside).length, 28, "February 2027 has 28 days");
  assert.equal(monthCells({ year: 2028, month: 1 }).filter((cell) => !cell.outside).length, 29, "and 2028 has 29");
  results.push("month calendar ok");
}

// ---- search ----------------------------------------------------------------------------------------------

{
  const sections = [
    { title: "Task", hits: [{ id: "1", label: "Call the florist", detail: "Decor", data: { page: "tasks" } }, { id: "2", label: "Book DJ" }] },
    { title: "Guest", hits: [{ id: "3", label: "Alex Florist", detail: "table 4" }, { id: "4", label: "Sam", detail: "friend of the florist" }] },
  ];
  assert.deepEqual(searchSections(sections, "  ", 15), [], "nothing for an empty query");
  const found = searchSections(sections, "FLORIST");
  assert.deepEqual(found.map((hit) => hit.id), ["1", "3", "4"], "label or detail, any case, in section order");
  assert.deepEqual(found[0].data, { page: "tasks" }, "the app's data comes back");
  assert.equal(found[0].section, "Task");
  assert.deepEqual(searchSections(sections, "guest").map((hit) => hit.id), ["3", "4"], "the section title is searched too");
  assert.equal(searchSections(sections, "o", 2).length, 2, "limit");
  results.push("search ok");
}

// ---- notifications ------------------------------------------------------------------------------------------

{
  assert.equal(daysUntil("2027-03-15", "2027-03-15"), 0);
  assert.equal(daysUntil("2027-03-15", "2027-03-18"), 3);
  assert.equal(daysUntil("2027-03-15", "2027-03-10"), -5);
  assert.equal(daysUntil("2027-02-27", "2027-03-01"), 2, "across a month end");

  const tasks = [
    task("1", "New one", { assigned: "Sam" }),
    task("2", "Overdue one", { assigned: "sam", due: "2027-03-10" }),
    task("3", "Tomorrow", { assigned: "SAM", due: "2027-03-16" }),
    task("4", "In five days", { assigned: "sam", due: "2027-03-20" }),
    task("5", "Someone else's", { assigned: "alex", due: "2027-03-15" }),
    task("6", "Done", { assigned: "sam", due: "2027-03-10", completed: true }),
    task("7", "Today", { assigned: "sam", due: "2027-03-15" }),
  ];
  const seen = new Set(["2", "3", "4", "7"]);
  const list = buildNotifications({ tasks, username: "Sam", todayIso: "2027-03-15", seen });
  assert.deepEqual(
    list.map((note) => [note.kind, note.text]),
    [
      ["assigned", "New one"],
      ["overdue", "Overdue one (was due 2027-03-10)"],
      ["due", "Tomorrow"],
      ["due", "Today"],
    ],
    "new first, then overdue, then deadlines; others' and done tasks are left out"
  );
  assert.equal(list[2].title, "Due tomorrow");
  assert.equal(list[3].title, "Due today");
  assert.equal(list[1].key, "due:2:2027-03-10:overdue", "the key follows the deadline");
  assert.equal(buildNotifications({ tasks, username: "sam", todayIso: "2027-03-15", seen, dueSoonDays: 7 }).length, 5, "dueSoonDays widens the window");
  assert.equal(
    buildNotifications({ tasks, username: "sam", todayIso: "2027-03-15", seen, texts: { due: (days) => `in ${days}d` } })[2].title,
    "in 1d",
    "texts can be replaced"
  );
  results.push("notifications ok");
}

// ---- per-person prices -------------------------------------------------------------------------------------------

{
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(perPersonTotal(12.5, 80), 1000);
  assert.equal(perPersonTotal(33.33, 3), 99.99);
  assert.deepEqual(effectiveGuestCount(120, 80), { count: 120, auto: false }, "a saved number wins");
  assert.deepEqual(effectiveGuestCount(0, 80), { count: 80, auto: true }, "0 follows the guest list");
  assert.deepEqual(effectiveGuestCount(0, 0), { count: 1, auto: true }, "never below one guest");
  const items = [
    { name: "Dinner", perPerson: 50, estimated: 0 },
    { name: "Cake", perPerson: 0, estimated: 300 },
    { name: "DJ", estimated: 800 },
  ];
  const updated = withPerPersonTotals(items, 10, "estimated");
  assert.deepEqual(updated.map((item) => item.estimated), [500, 300, 800], "only per-person items are recalculated");
  assert.equal(items[0].estimated, 0, "the original items are not changed");
  const plain = [{ perPerson: 0, estimated: 1 }];
  assert.equal(withPerPersonTotals(plain, 10, "estimated"), plain, "the same array when nothing is per person");
  results.push("per-person prices ok");
}

// ---- links ---------------------------------------------------------------------------------------------------------

{
  assert.equal(hostOf("https://www.shop.com/a/b?c=1"), "shop.com");
  assert.equal(hostOf("not a link"), "not a link");
  assert.equal(asWebAddress("www.shop.com/dress"), "https://www.shop.com/dress");
  assert.equal(asWebAddress(" http://shop.com "), "http://shop.com");
  assert.equal(asWebAddress("hello"), "", "no dot in the host: not an address");
  assert.equal(asWebAddress("two words.com"), "");
  assert.equal(asWebAddress("javascript:alert(1)"), "", "no other schemes");
  assert.deepEqual(addLink([], "shop.com"), { links: ["https://shop.com"], added: true, invalid: false });
  assert.deepEqual(addLink(["https://shop.com"], "shop.com"), { links: ["https://shop.com"], added: false, invalid: false }, "no duplicates");
  assert.deepEqual(addLink(["https://a.com"], "nonsense"), { links: ["https://a.com"], added: false, invalid: true });
  assert.equal(addLink(["https://a.com", "https://b.com"], "c.com", 2).added, false, "a full list takes no more");
  assert.deepEqual(addLink([], "  "), { links: [], added: false, invalid: false });
  results.push("links ok");
}

// ---- menu tree -----------------------------------------------------------------------------------------------------

{
  const tree: NavNode[] = [
    { key: "home", title: "Home", permission: "tab:home" },
    {
      group: "Planning",
      pages: [
        { key: "tasks", title: "Tasks", permission: "tab:tasks" },
        { key: "budget", title: "Budget", permission: "tab:budget" },
      ],
    },
    { group: "Private", pages: [{ key: "secret", title: "Secret", permission: "tab:secret" }] },
  ];
  const visible = visibleNavTree(tree, { "tab:tasks": true });
  assert.equal(visible.length, 1, "pages without access and empty groups disappear");
  assert.deepEqual("group" in visible[0] && visible[0].pages.map((page) => page.key), ["tasks"], "a group keeps only its allowed pages");
  assert.equal(firstNavPage(tree, { "tab:tasks": true, "tab:home": true }), "home", "the first page in menu order");
  assert.equal(firstNavPage(tree, { "tab:budget": true }), "budget", "...or the first one inside a group");
  assert.equal(firstNavPage(tree, {}), null, "nothing to open");
  assert.equal(navPageTitle(tree, "budget"), "Budget");
  assert.equal(navPageTitle(tree, "missing"), "missing");
  results.push("menu tree ok");
}

// ---- calendar feed -------------------------------------------------------------------------------------------------

{
  assert.equal(escapeIcsText("a;b,c\\d\ne"), "a\;b\\,c\\\\d\\ne", "semicolons, commas, backslashes and newlines are escaped");

  // Folding: no line over 75 bytes, and no character cut in half.
  const long = `SUMMARY:${"é".repeat(120)}😀${"x".repeat(80)}`;
  const folded = foldIcsLine(long);
  for (const physical of folded.split("\r\n")) assert.ok(Buffer.byteLength(physical) <= 75, "folded lines are at most 75 bytes");
  assert.equal(folded.replace(/\r\n /g, ""), long, "unfolding gives the original line back");

  const now = new Date("2027-01-01T10:00:00Z");
  const ics = buildCalendar({
    name: "Tasks (Sam, Alex)",
    prodId: "-//Test//Tasks//EN",
    now,
    refreshHours: 2,
    events: [
      { uid: "day@test", date: "2027-12-31", summary: "New Year's Eve; party", location: "Home" },
      { uid: "task-1@test", date: "2027-06-12", summary: "Deadline: Pay", free: true, reminder: { text: "Tomorrow: Pay" } },
    ],
  });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"), "ics header");
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"), "ics footer and final newline");
  assert.ok(ics.includes("X-WR-CALNAME:Tasks (Sam\\, Alex)"), "the name is escaped");
  assert.ok(ics.includes("REFRESH-INTERVAL;VALUE=DURATION:PT2H"));
  assert.ok(ics.includes("DTSTAMP:20270101T100000Z"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101"), "an all-day event ends on the next day, also over a year end");
  assert.ok(ics.includes("SUMMARY:New Year's Eve\; party"));
  assert.ok(ics.includes("LOCATION:Home"));
  assert.equal(ics.split("BEGIN:VEVENT").length - 1, 2);
  assert.equal(ics.split("BEGIN:VALARM").length - 1, 1, "only the event with a reminder has one");
  assert.ok(ics.includes("TRIGGER:-PT15H"), "the default reminder: 09:00 the day before");
  assert.equal(ics.split("TRANSP:TRANSPARENT").length - 1, 1, "only the free event is transparent");

  const events = taskCalendarEvents(
    [
      task("1", "Pay the venue", { due: "2027-06-12", category: "Venue" }),
      task("2", "Done already", { due: "2027-06-12", completed: true }),
      task("3", "No date"),
      task("4", "Odd date", { due: "12/06/2027" }),
    ],
    { username: "Sam", uidDomain: "my-app" }
  );
  assert.equal(events.length, 1, "only open tasks with a proper deadline");
  assert.equal(events[0].uid, "task-1@my-app");
  assert.equal(events[0].summary, "Deadline: Pay the venue");
  assert.equal(events[0].description, "Venue · assigned to Sam");
  assert.equal(events[0].reminder?.text, "Tomorrow: Pay the venue");
  assert.equal(taskCalendarEvents([task("1", "A", { due: "2027-06-12" })], { username: "Sam", reminderHoursBefore: null })[0].reminder, undefined, "null: no reminder");

  const people = new Map([["Sam", [task("1", "Pay", { due: "2027-06-12" })]]]);
  const feed = createCalendarFeed({
    secret: () => "test-only-calendar-secret",
    name: (username) => `Tasks (${username})`,
    prodId: "-//Test//Tasks//EN",
    eventsFor: async (username) => (people.has(username) ? taskCalendarEvents(people.get(username)!, { username }) : null),
    fileName: "tasks.ics",
    logError: () => undefined,
  });
  const token = feed.tokenFor("Sam");
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "the token is safe to put in a URL");
  assert.equal(feed.usernameFromToken(token), "Sam");
  const [name, signature] = token.split(".");
  assert.equal(feed.usernameFromToken(`${Buffer.from("Robin").toString("base64url")}.${signature}`), null, "a changed name fails the signature");
  assert.equal(feed.usernameFromToken(`${name}.x${signature.slice(1)}`), null, "a changed signature fails");
  assert.equal(feed.usernameFromToken("nonsense"), null);
  const otherFeed = createCalendarFeed({ secret: "another-secret", name: () => "x", prodId: "x", eventsFor: async () => [] });
  assert.equal(otherFeed.usernameFromToken(token), null, "a token from another secret is refused");

  const response = await feed.respond(`${token}.ics`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/calendar; charset=utf-8");
  assert.equal(response.headers.get("Content-Disposition"), 'inline; filename="tasks.ics"');
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok((await response.text()).includes("SUMMARY:Deadline: Pay"));
  assert.equal((await feed.respond(token)).status, 200, "the .ics ending is optional");
  assert.equal((await feed.respond("garbage.token")).status, 404, "a bad token is a 404");
  assert.equal((await feed.respond(feed.tokenFor("Removed"))).status, 404, "a person who no longer exists is a 404");
  results.push("calendar feed ok");
}

// ---- accounts and permissions ----------------------------------------------------------------------------------------

type Role = "owner" | "editor" | "viewer" | "team";

const roles = [
  { key: "owner" as const, label: "Owner" },
  { key: "editor" as const, label: "Editor" },
  { key: "viewer" as const, label: "Viewer" },
  { key: "team" as const, label: "Team" },
];

const model = createPermissionModel<Role>({
  roles,
  adminRole: "owner",
  permissions: [
    { key: "tab:tasks", label: "Tasks", group: "Tabs" },
    { key: "tab:accounts", label: "Accounts", group: "Tabs" },
    { key: "tab:surprise", label: "Surprise", group: "Tabs", secret: true },
  ],
  defaults: { "tab:tasks": ["editor", "viewer"], "tab:accounts": ["editor"], "tab:surprise": ["team"] },
  // Editors may only give the "team" role.
  grantableRoles: (given) => (given.includes("owner") ? ["editor", "viewer", "team"] : given.includes("editor") ? ["team"] : []),
});

{
  const backend = createMemoryStorage();
  const storage = backend.list<AccountRecord<Role>>("accounts");
  const handlers = createAccountHandlers<Role>({
    model,
    storage,
    getSession: async (request) => {
      const session = await fakeSession(request);
      return session ? { username: session.username, roles: session.roles as Role[] } : null;
    },
    authorize: (session) => session.roles.includes("owner") || session.roles.includes("editor"),
    maxAccounts: 3,
    isReservedName: (name) => name.toLowerCase() === "boss",
    logError: () => undefined,
  });
  const call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", who: [string, Role[]], body?: unknown) =>
    handlers[method](asPerson(who[0], who[1], body, method));
  const owner: [string, Role[]] = ["boss", ["owner"]];
  const editor: [string, Role[]] = ["eddie", ["editor"]];

  assert.equal((await handlers.GET(new Request("http://localhost/api/accounts"))).status, 403, "accounts: not signed in");
  assert.equal((await call("GET", ["vera", ["viewer"]])).status, 403, "accounts: authorize");

  const first = (await (await call("POST", owner, { roles: ["owner", "editor", "bogus"] })).json()) as {
    username: string;
    password: string;
    users: { username: string; roles: Role[] }[];
    count: number;
    max: number;
    grantable: Role[];
  };
  assert.match(first.username, /^user\d{3}$/, "a username is generated");
  assert.equal(first.users[0].roles.join(), "editor", "the admin role can't be given, unknown roles are dropped");
  assert.equal(first.count, 1);
  assert.equal(first.max, 3);
  assert.deepEqual(first.grantable, ["editor", "viewer", "team"]);
  const [stored] = await storage.loadAll();
  assert.notEqual(stored.passwordHash, first.password, "only a hash is kept");
  assert.ok(verifyPassword(first.password, stored.passwordHash), "the password that was shown works");
  assert.ok(!JSON.stringify(first.users).includes("passwordHash"), "the hash never leaves the server");

  assert.equal((await call("POST", owner, { username: "a!" })).status, 400, "username pattern");
  assert.equal((await call("POST", owner, { username: first.username.toUpperCase() })).status, 400, "taken names, in any case");
  assert.equal((await call("POST", owner, { username: "Boss" })).status, 400, "reserved names");

  await call("POST", owner, { username: "vera", roles: ["viewer"] });
  const byEditor = (await (await call("POST", editor, { username: "tina", roles: ["viewer"] })).json()) as { users: { username: string; roles: Role[] }[] };
  assert.deepEqual(byEditor.users.map((user) => [user.username, user.roles.join()]), [["tina", "team"]], "an editor's account always gets a role they may give, and they see only those");
  const full = await call("POST", owner, { username: "extra" });
  assert.equal(full.status, 400, "maxAccounts counts every account, also the ones this person does not see");
  assert.equal((await call("POST", ["vera", ["viewer", "editor"]], { username: "x1" })).status, 400, "the limit applies to editors as well");

  const asEditor = (await (await call("GET", editor)).json()) as { users: { username: string }[] };
  assert.deepEqual(asEditor.users.map((user) => user.username), ["tina"], "an editor sees only accounts whose roles they could give");
  assert.equal((await call("PUT", editor, { username: "vera", roles: ["team"] })).status, 404, "...and can't change the others");
  assert.equal((await call("PATCH", editor, { username: "vera" })).status, 404);
  assert.equal((await call("DELETE", editor, { username: "vera" })).status, 404);

  const emptied = (await (await call("PUT", editor, { username: "tina", roles: [] })).json()) as { users: { roles: Role[] }[] };
  assert.equal(emptied.users[0].roles.join(), "team", "an editor can't leave an account without a role");
  const ownerEmptied = (await (await call("PUT", owner, { username: "vera", roles: [] })).json()) as { users: { username: string; roles: Role[] }[] };
  assert.equal(ownerEmptied.users.find((user) => user.username === "vera")?.roles.length, 0, "the admin can");

  const before = (await storage.loadAll()).find((account) => account.username === "vera")!.passwordHash;
  const reset = (await (await call("PATCH", owner, { username: "vera" })).json()) as { username: string; password: string };
  const after = (await storage.loadAll()).find((account) => account.username === "vera")!;
  assert.notEqual(after.passwordHash, before, "a new password replaces the hash");
  assert.ok(verifyPassword(reset.password, after.passwordHash));

  const removed = (await (await call("DELETE", owner, { username: "vera" })).json()) as { count: number };
  assert.equal(removed.count, 2);
  assert.equal((await call("DELETE", owner, { username: "vera" })).status, 404, "already gone");

  const noGrant = createAccountHandlers<Role>({
    model,
    storage,
    getSession: async () => ({ username: "x", roles: ["viewer"] }),
    authorize: () => true,
    maxAccounts: 10,
  });
  assert.equal((await noGrant.POST(asPerson("x", ["viewer"], {}, "POST"))).status, 403, "a person who may give no role can't create accounts");
  results.push("accounts handlers ok");
}

{
  let saved: Permissions<Role> = { "tab:tasks": ["team"] };
  let changed = 0;
  const history = createMemoryStorage().history();
  const handlers = createPermissionsHandlers<Role>({
    model,
    getSession: async (request) => {
      const session = await fakeSession(request);
      return session ? { username: session.username, roles: session.roles as Role[] } : null;
    },
    canView: (session) => session.roles.includes("editor") || session.roles.includes("owner"),
    loadSaved: async () => saved,
    save: async (permissions) => {
      saved = permissions;
    },
    onChanged: () => {
      changed += 1;
    },
    history,
    logError: () => undefined,
  });

  const viewed = (await (await handlers.GET(asPerson("eddie", ["editor"]))).json()) as { permissions: Permissions<Role> };
  assert.deepEqual(viewed.permissions["tab:tasks"], ["team"], "saved values on top of the defaults");
  assert.deepEqual(viewed.permissions["tab:accounts"], ["editor"], "defaults for the rest");
  assert.ok(!("tab:surprise" in viewed.permissions), "secret permissions are never sent");
  assert.equal((await handlers.GET(asPerson("vera", ["viewer"]))).status, 403, "canView");
  assert.equal((await handlers.PUT(asPerson("eddie", ["editor"], { key: "tab:tasks", roles: [] }, "PUT"))).status, 403, "only the admin role changes it");

  const put = (body: unknown) => handlers.PUT(asPerson("boss", ["owner"], body, "PUT"));
  const answer = (await (await put({ key: "tab:tasks", roles: ["viewer", "owner", "bogus", "viewer"] })).json()) as { permissions: Permissions<Role> };
  assert.deepEqual(answer.permissions["tab:tasks"], ["viewer"], "unknown roles, the admin role and repeats are dropped");
  assert.deepEqual(saved["tab:tasks"], ["viewer"]);
  assert.equal(changed, 1, "onChanged is called after a save");
  assert.equal((await put({ key: "tab:surprise", roles: ["viewer"] })).status, 400, "a secret permission can't be changed");
  assert.equal((await put({ key: "tab:nothing", roles: [] })).status, 400, "unknown keys are refused");
  assert.equal(changed, 1);
  await put({ key: "tab:accounts", roles: [] });
  const lines = (await history.readForUser("boss", 5)).map((event) => event.text).reverse();
  assert.deepEqual(lines, ["Permission “Tasks”: viewer", "Permission “Accounts”: admin only"]);
  results.push("permissions handlers ok");
}

// ---- trash ---------------------------------------------------------------------------------------------------------------

{
  assert.equal(trashDaysLeft("2027-01-01T00:00:00Z", 7, new Date("2027-01-01T00:00:00Z").getTime()), 7, "a new entry has all its days");
  assert.equal(trashDaysLeft("2027-01-01T00:00:00Z", 7, new Date("2027-01-03T12:00:00Z").getTime()), 5, "rounded up");
  assert.equal(trashDaysLeft("2027-01-01T00:00:00Z", 7, new Date("2027-02-01T00:00:00Z").getTime()), 0, "never below 0");

  const backend = createMemoryStorage({ initial: { tasks: [task("t0", "Already here")] } });
  const trash = createTrash(backend.list<TrashEntry>("trash"));
  await trash.put("task", "Call the florist", "sam", task("t1", "Call the florist"));
  await trash.put("mystery", "No home", "sam", { id: "m1" });
  const handlers = createTrashHandlers({
    trash,
    targets: { task: backend.list<Task>("tasks") },
    getSession: fakeSession,
    authorize: (session) => session.username === "sam",
    logError: () => undefined,
  });
  const call = (method: "GET" | "POST" | "DELETE", body?: unknown, who = "sam") => handlers[method](asPerson(who, [], body, method));

  assert.equal((await handlers.GET(new Request("http://localhost/api/trash"))).status, 401);
  assert.equal((await call("GET", undefined, "alex")).status, 403, "trash: authorize");
  const entries = ((await (await call("GET")).json()) as { entries: TrashEntry[] }).entries;
  assert.equal(entries.length, 2);

  const task1 = entries.find((entry) => entry.kind === "task")!;
  const restored = (await (await call("POST", { id: task1.id })).json()) as { entries: TrashEntry[] };
  assert.equal(restored.entries.length, 1, "the entry leaves the trash");
  assert.deepEqual((await backend.list<Task>("tasks").loadAll()).map((item) => item.id), ["t1", "t0"], "the item is back at the top of its list");

  const mystery = restored.entries[0];
  assert.equal((await call("POST", { id: mystery.id })).status, 404, "a kind without a target can't be restored");
  assert.equal((await trash.list()).length, 1, "...and stays in the trash");
  assert.equal((await call("POST", { id: "nope" })).status, 404);
  assert.equal((await call("POST", {})).status, 400, "an id is needed");
  assert.equal((await call("DELETE", { id: mystery.id })).status, 200, "but it can be deleted for good");
  assert.equal((await trash.list()).length, 0);
  assert.equal((await call("DELETE", { id: mystery.id })).status, 404);

  // The item goes back BEFORE the entry leaves the trash: a failed save loses nothing.
  await trash.put("task", "Keep me", "sam", task("t2", "Keep me"));
  const failing = {
    loadAll: async () => [] as Task[],
    saveAll: async () => {
      throw new Error("disk full");
    },
  };
  const entry = (await trash.list())[0];
  await assert.rejects(trash.restore(entry.id, failing), /disk full/);
  assert.equal((await trash.list()).length, 1, "a failed restore leaves the entry in the trash");
  results.push("trash handlers ok");
}

// ---- board items ----------------------------------------------------------------------------------------------------------

{
  assert.equal(cleanBoardItem({ title: "" }), null, "a title is required");
  assert.equal(cleanBoardItem({ title: "Doc", link: "javascript:alert(1)" }), null, "a link must be http or https");
  assert.equal(cleanBoardItem({ title: "Doc", link: "ftp://x.test/file" }), null);
  assert.equal(cleanBoardItem({ title: "Pic", image: "data:image/svg+xml;base64,AAAA" }), null, "only jpeg, png and webp pictures");
  assert.equal(cleanBoardItem({ title: "Pic", image: `data:image/jpeg;base64,${"A".repeat(200)}` }, { maxImageChars: 100 }), null, "a picture over the limit");
  const item = cleanBoardItem({ title: " Flight ", type: "ticket", link: "https://air.test/x", date: "11 Jun 2027", category: "Flights", note: "Window", image: "data:image/png;base64,AAAA", extra: "ignored" });
  assert.deepEqual(item, { type: "ticket", title: "Flight", link: "https://air.test/x", category: "Flights", date: "2027-06-11", note: "Window", image: "data:image/png;base64,AAAA" });
  assert.equal(cleanBoardItem({ title: "A", type: "weird" })?.type, "link", "an unknown type becomes the first one");
  assert.equal(cleanBoardItem({ title: "A", type: "idea" }, { types: ["note", "idea"] })?.type, "idea", "own item types");

  const backend = createMemoryStorage();
  const history = backend.history();
  const handlers = createBoardItemHandlers({
    storage: backend.list<BoardItem>("items"),
    getSession: fakeSession,
    history,
    boardName: "Bride Board",
    logError: () => undefined,
  });
  const put = (body: unknown) => handlers.PUT(asPerson("sam", [], { item: body }, "PUT"));
  const created = (await (await put({ title: "Seating plan", type: "link", link: "https://docs.test/s" })).json()) as { items: BoardItem[] };
  await put({ ...created.items[0], category: "Planning" });
  assert.equal((await put({ title: "Bad", link: "nope" })).status, 400);
  const lines = (await history.readForUser("sam", 5)).map((event) => event.text).reverse();
  assert.deepEqual(lines, ["Added a link “Seating plan” to the Bride Board", "Edited “Seating plan” on the Bride Board: category → Planning"]);

  const items: BoardItem[] = [
    emptyBoardItem({ id: "1", title: "Zebra", category: "Flights" }),
    emptyBoardItem({ id: "2", title: "Later flight", category: "Flights", date: "2027-06-12" }),
    emptyBoardItem({ id: "3", title: "Sooner flight", category: "Flights", date: "2027-06-10" }),
    emptyBoardItem({ id: "4", title: "Loose" }),
    emptyBoardItem({ id: "5", title: "Speech", category: "Speeches" }),
  ];
  const groups = groupItemsByCategory(items, "Not sorted");
  assert.deepEqual(groups.map((group) => group.name), ["Flights", "Speeches", "Not sorted"], "groups by name, unsorted last");
  assert.deepEqual(groups[0].items.map((entry) => entry.id), ["3", "2", "1"], "dated items first, soonest first, then by title");
  assert.deepEqual(categoriesOf(items), ["Flights", "Speeches"]);
  assert.equal(linkSource("https://docs.google.com/spreadsheets/d/abc/edit"), "Google Sheet");
  assert.equal(linkSource("https://www.figma.com/board/abc"), "Figma");
  assert.equal(linkSource("https://www.example.org/page"), "example.org");
  assert.equal(linkSource("nope"), "");
  assert.equal(formatItemDate("2027-06-11"), "Fri, 11 Jun 2027");
  assert.equal(formatItemDate("soon"), "");
  results.push("board items ok");
}

// ---- role preview ---------------------------------------------------------------------------------------------------------

{
  const role: RolePreviewRole = { id: "r", label: "Helper", story: "Helps", permissions: ["tab:tasks"], can: [] };
  assert.equal(roleCanOpen(role, { title: "Tasks", permission: "tab:tasks" }), true);
  assert.equal(roleCanOpen(role, { title: "Budget", permission: "tab:budget" }), false);
  assert.equal(roleCanOpen(role, { title: "My information" }), true, "a page without a permission is open to everyone");
  results.push("role preview ok");
}

// ---- Google Sheet layouts of the new lists ---------------------------------------------------------------------------------

{
  const notes = noteSheetTable();
  const doc = JSON.stringify({ blocks: [{ id: "a", type: "text", text: "é".repeat(100_000) }] });
  const note: NoteRecord = { id: "n1", title: "Big note", color: "#fff3d6", updatedAt: "2027-01-01T00:00:00.000Z", doc };
  const row = notes.toRow(note).map(String);
  assert.ok(row.length > 5, "a long note is split over several cells");
  assert.ok(row.slice(4).every((piece) => piece.length <= 45_000), "no cell is over the chunk size");
  assert.deepEqual(notes.fromRow(row), note, "the pieces are joined again, unchanged");
  assert.equal(notes.fromRow(["Old", "#fff", "2027", "n2"]).doc, "", "a note without content reads as empty");

  const items = boardItemSheetTable();
  const withPicture = emptyBoardItem({ id: "i1", type: "ticket", title: "Flight", link: "https://air.test", category: "Flights", date: "2027-06-11", note: "n", image: `data:image/jpeg;base64,${"A".repeat(100_000)}` });
  assert.deepEqual(items.fromRow(items.toRow(withPicture).map(String)), withPicture, "an item with a long picture round-trips");
  assert.equal(items.fromRow(["WEIRD", "T", "", "", "", "", "i2"]).type, "link", "an unknown type reads as the first");

  const accounts = accountSheetTable<Role>((text) => model.parseRoles(text));
  const account: AccountRecord<Role> = { id: "a1", username: "vera", passwordHash: "salt:hash", createdAt: "2027-01-01T00:00:00.000Z", roles: ["viewer", "team"] };
  assert.deepEqual(accounts.fromRow(accounts.toRow(account).map(String)), account);
  assert.deepEqual(accounts.fromRow(["old", "s:h", "2026", "Editor; nonsense"]).roles, ["editor"], "roles typed by hand are read forgivingly");
  assert.equal(accounts.fromRow(["old", "s:h", "2026", "viewer"]).id, "", "an old row without an id gets one on the next read");
  const wishlist = wishlistSheetTable("Favors", ["guests", "family"]);
  const present: WishlistItem = { id: "w1", category: "guests", title: "Candle", description: "Vanilla", link: "https://shop.test/c", price: "€5", image: "https://cdn.test/c.jpg" };
  assert.deepEqual(wishlist.headers, ["Category", "Title", "Description", "Link", "Price", "Picture", "ID"]);
  assert.deepEqual(wishlist.toRow(present), ["guests", "Candle", "Vanilla", "https://shop.test/c", "€5", "https://cdn.test/c.jpg", "w1"], "columns in the documented order");
  assert.deepEqual(wishlist.fromRow(wishlist.toRow(present).map(String)), present, "a present round-trips");
  const byHand = wishlist.fromRow([" Family ", "  Photo album ", "", "not a link", "", "ftp://x.test/a.jpg"]);
  assert.deepEqual(byHand, { id: "", category: "family", title: "Photo album", description: "", link: "", price: "", image: "" }, "typed by hand: the category in any case, a link that is not a web address read as empty, a missing id");
  assert.equal(wishlistSheetTable().fromRow(["Other", "x"]).category, "Other", "without keys the category is kept as typed");
  assert.equal(wishlist.fromRow(["Somewhere", "x"]).category, "Somewhere", "an unknown category is kept as typed");
  results.push("sheet layouts ok");
}

// ---- link preview (server) --------------------------------------------------------------------------------------------------
// Only the pure parts and the checks that run before any request is sent. The real fetch needs the network and is
// not part of the tests.

{
  const privateAddresses = [
    "0.0.0.0", "10.1.2.3", "127.0.0.1", "100.64.0.1", "100.127.255.255", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "192.0.0.1", "198.18.0.1", "198.19.255.255", "224.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    // an IPv4 address written as IPv6, in the dotted form and in the hexadecimal form Node's URL parser gives back
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:c0a8:101", "::FFFF:7F00:1",
  ];
  for (const address of privateAddresses) assert.equal(isPrivateAddress(address), true, `${address} is private`);

  const publicAddresses = [
    "8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255", "100.128.0.1", "198.17.255.255", "198.20.0.1", "192.169.0.1",
    "2606:4700:4700::1111", "::ffff:8.8.8.8", "::ffff:808:808",
  ];
  for (const address of publicAddresses) assert.equal(isPrivateAddress(address), false, `${address} is public`);

  // Each of these is refused before a request is made (and before any name lookup, so no network is needed).
  const blocked: [address: string, reason: RegExp][] = [
    ["http://localhost/", /not public/],
    ["http://127.0.0.1/", /not public/],
    ["http://169.254.169.254/latest/meta-data/", /not public/],
    ["http://[::1]/", /not public/],
    ["http://[::ffff:127.0.0.1]/", /not public/],
    ["http://[::ffff:169.254.169.254]/", /not public/],
    ["http://10.0.0.5/", /not public/],
    ["http://2130706433/", /not public/],
    ["http://shop.localhost/", /not public/],
    ["http://metadata.internal/", /not public/],
    ["http://printer.local/", /not public/],
    ["https://example.com:8080/", /port/],
    ["https://example.com:22/", /port/],
    ["https://user:pass@example.com/", /login/],
    ["ftp://example.com/file", /web addresses/],
    ["file:///etc/passwd", /web addresses/],
  ];
  for (const [address, reason] of blocked) await assert.rejects(fetchLinkPreview(address), reason, `${address} is blocked`);
  await assert.rejects(fetchLinkPreview("not a web address"), TypeError, "something that is not an address is refused");

  const page = new URL("https://www.shop.test/products/candle");

  // Open Graph: entities are decoded, a relative picture is made absolute, the site name is read.
  const og = parsePreview(
    `<html><head><title>Fallback title</title>
      <meta property="og:title" content="Candle &amp; holder &#8211; &#x4C;arge">
      <meta property="og:description" content="A &quot;calm&quot; scent,   in
        two lines">
      <meta content="/images/candle.jpg" property="og:image">
      <meta property="og:site_name" content="Shop &amp; Co">
    </head></html>`,
    page
  );
  assert.equal(og.title, "Candle & holder – Large");
  assert.equal(og.description, 'A "calm" scent, in two lines', "quotes are decoded and white space is collapsed");
  assert.equal(og.image, "https://www.shop.test/images/candle.jpg", "a relative picture is resolved against the page");
  assert.equal(og.siteName, "Shop & Co");
  assert.equal(og.price, "");

  // Without Open Graph tags: the <title>, and the host (without www) as the site name.
  const plain = parsePreview("<head><title>  Plain   page </title><meta name='description' content='Single quotes'></head>", page);
  assert.equal(plain.title, "Plain page");
  assert.equal(plain.description, "Single quotes");
  assert.equal(plain.siteName, "shop.test");

  // A picture on plain http is dropped (a page on https would not show it); an https one on another host is kept.
  assert.equal(parsePreview('<meta property="og:image" content="http://cdn.test/a.jpg">', page).image, "", "http picture dropped");
  assert.equal(parsePreview('<meta property="og:image" content="https://cdn.test/a.jpg">', page).image, "https://cdn.test/a.jpg");
  assert.equal(parsePreview('<meta property="og:image" content="//cdn.test/a.jpg">', page).image, "https://cdn.test/a.jpg", "a protocol-relative picture follows the page");

  // The price from product meta tags, with a dot or a comma as the decimal sign.
  const product = '<meta property="product:price:amount" content="24.90"><meta property="product:price:currency" content="EUR">';
  assert.equal(parsePreview(product, page).price, "€24.90");
  assert.equal(parsePreview(product.replace("24.90", "24,90"), page).price, "€24.90");
  assert.equal(parsePreview('<meta property="og:price:amount" content="12"><meta property="og:price:currency" content="XYZ1">', page).price, "XYZ1 12", "an unknown currency is shown as given");

  // The price from JSON-LD, here inside an @graph next to other nodes.
  const graph = {
    "@context": "https://schema.org",
    "@graph": [{ "@type": "WebSite", name: "Shop" }, { "@type": "Product", name: "Candle", offers: { "@type": "Offer", price: "19.5", priceCurrency: "USD" } }],
  };
  assert.equal(parsePreview(`<script type="application/ld+json">${JSON.stringify(graph)}</script>`, page).price, "$19.50");
  const offerList = { "@type": "Product", offers: [{ "@type": "Offer", priceSpecification: { price: 7, priceCurrency: "EUR" } }] };
  assert.equal(parsePreview(`<script type="application/ld+json">${JSON.stringify(offerList)}</script>`, page).price, "€7.00", "a list of offers with a price specification");

  // Broken JSON-LD is ignored: no error, and a later good block still counts.
  const broken = '<script type="application/ld+json">{ "offers": { "price": </script>';
  assert.equal(parsePreview(broken, page).price, "");
  const good = `<script type="application/ld+json">${JSON.stringify({ offers: { price: "3", priceCurrency: "EUR" } })}</script>`;
  assert.equal(parsePreview(broken + good, page).price, "€3.00");
  results.push("link preview ok");
}

// ---- wishlist ----------------------------------------------------------------------------------------------------------------

{
  // The pure helpers of the component.
  const empty = emptyWishlistItem({ category: "guests" });
  assert.deepEqual(empty, { id: "", category: "guests", title: "", description: "", link: "", price: "", image: "" });

  const typed = emptyWishlistItem({ category: "guests", title: "My own title", price: "" });
  const filled = fillFromPreview(typed, { title: "Page title", description: "From the page", price: "€5.00", image: "https://cdn.test/p.jpg" });
  assert.equal(filled.title, "My own title", "a typed title is kept");
  assert.deepEqual([filled.description, filled.price, filled.image], ["From the page", "€5.00", "https://cdn.test/p.jpg"], "empty fields are filled in");
  assert.equal(fillFromPreview(typed, {}).description, "", "a missing part of the preview leaves the field empty");

  const items = [emptyWishlistItem({ id: "1", category: "a" }), emptyWishlistItem({ id: "2", category: "b" }), emptyWishlistItem({ id: "3", category: "a" })];
  assert.deepEqual(itemsOfCategory(items, "a").map((item) => item.id), ["1", "3"]);

  const prepared = prepareWishlistItem(emptyWishlistItem({ title: "  Candle ", link: "www.shop.test/candle", image: "http://cdn.test/c.jpg", price: " 5 " }));
  assert.ok("item" in prepared);
  assert.deepEqual(
    [prepared.item.title, prepared.item.link, prepared.item.image, prepared.item.price],
    ["Candle", "https://www.shop.test/candle", "https://cdn.test/c.jpg", "5"],
    "texts trimmed, a link without https gets it, a picture on http becomes https"
  );
  assert.deepEqual(prepareWishlistItem(emptyWishlistItem({ title: "x", link: "not a link" })), { problem: "link" });
  assert.deepEqual(prepareWishlistItem(emptyWishlistItem({ title: "x", image: "nope nope" })), { problem: "picture" });
  const noLink = prepareWishlistItem(emptyWishlistItem({ title: "x" }));
  assert.ok("item" in noLink && noLink.item.link === "" && noLink.item.image === "", "link and picture are optional");

  // The clean function of the endpoint.
  const keys = ["guests", "family"];
  assert.equal(cleanWishlistItem({ category: "elsewhere", title: "Candle" }, keys), null, "an unknown category is refused");
  assert.equal(cleanWishlistItem({ category: "guests", title: "   " }, keys), null, "a title is required");
  assert.equal(cleanWishlistItem("nope", keys), null);
  assert.equal(cleanWishlistItem(null, keys), null);
  const cleaned = cleanWishlistItem(
    {
      category: "guests",
      title: ` ${"T".repeat(150)} `,
      description: "D".repeat(500),
      link: "javascript:alert(1)",
      price: "P".repeat(50),
      image: "http://cdn.test/plain-http.jpg",
      id: "ignored",
      extra: "ignored",
    },
    keys
  );
  assert.ok(cleaned);
  assert.deepEqual(
    cleaned,
    { category: "guests", title: "T".repeat(WISHLIST_LIMITS.title), description: "D".repeat(WISHLIST_LIMITS.description), link: "", price: "P".repeat(WISHLIST_LIMITS.price), image: "" },
    "lengths limited, a link that is not http(s) and a picture that is not https dropped, other fields ignored"
  );
  assert.equal(cleanWishlistItem({ category: "guests", title: "a", link: "ftp://x.test/f" }, keys)?.link, "");
  assert.equal(cleanWishlistItem({ category: "guests", title: "a", link: "http://shop.test/a", image: "https://cdn.test/a.png" }, keys)?.link, "http://shop.test/a");
  assert.equal(cleanWishlistItem({ category: "guests", title: "a", image: "https://cdn.test/a.png" }, keys)?.image, "https://cdn.test/a.png");
  results.push("wishlist helpers ok");
}

// The endpoint: a person only deals with the items of the categories they may see. Here a person's roles are the
// categories they may see, so "sam" sees the guests list and "vera" the family list.
{
  const categories = [
    { key: "guests", label: "Guests" },
    { key: "family", label: "Family" },
    { key: "groom", label: "Groom" },
  ];
  const backend = createMemoryStorage();
  const history = backend.history();
  const storage = backend.list<WishlistItem>("wishlist");
  const handlers = createWishlistHandlers({
    storage,
    getSession: fakeSession,
    history,
    categories,
    canSee: (category, session) => session.roles.includes(category),
    wishlistName: "favors",
    logError: () => undefined,
  });

  const everything = ["guests", "family", "groom"];
  const put = (who: string, roles: string[], item: unknown) => handlers.PUT(asPerson(who, roles, { item }, "PUT"));
  const remove = (who: string, roles: string[], id: string) => handlers.DELETE(asPerson(who, roles, { id }, "DELETE"));
  const list = async (who: string, roles: string[]) => ((await (await handlers.GET(asPerson(who, roles))).json()) as { items: WishlistItem[] }).items;
  const stored = async () => storage.loadAll(); // what is really saved, hidden items included

  // The bride (sees every list) adds one present to three lists.
  for (const [category, title] of [["guests", "Candle"], ["family", "Photo album"], ["groom", "Cufflinks"]]) {
    assert.equal((await put("bride", everything, { category, title })).status, 200);
  }
  const all = await list("bride", everything);
  assert.deepEqual(all.map((item) => item.title), ["Cufflinks", "Photo album", "Candle"], "newest first");
  const candle = all.find((item) => item.title === "Candle") as WishlistItem;
  const album = all.find((item) => item.title === "Photo album") as WishlistItem;
  const cufflinks = all.find((item) => item.title === "Cufflinks") as WishlistItem;

  // Listing: only the categories this person may see.
  assert.deepEqual((await list("sam", ["guests"])).map((item) => item.title), ["Candle"], "a present on a hidden list is not listed");
  assert.deepEqual((await list("vera", ["family"])).map((item) => item.title), ["Photo album"]);
  assert.deepEqual((await list("both", ["guests", "family"])).map((item) => item.title), ["Photo album", "Candle"]);

  // A person who may see no list at all is refused on every call.
  assert.equal((await handlers.GET(asPerson("nobody", []))).status, 403);
  assert.equal((await put("nobody", [], { category: "guests", title: "Sneaky" })).status, 403);
  assert.equal((await remove("nobody", [], candle.id)).status, 403);
  assert.equal((await handlers.GET(new Request("http://localhost/api/x"))).status, 401, "signed out: 401");

  // Creating on a hidden list is refused and nothing is saved.
  assert.equal((await put("sam", ["guests"], { category: "groom", title: "Sneaky" })).status, 403, "cannot create on a hidden list");
  assert.equal((await stored()).length, 3);

  // Moving one of their own presents to a hidden list is refused too, and the present stays where it was.
  assert.equal((await put("sam", ["guests"], { ...candle, category: "groom" })).status, 403, "cannot move to a hidden list");
  assert.equal((await stored()).find((item) => item.id === candle.id)?.category, "guests");

  // A present on a hidden list does not exist for them. Saving it with its own (hidden) list is refused like any
  // present on a hidden list; pulling it onto a visible list, or removing it, is "not found".
  assert.equal((await put("sam", ["guests"], { ...cufflinks, title: "Changed" })).status, 403, "cannot be changed while it is hidden");
  assert.equal((await put("sam", ["guests"], { ...cufflinks, category: "guests" })).status, 404, "cannot be pulled onto a visible list");
  assert.equal((await remove("sam", ["guests"], cufflinks.id)).status, 404, "cannot be removed while it is hidden");
  assert.equal((await remove("sam", ["guests"], album.id)).status, 404, "a hidden list's present answers like one that does not exist");
  assert.deepEqual((await stored()).find((item) => item.id === cufflinks.id), cufflinks, "the hidden present is untouched");
  assert.equal((await stored()).length, 3);

  // What they do see, they may change: and the reply only holds what they may see.
  const changed = (await (await put("sam", ["guests"], { ...candle, price: "€5" })).json()) as { items: WishlistItem[] };
  assert.deepEqual(changed.items.map((item) => item.title), ["Candle"], "the reply leaves out the hidden lists");
  assert.equal(changed.items[0].price, "€5");
  const added = (await (await put("sam", ["guests"], { category: "guests", title: "Napkins" })).json()) as { items: WishlistItem[] };
  assert.deepEqual(added.items.map((item) => item.title), ["Napkins", "Candle"]);
  assert.equal((await stored()).length, 4, "the hidden presents are kept when someone else saves");

  // A person who sees two lists can move a present between them; a person who sees one list sees it leave.
  const moved = (await (await put("both", ["guests", "family"], { ...candle, price: "€5", category: "family" })).json()) as { items: WishlistItem[] };
  assert.equal(moved.items.find((item) => item.id === candle.id)?.category, "family");
  assert.deepEqual((await list("sam", ["guests"])).map((item) => item.title), ["Napkins"], "a present moved to a hidden list is gone for them");

  // Removing a visible present works and reports only the visible rest.
  const afterRemove = (await (await remove("vera", ["family"], album.id)).json()) as { items: WishlistItem[] };
  assert.deepEqual(afterRemove.items.map((item) => item.title), ["Candle"]);
  assert.deepEqual((await stored()).map((item) => item.title).sort(), ["Candle", "Cufflinks", "Napkins"]);

  // Bad input.
  assert.equal((await put("sam", ["guests"], { category: "nowhere", title: "Lost" })).status, 400, "an unknown list");
  assert.equal((await put("sam", ["guests"], { category: "guests", title: "" })).status, 400, "no title");

  // The history lines use the lists' labels and the name given to the wishlist.
  const lines = (await history.readForUser("both", 5)).map((event) => event.text);
  assert.deepEqual(lines, ["Edited “Candle”: list → Family"]);
  const samLines = (await history.readForUser("sam", 5)).map((event) => event.text).reverse();
  assert.deepEqual(samLines, ["Edited “Candle”: price → €5", "Added “Napkins” to the Guests favors"]);
  assert.deepEqual((await history.readForUser("vera", 5)).map((event) => event.text), ["Removed “Photo album” from the Family favors"]);
  results.push("wishlist handlers ok");
}

// ---- grants (per-person access with a deadline) ------------------------------------------------------------------------------

{
  const grant = (id: string, username: string, key: string, expiresAt: string): Grant => ({ id, username, key, expiresAt, grantedBy: "mentor", createdAt: "2026-10-01T00:00:00.000Z" });
  const forever = grant("g1", "Vera", "course-1", "");
  const untilFirst = grant("g2", "vera", "course-2", "2026-12-01");
  const typo = grant("g3", "vera", "course-3", "soon");
  const someoneElse = grant("g4", "sam", "course-1", "2026-12-31");
  const all = [forever, untilFirst, typo, someoneElse];

  assert.ok(isGrantDate("2026-02-28") && !isGrantDate("2026-02-30") && !isGrantDate("1 Dec 2026") && !isGrantDate(""));
  assert.ok(isGrantActive(forever, "2099-01-01"), "no deadline: always active");
  assert.ok(isGrantActive(untilFirst, "2026-12-01"), "the deadline day itself is still active");
  assert.ok(!isGrantActive(untilFirst, "2026-12-02"), "the day after: expired");
  assert.ok(!isGrantActive(typo, "2000-01-01"), "a deadline that is not a date counts as expired");

  assert.deepEqual(activeGrantsFor(all, "VERA", "2026-11-15").map((item) => item.id), ["g1", "g2"], "own active grants, username in any case");
  assert.deepEqual(activeGrantsFor(all, "vera", "2026-12-02").map((item) => item.id), ["g1"]);
  assert.ok(hasGrant(all, "vera", "course-2", "2026-12-01"));
  assert.ok(!hasGrant(all, "vera", "course-2", "2026-12-02"));
  assert.ok(!hasGrant(all, "vera", "course-3", "2026-01-01"));
  assert.ok(!hasGrant(all, "sam", "course-2", "2026-11-01"), "another person's key does not count");

  assert.equal(daysLeft(forever, "2026-11-01"), null, "no deadline: null");
  assert.equal(daysLeft(untilFirst, "2026-12-01"), 1, "the last day counts as one");
  assert.equal(daysLeft(untilFirst, "2026-11-29"), 3);
  assert.equal(daysLeft(untilFirst, "2026-12-05"), 0, "expired: 0");
  assert.equal(daysLeft(grant("g5", "a", "b", "2027-04-01"), "2027-03-20"), 13, "across a daylight saving change");

  const sheet = grantSheetTable();
  assert.deepEqual(sheet.headers, ["Username", "Key", "Expires", "Granted by", "Created", "ID"]);
  assert.deepEqual(sheet.fromRow(sheet.toRow(untilFirst).map(String)), untilFirst, "a grant round-trips");
  assert.equal(sheet.fromRow(["vera", "k", ""]).expiresAt, "", "an empty cell: no deadline");
  assert.equal(sheet.fromRow(["vera", "k", "next week"]).expiresAt, "next week", "an unreadable deadline is kept, and so counts as expired");
  results.push("grant helpers ok");
}

{
  const storage = createMemoryStorage().list<Grant>("grants");
  let day = "2026-11-30";
  const handlers = createGrantHandlers({
    storage,
    getSession: fakeSession,
    canManage: (session) => session.roles.includes("admin"),
    today: () => day,
    logError: () => undefined,
  });
  const give = (who: string, roles: string[], body: unknown) => handlers.POST(asPerson(who, roles, body, "POST"));
  const listFor = async (who: string, roles: string[]) => ((await (await handlers.GET(asPerson(who, roles))).json()) as { grants: Grant[] }).grants;

  assert.equal((await handlers.GET(new Request("http://localhost/api/x"))).status, 401, "signed out: 401");
  assert.equal((await give("vera", ["member"], { username: "vera", key: "course-1", expiresAt: "" })).status, 403, "a member cannot give access");
  assert.equal((await give("mentor", ["admin"], { username: "vera", key: "course-1", expiresAt: "2026-02-30" })).status, 400, "not a real date");
  assert.equal((await give("mentor", ["admin"], { username: "", key: "course-1", expiresAt: "" })).status, 400, "no username");

  const first = (await (await give("mentor", ["admin"], { username: "vera", key: "course-1", expiresAt: "2026-12-01" })).json()) as { grant: Grant };
  assert.equal(first.grant.grantedBy, "mentor");
  await give("mentor", ["admin"], { username: "vera", key: "course-2", expiresAt: "" });
  await give("mentor", ["admin"], { username: "sam", key: "course-1", expiresAt: "2026-11-01" });
  const again = (await (await give("mentor", ["admin"], { username: "Vera", key: "course-1", expiresAt: "2026-12-15" })).json()) as { grant: Grant; grants: Grant[] };
  assert.equal(again.grant.id, first.grant.id, "the same person and key: the grant is changed, not doubled");
  assert.equal(again.grants.length, 3);

  assert.equal((await listFor("mentor", ["admin"])).length, 3, "a manager sees every grant");
  assert.deepEqual((await listFor("vera", ["member"])).map((item) => item.key).sort(), ["course-1", "course-2"], "a member sees their own");
  assert.deepEqual(await listFor("sam", ["member"]), [], "an expired grant is not listed for its person");
  day = "2026-12-16";
  assert.deepEqual((await listFor("vera", ["member"])).map((item) => item.key), ["course-2"], "after the deadline only the grant without one is left");

  assert.equal((await handlers.DELETE(asPerson("vera", ["member"], { id: first.grant.id }, "DELETE"))).status, 403);
  assert.equal((await handlers.DELETE(asPerson("mentor", ["admin"], { id: "nope" }, "DELETE"))).status, 404);
  assert.equal((await handlers.DELETE(asPerson("mentor", ["admin"], { id: first.grant.id }, "DELETE"))).status, 200);
  assert.equal((await storage.loadAll()).length, 2);
  results.push("grant handlers ok");
}

// ---- quiz scoring -----------------------------------------------------------------------------------------------------------

{
  const questions: QuizQuestion[] = [
    { id: "q1", prompt: "Capital of Ukraine?", kind: "text", answer: "Київ" },
    { id: "q2", prompt: "2 + 2?", kind: "choice", options: ["3", "4", ""], answer: "4" },
    { id: "q3", prompt: "What did you learn?", kind: "text" },
    { id: "q4", prompt: "Say hello", kind: "text", answer: "Good  Morning" },
    { id: "q5", prompt: "Blank expected", kind: "text", answer: "   " },
  ];
  const score = scoreQuiz(questions, { q1: "  київ ", q2: "3", q3: "a lot", q4: "good\nmorning" });
  assert.deepEqual(score, { correct: 2, total: 3, results: { q1: true, q2: false, q3: null, q4: true, q5: null } }, "case and spaces ignored; open questions not counted");
  assert.equal(scoreQuiz(questions, {}).correct, 0, "no answers: nothing right");
  assert.deepEqual(scoreQuiz([], {}), { correct: 0, total: 0, results: {} });
  assert.equal(normaliseAnswer("  Ї\tЖАК  "), "ї жак");
  assert.equal(normaliseAnswer("é"), normaliseAnswer("é"), "an accent typed separately counts as the same letter");
  assert.deepEqual(choiceOptions(questions[1]), ["3", "4"], "empty options are not shown");
  assert.deepEqual(emptyQuizQuestion("choice").options, ["", ""]);
  results.push("quiz scoring ok");
}

console.log(results.join("\n"));
