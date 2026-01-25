# RAPIDWIFI-ZONE

# 📖 Changelog

## 🏷️ Tags

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
