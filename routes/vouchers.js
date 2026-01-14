const express = require('express');
const router = express.Router();
const vm = require('../modules/voucherManager');
const path = require('path');
const fs = require('fs');

// === Voucher Stats ===
router.get('/api/vouchers/stats', async (req, res) => {
  try {
    const stats = await vm.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Export Batch (JSON or CSV) ===
router.get('/api/vouchers/export/:batch', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const vouchers = await vm.exportBatch(req.params.batch);
    if (format === 'csv') {
      const filePath = path.join(__dirname, '..', 'data', `vouchers_${req.params.batch}.csv`);
      res.download(filePath);
    } else {
      res.json(vouchers);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Export All Vouchers ===
router.get('/api/vouchers/exportAll', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const vouchers = await vm.exportAll();
    if (format === 'csv') {
      const filePath = path.join(__dirname, '..', 'data', 'vouchers_all.csv');
      res.download(filePath);
    } else {
      res.json(vouchers);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Print-Friendly Batch View ===
router.get('/api/vouchers/print/:batch', async (req, res) => {
  try {
    const vouchers = await vm.exportBatch(req.params.batch);
    let html = `
      <html><head><title>Batch ${req.params.batch}</title></head><body>
      <h2>Batch ${req.params.batch}</h2>
      <table border="1" cellpadding="5">
        <tr><th>Username</th><th>Password</th><th>Profile</th></tr>
        ${vouchers.map(v => `<tr><td>${v.name}</td><td>${v.password}</td><td>${v.profile}</td></tr>`).join('')}
      </table>
      <script>window.print()</script>
      </body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Export Audit Logs (Download) ===
router.get('/api/vouchers/audit/download', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'audit.log');
  res.download(filePath, 'audit.log', err => {
    if (err) {
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  });
});

// === Audit Logs (JSON for Viewer Page) ===
router.get('/api/vouchers/audit', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'audit.log');
  try {
    if (!fs.existsSync(filePath)) {
      return res.json([]);
    }
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    const entries = lines.filter(l => l).map(line => JSON.parse(line));
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read audit logs' });
  }
});

module.exports = router;

