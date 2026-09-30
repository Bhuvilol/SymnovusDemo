export const devices = new Map();

const HEARTBEAT_TIMEOUT_MS = 30_000;

export function getConnectivityStatus(device, now = Date.now()) {
  if (device.lastHeartbeatReceivedAt === null) {
    return 'OFFLINE';
  }

  return now - device.lastHeartbeatReceivedAt <= HEARTBEAT_TIMEOUT_MS
    ? 'ONLINE'
    : 'OFFLINE';
}

export function toDeviceResponse(device, now = Date.now()) {
  return {
    id: device.id,
    name: device.name,
    status: getConnectivityStatus(device, now),
    heartbeat_status: device.lastHeartbeat?.status ?? null,
    last_heartbeat: device.lastHeartbeat?.timestamp ?? null,
    last_heartbeat_received_at: device.lastHeartbeatReceivedAt === null
      ? null
      : new Date(device.lastHeartbeatReceivedAt).toISOString(),
  };
}
