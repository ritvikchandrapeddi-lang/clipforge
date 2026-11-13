import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { PORT, INSTANCE_ID, STORAGE_DIR, PROCESSED_DIR, UPLOADS_DIR, initStorageDirectories } from './config';
import { initDb } from './db/connection';
import { initRabbitMQ } from './rabbitmq/publisher';
import { uploadRouter } from './routes/upload.routes';
import { videoRouter } from './routes/videos.routes';
import { healthRouter } from './routes/health.routes';

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend Vite client and load balancer
app.use(cors({ origin: true, credentials: true }));

// Parse JSON bodies (for non-chunk routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static processed media files & thumbnails safely from storage
app.use('/media/processed', express.static(PROCESSED_DIR));
app.use('/media/uploads', express.static(UPLOADS_DIR));

// Mount routes
app.use(healthRouter); // /health, /ready, /api/admin/metrics, etc.
app.use('/api/uploads', uploadRouter);
app.use('/api', videoRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Unhandled Error on ${INSTANCE_ID}]`, err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function startServer(): Promise<void> {
  // 1. Initialize persistent storage paths
  initStorageDirectories();

  // 2. Initialize database connection pool & migrations
  await initDb();

  // 3. Declare RabbitMQ queue topology & confirm channels
  await initRabbitMQ();

  // 4. Start HTTP Server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 ClipForge Stateless Web Instance: [${INSTANCE_ID}]`);
    console.log(`📡 Listening on: http://0.0.0.0:${PORT}`);
    console.log(`📂 Shared Storage Mounted: ${STORAGE_DIR}`);
    console.log(`================================================================`);
  });
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log(`[${INSTANCE_ID}] Received SIGTERM. Shutting down gracefully...`);
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log(`[${INSTANCE_ID}] Received SIGINT. Shutting down gracefully...`);
  server.close(() => process.exit(0));
});

startServer().catch((err) => {
  console.error(`[${INSTANCE_ID} Fatal Startup Error]`, err);
  process.exit(1);
});

