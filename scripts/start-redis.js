const { spawn } = require('child_process');
const fs = require('fs');

const redisBin = 'C:\\Users\\Ritvik\\AppData\\Local\\Microsoft\\WinGet\\Packages\\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\\redis-server.exe';

if (!fs.existsSync(redisBin)) {
  console.error('[Redis Error] redis-server.exe not found at:', redisBin);
  process.exit(1);
}

console.log('================================================================');
console.log('⚡ Starting Real Redis Server v8.10 on port 6379');
console.log('📂 Binary:', redisBin);
console.log('================================================================');

const proc = spawn(redisBin, ['--port', '6379', '--save', '', '--appendonly', 'no'], {
  stdio: 'inherit',
});

proc.on('close', (code) => {
  console.log(`[Redis] Process exited with code ${code}`);
});

process.on('SIGINT', () => {
  proc.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  proc.kill('SIGTERM');
  process.exit(0);
});
