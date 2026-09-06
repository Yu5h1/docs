# HealthAI 互動 Demo

直接用瀏覽器開啟 `index.html`。部署時複製整個 `HealthAI` 資料夾，保留相對路徑。

## 檔案責任

| 檔案 | 責任 |
| --- | --- |
| `index.html` | 畫面結構與內嵌 SVG |
| `styles.css` | 色票、版面、符號動畫與層級 |
| `js/motion.js` | 可取消的彈簧動畫、速度延續、Reduce Motion |
| `js/state.js` | 共用畫面狀態與提示 |
| `js/demo.js` | 虛構腳本與細節資料 |
| `js/conversation.js` | 訊息與完整對話紀錄 |
| `js/sheets.js` | 共用細節／聊天面板、拖拉、收合 |
| `js/signals.js` | 訊號呈現與散落／橫列切換 |
| `js/app.js` | 事件綁定與初始化、導播控制 |

腳本依 HTML 列出的順序載入，使用一般 script 以支援本機檔案預覽，沒有模組下載或建置步驟。
`state.js` 擁有共用狀態；這些檔案共享同一頁面的作用域，非獨立套件。

面板拖拉使用 Pointer Events，放手後的速度傳入 `Motion.spring`。動畫完成才清除開啟狀態，
避免隱藏屬性中斷退場；短距離拖拉回彈。系統 Reduce Motion 開啟時直接到終點。
訊號切換使用切換前後的位置差進行補間，版面位置由 CSS 擁有。

此 Demo 提供互動規格參考；正式 Unity 實作不直接重用這些 JavaScript。
