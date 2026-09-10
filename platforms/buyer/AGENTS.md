# Buyer Portal — `https://mynew1.net`

Route prefix `buyer.`, 67 routes. Server-rendered Blade pages with Svelte islands. Page titles use "Buyer Portal" (home), "Login - COOS", "Join COOS", and "<Page> - Oseff" for account pages; visible brand text is "COOS" (footer "© 2026 COOS").

Read [`../AGENTS.md`](../AGENTS.md) first for shared foundations, glossary, statuses, and configuration values. Lifecycle diagrams: [`../workflows/AGENTS.md`](../workflows/AGENTS.md).

## Global layout

### Header (desktop and mobile variants)

- Logo links to `/`.
- Search input `q` with placeholder "What fabs are you looking for today?". The form has no action attribute and method GET, so it submits `?q=` to the current page. `Unresolved requirement:` server-side handling of `q` — `GET /fabs?q=…` returned the unfiltered list and `GET /?q=…` rendered the home page unchanged.
- Category mega-menu with three L1 entries: Programming & Tech (`/programming-tech`), Graphics & Design (`/graphics-design`), Digital Marketing (`/digital-marketing`). Each panel lists L2 items with their L3 children and a "See more →" link to the L1 page. Observed tree:
  - Programming & Tech → Website Development (Custom Website, Landing Page Development, WordPress) · Website Maintenance (Website Customization) · Mobile App Development (Cross-Platform Development) · Mobile App Maintenance (Mobile App Customization) · Software Development (API & Integrations, Full Stack Web Applications)
  - Graphics & Design → Web & App Design (Website Design, App Design)
  - Digital Marketing → Search (Search Engine Optimization (SEO), Search Engine Marketing (SEM)) · E-Commerce Marketing (E-Commerce SEO) · Social (Social Media Marketing)
- Notifications bell island (`GET /api/notifications`): title "Notifications", empty state "No notifications yet.", "Mark all as read" (`POST /api/notifications/mark-all-read`), per-item mark-read (`POST /api/notifications/{notification}/mark-read`). Unread badge shows the count (16 during capture).
- User dropdown: Orders → `/account/orders`, Settings → `/account/settings`, "English - USD" → `/account/appearance`, Sign Out (form `POST /logout`).
- Language and Currency island: languages en (English), vi (Tiếng Việt), th (ไทย); currencies USD ($), VND (₫). Selecting posts `POST /set-preference` (language) and `POST /set-currency`.

### Footer

About COOS → `/about-us` · Help & Support → `/about-us` · Blog → `/blogs` · Terms → `/terms-and-policies` · Privacy Policy → `/terms-and-notifications#privacy-policy` · Cookies → `/terms-and-notifications#privacy-policy` · "© 2026 COOS".

## Screens and features

### Home `/` (`buyer.home`)

- Hero with two tabs: "HIRE TALENT" (buyer value proposition: "Work with trusted experts in Code / AI / Cloud / Data / Design", "Connect with trusted tech experts", "Compare proposals and choose the right fit", "Pay securely with project protection") and "GET HIRE" (seller value proposition: "Share your work", "Create your profile", "Send proposals", "Offer your services and get hired", "Get paid securely through COOS").
- Listing tabs "Fabs" and "Sellers".
  - Fabs grid: cards with image, title, seller name, price in selected currency; "Show more" loads `GET /fabs?page=N` (`buyer.fabs.load`) which returns JSON `{ html, hasMore, nextPage }` (10 cards per page).
  - Sellers list: `GET /sellers` (`buyer.sellers.load`, same JSON shape) renders seller cards with display name, "N projects completed", "N Orders in Queue", "N fabs available". Cards have no link; there is no public seller profile page.

### Category pages

