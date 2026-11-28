// ============================================================
// HUE POUR — Economy & Tunable Config
// Offline localStorage wallet, earn/spend rules, rewarded-ad
// cooldowns & daily caps, interstitial gating, and shop palettes.
// ============================================================
'use strict';

const Economy = (() => {
  /* -------------------------------------------------------------------
     SINGLE TUNABLE CONFIG OBJECT
     Adjust all rewards, costs, ad limits, and palettes here.
     ------------------------------------------------------------------- */
  const CONFIG = {
    storageKeys: {
      wallet:         'hue_pour_coins',
      legacyWallet:   'hp_coins',
      rewardedAdLog:  'hue_pour_rewarded_ad_log',
      palettes:       'hue_pour_palettes',
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
    palettes: [
      {
        id:       'classic',
        name:     'Classic Prism',
        desc:     'Signature luminous hues',
        free:     true,
        swatches: ['#E53935', '#1E88E5', '#FDD835', '#43A047'],
      },
      {
        id:       'pastel',
        name:     'Candy Pastel',
        desc:     'Soft cloudlike glass accents',
        free:     false,
        swatches: ['#FF8A80', '#82B1FF', '#FFE57F', '#B9F6CA'],
      },
      {
        id:       'neon',
        name:     'Neon Cyber',
        desc:     'Electric arcade highlights',
        free:     false,
        swatches: ['#FF1744', '#00E5FF', '#FFEA00', '#00E676'],
      },
      {
        id:       'sunset',
        name:     'Amber Twilight',
        desc:     'Warm oasis dusk trim',
        free:     false,
        swatches: ['#FF7043', '#AB47BC', '#FFCA28', '#26A69A'],
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
    if (raw !== null) {
      return _nonNegInt(raw, 0);
    }
    // Migrate legacy hp_coins stub key if present
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
    const cur = getBalance();
    return setBalance(cur + delta);
  }

  function spend(amount) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    if (cost <= 0) return true;
    const cur = getBalance();
    if (cur < cost) return false;
    setBalance(cur - cost);
    return true;
  }

  /* ---------- Earn Calculations ---------- */
  function calcLevelEarn(opts) {
    const o = opts || {};
    const win = CONFIG.earn.levelWin;
    const starBonus = o.stars === 3 ? CONFIG.earn.threeStarsBonus : 0;
    const finaleBonus = o.isFinale ? CONFIG.earn.realmFinaleBonus : 0;
    return {
      win:         win,
      starBonus:   starBonus,
      finaleBonus: finaleBonus,
      total:       win + starBonus + finaleBonus,
    };
  }

  function calcDailyEarn(streakDays) {
    const s = Math.max(0, Math.floor(Number(streakDays) || 0));
    const base = CONFIG.earn.dailyBase;
    const streakBonus = Math.min(CONFIG.earn.dailyStreakCap, s * CONFIG.earn.dailyStreakPerDay);
    return {
      base:        base,
      streakBonus: streakBonus,
      streak:      s,
      total:       base + streakBonus,
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
    return { day: today, count: count, lastAt: lastAt };
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
      remainingToday:       remainingToday,
      cooldownRemainingMs:  cooldownRemainingMs,
      cooldownRemainingSec: cooldownRemainingSec,
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
    const nextLog = {
      day:    _localDayStr(now),
      count:  st.countToday + 1,
      lastAt: now,
    };
    _saveAdLog(nextLog);
    const balance = earn(CONFIG.earn.rewardedAdCoins);
    return {
      ok:      true,
      earned:  CONFIG.earn.rewardedAdCoins,
      balance: balance,
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

  /* ---------- Color Palettes (for Shop) ---------- */
  let _memPalState = { unlocked: ['classic'], active: 'classic' };

  function _loadPaletteState() {
    const saved = _readJSON(CONFIG.storageKeys.palettes, null);
    const raw = saved || _memPalState;
    const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.slice() : ['classic'];
    if (!unlocked.includes('classic')) unlocked.unshift('classic');
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
      owned:    !!p.free || st.unlocked.includes(p.id),
      active:   st.active === p.id,
    }));
  }

  function getActivePalette() {
    const all = getPalettes();
    return all.find(p => p.active) || all[0];
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
    calcLevelEarn,
    calcDailyEarn,
    getRewardedAdState,
    recordRewardedAdCoinClaim,
    canShowInterstitial,
    getPalettes,
    getActivePalette,
    selectPalette,
    buyPalette,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Economy;
}
