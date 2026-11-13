import { Pool, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';
import { DATABASE_URL, DATA_DIR, initStorageDirectories } from '../config';

let pgPool: Pool | null = null;
let useFallbackStorage = false;
let isConnected = false;

// Fallback JSON persistence file path shared by both web instances
const FALLBACK_DB_PATH = path.join(DATA_DIR, 'clipforge_db.json');

interface FallbackDatabase {
  departments: Record<string, any>;
  videos: Record<string, any>;
  video_chunks: Record<string, any>;
  jobs: Record<string, any>;
  worker_heartbeats: Record<string, any>;
  dead_letter_records: Record<string, any>;
}

let dbInMemory: FallbackDatabase | null = null;
let lastLoadedMtime = 0;
let lastLoadedSize = 0;

function loadFallbackDb(): FallbackDatabase {
  initStorageDirectories();
  if (fs.existsSync(FALLBACK_DB_PATH)) {
    try {
      const stat = fs.statSync(FALLBACK_DB_PATH);
      if (!dbInMemory || stat.mtimeMs !== lastLoadedMtime || stat.size !== lastLoadedSize) {
        const data = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf-8'));
        dbInMemory = data;
        lastLoadedMtime = stat.mtimeMs;
        lastLoadedSize = stat.size;
      }
      if (dbInMemory) return dbInMemory;
    } catch (err) {
      if (dbInMemory) return dbInMemory;
      console.warn('Failed to parse fallback DB, initializing new one:', err);
    }
  }

  const initialDb: FallbackDatabase = {
    departments: {
      'dept-cs': { id: 'dept-cs', name: 'Computer Science', code: 'CS', quota_hours: 250.0, used_hours: 194.5, priority_multiplier: 1.5 },
      'dept-ee': { id: 'dept-ee', name: 'Electrical Engineering', code: 'EE', quota_hours: 200.0, used_hours: 122.0, priority_multiplier: 1.2 },
      'dept-me': { id: 'dept-me', name: 'Mechanical Engineering', code: 'ME', quota_hours: 150.0, used_hours: 98.2, priority_multiplier: 1.0 },
      'dept-math': { id: 'dept-math', name: 'Mathematics & Statistics', code: 'MATH', quota_hours: 120.0, used_hours: 64.0, priority_multiplier: 1.0 },
      'dept-phys': { id: 'dept-phys', name: 'Physics & Biophysics', code: 'PHYS', quota_hours: 100.0, used_hours: 32.5, priority_multiplier: 1.0 },
    },
    videos: {},
    video_chunks: {},
    jobs: {},
    worker_heartbeats: {},
    dead_letter_records: {},
  };
  dbInMemory = initialDb;
  flushDb();
  return initialDb;
}

export function flushDb(): void {
  if (dbInMemory) {
    try {
      initStorageDirectories();
      const tmpPath = `${FALLBACK_DB_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(dbInMemory, null, 2), 'utf-8');
      fs.renameSync(tmpPath, FALLBACK_DB_PATH);
      try {
        const stat = fs.statSync(FALLBACK_DB_PATH);
        lastLoadedMtime = stat.mtimeMs;
        lastLoadedSize = stat.size;
      } catch (_) {}
    } catch (_) {}
  }
}

function saveFallbackDb(db: FallbackDatabase): void {
  dbInMemory = db;
  flushDb();
}

export async function initDb(): Promise<void> {
  initStorageDirectories();
  try {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const client = await pgPool.connect();
    console.log('[DB] Connected to PostgreSQL successfully.');

    // Execute schema.sql migrations
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schemaSql);
      console.log('[DB] PostgreSQL schema initialized.');
    }
    client.release();
    isConnected = true;
    useFallbackStorage = false;
  } catch (err: any) {
    console.warn(`[DB] PostgreSQL unavailable (${err.message}). Using shared persistent store (${FALLBACK_DB_PATH}) for web instances.`);
    useFallbackStorage = true;
    isConnected = true;
    loadFallbackDb(); // Initialize initial tables
  }
}

export function isDbReady(): boolean {
  return isConnected;
}

export async function query(text: string, params: any[] = []): Promise<QueryResult<any>> {
  if (!useFallbackStorage && pgPool) {
    try {
      return await pgPool.query(text, params);
    } catch (err: any) {
      console.error('[DB Query Error]', err.message);
      throw err;
    }
  }

  // Fallback persistent handler for query simulation
  const db = loadFallbackDb();
  const cleanSql = text.replace(/\s+/g, ' ').trim();

  // Metrics: COUNT(*) as total_videos
  if (cleanSql.includes('COUNT(*) as total_videos')) {
    const allVideos = Object.values(db.videos);
    const row = {
      total_videos: allVideos.length,
      completed_videos: allVideos.filter((v: any) => v.status === 'ready').length,
      processing_videos: allVideos.filter((v: any) => ['validation', 'conversion', 'thumbnail'].includes(v.status)).length,
      failed_videos: allVideos.filter((v: any) => v.status === 'failed').length,
    };
    return { rows: [row], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
  }

  // Metrics: department workload counts
  if (cleanSql.includes('FROM departments d') && cleanSql.includes('JOIN videos v')) {
    const counts: Record<string, number> = {};
    Object.values(db.departments).forEach((d: any) => { counts[d.name] = 0; });
    Object.values(db.videos).forEach((v: any) => {
      const d = db.departments[v.department_id];
      if (d) counts[d.name] = (counts[d.name] || 0) + 1;
    });
    const rows = Object.entries(counts).map(([name, count]) => ({ name, count }));
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 1. SELECT departments
  if (cleanSql.startsWith('SELECT * FROM departments') || cleanSql.startsWith('SELECT id, name, code, quota_hours')) {
    const rows = Object.values(db.departments);
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 2. SELECT department by id
  if (cleanSql.includes('FROM departments WHERE id = $1')) {
    const dep = db.departments[params[0]];
    const rows = dep ? [dep] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 3. ATOMIC QUOTA ENFORCEMENT
  // UPDATE departments SET used_hours = used_hours + $1 WHERE id = $2 AND (used_hours + $1 <= quota_hours OR $3 = 'urgent') RETURNING *;
  if (cleanSql.includes('UPDATE departments SET used_hours')) {
    const deltaHours = Number(params[0]);
    const deptId = params[1];
    const isUrgent = params[2] === 'urgent';
    const dept = db.departments[deptId];

    if (dept) {
      const nextUsage = Number(dept.used_hours) + deltaHours;
      if (nextUsage <= Number(dept.quota_hours) || isUrgent) {
        dept.used_hours = nextUsage;
        saveFallbackDb(db);
        return { rows: [dept], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] };
      }
    }
    // Quota exceeded
    return { rows: [], rowCount: 0, command: 'UPDATE', oid: 0, fields: [] };
  }

  // 4. INSERT INTO videos
  if (cleanSql.includes('INSERT INTO videos')) {
    const [id, title, original_name, mime_type, size, hash, department_id, priority, status, upload_progress, is_upload_complete, total_chunks, uploaded_chunks] = params;
    const video = {
      id,
      title,
      original_name,
      mime_type,
      size: Number(size),
      hash,
      department_id,
      priority,
      status: status || 'validation',
      upload_progress: Number(upload_progress || 0),
      is_upload_complete: Boolean(is_upload_complete),
      total_chunks: Number(total_chunks),
      uploaded_chunks: Number(uploaded_chunks || 0),
      duration: 0,
      resolution_360p: null,
      resolution_720p: null,
      resolution_1080p: null,
      thumbnail_url: null,
      preview_strip_url: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.videos[id] = video;
    saveFallbackDb(db);
    return { rows: [video], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 5. SELECT video by hash (Duplicate detection)
  if (cleanSql.includes('FROM videos WHERE hash = $1')) {
    const hash = params[0];
    const excludeId = params[1];
    const match = Object.values(db.videos).find((v: any) => v.hash === hash && v.is_upload_complete && (!excludeId || v.id !== excludeId));
    const rows = match ? [match] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 6. SELECT video by id
  if (cleanSql.includes('FROM videos WHERE id = $1') || cleanSql.includes('WHERE v.id = $1')) {
    const video = db.videos[params[0]];
    const rows = video ? [{ ...video, department_name: db.departments[video.department_id]?.name || 'Computer Science' }] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 7. SELECT all videos
  if (cleanSql.includes('FROM videos')) {
    const rows = Object.values(db.videos)
      .map((v: any) => ({
        ...v,
        department_name: db.departments[v.department_id]?.name || 'Computer Science'
      }))
      .sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 8. UPDATE video status / completion / hash
  if (cleanSql.includes('UPDATE videos SET')) {
    const videoId = params[params.length - 1];
    const video = db.videos[videoId];
    if (video) {
      if (cleanSql.includes('is_upload_complete = TRUE')) {
        video.is_upload_complete = true;
        video.status = 'validation';
        video.upload_progress = 100;
        video.uploaded_chunks = video.total_chunks;
      }
      if (cleanSql.includes('hash = $1')) {
        video.hash = params[0];
      }
      video.updated_at = new Date().toISOString();
      saveFallbackDb(db);
      return { rows: [video], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] };
    }
  }

  // 9. INSERT INTO video_chunks
  if (cleanSql.includes('INSERT INTO video_chunks')) {
    const [video_id, chunk_index, chunk_size, chunk_hash] = params;
    const chunkKey = `${video_id}_${chunk_index}`;
    const chunk = {
      video_id,
      chunk_index: Number(chunk_index),
      chunk_size: Number(chunk_size),
      chunk_hash,
      received_at: new Date().toISOString(),
    };
    db.video_chunks[chunkKey] = chunk;

    // Update video uploaded_chunks count
    const video = db.videos[video_id];
    if (video) {
      const parts = Object.values(db.video_chunks).filter((c: any) => c.video_id === video_id);
      video.uploaded_chunks = parts.length;
      video.upload_progress = Math.min(100, Math.round((video.uploaded_chunks / video.total_chunks) * 100));
      video.updated_at = new Date().toISOString();
    }
    saveFallbackDb(db);
    return { rows: [chunk], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 10. SELECT video_chunks by video_id
  if (cleanSql.includes('FROM video_chunks WHERE video_id = $1')) {
    const video_id = params[0];
    const chunks = Object.values(db.video_chunks)
      .filter((c: any) => c.video_id === video_id)
      .sort((a: any, b: any) => a.chunk_index - b.chunk_index);
    return { rows: chunks, rowCount: chunks.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 11. INSERT INTO jobs
  if (cleanSql.includes('INSERT INTO jobs')) {
    const [id, video_id, stage, status, attempts, max_attempts, department_id, priority] = params;
    const job = {
      id,
      video_id,
      stage,
      status: status || 'pending',
      attempts: attempts || 0,
      max_attempts: max_attempts || 3,
      worker_id: null,
      progress: 0,
      department_id,
      priority: priority || 'standard',
      error: null,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      created_at: new Date().toISOString(),
    };
    db.jobs[id] = job;
    saveFallbackDb(db);
    return { rows: [job], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 12. SELECT job by id
  if (cleanSql.includes('FROM jobs WHERE id = $1')) {
    const job = db.jobs[params[0]];
    const rows = job ? [job] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // Default empty return
  return { rows: [], rowCount: 0, command: 'UNKNOWN', oid: 0, fields: [] };
}
