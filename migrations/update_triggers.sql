BEGIN TRANSACTION;

-- 1. Drop old triggers
DROP TRIGGER IF EXISTS log_voucher_created;
DROP TRIGGER IF EXISTS log_voucher_status_change;
DROP TRIGGER IF EXISTS log_voucher_expired;
DROP TRIGGER IF EXISTS log_payment_failed;

-- 2. Recreate updated triggers

-- Voucher Creation
CREATE TRIGGER log_voucher_created
AFTER INSERT ON vouchers
FOR EACH ROW
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
        'voucher_created',
        NEW.batch_tag,
        NEW.profile,
        'Voucher ID ' || NEW.id || ' created with profile ' || NEW.profile ||
        ' (batch_tag=' || NEW.batch_tag || ')',
        'system',
        'success',
        NEW.id
    );
END;

-- Voucher Status Change
CREATE TRIGGER log_voucher_status_change
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status <> NEW.status
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
        'voucher_status_change',
        NEW.batch_tag,
        NEW.profile,
        'Voucher ID ' || NEW.id || ' changed from ' || OLD.status || ' to ' || NEW.status ||
        ' (batch_tag=' || NEW.batch_tag || ')',
        'system',
        'success',
        NEW.id
    );
END;

-- Voucher Expired
CREATE TRIGGER log_voucher_expired
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN NEW.status = 'expired'
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
        'voucher_expired',
        NEW.batch_tag,
        NEW.profile,
        'Voucher ID ' || NEW.id || ' expired (batch_tag=' || NEW.batch_tag || ')',
        'system',
        'success',
        NEW.id
    );
END;

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
        NEW.method,
        'Payment ' || NEW.id || ' for voucher ' || NEW.voucher_id || ' failed ' ||
        '(batch_tag=' || (SELECT batch_tag FROM vouchers WHERE id = NEW.voucher_id) || ')',
        'system',
        'error',
        NEW.voucher_id
    );
END;

-- 3. Smoke test inserts/updates

-- Create a test voucher
INSERT INTO vouchers(username, password, profile, batch_tag)
VALUES('TESTCODE','', 'default', 'batch-TEST-001');

-- Change status
UPDATE vouchers SET status='sold' WHERE username='TESTCODE';
UPDATE vouchers SET status='expired' WHERE username='TESTCODE';

-- Simulate payment failure
INSERT INTO payments(id, voucher_id, method, status)
VALUES(999, (SELECT id FROM vouchers WHERE username='TESTCODE'), 'mobile_money', 'failed');

-- 4. Verification queries

-- Show last few audit logs
SELECT voucher_id, action, username, profile, details
FROM audit_logs
ORDER BY id DESC LIMIT 10;

-- Count how many audit logs have voucher_id populated
SELECT COUNT(*) AS populated_voucher_id
FROM audit_logs
WHERE voucher_id IS NOT NULL;

COMMIT;

