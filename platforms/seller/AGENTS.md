# Seller Portal — `https://seller.mynew1.net`

Route prefix `seller.`, 67 routes. Inertia.js + Svelte single-page app; brand "COOS · Seller Portal"; browser title "Dashboard - Laravel" on the dashboard and "COOS" elsewhere. Footer text "Default page footer".

Read [`../AGENTS.md`](../AGENTS.md) first for shared foundations, glossary, statuses, and configuration values. Lifecycle diagrams: [`../workflows/AGENTS.md`](../workflows/AGENTS.md).

## Layout and navigation

Sidebar (collapsible groups, "Toggle Sidebar" button, badge "COOS 2" = seller display name):

| Group | Item | URI | Permission key |
| --- | --- | --- | --- |
| Platform | Dashboard | `/` | `seller.dashboard.view` |
| Platform | My Profile | `/profile` | — |
| Platform | Fabricas › Orders | `/orders` | — |
| Platform | Fabricas › Tasks | `/fab-delivery/tasks` | — |
| Platform | Fabricas › Artifacts | `/fab-delivery/artifacts` | — |
| Platform | Fabricas › Revision Requests | `/fab-delivery/revision-requests` | — |
| Platform | Fabricas › Seller Execution Queue | `/fab-delivery/execution-queue` | — |
| Personal Info | Account › Profile | `/accounts/profile` | `seller.account.profile.view` (group `seller.account.view`) |
| Personal Info | Account › Security | `/accounts/security` | `seller.account.security.view` |
| Personal Info | Account › Appearance | `/accounts/appearance` | `seller.account.appearance.view` |

User menu (bottom-left): Profile → `/accounts/profile`, Logout → `POST /logout`. Shared props on every page: `auth.user` (id, name, email, timezone, country, status, last_login_at), `sidebar`, `sidebarOpen`, `pageMetadata` (title, breadcrumbs, header, rightSidebar, briefData), `flash` (success / error / warning), `appearanceSettings`, `locale` (en/vi/th).

Right sidebar on detail pages: "Views" section with tabs (Overview, Activities, Status History, plus object tabs). Persistent, deep-linked, responsive.

## Screens and features

### Dashboard `/` and `/dashboard`

Component `seller/dashboard`; header "Dashboard"; no widgets or data (placeholder). `Unresolved requirement:` intended dashboard content.

### My Profile `/profile` (`seller.profile.edit` → `POST /profile/update`)

Form `seller-profile-form`, buttons "Save Profile" / "Cancel", dirty-check enabled, toast on result.

| Section | Field | Rules observed |
| --- | --- | --- |
| Identity | Profile Image (`profile_image`) | image upload, max 10 MB, jpeg/png/jpg/webp, crop ratio 16:9, delete button |
| Identity | Display Name (`display_name`) | text, placeholder "Your public display name"; shown to buyers as seller name |
| Identity | Bio (`bio`) | textarea, 4 rows, character counter, placeholder "Tell buyers about yourself..." |
| Availability | Accepting New Orders (`accepting_new_orders`) | toggle, default on; description "When turned off, buyers will not be able to place new orders with you." → buyer Fab page shows "Not accepting orders" |
| Working Schedule | Timezone (`timezone`) | combobox of IANA zones with UTC offsets |
| Working Schedule | Working Schedule (`working_schedule`) | custom editor `working-schedule-editor`: per weekday `enabled`, `start`, `end` (e.g. tuesday 09:00–17:00) |

Snapshots of the schedule are copied into each Order/Task at purchase time; delivery deadlines are computed in Seller working hours.

### Orders `/orders` (`seller.orders.index`)

Datatable `orders` (title "All Orders"), only Orders whose `seller_id` is the current seller.

