BEGIN TRANSACTION;

-- Log all voucher status changes
CREATE TRIGGER log_voucher_status_change
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES (
        'voucher_status_change',
        'Voucher ' || OLD.username || ' changed from ' || OLD.status || ' to ' || NEW.status,
        CURRENT_TIMESTAMP
    );
END;

-- Log payment failures
CREATE TRIGGER log_payment_failure
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN NEW.status = 'failed'
BEGIN
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES (
        'payment_failed',
        'Payment ' || NEW.id || ' for voucher ' || NEW.voucher_id || ' failed',
        CURRENT_TIMESTAMP
    );
END;

COMMIT;

