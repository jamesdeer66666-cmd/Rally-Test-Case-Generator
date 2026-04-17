#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::process::{Child, Command};
use std::sync::Mutex;
use std::env;
use tauri::{Emitter, Manager};

static NODE_SERVER: Mutex<Option<Child>> = Mutex::new(None);

#[tauri::command]
async fn start_backend() -> Result<String, String> {
  let mut server = NODE_SERVER.lock().map_err(|e| e.to_string())?;
  
  if server.is_some() {
    return Ok("Backend already running".to_string());
  }

  // Get the project root directory
  let exe_path = env::current_exe().map_err(|e| format!("Failed to get exe path: {}", e))?;
  let exe_dir = exe_path.parent().ok_or("Failed to get exe parent directory")?;
  
  // Navigate from src-tauri/target/debug/rally-ai-testcase-generator.exe to root
  let project_root = exe_dir
    .parent()
    .and_then(|p| p.parent())
    .and_then(|p| p.parent())
    .ok_or("Failed to find project root")?;
  
  let server_js = project_root.join("src").join("server.js");

  let child = Command::new("node")
    .arg(&server_js)
    .current_dir(&project_root)
    .spawn()
    .map_err(|e| format!("Failed to start backend: {} (trying path: {:?})", e, server_js))?;

  *server = Some(child);
  Ok("Backend started".to_string())
}

#[tauri::command]
async fn stop_backend() -> Result<String, String> {
  let mut server = NODE_SERVER.lock().map_err(|e| e.to_string())?;
  
  if let Some(mut child) = server.take() {
    let _ = child.kill();
    return Ok("Backend stopped".to_string());
  }

  Ok("Backend not running".to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      start_backend,
      stop_backend
    ])
    .setup(|app| {
      // Get the main window through the app handle
      let windows = app.webview_windows();
      if let Some((_, window)) = windows.iter().next() {
        let _ = window.emit("backend-starting", ());
        
        tauri::async_runtime::spawn(async {
          match start_backend().await {
            Ok(msg) => println!("✅ {}", msg),
            Err(e) => eprintln!("❌ Error: {}", e),
          }
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
