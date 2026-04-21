# Tauri Setup Guide

## What this repo contains

This project is built as a Tauri desktop wrapper around a Node.js API backend.

- `src-tauri/src/main.rs` launches the Tauri application and starts the Node.js backend.
- `src-tauri/resources/node/server.js` is the actual Express server.
- `public/index.html` is the web UI loaded by the frontend.

## Required tools

- Node.js 14 or higher
- npm
- Rust toolchain (for Tauri development): `rustc --version`, `cargo --version`
- Optional: `@tauri-apps/cli`

## How Tauri starts the backend

In development mode, `src-tauri/src/main.rs` spawns:

- `src-tauri/resources/node/server.js`

That backend listens on `http://localhost:3000` by default.

## Running the app in development

From the repo root:

```powershell
npm install
npm run tauri:dev
```

This command:

- builds the Tauri desktop application in development mode
- opens a desktop window
- starts the Node.js backend automatically

## Backend entry point

The current backend entry point is:

- `src-tauri/resources/node/server.js`

This file loads environment variables from `src-tauri/resources/node/.env` when present.

## Frontend behavior

The current static frontend uses `fetch()` calls to the backend API.

- It is not served by the backend itself.
- The frontend must load `public/index.html` from the browser or from the Tauri app.

## Recommended local workflow

1. Start the backend directly:
   ```powershell
   node .\src-tauri\resources\node\server.js
   ```
2. Open `public/index.html` in your browser.
3. Or run the Tauri wrapper:
   ```powershell
   npm run tauri:dev
   ```

## Important note

The Tauri wrapper does not launch `node src/server.js`. It launches the backend from `src-tauri/resources/node/server.js` in development mode.
