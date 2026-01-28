// Simple Node.js script to run your existing ssh command and parse MikroTik profiles
// No need to parse private keys manually, we just reuse your working ssh command.

const { exec } = require('child_process');

exec(
  'ssh -o PubkeyAcceptedAlgorithms=+ssh-rsa -o HostkeyAlgorithms=+ssh-rsa admin@192.168.88.1 /ip hotspot user profile print terse',
  (error, stdout, stderr) => {
    if (error) {
      console.error(`SSH error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`SSH stderr: ${stderr}`);
      return;
    }

    const lines = stdout.split('\n').filter(l => l.includes('name='));
    const priceMap = {};

    lines.forEach(line => {
      const match = line.match(/name=([^ ]+)/);
      if (match) {
        const name = match[1];
        if (name.includes('-')) {
          const [duration, priceStr] = name.split('-');
          const price = parseInt(priceStr.replace('FCFA', ''), 10);
          priceMap[name] = { duration, price };
        }
      }
    });

    console.log('Parsed profile prices:');
    console.log(priceMap);
  }
);

