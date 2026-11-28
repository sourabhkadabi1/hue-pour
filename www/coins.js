// ============================================================
// HUE POUR — Coins stub  (TODO: replace with real economy)
// ============================================================
'use strict';

const Coins = (() => {
  const KEY = 'hp_coins';

  function getBalance() {
    try { return Math.max(0, parseInt(localStorage.getItem(KEY) || '0', 10)); }
    catch (e) { return 0; }
  }

  function setBalance(n) {
    try { localStorage.setItem(KEY, String(Math.max(0, n))); } catch (e) {}
  }

  /**
   * Spend `amount` coins.
   * Returns true if successful (balance deducted), false if insufficient.
   */
  function spend(amount) {
    // TODO: hook into real IAP / server-side coins when implemented
    const bal = getBalance();
    if (bal < amount) return false;
    setBalance(bal - amount);
    return true;
  }

  /** Add coins (e.g. from rewarded ad). */
  function earn(amount) {
    setBalance(getBalance() + amount);
  }

  return { getBalance, spend, earn };
})();
