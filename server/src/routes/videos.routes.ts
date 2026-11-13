import { Router, Request, Response } from 'express';
import { query } from '../db/connection';

export const videoRouter = Router();

/**
 * GET /api/videos
 * Returns searchable, filterable list of videos for Video Library.
 */
videoRouter.get('/videos', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, department, status } = req.query;
    let sql = 'SELECT v.*, d.name as department_name FROM videos v LEFT JOIN departments d ON v.department_id = d.id';
    const params: any[] = [];
    const conditions: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(v.title ILIKE $${params.length} OR v.original_name ILIKE $${params.length})`);
    }

    if (department && department !== 'all') {
      params.push(department);
      conditions.push(`v.department_id = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`v.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY v.created_at DESC';

    const result = await query(sql, params);

    // Format for frontend
    const formatted = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: Number(row.size),
      hash: row.hash,
      departmentId: row.department_id,
      departmentName: row.department_name,
      priority: row.priority,
      status: row.status,
      currentStage: row.status,
      uploadProgress: Number(row.upload_progress),
      isUploadComplete: Boolean(row.is_upload_complete),
      totalChunks: Number(row.total_chunks),
      uploadedChunks: Number(row.uploaded_chunks),
      duration: row.duration || 0,
      resolutions: {
        '360p': row.resolution_360p,
        '720p': row.resolution_720p,
        '1080p': row.resolution_1080p,
      },
      thumbnailUrl: row.thumbnail_url,
      previewStripUrl: row.preview_strip_url,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.status(200).json({ videos: formatted, count: formatted.length });
  } catch (err: any) {
    console.error('[Get Videos Error]', err);
    res.status(500).json({ error: `Failed to fetch videos: ${err.message}` });
  }
});

/**
 * GET /api/videos/:id
 * Returns detailed video record with multi-quality stream links.
 */
videoRouter.get('/videos/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT v.*, d.name as department_name 
       FROM videos v 
       LEFT JOIN departments d ON v.department_id = d.id 
       WHERE v.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      title: row.title,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: Number(row.size),
      hash: row.hash,
      departmentId: row.department_id,
      departmentName: row.department_name,
      priority: row.priority,
      status: row.status,
      uploadProgress: Number(row.upload_progress),
      isUploadComplete: Boolean(row.is_upload_complete),
      totalChunks: Number(row.total_chunks),
      uploadedChunks: Number(row.uploaded_chunks),
      duration: row.duration || 0,
      resolutions: {
        '360p': row.resolution_360p,
        '720p': row.resolution_720p,
        '1080p': row.resolution_1080p,
      },
      thumbnailUrl: row.thumbnail_url,
      previewStripUrl: row.preview_strip_url,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err: any) {
    console.error('[Get Video Error]', err);
    res.status(500).json({ error: `Failed to fetch video: ${err.message}` });
  }
});

/**
 * GET /api/jobs/:id
 * Returns processing job status, stage, attempts and progress.
 */
videoRouter.get('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM jobs WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      videoId: row.video_id,
      stage: row.stage,
      status: row.status,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      workerId: row.worker_id,
      progress: Number(row.progress),
      departmentId: row.department_id,
      priority: row.priority,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
    });
  } catch (err: any) {
    console.error('[Get Job Error]', err);
    res.status(500).json({ error: `Failed to fetch job: ${err.message}` });
  }
});
