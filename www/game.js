// ============================================================
// HUE POUR — Game Logic  (pure functions, no UI dependencies)
// 12-colour wheel · unified fusion table · reverse-move generator
// ============================================================
'use strict';

/* ---------- Seeded PRNG (Mulberry32) ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ========== COLOUR CONSTANTS ========== */
const Color = Object.freeze({
  RED:       'RED',
  YELLOW:    'YELLOW',
  BLUE:      'BLUE',
  ORANGE:    'ORANGE',
  GREEN:     'GREEN',
  PURPLE:    'PURPLE',
  VERMILION: 'VERMILION',
  AMBER:     'AMBER',
  LIME:      'LIME',
  TEAL:      'TEAL',
  INDIGO:    'INDIGO',
  MAGENTA:   'MAGENTA',
});

const PRIMARIES   = [Color.RED, Color.YELLOW, Color.BLUE];
const SECONDARIES = [Color.ORANGE, Color.GREEN, Color.PURPLE];
const TERTIARIES  = [Color.VERMILION, Color.AMBER, Color.LIME,
                     Color.TEAL, Color.INDIGO, Color.MAGENTA];
const ALL_COLORS  = [...PRIMARIES, ...SECONDARIES, ...TERTIARIES];

const TUBE_CAPACITY = 4;
const MAX_TUBES     = 14;
const MAX_TARGETS   = 10;

/* ========== UNIFIED FUSION TABLE (single data object) ========== */
// Maps result colour -> [parentA, parentB]. Order of parents does not matter.
// Tertiary colours do not appear as parents, so they cannot fuse further.
const FUSION_TABLE = Object.freeze({
  ORANGE:    ['RED',    'YELLOW'],
  GREEN:     ['YELLOW', 'BLUE'],
  PURPLE:    ['BLUE',   'RED'],
  VERMILION: ['RED',    'ORANGE'],
  AMBER:     ['YELLOW', 'ORANGE'],
  LIME:      ['YELLOW', 'GREEN'],
  TEAL:      ['BLUE',   'GREEN'],
  INDIGO:    ['BLUE',   'PURPLE'],
  MAGENTA:   ['RED',    'PURPLE'],
});

/* Derived fast look-ups built directly from FUSION_TABLE */
const FUSION = {};
const REVERSE_FUSION = FUSION_TABLE;
for (const result of Object.keys(FUSION_TABLE)) {
  const [a, b] = FUSION_TABLE[result];
  FUSION[a + '|' + b] = result;
  FUSION[b + '|' + a] = result;
}

/* Compact integer codes (1..12) and fusion lookup for fast BFS solver */
const _COLOR_TO_INT = {};
for (let i = 0; i < ALL_COLORS.length; i++) {
  _COLOR_TO_INT[ALL_COLORS[i]] = i + 1; // 1..12 (4-bit non-zero)
}
const _INT_FUSION = new Uint8Array(256);
for (const result of Object.keys(FUSION_TABLE)) {
  const [a, b] = FUSION_TABLE[result];
  const ia = _COLOR_TO_INT[a], ib = _COLOR_TO_INT[b], ir = _COLOR_TO_INT[result];
  _INT_FUSION[(ia << 4) | ib] = ir;
  _INT_FUSION[(ib << 4) | ia] = ir;
}

/* ========== COLOUR DISPLAY INFO ========== */
// Wheel order: RED ● -> VERMILION ▼ -> ORANGE ◆ -> AMBER ✕ -> YELLOW ▲ -> LIME ≡ ->
//              GREEN ★ -> TEAL ○ -> BLUE ■ -> INDIGO ≈ -> PURPLE ✚ -> MAGENTA □
// Every neighbouring pair on the 12-colour wheel uses a distinct symbol shape.
const COLOR_INFO = {
  RED:       { hex: '#E53935', glow: '#ff5252', symbol: '●', name: 'Red'       },
  YELLOW:    { hex: '#FFD93B', glow: '#ffff00', symbol: '▲', name: 'Yellow'    },
  BLUE:      { hex: '#2F7DF6', glow: '#448aff', symbol: '■', name: 'Blue'      },
  ORANGE:    { hex: '#FF8A1F', glow: '#ffab40', symbol: '◆', name: 'Orange'    },
  GREEN:     { hex: '#2ECC71', glow: '#69f0ae', symbol: '★', name: 'Green'     },
  PURPLE:    { hex: '#8E44AD', glow: '#ea80fc', symbol: '✚', name: 'Purple'    },
  VERMILION: { hex: '#FF5A36', glow: '#ff7c5e', symbol: '▼', name: 'Vermilion' },
  AMBER:     { hex: '#FFB020', glow: '#ffc84d', symbol: '✕', name: 'Amber'     },
  LIME:      { hex: '#A6D930', glow: '#c5e85c', symbol: '≡', name: 'Lime'      },
  TEAL:      { hex: '#1BB3A5', glow: '#4dd0c5', symbol: '○', name: 'Teal'      },
  INDIGO:    { hex: '#4B4BD6', glow: '#7c7ce8', symbol: '≈', name: 'Indigo'    },
  MAGENTA:   { hex: '#D63384', glow: '#e566a4', symbol: '□', name: 'Magenta'   },
};

