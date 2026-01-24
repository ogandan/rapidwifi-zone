# RAPIDWIFI-ZONE Change Log

All notable changes are tracked here with timestamps and tags.

# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a community-focused WISP platform designed for secure, auditable, and modular voucher-based internet access.  
This project runs on Raspberry Pi 3 with SQLite3 for lightweight, embedded database management.

---
# 📖 Changelog

## 2026‑01‑24 — Audit Log Trigger Migration & Cleanup

### 🔧 Trigger Updates
- Replaced all audit log triggers (`voucher_created`, `voucher_status_change`, `voucher_expired`, `payment_failed`) with new definitions.  
- Each trigger now **always records both**:
  - `voucher_id` (numeric primary key of the voucher)  
  - `batch_tag` (batch context for traceability)  
- `details` field enriched to include voucher ID and batch tag for human‑readable clarity.

### 🧹 Data Cleanup
- Identified **275 legacy audit log rows** missing `voucher_id`.  
- Implemented a one‑time backfill strategy:
  - Direct joins patched recoverable rows.  
  - Batch mapping table used for partial reconstruction.  
  - Remaining irrecoverable rows flagged as unresolved.  
- Final step: **deleted 273 unresolved orphaned rows** to simplify reporting and ensure data integrity.

### ✅ Verification
- Post‑migration audit log count: **29 total rows**.  
- All rows now have a valid `voucher_id`.  
- Smoke tests confirmed:
  - Voucher creation logs include both ID and batch tag.  
  - Status changes and expirations are captured consistently.  
  - Payment failures log voucher ID and batch tag correctly.

### 📌 Notes
- From this date forward, **all audit logs are guaranteed consistent**.  
- Legacy orphaned rows were intentionally purged; this is documented for audit transparency.  
- Future migrations should preserve this invariant: `voucher_id` must never be NULL in `audit_logs`.

---

## Features

- **Voucher Lifecycle (Fully Automated)**
  - `pending` → created at payment initiation
  - `reserved` → allocated to operator, awaiting cash confirmation
  - `sold` → delivered to client, locked
  - `expired` → validity period ended
  - `inactive` → cancelled or failed payment

- **Payment Integration**
  - Mobile money (self-service, voucherless or voucher delivery)
  - Operator-mediated cash sales
  - Normalized `payments` table with FK links to vouchers and users
  - Audit logging for every voucher transition

- **Auditability**
  - Triggers enforce lifecycle transitions:
    - `pending → sold` requires completed payment
    - `reserved → sold` requires completed cash payment
    - `sold → expired` automatically logged
  - All transitions recorded in `audit_logs`

- **Best Practices for Pi + SQLite**
  - WAL mode enabled for concurrency
  - Indexed critical columns (`status`, `profile`, `voucher_id`)
  - Background notification queue (SMS/WhatsApp/Telegram)
  - Regular pruning of expired vouchers/logs
  - Daily backup of `db.sqlite`

---

## Development Workflow

1. **Database Migrations**
   - Migration scripts stored in `/migrations`
   - Run with:
     ```bash
     sqlite3 data/db.sqlite < migrations/<script>.sql
     ```

2. **Version Control**
   - Track schema and documentation changes in git
   - Commit `db.sqlite` only after verified migrations

---

## Git Workflow

