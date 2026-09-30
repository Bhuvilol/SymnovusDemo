# Submission: Mini Device Fleet Monitor

Campus Hiring Round 2, 3-hour engineering project.

| | |
|---|---|
| Repository | <https://github.com/Bhuvilol/SymnovusDemo> |
| Live deployment | <https://fleet-monitor-opal.vercel.app/> |
| Stack | Node.js 22 + Express 5 (backend), React 19 + Vite (dashboard), Node.js CLI (simulator), Node.js built-in test runner |
| Full documentation | [README.md](README.md) |

## Quick start

With Docker (no Node.js needed):

```bash
docker compose up --build              # API on :3000, dashboard on http://localhost:5173
docker compose run --rm simulator      # second terminal: registers device-01 … device-05, sends heartbeats
docker compose run --rm test           # 12 automated tests
```

Without Docker:

```bash
npm install
npm test                 # 12 automated tests
npm run dev:backend      # terminal 1: API on http://localhost:3000
npm run dev:frontend     # terminal 2: dashboard on http://localhost:5173
npm run simulator        # terminal 3: CLI simulator for device-01 … device-05
```

Without Docker, the CLI simulator does not register devices unless you start it with `REGISTER_DEVICES=true npm run simulator`. You can also register them by clicking **Add device** five times in the dashboard, or with the `POST /devices` request below.

### Verify the timeout in about one minute

1. Start the simulator (`docker compose run --rm simulator`, or register the devices and run `npm run simulator`). All five show `ONLINE` in the dashboard.
2. Type `stop device-03` in the simulator terminal.
3. About 30 seconds later, `device-03` shows `OFFLINE` and the summary reads 4 online / 1 offline. The other devices stay `ONLINE`.
4. Type `start device-03`. It returns to `ONLINE` on the next poll.

The same check works against the live deployment with `BACKEND_URL=https://fleet-monitor-opal.vercel.app npm run simulator`, or with the dashboard's browser simulator (**Start** / **Stop** per device).

### Example requests

```bash
curl -X POST localhost:3000/devices -H 'content-type: application/json' \
  -d '{"id":"device-01","name":"Lab Device 01"}'

curl -X POST localhost:3000/devices/device-01/heartbeat -H 'content-type: application/json' \
  -d '{"timestamp":"2026-09-21T10:30:00Z","status":"OK"}'

curl localhost:3000/devices
curl localhost:3000/devices/device-01
curl localhost:3000/summary
curl -X DELETE localhost:3000/devices/device-01    # remove a device (204)
```

## Requirements coverage

