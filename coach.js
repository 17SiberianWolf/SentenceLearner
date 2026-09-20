// SentenceLearner · AI 教练模块（零依赖，挂 window.Coach）
// 作用：把本机 Ollama 当成"造句教练"——渐进提示梯 / 句型拆解 / FSI Drills / 闭环补强 / 导师问答 / 自适应生成 / 评分。
// 全部经 serve.js 同源代理（/api/ollama/chat），不直连 Ollama，免 CORS、数据不出本机。
(function () {
  'use strict';

  const DEFAULT_MODEL = 'qwen2.5:7b';
  const status = { ok: false, models: [] };

  function loadEnabled() { try { return localStorage.getItem('sl_ai_enabled') !== 'false'; } catch (e) { return true; } }
  function saveEnabled(v) { try { localStorage.setItem('sl_ai_enabled', v ? 'true' : 'false'); } catch (e) {} }
  function loadModel() { try { return localStorage.getItem('sl_ai_model') || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; } }
  function saveModel(v) { try { localStorage.setItem('sl_ai_model', v || DEFAULT_MODEL); } catch (e) {} }

  function isEnabled() { return loadEnabled(); }
  function getModel() { return loadModel(); }
  function setEnabled(v) { saveEnabled(v); }
  function setModel(v) { saveModel(v); }

  // ---- 薄弱点诊断（仅诊断，不记对错；浏览器缓存 + 可落盘 store.json） ----
  function loadWeakness() { try { return JSON.parse(localStorage.getItem('sl_weakness') || '{}'); } catch (e) { return {}; } }
  function recordWeakness(cat) {
    if (!cat) return;
    const w = loadWeakness();
    w[cat] = (w[cat] || 0) + 1;
    try { localStorage.setItem('sl_weakness', JSON.stringify(w)); } catch (e) {}
  }
  function getWeakness() { return loadWeakness(); }

  // ---- 防御性 JSON 解析：取第一个 { 到最后一个 } 的子串 ----
  function extractJson(text) {
    if (!text) return null;
    const i = text.indexOf('{');
    const j = text.lastIndexOf('}');
    if (i < 0 || j < 0 || j < i) return null;
    try { return JSON.parse(text.slice(i, j + 1)); } catch (e) { return null; }
  }

  // ---- Prompt 库（与 UI 上下文强相关，放在前端） ----
  function buildMessages(task, p) {
    p = p || {};
    switch (task) {
      case 'hint':
        return [
          { role: 'system', content: '你是英文造句教练。用户看到中文想写英文但卡住了。给定目标中文与(可选)参考答案，只输出一个 JSON 对象（不要任何额外文字），含 3 级提示：level1_keywords=本句必须用到的核心英文词/短语(逗号分隔)；level2_skeleton=句型骨架(用 ___ 表示待填词，如 "I ___ a book yesterday.")；level3_near=补全到只剩 1-2 个词(如 "I read a ___ yesterday.")。' },
          { role: 'user', content: '目标中文：' + (p.target || '') + '\n参考答案：' + (p.reference || '') }
        ];
      case 'breakdown':
        return [
          { role: 'system', content: '你是语法讲师。给定中文含义、参考英文句与(可选)用户写出的英文，只输出一个 JSON 对象（不要额外文字）：pattern=句型公式(如 "Subj. + be + V-ing + Obj.")；structure=数组，逐词/短语的角色说明；mnemonic=一句中文记忆口诀；pitfalls=数组，学习者常犯的错误 1-3 条；category=单个字符串，从 tense/word_order/preposition/article/vocabulary/other 中选最贴切的一个(用于薄弱点诊断)。' },
          { role: 'user', content: '目标中文：' + (p.target || '') + '\n参考英文：' + (p.reference || '') + '\n我的英文：' + (p.userText || '(未写)') }
        ];
      case 'drill':
        return [
          { role: 'system', content: '你是 FSI 操练设计师。给定基础英文句与模式(mode)，生成 5-8 个同句型变体。mode=substitution: 仅替换词汇；mode=morphology: 换主语(I/He/They)或时态；mode=transformation: 在肯定/否定/疑问间转换。只输出一个 JSON 对象（不要额外文字）：{base:原句, mode:模式, cues:[{transform:中文指令(如"改成过去式"/"把主语换成 they"), expect:变换后的完整英文句}]}。' },
          { role: 'user', content: '基础句：' + (p.base || '') + '\n模式：' + (p.mode || 'substitution') }
        ];
      case 'remedial':
        return [
          { role: 'system', content: '用户在某类错误上反复出错。基于用户写出的英文与参考答案，生成 3 个针对练习的小句(同错误类型、更简单)。只输出一个 JSON 对象（不要额外文字）：{drills:[{zh:中文提示, en:参考答案}]}。' },
          { role: 'user', content: '我的英文：' + (p.text || '') + '\n参考答案：' + (p.reference || '') }
        ];
      case 'tutor':
        return [
          { role: 'system', content: '你是耐心的英文教练，用中文解释，必要时给公式+高亮例句+口诀。保持简短(≤120 字)，鼓励为主。' },
          { role: 'user', content: (p.question || '') + (p.context ? ('\n（上下文：' + p.context + '）') : '') }
        ];
      case 'generate':
        return [
          { role: 'system', content: '给定用户水平与薄弱类别，用语法模板生成 5 个新练习句(中文→英文)。只输出一个 JSON 对象（不要额外文字）：{sentences:[{zh:中文提示, en:参考, level:难度}]}。' },
          { role: 'user', content: '水平：' + (p.level || 'A2') + '\n薄弱类别：' + (p.category || 'vocabulary') }
        ];
      case 'grade':
        return [
          { role: 'system', content: '你是英文写作教练。给定目标中文、用户英文与(可选)参考答案，只输出一个 JSON 对象（不要额外文字）：verdict(correct|partial|wrong)、score(0-100)、corrected(修正后的自然整句)、errors(数组{type,original,correction,explanation})、comment(中文鼓励评语)。' },
          { role: 'user', content: '目标中文：' + (p.target || '') + '\n我的英文：' + (p.text || '') + '\n参考答案：' + (p.reference || '') }
        ];
      default:
        return null;
    }
  }

  // ---- 通用调用：POST /api/ollama/chat ----
  function callCoach(task, payload, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (typeof fetch !== 'function') { resolve({ ok: false, error: '当前环境不支持 fetch' }); return; }
      const msgs = buildMessages(task, payload);
      if (!msgs) { resolve({ ok: false, error: '未知任务: ' + task }); return; }
      fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: getModel(), messages: msgs, task: task, json: !!opts.json, temp: (typeof opts.temp === 'number' ? opts.temp : 0.3) })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || j.ok === false) { resolve({ ok: false, error: (j && j.error) || '服务返回错误' }); return; }
          const content = j.content || '';
          if (opts.json) {
            const data = extractJson(content);
            if (data) resolve({ ok: true, data: data });
            else resolve({ ok: false, error: 'AI 返回非规范 JSON', raw: content });
          } else {
            resolve({ ok: true, text: content });
          }
        })
        .catch(function (e) { resolve({ ok: false, error: String((e && e.message) || e) }); });
    });
  }

  // ---- 探活 + 状态灯 ----
  function setStatusDom(ok, text) {
    const el = document.getElementById('aiStatus');
    if (!el) return;
    el.textContent = 'AI：' + text;
    el.className = 'badge ' + (ok ? 'badge-ok' : 'badge-warn');
  }
  function updateStatus(cb) {
    if (typeof fetch !== 'function') { status.ok = false; setStatusDom(false, '不可用'); if (cb) cb(false); return; }
    fetch('/api/ollama/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        status.ok = !!(j && j.ok);
        status.models = (j && j.models) || [];
        setStatusDom(status.ok, status.ok ? ('已连 · ' + (status.models[0] || '')) : '未连接');
        if (cb) cb(status.ok);
      })
      .catch(function (e) { status.ok = false; setStatusDom(false, '未连接'); if (cb) cb(false); });
  }

  window.Coach = {
    isEnabled: isEnabled,
    getModel: getModel,
    setEnabled: setEnabled,
    setModel: setModel,
    recordWeakness: recordWeakness,
    getWeakness: getWeakness,
    callCoach: callCoach,
    updateStatus: updateStatus,
    status: status,
  };
})();
