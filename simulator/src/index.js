import { createInterface } from 'node:readline';

const DEVICE_IDS = [
  'device-01',
  'device-02',
  'device-03',
  'device-04',
  'device-05',
];
const HEARTBEAT_INTERVAL_MS = 5_000;
const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${Number(process.env.PORT) || 3000}`;
const shouldRegisterDevices = process.env.REGISTER_DEVICES === 'true';
const devices = new Map(DEVICE_IDS.map((id) => [id, {
  id,
  timer: null,
  stopped: true,
  inFlight: false,
}]));

async function sendHeartbeat(device) {
  if (device.stopped || device.inFlight) {
    return;
  }

  device.inFlight = true;

  try {
    const response = await fetch(`${backendUrl}/devices/${encodeURIComponent(device.id)}/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        status: 'OK',
      }),
    });

    if (response.ok) {
      console.log(`[${device.id}] heartbeat accepted`);
      return;
    }

    let errorMessage = '';
    try {
      const responseBody = await response.json();
      errorMessage = responseBody.error?.message ?? '';
    } catch {
      // Keep the HTTP status useful even when an error response is not JSON.
    }

    if (response.status === 404) {
      console.error(`[${device.id}] heartbeat failed: device not found`);
    } else {
      console.error(`[${device.id}] heartbeat failed: HTTP ${response.status}${errorMessage ? ` - ${errorMessage}` : ''}`);
    }
  } catch (error) {
    console.error(`[${device.id}] heartbeat request failed: ${error.message}`);
  } finally {
    device.inFlight = false;
  }
}

async function registerDevices() {
  for (const id of DEVICE_IDS) {
    const name = `Lab Device ${id.slice('device-'.length)}`;

    try {
      const response = await fetch(`${backendUrl}/devices`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });

      if (response.status === 201) {
        console.log(`[${id}] registered`);
      } else if (response.status === 409) {
        console.log(`[${id}] already registered`);
      } else {
        console.error(`[${id}] registration failed: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`[${id}] registration request failed: ${error.message}`);
    }
  }
}

console.log(`Sending heartbeats to ${backendUrl} every ${HEARTBEAT_INTERVAL_MS / 1_000} seconds.`);
if (shouldRegisterDevices) {
  await registerDevices();
} else {
  console.log('Devices must already be registered; set REGISTER_DEVICES=true to register them automatically.');
}
console.log('Commands:');
console.log('  stop <device-id>   Stop a device');
console.log('  start <device-id>  Resume a stopped device');
console.log('  status             Show simulator state');
console.log('  exit               Stop the simulator');

function startDevice(device) {
  if (!device.stopped) {
    console.log(`[${device.id}] already running`);
    return;
  }

  device.stopped = false;
  void sendHeartbeat(device);
  device.timer = setInterval(() => void sendHeartbeat(device), HEARTBEAT_INTERVAL_MS);
  console.log(`[${device.id}] started`);
}

function stopDevice(device) {
  if (device.stopped) {
    console.log(`[${device.id}] already stopped`);
    return;
  }

  device.stopped = true;
  clearInterval(device.timer);
  device.timer = null;
  console.log(`[${device.id}] stopped`);
}

function showStatus() {
  for (const device of devices.values()) {
    console.log(`${device.id}  ${device.stopped ? 'STOPPED' : 'RUNNING'}`);
  }
}

function stopSimulator() {
  for (const device of devices.values()) {
    clearInterval(device.timer);
    device.timer = null;
    device.stopped = true;
  }
  console.log('Simulator stopped.');
}

const commandLine = createInterface({ input: process.stdin, output: process.stdout });
commandLine.setPrompt('simulator> ');

for (const device of devices.values()) {
  startDevice(device);
}

commandLine.prompt();
commandLine.on('line', (input) => {
  const [command, deviceId] = input.trim().split(/\s+/, 2);

  if (command === 'stop' || command === 'start') {
    const device = devices.get(deviceId);
    if (!device) {
      console.error(`Unknown device '${deviceId ?? ''}'.`);
    } else if (command === 'stop') {
      stopDevice(device);
    } else {
      startDevice(device);
    }
  } else if (command === 'status') {
    showStatus();
  } else if (command === 'exit') {
    commandLine.close();
    return;
  } else if (command) {
    console.error('Unknown command. Use stop, start, status, or exit.');
  }

  commandLine.prompt();
});

commandLine.on('SIGINT', () => commandLine.close());
commandLine.on('close', stopSimulator);
