// ============================================================
// HUE POUR — Game Logic  (pure functions, no UI dependencies)
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

/* ---------- Colour constants ---------- */
const Color = Object.freeze({
  RED: 'RED',
  YELLOW: 'YELLOW',
  BLUE: 'BLUE',
  ORANGE: 'ORANGE',
  GREEN: 'GREEN',
  PURPLE: 'PURPLE',
});

const PRIMARIES   = [Color.RED, Color.YELLOW, Color.BLUE];
const SECONDARIES = [Color.ORANGE, Color.GREEN, Color.PURPLE];
const ALL_COLORS  = [...PRIMARIES, ...SECONDARIES];

const TUBE_CAPACITY = 4;

/* Fusion look-up (both orderings) */
const FUSION = {};
function _addFusion(a, b, r) { FUSION[a + '|' + b] = r; FUSION[b + '|' + a] = r; }
_addFusion(Color.RED,    Color.YELLOW, Color.ORANGE);
_addFusion(Color.YELLOW, Color.BLUE,   Color.GREEN);
_addFusion(Color.RED,    Color.BLUE,   Color.PURPLE);

/* Reverse fusion: secondary → [primaryA, primaryB] */
const REVERSE_FUSION = {};
REVERSE_FUSION[Color.ORANGE] = [Color.RED, Color.YELLOW];
REVERSE_FUSION[Color.GREEN]  = [Color.YELLOW, Color.BLUE];
REVERSE_FUSION[Color.PURPLE] = [Color.RED, Color.BLUE];

/* Display info used by the UI layer */
const COLOR_INFO = {
  RED:    { hex: '#E53935', glow: '#ff5252', symbol: '●', name: 'Red' },
  YELLOW: { hex: '#FDD835', glow: '#ffff00', symbol: '▲', name: 'Yellow' },
  BLUE:   { hex: '#1E88E5', glow: '#448aff', symbol: '■', name: 'Blue' },
  ORANGE: { hex: '#FB8C00', glow: '#ffab40', symbol: '◆', name: 'Orange' },
  GREEN:  { hex: '#43A047', glow: '#69f0ae', symbol: '★', name: 'Green' },
  PURPLE: { hex: '#8E24AA', glow: '#ea80fc', symbol: '✚', name: 'Purple' },
};

/* ---------- Tube helpers ---------- */
function cloneTubes(tubes) { return tubes.map(t => t.slice()); }

function tubeTop(tube) { return tube.length ? tube[tube.length - 1] : null; }

function tubeFreeSpace(tube) { return TUBE_CAPACITY - tube.length; }

/** How many consecutive same-colour units on top. */
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

/* ---------- Pour analysis ---------- */
/**
 * Returns { type:'move'|'fuse'|'illegal', units, result? }
 */
function analyzePour(tubes, si, di) {
  if (si === di) return { type: 'illegal', units: 0 };
  const src = tubes[si], dst = tubes[di];
  if (!src.length) return { type: 'illegal', units: 0 };
  // Cannot pour from a completed (full + single colour) tube
  if (isTubeComplete(src)) return { type: 'illegal', units: 0 };

  const sTop = tubeTop(src);
  const dTop = tubeTop(dst);
  const free = tubeFreeSpace(dst);

  // A) empty or same colour
  if (!dst.length || dTop === sTop) {
    if (free <= 0) return { type: 'illegal', units: 0 };
    return { type: 'move', units: Math.min(topBlockSize(src), free) };
  }

  // B) fusion pair
  const fr = getFusionResult(sTop, dTop);
  if (fr) return { type: 'fuse', units: 1, result: fr };

  // C) illegal
  return { type: 'illegal', units: 0 };
}

/**
 * Execute a pour.  Returns a result object or null if illegal.
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

/* ---------- Win check ---------- */
/**
 * target is an array of colour names, e.g. ['ORANGE','ORANGE','GREEN'].
 */
function checkWin(tubes, target) {
  const finished = [];
  for (const t of tubes) {
    if (!t.length) continue;                         // empty ok
    if (t.length !== TUBE_CAPACITY) return false;    // not full
    if (!t.every(c => c === t[0])) return false;     // mixed
    finished.push(t[0]);
  }
  return arraysEqualSorted(finished, target);
}

