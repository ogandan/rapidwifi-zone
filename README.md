# RAPIDWIFI-ZONE

# 📖 Changelog

## 🏷️ Tags

# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a captive portal and voucher management system with admin/operator dashboards, payment integration, analytics, and audit logs.

## Recent Fixes and Enhancements (2026-01-29)

### Server.js
- Split into 6 logical parts for clarity and maintainability.
- Preserved all existing voucher, payment, audit log, and analytics features.
- Added **operator management routes**:
  - `/api/operators` → list operators
  - `/admin/operator/create` → create operator
  - `/admin/operator/activate` → activate operator
  - `/admin/operator/deactivate` → deactivate operator
  - `/admin/operator/delete` → delete operator (restricted if vouchers exist)
- Added **voucher bulk-action routes**:
  - `/admin/vouchers/bulk-activate`
  - `/admin/vouchers/bulk-block`
  - `/admin/vouchers/bulk-delete`
- Improved self-service payment route to show alerts (green for success, red for failure) instead of raw JSON.

### Templates
- **login.ejs**: Now displays Bootstrap alerts for payment success/failure with voucher details.
- **operator.ejs**: Cash payment form aligned with `/operator/pay/cash`, dynamic profiles, CSRF handling intact.
- **audit_logs.ejs**: Corrected Ajax URL to `/api/audit-logs`, filters working, auto-refresh every 30s.
- **admin.ejs**: Extended with operator management UI, voucher filters (status, profile, date, created_by), and bulk actions (activate, block, delete selected vouchers). Existing voucher and payments tables preserved.

### Database
- `payments` table confirmed to include `phone TEXT` column for mobile money support.
- `vouchers` table rebuilt with `created_by` referencing `users.username` and `ON DELETE RESTRICT` to prevent operator deletion if vouchers exist.
- `operators` table extended with `status` column for active/inactive state.

## Smoke Test Checklist
- Operator lifecycle: create, activate, deactivate, delete (restricted if vouchers exist).
- Voucher bulk actions: activate, block, delete selected vouchers.
- API validation: `/api/operators` and `/api/vouchers` return correct JSON.
- CSRF enforcement: invalid tokens blocked, valid tokens succeed.
- UI integration: operators table, voucher filters, bulk actions functional.


# RAPIDWIFI-ZONE

## Template & Route Changes (2026-01-29)

- **Admin Dashboard**
  - Added DataTables voucher table (`/api/vouchers`).
  - Added filters: status, profile, batch, created by, date.
  - Bulk-action select boxes for vouchers still missing.
  - Operator management features missing (create, activate, deactivate, delete).
  - Export via DataTables CSV/Excel works; custom export routes (`/admin/export-*`) not yet implemented.

- **Audit Logs**
  - Corrected Ajax URL to `/api/audit-logs`.
  - Filters working.
  - Payments table displays but does not auto-refresh.

- **Voucher Login**
  - Profile dropdown dynamically populated from MikroTik.
  - Payment failure now shows red alert instead of raw JSON.
  - DB schema missing `phone` column in `payments` table → causes errors.

- **Operator Dashboard**
  - Cash payment form aligned with `/operator/pay/cash`.
  - Profiles rendered dynamically.
  - Logout button missing.

- **Analytics**
  - Charts and counts display correctly.

- **CSRF**
  - Tokens enforced; invalid tokens throw `EBADCSRFTOKEN`.
  - Need operator/admin guidance on how to test CSRF manually.

## Outstanding Fixes
- Add operator management (create, activate, deactivate, delete).
- Implement bulk voucher actions.
- Implement `/admin/export-*` routes.
- Add `phone` column to `payments` table schema.
- Add logout button to operator dashboard.
- Ensure payments table auto-refreshes.


# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a captive portal and voucher management system with admin/operator dashboards, payment integration, analytics, and audit logs.

## Recent Fixes (2026-01-29)

