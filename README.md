# HillAlert

## Problem Statement
In mountainous/hill areas, natural disasters (landslides, flash floods) often damage mobile-network connectivity.

## Solution
An emergency-support app offering real-time alerts when online and fallback BLE-based mesh messaging when offline.

## Architecture
- Frontend: React + Vite + Tailwind CSS
- Bluetooth: Web Bluetooth API + Offline indexing (Dexie)

## Local setup

Use Node.js 22.12+ (Node.js 24 recommended) and npm. From the project root:

```sh
npm run setup
npm run dev
```

Open http://localhost:5173. The backend listens on http://localhost:3000;
its health endpoint is `/api/health`. Stop both services with Ctrl+C.
Dependencies already installed can be used directly with `npm run dev`.

The default configuration requires no credentials or database. Optional overrides
are documented in `backend/.env.example` and `frontend/.env.example`; copy each
to `.env` in the same directory if needed. If you change the backend `PORT`,
also update the frontend `BACKEND_URL` and restart the servers.
Vite proxies `/api` and `/socket.io` to the backend during development and preview.

## Verification and production build

```sh
npm run check
```

This builds both projects, lints the frontend, and runs an integration test for
backend health, Socket.IO connection, and unknown API routes.

Browser checks: run `npx playwright install chromium` once, then `npm run test:e2e`.
Tests start isolated services on ports 3100 and 5174 and cover desktop/mobile
navigation, checklist download, live connection, and recovery after going offline.
To use installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome` in your shell
(PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'chrome'`) before running the tests.

To run the compiled backend: `npm start --prefix backend`.
To preview the built frontend locally: `npm run preview --prefix frontend`
(http://localhost:4173). Start the backend alongside it.
For deployment, serve `frontend/dist` with SPA history fallback and route `/api`
and `/socket.io` (including WebSocket upgrades) to the backend.

## Current functionality

The responsive dashboard includes desktop/mobile navigation, a session packing
checklist with download, and a real Socket.IO connection with automatic retry
and acknowledged latency measurements. “Connected” means a live session with
the backend; it does not mean a Bluetooth device has been paired.

Official alert feeds, navigational maps, Bluetooth mesh, offline messaging,
and emergency dispatch are not implemented. Their screens describe the current
availability rather than displaying simulated live data. PostgreSQL is not yet used.
