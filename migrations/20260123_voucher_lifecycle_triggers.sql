-- -----------------------------------------------------------------------------
-- Migration: Voucher lifecycle triggers (fixed)
-- -----------------------------------------------------------------------------

BEGIN TRANSACTION;

-- Enforce valid status values
CREATE TRIGGER IF NOT EXISTS enforce_voucher_status_insert
BEFORE INSERT ON vouchers
FOR EACH ROW
BEGIN
    SELECT
    CASE
        WHEN NEW.status NOT IN ('active','inactive','pending','reserved','sold','expired')
        THEN RAISE(ABORT, 'Invalid voucher status')
    END;
END;

CREATE TRIGGER IF NOT EXISTS enforce_voucher_status_update
BEFORE UPDATE OF status ON vouchers
FOR EACH ROW
BEGIN
    SELECT
    CASE
        WHEN NEW.status NOT IN ('active','inactive','pending','reserved','sold','expired')
        THEN RAISE(ABORT, 'Invalid voucher status')
    END;
END;

-- Transition: pending → sold (requires completed payment)
CREATE TRIGGER IF NOT EXISTS voucher_pending_to_sold
BEFORE UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'pending' AND NEW.status = 'sold'
BEGIN
    SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM payments
            WHERE voucher_id = OLD.id AND status = 'completed'
        )
        THEN RAISE(ABORT, 'Cannot mark voucher as sold without completed payment')
    END;
END;

-- Transition: reserved → sold (requires completed cash payment)
CREATE TRIGGER IF NOT EXISTS voucher_reserved_to_sold
BEFORE UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'reserved' AND NEW.status = 'sold'
BEGIN
    SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM payments
            WHERE voucher_id = OLD.id AND method = 'cash' AND status = 'completed'
        )
        THEN RAISE(ABORT, 'Cannot mark reserved voucher as sold without cash payment')
    END;
END;

-- Transition: sold → expired (allowed, also log to audit_logs)
CREATE TRIGGER IF NOT EXISTS voucher_sold_to_expired
AFTER UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'sold' AND NEW.status = 'expired'
BEGIN
    INSERT INTO audit_logs(action, details, timestamp)
    VALUES ('voucher_expired',
            'Voucher ' || OLD.username || ' moved from sold to expired',
            CURRENT_TIMESTAMP);
END;

COMMIT;

