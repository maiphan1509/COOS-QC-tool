# Admin Portal — `https://admin.mynew1.net`

Route prefix `admin.`, 122 routes. Inertia.js + Svelte single-page app; brand "COOS · Admin Portal"; the logged-in user during capture had role `super_admin` (display "Super Admin", code `ADM…`). Footer text "Default page footer".

Read [`../AGENTS.md`](../AGENTS.md) first for shared foundations, glossary, statuses, and configuration values. Lifecycle diagrams: [`../workflows/AGENTS.md`](../workflows/AGENTS.md).

## Layout and navigation

Sidebar groups and items (permission keys as delivered in `props.sidebar`):

| Group | Item | URI | Permission key |
| --- | --- | --- | --- |
| Platform | Dashboard | `/` | `admin.dashboard.view` |
| Platform › IAM | Accounts | `/accounts` | — |
| Platform › IAM | User Groups | `/user-groups` | — |
| Platform › IAM | Invitations | `/invitations` | — |
| Platform › Fabricas | Orders | `/orders` | `admin.order.view` |
| Platform › Fabricas | Tasks | `/fab-delivery/tasks` | `admin.fab-delivery.view` |
| Platform › Fabricas | Artifacts | `/fab-delivery/artifacts` | `admin.fab-delivery.view` |
| Platform › Fabricas | Revision Requests | `/fab-delivery/revision-requests` | `admin.fab-delivery.view` |
| Platform › Fabricas | Disputes | `/fab-delivery/disputes` | `admin.fab-delivery.view` |
| Platform › Fabricas | Seller Execution Queue | `/fab-delivery/execution-queue` | `admin.fab-delivery.view` |
| Platform › Finance | Payment Instructions | `/payment-instructions` | — |
| Platform › Finance | Transactions | `/transactions` | — |
| Platform › Conversations | Chat Threads | `#` (placeholder) | — |
| Platform › Operation | Markers | `/markers` | — |
| Platform › Operation | Service Categories | `/categories` | — |
| Platform › Operation | Service Models | `#` (placeholder) | — |
| Platform › Operation | Add-ons Models | `#` (placeholder) | — |
| Platform › Configuration | General | `/configuration` | `admin.general.view` |
| Platform › Governance | Settings | `/settings` | `admin.governance.view` |
| Platform › Governance | Activities | `/audit/activities` | — |
| Platform › Governance | Account Logs | `/audit/access-identity` | — |
| Platform › Governance | Payment Logs | `/payment-logs` | — |
| Personal Info | Account › Profile | `/accounts/profile` | `admin.account.profile.view` (group `admin.account.view`) |
| Personal Info | Account › Security | `/accounts/security` | `admin.account.security.view` |
| Personal Info | Account › Appearance | `/accounts/appearance` | `admin.account.appearance.view` |

User menu: Profile → `/accounts/profile`, Logout → `POST /logout`. Shared page props and datatable/detail conventions are the same as the Seller Portal (see `../AGENTS.md` → "URL patterns shared by Seller and Admin").

## Screens and features

### Dashboard `/` and `/dashboard`

Component `admin/dashboard`; header "Dashboard"; no widgets (placeholder). `Unresolved requirement:` intended dashboard content.

### IAM › Accounts `/accounts`

Datatable `users` ("All Accounts") — union of Admin, Seller, and Buyer accounts.

- Columns: ● Code (`ADM…`/`SEL…`/`BUY…`, link to show) · ● Name · ● Email · ● Platform badge (Admin / Seller / Buyer) · ● Status (Active / Inactive) · ● 2FA (Enabled / Disabled) · ● Last Login · Created At.
- Filters: Platform (admin, seller, buyer), Status (Active / Inactive), Created Date (date range). Search: "All — Name" and "Code".
- Row actions: View (`GET /accounts/{platform}/{id}`), Deactivate (`POST /accounts/{platform}/{id}/deactivate`, confirmation "Are you sure you want to deactivate this account?"). Activate (`POST …/activate`) exists for inactive accounts (none in the dataset).
- Show `/accounts/{platform}/{id}` (component `admin/user/show`, title "Account Details Details: <code>"): read-only Code, First Name, Last Name, Name, Email, Phone, Platform, Role, Status, Country, Timezone, Address, Avatar, Email Verified At, Two Factor Authentication toggle, Last Login, Created At. Right sidebar: Views → "Account Details"; Actions → "Deactivate" (destructive, confirmation dialog "Are you sure you want to deactivate this account?" with Cancel / Confirm).
- `GET /api/users/search` (`admin.api.users.search`) provides user lookup (used by user-group member pickers). `Unresolved requirement:` query parameters and response shape.

