import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { INSTANCE_ID } from '../config';
import { subscribeToEvents, publishEvent, isRedisReady, CHANNELS } from '../redis/client';
import { query, isRealPostgresConnected } from '../db/connection';
import { isRabbitMqReady } from '../rabbitmq/publisher';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocketServer(server: http.Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket) => {
    clients.add(ws);
    console.log(`[WebSocket ${INSTANCE_ID}] Client connected. Total active clients: ${clients.size}`);

    // Send immediate state synchronization upon connection
    try {
      const syncPayload = await getInitialSyncPayload();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(syncPayload));
      }
    } catch (err) {
      console.warn(`[WebSocket ${INSTANCE_ID}] Initial sync failed:`, err);
    }

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WebSocket ${INSTANCE_ID}] Client disconnected. Remaining: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.warn(`[WebSocket ${INSTANCE_ID}] Client socket error:`, err.message);
      clients.delete(ws);
    });
  });

  // Subscribe to Redis Pub/Sub events for cluster-wide fanout
  subscribeToEvents(CHANNELS.EVENTS, (eventData) => {
    broadcastToLocalClients(eventData);
  });
}

export function broadcastToLocalClients(data: any): void {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export async function broadcastClusterEvent(type: string, payload: any): Promise<void> {
  const event = {
    type,
    ...payload,
    instanceId: INSTANCE_ID,
    timestamp: new Date().toISOString(),
  };

  // Publish to Redis channel so all web instances fan it out to their browser clients
  await publishEvent(CHANNELS.EVENTS, event);
}

async function getInitialSyncPayload(): Promise<any> {
  const videosResult = await query('SELECT * FROM videos ORDER BY created_at DESC LIMIT 25');
  const jobsResult = await query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 25');
  const deptsResult = await query('SELECT * FROM departments ORDER BY name ASC');
  const dlqResult = await query('SELECT * FROM dead_letter_records ORDER BY failed_at DESC LIMIT 20');

  return {
    type: 'SYNC_ALL',
    instanceId: INSTANCE_ID,
    timestamp: new Date().toISOString(),
    infrastructure: {
      database: isRealPostgresConnected() ? 'connected' : 'disconnected',
      rabbitmq: isRabbitMqReady() ? 'connected' : 'disconnected',
      redis: isRedisReady() ? 'connected' : 'simulated',
    },
    videos: videosResult.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      originalName: r.original_name,
      mimeType: r.mime_type,
      size: Number(r.size),
      hash: r.hash,
      departmentId: r.department_id,
      priority: r.priority,
      status: r.status,
      currentStage: r.status,
      uploadProgress: Number(r.upload_progress || 0),
      isUploadComplete: Boolean(r.is_upload_complete),
      totalChunks: Number(r.total_chunks),
      uploadedChunks: Number(r.uploaded_chunks),
      duration: r.duration || 0,
      resolutions: {
        '360p': r.resolution_360p,
        '720p': r.resolution_720p,
        '1080p': r.resolution_1080p,
      },
      thumbnailUrl: r.thumbnail_url,
      previewStripUrl: r.preview_strip_url,
      error: r.error,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    jobs: jobsResult.rows.map((r: any) => ({
      id: r.id,
      videoId: r.video_id,
      stage: r.stage,
      status: r.status,
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
      workerId: r.worker_id,
      progress: Number(r.progress || 0),
      departmentId: r.department_id,
      priority: r.priority,
      error: r.error,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    })),
    departments: deptsResult.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      quotaHours: Number(r.quota_hours),
      usedHours: Number(r.used_hours),
      priorityWeight: Number(r.priority_multiplier),
      activeJobs: 0,
    })),
    deadLetters: dlqResult.rows.map((r: any) => ({
      id: r.id,
      jobId: r.job_id,
      videoId: r.video_id,
      videoTitle: 'Quarantined Lecture Video',
      stage: r.stage,
      error: r.error,
      attempts: Number(r.attempts),
      timestamp: r.failed_at,
      payload: r.payload,
      replayed: Boolean(r.replayed),
    })),
  };
}

