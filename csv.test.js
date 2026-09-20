// Standalone algorithm test for the CSV parser used in app.js (parseCsv + csvToSentences logic).
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
  let start = 0;
  if (rows[0] && /原文正文|英文|en/i.test(rows[0].join(','))) start = 1;
  const out = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const en = (r[1] || '').trim();
    const zh = (r[3] || '').trim();
    if (!en || !zh) continue;
    out.push({ category: (r[0] || '').trim() || '自定义', en: en, zh: zh });
  }
  return out;
}

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }

// 1) plain csv with header
let s = csvToSentences('原文标题,原文正文,译文标题,译文正文,音频地址\nCat,Hello world.,,你好世界。,\nCat,We are testing.,,我们在测试。,');
assert(s.length === 2, 'two rows mapped');
assert(s[0].en === 'Hello world.' && s[0].zh === '你好世界。', 'first row mapped');
assert(s[1].en === 'We are testing.', 'second row mapped');

// 2) quoted field with comma
s = csvToSentences('cat,en,,zh,\nCustom,"Hello, world.",,你好，世界。,');
assert(s.length === 1, 'quoted comma row mapped');
assert(s[0].en === 'Hello, world.', 'comma preserved inside quotes');

// 3) no header
s = csvToSentences('Custom,Hi there.,,嗨。,');
assert(s.length === 1 && s[0].zh === '嗨。', 'no-header row mapped');

console.log('CSV TEST PASSED');