### Server.js
- Added `/api/vouchers` endpoint returning `{ data: [...] }` for DataTables.
- Corrected `/api/audit-logs` endpoint (hyphen instead of underscore).
- Adjusted MikroTik profile parsing so profiles like `day-FCFA100` are keyed by `day`.
- Fixed operator cash payment route to `/operator/pay/cash`.
- Enforced CSRF tokens consistently across forms and Ajax requests.
- Self-service payment route now records payments with timestamp and updates voucher status.

### Templates
- **admin.ejs**: Added DataTables initialization for vouchers (`/api/vouchers`), ensured CSRF hidden fields, auto-refresh for vouchers and payments.
- **audit_logs.ejs**: Corrected Ajax URL to `/api/audit-logs`, ensured filters work, auto-refresh every 30s.
- **login.ejs**: Profile dropdown now dynamically populated from MikroTik profiles instead of hardcoded values.
- **operator.ejs**: Cash payment form posts to `/operator/pay/cash`, CSRF token included, profiles rendered dynamically.

## Key Routes
- Admin dashboard: `/admin`
- Operator dashboard: `/operator`
- Voucher login: `/login`
- Logs dashboard: `/admin/logs`
- Analytics dashboard: `/analytics`

## APIs
- `/api/vouchers` → voucher list for DataTables
- `/api/payments` → payments list
- `/api/audit-logs` → audit logs list

## Development Notes
- Ensure SQLite schema includes:
  - `vouchers.created_by`
  - `payments.timestamp`
- Run smoke test checklist after deployment to validate dashboards and APIs.


# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a captive portal and voucher management system with admin/operator dashboards, payment integration, analytics, and audit logs.

## Recent Fixes (2026-01-28)

- **Voucher List**: Admin dashboard now displays vouchers correctly. Added `/api/vouchers` endpoint returning JSON `{ data: [...] }` for DataTables.
- **Audit Logs**: Fixed DataTables Ajax error. `/api/audit-logs` consistently returns `{ data: [...] }`.
- **CSRF Handling**: Middleware exempts API and callback routes, tokens passed to templates, error handler improved.
- **Self-service Payments**: Mobile money vouchers are created and marked as sold, payments recorded with `timestamp`.

## Usage

- Admin dashboard: `/admin`
- Operator dashboard: `/operator`
- Voucher login: `/login`
- Logs dashboard: `/admin/logs`
- Analytics dashboard: `/analytics`
- APIs:
  - `/api/vouchers`
  - `/api/payments`
  - `/api/audit-logs`

## Development Notes

- Ensure SQLite schema includes:
  - `vouchers.created_by`
  - `payments.timestamp`
- Run smoke test checklist after deployment to validate dashboards and APIs.


# RAPIDWIFI-ZONE

## Overview
RAPIDWIFI-ZONE is a captive portal and admin dashboard for managing vouchers, operators, payments, and analytics.

## Recent Updates (2026-01-27)
- **Bulk Actions Fixed**: Voucher bulk actions (block, activate, delete) now work correctly.
  - Updated `views/admin.ejs` checkboxes to use `ids[]`.
  - Aligned action values (`block-voucher`, `activate-voucher`, `delete-voucher`) with backend routes.
- **Admin Dashboard Cleanup**:
  - Removed embedded Audit Logs table from `admin.ejs`.
  - Restored **View Logs** button in the toolbar to navigate to `/admin/logs`.
- **server.js Updates**:
  - Corrected `/admin/bulk-action` route to normalize `ids

### Operator Dashboard and Voucher Attribution

- **New Column:** `created_by` has been added to the `vouchers` table schema.
- **Purpose:** Tracks which operator created each voucher.
- **Usage:**
  - When an operator creates a voucher, their username is stored in `created_by`.
  - The operator dashboard now displays the total vouchers sold today per operator using this column.
- **Migration:**
  ```sql
  ALTER TABLE vouchers ADD COLUMN created_by TEXT;


# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a captive portal and management system for vouchers, operators, and payments.  
It provides dashboards for admins and operators, analytics, and export functionality.

---

## Features

### Authentication & CSRF
- Voucher login with CSRF protection.
- Admin and operator login with role-based redirects.
- CSRF tokens enforced on all forms except `/api/*` and `/payments/callback`.

