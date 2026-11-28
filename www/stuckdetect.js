// ============================================================
// HUE POUR — Stuck-Detection Engine & Web Worker  v2
// ============================================================
// Dual-mode script:
//   1. Loaded as a Web Worker (`new Worker('stuckdetect.js')`):
//      imports game.js and runs full detection (rules + 30k/150ms BFS) off
//      the main thread.
//   2. Loaded via <script src="stuckdetect.js"> in page context (after game.js):
//      exposes `StuckDetect` shared rule helpers so the time-sliced fallback
//      never duplicates condition checks (a), (c), (d), (e).
// ============================================================
'use strict';

/* global importScripts, hasLegalMove, checkSolvability */

const StuckDetect = (() => {
  const NODE_CAP = 30000;
  const TIME_CAP = 150;

  /**
   * Run synchronous O(1) / O(N^2) stuck checks:
   *   - first 5 moves guard (moveCount <= 5)
   *   - (c) restarts >= 2
   *   - (d) moveCount > 2.5 * par (respecting post-rescue baseline)
   *   - (e) 60s with no progress after >= 10 moves
   *   - (a) no legal move
   * Returns `{ stuck: boolean, reason: string } | null` (`null` means run solver).
   */
  function checkFastConditions(d) {
    if (d.forceStuck) {
      return { stuck: true, reason: 'forced' };
    }

    // Never show on the first 5 moves of a level
    if ((d.moveCount || 0) <= 5) {
      return { stuck: false, reason: 'early-moves' };
    }

    // (c) Player has restarted the level 2+ times
    if ((d.restartCount || 0) >= 2) {
      return { stuck: true, reason: 'restarts' };
    }

    // (d) Moves exceed 2.5 * par (and if a tube was already added this attempt,
    // wait for a modest grace window so a second extra tube isn't forced immediately)
    if (d.par > 0 && d.moveCount > 2.5 * d.par) {
      const baseline = d.movesAtLastRescue || 0;
      const grace = Math.max(4, Math.round(d.par * 0.5));
      if (baseline === 0 || d.moveCount >= baseline + grace) {
        return { stuck: true, reason: 'over-par' };
      }
    }

    // (e) 60 seconds with no progress after at least 10 moves
    if (d.moveCount >= 10 && d.lastProgressTime > 0 &&
        (d.now - d.lastProgressTime) >= 60000) {
      return { stuck: true, reason: 'no-progress' };
    }

    // (a) No legal move
    if (!hasLegalMove(d.tubes)) {
      return { stuck: true, reason: 'no-legal-move' };
    }

    return null; // proceed to capped solver (b)
  }

  /** Interpret `checkSolvability` result into stuck status (`null` = unknown). */
  function interpretSolverResult(res) {
    if (!res) return { stuck: null, reason: 'unknown' };
    if (res.status === 'unsolvable') return { stuck: true, reason: 'unsolvable' };
    if (res.status === 'timeout' || res.status === 'capped') {
      return { stuck: null, reason: res.status }; // unknown, NOT stuck
    }
    return { stuck: false, reason: 'ok' };
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
      self.postMessage({ type: 'result', seq: d.seq, stuck: fast.stuck, reason: fast.reason });
      return;
    }

    // (b) Capped solver: 30k nodes, 150ms time cap per check
    let res = null;
    try {
      res = checkSolvability(d.tubes, d.target, StuckDetect.NODE_CAP, StuckDetect.TIME_CAP);
    } catch (_) {
      res = { status: 'timeout', moves: null, nodeCount: 0 };
    }
    const interpreted = StuckDetect.interpretSolverResult(res);
    self.postMessage({
      type:   'result',
      seq:    d.seq,
      stuck:  interpreted.stuck,
      reason: interpreted.reason,
    });
  };
}