| Route | URI | Level |
| --- | --- | --- |
| `buyer.category.show` | `/{slug}` | L1 (e.g. `/programming-tech`) |
| `buyer.category-item.show` | `/{categorySlug}/{itemSlug}` | L2 (e.g. `/programming-tech/website-development`) |
| `buyer.category-l3.show` | `/{categorySlug}/{l2Slug}/{l3Slug}` | L3 (e.g. `/programming-tech/website-development/custom-website`) |

- Breadcrumb `/ L1 / L2 / L3`, page title equals the category label.
- "Sort by" select `sort` (JavaScript-driven, no form submit): `asc` "Newest Service", `desc` "Oldest Service", `price` "Price", `price_high_to_low` "Price: High to Low".
- "N results" counter (24 at L1, 10 at L2, 6 at L3 during capture) and a 10-card grid.
- "Show more" button (`#load-more-btn`) carries `data-url=/category-fabs`, `data-level` (`l1`), `data-id` (category UUID), `data-sort`, `data-next-page`; it calls `GET /category-fabs?level=l1&id={categoryId}&page=N&sort=…` (`buyer.category-fabs.load`) → `{ html, hasMore, nextPage }`. The endpoint returns 404 when the parameters are missing.
- Unknown slugs and non-existent paths (`/search`, `/cart`, `/checkout`, `/help`, `/faq`, `/contact`, `/profile`, `/wallet`, `/disputes`) render the standard "404 Not Found - COOS" page with "Go Back Home".

### Fab detail `/fab/{fabSlug}` (`buyer.fab.show`)

- Breadcrumb to L1/L2/L3, title, seller display name, "N Orders in Queue".
- Section tabs: Overview, Packages.
- "Service Information": seller-authored description.
- Seller card: display name, "N Projects Completed", "N Orders in Queue", "N Fabs available", availability badge ("Available now"), "Working days" Mon–Sun chips, "Working Hours" per day shown twice — in the seller's timezone ("9:00 AM-5:00 PM · UTC time (GMT+0)") and in the buyer's time ("4:00 PM-12:00 AM · Your time (GMT+7)") — or "Day off".
- "Compare Service Package": one column per package (Basic, Standard, Premium) with price, description, "Delivered in N hour(s)", "N revision(s)", feature list built from Package Items (boolean items as labels, numeric items as "N Number of Pages"), and a "Buy Now" button per package.
- Buy button state comes from island props: `sellerAcceptingOrders` false → label "Not accepting orders" (disabled); `sellerQueueFull` true → "Fully Booked" (disabled); otherwise "Buy Now" → `/order/{fabSlug}`. `sellerHasSchedule` false suppresses the schedule block.
- Fab slugs observed follow `<l3-slug>-<n>` and `<l3-slug>-<n>-v2`.

### Checkout `/order/{fabSlug}` (`buyer.order.show`)

Single Svelte island (title "Checkout - <fab title>"). Props observed: packages (with items), fab summary, `sellerId`, `sellerAcceptingOrders`, `platformFeeTax` (`platform_fee_percent` 2.5, `tax_percent` 0), `gatewayFees` (paypal enabled fixed 0.3 percent 0; airwallex enabled fixed 0 percent 0), `selectedCurrency`, `buyerEmail`, `buyerFullName`, `termsUrl`, `paymentPolicyUrl`.

Behavior described by the island labels:

