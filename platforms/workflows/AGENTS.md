# COOS business workflows (Mermaid)

Four Mermaid flowcharts (`layout: elk`, `flowchart TB`) describe the COOS order lifecycle. They follow the `coos-business-diagrams` visual language: legend subgraph, swimlane-like phase subgraphs, class colors for Buyer / Seller / System actions, status pills per object, dashed policy notes.

| File | Title | Scope |
| --- | --- | --- |
| [`order-lifecycle-overview.mmd`](order-lifecycle-overview.mmd) | Order Lifecycle — Overview | End to end: checkout and payment → queue and sequential execution → review and outcome → seller non-delivery exception |
| [`seller-queue-and-sequential-execution.mmd`](seller-queue-and-sequential-execution.mmd) | Feature 04 — Seller Queue and Sequential Execution | Paid Order activation, one RUNNING entry per Seller, task scheduling in working hours, dispute blocking, non-delivery cancellation, atomic FIFO promotion |
| [`artifact-delivery-and-approval.mmd`](artifact-delivery-and-approval.mmd) | Artifact Delivery and Approval | Official delivery, Buyer review window, approval and earning, revised delivery history |
| [`revision-request-and-dispute-lifecycle.mmd`](revision-request-and-dispute-lifecycle.mmd) | Feature 04 — Revision Request and Dispute Lifecycle | Create/edit/withdraw a revision request, Seller accept/deny, automatic acceptance, Buyer response after denial, atomic Dispute outcome |

Render any file with the Mermaid CLI or the Mermaid live editor. Node ids are prefixed per diagram (`overview_`, `queue_`, `artifact_`, `revision_`) so the files can be merged without collisions.

## Rules stated in the diagrams and their configuration source

| Rule (diagram) | Configuration key (Admin › Configuration / Settings) | Observed value |
| --- | --- | --- |
| Buyer review defaults to 24 calendar hours | `order.buyer_artifact_review_timeout_hours` | 24 |
| Seller response to a revision request: 24 elapsed calendar hours | `order.seller_revision_response_timeout_hours` | 24 |
| Buyer response after denial: 24 elapsed calendar hours | `order.buyer_revision_denial_response_timeout_hours` | 24 |
| Automatic revision duration = 50% of original delivery, at least 1 hour, shorter than original | `order.auto_revision_duration_percent`, `order.minimum_revision_duration_hours` | 50, 1 |
| Unpaid checkout closes under guard rules | `order.payment_checkout_expiry_minutes` | 1440 |
| BLOCKED still counts toward the admission threshold | `order.seller_max_execution_queue_orders` | 8 |
| Quantity one to three per checkout | Buyer checkout island | observed orders with `package_quantity` 1 and 3 |
| Delivery uses Seller working hours; timeouts use calendar hours | Seller My Profile › Working Schedule (snapshotted per Task) | per seller |
| Every transition records actor, reason, UTC time, audit, notification | Status History tabs, Governance › Activities, `/api/notifications` | — |

## Diagram-to-platform mapping

### Order Lifecycle — Overview

