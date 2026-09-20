// Smoke test for the SentenceLearner engine.
// De-risks ADR-005: confirms a long sentence is handled as ONE continuous character
// stream (no space-based segmentation), and that level classification works.
const E = require('./engine.js');
let pass = true;
function assert(cond, msg) {
  if (!cond) { pass = false; console.error('FAIL:', msg); }
  else console.log('  ok:', msg);
}

console.log('--- engine smoke test ---');

// A sentence with >15 words (advanced level).
const long = 'We have successfully completed the debugging of the continuous caster and the quality is now within the required specification.';
const longWords = long.split(/\s+/).filter(Boolean).length;
assert(longWords > 15, 'long sentence has >15 words (' + longWords + ')');
assert(E.levelOf(long) === '高级', 'levelOf(long) === 高级');

// The whole string must be one continuous char stream, not split by spaces.
const res = E.compareChars(long, long);
assert(res.length === long.length, 'compareChars length === target length (continuous, no space split)');
assert(res.every(function (r) { return r.status === 'ok'; }), 'perfect input => all chars ok');

// A wrong char in the middle must be detected at the right index; neighbors unaffected.
const bad = long.slice(0, 10) + 'X' + long.slice(11);
const res2 = E.compareChars(long, bad);
assert(res2[10].status === 'wrong', 'wrong char detected at index 10');
assert(res2[9].status === 'ok' && res2[11].status === 'ok', 'neighbors of the wrong char are ok');
assert(E.firstWrongIndex(long, bad) === 10, 'firstWrongIndex === 10');

// Spaces are treated as ordinary characters (compareChars includes them in the stream).
const withSpaceWrong = long.slice(0, 4) + 'X' + long.slice(5);
assert(E.firstWrongIndex(long, withSpaceWrong) === 4, 'wrong char after a space is detected at its true index');

// Short sentence => 初级, also continuous.
const short = 'Please send me the report.';
assert(E.levelOf(short) === '初级', 'short sentence => 初级');
assert(E.compareChars(short, short).length === short.length, 'short sentence is a continuous char stream');

// Pending tail: partial input leaves remaining chars pending.
const partial = E.compareChars(short, 'Please send');
assert(partial[0].status === 'ok' && partial[partial.length - 1].status === 'pending', 'partial input => ok prefix + pending tail');

console.log(pass ? '\nSMOKE TEST PASSED' : '\nSMOKE TEST FAILED');
process.exit(pass ? 0 : 1);
