# Deploying Popcorn

Popcorn deploys as two services:

- `apps/web`: a static React/Vite application
- `apps/server`: a long-running Node.js HTTP and Socket.IO server

The web app can run on any static host. The server must run on a platform that
supports persistent WebSocket connections.

## Current Production Limitations

Read these before deploying:

- Rooms and playback state are stored in server memory.
- Deploy exactly **one server instance**. Multiple instances will create isolated
  rooms unless a shared room store and Socket.IO adapter are added.
- Restarting or redeploying the server removes all active rooms.
- Camera and microphone access require HTTPS outside `localhost`.
- TURN configuration is listed in `.env.example`, but media peer connections
  and TURN support are not implemented yet.

## Prerequisites

- Node.js 22 or newer
- Corepack
- A public HTTPS URL for the web app
- A public HTTPS/WSS URL for the server

Enable the repository's pinned pnpm version:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

The repository explicitly allows `esbuild` install scripts in
`pnpm-workspace.yaml`. This is required by pnpm 11's strict dependency-build
policy and allows Cloudflare Pages and Render to install Vite/tsup successfully.

Before deployment, run:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Environment Variables

### Server runtime

Set these on the Node server:

```env
NODE_ENV=production
PORT=4000
CLIENT_URL=https://watch.example.com
```

`CLIENT_URL` must exactly match the web application's browser origin. Do not add
a trailing slash. It is used by Express and Socket.IO CORS.

Most hosting platforms assign `PORT` automatically. Use the platform-provided
value when available.

### Web build

Set this while building the web application:

```env
VITE_SERVER_URL=https://api.example.com
```

Vite embeds `VITE_SERVER_URL` into the generated JavaScript during
`pnpm build`. Changing it after the build does not update an existing web
artifact.

## Build Outputs

From the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

The deployable outputs are:

```txt
apps/web/dist/          Static web files
apps/server/dist/       Bundled Node server
```

## Deploy the Server

Run the build and start commands from the repository root:

```bash
corepack pnpm --filter @popcorn/server build
corepack pnpm --filter @popcorn/server start
```

Recommended platform settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @popcorn/server build` |
| Start command | `corepack pnpm --filter @popcorn/server start` |
| Health check | `/health` |
| Instance count | `1` |

Verify the deployed server:

```bash
curl https://api.example.com/health
```

Expected response:

```json
{"ok":true,"service":"popcorn-server"}
```

The platform must allow WebSocket upgrades and long-lived connections. Socket.IO
uses the same server URL as the health endpoint.

## Deploy the Web App

Set `VITE_SERVER_URL` to the deployed server URL, then build:

```bash
VITE_SERVER_URL=https://api.example.com \
  corepack pnpm --filter @popcorn/web build
```

Publish `apps/web/dist` as the static site directory.

Configure an SPA fallback so paths such as `/room/ABCD1234` serve
`apps/web/dist/index.html`. Without the fallback, directly opening a room link
will return a host-level 404.

Recommended static-host settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @popcorn/web build` |
| Publish directory | `apps/web/dist` |
| Environment variable | `VITE_SERVER_URL=https://api.example.com` |
| SPA fallback | `/*` to `/index.html` |

After deploying the web app, update the server's `CLIENT_URL` to the exact web
origin and restart the server.

## Cloudflare Pages + Render

This is the recommended hosted setup for the current repository:

```txt
Browser
  ├── HTTPS → Cloudflare Pages → React/Vite web app
  └── WSS   → Render Web Service → Express + Socket.IO server
```

Deploy Render first, then Cloudflare Pages, then confirm Render's `CLIENT_URL`.

### 1. Push the repository

Cloudflare Pages and Render can both deploy from the same GitHub or GitLab
repository. Push the project before creating either service.

### 2. Create the Render server

In Render, select **New > Web Service**, connect the repository, and use:

| Render setting | Value |
| --- | --- |
| Language | Node |
| Branch | `main`, or your production branch |
| Root Directory | Leave blank |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @popcorn/server build` |
| Start Command | `pnpm --filter @popcorn/server start` |
| Health Check Path | `/health` |
| Instance count | `1` |

Set these Render environment variables:

```env
NODE_ENV=production
CLIENT_URL=https://YOUR-CLOUDFLARE-PROJECT.pages.dev
```

Do not set `PORT`. Render provides it automatically.

Choose the Cloudflare Pages project name before this step so you can predict its
initial URL. For example, a Pages project named `popcorn-watch` receives
`https://popcorn-watch.pages.dev`.