| Diagram node (id) | Actor | Portal surface / route |
| --- | --- | --- |
| Buyer reviews Seller availability, queue estimate, projected dates (`overview_buyer_reviews_forecast`) | Buyer | Fab detail seller card; checkout "Estimated Start" via `POST /orders/queue-preview` |
| Buyer submits checkout (`overview_buyer_submits_checkout`) | Buyer | `/order/{fabSlug}` → `POST /orders` |
| System validates checkout (`overview_system_validates_checkout`) → "Checkout unavailable" | System | Checkout errors "This seller is currently not accepting new orders." / "Fully Booked" on Fab page |
| Create checkout records, reserve queue slot → Order NEW (`overview_order_new`) | System | Seller/Admin queue entry `reserved` with `reservation_expires_at`; Admin Orders status New |
| Payment confirmed? (`overview_payment_confirmed`) | System | `POST /orders/{order}/pay`, gateway webhooks, Admin Finance › Payment Instructions (`completed`) |
| Unpaid checkout closed → Order CLOSED, queue RELEASED | System | Admin `POST /orders/{order}/expire-checkout`; Buyer orders list status Closed |
| Order READY → provision Tasks → ACTIVE (`overview_order_ready` … `overview_order_active`) | System | Buyer Activity "Your payment was confirmed. / Your order is ready. / Your order was added to the Seller's queue."; Seller Tasks (status new) |
| Seller has RUNNING Order? WAITING / RUNNING (`overview_queue_waiting`, `overview_queue_running`) | System | Seller Execution Queue datatable; Buyer orders "Queue" column `n/total` |
| Start first unfinished Task at valid working time (`overview_system_starts_task`) | System | Task `in_progress`, Started At / Due At |
| Seller confirms official delivery (`overview_seller_confirms_delivery`) → Artifact SUBMITTED, Task DELIVERED | Seller | Task row action "Create Artifact" → `POST /fab-delivery/artifacts/submit` |
| Buyer acts before review deadline? approve / request revision / open dispute (`overview_buyer_outcome`) | Buyer | Order detail Items tab; `…/artifacts/{artifact}/approve`, `…/revision-request`, `…/dispute` |
| Automatic approval (`overview_system_auto_approves`) | System | Admin `POST /fab-delivery/artifacts/{artifact}/auto-approve`; Artifact `approval_type` |
| Record Seller earning once (`overview_system_records_earning`) | System | `Unresolved requirement:` no earnings screen exists in the Seller or Admin portals yet |
| Order COMPLETED, queue RELEASED (`overview_order_completed`) | System | Buyer orders Completed; queue `released`; notification "Order completed" |
| Dispute → Task DISPUTED, later ON_HOLD, queue BLOCKED (`overview_task_disputed` …) | System | Admin Fabricas › Disputes (`open`); Tasks `disputed` / `on_hold`; queue `blocked` |
| Seller non-delivery → Tasks CANCELED, Order CANCELED, queue RELEASED, finance marked | System | Admin `POST /fab-delivery/tasks/{orderTask}/auto-cancel-overdue`; Task `financial_resolution_required`; notifications "Task canceled", "Order canceled" |

### Feature 04 — Seller Queue and Sequential Execution

| Diagram node | Portal surface / route |
| --- | --- |
| Valid payment confirmed → Order READY, queue RESERVED (`queue_order_ready`, `queue_reserved`) | Queue entry `reserved`; `reservation_expires_at` = checkout expiry |
| Provision one Task per quantity unit with brief, sequence, duration, schedule, financial allocation (`queue_system_provisions`, `queue_system_attaches_snapshots`) | Task fields `brief`, `sequence_no`, `delivery_duration_hours`, `working_schedule`, `timezone`; Order snapshot `task_briefs`, `pricing` |
| Orchestration retry idempotently (`queue_system_retries`) | Not visible in UI; Order stays READY |
| Activate Order and establish FIFO time (`queue_system_activates`) | Queue `queued_at`; Order `active` |
| Seller already has RUNNING? WAITING / RUNNING | Queue status; projected dates (`projected_start_at`, `projected_completion_at`, `projection_calculated_at`) |
| Next valid working interval reached? keep scheduled / start Task (`queue_work_time`) | Task `new` → `in_progress`, `started_at`, `due_at` |
| Seller confirms delivery at or before deadline (`queue_seller_delivers`) | `POST /fab-delivery/artifacts/submit` |
| Review outcome: approved / revision accepted / dispute (`queue_review_outcome`) | Artifact status; Revision accept form; Dispute record |
| Schedule next Task (`queue_system_schedules_next`) | Next Task `new` → `in_progress` |
| Order COMPLETED → RELEASED → promotion trigger | Queue `released`; notification "Execution released" |
| Dispute blocks execution (`queue_blocked`) | Queue `blocked`; Order `has_open_dispute` |
| Non-delivery cancels remaining work (`queue_cancellation`) | `auto-cancel-overdue`; Tasks/Order `canceled` |
| Atomic FIFO promotion: select oldest by queue time then Order ID (`queue_system_selects_oldest`) | Next queue entry `waiting` → `running` |

### Artifact Delivery and Approval

