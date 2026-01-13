// File: modules/mikrotik-api.js
// Purpose: Real RouterOS API wrapper using mikronode-ng

const MikroNode = require('mikronode-ng');

class MikrotikAPI {
  constructor({ host, user, password, port = 8728 }) {
    this.host = host;
    this.user = user;
    this.password = password;
    this.port = port;
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = MikroNode.getConnection(this.host, this.user, this.password, {
        port: this.port,
        timeout: 5000
      });
      await this.connection.connect();
      this.channel = this.connection.openChannel();
      console.log(`[MikrotikAPI] Connected to ${this.host}:${this.port}`);
    } catch (err) {
      console.error('[MikrotikAPI] Connection failed:', err);
    }
  }

  async createVoucher(code, duration) {
    try {
      // Add hotspot user with given code and time limit
      await this.channel.write('/ip/hotspot/user/add', [
        `=name=${code}`,
        `=password=${code}`,
        `=limit-uptime=${duration}m`
      ]);
      console.log(`[MikrotikAPI] Voucher ${code} created for ${duration} minutes`);
      return true;
    } catch (err) {
      console.error('[MikrotikAPI] Error creating voucher:', err);
      return false;
    }
  }

  async validateVoucher(code) {
    try {
      const data = await this.channel.write('/ip/hotspot/user/print', [`?name=${code}`]);
      return data.length > 0;
    } catch (err) {
      console.error('[MikrotikAPI] Error validating voucher:', err);
      return false;
    }
  }

  async blockVoucher(code) {
    try {
      await this.channel.write('/ip/hotspot/user/set', [
        `=disabled=yes`,
        `=.id=${code}`
      ]);
      console.log(`[MikrotikAPI] Voucher ${code} blocked`);
      return true;
    } catch (err) {
      console.error('[MikrotikAPI] Error blocking voucher:', err);
      return false;
    }
  }

  async getVoucherStats() {
    try {
      const users = await this.channel.write('/ip/hotspot/user/print');
      const active = users.filter(u => u.disabled !== 'true').length;
      const blocked = users.filter(u => u.disabled === 'true').length;
      return { active, blocked, total: users.length };
    } catch (err) {
      console.error('[MikrotikAPI] Error fetching stats:', err);
      return { active: 0, blocked: 0, total: 0 };
    }
  }
}

module.exports = MikrotikAPI;

