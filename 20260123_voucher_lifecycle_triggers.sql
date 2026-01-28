-- -----------------------------------------------------------------------------
-- Migration: Voucher lifecycle triggers
-- Timestamp: 2026-01-23 22:55 WAT
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

-- Transition: pending → sold (only allowed if payment completed)
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

-- Transition: reserved → sold (only allowed if operator cash payment recorded)
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

-- Transition: sold → expired (automatic when validity ends)
-- Note: This trigger enforces manual update, but you can add a cron job or script
-- to update vouchers after their validity period.
CREATE TRIGGER IF NOT EXISTS voucher_sold_to_expired
BEFORE UPDATE OF status ON vouchers
FOR EACH ROW
WHEN OLD.status = 'sold' AND NEW.status = 'expired'
BEGIN
    -- No condition: allowed when admin/system marks voucher expired
    -- Audit logging can be added here if needed
END;

COMMIT;