After Render deploys, copy its public URL:

```txt
https://YOUR-RENDER-SERVICE.onrender.com
```

Verify:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/health
```

Render Web Services accept public WebSocket connections, so no additional
Socket.IO proxy configuration is needed.

> Render free Web Services spin down after inactivity. A spin-down or redeploy
> removes every active Popcorn room because room state currently lives in
> memory. Use a paid always-on instance for reliable watch parties.

### 3. Create the Cloudflare Pages site

In Cloudflare, open **Workers & Pages > Create application > Pages > Import an
existing Git repository**. Connect the same repository and use:

| Cloudflare Pages setting | Value |
| --- | --- |
| Production branch | `main`, or your production branch |
| Framework preset | None or Vite |
| Root directory | Leave blank |
| Build command | `pnpm --filter @popcorn/web build` |
| Build output directory | `apps/web/dist` |

Cloudflare Pages automatically runs `pnpm install` before the user build
command. Enter the build command as plain text. Do **not** include surrounding
backticks:

```txt
pnpm --filter @popcorn/web build
```

Literal backticks trigger shell command substitution. After the build finishes,
the shell then attempts to execute pnpm output such as `Scope: all 4 workspace
projects`, resulting in `/bin/sh: Scope:: not found`.

Add this Pages environment variable for both Production and Preview if previews
should connect to the same server:

```env
VITE_SERVER_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

The repository includes `apps/web/public/_redirects`, which Vite copies into the
build output. Cloudflare Pages uses it to serve `/index.html` for room URLs such
as `/room/ABCD1234`.

### 4. Confirm Render CORS

After Cloudflare's first deploy, copy the exact production Pages origin and set
Render's `CLIENT_URL` to it:

```env
CLIENT_URL=https://YOUR-CLOUDFLARE-PROJECT.pages.dev
```

Do not include a trailing slash. Save the variable and redeploy the Render
service.

If you later add a custom domain to Cloudflare Pages, update `CLIENT_URL` again
to the custom origin:

```env
CLIENT_URL=https://watch.example.com
```

### 5. Verify the hosted app

1. Open the Cloudflare Pages URL.
2. Create a room.
3. Open the invite URL in a private window.
4. Confirm both participants appear.
5. Confirm host play, pause, and seek reach the second browser.
6. Confirm the browser console has no CORS or Socket.IO errors.
7. Directly open a `/room/<room-id>` URL and confirm Pages serves the app.

### Preview deployment limitation

Cloudflare Pages preview deployments use changing `*.pages.dev` origins.
The server currently accepts exactly one `CLIENT_URL`, so preview deployments
will be blocked by CORS unless the server is temporarily configured for that
preview origin. Production deployment is unaffected.

## Reverse Proxy Example

You can serve the static app and proxy the Socket.IO server from the same
`https://watch.example.com` origin. This requires building the web app with:

```env
VITE_SERVER_URL=https://watch.example.com
```

Example Nginx configuration:

```nginx
server {
  listen 443 ssl http2;
  server_name watch.example.com;

  root /srv/popcorn/apps/web/dist;
  index index.html;

  location /socket.io/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location /health {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

For this setup, use:

```env
CLIENT_URL=https://watch.example.com
```

## Post-Deployment Checklist

1. Open the web app over HTTPS.
2. Confirm the browser console has no CORS or Socket.IO connection errors.
3. Confirm `/health` returns HTTP `200`.
4. Create a room and open its invite URL in a second browser or private window.
5. Confirm both users appear in the room.
6. Confirm host play, pause, and seek reach the second user.
7. Confirm camera permission can be requested over HTTPS.
8. Confirm direct navigation to `/room/<room-id>` loads the web app.

## Troubleshooting

### Browser shows CORS errors

Set server `CLIENT_URL` to the exact web origin, including `https://` and any
non-default port. Remove trailing slashes.

### Socket connects locally but not in production

Confirm the hosting platform supports WebSockets and that the reverse proxy
forwards the `Upgrade` and `Connection` headers.

### Room links return 404

Configure the static host to rewrite unknown paths to `/index.html`.

### Users create rooms but cannot join each other's rooms

Ensure the server runs as one instance. Current room state is not shared across
processes or machines.

### Camera or microphone permission is unavailable

Serve the web app over HTTPS. Browsers allow media capture on `localhost`, but
require a secure context in production.