- Columns (default visible marked ●): ● Code (link to show) · ● Status badge · ● Buyer Email · ● Title (fab, 35% width) · ● Package · ● Package Quantity · ● Total Amount · Currency · ● Created At.
- Filter: Status (New, Ready, Active, Delivered, Completed, Closed, Canceled). Code search ("Code — enter one or more values, separated by commas").
- Row actions: none (no `record_actions_key`).
- Show `/orders/{order}` (form `order-show-form`, read-only): Order Info (Code copyable, Status badge, Created At) · Buyer (Email, Name) · Fab (Title, Package, Package Tier) · Pricing (Package Quantity, Subtotal, Platform Fee, Payment Fee, Tax, Total Amount, Currency). Right sidebar views: Overview, Activities (`/orders/{order}/activities`), Status History (`/orders/{order}/status-history`), Tasks (`/orders/{order}/tasks`).
- Edit `/orders/{order}/edit` (form `order-edit-form` → `POST /orders/{order}`): every field read-only except Status select (New, Ready, Active, Delivered, Completed, Closed, Canceled); buttons "Update" / "Cancel". `Unresolved requirement:` whether a seller is meant to change Order status manually; no UI entry point to this page was observed (no row action, no header button).
- Order Tasks tab: datatable `order_tasks` filtered to the Order (Code, Sequence No., Status, Started At, Due At, Completed At, Created At; Status filter).
- Order Status History tab: Time, Old Status, New Status, Note, Changed By.
- Order Activities tab: Code, Module, Created At, Created By, Action, Message; filters Module, Action.

### Tasks `/fab-delivery/tasks` (`seller.fab-delivery.tasks.index`)

Datatable `order_tasks` ("All Tasks", description "Task management").

- Columns: ● Code (link) · ● Order (link to order) · ● Sequence No. · ● Status badge · ● Started At · ● Due At · Completed At · ● Created At.
- Filter: Status (New, In Progress, Delivered, Completed, Disputed, On Hold, Canceled). Code search.
- Row action "Create Artifact" (GET `/fab-delivery/artifacts/create?task_id={id}`) appears only for Tasks in `in_progress` (`canCreateArtifact`); record flags `hasActionableArtifact`, `canCreateArtifact`, `financial_resolution_required`, `reupload_due_at`.
- Show `/fab-delivery/tasks/{orderTask}` (read-only): Task Info (Code, Status, Sequence No.; Started At, Due At, Reupload Due At, Completed At, Created At) · Order Snapshot (Order Code, Order Status) · Fab (Fab Title, Fab Category; Package, Tier) · Pricing (Unit Price, Quantity, Amount; Tax, Total Amount, Currency) · Package Items (custom list `package-items-list`) · Working Schedule (Timezone, read-only editor). Views: Overview, Activities, Status History, Artifacts (`/fab-delivery/tasks/{orderTask}/artifacts`), Revision Requests (`/fab-delivery/tasks/{orderTask}/revision-requests`).
- Task record fields (for test data): `brief`, `delivery_duration_hours` (e.g. 72, 240, 720, 1080, 1440), `revision_limit` (1–2 observed), `accepted_revision_count`, `working_schedule`, `timezone`.

### Artifacts `/fab-delivery/artifacts` (`seller.fab-delivery.artifacts.index`)

Datatable `order_artifacts` ("All Artifacts", "Delivery artifacts management"), default sort `order_artifacts.created_at desc`.

- Columns: ● Artifact Code (link) · ● Order (link) · ● Task (link) · ● Status badge (Verifying, Submitted, Revision Requested, Approved, Rejected, Error) · ● Delivery # (`sequence_no`) · ● Submitted At · ● Created At.
- Filter: Status. Search: "All — Order, Task" and "Code — Artifact Code".
- Create `/fab-delivery/artifacts/create?task_id=` (form `artifact-form` → `POST /fab-delivery/artifacts/submit`): section Details → Delivery Note (`note`, textarea 4 rows, placeholder "Delivery Note"); section Files → File Ids (`file_ids`, media-gallery-upload, required, `maxFiles` 1); hidden `task_id`. Submission creates the Artifact in `verifying`; after the malware scan it becomes `submitted` and the Buyer review window starts. The route is `POST /fab-delivery/artifacts/submit` (`seller.fab-delivery.artifacts.submit`).
- Show `/fab-delivery/artifacts/{artifact}` (read-only): Task (code), Status, Delivery #, Delivery Cycle, Seller Submitted At, Verified At, Buyer Available At, Verification Result ("No threats found"), Verification Provider (`amazon_guardduty`), Verification Started At, Verification Completed At, Review Deadline (`buyer_review_due_at`), Verification Error Detail, Delivery Note; Files gallery (read-only, file name, size, presigned download). Views: Overview, Activities, Status History, Revision Requests. Record also carries `approval_type` (`manual`), `buyer_review_remaining_seconds`, `buyer_response_due_at`, `revision_request_id`, `files[]`, `status_histories[]`.
- `Unresolved requirement:` re-upload flow for `error` Artifacts (route not distinct; `reupload_due_at` on the Task suggests the same create form).

