export function createMemoryStore() {
  const devices = new Map();

  return {
    async getDevice(id) {
      return devices.get(id);
    },

    async getDevices() {
      return Array.from(devices.values());
    },

    async registerDevice(id, name) {
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
    },

    async removeDevice(id) {
      return devices.delete(id);
    },

    async recordHeartbeat(device, timestamp, status, receivedAt) {
      // The device may have been removed after the caller looked it up.
      if (devices.get(device.id) !== device) {
        return null;
      }

      device.lastHeartbeat = { timestamp, status };
      device.lastHeartbeatReceivedAt = receivedAt;
      return device;
    },
  };
}
