UPDATE audit_logs SET channel = 'Dashboard' WHERE channel IS NULL;
UPDATE audit_logs SET status = 'success' WHERE status IS NULL;
