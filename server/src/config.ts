import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '4001', 10);
export const INSTANCE_ID = process.env.INSTANCE_ID || `web-instance-${PORT === 4002 ? '2' : '1'}`;
export const NODE_ENV = process.env.NODE_ENV || 'development';

// 5MB Standard chunk size as required
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5,242,880 bytes

// Shared Storage directory configuration
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(__dirname, '../../storage');

export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
export const TEMP_CHUNKS_DIR = path.join(STORAGE_DIR, 'temp_chunks');
export const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');
export const DATA_DIR = path.join(STORAGE_DIR, 'data');

// Database, RabbitMQ and Redis URLs
export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://clipforge_user:clipforge_secret@localhost:5432/clipforge';
export const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Ensure shared storage directories exist at startup
export function initStorageDirectories(): void {
  const dirs = [STORAGE_DIR, UPLOADS_DIR, TEMP_CHUNKS_DIR, PROCESSED_DIR, DATA_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
