BEGIN TRANSACTION;

-- 1. Ensure payments table has normalized schema
-- (Adjust types if needed for your environment)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','success','failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(voucher_id) REFERENCES vouchers(id)
);

-- 2. Drop old triggers
DROP TRIGGER IF EXISTS log_payment_failed;
DROP TRIGGER IF EXISTS log_payment_success;

-- 3. Recreate updated triggers

-- Payment Failed
CREATE TRIGGER log_payment_failed
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN NEW.status = 'failed'
BEGIN
    INSERT INTO audit_logs(
        action,
        username,
        profile,
        details,
        channel,
        status,
        voucher_id
    )
    VALUES (
        'payment_failed',
        (SELECT batch_tag FROM vouchers WHERE id = NEW.voucher_id),
        (SELECT profile FROM vouchers WHERE id = NEW.voucher_id),
        'Payment ' || NEW.id || ' for voucher ' || NEW.voucher_id ||
        ' failed via ' || NEW.method || ' amount=' || NEW.amount ||
        ' (batch_tag=' || (SELECT batch_tag FROM vouchers WHERE id = NEW.voucher_id) || ')',
        'system',
        'error',
        NEW.voucher_id
    );
END;

-- Payment Success
CREATE TRIGGER log_payment_success
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN NEW.status = 'success'
BEGIN
    INSERT INTO audit_logs(
        action,
        username,
        profile,
        details,
        channel,
        status,
        voucher_id
    )
    VALUES (
        'payment_success',
        (SELECT batch_tag FROM vouchers WHERE id = NEW.voucher_id),
        (SELECT profile FROM vouchers WHERE id = NEW.voucher_id),
        'Payment ' || NEW.id || ' for voucher ' || NEW.voucher_id ||
        ' succeeded via ' || NEW.method || ' amount=' || NEW.amount ||
        ' (batch_tag=' || (SELECT batch_tag FROM vouchers WHERE id = NEW.voucher_id) || ')',
        'system',
        'success',
        NEW.voucher_id
    );
END;

-- 4. Smoke test inserts

-- Create a test voucher
INSERT INTO vouchers(username, password, profile, batch_tag)
VALUES('PAYTEST01','', 'default', 'batch-PAYTEST-001');

-- Insert payment records
INSERT INTO payments(voucher_id, method, amount, status)
VALUES((SELECT id FROM vouchers WHERE username='PAYTEST01'), 'mobile_money', 500, 'pending');

-- Simulate payment success
UPDATE payments
SET status='success'
WHERE voucher_id = (SELECT id FROM vouchers WHERE username='PAYTEST01');

-- Simulate payment failure
INSERT INTO payments(voucher_id, method, amount, status)
VALUES((SELECT id FROM vouchers WHERE username='PAYTEST01'), 'cash', 300, 'failed');

-- 5. Verification queries

-- Show last few audit logs
SELECT voucher_id, action, username, profile, details
FROM audit_logs
ORDER BY id DESC LIMIT 10;

-- Count how many audit logs have voucher_id populated
SELECT COUNT(*) AS populated_voucher_id
FROM audit_logs
WHERE voucher_id IS NOT NULL;

COMMIT;

