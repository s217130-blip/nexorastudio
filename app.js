const $ = (id) => document.getElementById(id);

const etymDB = {
  prefixes: [
    { c: "trans", m: "跨越/轉移" }, { c: "contra", m: "相反/對抗" }, { c: "inter", m: "相互/之間" },
    { c: "sub", m: "下方/次要" }, { c: "con", m: "共同/加強" }, { c: "com", m: "共同/一起" },
    { c: "dis", m: "否定/分離" }, { c: "pre", m: "提前/在先" }, { c: "pro", m: "向前/支持" },
    { c: "re", m: "再次/返回" }, { c: "in", m: "進入/否定" }, { c: "un", m: "不/相反" },
    { c: "ex", m: "向外/前" }, { c: "mis", m: "錯誤/不當" }, { c: "over", m: "過多/超越" }
  ],
  roots: [
    { c: "port", m: "搬運/攜帶" }, { c: "dict", m: "言語/說話" }, { c: "vis", m: "看見/視線" },
    { c: "spect", m: "觀看/審視" }, { c: "tract", m: "拉引/抽取" }, { c: "press", m: "擠壓/按壓" },
    { c: "duct", m: "引導/帶領" }, { c: "gest", m: "攜帶/產生" }, { c: "ven", m: "來/到" },
    { c: "mit", m: "送出/投遞" }, { c: "pos", m: "放置/提出" }, { c: "fer", m: "攜帶/承受" },
    { c: "scrib", m: "書寫/記錄" }, { c: "struct", m: "建造/組織" }, { c: "rupt", m: "破裂/中斷" }
  ],
  suffixes: [
    { c: "tion", m: "動作或狀態名詞" }, { c: "ment", m: "結果/行為" }, { c: "ize", m: "使成為" },
    { c: "ise", m: "使成為" }, { c: "ible", m: "可...的" }, { c: "able", m: "能...的" },
    { c: "er", m: "從事者/工具" }, { c: "ous", m: "充滿...的" }, { c: "al", m: "具有...特性的" },
    { c: "ly", m: "以...方式" }, { c: "ness", m: "狀態/性質" }, { c: "ive", m: "具有...傾向" },
    { c: "ance", m: "狀態/行為" }, { c: "ence", m: "狀態/性質" }, { c: "ity", m: "性質/狀態" }
  ]
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function analyzeEtymon(word) {
  const w = word.toLowerCase();
  const res = [];
  etymDB.prefixes.forEach((p) => { if (w.startsWith(p.c) && w.length > p.c.length + 2) res.push({ label: "字首", code: `${p.c}-`, mean: p.m }); });
  etymDB.roots.forEach((r) => { if (w.includes(r.c) && w.length > r.c.length) res.push({ label: "字根", code: r.c, mean: r.m }); });
  etymDB.suffixes.forEach((s) => { if (w.endsWith(s.c) && w.length > s.c.length + 1) res.push({ label: "字尾", code: `-${s.c}`, mean: s.m }); });
  return res;
}

function apiBase() {
  return window.NEXORA_API_BASE || "/api";
}

async function callCloud(path, payload, fallback) {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Nexora cloud API unavailable, using demo fallback.", error);
    return fallback(payload);
  }
}

function showState(state) {
  ["Welcome", "Loading", "Result"].forEach((name) => {
    const el = $(`state${name}`);
    if (!el) return;
    el.style.display = state === name.toLowerCase() ? (name === "Result" ? "block" : "flex") : "none";
  });
}

function setResult(html) {
  const result = $("stateResult");
  if (!result) return;
  result.innerHTML = html;
  showState("result");
}

function showErrNotice(message) {
  const notice = $("errNotice");
  if (notice) {
    notice.textContent = `! ${message}`;
    notice.style.display = "block";
  }
  showState("welcome");
}

