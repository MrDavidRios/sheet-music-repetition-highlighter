use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteLocator {
    pub index: i32,
    pub measure: i32,
    pub beat: Option<f64>,
    pub pitch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pattern {
    pub id: i32,
    pub length: i32,
    pub count: i32,
    pub positions: Vec<i32>,
    pub notes: Vec<NoteLocator>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StaffPatternData {
    pub part_index: i32,
    pub part_name: String,
    pub patterns: Vec<Pattern>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub file: String,
    pub treble: StaffPatternData,
    pub bass: StaffPatternData,
    pub musicxml_content: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisError {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Progress {
    #[serde(rename = "type")]
    pub progress_type: String,
    pub stage: String,
    pub current: i32,
    pub total: i32,
    pub message: String,
}

#[tauri::command]
async fn analyze_music(app: tauri::AppHandle, path: String) -> Result<AnalysisResult, String> {
    // Debug: print resource path
    if let Ok(resource_dir) = app.path().resource_dir() {
        eprintln!("Resource dir: {:?}", resource_dir);
    }

    let sidecar = app
        .shell()
        .sidecar("analyzer")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args([&path]);

    eprintln!("Sidecar created, attempting to spawn...");

    let (mut rx, _child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {} (path: {})", e, path))?;

    let mut stdout_buffer = String::new();
    let mut stderr_lines: Vec<String> = Vec::new();
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                // Try to parse as progress JSON
                if let Ok(progress) = serde_json::from_str::<Progress>(&line) {
                    let _ = app.emit("analyze-progress", &progress);
                } else {
                    // Not progress - collect for potential error reporting
                    stderr_lines.push(line.to_string());
                }
            }
            CommandEvent::Stdout(line_bytes) => {
                stdout_buffer.push_str(&String::from_utf8_lossy(&line_bytes));
                stdout_buffer.push('\n');
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
                break;
            }
            CommandEvent::Error(err) => {
                return Err(format!("Command error: {}", err));
            }
            _ => {}
        }
    }

    // Check for error JSON in stdout first (Python prints errors to stdout as JSON)
    if let Ok(err) = serde_json::from_str::<AnalysisError>(&stdout_buffer) {
        return Err(err.error);
    }

    // Check exit code
    if exit_code != Some(0) {
        // Filter out Python warnings, keep only actual errors
        let filtered_stderr: String = stderr_lines
            .iter()
            .filter(|line| !line.contains("Warning") && !line.contains("warnings.warn"))
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        let error_msg = if filtered_stderr.trim().is_empty() {
            format!("Process failed with exit code: {:?}", exit_code)
        } else {
            filtered_stderr
        };
        return Err(format!("Analyzer failed: {}", error_msg));
    }

    serde_json::from_str::<AnalysisResult>(&stdout_buffer)
        .map_err(|e| format!("Failed to parse output: {} (got: {:?})", e, stdout_buffer))
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn reveal_in_finder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| format!("Failed to reveal in Finder: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![analyze_music, read_file, reveal_in_finder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
