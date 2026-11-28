// ============================================================
// HUE POUR — Coins Wallet Compatibility Bridge
// Delegates to Economy when loaded; falls back safely otherwise.
// ============================================================
'use strict';

const Coins = (() => {
  const KEY = 'hp_coins';

  function _readLegacy() {
    try {
      if (typeof localStorage === 'undefined') return 0;
      const v = parseInt(localStorage.getItem(KEY) || '0', 10);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function _writeLegacy(n) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(KEY, String(Math.max(0, Math.floor(n))));
    } catch (e) {}
  }

  function getBalance() {
    if (typeof Economy !== 'undefined' && Economy.getBalance) return Economy.getBalance();
    return _readLegacy();
  }

  function setBalance(amount) {
    if (typeof Economy !== 'undefined' && Economy.setBalance) return Economy.setBalance(amount);
    const next = Math.max(0, Math.floor(Number(amount) || 0));
    _writeLegacy(next);
    return next;
  }

  function canAfford(amount) {
    if (typeof Economy !== 'undefined' && Economy.canAfford) return Economy.canAfford(amount);
    return getBalance() >= (Number(amount) || 0);
  }

  function spend(amount) {
    if (typeof Economy !== 'undefined' && Economy.spend) return Economy.spend(amount);
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) return true;
    const bal = getBalance();
    if (bal < n) return false;
    _writeLegacy(bal - n);
    return true;
  }

  function earn(amount) {
    if (typeof Economy !== 'undefined' && Economy.earn) return Economy.earn(amount);
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    const bal = getBalance() + n;
    _writeLegacy(bal);
    return bal;
  }

  return { getBalance, setBalance, canAfford, spend, earn };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Coins;
}
