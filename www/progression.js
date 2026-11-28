// ============================================================
// HUE POUR — Progression & Realm Configuration (data-driven)
// No DOM dependencies; works standalone or alongside game.js.
// ============================================================
'use strict';

const PROGRESSION_REALMS = Object.freeze([
  { index: 1,  name: 'Sunrise Meadow',   start: 1,   end: 15,  minScramble: 10, maxScramble: 18 },
  { index: 2,  name: 'Whispering Grove', start: 16,  end: 30,  minScramble: 16, maxScramble: 26 },
  { index: 3,  name: 'Crystal Caverns',  start: 31,  end: 50,  minScramble: 22, maxScramble: 36 },
  { index: 4,  name: 'Desert Oasis',     start: 51,  end: 75,  minScramble: 26, maxScramble: 44 },
  { index: 5,  name: 'Neon Metropolis',  start: 76,  end: 100, minScramble: 31, maxScramble: 52 },
  { index: 6,  name: 'Starlit Cosmos',   start: 101, end: 125, minScramble: 36, maxScramble: 60 },
  { index: 7,  name: 'Sunken Kingdom',   start: 126, end: 150, minScramble: 41, maxScramble: 68 },
  { index: 8,  name: 'Candy Cloudland',  start: 151, end: 175, minScramble: 46, maxScramble: 76 },
  { index: 9,  name: 'Aurora Summit',    start: 176, end: 200, minScramble: 52, maxScramble: 86 },
  { index: 10, name: 'Endless Spectrum', start: 201, end: Infinity, minScramble: 54, maxScramble: 90 },
]);