### IAM › User Groups `/user-groups`

Datatable `admin_user_groups` ("All User Groups"; empty during capture).

- Columns: Code (link) · Name · Description (truncated 50, tooltip) · Members (`user_group_members_count`) · Created Date. Search: Name, Description, Code. Toolbar button "New User Group".
- Create `/user-groups/create` (form `create-user-group-form`, block "User Group Details" → `POST /user-groups`): Name (required, max 255, "Enter a name"), Description (max 1000). Button "Create" ("Saving...").
- Routes for show (`/user-groups/{user_group}`), edit/update, and members (`/user-groups/{user_group}/members`, `/members/create`, `POST /members`, `DELETE /members/{user_group_member}`) exist. `Unresolved requirement:` member picker fields, and how groups map to permission keys.

### IAM › Invitations `/invitations`

Datatable `invitations` ("All Invitations"; empty during capture).

- Columns: ● Code · ● Email · ● Platform · ● Status badge (Pending, Accepted, Revoked, Expired, Rejected) · Send Count · Last Sent At · ● Expires At. Filters: Status, Expires At (date range). Search: Email, Code. Toolbar "New Invitation".
- Create `/invitations/create` (component `admin/invite/create`, form `invite-member` → `POST /invitations`): Email (required, email input, "Enter email address"), Platform (required select; only "Admin" offered). Button "Submit".
- Row-level routes: resend (`POST /invitations/{id}/resend`), revoke (`POST /invitations/{id}/revoke`), history (`GET /invitations/{id}/history`). The invitee completes onboarding at `GET|POST /password/create` (`admin.invite.password.*`); without a valid invitation token the page returns 404.
- `Unresolved requirement:` invitation expiry duration and email content.

### Fabricas › Orders `/orders`

Datatable `orders` ("All Orders") across all sellers.

- Columns: ● Code (link) · ● Status badge · ● Buyer Email · ● Seller Email · ● Title · ● Package · ● Package Quantity · ● Total Amount · Currency · ● Created At. Filter: Status (7 statuses). Code search. No row actions.
- Show `/orders/{order}` (form `order-show-form`, read-only): Order Info (Code, Status, Created At) · Buyer (Email, Name) · Seller (Email, Name) · Fab (Title, Package, Package Tier) · Pricing (Package Quantity, Subtotal, Platform Fee, Payment Fee, Tax, Total Amount, Currency). Right sidebar views: Overview, Activities, Status History, Tasks, Disputes. Props expose the full order record including `snapshot` (fab, billing, package, pricing, delivery hours, task_briefs, package_items, working_schedule), `checkout_expires_at`, `has_open_dispute`, buyer and seller records.
- Edit `/orders/{order}/edit` (form `order-edit-form` → `POST /orders/{order}`): Status select (New … Canceled) is the only editable field; "Update" / "Cancel".
- Action route `POST /orders/{order}/expire-checkout` (`admin.orders.expire-checkout`): forces an unpaid checkout to close and release the reserved queue slot. `Unresolved requirement:` UI trigger (expected in the right-sidebar Actions section for Orders in `new`).
- Tabs: Activities (`/orders/{order}/activities`: Code, Module, Created At, Created By, Action, Message; filters Module, Action), Status History (`/orders/{order}/status-history`: Time, Old Status, New Status, Note, Changed By), Tasks (`/orders/{order}/tasks`), Disputes (`/orders/{order}/disputes`).

### Fabricas › Tasks `/fab-delivery/tasks`

Same datatable and detail layout as the Seller Portal (columns Code, Order, Sequence No., Status, Started At, Due At, Completed At, Created At; Status filter; Code search), across all sellers. No row actions for admins.

- Show views: Overview, Activities, Status History, Artifacts, Revision Requests.
- Action route `POST /fab-delivery/tasks/{orderTask}/auto-cancel-overdue` (`admin.fab-delivery.tasks.auto-cancel-overdue`): cancels the overdue current Task, later NEW/ON_HOLD Tasks, and the Order (non-delivery exception in the workflow). `Unresolved requirement:` UI trigger and whether this is manual, scheduled, or both.

### Fabricas › Artifacts `/fab-delivery/artifacts`

