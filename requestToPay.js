// -----------------------------------------------------------------------------
// File: requestToPay.js
// Purpose: Trigger a MoMo sandbox requesttopay and log the response
// -----------------------------------------------------------------------------

const dotenv = require('dotenv');
dotenv.config({ quiet: true });

const fetch = require('node-fetch'); // install with: npm install node-fetch@2
const { v4: uuidv4 } = require('uuid'); // install with: npm install uuid

// Load required env values
const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;
const apiUserId = process.env.MOMO_API_USER;
const apiKey = process.env.GATEWAY_SECRET;
const callbackHost = process.env.MOMO_CALLBACK_HOST;

if (!subscriptionKey || !apiUserId || !apiKey) {
  console.error("❌ Missing MOMO_SUBSCRIPTION_KEY, MOMO_API_USER, or GATEWAY_SECRET in .env");
  process.exit(1);
}

// Step 1: Get an access token
async function getAccessToken() {
  const response = await fetch("https://sandbox.momodeveloper.mtn.com/collection/token/", {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Authorization": "Basic " + Buffer.from(apiUserId + ":" + apiKey).toString("base64")
    }
  });

  if (!response.ok) {
    throw new Error("Failed to get access token: " + await response.text());
  }

  const data = await response.json();
  return data.access_token;
}

// Step 2: Trigger requesttopay
async function requestToPay(accessToken) {
  const referenceId = uuidv4(); // unique transaction ID

  const body = {
    amount: "1000",
    currency: "EUR",
    externalId: "12345",
    payer: {
      partyIdType: "MSISDN",
      partyId: "46733123450" // sandbox test number
    },
    payerMessage: "Test payment",
    payeeNote: "Sandbox demo"
  };

  const response = await fetch("https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": "sandbox",
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("❌ RequestToPay failed: " + await response.text());
  }

  console.log("✅ RequestToPay initiated. Reference ID:", referenceId);

  return referenceId;
}

// Step 3: Check transaction status
async function checkStatus(accessToken, referenceId) {
  const response = await fetch(`https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/${referenceId}`, {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "X-Target-Environment": "sandbox",
      "Ocp-Apim-Subscription-Key": subscriptionKey
    }
  });

  if (!response.ok) {
    throw new Error("❌ Status check failed: " + await response.text());
  }

  const data = await response.json();
  console.log("📊 Transaction status:", data);
}

// Main flow
(async () => {
  try {
    const token = await getAccessToken();
    const refId = await requestToPay(token);

    // Wait a few seconds before checking status
    setTimeout(async () => {
      await checkStatus(token, refId);
    }, 5000);
  } catch (err) {
    console.error(err);
  }
})();

