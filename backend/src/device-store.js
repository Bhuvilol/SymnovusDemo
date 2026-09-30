import { now } from './clock.js';

const devices = new Map();

const HEARTBEAT_TIMEOUT_MS = 30_000;

export function getDevice(id) {
  return devices.get(id);
}

export function getDevices() {
  return Array.from(devices.values());
}

export function getDeviceCount() {
  return devices.size;
}

export function registerDevice(id, name) {
  if (devices.has(id)) {
    return null;
  }

  const device = {
    id,
    name,
    lastHeartbeat: null,
    lastHeartbeatReceivedAt: null,
  };

  devices.set(id, device);
  return device;
}

export function recordHeartbeat(device, timestamp, status, receivedAt = now()) {
  device.lastHeartbeat = { timestamp, status };
  device.lastHeartbeatReceivedAt = receivedAt;
  return device;
}

export function getConnectivityStatus(device, currentTime = now()) {
  if (device.lastHeartbeatReceivedAt === null) {
    return 'OFFLINE';
  }

  return currentTime - device.lastHeartbeatReceivedAt <= HEARTBEAT_TIMEOUT_MS
    ? 'ONLINE'
    : 'OFFLINE';
}

export function toDeviceResponse(device, currentTime = now()) {
  return {
    id: device.id,
    name: device.name,
    status: getConnectivityStatus(device, currentTime),
    last_heartbeat: device.lastHeartbeat?.timestamp ?? null,
  };
}
