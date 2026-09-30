import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  registerTestDevice,
  requestJson,
  startTestServer,
} from '../test-support/server-fixture.js';

test('device reads expose public fields and summary derives dynamic fleet counts', async (t) => {
  const { baseUrl, advanceTime } = await startTestServer(t);
  const timestamp = '2026-09-21T10:30:00Z';
  await registerTestDevice(baseUrl, 'device-01', 'Lab Device 01');
  await registerTestDevice(baseUrl, 'device-02', 'Lab Device 02');
  await registerTestDevice(baseUrl, 'device-03', 'Lab Device 03');
  await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
    status: 'OK',
  });
  await requestJson(baseUrl, 'POST', '/devices/device-02/heartbeat', {
    timestamp,
    status: 'WARNING',
  });

  const list = await requestJson(baseUrl, 'GET', '/devices');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, [
    {
      id: 'device-01',
      name: 'Lab Device 01',
      status: 'ONLINE',
      last_heartbeat: timestamp,
    },
    {
      id: 'device-02',
      name: 'Lab Device 02',
      status: 'ONLINE',
      last_heartbeat: timestamp,
    },
    {
      id: 'device-03',
      name: 'Lab Device 03',
      status: 'OFFLINE',
      last_heartbeat: null,
    },
  ]);
  assert.deepEqual(Object.keys(list.body[0]), ['id', 'name', 'status', 'last_heartbeat']);

  const detail = await requestJson(baseUrl, 'GET', '/devices/device-01');
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body, list.body[0]);

  const summary = await requestJson(baseUrl, 'GET', '/summary');
  assert.deepEqual(summary.body, { total: 3, online: 2, offline: 1 });
  assert.equal(summary.body.online + summary.body.offline, summary.body.total);

  advanceTime(30_001);
  const expiredSummary = await requestJson(baseUrl, 'GET', '/summary');
  assert.deepEqual(expiredSummary.body, { total: 3, online: 0, offline: 3 });
  assert.equal(expiredSummary.body.online + expiredSummary.body.offline, expiredSummary.body.total);

  const unknown = await requestJson(baseUrl, 'GET', '/devices/not-registered');
  assert.equal(unknown.status, 404);
});
