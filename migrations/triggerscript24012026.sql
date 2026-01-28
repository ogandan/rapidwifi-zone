BEGIN TRANSACTION;

-- Log voucher creation
CREATE TRIGGER log_voucher_created
AFTER INSERT ON vouchers
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'voucher_created',
        NEW.username,
        NEW.profile,
        'Voucher created',
        'system',
        'success'
    );
END;

-- Log voucher status changes
CREATE TRIGGER log_voucher_status_change
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'voucher_status_change',
        OLD.username,
        OLD.profile,
        'Voucher ' || OLD.username || ' changed from ' || OLD.status || ' to ' || NEW.status,
        'system',
        'success'
    );
END;

-- Log voucher expiration
CREATE TRIGGER log_voucher_expired
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN NEW.status = 'expired'
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'voucher_expired',
        OLD.username,
        OLD.profile,
        'Voucher ' || OLD.username || ' expired',
        'system',
        'success'
    );
END;

-- Log payment failures
CREATE TRIGGER log_payment_failed
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN NEW.status = 'failed'
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'payment_failed',
        NEW.user,          -- from payments table
        NEW.provider,      -- use provider as profile context
        'Payment ' || NEW.id || ' for voucher ' || NEW.voucher_id || ' failed',
        'system',
        'error'
    );
END;

COMMIT;

