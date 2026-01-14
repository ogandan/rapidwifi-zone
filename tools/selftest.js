#!/usr/bin/env node
// Self-test script for voucherManager.js
// Runs through core functions and reports PASS/FAIL with summary

const vm = require('../modules/voucherManager');

let total = 0;
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  total++;
  try {
    const result = await fn();
    passed++;
    console.log(`✅ PASS: ${name}`);
    console.log(result);
  } catch (err) {
    failed++;
    console.error(`❌ FAIL: ${name} -> ${err.message}`);
  }
}

(async () => {
  console.log('=== VoucherManager Self-Test ===');

  await runTest('createBatch', async () => {
    return await vm.createBatch(2, 'default', 'selftest');
  });

  await runTest('exportBatch', async () => {
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

  await runTest('blockVoucher', async () => {
    const batch = await vm.exportBatch('selftest');
    if (batch.length === 0) throw new Error('No vouchers in batch');
    await vm.blockVoucher(batch[0].name);
    return `Blocked ${batch[0].name}`;
  });

  await runTest('deleteVoucher', async () => {
    const batch = await vm.exportBatch('selftest');
    if (batch.length === 0) throw new Error('No vouchers in batch');
    await vm.deleteVoucher(batch[0].name);
    return `Deleted ${batch[0].name}`;
  });

  console.log('=== Self-Test Complete ===');
  console.log(`Summary: Total=${total}, Passed=${passed}, Failed=${failed}`);
})();

