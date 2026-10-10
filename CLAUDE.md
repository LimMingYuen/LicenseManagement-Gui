# License Management: Frontend

A web portal for issuing and tracking RSA-signed license files for industrial products
(KUKA AMR machines and robots, OMRON gateways). It is a port of an older desktop app whose signing
scheme, enum values and ID normalisation must stay compatible.

The portal is split across two repos. This one is the Angular 22 SPA (standalone components,
signals, Angular Material). The ASP.NET Core API lives in the sibling repo
`LicenseManagement-Backend`, which has its own CLAUDE.md with the API, domain and compatibility
rules. Locally both are cloned side by side under one workspace folder.

## Running locally

```bash
# http://localhost:4300. /api is proxied to the API on :5292 (src/proxy.conf.json).
npm start

# Vitest through the Angular builder
npm test
```

- CI: `.github/workflows/ci.yml` (build + unit tests on pushes to `main` and on PRs).
- Formatting follows Prettier (`.prettierrc`): 100 columns and single quotes.
- A cloud session has no backend running, so it can build and run the unit tests, but pages that
  call `/api` show the outage screen.
- `graft/` is a local index cache and `dist/` is build output. Don't edit or search either.

## Domain in brief

- **Application** is a product family that declares which payload types it may issue
  (Machine, Robot, Gateway). **Customer** is an entry in the register. A **Machine** is created when
  its first machine license is issued. A **Robot** license needs its machine licensed under the same
  application first; a **Gateway** license may name a machine.
- The license catalog is a tree: Application → Customer → Machine → licenses.
- Roles: `SuperAdmin` and `Operator` are system roles; others are custom. Destructive actions are
  SuperAdmin-only on the API, so table configs hide them from other roles.
- There is no revocation. Files are verified offline, so deleting a license only removes it from
  the register; a file already installed keeps working until it expires.
- Normalisation in `normalizeTarget` must match the server and the desktop app: machine IDs drop
  dashes, gateway device IDs drop whitespace and are uppercased, robot IDs are unchanged. File
  names: `gateway_<first 8 of fingerprint>.lic`, otherwise `<target>.lic`.

## Conventions (`src/app`)

- Standalone components, `ChangeDetectionStrategy.OnPush`, signals for state, `inject()` for DI.
  Services return Promises through `firstValueFrom`, and pages use `async/await` with
  `try/catch/finally` around a `loading` signal.
- Every component, dialogs included, keeps its markup and styles in sibling `.html` and `.scss` files
  (`templateUrl` / `styleUrl`); never inline `template` or `styles` in the `.ts`.
- **Folders:** every component gets its own folder named after it. A page's files sit at the root of
  `pages/<area>/`, and its dialogs and sub-components go in sibling folders
  (`pages/customers/customer-form/`). Table configs and helpers used by the page stay beside it;
  helpers shared by several pages in an area sit at the area root (`licenses/delete-message.ts`).
  Shell components that are not routed (`sidebar`, `server-unavailable`) live in `layout/`.
- **Adding a page:** add a lazy route in `app.routes.ts` spreading `...page(heading, icon)`, which
  sets the browser title and the shell header's heading and icon, and add an entry in
  `config/page-registry.ts`. The sidebar builds itself from the registry. Keep `superAdminOnly` in
  the registry in step with `superAdminGuard` on the route.
- **Page header:** the shell renders one `app-page-header` (in `sidebar.html`) above the routed page.
  A page puts its controls in a single `<ng-template appPageHeaderActions [count]="...">`, which
  `PageHeaderSlot` shows in the header while the page is alive; `count` renders as a pill after the
  title. Pages don't declare their own header.
- **List pages** use the shared `DataTableComponent` together with a `*-table.config.ts` builder.
  The builder takes `isSuperAdmin` and hides actions an Operator can't use.
- Dialogs open through `shared/utils/dialog.ts` (`dialogConfig`). Show errors with
  `describeError(...)` from `shared/utils/http-error.ts` in a snackbar.
- **Auth:** `AuthService` keeps Basic credentials in `sessionStorage` (`lm.credentials`), and
  `restoreSession()` runs as an app initializer. `authInterceptor` attaches the header to `/api`
  calls, logs out on a 401 and passes reachability to `HealthService`. When the server is
  unreachable, the session counts as *unverified*, not signed out.
- **Page permissions** are enforced only in the SPA (sidebar + `pageGuard`); the API checks just
  `[Authorize]` and the SuperAdmin role. Login and `/me` return `allowedPages`, and a SuperAdmin
  syncs the registry to `POST /api/pages/sync` after signing in or restoring a session.
