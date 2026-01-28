WITH voucher_events AS (
    SELECT 
        id AS log_id,
        action,
        username,
        profile,
        details,
        timestamp,
        -- Extract voucher ID: find "Voucher ID " and take the next few characters
        CAST(
            substr(details, instr(details, 'Voucher ID ') + 11, 5)
            AS INTEGER
        ) AS voucher_id
    FROM audit_logs
    WHERE action IN ('voucher_status_change','voucher_expired','payment_failed')
)
SELECT 
    v.voucher_id,
    MAX(CASE WHEN v.action='voucher_status_change' THEN v.details END) AS status_change_details,
    MAX(CASE WHEN v.action='voucher_expired' THEN v.details END) AS expired_details,
    MAX(CASE WHEN v.action='payment_failed' THEN v.details END) AS payment_failed_details,
    MIN(v.timestamp) AS first_event_time,
    MAX(v.timestamp) AS last_event_time
FROM voucher_events v
GROUP BY v.voucher_id
ORDER BY v.voucher_id;

