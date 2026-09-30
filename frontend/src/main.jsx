import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchFleet, registerDevice, removeDevice, sendHeartbeat } from './api.js';
import './style.css';

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 5_000;

function getNextDevice(devices) {
  const usedIds = new Set(devices.map((device) => device.id));
  const usedNumbers = devices
    .map((device) => /^device-(\d+)$/i.exec(device.id)?.[1])
    .filter(Boolean)
    .map(Number);
  let number = Math.max(0, ...usedNumbers) + 1;
  let id = `device-${String(number).padStart(2, '0')}`;

  while (usedIds.has(id)) {
    number += 1;
    id = `device-${String(number).padStart(2, '0')}`;
  }

  const suffix = String(number).padStart(2, '0');
  return { id, name: `Lab Device ${suffix}` };
}

function formatHeartbeat(timestamp) {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function StatusLabel({ status }) {
  const isOnline = status === 'ONLINE';

  return (
    <span className={`status-label ${isOnline ? 'status-label--online' : 'status-label--offline'}`}>
      <span className="status-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

function App() {
  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [pageError, setPageError] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [notice, setNotice] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [removalMessage, setRemovalMessage] = useState(null);
  const [runningSimulators, setRunningSimulators] = useState({});
  const [simulatorErrors, setSimulatorErrors] = useState({});
  const simulatorTimers = useRef(new Map());
  const heartbeatRequests = useRef(new Set());

  const refreshFleet = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const fleet = await fetchFleet();
      setDevices(fleet.devices);
      setSummary(fleet.summary);
      setPageError('');
      return true;
    } catch (error) {
      setPageError(error.message);
      return false;
    } finally {
      setHasLoaded(true);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshFleet();
    const interval = window.setInterval(() => void refreshFleet(), POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      for (const timer of simulatorTimers.current.values()) {
        window.clearInterval(timer);
      }
      simulatorTimers.current.clear();
    };
  }, [refreshFleet]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const sendSimulatedHeartbeat = useCallback(async (deviceId) => {
    if (heartbeatRequests.current.has(deviceId)) return;

    heartbeatRequests.current.add(deviceId);
    try {
      await sendHeartbeat(deviceId);
      setSimulatorErrors((current) => ({ ...current, [deviceId]: '' }));
    } catch (error) {
      // A request still in flight when its simulator was stopped (for example, because
      // the device was removed) should not leave an error on a later device with this ID.
      if (!simulatorTimers.current.has(deviceId)) return;

      const message = error.status === 404
        ? `${deviceId} is not registered. Register it here; retries continue every 5 seconds.`
        : error.message;
      setSimulatorErrors((current) => ({ ...current, [deviceId]: message }));
    } finally {
      heartbeatRequests.current.delete(deviceId);
    }
  }, []);

  function startSimulator(deviceId) {
    if (simulatorTimers.current.has(deviceId)) return;

    setRunningSimulators((current) => ({ ...current, [deviceId]: true }));
    void sendSimulatedHeartbeat(deviceId);
    const timer = window.setInterval(
      () => void sendSimulatedHeartbeat(deviceId),
      HEARTBEAT_INTERVAL_MS,
    );
    simulatorTimers.current.set(deviceId, timer);
  }

  function stopSimulator(deviceId) {
    const timer = simulatorTimers.current.get(deviceId);
    if (timer === undefined) return;

    window.clearInterval(timer);
    simulatorTimers.current.delete(deviceId);
    setRunningSimulators((current) => ({ ...current, [deviceId]: false }));
  }

  // Stop browser heartbeats for devices that are no longer registered (for example,
  // removed here or from another tab) so hidden timers do not keep sending.
  useEffect(() => {
    const registeredIds = new Set(devices.map((device) => device.id));
    for (const deviceId of simulatorTimers.current.keys()) {
      if (!registeredIds.has(deviceId)) {
        stopSimulator(deviceId);
        setSimulatorErrors((current) => ({ ...current, [deviceId]: '' }));
      }
    }
  }, [devices]);

  async function handleRemoveDevice(device) {
    if (!window.confirm(`Remove ${device.id} (${device.name}) from the fleet?`)) return;

    stopSimulator(device.id);
    setRemovalMessage(null);
    setRemovingIds((current) => new Set(current).add(device.id));

    try {
      await removeDevice(device.id);
      setRemovalMessage({ type: 'success', text: `${device.name} removed (${device.id}).` });
    } catch (error) {
      if (error.status === 404) {
        setRemovalMessage({ type: 'success', text: `${device.id} was already removed.` });
      } else {
        setRemovalMessage({ type: 'error', text: error.message });
      }
    } finally {
      setSimulatorErrors((current) => ({ ...current, [device.id]: '' }));
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(device.id);
        return next;
      });
      await refreshFleet();
    }
  }

  function startAllSimulators() {
    devices.forEach((device) => startSimulator(device.id));
  }

  function stopAllSimulators() {
    for (const deviceId of simulatorTimers.current.keys()) {
      stopSimulator(deviceId);
    }
  }

  async function handleAddDevice() {
    setRegistrationError('');
    setNotice('');
    setIsRegistering(true);

    try {
      let fleet = await fetchFleet();
      setDevices(fleet.devices);
      setSummary(fleet.summary);

      let device = getNextDevice(fleet.devices);
      try {
        await registerDevice(device);
      } catch (error) {
        if (error.status !== 409) throw error;

        fleet = await fetchFleet();
        setDevices(fleet.devices);
        setSummary(fleet.summary);
        device = getNextDevice(fleet.devices);
        await registerDevice(device);
      }

      setNotice(`${device.name} added (${device.id}).`);
      await refreshFleet();
    } catch (error) {
      setRegistrationError(error.message);
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">DEVICE FLEET</p>
          <h1>Fleet monitor</h1>
          <p className="page-description">A live view of registered devices and their heartbeat status.</p>
        </div>
        <div className="header-actions">
          <div className="live-clock" aria-label="Local time">
            <span>Local time</span>
            <time>{new Intl.DateTimeFormat(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(currentTime)}</time>
          </div>
          <button className="button button--secondary" type="button" onClick={() => void refreshFleet()} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {pageError && (
        <div className="message message--error" role="alert">
          <span>{pageError}</span>
          <button className="text-button" type="button" onClick={() => void refreshFleet()}>Try again</button>
        </div>
      )}

      <section className="summary-section" aria-label="Fleet summary">
        <SummaryMetric label="Total" value={summary?.total} />
        <SummaryMetric label="Online" value={summary?.online} />
        <SummaryMetric label="Offline" value={summary?.offline} />
      </section>

      <section className="devices-section" aria-labelledby="devices-heading">
        <div className="section-heading">
          <div>
            <h2 id="devices-heading">Devices</h2>
            <p>Current status is provided by the backend.</p>
          </div>
          {summary && <span className="device-count">{summary.total} {summary.total === 1 ? 'device' : 'devices'}</span>}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Device ID</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Last heartbeat</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!hasLoaded && (
                <tr><td className="table-message" colSpan="5">Loading fleet…</td></tr>
              )}
              {hasLoaded && devices.length === 0 && !pageError && (
                <tr><td className="table-message" colSpan="5">No devices registered yet.</td></tr>
              )}
              {hasLoaded && devices.length === 0 && pageError && (
                <tr><td className="table-message" colSpan="5">Fleet data is unavailable.</td></tr>
              )}
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="device-id">{device.id}</td>
                  <td>{device.name}</td>
                  <td><StatusLabel status={device.status} /></td>
                  <td className="heartbeat-time">{formatHeartbeat(device.last_heartbeat)}</td>
                  <td className="row-actions">
                    <button
                      className="button button--secondary button--compact button--danger"
                      type="button"
                      onClick={() => void handleRemoveDevice(device)}
                      disabled={removingIds.has(device.id)}
                      aria-label={`Remove ${device.id}`}
                    >
                      {removingIds.has(device.id) ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {removalMessage && (
          <p
            className={`form-message ${removalMessage.type === 'error' ? 'form-message--error' : 'form-message--success'}`}
            role={removalMessage.type === 'error' ? 'alert' : 'status'}
          >
            {removalMessage.text}
          </p>
        )}
        <p className="poll-note">Refreshes automatically every 5 seconds. Removing a device deletes it from the backend.</p>
      </section>

      <section className="register-section" aria-labelledby="register-heading">
        <div className="section-heading">
          <div>
            <h2 id="register-heading">Add a device</h2>
            <p>Adds the next available device ID and name automatically. New devices start offline until their first heartbeat.</p>
          </div>
        </div>

        <div className="register-form">
          <button className="button button--primary" type="button" onClick={() => void handleAddDevice()} disabled={isRegistering}>
            {isRegistering ? 'Adding…' : 'Add device'}
          </button>
        </div>
        {registrationError && <p className="form-message form-message--error" role="alert">{registrationError}</p>}
        {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
      </section>

      <section className="simulator-section" aria-labelledby="simulator-heading">
        <div className="section-heading simulator-heading">
          <div>
            <h2 id="simulator-heading">Browser simulator</h2>
            <p>Lists all registered devices. Heartbeats send immediately, then every 5 seconds.</p>
          </div>
          <div className="simulator-actions">
            <button className="button button--primary" type="button" onClick={startAllSimulators} disabled={devices.length === 0}>Start all</button>
            <button className="button button--secondary" type="button" onClick={stopAllSimulators} disabled={!Object.values(runningSimulators).some(Boolean)}>Stop all</button>
          </div>
        </div>

        <ul className="simulator-list">
          {devices.length === 0 && <li className="simulator-empty">Add a device to start simulating heartbeats.</li>}
          {devices.map((device) => {
            const deviceId = device.id;
            const isRunning = Boolean(runningSimulators[deviceId]);
            return (
              <li className="simulator-row" key={deviceId}>
                <div className="simulator-device">
                  <span className="device-id">{deviceId}</span>
                  <span className="simulator-name">{device.name}</span>
                  <span className={`simulator-state ${isRunning ? 'simulator-state--running' : ''}`}>
                    {isRunning ? 'RUNNING' : 'STOPPED'}
                  </span>
                  {simulatorErrors[deviceId] && (
                    <span className="simulator-error" role="status">{simulatorErrors[deviceId]}</span>
                  )}
                </div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => (isRunning ? stopSimulator(deviceId) : startSimulator(deviceId))}
                  aria-label={`${isRunning ? 'Stop' : 'Start'} heartbeat simulator for ${deviceId}`}
                >
                  {isRunning ? 'Stop' : 'Start'} {deviceId}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function SummaryMetric({ label, value }) {
  return (
    <div className="summary-metric">
      <span className="summary-label">{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