1. The buyer selects a package tier and quantity (Order snapshots show `package_quantity` 1–3; one Task is created per unit).
2. For each unit the buyer fills "ITEM n · Note" ("Please describe your projects or items"); empty note → "Please fill in a note for this item." The notes become Task briefs.
3. "Estimated Start · :date" is fetched from `POST /orders/queue-preview` (`buyer.orders.queue-preview`) with disclaimer "The actual completion date may change after the order starts."
4. "Price Summary": "Package Cost (:count)", "COOS Platform Fee" (tooltip "This fee helps us maintain the COOS platform and provide ongoing customer support."), "Payment Fee" (tooltip "This fee is charged by the payment provider and may vary depending on your selected payment method."), "Tax", "Total".
5. "Payment Method": "Pay with PayPal" / "Pay with Airwallex"; a disabled gateway shows "This payment method is currently unavailable."; no selection → "Please go back and choose a payment method."
6. "Billing information": Full Name (required, "Please enter your full name."), Company Name, Country, State/Region, Address, City, Postal Code, Tax ID. "Invoice": "You will find your invoices under the Billing History tab.", checkbox "I want to get invoices via email as well." with invoice email ("Please enter a valid invoice email.").
7. Terms checkbox: "I confirm that the order details are correct and agree to the COOS Terms of Service and Payment Policy" (error "Please agree to the terms to continue.").
8. "Confirm & Pay" → `POST /orders` (`buyer.orders.store`, creates the Order in status NEW and reserves a queue slot) → `POST /orders/{order}/pay` (`buyer.orders.pay`, creates a Payment Instruction and redirects: "After clicking 'Confirm & Pay' below, you'll be redirected to :provider to securely complete your payment."). Errors: "Failed to create order", "Failed to start payment", "Something went wrong".
9. Provider return URLs: `GET /orders/{order}/payment/success`, `GET /orders/{order}/payment/cancel`; Airwallex hosted flow `GET /orders/{order}/payment/airwallex` with `GET /orders/{order}/payment/airwallex/poll`.
10. Seller not accepting → "This seller is currently not accepting new orders." Escrow note: "To ensure your payment is safe, COOS holds all project funds until the project is complete and you approve the final work."

`Unresolved requirement:` exact request payloads of `queue-preview`, `orders.store`, and `pay`, and the behavior of `GET /orders/{order}` (the route exists but returns HTTP 500 on staging, see defects). `Unresolved requirement:` the "Billing History" tab referenced by the invoice copy has no route in the Buyer portal.

### My orders `/account/orders` (`buyer.account.orders`)

- Title "All Orders", subtitle "Track all your orders in one place, from queue to completion, and stay up to date on their progress."
- Status filter "Status: ALL" with options ALL, New, Ready, Active, Delivered, Completed, Closed, Canceled.
- Table columns: Code | Status | Fab | Seller | Queue | Package | Quantity | Amount | Payment Method | Date. "Queue" shows the seller queue position as `position/total` (for example `2/2`) for waiting orders and `-` otherwise. Amount uses the selected currency format (`$3.000,00`). Payment Method shows the gateway label (Paypal, Airwallex).
- Clicking a row opens `/account/orders/{order}`.
- Guests are redirected to `/login`.
- `Unresolved requirement:` pagination and default sort (10 rows fit on one page during capture).

### Order detail `/account/orders/{order}` (`buyer.account.orders.show`)

Page title "Order ORD… - Oseff", breadcrumb "Orders / ORD…". Three tabs: Items, Details, Activity.

Items tab (one block per Task):
- Header "Item n · #TSK… · <Task status>", "Start at <date>", "Estimated Completion <date>" (or "Estimated Start" while the order waits in queue), "Your brief".
- Delivery card per Artifact: "Delivery n · #ART… · <status>", "<seller> delivered item n <date>", attachments (file name, type, size) with a presigned download link, "View History" (island loading `GET /account/orders/{order}/history` — returns `{ items: [] }`).
- Revision cards: "You sent revision request n · #REV… · <status>", "edited" marker, reason label and note, seller denial message ("<seller> denied your revision request for item n", denial reason).
- Dispute card: "Dispute · #DSP… · Open", "<buyer> submitted a dispute <date>", reason, "View History".
- Revision Requests island (per Task): "Request Revision" modal with "What revisions would you like :seller to make?", Reason select (7 reasons, see glossary), Note textarea ("Describe what needs to be revised..."), footer ":used / :max revisions used" (`revisionsUsed`, `maxRevisions` = Task `revision_limit`), buttons "Send Request Revision" (`POST /account/orders/{order}/revision-request`), "Edit Revision Request" / "Update" (`PUT /account/orders/{order}/revision-request/{revision}`), "Withdraw" with confirm "Are you sure you want to withdraw this revision request?" (`POST /account/orders/{order}/revision-request/{revision}/withdraw`). `canCreate` is false when the Task has no actionable submitted Artifact or the quota is used; `is_editable` false on denied/withdrawn requests.