### Voucher Lifecycle
- Create vouchers individually or in bulk.
- Activate, block, or delete vouchers.
- Voucher status tracked (`active`, `inactive`, `sold`).

### Payments
- Self-service mobile money payments insert vouchers with `pending` status.
- Callback handler updates payment status and marks vouchers as sold.
- Cash payments supported with credential display.
- Payments API available at `/api/payments`.

### Operator Dashboard (Redesigned)
- Displays **total vouchers sold today** by the logged-in operator.
- Profile dropdown to create vouchers (`1h`, `day`, `week`).
- Sell workflow:
  - Operator enters amount.
  - Voucher password revealed after sale.
  - Transaction closed with a "Close Sale" button.

### Analytics Dashboard
- Voucher status chart (active vs inactive).
- Profile distribution chart.
- Export logs chart.
- Payments status chart (success vs failed).
- Revenue by method chart.
- Payments time-series chart.
- Revenue trend chart.
- Profile-based revenue chart.

### Logs & Exports
- Export vouchers to CSV with headers.
- Export logs to CSV/JSON with filters:
  - Filter by profile, status, batch tag.

### Operator Management
- Create, activate/deactivate, and delete operators.
- Operator actions tracked.

### Audit Logs
- Audit logs available via `/api/audit_logs`.

---

## Database Helpers

- `countOperatorSoldToday(username)`  
  Returns the number of vouchers sold today by the specified operator.

---

## Setup

1. Install dependencies:
   ```bash
   npm install


# RAPIDWIFI-ZONE

Captive portal and admin dashboards for voucher lifecycle, payments integration, analytics, and notifications.

## Features
- Voucher login and lifecycle management
- Admin and operator dashboards
- Self-service payments (MTN MoMo sandbox + cash)
- Audit logs and payments dashboard (`/admin/logs`)
- Enhanced analytics dashboard (`/analytics`) with:
  - Voucher status
  - Profile distribution
  - Export logs
  - Payments status
  - Revenue by method
  - Payments time-series
  - Revenue trend (cumulative)
  - Profile-based revenue
- Operator management (create, activate, deactivate, delete)
- Export vouchers and logs (CSV/JSON)
- CSRF protection for all forms

## Installation
```bash
npm install


# RAPIDWIFI-ZONE

Captive portal and admin dashboards for voucher lifecycle, payments integration, analytics, and notifications.

## Features
- Voucher login and lifecycle management
- Admin and operator dashboards
- Self-service payments (MTN MoMo sandbox)
- Cash payments with voucher credentials returned
- Audit logs and payments dashboard (`/admin/logs`)
- Enhanced analytics dashboard (`/analytics`) with:
  - Voucher status
  - Profile distribution
  - Export logs
  - Payments status
  - Revenue by method
  - Payments time-series
  - Revenue trend (cumulative)
  - Profile-based revenue
- Operator management (create, activate, deactivate, delete)
- Export vouchers and logs (CSV/JSON)

## Installation
```bash
npm install


# RAPIDWIFI-ZONE

Captive portal and admin dashboards for voucher lifecycle, payments integration, and notifications.

## Features
- Voucher login and lifecycle management
- Admin and operator dashboards
- Self-service payments (MTN MoMo sandbox)
- Cash payments
- Audit logs and payments dashboard (`/admin/logs`)
- Analytics dashboard (`/analytics`)
- Operator management (create, activate, deactivate, delete)
- Export vouchers and logs (CSV/JSON)

## Installation
```bash
npm install


## 📌 Self‑Service Mobile Money Payment Workflow

# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a captive portal and dashboard system for voucher lifecycle management, payments integration, and notifications.

## Recent Fixes

### Audit Logs
- Fixed query in `db.js` to use `timestamp` instead of non-existent `created_at`.
- Ensures audit logs load correctly in dashboards and API.

### CSRF Protection
- Global CSRF middleware applied after session setup.
- Added CSRF error handler to render a friendly error page.

### Error Page
- Updated `error.ejs` to use `<%= message %>` instead of `__("payment_error")`.
- Prevents runtime `ReferenceError: __ is not defined`.

### Routes
- Added `/pay/cash` route for recording cash payments.
- Added `/logout` route to destroy session and redirect to login.

