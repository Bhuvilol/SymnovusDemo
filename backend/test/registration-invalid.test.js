import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestJson, startTestServer } from '../test-support/server-fixture.js';

test('invalid or missing registration fields return a JSON 400 error', async (t) => {
  const { baseUrl } = await startTestServer(t);
  const invalidId = await requestJson(baseUrl, 'POST', '/devices', {
    id: '',
    name: 'Lab Device 01',
  });
  const invalidName = await requestJson(baseUrl, 'POST', '/devices', {
    id: 'device-01',
    name: '',
  });
  const missingId = await requestJson(baseUrl, 'POST', '/devices', {
    name: 'Lab Device 01',
  });
  const missingName = await requestJson(baseUrl, 'POST', '/devices', {
    id: 'device-01',
  });

  for (const response of [invalidId, invalidName, missingId, missingName]) {
    assert.equal(response.status, 400);
    assert.equal(typeof response.body.error.code, 'string');
    assert.equal(typeof response.body.error.message, 'string');
  }
});
