-- Migration: Backfill voucher_id in audit_logs from details text
BEGIN TRANSACTION;

-- Case 1: Details contain "Voucher ID <number>"
UPDATE audit_logs
SET voucher_id = CAST(
    substr(details, instr(details, 'Voucher ID ') + 11, 5) AS INTEGER
)
WHERE voucher_id IS NULL
  AND details LIKE '%Voucher ID %';

-- Verification for Case 1
SELECT COUNT(*) AS updated_voucher_id_rows
FROM audit_logs
WHERE details LIKE '%Voucher ID %'
  AND voucher_id IS NOT NULL;

-- Case 2: Payment failures logged as "Payment X for voucher <number> failed"
UPDATE audit_logs
SET voucher_id = CAST(
    substr(details, instr(details, 'voucher ') + 8, 5) AS INTEGER
)
WHERE voucher_id IS NULL
  AND details LIKE '%voucher % failed%';

-- Verification for Case 2
SELECT COUNT(*) AS updated_payment_failed_rows
FROM audit_logs
WHERE details LIKE '%voucher % failed%'
  AND voucher_id IS NOT NULL;

-- Optional Case 3: Expired logs without "Voucher ID" but with "Voucher <username>"
-- Requires mapping usernames to voucher IDs via the vouchers table.

-- Final Summary Check: how many rows still missing voucher_id
SELECT COUNT(*) AS rows_missing_voucher_id
FROM audit_logs
WHERE voucher_id IS NULL;

COMMIT;

