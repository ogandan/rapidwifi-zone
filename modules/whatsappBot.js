// modules/whatsappBot.js
require('dotenv').config();

const ENABLE_WHATSAPP = process.env.ENABLE_WHATSAPP === 'true';

async function handleWhatsAppMessage(userId, messageText) {
  if (!ENABLE_WHATSAPP) {
    console.log(`[WhatsApp] Disabled. Skipping message from ${userId}`);
    return;
  }

  try {
    // Stub: integrate with WhatsApp Cloud API later
    console.log(`[WhatsApp] Received from ${userId}: ${messageText}`);
    // TODO: implement voucher lookup and reply
    return { success: true, user: userId, reply: "Voucher stub reply" };
  } catch (err) {
    console.error(`[WhatsApp] Error handling message from ${userId}:`, err);
    return { success: false, error: err };
  }
}

module.exports = { handleWhatsAppMessage };

