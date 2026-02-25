use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteLocator {
    pub index: i32,
    pub measure: i32,
    pub beat: f64,
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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisError {
    pub error: String,
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

    eprintln!("Sidecar created, attempting to run...");

    let output = sidecar
        .output()
        .await
        .map_err(|e| format!("Failed to run sidecar: {} (path: {})", e, path))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for error JSON in stdout first (Python prints errors to stdout as JSON)
    if let Ok(err) = serde_json::from_str::<AnalysisError>(&stdout) {
        return Err(err.error);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Filter out Python warnings, keep only actual errors
        let filtered_stderr: String = stderr
            .lines()
            .filter(|line| !line.contains("Warning") && !line.contains("warnings.warn"))
            .collect::<Vec<_>>()
            .join("\n");
        let error_msg = if filtered_stderr.trim().is_empty() {
            format!("Process failed with exit code: {:?}", output.status.code())
        } else {
            filtered_stderr
        };
        return Err(format!("Analyzer failed: {}", error_msg));
    }

    serde_json::from_str::<AnalysisResult>(&stdout)
        .map_err(|e| format!("Failed to parse output: {}", e))
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![analyze_music, read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
