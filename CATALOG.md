Check this file before building anything new.

Everything in the library, by area: the components, hooks, helpers and server utilities of version 0.4.0.
Import paths start with `anhel-frontend-library`; every browser-safe export is also available from the package root.
Server-only code (it uses `node:crypto`, the file system or a cloud SDK) is only available from its own `server/...` path.

**Status**

- `in library`: it is in the library as it was added.
- `extended`: it was in the library before and was extended or fixed when the 0.3.0 or 0.4.0 pieces were added.
- `not extracted`: it exists in the source projects and is not in the library (see the last section).

**Source projects**

- `wedding`: `angela-simon-wedding` (the wedding site and its planning panel).
- `portfolio`: `wedding-panel-portfolio` (the static portfolio page of that project).
- Versions: 0.1.0, 0.2.0 and 0.3.0 are the earlier extractions, 0.4.0 is the latest.

## Login and permissions

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `LoginForm` | `anhel-frontend-library/login-form` | Username and password card that posts to a login endpoint | `endpoint`, `redirectTo`, `navigate`, `icon`, `texts` | wedding: `components/panel/LoginForm.tsx` | in library (0.2.0) |
| `SessionNotice` | `anhel-frontend-library/login-form` | "Signed in as…" card (continue or log out), or a "can't load, try again" card | `username`, `problem`, `continueHref`, `logoutEndpoint`, `loginPath`, `navigate`, `onRetry`, `icon`, `texts` | wedding: `components/panel/SessionNotice.tsx` | in library (0.2.0) |
| `createAuth` | `anhel-frontend-library/server/auth` | Login and logout handlers, HMAC-signed session cookie, roles and permissions looked up on every request, `requirePermission`, `requireRole` | `secret`, `model`, `configuredAccounts`, `listAccounts`, `loadPermissions`, `permissionsCacheMs`, `cookieName`, `sessionDays`, `messages` | wedding: `lib/panel/auth.ts`, `app/api/auth/login`, `app/api/auth/logout` | in library (0.2.0) |
| `hashPassword`, `verifyPassword`, `generatePassword`, `safeEqual` | `anhel-frontend-library/server/auth` | scrypt password hashes, a readable random password, constant-time comparison | `hashPassword(password)`, `verifyPassword(password, stored)`, `generatePassword(length)` | wedding: `lib/panel/auth.ts` | in library (0.2.0) |
| `readCookie`, `serializeCookie` | `anhel-frontend-library/server/auth` | Cookie header helpers for plain web `Request` and `Response` | `readCookie(request, name)`, `serializeCookie(name, value, options)` | wedding: `lib/panel/auth.ts` | in library (0.2.0) |
| `createPermissionModel` | `anhel-frontend-library/permissions` | Roles, permission keys, defaults, an admin role, secret permissions, `grantableRoles`, `parseRoles` (pure: browser and server) | `roles`, `adminRole`, `permissions`, `defaults`, `grantableRoles` | wedding: `lib/panel/permissions.ts` | in library (0.2.0) |
| `PermissionsPanel` | `anhel-frontend-library/accounts` | Grid of permissions against roles, saved at once; read-only mode; secret permissions left out | `model`, `canEdit`, `endpoint`, `texts` | wedding: `components/panel/PermissionsPanel.tsx` | in library (0.3.0) |
| `AccountsPanel` | `anhel-frontend-library/accounts` | Create a login (name generated when empty), roles per account, new password, remove; a password is shown once; role boxes limited to what the server says may be given | `model`, `endpoint`, `icon`, `locale`, `texts` | wedding: `components/panel/AccountsPanel.tsx` | in library (0.3.0) |
| `MyInformation` | `anhel-frontend-library/accounts` | The person's roles and what they may open and do; secret permissions listed only to those who have them | `username`, `roles`, `access`, `model`, `texts` | wedding: `components/panel/MyInformation.tsx` | in library (0.3.0) |
| `AccountMenu` | `anhel-frontend-library/accounts` | Round avatar with a menu: name, roles, the given items, log out; closes on an outside click or Escape | `username`, `roleLabels`, `items`, `onLogOut`, `initials`, `texts` | wedding: avatar menu in `components/panel/PanelApp.tsx` | in library (0.3.0) |
| `createAccountHandlers` | `anhel-frontend-library/server/accounts` | Accounts endpoint: GET, POST (password returned once), PUT roles, PATCH new password, DELETE; grantable roles, account limit, reserved names. Reuses `createPermissionModel`, `generatePassword`, `hashPassword` | `model`, `storage`, `getSession`, `authorize`, `maxAccounts`, `isReservedName`, `usernamePattern`, `generateUsername`, `messages` | wedding: `app/api/panel/accounts/route.ts` | in library (0.3.0) |
| `createPermissionsHandlers` | `anhel-frontend-library/server/accounts` | Permissions endpoint: GET without secret permissions, PUT by the admin role only, history line | `model`, `getSession`, `canView`, `loadSaved`, `save`, `onChanged`, `history`, `messages` | wedding: `app/api/panel/permissions/route.ts` | in library (0.3.0) |
| `GroupedNav`, `visibleNavTree`, `firstNavPage`, `navPageTitle`, `allNavPages`, `isNavGroup` | `anhel-frontend-library/grouped-nav` | Side menu of pages and groups of pages, each with a permission key; only allowed pages shown; where a person lands | `tree`, `access`, `active`, `onSelect`, `label` | wedding: `NAV_TREE`, `visibleTree`, `firstPage` in `components/panel/PanelApp.tsx` | in library (0.3.0) |
| `RolePreview`, `roleCanOpen`, `isPreviewGroup` | `anhel-frontend-library/role-preview` | "Log in as…": a role picker and the menu as that role sees it, with a story and what it can also do | `roles`, `menu`, `extraMenu`, `initialRoleId`, `texts` | portfolio: `script.js`, `index.html`, `styles.css` | in library (0.3.0) |
| `isGrantActive`, `activeGrantsFor`, `hasGrant`, `daysLeft`, `isGrantDate`, `Grant` | `anhel-frontend-library/server/grants` | Per-person access to one key (a course, a lesson) with an optional deadline, on top of the roles; the deadline day is still active, a deadline that is not a date counts as expired (pure, no React or Node) | `hasGrant(grants, username, key, today)`, `daysLeft(grant, today)` | library (written for 0.5.0) | in library (0.5.0) |
| `createGrantHandlers` | `anhel-frontend-library/server/grants` | Grants endpoint: GET (every grant for a manager, own active grants for anyone else), POST give or change a deadline, DELETE; managers only for changes; history lines. On any `ListStorage` | `storage`, `getSession`, `canManage`, `listName`, `history`, `today`, `messages`, `logError` | library (written for 0.5.0) | in library (0.5.0) |

