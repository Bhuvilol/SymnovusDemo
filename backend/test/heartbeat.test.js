import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  registerTestDevice,
  requestJson,
  startTestServer,
} from '../test-support/server-fixture.js';

test('validates heartbeat ownership, timestamp, and status', async (t) => {
  const { baseUrl } = await startTestServer(t);
  const timestamp = '2026-09-21T10:30:00Z';
  await registerTestDevice(baseUrl, 'device-01');

  const unknown = await requestJson(baseUrl, 'POST', '/devices/unregistered/heartbeat', {
    timestamp,
    status: 'OK',
  });
  const invalidTimestamp = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp: 'not-a-date',
    status: 'OK',
  });
  const invalidStatus = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
    status: '  ',
  });
  const missingStatus = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
  });
  const invalidStatusType = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
    status: 7,
  });
  const heartbeat = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp,
    status: 'OK',
  });
  const customStatus = await requestJson(baseUrl, 'POST', '/devices/device-01/heartbeat', {
    timestamp: '2026-09-21T10:30:01Z',
    status: 'CUSTOM_STATUS',
  });

  assert.equal(unknown.status, 404);
  assert.equal(invalidTimestamp.status, 400);
  assert.equal(invalidStatus.status, 400);
  assert.equal(missingStatus.status, 400);
  assert.equal(invalidStatusType.status, 400);
  for (const response of [unknown, invalidTimestamp, invalidStatus, missingStatus, invalidStatusType]) {
    assert.equal(typeof response.body.error.code, 'string');
    assert.equal(typeof response.body.error.message, 'string');
  }

  assert.equal(heartbeat.status, 200);
  assert.deepEqual(heartbeat.body, {
    id: 'device-01',
    name: 'Lab Device 01',
    status: 'ONLINE',
    last_heartbeat: timestamp,
  });
  assert.equal(customStatus.status, 200);
  assert.equal(customStatus.body.status, 'ONLINE');
});
