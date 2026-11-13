import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { REDIS_URL } from '../config';

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let isRedisConnected = false;

// Fallback in-process bus for local standalone operation
const localBus = new EventEmitter();
localBus.setMaxListeners(100);

export const CHANNELS = {
  EVENTS: 'clipforge:events',
  METRICS: 'clipforge:metrics',
};

export async function initRedis(): Promise<void> {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => 5000,
      lazyConnect: true,
    });

    await redisClient.connect();
    isRedisConnected = true;
    console.log('[Redis] Connected to shared cache & state store.');

    // Separate connection for Pub/Sub subscriptions
    redisSubscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => 5000,
      lazyConnect: true,
    });
    await redisSubscriber.connect();
  } catch (err: any) {
    console.warn(`[Redis] Redis broker offline (${err.message}). Using shared in-memory pub/sub bus.`);
    isRedisConnected = false;
  }
}

export function isRedisReady(): boolean {
  return isRedisConnected;
}

/**
 * Publish event to all connected web instances for real-time WebSocket broadcast.
 */
export async function publishEvent(channel: string, eventData: any): Promise<void> {
  const payloadStr = JSON.stringify(eventData);

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.publish(channel, payloadStr);
      return;
    } catch (_) {}
  }

  // Fallback to local process bus
  localBus.emit(channel, payloadStr);
}

/**
 * Subscribe to real-time events across web cluster instances.
 */
export async function subscribeToEvents(
  channel: string,
  callback: (data: any) => void
): Promise<void> {
  if (isRedisConnected && redisSubscriber) {
    try {
      await redisSubscriber.subscribe(channel);
      redisSubscriber.on('message', (chan, message) => {
        if (chan === channel) {
          try {
            callback(JSON.parse(message));
          } catch (_) {}
        }
      });
      return;
    } catch (_) {}
  }

  // Fallback
  localBus.on(channel, (payloadStr) => {
    try {
      callback(JSON.parse(payloadStr));
    } catch (_) {}
  });
}
