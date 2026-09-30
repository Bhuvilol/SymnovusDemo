import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRedisStore, createRedisStoreWithClient } from '../src/redis-store.js';

// Mimics the Upstash client: hash values written as JSON strings come back parsed.
function createFakeRedis() {
  const hashes = new Map();
  const counters = new Map();
  const hash = (key) => {
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key);
  };

  return {
    async incr(key) {
      counters.set(key, (counters.get(key) ?? 0) + 1);
      return counters.get(key);
    },
    async hget(key, field) {
      const value = hash(key).get(field);
      return value === undefined ? null : JSON.parse(value);
    },
    async hgetall(key) {
      const entries = hash(key);
      if (entries.size === 0) return null;
      return Object.fromEntries([...entries].map(([field, value]) => [field, JSON.parse(value)]));
    },
    async hsetnx(key, field, value) {
      if (hash(key).has(field)) return 0;
      hash(key).set(field, value);
      return 1;
    },
    async hdel(key, field) {
      return hash(key).delete(field) ? 1 : 0;
    },
    // Emulates the store's only script: write the field only if it already exists.
    async eval(script, [key], [field, value]) {
      if (!hash(key).has(field)) return 0;
      hash(key).set(field, value);
      return 1;
    },
  };
}

test('redis store is only used when credentials are configured', () => {
  assert.equal(createRedisStore({}), null);
  assert.ok(createRedisStore({ KV_REST_API_URL: 'https://example.upstash.io', KV_REST_API_TOKEN: 'token' }));
});

test('redis store registers, rejects duplicates, orders devices, and records heartbeats', async () => {
  const store = createRedisStoreWithClient(createFakeRedis());

  assert.deepEqual(await store.getDevices(), []);
  assert.equal(await store.getDevice('device-01'), undefined);

  await store.registerDevice('device-02', 'Lab Device 02');
  await store.registerDevice('device-01', 'Lab Device 01');
  assert.equal(await store.registerDevice('device-01', 'Duplicate'), null);

  const devices = await store.getDevices();
  assert.deepEqual(devices.map((device) => device.id), ['device-02', 'device-01']);
  assert.equal(devices[1].name, 'Lab Device 01');

  const device = await store.getDevice('device-01');
  const updated = await store.recordHeartbeat(device, '2026-09-21T10:30:00Z', 'OK', 1_000);
  assert.deepEqual(updated.lastHeartbeat, { timestamp: '2026-09-21T10:30:00Z', status: 'OK' });

  const stored = await store.getDevice('device-01');
  assert.equal(stored.lastHeartbeatReceivedAt, 1_000);
  assert.equal(stored.lastHeartbeat.status, 'OK');
});

test('redis store removes devices and does not let a late heartbeat recreate them', async () => {
  const store = createRedisStoreWithClient(createFakeRedis());
  await store.registerDevice('device-01', 'Lab Device 01');
  const device = await store.getDevice('device-01');

  assert.equal(await store.removeDevice('device-01'), true);
  assert.equal(await store.removeDevice('device-01'), false);

  // A heartbeat that looked the device up before the removal must not write it back.
  assert.equal(await store.recordHeartbeat(device, '2026-09-21T10:30:00Z', 'OK', 1_000), null);
  assert.equal(await store.getDevice('device-01'), undefined);
  assert.deepEqual(await store.getDevices(), []);
});
