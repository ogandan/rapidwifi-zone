#!/bin/bash
set -e

BASE_URL="http://localhost:3000"
COOKIE_JAR="cookies.txt"

# Use your .env values directly
EMAIL="admin"     # replace with your admin email
PASS="xSeries325!!!$"       # replace with your admin password



echo "=== Resetting cookie jar ==="
rm -f "$COOKIE_JAR"

# Step 1: Fetch login page
echo "=== Step 1: Fetch login page ==="
LOGIN_CSRF=$(curl -s -c "$COOKIE_JAR" "$BASE_URL/login" | grep -oP 'name="_csrf" value="\K[^"]+')
echo "Login CSRF: $LOGIN_CSRF"

# Step 2: Perform login
echo "=== Step 2: Perform login ==="
curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "$BASE_URL/authv2/login" \
  --data "email=$EMAIL&password=$PASS&_csrf=$LOGIN_CSRF"

echo "---- Cookies after login ----"
cat "$COOKIE_JAR"

grep -q "connect.sid" "$COOKIE_JAR" || { echo "❌ No session cookie found (login failed)"; exit 1; }

# Step 3: Fetch admin dashboard (JSON health endpoint)
echo "=== Step 3: Fetch admin dashboard ==="
DASHBOARD=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/admin/dashboard")
echo "$DASHBOARD"
echo "$DASHBOARD" | grep -q '"ok":true' || { echo "❌ Dashboard fetch failed"; exit 1; }

# Step 4: Fetch admin CSRF token
echo "=== Step 4: Fetch admin CSRF token ==="
ADMIN_CSRF=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/admin/csrf-token" | grep -oP '"csrfToken":"\K[^"]+')
echo "Admin CSRF: $ADMIN_CSRF"

# Step 5: Block batch
echo "=== Step 5: Block batch ==="
BLOCK=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/admin/batch/block" \
  -H "Content-Type: application/json" \
  -d "{\"usernames\":[\"testuser\"],\"_csrf\":\"$ADMIN_CSRF\"}")
echo "$BLOCK" | grep -q '"success":true' || { echo "❌ Block batch failed"; exit 1; }

# Step 6: Delete batch
echo "=== Step 6: Delete batch ==="
DELETE=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/admin/batch/delete" \
  -H "Content-Type: application/json" \
  -d "{\"usernames\":[\"testuser\"],\"_csrf\":\"$ADMIN_CSRF\"}")
echo "$DELETE" | grep -q '"success":true' || { echo "❌ Delete batch failed"; exit 1; }

# Step 7: Create voucher
echo "=== Step 7: Create voucher ==="
VOUCHER=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/admin/create-voucher" \
  -H "Content-Type: application/json" \
  -d "{\"profile\":\"default\",\"count\":1,\"_csrf\":\"$ADMIN_CSRF\"}")
echo "$VOUCHER" | grep -q '"success":true' || { echo "❌ Voucher creation failed"; exit 1; }

# Step 8: Audit logs (only if you have this route)
echo "=== Step 8: Audit logs ==="
AUDIT=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/admin/audit-logs" || true)
echo "$AUDIT" | grep -q '"ok":true' || echo "⚠️ Audit logs route not implemented"

# Step 9: Dashboard stats (your /status route)
echo "=== Step 9: Dashboard stats ==="
STATS=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/admin/status")
echo "$STATS" | grep -q 'system_uptime' || { echo "❌ Dashboard stats fetch failed"; exit 1; }

# Step 10: Logout
echo "=== Step 10: Logout ==="
LOGOUT=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/authv2/logout" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "_csrf=$ADMIN_CSRF")
echo "$LOGOUT" | grep -q '"ok":true' || { echo "❌ Logout failed"; exit 1; }

echo "✅ All admin stack checks passed"

