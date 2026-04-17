# Tauri Conversion - Setup Guide

## What Was Created

```
src-tauri/
├── tauri.conf.json      # Tauri configuration
├── Cargo.toml           # Rust dependencies
├── build.rs             # Build script
└── src/
    └── main.rs          # Rust backend that spawns and controls a Node.js backend process
``


## Prerequisites to Complete Setup

1. **Install Rust**
   - Download: https://rustup.rs/
   - Run the installer and follow instructions
   - Verify: `rustc --version` and `cargo --version`

2. **Verify your system has Node.js in PATH**
   - The Tauri app will spawn `node src/server.js` automatically
   - Verify: Open PowerShell and run `node --version`

## Next Steps

### 1. Update Frontend to Use Tauri API

The current frontend uses `fetch()` calls. With Tauri, you need to:
- Keep `fetch()` calls (they'll hit `http://localhost:3000` from the bundled Node server)
- OR use Tauri commands for direct Rust-to-Frontend communication

**Current setup keeps it simple**: 
- Tauri spawns your Node.js server on startup
- Frontend continues using `fetch()` as-is
- No code changes needed in frontend!

### 2. Build & Run in Development

```bash
npm run tauri:dev
```

This will:
- Launch a Tauri window
- Start your Node.js server automatically
- Open your HTML/CSS/JS from the `public/` folder

### 3. Build for Production

```bash
npm run tauri:build
```

This will create a standalone `.exe` that bundles:
- Your Node.js server
- Your frontend HTML/CSS/JS
- Rust microkernel

### Changes Made

✅ `package.json` - Added Tauri scripts
✅ `src-tauri/` - Created Rust project structure
✅ `src-tauri/src/main.rs` - Spawns Node server, bridges desktop window
✅ `src-tauri/tauri.conf.json` - Points to `public/` folder for assets

## Folder Structure (Final)

```
Rally-Test-Case-Generator/
├── public/                 # Frontend (HTML/CSS/JS) - UNCHANGED
├── src/                    # Backend (Node.js)     - UNCHANGED
├── src-tauri/              # Desktop app (Tauri)   - NEW
│   ├── src/main.rs
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── build.rs
└── package.json            # Updated with Tauri scripts

```

## How It Works

1. User launches the `.exe` (or runs `npm run tauri:dev`)
2. Tauri (Rust) starts up and creates a window
3. `main.rs` spawns Node.js server (`node src/server.js`)
4. Frontend loads from `public/index.html`
5. Frontend makes API calls to `http://localhost:3000/api/...`
6. Node.js server processes them
7. No internet needed - fully offline!

## Troubleshooting

**Issue**: "Rust not found"
- Solution: Install Rust from https://rustup.rs/

**Issue**: "Node command not found"
- Solution: Ensure Node.js is in your PATH
- Verify: `node --version` in PowerShell

**Issue**: "tauri command not found"
- Solution: Run `npm install -D @tauri-apps/cli` again

## Optional: Advanced Customizations

Once working, you can:
- Move business logic to Rust for better performance
- Add system tray icon
- Add auto-updates
- Create installers for distribution
- Use Tauri commands instead of HTTP calls

Start with: `npm run tauri:dev`
