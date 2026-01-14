// modules/smsSender.js
require('dotenv').config();

const ENABLE_SMS = process.env.ENABLE_SMS === 'true';

async function sendSMS(recipientNumber, voucherText) {
  if (!ENABLE_SMS) {
    console.log(`[SMS] Disabled. Skipping send to ${recipientNumber}`);
    return;
  }

  try {
    // Stub: integrate with Twilio, Africa's Talking, or GSM modem later
    console.log(`[SMS] Sending to ${recipientNumber}: ${voucherText}`);
    // TODO: implement actual API call
    return { success: true, recipient: recipientNumber };
  } catch (err) {
    console.error(`[SMS] Error sending to ${recipientNumber}:`, err);
    return { success: false, error: err };
  }
}

module.exports = { sendSMS };

