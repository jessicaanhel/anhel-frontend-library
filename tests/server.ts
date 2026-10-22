// Checks the server-side and pure pieces: permissions, login and sessions,
// the list route handlers (with the in-memory storage), and the helpers of
// the task list, the Pinterest boards and the Figma board. Everything runs in
// Node with plain web Request/Response objects; no framework, no network.
import assert from "node:assert/strict";
import { figmaEmbedUrl, isFigmaLink } from "../src/components/figma-board";
import { cleanBoard, cleanTags, isEmbeddableBoard, pinterestLink, tagCounts } from "../src/components/pinterest-boards";
import { filterTasks, isInPeriod, sortTasks, type Task } from "../src/components/task-list";
import { createPermissionModel } from "../src/permissions";
import { createAuth, generatePassword, hashPassword, verifyPassword } from "../src/server/auth";
import { createListHandlers, createTaskListHandlers, createTrash, isoDate, listChanges, type TrashEntry } from "../src/server/lists";
import { createMemoryStorage } from "../src/server/storage";

const results: string[] = [];

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { id, title, category: "", due: "", assigned: "", notes: "", completed: false, important: false, ...extra };
}

// ---- permissions -------------------------------------------------------------------

type Role = "owner" | "editor" | "viewer" | "team";

const model = createPermissionModel<Role>({
  roles: [
    { key: "owner", label: "Owner" },
    { key: "editor", label: "Editor" },
    { key: "viewer", label: "Viewer" },
    { key: "team", label: "Team" },
  ],
  adminRole: "owner",
  permissions: [
    { key: "tab:tasks", label: "Tasks", group: "Tabs" },
    { key: "tab:accounts", label: "Accounts", group: "Tabs" },
    { key: "tab:surprise", label: "Surprise board", group: "Tabs", secret: true },
  ],
  defaults: {
    "tab:tasks": ["editor", "viewer", "team"],
    "tab:accounts": ["editor"],
    "tab:surprise": ["team"],
  },
});

{
  const saved = model.withDefaults({ "tab:tasks": ["editor"], "tab:surprise": ["viewer"] });
  assert.equal(model.isAllowed(saved, "tab:tasks", ["owner"]), true, "the admin role can do everything");
  assert.equal(model.isAllowed(saved, "tab:tasks", ["viewer"]), false, "a saved value replaces the default");
  assert.equal(model.isAllowed(saved, "tab:accounts", ["editor"]), true, "an unsaved key uses its default");
  assert.equal(model.isAllowed(saved, "tab:unknown", ["editor"]), false, "an unknown key allows nobody");
  assert.equal(model.isAllowed(saved, "tab:surprise", ["owner"]), false, "a secret permission is closed to the admin role");
  assert.equal(model.isAllowed(saved, "tab:surprise", ["owner", "team"]), true, "...but open through another role");
  assert.equal(model.isAllowed(saved, "tab:surprise", ["viewer"]), false, "saved values can't open a secret permission");
  assert.deepEqual(saved["tab:surprise"], ["team"], "withDefaults keeps the secret default");
  assert.deepEqual(model.grantableRoles(["owner"]), ["editor", "viewer", "team"], "the admin may grant every other role");
  assert.deepEqual(model.grantableRoles(["editor"]), [], "others grant nothing by default");
  assert.deepEqual(model.parseRoles("Editor, viewer;old-name, nonsense", { "old-name": "team" }), ["editor", "viewer", "team"]);
  assert.equal(model.roleLabel("viewer"), "Viewer");
  results.push("permissions ok");
}

// ---- passwords, login and sessions -----------------------------------------------------

{
  const stored = hashPassword("correct horse");
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{64}$/, "hash is salt:hash");
  assert.notEqual(hashPassword("correct horse"), stored, "every hash has its own salt");
  assert.equal(verifyPassword("correct horse", stored), true);
  assert.equal(verifyPassword("wrong", stored), false);
  assert.equal(verifyPassword("anything", "not-a-hash"), false);
  assert.match(generatePassword(12), /^[a-km-np-zA-HJ-NP-Z2-9]{12}$/, "no look-alike characters");
  results.push("passwords ok");
}

let storedAccounts = [{ username: "Robin", passwordHash: hashPassword("robin-pass"), roles: ["viewer"] as Role[] }];
let listAccountsCalls = 0;

