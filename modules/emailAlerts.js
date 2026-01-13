// File: modules/emailAlerts.js
// Purpose: Send bilingual system alerts, daily/weekly reports, service checks, and attach graphs via Postfix relay

const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const voucherManager = require('./voucherManager'); 
const paymentHandler = require('./paymentHandler'); 

function sendMail(subject, body, attachments = []) {
  // Build mail command with optional attachments
  let cmd = `echo "${body}" | mail -s "${subject}" yourgmail@gmail.com`;
  attachments.forEach(file => {
    cmd += ` -A ${file}`;
  });

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`[EMAIL ERROR] ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`[EMAIL STDERR] ${stderr}`);
      return;
    }
    console.log(`[EMAIL SENT] ${stdout}`);
  });
}

module.exports = {
  // 🔴 Immediate error alerts
  systemError: (message) => {
    const subject = "RAPIDWIFI-ZONE System Error / Erreur système";
    const body = `EN: A system error occurred: ${message}\nFR: Une erreur système est survenue: ${message}`;
    sendMail(subject, body);
  },

  // 💳 Payment alerts
  paymentSuccess: (user, plan) => {
    const subject = "Payment Success / Paiement réussi";
    const body = `EN: User ${user} purchased plan ${plan}\nFR: L'utilisateur ${user} a acheté le forfait ${plan}`;
    sendMail(subject, body);
  },

  paymentFailure: (user, plan) => {
    const subject = "Payment Failure / Échec du paiement";
    const body = `EN: Payment failed for user ${user}, plan ${plan}\nFR: Le paiement a échoué pour l'utilisateur ${user}, forfait ${plan}`;
    sendMail(subject, body);
  },

  // 📅 Daily health report with logging
  dailyHealthReport: () => {
    const uptime = os.uptime();
    const load = os.loadavg().map(v => v.toFixed(2)).join(', ');
    const freeMem = (os.freemem() / (1024*1024)).toFixed(2);
    const totalMem = (os.totalmem() / (1024*1024)).toFixed(2);

    const stats = voucherManager.getStats(); 
    const payments = paymentHandler.getDailySummary();

    // Log daily report
    const logPath = path.join(__dirname, '../data/dailyReports.json');
    let reports = [];
    if (fs.existsSync(logPath)) {
      reports = JSON.parse(fs.readFileSync(logPath));
    }
    reports.push({
      date: new Date().toISOString(),
      uptime,
      loadAvg: load,
      memory: { free: freeMem, total: totalMem },
      stats,
      payments
    });
    fs.writeFileSync(logPath, JSON.stringify(reports, null, 2));

    const subject = "Daily System Report / Rapport quotidien du système";
    const body = 
      `EN:\nUptime: ${uptime} seconds\nLoad Avg: ${load}\nMemory: ${freeMem} MB free / ${totalMem} MB total\n` +
      `Active vouchers: ${stats.active}\nBlocked vouchers: ${stats.blocked}\nTotal vouchers: ${stats.total}\n` +
      `Payments today: ${payments.count}\nRevenue today: ${payments.revenue} FCFA\n\n` +
      `FR:\nTemps de fonctionnement: ${uptime} secondes\nCharge moyenne: ${load}\nMémoire: ${freeMem} MB libre / ${totalMem} MB total\n` +
      `Bons actifs: ${stats.active}\nBons bloqués: ${stats.blocked}\nTotal des bons: ${stats.total}\n` +
      `Paiements aujourd'hui: ${payments.count}\nRevenu aujourd'hui: ${payments.revenue} FCFA`;

    sendMail(subject, body);
  },

  // 📊 Weekly report with graphs
  weeklyReport: () => {
    const logPath = path.join(__dirname, '../data/dailyReports.json');
    let reports = [];
    if (fs.existsSync(logPath)) {
      reports = JSON.parse(fs.readFileSync(logPath));
    }

    const lastWeek = reports.slice(-7);

    const totalVouchers = lastWeek.reduce((sum, r) => sum + (r.stats.total || 0), 0);
    const activeVouchers = lastWeek.reduce((sum, r) => sum + (r.stats.active || 0), 0);
    const blockedVouchers = lastWeek.reduce((sum, r) => sum + (r.stats.blocked || 0), 0);

    const totalPayments = lastWeek.reduce((sum, r) => sum + (r.payments.count || 0), 0);
    const totalRevenue = lastWeek.reduce((sum, r) => sum + (r.payments.revenue || 0), 0);

    const avgLoad = (
      lastWeek.reduce((sum, r) => sum + parseFloat(r.loadAvg || 0), 0) / lastWeek.length
    ).toFixed(2);

    const avgUptime = (
      lastWeek.reduce((sum, r) => sum + (r.uptime || 0), 0) / lastWeek.length
    ).toFixed(0);

    // Generate graphs (voucher usage + revenue trend)
    const graphDir = path.join(__dirname, '../data/graphs');
    if (!fs.existsSync(graphDir)) fs.mkdirSync(graphDir, { recursive: true });

    const voucherGraph = path.join(graphDir, 'voucher_trend.png');
    const revenueGraph = path.join(graphDir, 'revenue_trend.png');

    // Assume external script generates graphs (Python/Chart.js)
    exec(`python3 ../scripts/generate_graphs.py`, (err) => {
      if (err) console.error("Graph generation failed:", err.message);
    });

    const subject = "Weekly System Report / Rapport hebdomadaire du système";
    const body =
      `EN:\nWeekly RAPIDWIFI-ZONE Report\n` +
      `Total vouchers: ${totalVouchers}\nActive vouchers: ${activeVouchers}\nBlocked vouchers: ${blockedVouchers}\n` +
      `Payments: ${totalPayments}\nRevenue: ${totalRevenue} FCFA\n` +
      `Average load: ${avgLoad}\nAverage uptime: ${avgUptime} seconds\n\n` +
      `FR:\nRapport hebdomadaire RAPIDWIFI-ZONE\n` +
      `Bons totaux: ${totalVouchers}\nBons actifs: ${activeVouchers}\nBons bloqués: ${blockedVouchers}\n` +
      `Paiements: ${totalPayments}\nRevenu: ${totalRevenue} FCFA\n` +
      `Charge moyenne: ${avgLoad}\nTemps de fonctionnement moyen: ${avgUptime} secondes`;

    sendMail(subject, body, [voucherGraph, revenueGraph]);
  },

  // 🛡️ Service check module
  serviceCheck: () => {
    const services = ['nginx', 'node', 'postfix'];
    services.forEach(service => {
      exec(`systemctl is-active ${service}`, (err, stdout) => {
        if (stdout.trim() !== 'active') {
          const subject = `Service Alert: ${service} down / Alerte service: ${service} arrêté`;
          const body = `EN: The ${service} service is not running.\nFR: Le service ${service} n'est pas en cours d'exécution.`;
          sendMail(subject, body);
        }
      });
    });

    // Cloudflare tunnel check
    exec("pgrep cloudflared", (err, stdout) => {
      if (!stdout.trim()) {
        const subject = "Service Alert: Cloudflare Tunnel down / Alerte service: Tunnel Cloudflare arrêté";
        const body = "EN: Cloudflare tunnel is not running.\nFR: Le tunnel Cloudflare n'est pas en cours d'exécution.";
        sendMail(subject, body);
      }
    });
  }
};

