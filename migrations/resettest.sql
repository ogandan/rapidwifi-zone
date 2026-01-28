BEGIN TRANSACTION;

-- Delete test payments linked to test vouchers
DELETE FROM payments
WHERE voucher_id IN (
    SELECT id FROM vouchers WHERE username LIKE 'TESTUSER%'
);

-- Delete test vouchers
DELETE FROM vouchers
WHERE username LIKE 'TESTUSER%';

-- Delete audit log entries related to test users
DELETE FROM audit_logs
WHERE username LIKE 'TESTUSER%';

COMMIT;