/* ---------- Tube helpers ---------- */
function cloneTubes(tubes) { return tubes.map(t => t.slice()); }

function tubeTop(tube) { return tube.length ? tube[tube.length - 1] : null; }

function tubeFreeSpace(tube) { return TUBE_CAPACITY - tube.length; }

function topBlockSize(tube) {
  if (!tube.length) return 0;
  const c = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === c) n++; else break;
  }
  return n;
}

function isTubeComplete(tube) {
  return tube.length === TUBE_CAPACITY && topBlockSize(tube) === TUBE_CAPACITY;
}

function getFusionResult(a, b) { return FUSION[a + '|' + b] || null; }

/* ========== POUR RULES ========== */
/**
 * Returns { type:'move'|'fuse'|'illegal', units, result? }
 */
function analyzePour(tubes, si, di) {
  if (si === di) return { type: 'illegal', units: 0 };
  const src = tubes[si], dst = tubes[di];
  if (!src.length) return { type: 'illegal', units: 0 };
  if (isTubeComplete(src)) return { type: 'illegal', units: 0 };

  const sTop = tubeTop(src);
  const dTop = tubeTop(dst);
  const free = tubeFreeSpace(dst);

  // A) empty or same colour
  if (!dst.length || dTop === sTop) {
    if (free <= 0) return { type: 'illegal', units: 0 };
    return { type: 'move', units: Math.min(topBlockSize(src), free) };
  }

  // B) fusion pair (tertiary inputs do not appear in FUSION, so return null)
  const fr = getFusionResult(sTop, dTop);
  if (fr) return { type: 'fuse', units: 1, result: fr };

  // C) illegal
  return { type: 'illegal', units: 0 };
}

/**
 * Execute a pour. Returns a result object or null if illegal.
 */
function executePour(tubes, si, di) {
  const a = analyzePour(tubes, si, di);
  if (a.type === 'illegal') return null;

  const nt = cloneTubes(tubes);

  if (a.type === 'move') {
    const color = tubeTop(nt[si]);
    for (let i = 0; i < a.units; i++) { nt[si].pop(); nt[di].push(color); }
    return { newTubes: nt, moveType: 'move', units: a.units, si, di, color };
  }

  // fuse
  const srcColor = tubeTop(nt[si]);
  const dstColor = tubeTop(nt[di]);
  nt[si].pop();
  nt[di][nt[di].length - 1] = a.result;
  return {
    newTubes: nt, moveType: 'fuse', units: 1, si, di,
    srcColor, dstColor, fusionResult: a.result,
  };
}

/* ========== WIN CHECK ========== */
function checkWin(tubes, target) {
  const finished = [];
  for (let i = 0; i < tubes.length; i++) {
    const t = tubes[i];
    if (!t.length) continue;
    if (t.length !== TUBE_CAPACITY) return false;
    const c0 = t[0];
    for (let j = 1; j < TUBE_CAPACITY; j++) {
      if (t[j] !== c0) return false;
    }
    finished.push(c0);
  }
  return arraysEqualSorted(finished, target);
}

