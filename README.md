# anhel-frontend-library

Reusable React components (TypeScript + CSS modules), plus small asset tools.
Shipped as **source**, with no build step: the consuming app's bundler compiles it.

Everything in the library, with import paths, origins and status, is listed in
[CATALOG.md](CATALOG.md).

| Component | Used on the wedding website as | What it does | Needs |
|---|---|---|---|
| [`VideoEntry`](#videoentry) | the envelope opening (entry screen + music button) | Tap a closed envelope image, a video plays (plus background music), and the entry blurs away to reveal the page | React 18+, framer-motion 11+ |
| [`FramedPhotoStack`](#framedphotostack) | the photo slider in "Our story" | Scroll-driven sticky stack of tilted photos, each clipped to an oval behind a decorative frame | React 18+ |
| [`ScheduleTimeline`](#scheduletimeline) | the program, with the sliding rings and the heart (date change) | Program timeline: a golden thread grows with scroll, a pendant slides down it, and a heart slides across a sticky date strip | React 18+, framer-motion 11+ |
| [`LoginForm`, `SessionNotice`, `createAuth`](#login) | the planning panel's /login page and its session cookie | Username + password login with scrypt hashes, an HMAC-signed cookie, and roles and permissions checked on every request | React 18+; server part: Node 18+ |
| [`TaskList`, `AddTaskDialog`, `TaskChecklist`](#tasks) | the panel's shared to-do list and the private boards' to-do lists | Tasks with a star for important, assignee, deadline, filters, "show more" or pages, with optimistic saving and polling | React 18+ |
| [Task storage](#task-storage) | the panel's Google Sheet (and the local JSON file) | One storage contract with memory, JSON file, Google Sheets and DynamoDB backends, picked by a setting | Node 18+; Sheets: a googleapis client; DynamoDB: `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` |
| [`PinterestBoardList`, `PinterestBoard`](#pinterestboardlist) | the panel's Inspiration pages | Public Pinterest boards added by link, with tags and a tag filter; full board links are embedded live | React 18+ |
| [`FigmaBoard`](#figmaboard) | the panel's Mind Board page | A shared Figma / FigJam file embedded, with an "Open in Figma" link | React 18+ |
| [`NotesPad`, `NoteEditor`, `NoteView`, `DrawPad`](#notespad) | the Notes of the private Bride and Groom boards (`NoteEditor` and `NoteView` written for 0.5.0) | Notes with text, a drawing pad, pictures and stickers, saved by itself; one note's editor on its own; a read-only note; the matching notes endpoint | React 18+; server part: Node 18+ |
| [`PyramidChart`](#pyramidchart) | the budget pyramid | A pyramid with one layer per label, sliced by area, with a legend and an optional switch between views | React 18+ |
| [`MiniCalendar`](#minicalendar) | the calendar in the panel's right column | A month view with dotted days and a red round count badge per day | React 18+ |
| [`SearchDialog`, `useSearchShortcut`](#searchdialog) | "Search anything" (Ctrl/⌘ K) | One search box over sections of results that are passed in | React 18+ |
| [`useNotifications`, `NotificationBell`](#notifications) | the bell in the top bar | New tasks and close or past deadlines for one person, with read state kept in the browser | React 18+ |
| [`AccountsPanel`, `PermissionsPanel`, `MyInformation`, `AccountMenu`](#accounts-and-permissions-screens) | the Accounts, Permissions and My information pages, and the avatar menu | Logins and roles, a roles-by-permissions grid, and the account endpoints with the rules of who may give which role | React 18+; server part: Node 18+ |
| [`BoardOverview`, `LinkChips`](#boardoverview-and-linkchips) | the private boards' Overview, and "where to buy" on budget items | Links, tickets, pictures and files kept in categories; small link chips | React 18+ |
| [`PerPersonPrice`](#perpersonprice) | the "Estimated" cell of a budget item | A price per person times the number of guests, or a typed total | React 18+ |
| [`Wishlist`, link preview](#wishlist) | the panel's Wedding favors page (a wishlist of presents for each group) and its "paste a link" | A wishlist with a tab per category, cards, an add and edit form that fills in from a pasted link, and the matching endpoint and page reader | React 18+; server part: Node 18+ |
| [`GroupedNav`](#groupednav) | the panel's side menu | Pages and groups of pages, each with a permission key | React 18+ |
| [Calendar feed](#calendar-feed) | the calendar of task deadlines on phones | `.ics` with reminders, behind a signed token | Node 18+ |
| [`TrashPanel`](#trashpanel) | the panel's Trash page | What was removed, with restore and delete for good | React 18+; server part: Node 18+ |
| [`PhoneFrame`, `PhoneTour`, `RolePreview`](#phoneframe-phonetour-and-rolepreview) | the portfolio page's phones, screenshot tour and "Log in as" | A phone frame, a swipeable screenshot row, and a role-by-role menu preview | React 18+ |
| [`shrinkPicture`, `useDismiss`](#utilities) | the notes and board pictures; the panel's dropdowns | Picture shrinking in the browser; closing a dropdown on an outside click | React 18+ |
| [Grants](#grants) | not on the wedding site (written for 0.5.0, for a members' area) | Per-person access to a course or lesson with an optional deadline, and its endpoint | Node 18+ |
| [`Quiz`, `QuizEditor`](#quiz-and-quizeditor) | not on the wedding site (written for 0.5.0, for a members' area) | A quiz to fill in with optional right/wrong marks, and the editor of its questions | React 18+ |
| [`YouTubePlayer`, `LessonPlaylist`](#youtubeplayer-and-lessonplaylist) | not on the wedding site (written for 0.5.0, for a members' area) | A privacy-enhanced YouTube player and the list of a course's videos and readings | React 18+ |
| [`tools/cut-frame-interior.mjs`](#toolscut-frame-interiormjs) | the cutting of the floral frame's inside for that photo slider | Cuts a frame image's solid inside to transparent and suggests the matching clip-path | Node 18+, ffmpeg |

All of them were extracted from the `angela-simon-wedding` site (Next.js 16,
React 19, framer-motion 13; the last three rows also from its `wedding-panel-portfolio`
page) and made data-driven. The DynamoDB backend is new.

## Install

From another project next to this one:

```bash
npm install ../anhel-frontend-library
npm install react react-dom framer-motion   # peer dependencies
```

**Next.js** (tested with Next 16 + Turbopack): the package ships TypeScript
and CSS modules, so let Next compile it. A local folder install is a symlink
outside your project, so Turbopack also needs a root that contains both:

```ts
// next.config.ts
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["anhel-frontend-library"],
  // Only needed for a local folder install (symlink). Points at the folder
  // that contains both this app and anhel-frontend-library.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
```

**Vite**: works out of the box (Vite handles TS and CSS modules). With a
local folder install, add `resolve: { dedupe: ["react", "react-dom", "framer-motion"] }`
so only one copy of React is used.

Import per component (keeps bundles small) or from the root:

```tsx
import { VideoEntry } from "anhel-frontend-library/video-entry";
import { FramedPhotoStack, ScheduleTimeline } from "anhel-frontend-library";
```

### Browser and server entry points

The root entry and the component entries are safe for the browser. Server-only
code (it uses `node:crypto`, the file system or a cloud SDK) has its own entries
and is not re-exported from the root:

| Entry | What lives there |
|---|---|
| `anhel-frontend-library/login-form` | `LoginForm`, `SessionNotice` |
| `anhel-frontend-library/task-list` | `TaskList`, `AddTaskDialog`, `TaskChecklist`, `useSharedList`, `Task` and its filter helpers |
| `anhel-frontend-library/confirm-dialog` | `useConfirm` (the "Are you sure?" dialog the lists use) |
| `anhel-frontend-library/pinterest-boards` | `PinterestBoardList`, `PinterestBoard`, `cleanBoard`, `cleanTags`, `isEmbeddableBoard`, `pinterestLink`, `tagCounts`, `boardsWithTag` |
| `anhel-frontend-library/figma-board` | `FigmaBoard`, `isFigmaLink`, `figmaEmbedUrl` |
| `anhel-frontend-library/notes-pad` | `NotesPad`, `NoteEditor`, `NoteView`, `DrawPad`, `cleanNoteDoc`, `previewOf`, `noteToPlainText`, `noteFillPercent`, the note types and constants |
| `anhel-frontend-library/pyramid-chart` | `PyramidChart`, `pyramidLayers` |
| `anhel-frontend-library/mini-calendar` | `MiniCalendar`, `monthCells`, `weekdayLabels` |
| `anhel-frontend-library/search-dialog` | `SearchDialog`, `useSearchShortcut`, `searchSections` |
| `anhel-frontend-library/notifications` | `useNotifications`, `NotificationBell`, `buildNotifications`, `daysUntil`, `myOpenTasks` |
| `anhel-frontend-library/accounts` | `AccountsPanel`, `PermissionsPanel`, `MyInformation`, `AccountMenu` |
| `anhel-frontend-library/board-overview` | `BoardOverview`, `DEFAULT_BOARD_ITEM_TYPES`, `groupItemsByCategory`, `categoriesOf`, `linkSource`, `formatItemDate`, `emptyBoardItem` |
| `anhel-frontend-library/link-chips` | `LinkChips`, `asWebAddress`, `hostOf`, `addLink` |
| `anhel-frontend-library/per-person-price` | `PerPersonPrice`, `round2`, `perPersonTotal`, `effectiveGuestCount`, `withPerPersonTotals` |
| `anhel-frontend-library/quiz` | `Quiz`, `QuizEditor`, `scoreQuiz`, `isAnswerCorrect`, `normaliseAnswer`, `hasExpectedAnswer`, `choiceOptions`, `emptyQuizQuestion`, the question and answer types |
| `anhel-frontend-library/youtube-lesson` | `YouTubePlayer`, `LessonPlaylist`, `youtubeIdFrom`, `youtubeEmbedUrl`, the playlist item type |
| `anhel-frontend-library/wishlist` | `Wishlist`, `WISHLIST_LIMITS`, `emptyWishlistItem`, `fillFromPreview`, `itemsOfCategory`, `prepareWishlistItem`, the item, category and preview types |
| `anhel-frontend-library/grouped-nav` | `GroupedNav`, `visibleNavTree`, `firstNavPage`, `navPageTitle`, `allNavPages` |
| `anhel-frontend-library/trash-panel` | `TrashPanel`, `trashDaysLeft` |
| `anhel-frontend-library/phone-tour` | `PhoneFrame`, `PhoneTour` |
| `anhel-frontend-library/role-preview` | `RolePreview`, `roleCanOpen` |
| `anhel-frontend-library/shrink-picture` | `shrinkPicture`, `scaledSize`, `nextAttempt` |
| `anhel-frontend-library/use-dismiss` | `useDismiss` |
| `anhel-frontend-library/permissions` | `createPermissionModel` (pure: browser and server) |
| `anhel-frontend-library/server/auth` | `createAuth`, `hashPassword`, `verifyPassword`, `generatePassword`, cookie helpers |
| `anhel-frontend-library/server/lists` | `createListHandlers`, `createTaskListHandlers`, `cleanTask`, `describeTasks`, `createTrash`, `createTrashHandlers`, `createBoardItemHandlers`, `cleanBoardItem`, `text`, `isoDate`, `amount`, `listChanges`, `cleanBoard` |
| `anhel-frontend-library/server/notes` | `createNotesHandlers` |
| `anhel-frontend-library/server/accounts` | `createAccountHandlers`, `createPermissionsHandlers`, the `AccountRecord` type |
| `anhel-frontend-library/server/link-preview` | `fetchLinkPreview`, `parsePreview`, `isPrivateAddress`, the `LinkPreview` type |
| `anhel-frontend-library/server/wishlist` | `createWishlistHandlers`, `cleanWishlistItem` |
| `anhel-frontend-library/server/grants` | `createGrantHandlers`, `isGrantActive`, `activeGrantsFor`, `hasGrant`, `daysLeft`, `isGrantDate`, the `Grant` type |
| `anhel-frontend-library/server/calendar` | `createCalendarFeed`, `buildCalendar`, `taskCalendarEvents`, `escapeIcsText`, `foldIcsLine` |
| `anhel-frontend-library/server/storage` | `ListStorage`/`HistoryStorage`/`StorageBackend` types, `createMemoryStorage`, `createJsonFileStorage`, `selectStorage`, `newId` |
| `anhel-frontend-library/server/storage/google-sheets` | `createSheetsStorage`, `taskSheetTable`, `trashSheetTable`, `historySheetTable`, `noteSheetTable`, `boardItemSheetTable`, `accountSheetTable`, `wishlistSheetTable`, `grantSheetTable`, `cell`, `isYes`, `toNumber` |
| `anhel-frontend-library/server/storage/dynamodb` | `createDynamoDbStorage` (needs the two `@aws-sdk` packages, optional peer dependencies) |

The server code returns plain web `Response` objects and reads cookies from a
`Request` (or from Next.js's `await cookies()`), so it has no Next.js
dependency.

### Images: plain `<img>` or your own component

Every component renders a plain `<img>` by default. To use `next/image` (or
anything else), pass a `renderImage` function (`renderClosedImage` on
`VideoEntry`). The image always sits in a positioned box it should fill:

```tsx
import Image from "next/image";

const nextImage = ({ src, alt, className, sizes, priority }) => (
  <Image src={src} alt={alt} className={className} sizes={sizes} priority={priority} fill />
);
```

### Theming (CSS custom properties)

All optional, with fallbacks. Set them on `:root` or any parent element.

| Variable | Used for | Fallback |
|---|---|---|
| `--font-display` | Labels, day numbers, times | `inherit` |
| `--ink-soft` | Muted text | `#837e70` |
| `--paper` | Background of the sticky date strip (should match the page) | `#fbf5ea` |
| `--accent` | Schedule times and eyebrow | `#b08d4f` |
| `--gutter` | Padding around the entry video | `clamp(1.5rem, 5vw, 4rem)` |
| `--schedule-sticky-top` | Where the date strip sticks (e.g. below a fixed nav) | `3.6rem` |
| `--ink` | Text of the panel cards (login, tasks, boards) | `#2d302b` |
| `--line` | Row dividers and field borders | `#e7e2d8` (varies) |
| `--surface` | Field, filter and chip backgrounds | `#f1efe9` (varies) |
| `--danger` | Error text, overdue deadlines, the confirm button | `#a8644c` |
| `--important` | The filled star of an important task, and the count badge of `MiniCalendar` | `#d1453b` |
| `--nav-ink` | `GroupedNav`: text of a page | `#aab4a7` |
| `--nav-active-bg` / `--nav-active-ink` | `GroupedNav`: the open (or hovered) page | `#f1eadc` / `#3f503d` |
| `--nav-group-ink` | `GroupedNav`: the group titles | `#8a9686` |
| `--phone-bezel` | `PhoneFrame`: the colour of the phone's frame | `#1e2a21` |

The panel components also use `--paper` (card background), `--accent`
(buttons, links), `--ink-soft` and `--font-display` (headings).

### Example assets

`assets/` holds the images from the wedding site, so you can try the
components quickly. Copy them into your app's `public/` folder:

- `assets/framed-photo-stack/floral-frame.png` (1421x2000, interior already cut out)
- `assets/schedule-timeline/heart-gold.png` (256x228)
- `assets/schedule-timeline/rings-gold.png` (1231x990)

## VideoEntry

`"use client"`. Shows a static closed-envelope image. On tap, the video plays
and the looping music starts from the same click (browsers only allow audio
that starts from a user gesture). At `dissolveAt` (the video's midpoint by
default) the overlay blurs and fades away. The page is already mounted
underneath it by then, and its content fades in slightly later. A floating
button switches the music on and off.

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | required: the page |
| `closedImageSrc` | `string` | required |
| `closedImageAlt` | `string` | `"A closed envelope"` |
| `videoSrc` | `string` | required |
| `audioSrc` | `string` | none (no music, no music button) |
| `musicVolume` | `number` 0-1 | `0.5` |
| `texts` | `{ tapToOpen, openLabel, musicOn, musicOff }` (any subset) | English defaults |
| `timings` | `{ dissolveAt, dissolveDuration, textRevealDelay, textRevealDuration }` (any subset) | `0.5`, `1.8`s, `1.0`s, `1.0`s |
| `wrapper` | `ComponentType<{ children }>`, e.g. a paper panel | none |
| `backgroundColor` | `string`: must match the video's canvas colour | `"#ffffff"` |
| `aspectRatio` | `string`: box shared by image and video | `"16 / 9"` |
| `width` | `string` | `"min(70.5vw, 585px)"` |
| `renderClosedImage` | `RenderImage` | plain `<img>` |

```tsx
<VideoEntry
  closedImageSrc="/images/envelope-closed.png"
  videoSrc="/videos/entry.mp4"
  audioSrc="/audio/music.mp3"
  texts={{ tapToOpen: "Tap to open" }}
  aspectRatio="1.132 / 1"
  wrapper={SitePanel}
>
  <MyPage />
</VideoEntry>
```

Things to know:

- **Do not restructure the JSX carelessly.** The `<video>` and `<audio>`
  elements stay at the same position in the tree in every stage, so React
  never remounts them. A second early-return branch makes the video jump
  back to frame 0 the moment the dissolve starts, and the music stops.
- **Cropping trick:** if the subject only fills part of the video frame
  (e.g. white margins left and right), set `aspectRatio` to the ratio of the
  part that has content. `object-fit: cover` then crops exactly onto it. Give
  the closed image (almost) the same ratio, so nothing jumps when playback
  starts. The wedding site used `"1.132 / 1"` for a 3840x2160 video.
- The video itself can be silent: the `audioSrc` track is what people hear.
- Define `wrapper` at module level, not inline, otherwise the page remounts
  on every render.
- Difference from the wedding-site original: there, the page was remounted
  once when the dissolve finished. Here it has one stable slot, so page
  state survives the transition.

## FramedPhotoStack

No client code needed (pure CSS `position: sticky`). Each photo sticks near
the top of the viewport and the next one slides over it. Every photo gets a
deterministic tilt and sideways shift, is clipped to an oval with
`clip-path`, and sits **behind** a frame image whose inside is transparent.

| Prop | Type | Default |
|---|---|---|
| `photos` | `{ src: string; alt: string }[]` | required (`src` is used as the key, so keep it unique) |
| `frameSrc` | `string` | required |
| `frameAspectRatio` | `string`: the frame image's width / height | `"1421 / 2000"` (floral-frame.png) |
| `photoClipPath` | `string` | `"ellipse(43% 33% at 50% 49%)"` (floral-frame.png) |
| `stickyTop` | `string` | `"110px"` |
| `itemWidth` | `string` | `"min(280px, 72vw)"` |
| `itemGap` | `string`: scroll distance between photos | `"190px"` |
| `rotationFor` / `offsetFor` | `(index) => number` (degrees / px) | spread between -12..12 deg and -30..30 px |
| `className` | `string` | none |
| `renderImage` | `RenderImage` | plain `<img>` (lazy) |

```tsx
<FramedPhotoStack
  photos={[
    { src: "/images/story/1.jpg", alt: "First trip" },
    { src: "/images/story/2.jpg", alt: "Engagement" },
  ]}
  frameSrc="/images/floral-frame.png"
/>
```

With a different frame, cut its inside out with the tool below, then pass
its `frameAspectRatio` and the `photoClipPath` the tool suggests.

## ScheduleTimeline

`"use client"`. Items alternate left and right of a thin golden thread that
**grows** downward as you scroll (it is not drawn up front), with a pendant
image (the rings) sliding down its end. Above it, a sticky date strip shows
the day numbers. A heart image slides horizontally to the day currently in
view and shows that day's number. Clicking a number scrolls to that day.
Uses framer-motion `useScroll`/`useTransform`.

| Prop | Type | Default |
|---|---|---|
| `days` | `{ date: "YYYY-MM-DD"; items: { time; title; description }[] }[]` | required (empty array renders nothing) |
| `heartSrc` | `string` | required |
| `pendantSrc` | `string` | required |
| `eyebrow` / `heading` | `ReactNode` | none |
| `edgeDays` | `{ before?, after? }`: decorative faded numbers either side | none |
| `jumpToLabel` | `(date "DD.MM.YY") => string` | `` `Jump to ${date}` `` |
| `id` | `string` | `"schedule"` |
| `classNames` | `{ section?, inner?, eyebrow?, heading? }`, e.g. your site's own heading classes | none |
| `renderImage` | `RenderImage` | plain `<img>` |

```tsx
<ScheduleTimeline
  eyebrow="The program"
  heading="How the day unfolds"
  heartSrc="/images/heart-gold.png"
  pendantSrc="/images/rings-gold.png"
  edgeDays={{ before: 9, after: 14 }}
  days={[
    { date: "2027-06-11", items: [{ time: "18:00", title: "Welcome drinks", description: "On the terrace" }] },
    { date: "2027-06-12", items: [{ time: "15:00", title: "Ceremony", description: "In the garden" }] },
  ]}
/>
```

Notes: the `.pendant` box in the CSS is sized to the rings image's aspect
ratio (about 1.24). Adjust it if you use a different pendant. Set `--paper` to
your page background, so the sticky strip doesn't show as a different-coloured band.

## Login

Three parts: a role/permission model (`createPermissionModel`, pure), the
server side (`createAuth`), and two `"use client"` cards (`LoginForm`,
`SessionNotice`).

**Accounts.** *Configured* accounts come from the app's own server settings
(passed in as a function, compared in constant time). *Stored* accounts are
kept by the app, with the password as `hashPassword`'s `salt:hash` (scrypt).
A login sets an HMAC-signed cookie with the username and an expiry, and no
roles: roles and permissions are looked up on every request, so a removed
account is signed out and a role change applies at once.

**Permissions.** Each person has one or more roles. The `adminRole` may do
everything except *secret* permissions: those are closed to the admin role,
always follow their defaults, and are meant to stay off any permissions page
(e.g. a surprise board the admin must not see).

```ts
// lib/auth.ts (server)
import { createPermissionModel } from "anhel-frontend-library/permissions";
import { createAuth } from "anhel-frontend-library/server/auth";

type Role = "owner" | "editor" | "viewer";

export const model = createPermissionModel<Role>({
  roles: [
    { key: "owner", label: "Owner" },
    { key: "editor", label: "Editor" },
    { key: "viewer", label: "Viewer" },
  ],
  adminRole: "owner",
  permissions: [
    { key: "tab:tasks", label: "Tasks", group: "Tabs" },
    { key: "tab:surprise", label: "Surprise board", group: "Tabs", secret: true },
  ],
  defaults: { "tab:tasks": ["editor", "viewer"], "tab:surprise": ["editor"] },
});

export const auth = createAuth<Role>({
  secret: () => process.env.SESSION_SECRET,
  model,
  configuredAccounts: () => [
    { username: process.env.OWNER_USERNAME ?? "", password: process.env.OWNER_PASSWORD ?? "", roles: ["owner"] },
  ],
  listAccounts: () => accountsFromYourStore(),
  loadPermissions: () => permissionsFromYourStore(),
});
```

```ts
// app/api/auth/login/route.ts
export const POST = (request: Request) => auth.handleLogin(request);

// app/api/auth/logout/route.ts
export const POST = () => auth.handleLogout();
```

```tsx
// app/login/page.tsx (server component)
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

export default async function LoginPage() {
  let session = null;
  try {
    session = await auth.getSession(await cookies());
  } catch (error) {
    unstable_rethrow(error); // e.g. the account store can't be reached: show the form
  }
  // Already signed in: offer to continue or log out instead of redirecting,
  // so a page that fails to load can't trap the person.
  if (session) return <SessionNotice username={session.username} continueHref="/board" />;
  return <LoginForm redirectTo="/board" />;
}
```

| `createAuth` option | Type | Default |
|---|---|---|
| `secret` | `string \| () => string \| undefined` | required (a missing value fails on the first request) |
| `model` | `createPermissionModel(...)` | required |
| `configuredAccounts` | `() => { username, password, roles }[]` | none |
| `listAccounts` | `() => Promise<{ username, passwordHash, roles }[]>` | none |
| `loadPermissions` | `() => Promise<Record<permission, Role[]>>` | defaults only |
| `permissionsCacheMs` | `number` | `10000` |
| `cookieName` / `sessionDays` | `string` / `number` | `"session"` / `30` |
| `secureCookie` | `boolean` | `NODE_ENV === "production"` |
| `messages` | `{ invalidRequest, missingFields, wrongCredentials, failed }` (any subset) | English defaults |
| `describeError` / `logError` | `(error) => string` / `(message, error) => void` | `messages.failed` / `console.error` |

Returns `handleLogin(request)`, `handleLogout()`, `getSession(source)`,
`can(session, key)`, `hasRole`, `requirePermission(source, key)`,
`requireRole(source, role)`, `loadPermissions`, `forgetPermissions` (call after
saving permissions), `createSessionToken`, `cookieName`, `cookieOptions`.
`source` is a `Request`, Next.js's `await cookies()`, or the token itself.

`createPermissionModel` returns `isAllowed(saved, key, roles)`,
`withDefaults(saved)`, `grantableRoles(roles)` (default: the admin role may
grant every other role, others none; override with the `grantableRoles`
option), `assignableRoles`, `roleLabel`, `isRoleKey`, `isSecret` and
`parseRoles(text, aliases)` for roles stored as text.

`LoginForm` props: `endpoint` (`"/api/auth/login"`), `redirectTo` (`"/"`),
`navigate` (default a full page load; in Next.js
`(path) => { router.replace(path); router.refresh(); }`), `icon`, `texts`
(`eyebrow, heading, intro, username, password, submit, submitting, failed`),
`className`.

`SessionNotice` props: `username`, `problem` (set: "can't load" variant with
Try again), `continueHref` (`"/"`), `logoutEndpoint` (`"/api/auth/logout"`),
`loginPath` (`"/login"`), `navigate`, `onRetry` (default reload), `icon`,
`texts`, `className`.

## Tasks

`"use client"`. The UI is controlled: `TaskList` shows `tasks` and reports
changes. `useSharedList(endpoint)` connects it to a list endpoint: changes show
at once (optimistic), the server's reply then replaces the list, and on an
error the list goes back to what the server has. The list is re-read every
20 seconds and when the tab regains focus, which picks up other people's
edits and edits made by hand in a spreadsheet.

```tsx
"use client";
import { useState } from "react";
import { AddTaskDialog, TaskList, useSharedList, type Task } from "anhel-frontend-library/task-list";

export function Tasks({ initialTasks, people, me }: { initialTasks: Task[]; people: string[]; me: string }) {
  const list = useSharedList<Task>("/api/tasks", initialTasks);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <TaskList
        tasks={list.items}
        onSave={list.save}
        onRemove={(task) => list.remove(task.id)}
        people={people}
        currentUser={me}
        error={list.error}
        headerAction={<button onClick={() => setAdding(true)}>Add task</button>}
      />
      <AddTaskDialog open={adding} onClose={() => setAdding(false)} onAdd={list.save} people={people} currentUser={me} />
    </>
  );
}
```

```ts
// app/api/tasks/route.ts (server)
import type { Task } from "anhel-frontend-library/task-list";
import { createTaskListHandlers, createTrash, type TrashEntry } from "anhel-frontend-library/server/lists";
import { storage } from "@/lib/storage"; // see "Task storage"

const handlers = createTaskListHandlers({
  storage: storage.list<Task>("tasks"),
  history: storage.history(),
  trash: { trash: createTrash(storage.list<TrashEntry>("trash")), kind: "task", title: (task) => task.title },
  getSession: (request) => auth.getSession(request),
  authorize: (session) => auth.can(session, "tab:tasks"),
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
```

`Task`: `{ id, title, category, due (YYYY-MM-DD or ""), assigned (username or
""), notes, completed, important }`. New tasks are sent with `id: ""`; the
server gives the id and puts them at the top.

| `TaskList` prop | Type | Default |
|---|---|---|
| `tasks`, `onSave`, `onRemove`, `people` | | required |
| `currentUser` | `string`: "My tasks", "(you)", the "yours" count | none |
| `mode` | `"paged"` (pages + time filter) or `"compact"` (first N + "Show more") | `"paged"` |
| `pageSize` / `compactStep` | `number` | `12` / `5` |
| `initialFilters` | `{ status, assignee, period }` (any subset) | all, everyone, `"next3"` (paged) |
| `showFilters` | `boolean` | `true` |
| `onViewAll` | `() => void`: compact mode's "View all tasks" | none |
| `headerAction` / `tools` | `ReactNode` | none |
| `error` | `string` | none |
| `confirmRemove` | `boolean \| (task) => Promise<boolean>` | built-in dialog |
| `today` | `"YYYY-MM-DD"` | the browser's date, after mounting |
| `dotColours` | `string[]`: the category dot colours | six muted colours |
| `texts` | every label (see `TaskListTexts`) | English defaults |

Time filter (paged): next 3 months, this month, no deadline, all. The first
two always include open tasks whose deadline has passed. Order: nearest
deadline first, then tasks without one, then completed ones.

`AddTaskDialog` props: `open`, `onClose`, `onAdd`, `people`, `currentUser`
(pre-selected assignee), `defaultCategory`, `icon`, `texts`.

`TaskChecklist` is the smaller, self-contained list (no filters, no pages,
an inline Add form): `endpoint`, `people`, `currentUser`, `initialTasks`,
`dotColour`, `texts`, `className`. It loads and saves through `endpoint` itself.

`createListHandlers(config)` is the general version for any list with ids:
`storage`, `getSession`, `clean`, `maxItems`, and optional `history`,
`describeCreate/Update/Remove`, `normalize`, `trash`, `beforeCreate`,
`authorize`, `canCreate`, `visible`, `messages`, `logError`. It returns
`{ GET, PUT, DELETE }`: `GET -> { items }`, `PUT { item } -> { items }`,
`DELETE { id } -> { items }`. A PUT with an id that is no longer in the list
saves the item as new. `createTaskListHandlers` adds the task fields
(`cleanTask`), the history lines (`describeTasks(noun)`), `maxItems: 300` and
`defaultCategory`.

`createTrash(storage, { keepDays: 7 })` returns `list()`, `put(kind, title,
removedBy, item)`, `take(entryId)` and `restore(entryId, targetList)`.
Entries older than `keepDays` are dropped whenever the trash is read.

## Task storage

The handlers only see two small interfaces, so the backend can change without
touching routes or UI:

```ts
interface ListStorage<T extends { id: string }> {
  loadAll(): Promise<T[]>;          // in list order
  saveAll(items: T[]): Promise<void>; // replaces the whole list
}
interface HistoryStorage {
  append(event: { at: string; username: string; text: string }): Promise<void>;
  readForUser(username: string, limit: number): Promise<HistoryEvent[]>; // newest first
}
// A backend hands out named lists and a history:
interface StorageBackend {
  list<T>(name: string): ListStorage<T>;
  history(name?: string): HistoryStorage;
}
```

The source is picked in one place, usually from a setting:

```ts
// lib/storage.ts (server)
import { createJsonFileStorage, createMemoryStorage, selectStorage } from "anhel-frontend-library/server/storage";
import { createSheetsStorage, taskSheetTable, trashSheetTable } from "anhel-frontend-library/server/storage/google-sheets";
import { createDynamoDbStorage } from "anhel-frontend-library/server/storage/dynamodb";

export const storage = selectStorage(
  process.env.APP_STORAGE,
  {
    memory: () => createMemoryStorage(),
    file: () => createJsonFileStorage({ filePath: ".data/store.json" }),
    sheets: () =>
      createSheetsStorage({
        sheets: google.sheets({ version: "v4", auth: yourGoogleAuth }),
        spreadsheetId: () => process.env.APP_SHEET_ID,
        tables: { tasks: taskSheetTable(), trash: trashSheetTable() },
      }),
    dynamodb: () => createDynamoDbStorage({ tableName: "app-data", region: "eu-west-1" }),
  },
  "memory"
);
```

Only the chosen factory runs; an unknown name throws. Each adapter entry
needs its own package only when imported, so `lib/storage.ts` lists just the
backends the app uses.

| Backend | Where the data lives | Notes |
|---|---|---|
| `createMemoryStorage({ initial?, initialHistory? })` | the server's memory | Tests and demos. Lost on restart, one copy per server instance. |
| `createJsonFileStorage({ filePath })` | one JSON file, `{ "<list>": [...], "history": [...] }` | Local development. Writes are queued within the process and written via a temporary file. A file that is not valid JSON is an error, not an empty list. |
| `createSheetsStorage({ sheets, spreadsheetId, tables, protectedSpreadsheetIds?, lastColumn? })` | one tab per list, header row first | Tabs are created on first use. Columns are positional: new fields go at the end. Rows added by hand get an id on the next read. New rows are written before old ones are cleared, so an interrupted save can't empty a tab. History is appended to a `History` tab. `protectedSpreadsheetIds` refuses spreadsheets that must never be written to. |
| `createDynamoDbStorage({ tableName, region?, client?, keySchema? })` | one record per item | See below. |

`sheets` is any object with the Sheets v4 calls used (`SheetsClient`); the
googleapis `google.sheets({ version: "v4", auth })` client fits it. The task
tab's columns are `Task, Category, Due, Assigned, Notes, Done, ID, Important`.
`noteSheetTable`, `boardItemSheetTable` and `accountSheetTable` are the layouts
of the notes, the board items and the stored accounts. A long text (a note's
content, a picture) is cut into pieces of 45,000 characters over the columns to
the right, because a cell holds at most 50,000 characters, and the sheet is read
up to column `Z`.

**DynamoDB.** Credentials come from the AWS SDK's usual sources; none are set
in the library. Two table layouts, chosen by `keySchema`:

| `keySchema` | Record | Loading a list |
|---|---|---|
| `{ partitionKey: "pk", sortKey: "sk" }` (default) | `{ pk: "<list>", sk: "<item id>", position, item }` | Query on `pk` |
| `{ partitionKey: "id" }` | `{ id: "<list>#<item id>", list: "<list>", position, item }` | Scan filtered on `list` (whole table, so for small tables) |

The item's own fields sit under `item`, so they never clash with the key
attributes; `position` keeps the list order. A save writes every item (25 per
`BatchWriteItem`, retrying unprocessed ones) and then deletes the records of
removed items, so an interrupted save can leave a removed item behind but never
loses one. History events are records in the same table under the history's
name (`"history"`), with a sort value that starts with the time. `client`
takes a ready `DynamoDBDocumentClient` (custom endpoint or credentials, or a
fake in tests).

## PinterestBoardList

`"use client"`. Saved public Pinterest boards. A board is added by pasting its
link (with an optional title and tags); tags can be added later with "+ tag"
or removed, and the tag row at the top filters the boards (case-insensitive,
most used first). Full board links (`pinterest.<tld>/<user>/<board>/`) are
shown with Pinterest's own live embed (`PinterestBoard`, which loads
`assets.pinterest.com/js/pinit.js` once). Short `pin.it` links and anything
else that can't be embedded show as a plain "Open on Pinterest" link.

| Prop | Type | Default |
|---|---|---|
| `items` | `{ id, title, link, tags }[]` | required |
| `onSave` / `onRemove` | `(item) => void` / `(id) => void` | required |
| `error` | `string` | none |
| `canAdd` | `boolean` | `true` |
| `texts` | every label (see `PinterestBoardListTexts`) | English defaults |
| `className` | `string` | none |

On the server, `cleanBoard(input)` is the list endpoint's `clean`: it accepts
only https Pinterest links (`pinterestLink`), names an untitled board after its
link (`…/user/garden-ideas/` becomes "garden ideas"), and cleans the tags
(`cleanTags`: trimmed, no repeats ignoring case, at most 8 of 30 characters).

```ts
const handlers = createListHandlers<PinterestBoardItem>({
  storage: storage.list<PinterestBoardItem>("boards"),
  getSession: (request) => auth.getSession(request),
  clean: (input) => cleanBoard(input),
  maxItems: 50,
});
```

`PinterestBoard` on its own: `link`, `compact` (a short strip of pins),
`className`. Show it only for links where `isEmbeddableBoard(link)` is true.

## FigmaBoard

`"use client"`. A shared Figma or FigJam file shown with Figma's own embed,
with an "Open in Figma" link. The file has to be shared as "Anyone with the
link can view", otherwise Figma asks for a login inside the frame.

| Prop | Type | Default |
|---|---|---|
| `link` | `string`: `""` shows the empty state | required |
| `title` | `ReactNode` | required |
| `description` | `ReactNode` | none |
| `frameTitle` | `string`: the iframe's accessible name | `title` when it is text |
| `height` | `string` | `"74vh"` (at least 420px) |
| `texts` | `{ open, empty, notFigma }` (any subset) | English defaults |
| `className` | `string` | none |

A link that is not on `figma.com` is not embedded; only the "Open" link is
shown. `isFigmaLink(link)` and `figmaEmbedUrl(link)` are exported for checks
elsewhere (e.g. before saving a link).

## Planning-panel pieces (0.3.0)

The pieces below were added in 0.3.0. They come from the wedding site's planning
panel (`components/panel/*`, `lib/panel/*`, `app/api/panel/*`) and from the
portfolio page. Texts, endpoints, storage and navigation are passed in. Every
`texts` prop takes any subset of its labels, and every component takes a
`className`. [CATALOG.md](CATALOG.md) lists each one with its origin.

### NotesPad

`"use client"`. Pages like a notes app: a list of notes, and an editor whose note
is a list of blocks (text, a drawing pad, a picture, a sticker) that can be
moved up and down and removed. A note saves by itself 900 ms after the last
change. Saves run one after another (a slow first save of a new note hands out
the id before the next one starts), and "back" saves first. Pictures are
shrunk in the browser (`shrinkPicture`) and a note has a size limit. "Share"
opens the phone's share sheet, or copies the note as plain text. The drawing
pad (`DrawPad`) keeps strokes as lists of points in a fixed 1000 x 600 space,
so it stays small and redraws sharply at any size; "Draw" has to be switched on,
so a finger can still scroll the page.

| Prop | Type | Default |
|---|---|---|
| `endpoint` | `string`: the notes route | required |
| `colours` | `string[]`: paper colours (the same as the handlers') | `NOTE_COLOURS` |
| `stickers` | `string[]` | a set of 16 emoji |
| `maxChars` | `number`: for the "almost full" hint (the same as the handlers') | `400000` |
| `saveDelayMs` | `number` | `900` |
| `locale` | `string`: the date on each note card | `"en-GB"` |
| `texts` / `drawTexts` | every label | English defaults |

```ts
// app/api/notes/route.ts (server)
import { createNotesHandlers } from "anhel-frontend-library/server/notes";
import type { NoteRecord } from "anhel-frontend-library/notes-pad";

const handlers = createNotesHandlers({
  storage: storage.list<NoteRecord>("notes"),
  getSession: (request) => auth.getSession(request),
  authorize: (session) => auth.can(session, "tab:notes"),
  history: storage.history(),
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
```

The endpoint is not a plain list, because a note can be big:
`GET -> { notes }` (a summary of each, no content, newest first),
`GET ?id=... -> { note }`, `PUT { note } -> { note }` (no id creates),
`DELETE { id } -> { ok }`. Options: `storage`, `getSession`, `authorize`,
`history` (a note is logged when it is started and when it is deleted),
`describeCreate`, `describeRemove`, `maxNotes` (`40`), `maxChars` (`400000`, the
saved JSON of one note), `colours`, `untitled`, `previewLabels`, `messages`,
`logError`. A DynamoDB record is limited to 400 KB, so a lower `maxChars` is
needed there (on the editor and the handlers alike). For Google Sheets,
`noteSheetTable()` splits the content over the cells to the right.

Pure helpers: `cleanNoteDoc(input, { maxChars, maxBlocks })` (checks a document
from the browser and returns a clean copy or `null`), `previewOf`,
`noteToPlainText`, `noteFillPercent`.

**`NoteEditor`** (0.5.0, `"use client"`) is the block editor of `NotesPad` on its
own: controlled (`value: NoteDoc`, `onChange(doc)`), without a title, colour,
list or endpoint, so a page can put one note under a video and save it itself.
Props: `value`, `onChange`, `stickers`, `maxChars`, `texts`, `drawTexts`,
`className`.

**`NoteView`** (0.5.0) shows a `NoteDoc` read-only, with the same paper and type:
text with its line breaks, drawings as SVG from the strokes (the pad's 1000 x
600 shape, sharp at any width), pictures and stickers; no buttons or fields.
Props: `value`, `title`, `colour` (paper, default the first of `NOTE_COLOURS`),
`texts` (`empty`, `drawing`), `className`. It has no state, so it also renders
in a server component.

```tsx
const [doc, setDoc] = useState<NoteDoc>({ blocks: [] });
<NoteEditor value={doc} onChange={(next) => { setDoc(next); saveLater(next); }} />
<NoteView value={mentorNote} title="Homework" />
```

### PyramidChart

`"use client"`. A pyramid with one layer per label, the biggest at the bottom.
The layers are sliced by area (`pyramidLayers`), so a layer with 30% of the total
covers 30% of the triangle. Items with the same label, in any case, are added
up. A legend lists the layers, and hovering one dims the others.

| Prop | Type | Default |
|---|---|---|
| `items` | `{ label, value }[]`: one pyramid | none |
| `views` | `{ key, label, items, emptyText? }[]`: the same data seen in several ways; two or more show a switch | none |
| `formatValue` | `(value) => string` | a rounded number |
| `target` | `number`: the note under the pyramid compares the total with it | none |
| `colours` | `string[]` | ten muted colours |
| `texts` | `title`, `switchLabel`, `chartLabel`, `empty`, `unlabelled`, `note(viewLabel, total, target, percent)` | English defaults |

```tsx
<PyramidChart
  views={[
    { key: "planned", label: "Planned", items: costs.map((cost) => ({ label: cost.category, value: cost.estimated })) },
    { key: "actual", label: "Actual", items: costs.map((cost) => ({ label: cost.category, value: cost.actual })), emptyText: "No actual costs yet." },
  ]}
  formatValue={(value) => `€${Math.round(value)}`}
  target={plannedBudget}
/>
```

### MiniCalendar

`"use client"`. A month view with arrows. `marked` days get a dot, and `counts`
puts a red round badge with a number on a day (for example the important tasks
due). The month always has six rows, so the height stays the same. Days of the
neighbouring months are faint and never marked.

| Prop | Type | Default |
|---|---|---|
| `marked` | `Iterable<string>` of `YYYY-MM-DD` | none |
| `counts` | `Record<string, number>` or `Map` of `YYYY-MM-DD` | none |
| `today` | `YYYY-MM-DD` | the browser's date, read after the first render (an empty box until then, so the server and the browser agree) |
| `weekStartsOn` | `0 \| 1` | `0` (Sunday) |
| `locale` | `string`: the month name | `"en-GB"` |
| `texts` | `previousMonth`, `nextMonth`, `weekdays` (starting Sunday), `badgeTitle(count)` | English defaults |

`monthCells(...)` and `weekdayLabels(...)` are the pure part.

### SearchDialog

`"use client"`. One search box over any number of sections of results that
the app passes in. A result is `{ id, label, detail?, data? }`; picking one (a
click, or Enter for the first) reports it with its section title and `data`, so
the app can open the right page. The label, the section title and the detail
are searched, in any case, and at most `limit` (`15`) results are shown. The
dialog is rendered only while it is open, so it starts empty each time.
`useSearchShortcut(onOpen, key = "k")` opens it with Ctrl/⌘ K.

```tsx
const [open, setOpen] = useState(false);
useSearchShortcut(() => setOpen(true));
{open && (
  <SearchDialog
    sections={[{ title: "Task", hits: tasks.map((task) => ({ id: task.id, label: task.title, detail: task.category, data: "tasks" })) }]}
    onPick={(hit) => { openPage(hit.data); setOpen(false); }}
    onClose={() => setOpen(false)}
  />
)}
```

### Notifications

`useNotifications(tasks, username, todayIso, options)` works out the bell's
content from the shared task list, so nothing extra is stored on the server:
a task that was given to the person and not seen before, a deadline within
`dueSoonDays` (`3`), and a deadline that has passed. What this browser has
seen and read is kept in `localStorage`, per person (`storagePrefix`). On the
very first visit everything already assigned counts as seen. It returns
`notifications`, `unread`, `read`, `markSeen(ids)` (for a task the person gave
to themselves), `markRead(key)` and `markAllRead()`. `todayIso` comes from the
caller, read in the browser after the first render.

`NotificationBell` is the round button with the unread count and a dropdown
list (it closes itself on an outside click or Escape): `notifications`, `read`,
`onSelect(notification)`, `onMarkAllRead`, `icon`, `texts`. `buildNotifications`
(pure) and `daysUntil` are exported, and `texts` for the hook takes `assigned`,
`overdue`, `overdueText(title, due)` and `due(days)`.

### Accounts and permissions screens

`"use client"`. Four pieces built on `createPermissionModel` and the
server's `createAuth`:

- `PermissionsPanel`: a grid of the permissions (grouped, secret ones left out)
  against the roles (the admin role has no column). Ticking a box saves at once.
  `model`, `canEdit` (off: read-only), `endpoint` (`"/api/permissions"`).
- `AccountsPanel`: the logins list with a box per role, a form that creates a
  login (the username can be left empty to generate one), a new-password button
  and remove. A password is shown once, because only a hash is kept. The role
  boxes are limited to the roles the server says this person may give.
  `model`, `endpoint` (`"/api/accounts"`), `icon`, `locale`.
- `MyInformation`: the person's roles and what they may open and do, from an
  `access` map of permission key to allowed. A secret permission is listed only
  to those who have it. `groupHeadings` names the group headings.
- `AccountMenu`: the round avatar with a menu (name, roles, the items passed in,
  log out): `username`, `roleLabels`, `items`, `onLogOut`, `initials`.

```ts
// app/api/accounts/route.ts (server)
import { createAccountHandlers, type AccountRecord } from "anhel-frontend-library/server/accounts";

const handlers = createAccountHandlers({
  model,
  storage: storage.list<AccountRecord<Role>>("accounts"),
  getSession: (request) => auth.getSession(request),
  authorize: (session) => auth.can(session, "tab:accounts"),
  maxAccounts: 10,
  isReservedName: (name) => configuredNames().includes(name.toLowerCase()),
});
export const { GET, POST, PUT, PATCH, DELETE } = handlers;
```

The rules of `createAccountHandlers`: what a person may give comes from the
model's `grantableRoles` (by default the admin role gives every other role and
nobody else gives any). A person who may give only some roles sees and manages
only the accounts whose roles are all among them, and an account they create or
change always keeps at least one role. Nobody can give the admin role. The
limit `maxAccounts` counts every account. A new password is returned once and
only its hash is stored. The stored account is `AccountRecord`: the shape
`createAuth`'s `listAccounts` needs, plus an `id` and `createdAt`
(`accountSheetTable(model.parseRoles)` is its Google Sheets layout).

`createPermissionsHandlers({ model, getSession, canView, loadSaved, save,
onChanged, history })` is the permissions page's endpoint: `GET` sends the saved
permissions on top of the defaults without the secret ones, and `PUT { key,
roles }` changes one permission. Only the admin role may change them. The admin
role and unknown roles are never stored. `onChanged` is where
`auth.forgetPermissions` goes.

### BoardOverview and LinkChips

`BoardOverview` (`"use client"`) keeps links, tickets, pictures and files
together, each with a category to group and reorganise them (the category is
edited on the card). A Figma link can be opened inline in its card. Files are
kept as links: a spreadsheet cell or a small record can't hold a file. A picture
is shrunk in the browser first. It loads and saves through a list endpoint with
`useSharedList` and shows its `children` (for example a to-do list and a notes
pad) under the items.

| Prop | Type | Default |
|---|---|---|
| `endpoint` | `string`: a list endpoint | required |
| `types` | `{ key, label, plural, icon?, titlePlaceholder?, linkPlaceholder?, linkRequired?, withDate?, picture? }[]` | link, ticket, picture, file (`DEFAULT_BOARD_ITEM_TYPES`) |
| `initialItems` | `BoardItem[]` | none |
| `describeLink` | `(link) => string`: the "Open <name>" part | `linkSource` (Google Doc, Google Sheet, Figma, or the host) |
| `locale` | `string` | `"en-GB"` |
| `children` | `ReactNode` | none |
| `texts` | every label | English defaults |

`BoardItem` is `{ id, type, title, link, category, date, note, image }`. On the
server, `createBoardItemHandlers({ storage, getSession, ... , types, boardName })`
is `createListHandlers` with `cleanBoardItem` (a link has to be http or https; a
picture has to be a jpeg, png or webp data URL of at most `maxImageChars`,
`140000`) and history lines. `boardItemSheetTable(tab, types)` splits the
picture over the cells to the right. The pure helpers `groupItemsByCategory`,
`categoriesOf`, `linkSource`, `formatItemDate` and `emptyBoardItem` are exported.

`LinkChips` is the small "where to buy" list: chips named after the shop
(`shop.com`), each with a remove button, and a field to add another. Enter or
leaving the field adds what was typed (`www.shop.com` gets `https://`); text
that is not a web address stays in the field, marked as invalid. Props:
`links`, `onChange(links)`, `max` (`8`), `itemLabel`, `texts`. The pure
`asWebAddress`, `hostOf` and `addLink` are exported.

### PerPersonPrice

`"use client"`. The price cell of an item that is priced either as a total or per
person. The small link under the field switches between the two. A `perPerson`
above 0 means "per person", and then the total is the price times `guests`.
Controlled: `total`, `perPerson`, `guests`, `onChange({ total, perPerson })`,
`itemLabel`, `formatMoney`, `texts`. The values are saved when the field loses
focus.

Pure helpers: `round2`, `perPersonTotal(perPerson, guests)`,
`effectiveGuestCount(saved, followCount)` (a saved number above 0 wins,
otherwise the count follows the guest list and is at least 1) and
`withPerPersonTotals(items, guests, totalKey)` (brings the totals of the
per-person items up to date).

### GroupedNav

A side menu of single pages and groups of pages, each page with a permission
key. `tree` is defined once, `access` maps permission keys to allowed, and only
the allowed pages are shown (a group shows when at least one of its pages does).
Props: `tree`, `access`, `active`, `onSelect(key)`, `label`. A page is
`{ key, title, icon?, permission }`, a group `{ group, icon?, pages }`.
`visibleNavTree`, `firstNavPage` (where a person lands), `navPageTitle` and
`allNavPages` are exported. The colours come from `--nav-ink`,
`--nav-active-bg`, `--nav-active-ink` and `--nav-group-ink`.

### Calendar feed

Server only (`anhel-frontend-library/server/calendar`). A phone's calendar app
can't send the login cookie, so each person gets a link with a signed token
(their username and an HMAC signature of it). The signed text starts with
`calendar:`, so the session secret can be reused and a calendar token is never
valid as a session.

```ts
// lib/calendar.ts
import { createCalendarFeed, taskCalendarEvents } from "anhel-frontend-library/server/calendar";

export const feed = createCalendarFeed({
  secret: () => process.env.SESSION_SECRET,
  name: (username) => `Tasks (${username})`,
  prodId: "-//My app//Tasks//EN",
  // null (the account is gone) answers 404.
  eventsFor: async (username) => (await accountExists(username) ? taskCalendarEvents(await tasksOf(username), { username }) : null),
});

// app/api/calendar/[token]/route.ts
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  return feed.respond((await params).token); // ".ics" at the end is optional
}
// A person's link: `/api/calendar/${feed.tokenFor(username)}.ics`
```

`buildCalendar({ name, prodId, events, refreshHours, now })` makes the `.ics`
text of all-day events (`{ uid, date, summary, description?, location?,
reminder?, free? }`). A reminder is `{ text, hoursBefore }` counted from
midnight, so the default `15` is 09:00 on the day before. Text is escaped and
lines are folded at 75 bytes between characters. `taskCalendarEvents(tasks,
options)` makes an event for each open task with a deadline.

### TrashPanel

`"use client"`. The list of what was removed, with a restore and a "delete for
good" button (which asks first). Props: `endpoint` (`"/api/trash"`), `onRestored`,
`keepDays` (`7`, only for the "days left" text), `kindLabels`, `locale`, `texts`.

```ts
// app/api/trash/route.ts (server): next to createListHandlers' `trash` option
import { createTrash, createTrashHandlers, type TrashEntry } from "anhel-frontend-library/server/lists";

const handlers = createTrashHandlers({
  trash: createTrash(storage.list<TrashEntry>("trash")),
  targets: { task: storage.list<Task>("tasks"), guest: storage.list<Guest>("guests") },
  getSession: (request) => auth.getSession(request),
  authorize: (session) => auth.can(session, "tab:trash"),
});
export const { GET, POST, DELETE } = handlers;
```

`GET -> { entries }`, `POST { id }` restores (the item goes back to the top of the
list named by its `kind`, and the entry leaves the trash only after that), and
`DELETE { id }` deletes for good. An entry of a kind without a target can only be
deleted.

### PhoneFrame, PhoneTour and RolePreview

From the portfolio page. `PhoneFrame` is a phone-shaped frame (`src` and `alt`,
or `children`; `width`, `aspectRatio`, `renderImage`). `PhoneTour` is a row of
framed screenshots with captions that snap into place as they are swiped
(`screens: { src, alt, caption? }[]`, `screenWidth`, `gap`, `edge`, `label`);
two round arrows scroll two screens at a time on a computer with a mouse and
are hidden on touch screens. The frame colour is `--phone-bezel`.

`RolePreview` ("Log in as…") shows the side menu as each role sees it. `roles` are
`{ id, label, story, permissions, hiddenNotes?, can }`, `menu` is a list of pages
`{ title, permission? }` and groups `{ group, pages }` (a page without a
permission is open to everyone), and `extraMenu` is a second menu such as the
pages under the account icon. It is a picture of the permissions, not a login.

### Utilities

- `shrinkPicture(file, { longestSide, quality, maxChars, attempts })`: scales a
  photo down and saves it as a small JPEG data URL, trying smaller and lower
  quality until it is shorter than `maxChars` (`110000`, what fits in a few
  Google Sheet cells). Browser only. `scaledSize` and `nextAttempt` are the pure part.
- `useDismiss(open, ref, onClose)`: calls `onClose` on a mouse press outside the
  element or on Escape, for dropdowns.

## Wishlist and link preview (0.4.0)

Added in 0.4.0 from the wedding site's "Wedding favors" page (`FavorsPanel.tsx`,
`lib/panel/favors.ts`, `linkPreview.ts` and the favors and link preview routes).
The lists, the permission check, the endpoints and the page reader are passed in.

### Wishlist

`"use client"`. A card with one tab per category (with the number of items), an
"Add an item" form and a grid of item cards. An item has a title, a description,
a link (shown by its host name, opens in a new tab), a price (free text) and a
picture address. Pasting a link fills the fields that are still empty from
`fetchPreview(url)`, so nothing typed is replaced; everything can also be typed
or changed by hand, and the category (the list) of an item can be changed on
edit. Removing asks first (`useConfirm`). Controlled, like the other lists:
show `items`, report `onSave` (a new item has id `""`) and `onRemove`.

| Prop | Type | Default |
|---|---|---|
| `categories` | `{ key, label }[]`: the lists this person may see | required |
| `items` | `{ id, category, title, description, link, price, image }[]` (items of other categories are not shown) | required |
| `onSave` / `onRemove` | `(item) => void` / `(id) => void` | required |
| `fetchPreview` | `(url) => Promise<{ title, description, image, price }>`; throw an `Error` to show its message | none (nothing is read, all fields by hand) |
| `error` | `string` | none |
| `icon` | `ReactNode`, at the right of the heading | none |
| `texts` | every label (see `WishlistTexts`) | English defaults |
| `className` | `string` | none |

```tsx
"use client";
import { Wishlist, type WishlistItem } from "anhel-frontend-library/wishlist";
import { useSharedList } from "anhel-frontend-library/task-list";

export function Favors({ categories }: { categories: { key: string; label: string }[] }) {
  const list = useSharedList<WishlistItem>("/api/favors", []);
  return (
    <Wishlist
      categories={categories}
      items={list.items}
      onSave={list.save}
      onRemove={list.remove}
      error={list.error}
      fetchPreview={async (url) => {
        const response = await fetch("/api/link-preview", { method: "POST", body: JSON.stringify({ url }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body.preview;
      }}
    />
  );
}
```

The pure helpers are exported as well: `prepareWishlistItem` (trims the texts,
checks the link and the picture, turns a picture on `http` into `https`),
`fillFromPreview`, `itemsOfCategory`, `emptyWishlistItem` and `WISHLIST_LIMITS`
(the longest texts: title 100, description 400, link and picture 800, price 30).

### createWishlistHandlers

`createListHandlers` with the wishlist's rules. Every item belongs to a
category, and a person only sees, adds, moves, changes and removes the items of
the categories `canSee(category, session)` allows. An item of any other category
does not exist for them: it is not listed, changing or removing it is refused,
and creating one or moving one there is refused. A person who may see no category
at all gets 403 on every call.

```ts
// app/api/favors/route.ts (server)
import { createWishlistHandlers } from "anhel-frontend-library/server/wishlist";
import type { WishlistItem } from "anhel-frontend-library/wishlist";

const handlers = createWishlistHandlers({
  storage: storage.list<WishlistItem>("favors"),
  history: storage.history(),
  getSession: (request) => auth.getSession(request),
  categories,                                                     // the same list the page gets
  canSee: (category, session) => auth.can(session, `favors:${category}`),
  wishlistName: "favors",                                         // for the history lines
});
export const { GET, PUT, DELETE } = handlers;
```

Options: the list options of `createListHandlers` (except `clean`, `authorize`
and `visible`, which come from `categories` and `canSee`) plus `categories`,
`canSee`, `maxItems` (`300`) and `wishlistName` (`"wishlist"`). `cleanWishlistItem(input,
categoryKeys)` is the `clean`: the category has to be known and the title is
required; a link that is not http or https, and a picture that is not https, are
dropped; the texts are cut to `WISHLIST_LIMITS`. `wishlistSheetTable(tab,
categoryKeys)` is the Google Sheets layout (`Category, Title, Description, Link,
Price, Picture, ID`).

`createListHandlers` has a new `visible(item, session)` option for this: an item
a person may not see is left out of every reply, answers 404 when they try to
remove it or pull it onto a visible category, and cannot be created or changed
into by them (403, `messages.notAllowed`).

### Link preview

Server only (`anhel-frontend-library/server/link-preview`). `fetchLinkPreview(url)`
reads a page and returns `{ title, description, image, price, siteName }` from
its Open Graph and product tags and its JSON-LD data (`parsePreview(html,
pageUrl)` is the pure part). The picture is only kept when it is https, and a
relative one is made absolute. The fetch only goes to public web addresses:
`http` and `https` on the standard ports, no `user:pass@`, never a private,
local or reserved address (`isPrivateAddress`, also after each of at most four
redirects), a 6 second limit and about 900 KB read. It throws an `Error` for
anything it refuses.

```ts
// app/api/link-preview/route.ts (server)
import { fetchLinkPreview } from "anhel-frontend-library/server/link-preview";

export async function POST(request: Request) {
  if (!(await auth.getSession(request))) return Response.json({ error: "Not signed in." }, { status: 401 });
  const { url } = await request.json();
  try {
    return Response.json({ preview: await fetchLinkPreview(String(url)) });
  } catch {
    return Response.json({ error: "Could not read that page. Fill in the details by hand." }, { status: 422 });
  }
}
```

The route decides who may use it. The name lookup and the request are two steps,
so an address that changes between them is not caught.

## Members' area pieces (0.5.0)

Added in 0.5.0 for a members' area: lessons and videos behind a login, notes
and quizzes. Written for the library, not taken from another project.

### Grants

Server-safe, no React (`anhel-frontend-library/server/grants`). A role says
what a group of people may open; a grant gives one person one extra key (a
course, a lesson) until a date. A grant is
`{ id, username, key, expiresAt, grantedBy, createdAt }`, where `expiresAt` is
`YYYY-MM-DD` or `""` for no deadline. The deadline day is still active, and a
deadline that is not a valid date counts as expired (a typo in a spreadsheet
must never mean "forever"). Usernames are compared without case, keys exactly.

```ts
import { hasGrant, type Grant } from "anhel-frontend-library/server/grants";

const grants = await storage.list<Grant>("grants").loadAll();
if (!hasGrant(grants, session.username, "course-1", today)) return notFound();
```

`isGrantActive(grant, today)`, `activeGrantsFor(grants, username, today)`,
`hasGrant(grants, username, key, today)`, `daysLeft(grant, today)` (days the
grant still opens, today included: `1` on the last day, `0` once expired,
`null` without a deadline) and `isGrantDate(value)`. `today` is always passed in
as `YYYY-MM-DD`, so the app decides the time zone.

```ts
// app/api/grants/route.ts (server)
import { createGrantHandlers, type Grant } from "anhel-frontend-library/server/grants";

export const { GET, POST, DELETE } = createGrantHandlers({
  storage: storage.list<Grant>("grants"),
  getSession: (request) => auth.getSession(request),
  canManage: (session) => session.roles.includes("admin"),
  history: storage.history(),
});
```

`GET -> { grants }` (every grant for a manager; anyone else gets only their own
grants that are active today), `POST { username, key, expiresAt } -> { grant,
grants }` (managers only; a person who already has the key gets their grant
changed, not a second one; a deadline that is not a real date is a 400),
`DELETE { id } -> { ok, grants }` (managers only). Options: `storage`,
`getSession`, `canManage`, `listName` (`"access"`, used in history lines and
logs), `history`, `today` (default: the date in UTC), `messages`, `logError`.
For Google Sheets, `grantSheetTable(tab = "Grants")` has the columns
`Username, Key, Expires, Granted by, Created, ID`.

### Quiz and QuizEditor

`"use client"`. A question is `{ id, prompt, kind: "text" | "choice", options?,
answer? }`; `answer` is the expected answer, left out for an open question.
`Quiz` shows the questions as a numbered list (a text field, or one radio button
per option; empty options are left out) and hands every answer, by question id,
to `onSubmit` (throw an `Error` to show its message). With `showResult`, a
successful submit marks the questions that have an expected answer as right or
not and shows "3 of 4 right"; changing an answer takes the marks away again.

| Prop | Type | Default |
|---|---|---|
| `questions` | `QuizQuestion[]` | required |
| `initialAnswers` | `Record<string, string>` by question id | `{}` |
| `onSubmit` | `(answers) => Promise<void> \| void` | required |
| `showResult` | `boolean` | `false` |
| `texts` | every label (see `QuizTexts`) | English defaults |
| `className` | `string` | none |

`QuizEditor` is controlled (`value`, `onChange`, `texts`, `className`): add,
change, move and remove questions (removing a filled-in one asks first), switch
between typed and choice, edit the options and pick the expected answer.
Renaming the option that is the expected answer renames the answer too.

`scoreQuiz(questions, answers)` returns `{ correct, total, results }`: `total`
counts the questions with an expected answer, `results[id]` is `true`, `false`
or `null` (open question). Answers are compared with `normaliseAnswer`: no
case, no spaces at the ends, runs of spaces and line breaks as one space. The
same function on the server gives the same score.

### YouTubePlayer and LessonPlaylist

`YouTubePlayer` shows one video in a 16:9 box through YouTube's
privacy-enhanced embed (`https://www.youtube-nocookie.com/embed/<id>`, no
cookies until the video plays), loaded when it comes near the screen. Props:
`video` (an id or any YouTube link), `title` (the player's accessible name),
`start` (seconds), `texts` (`invalid`), `className`. A link that is not a
YouTube video shows a short message instead of the player.

The videos must be **unlisted** on YouTube, not private: a private video only
plays for the YouTube accounts it is shared with, so everyone else sees an
error. An unlisted video plays for anyone with the link and is not listed in
search or on the channel, so the page itself decides who sees the player. A
site with a Content Security Policy must allow
`frame-src https://www.youtube-nocookie.com`.

`LessonPlaylist` (`"use client"`) is the list of a course's parts for a column
next to the player: `items` (`{ id, title, kind: "video" | "reading",
duration? }[]`), `activeId`, `onSelect(id)`, `texts` (`label`, `video`,
`reading`, `empty`), `className`. Every part is a button; the arrow keys, Home
and End move between them, and the open one has `aria-current`.

```tsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
  <div>
    <YouTubePlayer video={lesson.youtube} title={lesson.title} />
    <NoteEditor value={note} onChange={saveNote} />
  </div>
  <LessonPlaylist items={lessons} activeId={lesson.id} onSelect={open} />
</div>
```

`youtubeIdFrom(urlOrId)` returns the 11-character id of a watch link
(`youtube.com/watch?v=`, also `m.` and `music.`), a `youtu.be/` link, an
`/embed/`, `/shorts/`, `/live/` or `/v/` link, or a plain id, and `""` for
anything else. `youtubeEmbedUrl(id, { start })` builds the embed address.

## tools/cut-frame-interior.mjs

Makes the solid inside of a frame image (wreath, oval, card) transparent,
so a photo can sit behind it. This is how `floral-frame.png` was made.
Needs Node 18+ and `ffmpeg`/`ffprobe` on the PATH. No npm packages.

```bash
# 1. Look at the colours first: fill, petals, outline
node tools/cut-frame-interior.mjs frame.png --sample "700,1000;650,400;710,300"

# 2. Cut (defaults are tuned for a cream fill around (243,240,228))
node tools/cut-frame-interior.mjs frame.png frame-cut.png
#   -> prints e.g. "suggested clip-path: ellipse(45.1% 35.0% at 50.0% 49.2%)"
#      trim the radii by 2-3% and pass it as photoClipPath

# Other fills: --min-bright N --max-rg N --min-gb N --max-gb N (see the file header)
```

**Important:** the area **outside** the frame must already be transparent.
The tool clears every pixel matching the colour test, so a cream background
around the frame would be cleared too, and the suggested clip-path would
then cover the whole image. It deliberately uses a colour-window test rather
than "distance to the fill colour", because pale pink petals were too close to
the cream and got eaten. Many viewers draw transparency as white, so check the
result over red with the `ffmpeg` command it prints.

## Development

```bash
npm install
npm run check      # tsc --noEmit + the tests below
```

`npm test` bundles and runs, in Node:

- `tests/smoke.tsx`: server-renders every component once;
- `tests/server.ts`: permissions, login and sessions, the list handlers with
  history and trash, and the task, Pinterest and Figma helpers;
- `tests/panel.ts`: the 0.3.0, 0.4.0 and 0.5.0 logic: notes (the document check and the
  handlers), picture sizes, the pyramid layers, the month calendar, search,
  notifications, per-person prices, links, the menu tree, the calendar feed and
  its token, the account and permission rules, the trash and board item
  handlers, the link preview (address table, refused addresses, page parsing;
  never the real network), the wishlist helpers and handlers (who sees which
  category), the grants (deadlines, the endpoint), quiz scoring, YouTube links,
  and the Google Sheets layouts of the new lists;
- `tests/storage-contract.ts`: the same storage contract on every backend
  (memory, JSON file, Google Sheets with a fake client, DynamoDB with a fake
  client in both key layouts), and the notes, board item, account and wishlist
  layouts on Google Sheets. No network, no credentials.

The smoke test only checks the initial markup. Scroll and click behaviour
needs a look in a real browser.
