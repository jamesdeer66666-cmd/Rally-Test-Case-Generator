#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

static NODE_SERVER: Mutex<Option<Child>> = Mutex::new(None);

/// Start the Node backend from resources/node/server.js
#[tauri::command]
async fn start_backend(app: AppHandle) -> Result<String, String> {
  let mut server = NODE_SERVER
    .lock()
    .map_err(|e| format!("Lock error: {}", e))?;

  if server.is_some() {
    return Ok("Backend already running".into());
  }

  let server_js = if cfg!(debug_assertions) {
    // ✅ DEV MODE — run from source directory
    let mut path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop(); // remove `src-tauri`
    path.push("src-tauri");
    path.push("resources");
    path.push("node");
    path.push("server.js");
    path
  } else {
    // ✅ PRODUCTION MODE — run from bundled resources
    app.path()
      .resource_dir()
      .map_err(|e| format!("Failed to resolve resource dir: {}", e))?
      .join("node")
      .join("server.js")
  };

  let child = Command::new("node")
    .arg(&server_js)
    .spawn()
    .map_err(|e| format!("Failed to start Node backend: {}", e))?;

  *server = Some(child);
  println!("✅ Backend started");

  Ok("Backend started".into())
}


/// Stop the Node backend
#[tauri::command]
async fn stop_backend() -> Result<String, String> {
  let mut server = NODE_SERVER
    .lock()
    .map_err(|e| format!("Lock error: {}", e))?;

  if let Some(mut child) = server.take() {
    let _ = child.kill();
    println!("🛑 Backend stopped");
    return Ok("Backend stopped".into());
  }

  Ok("Backend not running".into())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      start_backend,
      stop_backend
    ])
    .setup(|app| {
      let app_handle = app.handle().clone();

      tauri::async_runtime::spawn(async move {
        if let Err(err) = start_backend(app_handle).await {
          eprintln!("❌ Failed to start backend: {}", err);
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}