## Tasks and storage

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `TaskList` | `anhel-frontend-library/task-list` | Shared to-do list: tick off, star as important, assignee, deadline, person/status/time filters, "show more" or pages | `tasks`, `onSave`, `onRemove`, `people`, `currentUser`, `mode`, `pageSize`, `initialFilters`, `texts` | wedding: task parts of `components/panel/PanelApp.tsx` | in library (0.2.0) |
| `AddTaskDialog` | `anhel-frontend-library/task-list` | "Add a task" pop-up (name, deadline, important, assignee) | `open`, `onClose`, `onAdd`, `people`, `currentUser`, `defaultCategory`, `texts` | wedding: add-task modal in `PanelApp.tsx` | in library (0.2.0) |
| `TaskChecklist` | `anhel-frontend-library/task-list` | Small self-contained to-do list with an inline add form; loads and saves through an endpoint | `endpoint`, `people`, `currentUser`, `initialTasks`, `dotColour`, `texts` | wedding: `components/panel/BoardTasks.tsx` | in library (0.2.0) |
| `useSharedList` | `anhel-frontend-library/task-list` | Client side of a list endpoint: optimistic saving, the server's reply replaces the list, polling and refresh on focus | `endpoint`, `initial`, `{ onChanged, pollMs, saveError }` | wedding: `components/panel/useSharedList.ts` | in library (0.2.0) |
| `filterTasks`, `sortTasks`, `isInPeriod`, `isOverdue`, `emptyTask`, `isIsoDate`, `toIsoDate`, `categoryColour`, `DEFAULT_DOT_COLOURS` | `anhel-frontend-library/task-list` | Pure task helpers and the `Task` type | `filterTasks(tasks, filters, today)` | wedding: `lib/panel/types.ts`, `PanelApp.tsx` | in library (0.2.0) |
| `TrashPanel`, `trashDaysLeft` | `anhel-frontend-library/trash-panel` | List of removed items with restore and delete for good (asks first), "days left" | `endpoint`, `onRestored`, `keepDays`, `kindLabels`, `locale`, `texts` | wedding: `components/panel/TrashPanel.tsx` | in library (0.3.0) |
| `ListStorage`, `HistoryStorage`, `StorageBackend`, `WithId` | `anhel-frontend-library/server/storage` | The storage contract: lists loaded and saved whole, plus a per-person history | `loadAll`, `saveAll`, `append`, `readForUser` | wedding: `lib/panel/store.ts` | in library (0.2.0) |
| `createMemoryStorage` | `anhel-frontend-library/server/storage` | In-memory backend for tests and demos | `initial`, `initialHistory` | library (written for 0.2.0) | in library (0.2.0) |
| `createJsonFileStorage` | `anhel-frontend-library/server/storage` | One JSON file, queued atomic writes | `filePath` | wedding: `lib/panel/fileStore.ts` | in library (0.2.0) |
| `createSheetsStorage` | `anhel-frontend-library/server/storage/google-sheets` | Google Sheets backend: one tab per list, positional columns, tabs created on first use | `sheets`, `spreadsheetId`, `tables`, `protectedSpreadsheetIds`, `lastColumn` | wedding: `lib/panel/sheetsStore.ts` | in library (0.2.0) |
| `taskSheetTable`, `trashSheetTable`, `historySheetTable`, `cell`, `isYes`, `toNumber` | `anhel-frontend-library/server/storage/google-sheets` | Sheet layouts of tasks, trash and history, and forgiving cell readers | `taskSheetTable(tab)` | wedding: `lib/panel/tables.ts` | in library (0.2.0) |
| `noteSheetTable`, `boardItemSheetTable`, `accountSheetTable` | `anhel-frontend-library/server/storage/google-sheets` | Sheet layouts of notes, board items and stored accounts; long text is split over cells to the right | `noteSheetTable(tab)`, `boardItemSheetTable(tab, types)`, `accountSheetTable(parseRoles, tab)` | wedding: `lib/panel/tables.ts` | in library (0.3.0) |
| `wishlistSheetTable` | `anhel-frontend-library/server/storage/google-sheets` | Sheet layout of a wishlist: `Category, Title, Description, Link, Price, Picture, ID`; a category typed in any case reads as its key; a link or picture that is not a web address reads as empty | `wishlistSheetTable(tab, categoryKeys)` | wedding: `favorsTable` in `lib/panel/tables.ts` | in library (0.4.0) |
| `grantSheetTable` | `anhel-frontend-library/server/storage/google-sheets` | Sheet layout of the grants: `Username, Key, Expires, Granted by, Created, ID`; a deadline typed by hand reads as YYYY-MM-DD, one that is not a date is kept (and so counts as expired) | `grantSheetTable(tab)` | library (written for 0.5.0) | in library (0.5.0) |
| `createDynamoDbStorage` | `anhel-frontend-library/server/storage/dynamodb` | DynamoDB backend (Query or Scan layout, batched writes with retries) | `tableName`, `region`, `client`, `keySchema` | library (written for 0.2.0) | in library (0.2.0) |
| `selectStorage`, `newId` | `anhel-frontend-library/server/storage` | Picks a backend by name from a setting; short random ids | `selectStorage(source, factories, fallback)` | wedding: `lib/panel/store.ts`, `tables.ts` | in library (0.2.0) |

