#!/bin/bash
# Run cloudflared quick tunnel and capture URL

LOGFILE="/home/chairman/rapidwifi-zone/data/tunnel.log"
URLFILE="/home/chairman/rapidwifi-zone/data/tunnel_url.txt"

# Start tunnel in background and capture output
cloudflared tunnel --url https://localhost:443 --no-tls-verify 2>&1 | tee $LOGFILE | \
grep -m1 -o "https://[a-z0-9.-]*\.trycloudflare\.com" > $URLFILE

