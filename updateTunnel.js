// -----------------------------------------------------------------------------
// File: updateTunnel.js
// Purpose: Detect new Cloudflare Quick Tunnel URL, update .env, verify API User
// -----------------------------------------------------------------------------

const dotenv = require('dotenv');
dotenv.config({ quiet: true });

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // ensure you install: npm install node-fetch@2

const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;
const apiUserId = process.env.MOMO_API_USER;

if (!subscriptionKey || !apiUserId) {
  console.error("❌ Missing MOMO_SUBSCRIPTION_KEY or MOMO_API_USER in .env");
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env');

// Function to update .env file
function updateEnv(tunnelUrl) {
  let envContent = fs.readFileSync(envPath, 'utf8').split('\n');
  let found = false;

  envContent = envContent.map(line => {
    if (line.startsWith('MOMO_CALLBACK_HOST=')) {
      found = true;
      return `MOMO_CALLBACK_HOST=${tunnelUrl}`;
    }
    return line;
  });

  if (!found) {
    envContent.push(`MOMO_CALLBACK_HOST=${tunnelUrl}`);
  }

  fs.writeFileSync(envPath, envContent.join('\n'));
  console.log("✅ .env updated with new MOMO_CALLBACK_HOST:", tunnelUrl);
}

// Function to verify API User
async function verifyUser() {
  try {
    const response = await fetch(`https://sandbox.momodeveloper.mtn.com/v1_0/apiuser/${apiUserId}`, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey
      }
    });

    if (!response.ok) {
      console.error("❌ Failed to verify API User:", await response.text());
    } else {
      const data = await response.json();
      console.log("✅ API User verification result:", data);
    }
  } catch (err) {
    console.error("❌ Error during API User verification:", err);
  }
}

// Step 1: Start cloudflared tunnel
const cloudflared = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000']);

// Listen to both stdout and stderr
function handleOutput(data) {
  const output = data.toString();
  const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    const tunnelUrl = match[0];
    console.log("✅ Tunnel URL detected:", tunnelUrl);

    updateEnv(tunnelUrl);
    verifyUser();

    cloudflared.kill();
  }
}

cloudflared.stdout.on('data', handleOutput);
cloudflared.stderr.on('data', handleOutput);