## Boards and widgets

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `PinterestBoardList` | `anhel-frontend-library/pinterest-boards` | Public Pinterest boards added by link, with tags and a tag filter | `items`, `onSave`, `onRemove`, `canAdd`, `error`, `texts` | wedding: `components/panel/InspirationPanel.tsx` | in library (0.2.0) |
| `PinterestBoard` | `anhel-frontend-library/pinterest-boards` | Pinterest's live embed of one board (full board links only) | `link`, `compact` | wedding: `components/panel/PinterestBoard.tsx` | in library (0.2.0) |
| `pinterestLink`, `isEmbeddableBoard`, `cleanTags`, `cleanBoard`, `tagCounts`, `boardsWithTag` | `anhel-frontend-library/pinterest-boards` | Pure helpers for Pinterest links and tags; `cleanBoard` is the list endpoint's `clean` (also exported from `server/lists`) | `cleanBoard(input, { fallbackTitle })` | wedding: `lib/panel/pinterest.ts`, `inspirationTags.ts` | in library (0.2.0) |
| `FigmaBoard`, `isFigmaLink`, `figmaEmbedUrl` | `anhel-frontend-library/figma-board` | A shared Figma or FigJam file embedded, with an "Open" link; link checks. `BoardOverview` reuses the helpers | `link`, `title`, `description`, `height`, `texts` | wedding: `components/panel/FigmaBoard.tsx`, `lib/panel/figma.ts` | in library (0.2.0) |
| `NotesPad` | `anhel-frontend-library/notes-pad` | Notes list and editor: text, drawing, pictures, stickers; autosave, share or copy as text; reuses `useConfirm` and `shrinkPicture` | `endpoint`, `colours`, `stickers`, `maxChars`, `saveDelayMs`, `locale`, `texts` | wedding: `components/panel/NotesPanel.tsx` | in library (0.3.0) |
| `DrawPad` | `anhel-frontend-library/notes-pad` | Drawing pad kept as strokes (pen, colours, eraser, undo); mouse, pen and touch through pointer events, one stroke at a time (a second finger and other mouse buttons are ignored) | `strokes`, `onChange`, `colours`, `sizes`, `texts` | wedding: `components/panel/DrawPad.tsx` | extended (one pointer at a time in 0.5.0) |
| `NoteEditor` | `anhel-frontend-library/notes-pad` | The blocks of one note on their own (text, drawing, pictures, stickers; move, remove, toolbar), controlled and without network, so a page saves the note itself. `NotesPad` uses it inside its editor | `value`, `onChange`, `stickers`, `maxChars`, `texts`, `drawTexts`, `className` | library (written for 0.5.0) | in library (0.5.0) |
| `NoteView` | `anhel-frontend-library/notes-pad` | A note shown read-only: text with its line breaks, drawings as SVG from the strokes at the pad's 1000 x 600 shape (eraser strokes as masks), pictures, stickers; no controls. No state, also renders on the server | `value`, `title`, `colour`, `texts`, `className` | library (written for 0.5.0) | in library (0.5.0) |
| `cleanNoteDoc`, `previewOf`, `noteToPlainText`, `noteFillPercent`, `NOTE_COLOURS`, `DEFAULT_STICKERS`, `MAX_NOTE_CHARS` | `anhel-frontend-library/notes-pad` | The note document (types, constants) and its pure checks; `cleanNoteDoc` is what the notes handlers use | `cleanNoteDoc(input, { maxChars, maxBlocks })` | wedding: `lib/panel/notes.ts` and `NotesPanel.tsx` | in library (0.3.0) |
| `BoardOverview` | `anhel-frontend-library/board-overview` | Links, tickets, pictures and files kept in categories; a Figma link opens inline; shows its children below. Reuses `useSharedList`, `useConfirm`, `shrinkPicture`, the Figma helpers | `endpoint`, `types`, `initialItems`, `describeLink`, `locale`, `children`, `texts` | wedding: `components/panel/BoardOverview.tsx` | in library (0.3.0) |
| `groupItemsByCategory`, `categoriesOf`, `linkSource`, `formatItemDate`, `emptyBoardItem`, `DEFAULT_BOARD_ITEM_TYPES` | `anhel-frontend-library/board-overview` | Pure helpers and the `BoardItem` type of the overview | `groupItemsByCategory(items, unsortedName)` | wedding: `BoardOverview.tsx`, `lib/panel/types.ts` | in library (0.3.0) |
| `LinkChips`, `asWebAddress`, `hostOf`, `addLink` | `anhel-frontend-library/link-chips` | Chips named after the shop with remove buttons and a field to add a link ("where to buy") | `links`, `onChange`, `max`, `itemLabel`, `texts` | wedding: `WhereToBuy` in `components/panel/BudgetPanel.tsx` | in library (0.3.0) |
| `PerPersonPrice`, `perPersonTotal`, `round2`, `effectiveGuestCount`, `withPerPersonTotals` | `anhel-frontend-library/per-person-price` | A price per person times the number of guests, or a typed total; pure helpers for the totals | `total`, `perPerson`, `guests`, `onChange`, `itemLabel`, `formatMoney`, `texts` | wedding: `EstimateCell` in `BudgetPanel.tsx`, `lib/panel/budgetGuests.ts` | in library (0.3.0) |
| `Wishlist`, `emptyWishlistItem`, `fillFromPreview`, `itemsOfCategory`, `prepareWishlistItem`, `WISHLIST_LIMITS` | `anhel-frontend-library/wishlist` | Wishlist with a tab per category, cards (title, description, link opening in a new tab, price, picture), an add and edit form, and a removal that asks first. Pasting a link fills the empty fields from `fetchPreview`; everything can be typed by hand; the category of an item can be changed on edit. Reuses `useConfirm`, `asWebAddress` and `hostOf` | `categories`, `items`, `onSave`, `onRemove`, `fetchPreview`, `error`, `icon`, `texts`, `className` | wedding: `components/panel/FavorsPanel.tsx`, `Favor` in `lib/panel/types.ts` | in library (0.4.0) |
| `PhoneFrame` | `anhel-frontend-library/phone-tour` | Phone-shaped frame around a screenshot or any content | `src`, `alt`, `children`, `width`, `aspectRatio`, `renderImage` | portfolio: `.phone` in `styles.css` | in library (0.3.0) |
| `PhoneTour` | `anhel-frontend-library/phone-tour` | Swipeable row of framed screenshots with captions; arrows on a computer | `screens`, `screenWidth`, `aspectRatio`, `gap`, `edge`, `label`, `renderImage` | portfolio: `index.html`, `styles.css`, `script.js` | in library (0.3.0) |

