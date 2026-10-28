/**
 * Migration worker — claims pending Shopify import jobs from Redis and
 * triggers Nest platform migration run via HTTP.
 *
 * Enqueue: LPUSH migration:jobs <jobId>
 * Env: API_URL, PLATFORM_API_KEY, REDIS_URL, QUEUE_NAME (default migration:jobs)
 */
import Redis from 'ioredis';

const QUEUE = process.env.QUEUE_NAME ?? 'migration:jobs';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);
const PLATFORM_KEY =
  process.env.PLATFORM_API_KEY?.trim() || 'ecom-local-platform-key-change-me';
const POLL_MS = Number(process.env.MIGRATE_POLL_MS ?? 5000);

async function runJob(jobId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/v1/platform/migration/jobs/${jobId}/run`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Platform-Key': PLATFORM_KEY,
      },
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`run ${jobId} failed: ${res.status} ${text.slice(0, 400)}`);
  }
  console.log(`[worker-migrate] completed job=${jobId} ${text.slice(0, 200)}`);
}

async function main() {
  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    console.log(
      `[worker-migrate] connected; polling queue=${QUEUE} api=${API_URL}`,
    );
  } catch (err) {
    console.warn(
      '[worker-migrate] redis unavailable:',
      (err as Error).message,
    );
    process.stdin.resume();
    return;
  }

  const tick = async () => {
    try {
      const jobId = await redis.rpop(QUEUE);
      if (!jobId) return;
      console.log(`[worker-migrate] claimed job=${jobId}`);
      await runJob(jobId);
    } catch (err) {
      console.error('[worker-migrate] tick error:', (err as Error).message);
    }
  };

  setInterval(() => {
    void tick();
  }, POLL_MS);

  process.stdin.resume();
}

void main();
