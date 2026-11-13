const { spawn } = require('child_process');
const path = require('path');
const Redis = require(path.join(__dirname, '../server/node_modules/ioredis'));

const redisBin = 'C:\\Users\\Ritvik\\AppData\\Local\\Microsoft\\WinGet\\Packages\\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\\redis-server.exe';

async function testRealRedis() {
  console.log('Starting Redis Server from:', redisBin);
  const redisProc = spawn(redisBin, ['--port', '6379', '--save', '', '--appendonly', 'no'], {
    stdio: 'ignore',
    windowsHide: true,
  });

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const pub = new Redis('redis://127.0.0.1:6379', { maxRetriesPerRequest: 1 });
    const sub = new Redis('redis://127.0.0.1:6379', { maxRetriesPerRequest: 1 });

    // 1. SET / GET
    await pub.set('clipforge:test:key', 'connected_real_redis_8.10');
    const val = await pub.get('clipforge:test:key');
    console.log('Redis GET key value:', val);

    // 2. Pub/Sub
    let receivedMsg = null;
    await sub.subscribe('clipforge:test:channel');
    sub.on('message', (ch, msg) => {
      receivedMsg = msg;
    });

    await pub.publish('clipforge:test:channel', JSON.stringify({ type: 'CLUSTER_EVENT', status: 'verified' }));
    await new Promise((r) => setTimeout(r, 600));

    console.log('Redis Pub/Sub received message:', receivedMsg);

    const success = val === 'connected_real_redis_8.10' && receivedMsg !== null;
    console.log('Redis Verification Result:', success ? 'ALL TESTS PASSED' : 'FAILED');

    await pub.quit();
    await sub.quit();
  } catch (err) {
    console.error('Redis test error:', err);
  } finally {
    try {
      redisProc.kill();
    } catch (_) {}
  }
}

testRealRedis();