## Lessons and quizzes

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `Quiz` | `anhel-frontend-library/quiz` | A numbered list of typed and multiple-choice questions with one submit button; answers go to `onSubmit`; with `showResult`, the answers with an expected one are marked right or not (no case, extra spaces ignored) and the score is shown | `questions`, `initialAnswers`, `onSubmit`, `showResult`, `texts`, `className` | library (written for 0.5.0) | in library (0.5.0) |
| `QuizEditor` | `anhel-frontend-library/quiz` | Controlled editor of a quiz's questions: add, change, move, remove (asks first); typed or choice, options, optional expected answer. Reuses `useConfirm` | `value`, `onChange`, `texts`, `className` | library (written for 0.5.0) | in library (0.5.0) |
| `scoreQuiz`, `isAnswerCorrect`, `normaliseAnswer`, `hasExpectedAnswer`, `choiceOptions`, `emptyQuizQuestion` | `anhel-frontend-library/quiz` | Pure quiz helpers and the `QuizQuestion` type; open questions (no expected answer) are not counted | `scoreQuiz(questions, answers)` | library (written for 0.5.0) | in library (0.5.0) |
| `YouTubePlayer` | `anhel-frontend-library/youtube-lesson` | One YouTube video in a 16:9 box through the privacy-enhanced embed (youtube-nocookie.com), loaded lazily, with a title; a message instead of the player for a bad link. The video must be "unlisted" on YouTube (a private one plays for nobody else) | `video`, `title`, `start`, `texts`, `className` | library (written for 0.5.0) | in library (0.5.0) |
| `LessonPlaylist` | `anhel-frontend-library/youtube-lesson` | Numbered list of a course's videos and readings for a column next to the player; the open one highlighted (`aria-current`); buttons, plus arrow keys, Home and End | `items`, `activeId`, `onSelect`, `texts`, `className` | library (written for 0.5.0) | in library (0.5.0) |
| `youtubeIdFrom`, `youtubeEmbedUrl` | `anhel-frontend-library/youtube-lesson` | The video id of a watch, youtu.be, /embed/, /shorts/ or /live/ link or of a plain id ("" when it is none); the nocookie embed address | `youtubeIdFrom(urlOrId)`, `youtubeEmbedUrl(id, { start })` | library (written for 0.5.0) | in library (0.5.0) |