### Revision Requests `/fab-delivery/revision-requests` (`seller.fab-delivery.revision-requests.index`)

Datatable `revision_requests` ("All Revision Requests").

- Columns: ● Revision Code (link) · ● Order (link) · ● Artifact (link) · ● Reason (`reason_type_label`) · ● Status badge (New, Accepted, Denied, Withdrawn) · ● Requested At. No filters; Code search.
- Show `/fab-delivery/revision-requests/{revision}` (read-only): Revision Code, Status, Reason, Response Deadline (`seller_response_due_at` = created + 24 h), Revision Duration (hours), Requested At, Order, Artifact, Note, Deny Reason Type, Denial Reason. Views: Overview, Activities, Status History. Record fields: `remaining_revisions_at_creation`, `requested_by` (buyer), `reason`, `deny_reason`, `artifact.task`.
- Accept form `GET /fab-delivery/revision-requests/{revision}/accept` (`revision-request-accept-form` → `POST …/accept`): "Accept Revision" — Revision Duration (hours) (`revision_duration_hours`, number, required, min 1); buttons "Accept Revision" / "Cancel". Workflow rule: duration must be a positive whole hour shorter than the original delivery duration; acceptance consumes one revision from the Task quota and returns the Task to `in_progress`.
- Deny form `GET /fab-delivery/revision-requests/{revision}/deny` (`revision-request-deny-form` → `POST …/deny`): "Deny Revision" — Deny Reason Type (`deny_revision_reason_id`, select, required: Out of scope, Already addressed, Unreasonable request, Insufficient information, Exceeds revision scope, Other) and Denial Reason (`denial_reason`, textarea 4 rows, required); buttons "Deny Revision" / "Cancel". Denial restores the Artifact to `submitted` and starts the Buyer 24 h response window (approve or dispute).
- No response within 24 h → system auto-accepts with 50% of the original duration (minimum 1 h) — Admin route `auto-accept` exists for this.
- `Unresolved requirement:` where the Accept / Deny buttons render for a `new` request (expected in the right-sidebar Actions section or as row actions; the only request in the dataset was already denied).

### Seller Execution Queue `/fab-delivery/execution-queue` (`seller.fab-delivery.execution-queue.index`)

Datatable `seller_execution_queue` ("All Seller Execution Queue", "View and monitor seller execution queue entries.").

- Columns: ● Code (`SEQ…`, link) · ● Order (link) · ● Status badge (Reserved, Waiting, Running, Blocked, Released) · ● Queued At · ● Projected Start At · ● Projected Completion At · ● Created At. Filter: Status. No code search.
- Show `/fab-delivery/execution-queue/{queue}` (read-only): Code, Status, Order; section "Queued At": Reservation Expires At, Queued At, Projected Start At, Projected Completion At, Projection Calculated At, Created At. Views: Overview, Activities, Status History. Record fields: `reservation_expires_at` (checkout expiry), `capacity_override_reason`, `projection_calculated_at`.
- Rules (see workflows): one `running` entry per seller; `waiting` entries ordered by queue time then Order ID; `blocked` when a Dispute is open (slot released, still counts toward the admission threshold of 8); `released` on completion or cancellation; projections include remaining execution, review windows, and accepted revisions.