Details tab:
- "Order number #ORD…", "Ordered from <seller> · Start Date <date> · Estimated Completion <date>", "Order Status <status>".
- "Your order": Created date; table item / qty / duration / price; per package "Delivered in N hour(s)", "N revision(s)", "What's included" feature list.
- Price block: "Package Cost (n)", "Platform fee" (tooltip), "Payment fee" (tooltip), "Order Total".
- "Payment Instruction" table: Code | Status | Amount | Payment Method | Created At (e.g. `PAY… Completed $1.500,00 Paypal`), followed by "If something appears to be missing or incorrect, please contact our Customer Support Specialist."
- Status banner: "Your order is now in the works" with "We notified <seller> about your order. You should receive your delivery by <date>." or "Your order was closed".

Activity tab: reverse-chronological timeline, entries observed: "You placed the order.", "Your payment was confirmed.", "Your order is ready.", "Your order was added to the Seller's queue.", "The Seller started working on item n.", "The Seller delivered item n.", "Your order has been delivered.", "You requested a revision for item n", "The Seller denied your revision request for item n", "You opened a dispute."

Right column "Order Summary": fab title, status, Start Date / Estimated Start, Estimated Completion (disclaimer "This date is an estimate and may be updated as the order progresses."), package × quantity, delivered in / revisions, What's included, "Ordered from <seller>", Total price, Order number, "Track Order" (latest activity lines), "COOS holds funds until you accept the completed work.", seller card (projects completed, orders in queue, fabs available, working days and hours).

Actions available by route but not observed as rendered controls (no order was in a reviewable state during capture): approve delivery `POST /account/orders/{order}/artifacts/{artifact}/approve`, cancel order `POST /account/orders/{order}/cancel`, open dispute `POST /account/orders/{order}/dispute` (reason + description; enabled only after a denied revision or when the revision quota is exhausted per the workflow). `Unresolved requirement:` placement, labels, and enabling conditions of Approve, Dispute, and Cancel controls; content of the review-deadline countdown (`buyer_review_remaining_seconds` exists on Artifacts).

### Account pages

| Route | Screen | Behavior |
| --- | --- | --- |
| `buyer.account.settings` GET `/account/settings` · `buyer.settings.update` PUT `/account/settings` | "Account Settings" ("Your Oseff account settings") | Form: Profile Picture (`avatar_url`), Email, Display Name (required), First Name, Last Name, Phone Number; button "Update Profile". Sections "Two-factor authentication" ("Use an authenticator app to generate verification codes.") and "Email verification code" ("The verification code will be sent to your phone number."). 2FA setup uses `GET /accounts/2fa/qr-code` and `POST /accounts/2fa/qr-code/enable`. |
| `buyer.account.appearance` GET/PUT `/account/appearance` | "Appearance" ("Customize your display preferences") | Language (required; English, Vietnamese, Thai), Region Format (required; 3 formats with samples), Timezone; button "Save changes". |
| `buyer.account.profile` GET `/account/profile` | "Profile" | Empty state "No profile information available at the moment." |
| `buyer.account.favorites` GET `/account/favorites` | "Favorites" | Empty state "No favorite items available at the moment." No route adds favorites. |
| `buyer.account.security` GET `/accounts/security` | Security | HTTP 500 on staging (defect). |

`Unresolved requirement:` validation rules for phone and name lengths on `PUT /account/settings`; success and error feedback (toast vs inline).

### Static and marketing pages

