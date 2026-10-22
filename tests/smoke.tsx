// Server-renders every component once and checks the initial markup. This
// catches crashes, missing props and broken structure; the scroll/click
// behaviour itself still needs a look in a real browser.
import assert from "node:assert/strict";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import {
  AccountMenu,
  AccountsPanel,
  AddTaskDialog,
  BoardOverview,
  DrawPad,
  FigmaBoard,
  FramedPhotoStack,
  GroupedNav,
  LessonPlaylist,
  LinkChips,
  LoginForm,
  MiniCalendar,
  MyInformation,
  NoteEditor,
  NoteView,
  NotesPad,
  NotificationBell,
  PerPersonPrice,
  PermissionsPanel,
  PhoneFrame,
  PhoneTour,
  PinterestBoard,
  PinterestBoardList,
  PyramidChart,
  Quiz,
  QuizEditor,
  RolePreview,
  ScheduleTimeline,
  SearchDialog,
  SessionNotice,
  TaskChecklist,
  TaskList,
  TrashPanel,
  VideoEntry,
  Wishlist,
  YouTubePlayer,
  createPermissionModel,
  emptyBoardItem,
  type NavNode,
  type Task,
  type WishlistItem,
} from "../src";

function Panel({ children }: { children: ReactNode }) {
  return <div className="test-panel">{children}</div>;
}

