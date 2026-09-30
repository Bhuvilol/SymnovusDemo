# Mini Device Fleet Monitor

A small fleet monitoring application. Registered devices periodically send heartbeats to an Express backend. The backend determines whether each device is `ONLINE` or `OFFLINE` from when it received the heartbeat, and the React dashboard displays the current fleet state. The dashboard can simulate heartbeats for registered devices, and a Node.js command-line simulator is also available.

**Live deployment:** <https://fleet-monitor-opal.vercel.app/> (Vercel, with Upstash Redis storage). See [Deploy to Vercel](#deploy-to-vercel).

## Architecture

```text
React Dashboard + Browser Simulator
       |
       v
Express Backend  (local: Node server; Vercel: serverless function)
       |
       v
Device Store     (local: in-memory; Vercel: Upstash Redis)

CLI Simulator ---> Express Backend  (local or deployed, via BACKEND_URL)
```

- **Backend:** Node.js and Express
- **Frontend:** React and Vite
- **Storage:** In-memory device store locally; Upstash Redis when deployed to Vercel
- **Simulator:** Node.js
- **Tests:** Node.js built-in test runner

## Project structure

```text
backend/
  src/                 Express app, server, clock, and device stores (memory, Redis)
  test/                Backend API and store tests
  test-support/        Isolated test server fixture
frontend/
  src/                 React dashboard, API helper, and styles
  index.html
  vite.config.js
simulator/
  src/index.js         Five-device heartbeat simulator and CLI
api/index.js           Vercel serverless entry point for the Express app
vercel.json            Vercel build output and API rewrites
Dockerfile             Images for backend, dashboard (nginx), simulator, and tests
compose.yaml           Docker Compose services
docker/nginx.conf      Serves the dashboard and proxies the API to the backend
package.json           Workspace scripts
README.md
```

## Prerequisites

