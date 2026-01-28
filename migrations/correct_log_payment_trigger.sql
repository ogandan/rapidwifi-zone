DROP TRIGGER IF EXISTS log_payment_failed;

CREATE TRIGGER log_payment_failed
AFTER UPDATE OF status ON payments
FOR EACH ROW
WHEN NEW.status = 'failed'
BEGIN
    INSERT INTO audit_logs(action, username, profile, details, channel, status)
    VALUES (
        'payment_failed',                        -- action
        CAST(NEW.user_id AS TEXT),               -- username: numeric user_id stored as text
        NEW.method,                              -- profile: payment method (mobile_money, cash, card)
        'Payment ' || NEW.id || ' for voucher ' || NEW.voucher_id || ' failed',
        'system',                                -- channel
        'error'                                  -- status
    );
END;