const getLevelConfig = (() => {
  const BASE_COLORS = ['RED', 'YELLOW', 'BLUE', 'ORANGE', 'GREEN', 'PURPLE'];
  const SECONDARIES = ['ORANGE', 'GREEN', 'PURPLE'];
  const TERTIARIES  = ['VERMILION', 'AMBER', 'LIME', 'TEAL', 'INDIGO', 'MAGENTA'];
  const FULL_COLORS = BASE_COLORS.concat(TERTIARIES);

  const TERTIARY_HINTS = {
    VERMILION: 'New hue: Vermilion! Pour Red onto Orange (or vice versa) to blend it.',
    AMBER:     'New hue: Amber! Blend Yellow + Orange to craft Amber.',
    LIME:      'New hue: Lime! Blend Yellow + Green to craft Lime.',
    TEAL:      'New hue: Teal! Blend Blue + Green to craft Teal.',
    INDIGO:    'New hue: Indigo! Blend Blue + Purple to craft Indigo.',
    MAGENTA:   'New hue: Magenta! Blend Red + Purple to craft Magenta.',
  };

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function sameMultiset(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    const sa = a.slice().sort(), sb = b.slice().sort();
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  }

  function countMap(arr) {
    const m = {};
    for (let i = 0; i < arr.length; i++) m[arr[i]] = (m[arr[i]] || 0) + 1;
    return m;
  }

  function multisetOverlap(a, b) {
    if (!a || !b) return 0;
    const ma = countMap(a), mb = countMap(b);
    let shared = 0;
    for (const k in ma) {
      if (mb[k]) shared += Math.min(ma[k], mb[k]);
    }
    return shared;
  }

  function distinctOverlap(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a), setB = new Set(b);
    let shared = 0;
    for (const k of setA) if (setB.has(k)) shared++;
    return shared;
  }

  function getRealm(levelNumber) {
    for (let i = 0; i < PROGRESSION_REALMS.length; i++) {
      const r = PROGRESSION_REALMS[i];
      if (levelNumber >= r.start && levelNumber <= r.end) return r;
    }
    return PROGRESSION_REALMS[PROGRESSION_REALMS.length - 1];
  }

  function targetsForLevel(realm, levelNumber) {
    switch (realm.index) {
      case 1: return levelNumber <= 5 ? 1 : 2;
      case 2: return 3;
      case 3: return 4;
      case 4: return 4;
      case 5: return 5;
      case 6: return 6;
      case 7: return 7;
      case 8: return 8;
      case 9: return (levelNumber === 190 || levelNumber === 195 || levelNumber === 200) ? 10 : 9;
      case 10: {
        const posInWave = (levelNumber - 201) % 25;
        return 6 + Math.floor(posInWave / 5); // cycles 6, 7, 8, 9, 10 across 25-level waves
      }
      default: return 6;
    }
  }

  function poolForRealm(realm) {
    return realm.index <= 3 ? BASE_COLORS.slice() : FULL_COLORS.slice();
  }

  /**
   * Build target quotas across a block of levels so every colour in `pool`
   * appears evenly (counts differ by at most 1).
   */
  function buildQuotas(pool, totalSlots, rng, realmIndex) {
    const quota = {};
    if (realmIndex === 4) {
      // 100 slots (25 * 4): 50 tertiary + 50 base so each of the 12 colours appears 8 or 9 times
      const half = Math.floor(totalSlots / 2);
      const tOrder = shuffle(TERTIARIES, rng);
      const bOrder = shuffle(BASE_COLORS, rng);
      const tBase = Math.floor(half / TERTIARIES.length);
      const tRem  = half % TERTIARIES.length;
      for (let i = 0; i < TERTIARIES.length; i++) quota[TERTIARIES[i]] = tBase;
      for (let i = 0; i < tRem; i++) quota[tOrder[i]]++;

      const bSlots = totalSlots - half;
      const bBase = Math.floor(bSlots / BASE_COLORS.length);
      const bRem  = bSlots % BASE_COLORS.length;
      for (let i = 0; i < BASE_COLORS.length; i++) quota[BASE_COLORS[i]] = bBase;
      for (let i = 0; i < bRem; i++) quota[bOrder[i]]++;
      return quota;
    }

    const base = Math.floor(totalSlots / pool.length);
    const rem  = totalSlots % pool.length;
    for (let i = 0; i < pool.length; i++) quota[pool[i]] = base;
    // In Realm 1, give any extra slot (+1) to a secondary since levels 1-5 use secondaries
    const extraOrder = realmIndex === 1
      ? shuffle(SECONDARIES, rng).concat(shuffle(['RED', 'YELLOW', 'BLUE'], rng))
      : shuffle(pool, rng);
    for (let i = 0; i < rem; i++) quota[extraOrder[i]]++;
    return quota;
  }

  /**
   * Dedicated selector for 9-10 target levels (12-colour pool).
   * Keeps distinct colours <= 7 so the next level always has >= 5 fresh colours,
   * shares <= floor(n/2) colours, and stays tightly balanced with remaining quotas.
   */
  function pickLargeLevelColors(n, quota, prevColors, rng, isBlockLast) {
    const maxOverlap = Math.floor(n / 2); // 4 for n=9, 5 for n=10
    const prevSet = new Set(prevColors || []);
    const prevPool = shuffle(Object.keys(quota).filter(c => prevSet.has(c) && quota[c] > 0), rng)
      .sort((a, b) => quota[b] - quota[a]);
    const freshPool = shuffle(Object.keys(quota).filter(c => !prevSet.has(c) && quota[c] > 0), rng)
      .sort((a, b) => quota[b] - quota[a]);

    const needFresh = n - maxOverlap; // 5 for both n=9 and n=10
    const freshAvail = freshPool.reduce((s, c) => s + quota[c], 0);
    const prevAvail  = prevPool.reduce((s, c) => s + quota[c], 0);
    if (freshAvail < needFresh || freshAvail + prevAvail < n) return null;

    const chosen = [];
    const localQ = Object.assign({}, quota);

    // Choose how many slots to take from freshPool vs prevPool:
    // keep between needFresh and min(freshAvail, n), balancing average remaining quota.
    const minShared = Math.max(0, n - freshAvail);
    const maxShared = Math.min(maxOverlap, prevAvail);
    let sharedSlots = minShared;
    if (maxShared > minShared) {
      // Pick sharedSlots to draw down higher-quota prev colours without starving freshPool
      const avgFresh = freshPool.length ? freshAvail / freshPool.length : 0;
      const avgPrev  = prevPool.length ? prevAvail / prevPool.length : 0;
      sharedSlots = avgPrev >= avgFresh
        ? maxShared
        : Math.max(minShared, Math.min(maxShared, Math.floor(maxShared / 2) + (rng() < 0.5 ? 1 : 0)));
    }

    // Use top 2-4 highest-quota prev colours for sharedSlots (keeping distinct <= 7 when not last, <= 9 on last)
    const freshSlots = n - sharedSlots;
    const maxDistinctTotal = isBlockLast ? 9 : 7;
    const maxSharedDistinct = Math.max(1, Math.min(prevPool.length, maxDistinctTotal - Math.min(freshPool.length, freshSlots)));
    const sharedCands = prevPool.slice(0, Math.min(prevPool.length, Math.max(2, maxSharedDistinct)));

    // If those sharedCands don't have enough quota for sharedSlots, allow more prevPool colours
    let scSum = sharedCands.reduce((s, c) => s + localQ[c], 0);
    for (let idx = sharedCands.length; scSum < sharedSlots && idx < prevPool.length; idx++) {
      sharedCands.push(prevPool[idx]);
      scSum += localQ[prevPool[idx]];
    }

    for (let s = 0; s < sharedSlots; s++) {
      sharedCands.sort((a, b) => (localQ[b] + rng() * 0.2) - (localQ[a] + rng() * 0.2));
      const pick = sharedCands.find(c => localQ[c] > 0);
      if (!pick) break;
      chosen.push(pick);
      localQ[pick]--;
    }

    // Fill remaining slots from freshPool, favouring highest-quota colours and staying <= maxDistinctTotal
    const distinctUsedSoFar = new Set(chosen).size;
    const freshDistinctBudget = Math.max(1, maxDistinctTotal - distinctUsedSoFar);
    const activeFresh = freshPool.slice(0, Math.min(freshPool.length, freshDistinctBudget));

    while (chosen.length < n) {
      activeFresh.sort((a, b) => (localQ[b] + rng() * 0.2) - (localQ[a] + rng() * 0.2));
      let pick = activeFresh.find(c => localQ[c] > 0);
      if (!pick) pick = freshPool.find(c => localQ[c] > 0);
      if (!pick) return null;
      chosen.push(pick);
      localQ[pick]--;
    }

    if (sameMultiset(prevColors, chosen)) return null;
    if (multisetOverlap(prevColors, chosen) > maxOverlap) return null;
    if (distinctOverlap(prevColors, chosen) > maxOverlap) return null;
    if (!isBlockLast && new Set(chosen).size > 7) return null;
    return chosen;
  }

  /**
   * Pick a valid targetColors array for one level, respecting quotas,
   * consecutive-level constraints, and realm rules.
   */
  function pickLevelColors(spec, quota, prevColors, rng, attempts, isBlockLast) {
    const n = spec.targets;
    if (n >= 9) {
      for (let t = 0; t < attempts; t++) {
        const res = pickLargeLevelColors(n, quota, prevColors, rng, isBlockLast);
        if (res) return res;
      }
      return null;
    }
    const pool = spec.pool;
    const maxOverlap = Math.floor(n / 2);
    const prevSet = new Set(prevColors || []);
    // Cap distinct colours on 9-10 target levels to <= 7 so the next level can always share <= half
    const maxDistinct = n >= 9 ? 7 : n;

    // For Realm 4 (Desert Oasis) levels 51-56, introduce tertiaries one at a time
    const forcedTert = spec.forcedTertiary || null;
    const allowedTertSet = spec.allowedTertiaries ? new Set(spec.allowedTertiaries) : null;

    for (let tryIdx = 0; tryIdx < attempts; tryIdx++) {
      const chosen = [];
      const localQuota = Object.assign({}, quota);

      if (forcedTert) {
        // Use 2 of the newly introduced tertiary if available, else 1 + another unlocked tertiary
        const firstCount = localQuota[forcedTert] >= 2 && (!prevSet.has(forcedTert) || maxOverlap >= 2) ? 2 : 1;
        for (let k = 0; k < firstCount && localQuota[forcedTert] > 0; k++) {
          chosen.push(forcedTert);
          localQuota[forcedTert]--;
        }
      }

      // Fill remaining slots greedily with seeded tie-breaking
      while (chosen.length < n) {
        let candidates = pool.filter(c => localQuota[c] > 0);
        if (!candidates.length) break;

        // Realm 1 levels 1-5: always choose secondaries (1 target -> teaches fusion & par >= 3)
        if (spec.onlySecondaries) {
          const secCands = candidates.filter(c => SECONDARIES.indexOf(c) >= 0);
          if (secCands.length) candidates = secCands;
        }

        // Desert Oasis rule: at least 2 tertiary colours
        if (spec.minTertiaries) {
          const curTerts = chosen.filter(c => TERTIARIES.indexOf(c) >= 0).length;
          const slotsLeft = n - chosen.length;
          const needTerts = spec.minTertiaries - curTerts;
          if (needTerts > 0 && slotsLeft <= needTerts) {
            const tertCands = candidates.filter(c =>
              TERTIARIES.indexOf(c) >= 0 && (!allowedTertSet || allowedTertSet.has(c))
            );
            if (tertCands.length) candidates = tertCands;
          } else if (allowedTertSet) {
            const filtered = candidates.filter(c =>
              TERTIARIES.indexOf(c) < 0 || allowedTertSet.has(c)
            );
            if (filtered.length) candidates = filtered;
          }
          // Prefer non-tertiary when we already have enough tertiaries and base quota needs consuming
          if (curTerts >= spec.minTertiaries) {
            const baseCands = candidates.filter(c => BASE_COLORS.indexOf(c) >= 0);
            if (baseCands.length && spec.capTertiaries) candidates = baseCands;
          }
        }

        // Respect maxDistinct cap (for 9-10 targets)
        const curDistinct = new Set(chosen);
        if (curDistinct.size >= maxDistinct) {
          const inSet = candidates.filter(c => curDistinct.has(c));
          if (inSet.length) candidates = inSet;
        }

        // Respect overlap budget against prevColors
        const curMOverlap = multisetOverlap(prevColors, chosen);
        const prevMap = countMap(prevColors || []);
        const curMap = countMap(chosen);
        const nonOverlapCands = candidates.filter(c => !prevSet.has(c));
        const safeOverlapCands = candidates.filter(c => {
          const usedSame = curMap[c] || 0;
          const prevSame = prevMap[c] || 0;
          const addsMultiset = usedSame < prevSame ? 1 : 0;
          const addsDistinct = (!curMap[c] && prevSet.has(c)) ? 1 : 0;
          return (curMOverlap + addsMultiset <= maxOverlap) &&
                 (distinctOverlap(prevColors, chosen) + addsDistinct <= maxOverlap);
        });

        // Bias towards non-overlapping colours first when needed, and higher remaining quota
        let pickPool = safeOverlapCands.length ? safeOverlapCands : candidates;
        if (nonOverlapCands.length && (n - chosen.length) <= (n - maxOverlap) && curMOverlap >= maxOverlap) {
          pickPool = nonOverlapCands;
        }

        // On 9-10 target levels, reserve distinct-colour budget for fresh (non-prev) colours
        // by limiting shared colours from prev to at most 2 distinct colours (e.g. 2+2 or 3+2).
        const freshSlotsNeeded = Math.max(0, (n - maxOverlap) - chosen.filter(c => !prevSet.has(c)).length);
        const slotsRemaining = n - chosen.length;
        if (n >= 9 && freshSlotsNeeded >= slotsRemaining) {
          const onlyFresh = pickPool.filter(c => !prevSet.has(c));
          if (onlyFresh.length) pickPool = onlyFresh;
        } else if (n >= 9 && prevColors) {
          const sharedDistinctUsed = new Set(chosen.filter(c => prevSet.has(c)));
          if (sharedDistinctUsed.size >= 2) {
            const noNewSharedDistinct = pickPool.filter(c => !prevSet.has(c) || sharedDistinctUsed.has(c));
            if (noNewSharedDistinct.length) pickPool = noNewSharedDistinct;
          }
        }

        // Prefer distinct colours within a level when n <= 8 (or when fresh slots can still stay distinct)
        const unusedInLevel = pickPool.filter(c => !curDistinct.has(c));
        if (unusedInLevel.length && curDistinct.size < maxDistinct) {
          if (n < 9 || unusedInLevel.some(c => !prevSet.has(c)) || new Set(chosen.filter(c => prevSet.has(c))).size < 2) {
            pickPool = unusedInLevel;
          }
        }

        // Score by remaining quota + small jitter (tiny jitter preserves quota balance)
        pickPool = shuffle(pickPool, rng);
        const jitter = n >= 9 ? 0.35 : 0.9;
        pickPool.sort((a, b) => (localQuota[b] + rng() * jitter) - (localQuota[a] + rng() * jitter));

        const pick = pickPool[0];
        chosen.push(pick);
        localQuota[pick]--;
      }

      if (chosen.length !== n) continue;
      if (sameMultiset(prevColors, chosen)) continue;
      if (multisetOverlap(prevColors, chosen) > maxOverlap) continue;
      if (distinctOverlap(prevColors, chosen) > maxOverlap) continue;
      if (new Set(chosen).size > maxDistinct) continue;
      if (spec.minTertiaries && chosen.filter(c => TERTIARIES.indexOf(c) >= 0).length < spec.minTertiaries) continue;

      return chosen;
    }
    return null;
  }

  /**
   * Build and cache deterministic target schedules per realm/chapter block.
   * For Realms 1-9, blockIndex = realm.index.
   * For Realm 10 (Endless Spectrum), blocks are 25-level chapters: blockIndex = 10 + wave.
   */
  const _blockCache = {};

  function getBlockSchedule(blockKey) {
    if (_blockCache[blockKey]) return _blockCache[blockKey];

    let start, end, realm;
    if (blockKey <= 9) {
      realm = PROGRESSION_REALMS[blockKey - 1];
      start = realm.start;
      end = realm.end;
    } else {
      realm = PROGRESSION_REALMS[9];
      const wave = blockKey - 10;
      start = 201 + wave * 25;
      end = start + 24;
    }

    // Ensure previous block exists so boundary transition shares <= half colours
    let prevBlockLastColors = null;
    if (blockKey > 1) {
      const prevSched = getBlockSchedule(blockKey - 1);
      prevBlockLastColors = prevSched[prevSched.length - 1].targetColors;
    }

    const len = end - start + 1;
    const pool = poolForRealm(realm);
    const specs = [];
    let totalSlots = 0;

    for (let i = 0; i < len; i++) {
      const lvl = start + i;
      const t = targetsForLevel(realm, lvl);
      totalSlots += t;
      const spec = {
        level: lvl,
        targets: t,
        pool: pool,
        onlySecondaries: realm.index === 1 && lvl <= 5,
        minTertiaries: realm.index === 4 ? 2 : 0,
        capTertiaries: realm.index === 4,
        forcedTertiary: null,
        allowedTertiaries: null,
        introHint: null,
      };

      // Desert Oasis (levels 51-75): introduce one tertiary at a time on levels 51-56
      if (realm.index === 4 && i < TERTIARIES.length) {
        spec.forcedTertiary = TERTIARIES[i];
        spec.allowedTertiaries = TERTIARIES.slice(0, i + 1);
        spec.introHint = TERTIARY_HINTS[TERTIARIES[i]];
      }
      specs.push(spec);
    }

    // Try seeded schedule generation with retries if tail constraints collide
    for (let seedAttempt = 0; seedAttempt < 64; seedAttempt++) {
      const rng = mulberry32(blockKey * 7919 + 104729 + seedAttempt * 313);
      const quota = buildQuotas(pool, totalSlots, rng, realm.index);
      const result = [];
      let prev = prevBlockLastColors;
      let ok = true;

      for (let i = 0; i < len; i++) {
        const chosen = pickLevelColors(specs[i], quota, prev, rng, 24, i === len - 1);
        if (!chosen) { ok = false; break; }
        for (let k = 0; k < chosen.length; k++) quota[chosen[k]]--;
        result.push({
          level: specs[i].level,
          targetColors: shuffle(chosen, rng),
          introHint: specs[i].introHint,
        });
        prev = chosen;
      }

      if (ok) {
        _blockCache[blockKey] = result;
        return result;
      }
    }

    // Fallback deterministic assignment (still honours per-level rules)
    const rng = mulberry32(blockKey * 7919 + 99991);
    const quota = buildQuotas(pool, totalSlots, rng, realm.index);
    const fallback = [];
    let prev = prevBlockLastColors;
    for (let i = 0; i < len; i++) {
      const chosen = pickLevelColors(specs[i], quota, prev, rng, 40, i === len - 1) ||
        shuffle(pool, rng).slice(0, specs[i].targets);
      fallback.push({
        level: specs[i].level,
        targetColors: chosen,
        introHint: specs[i].introHint,
      });
      prev = chosen;
    }
    _blockCache[blockKey] = fallback;
    return fallback;
  }

  return function getLevelConfig(levelNumber) {
    const lvl = Math.max(1, Math.floor(levelNumber || 1));
    const realm = getRealm(lvl);

    const isEndless = realm.index === 10;
    const wave = isEndless ? Math.floor((lvl - 201) / 25) : 0;
    const blockStart = isEndless ? (201 + wave * 25) : realm.start;
    const blockEnd   = isEndless ? (blockStart + 24) : realm.end;
    const posInBlock = lvl - blockStart;
    const blockLen   = blockEnd - blockStart + 1;

    const isIntro    = isEndless ? (lvl - 201) < 3 : posInBlock < 3;
    const isFinale   = isEndless ? false : (lvl === realm.end);
    const isBreather = !isFinale && (lvl % 5 === 0);

    const targets = targetsForLevel(realm, lvl);
    const colorPool = poolForRealm(realm);

    // Empty tubes: 3 for intro, 2 normally, +1 on breather (capped so total tubes <= 14)
    let emptyTubes = isIntro ? 3 : 2;
    if (isBreather) emptyTubes += 1;
    emptyTubes = Math.max(1, Math.min(emptyTubes, 14 - targets));

    // Smooth scramble ramp: ~60% of realm max at start -> 100% at end; wave growth in Endless
    const waveBoost = isEndless ? Math.min(24, wave * 4) : 0;
    const minS = realm.minScramble + waveBoost;
    const maxS = realm.maxScramble + waveBoost;
    const progress = blockLen > 1 ? (posInBlock / (blockLen - 1)) : 1;
    let scrambleDepth = Math.round(minS + (maxS - minS) * progress);

    if (isFinale) {
      scrambleDepth = maxS;
    } else if (isBreather) {
      scrambleDepth = Math.max(4, Math.round(scrambleDepth * 0.7));
    }

    const blockKey = isEndless ? (10 + wave) : realm.index;
    const sched = getBlockSchedule(blockKey);
    const entry = sched[posInBlock];

    return {
      realmIndex:    realm.index,
      realmName:     realm.name,
      targets:       targets,
      colorPool:     colorPool,
      targetColors:  entry.targetColors.slice(),
      emptyTubes:    emptyTubes,
      scrambleDepth: scrambleDepth,
      isBreather:    isBreather,
      isIntro:       isIntro,
      isFinale:      isFinale,
      introHint:     entry.introHint || null,
    };
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getLevelConfig, PROGRESSION_REALMS };
}
