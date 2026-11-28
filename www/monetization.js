// ============================================================
// HUE POUR — Monetization Wrapper (Offline Mock + SDK Hooks)
// Supports Capacitor/AdMob replacement while keeping all
// existing exports and working offline with localStorage.
// ============================================================
'use strict';

const Monetization = (() => {
  const ADS_KEY = 'hue_pour_ads_removed';
  const LAST_REWARDED_KEY = 'hue_pour_last_rewarded_at';
  const DEFAULT_REWARD_COOLDOWN_MS = 120000;

  let _adsRemoved = false;
  let _lastRewardedAt = 0;
  let _overlay = null;
  let _countdownEl = null;
  let _labelEl = null;
  let _reasonEl = null;
  let _adTimer = null;
  let _adActive = false;

  const REASON_LABELS = {
    coins_150:    'Reward: +150 coins',
    double_coins: 'Reward: Double level coins',
    extra_hint:   'Reward: Extra hint',
    extra_undo:   'Reward: +3 undos',
    extra_tube:   'Reward: Extra empty tube',
  };

  function _readAdsRemoved() {
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(ADS_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function _writeAdsRemoved(v) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(ADS_KEY, v ? '1' : '0');
    } catch (e) {}
  }

  function _readLastRewardedAt() {
    try {
      if (typeof localStorage === 'undefined') return _lastRewardedAt;
      const n = parseInt(localStorage.getItem(LAST_REWARDED_KEY) || '0', 10);
      return Number.isFinite(n) && n > 0 ? n : _lastRewardedAt;
    } catch (e) {
      return _lastRewardedAt;
    }
  }

  function _setLastRewardedAt(ts) {
    const n = Math.max(0, Math.floor(Number(ts) || 0));
    _lastRewardedAt = n;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LAST_REWARDED_KEY, String(n));
      }
    } catch (e) {}
  }

  function _cooldownWindowMs() {
    if (typeof Economy !== 'undefined' && Economy.CONFIG && Economy.CONFIG.ads) {
      return Economy.CONFIG.ads.interstitialAfterRewardedMs;
    }
    return DEFAULT_REWARD_COOLDOWN_MS;
  }

  function init() {
    _adsRemoved = _readAdsRemoved();
    _lastRewardedAt = _readLastRewardedAt();
    if (typeof document === 'undefined' || !document.body) return;
    if (_overlay) return;

    // Build the full-screen mock-ad overlay once (original SVG icon)
    _overlay = document.createElement('div');
    _overlay.id = 'ad-overlay';
    _overlay.className = 'overlay hidden';
    _overlay.setAttribute('aria-hidden', 'true');
    _overlay.innerHTML =
      '<div class="overlay-card ad-card">' +
        '<p class="ad-label" id="ad-label">ADVERTISEMENT</p>' +
        '<div class="ad-placeholder">' +
          '<svg class="ad-icon-svg" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">' +
            '<rect x="4" y="10" width="40" height="28" rx="6" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
            '<polygon points="20,17 32,24 20,31" fill="currentColor"/>' +
          '</svg>' +
          '<p class="ad-mock-title">Mock Ad Preview</p>' +
          '<p class="ad-sdk-note">REPLACE WITH REAL SDK</p>' +
          '<p class="ad-reason hidden" id="ad-reason"></p>' +
        '</div>' +
        '<p class="ad-countdown" id="ad-countdown"></p>' +
      '</div>';
    document.body.appendChild(_overlay);
    _countdownEl = _overlay.querySelector('#ad-countdown');
    _labelEl     = _overlay.querySelector('#ad-label');
    _reasonEl    = _overlay.querySelector('#ad-reason');
  }

  /* ---------- Internal: show overlay for N seconds ---------- */
  function _showMockAd(seconds, opts) {
    if (_adActive) return Promise.resolve(false);
    const o = opts || {};
    if (!_overlay && typeof document !== 'undefined' && document.body) init();

    // Headless / no-DOM fallback for unit verification
    if (!_overlay) {
      return Promise.resolve(true);
    }

    _adActive = true;
    if (_labelEl) {
      _labelEl.textContent = o.kind === 'rewarded' ? 'REWARDED AD' : 'ADVERTISEMENT';
    }
    if (_reasonEl) {
      const label = o.reason ? (REASON_LABELS[o.reason] || String(o.reason)) : '';
      _reasonEl.textContent = label;
      _reasonEl.classList.toggle('hidden', !label);
    }

    let left = Math.max(1, seconds || 3);
    if (_countdownEl) _countdownEl.textContent = 'Closing in ' + left + 's…';
    _overlay.classList.remove('hidden');
    _overlay.setAttribute('aria-hidden', 'false');

    return new Promise(resolve => {
      if (_adTimer) { clearInterval(_adTimer); _adTimer = null; }
      _adTimer = setInterval(() => {
        left--;
        if (left > 0) {
          if (_countdownEl) _countdownEl.textContent = 'Closing in ' + left + 's…';
        } else {
          clearInterval(_adTimer);
          _adTimer = null;
          _overlay.classList.add('hidden');
          _overlay.setAttribute('aria-hidden', 'true');
          _adActive = false;
          resolve(true);
        }
      }, 1000);
    });
  }

  /* ---------- Helpers ---------- */
  function getLastRewardedAt() {
    return _readLastRewardedAt();
  }

  function getInterstitialCooldownRemaining(nowMs) {
    const now = nowMs !== undefined ? nowMs : Date.now();
    const last = getLastRewardedAt();
    if (!last) return 0;
    return Math.max(0, _cooldownWindowMs() - (now - last));
  }

  /* ---------- Public API (preserve all existing exports & signatures) ---------- */
  async function showInterstitial(opts) {
    // REPLACE WITH REAL SDK: AdMob interstitial
    if (_adsRemoved) return false;
    const o = opts || {};
    if (o.isCelebrating || o.isFinale) return false;
    if (o.levelNum !== undefined && o.levelNum !== null && Number(o.levelNum) <= 5) return false;
    if (getInterstitialCooldownRemaining() > 0) return false;
    return _showMockAd(3, { kind: 'interstitial', reason: o.reason || '' });
  }

  async function showRewarded(reason) {
    // REPLACE WITH REAL SDK: AdMob rewarded video
    // Rewarded ads stay available even when adsRemoved is true (optional bonuses).
    const ok = await _showMockAd(3, { kind: 'rewarded', reason: reason || '' });
    if (ok) {
      _setLastRewardedAt(Date.now());
    }
    return ok;
  }

  async function purchaseRemoveAds() {
    // REPLACE WITH REAL SDK: Capacitor In-App Purchase
    _adsRemoved = true;
    _writeAdsRemoved(true);
    return true;
  }

  function isAdsRemoved() {
    return _adsRemoved;
  }

  async function restorePurchases() {
    // REPLACE WITH REAL SDK: restore IAP receipts
    _adsRemoved = _readAdsRemoved();
    return _adsRemoved;
  }

  return {
    init,
    showInterstitial,
    showRewarded,
    purchaseRemoveAds,
    isAdsRemoved,
    restorePurchases,
    getLastRewardedAt,
    getInterstitialCooldownRemaining,
    setLastRewardedAt: _setLastRewardedAt,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Monetization;
}
