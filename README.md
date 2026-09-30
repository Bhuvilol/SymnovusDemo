# Mini Device Fleet Monitor

A small fleet monitoring application. Registered devices periodically send heartbeats to an Express backend. The backend determines whether each device is `ONLINE` or `OFFLINE` from when it received the heartbeat, and the React dashboard displays the current fleet state. A Node.js simulator generates heartbeat traffic for five devices.

## Architecture

```text
React Dashboard
       |
       v
Express Backend
       |
       v
In-Memory Device Store

Simulator ---> Express Backend
```

- **Backend:** Node.js and Express
- **Frontend:** React and Vite
- **Storage:** In-memory device store; no database
- **Simulator:** Node.js
- **Tests:** Node.js built-in test runner

## Project structure

```text
backend/
  src/                 Express app, server, clock, and device store
  test/                Backend API tests
  test-support/        Isolated test server fixture
frontend/
  src/                 React dashboard, API helper, and styles
  index.html
  vite.config.js
simulator/
  src/index.js         Five-device heartbeat simulator and CLI
package.json           Workspace scripts
README.md
```

## Prerequisites

- Node.js 22.12.0 or newer, as specified by the root `package.json`
- npm
- No database is required

## Install

From the repository root:

```bash
npm install
```

## Run the application

Run each command in a separate terminal from the repository root:

```bash
npm run dev:backend
npm run dev:frontend
```

Open the dashboard at <http://localhost:5173/>. The backend listens at <http://localhost:3000/> by default. The Vite development server proxies the dashboard's API requests to that backend.

## Simulator

The simulator assumes `device-01` through `device-05` have already been registered through the dashboard or API. It does not register them. Each device sends a heartbeat immediately and then every five seconds.

Start it from the repository root:

```bash
npm run simulator
```

Available commands:

- `stop <device-id>` — stop one device's heartbeat loop
- `start <device-id>` — resume it and send a heartbeat immediately
- `status` — show local simulator state
- `exit` — stop the simulator

For example, `stop device-03` pauses that device while the others continue. A device that is not registered reports an error and keeps retrying without stopping other devices. Press Ctrl+C to shut down cleanly.

## API

All errors use JSON of the form `{"error":{"code":"...","message":"..."}}`.

### `POST /devices`

Register a device:

```json
{
  "id": "device-01",
  "name": "Lab Device 01"
}
```

Returns `201 Created` with the public device representation and initial `OFFLINE` status. Duplicate IDs return `409 Conflict`; invalid input returns `400 Bad Request`.

### `POST /devices/:id/heartbeat`

Send a heartbeat for an already registered device:

```json
{
  "timestamp": "2026-09-21T10:30:00Z",
  "status": "OK"
}
```

The timestamp must be a valid ISO-8601 date and time, and status must be a non-empty string. Unknown devices return `404 Not Found`; invalid input returns `400 Bad Request`. The device-reported timestamp is stored as `last_heartbeat`, but connectivity uses the server's heartbeat receipt time.

### `GET /devices`

Returns an array of all registered devices. Each public device representation contains `id`, `name`, `status`, and `last_heartbeat`.

### `GET /devices/:id`

Returns the same public device representation for one device. An unknown device returns `404 Not Found`.

### `GET /summary`

Returns counts calculated from the current device state:

```json
{
  "total": 5,
  "online": 5,
  "offline": 0
}
```

## ONLINE and OFFLINE status

- A device with no heartbeat is `OFFLINE`.
- A heartbeat received within the last 30 seconds means `ONLINE`.
- More than 30 seconds since server receipt means `OFFLINE`.
- Status is calculated dynamically when API responses are generated; there is no background timeout process.
- The client-provided timestamp does not determine connectivity status.

## Dashboard behavior

The dashboard shows fleet summary counts and the device list, including each device's latest heartbeat. It supports device registration and manual refresh, and polls the backend every five seconds. It displays backend-provided status and shows errors when API requests fail.

## Tests and build

Run the backend tests with Node.js's built-in test runner:

```bash
npm test
```

The tests cover registration, validation, duplicate registration, heartbeat handling, unknown devices, device list/detail and summary responses, the 30-second boundary and 31-second offline transition, and server receipt time versus the client timestamp.

Build the production frontend bundle with:

```bash
npm run build:frontend
```

## Assumptions and limitations

- In-memory storage is intentional; restarting the backend clears all registered devices and heartbeat state.
- State is local to one backend process and is not shared across multiple instances.
- Authentication and authorization are not implemented.
- Local defaults are fixed for this assessment: backend port `3000`, Vite dashboard port `5173`, and five simulator device IDs. The backend port can be overridden with `PORT`.
- A simulator device must be registered before its heartbeat can succeed.
- The heartbeat `status` is device-reported information; it is separate from fleet connectivity status.
- There is no production deployment configuration.

## With one more day

- Add persistent storage and authentication/authorization.
- Add stronger integration and load testing, plus more operational observability.
- Prepare deployment and containerization configuration.
- Extend device metrics beyond heartbeat state.

## Verification

The application was manually verified end to end: five-device heartbeat simulation, the 30-second `ONLINE` to `OFFLINE` transition and recovery, dashboard polling, UI registration and duplicate/error handling, and dashboard behavior during backend outage and recovery. The automated backend suite passed (7 tests), and the frontend production build succeeded.
