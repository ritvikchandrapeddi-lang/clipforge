const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

console.log('=== CLIPFORGE ENVIRONMENT INSPECTION ===\n');

function runSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return `ERROR/NOT_FOUND: ${err.message.split('\n')[0]}`;
  }
}

// 1. Check CLI Binaries in PATH
console.log('--- Checking PATH for standard binaries ---');
const binaries = ['docker', 'docker-compose', 'psql', 'postgres', 'rabbitmq-server', 'rabbitmqctl', 'redis-server', 'redis-cli', 'wsl', 'winget', 'scoop', 'choco'];
for (const b of binaries) {
  const whereRes = runSafe(`where ${b}`);
  console.log(`${b.padEnd(16)}: ${whereRes.includes('ERROR') ? 'NOT FOUND' : whereRes.split('\r\n')[0]}`);
}

// 2. Check WSL status
console.log('\n--- Checking WSL Status ---');
console.log(runSafe('wsl --status'));
console.log(runSafe('wsl -l -v'));

// 3. Check Program Files directories
console.log('\n--- Checking Program Files Locations ---');
const candidateDirs = [
  'C:\\Program Files\\PostgreSQL',
  'C:\\Program Files (x86)\\PostgreSQL',
  'C:\\Program Files\\RabbitMQ Server',
  'C:\\Program Files\\Redis',
  'C:\\Program Files\\Memurai',
  'C:\\Program Files\\Docker\\Docker',
  'C:\\ProgramData\\DockerDesktop'
];
for (const d of candidateDirs) {
  const exists = fs.existsSync(d);
  console.log(`${d.padEnd(36)}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  if (exists) {
    try {
      console.log('  Contents:', fs.readdirSync(d).slice(0, 5).join(', '));
    } catch (_) {}
  }
}

// 4. Check Windows Services
console.log('\n--- Checking Windows Services (sc query) ---');
const serviceNames = ['postgresql-x64-16', 'postgresql-x64-15', 'postgresql-x64-14', 'postgresql', 'RabbitMQ', 'Redis', 'Memurai', 'com.docker.service'];
for (const s of serviceNames) {
  const scRes = runSafe(`sc query ${s}`);
  if (!scRes.includes('1060') && !scRes.includes('ERROR')) {
    console.log(`Service [${s}]: FOUND -> ${scRes.split('\r\n').find(l => l.includes('STATE')) || scRes.split('\r\n')[0]}`);
  } else {
    console.log(`Service [${s}]: Not registered`);
  }
}

// 5. Test Default TCP Ports
console.log('\n--- Probing TCP Ports (Localhost) ---');
const portsToTest = [
  { name: 'PostgreSQL', port: 5432 },
  { name: 'RabbitMQ AMQP', port: 5672 },
  { name: 'RabbitMQ Management', port: 15672 },
  { name: 'Redis', port: 6379 },
  { name: 'Web Instance 1', port: 4001 },
  { name: 'Web Instance 2', port: 4002 },
  { name: 'Frontend Client', port: 3000 },
];

async function probePort(p) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(p.port, '127.0.0.1');
  });
}

(async () => {
  for (const p of portsToTest) {
    const isOpen = await probePort(p);
    console.log(`${p.name.padEnd(22)} (:${p.port}): ${isOpen ? 'LISTENING (OPEN)' : 'CLOSED (Nothing listening)'}`);
  }

  // 6. Inspect Environment Configuration
  console.log('\n--- Checking .env Files ---');
  const envFiles = ['.env', '.env.example', 'server/.env', 'workers/.env', 'client/.env'];
  for (const ef of envFiles) {
    const absPath = path.join(__dirname, ef);
    console.log(`${ef.padEnd(16)}: ${fs.existsSync(absPath) ? 'EXISTS' : 'NOT FOUND'}`);
  }
})();

