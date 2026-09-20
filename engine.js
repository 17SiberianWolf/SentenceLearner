// SentenceLearner engine — pure functions, usable in browser (window.Engine) and node (module.exports).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Engine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Compare target vs input character-by-character. No space-based segmentation:
  // the whole string (including spaces) is a single continuous character stream.
  function compareChars(target, input) {
    const n = target.length;
    const res = new Array(n);
    const inp = input == null ? '' : input;
    for (let i = 0; i < n; i++) {
      const t = target[i];
      const typed = inp[i];
      if (typed === undefined) res[i] = { ch: t, status: 'pending' };
      else if (typed === t) res[i] = { ch: t, status: 'ok' };
      else res[i] = { ch: t, status: 'wrong', typed: typed };
    }
    return res;
  }

  // Index of first mismatch between target and input; -1 if input is a correct prefix (or exact).
  function firstWrongIndex(target, input) {
    const inp = input == null ? '' : input;
    const lim = Math.min(target.length, inp.length);
    for (let i = 0; i < lim; i++) if (inp[i] !== target[i]) return i;
    if (inp.length > target.length) return target.length; // overflow counts as wrong
    return -1;
  }

  // Difficulty: <=15 words => 初级, >15 => 高级.
  function levelOf(en) {
    const wc = (en || '').trim().split(/\s+/).filter(Boolean).length;
    return wc <= 15 ? '初级' : '高级';
  }

  // WPM = correct characters / elapsed minutes (per LLD). accuracy = correct / attempted.
  function computeStats(correctChars, attempted, startTimeMs) {
    const elapsedMin = Math.max((Date.now() - startTimeMs) / 60000, 1 / 60000);
    const wpm = Math.round(correctChars / elapsedMin);
    const accuracy = attempted > 0 ? correctChars / attempted : 0;
    return { wpm: wpm, accuracy: accuracy };
  }

  return { compareChars: compareChars, firstWrongIndex: firstWrongIndex, levelOf: levelOf, computeStats: computeStats };
});