function arraysEqualSorted(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.slice().sort(), sb = b.slice().sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

/* ========== STATE HASHING (normalised) ========== */
function hashState(tubes) {
  const parts = new Array(tubes.length);
  for (let i = 0; i < tubes.length; i++) parts[i] = tubes[i].join(',');
  parts.sort();
  return parts.join('|');
}

/* ========== SOLVER (BFS, packed 20-bit tube states, normalised hash) ========== */
function _encodeWinTarget(target) {
  const arr = new Int32Array(target.length);
  for (let i = 0; i < target.length; i++) arr[i] = _COLOR_TO_INT[target[i]] * 0x1111;
  arr.sort();
  return arr;
}

function _isEncodedWin(state, targetSortedRaw, targetCount, colsScratch) {
  let wi = 0;
  for (let i = 0; i < state.length; i++) {
    const v = state[i];
    if (v === 0) continue;
    if ((v >>> 16) !== TUBE_CAPACITY) return false;
    const raw = v & 0xFFFF;
    if (raw !== (raw & 15) * 0x1111) return false;
    if (wi >= targetCount) return false;
    colsScratch[wi++] = raw;
  }
  if (wi !== targetCount) return false;
  colsScratch.sort();
  for (let i = 0; i < targetCount; i++) {
    if (colsScratch[i] !== targetSortedRaw[i]) return false;
  }
  return true;
}

/** Check whether any legal pour exists in `tubes`. */
function hasLegalMove(tubes) {
  const n = tubes.length;
  for (let si = 0; si < n; si++) {
    for (let di = 0; di < n; di++) {
      if (si === di) continue;
      if (analyzePour(tubes, si, di).type !== 'illegal') return true;
    }
  }
  return false;
}

/**
 * Create an incremental BFS solver so both synchronous calls and
 * time-sliced main-thread checks share identical traversal & pruning.
 * Each tube is packed as `(len << 16) | c0 | (c1 << 4) | (c2 << 8) | (c3 << 12)`
 * with non-zero colour IDs `1..12` (valid for `TUBE_CAPACITY === 4`).
 *
 * `step(maxSliceNodes, maxSliceMs)` returns null while work remains, or:
 *   { status: 'solved',     moves, nodeCount }
 *   { status: 'unsolvable', moves: null, nodeCount }  (queue exhausted)
 *   { status: 'capped',     moves: null, nodeCount }  (nodeLimit reached)
 *   { status: 'timeout',    moves: null, nodeCount }  (timeLimitMs reached)
 */
function createChunkedSolver(tubes, target, nodeLimit, timeLimitMs) {
  if (nodeLimit === undefined) nodeLimit = 200000;
  if (timeLimitMs === undefined) timeLimitMs = 0;

  if (checkWin(tubes, target)) {
    const done = { status: 'solved', moves: [], nodeCount: 0 };
    return { step: () => done };
  }

  const n = tubes.length;
  const targetCount = target.length;
  const targetSortedRaw = _encodeWinTarget(target);
  const colsScratch = new Int32Array(targetCount);

  const initState = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const t = tubes[i];
    let v = (t.length << 16);
    for (let j = 0; j < t.length; j++) v |= (_COLOR_TO_INT[t[j]] << (j << 2));
    initState[i] = v;
  }

  // Reusable scratch buffer for insertion-sorting canonical 16-bit tube keys
  const tmp = new Array(n);
  function canonicalKey(arr, si, newSrc, di, newDst) {
    for (let i = 0; i < n; i++) tmp[i] = arr[i] & 0xFFFF;
    if (si >= 0) { tmp[si] = newSrc & 0xFFFF; tmp[di] = newDst & 0xFFFF; }
    for (let i = 1; i < n; i++) {
      const key = tmp[i];
      let j = i - 1;
      while (j >= 0 && tmp[j] > key) {
        tmp[j + 1] = tmp[j];
        j--;
      }
      tmp[j + 1] = key;
    }
    return String.fromCharCode.apply(null, tmp);
  }

  const visited = new Set();
  visited.add(canonicalKey(initState, -1, 0, -1, 0));

  const queue = [{ state: initState, parent: null, src: -1, dst: -1, type: null }];
  let head = 0, nodeCount = 0, totalWorkMs = 0;
  let result = null;

  function step(maxSliceNodes, maxSliceMs) {
    if (result) return result;
    const sliceLimit = maxSliceNodes > 0 ? maxSliceNodes : Infinity;
    const timed = (maxSliceMs > 0 || timeLimitMs > 0);
    const sliceStart = timed ? Date.now() : 0;
    let sliceNodes = 0;

    while (head < queue.length && nodeCount < nodeLimit && sliceNodes < sliceLimit) {
      if (timed && (sliceNodes & 63) === 63) {
        const sliceElapsed = Date.now() - sliceStart;
        if (maxSliceMs > 0 && sliceElapsed >= maxSliceMs) {
          totalWorkMs += sliceElapsed;
          if (timeLimitMs > 0 && totalWorkMs >= timeLimitMs) {
            result = { status: 'timeout', moves: null, nodeCount };
            return result;
          }
          return null; // yield slice cleanly without marking done
        }
        if (timeLimitMs > 0 && (totalWorkMs + sliceElapsed) >= timeLimitMs) {
          totalWorkMs += sliceElapsed;
          result = { status: 'timeout', moves: null, nodeCount };
          return result;
        }
      }

      const cur = queue[head++];
      nodeCount++;
      sliceNodes++;
      const cs = cur.state;

      for (let si = 0; si < n; si++) {
        const sv = cs[si];
        const sLen = sv >>> 16;
        if (sLen === 0) continue;

        const sShift = (sLen - 1) << 2;
        const sTop = (sv >>> sShift) & 15;
        let block = 1;
        for (let sh = sShift - 4; sh >= 0; sh -= 4) {
          if (((sv >>> sh) & 15) === sTop) block++; else break;
        }
        if (sLen === TUBE_CAPACITY && block === TUBE_CAPACITY) continue;

        const srcUniform = (block === sLen);
        let emptyUsedSrc = false;

        for (let di = 0; di < n; di++) {
          if (si === di) continue;
          const dv = cs[di];
          const dLen = dv >>> 16;

          let newSrc, newDst, moveType, newDstLen;

          if (dLen === 0) {
            if (emptyUsedSrc || srcUniform) continue;
            emptyUsedSrc = true;
            const remLen = sLen - block;
            const remSh = remLen << 2;
            newSrc = (remLen << 16) | (sv & ((1 << remSh) - 1));
            newDst = (block << 16) | ((sv & 0xFFFF) >>> remSh);
            newDstLen = block;
            moveType = 'move';
          } else {
            const dTop = (dv >>> ((dLen - 1) << 2)) & 15;
            if (dTop === sTop) {
              const free = TUBE_CAPACITY - dLen;
              if (free <= 0) continue;
              const u = block < free ? block : free;
              const remLen = sLen - u;
              const remSh = remLen << 2;
              const moved = ((sv & 0xFFFF) >>> remSh) & ((1 << (u << 2)) - 1);
              newSrc = (remLen << 16) | (sv & ((1 << remSh) - 1));
              newDst = ((dLen + u) << 16) | (dv & 0xFFFF) | (moved << (dLen << 2));
              newDstLen = dLen + u;
              moveType = 'move';
            } else {
              const fused = _INT_FUSION[(sTop << 4) | dTop];
              if (!fused) continue;
              const remLen = sLen - 1;
              const dstTopSh = (dLen - 1) << 2;
              newSrc = (remLen << 16) | (sv & ((1 << (remLen << 2)) - 1));
              newDst = (dLen << 16) | ((dv & 0xFFFF) & ~(15 << dstTopSh)) | (fused << dstTopSh);
              newDstLen = dLen;
              moveType = 'fuse';
            }
          }

          const h = canonicalKey(cs, si, newSrc, di, newDst);
          if (visited.has(h)) continue;
          visited.add(h);

          const nextState = cs.slice();
          nextState[si] = newSrc;
          nextState[di] = newDst;

          const node = { state: nextState, parent: cur, src: si, dst: di, type: moveType };
          const newSrcLen = newSrc >>> 16;
          if (newDstLen === TUBE_CAPACITY &&
              (newSrcLen === 0 || newSrcLen === TUBE_CAPACITY) &&
              _isEncodedWin(nextState, targetSortedRaw, targetCount, colsScratch)) {
            const moves = [];
            let p = node;
            while (p.parent) {
              moves.push({ src: p.src, dst: p.dst, type: p.type });
              p = p.parent;
            }
            moves.reverse();
            result = { status: 'solved', moves, nodeCount };
            return result;
          }

          queue.push(node);
        }
      }
    }

    if (timed) totalWorkMs += Date.now() - sliceStart;
    if (head >= queue.length) {
      result = { status: 'unsolvable', moves: null, nodeCount };
      return result;
    }
    if (nodeCount >= nodeLimit) {
      result = { status: 'capped', moves: null, nodeCount };
      return result;
    }
    if (timeLimitMs > 0 && totalWorkMs >= timeLimitMs) {
      result = { status: 'timeout', moves: null, nodeCount };
      return result;
    }
    return null; // yielded due to maxSliceNodes
  }

  return { step };
}

