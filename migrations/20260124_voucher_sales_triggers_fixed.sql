BEGIN TRANSACTION;

-- Pending → Sold: block if no completed payment
CREATE TRIGGER IF NOT EXISTS block_pending_to_sold
BEFORE UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'pending' AND NEW.status = 'sold'
BEGIN
    SELECT RAISE(ABORT, 'Cannot mark voucher as sold without completed payment')
    WHERE NOT EXISTS (
        SELECT 1 FROM payments
        WHERE voucher_id = OLD.id AND status = 'completed'
    );
END;

-- Pending → Sold: log if successful
CREATE TRIGGER IF NOT EXISTS log_pending_to_sold
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'pending' AND NEW.status = 'sold'
BEGIN
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES ('voucher_sold',
            'Voucher ' || OLD.username || ' moved from pending to sold',
            CURRENT_TIMESTAMP);
END;

-- Reserved → Sold: block if no completed cash payment
CREATE TRIGGER IF NOT EXISTS block_reserved_to_sold
BEFORE UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'reserved' AND NEW.status = 'sold'
BEGIN
    SELECT RAISE(ABORT, 'Cannot mark reserved voucher as sold without cash payment')
    WHERE NOT EXISTS (
        SELECT 1 FROM payments
        WHERE voucher_id = OLD.id AND method = 'cash' AND status = 'completed'
    );
END;

-- Reserved → Sold: log if successful
CREATE TRIGGER IF NOT EXISTS log_reserved_to_sold
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'reserved' AND NEW.status = 'sold'
BEGIN
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES ('voucher_sold',
            'Voucher ' || OLD.username || ' moved from reserved to sold',
            CURRENT_TIMESTAMP);
END;

COMMIT;