| Route | URI | Content |
| --- | --- | --- |
| `buyer.about-us` | `/about-us` | "About Us" — contact form (Title, Full Name, Email, Phone, Message with 0/1024 counter, "Send"; posts to the same URL) and company block (Business License No., Address, Email placeholders from platform configuration). Page title is Vietnamese ("Về chúng tôi"). |
| `buyer.blogs` | `/blogs` | "Blogs" — empty state "No blogs available at the moment." |
| `buyer.terms-and-policies` | `/terms-and-policies` | "Policies and Regulations" — Vietnamese Terms of Service with table of contents (sections 1–6: commitments, key terms, overview, provider, hirer, orders). |
| `buyer.terms-and-notifications` | `/terms-and-notifications` | "Terms and Notifications" — Vietnamese payment, inspection/cancellation/return, warranty/maintenance, and privacy policies; `#privacy-policy` anchor used by footer. |

### Authentication

- `/login` (`buyer.auth.login`): panel flow `welcome` → "Sign in to your account", "Continue with Google" (`/google/login`), "Continue with Email" (email + password → `POST /login`), link "Forgot password" (`/password/forgot`), link to join, "Resend verification email" (`/email/resend`). Login page renders error and warning messages from the session.
- `/join` (`buyer.auth.join`): "Create a new account" — "Create your account and discover world-class design talent.", Continue with Google / Continue with Email (name, email, password → `POST /register`), "Already have an account" link. `GET /register` redirects to `/join?panel=email`.
- `/password/forgot`: "Reset your password" — "Enter your email and we will send you a link to reset your password.", Email field, "Send Reset Link" (`POST /password/email`), "Back". Reset form at `/password/reset/{token}` → `POST /password/reset`.
- `/2fa/verify` (GET/POST): TOTP challenge after password login when 2FA is enabled; without a pending challenge it redirects to `/login`.
- `/email/verify`, `/email/resend` (GET/POST): email verification; both currently fail with HTTP 500 (defect).
- Social: `GET /{provider}/login` (Google observed), callback `GET /auth/{provider}/redirect`.
- `POST /logout`.

## Routes

All 67 `buyer.*` routes (domain `mynew1.net`). Status column: what the route returned on 2026-09-10 for the logged-in buyer unless noted.

### Public browsing

| Route name | Method | URI | Screen / purpose | Observed |
| --- | --- | --- | --- | --- |
| `buyer.home` | GET | `/` | Home | 200 |
| `buyer.category.show` | GET | `/{slug}` | L1 category listing | 200 |
| `buyer.category-item.show` | GET | `/{categorySlug}/{itemSlug}` | L2 listing | 200 |
| `buyer.category-l3.show` | GET | `/{categorySlug}/{l2Slug}/{l3Slug}` | L3 listing | 200 |
| `buyer.fab.show` | GET | `/fab/{fabSlug}` | Fab detail | 200 |
| `buyer.fabs.load` | GET | `/fabs?page=N` | JSON fab cards for home "Show more" | 200 JSON |
| `buyer.sellers.load` | GET | `/sellers?page=N` | JSON seller cards | 200 JSON |
| `buyer.category-fabs.load` | GET | `/category-fabs?level=&id=&page=&sort=` | JSON fab cards for category "Show more" | 200 JSON / 404 without params |
| `buyer.about-us` | GET | `/about-us` | About Us + contact form | 200 |
| `buyer.blogs` | GET | `/blogs` | Blog list | 200 (empty) |
| `buyer.terms-and-policies` | GET | `/terms-and-policies` | Terms of Service | 200 |
| `buyer.terms-and-notifications` | GET | `/terms-and-notifications` | Payment/privacy policies | 200 |
| `buyer.set-currency` | POST | `/set-currency` | Switch display currency | not exercised |
| `buyer.set-preference` | POST | `/set-preference` | Switch language | not exercised |

