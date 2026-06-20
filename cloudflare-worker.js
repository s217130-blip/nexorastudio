const MODEL = "gemini-2.5-flash";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const body = await readBody(request);

    try {
      if (url.pathname === "/api/word" || url.pathname === "/api/dictionary/search") {
        requireMethod(request, "POST");
        return cors(json(await dictionarySearch(body.word, env)));
      }
      if (url.pathname.startsWith("/api/dictionary/cache/")) {
        requireMethod(request, "GET");
        const word = decodeURIComponent(url.pathname.split("/").pop() || "");
        return cors(json(await dictionaryCache(word, env)));
      }
      if (url.pathname === "/api/quiz" || url.pathname === "/api/quiz/generate") {
        requireMethod(request, "POST");
        return cors(json(await quizGenerate(body, env)));
      }
      if (url.pathname === "/api/quiz/attempt") {
        requireMethod(request, "POST");
        return cors(json(await quizAttempt(body, env)));
      }
      if (url.pathname === "/api/assistant") {
        requireMethod(request, "POST");
        return cors(json(await assistant(body.message, env)));
      }
      if (url.pathname === "/api/assistant/summary") {
        requireMethod(request, "POST");
        return cors(json(await assistantSummary(body, env)));
      }
      if (url.pathname === "/api/tasks") {
        if (!["GET", "POST"].includes(request.method)) return cors(json({ error: "GET or POST only" }, 405));
        return cors(json(await tasks(request, body, env)));
      }
      return cors(json({ error: "Not found" }, 404));
    } catch (error) {
      return cors(json({ error: error.message || "Cloud service failed" }, error.status || 500));
    }
  }
};

async function readBody(request) {
  if (request.method === "GET") return {};
  return request.json().catch(() => ({}));
}

function requireMethod(request, method) {
  if (request.method !== method) {
    const error = new Error(`${method} only`);
    error.status = 405;
    throw error;
  }
}

async function dictionarySearch(input, env) {
  const word = String(input || "").trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) throw new Error("Invalid word");

  const cached = await dictionaryCache(word, env).catch(() => null);
  if (cached?.hit) return cached.entry;

  const entry = await geminiJson(env, `You are Nexora's TOEIC dictionary engine for Taiwanese learners.
Analyze the English word "${word}".
Rules:
1. Use natural Traditional Chinese used in Taiwan.
2. Focus on TOEIC/business/travel/workplace meanings.
3. Do not copy Oxford, Cambridge, or any copyrighted dictionary text.
4. Return concise original definitions and examples.
5. toeicFreq must be high, medium, or low.
Return JSON only:
{"word":"${word}","phonetic":"KK phonetic if known","toeicFreq":"medium","meanings":[{"pos":"n.","zhDef":"Traditional Chinese definition","engDef":"short original English definition"}],"examples":[{"pos":"n.","eng":"TOEIC-style example sentence","zht":"Traditional Chinese translation","tag":"business"}]}`);

  if (env.DICTIONARY_KV) {
    await env.DICTIONARY_KV.put(`word:${word}`, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 30 });
  }
  return entry;
}

async function dictionaryCache(word, env) {
  const clean = String(word || "").trim().toLowerCase();
  if (!/^[a-z]+$/.test(clean)) throw new Error("Invalid word");
  if (!env.DICTIONARY_KV) return { hit: false, entry: null };
  const raw = await env.DICTIONARY_KV.get(`word:${clean}`);
  return { hit: Boolean(raw), entry: raw ? JSON.parse(raw) : null };
}

async function quizGenerate(body, env) {
  const category = String(body.category || "商務會議").slice(0, 80);
  const difficulty = String(body.difficulty || "medium").slice(0, 20);
  const weakness = String(body.weakness || "general Part 5 grammar").slice(0, 160);
  return geminiJson(env, `You are Nexora's TOEIC Part 5 cloud question engine.
Generate one high-quality TOEIC Part 5 sentence completion question.
Context: ${category}
Difficulty: ${difficulty}
Learner weakness: ${weakness}
Rules:
1. Choose one clear test point: part of speech, tense, voice, conjunction, or preposition.
2. Options must be plausible English distractors.
3. answer must be A/B/C/D.
4. translation and explanation must be in Traditional Chinese for Taiwan.
5. Return JSON only:
{"question":"The meeting has been ______ to next Monday due to the holiday.","options":{"A":"postpone","B":"postponed","C":"postponing","D":"postponement"},"answer":"B","translation":"由於假日，會議已推遲至下週一。","explanation":"has been + 過去分詞形成被動語態，故選 B。","skill":"passive voice","difficulty":"medium"}`);
}

async function quizAttempt(body, env) {
  const userId = String(body.userId || "demo");
  const record = {
    id: crypto.randomUUID(),
    userId,
    questionId: body.questionId || null,
    answer: body.answer || null,
    correct: Boolean(body.correct),
    skill: body.skill || "unknown",
    createdAt: new Date().toISOString()
  };
  if (env.DB) {
    await env.DB.prepare(
      "insert into quiz_attempts (id, user_id, question_id, answer, correct, skill, created_at) values (?, ?, ?, ?, ?, ?, ?)"
    ).bind(record.id, record.userId, record.questionId, record.answer, record.correct ? 1 : 0, record.skill, record.createdAt).run();
  }
  return { saved: Boolean(env.DB), record };
}

async function assistant(message, env) {
  const text = String(message || "").trim().slice(0, 1200);
  if (!text) throw new Error("Empty message");
  return geminiJson(env, `You are Nexora AI, a TOEIC learning assistant for Taiwanese learners.
Answer in natural Traditional Chinese.
User message:
${text}

Give practical next steps. Return JSON only:
{"reply":"your answer"}`);
}

async function assistantSummary(body, env) {
  const profile = JSON.stringify(body.profile || {});
  const tasks = JSON.stringify(body.tasks || []);
  const attempts = JSON.stringify(body.attempts || []);
  return geminiJson(env, `Summarize this TOEIC learner state for Nexora AI.
Profile: ${profile}
Tasks: ${tasks}
Quiz attempts: ${attempts}
Return JSON only:
{"weaknesses":["..."],"nextTasks":["..."],"summary":"Traditional Chinese summary"}`);
}

async function tasks(request, body, env) {
  if (!env.DB) throw new Error("Missing Cloudflare D1 binding: DB");
  const userId = request.headers.get("x-nexora-user-id");
  if (!userId) throw new Error("Missing authenticated user id");

  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      "select id, title, category, due_date, completed_at, created_at from tasks where user_id = ? order by created_at desc limit 50"
    ).bind(userId).all();
    return { tasks: rows.results || [] };
  }

  const title = String(body.title || "").trim().slice(0, 120);
  const category = String(body.category || "general").trim().slice(0, 40);
  const dueDate = String(body.dueDate || "").trim().slice(0, 20);
  if (!title) throw new Error("Missing task title");
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "insert into tasks (id, user_id, title, category, due_date, created_at) values (?, ?, ?, ?, ?, datetime('now'))"
  ).bind(id, userId, title, category, dueDate).run();
  return { id, title, category, dueDate };
}

async function geminiJson(env, prompt) {
  if (!env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error?.message || "Gemini API error");
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, x-nexora-user-id");
  return new Response(response.body, { status: response.status, headers });
}
