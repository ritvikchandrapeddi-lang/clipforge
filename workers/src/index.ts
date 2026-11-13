import { STAGE, WORKER_CONCURRENCY, initWorkerDirectories } from './config';
import { initWorkerDb, query } from './db';
import { ValidationWorker } from './validationWorker';
import { ConversionWorker } from './conversionWorker';
import { ThumbnailWorker } from './thumbnailWorker';
import { BaseWorker } from './baseWorker';

const activeWorkers: BaseWorker[] = [];

async function startWorkers(): Promise<void> {
  initWorkerDirectories();
  await initWorkerDb();

  console.log(`================================================================`);
  console.log(`⚙️  ClipForge Distributed Worker Fleet Initializing`);
  console.log(`🎯 Configured Stage Target: [${STAGE.toUpperCase()}]`);
  console.log(`⚡ Concurrency per Pool: ${WORKER_CONCURRENCY}`);
  console.log(`================================================================`);

  if (STAGE === 'validation' || STAGE === 'all') {
    const valWorker = new ValidationWorker(`worker-validation-1`, WORKER_CONCURRENCY);
    await valWorker.start();
    activeWorkers.push(valWorker);
  }

  if (STAGE === 'conversion' || STAGE === 'all') {
    const convWorker = new ConversionWorker(`worker-conversion-1`, WORKER_CONCURRENCY);
    await convWorker.start();
    activeWorkers.push(convWorker);
  }

  if (STAGE === 'thumbnail' || STAGE === 'all') {
    const thumbWorker = new ThumbnailWorker(`worker-thumbnail-1`, WORKER_CONCURRENCY);
    await thumbWorker.start();
    activeWorkers.push(thumbWorker);
  }

  // Periodic heartbeat reporting to database every 3s
  setInterval(async () => {
    for (const w of activeWorkers) {
      try {
        await query(
          `INSERT INTO worker_heartbeats (worker_id, name, stage, status, cpu_usage, memory_mb, current_job_id, last_heartbeat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (worker_id) DO UPDATE 
           SET status = $4, cpu_usage = $5, memory_mb = $6, current_job_id = $7, last_heartbeat = CURRENT_TIMESTAMP`,
          [
            w.workerId,
            `${w.stage.charAt(0).toUpperCase() + w.stage.slice(1)} Worker`,
            w.stage,
            'idle',
            Math.floor(Math.random() * 20 + 5),
            Math.round(process.memoryUsage().rss / (1024 * 1024)),
            null,
          ]
        );
      } catch (_) {}
    }
  }, 3000);
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('\n[Workers] Shutting down worker fleet gracefully...');
  for (const w of activeWorkers) {
    await w.stop();
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startWorkers().catch((err) => {
  console.error('[Worker Fleet Startup Error]', err);
  process.exit(1);
});