const auth = createAuth<Role>({
  // A fixed test-only value: tests never read real settings.
  secret: () => "test-only-secret-not-used-anywhere",
  model,
  configuredAccounts: () => [{ username: "Owner", password: "owner-pass", roles: ["owner"] }],
  listAccounts: async () => {
    listAccountsCalls += 1;
    return storedAccounts;
  },
  loadPermissions: async () => ({ "tab:accounts": ["viewer"] }),
  secureCookie: true,
  logError: () => undefined,
});

function loginRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieFrom(response: Response) {
  const header = response.headers.get("Set-Cookie") ?? "";
  return header.split(";")[0]; // "session=<token>"
}

function requestWithCookie(cookie: string, init: RequestInit = {}) {
  return new Request("http://localhost/api/list", { ...init, headers: { ...(init.headers ?? {}), cookie } });
}

{
  const configured = await auth.handleLogin(loginRequest({ username: "owner", password: "owner-pass" }));
  assert.equal(configured.status, 200, "configured account logs in (name in any case)");
  const setCookie = configured.headers.get("Set-Cookie") ?? "";
  assert.match(setCookie, /^session=[^;]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/, "signed session cookie set");
  const ownerSession = await auth.getSession(requestWithCookie(cookieFrom(configured)));
  assert.equal(ownerSession?.username, "Owner", "the configured spelling of the name is kept");
  assert.equal(ownerSession?.kind, "configured");
  assert.deepEqual(ownerSession?.roles, ["owner"]);

  const callsBefore = listAccountsCalls;
  const wrongOwner = await auth.handleLogin(loginRequest({ username: "Owner", password: "nope" }));
  assert.equal(wrongOwner.status, 401, "wrong password for a configured name");
  assert.equal(listAccountsCalls, callsBefore, "...answered without reading the stored accounts");

  const stored = await auth.handleLogin(loginRequest({ username: "robin", password: "robin-pass" }));
  assert.equal(stored.status, 200, "stored account logs in");
  const cookie = cookieFrom(stored);
  const session = await auth.getSession(requestWithCookie(cookie));
  assert.equal(session?.kind, "stored");
  assert.equal(auth.can(session!, "tab:accounts"), true, "saved permissions are applied");
  assert.equal(auth.can(session!, "tab:surprise"), false);

  // Next.js-style cookie reader and a raw token work too.
  const token = decodeURIComponent(cookie.split("=")[1]);
  assert.equal((await auth.getSession({ get: () => ({ value: token }) }))?.username, "Robin");
  assert.equal((await auth.getSession(token))?.username, "Robin");

  // A tampered token is refused.
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "Owner", k: "configured", e: Date.now() + 1000 })).toString("base64url");
  assert.equal(await auth.getSession(`${forged}.${signature}`), null, "a changed payload fails the signature");
  assert.equal(await auth.getSession(`${payload}.x${signature.slice(1)}`), null, "a changed signature fails");

  assert.equal((await auth.requirePermission(token, "tab:tasks"))?.username, "Robin");
  assert.equal(await auth.requireRole(token, "owner"), null);

  // Removing the account signs the person out at once.
  storedAccounts = [];
  assert.equal(await auth.getSession(token), null, "a removed account is signed out");

  assert.equal((await auth.handleLogin(loginRequest({ username: "x" }))).status, 400, "missing password");
  assert.equal((await auth.handleLogin(loginRequest("{not json"))).status, 400, "invalid JSON");
  assert.equal((await auth.handleLogin(loginRequest({ username: "ghost", password: "pw" }))).status, 401, "unknown user");

  const logout = auth.handleLogout();
  assert.match(logout.headers.get("Set-Cookie") ?? "", /^session=; Max-Age=0; Path=\//, "logout clears the cookie");

  const broken = createAuth<Role>({ secret: () => undefined, model, configuredAccounts: () => [], logError: () => undefined });
  const failed = await broken.handleLogin(loginRequest({ username: "a", password: "b" }));
  assert.equal(failed.status, 401, "no secret needed to refuse unknown credentials");
  await assert.rejects(broken.getSession("a.b"), /session secret is not configured/, "a missing secret is reported");
  results.push("login, sessions and logout ok");
}

