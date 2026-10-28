/**
 * Phase 0: empty job runner — Redis connection + noop consumer.
 * Queue wiring lands with outbox / abandon / DSAR / email / migrate jobs.
 */
import Redis from 'ioredis';

const QUEUE = process.env.QUEUE_NAME ?? 'worker-migrate';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function main() {
  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    console.log('[worker-migrate] connected to redis; noop consumer on queue=' + QUEUE);
  } catch (err) {
    console.warn('[worker-migrate] redis unavailable (ok for Phase 0 scaffold):', (err as Error).message);
  }

  // Noop poll loop placeholder
  setInterval(() => {
    // claim jobs later
  }, 60_000);

  // Keep process alive in dev without busy loop
  process.stdin.resume();
}

void main();