| Requirement | Implementation | Tests |
|---|---|---|
| Register a device, `POST /devices` | [backend/src/app.js](backend/src/app.js): validates `id`/`name`, returns `201`; `409` on duplicate ID, `400` on invalid input or JSON | `registration-success`, `registration-duplicate`, `registration-invalid` |
| Receive a heartbeat, `POST /devices/{id}/heartbeat` | Requires an ISO-8601 `timestamp` and a non-empty `status`; `404` for unknown devices | `heartbeat`, `heartbeat-receipt-time` |
| List devices, `GET /devices` | Returns `id`, `name`, `status`, `last_heartbeat` for each device | `device-reads-summary` |
| Device details, `GET /devices/{id}` | Same shape for one device; `404` if unknown | `device-reads-summary`, `status-timeout` |
| Fleet summary, `GET /summary` | `total`, `online`, `offline`, calculated from current state | `device-reads-summary`, `status-timeout` |
| *Extra:* remove a device, `DELETE /devices/{id}` | `204`; `404` if unknown. Available in the API, the dashboard (**Remove** button with confirmation), Docker, and the live deployment. A heartbeat racing a removal cannot recreate the device. | `device-removal`, `redis-store` |
| 30-second ONLINE/OFFLINE timeout | Status is calculated on every read from the **server's receipt time** of the last heartbeat ([device-store.js](backend/src/device-store.js)). A device is `ONLINE` for 30 s or less and `OFFLINE` after that; it is `OFFLINE` if it has never sent a heartbeat. No background timer is needed. | `status-timeout` checks exactly 30 s (`ONLINE`) and 31 s (`OFFLINE`) with an injected clock |
| Simulator with at least 5 devices, and a way to stop one | [simulator/src/index.js](simulator/src/index.js): `device-01` to `device-05`, a heartbeat every 5 s, commands `stop`/`start`/`status`/`exit`. The dashboard also has a browser simulator for any registered device. | Manual and browser tests (below) |
| Automated tests | 12 tests with `node --test`, each using an isolated server and a fake clock | See [Testing](#testing) |
| README sections | What it does, architecture, prerequisites, build, run, simulator, tests, API examples, assumptions, limitations, "with one more day", and deployment | — |

## Design decisions

- **Status uses server receipt time, not the device's timestamp.** Device clocks can be wrong or skewed. The reported timestamp is stored and shown as `last_heartbeat`, but it never decides connectivity. The `heartbeat-receipt-time` test sends heartbeats dated 2020 and 100 years in the future to show this.
- **Status is calculated on read.** Every response calculates status from "now", so there is no background sweeper that could fall out of sync with it.
- **Injectable clock.** [clock.js](backend/src/clock.js) lets tests move time forward instead of sleeping for 30 seconds, so the timeout tests are fast and give the same result every run.
- **Replaceable storage.** The route handlers call a small store interface. Local development and tests use an in-memory `Map` ([memory-store.js](backend/src/memory-store.js)). The Vercel deployment uses Upstash Redis ([redis-store.js](backend/src/redis-store.js)), because serverless instances don't share memory. Registration uses `HSETNX`, so duplicate IDs are rejected even when concurrent requests reach different instances. Heartbeats are written by a small Lua script that only updates existing devices, so a heartbeat that races a removal cannot recreate the device.
- **Consistent errors.** Every error returns `{"error":{"code","message"}}` with a suitable HTTP status. Malformed JSON returns `400 INVALID_JSON`, not a stack trace.

## Optional enhancements included

- **Input validation:** ID/name, ISO-8601 timestamps, non-empty status, JSON body shape.
- **Simple UI:** React dashboard with summary counts, a device table, 5-second polling, automatic device registration, a browser heartbeat simulator, and an error banner when the backend is unreachable.
- **Persistent storage:** Upstash Redis on the deployment.
- **Configuration through environment variables:** `PORT` for the backend, `PORT`/`BACKEND_URL` for the dashboard proxy and CLI simulator, and Redis credentials.
- **Graceful shutdown:** the backend closes its HTTP server on `SIGINT`/`SIGTERM`, and the simulator clears its timers on exit or Ctrl+C.
- **Concurrency-safe implementation:** atomic duplicate detection in Redis; heartbeats cannot recreate a removed device; the dashboard retries registration with the next ID after a `409`.
- **Device removal:** `DELETE /devices/{id}` and a **Remove** button in the dashboard.
- **Docker support:** `docker compose up` runs the backend and an nginx-served production dashboard; the simulator and test suite run as one-off containers. The backend runs as a non-root user and has a healthcheck.
- **Deployment:** Vercel (static dashboard + serverless API) with Redis.

## Testing

### Automated tests: `npm test` (12/12 passing)

| File | What it covers |
|---|---|
| `registration-success.test.js` | A new device is registered as `OFFLINE` with no heartbeat |
| `registration-invalid.test.js` | Missing or empty fields and invalid bodies return a JSON `400` |
| `registration-duplicate.test.js` | A duplicate ID returns `409` and does not overwrite the original |
| `device-removal.test.js` (2 tests) | Removal returns `204` and deletes the device from reads, the summary, and heartbeats; an unknown device returns `404`; a removed ID can be registered again |
| `heartbeat.test.js` | Unknown device (`404`), invalid timestamp or status (`400`), valid heartbeat |
| `heartbeat-receipt-time.test.js` | Connectivity uses server receipt time, not past or future device timestamps |
| `status-timeout.test.js` | `ONLINE` at exactly 30 s, `OFFLINE` at 31 s, a device with no heartbeat is `OFFLINE`, and the summary counts match |
| `device-reads-summary.test.js` | The list and detail responses expose only public fields, and the summary is calculated dynamically |
| `redis-store.test.js` (3 tests) | Redis store selection, registration order, duplicate rejection, heartbeat persistence, removal, and that a late heartbeat cannot recreate a removed device, tested against a fake client |

### Manual and end-to-end checks

- **Three terminals locally** (backend, dashboard, CLI simulator): `stop device-03` made it `OFFLINE` about 33 s later (the 30 s timeout plus polling) while the others stayed `ONLINE`; `start device-03` restored it within 2 s.
- **Browser tests (Playwright + Chrome)**, run against both the local app and the live deployment: 32 of 33 checks passed in each. They covered registration, the simulator controls, the 30-second timeout and recovery, the backend-outage banner and recovery, registration errors, the `409` retry, and the phone-width layout. The one failed check is "no console errors": the dashboard has no favicon (a harmless `404`), and the outage tests trigger errors on purpose.
- **Docker:** 12/12 tests pass in the test container; the containerized simulator registers its devices, and stopping `device-03` gives 4 online / 1 offline through the nginx proxy; the browser tests pass 32 of 33 against the containerized dashboard; stopping the backend container shuts it down cleanly, and the dashboard recovers after a restart.
- **Device removal (browser, 13 checks):** passed locally, in Docker, and live. It covers cancel/confirm, the `204` response, removal from the table, simulator list, and summary, no heartbeats after removal, handling of removal by another client, and no stale error when the same ID is re-added. On the live deployment, 5 rounds of 15 concurrent heartbeats racing a removal never recreated the device.
- **Live API:** status codes match local behaviour, and 20 concurrent reads returned consistent data across serverless instances.

## Git history

The commits show the order the work was done in:

1. Project foundation and commit message policy
2. Registration validation and error handling
3. Central device state and an injectable clock
4. API tests for registration, heartbeats, and status
5. Tests for API errors and heartbeat timing
6. Five-device interactive simulator
7. React dashboard with live polling
8. Documentation
9. Better registration, simulation, and status presentation
10. Clearer startup and simulator instructions
11. Follow-up work: scoped dev reload, configurable ports, Redis storage, Vercel deployment, Docker support, and this document

## AI Usage

> **TODO (author):** Check this section, fill in the marked parts, and copy it into `README.md` under `## AI Usage`. The brief requires that section in the README.

- **Tools used:** Claude Code (Anthropic), in VS Code. *(TODO: add any other tools used earlier in the project, e.g. ChatGPT or Copilot.)*
- **What it was used for:** reviewing the whole repository; containerizing it with Docker Compose; adding device removal; running the backend, dashboard, and simulator together to test them; writing browser tests for the dashboard; fixing issues it found (the dev server restarted on `node_modules` changes and wiped in-memory data, and the simulator and dashboard proxy ignored `PORT`); adding Redis-backed storage; deploying to Vercel; and writing documentation.
- **A suggestion that was changed or rejected:** Deploying the original in-memory backend to Vercel "as-is" was rejected, because serverless instances don't share memory and devices would disappear at random. Replacing the in-memory store outright was also rejected, since that would change the documented design. The chosen approach selects the store from environment variables: in-memory locally and in tests, Redis only on the deployment. Separately, the Vercel CLI added a broad `.env*` rule to `.gitignore` that would have undone the existing `!.env.example` exception; that line was removed.
- **Something personally verified:** *(TODO: author to describe in their own words, for example running `stop device-03` in the simulator and watching it go `OFFLINE` after 30 seconds in the dashboard, or reading the `status-timeout` test to confirm the 30 s and 31 s boundary.)*

## Known limitations

- Local storage is in memory, so restarting the backend clears the fleet. The deployment keeps data in Redis.
- No authentication or authorization.
- The browser simulator only runs while the dashboard is open, and the CLI simulator runs on the tester's machine. Neither is hosted.
- The browser simulator only knows about heartbeats it sent itself, so devices driven by the CLI show `STOPPED` in its list while their fleet status is `ONLINE`.
- At phone width, the "Last heartbeat" column is only visible after scrolling the table sideways.
- Optional heartbeat metrics (`cpu_usage`, `signal_strength`) are not stored or displayed.

## With one more day

- Authentication/authorization for device and operator endpoints.
- Store and chart optional heartbeat metrics, and filter devices by status (`GET /devices?status=OFFLINE`).
- Integration tests for the full stack running in CI, and load tests for heartbeat traffic.
- Structured logging and basic metrics (heartbeat rate, devices that change status often).
