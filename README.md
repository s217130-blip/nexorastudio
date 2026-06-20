# Nexora 多益 AI 學習平台

這版已把原本「使用者在右上角貼 Gemini API Key」改成雲端代理架構。

產品定位：由 Nexora AI 驅動的多益學習系統。Nexora AI 負責個人化學習、弱點摘要與任務調度；雲端出題引擎負責題型、難度、解析與成本控管；辭典層負責權威字義與多益繁中學習資料。

## 頁面

- `index.html`：首頁工具入口
- `vocabulary.html`：英文單字智慧掃描
- `quiz.html`：TOEIC Part 5 智能出題
- `assistant.html`：Nexora AI 學習助理
- `resources.html`：多益與學習資源
- `tasks.html`：登入與學習任務設定

## 雲端 API

前端會呼叫：

- `POST /api/word`
- `POST /api/dictionary/search`
- `GET /api/dictionary/cache/:word`
- `POST /api/quiz`
- `POST /api/quiz/generate`
- `POST /api/quiz/attempt`
- `POST /api/assistant`
- `POST /api/assistant/summary`
- `GET /api/tasks`
- `POST /api/tasks`

目前本機如果沒有後端，會自動使用示範資料，方便直接預覽版面。正式部署時可使用 `cloudflare-worker.js`，並在 Worker 設定環境變數 `GEMINI_API_KEY`。

## 登入與任務後台建議

目前 `tasks.html` 用 localStorage 模擬登入與任務狀態。正式版建議：

- 前端部署：Vercel 或 Cloudflare Pages
- 登入：Vercel Auth、NextAuth、Supabase Auth，或 Cloudflare Access
- 任務資料：Cloudflare D1 存 users、plans、tasks、task_events
- 快取：Cloudflare KV 快取常見單字解析與 AI 回覆
- AI 代理：Cloudflare Worker 或 Vercel Function 統一呼叫 Gemini/OpenAI，前端不保存任何模型金鑰

建議資料表：

```sql
users(id, email, created_at)
study_plans(id, user_id, target_score, exam_date, daily_minutes, created_at)
tasks(id, user_id, title, category, due_date, completed_at, created_at)
task_events(id, task_id, event_type, metadata_json, created_at)
ai_usage(id, user_id, feature, tokens, cost_estimate, created_at)
```

## 出題與辭典資料策略

出題需要資料，不只是模型提示詞。建議拆成：

- 題型資料：Part 5 常見考點、題幹模板、選項干擾規則
- 學習資料：使用者錯題、完成率、常錯詞性/時態/介系詞
- 難度校準：每題答對率、平均作答時間、錯誤選項分布
- 生成流程：雲端先選考點與難度，再請模型生成題目，最後用規則檢查 JSON、答案與解析

辭典層建議拆成兩段：

- 權威來源：Oxford / Cambridge 類資料需走正式授權、資料 API 或外部連結，不建議直接抓取內容
- Nexora 詞庫：自建多益常見字義、台灣繁中解釋、商務情境例句、考頻與字根資料

長期做法不是每次都「重新訓練模型」，而是先累積任務、錯題、單字與使用紀錄，讓 Nexora AI 在回答時讀取這些資料。等資料量夠，再評估 RAG、向量搜尋或微調。

## 目前需要準備的後台資源

- `GEMINI_API_KEY`：放在 Cloudflare Worker 或 Vercel Function 的環境變數
- `DICTIONARY_KV`：Cloudflare KV binding，用來快取雲端辭典查詢
- `DB`：Cloudflare D1 binding，用來存任務、答題紀錄、使用者設定
- 登入方案：Cloudflare Access、Vercel Auth、NextAuth 或 Supabase Auth 擇一
- 字典授權：若要使用 Oxford / Cambridge 類內容，需要授權 API 或資料授權；未授權時只做外部連結與 Nexora 自建定義

建議先用這個流程跑通 MVP：

1. Vercel / Cloudflare Pages 部署前端。
2. Cloudflare Worker 部署 `cloudflare-worker.js`。
3. 綁定 `GEMINI_API_KEY`、`DICTIONARY_KV`、`DB`。
4. 學習任務先存 D1，登入可先用 demo user，等流程穩定後再接正式 Auth。
5. 後台看 `backend.html` 的四個服務：辭典、出題、Nexora AI、學習任務。

若前端與 API 不同網域，可在頁面載入 `assets/app.js` 前加入：

```html
<script>
  window.NEXORA_API_BASE = "https://your-worker.example.com/api";
</script>
```