function renderWord(ai, word) {
  const etym = analyzeEtymon(word);
  const freqClass = { high: "freq-high", medium: "freq-medium", low: "freq-low" }[ai.toeicFreq] || "freq-low";
  const freqLabel = { high: "多益高頻", medium: "多益中頻", low: "多益低頻" }[ai.toeicFreq] || "多益";
  let html = `<div class="word-header">
    <span class="word-main">${escapeHtml(ai.word || word).toUpperCase()}</span>
    <span class="word-phon">${ai.phonetic ? `/${escapeHtml(ai.phonetic).replaceAll("/", "")}/` : ""}</span>
    <span class="freq-badge ${freqClass}">${freqLabel}</span>
  </div>`;

  html += '<div class="result-section"><div class="result-label">核心多義定義</div>';
  (ai.meanings || []).forEach((m) => {
    html += `<div class="meaning-card"><div class="pos-tag">${escapeHtml(m.pos)}</div><div><div class="meaning-zh">${escapeHtml(m.zhDef)}</div><div class="meaning-en">${escapeHtml(m.engDef)}</div></div></div>`;
  });
  html += "</div>";

  if (etym.length > 0) {
    html += '<div class="result-section"><div class="result-label">X 光字根拆解</div><div class="etym-grid">';
    etym.forEach((e) => {
      html += `<div class="etym-item"><div><div class="etym-code">${escapeHtml(e.code)}</div><div class="etym-type">${escapeHtml(e.label)}</div></div><div class="etym-mean">${escapeHtml(e.mean)}</div></div>`;
    });
    html += "</div></div>";
  }

  if (ai.examples?.length > 0) {
    html += '<div class="result-section"><div class="result-label">多益情境例句</div>';
    ai.examples.forEach((ex, i) => {
      html += `<div class="ex-card"><div class="ex-meta"><span class="ex-pos">例句 ${i + 1} · ${escapeHtml(ex.pos)}</span><span class="ex-tag">${escapeHtml(ex.tag || "商務應用")}</span></div><div class="ex-eng">"${escapeHtml(ex.eng)}"</div><div class="ex-zh">${escapeHtml(ex.zht)}</div></div>`;
    });
    html += "</div>";
  }
  return html;
}

function demoWord({ word }) {
  const lower = word.toLowerCase();
  const samples = {
    conference: {
      word: "conference",
      phonetic: "ˈkɑnfərəns",
      toeicFreq: "high",
      meanings: [
        { pos: "n.", zhDef: "會議；研討會", engDef: "a formal meeting for discussion" },
        { pos: "n.", zhDef: "協商；討論", engDef: "a discussion between people who exchange information" }
      ],
      examples: [
        { pos: "n.", eng: "The annual sales conference will be held in Taipei next month.", zht: "年度業務會議將於下個月在台北舉行。", tag: "商務會議" }
      ]
    },
    initially: {
      word: "initially",
      phonetic: "ɪˈnɪʃəlɪ",
      toeicFreq: "medium",
      meanings: [
        { pos: "adv.", zhDef: "起初；最初", engDef: "at the beginning" }
      ],
      examples: [
        { pos: "adv.", eng: "The project was initially scheduled for June.", zht: "該專案原先排定在六月進行。", tag: "專案管理" }
      ]
    }
  };
  return samples[lower] || {
    word: lower,
    phonetic: "",
    toeicFreq: "medium",
    meanings: [
      { pos: "v./n.", zhDef: "雲端示範定義", engDef: "Demo definition shown when the cloud API is not connected." }
    ],
    examples: [
      { pos: "n.", eng: `The word "${lower}" will be analyzed by the cloud service after deployment.`, zht: "部署雲端 API 後，系統會回傳完整多益導向解析。", tag: "雲端備援" }
    ]
  };
}

function demoQuiz({ category }) {
  return {
    question: "The updated proposal must be submitted ______ Friday afternoon.",
    options: { A: "by", B: "on", C: "at", D: "for" },
    answer: "A",
    translation: "更新後的提案必須在週五下午以前提交。",
    explanation: "by 表示期限之前，符合 submit by Friday afternoon 的用法。on 用於日期或星期，at 用於時間點，for 表示目的或期間。",
    category
  };
}

function demoAssistant({ message }) {
  return {
    reply: `我會把你的問題拆成多益備考步驟。你剛剛問：「${message}」。建議先鎖定題型考點，再補 3 個同主題單字，最後用一題 Part 5 檢查是否真的會用。`
  };
}

