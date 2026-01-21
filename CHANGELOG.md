# RAPIDWIFI-ZONE Change Log

All notable changes are tracked here with timestamps and tags.

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

