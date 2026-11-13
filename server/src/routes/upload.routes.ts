import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/connection';
import { StorageService } from '../services/storage.service';
import { QuotaService } from '../services/quota.service';
import { CHUNK_SIZE } from '../config';
import { publishToStage } from '../rabbitmq/publisher';

export const uploadRouter = Router();

/**
 * 1. POST /api/uploads/init
 * Initializes a resumable chunk upload session and enforces department quota atomically.
 */
uploadRouter.post('/init', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, originalName, mimeType, size, departmentId, priority } = req.body;

    if (!originalName || !size || !departmentId) {
      res.status(400).json({ error: 'Missing required parameters (originalName, size, departmentId)' });
      return;
    }

    const priorityTier: 'urgent' | 'standard' = priority === 'urgent' ? 'urgent' : 'standard';
    const totalChunks = Math.ceil(Number(size) / CHUNK_SIZE);

    // Atomic quota enforcement
    const quotaCheck = await QuotaService.enforceAndReserveQuota(
      departmentId,
      Number(size),
      priorityTier
    );

    if (!quotaCheck.allowed) {
      res.status(403).json({ error: quotaCheck.error || 'Quota enforcement blocked upload.' });
      return;
    }

    const uploadId = `vid-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const videoTitle = title || originalName.replace(/\.[^/.]+$/, '');

    // Insert pending video record into database
    await query(
      `INSERT INTO videos (
        id, title, original_name, mime_type, size, hash, department_id, 
        priority, status, upload_progress, is_upload_complete, total_chunks, uploaded_chunks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        uploadId,
        videoTitle,
        originalName,
        mimeType || 'video/mp4',
        Number(size),
        'pending', // Hash calculated upon assembly
        departmentId,
        priorityTier,
        'uploading',
        0,
        false,
        totalChunks,
        0,
      ]
    );

    res.status(201).json({
      uploadId,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      departmentId,
      priority: priorityTier,
      message: 'Upload initialized successfully.',
    });
  } catch (err: any) {
    console.error('[Upload Init Error]', err);
    res.status(500).json({ error: `Upload initialization failed: ${err.message}` });
  }
});

/**
 * 2. PUT /api/uploads/:id/parts/:part
 * Streams individual 5MB chunk directly to disk without memory buffering.
 */
uploadRouter.put('/:id/parts/:part', async (req: Request, res: Response): Promise<void> => {
  try {
    const uploadId = req.params.id;
    const partIndex = parseInt(req.params.part, 10);

    if (isNaN(partIndex) || partIndex < 0) {
      res.status(400).json({ error: 'Invalid chunk part index' });
      return;
    }

    // Validate upload ownership & session
    const videoResult = await query('SELECT id, total_chunks, is_upload_complete FROM videos WHERE id = $1', [uploadId]);
    if (videoResult.rowCount === 0) {
      res.status(404).json({ error: 'Upload session not found' });
      return;
    }

    const video = videoResult.rows[0];
    if (video.is_upload_complete) {
      res.status(409).json({ error: 'Upload already completed' });
      return;
    }

    if (partIndex >= video.total_chunks) {
      res.status(400).json({ error: `Part index ${partIndex} exceeds total chunks (${video.total_chunks})` });
      return;
    }

    // Stream chunk directly to disk
    const { size, hash } = await StorageService.saveChunkStream(uploadId, partIndex, req);

    // Record completed chunk in database
    await query(
      `INSERT INTO video_chunks (video_id, chunk_index, chunk_size, chunk_hash) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (video_id, chunk_index) DO UPDATE 
       SET chunk_size = $3, chunk_hash = $4, received_at = CURRENT_TIMESTAMP`,
      [uploadId, partIndex, size, hash]
    );

    res.status(200).json({
      uploadId,
      part: partIndex,
      size,
      chunkHash: hash,
      success: true,
    });
  } catch (err: any) {
    console.error(`[Upload Part ${req.params.part} Error]`, err);
    res.status(500).json({ error: `Failed to store chunk part: ${err.message}` });
  }
});

/**
 * 3. GET /api/uploads/:id/status
 * Retrieves uploaded chunk parts to enable resilient client resume after network interruption.
 */