async function doScan() {
  const input = $("wordInput");
  const word = input?.value.trim().toLowerCase();
  const notice = $("errNotice");
  if (notice) notice.style.display = "none";
  if (!word) return showErrNotice("請輸入英文單字");
  if (/[^a-zA-Z]/.test(word)) return showErrNotice("僅支援純英文字母");
  showState("loading");
  const ai = await callCloud("/word", { word }, demoWord);
  setResult(renderWord(ai, word));
}

let currentQuizData = null;

async function doQuiz() {
  const category = $("quizCategory")?.value || "商務會議";
  const notice = $("errNotice");
  if (notice) notice.style.display = "none";
  showState("loading");
  const ai = await callCloud("/quiz", { category }, demoQuiz);
  currentQuizData = ai;
  const opts = ["A", "B", "C", "D"].map((key) => `<button class="quiz-opt" id="opt${key}" data-answer="${key}"><span class="opt-key">${key}</span>${escapeHtml(ai.options[key])}</button>`).join("");
  setResult(`<div class="quiz-badge">Part 5 模擬題</div>
    <div class="quiz-q">${escapeHtml(ai.question)}</div>
    <div class="quiz-options">${opts}</div>
    <div class="quiz-analysis" id="quizAnalysis">
      <div class="ans-correct">正確答案：(${escapeHtml(ai.answer)}) ${escapeHtml(ai.options[ai.answer])}</div>
      <div class="ans-row"><strong>中文翻譯：</strong>${escapeHtml(ai.translation)}</div>
      <div class="ans-row"><strong>深度解析：</strong>${escapeHtml(ai.explanation)}</div>
    </div>`);
  document.querySelectorAll(".quiz-opt").forEach((btn) => btn.addEventListener("click", () => checkAnswer(btn.dataset.answer)));
}

function checkAnswer(pick) {
  if (!currentQuizData) return;
  const answer = currentQuizData.answer;
  ["A", "B", "C", "D"].forEach((key) => {
    const el = $(`opt${key}`);
    if (!el) return;
    el.onclick = null;
    if (key === answer) el.classList.add("correct");
    else if (key === pick) el.classList.add("wrong");
  });
  $("quizAnalysis")?.classList.add("show");
}

async function askAssistant(messageOverride) {
  const input = $("assistantInput");
  const message = (messageOverride || input?.value || "").trim();
  if (!message) return;
  const log = $("assistantLog");
  if (!log) return;
  log.insertAdjacentHTML("beforeend", `<div class="assistant-msg user"><strong>你</strong>${escapeHtml(message)}</div>`);
  if (input) input.value = "";
  const waiting = document.createElement("div");
  waiting.className = "assistant-msg";
  waiting.innerHTML = "<strong>Nexora AI</strong>思考中...";
  log.appendChild(waiting);
  const ai = await callCloud("/assistant", { message }, demoAssistant);
  waiting.innerHTML = `<strong>Nexora AI</strong>${escapeHtml(ai.reply)}`;
}

function initNav() {
  $("hamburger")?.addEventListener("click", () => $("mobileDrawer")?.classList.add("open"));
  $("drawerClose")?.addEventListener("click", closeDrawer);
  $("mobileDrawer")?.addEventListener("click", (e) => {
    if (e.target === $("mobileDrawer")) closeDrawer();
  });
}

function closeDrawer() {
  $("mobileDrawer")?.classList.remove("open");
}

window.closeDrawer = closeDrawer;
window.askAssistant = askAssistant;

const taskDefaults = [
  { id: "vocab", name: "完成 12 個多益高頻單字", note: "用雲端辭典查 3 個不熟詞，加入今天複習。", type: "單字", href: "vocabulary.html", done: false },
  { id: "part5", name: "練習 5 題 Part 5", note: "雲端出題系統會依考點產生題目，做完再看解析。", type: "出題", href: "quiz.html", done: false },
  { id: "assistant", name: "請 Nexora AI 整理一個弱點", note: "貼一題錯題，讓 AI 轉成複習規則與下一步任務。", type: "AI", href: "assistant.html", done: false }
];

function cloneTaskDefaults() {
  return taskDefaults.map((task) => ({ ...task }));
}

