import { now } from './clock.js';
import { createMemoryStore } from './memory-store.js';
import { createRedisStore } from './redis-store.js';

const HEARTBEAT_TIMEOUT_MS = 30_000;

// Redis when deployed with credentials; in-memory for local development and tests.
const store = createRedisStore() ?? createMemoryStore();

export function getDevice(id) {
  return store.getDevice(id);
}

export function getDevices() {
  return store.getDevices();
}

export function registerDevice(id, name) {
  return store.registerDevice(id, name);
}

export function removeDevice(id) {
  return store.removeDevice(id);
}

export function recordHeartbeat(device, timestamp, status, receivedAt = now()) {
  return store.recordHeartbeat(device, timestamp, status, receivedAt);
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
