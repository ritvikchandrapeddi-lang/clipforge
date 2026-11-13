import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export const STAGE = process.env.STAGE || 'all';
export const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);
export const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://clipforge_user:clipforge_secret@localhost:5432/clipforge';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(__dirname, '../../storage');

export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
export const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');
export const DATA_DIR = path.join(STORAGE_DIR, 'data');

export function initWorkerDirectories(): void {
  const dirs = [STORAGE_DIR, UPLOADS_DIR, PROCESSED_DIR, DATA_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