/**
 * Check solvability with explicit distinction between proven 'unsolvable'
 * and resource-limited 'timeout' / 'capped' (unknown).
 */
function checkSolvability(tubes, target, nodeLimit, timeLimitMs) {
  return createChunkedSolver(tubes, target, nodeLimit || 30000, timeLimitMs || 150)
    .step(Infinity, 0);
}

function solve(tubes, target, nodeLimit) {
  const res = createChunkedSolver(tubes, target, nodeLimit, 0).step(Infinity, 0);
  return res.status === 'solved' ? { moves: res.moves, nodeCount: res.nodeCount } : null;
}

/* ========== REPLAY VALIDATION ========== */
/**
 * Replay a list of forward moves from startTubes using real pour rules.
 * Returns { success: boolean, failedAt?: number }.
 */
function replayMoves(startTubes, moves, target) {
  let cur = cloneTubes(startTubes);
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const result = executePour(cur, m.src, m.dst);
    if (!result) return { success: false, failedAt: i };
    cur = result.newTubes;
  }
  return { success: checkWin(cur, target) };
}

/* ========== LEVEL GENERATION ========== */

function targetForLevel(levelNum, rng) {
  let count;
  if (levelNum <= 5)        count = 1;
  else if (levelNum <= 15)  count = 2;
  else if (levelNum <= 25)  count = 3;
  else if (levelNum <= 35)  count = 4;
  else if (levelNum <= 50)  count = 5;
  else if (levelNum <= 65)  count = 6;
  else if (levelNum <= 80)  count = 7;
  else if (levelNum <= 95)  count = 8;
  else if (levelNum <= 110) count = 9;
  else                      count = MAX_TARGETS;

  const target = [];
  const fusable = levelNum <= 10 ? SECONDARIES : [...SECONDARIES, ...TERTIARIES];
  const basicColors = [...PRIMARIES, ...SECONDARIES];

  for (let i = 0; i < count; i++) {
    if (levelNum <= 5 || i === 0) {
      // Guarantee at least one secondary (teach fusion)
      target.push(SECONDARIES[Math.floor(rng() * SECONDARIES.length)]);
    } else if (levelNum <= 10) {
      target.push(basicColors[Math.floor(rng() * basicColors.length)]);
    } else {
      target.push(fusable[Math.floor(rng() * fusable.length)]);
    }
  }
  return target;
}

