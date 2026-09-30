import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialTime,
  registerTestDevice,
  requestJson,
  startTestServer,
} from '../test-support/server-fixture.js';

test('uses fake server time at registration, heartbeat, and the 30-second boundary', async (t) => {
  const { baseUrl, advanceTime } = await startTestServer(t);
  const timestamp = new Date(initialTime).toISOString();
  const registration = await registerTestDevice(baseUrl, 'device-01');
  await registerTestDevice(baseUrl, 'never-heartbeated-device', 'Never Heartbeated');
  assert.equal(registration.body.status, 'OFFLINE');

  const heartbeat = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
    status: 'OK',
  });
  assert.equal(heartbeat.body.status, 'ONLINE');

  advanceTime(30_000);
  const atBoundary = await requestJson(baseUrl, 'GET', '/devices/device-01');
  assert.equal(atBoundary.body.status, 'ONLINE');

  advanceTime(1_000);
  const after31Seconds = await requestJson(baseUrl, 'GET', '/devices/device-01');
  const noHeartbeat = await requestJson(baseUrl, 'GET', '/devices/never-heartbeated-device');
  const summary = await requestJson(baseUrl, 'GET', '/summary');
  assert.equal(after31Seconds.body.status, 'OFFLINE');
  assert.equal(noHeartbeat.body.status, 'OFFLINE');
  assert.deepEqual(summary.body, { total: 2, online: 0, offline: 2 });
});
