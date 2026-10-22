# Changelog

## 0.4.0 (2026-10-22)

The wishlist of the wedding site's planning panel ("Wedding favors"), extracted from `angela-simon-wedding` (branch
`feat/create-management-board`, working tree on top of commit e289ee0) and made generic: the categories, the
permission check, the endpoints and the page reader are passed in. [CATALOG.md](CATALOG.md) lists the new pieces.

- `Wishlist` (from `FavorsPanel.tsx`): tabs per category, item cards, an add and edit form, removal that asks first.
  Pasting a link fills the empty fields from an optional `fetchPreview(url)` function, so the component needs no server
  of its own. `prepareWishlistItem`, `fillFromPreview`, `itemsOfCategory`, `emptyWishlistItem` and `WISHLIST_LIMITS`
  are the pure part.
- `server/link-preview` (from `lib/panel/linkPreview.ts`): `fetchLinkPreview`, `parsePreview` and `isPrivateAddress`.
- `server/wishlist` (from `app/api/panel/favors/route.ts`): `createWishlistHandlers` on `createListHandlers`, with a
  `canSee(category, session)` option, and `cleanWishlistItem`.
- `wishlistSheetTable` (from `favorsTable` in `lib/panel/tables.ts`): `Category, Title, Description, Link, Price,
  Picture, ID`.

Changes to what 0.3.0 had:

- `createListHandlers` has a new `visible(item, session)` option (from `lib/panel/lists.ts`): an item a person may not
  see is left out of every reply, answers "not found" when they change or remove it, and cannot be created or moved to
  by them (403, the new `messages.notAllowed`). Lists without it behave as before.
- New entry points: `wishlist`, `server/link-preview` and `server/wishlist`; `server/storage/google-sheets` also
  exports `wishlistSheetTable`.

Differences from the originals:

- `isPrivateAddress` also recognises an IPv4 address written as IPv6 in hexadecimal. Node's URL parser turns
  `http://[::ffff:127.0.0.1]/` into the host `[::ffff:7f00:1]`, which the original did not treat as private.
- The wishlist form reads the same pasted link only once (the original read it again every time the field lost focus
  while the title was empty), ignores a reply that arrives after a newer paste or after the form was closed, and
  shows the placeholder when a picture cannot be loaded (the original hid the image).
- Wedding wording is gone: "present" and "favors" are texts, and the picture placeholder is the image icon.

## 0.3.0 (2026-10-22)

More planning-panel pieces, extracted from `angela-simon-wedding` (branch `feat/create-management-board`, working
tree on top of commit c5a5e5d) and from the `wedding-panel-portfolio` page, and made generic: texts, endpoints,
storage and navigation are passed in. [CATALOG.md](CATALOG.md) is new: it lists everything in the library.

- Notes: `NotesPad` and `DrawPad` (from `NotesPanel.tsx` and `DrawPad.tsx`), the note document and its checks
  (`cleanNoteDoc`, `previewOf`; from `lib/panel/notes.ts`, and `noteToPlainText` from `NotesPanel.tsx`) and `createNotesHandlers` (from
  `boardNotesHandlers` in `lib/panel/boardRoutes.ts`) on any `ListStorage`. `noteSheetTable` splits the content
  over several Google Sheet cells.