function emptyTubesForLevel(levelNum, numTargets) {
  let empties;
  if (numTargets <= 2)       empties = 2;
  else if (numTargets === 3) empties = (levelNum % 3 === 0) ? 1 : 2;
  else if (numTargets <= 6)  empties = 2;
  else if (numTargets <= 8)  empties = 3;
  else                       empties = 4;

  // Enforce max 14 tubes total
  return Math.max(1, Math.min(empties, MAX_TUBES - numTargets));
}

function buildSolvedState(target, empties) {
  const tubes = target.map(c => [c, c, c, c]);
  for (let i = 0; i < empties; i++) tubes.push([]);
  return tubes;
}

function scrambleMoveCount(levelNum) {
  if (levelNum <= 2)  return 5;
  if (levelNum <= 5)  return 10;
  if (levelNum <= 10) return 18;
  if (levelNum <= 15) return 26;
  if (levelNum <= 25) return 32;
  if (levelNum <= 50) return 40;
  return 48 + Math.min(20, Math.floor((levelNum - 50) / 5));
}

/**
 * Scramble by applying strictly invertible reverse moves from the solved state,
 * recording the exact forward move list that solves the level.
 *
 * Every reverse move (S_after -> S_before) is constructed so that
 * executePour(S_before, forward.src, forward.dst) reproduces S_after identically.
 *
 * Returns { tubes, forwardMoves }.
 */
function scramble(tubes, numMoves, rng) {
  const cur = cloneTubes(tubes);
  const forwardMoves = [];
  const n = cur.length;

  // Keep a small amount of free space so players have room to pour at level start
  let totalFree = 0;
  for (let i = 0; i < n; i++) totalFree += tubeFreeSpace(cur[i]);
  const minKeepFree = totalFree >= 12 ? 3 : (totalFree >= 8 ? 2 : (totalFree >= 4 ? 1 : 0));

  let unfuseCount = 0;
  let lastSplitFrom = -1, lastSplitTo = -1;

  for (let m = 0; m < numMoves; m++) {
    const splitOpts = [];
    const unfuseOpts = [];

    for (let si = 0; si < n; si++) {
      const src = cur[si];
      if (!src.length) continue;

      const sTop = tubeTop(src);
      const block = topBlockSize(src);
      const srcFree = tubeFreeSpace(src);
      const revParents = REVERSE_FUSION[sTop];

      for (let di = 0; di < n; di++) {
        if (si === di) continue;
        const dst = cur[di];
        const dstFree = tubeFreeSpace(dst);
        if (dstFree <= 0) continue;

        // --- A) Reverse-pour (split u units of sTop from si to di) ---
        // Forward move will be: di -> si.
        const maxU = Math.min(block, dstFree);
        const dstTop = tubeTop(dst);
        // A4: if di already has sTop on top, forward di->si would pour all matching units
        // unless si was full (srcFree === 0 -> forward free space === u).
        const canMoveOntoDst = (dstTop !== sTop) || (srcFree === 0);

        if (canMoveOntoDst) {
          const dstUniformSame = dst.length > 0 && dst.every(c => c === sTop);

          for (let u = 1; u <= maxU; u++) {
            // A2: forward pour cannot stack sTop onto a different colour beneath
            if (u === block && src.length > block) continue;
            // Skip moving entire uniform tube into an empty tube (pure permutation no-op)
            if (!dst.length && u === src.length) continue;
            // A3: forward pour cannot start from a completed tube
            if ((dstUniformSame || !dst.length) && dst.length + u === TUBE_CAPACITY) continue;

            splitOpts.push({ t: 'split', si, di, u });
          }
        }

        // --- B) Reverse-fusion (split secondary/tertiary sTop into parents) ---
        // Forward move will be: di (send) -> si (keep).
        if (revParents) {
          const [p1, p2] = revParents;
          const dstAlmostFull = dst.length === TUBE_CAPACITY - 1;
          // B1: forward pour cannot start from a completed tube
          if (!(dstAlmostFull && dst.every(c => c === p2))) {
            unfuseOpts.push({ t: 'unfuse', si, di, keep: p1, send: p2 });
          }
          if (!(dstAlmostFull && dst.every(c => c === p1))) {
            unfuseOpts.push({ t: 'unfuse', si, di, keep: p2, send: p1 });
          }
        }
      }
    }

    // Filter out immediate back-and-forth split cancellation when alternatives exist
    let nonCancelSplits = splitOpts.filter(o => !(o.si === lastSplitTo && o.di === lastSplitFrom));
    if (!nonCancelSplits.length) nonCancelSplits = splitOpts;

    const allowUnfuseBySpace = totalFree > minKeepFree;
    let chosen = null;

    // On move 0, prefer splitting a full uniform tube first so smaller pieces
    // are available to unfuse without locking remaining layers underneath.
    const initialFullSplits = (m === 0)
      ? nonCancelSplits.filter(o => cur[o.si].length === TUBE_CAPACITY)
      : [];

    if (initialFullSplits.length) {
      chosen = initialFullSplits[Math.floor(rng() * initialFullSplits.length)];
    } else if (unfuseOpts.length && allowUnfuseBySpace) {
      // Ensure at least one fusion happens early once tubes are split, and ~40% unfuses overall
      const forceUnfuse = (unfuseCount === 0 && m >= 1);
      if (forceUnfuse || !nonCancelSplits.length || rng() < 0.4) {
        // Prefer unfusing tubes that are not full, so underlying layers stay accessible
        const partialUnfuses = unfuseOpts.filter(o => cur[o.si].length < TUBE_CAPACITY);
        const pool = partialUnfuses.length ? partialUnfuses : unfuseOpts;
        chosen = pool[Math.floor(rng() * pool.length)];
      } else {
        chosen = nonCancelSplits[Math.floor(rng() * nonCancelSplits.length)];
      }
    } else if (nonCancelSplits.length) {
      chosen = nonCancelSplits[Math.floor(rng() * nonCancelSplits.length)];
    } else if (unfuseOpts.length && totalFree > 0) {
      chosen = unfuseOpts[Math.floor(rng() * unfuseOpts.length)];
    }

    if (!chosen) break;

    if (chosen.t === 'split') {
      const c = tubeTop(cur[chosen.si]);
      for (let i = 0; i < chosen.u; i++) {
        cur[chosen.si].pop();
        cur[chosen.di].push(c);
      }
      forwardMoves.push({ src: chosen.di, dst: chosen.si });
      lastSplitFrom = chosen.si;
      lastSplitTo   = chosen.di;
    } else {
      cur[chosen.si].pop();
      cur[chosen.si].push(chosen.keep);
      cur[chosen.di].push(chosen.send);
      totalFree--;
      unfuseCount++;
      forwardMoves.push({ src: chosen.di, dst: chosen.si });
      lastSplitFrom = -1;
      lastSplitTo   = -1;
    }
  }

  forwardMoves.reverse();
  return { tubes: cur, forwardMoves };
}