| Diagram node | Portal surface / route |
| --- | --- |
| Seller uploads temporary files / prepares content (`artifact_seller_uploads`) | `POST /presigned-url` + S3 upload from the New Artifact form; temporary uploads are not Artifacts |
| Seller confirms official delivery (`artifact_seller_confirms`) | `POST /fab-delivery/artifacts/submit` (Delivery Note + one file) |
| Is Task IN_PROGRESS, content valid, at or before deadline? (`artifact_submission_valid`) | Row action "Create Artifact" only for `in_progress`; `due_at`; malware scan `verifying` → `submitted` / `error` |
| Create next official Artifact (`artifact_system_creates`) → SUBMITTED, Task DELIVERED | Artifact `sequence_no`, `delivery_cycle_no`, `seller_submitted_at`, `verified_at`, `buyer_available_at` |
| Set Buyer review deadline (`artifact_system_sets_review`) | Artifact `buyer_review_due_at` (+24 h from `buyer_available_at`); Buyer sees "Review Deadline" in Seller/Admin detail |
| All Tasks DELIVERED or COMPLETED? Order ACTIVE / DELIVERED | Order status |
| Buyer approves / no action → auto-approve (`artifact_buyer_approves`, `artifact_system_auto_approves`) | `POST /account/orders/{order}/artifacts/{artifact}/approve`; `approval_type` manual/auto; notification "Delivery approved" |
| Record Task completion earning exactly once (`artifact_system_records_earning`) | `Unresolved requirement:` no earning record surface |
| Schedule next Task / Order COMPLETED, queue RELEASED | Tasks list; queue status |
| Buyer requests revision / opens dispute (connectors) | See Revision Request and Dispute Lifecycle |
| Revised delivery creates a new sequential Artifact (`artifact_system_creates_next`) | Artifact `sequence_no` + 1 with `revision_request_id` set; previous Artifact stays `revision_requested` |

### Feature 04 — Revision Request and Dispute Lifecycle

| Diagram node | Portal surface / route |
| --- | --- |
| Buyer requests revision with reason and instructions (`revision_buyer_requests`) | Order detail "Request Revision" modal (Reason, Note) → `POST /account/orders/{order}/revision-request` |
| Quota available and no conflicting request? (`revision_eligible`) | Island `canCreate`, `revisionsUsed`, `maxRevisions` (Task `revision_limit`, `accepted_revision_count`); one request per Artifact |
| Create Revision Request NEW, pause Buyer review timer, Artifact REVISION_REQUESTED, set Seller response deadline (24 h) | Revision `new`, `seller_response_due_at`; Artifact `revision_requested` |
| Buyer edits open request (`revision_buyer_edits`) | "Edit Revision Request" → `PUT …/revision-request/{revision}` (`is_editable`) |
| Buyer withdraws (`revision_buyer_withdraws`) → WITHDRAWN, Artifact SUBMITTED, resume review time; approve only, no dispute | "Withdraw" (confirm) → `POST …/revision-request/{revision}/withdraw` |
| Seller accepts with duration (`revision_seller_accepts`, `revision_duration_valid`) | Seller `GET|POST /fab-delivery/revision-requests/{revision}/accept` (Revision Duration (hours) ≥ 1, shorter than original) |
| No Seller response before deadline → automatic acceptance (`revision_system_auto_accepts`, `revision_system_calculates_duration`) | Admin `POST /fab-delivery/revision-requests/{revision}/auto-accept` (50% of original, min 1 h) |
| ACCEPTED → consume quota, Task IN_PROGRESS, revision deadline in working hours, recalculate projections (`revision_request_accepted` …) | Revision `accepted`, `revision_duration_hours`; Task `accepted_revision_count` + 1; queue projections; notification "Order eta updated" |
| Seller resubmits → new sequential Artifact → new review window | "Create Artifact" again |
| Seller denies with reason (`revision_seller_denies`) → DENIED, Artifact SUBMITTED, Buyer response deadline (24 h) | Seller `GET|POST …/deny` (Deny Reason Type + Denial Reason); Revision `denial_reason`, `deny_revision_reason_id`; Artifact `buyer_response_due_at` |
| Buyer approves / no action → auto-approve / opens Dispute (`revision_denial_outcome`) | `…/approve`; Admin `auto-approve-post-denial`; `POST /account/orders/{order}/dispute` |
| Dispute eligible only after denial or with no quota (`revision_dispute_eligible`) | Buyer order detail (Dispute card appears after opening) |
| Atomic Dispute outcome: Artifact REJECTED, Task DISPUTED, later Tasks ON_HOLD, Dispute OPEN, Order stays ACTIVE with open dispute, queue BLOCKED, promote oldest WAITING | Artifact `rejected`; Task `disputed` / `on_hold`; Admin Disputes `open`; Order `has_open_dispute`; queue `blocked` |
| Scope boundary: no resolution, refund, or re-enqueue | Admin Dispute detail has no actions; Transactions `refund` type exists but unused |

## Using the diagrams in deliverables

- For product documentation, cite the diagram file and node ids instead of redrawing; keep node labels unchanged so QA traceability holds.
- For test cases, derive one scenario per decision diamond (`{...}`) outcome and one negative scenario per "End: … rejected" terminal.
- When observed behavior contradicts a diagram (for example an order changes status without the diagram's transition), record it as `Unresolved requirement:` in the portal file and raise it; do not edit the diagram to match staging.
