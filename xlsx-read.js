// xlsx-read.js — zero-dependency .xlsx reader (browser + node).
// Modern browsers and Node >=18 ship DecompressionStream, so we parse the
// zip + inflate deflate streams ourselves instead of bundling SheetJS.
// Supports the common case: shared strings and/or inline strings, deflate or stored.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.XlsxRead = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function decodeEntities(s) {
    return String(s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  function colToIndex(letters) {
    let n = 0;
    for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1; // 0-based
  }

  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  // Parse a zip archive; return { name: inflated Uint8Array }
  async function unzip(buf) {
    const dv = new DataView(buf);
    // find End Of Central Directory
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 xlsx/zip 文件');
    const cdOffset = dv.getUint32(eocd + 16, true);
    const files = {};
    let p = cdOffset;
    while (p + 4 <= buf.byteLength && dv.getUint32(p, true) === 0x02014b50) {
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOffset = dv.getUint32(p + 42, true);
      const nameBytes = new Uint8Array(buf.slice(p + 46, p + 46 + nameLen));
      const name = new TextDecoder('utf-8').decode(nameBytes);
      // read local header
      const lm = dv.getUint16(localOffset + 8, true);
      const lNameLen = dv.getUint16(localOffset + 26, true);
      const lExtraLen = dv.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const comp = new Uint8Array(buf.slice(dataStart, dataStart + compSize));
      let data;
      if (lm === 8) data = await inflateRaw(comp);
      else if (lm === 0) data = comp;
      else throw new Error('不支持的压缩方式: ' + lm);
      files[name] = data;
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  function parseSharedStrings(xml) {
    const out = [];
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(xml))) {
      const inner = m[1];
      const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let t, txt = '';
      while ((t = tRe.exec(inner))) txt += t[1];
      out.push(decodeEntities(txt));
    }
    return out;
  }

  function parseSheet(xml, shared) {
    const rows = [];
    const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
    let r;
    while ((r = rowRe.exec(xml))) {
      const cells = {};
      const cRe = /<c\s+r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
      let c;
      while ((c = cRe.exec(r[1]))) {
        const col = colToIndex(c[1]);
        const attrs = c[3];
        const body = c[4];
        const tMatch = /t="([^"]*)"/.exec(attrs);
        const type = tMatch ? tMatch[1] : '';
        let value = '';
        if (type === 's') {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body);
          if (v) value = shared[parseInt(v[1], 10)] || '';
        } else if (type === 'inlineStr') {
          const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
          let t, txt = '';
          while ((t = tRe.exec(body))) txt += t[1];
          value = txt;
        } else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body);
          if (v) value = v[1];
        }
        cells[col] = decodeEntities(value);
      }
      const maxCol = Math.max(-1, ...Object.keys(cells).map(Number));
      const row = [];
      for (let i = 0; i <= maxCol; i++) row.push(cells[i] || '');
      rows.push(row);
    }
    return rows;
  }

  // Parse xlsx ArrayBuffer/Uint8Array -> array of rows (each row = array of cell strings)
  async function parseXlsx(buffer) {
    const buf = buffer instanceof Uint8Array ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer;
    const files = await unzip(buf);
    const shared = files['xl/sharedStrings.xml'] ? parseSharedStrings(new TextDecoder('utf-8').decode(files['xl/sharedStrings.xml'])) : [];
    let sheetXml = null;
    for (const k of Object.keys(files)) {
      if (/xl\/worksheets\/sheet\d*\.xml$/.test(k)) { sheetXml = new TextDecoder('utf-8').decode(files[k]); break; }
    }
    if (!sheetXml) throw new Error('xlsx 中未找到工作表');
    return parseSheet(sheetXml, shared);
  }

  // Map xlsx rows (template.xlsx layout) to sentence objects.
  // Layout: [category, en, , zh, audioUrl]  (col0..col4)
  function xlsxToSentences(buffer) {
    return parseXlsx(buffer).then(function (rows) {
      const out = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const maybeHeader = (row[1] || '').trim();
        if (i === 0 && (maybeHeader === '原文正文' || maybeHeader === 'en' || maybeHeader === '英文')) continue;
        const en = (row[1] || '').trim();
        const zh = (row[3] || '').trim();
        if (!en || !zh) continue;
        out.push({
          category: (row[0] || '').trim() || '自定义',
          en: en,
          zh: zh,
          audioUrl: (row[4] || '').trim(),
        });
      }
      return out;
    });
  }

  return { parseXlsx: parseXlsx, xlsxToSentences: xlsxToSentences };
});
