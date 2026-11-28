// ============================================================
// HUE POUR — Economy, Unlocks & Tunable Config
// Offline localStorage wallet, earn/spend rules, rewarded-ad
// cooldowns & daily caps, interstitial gating, and unlockable
// themes, bottles (tubes), and color palettes.
// ============================================================
'use strict';

const Economy = (() => {
  /* -------------------------------------------------------------------
     SINGLE TUNABLE CONFIG OBJECT
     Adjust all rewards, costs, ad limits, unlocks, and palettes here.
     ------------------------------------------------------------------- */
  const CONFIG = {
    storageKeys: {
      wallet:         'hue_pour_coins',
      legacyWallet:   'hp_coins',
      rewardedAdLog:  'hue_pour_rewarded_ad_log',
      palettes:       'hue_pour_palettes',
      themes:         'hue_pour_themes',
      tubes:          'hue_pour_tubes',
      highestLevel:   'hue_pour_highest_level',
      lastRewardedAt: 'hue_pour_last_rewarded_at',
    },
    earn: {
      levelWin:          10,
      threeStarsBonus:   10,
      realmFinaleBonus:  100,
      dailyBase:         30,
      dailyStreakPerDay: 5,
      dailyStreakCap:    50,
      rewardedAdCoins:   150,
    },
    spend: {
      extraHint:       40,
      extraUndos:      30,
      extraUndosCount: 3,
      extraTube:       100,
      colorPalette:    800,
    },
    free: {
      hintsPerLevel: 1,
      undosPerLevel: 3,
    },
    ads: {
      rewardedCooldownMs:          30000,   // 30s between "+150 coins" rewarded ads
      rewardedDailyLimit:          10,      // max "+150 coins" rewarded ads per day
      interstitialAfterRewardedMs: 120000,  // 2 min interstitial cooldown after any rewarded ad
      interstitialEveryNLevels:    4,       // existing every-4-completions rule
      interstitialMinLevel:        6,       // never show interstitial in levels 1-5
      interstitialMinCompleted:    6,       // never show interstitial when levelsCompleted <= 5
    },
    tubes: [
      { id: 'classic',   name: 'Classic Tubes',   unlockLevel: 1,   accent: '#cfd8dc' },
      { id: 'nursing',   name: 'Milk Bottles',    unlockLevel: 10,  accent: '#4dd0e1' },
      { id: 'soda',      name: 'Soda Bottles',    unlockLevel: 30,  accent: '#ef5350' },
      { id: 'champagne', name: 'Fizz Bottles',    unlockLevel: 50,  accent: '#f06292' },
      { id: 'vase',      name: 'Blossom Vases',   unlockLevel: 70,  accent: '#ba68c8' },
      { id: 'cocktail',  name: 'Cocktail Glass',  unlockLevel: 90,  accent: '#66bb6a' },
      { id: 'cork',      name: 'Corked Vials',    unlockLevel: 110, accent: '#bcaaa4' },
      { id: 'pineapple', name: 'Tiki Flasks',     unlockLevel: 130, accent: '#ffb74d' },
      { id: 'mushroom',  name: 'Shroom Flasks',   unlockLevel: 150, accent: '#e57373' },
      { id: 'winter',    name: 'Frost Bottles',   unlockLevel: 170, accent: '#81d4fa' },
    ],
    themes: [
      { id: 'doodle',     name: 'Alchemist Night',  unlockLevel: 1,   bgTop: '#12082b', bgBot: '#1d1242', hill1: '#23154d', hill2: '#170d36', accent: '#7c4dff' },
      { id: 'forest',     name: 'Emerald Woods',    unlockLevel: 1,   bgTop: '#7be3b5', bgBot: '#1b5e4a', hill1: '#144d3c', hill2: '#0b2d23', accent: '#69f0ae' },
      { id: 'nightwoods', name: 'Moonlit Pines',    unlockLevel: 20,  bgTop: '#1d1a4e', bgBot: '#0d0c28', hill1: '#29245e', hill2: '#13103a', accent: '#b388ff' },
      { id: 'sunset',     name: 'Crimson Canyon',   unlockLevel: 40,  bgTop: '#6d1b4b', bgBot: '#29102e', hill1: '#8e2d4a', hill2: '#46162d', accent: '#ff8a65' },
      { id: 'desert',     name: 'Golden Pyramids',  unlockLevel: 60,  bgTop: '#70422b', bgBot: '#2a1617', hill1: '#8f5534', hill2: '#48241b', accent: '#ffd54f' },
      { id: 'cosmos',     name: 'Starlit Planets',  unlockLevel: 80,  bgTop: '#15123c', bgBot: '#09071d', hill1: '#2b326c', hill2: '#161844', accent: '#4fc3f7' },
      { id: 'skyline',    name: 'Midnight City',    unlockLevel: 100, bgTop: '#1d1649', bgBot: '#0b0822', hill1: '#2d2466', hill2: '#181242', accent: '#ff80ab' },
      { id: 'lilypad',    name: 'Jade Pond',        unlockLevel: 120, bgTop: '#134e4a', bgBot: '#08272b', hill1: '#1b6b61', hill2: '#0e3c38', accent: '#80cbc4' },
      { id: 'abyss',      name: 'Sunken Reef',      unlockLevel: 140, bgTop: '#122c57', bgBot: '#061129', hill1: '#183e75', hill2: '#0b1e42', accent: '#4dd0e1' },
      { id: 'aurora',     name: 'Aurora Peaks',     unlockLevel: 160, bgTop: '#141e46', bgBot: '#0a0f26', hill1: '#1b3b6f', hill2: '#0f2042', accent: '#a7ffeb' },
    ],
    palettes: [
      {
        id:   'classic',
        name: 'Classic Prism',
        desc: 'Signature luminous hues',
        free: true,
        swatches: ['#E53935', '#FFD93B', '#2F7DF6', '#2ECC71'],
        preview: [
          ['GREEN', 'ORANGE', 'BLUE'],
          ['PURPLE', 'YELLOW', 'BLUE'],
          ['VERMILION', 'TEAL', 'RED'],
        ],
        colors: null, // uses COLOR_INFO defaults directly
      },
      {
        id:   'pastel',
        name: 'Candy Pastel',
        desc: 'Soft sherbet glass tones',
        free: true,
        swatches: ['#FF7B9C', '#FFE699', '#7CC6FE', '#A8E6CF'],
        preview: [
          ['LIME', 'PEACH', 'TEAL'],
          ['PINK', 'CREAM', 'MINT'],
          ['LAVENDER', 'AQUA', 'TAN'],
        ],
        colors: {
          RED:       '#FF7B89',
          VERMILION: '#FFA384',
          ORANGE:    '#FFB884',
          AMBER:     '#FFD591',
          YELLOW:    '#FFF099',
          LIME:      '#C3EC9B',
          GREEN:     '#8FE3B4',
          TEAL:      '#7ED6C9',
          BLUE:      '#7DB8FF',
          INDIGO:    '#9D9BFF',
          PURPLE:    '#C9A0FF',
          MAGENTA:   '#F69BD3',
        },
      },
      {
        id:   'candy',
        name: 'Fruit Punch',
        desc: 'Punchy juicy pop tones',
        free: false,
        swatches: ['#FF3D7F', '#FFAA00', '#0095FF', '#00D68F'],
        colors: {
          RED:       '#FF3D7F',
          VERMILION: '#FF6B4A',
          ORANGE:    '#FF9E2C',
          AMBER:     '#FFC933',
          YELLOW:    '#FFF04D',
          LIME:      '#A2EC42',
          GREEN:     '#00D68F',
          TEAL:      '#00C4B4',
          BLUE:      '#0095FF',
          INDIGO:    '#5E60CE',
          PURPLE:    '#B5179E',
          MAGENTA:   '#FF4DC4',
        },
      },
      {
        id:   'earthy',
        name: 'Botanical Earth',
        desc: 'Warm clay & moss tones',
        free: false,
        swatches: ['#C85A53', '#E3B23C', '#4A7C8C', '#5C8D67'],
        colors: {
          RED:       '#C85A53',
          VERMILION: '#D9724B',
          ORANGE:    '#DE8F4E',
          AMBER:     '#E3B23C',
          YELLOW:    '#EAD268',
          LIME:      '#9DB35B',
          GREEN:     '#5C8D67',
          TEAL:      '#3D8282',
          BLUE:      '#4A7C8C',
          INDIGO:    '#575C8C',
          PURPLE:    '#8B5F88',
          MAGENTA:   '#B85B7B',
        },
      },
      {
        id:   'neon',
        name: 'Cyber Neon',
        desc: 'High-contrast electric glow',
        free: false,
        swatches: ['#FF1744', '#FFEA00', '#00E5FF', '#00E676'],
        colors: {
          RED:       '#FF1744',
          VERMILION: '#FF5252',
          ORANGE:    '#FF9100',
          AMBER:     '#FFC400',
          YELLOW:    '#FFEA00',
          LIME:      '#C6FF00',
          GREEN:     '#00E676',
          TEAL:      '#1DE9B6',
          BLUE:      '#00B0FF',
          INDIGO:    '#651FFF',
          PURPLE:    '#D500F9',
          MAGENTA:   '#FF4081',
        },
      },
      {
        id:   'twilight',
        name: 'Royal Dusk',
        desc: 'Deep jewel alchemy hues',
        free: false,
        swatches: ['#D94A64', '#F0A848', '#487AE0', '#38B27A'],
        colors: {
          RED:       '#D94A64',
          VERMILION: '#E5674A',
          ORANGE:    '#EB8544',
          AMBER:     '#F0A848',
          YELLOW:    '#F5D259',
          LIME:      '#9ED456',
          GREEN:     '#38B27A',
          TEAL:      '#2AA3A8',
          BLUE:      '#487AE0',
          INDIGO:    '#6356C7',
          PURPLE:    '#9D4EDD',
          MAGENTA:   '#D649A8',
        },
      },
    ],
  };

  /* ---------- Safe localStorage helpers ---------- */
  function _readRaw(key) {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function _writeRaw(key, val) {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(key, String(val));
      return true;
    } catch (e) {
      return false;
    }
  }

  function _readJSON(key, fallback) {
    const raw = _readRaw(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function _writeJSON(key, obj) {
    try {
      return _writeRaw(key, JSON.stringify(obj));
    } catch (e) {
      return false;
    }
  }

  function _nonNegInt(val, def) {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n >= 0 ? n : (def || 0);
  }

  /* ---------- Wallet ---------- */
  let _memBalance = null;

  function _loadBalance() {
    const raw = _readRaw(CONFIG.storageKeys.wallet);
    if (raw !== null) return _nonNegInt(raw, 0);
    const legacy = _readRaw(CONFIG.storageKeys.legacyWallet);
    if (legacy !== null) {
      const val = _nonNegInt(legacy, 0);
      _writeRaw(CONFIG.storageKeys.wallet, val);
      return val;
    }
    return _memBalance !== null ? _memBalance : 0;
  }

  function getBalance() {
    const bal = _loadBalance();
    _memBalance = bal;
    return bal;
  }

  function setBalance(amount) {
    const next = Math.max(0, Math.floor(Number(amount) || 0));
    _memBalance = next;
    _writeRaw(CONFIG.storageKeys.wallet, next);
    _writeRaw(CONFIG.storageKeys.legacyWallet, next);
    return next;
  }

  function canAfford(amount) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    return getBalance() >= cost;
  }

  function earn(amount) {
    const delta = Math.max(0, Math.floor(Number(amount) || 0));
    return setBalance(getBalance() + delta);
  }

  function spend(amount) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    if (cost <= 0) return true;
    const cur = getBalance();
    if (cur < cost) return false;
    setBalance(cur - cost);
    return true;
  }

  /* ---------- Highest Level Unlocked ---------- */
  let _memHighestLevel = 1;

  function getHighestLevel() {
    const raw = _readRaw(CONFIG.storageKeys.highestLevel);
    if (raw !== null) {
      const n = Math.max(1, _nonNegInt(raw, 1));
      _memHighestLevel = n;
      return n;
    }
    return _memHighestLevel;
  }

  function setHighestLevel(levelNum) {
    const n = Math.max(1, Math.floor(Number(levelNum) || 1));
    const cur = getHighestLevel();
    const next = Math.max(cur, n);
    _memHighestLevel = next;
    _writeRaw(CONFIG.storageKeys.highestLevel, next);
    return next;
  }

  function forceHighestLevel(levelNum) {
    const n = Math.max(1, Math.floor(Number(levelNum) || 1));
    _memHighestLevel = n;
    _writeRaw(CONFIG.storageKeys.highestLevel, n);
    return n;
  }

  /* ---------- Earn Calculations ---------- */
  function calcLevelEarn(opts) {
    const o = opts || {};
    const win = CONFIG.earn.levelWin;
    const starBonus = o.stars === 3 ? CONFIG.earn.threeStarsBonus : 0;
    const finaleBonus = o.isFinale ? CONFIG.earn.realmFinaleBonus : 0;
    return {
      win,
      starBonus,
      finaleBonus,
      total: win + starBonus + finaleBonus,
    };
  }

  function calcDailyEarn(streakDays) {
    const s = Math.max(0, Math.floor(Number(streakDays) || 0));
    const base = CONFIG.earn.dailyBase;
    const streakBonus = Math.min(CONFIG.earn.dailyStreakCap, s * CONFIG.earn.dailyStreakPerDay);
    return {
      base,
      streakBonus,
      streak: s,
      total: base + streakBonus,
    };
  }

  /* ---------- Rewarded Ad (+150 Coins) Cooldown & Daily Cap ---------- */
  let _memAdLog = null;

  function _localDayStr(nowMs) {
    const d = new Date(nowMs !== undefined ? nowMs : Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function _loadAdLog(nowMs) {
    const today = _localDayStr(nowMs);
    const saved = _readJSON(CONFIG.storageKeys.rewardedAdLog, null);
    const src = saved || _memAdLog || { day: today, count: 0, lastAt: 0 };
    const count = src.day === today ? _nonNegInt(src.count, 0) : 0;
    const lastAt = _nonNegInt(src.lastAt, 0);
    return { day: today, count, lastAt };
  }

  function _saveAdLog(entry) {
    _memAdLog = { day: entry.day, count: entry.count, lastAt: entry.lastAt };
    _writeJSON(CONFIG.storageKeys.rewardedAdLog, _memAdLog);
  }

  function getRewardedAdState(nowMs) {
    const now = nowMs !== undefined ? nowMs : Date.now();
    const log = _loadAdLog(now);
    const limit = CONFIG.ads.rewardedDailyLimit;
    const cooldownMs = CONFIG.ads.rewardedCooldownMs;
    const remainingToday = Math.max(0, limit - log.count);
    const cooldownRemainingMs = log.lastAt > 0 ? Math.max(0, cooldownMs - (now - log.lastAt)) : 0;
    const cooldownRemainingSec = Math.ceil(cooldownRemainingMs / 1000);
    return {
      canWatch:             remainingToday > 0 && cooldownRemainingMs <= 0,
      countToday:           log.count,
      dailyLimit:           limit,
      remainingToday,
      cooldownRemainingMs,
      cooldownRemainingSec,
      rewardAmount:         CONFIG.earn.rewardedAdCoins,
      lastAt:               log.lastAt,
    };
  }

  function recordRewardedAdCoinClaim(nowMs) {
    const now = nowMs !== undefined ? nowMs : Date.now();
    const st = getRewardedAdState(now);
    if (!st.canWatch) {
      return {
        ok:     false,
        reason: st.remainingToday <= 0 ? 'limit' : 'cooldown',
        state:  st,
      };
    }
    _saveAdLog({ day: _localDayStr(now), count: st.countToday + 1, lastAt: now });
    const balance = earn(CONFIG.earn.rewardedAdCoins);
    return {
      ok:      true,
      earned:  CONFIG.earn.rewardedAdCoins,
      balance,
      state:   getRewardedAdState(now),
    };
  }

  /* ---------- Interstitial Policy Evaluator ---------- */
  function canShowInterstitial(ctx) {
    const c = ctx || {};
    if (c.adsRemoved) return false;
    if (c.isCelebrating || c.isFinale) return false;

    const completed = Number(c.levelsCompleted) || 0;
    if (completed < CONFIG.ads.interstitialMinCompleted) return false;
    if (completed % CONFIG.ads.interstitialEveryNLevels !== 0) return false;

    if (c.levelNum !== undefined && c.levelNum !== null) {
      if (Number(c.levelNum) < CONFIG.ads.interstitialMinLevel) return false;
    }

    const now = c.now !== undefined ? c.now : Date.now();
    const lastRewardedAt = Number(c.lastRewardedAt) || 0;
    if (lastRewardedAt > 0 && (now - lastRewardedAt) < CONFIG.ads.interstitialAfterRewardedMs) {
      return false;
    }
    return true;
  }

  /* ---------- Themes (Backgrounds, unlocked by level) ---------- */
  let _memActiveTheme = 'doodle';

  function _getActiveId(key, items, defId, levelNow) {
    const raw = _readRaw(key) || defId;
    const lvl = levelNow !== undefined ? levelNow : getHighestLevel();
    const found = items.find(it => it.id === raw);
    if (found && lvl >= found.unlockLevel) return found.id;
    return items[0].id;
  }

  function getThemes(levelOpt) {
    const lvl = levelOpt !== undefined ? levelOpt : getHighestLevel();
    const activeId = _getActiveId(CONFIG.storageKeys.themes, CONFIG.themes, _memActiveTheme, lvl);
    _memActiveTheme = activeId;
    return CONFIG.themes.map(t => ({
      id:          t.id,
      name:        t.name,
      unlockLevel: t.unlockLevel,
      bgTop:       t.bgTop,
      bgBot:       t.bgBot,
      hill1:       t.hill1,
      hill2:       t.hill2,
      accent:      t.accent,
      unlocked:    lvl >= t.unlockLevel,
      active:      activeId === t.id,
    }));
  }

  function getActiveTheme(levelOpt) {
    const all = getThemes(levelOpt);
    return all.find(t => t.active) || all[0];
  }

  function selectTheme(id, levelOpt) {
    const lvl = levelOpt !== undefined ? levelOpt : getHighestLevel();
    const found = CONFIG.themes.find(t => t.id === id);
    if (!found || lvl < found.unlockLevel) return false;
    _memActiveTheme = found.id;
    _writeRaw(CONFIG.storageKeys.themes, found.id);
    return true;
  }

  /* ---------- Bottles / Tubes (unlocked by level) ---------- */
  let _memActiveTube = 'classic';

  function getTubes(levelOpt) {
    const lvl = levelOpt !== undefined ? levelOpt : getHighestLevel();
    const activeId = _getActiveId(CONFIG.storageKeys.tubes, CONFIG.tubes, _memActiveTube, lvl);
    _memActiveTube = activeId;
    return CONFIG.tubes.map(b => ({
      id:          b.id,
      name:        b.name,
      unlockLevel: b.unlockLevel,
      accent:      b.accent,
      unlocked:    lvl >= b.unlockLevel,
      active:      activeId === b.id,
    }));
  }

  function getActiveTube(levelOpt) {
    const all = getTubes(levelOpt);
    return all.find(b => b.active) || all[0];
  }

  function selectTube(id, levelOpt) {
    const lvl = levelOpt !== undefined ? levelOpt : getHighestLevel();
    const found = CONFIG.tubes.find(b => b.id === id);
    if (!found || lvl < found.unlockLevel) return false;
    _memActiveTube = found.id;
    _writeRaw(CONFIG.storageKeys.tubes, found.id);
    return true;
  }

  /* ---------- Unlock Progress Helper (used on Win Screen) ---------- */
  function getNextUnlock(kind, completedLevelNum) {
    const list = kind === 'theme' ? CONFIG.themes : CONFIG.tubes;
    const lvl = Math.max(0, Math.floor(Number(completedLevelNum) || 0));
    const exactMatch = list.find(item => item.unlockLevel > 1 && item.unlockLevel === lvl);
    if (exactMatch) {
      return { item: exactMatch, unlockLevel: exactMatch.unlockLevel, current: lvl, justUnlocked: true };
    }
    const upcoming = list.find(item => item.unlockLevel > lvl);
    if (!upcoming) return null;
    return { item: upcoming, unlockLevel: upcoming.unlockLevel, current: lvl, justUnlocked: false };
  }

  /* ---------- Color Palettes (unlocked + 800-coin shop items) ---------- */
  let _memPalState = { unlocked: ['classic', 'pastel'], active: 'classic' };

  function _defaultUnlockedPaletteIds() {
    return CONFIG.palettes.filter(p => p.free).map(p => p.id);
  }

  function _loadPaletteState() {
    const saved = _readJSON(CONFIG.storageKeys.palettes, null);
    const raw = saved || _memPalState;
    const baseFree = _defaultUnlockedPaletteIds();
    const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.slice() : [];
    for (let i = 0; i < baseFree.length; i++) {
      if (!unlocked.includes(baseFree[i])) unlocked.push(baseFree[i]);
    }
    const active = unlocked.includes(raw.active) ? raw.active : 'classic';
    return { unlocked, active };
  }

  function _savePaletteState(st) {
    _memPalState = { unlocked: st.unlocked.slice(), active: st.active };
    _writeJSON(CONFIG.storageKeys.palettes, _memPalState);
  }

  function _palettePrice(p) {
    return p.free ? 0 : CONFIG.spend.colorPalette;
  }

  function getPalettes() {
    const st = _loadPaletteState();
    return CONFIG.palettes.map(p => ({
      id:       p.id,
      name:     p.name,
      desc:     p.desc,
      price:    _palettePrice(p),
      swatches: p.swatches.slice(),
      colors:   p.colors ? Object.assign({}, p.colors) : null,
      owned:    !!p.free || st.unlocked.includes(p.id),
      active:   st.active === p.id,
    }));
  }

  function getActivePalette() {
    const all = getPalettes();
    return all.find(p => p.active) || all[0];
  }

  function getDisplayHex(colorKey, fallbackHex, paletteIdOpt) {
    let pal = null;
    if (paletteIdOpt) {
      pal = CONFIG.palettes.find(p => p.id === paletteIdOpt) || null;
    } else {
      pal = getActivePalette();
    }
    if (pal && pal.colors && pal.colors[colorKey]) {
      return pal.colors[colorKey];
    }
    return fallbackHex;
  }

  function selectPalette(id) {
    const st = _loadPaletteState();
    const def = CONFIG.palettes.find(p => p.id === id);
    if (!def) return false;
    if (!def.free && !st.unlocked.includes(id)) return false;
    st.active = id;
    _savePaletteState(st);
    return true;
  }

  function buyPalette(id) {
    const def = CONFIG.palettes.find(p => p.id === id);
    if (!def) return { ok: false, reason: 'not_found' };
    const st = _loadPaletteState();
    if (def.free || st.unlocked.includes(id)) {
      st.active = id;
      _savePaletteState(st);
      return { ok: true, alreadyOwned: true, balance: getBalance(), palette: getActivePalette() };
    }
    const price = _palettePrice(def);
    if (!spend(price)) {
      return { ok: false, reason: 'insufficient_coins', balance: getBalance(), price };
    }
    st.unlocked.push(id);
    st.active = id;
    _savePaletteState(st);
    return { ok: true, price, balance: getBalance(), palette: getActivePalette() };
  }

  return {
    CONFIG,
    getBalance,
    setBalance,
    canAfford,
    earn,
    spend,
    getHighestLevel,
    setHighestLevel,
    forceHighestLevel,
    calcLevelEarn,
    calcDailyEarn,
    getRewardedAdState,
    recordRewardedAdCoinClaim,
    canShowInterstitial,
    getThemes,
    getActiveTheme,
    selectTheme,
    getTubes,
    getActiveTube,
    selectTube,
    getNextUnlock,
    getPalettes,
    getActivePalette,
    getDisplayHex,
    selectPalette,
    buyPalette,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Economy;
}
