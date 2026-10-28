import Redis from 'ioredis';

export function createRedisClient(url = process.env.REDIS_URL ?? 'redis://localhost:6379') {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
}