// ---- list handlers -----------------------------------------------------------------------

{
  storedAccounts = [{ username: "Robin", passwordHash: hashPassword("robin-pass"), roles: ["viewer"] }];
  const login = await auth.handleLogin(loginRequest({ username: "Robin", password: "robin-pass" }));
  const cookie = cookieFrom(login);

  const backend = createMemoryStorage({ initial: { tasks: [task("seed0001", "Existing task", { assigned: "Robin" })] } });
  const history = backend.history();
  const trash = createTrash(backend.list<TrashEntry>("trash"));
  const handlers = createTaskListHandlers({
    storage: backend.list<Task>("tasks"),
    getSession: (request) => auth.getSession(request),
    authorize: (current) => auth.can(current, "tab:tasks"),
    history,
    trash: { trash, kind: "task", title: (item) => item.title },
    defaultCategory: "General",
    maxItems: 3,
  });

  const anonymous = await handlers.GET(new Request("http://localhost/api/list"));
  assert.equal(anonymous.status, 401, "not signed in");

  const listed = (await (await handlers.GET(requestWithCookie(cookie))).json()) as { items: Task[] };
  assert.equal(listed.items.length, 1, "GET returns the list");

  const put = (item: unknown) =>
    handlers.PUT(requestWithCookie(cookie, { method: "PUT", body: JSON.stringify({ item }), headers: { "Content-Type": "application/json" } }));

  const created = await put({ title: "  New task  ", due: "1 Dec 2027", important: true, completed: "yes" });
  const afterCreate = (await created.json()) as { items: Task[] };
  assert.equal(created.status, 200);
  assert.equal(afterCreate.items[0].title, "New task", "new items go to the top, cleaned");
  assert.equal(afterCreate.items[0].category, "General", "default category used");
  assert.equal(afterCreate.items[0].due, "2027-12-01", "dates are normalised");
  assert.equal(afterCreate.items[0].completed, false, "only a real true counts");
  assert.match(afterCreate.items[0].id, /^[0-9a-f]{8}$/, "the server gives the id");

  const newId = afterCreate.items[0].id;
  await put({ ...afterCreate.items[0], completed: true });
  await put({ ...afterCreate.items[0], completed: true, due: "", assigned: "Robin" });
  assert.equal((await put({ title: "" })).status, 400, "a title is required");
  await put({ title: "Third" });
  assert.equal((await put({ title: "Fourth" })).status, 400, "maxItems is enforced");

  const removeRequest = (id: string) =>
    handlers.DELETE(requestWithCookie(cookie, { method: "DELETE", body: JSON.stringify({ id }), headers: { "Content-Type": "application/json" } }));
  assert.equal((await removeRequest("missing")).status, 404);
  assert.equal((await removeRequest(newId)).status, 200);
  assert.equal((await backend.list<Task>("tasks").loadAll()).some((item) => item.id === newId), false, "removed from the list");

  const inTrash = await trash.list();
  assert.equal(inTrash.length, 1, "removed item is in the trash");
  assert.equal(inTrash[0].title, "New task");
  assert.equal(await trash.restore(inTrash[0].id, backend.list<Task>("tasks")), true, "restored from the trash");
  assert.equal((await backend.list<Task>("tasks").loadAll())[0].id, newId, "restored at the top with the same id");

  const lines = (await history.readForUser("Robin", 10)).map((event) => event.text).reverse();
  assert.deepEqual(lines, [
    "Added task “New task”",
    "Completed “New task”",
    "Edited task “New task”: deadline → empty, assigned to → Robin",
    "Added task “Third”",
    "Removed task “New task”",
  ]);

  // authorize: a person without the permission gets 403 on every call.
  const closed = createListHandlers<Task>({
    storage: backend.list<Task>("tasks"),
    getSession: async () => ({ username: "Robin" }),
    authorize: () => false,
    clean: () => null,
    maxItems: 10,
  });
  assert.equal((await closed.GET(new Request("http://localhost/x"))).status, 403);
  results.push("list handlers, history and trash ok");
}

// ---- pure helpers ---------------------------------------------------------------------------