function count(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

const results: string[] = [];

// VideoEntry: before the tap only the closed image, the video and the audio
// exist. The page (children) must not be mounted yet.
{
  const html = renderToString(
    <VideoEntry
      closedImageSrc="/closed.png"
      videoSrc="/entry.mp4"
      audioSrc="/music.mp3"
      wrapper={Panel}
      texts={{ tapToOpen: "Open me" }}
    >
      <p>THE PAGE</p>
    </VideoEntry>
  );
  assert.ok(html.includes('src="/closed.png"'), "closed image rendered");
  assert.ok(html.includes("<video"), "video rendered");
  assert.ok(html.includes('src="/music.mp3"'), "audio rendered");
  assert.ok(html.includes("Open me"), "custom tap text used");
  assert.ok(!html.includes("THE PAGE"), "page not mounted before the tap");
  assert.ok(!html.includes("test-panel"), "wrapper not mounted before the tap");
  results.push("VideoEntry: closed stage ok");
}

// VideoEntry without audio: no <audio> element at all.
{
  const html = renderToString(
    <VideoEntry closedImageSrc="/closed.png" videoSrc="/entry.mp4">
      <p>page</p>
    </VideoEntry>
  );
  assert.ok(!html.includes("<audio"), "no audio without audioSrc");
  results.push("VideoEntry: no-audio variant ok");
}

// FramedPhotoStack: one frame per photo, clip-path passed through.
{
  const html = renderToString(
    <FramedPhotoStack
      photos={[
        { src: "/a.jpg", alt: "A" },
        { src: "/b.jpg", alt: "B" },
        { src: "/c.jpg", alt: "C" },
      ]}
      frameSrc="/frame.png"
      photoClipPath="ellipse(40% 30% at 50% 50%)"
    />
  );
  assert.equal(count(html, 'src="/frame.png"'), 3, "one frame per photo");
  assert.ok(html.includes('alt="B"'), "photo alt text rendered");
  assert.ok(html.includes("ellipse(40% 30% at 50% 50%)"), "clip-path passed through");
  assert.ok(html.includes("rotate("), "per-photo rotation applied");
  results.push("FramedPhotoStack ok");
}

// ScheduleTimeline: day numbers in the strip, items, edge days, alternation.
{
  const html = renderToString(
    <ScheduleTimeline
      days={[
        {
          date: "2027-06-11",
          items: [
            { time: "18:00", title: "Welcome drinks", description: "On the terrace" },
            { time: "20:00", title: "Dinner", description: "Garden" },
          ],
        },
        { date: "2027-06-12", items: [{ time: "15:00", title: "Ceremony", description: "Chapel" }] },
      ]}
      heartSrc="/heart.png"
      pendantSrc="/rings.png"
      eyebrow="The program"
      heading="How the day unfolds"
      edgeDays={{ before: 9, after: 14 }}
    />
  );
  assert.ok(html.includes("How the day unfolds"), "heading rendered");
  assert.ok(html.includes("Jump to 11.06.27"), "date button label rendered");
  assert.ok(html.includes("Welcome drinks") && html.includes("Ceremony"), "items rendered");
  assert.ok(html.includes(">9<") && html.includes(">14<"), "edge days rendered");
  assert.ok(html.includes('src="/heart.png"') && html.includes('src="/rings.png"'), "images rendered");
  results.push("ScheduleTimeline ok");
}

// ScheduleTimeline: alternation continues across day boundaries
// (item 0 left, item 1 right, then the next day's first item left again).
{
  const html = renderToString(
    <ScheduleTimeline
      days={[
        { date: "2027-06-11", items: [{ time: "1", title: "first", description: "" }, { time: "2", title: "second", description: "" }] },
        { date: "2027-06-12", items: [{ time: "3", title: "third", description: "" }] },
      ]}
      heartSrc="/heart.png"
      pendantSrc="/rings.png"
    />
  );
  // esbuild names CSS module classes "<File>_<class>", e.g. ScheduleTimeline_itemLeft.
  const sides = [...html.matchAll(/_item(Left|Right)\b/g)].map((match) => (match[1] === "Left" ? "left" : "right"));
  assert.deepEqual(sides, ["left", "right", "left"], "items alternate across days");
  results.push("ScheduleTimeline: alternation ok");
}

// ScheduleTimeline with no days renders nothing instead of crashing.
{
  const html = renderToString(<ScheduleTimeline days={[]} heartSrc="/h.png" pendantSrc="/r.png" />);
  assert.equal(html, "", "empty schedule renders nothing");
  results.push("ScheduleTimeline: empty days ok");
}

// LoginForm and SessionNotice: fields, custom texts, both notice variants.
{
  const html = renderToString(<LoginForm texts={{ heading: "Sign in", eyebrow: "TEAM AREA" }} />);
  assert.ok(html.includes('name="username"') && html.includes('type="password"'), "login fields rendered");
  assert.ok(html.includes("Sign in") && html.includes("TEAM AREA"), "custom login texts used");

  const signedIn = renderToString(<SessionNotice username="sam" continueHref="/board" />);
  assert.ok(signedIn.includes("Signed in as sam") && signedIn.includes('href="/board"'), "signed-in notice rendered");
  const problem = renderToString(<SessionNotice username="sam" problem="The data can't be read." />);
  assert.ok(problem.includes("The data can&#x27;t be read.") && problem.includes("Try again"), "problem notice rendered");
  assert.ok(!problem.includes('href="/"'), "no continue link when the app can't load");
  results.push("LoginForm + SessionNotice ok");
}

const sampleTasks: Task[] = [
  { id: "t1", title: "Book the venue", category: "Venue", due: "2027-01-10", assigned: "sam", notes: "Ask about parking", completed: false, important: true },
  { id: "t2", title: "Order flowers", category: "Decor", due: "", assigned: "", notes: "", completed: false, important: false },
  { id: "t3", title: "Send the invitations", category: "Post", due: "2026-12-01", assigned: "alex", notes: "", completed: true, important: false },
  { id: "t4", title: "Choose music", category: "", due: "", assigned: "former-member", notes: "", completed: false, important: false },
];

// TaskList (paged): rows, star state, the assignee kept even when not in `people`, pager text.
{
  const html = renderToString(
    <TaskList tasks={sampleTasks} people={["sam", "alex"]} currentUser="sam" onSave={() => {}} onRemove={() => {}} today="2027-02-01" initialFilters={{ period: "all" }} />
  );
  assert.ok(html.includes("Book the venue") && html.includes("Ask about parking"), "task and notes rendered");
  assert.ok(html.includes('aria-pressed="true"'), "important task has a pressed star");
  assert.ok(html.includes("sam (you)") && html.includes("sam (me)"), "own name marked");
  assert.ok(html.includes('value="former-member"'), "a former assignee stays selectable");
  assert.ok(html.includes("Page 1 of 1 · 4 tasks"), "pager rendered");
  assert.ok(html.includes("3 still need attention · 1 yours"), "summary counts");
  // Only the open task due before `today` is overdue (the done one is not).
  assert.equal(count(html, "_dueOverdue"), 1, "overdue deadline marked");
  results.push("TaskList (paged) ok");
}

// TaskList (compact): only `compactStep` tasks, then "Show N more".
{
  const html = renderToString(
    <TaskList tasks={sampleTasks} people={[]} onSave={() => {}} onRemove={() => {}} mode="compact" compactStep={2} onViewAll={() => {}} />
  );
  assert.equal(count(html, 'aria-label="Deadline for '), 2, "two rows shown");
  assert.ok(html.includes("Show 2 more") && html.includes("View all tasks"), "show-more and view-all rendered");
  assert.ok(!html.includes("Filter by time"), "no time filter in compact mode");
  results.push("TaskList (compact) ok");
}

// TaskList empty state.
{
  const html = renderToString(<TaskList tasks={[]} people={[]} onSave={() => {}} onRemove={() => {}} texts={{ emptyList: "Nothing here" }} />);
  assert.ok(html.includes("Nothing here"), "empty state rendered");
  results.push("TaskList (empty) ok");
}

// AddTaskDialog: nothing when closed; the form when open.
{
  assert.equal(renderToString(<AddTaskDialog open={false} onClose={() => {}} onAdd={() => {}} people={[]} />), "", "closed dialog renders nothing");
  const html = renderToString(<AddTaskDialog open onClose={() => {}} onAdd={() => {}} people={["sam"]} currentUser="sam" />);
  assert.ok(html.includes("Add a task") && html.includes('type="date"') && html.includes('type="checkbox"'), "add-task form rendered");
  assert.ok(html.includes("sam (you)"), "assignee menu rendered");
  results.push("AddTaskDialog ok");
}

// TaskChecklist: initial tasks shown before the first load.
{
  const html = renderToString(<TaskChecklist endpoint="/api/team/tasks" people={["sam"]} initialTasks={sampleTasks.slice(0, 2)} texts={{ heading: "Team to-do" }} />);
  assert.ok(html.includes("Team to-do") && html.includes("2 to do."), "checklist heading and count");
  assert.ok(html.includes("Order flowers"), "checklist rows rendered");
  results.push("TaskChecklist ok");
}

// PinterestBoardList: tags, the tag filter, embeds only for full board links.
{
  const html = renderToString(
    <PinterestBoardList
      items={[
        { id: "p1", title: "Garden ideas", link: "https://www.pinterest.com/someone/garden-ideas/", tags: ["Garden", "Colours"] },
        { id: "p2", title: "Short link", link: "https://pin.it/AbCdE", tags: ["garden"] },
      ]}
      onSave={() => {}}
      onRemove={() => {}}
    />
  );
  assert.ok(html.includes("Garden ideas") && html.includes("Open on Pinterest"), "boards rendered");
  // React separates "{tag}" and the following text with an empty comment.
  assert.ok(/Garden(<!-- -->)? <span>2<\/span>/.test(html), "tags counted case-insensitively");
  assert.equal(count(html, "_embed"), 1, "only the full board link is embedded");
  results.push("PinterestBoardList ok");
}

// PinterestBoard renders an empty container; the embed is built in the browser.
{
  const html = renderToString(<PinterestBoard link="https://www.pinterest.com/someone/garden-ideas/" compact />);
  assert.ok(html.startsWith("<div") && html.includes("_embedCompact"), "embed container rendered");
  results.push("PinterestBoard ok");
}

// FigmaBoard: embed for a Figma link, empty state for "", no iframe for other links.
{
  const html = renderToString(<FigmaBoard title="Plan" link="https://www.figma.com/board/abc/Plan" />);
  assert.ok(html.includes("<iframe") && html.includes("figma.com/embed?embed_host=share"), "embed rendered");
  assert.ok(html.includes("Open in Figma"), "open link rendered");
  const empty = renderToString(<FigmaBoard title="Plan" link="" texts={{ empty: "No board yet" }} />);
  assert.ok(empty.includes("No board yet") && !empty.includes("<iframe") && !empty.includes("Open in Figma"), "empty state");
  const other = renderToString(<FigmaBoard title="Plan" link="https://example.com/board" />);
  assert.ok(!other.includes("<iframe") && other.includes("Open in Figma"), "other links are not embedded");
  results.push("FigmaBoard ok");
}

// ---- planning-panel pieces (version 0.3.0) -----------------------------------------------------

// NotesPad: the list state before the first load; the pad on its own.
{
  const html = renderToString(<NotesPad endpoint="/api/notes" texts={{ heading: "Ideas", newNote: "Start a note" }} />);
  assert.ok(html.includes("Ideas") && html.includes("Start a note"), "notes heading and button");
  assert.ok(!html.includes("No notes yet"), "no empty message before the notes are loaded");

  const pad = renderToString(<DrawPad strokes={[]} onChange={() => {}} />);
  assert.ok(pad.includes("<canvas") && pad.includes('width="2000"') && pad.includes("Draw"), "drawing pad with a canvas");
  assert.ok(!pad.includes("Pen colour"), "the pen tools only show once drawing is on");
  results.push("NotesPad + DrawPad ok");
}

// NoteView: read-only text with its line breaks, a drawing as SVG (an eraser
// stroke as a mask), a picture and a sticker; no fields and no buttons.
// NoteEditor: the blocks with their controls and the toolbar, without the endpoint parts.
{
  const doc = {
    blocks: [
      { id: "a", type: "text" as const, text: "First line\nSecond line" },
      { id: "b", type: "text" as const, text: "   " },
      { id: "c", type: "draw" as const, strokes: [{ c: "#112233", w: 4, p: [10, 10, 50, 60, 90, 20] }, { c: "#000000", w: 8, e: 1 as const, p: [40, 40] }, { c: "#445566", w: 3, p: [5, 5] }] },
      { id: "d", type: "image" as const, src: "https://cdn.test/a.jpg" },
      { id: "e", type: "sticker" as const, emoji: "🎉" },
    ],
  };
  const view = renderToString(<NoteView value={doc} title="Lesson 1" />);
  assert.ok(view.includes("Lesson 1") && view.includes("First line\nSecond line"), "title and text with its line break");
  assert.ok(view.includes('viewBox="0 0 1000 600"') && view.includes("<path") && view.includes("<circle"), "the drawing as SVG");
  assert.equal(count(view, "<mask"), 1, "one eraser stroke, one mask");
  assert.ok(view.includes("https://cdn.test/a.jpg") && view.includes("🎉"), "picture and sticker");
  assert.ok(!view.includes("<textarea") && !view.includes("<button") && !view.includes("<input"), "nothing to edit");
  assert.equal(count(view, "_viewText"), 1, "an empty text block is left out");
  assert.ok(renderToString(<NoteView value={{ blocks: [] }} texts={{ empty: "Nothing yet" }} />).includes("Nothing yet"));

  const editor = renderToString(<NoteEditor value={doc} onChange={() => {}} texts={{ addText: "Add text" }} />);
  assert.equal(count(editor, "<textarea"), 2, "a field per text block");
  assert.ok(editor.includes("<canvas") && editor.includes("Add text") && editor.includes('aria-label="Move up"'), "pad, toolbar, block controls");
  assert.ok(!editor.includes("Saved") && !editor.includes("Back to the notes"), "no save state and no back button");
  results.push("NoteView + NoteEditor ok");
}

// PyramidChart: layers by area, a legend, the switch for several views, the empty text.
{
  const html = renderToString(
    <PyramidChart
      views={[
        { key: "planned", label: "Planned", items: [{ label: "Venue", value: 600 }, { label: "Food", value: 300 }, { label: "venue", value: 100 }] },
        { key: "actual", label: "Actual", items: [], emptyText: "No actual costs yet." },
      ]}
      formatValue={(value) => `€${value}`}
      target={2000}
    />
  );
  assert.equal(count(html, "<polygon"), 2, "one layer per label (same label in any case is one layer)");
  assert.ok(html.includes("€700") && html.includes("€300"), "legend values");
  assert.ok(html.includes("Planned") && html.includes("Actual") && html.includes('aria-pressed="true"'), "switch between the views");
  assert.ok(html.includes("Planned total €1000 of €2000 (50%)."), "note under the pyramid");
  const empty = renderToString(<PyramidChart items={[]} texts={{ empty: "Nothing yet" }} />);
  assert.ok(empty.includes("Nothing yet") && !empty.includes("<svg"), "empty pyramid");
  results.push("PyramidChart ok");
}

// MiniCalendar: dots, count badges, today; without `today` an empty box until the browser knows the date.
{
  const html = renderToString(<MiniCalendar today="2027-06-12" marked={["2027-06-12", "2027-06-20"]} counts={{ "2027-06-20": 3 }} weekStartsOn={1} />);
  assert.ok(html.includes("June 2027"), "month name");
  assert.equal(count(html, "_marked"), 2, "two dotted days");
  assert.equal(count(html, "_today"), 1, "today is marked");
  assert.ok(html.includes("<b") && html.includes(">3</b>"), "badge with the number");
  assert.ok(html.includes('aria-label="Previous month"'), "month arrows");
  const empty = renderToString(<MiniCalendar marked={[]} />);
  assert.ok(!empty.includes("Previous month"), "empty box until the browser date is known");
  results.push("MiniCalendar ok");
}

// SearchDialog: field, hint, dialog role.
{
  const html = renderToString(<SearchDialog sections={[{ title: "Task", hits: [{ id: "1", label: "Call the florist" }] }]} onPick={() => {}} onClose={() => {}} texts={{ placeholder: "Search tasks…" }} />);
  assert.ok(html.includes('role="dialog"') && html.includes("Search tasks…") && html.includes("Type to search."), "search dialog");
  assert.ok(!html.includes("Call the florist"), "no results before something is typed");
  results.push("SearchDialog ok");
}

// NotificationBell: the unread count on the closed bell.
{
  const notifications = [
    { key: "a", kind: "assigned" as const, title: "New task for you", text: "Pay" },
    { key: "b", kind: "due" as const, title: "Due today", text: "Call" },
  ];
  const html = renderToString(<NotificationBell notifications={notifications} read={new Set(["b"])} onSelect={() => {}} onMarkAllRead={() => {}} />);
  assert.ok(html.includes("Notifications, 1 new") && html.includes(">1</b>"), "one unread");
  assert.ok(!html.includes("New task for you"), "the list is closed");
  results.push("NotificationBell ok");
}

type PanelRole = "owner" | "editor" | "viewer";
const panelModel = createPermissionModel<PanelRole>({
  roles: [
    { key: "owner", label: "Owner" },
    { key: "editor", label: "Editor" },
    { key: "viewer", label: "Viewer" },
  ],
  adminRole: "owner",
  permissions: [
    { key: "tab:tasks", label: "Tasks", group: "Tabs" },
    { key: "tab:surprise", label: "Surprise", group: "Tabs", secret: true },
    { key: "action:export", label: "Export", group: "Actions" },
  ],
  defaults: { "tab:tasks": ["editor"], "tab:surprise": ["viewer"], "action:export": [] },
});

// Accounts and permissions screens.
{
  const accounts = renderToString(<AccountsPanel model={panelModel} icon={<span>icon</span>} />);
  assert.ok(accounts.includes("Generate login") && accounts.includes("Editor") && accounts.includes("Viewer"), "accounts: form with the assignable roles");
  assert.ok(!accounts.includes(">Owner<"), "accounts: the admin role is not offered");

  const permissions = renderToString(<PermissionsPanel model={panelModel} canEdit />);
  assert.ok(permissions.includes("Permissions") && permissions.includes("Changes apply at once"), "permissions: editable text");
  assert.ok(renderToString(<PermissionsPanel model={panelModel} canEdit={false} />).includes("Only the admin can change this."), "permissions: read-only text");

  const info = renderToString(<MyInformation username="sam" roles={["editor", "viewer"]} access={{ "tab:tasks": true, "action:export": false, "tab:surprise": false }} model={panelModel} texts={{ groupHeadings: { Tabs: "WHAT YOU CAN OPEN" } }} />);
  assert.ok(info.includes("Editor · Viewer") && info.includes("WHAT YOU CAN OPEN") && info.includes("ACTIONS"), "my information: roles and groups");
  assert.ok(!info.includes("Surprise"), "my information: a secret permission is hidden from those who do not have it");
  assert.ok(renderToString(<MyInformation username="sam" roles={["viewer"]} access={{ "tab:surprise": true }} model={panelModel} />).includes("Surprise"), "...and shown to those who do");

  const menu = renderToString(<AccountMenu username="sam" roleLabels={["Editor"]} items={[{ key: "me", label: "My information", onSelect: () => {} }]} onLogOut={() => {}} />);
  assert.ok(menu.includes(">SA<") && menu.includes('aria-label="Account menu"'), "account menu: initials on the avatar");
  assert.ok(!menu.includes("Log out"), "account menu: closed at first");
  results.push("AccountsPanel, PermissionsPanel, MyInformation, AccountMenu ok");
}

// BoardOverview: groups by category, filter counts, a Figma card with its button, a ticket with a date.
{
  const html = renderToString(
    <BoardOverview
      endpoint="/api/board-items"
      initialItems={[
        emptyBoardItem({ id: "1", type: "ticket", title: "Flight to Pisa", category: "Flights", date: "2027-06-11", link: "https://air.test/x" }),
        emptyBoardItem({ id: "2", type: "link", title: "Mind board", category: "Ideas", link: "https://www.figma.com/board/abc/Plan" }),
        emptyBoardItem({ id: "3", type: "link", title: "Loose link", link: "https://docs.google.com/document/d/abc" }),
      ]}
    >
      <p>CHILD</p>
    </BoardOverview>
  );
  assert.ok(html.includes("Flights") && html.includes("Ideas") && html.includes("Not sorted yet"), "groups, with the unsorted one");
  assert.ok(html.includes("Fri, 11 Jun 2027"), "ticket date");
  assert.ok(html.includes("Show board here") && html.includes("Mind board"), "a Figma link can be opened inline");
  assert.ok(!html.includes("<iframe"), "...but is closed at first");
  assert.ok(html.includes("Open Google Doc"), "links say where they go");
  assert.ok(html.includes("CHILD"), "children are shown under the items");
  assert.ok(html.includes("Tickets") && html.includes("Links"), "filter by type");
  results.push("BoardOverview ok");
}

// Wishlist: tabs with counts, the cards of the first list, and nothing from a list that is not passed in.
{
  const categories = [
    { key: "guests", label: "Guests" },
    { key: "family", label: "Family" },
  ];
  const items: WishlistItem[] = [
    { id: "w1", category: "guests", title: "Linen napkins", description: "Set of six", link: "https://www.shop.test/napkins", price: "€24.90", image: "https://cdn.test/napkins.jpg" },
    { id: "w2", category: "guests", title: "Candle", description: "", link: "", price: "", image: "" },
    { id: "w3", category: "family", title: "Photo album", description: "", link: "", price: "", image: "" },
    { id: "w4", category: "hidden", title: "Secret present", description: "", link: "", price: "", image: "" },
  ];
  const html = renderToString(
    <Wishlist categories={categories} items={items} onSave={() => {}} onRemove={() => {}} fetchPreview={async () => ({ title: "", description: "", image: "", price: "" })} className="my-wishlist" />
  );
  assert.ok(html.includes("my-wishlist"), "className is applied");
  assert.ok(/Guests(<!-- -->)? <span>2<\/span>/.test(html) && /Family(<!-- -->)? <span>1<\/span>/.test(html), "tabs with the number of items");
  assert.ok(html.includes("Linen napkins") && html.includes("Candle"), "the first list's items rendered");
  assert.ok(!html.includes("Photo album"), "the other list is not shown until its tab is chosen");
  assert.ok(!html.includes("Secret present"), "an item of a list that is not passed in is never shown");
  assert.ok(html.includes("€24.90") && html.includes("shop.test"), "price and link host shown");
  assert.ok(html.includes('href="https://www.shop.test/napkins"') && html.includes('target="_blank"') && html.includes("noopener"), "the link opens in a new tab");
  assert.ok(html.includes('aria-label="Edit Linen napkins"') && html.includes('aria-label="Remove Candle"'), "edit and remove buttons");
  assert.equal(count(html, "<form"), 0, "the form is closed at first");

  const none = renderToString(<Wishlist categories={[]} items={items} onSave={() => {}} onRemove={() => {}} texts={{ noCategories: "No lists for you." }} />);
  assert.ok(none.includes("No lists for you.") && !none.includes("Linen napkins") && !none.includes("Add an item"), "no categories: nothing shown, nothing to add");
  results.push("Wishlist ok");
}

// LinkChips, PerPersonPrice: both ways of pricing.
{
  const chips = renderToString(<LinkChips links={["https://www.shop.com/dress", "https://other.nl/x"]} onChange={() => {}} itemLabel="Dress" />);
  assert.ok(chips.includes("shop.com") && chips.includes("other.nl") && chips.includes("+ another link"), "link chips");
  assert.ok(chips.includes('aria-label="Dress: add a link"'), "the field is named after the item");
  assert.ok(!renderToString(<LinkChips links={["https://a.com", "https://b.com"]} max={2} onChange={() => {}} />).includes("<input"), "no field when the list is full");

  const asTotal = renderToString(<PerPersonPrice total={900} perPerson={0} guests={30} onChange={() => {}} itemLabel="Dinner" />);
  assert.ok(asTotal.includes('value="900"') && asTotal.includes("per person") && asTotal.includes('aria-label="Total for Dinner"'), "priced as a total");
  const byPerson = renderToString(<PerPersonPrice total={1500} perPerson={50} guests={30} onChange={() => {}} formatMoney={(value) => `€${value}`} />);
  assert.ok(byPerson.includes("× 30 = €1500") && byPerson.includes("enter total"), "priced per person");
  results.push("LinkChips + PerPersonPrice ok");
}

// GroupedNav: only the pages the person may open, groups kept only when something is open.
{
  const tree: NavNode[] = [
    { key: "home", title: "Home", permission: "tab:home" },
    { group: "Planning", pages: [{ key: "tasks", title: "Tasks", permission: "tab:tasks" }, { key: "budget", title: "Budget", permission: "tab:budget" }] },
    { group: "Private", pages: [{ key: "secret", title: "Secret", permission: "tab:secret" }] },
  ];
  const html = renderToString(<GroupedNav tree={tree} access={{ "tab:home": true, "tab:tasks": true }} active="tasks" onSelect={() => {}} />);
  assert.ok(html.includes("Home") && html.includes("Planning") && html.includes("Tasks"), "allowed pages and their group");
  assert.ok(!html.includes("Budget") && !html.includes("Private") && !html.includes("Secret"), "no access: left out, and so is an empty group");
  assert.ok(html.includes('aria-current="page"') && html.includes('aria-label="Main navigation"'), "active page and menu name");
  results.push("GroupedNav ok");
}

// TrashPanel before the first load.
{
  const html = renderToString(<TrashPanel keepDays={14} texts={{ heading: "Bin" }} />);
  assert.ok(html.includes("Bin") && html.includes("kept for 14 days"), "trash heading and keep time");
  assert.ok(!html.includes("The trash is empty."), "no empty message before the first load");
  results.push("TrashPanel ok");
}

// PhoneFrame, PhoneTour.
{
  const frame = renderToString(<PhoneFrame src="/shot.jpg" alt="The overview" width="200px" />);
  assert.ok(frame.includes('src="/shot.jpg"') && frame.includes('alt="The overview"') && frame.includes("--phone-width:200px"), "phone frame with a screenshot");
  assert.ok(renderToString(<PhoneFrame>LIVE</PhoneFrame>).includes("LIVE"), "phone frame around children");

  const tour = renderToString(
    <PhoneTour
      screens={[
        { src: "/a.jpg", alt: "A", caption: <strong>First.</strong> },
        { src: "/b.jpg", alt: "B", caption: "Second" },
      ]}
      label="Panel screenshots"
    />
  );
  assert.equal(count(tour, "<figure"), 2, "one card per screen");
  assert.ok(tour.includes('aria-label="Panel screenshots"') && tour.includes('aria-label="Next screen"'), "row name and arrows");
  assert.ok(tour.includes("First.") && tour.includes("Second"), "captions");
  results.push("PhoneFrame + PhoneTour ok");
}

// RolePreview: the first role's menu, locked pages struck out, notes and abilities.
{
  const html = renderToString(
    <RolePreview
      roles={[
        { id: "helper", label: "Helper", story: "Helps with the planning.", permissions: ["tab:tasks"], can: [["Create accounts", false], ["Change permissions", "view only"]] },
        { id: "admin", label: "Admin", story: "Opens everything.", permissions: ["tab:tasks", "tab:budget"], hiddenNotes: { "tab:secret": "even for the admin" }, can: [] },
      ]}
      menu={[{ title: "Home" }, { group: "Planning", pages: [{ title: "Tasks", permission: "tab:tasks" }, { title: "Budget", permission: "tab:budget" }] }]}
      extraMenu={{ heading: "Under the account icon", pages: [{ title: "Accounts", permission: "tab:accounts" }] }}
    />
  );
  assert.ok(html.includes("Helper") && html.includes("Admin") && html.includes("Helps with the planning."), "role buttons and the first story");
  assert.equal(count(html, "_locked"), 2, "Budget and Accounts are locked for the helper");
  assert.ok(html.includes("no access"), "note on a locked page");
  assert.ok(html.includes("Change permissions: view only") && html.includes("Create accounts"), "abilities");
  assert.ok(html.includes("Under the account icon"), "extra menu");
  assert.equal(renderToString(<RolePreview roles={[]} menu={[]} />), "", "no roles: nothing");
  results.push("RolePreview ok");
}

// Quiz: a typed and a choice question, nothing marked before a submit.
// QuizEditor: a row per question with its controls, options and expected answer.
{
  const questions = [
    { id: "q1", prompt: "What is a pause?", kind: "text" as const, answer: "silence" },
    { id: "q 2", prompt: "Pick one", kind: "choice" as const, options: ["Yes", "", "No"], answer: "No" },
  ];
  const quiz = renderToString(<Quiz questions={questions} initialAnswers={{ q1: "a rest" }} onSubmit={() => {}} showResult texts={{ submit: "Check" }} />);
  assert.ok(quiz.includes("What is a pause?") && quiz.includes("a rest") && quiz.includes("Check"), "prompt, earlier answer and button");
  assert.equal(count(quiz, 'type="radio"'), 2, "empty options are left out");
  assert.ok(!quiz.includes("Not quite") && !quiz.includes(" right"), "no marks before a submit");
  assert.ok(renderToString(<Quiz questions={[]} onSubmit={() => {}} />).includes("no questions"), "empty quiz");

  const editor = renderToString(<QuizEditor value={questions} onChange={() => {}} />);
  assert.ok(editor.includes("Question 1") && editor.includes("Question 2") && editor.includes("Add a question"), "rows and the add button");
  assert.equal(count(editor, 'aria-label="Remove this option"'), 3, "one remove button per option");
  assert.ok(editor.includes("None (open question)") && editor.includes('value="silence"'), "expected answers");
  results.push("Quiz + QuizEditor ok");
}

// YouTubePlayer: the privacy-enhanced embed, lazy, with a title; a message for a bad link.
// LessonPlaylist: one button per part, the open one marked.
{
  const player = renderToString(<YouTubePlayer video="https://youtu.be/dQw4w9WgXcQ" title="Lesson 1" />);
  assert.ok(player.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"'), "nocookie embed");
  assert.ok(player.includes('loading="lazy"') && player.includes('title="Lesson 1"') && player.includes("allowFullScreen"), "lazy, titled, full screen");
  const bad = renderToString(<YouTubePlayer video="https://vimeo.com/1" title="x" texts={{ invalid: "Bad link" }} />);
  assert.ok(bad.includes("Bad link") && !bad.includes("<iframe"), "no player for a bad link");

  const playlist = renderToString(
    <LessonPlaylist
      items={[
        { id: "a", title: "Welcome", kind: "video", duration: "3:10" },
        { id: "b", title: "Read first", kind: "reading" },
      ]}
      activeId="b"
      onSelect={() => {}}
      texts={{ label: "Course" }}
    />
  );
  assert.ok(playlist.includes('aria-label="Course"') && playlist.includes("Welcome") && playlist.includes("3:10"), "list, titles, duration");
  assert.equal(count(playlist, "<button"), 2);
  assert.equal(count(playlist, 'aria-current="true"'), 1, "one part is open");
  assert.ok(playlist.indexOf('aria-current="true"') > playlist.indexOf("Welcome"), "the second part is the open one");
  results.push("YouTubePlayer + LessonPlaylist ok");
}

console.log(results.join("\n"));
