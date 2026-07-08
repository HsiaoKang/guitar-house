/// 应用入口：注册插件并启动 Tauri 运行时
///
/// 当前注册的插件：
/// - dialog: 提供原生文件选择对话框，用于挑选视频/谱子文件
/// - fs: 提供文件读取能力，用于加载 Guitar Pro 等二进制谱文件
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
