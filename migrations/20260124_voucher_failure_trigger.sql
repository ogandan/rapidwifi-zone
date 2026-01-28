BEGIN TRANSACTION;

-- Payment failure → Voucher inactive + audit log
CREATE TRIGGER payment_failed_voucher_inactive
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN NEW.status = 'failed'
BEGIN
    -- Move linked voucher back to inactive
    UPDATE vouchers
    SET status = 'inactive'
    WHERE id = NEW.voucher_id;

    -- Log the failure
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES ('voucher_failed',
            'Voucher ' || NEW.voucher_id || ' marked inactive due to failed payment',
            CURRENT_TIMESTAMP);
END;

COMMIT;