### Account

| Screen | Route | Fields / behavior |
| --- | --- | --- |
| Profile | `GET /accounts/profile` → `PUT /accounts/profile/update` (`personal-settings-form`) | Display Name (`name`, max 255), Email (disabled), Phone Number (max 20), First Name, Last Name (max 255), Address (max 500), Profile Picture (`avatar_url`: image ≤ 2 MB, jpeg/png/jpg/gif, presigned upload, cropping 1:1 or 3:4). Button "Submit" ("Updating..."). Page title "Personal Settings", description "Manage your personal information and profile picture". |
| Security | `GET /accounts/security` (component `account/setting/info`) | Shows name, email, `email_verified_at`, status, phone, `has_password`, `two_factor_enabled`; description "Manage your account information and verification status". Actions by route: change password `PUT /accounts/password/update`, resend verification `POST /accounts/email/resend-verification`, deactivate account `POST /accounts/deactivate`, 2FA setup `GET /accounts/2fa/qr-code` + `POST /accounts/2fa/qr-code/enable`. `Unresolved requirement:` field-level rules of the password form and the deactivate confirmation. |
| Appearance | `GET /accounts/appearance` → `PUT /accounts/appearance/update` (form `appearance`) | Language (required: English, Vietnamese, Thai), Region Format (required: 3 formats), Timezone (required combobox); Sidebar: Main Sidebar and Right Sidebar radio (Always open / Always closed / Follow system default). |

### Authentication (guest)

| Route | Component / behavior |
| --- | --- |
| `GET /login` | `seller/auth/login`, props `canRegister: true`, `resendVerificationRoute`; protected URLs redirect here |
| `POST /login` | authenticate |
| `GET /register` | `seller/auth/register` (self-registration enabled) |
| `POST /register` | create seller account |
| `GET /join` | HTTP 500 — `SellerAuthController::join does not exist` (defect) |
| `GET /password/forgot` | `seller/auth/forgot-password`: Email (required) form |
| `POST /password/email`, `GET /password/reset/{token}`, `POST /password/reset` | reset flow |
| `GET /2fa/verify`, `POST /2fa/verify` | TOTP challenge; redirects to `/login` without challenge |
| `GET /email/verify` → `GET /email/resend` | `seller/auth/resend-verification`: Email (required) form; `POST /email/resend` submits |
| `GET /{provider}/login`, `GET /auth/{provider}/redirect` | Google social login |
| `POST /logout` | sign out |

Logged-in sellers requesting `/login` or `/register` are redirected to `/`.

## Routes

All 67 `seller.*` routes (domain `seller.mynew1.net`). "Observed" is the response on 2026-09-10 for the logged-in seller unless noted.

