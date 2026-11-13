import path from 'path';
import fs from 'fs';
import { BaseWorker } from './baseWorker';
import { FFmpegHelper } from './ffmpegHelper';
import { PROCESSED_DIR } from './config';
import { query } from './db';

export class ConversionWorker extends BaseWorker {
  constructor(workerId = 'worker-conversion-1', concurrency = 1) {
    super(workerId, 'conversion', concurrency);
  }

  async processTask(payload: any): Promise<{
    success: boolean;
    nextStage?: 'conversion' | 'thumbnail' | 'ready';
    nextPayload?: any;
    error?: string;
  }> {
    const { videoId, filePath, jobId, priority } = payload;
    console.log(`[Conversion Worker] Transcoding multi-bitrate profiles for video: ${videoId}`);

    const out360 = path.join(PROCESSED_DIR, `${videoId}-360p.mp4`);
    const out720 = path.join(PROCESSED_DIR, `${videoId}-720p.mp4`);
    const out1080 = path.join(PROCESSED_DIR, `${videoId}-1080p.mp4`);

    // 1. Idempotency Check: if all profiles already exist on disk, skip redundant encoding
    const alreadyDone = fs.existsSync(out360) && fs.existsSync(out720) && fs.existsSync(out1080);
    if (!alreadyDone) {
      // 2. Generate 360p MP4
      console.log(`[Conversion Worker] Encoding 360p MP4 -> ${out360}`);
      await FFmpegHelper.transcodeToResolution(filePath, out360, 360);
      await query(`UPDATE jobs SET progress = 33 WHERE id = $1`, [jobId]);

      // 3. Generate 720p MP4
      console.log(`[Conversion Worker] Encoding 720p MP4 -> ${out720}`);
      await FFmpegHelper.transcodeToResolution(filePath, out720, 720);
      await query(`UPDATE jobs SET progress = 66 WHERE id = $1`, [jobId]);

      // 4. Generate 1080p MP4
      console.log(`[Conversion Worker] Encoding 1080p MP4 -> ${out1080}`);
      await FFmpegHelper.transcodeToResolution(filePath, out1080, 1080);
      await query(`UPDATE jobs SET progress = 95 WHERE id = $1`, [jobId]);
    } else {
      console.log(`[Conversion Worker] Idempotent skip: profiles for ${videoId} already present.`);
    }

    // 5. Durably persist output paths in database
    const res360Url = `/media/processed/${videoId}-360p.mp4`;
    const res720Url = `/media/processed/${videoId}-720p.mp4`;
    const res1080Url = `/media/processed/${videoId}-1080p.mp4`;

    await query(
      `UPDATE videos 
       SET resolution_360p = $1, resolution_720p = $2, resolution_1080p = $3, status = 'thumbnail', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [res360Url, res720Url, res1080Url, videoId]
    );

    await query(
      `UPDATE jobs SET stage = 'conversion', status = 'completed', progress = 100 WHERE id = $1`,
      [jobId]
    );

    return {
      success: true,
      nextStage: 'thumbnail',
      nextPayload: {
        jobId,
        videoId,
        filePath,
        priority: priority || 'standard',
      },
    };
  }
}

