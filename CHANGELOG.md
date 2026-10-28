# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-28

### Added

- Every circulating ISO 4217 currency, listed by the browser through
  `Intl.supportedValuesOf("currency")` with English names from `Intl.DisplayNames`.
  Precious metals, test, fund and accounting codes (XAU, XXX, XDR, CHE and similar) and
  replaced currencies are left out; real X-codes such as XAF, XOF, XCD and XPF stay.
  Browsers without that API keep the original 12 currencies, which are always supported,
  so existing saved trips load unchanged.
- The currency picker is still a native select, now grouped: "Common" (USD, EUR, GBP, INR,
  JPY and others) first, then "All currencies" sorted by name.
- A new trip defaults to the currency of the browser's region (for example en-GB to GBP,
  de to EUR, ja to JPY), falling back to USD. The rule lives in `defaultCurrencyForLocale`
  in core.js and is tested.

### Changed

- Amount fields handle currencies with three minor digits (KWD, BHD, OMR, JOD, TND): the
  placeholder reads 0.000, entry and validation allow three decimals, and amounts show
  them. Zero-decimal currencies such as JPY keep a 0 placeholder.
- Currency-neutral wording: the amount labels no longer start as "Amount (INR)", the
  trip and member name examples are no longer Indian-specific, and the "valid amount"
  example matches the trip currency's decimals. The Goa sample trip keeps its rupee amounts.
- Checking a trip's currency no longer depends on the picker list. Any currency Intl
  knows by name is accepted, except metals, test, fund and accounting codes. A trip exported
  from another browser, or saved in a currency that has since been retired (such as HRK),
  still loads, and the picker shows that currency as selected instead of switching it.
- Amount limits are in major units, so they are the same in every currency: up to
  1,000,000,000 per expense (for example ¥1,000,000,000, $1,000,000,000 or KWD
  1,000,000,000) and 1,000 times that for a payment typed by hand. Before, the expense
  limit was 1,000,000,000 minor units, only ₹10,000,000 or $10,000,000.
- Adding, editing or restoring an expense is refused when it would push the trip's total
  past what can be added up exactly, with a message instead of a wrong total. Payments
  already had this check.
- Minor-unit digits are worked out when a currency is first used rather than for every
  currency at start-up.

## [1.0.0] - 2026-10-28

First public release.

### Added

- `npm run build` writes a static `dist/` (index.html, core.js, app.js, styles.css).
  Asset URLs get the same content-hash versions the dev server uses and stay relative.
  The Content Security Policy is also embedded as a `<meta>` tag.
- Hosting on Vercel at https://fairshare-trips.vercel.app, configured by `vercel.json`:
  the same CSP as the dev server plus `frame-ancestors 'none'`, HSTS, a permissions
  policy, and year-long immutable caching for the hashed assets.
- GitHub Actions CI runs lint, tests and the build on every push and pull request.
- MIT license.

### Changed

- Removed the remaining uses of the app's earlier name, SplitSafar. The core API is
  exposed only as `window.FairShareCore`, and the dev server's root override is now
  `FAIRSHARE_ROOT`.
- Browser storage keys are now `fairshare.*.v1`. On first load, data saved under the old
  `splitsafar.*.v1` keys is moved to the new keys once; nothing is overwritten, and the old
  copy is kept if the move cannot be written.
- The dev server and the build share one module for asset hashing and the CSP.

> **Entries before 1.0.0** were written while FairShare was built inside the AI Innovation
> Arena workspace, which also had a `frontend/` folder, a Makefile, a `BASE_BE_ENDPOINT`
> setting and platform-provided `.env` files. None of those are part of this repository,
> and the app never read anything from them.

## [0.31.7] - 2026-09-23

### Fixed

- Fixed the run-frontend URL check, whose error message was truncated.

## [0.31.6] - 2026-09-23

### Security

- Removed the platform-provided credential entries from the workspace's `.env` and `.env.example` (the app never used them). The Makefile no longer writes a `.env` file and passes configuration through environment variables instead.

### Changed

- The Makefile `run-frontend` target validates that `BASE_BE_ENDPOINT` is an http(s) URL and forwards it via environment variable.

## [0.31.5] - 2026-09-23

### Fixed

- Replaced self-closing SVG child elements with explicit open/close tags so the HTML parser no longer reports mismatched or unclosed tags.

## [0.31.4] - 2026-09-23

### Changed

- Moved the SVG grain texture from a data URI in styles.css to inline markup in index.html.
- Replaced the multi-line font-family syntax with a single-line system-ui stack.

## [0.31.3] - 2026-09-23

### Security

