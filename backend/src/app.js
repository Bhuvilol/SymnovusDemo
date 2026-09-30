import express from 'express';
import { now } from './clock.js';
import {
  getConnectivityStatus,
  getDevice,
  getDeviceCount,
  getDevices,
  recordHeartbeat,
  registerDevice,
  toDeviceResponse,
} from './device-store.js';

const app = express();

app.use((req, res, next) => {
  req.receivedAt = now();
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

function isIso8601DateTime(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    && !Number.isNaN(Date.parse(value));
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

  const device = registerDevice(id, name);
  if (!device) {
    return sendError(res, 409, 'DEVICE_EXISTS', `Device '${id}' is already registered.`);
  }
  return res.status(201).json({
    id: device.id,
    name: device.name,
    status: 'OFFLINE',
    last_heartbeat: null,
  });
});

app.post('/devices/:id/heartbeat', (req, res) => {
  const device = getDevice(req.params.id);

  if (!device) {
    return sendError(res, 404, 'DEVICE_NOT_FOUND', `Device '${req.params.id}' is not registered.`);
  }

  if (!isObject(req.body)) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }

  const { timestamp, status } = req.body;
  const heartbeatStatus = typeof status === 'string' ? status : '';

  if (!isIso8601DateTime(timestamp) || !heartbeatStatus.trim()) {
    return sendError(
      res,
      400,
      'INVALID_HEARTBEAT',
      'Heartbeat requires a valid timestamp and a non-empty status.',
    );
  }

  recordHeartbeat(device, timestamp, heartbeatStatus, req.receivedAt);

  return res.status(200).json({
    id: device.id,
    name: device.name,
    status: getConnectivityStatus(device, now()),
    last_heartbeat: device.lastHeartbeat.timestamp,
  });
});

app.get('/devices', (req, res) => {
  const currentTime = now();
  return res.json(getDevices().map((device) => toDeviceResponse(device, currentTime)));
});

app.get('/devices/:id', (req, res) => {
  const device = getDevice(req.params.id);

  if (!device) {
    return sendError(res, 404, 'DEVICE_NOT_FOUND', `Device '${req.params.id}' is not registered.`);
  }

  return res.json(toDeviceResponse(device));
});

app.get('/summary', (req, res) => {
  const currentTime = now();
  let online = 0;

  for (const device of getDevices()) {
    if (toDeviceResponse(device, currentTime).status === 'ONLINE') {
      online += 1;
    }
  }

  const total = getDeviceCount();
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