## Calendar and search

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `MiniCalendar` | `anhel-frontend-library/mini-calendar` | Month view with dotted days and a red round count badge per day | `marked`, `counts`, `today`, `weekStartsOn`, `locale`, `texts` | wedding: `MiniCalendar` in `components/panel/PanelApp.tsx` | in library (0.3.0) |
| `monthCells`, `weekdayLabels` | `anhel-frontend-library/mini-calendar` | The 42 cells of a month, and rotated weekday letters | `monthCells({ year, month, todayIso, marked, counts, weekStartsOn })` | wedding: `PanelApp.tsx` | in library (0.3.0) |
| `SearchDialog` | `anhel-frontend-library/search-dialog` | Search box over sections of results that are passed in; Enter picks the first | `sections`, `onPick`, `onClose`, `limit`, `texts` | wedding: `components/panel/SearchDialog.tsx` | in library (0.3.0) |
| `useSearchShortcut` | `anhel-frontend-library/search-dialog` | Opens the search with Ctrl or ⌘ and a key (default K) | `onOpen`, `key` | wedding: key listener in `PanelApp.tsx` | in library (0.3.0) |
| `searchSections` | `anhel-frontend-library/search-dialog` | The matching: label, section title and detail, any case, limited | `searchSections(sections, query, limit)` | wedding: `SearchDialog.tsx` | in library (0.3.0) |
| `useNotifications` | `anhel-frontend-library/notifications` | A person's notifications from the task list (new task, deadline close or past); seen and read state in `localStorage` | `tasks`, `username`, `todayIso`, `{ storagePrefix, dueSoonDays, texts }` | wedding: `components/panel/useNotifications.ts` | in library (0.3.0) |
| `NotificationBell` | `anhel-frontend-library/notifications` | Bell button with an unread count and a dropdown list | `notifications`, `read`, `onSelect`, `onMarkAllRead`, `icon`, `texts` | wedding: bell in `PanelApp.tsx` | in library (0.3.0) |
| `buildNotifications`, `daysUntil`, `myOpenTasks` | `anhel-frontend-library/notifications` | Pure part of the notifications | `buildNotifications({ tasks, username, todayIso, seen, dueSoonDays, texts })` | wedding: `useNotifications.ts` | in library (0.3.0) |
| `createCalendarFeed` | `anhel-frontend-library/server/calendar` | Signed per-person calendar link: `tokenFor`, `usernameFromToken`, `respond(token)` returns the `.ics` response or 404 | `secret`, `name`, `prodId`, `eventsFor`, `refreshHours`, `fileName` | wedding: `calendarToken` in `lib/panel/auth.ts`, `app/api/calendar/[token]/route.ts` | in library (0.3.0) |
| `buildCalendar`, `taskCalendarEvents`, `escapeIcsText`, `foldIcsLine` | `anhel-frontend-library/server/calendar` | Builds an `.ics` of all-day events with reminders; events from open tasks with a deadline | `buildCalendar({ name, prodId, events, refreshHours, now })`, `taskCalendarEvents(tasks, { username, uidDomain, reminderHoursBefore })` | wedding: `lib/panel/calendar.ts` | in library (0.3.0) |