- Material form fields default to `outline` with dynamic subscript sizing (set in `app.config.ts`),
  so don't repeat those settings on each field.

## Design notes

- **Session and health:**
  - Only a real API answer signs the user out. Status 0 and 502/503/504 keep the credentials as
    *unverified*, so a reload during an outage doesn't force a retype. `login()` sets the header on
    its own request so nothing is stored until it succeeds. Credentials are UTF-8 encoded before
    `btoa()`, which throws outside Latin-1. `sessionStorage` is XSS-readable; never move it to
    `localStorage`.
  - The interceptor doesn't report the `/api/health` probe itself (that would re-enter
    `HealthService`). 502/503/504 trigger a fresh probe, since behind a proxy they can't tell a dead
    API from a busy one; status 0 means unreachable and any other status proves the API is up.
  - A 503 whose body is a health report means *unhealthy*, not *unreachable*. One failed probe is
    ignored as a blip and two mark the API unreachable, except the first probe, which reports at
    once. `degraded` doesn't take over the screen. Polling pauses while the tab is hidden, and
    browser `offline` marks the API unreachable without probing.
  - `HealthService.start()` runs from an app initializer, not the constructor, because the
    interceptor injects the service and a probe during construction would re-enter it. It isn't
    awaited, so a dead backend can't hold a blank screen. The `DestroyRef` → `stop()` hook exists
    for tests, where timers would otherwise outlive the TestBed.
  - The outage screen replaces the whole shell, because anything left on screen would be stale.
    When the API recovers, an unverified session is re-validated automatically.
  - `App.currentUrl` is a signal from `NavigationEnd` because `Router.url` isn't reactive. Both
    `guestGuard` (navigations to `/login` while signed in) and the App effect (session restored
    while already on `/login`) are needed, or the login form renders inside the signed-in shell.
    `app-login-redirect.spec.ts` must write `sessionStorage` before anything injects `AuthService`.
  - The account menu sits on the right of the shell header. Its avatar status dot and connection
    row show `HealthService` status after the banner is gone.
- **Data table (`DataTableComponent`):**
  - Paginator and sort are wired from `@ViewChild` setters in a microtask, with no
    `ngAfterViewInit`; synchronous wiring throws ExpressionChangedAfterItHasBeenChecked, and the
    setters also cover a table that appears after loading.
  - `draftFor` creates filter drafts lazily so `mat-menu` bindings never read `undefined`.
  - Date filters: a date without time becomes 00:00 ("from") or 23:59:59.999 ("to"), and those
    boundary times reopen as "no time set". A reversed range shows an inline error instead of
    emptying the table.
  - The filter popover anchors to `.dt-th__anchor`, which spans the whole header cell; its negative
    inset equals the `th` padding because Chrome resolves `inset: 0` against a cell's content box.
    Width is measured on the next frame because the panel enters the DOM on attach.
    `min-width: 280px` in `data-table.scss` must match `POPOVER_MIN_WIDTH`.
  - `clearAllFilters()` calls `markForCheck()` because pages call it from their own toolbars.
    `getVisibleRows()` is what exports should use (filtered rows from every page, current sort).
    A column's `transform` also receives null, so the column decides how a missing value reads.
  - Header cells need `background: … !important` because Material sets a white background there.
    The search field overrides MDC sizing to match `--control-h`.
  - The Licenses table's Application and Type filter options are hard-coded so an option stays
    selectable with no matching rows. Update the application names by hand when a product is added.
- **Layout and Material quirks:**
  - Table pages use `page-fill` (the table scrolls itself); card pages use `page-scroll` (pinned
    header above a scrolling `.page`). The generate pages use neither: the form scrolls itself so its
    action bar stays pinned, and `generate-license-form.scss` copies the `_page-scroll` helpers
    because view encapsulation blocks the page partial. Don't remove them as duplicates.
  - The generate form's breakpoints are container queries on `gen` (window minus the nav rail).
    Overlay content (`.option-note`, the datepicker) renders on `<body>`, so it is styled top-level.
    A ResizeObserver sets `--field-calendar-width` on `documentElement` for the global
    `.field-width-calendar` rule, which also needs `height: auto` because cell padding is a
    percentage of width.
  - The header SCSS sizes projected controls to `--control-h` via `::ng-deep` on
    `.page-header__controls`, without `!important`, so a page can restyle its own.
  - Dialogs go through MatDialog so the CDK renders them on `<body>`, above the sidenav's stacking
    context and the table's sticky headers. Dialog styles are scoped to the `.app-dialog` panel
    class; its title + content padding restores what Material zeroes, which otherwise clips an
    outlined field's floating label.
  - Textareas set only `min-height`; `--mat-form-field-container-height: auto` breaks the floating
    label. The data table's own fields are excluded from global form-field sizing.
  - The sidebar's `.nav-item` needs `box-sizing: border-box` because the `*` reset in `app.scss` is
    scoped to the app component.
  - `server-unavailable`'s retry button wraps each `@if` branch in a `<span>` so MatButton's icon
    slot doesn't grab a bare `mat-icon`, and `.mdc-button__label { display: flex }` removes a
    baseline gap.
  - `index.html` must load Roboto weights 400–700 to cover `--fw-*`, or 600/700 render faux-bold.