function getTaskState() {
  const saved = localStorage.getItem("nexoraTasks");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      parsed.profile = parsed.profile || { targetScore: 750, examDate: "", dailyMinutes: 30 };
      parsed.tasks = (parsed.tasks || cloneTaskDefaults()).map((task) => ({
        href: task.href || taskDefaults.find((item) => item.id === task.id)?.href || "assistant.html",
        done: Boolean(task.done),
        ...task
      }));
      return parsed;
    } catch {
      localStorage.removeItem("nexoraTasks");
    }
  }
  return {
    user: null,
    profile: { targetScore: 750, examDate: "", dailyMinutes: 30 },
    tasks: cloneTaskDefaults()
  };
}

function saveTaskState(state) {
  localStorage.setItem("nexoraTasks", JSON.stringify(state));
}

function renderTaskPage() {
  const root = $("taskApp");
  if (!root) return;
  const state = getTaskState();
  if (!state.user) {
    root.innerHTML = `<div class="auth-box">
      <div class="auth-tabs"><button class="auth-tab active">登入</button><button class="auth-tab">註冊</button></div>
      <label class="form-label">Email</label>
      <input id="taskEmail" class="form-input" type="email" placeholder="student@nexora.ai">
      <div style="height:8px;"></div>
      <label class="form-label">密碼</label>
      <input id="taskPassword" class="form-input" type="password" placeholder="至少 8 碼">
      <div style="height:12px;"></div>
      <button class="btn btn-primary btn-full" id="taskLoginBtn">進入學習任務</button>
      <div class="task-meta">目前是可操作原型；正式版會接 Cloudflare Access、Vercel Auth 或 NextAuth。</div>
    </div>`;
    $("taskLoginBtn")?.addEventListener("click", () => {
      const email = $("taskEmail")?.value.trim() || "student@nexora.ai";
      const next = getTaskState();
      next.user = { email };
      saveTaskState(next);
      renderTaskPage();
    });
    return;
  }

  const doneCount = state.tasks.filter((task) => task.done).length;
  const progress = state.tasks.length ? Math.round((doneCount / state.tasks.length) * 100) : 0;
  root.innerHTML = `<div class="task-layout">
    <aside class="task-panel">
      <h3>學習設定</h3>
      <label class="form-label">目標分數</label>
      <input id="targetScore" class="form-input" type="number" min="10" max="990" step="5" value="${escapeHtml(state.profile.targetScore)}">
      <div style="height:8px;"></div>
      <label class="form-label">考試日期</label>
      <input id="examDate" class="form-input" type="date" value="${escapeHtml(state.profile.examDate)}">
      <div style="height:8px;"></div>
      <label class="form-label">每日分鐘數</label>
      <input id="dailyMinutes" class="form-input" type="number" min="10" max="180" step="5" value="${escapeHtml(state.profile.dailyMinutes)}">
      <div style="height:12px;"></div>
      <button class="btn btn-primary btn-full" id="savePlanBtn">儲存設定</button>
      <button class="btn btn-ghost btn-full" id="resetTasksBtn" style="margin-top:6px;">重設今日任務</button>
      <button class="btn btn-ghost btn-full" id="logoutTaskBtn" style="margin-top:6px;">登出</button>
      <div class="task-meta">登入：${escapeHtml(state.user.email)}</div>
    </aside>
    <section class="task-panel">
      <h3>今日任務</h3>
      <div class="task-meta">完成 ${doneCount} / ${state.tasks.length}，Nexora AI 會用完成紀錄調整下一步建議。</div>
      <div class="task-progress"><span style="width:${progress}%"></span></div>
      <div style="height:12px;"></div>
      <div class="task-list">${state.tasks.map((task) => `<label class="task-item ${task.done ? "done" : ""}">
        <input type="checkbox" data-task-id="${escapeHtml(task.id)}" ${task.done ? "checked" : ""}>
        <span><span class="task-name">${escapeHtml(task.name)}</span><span class="task-note">${escapeHtml(task.note)}</span></span>
        <span class="task-chip">${escapeHtml(task.type)}</span>
        <a class="task-action" href="${escapeHtml(task.href || "assistant.html")}">開始</a>
      </label>`).join("")}</div>
      <div style="height:14px;"></div>
      <label class="form-label">新增任務</label>
      <input id="newTaskName" class="form-input" type="text" placeholder="例如：複習介系詞 by / until / before">
      <div style="height:8px;"></div>
      <select id="newTaskType" class="form-select">
        <option value="單字">單字</option>
        <option value="出題">出題</option>
        <option value="AI">AI</option>
      </select>
      <div style="height:8px;"></div>
      <button class="btn btn-ghost" id="addTaskBtn">加入任務</button>
    </section>
  </div>`;

  $("savePlanBtn")?.addEventListener("click", () => {
    const next = getTaskState();
    next.profile = {
      targetScore: Number($("targetScore")?.value || 750),
      examDate: $("examDate")?.value || "",
      dailyMinutes: Number($("dailyMinutes")?.value || 30)
    };
    saveTaskState(next);
    renderTaskPage();
  });
  $("resetTasksBtn")?.addEventListener("click", () => {
    const next = getTaskState();
    next.tasks = cloneTaskDefaults();
    saveTaskState(next);
    renderTaskPage();
  });
  $("logoutTaskBtn")?.addEventListener("click", () => {
    const next = getTaskState();
    next.user = null;
    saveTaskState(next);
    renderTaskPage();
  });
  $("addTaskBtn")?.addEventListener("click", () => {
    const title = $("newTaskName")?.value.trim();
    const type = $("newTaskType")?.value || "AI";
    if (!title) return;
    const hrefMap = { "單字": "vocabulary.html", "出題": "quiz.html", "AI": "assistant.html" };
    const next = getTaskState();
    next.tasks.push({
      id: `task-${Date.now()}`,
      name: title,
      note: "自訂任務，之後可同步到 Cloudflare D1。",
      type,
      href: hrefMap[type] || "assistant.html",
      done: false
    });
    saveTaskState(next);
    renderTaskPage();
  });
  document.querySelectorAll("[data-task-id]").forEach((box) => {
    box.addEventListener("change", () => {
      const next = getTaskState();
      const task = next.tasks.find((item) => item.id === box.dataset.taskId);
      if (task) task.done = box.checked;
      saveTaskState(next);
      renderTaskPage();
    });
  });
}
// assets/app.js