function arraysEqualSorted(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.slice().sort(), sb = b.slice().sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

/* ---------- State hashing (normalised) ---------- */
function hashState(tubes) {
  return tubes.map(t => t.join(',')).sort().join('|');
}

/* ---------- Solver  (BFS, normalised hash) ---------- */
function solve(tubes, target, nodeLimit) {
  if (nodeLimit === undefined) nodeLimit = 200000;

  if (checkWin(tubes, target)) return { moves: [], nodeCount: 0 };

  const visited = new Set();
  visited.add(hashState(tubes));

  const queue = [{ tubes: tubes, moves: [] }];
  let head = 0, nodeCount = 0;

  while (head < queue.length && nodeCount < nodeLimit) {
    const cur = queue[head++];
    nodeCount++;
    const ct = cur.tubes;
    const n = ct.length;

    // track first empty index to avoid duplicate empty-tube pours
    let firstEmpty = -1;

    for (let si = 0; si < n; si++) {
      if (!ct[si].length) continue;
      // skip pouring from a completed tube that matches a target colour
      if (isTubeComplete(ct[si])) continue;

      let emptyUsed = false;
      for (let di = 0; di < n; di++) {
        if (si === di) continue;

        // optimisation: only pour into the FIRST empty tube
        if (!ct[di].length) {
          if (emptyUsed) continue;
          // don't move an entire uniform tube to an empty one
          if (topBlockSize(ct[si]) === ct[si].length) continue;
          emptyUsed = true;
        }

        const res = executePour(ct, si, di);
        if (!res) continue;

        const h = hashState(res.newTubes);
        if (visited.has(h)) continue;
        visited.add(h);

        const moves = cur.moves.concat({ src: si, dst: di, type: res.moveType });
        if (checkWin(res.newTubes, target)) return { moves, nodeCount };

        queue.push({ tubes: res.newTubes, moves });
      }
    }
  }
  return null;
}

/* ---------- Level generation ---------- */

function targetForLevel(levelNum, rng) {
  let count;
  if (levelNum <= 5)       count = 1;
  else if (levelNum <= 15) count = 2;
  else                     count = 3;

  const target = [];
  for (let i = 0; i < count; i++) {
    if (levelNum <= 5 || i === 0) {
      // guarantee at least one secondary to teach fusion
      target.push(SECONDARIES[Math.floor(rng() * SECONDARIES.length)]);
    } else {
      target.push(ALL_COLORS[Math.floor(rng() * ALL_COLORS.length)]);
    }
  }
  return target;
}

function emptyTubesForLevel(levelNum, numTargets) {
  if (levelNum <= 15) return 2;
  return (numTargets >= 3 && levelNum % 3 === 0) ? 1 : 2;
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
  if (levelNum <= 15) return 28;
  return 35 + Math.floor(levelNum / 4);
}

/** Apply random reverse moves to the solved state. */
function scramble(tubes, moves, rng) {
  let cur = cloneTubes(tubes);
  for (let m = 0; m < moves; m++) {
    const opts = [];

    for (let si = 0; si < cur.length; si++) {
      if (!cur[si].length) continue;
      for (let di = 0; di < cur.length; di++) {
        if (si === di) continue;
        const free = tubeFreeSpace(cur[di]);
        if (free <= 0) continue;

        // reverse-move: shift units
        const block = topBlockSize(cur[si]);
        for (let u = 1; u <= Math.min(block, free); u++) {
          opts.push({ t: 'split', si, di, u });
        }

        // reverse-fuse: split a secondary
        const top = tubeTop(cur[si]);
        if (REVERSE_FUSION[top]) {
          const [p1, p2] = REVERSE_FUSION[top];
          opts.push({ t: 'unfuse', si, di, keep: p1, send: p2 });
          opts.push({ t: 'unfuse', si, di, keep: p2, send: p1 });
        }
      }
    }

    if (!opts.length) break;
    const o = opts[Math.floor(rng() * opts.length)];

    if (o.t === 'split') {
      const c = tubeTop(cur[o.si]);
      for (let i = 0; i < o.u; i++) { cur[o.si].pop(); cur[o.di].push(c); }
    } else {
      cur[o.si].pop();
      cur[o.si].push(o.keep);
      cur[o.di].push(o.send);
    }
  }
  return cur;
}

/**
 * Generate a level.  Deterministic for a given (levelNum, forcedSeed).
 * Returns { levelNum, seed, tubes, target, par, solverNodeCount }.
 */
function generateLevel(levelNum, forcedSeed) {
  const baseSeed = forcedSeed !== undefined ? forcedSeed : (levelNum * 31337 + 7919);
  const maxAttempts = 80;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = baseSeed + attempt;
    const rng  = mulberry32(seed);

    const target   = targetForLevel(levelNum, rng);
    const empties  = emptyTubesForLevel(levelNum, target.length);
    const solved   = buildSolvedState(target, empties);
    const nScramble = scrambleMoveCount(levelNum);
    const scrambled = scramble(solved, nScramble, rng);

    if (checkWin(scrambled, target)) continue;           // already solved

    const solution = solve(scrambled, target);
    if (!solution) continue;                             // unsolvable

    // Reject trivially short puzzles (not interesting)
    if (solution.moves.length < 3) continue;

    // For very early levels, reject solutions that are too long
    if (levelNum <= 3 && solution.moves.length > 12) continue;

    const par = solution.moves.length;
    console.log(
      'Level ' + levelNum + ': seed=' + seed +
      ', par=' + par + ', solver nodes=' + solution.nodeCount
    );
    return { levelNum, seed, tubes: scrambled, target, par,
             solverNodeCount: solution.nodeCount };
  }

  // fallback — trivial puzzle
  console.warn('Level ' + levelNum + ': fallback after ' + maxAttempts + ' attempts');
  const rng    = mulberry32(baseSeed);
  const target = [SECONDARIES[levelNum % 3]];
  const solved = buildSolvedState(target, 2);
  const sc     = scramble(solved, 4, rng);
  const sol    = solve(sc, target);
  return {
    levelNum, seed: baseSeed, tubes: sc, target,
    par: sol ? sol.moves.length : 10,
    solverNodeCount: sol ? sol.nodeCount : 0,
  };
}


