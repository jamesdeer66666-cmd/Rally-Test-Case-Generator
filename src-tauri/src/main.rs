#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread::sleep;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

static NODE_SERVER: Mutex<Option<Child>> = Mutex::new(None);

fn resolve_backend_executable(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let exe_name = if cfg!(target_os = "windows") {
    "server-win.exe"
  } else if cfg!(target_os = "linux") {
    "server-linux"
  } else if cfg!(target_os = "macos") {
    "server-macos"
  } else {
    return Err("Unsupported platform".into());
  };

  let mut candidates = Vec::new();

  if let Ok(resource_dir) = app.path().resource_dir() {
    candidates.push(resource_dir.join("node").join("dist").join(exe_name));
    candidates.push(resource_dir.join("dist").join(exe_name));
  }

  if let Ok(current_exe) = std::env::current_exe() {
    if let Some(parent) = current_exe.parent() {
      candidates.push(parent.join("resources").join("node").join("dist").join(exe_name));
      candidates.push(parent.join("node").join("dist").join(exe_name));
      candidates.push(parent.join(exe_name));
    }
  }

  for candidate in candidates {
    if candidate.exists() {
      return Ok(candidate);
    }
  }

  Err("Could not find bundled backend executable in resource paths".into())
}

fn wait_for_backend_ready() -> Result<(), String> {
  let timeout = Duration::from_secs(5);
  let start = Instant::now();

  while start.elapsed() < timeout {
    if TcpStream::connect("127.0.0.1:3000").is_ok() {
      return Ok(());
    }
    sleep(Duration::from_millis(100));
  }

  Err("Backend did not become ready within 5 seconds".into())
}

#[tauri::command]
async fn launch_backend(app: AppHandle) -> Result<String, String> {
  let mut server = NODE_SERVER
    .lock()
    .map_err(|e| format!("Lock error: {}", e))?;

  if server.is_some() {
    return Ok("Backend already running".into());
  }

  let (command, args, working_dir) = if cfg!(debug_assertions) {
    // ✅ DEV MODE — run from source directory with node
    let mut path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop(); // remove `src-tauri`
    path.push("src-tauri");
    path.push("resources");
    path.push("node");
    path.push("server.js");
    (
      "node".to_string(),
      vec![path.to_string_lossy().to_string()],
      std::env::current_dir().map_err(|e| format!("Could not resolve cwd: {}", e))?,
    )
  } else {
    // ✅ PRODUCTION MODE — run bundled executable
    let exe_path = resolve_backend_executable(&app)?;
    println!("Starting backend executable at {:?}", exe_path);
    let working_dir = exe_path
      .parent()
      .ok_or_else(|| "Failed to determine backend working directory".to_string())?
      .to_path_buf();
    (exe_path.to_string_lossy().to_string(), vec![], working_dir)
  };

  let child = Command::new(&command)
    .args(&args)
    .current_dir(working_dir)
    .spawn()
    .map_err(|e| format!("Failed to start Node backend '{}': {}", command, e))?;

  wait_for_backend_ready()
    .map_err(|e| format!("Backend launch failed: {}", e))?;

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
      launch_backend,
      stop_backend
    ])
    .setup(|app| {
      let app_handle = app.handle().clone();

      tauri::async_runtime::spawn(async move {
        if let Err(err) = launch_backend(app_handle).await {
          eprintln!("❌ Failed to start backend: {}", err);
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}