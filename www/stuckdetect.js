// ============================================================
// HUE POUR — Stuck-Detection Engine & Web Worker  v3
// ============================================================
// Runs after every move off the main thread (via Web Worker `stuckdetect.js`
// or `createChunkedSolver` time-sliced fallback in ui.js).
//
// Stuck iff:
//   (a) there is NO legal move, OR
//   (b) capped BFS (30k nodes / 150ms) PROVES the position unsolvable.
// Timeouts / node caps mean 'unknown' (NOT stuck).
// ============================================================
'use strict';

/* global importScripts, hasLegalMove, checkSolvability */

const StuckDetect = (() => {
  const NODE_CAP = 30000;
  const TIME_CAP = 150;

  /**
   * Run synchronous O(1) / O(N^2) check:
   *   - Returns `{ status: 'yes', stuck: true, reason: 'no-legal-move' }` if no legal move exists.
   *   - Otherwise returns `null` (caller runs capped BFS solver).
   */
  function checkFastConditions(d) {
    if (!hasLegalMove(d.tubes)) {
      return { stuck: true, status: 'yes', reason: 'no-legal-move' };
    }
    return null;
  }

  /**
   * Map `checkSolvability` result into tri-state `{ stuck, status, reason }`:
   *   - 'unsolvable' -> { stuck: true,  status: 'yes',     reason: 'unsolvable' }
   *   - 'solved'     -> { stuck: false, status: 'no',      reason: 'ok' }
   *   - 'timeout'/'capped'/null -> { stuck: false, status: 'unknown', reason: ... }
   */
  function interpretSolverResult(res) {
    if (!res) return { stuck: false, status: 'unknown', reason: 'unknown' };
    if (res.status === 'unsolvable') return { stuck: true, status: 'yes', reason: 'unsolvable' };
    if (res.status === 'solved') return { stuck: false, status: 'no', reason: 'ok' };
    return { stuck: false, status: 'unknown', reason: res.status || 'timeout' };
  }

  return {
    NODE_CAP,
    TIME_CAP,
    checkFastConditions,
    interpretSolverResult,
  };
})();

if (typeof importScripts === 'function') {
  importScripts('./game.js');

  self.onmessage = function (e) {
    const d = e.data;
    if (!d || d.type !== 'check') return;

    const fast = StuckDetect.checkFastConditions(d);
    if (fast !== null) {
      self.postMessage({
        type: 'result', seq: d.seq,
        stuck: fast.stuck, status: fast.status, reason: fast.reason,
      });
      return;
    }

    // (b) Capped solver: ~30k nodes, ~150ms time cap per check
    let res = null;
    try {
      res = checkSolvability(d.tubes, d.target, StuckDetect.NODE_CAP, StuckDetect.TIME_CAP);
    } catch (_) {
      res = { status: 'timeout', moves: null, nodeCount: 0 };
    }
    const out = StuckDetect.interpretSolverResult(res);
    self.postMessage({
      type: 'result', seq: d.seq,
      stuck: out.stuck, status: out.status, reason: out.reason,
    });
  };
}