### Exports
- Verified export routes (`/admin/export-all`, `/admin/export-logs-csv`, `/admin/export-logs-json`) are wired and functional.


RAPIDWIFI‑ZONE now supports **direct client payments via Mobile Money**. This feature allows a client to purchase a voucher themselves, without operator intervention, and immediately gain browsing access once payment is confirmed.

### Audit Logs
- The `audit_logs` table uses a `timestamp` column for entries.
- Code has been updated to query `timestamp` instead of `created_at`.
- No migration or backfill is required because `timestamp` is already populated automatically.

# RAPIDWIFI-ZONE

RAPIDWIFI-ZONE is a captive portal and dashboard system for voucher lifecycle management, payments integration, and notifications.

## Recent Fixes

### CSRF Protection
- Added global CSRF middleware (`app.use(csrfProtection)`) after session setup.
- Implemented a CSRF error handler to catch invalid tokens and display a friendly error message.
- All forms now include `<input type="hidden" name="_csrf" value="<%= csrfToken %>">` and route handlers pass `req.csrfToken()` to templates.

### Audit Logs
- The `audit_logs` table uses a `timestamp` column (not `created_at`).
- Updated queries in `db.js` to reference `timestamp` instead of `created_at`.
- This resolves `SQLITE_ERROR: no such column: created_at`.

## Deployment Notes
- Restart with `pm2 restart rapidwifi --update-env` to ensure environment variables are loaded.
- For local testing, session cookies are configured with `secure: false`.


### 🔎 Workflow Overview

1. **Client selects profile**  
   On the login page, the client enters their **mobile phone number** and chooses a browsing profile (e.g. 1‑hour pass, daily pass, weekly pass).

2. **Voucher created (pending)**  
   The backend generates a valid voucher (4‑char username, 5‑char password) and records a payment entry linked to that voucher ID.

3. **Payment initiated**  
   A `requesttopay` is sent to the Mobile Money API.  
   - The client’s phone number is used as the payer (`partyId`).  
   - The voucher ID is passed as `externalId` to link payment → voucher.

4. **Gateway callback → confirmation**  
   The Mobile Money gateway sends a callback to `/payments/callback`.  
   - The callback handler verifies the payload (signature in production, sandbox status otherwise).  
   - Voucher transitions from `pending` → `sold` if payment is successful.

5. **Client notified**  
   Once voucher is marked `sold`, the system triggers `notificationManager` to send voucher credentials via SMS/WhatsApp/Telegram.  
   Notifications are queued so DB transactions are not blocked.

6. **Audit trail created**  
   Every voucher transition and payment confirmation is logged in `audit_logs`.  
   Sandbox callbacks are also logged for visibility.

7. **Client login → browsing enabled**  
   The client uses the delivered voucher credentials to log in via the captive portal.  
   Browsing access is granted immediately.

---

### ✅ Key Files Updated
- `server.js` — corrected self‑service payment flow, merged working `/admin-login`, callback handler aligned with schema.  
- `views/payment_result.ejs` — new view to display payment status.  
- `README.md` — this section added to document the workflow.

---

## 📌 Self‑Service Mobile Money Payment Workflow

RAPIDWIFI‑ZONE now supports **direct client payments via Mobile Money**. This feature allows a client to purchase a voucher themselves, without operator intervention, and immediately gain browsing access once payment is confirmed.

### 🔎 Workflow Overview
1. **Client selects profile**  
   On the login page, the client enters their **mobile phone number** and chooses a browsing profile (e.g. 1‑hour pass, daily pass, weekly pass).

2. **Voucher created (pending)**  
   The backend creates a voucher in `pending` state and records a payment entry linked to that voucher.

3. **Payment initiated**  
   A `requesttopay` is sent to the Mobile Money API.  
   - The client’s phone number is used as the payer (`partyId`).  
   - The voucher ID is passed as `externalId` to link payment → voucher.

4. **Gateway callback → confirmation**  
   The Mobile Money gateway sends a callback to `/payments/callback`.  
   - The callback handler verifies the payload (signature in production, sandbox status otherwise).  
   - Voucher transitions from `pending` → `sold` if payment is successful.