/* Capped solver limit during level generation (deterministic, < 150ms on a phone) */
function _genSolveNodeLimit(numTargets) {
  if (numTargets <= 2) return 8000;
  if (numTargets === 3) return 1800;
  return 700;
}

/**
 * Generate a level. Deterministic for a given (levelNum, forcedSeed).
 * Uses progression.js getLevelConfig(levelNum) when available.
 * Returns { levelNum, seed, tubes, target, par, forwardMoves, config }.
 */
function generateLevel(levelNum, forcedSeed, opts) {
  const baseSeed = forcedSeed !== undefined ? forcedSeed : (levelNum * 31337 + 7919);
  const maxAttempts = 80;
  const quiet = opts && opts.quiet;
  const cfg = typeof getLevelConfig === 'function' ? getLevelConfig(levelNum) : null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = baseSeed + attempt;
    const rng  = mulberry32(seed);

    const target    = cfg ? cfg.targetColors.slice() : targetForLevel(levelNum, rng);
    const empties   = cfg ? cfg.emptyTubes : emptyTubesForLevel(levelNum, target.length);
    const solved    = buildSolvedState(target, empties);
    const nScramble = cfg ? cfg.scrambleDepth : scrambleMoveCount(levelNum);
    const { tubes: scrambled, forwardMoves } = scramble(solved, nScramble, rng);

    if (checkWin(scrambled, target)) continue;           // already solved

    // VALIDATE by replaying the recorded forward moves
    const replay = replayMoves(scrambled, forwardMoves, target);
    if (!replay.success) continue;                       // regenerate with seed+1

    // par = length of recorded solution (upper bound)
    let par = forwardMoves.length;

    // For <= 5 targets, also run capped BFS solver and use shorter par if it finishes
    if (target.length <= 5) {
      const solution = solve(scrambled, target, _genSolveNodeLimit(target.length));
      if (solution && solution.moves.length < par) {
        par = solution.moves.length;
      }
    }

    // Reject trivially short puzzles
    if (par < 3) continue;

    // For very early levels, reject too-long solutions
    if (levelNum <= 3 && par > 12) continue;

    if (!quiet) {
      console.log(
        'Level ' + levelNum +
        (cfg ? ' (' + cfg.realmName + ')' : '') +
        ': seed=' + seed + ', par=' + par + ', targets=' + target.length
      );
    }
    return { levelNum, seed, tubes: scrambled, target, par, forwardMoves, config: cfg };
  }

  // Fallback preserving config target count/colors and replay validation
  if (!quiet) {
    console.warn('Level ' + levelNum + ': fallback after ' + maxAttempts + ' attempts');
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const seed   = baseSeed + maxAttempts + attempt;
    const rng    = mulberry32(seed);
    const target = cfg ? cfg.targetColors.slice() : targetForLevel(levelNum, rng);
    const empties = cfg ? cfg.emptyTubes : emptyTubesForLevel(levelNum, target.length);
    const solved = buildSolvedState(target, empties);
    const { tubes: sc, forwardMoves } = scramble(solved, Math.max(6, target.length * 4), rng);
    if (checkWin(sc, target)) continue;
    const replay = replayMoves(sc, forwardMoves, target);
    if (!replay.success) continue;
    let par = forwardMoves.length;
    if (target.length <= 5) {
      const sol = solve(sc, target, _genSolveNodeLimit(target.length));
      if (sol && sol.moves.length < par) par = sol.moves.length;
    }
    return { levelNum, seed, tubes: sc, target, par: Math.max(par, 1), forwardMoves, config: cfg };
  }

  // Last-resort deterministic valid state
  const rng = mulberry32(baseSeed);
  const target = cfg ? cfg.targetColors.slice() : targetForLevel(levelNum, rng);
  const empties = cfg ? cfg.emptyTubes : emptyTubesForLevel(levelNum, target.length);
  const solved = buildSolvedState(target, empties);
  const { tubes: sc, forwardMoves } = scramble(solved, 4, rng);
  return {
    levelNum, seed: baseSeed, tubes: sc, target,
    par: Math.max(forwardMoves.length, 1), forwardMoves, config: cfg,
  };
}


