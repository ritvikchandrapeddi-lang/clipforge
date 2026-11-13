import path from 'path';
import fs from 'fs';
import { BaseWorker } from './baseWorker';
import { FFmpegHelper } from './ffmpegHelper';
import { PROCESSED_DIR } from './config';
import { query } from './db';

export class ThumbnailWorker extends BaseWorker {
  constructor(workerId = 'worker-thumbnail-1', concurrency = 1) {
    super(workerId, 'thumbnail', concurrency);
  }

  async processTask(payload: any): Promise<{
    success: boolean;
    nextStage?: 'conversion' | 'thumbnail' | 'ready';
    nextPayload?: any;
    error?: string;
  }> {
    const { videoId, filePath, jobId } = payload;
    console.log(`[Thumbnail Worker] Extracting poster & timeline sprites for video: ${videoId}`);

    const thumbPath = path.join(PROCESSED_DIR, `${videoId}-thumb.jpg`);
    const previewPath = path.join(PROCESSED_DIR, `${videoId}-preview.jpg`);

    // 1. Generate Poster Thumbnail
    await FFmpegHelper.generateThumbnail(filePath, thumbPath);

    // 2. Generate Timeline Preview Strip Sprite
    await FFmpegHelper.generatePreviewStrip(filePath, previewPath);

    const thumbUrl = `/media/processed/${videoId}-thumb.jpg`;
    const previewUrl = `/media/processed/${videoId}-preview.jpg`;

    // 3. Mark video as 'ready' (Playable in player and library)
    await query(
      `UPDATE videos 
       SET thumbnail_url = $1, preview_strip_url = $2, status = 'ready', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [thumbUrl, previewUrl, videoId]
    );

    // 4. Mark job as complete
    await query(
      `UPDATE jobs 
       SET stage = 'thumbnail', status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [jobId]
    );

    console.log(`[Thumbnail Worker] Video ${videoId} is now fully transcoded and READY.`);

    return {
      success: true,
      nextStage: 'ready',
    };
  }
}