5. **Client notified**  
   Once voucher is marked `sold`, the system triggers `notificationManager` to send voucher credentials via SMS/WhatsApp/Telegram.  
   Notifications are queued so DB transactions are not blocked.

6. **Audit trail created**  
   Every voucher transition and payment confirmation is logged in `audit_logs`.  
   Sandbox callbacks are also logged for visibility.

7. **Client login → browsing enabled**  
   The client uses the delivered voucher credentials to log in via the captive portal.  
   Browsing access is granted immediately.

---

### ✅ Key Files Updated
- `views/login.ejs` — extended with phone number + profile selection form.  
- `server.js` — new `/selfservice/pay` route, updated `/payments/callback` handler.  
- `README.md` — this section added to document the workflow.


- **feature-user-management-20260124-1504**  
  Voucher audit log migration and cleanup (2026‑01‑24 15:04 WAT).  
  - Updated triggers to always record `voucher_id` and `batch_tag`.  
  - Purged 273 unresolved orphaned rows for consistency.

- **feature-user-management-20260124-1533**  
  Payment trigger migration and audit trail enhancement (2026‑01‑24 15:33 WAT).  
  - Added `payment_success` and `payment_failed` triggers.  
  - Enforced `NOT NULL amount` and FK to vouchers.  
  - Audit logs now capture `voucher_id`, `batch_tag`, `method`, and `amount`.


## 2026‑01‑24 — Payment Trigger Migration & Audit Trail Enhancement

### 🔧 Trigger Updates
- Added and updated payment triggers to ensure full lifecycle auditability:
  - **payment_success** → Logs successful payments with voucher ID, batch tag, method, and amount.
  - **payment_failed** → Logs failed payments with voucher ID, batch tag, method, and amount.
- All payment events now consistently record:
  - `voucher_id` (numeric primary key of the voucher)
  - `batch_tag` (batch context for traceability)
  - `method` (payment channel, e.g., mobile_money, cash)
  - `amount` (mandatory, enforced by schema)

### 🧹 Schema Normalization
- Enforced `NOT NULL` constraint on `amount` to prevent incomplete payment records.
- Added `created_at` timestamp default for all payment entries.
- Ensured `voucher_id` is a foreign key referencing `vouchers.id`.

### ✅ Verification
- Smoke tests confirmed:
  - Voucher 77 → `payment_success` logged with method `mobile_money`, amount `500.0`, and batch tag.
  - Vouchers 70–73 → Multiple `payment_failed` entries logged with voucher IDs and methods.
  - Voucher 1 → Legacy `payment_failed` entry now aligned with new schema.
- Query results show all `payment_%` actions include populated `voucher_id` and enriched details.

### 📌 Notes
- From this date forward, **all payment events are guaranteed consistent** in the audit trail.
- Legacy incomplete rows were normalized or flagged during migration.
- Future migrations should preserve this invariant: `amount` must never be NULL and `voucher_id` must always be populated.


RAPIDWIFI-ZONE is a captive portal and dashboard system designed for community Wi-Fi deployments.  
It provides voucher-based access, operator/admin management, analytics, and export logging.

---

## 📌 Directory Structure (verified on system)

