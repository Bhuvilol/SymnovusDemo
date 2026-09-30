import express from 'express';
import { devices, toDeviceResponse } from './device-store.js';

const app = express();

app.use((req, res, next) => {
  req.receivedAt = Date.now();
  next();
});

app.use(express.json());

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

app.post('/devices', (req, res) => {
  if (!isObject(req.body)) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }

  const id = req.body.id;
  const name = req.body.name;

  if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) {
    return sendError(res, 400, 'INVALID_DEVICE', 'Device id and name are required.');
  }

  if (devices.has(id)) {
    return sendError(res, 409, 'DEVICE_EXISTS', `Device '${id}' is already registered.`);
  }

  const device = {
    id,
    name,
    lastHeartbeat: null,
    lastHeartbeatReceivedAt: null,
  };

  devices.set(id, device);
  return res.status(201).json({
    id: device.id,
    name: device.name,
    status: 'OFFLINE',
    last_heartbeat: null,
  });
});

app.post('/devices/:id/heartbeat', (req, res) => {
  const device = devices.get(req.params.id);

  if (!device) {
    return sendError(res, 404, 'DEVICE_NOT_FOUND', `Device '${req.params.id}' is not registered.`);
  }

  if (!isObject(req.body)) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }

  const { timestamp, status } = req.body;
  const parsedTimestamp = typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN;
  const heartbeatStatus = typeof status === 'string' ? status.trim() : '';

  if (Number.isNaN(parsedTimestamp) || !heartbeatStatus) {
    return sendError(
      res,
      400,
      'INVALID_HEARTBEAT',
      'Heartbeat requires a valid timestamp and a non-empty status.',
    );
  }

  device.lastHeartbeat = {
    timestamp: new Date(parsedTimestamp).toISOString(),
    status: heartbeatStatus,
  };
  device.lastHeartbeatReceivedAt = req.receivedAt;

  return res.status(200).json(toDeviceResponse(device, req.receivedAt));
});

app.get('/devices', (req, res) => {
  const now = Date.now();
  return res.json(Array.from(devices.values(), (device) => toDeviceResponse(device, now)));
});

app.get('/devices/:id', (req, res) => {
  const device = devices.get(req.params.id);

  if (!device) {
    return sendError(res, 404, 'DEVICE_NOT_FOUND', `Device '${req.params.id}' is not registered.`);
  }

  return res.json(toDeviceResponse(device));
});

app.get('/summary', (req, res) => {
  const now = Date.now();
  let online = 0;

  for (const device of devices.values()) {
    if (toDeviceResponse(device, now).status === 'ONLINE') {
      online += 1;
    }
  }

  const total = devices.size;
  return res.json({
    total,
    online,
    offline: total - online,
  });
});

app.use((req, res) => {
  return sendError(res, 404, 'NOT_FOUND', 'The requested resource was not found.');
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'Request body contains invalid JSON.');
  }

  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
});

export default app;