/* ============================================================
   Daily Puzzle, Challenge Codes, Hints
   ============================================================ */

/* ---------- Daily puzzle ---------- */
const _DAILY_EPOCH = new Date(2024, 0, 1).getTime();

function getDayNumber(date) {
  const d = date || new Date();
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((local.getTime() - _DAILY_EPOCH) / 86400000);
}

function getDailySeed(date) {
  const d = date || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function generateDailyLevel(date) {
  const seed   = getDailySeed(date);
  const dayNum = getDayNumber(date);
  const pool   = [...SECONDARIES, ...TERTIARIES];

  for (let attempt = 0; attempt < 80; attempt++) {
    const s   = seed + attempt;
    const rng = mulberry32(s);

    // Medium difficulty: 2 target colours, may include tertiaries
    const target = [
      SECONDARIES[Math.floor(rng() * SECONDARIES.length)],
      pool[Math.floor(rng() * pool.length)],
    ];
    const solved = buildSolvedState(target, 2);
    const { tubes: scrambled, forwardMoves } = scramble(solved, 20, rng);

    if (checkWin(scrambled, target)) continue;

    // Validate by replay
    const replay = replayMoves(scrambled, forwardMoves, target);
    if (!replay.success) continue;

    let par = forwardMoves.length;
    const solution = solve(scrambled, target, _genSolveNodeLimit(target.length));
    if (solution && solution.moves.length < par) par = solution.moves.length;
    if (par < 5) continue;

    console.log(
      'Daily #' + dayNum + ': seed=' + s +
      ', par=' + par
    );
    return {
      dayNum, seed: s, tubes: scrambled, target,
      par, isDaily: true, forwardMoves,
    };
  }
  // fallback
  const fb = generateLevel(10, seed);
  fb.dayNum  = dayNum;
  fb.isDaily = true;
  return fb;
}

/* ---------- Challenge codes (base-32 with checksum, supports 1-10 targets) ---------- */
const _CODE_ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function encodeChallenge(seed, difficulty) {
  var diff = Math.max(1, Math.min(MAX_TARGETS, difficulty || 1));
  var val = seed * 16 + (diff - 1);
  var chars = [];
  do {
    chars.push(_CODE_ALPHA[val % 32]);
    val = Math.floor(val / 32);
  } while (val > 0);
  chars.reverse();
  var sum = 0;
  for (var i = 0; i < chars.length; i++) sum += _CODE_ALPHA.indexOf(chars[i]);
  chars.push(_CODE_ALPHA[sum % 32]);
  return 'HP-' + chars.join('');
}

function decodeChallenge(code) {
  var clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 4 || clean.slice(0, 2) !== 'HP') return null;
  var payload = clean.slice(2);
  if (payload.length < 2) return null;

  var checkChar = payload[payload.length - 1];
  var data      = payload.slice(0, payload.length - 1);

  var sum = 0;
  for (var i = 0; i < data.length; i++) {
    var idx = _CODE_ALPHA.indexOf(data[i]);
    if (idx < 0) return null;
    sum += idx;
  }
  if (_CODE_ALPHA[sum % 32] !== checkChar) return null;

  var val = 0;
  for (var i = 0; i < data.length; i++) {
    val = val * 32 + _CODE_ALPHA.indexOf(data[i]);
  }
  var difficulty = (val % 16) + 1;
  var seed       = Math.floor(val / 16);
  if (difficulty > MAX_TARGETS) return null;
  return { seed: seed, difficulty: difficulty };
}

