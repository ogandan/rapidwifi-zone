// File: paymentHandler.js
// Path: /home/pi/rapidwifi-zone/modules/paymentHandler.js
// Device: Raspberry Pi 3
// Purpose: Handle MTN MoMo and Moov Money API payments

const axios = require('axios');
const voucherManager = require('./voucherManager');

module.exports = {
  processPayment: async (provider, payload) => {
    if (provider === 'mtn') {
      const response = await axios.post('https://api.mtnmomo.com/v1/payment', payload);
      if (response.data.status === 'success') {
        await voucherManager.createVoucher(payload.phone, payload.plan);
      }
    } else if (provider === 'moov') {
      const response = await axios.post('https://api.moovmoney.bj/v1/payment', payload);
      if (response.data.status === 'success') {
        await voucherManager.createVoucher(payload.phone, payload.plan);
      }
    }
  }
};