## Charts

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `PyramidChart` | `anhel-frontend-library/pyramid-chart` | Pyramid with one layer per label, sliced by area, with a legend and an optional switch between views | `items`, `views`, `formatValue`, `target`, `colours`, `texts` | wedding: `components/panel/BudgetPyramid.tsx` | in library (0.3.0) |
| `pyramidLayers` | `anhel-frontend-library/pyramid-chart` | The layers: labels added up ignoring case, share, depth by area | `pyramidLayers(items, unlabelled)` | wedding: `BudgetPyramid.tsx` | in library (0.3.0) |

## Server helpers

Server-only helpers that belong to other areas are listed there: the auth, accounts, permissions, storage and calendar helpers.

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `createListHandlers` | `anhel-frontend-library/server/lists` | GET, PUT and DELETE for any list with ids: clean, history lines, authorize, trash, limits. 0.4.0 adds `visible`: an item a person may not see is not listed, answers "not found" on change and remove, and cannot be created or moved to by them | `storage`, `getSession`, `clean`, `maxItems`, `history`, `trash`, `authorize`, `canCreate`, `visible`, `messages` | wedding: `lib/panel/lists.ts` (`visible`) | extended (`visible` in 0.4.0) |
| `createTaskListHandlers`, `cleanTask`, `describeTasks` | `anhel-frontend-library/server/lists` | The task list endpoint: task fields, history lines | `defaultCategory`, `noun`, `maxItems` (plus the list options) | wedding: `app/api/panel/tasks/route.ts`, `boardTaskHandlers` | in library (0.2.0) |
| `createBoardItemHandlers`, `cleanBoardItem` | `anhel-frontend-library/server/lists` | The board overview's items endpoint; a link must be http or https, a picture a small image data URL. Reuses `createListHandlers` | `types`, `maxImageChars`, `boardName` (plus the list options) | wedding: `boardItemHandlers` in `lib/panel/boardRoutes.ts` | in library (0.3.0) |
| `createWishlistHandlers`, `cleanWishlistItem` | `anhel-frontend-library/server/wishlist` | The wishlist's items endpoint: every item belongs to a category and a person only sees, adds, moves, changes and removes items of the categories `canSee` allows; a link must be http or https, a picture https; lengths limited; history lines. Reuses `createListHandlers` | `categories`, `canSee`, `wishlistName`, `maxItems` (plus the list options) | wedding: `app/api/panel/favors/route.ts` | in library (0.4.0) |
| `fetchLinkPreview`, `parsePreview`, `isPrivateAddress` | `anhel-frontend-library/server/link-preview` | Reads a pasted link's page: title, description, picture and price from Open Graph, product and JSON-LD tags. Public addresses only (private, local and reserved ones are refused, also after a redirect), standard ports, time and size limits | `fetchLinkPreview(url)`, `parsePreview(html, pageUrl)`, `isPrivateAddress(ip)` | wedding: `lib/panel/linkPreview.ts` | in library (0.4.0) |
| `createNotesHandlers` | `anhel-frontend-library/server/notes` | The notes endpoint: summaries, one whole note, create or save, delete; size and count limits; history. On any `ListStorage` | `storage`, `getSession`, `authorize`, `history`, `maxNotes`, `maxChars`, `colours`, `messages` | wedding: `boardNotesHandlers` in `lib/panel/boardRoutes.ts` | in library (0.3.0) |
| `createTrash` | `anhel-frontend-library/server/lists` | Keeps removed items for some days: `list`, `put`, `take`, `restore`; `restore` now puts the item back before the entry leaves | `storage`, `{ keepDays }` | wedding: `lib/panel/trash.ts` | extended (restore order fixed in 0.3.0) |
| `createTrashHandlers` | `anhel-frontend-library/server/lists` | The trash endpoint: GET, POST restore (to the list of its kind), DELETE for good | `trash`, `targets`, `getSession`, `authorize`, `messages` | wedding: `app/api/panel/trash/route.ts`, `lib/panel/trash.ts` | in library (0.3.0) |
| `text`, `isoDate`, `amount`, `listChanges` | `anhel-frontend-library/server/lists` | Forgiving converters for what a browser sends; history change lines | `text(value, max)` | wedding: `lib/panel/lists.ts` | in library (0.2.0) |

