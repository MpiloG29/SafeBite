# SafeBite

SafeBite is a React-based accessibility dining app for blind and deaf diners. It supports:

- verified Gmail login through a backend verification endpoint
- first-run choice between a voice-first or text-first experience
- menu image upload with Claude-powered image extraction
- allergy-aware dish analysis
- nearby restaurant and mall suggestions
- accessible ordering with text or voice input

## Overview

SafeBite has two runtime pieces during development:

- a Vite frontend that serves the React app
- an Express backend that handles Google verification and Claude image extraction

When you open the app in the browser, the frontend talks to the backend through the Vite `/api` proxy. That means your phone only needs to reach the frontend port directly during development.

## Ports Used

| Service | Purpose | Default Port | Where It Is Set |
| --- | --- | --- | --- |
| Vite dev server | React frontend in development | `5173` | [vite.config.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/vite.config.js) |
| Express API | backend auth and image extraction | `3001` | [server/index.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/server/index.js) and `.env` via `PORT` |
| Vite preview server | previewing the production build | `4173` | [vite.config.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/vite.config.js) |

### How the ports work together

- In development, open `http://YOUR_COMPUTER_IP:5173` on your phone.
- Requests from the frontend to `/api/...` are proxied by Vite to `http://localhost:3001` on your computer.
- Your phone does not need to call port `3001` directly during normal development use.
- If you change `PORT` in `.env`, update the proxy target in [vite.config.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/vite.config.js) too.

## Setup

1. Ensure Node.js 18 or newer is installed.
2. Copy `.env.example` to `.env` if you have not already done that.
3. Set `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` to the same Google OAuth web client ID.
4. Set `ANTHROPIC_API_KEY` to your Anthropic API key.
5. Run `npm install`.

Example `.env`:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_DOMAIN=gmail.com
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_VISION_MODEL=claude-3-5-sonnet-latest
ALLOW_PREVIEW_LOGIN=true
PORT=3001
```

## Run Locally On Your Computer

1. Start both servers:

```bash
npm run dev
```

1. Vite will serve the frontend on port `5173`.
1. Express will serve the API on port `3001`.
1. Open the app on your computer using `http://localhost:5173`.

## Run On Your Phone

### Requirements

- Your phone and your computer must be on the same Wi-Fi network.
- Windows Firewall must allow Node.js to accept incoming connections on your local network.
- The Vite dev server must listen on your LAN address. This repo is now configured for that in [vite.config.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/vite.config.js).

### Steps

1. Start the app:

```bash
npm run dev
```

1. Find your computer's local IP address. In PowerShell:

```powershell
ipconfig
```

Look for the IPv4 address on your active Wi-Fi adapter, for example `192.168.1.25`.

1. On your phone, open:

```text
http://192.168.1.25:5173
```

Replace `192.168.1.25` with your actual LAN IP.

1. If the page does not load:

- confirm `npm run dev` is still running
- confirm your phone is on the same Wi-Fi network
- allow Node.js through Windows Firewall for private networks
- verify nothing else is already using port `5173`

### Important mobile/browser limitations

Some browser APIs are restricted on plain HTTP pages that are not `localhost`:

- Google sign-in may not work unless the origin is authorized in Google Cloud and served from HTTPS or an allowed test origin.
- Speech recognition support varies by browser and is usually best in Chrome.
- Geolocation may be blocked on non-HTTPS origins on mobile browsers.

If you mainly want to test layout and navigation on your phone, use preview login. If you want all browser security-sensitive features to work reliably on mobile, use HTTPS tunneling or deploy the app.

## Preview The Production Build

1. Build the app:

```bash
npm run build
```

1. Start preview mode:

```bash
npm run preview
```

1. Open it on your computer or phone using port `4173`:

```text
http://YOUR_COMPUTER_IP:4173
```

Preview mode only serves the frontend build. If you need the API features in preview, the backend still needs to be running separately.

## Environment Variables

- `VITE_GOOGLE_CLIENT_ID`: client ID used by the React frontend.
- `GOOGLE_CLIENT_ID`: client ID used by the backend to verify Google ID tokens.
- `GOOGLE_ALLOWED_DOMAIN`: allowed email domain. Defaults to `gmail.com`.
- `ANTHROPIC_API_KEY`: API key used by the backend image extraction endpoint.
- `ANTHROPIC_VISION_MODEL`: Claude model used for menu image extraction. Defaults to `claude-3-5-sonnet-latest`.
- `ALLOW_PREVIEW_LOGIN`: set to `false` to disable preview mode.
- `PORT`: backend port. Defaults to `3001`.

## Development Notes

- Google sign-in must run on `localhost` or HTTPS unless your OAuth configuration explicitly allows the origin you are using.
- Gmail verification is enforced on the backend, not only in the browser.
- Nearby place lookup uses Overpass and reverse geocoding uses Nominatim.
- Menu image extraction runs on the backend through the Claude API.
- Uploaded images are limited to 8 MB by the backend.
- In development, the frontend relies on the Vite proxy for `/api` requests.

## Troubleshooting

### Port already in use

If you see an `EADDRINUSE` error, another process is already using the port.

- For backend conflicts on `3001`, either stop the other process or change `PORT` in `.env` and then update the proxy target in [vite.config.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/vite.config.js).
- For frontend conflicts on `5173` or preview conflicts on `4173`, stop the other process or change the port in [vite.config.js](c:/Users/lerat/Documents/New%20folder%20(7)/SafeBite/vite.config.js).

### Phone cannot open the app

- Make sure the frontend is bound to `0.0.0.0`.
- Make sure your firewall allows incoming private-network traffic.
- Make sure the phone and computer are on the same subnet.
- Try the LAN IP directly instead of `localhost`.

### Upload works but login or location does not

That is usually a secure-context restriction in the mobile browser. For full mobile feature coverage, use HTTPS or deploy the app behind a real URL.