```bash
# Stage changes
git add README.md data/db.sqlite

# Commit with descriptive message
git commit -m "Add payments table, voucher lifecycle triggers, update README.md"

# Tag for rollback safety
git tag -a v20260123-lifecycle -m "Voucher lifecycle enforcement + payments schema"

# Push changes
git push origin main --tags

---
## [23012026-1806] - 23 Jan 2026 18:06 WAT
### Changed
- Full corrected `db.js` with voucher, operator, analytics, and log functions aligned to `export_logs`.
- Ensured all analytics functions (`countAllVouchers`, `countActiveVouchers`, `countInactiveVouchers`, `countProfiles`, `countExportsByProfile`) are defined before export.
- Fixed ReferenceError in `analytics.ejs` by passing `active` and `inactive` explicitly from `server.js`.
- Corrected `logs.ejs` to render `export_logs` schema and added CSV/JSON export buttons.
- Restored operator lifecycle routes (`/admin/deactivate-operator/:id`, `/admin/delete-operator/:id`, `/admin/activate-operator/:id`) in `server.js Part 2`.
- Added timestamp/version headers to all modified files for auditability.

---

## [2026-01-23 11:30 WAT] - Operator Lifecycle Status Separation

### Operator Lifecycle
- Added `status` column to `users` table (`active` / `inactive`).
- Updated `db.js` functions:
  - `getOperators()` now returns role + status.
  - `deactivateOperator()` sets `status='inactive'`.
  - `activateOperator()` sets `status='active'`.
  - `deleteOperator()` safely removes operators without actions.
- Updated `admin.ejs`:
  - Operator table now shows `status`.
  - Buttons switch correctly between Activate / Deactivate / Delete.
- Updated `server.js`:
  - `create-operator` inserts with `status='active'`.
  - Lifecycle routes call new `db.js` functions.
  - Analytics aligned with new `getVoucherCounts()` and `getProfileCounts()`.
  - Exports aligned with `db.getLogs()`.

### Files Modified
- `data/db.js`
- `views/admin.ejs`
- `server.js`
- `CHANGELOG.md`

---

## [2026-01-22 22:25 WAT] - Admin Dashboard & Voucher Lifecycle Fixes

### Operator Lifecycle
- Added explicit routes in `server.js` for operator **activate** and **deactivate**.
- Updated `admin.ejs` to show **Activate / Deactivate / Delete** buttons per operator.
- Ensured operators with audit logs are deactivated instead of deleted.

### Voucher Lifecycle
- Enforced voucher username/password length rules in `voucherManager.js`:
  - Usernames must be exactly 4 characters.
  - Passwords must be exactly 5 characters.
- Auto‑generation of voucher credentials now respects these length rules.
- Batch tags auto‑generated if not provided.

### Admin Dashboard
- Fixed EJS syntax errors (balanced `<% %>` blocks).
- Cleaned operator management loop and voucher table loops.
- Added bulk voucher actions (Block / Activate / Delete) by ID.
- Toolbar updated with export options and links to logs/analytics.

### Files Modified
- `server.js` (split into two parts for clarity, now complete)
- `views/admin.ejs` (split into two parts, lint‑safe)
- `modules/voucherManager.js` (username/password enforcement)
- `data/db.js` (operator lifecycle helpers, voucher counts, logs)

---

## [2026-01-22 19:50 WAT] - Operator Toggle & Voucher Length Fix
- Added explicit routes to activate and deactivate operators.
- Updated admin dashboard UI with Activate/Deactivate buttons.
- Restored voucher username/password length enforcement:
  - Usernames = 4 characters
  - Passwords = 5 characters
- Maintains auto-generated batch tags and audit integrity rules.

---

## [2026-01-22 18:30 WAT] - Operator Lifecycle Fix
- Operator IDs now displayed in admin dashboard.
- Operator deletion route corrected to `POST /admin/delete-operator/:id`.
- Audit integrity enforced:
  - Operators with recorded actions are deactivated instead of deleted.
  - Empty operators (no actions) can be deleted.
- Voucher bulk actions confirmed working by ID, with “Activate Selected” option.
- Voucher creation auto-generates batch tags if none provided.

---

## [2026-01-22 16:45 WAT] - Voucher & Operator Management Fixes
- Auto-generates batch tag during voucher creation if none is provided.
- Operator deletion now works via ID-based route.
- Operator listing now shows correct ID (requires db.js update).
- Voucher bulk actions now operate by ID, not username.
- Added support for activating inactive vouchers via bulk action.

---

## [2026-01-22 15:50 WAT] - Analytics Dashboard Chart Fix
- Rebuilt `analytics.ejs` to remove dependency on `/admin/stats` endpoint.
- Injected server-side data (`active`, `inactive`, `profiles`, `exportsByProfile`) directly into Chart.js.
- Added working charts for:
  - Active vs Inactive vouchers (doughnut chart).
  - Vouchers by profile (bar chart).
  - Exports by profile (bar chart).
- Verified charts render immediately when `/analytics` loads.

---

## [2026-01-22 13:20 WAT] - Analytics COUNT Fix
- Corrected aggregate queries in `data/db.js` to use single quotes for string literals ('active', 'inactive').
- Verified `countActiveVouchers` and `countInactiveVouchers` now return correct values without SQLITE_ERROR.
- Confirmed `runGet` is used for single-row aggregates, `runQuery` for multi-row queries.
- This patch stabilizes the `/analytics` dashboard counts.

---

## [2026-01-21 23:40 WAT] - Voucher, Operator, Analytics, Exports Fixes
- Implemented voucher creation in voucherManager.
- Added `/admin/delete-operator` POST route.
- Corrected analytics COUNT queries to use single quotes and db.get.
- Added export routes: `/admin/export-all`, `/admin/export-logs-csv`, `/admin/export-logs-json`.
- Fixed CSRF regression by ensuring operator login and dashboard forms include `_csrf`.

---

## [2026-01-21 22:55 WAT] - Fix aggregate COUNT queries
- Verified schema: vouchers, users, export_logs tables all have expected columns.
- Updated `db.js` to use `db.get` for aggregate queries (`COUNT(*)`).
- Fixed `countAllVouchers`, `countActiveVouchers`, `countInactiveVouchers`.
- Analytics dashboard should now load counts correctly.

---

## [2026-01-21 22:45 WAT] - Fix SQLite COUNT misuse
- Updated `db.js` to use `db.get` instead of `db.all` for aggregate queries.
- Fixed `countActiveVouchers`, `countInactiveVouchers`, and `countAllVouchers` functions.
- Analytics dashboard now loads counts without SQLITE_ERROR.

---

## [2026-01-21 22:25 WAT] - Login Result & Admin POST Routes
- Updated `login_result.ejs` to display both icon and message string (e.g. “✅ Login Successful – Welcome!”).
- Implemented missing POST routes:
  - `/admin/create` → create vouchers.
  - `/admin/create-operator` → create operator accounts with hashed passwords.
  - `/admin/bulk-action` → block or delete selected vouchers.
- Admin dashboard forms now functional instead of failing with “Cannot POST” errors.

---

## [2026-01-21 22:10 WAT] - Fix login_result mismatch
- Updated `server.js` to render `success: true/false` instead of `ok`.
- Ensured `login_result.ejs` conditional `<% if (success) %>` works correctly.
- Voucher login now shows proper success/failure messages instead of ReferenceError.
- This fix unblocks the voucher login flow in smoke tests.

---

## [2026-01-21 21:45 WAT] - Basic_Ok Checkpoint
- Marked current system state as **Basic_Ok**.
- Server & environment: restart and logs OK, server listening confirmed.
- Voucher login flow: UI loads, but login_result.ejs error (`success is not defined`) blocks success/failure rendering.
- Admin/operator login flow: working correctly with role-based redirects.
- CSRF validation: tokens present in forms, but voucher/operator creation not functional.
- Role-based access control: enforced correctly.
- Admin dashboard: create voucher/operator routes missing (`Cannot POST` errors), delete operator button absent, bulk actions failing.
- Operator dashboard: vouchers list not loading.
- Analytics dashboard: SQL misuse error on `COUNT()` aggregate.
- Logs dashboard: loads correctly.
- Database integrity: queries run, accounts and tunnel URL exist.
- ✅ This is a baseline checkpoint with partial functionality, saved as **Basic_Ok** for rollback safety.

---

## [2026-01-21 18:15 WAT] - Global CSRF Middleware Fix
- Mounted `app.use(csrfProtection)` globally after session middleware in `server.js`.
- Removed per-route `csrfProtection` wrappers to simplify and ensure consistency.
- Verified that `req.csrfToken()` is now always defined for all dashboard routes.
- Ensured `admin.ejs` and related forms correctly receive CSRF tokens.

---

## [2026-01-21 13:45 WAT] - DB Migration & Seed Verification
- Applied migrations to add `tunnel` and `export_logs` tables.
- Seeded initial Cloudflare tunnel URLs and export log entries.
- Verified helpers `getTunnelUrl` and `countExportsByProfile` return expected results.

---

## [2026-01-21 13:40 WAT] - Seed Data for Tunnel & Export Logs
- Added initial Cloudflare tunnel URLs for testing `getTunnelUrl`.
- Inserted sample export log entries for multiple profiles.
- Enabled immediate verification of `countExportsByProfile` helper.

---

## [2026-01-21 13:10 WAT] - DB Migration for Tunnel & Export Logs
- Added `tunnel` table to store Cloudflare tunnel endpoint.
- Added `export_logs` table to track voucher/profile export activity.
- Used `CREATE TABLE IF NOT EXISTS` for safe migration without overwriting existing schema.

---
## [2026-01-21 12:30 WAT] - DB Migration: Tunnel & Export Logs
- Added `tunnel` table to store Cloudflare tunnel URL.
- Added `export_logs` table to track voucher/profile export activity.
- Ensured safe creation with `IF NOT EXISTS` to avoid overwriting existing schema.

---

## [2026-01-21 12:00 WAT] - Centralized DB Helpers
- Added `runQuery` and `runExec` helpers to `data/db.js` for consistent async DB access.
- Migrated query functions (`getOperators`, `getTunnelUrl`, voucher counts, logs) into `db.js`.
- Ensures `server.js` and `voucherManager.js` use the same query style.

---

## [2026-01-21 11:55 WAT] - Bcrypt User Insert with Duplicate Check
- Extended helper script to check if username already exists in `users` table.
- If found, updates password hash and role instead of inserting duplicate.
- Simplifies account management for admins/operators.

---

## [2026-01-21 11:50 WAT] - Bcrypt User Insert CLI Helper
- Extended helper script to accept command-line arguments for username, password, and role.
- Validates role (`admin` or `operator`) before insertion.
- Simplifies onboarding of new accounts via CLI.

---

## [2026-01-21 11:45 WAT] - Bcrypt User Insert Helper
- Extended `bcrypt_test.js` to insert generated hash directly into `users` table.
- Supports onboarding new admin/operator accounts with one script run.

---

## [2026-01-21 11:35 WAT] - Admin/Operator Login via Users Table
- Updated `/admin-login` route to query `users` table for credentials.
- Added bcrypt password hash comparison against `password_hash`.
- Session role now set from `role` column (`admin` or `operator`).
- Removed hardcoded credentials; now fully database-driven.

---

## [2026-01-21 10:47 WAT] - Unified Login UI
- Updated `views/login.ejs` to match polished styling of `admin_login.ejs`.
- Added voucher name and code fields with CSRF protection.
- Improved branding and responsive layout.

## [2026-01-21 10:47 WAT]
---

## [2026-01-21 10:35 WAT] - Admin Login Page
- Added `views/admin_login.ejs` with polished UI for admin/operator login.
- Clean card layout, responsive design, and error feedback.
- Separated from voucher login to enforce role-based access.

---

i## [2026-01-21 10:30 WAT] - Split Login Flows
- Added `/admin-login` route for admin/operator authentication.
- Updated middleware to redirect unauthorized dashboard access to `/admin-login` instead of `/login`.
- Prevented voucher clients from seeing or accessing admin/operator login flows.

---

## [2026-01-21 10:05 WAT] - Fix Module Path
- Corrected `server.js` require path for `voucherManager` from `./voucherManager` to `./modules/voucherManager`.
- Ensures server can load voucher lifecycle functions without MODULE_NOT_FOUND error.

---

## [2026-01-21 09:55 WAT] - VoucherManager Update
- Added `validateVoucher(username, password)` to check both fields against DB.
- Confirmed schema alignment with `vouchers` table (`username`, `password`, `status`).
- Retained existing lifecycle functions: `listVouchers`, `createVoucher`, `deactivateVoucher`.
- No features removed; login validation fixed.

---

## [2026-01-21 09:40 WAT] - Voucher Login Fix
- Updated `server.js` `/login` route to accept both `username` and `password`.
- Added new `voucherManager.js` with `validateVoucher(username, password)` function.
- Ensured voucher authentication checks both fields against database.
- No features removed; only fixed login validation.

---

## [21012026-0015] - 21 Jan 2026 00:15 WAT
### Added
- New `logout.ejs` template with clean confirmation message.
- Card-style layout with friendly icon and message.
- Action buttons: Login Again and Return to Home.
- Responsive design for mobile readability.

---

## [20012026-0005] - 21 Jan 2026 00:05 WAT
### Added
- New `login_result.ejs` template with clean success/failure feedback.
- Success: green card with ✅, links to operator/admin dashboards.
- Failure: red card with ❌, retry link to login.
- Responsive design for mobile readability.

---

## [20012026-2355] - 20 Jan 2026 23:55 WAT
### Added
- New `login.ejs` template with responsive layout for voucher login form.
- Centered card-style login container with polished styling.
- Mobile-friendly adjustments: reduced padding, smaller header font, full-width button.
- Ensured consistent design language across all dashboards.

---

## [20012026-2340] - 20 Jan 2026 23:40 WAT
### Added
- New `logs.ejs` template with responsive layout.
- Desktop: clean table view with headers.
- Mobile: collapses into card-style blocks using `data-label` for readability.
- Unified display for audit and download logs.

---

## [20012026-2320] - 20 Jan 2026 23:20 WAT
### Added
- Full updated `analytics.ejs` template with responsive CSS integration.
- Implemented polished card-based grid layout for charts.
- Integrated Chart.js with responsive configuration for:
  - Voucher Creation (Last 7 Days)
  - Voucher Trends (Weekly)
  - Exports Over Time
  - Active vs Inactive Vouchers
  - Exports by Profile

---

## [20012026-2300] - 20 Jan 2026 23:00 WAT
### Added
- Responsive analytics dashboard layout:
  - Grid-based container for charts.
  - Card styling with shadows and rounded corners.
  - Chart.js configured for fluid resizing (`responsive: true`, `maintainAspectRatio: false`).
- Ensured charts stack neatly on mobile with reduced height.

---

## [20012026-2245] - 20 Jan 2026 22:45 WAT
### Added
- New `styles.css` for polished, responsive UI across all dashboards (admin, operator, analytics, logs).
- Operator dashboard distinct styling:
  - Green gradient header and buttons.
  - Visual separation from admin dashboard.
- Responsive tables collapse into card-style blocks on mobile devices.

---

## [20012026-2210] - 20 Jan 2026 22:10 WAT
### Added
- New `operator.ejs` template for restricted operator dashboard.
- Operators can:
  - View available vouchers.
  - Sell vouchers via cash payments.
  - Deliver vouchers via SMS, WhatsApp, or Telegram.
- Operators cannot create vouchers (admin-only functionality).

---

## [20012026-2140] - 20 Jan 2026 21:40 WAT
### Added
- Updated `db.js` with operator CRUD functions:
  - `createOperator`, `getOperators`, `deleteOperator` (with non-deletable constraint).
  - `operatorHasActions` checks audit_logs and payments before allowing deletion.
- Preserved tunnel URL management and logs functions.
- Confirmed analytics count functions remain intact.

---

## [20012026-2125] - 20 Jan 2026 21:25 WAT
### Added
- Migration script to create missing `operators` table.
- Rebuilt `payments` and `delivery_logs` tables with foreign keys to `vouchers`.
- Ensured data copied from old tables before dropping them.
- Enabled foreign key enforcement (`PRAGMA foreign_keys = ON`).

---

## [20012026-1645] - 20 Jan 2026 16:45 WAT
### Changed
- Completed full corrected `db.js` (Parts 1 + 2).
- Ensured all analytics functions are defined before export.
- Fixed ReferenceError on server startup.
- Added tunnel URL and log functions.

---

## [20012026-1606] - 20 Jan 2026 16:06 WAT
### Changed
- Full corrected `db.js` with voucher, operator, analytics, tunnel, and log functions.
- Ensured all analytics functions (`countAllVouchers`, `countActiveVouchers`, etc.) are defined before export.
- Fixed ReferenceError on server startup.
- Added timestamp/version headers to file.

---

## [20012026-1540] - 20 Jan 2026 15:40 WAT
### Changed
- Corrected `db.js` with all voucher, operator, analytics, tunnel, and log functions.
- Fixed missing analytics functions (`countAllVouchers`, `countActiveVouchers`, etc.) to resolve ReferenceError.
- Ensured all functions are defined before export.
- Added timestamp/version headers to file.

---

## [20012026-1455] - 20 Jan 2026 14:55 WAT
### Changed
- Finalized complete `db.js` with all voucher, operator, analytics, tunnel, and log functions.
- Ensured all functions defined before export to fix `ReferenceError: countAllVouchers`.
- Added timestamp/version comment headers to `db.js`.
- Verified login routes now reference defined functions, preparing for smoke test checklist.

---

## [20012026-1328] - 20 Jan 2026 13:28 WAT
### Changed
- Restarted complete `db.js` with operator functions, analytics, tunnel, logs, and hasActions flag.
- Initial attempt at fixing login errors, but server still returned red alerts on voucher/admin login.
- Highlighted need for timestamp/version headers in files.

---

## [20012026-1306] - 20 Jan 2026 13:06 WAT
### Changed
- First complete `db.js` with operator functions, analytics, tunnel, logs, and hasActions flag.
- Established baseline for voucher lifecycle and operator management functions.
- Provided initial structure for analytics functions (counts, trends).

---

## [phase-8-fixing-login-analytics]
### Changed
- Split login logic between voucher and admin/operator routes.
- Fixed operator management functions in `db.js`.
- Restored export options in admin dashboard.
- Adjusted analytics charts for voucher creation and profile performance.

---

## [phase-10-csrf-coherent-fix]
### Changed
- Applied CSRF protection coherently to GET routes rendering forms (`/`, `/admin`, `/analytics`).
- Kept POST protection intact to maintain security without breaking login flows.
- Stabilized CSRF handling across the system.