rapidwifi-zone/
├── server.js                                    # Express server entry point
├── modules/                   # Core business logic
│   ├── voucherManager.js              # Voucher lifecycle management
│   ├── adminDashboard.js              # Admin dashboard logic
│   ├── auditLogger.js                    # Audit logging
│   ├── mikrotik-api.js                  # RouterOS/Mikrotik integration
│   ├── paymentHandler.js              # Payment integration (to be built)
│   ├── smsSender.js                        # SMS notifications
│   ├── telegramBot.js                    # Telegram bot integration
│   └── whatsappBot.js                    # WhatsApp bot integration
├── data/
│   ├── db.js                                      # SQLite database helper functions
│   ├── db.sqlite                              # Main database file
│   ├── migrate_.sql           # Migration scripts
│   ├── vouchers_.csv          # Voucher export/import files
│   └── audit.log                              # Audit trail
├── views/                      # EJS templates
│   ├── login.ejs
│   ├── admin_login.ejs
│   ├── admin.ejs
│   ├── operator.ejs
│   ├── analytics.ejs
│   ├── logs.ejs
│   └── partials/               # Shared header/footer
├── routes/                     # Express route modules
│   └── vouchers.js
├── public/                     # Static assets
│   └── styles/style.css
├── scripts/                    # Utility scripts
│   ├── dailyReport.js
│   ├── weeklyReport.js
│   ├── generate_graphs.py
│   └── update-tunnel-url.sh
├── ssl/                        # Certificates
│   ├── selfsigned.crt
│   └── selfsigned.key
├── locales/                    # i18n translations
│   ├── en.json
│   └── fr.json
├── exports/                    # Exported logs and vouchers
│   └── audit_logs.csv
├── migrations/                 # SQL migrations
│   ├── 20260114_add_audit_columns.sql
│   └── 20260114_backfill_audit.sql
└── CHANGELOG.md                                # Versioned changelog

Code


Copy

---

## 📌 Dependencies

- **express** – Web framework  
- **express-session** – Session management  
- **body-parser** – Form parsing  
- **csurf** – CSRF protection  
- **bcrypt** – Password hashing  
- **sqlite3** – Database driver  
- **ejs** – Templating engine  

---

## 📌 Database Schema (verified on system)

### `users`
| Column       | Type      | Notes                          |
|--------------|-----------|--------------------------------|
| id           | INTEGER   | Primary key                    |
| username     | TEXT      | Unique, required               |
| password_hash| TEXT      | Hashed password                |
| role         | TEXT      | `admin` / `operator`           |
| created_at   | DATETIME  | Default `CURRENT_TIMESTAMP`    |
| status       | TEXT      | Default `'active'`             |

### `vouchers`
| Column     | Type      | Notes                          |
|------------|-----------|--------------------------------|
| id         | INTEGER   | Primary key                    |
| username   | TEXT      | Voucher username               |
| password   | TEXT      | Voucher password               |
| profile    | TEXT      | Profile name                   |
| created_at | DATETIME  | Default `CURRENT_TIMESTAMP`    |
| status     | TEXT      | Default `'active'`             |
| batch_tag  | TEXT      | Batch identifier               |

### `export_logs`
| Column      | Type      | Notes                          |
|-------------|-----------|--------------------------------|
| id          | INTEGER   | Primary key                    |
| profile     | TEXT      | Profile exported               |
| filename    | TEXT      | Export filename                |
| exported_by | TEXT      | Operator/admin who exported    |
| timestamp   | DATETIME  | Default `CURRENT_TIMESTAMP`    |

### Other Tables Present
- `active_users` – Tracks currently logged-in vouchers  
- `audit_logs` – System audit trail  
- `delivery_logs` – SMS/email delivery tracking  
- `download_logs` – Voucher download tracking  
- `operators` – Legacy operator table  
- `payments` – Payment transactions (to be built)  
- `tunnel` – Cloudflare tunnel metadata  

---

## 📌 Features

### ✅ Working
- Voucher login (`/login`)  
- Admin/operator login (`/admin-login`)  
- Admin dashboard (`/admin`)  
- Operator dashboard (`/operator`) with create, activate, deactivate, delete  
- Voucher lifecycle (create, block, activate, delete)  
- Analytics dashboard (`/analytics`) with charts  
- Logs dashboard (`/admin/logs`) with CSV/JSON export  
- CSRF protection across all forms  
- Localization (basic English/French JSON files)  

### 🚧 Pending
- Payment integration (voucher purchase flow)  
- Cloudflare tunnel enforcement  
- Rate limiting / brute-force defense  
- Full audit trail linking operator actions to `export_logs`  
- Extended role-based dashboards (finance, support)  
- Onboarding documentation auto-export  
- SMS/Telegram/WhatsApp bot integration  

---

## 📌 Development Workflow

- **Schema verification**:  
  ```sql
  .tables
  PRAGMA table_info(users);
  PRAGMA table_info(vouchers);
  PRAGMA table_info(export_logs);
