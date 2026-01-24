# RAPIDWIFI-ZONE
# 📖 Changelog

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