document.addEventListener('DOMContentLoaded', () => {
  // 1. 手機版漢堡選單開關邏輯
  const hamburger = document.getElementById('hamburger');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerClose = document.getElementById('drawerClose');

  if (hamburger && mobileDrawer) {
    hamburger.addEventListener('click', () => {
      mobileDrawer.classList.add('open');
    });
  }

  if (drawerClose && mobileDrawer) {
    drawerClose.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
    });
  }

  // 2. 提供全域的全功能關閉抽屜函式（修正 HTML 上的 onclick 噴錯問題）
  window.closeDrawer = function() {
    if (mobileDrawer) {
      mobileDrawer.classList.remove('open');
    }
  };

  // 3. 測試本機示範資料流（如果還沒接 Worker API 的暫時防崩潰機制）
  const quizBtn = document.getElementById('quizBtn');
  if (quizBtn) {
    quizBtn.addEventListener('click', () => {
      const welcome = document.getElementById('stateWelcome');
      const loading = document.getElementById('stateLoading');
      if (welcome) welcome.style.display = 'none';
      if (loading) loading.style.display = 'flex';
      
      // 模擬 AI 雲端出題兩秒鐘
      setTimeout(() => {
        if (loading) loading.style.display = 'none';
        alert('前端大腦已接管！接下來只要把 cloudflare-worker.js 的 API 透過 fetch() 串進來，題目就會顯示在這邊了！');
      }, 1500);
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  renderTaskPage();
  $("scanBtn")?.addEventListener("click", doScan);
  $("wordInput")?.addEventListener("keypress", (e) => { if (e.key === "Enter") doScan(); });
  $("clearScanBtn")?.addEventListener("click", () => {
    if ($("wordInput")) $("wordInput").value = "";
    showState("welcome");
  });
  $("quizBtn")?.addEventListener("click", doQuiz);
  $("clearQuizBtn")?.addEventListener("click", () => {
    currentQuizData = null;
    showState("welcome");
  });
  $("assistantBtn")?.addEventListener("click", () => askAssistant());
  $("assistantInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) askAssistant();
  });
});
