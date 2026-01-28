// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 17:15 WAT
// File: smokeTest.js
// Purpose: Programmatic smoke test harness for RAPIDWIFI-ZONE
// -----------------------------------------------------------------------------

const db = require('./data/db.js');
const bcrypt = require('bcrypt');

async function runSmokeTests() {
  console.log("=== RAPIDWIFI-ZONE Smoke Test Harness ===");

  try {
    // 1. Users table check
    const users = await db.runQuery("SELECT username, role FROM users");
    console.log("Users:", users);

    // 2. Voucher counts
    const total = await db.countAllVouchers();
    const active = await db.countActiveVouchers();
    const inactive = await db.countInactiveVouchers();
    console.log(`Vouchers: total=${total}, active=${active}, inactive=${inactive}`);

    // 3. Profiles
    const profiles = await db.countProfiles();
    console.log("Profiles:", profiles);

    // 4. Export logs
    try {
      const exports = await db.countExportsByProfile();
      console.log("Export logs:", exports);
    } catch (err) {
      console.error("Export logs check failed:", err.message);
    }

    // 5. Tunnel URL
    try {
      const tunnelUrl = await db.getTunnelUrl();
      console.log("Tunnel URL:", tunnelUrl);
    } catch (err) {
      console.error("Tunnel check failed:", err.message);
    }

    // 6. Download logs
    const logs = await db.getDownloadLogs();
    console.log("Download logs:", logs.slice(0, 3)); // show last 3

    console.log("=== Smoke Test Harness Completed ===");
  } catch (err) {
    console.error("Smoke test error:", err);
  }
}

runSmokeTests();

