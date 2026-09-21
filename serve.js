// SentenceLearner 本地存储服务
// 作用：让练习数据落盘到 data/store.json（真实文件），浏览器清数据也不丢。
// 零依赖：仅用 Node 内置模块。运行：node serve.js（或用 start.bat / start.sh 一键启动）。
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const PORT = 8787;
const HOST = '127.0.0.1';
const MAX_BODY = 5 * 1024 * 1024; // 5MB 上限

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '{}', 'utf8');
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '{}');
  } catch (e) {
    return {};
  }
}

// 原子写：先写临时文件再 rename，避免中途崩溃损坏 store.json
function writeStore(obj) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function openBrowser(url) {
  let cmd;
  if (process.platform === 'darwin') cmd = 'open "' + url + '"';
  else if (process.platform === 'win32') cmd = 'cmd /c start "" "' + url + '"';
  else cmd = 'xdg-open "' + url + '"';
  try { cp.exec(cmd); } catch (e) { /* 忽略：用户可手动打开 */ }
}

const server = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://' + HOST + ':' + PORT);
  const p = decodeURIComponent(u.pathname);

  // ---- 存储 API ----
  if (p === '/api/store') {
    if (req.method === 'GET') {
      sendJson(res, 200, readStore());
      return;
    }
    if (req.method === 'POST') {
      let raw = '';
      let aborted = false;
      req.on('data', function (c) {
        raw += c;
        if (raw.length > MAX_BODY) { aborted = true; req.destroy(); }
      });
      req.on('end', function () {
        if (aborted) { sendJson(res, 413, { error: 'payload too large' }); return; }
        try {
          const obj = JSON.parse(raw);
          if (typeof obj !== 'object' || obj === null) throw new Error('not object');
          const clean = {};
          ['errors', 'collected', 'attempts', 'custom', 'sr', 'sl_pat_master', 'sl_pat_wrong', 'sl_weakness'].forEach(function (k) {
            if (k in obj) clean[k] = obj[k];
          });
          writeStore(clean);
          sendJson(res, 200, { ok: true });
        } catch (e) {
          sendJson(res, 400, { error: 'invalid json' });
        }
      });
      return;
    }
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  // ---- Ollama 代理（本地大模型，零依赖；浏览器只调同源 8787） ----
  // 解析 Ollama 基址：请求携带的 override 优先，其次 OLLAMA_HOST 环境变量，最后默认本机 11434。
  // 安全：仅允许 http/https 基址（去掉结尾斜杠），非 http(s) 返回 null 由调用方拒绝，降低 SSRF 面。
  function resolveOllamaHost(override) {
    const ov = (override != null) ? String(override).trim() : '';
    const h = ov || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    if (!/^https?:\/\//i.test(h)) return null;
    return h.replace(/\/+$/, '');
  }

  if (p === '/api/ollama/status') {
    const target = resolveOllamaHost(u.searchParams.get('host'));
    if (!target) { sendJson(res, 200, { ok: false, models: [], error: 'invalid host' }); return; }
    // 健壮性：无论 fetch 是否支持 / 是否超时 / 是否抛异常，都保证在兜底时间内响应，
    // 避免前端状态灯永久卡在“检测中…”
    let done = false;
    const guard = setTimeout(function () { if (!done) { done = true; sendJson(res, 200, { ok: false, models: [], error: 'timeout' }); } }, 5000);
    const reply = function (ok, models, error) {
      if (done) return; done = true; clearTimeout(guard);
      sendJson(res, 200, { ok: ok, models: models || [], error: error || '' });
    };
    if (typeof fetch !== 'function') { reply(false, [], 'fetch unavailable'); return; }
    const ac = (typeof AbortSignal !== 'undefined' && AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(3000) : null;
    const opts = { method: 'GET' };
    if (ac) opts.signal = ac;
    try {
      fetch(target + '/api/tags', opts)
        .then(function (r) { return r.json(); })
        .then(function (j) { reply(true, (j.models || []).map(function (m) { return m.name; })); })
        .catch(function (e) { reply(false, [], String((e && e.message) || e)); });
    } catch (e) {
      reply(false, [], String((e && e.message) || e));
    }
    return;
  }

  if (p === '/api/ollama/chat') {
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return; }
    let raw = '';
    let aborted = false;
    req.on('data', function (c) { raw += c; if (raw.length > MAX_BODY) { aborted = true; req.destroy(); } });
    req.on('end', function () {
      if (aborted) { sendJson(res, 413, { error: 'payload too large' }); return; }
      let body;
      try { body = JSON.parse(raw); } catch (e) { sendJson(res, 400, { error: 'invalid json' }); return; }
      const target = resolveOllamaHost(body.ollamaHost);
      if (!target) { sendJson(res, 200, { ok: false, error: 'invalid ollama host' }); return; }
      const model = body.model || 'qwen2.5:7b';
      const temp = (typeof body.temp === 'number') ? body.temp : 0.3;
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const format = body.json ? 'json' : undefined;
      fetch(target + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, messages: messages, stream: false, temperature: temp, format: format }),
        signal: AbortSignal.timeout(60000),
      })
        .then(function (r) { return r.json(); })
        .then(function (j) { sendJson(res, 200, { ok: true, content: (j && j.message && j.message.content) || '' }); })
        .catch(function (e) { sendJson(res, 200, { ok: false, error: String((e && e.message) || e) }); });
    });
    return;
  }

  // ---- 静态文件 ----
  let rel = p === '/' ? '/index.html' : p;
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(filePath, function (err, st) {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

ensureStore();
server.listen(PORT, HOST, function () {
  const url = 'http://' + HOST + ':' + PORT + '/index.html';
  console.log('SentenceLearner 本地存储服务已启动');
  console.log('练习地址: ' + url);
  console.log('数据文件: ' + STORE_FILE);
  console.log('按 Ctrl+C 停止服务');
  openBrowser(url);
});