- `shrinkPicture` (from `shrinkPicture.ts`): size, quality and the character limit are options.
- `PyramidChart` (from `BudgetPyramid.tsx`): items with a label and a value, layers sliced by area, a legend, and
  optional `views` with a switch (the wedding site's "Planned" and "Actual"). `pyramidLayers` is the pure part.
- `MiniCalendar` (from `MiniCalendar` in `PanelApp.tsx`): dotted days and a red round count badge per day;
  `weekStartsOn`, `locale` and a fixed `today` are options. `monthCells` is the pure part.
- `SearchDialog` and `useSearchShortcut` (from `SearchDialog.tsx` and the Ctrl/⌘ K listener in `PanelApp.tsx`):
  sections of results are passed in.
- `useNotifications` and `NotificationBell` (from `useNotifications.ts` and the bell in `PanelApp.tsx`); the
  notifications are built by the pure `buildNotifications`.
- Accounts and permissions: `PermissionsPanel`, `AccountsPanel`, `MyInformation` and `AccountMenu` (from
  `PermissionsPanel.tsx`, `AccountsPanel.tsx`, `MyInformation.tsx` and the avatar menu in `PanelApp.tsx`), built on
  `createPermissionModel`; `createAccountHandlers` (the rules of `app/api/panel/accounts/route.ts`: grantable
  roles, password shown once) and `createPermissionsHandlers` (`app/api/panel/permissions/route.ts`), with
  `accountSheetTable` as the stored accounts' Google Sheets layout.
- `BoardOverview` (from `BoardOverview.tsx`) with `createBoardItemHandlers` and `cleanBoardItem` (from
  `boardItemHandlers`), `boardItemSheetTable`, and `LinkChips` (the "where to buy" chips of `BudgetPanel.tsx`).
- `PerPersonPrice` (the `EstimateCell` of `BudgetPanel.tsx`) and the pure helpers of `lib/panel/budgetGuests.ts`
  (`perPersonTotal`, `effectiveGuestCount`, `withPerPersonTotals`).
- `GroupedNav` (from `NAV_TREE` and `visibleTree` in `PanelApp.tsx`) with `visibleNavTree` and `firstNavPage`.
- Calendar feed (`server/calendar`, from `lib/panel/calendar.ts`, `calendarToken` in `lib/panel/auth.ts` and
  `app/api/calendar`): `buildCalendar`, `taskCalendarEvents` and `createCalendarFeed` (signed token and response).
- `TrashPanel` (from `TrashPanel.tsx`) and `createTrashHandlers` (from `app/api/panel/trash/route.ts`), on
  `createTrash`.
- From the portfolio page: `PhoneFrame`, `PhoneTour` (the swipeable screenshot row) and `RolePreview` (the
  "Log in as" menu preview).
- `useDismiss` (closing a dropdown on an outside click or Escape), used by the bell and the account menu.
- Icons added to `icons.tsx`: arrows, bell, copy, eraser, file, image, link, log out, pencil, plane, refresh,
  search, share, smile, type, undo.

Changes to what 0.2.0 had:

- `createTrash(...).restore` now puts the item back in its list before the entry leaves the trash (it was the other
  way round, so a failed save lost the item).
- New entry points: one per new component folder, `shrink-picture`, `use-dismiss`, `server/notes`,
  `server/accounts` and `server/calendar`. `server/lists` also exports `createTrashHandlers`,
  `createBoardItemHandlers` and `cleanBoardItem`; `server/storage/google-sheets` also exports `noteSheetTable`,
  `boardItemSheetTable` and `accountSheetTable`.

Differences from the originals:

- Notes: saves run one after another (a slow first save of a new note could create a second note), "back" saves
  before leaving, a failed delete is reported instead of closing the note, long loaded text is shown in full, a
  stroke with an odd number of coordinates is dropped, and the default stickers are not wedding-specific. The
  storage calls of the handlers are wrapped, so a failing store answers 502 instead of an unhandled error.
- Calendar feed: semicolons in text are now escaped (the original wrote `"\;"`, which JavaScript reads as a plain
  `;`), and long lines are folded between characters instead of inside one.
- `NotificationBell` also closes on an outside click and Escape; the original closed only on a second click.
- Account handlers: a generated username is retried at most 50 times, and storage failures answer 502.
- Tests: `tests/panel.ts` (new) next to the smoke test; `tests/smoke-render.mjs` runs all four files.

## 0.2.0 (2026-10-22)

Planning-panel pieces, extracted from `angela-simon-wedding` (branch `feat/create-management-board`, working tree
on top of commit f97d696) and made generic: roles, texts, endpoints and storage are passed in. Server-only code has
its own entry points (`server/auth`, `server/lists`, `server/storage...`) and is not exported from the root.

- Login: `LoginForm` and `SessionNotice` (from `components/panel/LoginForm.tsx`, `SessionNotice.tsx`), with texts,
  endpoints, icon and navigation as props, and no Next.js dependency. `createAuth` (from `lib/panel/auth.ts` and the
  `app/api/auth/login|logout` routes): scrypt password hashes, an HMAC-signed session cookie, roles and permissions
  looked up on every request, `requirePermission` / `requireRole`, and login/logout handlers that return plain web
  Responses. Accounts from the server settings and stored accounts are passed in as functions instead of fixed
  environment variable names.
- `createPermissionModel` (from `lib/panel/permissions.ts`): roles, permission definitions, defaults, the admin role
  and `grantableRoles` are configuration; secret permissions (closed even to the admin role) are kept.
- Tasks: `TaskList` (the task pieces of `components/panel/PanelApp.tsx`: star for important, assignee, deadline,
  person/status/time filters, compact list with "show more", pages), `AddTaskDialog` (its add-task modal),
  `TaskChecklist` (from `BoardTasks.tsx`), `useSharedList` (optimistic saving and polling; polling interval is an
  option) and `useConfirm`. Pure filter and sort helpers (`filterTasks`, `sortTasks`, `isInPeriod`) are exported.
- `createListHandlers` and `createTaskListHandlers` (from `lib/panel/lists.ts` and `app/api/panel/tasks/route.ts`):
  GET/PUT/DELETE with `clean`, history lines, `authorize`, `canCreate`, `normalize`, `beforeCreate` and an optional
  trash (`createTrash`, from `lib/panel/trash.ts`). The session lookup is passed in.
- Task storage: a `ListStorage` / `HistoryStorage` / `StorageBackend` contract with four backends: memory, JSON file
  (from `lib/panel/fileStore.ts`; writes are now queued and atomic, and an unreadable file is an error instead of an
  empty list), Google Sheets (from `lib/panel/sheetsStore.ts` and `tables.ts`; positional columns, the spreadsheet id
  and the Sheets client are passed in, tab names are quoted in ranges) and DynamoDB (new; Query or Scan layout, batched
  writes with retries). `selectStorage` picks one by name.
- `PinterestBoardList` and `PinterestBoard` (from `InspirationPanel.tsx`, `PinterestBoard.tsx`, `lib/panel/pinterest.ts`
  and `inspirationTags.ts`): add by link, tags, tag filter, live embed for full board links and a plain link for
  `pin.it` and other links. `cleanBoard` no longer needs a text helper passed in and survives a broken %-escape in
  the link; the tag `<datalist>` id is unique per list.
- `FigmaBoard` (from `components/panel/FigmaBoard.tsx` and `lib/panel/figma.ts`): the link is a prop (empty shows an
  empty state), `isFigmaLink` and `figmaEmbedUrl` are exported, and links outside figma.com are no longer embedded.
- Tests: `tests/server.ts` and `tests/storage-contract.ts` next to the smoke render test; `tests/smoke-render.mjs`
  runs all three.

## 0.1.0 (2026-10-18)

First version. Extracted from `angela-simon-wedding` (commit 00d8ac7) and made data-driven:

- `VideoEntry` (from `components/invitation/VideoEntry.tsx`): envelope image, tap to play the video plus
  background music, then a blur dissolve onto the page, with a floating music toggle. Texts, timings, media,
  wrapper and image component are props. The page now keeps one stable slot, so it is no longer remounted
  when the dissolve finishes.
- `FramedPhotoStack` (from `components/invitation/PolaroidStack.tsx`): sticky photo stack behind a frame,
  with an oval clip-path. Photos, frame, clip-path and layout are props.
- `ScheduleTimeline` (from `components/invitation/ScheduleInvitation.tsx`): scroll-grown thread with a sliding
  pendant, plus a sticky date strip with a sliding heart. Days, images, headings and edge days are props.
  Guards against an empty `days` array and a changing number of days.
- `tools/cut-frame-interior.mjs`: frame-interior cut-out tool. Changes from the original: explicit argument
  parsing (input filenames starting with a digit were skipped before), a usage error for a missing output
  path, a clear message when no opening is found, and a quoted path in the printed check command.
- Example assets: `floral-frame.png`, `heart-gold.png`, `rings-gold.png`.
