#!/bin/bash
# Unified Cloudflared Quick Tunnel starter + watchdog with log rotation

LOGFILE="/home/chairman/rapidwifi-zone/data/tunnel.log"
URLFILE="/home/chairman/rapidwifi-zone/data/tunnel_url.txt"
SERVICE_CMD="cloudflared tunnel --url http://localhost:3000 --no-tls-verify"

# Kill any existing cloudflared processes
pkill -f "cloudflared tunnel" 2>/dev/null

# Start tunnel in background
nohup $SERVICE_CMD 2>&1 | tee -a $LOGFILE &
sleep 5

# Rotate log: keep only last 500 lines
tail -n 500 $LOGFILE > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" $LOGFILE

# Extract latest valid tunnel URL and save
TUNNEL_URL=$(grep -o "https://[a-z0-9.-]*\.trycloudflare\.com" $LOGFILE | grep -v "api.trycloudflare.com" | tail -n1)

if [ -n "$TUNNEL_URL" ]; then
    echo "$TUNNEL_URL" > $URLFILE
    echo "$(date) - Tunnel started at $TUNNEL_URL" | tee -a $LOGFILE
else
    echo "$(date) - No tunnel URL found, check logs" >> $LOGFILE
    exit 1
fi

# Ping the tunnel URL
if ! curl -s --max-time 10 "$TUNNEL_URL" > /dev/null; then
    echo "$(date) - Tunnel unreachable ($TUNNEL_URL), restarting cloudflared" | tee -a $LOGFILE
    pkill -f "cloudflared tunnel" 2>/dev/null
    nohup $SERVICE_CMD 2>&1 | tee -a $LOGFILE &
    sleep 5
    # Rotate log again
    tail -n 500 $LOGFILE > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" $LOGFILE
    NEW_URL=$(grep -o "https://[a-z0-9.-]*\.trycloudflare\.com" $LOGFILE | grep -v "api.trycloudflare.com" | tail -n1)
    if [ -n "$NEW_URL" ]; then
        echo "$NEW_URL" > $URLFILE
        echo "$(date) - Tunnel restarted at $NEW_URL" | tee -a $LOGFILE
    else
        echo "$(date) - Restart failed, no URL found" >> $LOGFILE
    fi
else
    echo "$(date) - Tunnel healthy at $TUNNEL_URL" | tee -a $LOGFILE
fi