## Invitation and presentation

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `VideoEntry` | `anhel-frontend-library/video-entry` | Closed envelope image; a tap plays the video and music, then the entry blurs away | `closedImageSrc`, `videoSrc`, `audioSrc`, `texts`, `timings`, `wrapper`, `aspectRatio` | wedding: `components/invitation/VideoEntry.tsx` | in library (0.1.0) |
| `FramedPhotoStack` | `anhel-frontend-library/framed-photo-stack` | Scroll-driven sticky stack of tilted photos behind an oval frame | `photos`, `frameSrc`, `frameAspectRatio`, `photoClipPath`, `stickyTop`, `renderImage` | wedding: `components/invitation/PolaroidStack.tsx` | in library (0.1.0) |
| `ScheduleTimeline` | `anhel-frontend-library/schedule-timeline` | Program timeline with a growing thread, a sliding pendant and a sticky date strip with a heart | `days`, `heartSrc`, `pendantSrc`, `edgeDays`, `classNames`, `renderImage` | wedding: `components/invitation/ScheduleInvitation.tsx` | in library (0.1.0) |

## Icons and utilities

| Name | Import path | What it does | Main props or options | Came from | Status |
|---|---|---|---|---|---|
| `useConfirm` | `anhel-frontend-library/confirm-dialog` | In-page "Are you sure?" dialog instead of `window.confirm`: `ask(message, { confirmLabel, note })` and `dialog` | `texts` | wedding: `components/panel/useConfirm.tsx` | in library (0.2.0) |
| `shrinkPicture`, `scaledSize`, `nextAttempt` | `anhel-frontend-library/shrink-picture` | Scales a photo down to a small JPEG data URL, trying smaller until it is short enough (browser only) | `shrinkPicture(file, { longestSide, quality, maxChars, attempts })` | wedding: `components/panel/shrinkPicture.ts` | in library (0.3.0) |
| `useDismiss` | `anhel-frontend-library/use-dismiss` | Calls a function on a mouse press outside an element or on Escape, for dropdowns | `useDismiss(open, ref, onClose)` | wedding: account menu in `PanelApp.tsx` | in library (0.3.0) |
| `RenderImage`, `ImageRenderProps` | `anhel-frontend-library` | The type of the `renderImage` prop that swaps `<img>` for `next/image` | `src`, `alt`, `className`, `sizes`, `priority` | library (0.1.0) | in library (0.1.0) |
| Panel icons | internal: `src/icons.tsx` (not exported) | Small line icons drawn in the text colour, used by the components | `size`, `strokeWidth` | wedding: `components/panel/icons.tsx` | extended (19 icons added in 0.3.0, `Play` and `BookOpen` in 0.5.0) |
| `tools/cut-frame-interior.mjs` | script, not an import | Cuts a frame image's solid inside to transparent and suggests the matching clip-path | `--sample`, `--min-bright` and others | wedding: the frame-cutting script for the photo slider | in library (0.1.0) |
| `assets/*` | `anhel-frontend-library/assets/*` | Example images: `floral-frame.png`, `heart-gold.png`, `rings-gold.png` | none | wedding: images of the wedding site | in library (0.1.0) |