{
  assert.equal(isoDate("2027-06-12"), "2027-06-12");
  assert.equal(isoDate("not a date"), "");
  assert.equal(listChanges([["a", 1, 1], ["b", "x", ""], ["c", false, true]]), "b → empty, c → yes");

  const today = "2027-03-15";
  const tasks = [
    task("1", "No date"),
    task("2", "Overdue", { due: "2027-03-01" }),
    task("3", "This month", { due: "2027-03-31", assigned: "Sam" }),
    task("4", "In two months", { due: "2027-05-20" }),
    task("5", "Far away", { due: "2027-12-01" }),
    task("6", "Done and old", { due: "2027-01-01", completed: true }),
  ];
  const ids = (list: Task[]) => list.map((item) => item.id);
  assert.deepEqual(ids(sortTasks(tasks)), ["2", "3", "4", "5", "1", "6"], "nearest deadline first, then no date, then done");
  assert.deepEqual(ids(filterTasks(tasks, { status: "all", assignee: { kind: "everyone" }, period: "month" }, today)), ["2", "3"]);
  assert.deepEqual(ids(filterTasks(tasks, { status: "all", assignee: { kind: "everyone" }, period: "next3" }, today)), ["2", "3", "4"]);
  assert.deepEqual(ids(filterTasks(tasks, { status: "open", assignee: { kind: "everyone" }, period: "nodate" }, today)), ["1"]);
  assert.deepEqual(ids(filterTasks(tasks, { status: "done", assignee: { kind: "everyone" }, period: "all" }, today)), ["6"]);
  assert.deepEqual(ids(filterTasks(tasks, { status: "all", assignee: { kind: "person", username: "sam" }, period: "all" }, today)), ["3"]);
  assert.equal(filterTasks(tasks, { status: "all", assignee: { kind: "unassigned" }, period: "all" }, today).length, 5);
  assert.equal(isInPeriod(tasks[4], "month", ""), true, "without today every task is inside");
  results.push("task filters ok");
}

{
  assert.equal(pinterestLink("https://www.pinterest.co.uk/someone/ideas/"), "https://www.pinterest.co.uk/someone/ideas/");
  assert.equal(pinterestLink("https://pin.it/AbCdE"), "https://pin.it/AbCdE");
  assert.equal(pinterestLink("http://www.pinterest.com/someone/ideas/"), null, "https only");
  assert.equal(pinterestLink("https://evil-pinterest.com.example.org/x"), null, "lookalike hosts refused");
  assert.equal(isEmbeddableBoard("https://www.pinterest.com/someone/garden-ideas/"), true);
  assert.equal(isEmbeddableBoard("https://pin.it/AbCdE"), false, "short links fall back to a plain link");
  assert.equal(isEmbeddableBoard("https://www.pinterest.com/pin/123/extra/"), false, "three path parts are not a board");
  assert.deepEqual(cleanTags("Flowers, flowers; Decor ,, "), ["Flowers", "Decor"]);
  assert.equal(cleanTags(Array.from({ length: 12 }, (_, index) => `t${index}`)).length, 8);
  assert.deepEqual(cleanBoard({ link: "https://www.pinterest.com/someone/garden-party-ideas/", tags: "a, b" }), {
    title: "garden party ideas",
    link: "https://www.pinterest.com/someone/garden-party-ideas/",
    tags: ["a", "b"],
  });
  assert.equal(cleanBoard({ link: "https://pin.it/AbCdE" })?.title, "Pinterest board", "fallback title");
  assert.equal(cleanBoard({ link: "https://example.com/board/" }), null);
  assert.deepEqual(tagCounts([{ tags: ["b", "A"] }, { tags: ["a"] }, { tags: [] }]), [
    { tag: "A", count: 2 },
    { tag: "b", count: 1 },
  ]);
  results.push("pinterest helpers ok");
}

{
  assert.equal(isFigmaLink("https://www.figma.com/board/abc/Plan"), true);
  assert.equal(isFigmaLink("https://figma.com/design/abc"), true);
  assert.equal(isFigmaLink("https://example.com/figma.com/"), false);
  assert.equal(
    figmaEmbedUrl("https://www.figma.com/board/abc/Plan?node-id=0-1"),
    "https://www.figma.com/embed?embed_host=share&url=https%3A%2F%2Fwww.figma.com%2Fboard%2Fabc%2FPlan%3Fnode-id%3D0-1"
  );
  results.push("figma helpers ok");
}

console.log(results.join("\n"));