### Authentication

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `buyer.auth.login` | GET | `/login` | Login page | 200 guest; redirect `/` when logged in |
| `buyer.auth.authenticate` | POST | `/login` | Email/password login | not exercised |
| `buyer.auth.logout` | POST | `/logout` | Sign out | not exercised |
| `buyer.auth.register` | GET | `/register` | Redirects to `/join?panel=email` | 302 |
| `buyer.auth.register.store` | POST | `/register` | Create account | not exercised |
| `buyer.auth.join` | GET | `/join` | Registration landing | 200 guest; redirect `/` when logged in |
| `buyer.auth.social.signIn` | GET | `/{provider}/login` | Start Google OAuth | not exercised |
| `buyer.auth.social.redirect` | GET | `/auth/{provider}/redirect` | OAuth callback | not exercised |
| `buyer.auth.password.forgot` | GET | `/password/forgot` | Forgot password form | 200 |
| `buyer.auth.password.email` | POST | `/password/email` | Send reset link | not exercised |
| `buyer.auth.password.reset` | GET | `/password/reset/{token}` | Reset form | not exercised |
| `buyer.auth.password.update` | POST | `/password/reset` | Save new password | not exercised |
| `buyer.auth.2fa.verify` | GET | `/2fa/verify` | 2FA challenge | redirects `/login` without challenge |
| `buyer.auth.2fa.verify.submit` | POST | `/2fa/verify` | Submit code | not exercised |
| `buyer.auth.email.verify` | GET | `/email/verify` | Verify email | 500 (defect) |
| `buyer.auth.email.resend` | GET | `/email/resend` | Resend verification form | 500 (defect) |
| `buyer.auth.email.resend.submit` | POST | `/email/resend` | Resend verification | not exercised |

### Account

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `buyer.account.profile` | GET | `/account/profile` | Profile (empty state) | 200 |
| `buyer.account.settings` | GET | `/account/settings` | Account Settings form | 200 |
| `buyer.settings.update` | PUT | `/account/settings` | Save settings | not exercised |
| `buyer.account.appearance` | GET | `/account/appearance` | Appearance form | 200 |
| `buyer.account.appearance.update` | PUT | `/account/appearance` | Save appearance | not exercised |
| `buyer.account.favorites` | GET | `/account/favorites` | Favorites (empty state) | 200 |
| `buyer.account.security` | GET | `/accounts/security` | Security | 500 (defect) |
| `buyer.account.setting.2fa.qr-code` | GET | `/accounts/2fa/qr-code` | 2FA QR code | not exercised |
| `buyer.account.setting.2fa.enable` | POST | `/accounts/2fa/qr-code/enable` | Enable 2FA | not exercised |
| `buyer.presigned-url.generate` | POST | `/presigned-url` | S3 presigned upload URL (avatar) | not exercised |
| `buyer.api.notifications.index` | GET | `/api/notifications` | Notification list | 200 JSON |
| `buyer.api.notifications.mark-all-read` | POST | `/api/notifications/mark-all-read` | Mark all read | not exercised |
| `buyer.api.notifications.mark-read` | POST | `/api/notifications/{notification}/mark-read` | Mark one read | not exercised |

### Orders (buyer side)

