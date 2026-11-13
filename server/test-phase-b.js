const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

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

    if (payload) {
      req.write(payload);
    }
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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 CLIPFORGE PHASE B BACKEND INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  const serverDir = path.resolve(__dirname);
  const nodeBin = process.execPath;

  // 1. Start Web Instance 1 on Port 4001
  const env1 = Object.assign({}, process.env, {
    PORT: '4001',
    INSTANCE_ID: 'web-instance-1',
  });
  const web1 = spawn(nodeBin, ['dist/index.js'], { cwd: serverDir, env: env1, stdio: 'inherit' });

  // 2. Start Web Instance 2 on Port 4002
  const env2 = Object.assign({}, process.env, {
    PORT: '4002',
    INSTANCE_ID: 'web-instance-2',
  });
  const web2 = spawn(nodeBin, ['dist/index.js'], { cwd: serverDir, env: env2, stdio: 'inherit' });

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
    await waitForServer(4002, 'Web Instance 2');

    console.log('\n--- Test 1: Liveness and Readiness Endpoints ---');
    const health1 = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/health', method: 'GET' });
    record('Web1 GET /health', health1.status === 200 && health1.json.instance === 'web-instance-1');

    const health2 = await httpRequest({ hostname: '127.0.0.1', port: 4002, path: '/health', method: 'GET' });
    record('Web2 GET /health', health2.status === 200 && health2.json.instance === 'web-instance-2');

    const ready1 = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/ready', method: 'GET' });
    record('Web1 GET /ready', ready1.status === 200 && ready1.json.components.storage === 'accessible');

    console.log('\n--- Test 2: Department Quotas & Atomic Enforcement ---');
    const depts = await httpRequest({ hostname: '127.0.0.1', port: 4001, path: '/api/departments', method: 'GET' });
    record('GET /api/departments', depts.status === 200 && depts.json.departments.length >= 5);

    // Try over-quota standard upload to verify atomic rejection
    const overQuotaInit = await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: '/api/uploads/init', method: 'POST' },
      {
        title: 'Huge Video Beyond Quota',
        originalName: 'massive_exceed.mp4',
        mimeType: 'video/mp4',
        size: 500 * 1024 * 1024 * 1024, // 500 GB
        departmentId: 'dept-phys', // has only ~67h left
        priority: 'standard',
      }
    );
    record('Atomic Quota Block for Over-Capacity Standard Upload', overQuotaInit.status === 403);

    console.log('\n--- Test 3: Resumable Upload Initialization on Web1 ---');
    // Generate deterministic test chunk payloads
    const chunk0Data = Buffer.alloc(CHUNK_SIZE, 'A'); // 5MB chunk 0
    const chunk1Data = Buffer.alloc(1024 * 512, 'B'); // 512KB chunk 1 (total: 5.5MB, 2 chunks)
    const totalVideoSize = chunk0Data.length + chunk1Data.length;

    const initRes = await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: '/api/uploads/init', method: 'POST' },
      {
        title: 'CS 280: Computer Vision Lecture 1',
        originalName: 'CS280_Lec01_Intro.mp4',
        mimeType: 'video/mp4',
        size: totalVideoSize,
        departmentId: 'dept-cs',
        priority: 'standard',
      }
    );

    if (initRes.status !== 201) {
      console.error(`[DEBUG Init Failed] Status: ${initRes.status}, Body: ${initRes.body}`);
    }

    record('POST /api/uploads/init on Web1', initRes.status === 201 && !!initRes.json.uploadId);
    const uploadId = initRes.json.uploadId;
    console.log(`     Upload ID generated: ${uploadId}`);

    console.log('\n--- Test 4: Chunk Streaming (5MB Chunk 0 to Web1) ---');
    const chunk0Res = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: 4001,
        path: `/api/uploads/${uploadId}/parts/0`,
        method: 'PUT',
        headers: { 'Content-Length': chunk0Data.length },
      },
      chunk0Data
    );
    record('PUT /api/uploads/:id/parts/0 on Web1', chunk0Res.status === 200 && chunk0Res.json.size === CHUNK_SIZE);

    console.log('\n--- Test 5: Cross-Instance Recovery & Status Check on Web2 ---');
    // Status requested from Web2 on port 4002! Verifies Web2 accesses shared storage and DB
    const statusRes = await httpRequest({
      hostname: '127.0.0.1',
      port: 4002,
      path: `/api/uploads/${uploadId}/status`,
      method: 'GET',
    });
    const statusOk =
      statusRes.status === 200 &&
      statusRes.json.uploadedParts.includes(0) &&
      !statusRes.json.isComplete;
    record('GET /api/uploads/:id/status on Web2 (Shared State Access)', statusOk);

    console.log('\n--- Test 6: Resuming Chunk Upload on Web2 (Part 1 to Web2) ---');
    // Upload remaining part 1 directly to Web2!
    const chunk1Res = await httpRequest(
      {
        hostname: '127.0.0.1',
        port: 4002,
        path: `/api/uploads/${uploadId}/parts/1`,
        method: 'PUT',
        headers: { 'Content-Length': chunk1Data.length },
      },
      chunk1Data
    );
    record('PUT /api/uploads/:id/parts/1 on Web2', chunk1Res.status === 200 && chunk1Res.json.size === chunk1Data.length);

    console.log('\n--- Test 7: Upload Assembly and Job Creation on Web2 ---');
    const completeRes = await httpRequest(
      { hostname: '127.0.0.1', port: 4002, path: `/api/uploads/${uploadId}/complete`, method: 'POST' },
      {}
    );
    const completeOk =
      completeRes.status === 200 &&
      completeRes.json.success === true &&
      !completeRes.json.duplicateDetected &&
      !!completeRes.json.jobId &&
      !!completeRes.json.sha256;
    record('POST /api/uploads/:id/complete on Web2', completeOk);
    const originalSha256 = completeRes.json.sha256;
    const jobId = completeRes.json.jobId;

    console.log('\n--- Test 8: Verify Video & Job Persistence on Web1 ---');
    const videoCheck = await httpRequest({
      hostname: '127.0.0.1',
      port: 4001,
      path: `/api/videos/${uploadId}`,
      method: 'GET',
    });
    record('GET /api/videos/:id on Web1', videoCheck.status === 200 && videoCheck.json.isUploadComplete === true);

    const jobCheck = await httpRequest({
      hostname: '127.0.0.1',
      port: 4001,
      path: `/api/jobs/${jobId}`,
      method: 'GET',
    });
    record('GET /api/jobs/:id on Web1', jobCheck.status === 200 && jobCheck.json.stage === 'validation');

    console.log('\n--- Test 9: Duplicate Detection via SHA-256 ---');
    // Re-upload identical payload to test duplicate detection
    const dupInit = await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: '/api/uploads/init', method: 'POST' },
      {
        title: 'CS 280 Duplicate Re-upload',
        originalName: 'CS280_Lec01_Copy.mp4',
        mimeType: 'video/mp4',
        size: totalVideoSize,
        departmentId: 'dept-cs',
        priority: 'standard',
      }
    );
    const dupUploadId = dupInit.json.uploadId;

    // Send chunks
    await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: `/api/uploads/${dupUploadId}/parts/0`, method: 'PUT' },
      chunk0Data
    );
    await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: `/api/uploads/${dupUploadId}/parts/1`, method: 'PUT' },
      chunk1Data
    );

    const dupComplete = await httpRequest(
      { hostname: '127.0.0.1', port: 4001, path: `/api/uploads/${dupUploadId}/complete`, method: 'POST' },
      {}
    );
    const dupOk =
      dupComplete.status === 200 &&
      dupComplete.json.duplicateDetected === true &&
      dupComplete.json.existingVideoId === uploadId;
    record('Idempotent SHA-256 Duplicate Detection', dupOk, `Matched existing ${uploadId}`);

    console.log('\n--- Test 10: Video Library API & Admin Metrics ---');
    const videosList = await httpRequest({ hostname: '127.0.0.1', port: 4002, path: '/api/videos', method: 'GET' });
    record('GET /api/videos', videosList.status === 200 && videosList.json.count >= 1);

    const adminMetrics = await httpRequest({ hostname: '127.0.0.1', port: 4002, path: '/api/admin/metrics', method: 'GET' });
    record('GET /api/admin/metrics', adminMetrics.status === 200 && adminMetrics.json.totalVideos >= 1);

  } catch (err) {
    console.error('[UNEXPECTED TEST EXCEPTION]', err);
    record('Global Suite Execution', false, err.message);
  } finally {
    console.log('\nTerminating web instances...');
    web1.kill();
    web2.kill();
    await new Promise((r) => setTimeout(r, 600));

    console.log('\n================================================================');
    console.log(`RESULTS: ${passedTests.length} PASSED, ${failedTests.length} FAILED`);
    console.log('================================================================');
    process.exit(failedTests.length === 0 ? 0 : 1);
  }
}

runTests();
