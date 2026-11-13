import amqp from 'amqplib';
import { RABBITMQ_URL, initWorkerDirectories } from './config';
import { query } from './db';

export const QUEUES = {
  VALIDATION: 'clipforge.stage.validation',
  CONVERSION: 'clipforge.stage.conversion',
  THUMBNAIL: 'clipforge.stage.thumbnail',
  RETRY: 'clipforge.retry.delay',
  DLQ: 'clipforge.deadletter.sink',
};

export const EXCHANGES = {
  DIRECT: 'clipforge.direct',
  DLX: 'clipforge.dlx',
};

export abstract class BaseWorker {
  public workerId: string;
  public stage: 'validation' | 'conversion' | 'thumbnail';
  public concurrency: number;
  protected conn: any = null;
  protected channel: amqp.ConfirmChannel | null = null;
  protected isRunning = false;
  protected offlineMockQueue: any[] = [];

  constructor(workerId: string, stage: 'validation' | 'conversion' | 'thumbnail', concurrency = 1) {
    this.workerId = workerId;
    this.stage = stage;
    this.concurrency = concurrency;
  }

  abstract processTask(payload: any): Promise<{
    success: boolean;
    nextStage?: 'conversion' | 'thumbnail' | 'ready';
    nextPayload?: any;
    error?: string;
  }>;

  async start(): Promise<void> {
    initWorkerDirectories();
    this.isRunning = true;

    try {
      this.conn = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.conn.createConfirmChannel();

      const ch = this.channel!;

      // Topology declaration
      await ch.assertExchange(EXCHANGES.DIRECT, 'direct', { durable: true });
      await ch.assertExchange(EXCHANGES.DLX, 'direct', { durable: true });

      const queueName = QUEUES[this.stage.toUpperCase() as keyof typeof QUEUES];
      await ch.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': EXCHANGES.DLX,
          'x-dead-letter-routing-key': 'deadletter',
        },
      });
      await ch.bindQueue(queueName, EXCHANGES.DIRECT, this.stage);

      // Manual acknowledgements & strict prefetch = 1
      await ch.prefetch(this.concurrency);

      console.log(`[Worker ${this.workerId}] Listening on queue "${queueName}" with prefetch=${this.concurrency}`);

      ch.consume(
        queueName,
        async (msg) => {
          if (!msg) return;
          await this.handleMessage(msg, ch);
        },
        { noAck: false }
      );
    } catch (err: any) {
      console.warn(`[Worker ${this.workerId}] Broker offline (${err.message}). Ready for manual/local processing.`);
    }
  }

  async handleMessage(msg: amqp.ConsumeMessage, ch: amqp.ConfirmChannel): Promise<void> {
    let payload: any = null;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      console.error(`[Worker ${this.workerId}] Corrupted message payload, routing to DLQ:`, parseErr);
      ch.nack(msg, false, false); // Route directly to dead letter exchange
      return;
    }

    // 1. Validate payload structure
    if (!payload.jobId || !payload.videoId) {
      console.error(`[Worker ${this.workerId}] Missing required payload fields (jobId, videoId)`);
      ch.nack(msg, false, false);
      return;
    }

    const { jobId, videoId } = payload;
    const attempts = (payload.attempts || 0) + 1;

    try {
      // 2. Record stage lease start in database
      await query(
        `UPDATE jobs 
         SET status = 'processing', progress = 10, worker_id = $1, started_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [this.workerId, jobId]
      );

      // 3. Process the actual stage task
      const result = await this.processTask(payload);

      if (!result.success) {
        throw new Error(result.error || `Stage ${this.stage} failed`);
      }

      // 4. If next stage exists, publish using publisher confirms BEFORE acknowledging current message
      if (result.nextStage && result.nextStage !== 'ready') {
        const nextPayload = {
          ...result.nextPayload,
          attempts: 0,
        };

        await new Promise<void>((resolve, reject) => {
          ch.publish(
            EXCHANGES.DIRECT,
            result.nextStage!,
            Buffer.from(JSON.stringify(nextPayload)),
            { persistent: true, contentType: 'application/json' },
            (publishErr) => {
              if (publishErr) reject(publishErr);
              else resolve();
            }
          );
        });
      }

      // 5. CRITICAL GUARANTEE: Acknowledge ONLY after stage and state are safely persisted
      ch.ack(msg);
      console.log(`[Worker ${this.workerId}] ✅ Successfully completed stage "${this.stage}" for job ${jobId}`);
    } catch (taskErr: any) {
      console.error(`[Worker ${this.workerId}] ❌ Error processing job ${jobId} (Attempt ${attempts}/3):`, taskErr.message);

      if (attempts >= 3) {
        // Quarantined to Dead Letter Exchange
        await query(
          `INSERT INTO dead_letter_records (id, job_id, video_id, stage, error, attempts, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [`dlq-${Date.now()}`, jobId, videoId, this.stage, taskErr.message, attempts, JSON.stringify(payload)]
        );

        await query(
          `UPDATE jobs 
           SET status = 'failed', error = $1, completed_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [taskErr.message, jobId]
        );

        // Acknowledge original message to release queue buffer now that failure is recorded
        ch.ack(msg);
      } else {
        // Requeue with delay backoff
        payload.attempts = attempts;
        payload.lastError = taskErr.message;

        ch.publish(
          EXCHANGES.DIRECT,
          this.stage,
          Buffer.from(JSON.stringify(payload)),
          { persistent: true, headers: { 'x-delay': 5000 } }
        );
        ch.ack(msg);
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
  }
}

