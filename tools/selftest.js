#!/usr/bin/env node
// Self-test script for voucherManager.js
// Runs through core functions and reports PASS/FAIL with summary

const vm = require('../modules/voucherManager');

let total = 0;
let passed = 0;
let failed = 0;
let autoTagBatch = null; // track auto-generated batch for cleanup

async function runTest(name, fn) {
  total++;
  try {
    const result = await fn();
    passed++;
    console.log(`✅ PASS: ${name}`);
    console.log(result);
    return result;
  } catch (err) {
    failed++;
    console.error(`❌ FAIL: ${name} -> ${err.message}`);
    return null;
  }
}

(async () => {
  console.log('=== VoucherManager Self-Test ===');

  // Explicit batch creation
  await runTest('createBatch (explicit tag)', async () => {
    return await vm.createBatch(2, 'default', 'selftest');
  });

  await runTest('exportBatch (explicit tag)', async () => {
    return await vm.exportBatch('selftest');
  });

  await runTest('exportAll', async () => {
    return await vm.exportAll();
  });

  await runTest('exportProfiles', async () => {
    return await vm.exportProfiles();
  });

  await runTest('getStats', async () => {
    return await vm.getStats();
  });

  // Auto-tag batch creation
  await runTest('createBatch (auto-tag)', async () => {
    const created = await vm.createBatch(2, 'default'); // no batch name
    autoTagBatch = created[0].comment; // save for later tests
    if (!autoTagBatch || !autoTagBatch.startsWith('batch-')) {
      throw new Error(`Auto-tag not generated, got: ${autoTagBatch}`);
    }
    return `Auto-generated batch tag: ${autoTagBatch}`;
  });

  // Block voucher directly from createBatch result
  await runTest('blockVoucher (auto-tag)', async () => {
    const created = await vm.createBatch(1, 'default'); // fresh voucher
    autoTagBatch = created[0].comment;
    await vm.blockVoucher(created[0].name);
    return `Blocked ${created[0].name} in batch ${autoTagBatch}`;
  });

  // Delete voucher directly from createBatch result
  await runTest('deleteVoucher (auto-tag)', async () => {
    const created = await vm.createBatch(1, 'default'); // fresh voucher
    autoTagBatch = created[0].comment;
    await vm.deleteVoucher(created[0].name);
    return `Deleted ${created[0].name} in batch ${autoTagBatch}`;
  });

  // Cleanup: revoke the auto-tag batch
  if (autoTagBatch) {
    await runTest('cleanup (revoke auto-tag batch)', async () => {
      return await vm.revokeBatch(autoTagBatch);
    });
  }

  console.log('=== Self-Test Complete ===');
  console.log(`Summary: Total=${total}, Passed=${passed}, Failed=${failed}`);
})();