uploadRouter.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const uploadId = req.params.id;
    const videoResult = await query('SELECT * FROM videos WHERE id = $1', [uploadId]);

    if (videoResult.rowCount === 0) {
      res.status(404).json({ error: 'Upload session not found' });
      return;
    }

    const video = videoResult.rows[0];

    // Read parts from both database and physical filesystem to guarantee recovery
    const diskParts = StorageService.getUploadedPartIndexes(uploadId);
    const dbChunksResult = await query('SELECT chunk_index FROM video_chunks WHERE video_id = $1 ORDER BY chunk_index ASC', [uploadId]);
    const dbParts = dbChunksResult.rows.map((r: any) => r.chunk_index);

    // Merge union of verified parts
    const verifiedParts = Array.from(new Set([...diskParts, ...dbParts])).sort((a, b) => a - b);

    res.status(200).json({
      uploadId: video.id,
      title: video.title,
      isComplete: video.is_upload_complete,
      totalChunks: video.total_chunks,
      uploadedCount: verifiedParts.length,
      uploadedParts: verifiedParts,
      progress: video.upload_progress,
      status: video.status,
    });
  } catch (err: any) {
    console.error('[Upload Status Error]', err);
    res.status(500).json({ error: `Failed to get upload status: ${err.message}` });
  }
});

/**
 * 4. POST /api/uploads/:id/complete
 * Verifies all parts, stitches file sequentially, computes SHA-256 for duplicate detection,
 * and publishes the validation job to RabbitMQ.
 */
uploadRouter.post('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const uploadId = req.params.id;
    const videoResult = await query('SELECT * FROM videos WHERE id = $1', [uploadId]);

    if (videoResult.rowCount === 0) {
      res.status(404).json({ error: 'Upload session not found' });
      return;
    }

    const video = videoResult.rows[0];
    const totalChunks = video.total_chunks;

    // Check all chunks exist on disk
    const diskParts = StorageService.getUploadedPartIndexes(uploadId);
    if (diskParts.length < totalChunks) {
      res.status(400).json({
        error: `Cannot complete upload. Missing chunks: received ${diskParts.length} of ${totalChunks}.`,
        missingParts: Array.from({ length: totalChunks }, (_, i) => i).filter((i) => !diskParts.includes(i)),
      });
      return;
    }

    // Assemble parts sequentially into final file & calculate overall SHA-256
    const { assembledPath, totalSize, sha256 } = await StorageService.assembleChunks(
      uploadId,
      totalChunks,
      video.original_name
    );

    // 10. SHA-256 Duplicate Detection
    const duplicateCheck = await query(
      'SELECT id, title, status FROM videos WHERE hash = $1 AND is_upload_complete = TRUE AND id != $2',
      [sha256, uploadId]
    );

    if (duplicateCheck.rowCount && duplicateCheck.rowCount > 0) {
      const existingVideo = duplicateCheck.rows[0];
      // Mark as duplicate reference
      await query(
        `UPDATE videos 
         SET hash = $1, is_upload_complete = TRUE, upload_progress = 100, status = 'ready', error = 'Duplicate reference' 
         WHERE id = $2`,
        [sha256, uploadId]
      );

      res.status(200).json({
        success: true,
        duplicateDetected: true,
        existingVideoId: existingVideo.id,
        videoId: uploadId,
        sha256,
        message: `Duplicate video detected matching "${existingVideo.title}". Idempotent reference linked without re-processing.`,
      });
      return;
    }

    // Mark video as complete in database
    await query(
      `UPDATE videos 
       SET hash = $1, size = $2, is_upload_complete = TRUE, upload_progress = 100, status = 'validation' 
       WHERE id = $3`,
      [sha256, totalSize, uploadId]
    );

    // Create durable job record
    const jobId = `job-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await query(
      `INSERT INTO jobs (id, video_id, stage, status, attempts, max_attempts, department_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [jobId, uploadId, 'validation', 'pending', 0, 3, video.department_id, video.priority]
    );

    // Dispatch message to RabbitMQ validation queue
    await publishToStage('validation', {
      jobId,
      videoId: uploadId,
      filePath: assembledPath,
      originalName: video.original_name,
      departmentId: video.department_id,
      priority: video.priority,
      attempts: 0,
    });

    res.status(200).json({
      success: true,
      duplicateDetected: false,
      videoId: uploadId,
      jobId,
      sha256,
      message: 'File assembled successfully. Queued for Stage 1 Validation.',
    });
  } catch (err: any) {
    console.error('[Upload Complete Error]', err);
    res.status(500).json({ error: `Failed to complete upload and assemble file: ${err.message}` });
  }
});
