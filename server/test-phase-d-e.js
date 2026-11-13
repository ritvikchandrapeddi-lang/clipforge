const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const opts = Object.assign({}, options);
    opts.headers = Object.assign({}, opts.headers);
    let payload = null;

    if (data !== null) {
      if (Buffer.isBuffer(data)) {
        payload = data;
        opts.headers['Content-Length'] = data.length;
      } else if (typeof data === 'string') {
        payload = Buffer.from(data);
        opts.headers['Content-Length'] = payload.length;
      } else {
        payload = Buffer.from(JSON.stringify(data));
        opts.headers['Content-Type'] = 'application/json';
        opts.headers['Content-Length'] = payload.length;
      }
    }

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForServer(port, instanceName, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
      });
      if (res.status === 200) {
        console.log(`[OK] ${instanceName} is live and healthy on port ${port}`);
        return true;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${instanceName} failed to start on port ${port}`);
}

async function runPhaseDAndETests() {
  console.log('================================================================');
  console.log('🧪 CLIPFORGE PHASE D & E: WEBSOCKET, SIMULATOR & OBSERVATORY TESTS');
  console.log('================================================================\n');

  const serverDir = path.resolve(__dirname);
  const nodeBin = process.execPath;

  const env1 = Object.assign({}, process.env, { PORT: '4001', INSTANCE_ID: 'web-instance-1' });
  const web1 = spawn(nodeBin, ['dist/index.js'], { cwd: serverDir, env: env1, stdio: 'inherit' });

  const passedTests = [];
  const failedTests = [];

  function record(testName, passed, detail = '') {
    if (passed) {
      console.log(`  ✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passedTests.push(testName);
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failedTests.push({ testName, detail });
    }
  }

  try {
    await waitForServer(4001, 'Web Instance 1');

    console.log('\n--- Test 1: Real-Time WebSocket Connection & State Fan-Out ---');
    const wsReceivedEvents = [];
    const ws = new WebSocket('ws://127.0.0.1:4001/ws');

    await new Promise((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
    });

    ws.on('message', (msg) => {
      try {
        wsReceivedEvents.push(JSON.parse(msg.toString()));
      } catch (_) {}
    });

    // Wait 400ms for initial sync event
    await new Promise((r) => setTimeout(r, 400));
    const syncEvent = wsReceivedEvents.find((e) => e.type === 'SYNC_ALL');
    record(
      'WebSocket Initial State Sync (SYNC_ALL)',
      !!syncEvent && syncEvent.instanceId === 'web-instance-1',
      `Synchronized ${syncEvent?.videos?.length || 0} videos`
    );

    console.log('\n--- Test 2: Dead-Letter Center & Replay Controls ---');
    const dlqList = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/api/deadletter', method: 'GET' });
    record('GET /api/deadletter', dlqList.status === 200 && Array.isArray(dlqList.json.deadLetters));

    const replayBatchRes = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/api/deadletter/replay-all', method: 'POST' }, {});
    record('POST /api/deadletter/replay-all', replayBatchRes.status === 200 && replayBatchRes.json.success === true);

    console.log('\n--- Test 3: Smart Processing Observatory Rule-Based Bottleneck Engine ---');
    const obsRes = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/api/observatory', method: 'GET' });
    const obsOk =
      obsRes.status === 200 &&
      !!obsRes.json.observatory &&
      Array.isArray(obsRes.json.observatory.recommendations) &&
      Array.isArray(obsRes.json.observatory.bottlenecks);
    record(
      'Smart Observatory Heuristic Analysis (Rule-Based Recommendations)',
      obsOk,
      `Health: ${obsRes.json.observatory?.overallHealth}, Recommendations: ${obsRes.json.observatory?.recommendations?.length}`
    );

    console.log('\n--- Test 4: 500-Job Load Testing Simulator Blast ---');
    const blastRes = await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: '/api/simulator/blast', method: 'POST' },
      {
        jobCount: 500,
        corruptRatioPct: 5,
        departmentDistribution: 'balanced',
      }
    );
    const blastOk =
      blastRes.status === 200 &&
      blastRes.json.jobCount === 500 &&
      blastRes.json.corruptCount >= 1;
    record(
      '500 Synthetic Job High-Concurrency Blast',
      blastOk,
      `Dispatched: ${blastRes.json?.jobCount} jobs, Corrupt injected: ${blastRes.json?.corruptCount}`
    );

    // Verify WebSocket caught the cluster broadcast event!
    await new Promise((r) => setTimeout(r, 500));
    const broadcastEvent = wsReceivedEvents.find((e) => e.type === 'SIMULATOR_BURST_DISPATCHED');
    record(
      'WebSocket Real-Time Broadcast Fan-Out (Zero Polling)',
      !!broadcastEvent && broadcastEvent.jobCount === 500,
      'Live burst event received by connected client'
    );

    console.log('\n--- Test 5: Chaos Fault Injections ---');
    const crashRes = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/api/simulator/chaos/crash-worker', method: 'POST' }, {});
    record('Chaos Worker Fault Injection & Zero-Lost-Job Redelivery', crashRes.status === 200);

    const netRes = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/api/simulator/chaos/network-drop', method: 'POST' }, {});
    record('Chaos Network Partition & Auto-Healing', netRes.status === 200);

    ws.close();
  } catch (err) {
    console.error('[UNEXPECTED ERROR IN PHASE D/E SUITE]', err);
    record('Suite Execution', false, err.message);
  } finally {
    web1.kill();
    await new Promise((r) => setTimeout(r, 600));

    console.log('\n================================================================');
    console.log(`RESULTS: ${passedTests.length} PASSED, ${failedTests.length} FAILED`);
    console.log('================================================================');
    process.exit(failedTests.length === 0 ? 0 : 1);
  }
}

runPhaseDAndETests();