## Not extracted

Wedding-specific, so not in the library. The generic parts of these pages are in the library under the names above.

| What | Where it is | Why it is not in the library |
|---|---|---|
| Guest list with RSVP statuses, categories, tables, food, languages and the import from the RSVP sheet | wedding: `components/panel/GuestsPanel.tsx`, `lib/panel/rsvps.ts`, `app/api/panel/guests`, `app/api/panel/rsvp-import` | Guest fields and the one-way RSVP spreadsheet are the wedding's own data |
| Vendors (booked, pending, deposit, contract, payment dates) | wedding: `components/panel/VendorsPanel.tsx`, `app/api/panel/vendors` | Vendor fields, and a price taken from the wedding budget |
| The budget page itself (categories, totals, planned budget, vendor links) and the budget routes and store reads | wedding: `components/panel/BudgetPanel.tsx`, `lib/panel/budgetGuests.ts` (`loadBudget`, `effectiveBudgetGuests`), `app/api/panel/budget`, `app/api/panel/settings` | Wedding budget logic; its generic parts are `PyramidChart`, `LinkChips`, `PerPersonPrice` and the per-person helpers |
| The panel shell: overview cards, wedding countdown, welcome line, "My history" timeline, right column, page switching | wedding: `components/panel/PanelApp.tsx` | Composition of the wedding's pages; the generic pieces were taken out of it |
| The two private boards' pages and definitions (Bride Board, Groom Board) | wedding: `components/panel/BoardPanel.tsx`, `lib/panel/boards.ts`, `app/api/panel/bridesmaids*`, `groomsmen*` | Wedding structure; they are made of `BoardOverview`, `TaskChecklist`, `NotesPad` and `PinterestBoardList` |
| The wedding favors page's lists, permission keys and routes | wedding: `lib/panel/favors.ts`, `app/api/panel/favors/route.ts`, `app/api/panel/link-preview/route.ts` | The five groups and their `favors:<group>` permissions, and the route wiring; the generic parts are `Wishlist`, `createWishlistHandlers` and `fetchLinkPreview` |
| The panel's data types, store wiring and settings, preferences, people and history routes | wedding: `lib/panel/types.ts`, `store.ts`, `problems.ts`, `app/api/panel/settings`, `preferences`, `people`, `history` | App data and environment names; storage is covered by `StorageBackend` and `createSheetsStorage` |
| The Next.js pages and layout of the panel | wedding: `app/(panel)/layout.tsx`, `login/page.tsx`, `admin/page.tsx`, `panel.css` | App wiring and styling of one site |
| The portfolio page's text sections, footer and the "hub" mock | portfolio: `index.html`, `hub-idea/` | Content of one page |
| The portfolio's browser-window frame around a desktop screenshot | portfolio: `.browser` in `styles.css` | Not requested; a small wrapper with three dots and an image |

## How to add something

1. Check this catalogue (and the README) for something that already does the job. Extend it instead of adding a second one.
2. Make it generic: texts, endpoints, storage, navigation and data are props or options, with no environment names, routes or wedding wording inside. Give the component its own folder under `src/components/` with the component file, a CSS module and an `index.ts`. Server code goes under `src/server/`. Pure logic goes in its own file without React or Node imports, so the browser and the server can share it.
3. Add the entry point to `package.json` (`exports`) and to `src/index.ts` (browser-safe code only).
4. Add a test: pure logic and handlers in `tests/panel.ts` or `tests/server.ts`, and one render of each component in `tests/smoke.tsx`. `npm run check` has to pass.
5. Update the README (the table at the top, the entry points table and a section), the CHANGELOG (and the version in `package.json`) and this catalogue.
