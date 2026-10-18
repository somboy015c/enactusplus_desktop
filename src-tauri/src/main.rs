// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
fn open_target(t: &str) -> Result<(), String> {
    Command::new("rundll32").args(["url.dll,FileProtocolHandler", t]).spawn().map(|_| ()).map_err(|e| e.to_string())
}
#[cfg(target_os = "macos")]
fn open_target(t: &str) -> Result<(), String> {
    Command::new("open").arg(t).spawn().map(|_| ()).map_err(|e| e.to_string())
}
#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn open_target(t: &str) -> Result<(), String> {
    Command::new("xdg-open").arg(t).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn reveal(p: &str) { let _ = Command::new("explorer").arg(format!("/select,{}", p)).spawn(); }
#[cfg(target_os = "macos")]
fn reveal(p: &str) { let _ = Command::new("open").args(["-R", p]).spawn(); }
#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn reveal(p: &str) { if let Some(d) = std::path::Path::new(p).parent() { let _ = open_target(&d.to_string_lossy()); } }

/// Opens a web link (Team hub, job applications, Microsoft sign-in…) in the system browser.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only web links can be opened.".into());
    }
    open_target(&url)
}

/// Saves a downloaded attachment into the user's Downloads folder and shows it there.
#[tauri::command]
fn save_download(name: String, data: String) -> Result<String, String> {
    let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
    let clean: String = name.chars().map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c }).collect();
    let clean = if clean.trim().is_empty() { "file".to_string() } else { clean };
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).map_err(|e| e.to_string())?;
    let dir = PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut path = dir.join(&clean);
    let mut n = 1;
    while path.exists() {
        let p = std::path::Path::new(&clean);
        let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "file".into());
        let ext = p.extension().map(|s| format!(".{}", s.to_string_lossy())).unwrap_or_default();
        path = dir.join(format!("{} ({}){}", stem, n, ext));
        n += 1;
    }
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    let shown = path.to_string_lossy().to_string();
    reveal(&shown);
    Ok(shown)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_external, save_download])
        .run(tauri::generate_context!())
        .expect("error while running EnactusNG Plus");
}
