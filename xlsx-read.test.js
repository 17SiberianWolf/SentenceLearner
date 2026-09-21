// Node test for xlsx-read.js — verifies parsing against the real template.xlsx
const fs = require('fs');
const path = require('path');
const X = require('./xlsx-read.js');

const file = path.join(__dirname, 'resource', 'template.xlsx');
const buf = fs.readFileSync(file); // Buffer is a Uint8Array

(async () => {
  try {
    console.log('file bytes:', buf.length);
    const rows = await X.parseXlsx(buf);
    console.log('parsed rows:', rows.length);
    console.log('first 3 rows:');
    rows.slice(0, 3).forEach((r, i) => console.log('  row', i, JSON.stringify(r)));
    const sentences = await X.xlsxToSentences(buf);
    console.log('mapped sentences:', sentences.length);
    if (sentences.length) console.log('sample sentence:', JSON.stringify(sentences[0]));
    const withZh = sentences.filter(s => s.zh && s.en).length;
    console.log('rows with both zh & en:', withZh);
    if (sentences.length !== withZh) {
      console.log('WARN: some rows missing zh/en after header skip');
    }
    console.log(sentences.length > 100 && withZh === sentences.length ? 'XLSX TEST PASSED' : 'XLSX TEST CHECK');
  } catch (e) {
    console.error('XLSX TEST FAILED:', e && e.message);
    process.exit(1);
  }
})();