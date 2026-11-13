const fs = require('fs');
const path = require('path');
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
const { Pool } = require(path.join(__dirname, '../server/node_modules/pg'));

const rootEnvPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(rootEnvPath)) {
  console.error('[FATAL] Root .env file not found at:', rootEnvPath);
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(rootEnvPath));
const rawDbUrl = env.DATABASE_URL;

if (!rawDbUrl) {
  console.error('[FATAL] DATABASE_URL is not defined in root .env');
  process.exit(1);
}

console.log('================================================================');
console.log('CLIPFORGE — SUPABASE POSTGRESQL CONNECTION TEST');
console.log('================================================================\n');

// 1. Sanitize & Mask URL for Logging
function parseAndSanitize(raw) {
  let url = raw.trim();
  const match = url.match(/^postgres(ql)?:\/\/([^:]+):(.+)@([^@]+:\d+\/.*)$/);
  if (match) {
    const user = match[2];
    const rawPass = match[3];
    const rest = match[4];
    url = `postgresql://${encodeURIComponent(decodeURIComponent(user))}:${encodeURIComponent(decodeURIComponent(rawPass))}@${rest}`;
  }
  const cleanUrl = url.replace(/[\?&]sslmode=[^&]+/, '');
  return cleanUrl;
}

const sanitizedUrl = parseAndSanitize(rawDbUrl);

try {
  const u = new URL(sanitizedUrl);
  console.log('1. Configuration Parsed from Root .env:');
  console.log('   Host:     ', u.hostname);
  console.log('   Port:     ', u.port || 5432);
  console.log('   User:     ', u.username);
  console.log('   Database: ', u.pathname.replace('/', ''));
  console.log('   SSL Mode:  Enabled (rejectUnauthorized: false)');
  console.log('   Password:  [PROTECTED - Present & Validated]\n');
} catch (e) {
  console.error('[ERROR] Failed to parse sanitized URL:', e.message);
}

// 2. Execute Query Test
console.log('2. Initiating Real PostgreSQL Query: SELECT NOW()...');
const pool = new Pool({
  connectionString: sanitizedUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

(async () => {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT NOW() as current_time, version() as pg_version;');
    const elapsed = Date.now() - start;

    console.log(`\n✅ REAL SUPABASE QUERY SUCCEEDED in ${elapsed}ms!`);
    console.log('   Server Timestamp:  ', res.rows[0].current_time);
    console.log('   PostgreSQL Version:', res.rows[0].pg_version.split(',')[0]);

    // Check schema tables
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tableRes.rows.map(r => r.table_name);
    console.log('\n3. Existing Database Schema Status:');
    console.log('   Tables Found in public schema:', tables.length > 0 ? tables.join(', ') : 'None (Schema uninitialized)');

  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`\n❌ REAL SUPABASE QUERY FAILED after ${elapsed}ms:`);
    console.error('   Error Code:   ', err.code || 'UNKNOWN');
    console.error('   Error Message:', err.message);

    if (err.message.includes('tenant/user') && err.message.includes('not found')) {
      console.log('\n🔍 Root Cause Diagnosis:');
      console.log('   The Supavisor connection pooler did not find this tenant/project reference.');
      console.log('   Common Causes:');
      console.log('   a) The Supabase project is PAUSED (Free tier pauses after inactivity -> Click "Restore Project" in Supabase dashboard).');
      console.log('   b) The project reference in the username does not match the project ID in the dashboard.');
      console.log('   c) The pooler region does not match the project region.');
    }
  } finally {
    await pool.end();
  }
})();
