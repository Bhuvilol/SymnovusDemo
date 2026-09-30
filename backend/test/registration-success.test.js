import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTestDevice, startTestServer } from '../test-support/server-fixture.js';

test('registers a device as offline', async (t) => {
  const { baseUrl } = await startTestServer(t);
  const response = await registerTestDevice(baseUrl, 'device-01', 'Lab Device 01');

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, {
    id: 'device-01',
    name: 'Lab Device 01',
    status: 'OFFLINE',
    last_heartbeat: null,
  });
});
