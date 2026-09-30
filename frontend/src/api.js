async function requestJson(path, options) {
  let response;

  try {
    response = await fetch(path, options);
  } catch {
    throw new Error('Unable to connect to the backend.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error('Unable to connect to the backend.');
    }

    const error = new Error(payload?.error?.message ?? `Request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function fetchFleet() {
  return Promise.all([
    requestJson('/devices'),
    requestJson('/summary'),
  ]).then(([devices, summary]) => ({ devices, summary }));
}

export function registerDevice(device) {
  return requestJson('/devices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(device),
  });
}

export function sendHeartbeat(deviceId) {
  return requestJson(`/devices/${encodeURIComponent(deviceId)}/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 'OK',
    }),
  });
}
