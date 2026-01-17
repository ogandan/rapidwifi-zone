// ... (imports and middleware unchanged)

function exportCSV(res, vouchers, filename, action, user) {
  const fields = [
    { label: 'Voucher ID', value: 'id' },
    { label: 'Voucher Code', value: 'username' },
    { label: 'Password', value: 'password' },
    { label: 'Profile', value: 'profile' },
    { label: 'Status', value: 'status' },
    { label: 'Issued On', value: 'created_at' },
    { label: 'Batch Tag', value: 'batch_tag' }
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(vouchers);

  // Log the download
  db.logDownload(action, filename, user).catch(err => console.error("Log error:", err));

  res.header('Content-Type', 'text/csv');
  res.attachment(filename);
  return res.send(csv);
}

app.get('/admin/export', async (req, res) => {
  try {
    const vouchers = await db.getAllVouchers();
    return exportCSV(res, vouchers, 'vouchers.csv', 'export-all', 'admin');
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers');
  }
});

app.post('/admin/export-range', async (req, res) => {
  const { startDate, endDate } = req.body;
  try {
    const vouchers = await db.getVouchersByDateRange(startDate, endDate);
    return exportCSV(res, vouchers, `vouchers_${startDate}_to_${endDate}.csv`, 'export-range', 'admin');
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers by date range');
  }
});

app.post('/admin/export-profile', async (req, res) => {
  const { profile } = req.body;
  try {
    const vouchers = await db.getVouchersByProfile(profile);
    return exportCSV(res, vouchers, `vouchers_${profile}.csv`, 'export-profile', 'admin');
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers by profile');
  }
});

app.post('/admin/export-batch', async (req, res) => {
  const { batchTag } = req.body;
  try {
    const vouchers = await db.getVouchersByBatch(batchTag);
    return exportCSV(res, vouchers, `vouchers_${batchTag}.csv`, 'export-batch', 'admin');
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers by batch');
  }
});

// --------------------
// Admin Logs Page
// --------------------

app.get('/admin/logs', async (req, res) => {
  try {
    const logs = await db.getDownloadLogs(50);
    res.render('logs', { logs });
  } catch (err) {
    console.error(err);
    res.send('Error loading logs');
  }
});

