import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { publishToStage } from '../rabbitmq/publisher';
import { broadcastClusterEvent } from '../websocket/wsManager';

export const dlqRouter = Router();

/**
 * GET /api/deadletter
 * Lists quarantined dead-lettered jobs with error reasons and attempt records.
 */
dlqRouter.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT dl.*, v.title as video_title 
      FROM dead_letter_records dl 
      LEFT JOIN videos v ON dl.video_id = v.id 
      ORDER BY dl.failed_at DESC
    `);

    const items = result.rows.map((r: any) => ({
      id: r.id,
      jobId: r.job_id,
      videoId: r.video_id,
      videoTitle: r.video_title || 'Quarantined Media File',
      stage: r.stage,
      error: r.error,
      attempts: Number(r.attempts),
      timestamp: r.failed_at,
      payload: r.payload,
      replayed: Boolean(r.replayed),
    }));

    res.status(200).json({ deadLetters: items, count: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deadletter/:id/replay
 * Replays a quarantined job back into primary RabbitMQ stage queue with reset attempts.
 */
dlqRouter.post('/:id/replay', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM dead_letter_records WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Dead letter record not found' });
      return;
    }

    const item = result.rows[0];
    const payload = item.payload || {};

    // Reset attempt counter for fair replay
    payload.attempts = 0;
    payload.isReplayed = true;

    // Publish back to stage exchange
    await publishToStage(item.stage, payload);

    // Update record as replayed in database
    await query('UPDATE dead_letter_records SET replayed = TRUE WHERE id = $1', [id]);

    // Update job status back to pending
    await query("UPDATE jobs SET status = 'pending', error = NULL, attempts = 0 WHERE id = $1", [item.job_id]);

    // Broadcast live event via WebSockets
    await broadcastClusterEvent('DLQ_REPLAYED', { deadLetterId: id, jobId: item.job_id });

    res.status(200).json({
      success: true,
      message: `Job ${item.job_id} successfully replayed to queue "clipforge.stage.${item.stage}".`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/deadletter/replay-all
 * Batch replays all eligible dead letters.
 */
dlqRouter.post('/replay-all', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM dead_letter_records WHERE replayed = FALSE');
    let replayedCount = 0;

    for (const item of result.rows) {
      const payload = item.payload || {};
      payload.attempts = 0;
      payload.isReplayed = true;

      await publishToStage(item.stage, payload);
      await query('UPDATE dead_letter_records SET replayed = TRUE WHERE id = $1', [item.id]);
      await query("UPDATE jobs SET status = 'pending', error = NULL, attempts = 0 WHERE id = $1", [item.job_id]);
      replayedCount++;
    }

    await broadcastClusterEvent('DLQ_BATCH_REPLAYED', { count: replayedCount });

    res.status(200).json({
      success: true,
      replayedCount,
      message: `Batch replayed ${replayedCount} dead letter jobs.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
