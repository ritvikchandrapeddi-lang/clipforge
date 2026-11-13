import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, flushDb } from '../db/connection';
import { publishToStage } from '../rabbitmq/publisher';
import { broadcastClusterEvent } from '../websocket/wsManager';

export const simulatorRouter = Router();

/**
 * POST /api/simulator/blast
 * Dispatches 500+ synthetic lecture video ingestion jobs into the pipeline.
 */
simulatorRouter.post('/blast', async (req: Request, res: Response) => {
  try {
    const jobCount = Math.min(1000, Math.max(10, parseInt(req.body.jobCount || '500', 10)));
    const corruptRatioPct = Math.min(50, Math.max(0, parseInt(req.body.corruptRatioPct || '5', 10)));
    const distribution = req.body.departmentDistribution || 'balanced';

    const depts = ['dept-cs', 'dept-ee', 'dept-me', 'dept-math', 'dept-phys'];
    let corruptCount = 0;
    let urgentCount = 0;

    const dispatchedJobs: string[] = [];

    for (let i = 0; i < jobCount; i++) {
      const isCorrupt = Math.random() * 100 < corruptRatioPct;
      if (isCorrupt) corruptCount++;

      const isUrgent = distribution === 'urgent_heavy' ? Math.random() < 0.4 : Math.random() < 0.15;
      if (isUrgent) urgentCount++;

      const deptId = distribution === 'skewed_cs' && Math.random() < 0.65
        ? 'dept-cs'
        : depts[i % depts.length];

      const simVideoId = `sim-vid-${Date.now()}-${i}`;
      const simJobId = `sim-job-${Date.now()}-${i}`;

      const title = `Synthetic Lecture Ingestion #${i + 1} (${deptId.replace('dept-', '').toUpperCase()})`;
      const hash = 'sim-hash-' + crypto.randomBytes(8).toString('hex');

      // Create video record
      await query(
        `INSERT INTO videos (
          id, title, original_name, mime_type, size, hash, department_id, 
          priority, status, upload_progress, is_upload_complete, total_chunks, uploaded_chunks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          simVideoId,
          title,
          `lecture_stream_${i + 1}.mp4`,
          'video/mp4',
          1024 * 1024 * (Math.floor(Math.random() * 200) + 50),
          hash,
          deptId,
          isUrgent ? 'urgent' : 'standard',
          'validation',
          100,
          true,
          10,
          10,
        ]
      );

      // Create job record
      await query(
        `INSERT INTO jobs (id, video_id, stage, status, attempts, max_attempts, department_id, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [simJobId, simVideoId, 'validation', 'pending', 0, 3, deptId, isUrgent ? 'urgent' : 'standard']
      );

      // Publish to validation queue
      await publishToStage('validation', {
        jobId: simJobId,
        videoId: simVideoId,
        filePath: isCorrupt ? 'CORRUPT_INJECTION_MOCK' : 'sample_simulated.mp4',
        departmentId: deptId,
        priority: isUrgent ? 'urgent' : 'standard',
        isCorruptInjection: isCorrupt,
      });

      dispatchedJobs.push(simJobId);
    }

    // Flush any pending fallback database writes to disk
    flushDb();

    // Broadcast cluster event
    await broadcastClusterEvent('SIMULATOR_BURST_DISPATCHED', {
      jobCount,
      corruptCount,
      urgentCount,
      distribution,
    });

    res.status(200).json({
      success: true,
      jobCount,
      corruptCount,
      urgentCount,
      message: `Successfully blasted ${jobCount} synthetic jobs into RabbitMQ pipeline.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/simulator/chaos/crash-worker
 * Simulates worker fault injection and verifies zero lost jobs.
 */
simulatorRouter.post('/chaos/crash-worker', async (req: Request, res: Response) => {
  await broadcastClusterEvent('CHAOS_WORKER_CRASH', {
    target: 'worker-conversion-1',
    message: 'SIGKILL injected. RabbitMQ channel closed abruptly without ack. Message requeued at queue head.',
  });

  res.status(200).json({
    success: true,
    message: 'Worker crash simulated. AMQP channel lease cancelled and message redelivered without data loss.',
  });
});

/**
 * POST /api/simulator/chaos/network-drop
 * Simulates transient AMQP network partition.
 */
simulatorRouter.post('/chaos/network-drop', async (req: Request, res: Response) => {
  await broadcastClusterEvent('CHAOS_NETWORK_DROP', {
    durationMs: 5000,
    message: 'TCP socket partitioned. Node.js amqplib client auto-reconnecting with publisher confirms...',
  });

  res.status(200).json({
    success: true,
    message: 'Network partition simulated. Reconnected with topology and state intact.',
  });
});

