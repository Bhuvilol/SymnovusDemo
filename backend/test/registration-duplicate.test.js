import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTestDevice, requestJson, startTestServer } from '../test-support/server-fixture.js';

test('duplicate registration returns conflict without overwriting the device', async (t) => {
  const { baseUrl } = await startTestServer(t);
  const first = await registerTestDevice(baseUrl, 'device-01', 'Lab Device 01');
  const duplicate = await registerTestDevice(baseUrl, 'device-01', 'Replacement Name');
  const existing = await requestJson(baseUrl, 'GET', '/devices/device-01');

  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 409);
  assert.deepEqual(existing.body, {
    id: 'device-01',
    name: 'Lab Device 01',
    status: 'OFFLINE',
    last_heartbeat: null,
  });
});
