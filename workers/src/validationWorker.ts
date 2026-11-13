import { BaseWorker } from './baseWorker';
import { FFmpegHelper } from './ffmpegHelper';
import { query } from './db';

export class ValidationWorker extends BaseWorker {
  constructor(workerId = 'worker-validation-1', concurrency = 1) {
    super(workerId, 'validation', concurrency);
  }

  async processTask(payload: any): Promise<{
    success: boolean;
    nextStage?: 'conversion' | 'thumbnail' | 'ready';
    nextPayload?: any;
    error?: string;
  }> {
    const { videoId, filePath, jobId, priority } = payload;
    console.log(`[Validation Worker] Validating file integrity for video: ${videoId}`);

    const probe = await FFmpegHelper.probeVideo(filePath);

    if (probe.isCorrupt) {
      console.warn(`[Validation Worker] Corrupted video detected (${probe.errorReason}). Marking job failed.`);
      await query(
        `UPDATE videos SET status = 'failed', error = $1 WHERE id = $2`,
        [probe.errorReason || 'Video validation failed', videoId]
      );
      return {
        success: false,
        error: probe.errorReason || 'Video container corruption detected',
      };
    }

    // Update video duration and move status to conversion
    await query(
      `UPDATE videos SET duration = $1, status = 'conversion', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [probe.duration, videoId]
    );

    // Update validation stage job completion
    await query(
      `UPDATE jobs SET stage = 'validation', status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [jobId]
    );

    return {
      success: true,
      nextStage: 'conversion',
      nextPayload: {
        jobId,
        videoId,
        filePath,
        duration: probe.duration,
        priority: priority || 'standard',
      },
    };
  }
}
