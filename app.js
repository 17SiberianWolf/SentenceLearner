// SentenceLearner MVP — practice page + error book (browser only).
// Flow: 中文 -> 手写英文 -> 朗读 -> 提示/显示答案(抄写) -> 提交判分 -> 下一题
// 错句本：练习中写错/借助提示或答案的句子自动进入，可「看原文」或「重练」跳回练习页。
(function () {
  const S = window.SENTENCES || [];
  const A = window.ADVANCED_SENTENCES || [];
  const L = window.LIFE_SENTENCES || [];
  const E = window.Engine;
  const $ = function (id) { return document.getElementById(id); };

  const state = {
    tab: 'practice',
    level: '初级',
    category: '全部',
    index: 0,
    list: [],
    input: '',
    phase: 'typing',     // 'typing' | 'answered'
    revealed: false,     // 是否已点「显示答案」（看过完整原文）
    hintWords: 0,        // 提示已揭示到第几个词
    listened: false,
    startTime: Date.now(),
    typedCount: 0,       // 已作答句子数
    correctCount: 0,     // 真正掌握（无帮助且正确）的句子数
    collected: loadSet('sl_collected'),
    errors: loadSet('sl_errors'),
    attempts: loadAttempts(),
    custom: loadCustom(),
    reviewMode: false,
  };

  function loadSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) { return new Set(); } }
  function saveSet(key, set) { try { localStorage.setItem(key, JSON.stringify([].slice.call(set))); } catch (e) {} schedulePersist(); }
  function loadAttempts() { try { return JSON.parse(localStorage.getItem('sl_attempts') || '[]'); } catch (e) { return []; } }
  function saveAttempts(arr) { try { localStorage.setItem('sl_attempts', JSON.stringify(arr)); } catch (e) {} schedulePersist(); }
  function loadCustom() { try { return JSON.parse(localStorage.getItem('sl_custom') || '[]'); } catch (e) { return []; } }
  function saveCustom(arr) { try { localStorage.setItem('sl_custom', JSON.stringify(arr)); } catch (e) {} schedulePersist(); }

  // ---------- 间隔重复（Spaced Repetition）：轻量优先级 + 遗忘曲线 ----------
  // 仅跟踪「曾出错/需巩固」的句子；掌握则拉长间隔，未掌握则立即到期。
  const SR_INTERVALS = [1, 3, 7, 15, 30, 60, 120]; // 天，逐次递增
  const SR_DAY = 86400000;
  function loadSR() { try { return JSON.parse(localStorage.getItem('sl_sr') || '{}'); } catch (e) { return {}; } }
  function saveSR(obj) { try { localStorage.setItem('sl_sr', JSON.stringify(obj)); } catch (e) {} schedulePersist(); }
  // 到期句子：due <= now，按到期时间升序（最该练的排最前）
  function dueSentences() {
    const sr = loadSR();
    const now = Date.now();
    return effectiveSentences().filter(function (s) { return sr[s.id] && sr[s.id].due <= now; })
      .sort(function (a, b) { return sr[a.id].due - sr[b.id].due; });
  }
  function dueCount() { return dueSentences().length; }
  // 提交后更新间隔重复计划
  function updateSR(id, mastered) {
    const sr = loadSR();
    const now = Date.now();
    const cur = sr[id] || { reps: 0, interval: 0, due: now, last: 0, lastMaster: false };
    if (mastered) {
      const reps = Math.min((cur.reps || 0) + 1, SR_INTERVALS.length);
      const interval = SR_INTERVALS[reps - 1];
      sr[id] = { reps: reps, interval: interval, due: now + interval * SR_DAY, last: now, lastMaster: true };
      if (state.errors.has(id)) { state.errors.delete(id); saveSet('sl_errors', state.errors); }
    } else {
      sr[id] = { reps: 0, interval: 0, due: now, last: now, lastMaster: false };
      state.errors.add(id); saveSet('sl_errors', state.errors);
    }
    saveSR(sr);
  }

  // ---------- 存储后端：本地文件（data/store.json）为主，浏览器缓存兜底 ----------
  // serverAvailable: null=检测中, true=已连接本地服务, false=仅浏览器缓存
  let serverAvailable = null;
  let persistTimer = null;
  function snapshot() {
    return {
      errors: [].slice.call(state.errors),
      collected: [].slice.call(state.collected),
      attempts: state.attempts,
      custom: state.custom,
      sr: loadSR(),
      sl_pat_master: [].slice.call(patMaster),
      sl_pat_wrong: [].slice.call(patWrong),
      sl_weakness: loadWeaknessLocal(),
    };
  }
  function loadWeaknessLocal() { try { return JSON.parse(localStorage.getItem('sl_weakness') || '{}'); } catch (e) { return {}; } }
  function fetchStore() {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch('/api/store', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function pushStore(data) {
    if (typeof fetch !== 'function') return Promise.resolve(false);
    return fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; });
  }
  // 防抖：多次写合并为一次落盘，降低请求频率
  function schedulePersist() {
    if (persistTimer) return;
    persistTimer = setTimeout(function () {
      persistTimer = null;
      if (serverAvailable !== true) return; // 未连接本地服务则不推送
      pushStore(snapshot());
    }, 150);
  }
  function setBadge() {
    const el = document.getElementById('storeBadge');
    if (!el) return;
    if (serverAvailable === true) {
      el.textContent = '存储：本地文件（data/store.json）';
      el.className = 'badge badge-ok';
    } else if (serverAvailable === false) {
      el.textContent = '存储：浏览器缓存（建议用 start 启动器打开以落盘）';
      el.className = 'badge badge-warn';
    } else {
      el.textContent = '存储：检测中…';
      el.className = 'badge';
    }
  }
  // 启动时检测本地服务：以服务端数据为权威，并把浏览器里仅有（未落盘）的数据合并进文件
  function initStorage() {
    setBadge();
    fetchStore().then(function (server) {
      if (server && typeof server === 'object') {
        serverAvailable = true;
        var local = {
          errors: loadSet('sl_errors'),
          collected: loadSet('sl_collected'),
          attempts: loadAttempts(),
          custom: loadCustom(),
        };
        // 错句本 / 收藏：服务端 ∪ 浏览器缓存
        state.errors = new Set((Array.isArray(server.errors) ? server.errors : []).concat([].slice.call(local.errors)));
        state.collected = new Set((Array.isArray(server.collected) ? server.collected : []).concat([].slice.call(local.collected)));
        // 练习日志：按 (ts|id) 去重合并
        var seenA = {};
        state.attempts = (Array.isArray(server.attempts) ? server.attempts : []).slice();
        state.attempts.forEach(function (a) { seenA[(a && a.ts) + '|' + (a && a.id)] = 1; });
        local.attempts.forEach(function (a) {
          var k = (a && a.ts) + '|' + (a && a.id);
          if (!seenA[k]) { state.attempts.push(a); seenA[k] = 1; }
        });
        // 自定义句：按 id 去重合并
        var seenC = {};
        state.custom = (Array.isArray(server.custom) ? server.custom : []).slice();
        state.custom.forEach(function (c) { if (c && c.id) seenC[c.id] = 1; });
        local.custom.forEach(function (c) { if (c && c.id && !seenC[c.id]) { state.custom.push(c); seenC[c.id] = 1; } });
        // 句型训练进度：掌握/待巩固 集合，服务端 ∪ 浏览器缓存
        patMaster = new Set((Array.isArray(server.sl_pat_master) ? server.sl_pat_master : []).concat([].slice.call(loadPatSet('sl_pat_master'))));
        patWrong = new Set((Array.isArray(server.sl_pat_wrong) ? server.sl_pat_wrong : []).concat([].slice.call(loadPatSet('sl_pat_wrong'))));
        // 间隔重复计划：服务端 ∪ 浏览器缓存（按 id 去重，服务端优先）
        var srvSR = (server && typeof server.sr === 'object' && server.sr) ? server.sr : {};
        var locSR = loadSR();
        var mergedSR = {};
        Object.keys(srvSR).forEach(function (k) { mergedSR[k] = srvSR[k]; });
        Object.keys(locSR).forEach(function (k) { if (!(k in mergedSR)) mergedSR[k] = locSR[k]; });
        saveSR(mergedSR);
        // 薄弱点诊断：服务端 + 浏览器缓存（计数相加）
        var srvW = (server && typeof server.sl_weakness === 'object' && server.sl_weakness) ? server.sl_weakness : {};
        var locW = loadWeaknessLocal();
        var mergedW = {};
        Object.keys(srvW).forEach(function (k) { mergedW[k] = srvW[k] || 0; });
        Object.keys(locW).forEach(function (k) { mergedW[k] = (mergedW[k] || 0) + (locW[k] || 0); });
        try { localStorage.setItem('sl_weakness', JSON.stringify(mergedW)); } catch (e) {}
        // 合并结果写回磁盘，并刷新浏览器缓存
        pushStore(snapshot());
        saveSet('sl_errors', state.errors);
        saveSet('sl_collected', state.collected);
        saveAttempts(state.attempts);
        saveCustom(state.custom);
        savePatSet('sl_pat_master', patMaster);
        savePatSet('sl_pat_wrong', patWrong);
        setBadge();
        render(); renderErrors(); renderStats(); renderLibrary();
      } else {
        serverAvailable = false; // 无本地服务（如直接双击 index.html / 预览模式）：仅用浏览器缓存
        setBadge();
      }
    });
  }
  function hashId(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return 'c' + h.toString(36); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 撒花庆祝：写对句子时自动弹出。纯 JS+CSS，零外部依赖。
  function celebrate() {
    const layer = document.createElement('div');
    layer.id = 'confetti-layer';
    document.body.appendChild(layer);
    const colors = ['#185fa5', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      c.style.width = (6 + Math.random() * 6) + 'px';
      c.style.height = (6 + Math.random() * 6) + 'px';
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      c.style.animationDuration = (1 + Math.random() * 0.6) + 's';
      c.style.animationDelay = (Math.random() * 0.2) + 's';
      c.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      layer.appendChild(c);
    }
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1800);
  }

  // ---------- 句型训练（纯模板版） ----------
  // 数据：window.SENTENCE_PATTERNS = { oral:[...], email:[...] }，每个 pattern 含 items
  const PAT = (window.SENTENCE_PATTERNS && typeof window.SENTENCE_PATTERNS === 'object') ? window.SENTENCE_PATTERNS : { oral: [], email: [] };
  const PAT_GROUPS = ['oral', 'email'];
  const PAT_GROUP_LABEL = { oral: '口头交流', email: '商务邮件' };
  const PAT_ITEMS = [];
  PAT_GROUPS.forEach(function (g) {
    (PAT[g] || []).forEach(function (p, pi) {
      p.id = g + '_' + pi;
      (p.items || []).forEach(function (it, ii) {
        it.id = g + '_' + pi + '_' + ii;
        it.group = g;
        it.patternId = p.id;
        it.patternTitle = p.title;
        it.skeleton = it.en.split(it.gap).join('<span class="gap">____</span>');
        PAT_ITEMS.push(it);
      });
    });
  });
  function patItemsByGroup(g) { return PAT_ITEMS.filter(function (it) { return it.group === g; }); }
  function patItemById(id) { return PAT_ITEMS.find(function (x) { return x.id === id; }); }
  function patById(id) {
    for (let gi = 0; gi < PAT_GROUPS.length; gi++) {
      const f = (PAT[PAT_GROUPS[gi]] || []).find(function (p) { return p.id === id; });
      if (f) return f;
    }
    return null;
  }

  // 句型进度（自包含，不进入全局错句本/复习/统计）：掌握集合 + 待巩固集合
  function loadPatSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) { return new Set(); } }
  function savePatSet(key, set) { try { localStorage.setItem(key, JSON.stringify([].slice.call(set))); } catch (e) {} schedulePersist(); }
  let patMaster = loadPatSet('sl_pat_master');
  let patWrong = loadPatSet('sl_pat_wrong');

  function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.,!?;:]+$/, ''); }

  // 句型页运行时状态
  const pat = {
    group: 'oral',
    mode: 'full',
    index: 0,
    input: '',
    phase: 'typing',
    revealed: false,
    hintWords: 0,
    startTime: Date.now(),
    drill: { active: false, mode: 'substitution', base: '', cues: [], index: 0 },
  };

  function effectiveSentences() { return S.concat(A, L, state.custom); }

  function buildList() {
    if (state.reviewMode) {
      state.list = dueSentences();
    } else {
      state.list = effectiveSentences().filter(function (s) {
        return s.level === state.level && (state.category === '全部' || s.category === state.category);
      });
    }
    state.index = 0;
    updateReviewBanner();
  }
  function current() { return state.list[state.index]; }

  function wordsOf(sentence) { return (sentence || '').trim().split(/\s+/).filter(Boolean); }

  function render() {
    const s = current();
    if (!s) {
      $('prompt').textContent = state.level === '高级' ? '（暂无高级句子：需补充 >15 词的长句资料）' : '（无句子）';
      $('feedback').innerHTML = '';
      hideAnswer();
      updateStats();
      return;
    }
    $('prompt').textContent = s.zh;
    renderFeedback(s.en, state.input);
    renderAnswer();
    updateStats();
    updateCollectBtn(s);
    if (state.phase === 'answered') showAnswer(s.en);
  }

  // 用户输入内容的字符级反馈（只显示已输入部分的对错）。
  function renderFeedback(target, input) {
    const box = $('feedback');
    if (!input) { box.innerHTML = ''; return; }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < input.length; i++) {
      const span = document.createElement('span');
      const t = target[i];
      const ch = input[i];
      span.textContent = ch === ' ' ? '·' : ch;
      span.className = 'ch ' + (ch === t ? 'ok' : 'wrong') + (ch === ' ' ? ' space' : '');
      frag.appendChild(span);
    }
    box.innerHTML = '';
    box.appendChild(frag);
  }

  // 答案区：隐藏 / 提示渐进(部分词显示) / 显示答案(全显)。
  function renderAnswer() {
    const s = current();
    if (!s) return;
    const panel = $('answerPanel');
    const text = $('answerText');
    if (!state.revealed && state.hintWords === 0) {
      panel.classList.add('hidden');
      text.innerHTML = '';
      return;
    }
    panel.classList.remove('hidden');
    const words = wordsOf(s.en);
    const revealCount = state.revealed ? words.length : Math.min(state.hintWords, words.length);
    const frag = document.createDocumentFragment();
    words.forEach(function (w, i) {
      const span = document.createElement('span');
      if (i < revealCount) { span.textContent = w; span.className = 'ch'; }
      else { span.textContent = '____'; span.className = 'ch pending'; }
      frag.appendChild(span);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    text.innerHTML = '';
    text.appendChild(frag);
  }

  // 显示完整英文原文（不判分、不锁定）。用于抄写。
  function showAnswer(text) {
    state.revealed = true;
    const panel = $('answerPanel');
    const ans = $('answerText');
    panel.classList.remove('hidden');
    ans.textContent = text;
    ans.className = 'answer-text';
    // 已全显，提示无意义
    $('btnHint').disabled = true;
    $('btnShowAnswer').disabled = true;
  }

  function hideAnswer() {
    state.revealed = false;
    state.hintWords = 0;
    $('answerPanel').classList.add('hidden');
    $('answerText').innerHTML = '';
    $('btnHint').disabled = false;
    $('btnShowAnswer').disabled = false;
    const hp = $('aiHintPanel'); if (hp) { hp.classList.add('hidden'); hp.innerHTML = ''; }
    const bp = $('aiBreakdownPanel'); if (bp) { bp.classList.add('hidden'); bp.innerHTML = ''; }
  }

  // ---------- AI 教练：渐进提示梯（不直接给答案，分 3 级） ----------
  function aiHint() {
    const s = current();
    const panel = $('aiHintPanel');
    if (!s || !panel) return;
    if (!window.Coach || !Coach.isEnabled()) { alert('AI 教练未启用，或 Ollama 未连接。'); return; }
    panel.classList.remove('hidden');
    panel.innerHTML = '<div class="ai-loading">AI 正在生成提示…</div>';
    Coach.callCoach('hint', { target: s.zh, reference: s.en }, { json: true, temp: 0.3 }).then(function (r) {
      if (!r || !r.ok) { panel.innerHTML = '<div class="ai-err">AI 暂时不可用：' + escapeHtml((r && r.error) || '') + '</div>'; return; }
      const d = r.data || {};
      panel.innerHTML =
        '<div class="hint-ladder">' +
        '<div class="hl-row"><span class="hl-label">① 关键词</span><span class="hl-val">' + escapeHtml(d.level1_keywords || '—') + '</span></div>' +
        '<div class="hl-row"><span class="hl-label">② 句型骨架</span><span class="hl-val">' + escapeHtml(d.level2_skeleton || '—') + '</span></div>' +
        '<div class="hl-row"><span class="hl-label">③ 近完整</span><span class="hl-val">' + escapeHtml(d.level3_near || '—') + '</span></div>' +
        '</div>';
    });
  }

  // ---------- AI 教练：句型拆解讲解（提交/揭示答案时默认展示，可折叠） ----------
  function showBreakdown(zh, en, userText, recordWeak) {
    const panel = $('aiBreakdownPanel');
    if (!panel) return;
    panel.classList.remove('hidden');
    if (!window.Coach || !Coach.isEnabled()) { panel.classList.add('hidden'); return; }
    panel.innerHTML = '<details open class="breakdown"><summary>句型拆解（AI）</summary><div class="ai-loading">AI 正在解析句型…</div></details>';
    Coach.callCoach('breakdown', { target: zh, reference: en, userText: userText }, { json: true, temp: 0.2 }).then(function (r) {
      if (!r || !r.ok) {
        panel.innerHTML = '<details class="breakdown"><summary>句型拆解（AI）</summary><div class="ai-err">AI 暂时不可用：' + escapeHtml((r && r.error) || '') + '</div></details>';
        return;
      }
      const d = r.data || {};
      const structure = Array.isArray(d.structure) ? d.structure.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') : '';
      const pitfalls = Array.isArray(d.pitfalls) ? d.pitfalls.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') : '';
      panel.innerHTML = '<details open class="breakdown"><summary>句型拆解（AI）</summary>' +
        (d.pattern ? '<div class="bd-row"><span class="bd-label">句型公式</span><span class="bd-val">' + escapeHtml(d.pattern) + '</span></div>' : '') +
        (structure ? '<div class="bd-row"><span class="bd-label">结构</span><ul class="bd-list">' + structure + '</ul></div>' : '') +
        (d.mnemonic ? '<div class="bd-row"><span class="bd-label">记忆口诀</span><span class="bd-val">' + escapeHtml(d.mnemonic) + '</span></div>' : '') +
        (pitfalls ? '<div class="bd-row"><span class="bd-label">易错点</span><ul class="bd-list">' + pitfalls + '</ul></div>' : '') +
        '</details>';
      if (recordWeak && d.category) Coach.recordWeakness(d.category);
    });
  }

  function updateStats() {
    const total = state.list.length || 0;
    const acc = state.typedCount > 0 ? Math.round((state.correctCount / state.typedCount) * 100) : 0;
    const elapsedMin = Math.max((Date.now() - state.startTime) / 60000, 1e-6);
    const wpm = Math.round(state.typedCount > 0 ? (state.correctCount + state.errors.size) / elapsedMin : 0);
    $('stats').textContent = '第 ' + Math.min(state.index + 1, total) + '/' + total + ' 句 · 掌握率 ' + acc + '% · WPM ' + wpm;
  }

  function updateCollectBtn(s) {
    const on = state.collected.has(s.id);
    const btn = $('btnCollect');
    btn.innerHTML = '<span class="icon">' + (on ? '★' : '☆') + '</span> ' + (on ? '已收藏' : '收藏');
    btn.classList.toggle('on', on);
  }

  function updateLevelSwitch() {
    Array.prototype.forEach.call(document.querySelectorAll('.level-switch button'), function (b) {
      b.classList.toggle('active', b.dataset.level === state.level);
    });
  }

  // 强制纠错：允许正确前缀 + 至多一个错误字符。
  function onInput() {
    const s = current();
    if (!s || state.phase === 'answered') return;
    let val = $('capture').value;
    const fw = E.firstWrongIndex(s.en, val);
    const allow = fw < 0 ? s.en.length : fw + 1;
    if (val.length > allow) { val = val.slice(0, allow); $('capture').value = val; }
    state.input = val;
    renderFeedback(s.en, val);
    // 完整写对后自动提交，弹出撒花庆祝。
    if (val === s.en) { submit(); }
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音合成（Web Speech API）'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = parseFloat($('rate') ? $('rate').value : '0.9') || 0.9;
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      const want = ($('voice') && $('voice').value === 'uk') ? /en-GB/i : /en-US/i;
      const v = voices.find(function (x) { return want.test(x.lang); }) || voices.find(function (x) { return /^en/i.test(x.lang); });
      if (v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
    state.listened = true;
  }

  // 提示：每次多揭示一个词；揭示完则等同显示答案。
  function hint() {
    const s = current();
    if (!s || state.phase === 'answered' || state.revealed) return;
    const words = wordsOf(s.en);
    if (state.hintWords < words.length) {
      state.hintWords += 1;
      renderAnswer();
      speak(words.slice(0, state.hintWords).join(' '));
      if (state.hintWords >= words.length) { state.revealed = true; $('btnHint').disabled = true; $('btnShowAnswer').disabled = true; }
    }
  }

  // 显示答案：仅展示完整原文，不判分、不锁定，供抄写。
  function showAnswerClicked() {
    const s = current();
    if (!s || state.phase === 'answered') return;
    showAnswer(s.en);
    showBreakdown(s.zh, s.en, state.input, false); // 揭示答案也展示拆解，但不记薄弱点
  }

  // 提交判分：掌握度规则见 PRD/本次 grill 结论。
  function submit() {
    const s = current();
    if (!s) return;
    if (state.phase === 'answered') { next(); return; }

    const val = state.input;
    const isCorrect = val === s.en;
    const usedHelp = state.hintWords > 0 || state.revealed; // 用过提示或看过答案
    const mastered = isCorrect && !usedHelp;
    state.phase = 'answered';
    state.typedCount += 1;

    // 持久化本次练习记录（跨会话累计，供统计页使用）
    const secs = Math.max((Date.now() - state.startTime) / 1000, 0.1);
    const wordCount = wordsOf(s.en).length;
    const wpm = Math.round(wordCount / (secs / 60));
    state.attempts.push({ ts: Date.now(), id: s.id, level: s.level, category: s.category, mastered: mastered, usedHelp: usedHelp, wpm: wpm, secs: secs });
    saveAttempts(state.attempts);

    if (mastered) {
      state.correctCount += 1;            // 真正掌握，不进错句本
    } else {
      state.errors.add(s.id);             // 其余一律需复习
      saveSet('sl_errors', state.errors);
    }
    updateSR(s.id, mastered);             // 更新间隔重复计划

    showAnswer(s.en);
    renderFeedback(s.en, val);
    updateStats();

    const box = $('answerPanel');
    const res = $('answerResult');
    if (box) {
      box.classList.remove('flash-ok', 'flash-wrong');
      void box.offsetWidth;
      box.classList.add(isCorrect ? 'flash-ok' : 'flash-wrong');
      setTimeout(function () { box.classList.remove('flash-ok', 'flash-wrong'); }, 400);
    }
    if (res) {
      res.className = 'answer-result';
      res.classList.add(isCorrect ? 'ok' : 'wrong');
      res.textContent = isCorrect ? '正确！掌握这句了。' : '再核对一下，答案已显示。';
    }
    if (isCorrect) celebrate();

    // AI 教练：展示句型拆解（默认展开，可折叠）；出错时记录薄弱点类别。
    showBreakdown(s.zh, s.en, val, !isCorrect);

    lockControls();
  }

  // 提交后锁定输入与辅助按钮，仅保留下一题。
  function lockControls() {
    $('capture').disabled = true;
    $('btnHint').disabled = true;
    $('btnShowAnswer').disabled = true;
    $('btnSubmit').disabled = true;
    $('btnSubmit').textContent = '已提交';
  }
  function unlockControls() {
    $('capture').disabled = false;
    $('btnSubmit').disabled = false;
    $('btnSubmit').innerHTML = '<span class="icon">✓</span> 提交';
  }

  function next() {
    const s = current();
    if (s && state.phase === 'typing' && state.input && state.input !== s.en && !state.errors.has(s.id)) {
      state.errors.add(s.id);
      saveSet('sl_errors', state.errors);
    }
    if (state.reviewMode && state.index >= state.list.length - 1) {
      setReviewMode(false);               // 到期句已全部练完，退出复习模式
      return;
    }
    state.index = state.index < state.list.length - 1 ? state.index + 1 : 0;
    resetQuestion();
  }

  function autoSpeakEnabled() {
    const el = $('autoSpeak');
    return el ? el.checked : true;
  }

  function resetQuestion() {
    state.input = '';
    state.phase = 'typing';
    state.revealed = false;
    state.hintWords = 0;
    state.listened = false;
    state.startTime = Date.now();
    $('capture').value = '';
    unlockControls();
    hideAnswer();
    const res = $('answerResult');
    if (res) { res.className = 'answer-result'; res.textContent = ''; }
    render();
    focusCapture();
    // 开始练习新句子时，自动朗读一次；第二次及以后由用户手动点击「朗读」。
    if (autoSpeakEnabled()) { const s = current(); if (s) speak(s.en); }
  }

  function collect() {
    const s = current();
    if (!s) return;
    if (state.collected.has(s.id)) state.collected.delete(s.id); else state.collected.add(s.id);
    saveSet('sl_collected', state.collected);
    updateCollectBtn(s);
  }

  function focusCapture() { const el = $('capture'); if (el && !el.disabled) el.focus(); }

  function initCategories() {
    const cats = Array.from(new Set(effectiveSentences().map(function (x) { return x.category; })));
    const sel = $('category');
    sel.innerHTML = '';
    [['全部', '全部']].concat(cats.map(function (c) { return [c, c]; })).forEach(function (pair) {
      const o = document.createElement('option');
      o.value = pair[0]; o.textContent = pair[1];
      sel.appendChild(o);
    });
    sel.value = '全部';
  }

  function setLevel(lv) {
    state.level = lv;
    updateLevelSwitch();
    buildList();
    resetQuestion();
  }

  // ---------- 标签切换 ----------
  function switchTab(name) {
    state.tab = name;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    $('page-practice').classList.toggle('hidden', name !== 'practice');
    $('page-errors').classList.toggle('hidden', name !== 'errors');
    $('page-stats').classList.toggle('hidden', name !== 'stats');
    $('page-library').classList.toggle('hidden', name !== 'library');
    $('page-review').classList.toggle('hidden', name !== 'review');
    $('page-patterns').classList.toggle('hidden', name !== 'patterns');
    if (name === 'errors') renderErrors();
    if (name === 'stats') renderStats();
    if (name === 'library') { refreshLibCategories(); renderLibrary(); }
    if (name === 'review') renderReview();
    if (name === 'patterns') { renderPatterns(); const pe = $('patCapture'); if (pe) pe.focus(); }
  }

  // ---------- 句子库页 ----------
  function renderLibrary() {
    const lv = $('libLevel').value;
    const cat = $('libCategory').value;
    const all = effectiveSentences();
    const list = all.filter(function (s) {
      return (lv === '全部' || s.level === lv) && (cat === '全部' || s.category === cat);
    });
    const box = $('libList');
    box.innerHTML = '';
    $('libCount').textContent = '共 ' + list.length + ' 句';
    if (list.length === 0) { $('libEmpty').classList.remove('hidden'); return; }
    $('libEmpty').classList.add('hidden');
    list.forEach(function (s) {
      const li = document.createElement('li');
      li.className = 'lib-item';
      const isCustom = !!s.custom;
      li.innerHTML =
        '<div class="li-zh">' + escapeHtml(s.zh) + '</div>' +
        '<div class="li-en">' + escapeHtml(s.en) + '</div>' +
        '<div class="li-meta"><span class="tag">' + escapeHtml(s.category) + '</span><span class="tag">' + s.level + '</span>' +
        (isCustom ? '<span class="tag custom">自定义</span>' : '') + '</div>' +
        (isCustom ? '<button class="li-del" data-id="' + s.id + '">删除</button>' : '');
      box.appendChild(li);
    });
  }

  function refreshLibCategories() {
    const sel = $('libCategory');
    const cats = Array.from(new Set(effectiveSentences().map(function (x) { return x.category; })));
    const cur = sel.value;
    sel.innerHTML = '';
    [['全部', '全部']].concat(cats.map(function (c) { return [c, c]; })).forEach(function (p) {
      const o = document.createElement('option'); o.value = p[0]; o.textContent = p[1]; sel.appendChild(o);
    });
    if (cats.indexOf(cur) >= 0) sel.value = cur;
  }

  function makeSentence(zh, en, category, audioUrl) {
    const wc = wordsOf(en).length;
    return {
      id: hashId(en + '|' + zh),
      category: category || '自定义',
      en: en.trim(),
      zh: zh.trim(),
      audioUrl: audioUrl || '',
      wordCount: wc,
      level: E.levelOf(en),
      wrongCount: 0,
      custom: true,
    };
  }

  function addCustomSentence(zh, en, category) {
    if (!zh || !en) return { ok: false, msg: '中文和英文都不能为空' };
    const s = makeSentence(zh, en, category, '');
    if (effectiveSentences().some(function (x) { return x.id === s.id; })) return { ok: false, msg: '该句已存在' };
    state.custom.push(s);
    saveCustom(state.custom);
    initCategories();
    return { ok: true, msg: '已添加：' + en };
  }

  function importSentences(arr) {
    let added = 0, skipped = 0;
    arr.forEach(function (o) {
      if (!o || !o.en || !o.zh) { skipped++; return; }
      const s = makeSentence(o.zh, o.en, o.category, o.audioUrl);
      if (state.custom.some(function (x) { return x.id === s.id; })) { skipped++; return; }
      state.custom.push(s); added++;
    });
    saveCustom(state.custom);
    initCategories();
    return { added: added, skipped: skipped };
  }

  function deleteCustom(id) {
    state.custom = state.custom.filter(function (x) { return x.id !== id; });
    saveCustom(state.custom);
    // 同步从错句本移除（若有）
    if (state.errors.has(id)) { state.errors.delete(id); saveSet('sl_errors', state.errors); }
    initCategories();
    refreshLibCategories();
    renderLibrary();
  }

  // 极简 CSV 解析（支持引号包裹、字段内逗号/换行）
  function parseCsv(text) {
    const rows = []; let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function csvToSentences(text) {
    const rows = parseCsv(text).filter(function (r) { return r.some(function (c) { return c && c.trim(); }); });
    // 跳过表头（若首行含 原文正文/英文/en）
    let start = 0;
    if (rows[0] && /原文正文|英文|en/i.test(rows[0].join(','))) start = 1;
    const out = [];
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const en = (r[1] || '').trim();
      const zh = (r[3] || '').trim();
      if (!en || !zh) continue;
      out.push({ category: (r[0] || '').trim() || '自定义', en: en, zh: zh, audioUrl: (r[4] || '').trim() });
    }
    return out;
  }

  async function handleFile(file) {
    const msg = $('importMsg');
    msg.textContent = '解析中…';
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const rows = await window.XlsxRead.xlsxToSentences(buf);
        const res = importSentences(rows);
        msg.textContent = 'xlsx 导入完成：新增 ' + res.added + ' 句，跳过 ' + res.skipped + ' 句';
      } else if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const rows = csvToSentences(text);
        const res = importSentences(rows);
        msg.textContent = 'csv 导入完成：新增 ' + res.added + ' 句，跳过 ' + res.skipped + ' 句';
      } else {
        msg.textContent = '仅支持 .xlsx 或 .csv 文件';
        return;
      }
      refreshLibCategories();
      renderLibrary();
    } catch (e) {
      msg.textContent = '导入失败：' + (e && e.message ? e.message : e);
    }
  }

  // ---------- 错句本 ----------
  function renderErrors() {
    const listEl = $('errorList');
    const emptyEl = $('errorsEmpty');
    listEl.innerHTML = '';
    const ids = Array.from(state.errors);
    if (ids.length === 0) {
      emptyEl.classList.remove('hidden');
      $('errorsCount').textContent = '';
      return;
    }
    emptyEl.classList.add('hidden');
    $('errorsCount').textContent = '共 ' + ids.length + ' 句';
    ids.forEach(function (id) {
      const s = effectiveSentences().find(function (x) { return x.id === id; });
      if (!s) return;
      const li = document.createElement('li');
      li.className = 'error-item';
      li.dataset.id = id;
      li.innerHTML =
        '<div class="ei-zh">' + escapeHtml(s.zh) + '</div>' +
        '<div class="ei-meta"><span class="tag">' + escapeHtml(s.category) + '</span><span class="tag">' + s.level + '</span></div>' +
        '<div class="ei-en hidden">' + escapeHtml(s.en) + '</div>' +
        '<div class="ei-actions"><button class="reveal">看原文</button><button class="redo">重练</button></div>';
      listEl.appendChild(li);
    });
  }

  // 重练：在练习页预载指定句子（保持该句所在难度档的列表上下文）。
  function goToSentence(id) {
    const s = effectiveSentences().find(function (x) { return x.id === id; });
    if (!s) return;
    state.level = s.level;
    state.category = '全部';
    updateLevelSwitch();
    const cat = $('category'); if (cat) cat.value = '全部';
    buildList();
    const idx = state.list.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return;
    state.index = idx;
    switchTab('practice');
    resetQuestion();
  }

  function clearErrors() {
    if (state.errors.size === 0) return;
    if (!confirm('确定清空错句本？所有需复习的句子将被移除。')) return;
    state.errors = new Set();
    saveSet('sl_errors', state.errors);
    renderErrors();
  }

  // ---------- 复习（间隔重复） ----------
  // 开启/关闭复习模式：开启时练习列表改为「到期待复习」句子；无到期句则拒绝开启。
  function setReviewMode(on) {
    if (on && dueCount() === 0) {
      alert('当前没有到期要复习的句子。去练习页正常练，或稍后再来。');
      state.reviewMode = false;
      const cb = $('reviewMode'); if (cb) cb.checked = false;
      updateReviewBanner();
      return;
    }
    state.reviewMode = on;
    const cb = $('reviewMode'); if (cb) cb.checked = on;
    if (on) switchTab('practice');
    buildList();
    resetQuestion();
    updateReviewBanner();
  }
  function updateReviewBanner() {
    const el = $('reviewBanner');
    if (!el) return;
    if (state.reviewMode) {
      el.classList.remove('hidden');
      el.textContent = '🔁 复习模式 · 还剩 ' + state.list.length + ' 句到期待练（练完自动退出）';
    } else {
      el.classList.add('hidden');
      el.textContent = '';
    }
  }
  function reviewOne(id) {
    setReviewMode(true);
    const idx = state.list.findIndex(function (x) { return x.id === id; });
    if (idx >= 0) state.index = idx;
    resetQuestion();
  }
  function renderReview() {
    const sr = loadSR();
    const now = Date.now();
    const due = effectiveSentences().filter(function (s) { return sr[s.id] && sr[s.id].due <= now; })
      .sort(function (a, b) { return sr[a.id].due - sr[b.id].due; });
    const listEl = $('reviewList');
    const emptyEl = $('reviewEmpty');
    const startBtn = $('btnStartReview');
    if (!listEl) return;
    listEl.innerHTML = '';
    $('reviewSummary').textContent = '今日待复习 ' + due.length + ' 句 · 共 ' + Object.keys(sr).length + ' 句在复习计划';
    if (due.length === 0) {
      emptyEl.classList.remove('hidden');
      startBtn.classList.add('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    startBtn.classList.remove('hidden');
    due.forEach(function (s) {
      const st = sr[s.id];
      const days = st.interval || 0;
      const reps = st.reps || 0;
      const lastTxt = st.last ? new Date(st.last).toLocaleDateString() : '—';
      const li = document.createElement('li');
      li.className = 'review-item';
      li.innerHTML =
        '<div class="ri-zh">' + escapeHtml(s.zh) + '</div>' +
        '<div class="ri-meta"><span class="tag">' + escapeHtml(s.category) + '</span><span class="tag">' + s.level + '</span>' +
        '<span class="tag muted">上次 ' + lastTxt + ' · 间隔 ' + days + ' 天 · 第 ' + (reps + 1) + ' 次</span></div>' +
        '<div class="ri-en hidden">' + escapeHtml(s.en) + '</div>' +
        '<div class="ri-actions"><button class="ri-reveal">看原文</button><button class="ri-review" data-id="' + s.id + '">复习</button></div>';
      listEl.appendChild(li);
    });
  }

  // ---------- 句型训练页交互 ----------
  function patList() { return patItemsByGroup(pat.group); }
  function patCurrent() { const l = patList(); return l[pat.index] || null; }

  function patReset() {
    pat.input = '';
    pat.phase = 'typing';
    pat.revealed = false;
    pat.hintWords = 0;
    pat.startTime = Date.now();
    const ta = $('patCapture');
    if (ta) { ta.value = ''; ta.disabled = false; }
    $('patAnswerPanel').classList.add('hidden');
    $('patAnswerText').innerHTML = '';
    const res = $('patAnswerResult');
    if (res) { res.className = 'answer-result'; res.textContent = ''; }
    $('patFeedback').innerHTML = '';
    $('patSkeleton').classList.add('hidden');
    $('patPrompt').classList.remove('hidden');
    $('patShowAnswer').disabled = false;
    $('patHint').disabled = false;
    $('patSubmit').disabled = false;
    $('patSubmit').innerHTML = '<span class="icon">✓</span> 提交';
  }

  function patRender() {
    if (pat.drill.active) { patRenderFeedback(); return; } // Drill 模式：提示文案由 patDrillRenderCue 管理
    const list = patList();
    if (list.length === 0) return;
    if (pat.index >= list.length) pat.index = 0;
    if (pat.index < 0) pat.index = list.length - 1;
    const it = patCurrent();
    if (!it) return;
    const p = patById(it.patternId);
    // 句型卡片
    $('patPatternTitle').textContent = (p ? p.title : '') + '（' + (PAT_GROUP_LABEL[it.group] || '') + '）';
    $('patPattern').textContent = p ? p.pattern : '';
    $('patNote').textContent = p ? p.note : '';
    $('patExamples').innerHTML = (p && p.examples && p.examples.length)
      ? '<div class="pc-examples-label">例句</div>' + p.examples.map(function (x) {
          if (x && typeof x === 'object') {
            return '<div class="pc-ex"><span>' + escapeHtml(x.en) + '</span><span class="pc-ex-zh">' + escapeHtml(x.zh) + '</span></div>';
          }
          return '<div class="pc-ex">' + escapeHtml(x) + '</div>';
        }).join('')
      : '';
    // 提示区：完整造句显示中文，填空模式显示骨架
    if (pat.mode === 'blank') {
      $('patSkeleton').classList.remove('hidden');
      $('patSkeleton').innerHTML = it.skeleton;
      $('patPrompt').classList.add('hidden');
      $('patWriteLabel').textContent = '在横线处填入合适的英文（只需写空缺部分）';
    } else {
      $('patSkeleton').classList.add('hidden');
      $('patPrompt').classList.remove('hidden');
      $('patPrompt').textContent = it.zh;
      $('patWriteLabel').textContent = '根据中文意思，在下面输入完整英文句子';
    }
    renderPatProgress();
    patRenderFeedback();
  }

  function patTarget() {
    if (pat.drill.active) { const c = pat.drill.cues[pat.drill.index]; return c ? (c.expect || '') : ''; }
    const it = patCurrent(); if (!it) return ''; return pat.mode === 'blank' ? it.gap : it.en;
  }

  function patRenderFeedback() {
    const target = patTarget();
    const input = pat.input || '';
    const box = $('patFeedback');
    if (!input) { box.innerHTML = ''; return; }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < input.length; i++) {
      const span = document.createElement('span');
      const t = target[i];
      const ch = input[i];
      span.textContent = ch === ' ' ? '·' : ch;
      span.className = 'ch ' + (ch === t ? 'ok' : 'wrong') + (ch === ' ' ? ' space' : '');
      frag.appendChild(span);
    }
    box.innerHTML = '';
    box.appendChild(frag);
  }

  function patOnInput() {
    if (pat.drill.active) { patDrillOnInput(); return; }
    const it = patCurrent();
    if (!it || pat.phase === 'answered') return;
    const ta = $('patCapture');
    let val = ta.value;
    const fw = E.firstWrongIndex(patTarget(), val);
    const allow = fw < 0 ? patTarget().length : fw + 1;
    if (val.length > allow) { val = val.slice(0, allow); ta.value = val; }
    pat.input = val;
    patRenderFeedback();
    // 完整写对后自动提交，弹出撒花庆祝。
    if (val === patTarget()) { patSubmit(); }
  }

  function patRenderAnswer() {
    const it = patCurrent();
    if (!it) return;
    const panel = $('patAnswerPanel');
    const text = $('patAnswerText');
    if (!pat.revealed && pat.hintWords === 0) {
      panel.classList.add('hidden');
      text.innerHTML = '';
      return;
    }
    const words = wordsOf(patTarget());
    const revealCount = pat.revealed ? words.length : Math.min(pat.hintWords, words.length);
    const frag = document.createDocumentFragment();
    words.forEach(function (w, i) {
      const span = document.createElement('span');
      if (i < revealCount) { span.textContent = w; span.className = 'ch'; }
      else { span.textContent = '____'; span.className = 'ch pending'; }
      frag.appendChild(span);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    panel.classList.remove('hidden');
    text.innerHTML = '';
    text.appendChild(frag);
  }

  function patHint() {
    const it = patCurrent();
    if (!it || pat.phase === 'answered' || pat.revealed) return;
    const words = wordsOf(patTarget());
    if (pat.hintWords < words.length) {
      pat.hintWords += 1;
      patRenderAnswer();
      speak(words.slice(0, pat.hintWords).join(' '));
      if (pat.hintWords >= words.length) { pat.revealed = true; $('patHint').disabled = true; $('patShowAnswer').disabled = true; }
    }
  }

  function patShowAnswer() {
    const it = patCurrent();
    if (!it || pat.phase === 'answered') return;
    pat.revealed = true;
    const panel = $('patAnswerPanel');
    const ans = $('patAnswerText');
    panel.classList.remove('hidden');
    ans.textContent = patTarget();
    ans.className = 'answer-text';
    $('patHint').disabled = true;
    $('patShowAnswer').disabled = true;
  }

  // ---------- FSI Drills（AI 生成同句型无限变体，三模式） ----------
  function patDrillModeLabel(m) {
    return m === 'morphology' ? '换人称/时态' : (m === 'transformation' ? '肯否疑转换' : '替换词');
  }
  function patDrillStart() {
    if (!window.Coach || !Coach.isEnabled()) { alert('AI 教练未启用或 Ollama 未连接，无法生成 Drill。可退出后用固定句型练习。'); return; }
    const it = patCurrent();
    if (!it) return;
    const mode = ($('patDrillMode') && $('patDrillMode').value) || 'substitution';
    pat.drill = { active: true, mode: mode, base: it.en, cues: [], index: 0 };
    pat.input = '';
    $('patCapture').value = '';
    $('patCapture').disabled = false;
    $('patAnswerPanel').classList.add('hidden');
    $('patAnswerText').innerHTML = '';
    $('patSkeleton').classList.add('hidden');
    $('patPrompt').classList.remove('hidden');
    $('patPrompt').textContent = 'AI 正在生成「' + patDrillModeLabel(mode) + '」操练…';
    $('patWriteLabel').textContent = '根据上方指令，写出变换后的英文句子';
    $('patDrillBanner').classList.remove('hidden');
    $('patDrillExit').classList.remove('hidden');
    $('patDrillProgress').textContent = '';
    Coach.callCoach('drill', { base: it.en, mode: mode }, { json: true, temp: 0.4 }).then(function (r) {
      if (!r || !r.ok || !r.data || !Array.isArray(r.data.cues) || !r.data.cues.length) {
        $('patPrompt').textContent = 'Drill 生成失败：' + escapeHtml((r && r.error) || '无变体') + '（可退出用固定句型练习）';
        return;
      }
      pat.drill.cues = r.data.cues;
      pat.drill.index = 0;
      pat.phase = 'typing';
      patDrillRenderCue();
    });
  }
  function patDrillRenderCue() {
    const cue = pat.drill.cues[pat.drill.index];
    if (!cue) { patDrillFinish(); return; }
    $('patPrompt').textContent = '指令：' + (cue.transform || '写下一句');
    $('patWriteLabel').textContent = '根据指令写出英文';
    pat.input = '';
    $('patCapture').value = '';
    $('patCapture').disabled = false;
    $('patAnswerPanel').classList.add('hidden');
    $('patFeedback').innerHTML = '';
    $('patDrillProgress').textContent = 'Drill ' + (pat.drill.index + 1) + '/' + pat.drill.cues.length;
    if (cue.expect) speak(cue.expect); // 听打合一
    $('patCapture').focus();
  }
  function patDrillOnInput() {
    if (pat.phase === 'answered') return;
    const ta = $('patCapture');
    let val = ta.value;
    const tgt = patTarget();
    const fw = E.firstWrongIndex(tgt, val);
    const allow = fw < 0 ? tgt.length : fw + 1;
    if (val.length > allow) { val = val.slice(0, allow); ta.value = val; }
    pat.input = val;
    patRenderFeedback();
    if (val === tgt) patDrillSubmit(); // 写对自动提交
  }
  function patDrillSubmit() {
    const cue = pat.drill.cues[pat.drill.index];
    if (!cue) return;
    if (pat.phase === 'answered') { patDrillNext(); return; }
    const isCorrect = norm(pat.input || '') === norm(cue.expect || '');
    pat.phase = 'answered';
    const box = $('patAnswerPanel');
    const res = $('patAnswerResult');
    box.classList.remove('hidden');
    $('patAnswerText').textContent = cue.expect || '';
    box.classList.remove('flash-ok', 'flash-wrong');
    res.className = 'answer-result';
    void box.offsetWidth;
    box.classList.add(isCorrect ? 'flash-ok' : 'flash-wrong');
    res.classList.add(isCorrect ? 'ok' : 'wrong');
    res.textContent = isCorrect ? '正确！语感 +1' : '正确答案已显示，再来一次就熟了';
    setTimeout(function () { box.classList.remove('flash-ok', 'flash-wrong'); }, 400);
    if (isCorrect) celebrate();
    $('patCapture').disabled = true;
    $('patHint').disabled = true;
    $('patShowAnswer').disabled = true;
    $('patSubmit').disabled = true;
    $('patSubmit').textContent = '已提交';
    // 闭环补强（写错时生成同类小练习）
    if (!isCorrect) {
      Coach.callCoach('remedial', { text: pat.input, reference: cue.expect }, { json: true, temp: 0.3 }).then(function (r) {
        if (r && r.ok && r.data && Array.isArray(r.data.drills) && r.data.drills.length) {
          const items = r.data.drills.map(function (d) {
            return '<li>' + escapeHtml(d.zh || '') + ' → <b>' + escapeHtml(d.en || '') + '</b></li>';
          }).join('');
          const rd = document.createElement('div');
          rd.className = 'remedial';
          rd.innerHTML = '🔁 补强练习：<ul>' + items + '</ul>';
          box.appendChild(rd);
        }
      });
    }
  }
  function patDrillNext() {
    pat.drill.index += 1;
    if (pat.drill.index >= pat.drill.cues.length) { patDrillFinish(); return; }
    pat.phase = 'typing';
    $('patHint').disabled = false;
    $('patShowAnswer').disabled = false;
    $('patSubmit').disabled = false;
    $('patSubmit').innerHTML = '<span class="icon">✓</span> 提交';
    patDrillRenderCue();
  }
  function patDrillFinish() {
    $('patPrompt').textContent = '🎉 本轮 Drill 完成！可退出或换个模式再来一轮。';
    $('patWriteLabel').textContent = '';
    $('patCapture').value = '';
    $('patCapture').disabled = true;
    $('patFeedback').innerHTML = '';
    $('patDrillProgress').textContent = '';
    $('patSubmit').textContent = '已完成';
  }
  function patDrillExit() {
    pat.drill.active = false;
    $('patDrillBanner').classList.add('hidden');
    $('patDrillExit').classList.add('hidden');
    patReset();
    patRender();
  }

  function patSubmit() {
    if (pat.drill.active) { patDrillSubmit(); return; }
    const it = patCurrent();
    if (!it) return;
    if (pat.phase === 'answered') { patNext(); return; }
    const isCorrect = norm(pat.input || '') === norm(patTarget());
    const usedHelp = pat.hintWords > 0 || pat.revealed;
    const mastered = isCorrect && !usedHelp;
    pat.phase = 'answered';
    // 自包含进度：掌握进 master 集，否则进待巩固集
    if (mastered) { patMaster.add(it.id); patWrong.delete(it.id); }
    else { patWrong.add(it.id); }
    savePatSet('sl_pat_master', patMaster);
    savePatSet('sl_pat_wrong', patWrong);
    patShowAnswer();
    patRenderFeedback();
    renderPatProgress();
    const box = $('patAnswerPanel');
    const res = $('patAnswerResult');
    box.classList.remove('flash-ok', 'flash-wrong');
    res.className = 'answer-result';
    void box.offsetWidth;
    box.classList.add(isCorrect ? 'flash-ok' : 'flash-wrong');
    res.classList.add(isCorrect ? 'ok' : 'wrong');
    res.textContent = isCorrect ? '正确！掌握这个句型。' : '再核对一下，参考答案已显示。';
    setTimeout(function () { box.classList.remove('flash-ok', 'flash-wrong'); }, 400);
    if (isCorrect) celebrate();
    $('patCapture').disabled = true;
    $('patHint').disabled = true;
    $('patShowAnswer').disabled = true;
    $('patSubmit').disabled = true;
    $('patSubmit').textContent = '已提交';
    renderPatWrong();
  }

  function patNext() {
    if (pat.drill.active) { patDrillNext(); return; }
    const list = patList();
    if (list.length === 0) return;
    pat.index = pat.index < list.length - 1 ? pat.index + 1 : 0;
    patReset(); patRender(); $('patCapture').focus();
  }
  function patPrev() {
    if (pat.drill.active) { return; } // Drill 模式用「提交」逐变体推进
    const list = patList();
    if (list.length === 0) return;
    pat.index = pat.index > 0 ? pat.index - 1 : list.length - 1;
    patReset(); patRender(); $('patCapture').focus();
  }

  function patSetGroup(g) {
    if (pat.drill.active) patDrillExit();
    pat.group = g;
    pat.index = 0;
    pat.mode = 'full';
    Array.prototype.forEach.call(document.querySelectorAll('#patGroups button'), function (b) {
      b.classList.toggle('active', b.dataset.group === g);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#patModes button'), function (b) {
      b.classList.toggle('active', b.dataset.mode === pat.mode);
    });
    patReset(); patRender(); renderPatWrong(); $('patCapture').focus();
  }
  function patSetMode(m) {
    if (pat.drill.active) patDrillExit();
    pat.mode = m;
    Array.prototype.forEach.call(document.querySelectorAll('#patModes button'), function (b) {
      b.classList.toggle('active', b.dataset.mode === m);
    });
    patReset(); patRender(); $('patCapture').focus();
  }

  function renderPatProgress() {
    const list = patList();
    const total = list.length;
    const masteredN = list.filter(function (it) { return patMaster.has(it.id); }).length;
    const wrongN = list.filter(function (it) { return patWrong.has(it.id); }).length;
    const cur = Math.min(pat.index + 1, total);
    $('patProgress').innerHTML =
      '<span class="tag">' + (PAT_GROUP_LABEL[pat.group] || '') + '</span>' +
      '<span class="muted">第 ' + cur + '/' + total + ' 题</span>' +
      '<span class="muted">已掌握 ' + masteredN + '/' + total + '</span>' +
      '<span class="muted">待巩固 ' + wrongN + '</span>' +
      '<span class="muted">' + (pat.mode === 'blank' ? '填空模式' : '完整造句模式') + '</span>';
  }

  function renderPatWrong() {
    const list = patList();
    const wrongs = list.filter(function (it) { return patWrong.has(it.id); });
    const ul = $('patWrongList');
    if (!ul) return;
    ul.innerHTML = '';
    $('patWrongCount').textContent = wrongs.length ? ('共 ' + wrongs.length + ' 句') : '';
    if (wrongs.length === 0) { $('patWrongEmpty').classList.remove('hidden'); return; }
    $('patWrongEmpty').classList.add('hidden');
    wrongs.forEach(function (it) {
      const li = document.createElement('li');
      li.className = 'pat-wrong-item';
      li.dataset.id = it.id;
      li.innerHTML =
        '<div class="pwi-zh">' + escapeHtml(it.zh) + '</div>' +
        '<div class="pwi-en hidden">' + escapeHtml(it.en) + '</div>' +
        '<div class="pwi-actions"><button class="reveal">看答案</button><button class="redo">重练</button></div>';
      ul.appendChild(li);
    });
  }

  function patRedo(id) {
    const list = patList();
    const idx = list.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return;
    pat.index = idx;
    patReset(); patRender(); $('patCapture').focus();
  }

  function renderPatterns() {
    Array.prototype.forEach.call(document.querySelectorAll('#patGroups button'), function (b) {
      b.classList.toggle('active', b.dataset.group === pat.group);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#patModes button'), function (b) {
      b.classList.toggle('active', b.dataset.mode === pat.mode);
    });
    patRender();
    renderPatWrong();
  }

  function renderStats() {
    const A = state.attempts;
    const total = A.length;
    const mastered = A.filter(function (a) { return a.mastered; }).length;
    const rate = total ? Math.round((mastered / total) * 100) : 0;
    const avgWpm = total ? Math.round(A.reduce(function (s, a) { return s + (a.wpm || 0); }, 0) / total) : 0;

    $('statTotal').textContent = total;
    $('statRate').textContent = rate + '%';
    $('statReview').textContent = state.errors.size;
    $('statWpm').textContent = avgWpm;

    // 难度分布
    ['初级', '高级'].forEach(function (lv) {
      const la = A.filter(function (a) { return a.level === lv; });
      const lm = la.filter(function (a) { return a.mastered; }).length;
      const r = la.length ? Math.round((lm / la.length) * 100) : 0;
      if (lv === '初级') {
        $('lvBasic').textContent = '已练 ' + la.length + ' 次 · 掌握率 ' + r + '%';
        $('barBasic').style.width = r + '%';
      } else {
        $('lvAdvanced').textContent = '已练 ' + la.length + ' 次 · 掌握率 ' + r + '%';
        $('barAdvanced').style.width = r + '%';
      }
    });

    // 分类掌握率（只显示有练习记录的分类，按掌握率降序）
    const byCat = {};
    A.forEach(function (a) {
      if (!byCat[a.category]) byCat[a.category] = { n: 0, m: 0 };
      byCat[a.category].n += 1;
      if (a.mastered) byCat[a.category].m += 1;
    });
    const cats = Object.keys(byCat).map(function (c) {
      const o = byCat[c];
      return { cat: c, n: o.n, m: o.m, rate: o.n ? Math.round((o.m / o.n) * 100) : 0 };
    }).sort(function (x, y) { return y.rate - x.rate; });

    const box = $('catBars');
    box.innerHTML = '';
    if (cats.length === 0) {
      $('catEmpty').classList.remove('hidden');
      return;
    }
    $('catEmpty').classList.add('hidden');
    cats.forEach(function (o) {
      const row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML =
        '<div class="cat-name">' + escapeHtml(o.cat) + ' <span class="cat-sub">已练 ' + o.n + ' 次</span></div>' +
        '<div class="bar"><span class="bar-fill" style="width:' + o.rate + '%"></span></div>' +
        '<div class="cat-rate">' + o.rate + '%</div>';
      box.appendChild(row);
    });

    // 薄弱点诊断看板（仅诊断，不记对错；来自 AI 拆解的 category 计数）
    const wbox = $('weakBars');
    if (wbox) {
      const w = (window.Coach && Coach.getWeakness) ? Coach.getWeakness() : {};
      const order = ['tense', 'word_order', 'preposition', 'article', 'vocabulary', 'other'];
      const label = { tense: '时态', word_order: '语序', preposition: '介词', article: '冠词', vocabulary: '词汇', other: '其他' };
      const entries = order.filter(function (k) { return w[k]; }).map(function (k) { return { k: k, n: w[k] }; });
      const maxN = entries.reduce(function (m, e) { return Math.max(m, e.n); }, 0);
      wbox.innerHTML = '';
      if (entries.length === 0) { $('weakEmpty').classList.remove('hidden'); }
      else {
        $('weakEmpty').classList.add('hidden');
        entries.sort(function (a, b) { return b.n - a.n; }).forEach(function (e) {
          const row = document.createElement('div');
          row.className = 'cat-row';
          const pct = maxN ? Math.round((e.n / maxN) * 100) : 0;
          row.innerHTML =
            '<div class="cat-name">' + (label[e.k] || e.k) + ' <span class="cat-sub">出错 ' + e.n + ' 次</span></div>' +
            '<div class="bar"><span class="bar-fill" style="width:' + pct + '%"></span></div>' +
            '<div class="cat-rate">' + e.n + '</div>';
          wbox.appendChild(row);
        });
      }
    }
  }

  function init() {
    // 先恢复开关偏好，再出题 —— 避免首题按 HTML 默认 checked 朗读而忽略用户已关闭的「自动朗读」
    const as = $('autoSpeak');
    if (as) {
      as.checked = (function () { try { return localStorage.getItem('sl_autospeak') !== 'false'; } catch (e) { return true; } })();
      as.addEventListener('change', function () { try { localStorage.setItem('sl_autospeak', as.checked ? 'true' : 'false'); } catch (e) {} });
    }
    // AI 教练设置（开关 + 模型名，持久化）
    const aiEn = $('aiEnabled');
    if (aiEn) {
      aiEn.checked = (window.Coach && Coach.isEnabled()) !== false;
      aiEn.addEventListener('change', function () { if (window.Coach) Coach.setEnabled(aiEn.checked); refreshAiButtons(); });
    }
    const aiMd = $('aiModel');
    if (aiMd) {
      aiMd.value = (window.Coach && Coach.getModel()) || 'qwen2.5:7b';
      aiMd.addEventListener('change', function () { if (window.Coach) Coach.setModel(aiMd.value); });
    }
    initCategories();
    buildList();
    resetQuestion();

    $('capture').addEventListener('input', onInput);
    $('capture').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    $('btnSpeak').addEventListener('click', function () { const s = current(); if (s) speak(s.en); });
    $('btnHint').addEventListener('click', hint);
    $('btnAiHint').addEventListener('click', aiHint);
    $('btnShowAnswer').addEventListener('click', showAnswerClicked);
    $('btnSubmit').addEventListener('click', submit);
    $('btnCollect').addEventListener('click', collect);
    $('btnNext').addEventListener('click', next);
    Array.prototype.forEach.call(document.querySelectorAll('.level-switch button'), function (b) {
      b.addEventListener('click', function () { setLevel(b.dataset.level); });
    });
    $('category').addEventListener('change', function (e) {
      state.category = e.target.value; buildList(); resetQuestion();
    });

    // 复习（间隔重复）：练习页开关 + 复习页一键开始 / 逐句复习
    const rm = $('reviewMode');
    if (rm) rm.addEventListener('change', function (e) { setReviewMode(e.target.checked); });
    const srb = $('btnStartReview');
    if (srb) srb.addEventListener('click', function () { setReviewMode(true); });
    const rlist = $('reviewList');
    if (rlist) rlist.addEventListener('click', function (e) {
      const li = e.target.closest('.review-item');
      if (!li) return;
      if (e.target.classList.contains('ri-reveal')) {
        const en = li.querySelector('.ri-en');
        en.classList.toggle('hidden');
        e.target.textContent = en.classList.contains('hidden') ? '看原文' : '隐藏原文';
      } else if (e.target.classList.contains('ri-review')) {
        const id = e.target.dataset.id;
        if (id) reviewOne(id);
      }
    });

    // 标签导航
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    // 错句本交互（事件委托）
    $('errorList').addEventListener('click', function (e) {
      const li = e.target.closest('.error-item');
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.classList.contains('reveal')) {
        const en = li.querySelector('.ei-en');
        en.classList.toggle('hidden');
        e.target.textContent = en.classList.contains('hidden') ? '看原文' : '隐藏原文';
      } else if (e.target.classList.contains('redo')) {
        goToSentence(id);
      }
    });
    $('btnClearErrors').addEventListener('click', clearErrors);

    // 句子库页
    $('libLevel').addEventListener('change', renderLibrary);
    $('libCategory').addEventListener('change', renderLibrary);
    $('btnAddManual').addEventListener('click', function () {
      const r = addCustomSentence($('manZh').value, $('manEn').value, $('manCat').value);
      $('importMsg').textContent = r.msg;
      if (r.ok) { $('manZh').value = ''; $('manEn').value = ''; $('manCat').value = ''; refreshLibCategories(); renderLibrary(); }
    });
    $('btnImportJson').addEventListener('click', function () {
      try {
        const arr = JSON.parse($('jsonPaste').value);
        if (!Array.isArray(arr)) throw new Error('JSON 必须是数组');
        const res = importSentences(arr);
        $('importMsg').textContent = 'JSON 导入完成：新增 ' + res.added + ' 句，跳过 ' + res.skipped + ' 句';
        $('jsonPaste').value = '';
        refreshLibCategories(); renderLibrary();
      } catch (e) {
        $('importMsg').textContent = 'JSON 解析失败：' + (e && e.message ? e.message : e);
      }
    });
    $('fileInput').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) handleFile(f);
    });
    $('libList').addEventListener('click', function (e) {
      const btn = e.target.closest('.li-del');
      if (btn) deleteCustom(btn.dataset.id);
    });

    // 句型训练页：分组/模式切换、输入、朗读/提示/答案/提交/上下题、错题交互
    Array.prototype.forEach.call(document.querySelectorAll('#patGroups button'), function (b) {
      b.addEventListener('click', function () { patSetGroup(b.dataset.group); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#patModes button'), function (b) {
      b.addEventListener('click', function () { patSetMode(b.dataset.mode); });
    });
    $('patCapture').addEventListener('input', patOnInput);
    $('patCapture').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); patSubmit(); }
    });
    $('patSpeak').addEventListener('click', function () { const it = patCurrent(); if (it) speak(it.en); });
    $('patHint').addEventListener('click', patHint);
    $('patShowAnswer').addEventListener('click', patShowAnswer);
    $('patSubmit').addEventListener('click', patSubmit);
    // FSI Drills
    $('patDrillBtn').addEventListener('click', patDrillStart);
    $('patDrillExit').addEventListener('click', patDrillExit);
    $('patNext').addEventListener('click', patNext);
    $('patPrev').addEventListener('click', patPrev);
    $('patWrongList').addEventListener('click', function (e) {
      const li = e.target.closest('.pat-wrong-item');
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.classList.contains('reveal')) {
        const en = li.querySelector('.pwi-en');
        en.classList.toggle('hidden');
        e.target.textContent = en.classList.contains('hidden') ? '看答案' : '隐藏答案';
      } else if (e.target.classList.contains('redo')) {
        patRedo(id);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (state.tab !== 'practice') return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'l' || e.key === 'L') { const s = current(); if (s) speak(s.en); }
      else if (e.key === 'h' || e.key === 'H') { hint(); }
      else if (e.key === 'ArrowRight') { next(); }
    });

    document.addEventListener('click', function (e) {
      if (state.tab !== 'practice') return;
      if (e.target.closest('#actionbar') || e.target.closest('.level-switch') || e.target.closest('#category') || e.target.closest('.settings')) return;
      focusCapture();
    });

    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
    }
    initStorage();
    // AI 教练：探活状态灯，并按可用性启用/禁用 AI 按钮
    if (window.Coach) { Coach.updateStatus(refreshAiButtons); }
    focusCapture();
  }

  // 根据 AI 是否启用/可用，刷新练习页与句型页相关按钮的可用态
  function refreshAiButtons() {
    const enabled = window.Coach && Coach.isEnabled();
    const ok = window.Coach && Coach.status && Coach.status.ok;
    const usable = enabled && ok;
    const aiHintBtn = $('btnAiHint'); if (aiHintBtn) aiHintBtn.disabled = !usable;
    const drillBtn = $('patDrillBtn'); if (drillBtn) drillBtn.disabled = !usable;
    const aiEn = $('aiEnabled');
    if (aiEn && !enabled) {
      const h = $('aiHintPanel'); if (h) { h.classList.remove('hidden'); h.innerHTML = '<div class="ai-err">AI 教练已关闭，在工具栏勾选「🤖 AI 教练」并连接 Ollama 后可用。</div>'; }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
