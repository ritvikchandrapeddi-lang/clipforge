import amqp from 'amqplib';
import { RABBITMQ_URL } from '../config';

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

let connection: any = null;
let confirmChannel: amqp.ConfirmChannel | null = null;
let isConnecting = false;
let rabbitMqAvailable = false;

// Local in-memory backlog for offline dev resilience
const offlinePendingQueue: { stage: string; message: any }[] = [];

export async function initRabbitMQ(): Promise<void> {
  if (isConnecting || confirmChannel) return;
  isConnecting = true;

  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    connection = conn;

    conn.on('error', (err) => {
      console.warn('[RabbitMQ] Connection error:', err.message);
      confirmChannel = null;
      rabbitMqAvailable = false;
      setTimeout(initRabbitMQ, 5000);
    });

    conn.on('close', () => {
      console.warn('[RabbitMQ] Connection closed. Reconnecting in 5s...');
      confirmChannel = null;
      rabbitMqAvailable = false;
      setTimeout(initRabbitMQ, 5000);
    });

    const ch = await conn.createConfirmChannel();
    confirmChannel = ch;

    // Declare Direct Exchanges
    await ch.assertExchange(EXCHANGES.DIRECT, 'direct', { durable: true });
    await ch.assertExchange(EXCHANGES.DLX, 'direct', { durable: true });

    // 1. Validation Stage Queue
    await ch.assertQueue(QUEUES.VALIDATION, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.DLX,
        'x-dead-letter-routing-key': 'deadletter',
      },
    });
    await ch.bindQueue(QUEUES.VALIDATION, EXCHANGES.DIRECT, 'validation');

    // 2. Conversion Stage Queue
    await ch.assertQueue(QUEUES.CONVERSION, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.DLX,
        'x-dead-letter-routing-key': 'deadletter',
      },
    });
    await ch.bindQueue(QUEUES.CONVERSION, EXCHANGES.DIRECT, 'conversion');

    // 3. Thumbnail Stage Queue
    await ch.assertQueue(QUEUES.THUMBNAIL, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.DLX,
        'x-dead-letter-routing-key': 'deadletter',
      },
    });
    await ch.bindQueue(QUEUES.THUMBNAIL, EXCHANGES.DIRECT, 'thumbnail');

    // 4. Retry Delay Queue (TTL backoff routing back to main exchange)
    await ch.assertQueue(QUEUES.RETRY, {
      durable: true,
      arguments: {
        'x-message-ttl': 5000,
        'x-dead-letter-exchange': EXCHANGES.DIRECT,
      },
    });

    // 5. Dead-Letter Sink Queue
    await ch.assertQueue(QUEUES.DLQ, { durable: true });
    await ch.bindQueue(QUEUES.DLQ, EXCHANGES.DLX, 'deadletter');

    rabbitMqAvailable = true;
    console.log('[RabbitMQ] Topology declared successfully with publisher confirms & DLX.');

    // Drain offline queue
    while (offlinePendingQueue.length > 0) {
      const item = offlinePendingQueue.shift();
      if (item) {
        await publishToStage(item.stage, item.message);
      }
    }
  } catch (err: any) {
    console.warn(`[RabbitMQ] Broker offline (${err.message}). Prepared resilient fallback queue.`);
    rabbitMqAvailable = false;
  } finally {
    isConnecting = false;
  }
}

export async function publishToStage(stage: string, message: any): Promise<boolean> {
  const content = Buffer.from(JSON.stringify(message));

  if (!confirmChannel || !rabbitMqAvailable) {
    console.log(`[RabbitMQ Mock Queue] Enqueued job for stage "${stage}" locally. Payload:`, message.jobId || message.id);
    offlinePendingQueue.push({ stage, message });
    return true;
  }

  return new Promise((resolve, reject) => {
    confirmChannel!.publish(
      EXCHANGES.DIRECT,
      stage,
      content,
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        headers: {
          priority: message.priority || 'standard',
          attempts: message.attempts || 0,
        },
      },
      (err) => {
        if (err) {
          console.error(`[RabbitMQ] Publish to ${stage} rejected:`, err);
          offlinePendingQueue.push({ stage, message });
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}

export function isRabbitMqReady(): boolean {
  return rabbitMqAvailable;
}
