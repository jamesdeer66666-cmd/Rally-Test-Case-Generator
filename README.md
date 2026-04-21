# Rally AI Test Case Generator

A lightweight Tauri + Node.js app for turning Rally acceptance criteria into AI-generated test cases and Postman collections.

## Quick Start

### Requirements
- Node.js 14 or higher
- npm
- Optional: Rust + Tauri CLI if you want to run the desktop build
- Valid AI API key for OpenAI, GROQ, or Google Gemini

### 1) Run the backend locally

The current backend entry point is:

- `src-tauri/resources/node/server.js`

From the repository root:

```powershell
npm install
copy .env.example src-tauri/resources/node/.env
node .\src-tauri\resources\node\server.js
```

If you prefer Bash:

```bash
npm install
cp .env.example src-tauri/resources/node/.env
node src-tauri/resources/node/server.js
```

### 2) Open the frontend

The web UI is a static page at `public/index.html`. Open that file in your browser and make sure the backend is running on `http://localhost:3000`.

### 3) Run the Tauri desktop app

The repository also includes a Tauri wrapper. Use this command from the project root:

```powershell
npm run tauri:dev
```

This launches the desktop app and automatically starts the Node.js backend from `src-tauri/resources/node/server.js`.

## Current Project Layout

```
Rally-Test-Case-Generator/
  public/
    index.html
  src-tauri/
    resources/
      node/
        server.js
        rally.js
        testCaseGenerator.js
        utils/
          postmanGenerator.js
          swaggerParser.js
    src/
      main.rs
    tauri.conf.json
    Cargo.toml
  .env.example
  package.json
  DEVELOPMENT.md
  src-tauri/TAURI_SETUP.md
```

## What the app does today

- Accepts AI provider selection in the UI
- Validates credentials via `POST /api/config/validate`
- Generates combined AI test cases and Postman request definitions via `POST /api/generate/combined`
- Loads Swagger/OpenAPI endpoints via `POST /api/generate/swagger-endpoints`
- Exposes raw AI output and parsed results to the frontend

## Current Backend API

- `GET /api/health`
- `POST /api/config/validate`
- `POST /api/generate/combined`
- `POST /api/generate/postman`
- `POST /api/generate/testcases`
- `POST /api/generate/swagger-endpoints`
- `POST /api/export/postman`
- `GET /api/rally/stories`
- `GET /api/rally/story/:formattedId`

> Note: The current frontend uses the config validation, combined generation, and Swagger endpoint routes.

## Environment and runtime notes

The Node backend loads `.env` from `src-tauri/resources/node/.env` if present. That file is useful for configuring `PORT` and runtime settings.

Example `.env` values:

```env
PORT=3000
NODE_ENV=development
```

The UI sends AI credentials in the validation request body, so the current frontend does not rely on API keys being present in the backend `.env` file.

## Usage summary

1. Start the backend with `node src-tauri/resources/node/server.js`
2. Open `public/index.html` in a browser
3. Choose an AI provider
4. Paste your API key
5. Enter story name and acceptance criteria
6. Click Generate to receive test cases and Postman output

## Notes

- The backend does not serve the UI file directly.
- If you want the desktop app experience, use `npm run tauri:dev`.
