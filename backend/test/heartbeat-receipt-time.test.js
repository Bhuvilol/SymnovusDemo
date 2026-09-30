import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialTime,
  registerTestDevice,
  requestJson,
  startTestServer,
} from '../test-support/server-fixture.js';

test('connectivity uses server receipt time instead of the supplied device timestamp', async (t) => {
  const { baseUrl, advanceTime } = await startTestServer(t);
  await registerTestDevice(baseUrl, 'device-01');

  const oldTimestamp = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp: '2020-01-01T00:00:00Z',
    status: 'OK',
  });
  assert.equal(oldTimestamp.body.status, 'ONLINE');
  assert.equal(oldTimestamp.body.last_heartbeat, '2020-01-01T00:00:00Z');

  advanceTime(31_000);
  const oldHeartbeatExpired = await requestJson(baseUrl, 'GET', '/devices/device-01');
  assert.equal(oldHeartbeatExpired.body.status, 'OFFLINE');

  const futureTimestamp = new Date(initialTime + 31_000 + 100 * 365 * 24 * 60 * 60 * 1_000).toISOString();
  const futureHeartbeat = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp: futureTimestamp,
    status: 'OK',
  });
  assert.equal(futureHeartbeat.body.status, 'ONLINE');
  assert.equal(futureHeartbeat.body.last_heartbeat, futureTimestamp);

  advanceTime(31_000);
  const futureHeartbeatExpired = await requestJson(baseUrl, 'GET', '/devices/device-01');
  assert.equal(futureHeartbeatExpired.body.status, 'OFFLINE');
});
