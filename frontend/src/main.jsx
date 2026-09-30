import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchFleet, registerDevice } from './api.js';
import './style.css';

const POLL_INTERVAL_MS = 5_000;

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
  const [pageError, setPageError] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [notice, setNotice] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ id: '', name: '' });

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
    return () => window.clearInterval(interval);
  }, [refreshFleet]);

  async function handleSubmit(event) {
    event.preventDefault();
    setRegistrationError('');
    setNotice('');

    if (!form.id.trim() || !form.name.trim()) {
      setRegistrationError('Enter both a device ID and a device name.');
      return;
    }

    setIsRegistering(true);
    try {
      await registerDevice({ id: form.id, name: form.name });
      setForm({ id: '', name: '' });
      setNotice(`${form.id} was registered.`);
      await refreshFleet();
    } catch (error) {
      setRegistrationError(error.status === 409 ? 'Device already exists.' : error.message);
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
        <button className="button button--secondary" type="button" onClick={() => void refreshFleet()} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
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
              </tr>
            </thead>
            <tbody>
              {!hasLoaded && (
                <tr><td className="table-message" colSpan="4">Loading fleet…</td></tr>
              )}
              {hasLoaded && devices.length === 0 && !pageError && (
                <tr><td className="table-message" colSpan="4">No devices registered yet.</td></tr>
              )}
              {hasLoaded && devices.length === 0 && pageError && (
                <tr><td className="table-message" colSpan="4">Fleet data is unavailable.</td></tr>
              )}
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="device-id">{device.id}</td>
                  <td>{device.name}</td>
                  <td><StatusLabel status={device.status} /></td>
                  <td className="heartbeat-time">{formatHeartbeat(device.last_heartbeat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="poll-note">Refreshes automatically every 5 seconds.</p>
      </section>

      <section className="register-section" aria-labelledby="register-heading">
        <div className="section-heading">
          <div>
            <h2 id="register-heading">Register a device</h2>
            <p>New devices start offline until their first heartbeat.</p>
          </div>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="device-id">Device ID</label>
            <input
              id="device-id"
              name="id"
              value={form.id}
              onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
              placeholder="device-06"
              autoComplete="off"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="device-name">Device name</label>
            <input
              id="device-name"
              name="name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Lab Device 06"
              required
            />
          </div>
          <button className="button button--primary" type="submit" disabled={isRegistering}>
            {isRegistering ? 'Registering…' : 'Register'}
          </button>
        </form>
        {registrationError && <p className="form-message form-message--error" role="alert">{registrationError}</p>}
        {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
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