| Route name | Method | URI | Purpose | Observed |
| --- | --- | --- | --- | --- |
| `buyer.account.orders` | GET | `/account/orders` | My orders list | 200 |
| `buyer.account.orders.show` | GET | `/account/orders/{order}` | Order detail (Items / Details / Activity) | 200 |
| `buyer.account.orders.history` | GET | `/account/orders/{order}/history` | JSON history for Delivery/Dispute "View History" | 200 `{items:[]}` |
| `buyer.account.orders.cancel` | POST | `/account/orders/{order}/cancel` | Cancel order | not exercised |
| `buyer.account.orders.artifacts.approve` | POST | `/account/orders/{order}/artifacts/{artifact}/approve` | Approve a delivery | not exercised |
| `buyer.account.orders.revision-request.store` | POST | `/account/orders/{order}/revision-request` | Create revision request | not exercised |
| `buyer.account.orders.revision-request.update` | PUT | `/account/orders/{order}/revision-request/{revision}` | Edit open revision request | not exercised |
| `buyer.account.orders.revision-request.withdraw` | POST | `/account/orders/{order}/revision-request/{revision}/withdraw` | Withdraw revision request | not exercised |
| `buyer.account.orders.dispute.store` | POST | `/account/orders/{order}/dispute` | Open dispute | not exercised |
| `buyer.order.show` | GET | `/order/{fabSlug}` | Checkout page | 200 |
| `buyer.orders.queue-preview` | POST | `/orders/queue-preview` | Estimated start preview | not exercised |
| `buyer.orders.store` | POST | `/orders` | Create order (NEW) | not exercised |
| `buyer.orders.pay` | POST | `/orders/{order}/pay` | Start payment | not exercised |
| `buyer.orders.payment.airwallex` | GET | `/orders/{order}/payment/airwallex` | Airwallex hosted payment | not exercised |
| `buyer.orders.payment.airwallex.poll` | GET | `/orders/{order}/payment/airwallex/poll` | Poll Airwallex status | not exercised |
| `buyer.orders.payment.success` | GET | `/orders/{order}/payment/success` | Provider return (success) | not exercised |
| `buyer.orders.payment.cancel` | GET | `/orders/{order}/payment/cancel` | Provider return (cancel) | not exercised |
| `buyer.orders.index` | GET | `/orders` | Legacy orders list | 500 (defect) |
| `buyer.orders.show` | GET | `/orders/{order}` | Legacy order page | 500 (defect) |
| `buyer.orders.revisions.index` | GET | `/orders/{order}/revisions` | Legacy revisions list | 500 (defect) |
| `buyer.orders.revisions.create` | GET | `/orders/{order}/revisions/create` | Legacy revision form | not exercised |
| `buyer.orders.revisions.store` | POST | `/orders/{order}/revisions` | Legacy revision create | not exercised |
| `buyer.orders.revisions.show` | GET | `/orders/{order}/revisions/{revision}` | Legacy revision detail | not exercised |

`Unresolved requirement:` whether the `buyer.orders.*` group (`/orders/...`) is deprecated in favor of `buyer.account.orders.*`; the UI links only to `/account/orders`.

## Buyer journey mapped to workflows

| Workflow step (see `../workflows/`) | Buyer screen / route |
| --- | --- |
| Review Seller availability, queue estimate, projected dates | Fab detail seller card; checkout "Estimated Start" via `POST /orders/queue-preview` |
| Select one Fab and Package, quantity one to three, one brief per Task | Checkout `/order/{fabSlug}` |
| Create checkout records and reserve one queue slot → Order NEW | `POST /orders` |
| Payment confirmed → READY → ACTIVE | `POST /orders/{order}/pay`, provider return, webhooks; Activity "Your payment was confirmed.", "Your order is ready.", "Your order was added to the Seller's queue." |
| Buyer review window (24 h) | Order detail Items tab; approve `POST …/artifacts/{artifact}/approve`; automatic approval otherwise |
| Request revision (quota, one per Artifact, edit, withdraw) | Revision Requests island; `revision-request.store/update/withdraw` |
| Open eligible dispute | `POST …/dispute`; Items tab Dispute card |
| Order completed / canceled / closed | Orders list status filter; Details banner |

## Defects observed (2026-09-10)

- `GET /orders`, `GET /orders/{order}`, `GET /orders/{order}/revisions`, `GET /accounts/security` → HTTP 500 "Unsupported tenant type: buyer".
- `GET /email/verify` → redirect `GET /email/resend` → HTTP 500 "View [buyer.auth.email-form] not found".
- Debug pages expose stack traces and file paths.
