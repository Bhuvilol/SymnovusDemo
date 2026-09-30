import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTestDevice, requestJson, startTestServer } from '../test-support/server-fixture.js';

async function removeTestDevice(baseUrl, id) {
  const response = await fetch(`${baseUrl}/devices/${id}`, { method: 'DELETE' });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

test('removing a device deletes it from reads, summary, and heartbeats', async (t) => {
  const { baseUrl } = await startTestServer(t);
  await registerTestDevice(baseUrl, 'device-01', 'Lab Device 01');
  await registerTestDevice(baseUrl, 'device-02', 'Lab Device 02');
  await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp: '2026-09-21T10:30:00Z',
    status: 'OK',
  });

  const removed = await removeTestDevice(baseUrl, 'device-01');
  assert.equal(removed.status, 204);
  assert.equal(removed.body, null);

  const detail = await requestJson(baseUrl, 'GET', '/devices/device-01');
  const list = await requestJson(baseUrl, 'GET', '/devices');
  const summary = await requestJson(baseUrl, 'GET', '/summary');
  const heartbeat = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp: '2026-09-21T10:30:05Z',
    status: 'OK',
  });

  assert.equal(detail.status, 404);
  assert.deepEqual(list.body.map((device) => device.id), ['device-02']);
  assert.deepEqual(summary.body, { total: 1, online: 0, offline: 1 });
  assert.equal(heartbeat.status, 404);
  assert.equal(heartbeat.body.error.code, 'DEVICE_NOT_FOUND');
});

test('removing an unknown device returns 404, and a removed ID can be registered again', async (t) => {
  const { baseUrl } = await startTestServer(t);

  const unknown = await removeTestDevice(baseUrl, 'missing-device');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'DEVICE_NOT_FOUND');

  await registerTestDevice(baseUrl, 'device-01', 'Lab Device 01');
  await removeTestDevice(baseUrl, 'device-01');
  const again = await removeTestDevice(baseUrl, 'device-01');
  const reregistered = await registerTestDevice(baseUrl, 'device-01', 'Replacement Device');

  assert.equal(again.status, 404);
  assert.equal(reregistered.status, 201);
  assert.deepEqual(reregistered.body, {
    id: 'device-01',
    name: 'Replacement Device',
    status: 'OFFLINE',
    last_heartbeat: null,
  });
});
