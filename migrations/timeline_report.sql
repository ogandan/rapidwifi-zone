WITH summary AS (
    SELECT 
        voucher_id,
        SUM(CASE WHEN action='voucher_created' THEN 1 ELSE 0 END) AS created_count,
        SUM(CASE WHEN action='voucher_status_change' THEN 1 ELSE 0 END) AS status_change_count,
        SUM(CASE WHEN action='voucher_expired' THEN 1 ELSE 0 END) AS expired_count,
        SUM(CASE WHEN action='payment_failed' THEN 1 ELSE 0 END) AS payment_failed_count,
        COUNT(*) AS total_events
    FROM audit_logs
    WHERE action IN ('voucher_created','voucher_status_change','voucher_expired','payment_failed')
    GROUP BY voucher_id
),
grand_total AS (
    SELECT SUM(total_events) AS grand_total FROM summary
)
SELECT 
    s.voucher_id,
    s.created_count,
    s.status_change_count,
    s.expired_count,
    s.payment_failed_count,
    s.total_events,
    ROUND((s.total_events * 100.0 / g.grand_total), 2) || '%' AS pct_of_total
FROM summary s, grand_total g

UNION ALL

SELECT 
    'ALL' AS voucher_id,
    SUM(created_count),
    SUM(status_change_count),
    SUM(expired_count),
    SUM(payment_failed_count),
    SUM(total_events),
    '100%' AS pct_of_total
FROM summary
ORDER BY voucher_id;

