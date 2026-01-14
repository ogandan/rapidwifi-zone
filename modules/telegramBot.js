// modules/telegramBot.js
require('dotenv').config();

const ENABLE_TELEGRAM = process.env.ENABLE_TELEGRAM === 'true';

async function handleTelegramCommand(userId, command) {
  if (!ENABLE_TELEGRAM) {
    console.log(`[Telegram] Disabled. Skipping command from ${userId}`);
    return;
  }

  try {
    // Stub: integrate with Telegram Bot API later
    console.log(`[Telegram] Command from ${userId}: ${command}`);
    // TODO: implement voucher lookup and reply
    return { success: true, user: userId, reply: "Voucher stub reply" };
  } catch (err) {
    console.error(`[Telegram] Error handling command from ${userId}:`, err);
    return { success: false, error: err };
  }
}

module.exports = { handleTelegramCommand };