### Authentication and account

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `seller.auth.login` | GET | `/login` | Login page | 200 guest / redirect |
| `seller.auth.authenticate` | POST | `/login` | Login | not exercised |
| `seller.auth.logout` | POST | `/logout` | Logout | not exercised |
| `seller.auth.register` | GET | `/register` | Registration page | 200 guest |
| `seller.auth.register.store` | POST | `/register` | Create account | not exercised |
| `seller.auth.join` | GET | `/join` | Join landing | 500 (defect) |
| `seller.auth.social.signIn` | GET | `/{provider}/login` | Google login | not exercised |
| `seller.auth.social.redirect` | GET | `/auth/{provider}/redirect` | OAuth callback | not exercised |
| `seller.auth.password.forgot` | GET | `/password/forgot` | Forgot password | 200 |
| `seller.auth.password.email` | POST | `/password/email` | Send reset link | not exercised |
| `seller.auth.password.reset` | GET | `/password/reset/{token}` | Reset form | not exercised |
| `seller.auth.password.update` | POST | `/password/reset` | Save password | not exercised |
| `seller.auth.2fa.verify` | GET | `/2fa/verify` | 2FA challenge | redirect `/login` |
| `seller.auth.2fa.verify.submit` | POST | `/2fa/verify` | Submit code | not exercised |
| `seller.auth.email.verify` | GET | `/email/verify` | Verify email | redirect `/email/resend` |
| `seller.auth.email.resend` | GET | `/email/resend` | Resend form | 200 |
| `seller.auth.email.resend.submit` | POST | `/email/resend` | Resend | not exercised |
| `seller.account.profile` | GET | `/accounts/profile` | Personal Settings | 200 |
| `seller.account.profile.update` | PUT | `/accounts/profile/update` | Save profile | not exercised |
| `seller.account.security` | GET | `/accounts/security` | Security | 200 |
| `seller.account.password.update` | PUT | `/accounts/password/update` | Change password | not exercised |
| `seller.account.email.resend-verification` | POST | `/accounts/email/resend-verification` | Resend verification | not exercised |
| `seller.account.deactivate` | POST | `/accounts/deactivate` | Deactivate own account | not exercised |
| `seller.account.setting.2fa.qr-code` | GET | `/accounts/2fa/qr-code` | 2FA QR | not exercised |
| `seller.account.setting.2fa.enable` | POST | `/accounts/2fa/qr-code/enable` | Enable 2FA | not exercised |
| `seller.account.appearance` | GET | `/accounts/appearance` | Appearance | 200 |
| `seller.account.appearance.update` | PUT | `/accounts/appearance/update` | Save appearance | not exercised |
| `seller.presigned-url.generate` | POST | `/presigned-url` | Presigned S3 upload URL | not exercised |
| `seller.api.notifications.index` | GET | `/api/notifications` | Notifications (34 total during capture) | 200 JSON |
| `seller.api.notifications.mark-all-read` | POST | `/api/notifications/mark-all-read` | Mark all read | not exercised |
| `seller.api.notifications.mark-read` | POST | `/api/notifications/{notification}/mark-read` | Mark one read | not exercised |

### Dashboard and profile

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `seller.dashboard` | GET | `/` | Dashboard | 200 (`seller/dashboard`) |
| `seller.dashboard.index` | GET | `/dashboard` | Dashboard alias | 200 |
| `seller.profile.edit` | GET | `/profile` | My Profile form | 200 (`seller/profile/edit`) |
| `seller.profile.update` | POST | `/profile/update` | Save seller profile | not exercised |

### Orders

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `seller.orders.index` | GET | `/orders` | Orders datatable | 200 |
| `seller.orders.show` | GET | `/orders/{order}` | Order overview | 200 |
| `seller.orders.edit` | GET | `/orders/{order}/edit` | Order edit (status) | 200 |
| `seller.orders.update` | POST | `/orders/{order}` | Save order | not exercised |
| `seller.orders.activities` | GET | `/orders/{order}/activities` | Activities tab | 200 |
| `seller.orders.status-history` | GET | `/orders/{order}/status-history` | Status history tab | 200 |
| `seller.orders.tasks` | GET | `/orders/{order}/tasks` | Tasks tab | 200 |