- Removed the deprecated `document.execCommand("copy")` fallback and the hidden-textarea workaround.
- Added a boot-time null-element guard that calls `showLoadFailure` instead of proceeding with missing DOM nodes.

### Changed

- Reformatted the stylesheet into expanded CSS with Prettier.
- The copy fallback now unconditionally shows an actionable error message.

## [0.31.2] - 2026-09-23

### Security

- The .gitignore and .env.example prevent accidental secret commits.

### Fixed

- CSS `env()` is now called once in a custom property so that less capable parsers do not choke on it inside `calc()`.
- Form controls without a visible `<label>` now carry an explicit `aria-label`.

## [0.31.1] - 2026-09-23

### Security

- Trip ids come only from Web Crypto; without it they fall back to a timestamp and counter instead of `Math.random`.
- Lists are cleared with `replaceChildren()` rather than assigning `innerHTML`.

### Changed

- The grain texture's SVG data URI percent-encodes its namespace slashes and inner `url()` parentheses, so simple CSS parsers read it correctly.

## [0.31.0] - 2026-09-23

### Changed

- Stylesheet: the dark theme block is written like the other media queries, `!important` is no longer used (the `hidden` rule is ordered last and the desktop layout relies on the script's visibility logic), zero lengths drop their unit, every `font-family` ends in a generic family, and deeply nested selectors are simplified.
- Scripts load with `defer`; every form control names its label explicitly with `aria-labelledby`; payment fields use one element per line.
- Reduced motion now also disables the swipe snap animation.

## [0.30.0] - 2026-09-23

### Fixed

- "New trip" overwrote the backup of unreadable data; its recovery copy now has its own key, and a failed copy stops "Export and start new".
- "Export and start new" exported before checking for changes in another tab; a failed storage read no longer allows the reset; a retry after a failure now closes the dialog.
- Payment save and delete failures are explained inside the payment sheet; a suggested payment that cannot be recorded says so.
- Stored payments above the typed limit made the whole trip unreadable, and large suggested settlements could not be recorded; trips now require only that their total volume is a safe integer.
- Sequence numbers are bounded so the next one is always exact; a new expense can no longer reuse an existing seq.
- `123,45,678` was accepted as Indian grouping.
- The focused current tab had no visible focus ring.

### Changed

- Trips saved before ids existed get an id on their next save.
- Toast and "New trip" announcements are refilled a moment after clearing, so repeated messages are read again.
- Trip menu items are no longer separate Tab stops; opening the add-expense sheet keeps a pending Undo.
- The expense list sorts once and orders same-day ties deterministically; misplaced doc comments and an unused selector removed; 8 regression tests added.

## [0.29.0] - 2026-09-23

### Fixed

- A new trip saved in another tab at the same revision could be overwritten or deleted; trips now carry an id that saves and "New trip" check, and storage read errors no longer count as empty storage.
- "Start new without exporting" closed the dialog before it could explain a refusal; "New trip" now keeps a recovery copy of the removed trip.
- Undo was lost if its save failed, and could not restore a payment dated outside the entry range.
- Deleting a payment moved focus away from Undo; the toast could stay open on touch screens after a tap.
- Large recorded payments could not be edited; payment edits are now validated like new payments.
- `0,001` was read as one thousand, and mixed digit grouping was accepted; `-12,50` reported the wrong error.
- Migration renumbered expenses with seq 0, ignored a larger stored counter, could reuse a payment's seq, and accepted unsafe payment seqs.
- Dark theme: trip menu focus ring, load-failure text, pressed primary buttons and the sheet backdrop now have enough contrast.

### Changed

- Toast messages are announced through a persistent live region; the "Mark as paid?" popup's description includes the amount.
- The payment sheet's button reads "Save changes" when editing; the trip menu supports Home/End and fits its longest item.
- Opening or cancelling an edit highlights the row without rebuilding the list; currency formatters are cached; migration checks seqs in linear time.
- The `<dialog>` polyfill moved from the app into the tests, which now fire `close` like browsers do.
- Removed the unused `nextPaymentSeq` counter, dead CSS and misplaced doc comments.

## [0.28.0] - 2026-09-23

### Added

- Dark theme that follows `prefers-color-scheme`, with matching focus rings, dialogs and theme colour.
- "Mark as paid?" confirmation popup for suggested payments, showing the computed amount with no editing or delete.
- Avatar chips for trip members on the setup screen, and amounts on the hero's settle-up preview.

### Fixed

- Zero-decimal currencies (JPY, IDR) prefilled edits 100x too small and could not be saved.
- Adding a member reset the chosen currency.
- New payments could collide with existing sequence numbers after a reload; old expenses without a sequence number are now migrated.
- Undo did not restore a deleted payment, and the Undo toast could disappear while it had focus.
- A corrupted saved trip blocked creating a new one; a trip deleted in another tab could be written back.
- Decimal commas (`12,50`) were read as thousands separators.
- Right swipes could mark payments paid; failed swipes left the row off-screen.
- Clicking inside a sheet's padding closed it; focus was lost after dialogs re-rendered their opener.
- The currency error never cleared; export revoked its download link too early; past-year dates hid the year.
- Payment form errors now set `aria-invalid`; the trip menu closes when focus leaves it; smooth scrolling respects reduced motion.

### Changed

- Currency lookups use own-property checks; payments may settle amounts above the single-expense cap.
- ESLint configuration de-duplicated, with `no-unused-vars` enforced.

## [0.27.0] - 2026-09-23

### Changed

- Added date integrity checks for new expenses and payments, bounded from
  1 Jan 2000 through today while preserving existing stored trips.
- Rewrote the README with product, privacy, accessibility, security and local
  development documentation.

## [0.26.0] - 2026-09-23

### Changed

- Replaced Mark as paid actions with accessible tap-to-record and touch/pen
  swipe-to-pay settlement rows.
- Added touch discoverability guidance and a one-time swipe nudge.

## [0.25.0] - 2026-09-23

### Changed

- Enforced strict source readability rules across app, core and server code.
- Suggested payment recording now pre-fills the first settlement and shared
  sequence ordering keeps same-day payments above earlier expenses.
- Removed duplicate payment toast feedback and tightened payment row styling.

## [0.24.0] - 2026-09-23

### Changed

- Merged reversible actions into the single bottom status toast.
- Compacted settlement actions and sorted expenses and payments together by date.
- Refined payment sheet defaults, focus return and payment code structure.

## [0.23.0] - 2026-09-23

### Added

- Added integer minor-unit payments between trip members, including migration,
  balance/settlement effects, exports and Copy summary entries.
- Added Mark as paid and manual Record a payment flows with undo support and
  payment rows in the Expenses feed.

## [0.22.0] - 2026-09-23

### Added

- Added per-trip ISO 4217 currency selection with schema migration of existing
  trips to INR and integer minor-unit parsing/formatting for supported codes.
- Added currency-aware setup fields, exports, summaries and expense displays.

## [0.21.0] - 2026-09-23

### Changed

- Replaced the inline new-trip warning with an accessible native confirmation
  dialog and safe export-before-delete behavior.
- Added an app-wide status toast for export and copy results, including a
  clipboard fallback for browsers without `navigator.clipboard`.

## [0.20.0] - 2026-09-23

### Changed

- Added a desktop two-column dashboard showing expenses, balances and
  settlements together while preserving mobile tab navigation.
- Reworked expense sheet opening motion to use open-state keyframes for mobile
  and modal fade/scale motion on desktop.

## [0.19.0] - 2026-09-23

### Changed

- Reworked the expense dialog into an accessible responsive bottom sheet with
  a sticky action footer, edit header actions and in-sheet save errors.
- Replaced tall participant rows with keyboard-accessible wrapping checkbox
  chips and Select all/Clear all controls.

## [0.18.0] - 2026-09-23

### Changed

- Reworked Balances into ordered member cards with avatars, status, proportional
  balance bars and calm settled states.
- Reworked Settle up into avatar-to-avatar payment rows with payment summaries,
  accessible names and an empty state.

## [0.17.0] - 2026-09-23

### Changed

- Whole-rupee amounts now omit decimals consistently while paise retain two
  decimal places across the app.
- Refined expense row metadata, truncation, empty states and workspace heading
  structure for compact mobile presentation.
- Removed the duplicate hero navigation action and made the sample trip dates
  relative to the current day.

## [0.16.0] - 2026-09-23

### Added

- Added a cinematic setup hero with a CSS-only dusk background, responsive
  sample trip preview and reduced-motion support.
- Added a one-click Goa sample trip that uses the normal save and workspace
  rendering path with representative expenses and balances.

## [0.15.0] - 2026-09-23

### Changed

- Added a compact trip header with the member count, formatted total and a
  keyboard-accessible black glass menu for export and starting a new trip.
- Expanded the desktop workspace to a 1040px layout with a left-aligned
  segmented tab control and a content-area expense action button.
- Added inner expense-row padding so focused rows keep their outline clear of
  the row content.

## [0.14.0] - 2026-09-22

### Changed

- Expense rows are now compact, full-width tappable buttons with a 40px payer
  avatar, description, muted payer/date/split metadata and a right-aligned
  tabular amount. Row accessible names include the description, amount and
  payer.
- Edit opens the existing expense sheet from the row. Delete now lives inside
  the edit sheet as a separate destructive action; undo behavior is unchanged.
- The Expenses view has additional bottom space so the final row is not hidden
  behind the floating action button or mobile tab bar. Saving or cancelling
  returns focus to the opening FAB or expense row.

## [0.13.0] - 2026-09-22

### Changed

- Reworked the visual system around a calm FairShare money-app surface:
  borderless cards, restrained teal accent, whitespace, stronger controls,
  tabular amounts and accessible focus states.
- Reworked tabs for the responsive layout without changing navigation or
  behavior.

## [0.12.0] - 2026-09-22

### Changed

- Renamed SplitSafar to FairShare. The page `<title>` is now "FairShare -
  split trip costs fairly", the header wordmark is "FairShare", the
  meta description, loading messages, error messages and Copy summary
  prefix all use the new name. Export files are named
  `fairshare-<slug>-<date>.json` with `app: "FairShare"`.
- The internal storage keys (`splitsafar.activeTrip.v1`,
  `splitsafar.backup.v1`) are unchanged so existing saved trips load
  without migration. `window.SplitSafarCore` is still set alongside
  `window.FairShareCore` for backward compatibility. Exported files with
  `app: "SplitSafar"` are accepted by the import logic.

## [0.11.2] - 2026-09-22

### Fixed

- Added missing `let undoDismissPaused = false;` declaration so saving an
  expense no longer throws `ReferenceError: undoDismissPaused is not defined`.
- `no-undef` is now active for `app.js` with the full set of browser globals
  (`window`, `document`, `history`, `HTMLDialogElement`, …), so undeclared
  variables are caught by lint.
- The expense form's add path now calls `exitEditMode()` after a successful
  save, closing the dialog sheet.
- Smoke test extended with a "Save expense through dialog" case that verifies
  the sheet closes, the expense row appears, and no console error was thrown.

## [0.11.1] - 2026-09-22

### Fixed

- Removed an orphaned duplicate of the `clearUndoBar` body that was left
  after the 0.11.0 dialog refactor. The stray closing brace closed `runApp`
  early, causing `ReferenceError: undoDismissPaused is not defined` and
  making the app unusable on load.
- Added `HTMLDialogElement` to the ESLint browser globals for `app.js`.

## [0.11.0] - 2026-09-22

### Added

- Round floating action button ("+", accessible name "Add expense") opens a
  native `<dialog>` bottom sheet (full width with rounded top corners,
  max-height 90vh, scrollable) on small screens, and a centred card
  (max-width 480px) at 900px and above.
- The sheet shows only "Save" and "Cancel"; the expense form's inline
  validation errors stay visible and the sheet stays open until a save
  succeeds. Escape, Cancel or a backdrop click closes without changes, and
  focus returns to the control that opened it (the + button or the
  expense's Edit button).

## [0.10.2] - 2026-09-22

### Changed

- **Tab bar restyled**: white card background with a subtle top border;
  inactive tabs use the muted text colour; the active tab uses the accent
  colour with a 3‑px accent line. All text/background pairs have at least
  4.5:1 contrast.
- **Tab bar positioning**: under 900 px the bar is fixed at the bottom
  (respecting `safe-area-inset-bottom`); at 900 px and above it is sticky
  at the top of the workspace.
- **One heading per view**: duplicated panel headings ("Expenses",
  "Balances", "Suggested payments") were removed — only the view headings
  (the focus target) remain. The tagline was also removed.
- **No focus outline for programmatic focus**: `[tabindex="-1"]:focus`
  hides the outline, keeping visible focus rings on interactive controls.

## [0.10.1] - 2026-09-22

### Fixed

- Removed leftover duplicate markup (a second Suggested payments panel, New
  trip/Export row, new-trip confirmation, Add Expense button, expense form
  and Expenses list) that was left below the workspace section after the
  0.10.0 three-view refactor. Every id now exists exactly once.
- Server tests verify that `index.html` has no duplicate `id` attributes
  and that every `label for=` references an existing id.
- Smoke test checks that on first load with empty storage, the workspace
  is hidden and only the setup screen is visible (no expense form, tab
  bar or panels leaking outside).

## [0.10.0] - 2026-09-22

### Added

- **Tabbed workspace**: the trip workspace is split into three views —
  Expenses (add/edit form + expense list), Balances (total + per-member
  balances), and Settle up (suggested payments + copy). A `nav` landmark
  labelled "Trip sections" holds three tabs; the current tab has
  `aria-current="page"`. On screens narrower than 900px the tab bar is
  fixed at the bottom; on wider screens it sits at the top.
- **URL hash routing**: switching views updates the URL hash
  (`#expenses`, `#balances`, `#settle`), the browser back button works,
  and refreshing opens the same view. An unknown or empty hash opens
  Expenses.
- **Content-Security-Policy compliance**: all inline `style` attributes
  were moved to dedicated CSS classes in `styles.css`. A server test
  verifies that `index.html` contains no `style=` attributes.

## [0.9.1] - 2026-09-22

### Fixed

- Removed stray prompt text from `styles.css` that broke the `:root` block and
  caused all colour variables to be lost. The file now starts with `:root{`
  and a test verifies it contains no "Context:" text.
- Replaced the inline `onclick="location.reload()"` on the load-failure Reload
  button with an `id="reload-failure"` and a `click` event listener attached
  in `app.js`. `index.html` now has no `on*` attribute, and a server test
  scans the served HTML for any inline event handlers.
- `server.js` now sends a `Content-Security-Policy` header on HTML responses:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'
  data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none';
  form-action 'self'`. A server test verifies the exact CSP directives and
  that `frame-ancestors` is absent. Export downloads (blob URLs) and copy
  summary continue to work under this policy.

## [0.9.0] - 2026-09-22

### Added

- **Export trip** button in the workspace that downloads a JSON file
  (`splisfar-<slug>-<date>.json`) containing the full trip data. The
  `buildExport(trip, now)` pure function in core.js builds the export
  object and file name; tests verify the shape and slug generation.
- **New trip** button with an inline confirmation dialog (not
  `window.confirm`) that explains the current trip will be removed and
  offers three actions: "Export and start new", "Start new without
  exporting" and "Cancel". Starting new clears the saved trip and returns
  to an empty setup screen with focus on the trip name field.
- `no-unused-vars` is now active for `app.js`; the unused `prevCount`
  variable was removed, and `Blob`/`URL` globals were added to the ESLint
  config. A smoke test covers the "Start new without exporting" path.

## [0.8.4] - 2026-09-22

### Added

- **Focus after member removal**: `removeMember` moves focus to the next
  member's Remove button, the previous one if it was the last, or the member
  name input if the list is empty.
- **Focus on first invalid field**: `collectExpenseInputs` focuses the first
  field with an error, in form order (description → amount → paid by → date →
  split). A smoke test verifies that submitting with an empty amount focuses
  the amount input.
- **Server robustness**: `loadFile` and `getEntry` wrap file-system calls in
  try/catch and store a `FAILED_FILE` sentinel on error. If an asset file is
  missing or unreadable, the server responds with `503 Service unavailable`
  (Cache-Control: no-store) instead of crashing. A server test simulates a
  missing asset (app.js) and verifies the 503 and that a later request for a
  valid file still returns 200.

## [0.8.3] - 2026-09-22

### Added

- `jsdom` as a devDependency and `test/app.smoke.test.js` — an end-to-end
  smoke test that loads `index.html` with `core.js` and `app.js` into a
  jsdom window, drives the UI to create a trip and add expenses, and
  asserts the visible balances and settlement lines. A second test reloads
  the page from the saved `localStorage` and asserts the same balances.
  Together they cover the full create → expense → settle → reload cycle
  without network access (under 0.3 seconds).

## [0.8.2] - 2026-09-22

### Fixed

- `saveState` now uses `const baseRevision = state ? (state.revision || 0) : 0`
  so a first-time user (null state) can successfully create a trip.
- Added `prepareSave(baseRevision, storedRaw)` pure function in core.js that
  returns `{ ok: true, nextRevision }` or `{ ok: false }` for conflict. Used
  by `saveState` in place of the previous inline logic.
- Five core tests for `prepareSave`: empty storage (revision 1), matching
  revision, different revision (conflict), and corrupted / `"null"` stored
  values (no crash, allows save).
- `function readStoredTrip` and `if (!valid)` in createTrip were changed from
  column 0 to 2‑space indentation.

## [0.8.1] - 2026-09-22

### Fixed

- **Transactional saves**: `persist()` replaced with `saveState(newState)`. The
  new revision is computed and written to localStorage first; `state` is only
  updated after a successful write. A failed quota write no longer corrupts the
  in-memory revision.
- **No lost work on save failure**: all callers (add, edit, delete, undo,
  create) now construct a new state, call `saveState`, and only re-render or
  clear the form on success. If the save is rejected (conflict or storage
  full), the previous trip and open form values are preserved on screen.
- **Recovery from stored `null` or non-trip data**: `checkSaveConflict` now
  validates that the stored JSON is an object with trip structure (`name`,
  `members`) before checking the revision. Stored `null`, primitives or
  structure-less objects are treated as corrupted and overwritten, so a
  replacement trip created after recovery can always be saved.
- Tests added for `checkSaveConflict` with JSON `'null'`, primitives, and a
  structure-less `{ revision: 5 }` object.

## [0.8.0] - 2026-09-22

### Added

- `computeSettlements(trip)` pure function in core.js that returns a
  deterministic list of `{ from, to, amountPaise }` payments using integer
  paise. Repeatedly matches the member who owes the most with the member owed
  the most (ties broken by trip member order), producing at most
  (members - 1) payments. Never produces a zero or negative payment.
- "Suggested payments" panel in the workspace showing one line per payment
  (e.g. "D pays A Rs 51.66"), or "Everyone is settled." when nothing is due.
- "Copy summary" button that copies the trip name plus all payment lines to
  the clipboard, with a visible "Copied!" confirmation or a graceful error
  message if the clipboard API is unavailable.
- Tests for the four settlement scenarios: A/B/C/D fixture (D→A 5166, D→B 834,
  C→B 333), payments cancel all balances, all-settled trip returns empty, and
  a trip with a `__proto__` member works correctly.

## [0.7.8] - 2026-09-22

### Fixed

- Removed orphaned duplicate of the old `readStoredTrip` body that was left
  behind after the 0.7.7 edit, which broke the app by closing `runApp` early.
- Re-enabled `no-undef` for `app.js` with the full set of browser globals
  (`window`, `document`, `localStorage`, `location`, etc.), so this class of
  error will be caught by lint in the future.

## [0.7.7] - 2026-09-22

### Added

- `tabindex="-1"` on the trip heading so focus lands there after Create Trip.
- `checkSaveConflict` pure function in core.js that compares a local revision
  against a stored trip's revision. Tests cover matching, differing, null,
  unparseable and missing revision cases.
- Conflict detection: `persist()` reads the stored revision before every save
  and rejects the save when another tab has changed the trip, showing a
  "This trip was changed in another tab" notice with a Reload button.
- `storage` event listener so an idle tab shows the same conflict notice as
  soon as another tab saves.
- Recovery notice now says "could not be backed up" when the backup write
  fails, instead of claiming a backup was kept.

### Changed

- Saved trips now carry a `revision` field that starts at 0 and increments on
  every successful `persist()`. Old trips without a revision load as revision 0.

## [0.7.6] - 2026-09-22

### Fixed

- Re-rendering the workspace after delete or undo no longer resets the open
  add/edit form: `renderPayerOptions` preserves the selected payer, and
  participant checkboxes are rebuilt only when intentionally cleared.
- Focus is never lost to the body: after Create Trip focus moves to the
  trip heading; after Close it moves to the Add Expense button; Cancel in
  edit mode returns focus to the edited expense's Edit button.
- The undo bar does not auto-dismiss while its Undo button is focused or
  hovered. It is also not dismissed by opening the Add/Edit form (the
  clear-on-toggle and clear-on-edit calls were removed). It still closes on
  the next add, edit or delete, or 10 seconds after losing focus.
- Input border colour changed from `#e2e8f0` (≈1.2:1 contrast) to `#6b7280`
  (≈4.8:1 contrast), meeting the 3:1 minimum for non-text UI components.

## [0.7.5] - 2026-09-22

### Fixed

- Removed duplicated `const balances` declarations in `core.test.js` that
  caused a parse error.
- Load-failure guard now covers the case where `app.js` itself fails to
  load: `index.html` renders a static `<div id="loading-status" role="status">`
  with "Loading SplitSafar… If this message stays, please reload the page."
  that is hidden by `app.js` once it starts. If `app.js` never runs, the
  message stays visible and no broken UI is shown.
- `validateExpenseFieldsSeq` now rejects negative `seq` values.
- The app IIFE was reorganised so the main logic lives in `runApp()`, keeping
  the complexity of the IIFE itself at 6.

## [0.7.4] - 2026-09-22

### Fixed

- Tests that compare `null`-prototype objects returned by `computeBalances`
  and `splitPaise` now spread the result (`{ ...result }`) before comparing
  with `assert.deepStrictEqual`, so the test suite is fully green.
- `validateExpenseFields` was split into four smaller functions
  (`validateExpenseFieldsBasic`, `validateExpenseFieldsPayerDate`,
  `validateExpenseFieldsParticipants`, `validateExpenseFieldsSeq`), each
  with complexity 10 or below.
- `eslint.config.js` now declares Node globals for itself, so `module` is
  defined when linting the config file.

## [0.7.3] - 2026-09-22

### Fixed

- `computeBalances` no longer breaks when a member is named `__proto__`,
  `constructor` or `toString`: all per-member objects now use
  `Object.create(null)` instead of plain `{}`.
- `migrateTrip` and `validateExpenseFields` reject duplicate participants,
  duplicate expense `seq` values, and legacy `amount` values that overflow
  safe integer range (e.g. `1e308`). Previously these could produce
  non-zero-sum balances or `Infinity` paise.
- A shared `validateExpenseFields` function validates description,
  `amountPaise`, payer, date, participants (unique, existing members) and
  optional seq (unique), and is used by add (via `app.js`), edit (via
  `validateChanges`) and migration (via `validateExpense`).
- `migrateLegacyAmount` now rejects amounts above ₹10,00,000 when computed
  from old-format float values, preventing `Math.round` from overflowing.

## [0.7.2] - 2026-09-22

### Changed

- Each asset's version token is now computed over `server.js` bytes + the
  asset's file name + the asset's bytes (first 16 hex chars of SHA-256). Any
  server change (including bug fixes) therefore invalidates every cached URL,
  preventing the replay of wrong responses cached from a previous server.
- The token format changed from 64 hex chars to 16 hex chars. All regex
  patterns and stale-hash constants in tests were updated accordingly.

### Fixed

- Prevents a repeat of the 0.7.1 cache-poisoning incident, where the
  server sent core.js bytes for `/app.js` and `/styles.css`, and the CDN
  cached those wrong responses at the same URL for a year because the
  asset files themselves had not changed and therefore their hash URLs
  stayed the same.

## [0.7.1] - 2026-09-22

### Fixed

- Non-HTML route handler now serves `getEntry(route.file)` instead of always
  serving `core.js`, so `/styles.css` and `/app.js` return their own content.
- Added server tests that verify response bodies match the corresponding file
  on disk and that all three asset bodies differ from each other.

## [0.7.0] - 2026-09-22

### Added

- `frontend/app.js` and `frontend/styles.css` extracted from the inline script
  and style blocks in `index.html`. `index.html` now contains no inline
  script or style.
- Both files are served through the same single-loader and content-hash URL
  mechanism as `core.js`: `app.js?v=<hash>` and `styles.css?v=<hash>` are
  rewritten into `index.html` at serve time, and immutable caching is only
  enabled when `?v=` matches the file's current hash.

### Changed

- `npm run lint` now also checks `app.js`.
- Server and content-hash tests verify that all three assets (`core.js`,
  `app.js`, `styles.css`) are referenced in the HTML with current hashes,
  each returns the correct `Content-Type`, and a stale hash yields
  `no-cache`.
- Version bumped to 0.7.0.

## [0.6.3] - 2026-09-22

### Fixed

- Ordering bug where editing `core.js` and requesting the old hash before any
  HTML request could serve the new content as immutable under the old hash.
- The cached content and its hash are now always updated together by a single
  `loadFile` / `getEntry` path. The separate `refreshCoreHash()` function was
  removed.

### Changed

- Server tests include a regression case for the ordering scenario: edit
  `core.js`, request with the old hash (must be `no-cache`), then request
  `/` (must show the new hash).

## [0.6.2] - 2026-09-22

### Changed

- Server reloads allowlisted files when their modification time changes, so an
  update without restart is always served.
- `core.js?v=<SHA-256 hash>` computed from the file content at request time;
  the hash is injected into `index.html` on every response. Immutable
  `Cache-Control` is only sent when `?v=` matches the current content hash;
  any other `?v=` gets `no-cache`.
- Package-version URL test replaced with a server test that proves editing
  `core.js` while the server runs changes both the served content and the hash,
  and that a stale hash gets `no-cache`.

## [0.6.1] - 2026-09-22

### Changed

- Refactored `core.js`: split `migrateTrip` and `parseAmount` into smaller
  single-purpose validators; added JSDoc to every exported function; used
  optional catch binding with explanatory comments.
- Refactored `server.js`: `respond()` now takes an options object; allowed
  files are read into memory once at startup; `console.log` replaced with
  `process.stdout.write`; the `Allow: GET, HEAD` header is correctly sent on
  405 responses; the immutable `Cache-Control` for `/core.js` is only set when
  the query `?v=` exactly matches the package version.
- Refactored the app script in `index.html`: extracted expense-input validation
  and the undo-bar helper into smaller functions; used optional catch binding.
- Added `eslint.config.js` with the recommended rules plus `no-var`,
  `prefer-const`, `eqeqeq`, `complexity` (max 10), `max-lines-per-function`
  (max 50), `max-params` (max 4) and `no-unused-vars`. ESLint added as a
  devDependency.
- Add Makefile `lint` and `check` targets; npm script `lint`.
- Package version bumped to 0.6.1.

## [0.6.0] - 2026-09-22

### Added

- Versioned asset URL: `index.html` loads `core.js?v=<package.version>`, so a
  version bump invalidates any stale CDN cache.
- Version-consistency node:test that fails if the query-string version does not
  match `package.json`.
- Server tests covering every status code and `Cache-Control` value.
- Load guard: if `window.SplitSafarCore` is missing the app displays a
  "SplitSafar could not load" message with a Reload button and does not start.

### Changed

- Server now sets `Cache-Control` per route: HTML → `no-cache`; `/core.js`
  with a `?v=` → immutable one-year; without `?v=` → `no-cache`; errors →
  `no-store`. Keep `nosniff` and `no-referrer`.
- Package version bumped to 0.6.0.

## [0.5.0] - 2026-09-22

### Added

- Delete button on every expense row, with an accessible name such as
  "Delete expense: Cab".
- Undo bar shown in an `aria-live="polite"` region after a delete, with a
  single-level Undo that restores the expense at its original seq and position.
- `removeExpense(trip, seq)` and `restoreExpense(trip, expense)` pure functions
  in `frontend/core.js`, with `node:test` coverage.

### Changed

- Deleting recomputes the total and balances immediately and persists; the undo
  bar closes after 10 seconds or on the next add, edit or delete.
- Deleting the expense currently being edited cancels edit mode first.
- Edit mode now hides the Add Expense toggle and Close button (Cancel remains)
  and marks the edited row with `aria-current="true"`.
- Package version bumped to 0.5.0.

## [0.4.0] - 2026-09-22

### Added

- Edit button on every expense row that opens the existing expense form
  pre-filled with the description, amount, payer, date and participants.
- Cancel action that leaves the trip unchanged and returns the form to add mode.
- `updateExpense(trip, seq, changes)` pure function in `frontend/core.js`, with
  `node:test` coverage for balance changes, unknown seqs and invalid changes.

### Changed

- Editing reuses the same validation as adding and updates the expense in place,
  keeping its `seq` so same-date ordering stays stable.
- Saving or cancelling an edit returns focus to that expense's Edit button;
  opening an edit moves focus to the description field.
- Package version bumped to 0.4.0.

## [0.3.0] - 2026-09-22

### Added

- `frontend/core.js`: pure money, persistence and date logic, exposed as
  `window.SplitSafarCore` in the browser and via `require()` in Node.
- `frontend/test/core.test.js`: dependency-free `node:test` coverage for amount
  parsing, paise splitting, balances, migration, corrupted data and date
  formatting.
- `test` target in the `Makefile` plus a `.PHONY` listing for every target.
- `README.md` and this changelog.
- Meta description, inline SVG favicon, `aria-expanded`/`aria-controls` on the
  Add Expense toggle, and a minimum 44px touch height for every button.

### Changed

- Amount entry now parses straight to integer paise, rejects hex, binary,
  exponent, negative, zero and over-limit values with specific messages, and
  treats commas as ignorable separators.
- Expenses store `amountPaise`; totals, shares and balances are computed in
  integer paise with leftover paise assigned in trip-member order.
- Saved trips carry `schemaVersion`; old rupee-format trips are migrated on
  load without losing data.
- Unreadable saved data is backed up and surfaced through a dismissible notice;
  save failures show a visible warning banner.
- Members can be removed at any time; the 2–10 member rule is enforced when
  Create Trip is pressed.
- Dates display in Indian style (`22 Sep 2026`) while remaining stored as ISO.
- `server.js` serves `/core.js` with a JavaScript content type; all other paths,
  including `/test/`, return `404`.

## [0.2.0] - 2026-09-22

### Added

- Accessible names for every form control, `aria-describedby`-linked errors,
  `aria-invalid` state, polite live regions and visible focus styles.
- Allowlisted static file server with `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`.

### Changed

- Improved text contrast to meet WCAG AA.
- Forms declare explicit `action="#"` and `method="post"` while remaining
  JavaScript-handled.

## [0.1.0] - 2026-09-22

### Added

- Initial SplitSafar core loop: create a trip, add members, record expenses,
  and view per-member balances with browser-only persistence.