- Node.js 22.12.0 or newer, as specified by the root `package.json`
- npm
- No database is required for local development
- Or, instead of Node.js and npm: Docker with Docker Compose (see [Run with Docker](#run-with-docker))

## Run with Docker

The quickest way to evaluate the project. Only Docker is needed; nothing else has to be installed.

```bash
docker compose up --build
```

This builds and starts the backend on <http://localhost:3000/> and the dashboard on <http://localhost:5173/>. The dashboard is the production build served by nginx, which forwards `/devices` and `/summary` to the backend container.

In a second terminal, start the interactive five-device simulator:

```bash
docker compose run --rm simulator
```

In Docker, the simulator registers `device-01` to `device-05` itself (devices that already exist are skipped), then sends heartbeats every five seconds. Type `stop device-03`, watch it turn `OFFLINE` in the dashboard about 30 seconds later, then type `start device-03`. Type `exit` or press Ctrl+C to leave.

Run the backend test suite in a container:

```bash
docker compose run --rm test
```

Stop everything with `docker compose down`. If ports 3000 or 5173 are already in use, choose others, e.g. `BACKEND_PORT=3100 FRONTEND_PORT=5273 docker compose up --build`. Use the same variables for later `docker compose` commands in that terminal, so the running containers are reused rather than recreated. The Docker backend uses in-memory storage, so `docker compose down` or a backend restart clears the fleet.

## Install

From the repository root:

```bash
npm install
```

## Run the application

After `npm install`, open two terminals in the repository root and leave both running.

**Terminal 1 — backend:**

```bash
npm run dev:backend
```

The backend listens at <http://localhost:3000/> by default.

**Terminal 2 — dashboard:**

```bash
npm run dev:frontend
```

Open <http://localhost:5173/> in your browser. The Vite development server proxies the dashboard's API requests to the backend.

On first run the fleet is empty. Click **Add device** in the dashboard to register `device-01`; click it again to add the next sequential device. To simulate heartbeats, use **Start** or **Start all** in the browser simulator section. You can also use the command-line simulator described below.

## Simulator

The browser simulator lists every device registered with the backend. Use **Add device** to create the next sequential device (for example, `device-06`, then `device-07`); its name is filled in automatically. New devices appear in the simulator list after registration. Use **Start all** or an individual **Start** button to send an immediate heartbeat and continue every five seconds. **Stop** pauses that device's heartbeats, and **Stop all** pauses every browser simulation. A stopped device becomes `OFFLINE` after the backend's 30-second timeout; starting it again sends a fresh heartbeat. Keep the dashboard open while simulating; browser heartbeats stop when the page is closed.

The command-line simulator is also available and continues to simulate the five default IDs, `device-01` through `device-05`. Register these devices first if they are not already in the fleet. Start the CLI from the repository root:

```bash
npm run simulator
```

The simulator sends to `http://localhost:3000` by default. If the backend runs on another port, set the same `PORT` (for example, `PORT=4000 npm run simulator`), or set `BACKEND_URL` to a full URL. Set `REGISTER_DEVICES=true` to have the simulator register the five devices before it starts (existing devices are skipped); the Docker simulator does this by default.

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

### `DELETE /devices/:id`

Removes a device and its heartbeat state:

```bash
curl -X DELETE http://localhost:3000/devices/device-01
```

Returns `204 No Content`. An unknown or already removed device returns `404 Not Found`. After removal the device no longer appears in `GET /devices` or `/summary`, its heartbeats return `404`, and its ID can be registered again. A heartbeat that is in flight while the device is removed cannot bring it back: in Redis the heartbeat is written by a script that only updates devices that still exist.

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

The dashboard shows fleet summary counts and the device list, including each device's latest heartbeat. It supports automatic device registration, removal (a **Remove** button on each device row, after a confirmation), manual refresh, and browser simulator controls for all registered devices. Removing a device stops its browser simulator; if a device is removed elsewhere (another tab, the API), the dashboard stops its simulator on the next poll. A local clock at the top updates every second as a tester aid; it does not determine device status. The dashboard polls the backend every five seconds and displays backend-provided status and errors when API requests fail.

## Tests and build

Run the backend tests with Node.js's built-in test runner:

```bash
npm test
```

The tests cover registration, validation, duplicate registration, heartbeat handling, unknown devices, device list/detail and summary responses, device removal, the 30-second boundary and 31-second offline transition, and server receipt time versus the client timestamp. The Redis store is tested against an in-memory fake client, so no Redis connection is needed; the heartbeat-after-removal script was also checked against the live Upstash database.

Build the production frontend bundle with:

```bash
npm run build:frontend
```

## Deploy to Vercel

Live deployment: <https://fleet-monitor-opal.vercel.app/>

| Item | Value |
|---|---|
| Vercel project | `fleet-monitor` (team `bhuvilols-projects`) |
| Production URL | <https://fleet-monitor-opal.vercel.app/> (`fleet-monitor.vercel.app` is owned by another account) |
| Storage | Upstash Redis database `fleet-monitor-redis` (free plan), connected to Production, Preview, and Development |
| Environment variables | `KV_REST_API_URL`, `KV_REST_API_TOKEN` (set by the Upstash integration) |
| Redis keys | `fleet:devices` (hash of devices by ID), `fleet:sequence` (registration order counter) |

The dashboard is served as a static site and the Express app runs as a Vercel serverless function (`api/index.js`), on the same domain, so the dashboard's relative API paths work without CORS. `vercel.json` builds `frontend/dist` and rewrites `/devices`, `/devices/*`, and `/summary` to the function.

Serverless instances do not share memory, so the deployment stores devices in Redis. The backend picks the store at startup: Redis when `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) are set, otherwise in-memory. Registration uses `HSETNX`, so duplicate IDs are rejected atomically even across concurrent instances; removal uses `HDEL`, and heartbeats are written by a small Lua script that only updates devices that still exist. Connectivity status still uses the server's heartbeat receipt time.

To set up a new deployment:

1. Install the CLI and log in: `npm i -g vercel`, then `vercel login`.
2. From the repository root, run `vercel link` to create or link the project (`.vercel/` is git-ignored).
3. In the Vercel dashboard, open the project, choose **Storage → Create Database → Upstash for Redis**, accept the terms, and pick the free plan. If the database is not connected to the project afterwards, connect it with `vercel integration resource connect <database-name> <project-name> --yes`. Check with `vercel env ls`.
4. Deploy with `vercel deploy --prod`.

Deployments are manual: rerun `vercel deploy --prod` after changes, or run `vercel git connect` to deploy automatically on every push to GitHub.

To drive the deployed fleet from the command-line simulator:

```bash
BACKEND_URL=https://fleet-monitor-opal.vercel.app npm run simulator
```

## Assumptions and limitations

- Local development uses in-memory storage intentionally; restarting the backend clears all registered devices and heartbeat state, and state is not shared across processes. The Vercel deployment uses Redis so state is shared across serverless instances.
- Authentication and authorization are not implemented.
- Local defaults are fixed for this assessment: backend port `3000`, Vite dashboard port `5173`, and five command-line simulator device IDs. Browser simulator controls use all registered devices. The backend port can be overridden with `PORT`; pass the same `PORT` (or a full `BACKEND_URL`) to the dashboard and CLI simulator so they reach it.
- The development backend reloads only when files in `backend/src` change. Any restart clears the in-memory fleet.
- A simulator device must be registered before its heartbeat can succeed, unless the simulator is started with `REGISTER_DEVICES=true`.
- The heartbeat `status` is device-reported information; it is separate from fleet connectivity status.
- The browser simulator only runs while the dashboard is open, and the CLI simulator runs locally; neither is a hosted process.
- The browser simulator tracks only heartbeats it sends itself, so devices driven by the CLI simulator show `STOPPED` in the browser simulator list while their fleet status is `ONLINE`.
- At phone width, the device table scrolls horizontally inside its container; the "Last heartbeat" column is off-screen until scrolled.
- The dashboard has no favicon, so browsers log a harmless `404` for `/favicon.ico`.

## With one more day

- Add authentication/authorization.
- Add stronger integration and load testing, plus more operational observability.
- Extend device metrics beyond heartbeat state.

## Verification

- **Automated tests:** `npm test` passes all 12 tests (9 API tests plus 3 Redis store tests), and the frontend production build succeeds.
- **Local, three terminals:** backend, dashboard, and CLI simulator were run side by side. Five devices were registered and simulated; `stop device-03` made it `OFFLINE` after the 30-second timeout (about 33 seconds including polling) while the other four stayed `ONLINE`, and `start device-03` brought it back within 2 seconds.
- **Docker:** all images build; `docker compose run --rm test` passes 12/12; the simulator container registers the five devices and `stop device-03` produces 4 online / 1 offline through the nginx proxy; the browser tests pass 32 of 33 against the containerized dashboard (the only errors are the ones the tests trigger on purpose); stopping the backend container shuts it down cleanly on `SIGTERM`, the dashboard proxy returns `502` during the outage, and the dashboard recovers after a restart.
- **Browser tests:** the dashboard was driven in Chrome with Playwright, both locally and on the live deployment, with 32 of 33 checks passing in each. The checks covered page load, summary counts, the local clock, manual refresh and 5-second polling, sequential **Add device**, per-device and **Start all**/**Stop all** simulator controls, the 30-second timeout and recovery, the backend-outage banner and **Try again**, registration errors, the `409` retry path, and phone-width layout. The only failed check was "no console errors", caused by the missing favicon and by errors the outage tests triggered on purpose.
- **Device removal:** a separate browser test (13 checks) passed locally, in Docker, and on the live deployment: cancel keeps the device, confirm sends `DELETE` (`204`) and removes it from the table, simulator list, and summary, no heartbeats are sent afterwards, a device removed through the API is dropped on the next poll, and a re-added device with the same ID shows no stale error. On the live deployment, 5 rounds of 15 concurrent heartbeats racing a removal never recreated the device.
- **Live API:** registration, duplicate (`409`), invalid JSON (`400`), heartbeat, and unknown device (`404`) responses match local behavior, and 20 concurrent reads returned consistent data from Redis across serverless instances. Test devices were removed from the live database afterwards.