### Fab delivery

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `seller.fab-delivery.execution-queue.index` | GET | `/fab-delivery/execution-queue` | Queue datatable | 200 |
| `seller.fab-delivery.execution-queue.show` | GET | `/fab-delivery/execution-queue/{queue}` | Queue entry | 200 |
| `seller.fab-delivery.execution-queue.activities` | GET | `/fab-delivery/execution-queue/{queue}/activities` | Activities | 200 |
| `seller.fab-delivery.execution-queue.status-history` | GET | `/fab-delivery/execution-queue/{queue}/status-history` | Status history | 200 |
| `seller.fab-delivery.tasks.index` | GET | `/fab-delivery/tasks` | Tasks datatable | 200 |
| `seller.fab-delivery.tasks.show` | GET | `/fab-delivery/tasks/{orderTask}` | Task overview | 200 |
| `seller.fab-delivery.tasks.activities` | GET | `/fab-delivery/tasks/{orderTask}/activities` | Activities | 200 |
| `seller.fab-delivery.tasks.status-history` | GET | `/fab-delivery/tasks/{orderTask}/status-history` | Status history | 200 |
| `seller.fab-delivery.tasks.artifacts` | GET | `/fab-delivery/tasks/{orderTask}/artifacts` | Task artifacts | 200 |
| `seller.fab-delivery.tasks.revision-requests` | GET | `/fab-delivery/tasks/{orderTask}/revision-requests` | Task revision requests | 200 |
| `seller.fab-delivery.artifacts.index` | GET | `/fab-delivery/artifacts` | Artifacts datatable | 200 |
| `seller.fab-delivery.artifacts.create` | GET | `/fab-delivery/artifacts/create?task_id=` | New Artifact form | 200 |
| `seller.fab-delivery.artifacts.submit` | POST | `/fab-delivery/artifacts/submit` | Submit delivery | not exercised |
| `seller.fab-delivery.artifacts.show` | GET | `/fab-delivery/artifacts/{artifact}` | Artifact overview | 200 |
| `seller.fab-delivery.artifacts.activities` | GET | `/fab-delivery/artifacts/{artifact}/activities` | Activities | 200 |
| `seller.fab-delivery.artifacts.status-history` | GET | `/fab-delivery/artifacts/{artifact}/status-history` | Status history | 200 |
| `seller.fab-delivery.artifacts.revision-requests` | GET | `/fab-delivery/artifacts/{artifact}/revision-requests` | Artifact revision requests | 200 |
| `seller.fab-delivery.revision-requests.index` | GET | `/fab-delivery/revision-requests` | Revision datatable | 200 |
| `seller.fab-delivery.revision-requests.show` | GET | `/fab-delivery/revision-requests/{revision}` | Revision overview | 200 |
| `seller.fab-delivery.revision-requests.activities` | GET | `/fab-delivery/revision-requests/{revision}/activities` | Activities | 200 |
| `seller.fab-delivery.revision-requests.status-history` | GET | `/fab-delivery/revision-requests/{revision}/status-history` | Status history | 200 |
| `seller.fab-delivery.revision-requests.accept.form` | GET | `/fab-delivery/revision-requests/{revision}/accept` | Accept form | 200 |
| `seller.fab-delivery.revision-requests.accept` | POST | `/fab-delivery/revision-requests/{revision}/accept` | Accept revision | not exercised |
| `seller.fab-delivery.revision-requests.deny.form` | GET | `/fab-delivery/revision-requests/{revision}/deny` | Deny form | 200 |
| `seller.fab-delivery.revision-requests.deny` | POST | `/fab-delivery/revision-requests/{revision}/deny` | Deny revision | not exercised |

## Seller journey mapped to workflows

| Workflow step | Seller screen / route |
| --- | --- |
| Paid Order activation, Tasks provisioned, FIFO position | Orders list (status Active), Seller Execution Queue (`waiting` / `running`, projected dates) |
| Start of the first unfinished Task at a valid working time | Tasks list: status `in_progress`, Started At / Due At; working schedule from My Profile |
| Confirm official delivery at or before deadline | Task row action "Create Artifact" → `POST /fab-delivery/artifacts/submit` (one file + note) → Artifact `verifying` → `submitted` |
| Buyer review outcome | Artifact status `approved` (Task `completed`, earning recorded), `revision_requested`, or `rejected` (dispute) |
| Seller responds to a Revision Request within 24 h | Revision Requests → Accept (duration) or Deny (reason type + reason) |
| Accepted revision → Task back to work, new sequential Artifact | Tasks `in_progress`, "Create Artifact" again → Artifact `sequence_no` + 1 |
| Non-delivery cancels remaining work | Tasks `canceled`, Order `canceled`, queue `released` |
| Dispute blocks execution | Task `disputed`, later Tasks `on_hold`, queue `blocked` |

## Defects observed (2026-09-10)

- `GET /join` → HTTP 500 `Method Portal\Seller\Modules\Auth\Http\Controllers\SellerAuthController::join does not exist`.
- Order edit page allows a seller to change Order status without a visible entry point; confirm intent before writing test cases that rely on it.