function generateChallengeLevel(seed, difficulty) {
  var numT = Math.max(1, Math.min(MAX_TARGETS, difficulty));
  var pool = [...SECONDARIES, ...TERTIARIES];
  for (var attempt = 0; attempt < 80; attempt++) {
    var s   = seed + attempt;
    var rng = mulberry32(s);
    var target = [];
    for (var i = 0; i < numT; i++) {
      target.push(
        i === 0
          ? SECONDARIES[Math.floor(rng() * SECONDARIES.length)]
          : pool[Math.floor(rng() * pool.length)]
      );
    }
    var empties  = emptyTubesForLevel(numT * 10 + (attempt % 2), numT);
    var solved   = buildSolvedState(target, empties);
    var nMoves   = numT === 1 ? 10 : (numT === 2 ? 20 : Math.min(55, 22 + numT * 4));
    var result   = scramble(solved, nMoves, rng);
    var scrambled = result.tubes;
    var forwardMoves = result.forwardMoves;
    if (checkWin(scrambled, target)) continue;

    var replay = replayMoves(scrambled, forwardMoves, target);
    if (!replay.success) continue;

    var par = forwardMoves.length;
    if (numT <= 5) {
      var solution = solve(scrambled, target, _genSolveNodeLimit(numT));
      if (solution && solution.moves.length < par) par = solution.moves.length;
    }
    if (par < 3) continue;

    console.log(
      'Challenge seed=' + s + ' diff=' + numT +
      ', par=' + par
    );
    return {
      seed: s, difficulty: numT, tubes: scrambled, target,
      par, isChallenge: true, forwardMoves,
    };
  }
  return null;
}

/* ---------- Hint (solver optimal move, with fallback for large levels) ---------- */
function getHint(tubes, target, hintPlan) {
  var limit = tubes.length <= 7 ? 30000 : 8000;
  var solution = solve(tubes, target, limit);
  if (solution && solution.moves.length) return solution.moves[0];

  // If player is still on the recorded forward solution path, return next move
  if (hintPlan && hintPlan.initialTubes && hintPlan.forwardMoves) {
    var curHash = hashState(tubes);
    var sim = cloneTubes(hintPlan.initialTubes);
    for (var i = 0; i < hintPlan.forwardMoves.length; i++) {
      if (hashState(sim) === curHash && JSON.stringify(sim) === JSON.stringify(tubes)) {
        var fm = hintPlan.forwardMoves[i];
        var chk = analyzePour(tubes, fm.src, fm.dst);
        if (chk.type !== 'illegal') return { src: fm.src, dst: fm.dst, type: chk.type };
      }
      var step = executePour(sim, hintPlan.forwardMoves[i].src, hintPlan.forwardMoves[i].dst);
      if (!step) break;
      sim = step.newTubes;
    }
  }

  // Greedy heuristic fallback so large boards always return a valid non-trivial hint
  var bestMove = null;
  var bestScore = -1;
  var targetSet = {};
  for (var t = 0; t < target.length; t++) targetSet[target[t]] = true;

  for (var si = 0; si < tubes.length; si++) {
    if (!tubes[si].length || isTubeComplete(tubes[si])) continue;
    var srcUniform = topBlockSize(tubes[si]) === tubes[si].length;
    for (var di = 0; di < tubes.length; di++) {
      if (si === di) continue;
      if (!tubes[di].length && srcUniform) continue;
      var a = analyzePour(tubes, si, di);
      if (a.type === 'illegal') continue;

      var score = 0;
      if (a.type === 'fuse') {
        score = targetSet[a.result] ? 100 : 70;
      } else if (tubes[di].length) {
        score = 50 + a.units;
      } else {
        score = 10;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = { src: si, dst: di, type: a.type };
      }
    }
  }
  return bestMove;
}

/* ---------- Colour emoji for sharing ---------- */
const COLOR_EMOJI = {
  RED:       '\u{1F7E5}', YELLOW:    '\u{1F7E8}', BLUE:      '\u{1F7E6}',
  ORANGE:    '\u{1F7E7}', GREEN:     '\u{1F7E9}', PURPLE:    '\u{1F7EA}',
  VERMILION: '\u{1F534}', AMBER:     '\u{1F7E1}', LIME:      '\u{1F7E2}',
  TEAL:      '\u{1F535}', INDIGO:    '\u{1F7E3}', MAGENTA:   '\u{1F49C}',
};
