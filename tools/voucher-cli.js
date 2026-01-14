#!/usr/bin/env node
// CLI wrapper for voucherManager.js with pretty-print and file output options
// Default export directory: ../data/cli_exports

const fs = require('fs');
const path = require('path');
const vm = require('../modules/voucherManager');

// Parse args
const [,, cmd, ...args] = process.argv;

// Detect flags
const prettyFlags = args.filter(a => a.startsWith('--'));
const mode = prettyFlags.includes('--json') ? 'json' :
             prettyFlags.includes('--table') ? 'table' : 'raw';

// Default export directory
const EXPORT_DIR = path.join(__dirname, '..', 'data', 'cli_exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

// Extract file path if provided
let filePath = null;
const fileFlagIndex = args.indexOf('--file');
if (fileFlagIndex !== -1) {
  const nextArg = args[fileFlagIndex + 1];
  if (nextArg && !nextArg.startsWith('--')) {
    filePath = nextArg;
  } else {
    // Default filename based on command + timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    filePath = path.join(EXPORT_DIR, `${cmd}-${timestamp}.${mode === 'json' ? 'json' : 'txt'}`);
  }
}

// Remove flags from args
const cleanArgs = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (fileFlagIndex !== -1 && i === fileFlagIndex + 1) return false;
  return true;
});

function formatData(data) {
  if (mode === 'json') {
    return JSON.stringify(data, null, 2);
  } else if (mode === 'table') {
    // For file output, convert table to CSV
    if (Array.isArray(data)) {
      const keys = Object.keys(data[0] || {});
      const rows = data.map(obj => keys.map(k => obj[k]).join(','));
      return [keys.join(','), ...rows].join('\n');
    } else {
      const keys = Object.keys(data || {});
      return [keys.join(','), keys.map(k => data[k]).join(',')].join('\n');
    }
  } else {
    return String(data);
  }
}

function outputData(data) {
  if (filePath) {
    const formatted = formatData(data);
    fs.writeFileSync(filePath, formatted);
    console.log(`Output written to ${filePath}`);
  } else {
    if (mode === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (mode === 'table') {
      if (Array.isArray(data)) {
        console.table(data);
      } else {
        console.table([data]);
      }
    } else {
      console.log(data);
    }
  }
}

(async () => {
  try {
    switch (cmd) {
      case 'createBatch': {
        const [count, profile, batch] = cleanArgs;
        const created = await vm.createBatch(count, profile, batch);
        outputData(created);
        break;
      }
      case 'exportBatch': {
        const [batchName] = cleanArgs;
        const batchUsers = await vm.exportBatch(batchName);
        outputData(batchUsers);
        break;
      }
      case 'exportAll': {
        const users = await vm.exportAll();
        outputData(users);
        break;
      }
      case 'exportProfiles': {
        const profiles = await vm.exportProfiles();
        outputData(profiles);
        break;
      }
      case 'stats': {
        const stats = await vm.getStats();
        outputData(stats);
        break;
      }
      case 'blockVoucher': {
        const [username] = cleanArgs;
        await vm.blockVoucher(username);
        console.log(`Voucher ${username} blocked.`);
        break;
      }
      case 'deleteVoucher': {
        const [username] = cleanArgs;
        await vm.deleteVoucher(username);
        console.log(`Voucher ${username} deleted.`);
        break;
      }
      case 'list': {
        const users = await vm.fetchUsers();
        outputData(users);
        break;
      }
      default:
        console.log(`Unknown command: ${cmd}
Usage:
  createBatch <count> <profile> <batch> [--json|--table] [--file <path>]
  exportBatch <batch> [--json|--table] [--file <path>]
  exportAll [--json|--table] [--file <path>]
  exportProfiles [--json|--table] [--file <path>]
  stats [--json|--table] [--file <path>]
  blockVoucher <username>
  deleteVoucher <username>
  list [--json|--table] [--file <path>]`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();

