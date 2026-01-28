BEGIN TRANSACTION;

-- Log voucher creation
DROP TRIGGER IF EXISTS log_voucher_created;
CREATE TRIGGER log_voucher_created
AFTER INSERT ON vouchers
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'voucher_created',
        NEW.username,
        NEW.profile,
        'Voucher ID ' || NEW.id || ' (' || NEW.username || ') created with profile ' || NEW.profile,
        'system',
        'success'
    );
END;

-- Log voucher status changes
DROP TRIGGER IF EXISTS log_voucher_status_change;
CREATE TRIGGER log_voucher_status_change
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'voucher_status_change',
        OLD.username,
        OLD.profile,
        'Voucher ID ' || OLD.id || ' (' || OLD.username || ') changed from ' || OLD.status || ' to ' || NEW.status,
        'system',
        'success'
    );
END;

-- Log voucher expiration
DROP TRIGGER IF EXISTS log_voucher_expired;
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
        'Voucher ID ' || OLD.id || ' (' || OLD.username || ') expired',
        'system',
        'success'
    );
END;

COMMIT;

