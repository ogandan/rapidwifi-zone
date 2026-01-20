// modules/voucherManager.js - Voucher lifecycle + analytics + audit logging + payments + delivery
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/db.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper: run query with Promise
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --------------------
// Voucher Lifecycle
// --------------------
async function validateVoucher(username) { /* ...existing code... */ }
async function createVoucher(profile = 'default') { /* ...existing code... */ }
async function listVouchers(limit = 50) { /* ...existing code... */ }
async function disableVoucher(username) { /* ...existing code... */ }

// --------------------
// Analytics Functions
// --------------------
async function voucherCreationLast7Days() { /* ...existing code... */ }
async function voucherCreationTrends() { /* ...existing code... */ }
async function countExportsOverTime() { /* ...existing code... */ }
async function getFilteredLogs(query) { /* ...existing code... */ }

// --------------------
// Payment Handling
// --------------------

// Initiate payment with MTN MoMo
async function initiateMTNPayment(user, amount) {
  // TODO: integrate MTN MoMo API
  console.log(`Initiating MTN MoMo payment for ${user}, amount: ${amount}`);
  // Insert into payments table (pending)
  await runQuery(
    'INSERT INTO payments (user, provider, amount, status, timestamp) VALUES (?, "MTN", ?, "pending", datetime("now"))',
    [user, amount]
  );
  return { provider: "MTN", status: "pending" };
}

// Initiate payment with Moov Money
async function initiateMoovPayment(user, amount) {
  // TODO: integrate Moov Money API
  console.log(`Initiating Moov Money payment for ${user}, amount: ${amount}`);
  await runQuery(
    'INSERT INTO payments (user, provider, amount, status, timestamp) VALUES (?, "Moov", ?, "pending", datetime("now"))',
    [user, amount]
  );
  return { provider: "Moov", status: "pending" };
}

// Record cash payment
async function recordCashPayment(operator, user, amount, profile) {
  console.log(`Recording cash payment by ${operator} for ${user}, amount: ${amount}`);
  await runQuery(
    'INSERT INTO payments (user, provider, amount, status, operator, timestamp) VALUES (?, "Cash", ?, "success", ?, datetime("now"))',
    [user, amount, operator]
  );
  // Create voucher immediately
  return await createVoucher(profile);
}

// Confirm payment (generic)
async function confirmPayment(transactionId) {
  // TODO: query provider API for transaction status
  console.log(`Confirming payment transaction: ${transactionId}`);
  // Update DB record
  await runQuery(
    'UPDATE payments SET status = "success" WHERE id = ?',
    [transactionId]
  );
  return { transactionId, status: "success" };
}

// --------------------
// Voucher Delivery
// --------------------

// Deliver voucher via SMS
async function deliverVoucherSMS(voucher, phoneNumber) {
  // TODO: integrate SMS gateway or GSM modem
  console.log(`Delivering voucher ${voucher.username} via SMS to ${phoneNumber}`);
  await runQuery(
    'INSERT INTO delivery_logs (voucher_id, channel, recipient, status, timestamp) VALUES (?, "SMS", ?, "sent", datetime("now"))',
    [voucher.username, phoneNumber]
  );
  return { channel: "SMS", status: "sent" };
}

// Deliver voucher via WhatsApp
async function deliverVoucherWhatsApp(voucher, phoneNumber) {
  // TODO: integrate WhatsApp Business API or whatsapp-web.js
  console.log(`Delivering voucher ${voucher.username} via WhatsApp to ${phoneNumber}`);
  await runQuery(
    'INSERT INTO delivery_logs (voucher_id, channel, recipient, status, timestamp) VALUES (?, "WhatsApp", ?, "sent", datetime("now"))',
    [voucher.username, phoneNumber]
  );
  return { channel: "WhatsApp", status: "sent" };
}

// Deliver voucher via Telegram
async function deliverVoucherTelegram(voucher, chatId) {
  // TODO: integrate Telegram Bot API
  console.log(`Delivering voucher ${voucher.username} via Telegram to chat ${chatId}`);
  await runQuery(
    'INSERT INTO delivery_logs (voucher_id, channel, recipient, status, timestamp) VALUES (?, "Telegram", ?, "sent", datetime("now"))',
    [voucher.username, chatId]
  );
  return { channel: "Telegram", status: "sent" };
}

// --------------------
// Exports
// --------------------
module.exports = {
  // Lifecycle
  validateVoucher,
  createVoucher,
  listVouchers,
  disableVoucher,

  // Analytics
  voucherCreationLast7Days,
  voucherCreationTrends,
  countExportsOverTime,
  getFilteredLogs,

  // Payments
  initiateMTNPayment,
  initiateMoovPayment,
  recordCashPayment,
  confirmPayment,

  // Delivery
  deliverVoucherSMS,
  deliverVoucherWhatsApp,
  deliverVoucherTelegram
};

