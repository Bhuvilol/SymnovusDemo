import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialTime,
  registerTestDevice,
  requestJson,
  startTestServer,
} from '../test-support/server-fixture.js';

test('status remains online through 30 seconds and turns offline afterward', async (t) => {
  const { baseUrl, advanceTime } = await startTestServer(t);
  const timestamp = new Date(initialTime).toISOString();
  await registerTestDevice(baseUrl, 'device-01');
  await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
    status: 'OK',
  });

  advanceTime(30_000);
  const atBoundary = await requestJson(baseUrl, 'GET', '/devices/device-01');
  assert.equal(atBoundary.body.status, 'ONLINE');

  advanceTime(1);
  const afterBoundary = await requestJson(baseUrl, 'GET', '/devices/device-01');
  assert.equal(afterBoundary.body.status, 'OFFLINE');
});