- **Forms and pages:**
  - Cross-field errors (password mismatch) live on the form group, so the field needs
    `FormErrorStateMatcher` for its `<mat-error>` to show.
  - The generate form holds controls for all three configs so it is never rebuilt when `config`
    arrives, and copies its value via `valueChanges` (not `toSignal()`, which needed an injection
    context the field initializer didn't reliably provide). A robot's machine is a `'machine'`
    picker of already-licensed machines, not free text, so robots can't bind to unknown machines.
    Robots have no TRIAL tier, matching the desktop.
  - Page access: registry entries that are neither `superAdminOnly` nor `alwaysAllowed` (Dashboard)
    are permission pages; `getPermissionPages()` is what gets synced. Their routes use `pageGuard`, and
    `AuthService.canAccessPage` drives both the guard and the sidebar. Add a page to the registry and
    give its route `pageGuard`, or it is either unlisted or unguarded.
  - The Users page loads `/api/roles` with the users; its role filter and the `user-form` picker are
    built from that list, so the table config is a `computed`. Roles → "Show users" opens
    `/users?search=<role>` (global search).
  - Customers: the page lists customers with Licenses (total) and Active counts and offers create,
    View (`customer-detail`, details plus that customer's licenses) and, for a SuperAdmin, Delete.
    Delete is disabled while Active > 0 and its confirmation says expired licenses are removed too.
    `customer-form` only creates and sends null for code, contact and notes. Edit, status and merge
    are not offered even though the API still has them.
  - `LicenseDetailComponent` only emits `deleted` (shown to a SuperAdmin); the host confirms, deletes,
    shows the snackbar, removes the row or reloads the catalog, and closes the dialog. The signed
    file is fetched when the dialog opens, not in list payloads; downloads use the detail fetch
    because it carries the stored file name.
  - The Dashboard only reports license status: no navigation, issue or admin shortcuts. It loads the
    full list from `/api/licenses` and counts in `license-status.ts`, so `/summary` is unused; rows
    open the detail dialog with `hideDelete` and the status chips filter in place.
  - The catalog reloads the whole tree after a delete so roll-up counts come from the server, and
    tracks collapsed (not expanded) nodes so a new license shows in an open branch.
  - Applications link to `/licenses?application=<key>`, filtered server-side by key because display
    names can overlap.
  - Utilities: `toIsoDate` formats from local parts (`toISOString()` shifts the day across UTC).
    ISO date formats are provided per component, and `ISO_DATE_FORMATS` must keep the time formats
    because MatTimepicker reads the same token. `saveBlob` revokes the object URL one tick after the
    click. `safeReturnUrl` rejects `//host` and `/login`. `PillTone` guards `'pill--' + tone`; add a
    tone to the union and to `.pill--<tone>` in `styles.scss` together. `AppLogoComponent`'s geometry
    matches `public/logo.svg`; change both together.
  - Page-registry entries need `exact` where one path prefixes another (`/licenses` vs
    `/licenses/machine`).

## Comments

- Keep every comment short and professional: one plain sentence, neutral tone, no conversational
  phrasing, no history ("used to", "was changed because"), no first person.
- Write a one-line `/** */` summary per class and function: what it does, not how or why.
  Constructors and property accessors don't need one.
- A comment is one line of at most **110 characters, indentation included**. If it does not fit,
  cut words; never wrap onto a second line. Applies to `/** */`, `//` and `<!-- -->` alike.
- No comments inside function bodies. The only exception is a one-line note in an otherwise empty
  block (`catch { // … }`), because ESLint's `no-empty` rejects an empty block.
- No spec references, error-handling notes, or edge-case explanations.
- Reasoning and decision history belong in CLAUDE.md, not in code comments.

## Conventions

- A change that depends on a new or changed API contract needs the matching change in
  `LicenseManagement-Backend`.
