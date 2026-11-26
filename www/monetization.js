// ============================================================
// HUE POUR — Monetization Stubs (mock only)
//
// Clean interface for ads & in-app purchases.
// Every mock is marked with "REPLACE WITH REAL SDK".
// Drop in real AdMob / Play Billing later without touching game code.
// ============================================================
'use strict';

const Monetization = (() => {
  const ADS_KEY = 'hue_pour_ads_removed';
  let _adsRemoved = false;
  let _overlay = null;
  let _countdownEl = null;
  let _labelEl = null;

  /* ---------- Init ---------- */
  function init() {
    // Load persisted purchase flag
    try { _adsRemoved = localStorage.getItem(ADS_KEY) === 'true'; } catch (e) { /* */ }

    // Build the full-screen mock-ad overlay once
    _overlay = document.createElement('div');
    _overlay.id = 'ad-overlay';
    _overlay.className = 'overlay hidden';
    _overlay.setAttribute('aria-hidden', 'true');
    _overlay.innerHTML =
      '<div class="overlay-card ad-card">' +
        '<p class="ad-label">ADVERTISEMENT</p>' +
        '<div class="ad-placeholder">' +
          '<span class="ad-icon">📺</span>' +
          '<p>This is a mock ad.<br>Replace with real AdMob SDK.</p>' +
        '</div>' +
        '<p class="ad-countdown" id="ad-countdown"></p>' +
      '</div>';
    document.body.appendChild(_overlay);
    _countdownEl = _overlay.querySelector('#ad-countdown');
  }

  /* ---------- Internal: show overlay for N seconds ---------- */
  function _showMockAd(seconds) {
    return new Promise(resolve => {
      _overlay.classList.remove('hidden');
      _overlay.setAttribute('aria-hidden', 'false');
      let rem = seconds;
      _countdownEl.textContent = 'Closing in ' + rem + '…';
      const iv = setInterval(() => {
        rem--;
        if (rem <= 0) {
          clearInterval(iv);
          _overlay.classList.add('hidden');
          _overlay.setAttribute('aria-hidden', 'true');
          resolve(true);
        } else {
          _countdownEl.textContent = 'Closing in ' + rem + '…';
        }
      }, 1000);
    });
  }

  /* ---------- Public API ---------- */

  /**
   * Full-screen interstitial ad.
   * Call after every 4th level win, never in the first 5 levels.
   * Skipped when adsRemoved is true.
   * @returns {Promise<void>}
   */
  async function showInterstitial() {
    if (_adsRemoved) return;        // REPLACE WITH REAL SDK
    await _showMockAd(3);           // REPLACE WITH REAL SDK: AdMob interstitial
  }

  /**
   * Rewarded video ad. Player watches voluntarily to earn a reward.
   * Always available even after purchasing Remove Ads.
   * @returns {Promise<boolean>} true if the ad was watched fully.
   */
  async function showRewarded() {
    // REPLACE WITH REAL SDK: AdMob rewarded video
    return _showMockAd(3);
  }

  /**
   * Purchase "Remove Ads" IAP.
   * @returns {Promise<boolean>} true if purchase succeeded.
   */
  async function purchaseRemoveAds() {
    // REPLACE WITH REAL SDK: Google Play Billing / App Store IAP
    _adsRemoved = true;
    try { localStorage.setItem(ADS_KEY, 'true'); } catch (e) { /* */ }
    return true;
  }

  /** Whether the user has purchased Remove Ads. */
  function isAdsRemoved() {
    return _adsRemoved;
  }

  /**
   * Restore a previous purchase (e.g. after reinstall).
   * @returns {Promise<boolean>} true if a purchase was found.
   */
  async function restorePurchases() {
    // REPLACE WITH REAL SDK: query store for prior purchases
    try { _adsRemoved = localStorage.getItem(ADS_KEY) === 'true'; } catch (e) { /* */ }
    return _adsRemoved;
  }

  return { init, showInterstitial, showRewarded, purchaseRemoveAds, isAdsRemoved, restorePurchases };
})();
