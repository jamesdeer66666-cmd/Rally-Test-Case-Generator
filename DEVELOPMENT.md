# Rally AI Test Case Generator - Development Guide

## Overview

This repository combines a static frontend with a Node.js backend and a Tauri desktop wrapper.

- Frontend: `public/index.html`
- Backend: `src-tauri/resources/node/server.js`
- Tauri wrapper: `src-tauri/src/main.rs`

## Running locally

### Install dependencies

```powershell
npm install
```

### Start the backend directly

```powershell
node .\src-tauri\resources\node\server.js
```

Then open `public/index.html` in your browser.

### Run via Tauri

```powershell
npm run tauri:dev
```

This starts the Tauri desktop app and launches the Node.js backend automatically.

## Project structure

```
Rally-Test-Case-Generator/
  public/
    index.html
  src-tauri/
    resources/node/
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
```

## Backend API

- `GET /api/health`
- `POST /api/config/validate`
- `POST /api/generate/combined`
- `POST /api/generate/testcases`
- `POST /api/generate/postman`
- `POST /api/generate/swagger-endpoints`
- `POST /api/export/postman`
- `GET /api/rally/stories`
- `GET /api/rally/story/:formattedId`

## Key implementation details

### `src-tauri/resources/node/server.js`

- Uses Express for API routing
- Loads environment variables from `src-tauri/resources/node/.env`
- Supports AI provider configuration at runtime
- Exposes Rally integration and Swagger/OpenAPI parsing

### `src-tauri/resources/node/testCaseGenerator.js`

- Generates JSON-formatted AI responses for test cases and Postman intents
- Supports providers: OpenAI, GROQ, Gemini
- Sanitizes AI output and parses valid JSON

### `src-tauri/resources/node/rally.js`

- Wraps Rally REST API calls using Axios
- Fetches user stories and acceptance criteria

### `public/index.html`

- Contains the frontend user interface
- Uses `fetch()` to call the backend API at `http://localhost:3000`
- Current UI fields include AI provider, API key, story name, acceptance criteria, and optional endpoint

## Environment configuration

If you want to customize the backend port, create a `.env` file in `src-tauri/resources/node/`.

Example:

```env
PORT=3000
NODE_ENV=development
```

## Notes

- The Node backend does not serve static assets for the UI.
- The UI is a static client page that sends requests to `http://localhost:3000`.
- The current frontend does not expose Rally story fetch UI controls that older docs described.
