#!/bin/bash
# Cloudflared Quick Tunnel starter + watchdog with retry/backoff and log rotation

LOGFILE="/home/chairman/rapidwifi-zone/data/tunnel.log"
URLFILE="/home/chairman/rapidwifi-zone/data/tunnel_url.txt"
SERVICE_CMD="cloudflared tunnel --url http://localhost:3000 --no-tls-verify"

# Kill any existing cloudflared processes
pkill -f "cloudflared tunnel" 2>/dev/null

# Start tunnel in background
nohup $SERVICE_CMD 2>&1 | tee -a $LOGFILE &
sleep 10

# Rotate log: keep only last 500 lines
tail -n 500 $LOGFILE > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" $LOGFILE

# Retry loop to capture valid tunnel URL
MAX_RETRIES=10
RETRY_DELAY=15
TUNNEL_URL=""

for i in $(seq 1 $MAX_RETRIES); do
    TUNNEL_URL=$(grep -Eo "https://[A-Za-z0-9.-]+\.trycloudflare\.com" $LOGFILE | grep -v "api.trycloudflare.com" | tail -n1)
    if [ -n "$TUNNEL_URL" ]; then
        echo "$TUNNEL_URL" > $URLFILE
        echo "$(date) - Tunnel started at $TUNNEL_URL" | tee -a $LOGFILE
        break
    else
        echo "$(date) - Attempt $i/$MAX_RETRIES: no tunnel URL yet, waiting $RETRY_DELAY seconds..." | tee -a $LOGFILE
        sleep $RETRY_DELAY
    fi
done

if [ -z "$TUNNEL_URL" ]; then
    echo "$(date) - Failed to obtain tunnel URL after $MAX_RETRIES attempts" | tee -a $LOGFILE
    exit 1
fi

# Ping the tunnel URL
if ! curl -s --max-time 10 "$TUNNEL_URL" > /dev/null; then
    echo "$(date) - Tunnel unreachable ($TUNNEL_URL), will retry later" | tee -a $LOGFILE
    # Do not restart immediately — let systemd handle persistence
else
    echo "$(date) - Tunnel healthy at $TUNNEL_URL" | tee -a $LOGFILE
fi

