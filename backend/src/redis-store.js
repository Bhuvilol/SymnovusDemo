import { Redis } from '@upstash/redis';

const DEVICES_KEY = 'fleet:devices';
const SEQUENCE_KEY = 'fleet:sequence';

// Writes the heartbeat only if the device still exists, so a heartbeat racing a
// removal cannot recreate the removed device.
const RECORD_IF_REGISTERED = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
  return 1
end
return 0
`;

// Serverless deployments run many short-lived instances, so device state must
// live outside the process. Returns null when no Redis credentials are set.
export function createRedisStore(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return createRedisStoreWithClient(new Redis({ url, token }));
}

function toDevice(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  return typeof value === 'string' ? JSON.parse(value) : value;
}

export function createRedisStoreWithClient(redis) {
  return {
    async getDevice(id) {
      return toDevice(await redis.hget(DEVICES_KEY, id));
    },

    async getDevices() {
      const entries = await redis.hgetall(DEVICES_KEY);
      return Object.values(entries ?? {})
        .map(toDevice)
        .sort((a, b) => a.sequence - b.sequence);
    },

    async registerDevice(id, name) {
      const device = {
        id,
        name,
        lastHeartbeat: null,
        lastHeartbeatReceivedAt: null,
        sequence: await redis.incr(SEQUENCE_KEY),
      };

      // HSETNX makes duplicate detection atomic across concurrent instances.
      const created = await redis.hsetnx(DEVICES_KEY, id, JSON.stringify(device));
      return created ? device : null;
    },

    async removeDevice(id) {
      return (await redis.hdel(DEVICES_KEY, id)) === 1;
    },

    async recordHeartbeat(device, timestamp, status, receivedAt) {
      const updated = {
        ...device,
        lastHeartbeat: { timestamp, status },
        lastHeartbeatReceivedAt: receivedAt,
      };

      const saved = await redis.eval(
        RECORD_IF_REGISTERED,
        [DEVICES_KEY],
        [device.id, JSON.stringify(updated)],
      );
      return saved === 1 ? updated : null;
    },
  };
}
