import app from '../src/app.js';
import { resetTimeProvider, setTimeProvider } from '../src/clock.js';

export const initialTime = Date.parse('2026-09-21T10:30:00Z');

export async function startTestServer(t) {
  let currentTime = initialTime;
  setTimeProvider(() => currentTime);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    resetTimeProvider();
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  return {
    baseUrl,
    advanceTime(milliseconds) {
      currentTime += milliseconds;
    },
  };
}

export async function requestJson(baseUrl, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

export async function registerTestDevice(baseUrl, id, name = 'Lab Device 01') {
  return requestJson(baseUrl, 'POST', '/devices', { id, name });
}
