-- Insert a sample Cloudflare tunnel URL
INSERT INTO tunnel (url)
VALUES ('https://rapidwifi-zone.trycloudflare.com');

-- Insert another tunnel record for testing multiple entries
INSERT INTO tunnel (url)
VALUES ('https://backup-rapidwifi-zone.trycloudflare.com');
-- Insert sample export logs for different profiles
INSERT INTO export_logs (profile, filename, exported_by)
VALUES ('default', 'vouchers_default.csv', 'admin');

INSERT INTO export_logs (profile, filename, exported_by)
VALUES ('premium', 'vouchers_premium.csv', 'admin');

INSERT INTO export_logs (profile, filename, exported_by)
VALUES ('basic', 'vouchers_basic.csv', 'admin');

-- Insert another log to simulate operator activity
INSERT INTO export_logs (profile, filename, exported_by)
VALUES ('24h-1000FCFA', 'vouchers_24h.csv', 'operator');

