BEGIN TRANSACTION;

-- Pending → Sold (requires completed payment, logs audit)
CREATE TRIGGER IF NOT EXISTS voucher_pending_to_sold
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'pending' AND NEW.status = 'sold'
BEGIN
    -- Abort if no completed payment exists
    SELECT RAISE(ABORT, 'Cannot mark voucher as sold without completed payment')
    WHERE NOT EXISTS (
        SELECT 1 FROM payments
        WHERE voucher_id = OLD.id AND status = 'completed'
    );

    -- Log successful sale
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES ('voucher_sold',
            'Voucher ' || OLD.username || ' moved from pending to sold',
            CURRENT_TIMESTAMP);
END;

-- Reserved → Sold (requires completed cash payment, logs audit)
CREATE TRIGGER IF NOT EXISTS voucher_reserved_to_sold
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'reserved' AND NEW.status = 'sold'
BEGIN
    -- Abort if no completed cash payment exists
    SELECT RAISE(ABORT, 'Cannot mark reserved voucher as sold without cash payment')
    WHERE NOT EXISTS (
        SELECT 1 FROM payments
        WHERE voucher_id = OLD.id AND method = 'cash' AND status = 'completed'
    );

    -- Log successful sale
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES ('voucher_sold',
            'Voucher ' || OLD.username || ' moved from reserved to sold',
            CURRENT_TIMESTAMP);
END;

COMMIT;

