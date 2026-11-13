import { Pool, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';
import { DATABASE_URL, DATA_DIR, initWorkerDirectories } from './config';

let pgPool: Pool | null = null;
let useFallbackStorage = false;
let isConnected = false;

const FALLBACK_DB_PATH = path.join(DATA_DIR, 'clipforge_db.json');

function loadFallbackDb(): any {
  initWorkerDirectories();
  if (fs.existsSync(FALLBACK_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf-8'));
    } catch (_) {}
  }
  return { departments: {}, videos: {}, video_chunks: {}, jobs: {}, worker_heartbeats: {}, dead_letter_records: {} };
}

function saveFallbackDb(db: any): void {
  initWorkerDirectories();
  const tmpPath = `${FALLBACK_DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, FALLBACK_DB_PATH);
}

export function parseAndSanitizeDbUrl(rawUrl: string): { connectionString: string; isSsl: boolean } {
  let url = (rawUrl || '').trim();
  const isSsl =
    url.includes('supabase.com') ||
    url.includes('supabase.co') ||
    url.includes('sslmode=') ||
    process.env.PGSSLMODE === 'require';

  const match = url.match(/^postgres(ql)?:\/\/([^:]+):(.+)@([^@]+:\d+\/.*)$/);
  if (match) {
    const user = match[2];
    const rawPass = match[3];
    const rest = match[4];
    url = `postgresql://${encodeURIComponent(decodeURIComponent(user))}:${encodeURIComponent(decodeURIComponent(rawPass))}@${rest}`;
  }

  const cleanUrl = url.replace(/[\?&]sslmode=[^&]+/, '');
  return { connectionString: cleanUrl, isSsl };
}

export async function initWorkerDb(): Promise<void> {
  initWorkerDirectories();
  const { connectionString, isSsl } = parseAndSanitizeDbUrl(DATABASE_URL);

  try {
    pgPool = new Pool({
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    const client = await pgPool.connect();
    client.release();
    isConnected = true;
    useFallbackStorage = false;
  } catch (_) {
    useFallbackStorage = true;
    isConnected = true;
  }
}

export async function query(text: string, params: any[] = []): Promise<QueryResult<any>> {
  if (!useFallbackStorage && pgPool) {
    try {
      return await pgPool.query(text, params);
    } catch (err: any) {
      console.error('[Worker DB Query Error]', err.message);
      throw err;
    }
  }

  const db = loadFallbackDb();
  const cleanSql = text.replace(/\s+/g, ' ').trim();

  // 1. UPDATE jobs (status, progress, worker_id, attempts, error, completed_at)
  if (cleanSql.includes('UPDATE jobs SET')) {
    const jobId = params[params.length - 1];
    const job = db.jobs[jobId];
    if (job) {
      if (cleanSql.includes('status = $1') && cleanSql.includes('progress = $2')) {
        job.status = params[0];
        job.progress = Number(params[1]);
        if (params.length > 2 && cleanSql.includes('worker_id = $3')) job.worker_id = params[2];
      }
      if (cleanSql.includes('progress = 33')) job.progress = 33;
      if (cleanSql.includes('progress = 66')) job.progress = 66;
      if (cleanSql.includes('progress = 95')) job.progress = 95;
      if (cleanSql.includes('stage = \'validation\'') || cleanSql.includes('stage = \'conversion\'') || cleanSql.includes('stage = \'thumbnail\'')) {
        if (cleanSql.includes('stage = \'validation\'')) job.stage = 'validation';
        if (cleanSql.includes('stage = \'conversion\'')) job.stage = 'conversion';
        if (cleanSql.includes('stage = \'thumbnail\'')) job.stage = 'thumbnail';
        job.status = 'completed';
        job.progress = 100;
        job.completed_at = new Date().toISOString();
      }
      if (cleanSql.includes('error = $1') || cleanSql.includes('status = \'failed\'')) {
        job.status = 'failed';
        job.error = params[0];
        job.completed_at = new Date().toISOString();
      }
      job.updated_at = new Date().toISOString();
      saveFallbackDb(db);
      return { rows: [job], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] };
    }
  }

  // 2. UPDATE videos (resolutions, thumbnails, status)
  if (cleanSql.includes('UPDATE videos SET')) {
    const videoId = params[params.length - 1];
    const video = db.videos[videoId];
    if (video) {
      if (cleanSql.includes('resolution_360p = $1')) {
        video.resolution_360p = params[0];
        video.resolution_720p = params[1];
        video.resolution_1080p = params[2];
        if (cleanSql.includes("status = 'thumbnail'")) {
          video.status = 'thumbnail';
        }
      }
      if (cleanSql.includes('thumbnail_url = $1')) {
        video.thumbnail_url = params[0];
        video.preview_strip_url = params[1];
        if (cleanSql.includes("status = 'ready'")) {
          video.status = 'ready';
        }
      }
      if (cleanSql.includes('duration = $1')) {
        video.duration = params[0];
        video.status = 'conversion';
      }
      if (cleanSql.includes('status = \'failed\'')) {
        video.status = 'failed';
        video.error = params[0];
      }
      if (cleanSql.includes('status = $1') && params.length >= 2) {
        video.status = params[0];
      }
      video.updated_at = new Date().toISOString();
      saveFallbackDb(db);
      return { rows: [video], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] };
    }
  }

  // INSERT INTO videos
  if (cleanSql.includes('INSERT INTO videos')) {
    const [id, title, original_name, mime_type, size, hash, department_id, priority, status, is_upload_complete, total_chunks, uploaded_chunks] = params;
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
      upload_progress: 100,
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

  // INSERT INTO jobs
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
      created_at: new Date().toISOString(),
    };
    db.jobs[id] = job;
    saveFallbackDb(db);
    return { rows: [job], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 3. SELECT video by id
  if (cleanSql.includes('FROM videos WHERE id = $1')) {
    const video = db.videos[params[0]];
    const rows = video ? [video] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 4. SELECT job by id
  if (cleanSql.includes('FROM jobs WHERE id = $1')) {
    const job = db.jobs[params[0]];
    const rows = job ? [job] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  }

  // 5. INSERT INTO dead_letter_records
  if (cleanSql.includes('INSERT INTO dead_letter_records')) {
    const [id, job_id, video_id, stage, error, attempts, payload] = params;
    const dlqItem = {
      id,
      job_id,
      video_id,
      stage,
      error,
      attempts: Number(attempts || 3),
      payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
      failed_at: new Date().toISOString(),
      replayed: false,
    };
    db.dead_letter_records[id] = dlqItem;
    saveFallbackDb(db);
    return { rows: [dlqItem], rowCount: 1, command: 'INSERT', oid: 0, fields: [] };
  }

  // 6. UPDATE worker_heartbeats
  if (cleanSql.includes('worker_heartbeats')) {
    const [worker_id, name, stage, status, cpu_usage, memory_mb, current_job_id] = params;
    const hb = {
      worker_id,
      name,
      stage,
      status,
      cpu_usage: Number(cpu_usage || 0),
      memory_mb: Number(memory_mb || 0),
      current_job_id,
      last_heartbeat: new Date().toISOString(),
    };
    db.worker_heartbeats[worker_id] = hb;
    saveFallbackDb(db);
    return { rows: [hb], rowCount: 1, command: 'UPSERT', oid: 0, fields: [] };
  }

  return { rows: [], rowCount: 0, command: 'UNKNOWN', oid: 0, fields: [] };
}
