# RAPIDWIFI-ZONE Change Log

All notable changes are tracked here with timestamps and tags.

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