Same datatable as Seller (Artifact Code, Order, Task, Status, Delivery #, Submitted At, Created At; Status filter; search All (Order, Task) + Artifact Code). Statuses observed on staging: approved, rejected, error.

- Show views: Overview, Activities, Status History, Revision Requests. Overview fields: Task, Status, Delivery #, Delivery Cycle, Seller Submitted At, Verified At, Buyer Available At, Verification Result / Provider / Started At / Completed At, Review Deadline, Verification Error Detail, Delivery Note, Files.
- Action routes: `POST …/{artifact}/mark-error` (mark a delivery as failed verification), `POST …/{artifact}/auto-approve` (approve after the 24 h Buyer review timeout), `POST …/{artifact}/auto-approve-post-denial` (approve after the 24 h Buyer response timeout following a denied revision). `Unresolved requirement:` UI triggers and guard conditions for each action.

### Fabricas › Revision Requests `/fab-delivery/revision-requests`

Same datatable as Seller (Revision Code, Order, Artifact, Reason, Status, Requested At). Show fields: Revision Code, Status, Reason, Response Deadline, Revision Duration (hours), Requested At, Order, Artifact, Note, Deny Reason Type, Denial Reason. Views: Overview, Activities, Status History.

- Action route `POST …/{revision}/auto-accept` (`admin.fab-delivery.revision-requests.auto-accept`): system acceptance after the Seller response timeout with the configured percentage/minimum duration. `Unresolved requirement:` UI trigger.

### Fabricas › Disputes `/fab-delivery/disputes`

Datatable `order_disputes` ("All Disputes").

- Columns: ● Dispute Code (`DSP…`, link) · ● Order (link) · ● Status badge (Open) · ● Reason (`reason_type_label`) · ● Opened At. No filters; Code search.
- Show `/fab-delivery/disputes/{dispute}` (read-only): Dispute Code, Status, Order, Reason, Opened At, Note. Views: Overview, Activities, Status History.
- No resolution actions exist (workflow scope note: resolution, refund, and re-enqueue are deferred). Dispute reasons observed: "Missing requirements", "Wrong files submitted" (`dispute_reason_id`). `Unresolved requirement:` full dispute reason catalog.

### Fabricas › Seller Execution Queue `/fab-delivery/execution-queue`

Datatable `seller_execution_queue` with the Seller columns plus ● Seller (email) and Capacity Override Reason. Filter: Status. Show adds Seller and Capacity Override Reason to the Seller layout; views Overview, Activities, Status History. `Unresolved requirement:` how `capacity_override_reason` is set (no admin route found).

### Finance › Payment Instructions `/payment-instructions`

Datatable `payment-instructions` ("All Payment Instructions").

- Columns: ● Code (`PAY…`, link) · ● Status badge (New, Processing, Pending Settlement, Completed, Failed, Canceled) · ● Provider badge (PayPal, Airwallex, NowPayments) · ● Order (link) · ● Amount · ● Currency · ● Created At. Filter: Status. Search: Provider, Provider Reference, Code. Row action: View.
- Show `/payment-instructions/{payment_instruction}`: Payment Instruction (Code, Status, Order link) · Provider (Provider, Provider Reference) · Amount (Amount, Currency) · Timeline (Paid At, Failed At, Created At). Views: "Payment Instruction", Status History (Time, Old Status, New Status, Reason, Note, Changed By).
- Action route `POST /payment-instructions/{payment_instruction}/cancel`. `Unresolved requirement:` UI trigger and allowed source statuses.

### Finance › Transactions `/transactions`

Datatable `transactions` ("All Transactions").

- Columns: ● Code (`PTX…`, link) · ● Payment Instruction (link) · ● Type badge (Payment, Refund) · ● Status badge (Pending, Succeeded, Failed) · ● Provider Transaction ID · ● Amount · ● Currency · ● Created At. Filters: Type, Status. Search: Provider Transaction ID, Code. Row action: View.
- Show `/transactions/{transaction}`: Transaction (Code, Type, Status) · Related (Payment Instruction link, Order link, Provider Transaction ID) · Amount (Amount, Currency) · Timeline (Processed At, Created At). `provider_data` holds the raw gateway payload (payer, captures).

### Operation › Markers `/markers`

Datatable `markers` ("All Markers", "Manage display markers for categories and items"), default sort `display_order asc`.

- Columns: ● Code (`MRK…`, link) · ● Name · ● Label · ● Type badge (Badge / Icon) · Color · ● Display Order · ● Status (Active / Inactive) · Created At. Filters: Status, Type. Search: Name, Label, Code. Toolbar "New Marker".
- Row actions: View, Edit, Audit History (`GET /markers/{id}/history`), Delete (`DELETE /markers/{marker}`, confirmation "Are you sure you want to delete this item? This action cannot be undone.").
- Form (`marker-form`; create `POST /markers`, edit `POST /markers/{marker}`): Basic Information → Type (select Badge / Icon, default Badge), Name (required, hidden when Type = Icon), Label (required), Color (color input, hidden when Type = Icon); Icon (shown only when Type = Icon) → Icon upload (required, image ≤ 10 MB, jpeg/png/jpg/webp/svg); Settings → Display Order (numeric), Status toggle (default on). Buttons "Create"/"Update", "Cancel".
- Seeded markers: featured/Featured, Popular, New, Trending, Recommended.

### Operation › Service Categories `/categories`

Datatable `categories` ("All Service Categories", "Manage service category hierarchy for the buyer menu."), default sort `display_order asc`.

- Columns: ● Code (`CL1…`, link) · ● Label · ● Slug · ● Marker · ● Display Order · Pinned Menu (Yes/No) · Pinned Filter (Yes/No) · ● Status · Created At. Filters: Status, Pinned Menu, Pinned Filter. Search: Label, Slug, Code. Toolbar "New Service Category".
- Row actions: View, Edit, View Items (`GET /category-items?category_id={id}` — returns 404 on staging), Audit History (`GET /categories/{id}/history`), Delete (`DELETE /categories/{category}`, same confirmation text as markers).
- Form (`category-form`; create `POST /categories`, edit `POST /categories/{category}`): Basic Information → Label (EN) (required), Label (VI), Slug, Marker (select of active markers, nullable); Description (EN) / Description (VI) textareas; Banner CTA → Button Label (EN), Button Label (VI), Button URL; Thumbnail → Thumbnail / Banner Image (≤ 10 MB, 16:9); Settings → Max Depth (default 3), Display Order, Status toggle (default on), Pinned Menu toggle, Pinned Filter toggle.
- Show (`admin/categories/show`) renders the same fields read-only plus "Category Items" tree (`category-tree` component with nested menu/item nodes: name, slug, marker, thumbnail, banner CTA, max depth, display order, flags). Category items (L2/L3) have their own routes (`/category-items/...`) whose index and create pages currently fail (see defects).
- Seeded L1 categories: Programming & Tech (`programming-tech`, pinned menu), Graphics & Design, Digital Marketing — these drive the Buyer mega-menu.

### Configuration › General `/configuration` (`admin.configuration.*`)

Form `general-configuration-form` (`PUT /configuration`), three blocks:

1. Settings → Localization (toggles English [disabled, always on], Vietnamese, Thai); Datetime Formatting (three read-only samples); Currency (Default Currency select USD / VND; toggles "USD (United States)", "VND (Vietnam)" with description "Enable or disable this currency in the system.").
2. System Configuration → Platform Information (Company Full Name, Company No, Company Short Name, Company Email Contact "Email shown in static pages as landing page", Domain Name, Privacy Email Contact "Email shown in Privacy Policy page", Phone Number, License Issued, Platform Name, Platform Slogan Text "Slogan used in platform page titles.", Platform Footer Text "Text displayed in the application footer.", Company Address textarea); Admin Contact (Help Center Contact "URL or email shown in email footers and PDF receipts.", Admin Email, Email Footer Text).
3. Order Flow → Timeouts & Queue: Payment Checkout Expiry (minutes), Buyer Artifact Review Timeout (hours), Seller Revision Response Timeout (hours), Buyer Response After Denial Timeout (hours), Minimum Revision Duration (hours), Auto Revision Duration Percent, Seller Max Execution Queue Orders, Artifact Error Reupload Timeout (hours), Artifact Max File Size (MB). Current values are listed in `../AGENTS.md`.

The Buyer "About Us" page and email footers read the company fields; they are empty on staging.

### Governance › Settings `/settings` (`admin.settings.*`)

Form `payment-gateway-settings-form` (`PUT /settings`), block "Payment Gateway": Platform Fee & Tax (COOS Platform Fee (%), Tax (%)); PayPal (Enable PayPal "Allow buyers to pay with PayPal.", Fixed Fee $, Fee Percent %); Airwallex (Enable Airwallex, Fixed Fee, Fee Percent). NowPayments has a webhook but no settings section. Changes affect the Buyer checkout fee calculation and the availability of "Pay with …" buttons.

### Governance › Activities `/audit/activities`

Datatable `management_activities` ("All Activities"). Columns: ● Time · ● Platform · ● Actor · ● Action · Target · Resource (module) · ● Message. Filters: Platform (Admin / Seller / Buyer), Action (Create / Update / View), Resource (Account, User Group, Order, Finance, Service Delivery, Operation, Governance), Time (date range), Actor (text). Search: Actor, Target. Viewing a record (for example opening a marker) writes a `view` activity.

### Governance › Account Logs `/audit/access-identity`

Datatable `account_logs` ("All Account Logs"). Columns: ● Time · ● Platform · ● Actor · ● Action · Result badge (Success) · IP Address · ● Auth Method badge (e.g. "Username/Password") · ● Message ("Logged in successfully."). Filters: Time (range), Platform, Action (Login / Logout / Update), IP Address (text), Actor (text). Search: Actor, IP Address.

### Governance › Payment Logs `/payment-logs`

Datatable ("All Payment Logs") of gateway webhook deliveries. Columns: ● Gateway · ● Order ID · ● Payment Instruction ID · ● Event Type (e.g. `payment_attempt.paid`) · ● Provider Event ID · ● Signature Valid (Yes/No) · ● Status (`processed`, `failed`, `ignored`) · ● Error Message (truncated) · Request Header (hidden by default) · Request Body (hidden by default) · ● Created At. Search: Gateway, Event Type, Provider Event ID, Status. No row actions.

### Account (admin self-service)

Identical to the Seller Portal: Profile (`personal-settings-form`, `PUT /accounts/profile/update`), Security (`account/setting/info`, password update, resend verification, deactivate, 2FA), Appearance (language, region format, timezone, sidebar behavior). See `../seller/AGENTS.md` → Account.

### Authentication (guest)

| Route | Behavior |
| --- | --- |
| `GET /login` | component `admin/auth/login`, `canRegister: false`, no resend-verification link |
| `POST /login` | authenticate |
| `GET /register` | 404 (no admin self-registration) |
| `GET /password/forgot` → `POST /password/email` → `GET /password/reset/{token}` → `POST /password/reset` | password reset with Email (required) form (`admin/auth/forgot-password`) |
| `GET|POST /2fa/verify` | TOTP challenge; redirects to `/login` without challenge |
| `GET|POST /password/create` | invitation onboarding (set password); 404 without a valid invitation |
| `POST /logout` | sign out |

## Routes

All 122 `admin.*` routes (domain `admin.mynew1.net`). "Observed" is the response on 2026-09-10 for the logged-in super admin unless noted.

### Authentication, invitation, account, API

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `admin.auth.login` | GET | `/login` | Login page | 200 guest / redirect |
| `admin.auth.authenticate` | POST | `/login` | Login | not exercised |
| `admin.auth.logout` | POST | `/logout` | Logout | not exercised |
| `admin.auth.password.forgot` | GET | `/password/forgot` | Forgot password | 200 |
| `admin.auth.password.email` | POST | `/password/email` | Send reset link | not exercised |
| `admin.auth.password.reset` | GET | `/password/reset/{token}` | Reset form | not exercised |
| `admin.auth.password.update` | POST | `/password/reset` | Save password | not exercised |
| `admin.auth.2fa.verify` | GET | `/2fa/verify` | 2FA challenge | redirect `/login` |
| `admin.auth.2fa.verify.submit` | POST | `/2fa/verify` | Submit code | not exercised |
| `admin.invite.password.create` | GET | `/password/create` | Invitee sets password | 404 without token |
| `admin.invite.password.store` | POST | `/password/create` | Save invitee password | not exercised |
| `admin.account.profile` | GET | `/accounts/profile` | Personal Settings | 200 |
| `admin.account.profile.update` | PUT | `/accounts/profile/update` | Save profile | not exercised |
| `admin.account.security` | GET | `/accounts/security` | Security | 200 |
| `admin.account.password.update` | PUT | `/accounts/password/update` | Change password | not exercised |
| `admin.account.email.resend-verification` | POST | `/accounts/email/resend-verification` | Resend verification | not exercised |
| `admin.account.deactivate` | POST | `/accounts/deactivate` | Deactivate own account | not exercised |
| `admin.account.setting.2fa.qr-code` | GET | `/accounts/2fa/qr-code` | 2FA QR | not exercised |
| `admin.account.setting.2fa.enable` | POST | `/accounts/2fa/qr-code/enable` | Enable 2FA | not exercised |
| `admin.account.appearance` | GET | `/accounts/appearance` | Appearance | 200 |
| `admin.account.appearance.update` | PUT | `/accounts/appearance/update` | Save appearance | not exercised |
| `admin.presigned-url.generate` | POST | `/presigned-url` | Presigned S3 upload URL | not exercised |
| `admin.api.notifications.index` | GET | `/api/notifications` | Notifications | 200 JSON (0 items); 500 as guest |
| `admin.api.notifications.mark-all-read` | POST | `/api/notifications/mark-all-read` | Mark all read | not exercised |
| `admin.api.notifications.mark-read` | POST | `/api/notifications/{notification}/mark-read` | Mark one read | not exercised |
| `admin.api.users.search` | GET | `/api/users/search` | User lookup | not exercised |

### Dashboard, IAM

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `admin.dashboard` | GET | `/` | Dashboard | 200 |
| `admin.dashboard.index` | GET | `/dashboard` | Dashboard alias | 200 |
| `admin.accounts.index` | GET | `/accounts` | Accounts datatable | 200 |
| `admin.accounts.show` | GET | `/accounts/{platform}/{id}` | Account details | 200 |
| `admin.accounts.activate` | POST | `/accounts/{platform}/{id}/activate` | Activate account | not exercised |
| `admin.accounts.deactivate` | POST | `/accounts/{platform}/{id}/deactivate` | Deactivate account | not exercised |
| `admin.invitations.index` | GET | `/invitations` | Invitations datatable | 200 |
| `admin.invitations.create` | GET | `/invitations/create` | Invite Member form | 200 |
| `admin.invitations.store` | POST | `/invitations` | Send invitation | not exercised |
| `admin.invitations.resend` | POST | `/invitations/{id}/resend` | Resend | not exercised |
| `admin.invitations.revoke` | POST | `/invitations/{id}/revoke` | Revoke | not exercised |
| `admin.invitations.audit` | GET | `/invitations/{id}/history` | Invitation history | not exercised |
| `admin.user-groups.index` | GET | `/user-groups` | User groups datatable | 200 |
| `admin.user-groups.create` | GET | `/user-groups/create` | New User Group form | 200 |
| `admin.user-groups.store` | POST | `/user-groups` | Create group | not exercised |
| `admin.user-groups.show` | GET | `/user-groups/{user_group}` | Group details | not exercised (no data) |
| `admin.user-groups.edit` | GET | `/user-groups/{user_group}/edit` | Edit group | not exercised |
| `admin.user-groups.update` | PUT | `/user-groups/{user_group}` | Save group | not exercised |
| `admin.user-groups.members.index` | GET | `/user-groups/{user_group}/members` | Members list | not exercised |
| `admin.user-groups.members.create` | GET | `/user-groups/{user_group}/members/create` | Add member form | not exercised |
| `admin.user-groups.members.store` | POST | `/user-groups/{user_group}/members` | Add member | not exercised |
| `admin.user-groups.members.destroy` | DELETE | `/user-groups/{user_group}/members/{user_group_member}` | Remove member | not exercised |

### Fabricas (orders and fab delivery)

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `admin.orders.index` | GET | `/orders` | Orders datatable | 200 |
| `admin.orders.show` | GET | `/orders/{order}` | Order overview | 200 |
| `admin.orders.edit` | GET | `/orders/{order}/edit` | Order edit (status) | 200 |
| `admin.orders.update` | POST | `/orders/{order}` | Save order | not exercised |
| `admin.orders.expire-checkout` | POST | `/orders/{order}/expire-checkout` | Force checkout expiry | not exercised |
| `admin.orders.activities` | GET | `/orders/{order}/activities` | Activities tab | 200 |
| `admin.orders.status-history` | GET | `/orders/{order}/status-history` | Status history tab | 200 |
| `admin.orders.tasks` | GET | `/orders/{order}/tasks` | Tasks tab | 200 |
| `admin.orders.disputes` | GET | `/orders/{order}/disputes` | Disputes tab | 200 |
| `admin.fab-delivery.execution-queue.index` | GET | `/fab-delivery/execution-queue` | Queue datatable | 200 |
| `admin.fab-delivery.execution-queue.show` | GET | `/fab-delivery/execution-queue/{queue}` | Queue entry | 200 |
| `admin.fab-delivery.execution-queue.activities` | GET | `/fab-delivery/execution-queue/{queue}/activities` | Activities | 200 |
| `admin.fab-delivery.execution-queue.status-history` | GET | `/fab-delivery/execution-queue/{queue}/status-history` | Status history | 200 |
| `admin.fab-delivery.tasks.index` | GET | `/fab-delivery/tasks` | Tasks datatable | 200 |
| `admin.fab-delivery.tasks.show` | GET | `/fab-delivery/tasks/{orderTask}` | Task overview | 200 |
| `admin.fab-delivery.tasks.activities` | GET | `/fab-delivery/tasks/{orderTask}/activities` | Activities | 200 |
| `admin.fab-delivery.tasks.status-history` | GET | `/fab-delivery/tasks/{orderTask}/status-history` | Status history | 200 |
| `admin.fab-delivery.tasks.artifacts` | GET | `/fab-delivery/tasks/{orderTask}/artifacts` | Task artifacts | 200 |
| `admin.fab-delivery.tasks.revision-requests` | GET | `/fab-delivery/tasks/{orderTask}/revision-requests` | Task revision requests | 200 |
| `admin.fab-delivery.tasks.auto-cancel-overdue` | POST | `/fab-delivery/tasks/{orderTask}/auto-cancel-overdue` | Cancel overdue task/order | not exercised |
| `admin.fab-delivery.artifacts.index` | GET | `/fab-delivery/artifacts` | Artifacts datatable | 200 |
| `admin.fab-delivery.artifacts.show` | GET | `/fab-delivery/artifacts/{artifact}` | Artifact overview | 200 |
| `admin.fab-delivery.artifacts.activities` | GET | `/fab-delivery/artifacts/{artifact}/activities` | Activities | 200 |
| `admin.fab-delivery.artifacts.status-history` | GET | `/fab-delivery/artifacts/{artifact}/status-history` | Status history | 200 |
| `admin.fab-delivery.artifacts.revision-requests` | GET | `/fab-delivery/artifacts/{artifact}/revision-requests` | Artifact revision requests | 200 |
| `admin.fab-delivery.artifacts.mark-error` | POST | `/fab-delivery/artifacts/{artifact}/mark-error` | Mark verification error | not exercised |
| `admin.fab-delivery.artifacts.auto-approve` | POST | `/fab-delivery/artifacts/{artifact}/auto-approve` | Auto-approve after review timeout | not exercised |
| `admin.fab-delivery.artifacts.auto-approve-post-denial` | POST | `/fab-delivery/artifacts/{artifact}/auto-approve-post-denial` | Auto-approve after denial timeout | not exercised |
| `admin.fab-delivery.revision-requests.index` | GET | `/fab-delivery/revision-requests` | Revision datatable | 200 |
| `admin.fab-delivery.revision-requests.show` | GET | `/fab-delivery/revision-requests/{revision}` | Revision overview | 200 |
| `admin.fab-delivery.revision-requests.activities` | GET | `/fab-delivery/revision-requests/{revision}/activities` | Activities | 200 |
| `admin.fab-delivery.revision-requests.status-history` | GET | `/fab-delivery/revision-requests/{revision}/status-history` | Status history | 200 |
| `admin.fab-delivery.revision-requests.auto-accept` | POST | `/fab-delivery/revision-requests/{revision}/auto-accept` | Auto-accept after seller timeout | not exercised |
| `admin.fab-delivery.disputes.index` | GET | `/fab-delivery/disputes` | Disputes datatable | 200 |
| `admin.fab-delivery.disputes.show` | GET | `/fab-delivery/disputes/{dispute}` | Dispute overview | 200 |
| `admin.fab-delivery.disputes.activities` | GET | `/fab-delivery/disputes/{dispute}/activities` | Activities | 200 |
| `admin.fab-delivery.disputes.status-history` | GET | `/fab-delivery/disputes/{dispute}/status-history` | Status history | 200 |

### Finance

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `admin.payment-instructions.index` | GET | `/payment-instructions` | Payment instructions datatable | 200 |
| `admin.payment-instructions.show` | GET | `/payment-instructions/{payment_instruction}` | Details | 200 |
| `admin.payment-instructions.status-history` | GET | `/payment-instructions/{payment_instruction}/status-history` | Status history | 200 |
| `admin.payment-instructions.cancel` | POST | `/payment-instructions/{payment_instruction}/cancel` | Cancel instruction | not exercised |
| `admin.transactions.index` | GET | `/transactions` | Transactions datatable | 200 |
| `admin.transactions.show` | GET | `/transactions/{transaction}` | Details | 200 |
| `admin.payment-logs.index` | GET | `/payment-logs` | Webhook logs datatable | 200 |

### Operation

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `admin.categories.index` | GET | `/categories` | Service categories datatable | 200 |
| `admin.categories.create` | GET | `/categories/create` | New category form | 200 |
| `admin.categories.store` | POST | `/categories` | Create category | not exercised |
| `admin.categories.show` | GET | `/categories/{category}` | Category details + item tree | 200 |
| `admin.categories.edit` | GET | `/categories/{category}/edit` | Edit category | 200 |
| `admin.categories.update` | POST | `/categories/{category}` | Save category | not exercised |
| `admin.categories.destroy` | DELETE | `/categories/{category}` | Delete category | not exercised |
| `admin.categories.record-history` | GET | `/categories/{id}/history` | Audit history | 200 |
| `admin.category-items.index` | GET | `/category-items` | Category items datatable | 404 (defect) |
| `admin.category-items.create` | GET | `/category-items/create` | New item form | 500 (defect) |
| `admin.category-items.store` | POST | `/category-items` | Create item | not exercised |
| `admin.category-items.show` | GET | `/category-items/{category_item}` | Item details | not exercised |
| `admin.category-items.edit` | GET | `/category-items/{category_item}/edit` | Edit item | not exercised |
| `admin.category-items.update` | POST | `/category-items/{category_item}` | Save item | not exercised |
| `admin.category-items.destroy` | DELETE | `/category-items/{category_item}` | Delete item | not exercised |
| `admin.category-items.record-history` | GET | `/category-items/{id}/history` | Audit history | not exercised |
| `admin.markers.index` | GET | `/markers` | Markers datatable | 200 |
| `admin.markers.create` | GET | `/markers/create` | New marker form | 200 |
| `admin.markers.store` | POST | `/markers` | Create marker | not exercised |
| `admin.markers.show` | GET | `/markers/{marker}` | Marker details | 200 |
| `admin.markers.edit` | GET | `/markers/{marker}/edit` | Edit marker | 200 |
| `admin.markers.update` | POST | `/markers/{marker}` | Save marker | not exercised |
| `admin.markers.destroy` | DELETE | `/markers/{marker}` | Delete marker | not exercised |
| `admin.markers.record-history` | GET | `/markers/{id}/history` | Audit history | not exercised |

### Configuration and governance

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `admin.configuration.index` | GET | `/configuration` | General configuration form | 200 |
| `admin.configuration.update` | PUT | `/configuration` | Save configuration | not exercised |
| `admin.settings.index` | GET | `/settings` | Payment gateway settings form | 200 |
| `admin.settings.update` | PUT | `/settings` | Save settings | not exercised |
| `admin.audit.activities` | GET | `/audit/activities` | Activities datatable | 200 |
| `admin.audit.access-identity` | GET | `/audit/access-identity` | Account logs datatable | 200 |

## Admin controls mapped to workflows

| Workflow rule | Admin surface |
| --- | --- |
| Unpaid checkout closes after `payment_checkout_expiry_minutes` | Configuration › General; `POST /orders/{order}/expire-checkout`; Queue entry `reservation_expires_at` |
| Buyer review auto-approval after 24 h | Configuration; `POST /fab-delivery/artifacts/{artifact}/auto-approve` |
| Seller response timeout → automatic acceptance (50%, min 1 h) | Configuration; `POST /fab-delivery/revision-requests/{revision}/auto-accept` |
| Buyer response after denial timeout → approval | `POST /fab-delivery/artifacts/{artifact}/auto-approve-post-denial` |
| Non-delivery cancels current and later Tasks | `POST /fab-delivery/tasks/{orderTask}/auto-cancel-overdue`; Task `financial_resolution_required` flag |
| Failed malware scan | `POST /fab-delivery/artifacts/{artifact}/mark-error`; `artifact_error_reupload_timeout_hours` |
| Admission threshold (max 8 orders per seller queue) | Configuration `seller_max_execution_queue_orders`; Queue datatable |
| Every transition recorded with actor, reason, time | Status History tabs; Governance › Activities |
| Payment lifecycle (pending, retry, expiry, duplicate) | Finance › Payment Instructions / Transactions; Governance › Payment Logs |

## Defects observed (2026-09-10)

- `GET /category-items` → 404 although the sidebar row action "View Items" targets it; `GET /category-items/create` → 500.
- `GET /api/notifications` as guest → 500 instead of 401.
- `GET /password/create` → 404 without an invitation token (message does not explain the missing token).
- Sidebar placeholders: Conversations › Chat Threads, Operation › Service Models, Operation › Add-ons Models (`href="#"`).
- Debug pages expose stack traces and file paths.