/* ============================================================
   NEW: Daily Puzzle, Challenge Codes, Hints
   ============================================================ */

/* ---------- Daily puzzle ---------- */
const _DAILY_EPOCH = new Date(2024, 0, 1).getTime(); // Jan 1 2024

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

  for (let attempt = 0; attempt < 80; attempt++) {
    const s   = seed + attempt;
    const rng = mulberry32(s);

    // Medium difficulty: 2 target colours
    const target = [
      SECONDARIES[Math.floor(rng() * SECONDARIES.length)],
      ALL_COLORS[Math.floor(rng() * ALL_COLORS.length)],
    ];
    const solved    = buildSolvedState(target, 2);
    const scrambled = scramble(solved, 20, rng);

    if (checkWin(scrambled, target)) continue;
    const solution = solve(scrambled, target);
    if (!solution) continue;
    if (solution.moves.length < 5) continue;

    console.log(
      'Daily #' + dayNum + ': seed=' + s +
      ', par=' + solution.moves.length + ', nodes=' + solution.nodeCount
    );
    return {
      dayNum, seed: s, tubes: scrambled, target,
      par: solution.moves.length, isDaily: true,
    };
  }
  // fallback
  const fb = generateLevel(10, seed);
  fb.dayNum  = dayNum;
  fb.isDaily = true;
  return fb;
}

/* ---------- Challenge codes (base-32 with checksum) ---------- */
const _CODE_ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 chars, no 0/1/I/O

function encodeChallenge(seed, difficulty) {
  var val = seed * 4 + Math.max(0, Math.min(3, (difficulty || 1) - 1));
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
  var difficulty = (val % 4) + 1;
  var seed       = Math.floor(val / 4);
  if (difficulty > 3) return null;
  return { seed: seed, difficulty: difficulty };
}

function generateChallengeLevel(seed, difficulty) {
  var numT = Math.max(1, Math.min(3, difficulty));
  for (var attempt = 0; attempt < 80; attempt++) {
    var s   = seed + attempt;
    var rng = mulberry32(s);
    var target = [];
    for (var i = 0; i < numT; i++) {
      target.push(
        i === 0
          ? SECONDARIES[Math.floor(rng() * SECONDARIES.length)]
          : ALL_COLORS[Math.floor(rng() * ALL_COLORS.length)]
      );
    }
    var empties  = numT <= 2 ? 2 : (rng() > 0.3 ? 2 : 1);
    var solved   = buildSolvedState(target, empties);
    var nMoves   = numT === 1 ? 10 : (numT === 2 ? 20 : 35);
    var scrambled = scramble(solved, nMoves, rng);
    if (checkWin(scrambled, target)) continue;
    var solution = solve(scrambled, target);
    if (!solution) continue;
    if (solution.moves.length < 3) continue;

    console.log(
      'Challenge seed=' + s + ' diff=' + numT +
      ', par=' + solution.moves.length + ', nodes=' + solution.nodeCount
    );
    return {
      seed: s, difficulty: numT, tubes: scrambled, target,
      par: solution.moves.length, isChallenge: true,
    };
  }
  return null;
}

/* ---------- Hint (first move of optimal solution) ---------- */
function getHint(tubes, target) {
  var solution = solve(tubes, target, 50000);
  if (!solution || !solution.moves.length) return null;
  return solution.moves[0]; // { src, dst, type }
}

/* ---------- Colour emoji for sharing ---------- */
const COLOR_EMOJI = {
  RED: '\u{1F7E5}', YELLOW: '\u{1F7E8}', BLUE: '\u{1F7E6}',
  ORANGE: '\u{1F7E7}', GREEN: '\u{1F7E9}', PURPLE: '\u{1F7EA}',
};
