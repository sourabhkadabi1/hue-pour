// ============================================================
// HUE POUR — UI Layer  v2
// Rendering · Sound · Input · Animations · Daily · Challenge
// Tutorial · Share · Monetization integration
// ============================================================
'use strict';

/* ========== SOUND ENGINE (WebAudio) ========== */
const Sound = (() => {
  let ctx = null, enabled = true, ambOscs = null;

  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function note(freq, dur, type, vol) {
    if (!enabled) return;
    ensure();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  return {
    setEnabled(v) { enabled = v; if (!v) Sound.stopAmbience(); },
    select()  { note(880, 0.07, 'sine', 0.10); },
    btnClick(){ note(660, 0.05, 'sine', 0.08); },
    pour() {
      if (!enabled) return;
      ensure();
      const len = 0.28, buf = ctx.createBuffer(1, ctx.sampleRate * len | 0, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.10, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + len);
      s.connect(f); f.connect(g); g.connect(ctx.destination); s.start();
    },
    fuse() {
      if (!enabled) return;
      ensure();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(700, t);
      o.frequency.exponentialRampToValueAtTime(220, t + 0.35);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.45);
    },
    error() { note(160, 0.12, 'square', 0.07); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => note(f, 0.3, 'sine', 0.16), i * 140));
    },
    // Subtle ambient pad
    startAmbience() {
      if (!enabled || ambOscs) return;
      ensure();
      const g = ctx.createGain(); g.gain.value = 0.012;
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 164.81;
      o1.connect(g); o2.connect(g); g.connect(ctx.destination);
      o1.start(); o2.start();
      ambOscs = { o1, o2, g };
    },
    stopAmbience() {
      if (!ambOscs) return;
      try { ambOscs.o1.stop(); ambOscs.o2.stop(); } catch (e) { /* */ }
      ambOscs = null;
    },
  };
})();

/* ========== HAPTICS ========== */
const Haptic = (() => {
  let enabled = true;
  function vib(p) { if (enabled && navigator.vibrate) navigator.vibrate(p); }
  return {
    setEnabled(v) { enabled = v; },
    select() { vib(8); }, pour() { vib(15); },
    fuse()   { vib([20, 15, 40]); }, error() { vib([8, 8, 8]); },
  };
})();

/* ========== SAVE / LOAD ========== */
const Save = (() => {
  const KEY = 'hue_pour_save';
  function load() {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* */ }
  }
  return { load, save };
})();

/* ========== TOAST ========== */
const Toast = (() => {
  const el = document.getElementById('toast');
  let timer = null;
  return {
    show(msg, ms) {
      if (timer) clearTimeout(timer);
      el.textContent = msg;
      el.classList.remove('hidden');
      el.classList.add('show');
      timer = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.classList.add('hidden'), 350);
      }, ms || 2500);
    },
  };
})();

/* ========== SHARE HELPERS ========== */
async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ }
  }
  // fallback: clipboard
  try {
    await navigator.clipboard.writeText(text);
    Toast.show('Copied to clipboard!');
  } catch (e) {
    Toast.show('Could not share');
  }
}

async function shareOrDownloadCanvas(canvas, filename) {
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { /* cancelled */ }
    }
    // fallback: download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    Toast.show('Image saved!');
  }, 'image/png');
}

/* ========== SHARE CARD (canvas) ========== */
function renderShareCard(info) {
  const canvas = document.getElementById('share-canvas');
  const c = canvas.getContext('2d');
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;

  // gradient from target colours
  const cols = info.target.map(cl => COLOR_INFO[cl].hex);
  const grad = c.createLinearGradient(0, 0, W, H);
  cols.forEach((cl, i) => grad.addColorStop(i / Math.max(1, cols.length - 1), cl));
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  // darken
  c.fillStyle = 'rgba(0,0,0,0.52)'; c.fillRect(0, 0, W, H);

  // Title
  c.fillStyle = '#fff'; c.textAlign = 'center';
  c.font = 'bold 110px sans-serif';
  c.fillText('HUE POUR', W / 2, 320);

  // Subtitle
  c.font = '54px sans-serif'; c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillText(info.title, W / 2, 440);

  // Stars
  c.font = '120px sans-serif'; c.fillStyle = '#FFD700';
  const starStr = '\u2605'.repeat(info.stars) + '\u2606'.repeat(3 - info.stars);
  c.fillText(starStr, W / 2, 680);

  // Moves
  c.font = '64px sans-serif'; c.fillStyle = '#fff';
  c.fillText(info.moves + ' moves  (par ' + info.par + ')', W / 2, 840);

  // Colour palette tubes
  const palW = 100, gap = 24;
  const totalW = cols.length * palW + (cols.length - 1) * gap;
  let sx = (W - totalW) / 2;
  cols.forEach((cl, i) => {
    c.fillStyle = cl;
    c.beginPath();
    const x = sx + i * (palW + gap), y = 960;
    c.moveTo(x + 12, y);
    c.lineTo(x + palW - 12, y);
    c.quadraticCurveTo(x + palW, y, x + palW, y + 12);
    c.lineTo(x + palW, y + 180);
    c.quadraticCurveTo(x + palW, y + 200, x + palW - 20, y + 200);
    c.lineTo(x + 20, y + 200);
    c.quadraticCurveTo(x, y + 200, x, y + 180);
    c.lineTo(x, y + 12);
    c.quadraticCurveTo(x, y, x + 12, y);
    c.fill();
  });

  // Challenge code
  if (info.code) {
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '44px monospace';
    c.fillText(info.code, W / 2, 1340);
  }

  // Footer
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.font = '36px sans-serif';
  c.fillText('Can you beat my score?', W / 2, 1700);
}

/* ========== APP ========== */
const App = (() => {
  const $ = id => document.getElementById(id);

  const dom = {
    homeScreen:  $('home-screen'),
    app:         $('app'),
    homeLevelInfo: $('home-level-info'),
    homeStreak:  $('home-streak'),
    streakNum:   $('streak-num'),
    btnPlay:     $('btn-play'),
    btnDaily:    $('btn-daily'),
    codeInput:   $('code-input'),
    btnCodeGo:   $('btn-code-go'),
    btnHomeSettings: $('btn-home-settings'),

    tubeArea:    $('tube-area'),
    targetTubes: $('target-tubes'),
    hudLevel:    $('hud-level'),
    hudMoves:    $('hud-moves'),
    hudPar:      $('hud-par'),
    undoCount:   $('undo-count'),
    btnBack:     $('btn-back'),
    btnUndo:     $('btn-undo'),
    btnHint:     $('btn-hint'),
    btnRestart:  $('btn-restart'),
    btnSettings: $('btn-settings'),

    tutorialBar: $('tutorial-bar'),
    tutorialText:$('tutorial-text'),
    btnSkipTut:  $('btn-skip-tutorial'),

    winOverlay:  $('win-overlay'),
    winStars:    $('win-stars'),
    winInfo:     $('win-info'),
    winCodeBox:  $('win-code-box'),
    btnShareResult: $('btn-share-result'),
    btnShareCard:$('btn-share-card'),
    btnNext:     $('btn-next'),
    btnRemoveAdsWin: $('btn-remove-ads-win'),

    dailyDoneOverlay: $('daily-done-overlay'),
    dailyStars:  $('daily-stars'),
    dailyInfo:   $('daily-info'),
    dailyStreakLine: $('daily-streak-line'),
    dailyCountdownLine: $('daily-countdown-line'),
    btnDailyShare: $('btn-daily-share'),
    btnDailyShareCard: $('btn-daily-share-card'),
    btnDailyHome: $('btn-daily-home'),

    shareOverlay:$('share-overlay'),
    btnSaveImage:$('btn-save-image'),
    btnShareImage:$('btn-share-image'),
    btnCloseShare:$('btn-close-share'),

    settingsOverlay: $('settings-overlay'),
    setSound:     $('set-sound'),
    setHaptics:   $('set-haptics'),
    setColorblind:$('set-colorblind'),
    btnRemoveAds: $('btn-remove-ads'),
    btnRestore:   $('btn-restore'),
    btnCloseSettings: $('btn-close-settings'),
  };

  /* ---------- State ---------- */
  let state = {
    mode: 'home',  // 'home' | 'level' | 'daily' | 'challenge'
    levelNum: 1,
    tubes: [], target: [], par: 0,
    moveCount: 0,
    history: [],
    selectedTube: -1,
    animating: false,
    won: false,

    // undo / hint
    undosLeft: 3,
    FREE_UNDOS: 3,

    // daily
    dailyDayNum: 0,
    dailySeed: 0,

    // challenge
    challengeCode: '',
    challengeSeed: 0,
    challengeDiff: 0,

    // tutorial
    tutorialActive: false,
    hintMove: null,

    // monetization
    levelsCompleted: 0,  // total levels completed
  };

  let settings = { sound: true, haptics: true, colorblind: false };
  let bestResults = {};
  let dailyData = { streak: 0, lastDate: '', results: {} };
  let tutorialDone = {};

  /* ---------- Init ---------- */
  function init() {
    loadSave();
    parseURL();
    applySettings();
    bindEvents();
    Monetization.init();
    updateHomeScreen();

    // If URL specified level or seed, go straight to game
    if (state._jumpLevel) {
      startLevel(state._jumpLevel);
    }
  }

  function parseURL() {
    const p = new URLSearchParams(window.location.search);
    if (p.has('level')) {
      const n = parseInt(p.get('level'), 10);
      if (n > 0) { state.levelNum = n; state._jumpLevel = n; }
    }
    if (p.has('seed')) state._forcedSeed = parseInt(p.get('seed'), 10);
  }

  function loadSave() {
    const d = Save.load();
    if (!d) return;
    if (d.levelNum) state.levelNum = d.levelNum;
    if (d.settings) settings = { ...settings, ...d.settings };
    if (d.best)     bestResults = d.best;
    if (d.daily)    dailyData = { ...dailyData, ...d.daily };
    if (d.tutorialDone) tutorialDone = d.tutorialDone;
    if (d.levelsCompleted) state.levelsCompleted = d.levelsCompleted;
  }

  function persistSave() {
    Save.save({
      levelNum: state.levelNum,
      settings,
      best: bestResults,
      daily: dailyData,
      tutorialDone,
      levelsCompleted: state.levelsCompleted,
    });
  }

  /* ---------- Settings ---------- */
  function applySettings() {
    Sound.setEnabled(settings.sound);
    Haptic.setEnabled(settings.haptics);
    document.body.classList.toggle('colorblind', settings.colorblind);
    dom.setSound.checked     = settings.sound;
    dom.setHaptics.checked   = settings.haptics;
    dom.setColorblind.checked = settings.colorblind;
    // Update remove-ads buttons
    if (Monetization.isAdsRemoved()) {
      dom.btnRemoveAds.textContent = 'Ads Removed ✓';
      dom.btnRemoveAds.disabled = true;
      dom.btnRemoveAdsWin.classList.add('hidden');
    }
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    // Home
    dom.btnPlay.addEventListener('click', () => { Sound.btnClick(); startLevel(state.levelNum); });
    dom.btnDaily.addEventListener('click', () => { Sound.btnClick(); startDaily(); });
    dom.btnCodeGo.addEventListener('click', () => { Sound.btnClick(); loadChallengeCode(); });
    dom.codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadChallengeCode(); });
    dom.btnHomeSettings.addEventListener('click', () => { Sound.btnClick(); toggleOverlay(dom.settingsOverlay, true); });

    // Game HUD
    dom.btnBack.addEventListener('click', () => { Sound.btnClick(); goHome(); });
    dom.btnUndo.addEventListener('click', onUndoClick);
    dom.btnHint.addEventListener('click', onHintClick);
    dom.btnRestart.addEventListener('click', () => { Sound.btnClick(); restart(); });
    dom.btnSettings.addEventListener('click', () => { Sound.btnClick(); toggleOverlay(dom.settingsOverlay, true); });

    // Tutorial
    dom.btnSkipTut.addEventListener('click', () => { skipTutorial(); });

    // Win
    dom.btnNext.addEventListener('click', () => { Sound.btnClick(); nextLevel(); });
    dom.btnShareResult.addEventListener('click', () => shareResultText());
    dom.btnShareCard.addEventListener('click', () => openShareCard());
    dom.btnRemoveAdsWin.addEventListener('click', () => purchaseRemoveAds());

    // Daily done
    dom.btnDailyShare.addEventListener('click', () => shareDailyText());
    dom.btnDailyShareCard.addEventListener('click', () => openShareCard());
    dom.btnDailyHome.addEventListener('click', () => { Sound.btnClick(); goHome(); });

    // Share card overlay
    dom.btnSaveImage.addEventListener('click', () => {
      shareOrDownloadCanvas(document.getElementById('share-canvas'), 'hue-pour-share.png');
    });
    dom.btnShareImage.addEventListener('click', () => {
      shareOrDownloadCanvas(document.getElementById('share-canvas'), 'hue-pour-share.png');
    });
    dom.btnCloseShare.addEventListener('click', () => toggleOverlay(dom.shareOverlay, false));

    // Settings
    dom.setSound.addEventListener('change', () => {
      settings.sound = dom.setSound.checked; applySettings();
    });
    dom.setHaptics.addEventListener('change', () => {
      settings.haptics = dom.setHaptics.checked; applySettings();
    });
    dom.setColorblind.addEventListener('change', () => {
      settings.colorblind = dom.setColorblind.checked; applySettings();
    });
    dom.btnRemoveAds.addEventListener('click', () => purchaseRemoveAds());
    dom.btnRestore.addEventListener('click', async () => {
      await Monetization.restorePurchases();
      applySettings();
      Toast.show(Monetization.isAdsRemoved() ? 'Purchases restored!' : 'No purchases found');
    });
    dom.btnCloseSettings.addEventListener('click', () => {
      toggleOverlay(dom.settingsOverlay, false);
      persistSave();
    });
  }

  function toggleOverlay(el, show) {
    el.classList.toggle('hidden', !show);
    el.setAttribute('aria-hidden', String(!show));
  }

  /* ================================================================
     HOME SCREEN
     ================================================================ */
  function updateHomeScreen() {
    dom.homeLevelInfo.textContent = 'Level ' + state.levelNum;

    // Daily streak
    updateStreakDisplay();

    // Check if daily already done today
    const todayStr = getTodayStr();
    if (dailyData.results[todayStr]) {
      dom.btnDaily.textContent = '📅 Daily ✓ Done';
    } else {
      dom.btnDaily.textContent = '📅 Daily Puzzle';
    }
  }

  function updateStreakDisplay() {
    if (dailyData.streak > 0) {
      dom.homeStreak.classList.remove('hidden');
      dom.streakNum.textContent = dailyData.streak;
    } else {
      dom.homeStreak.classList.add('hidden');
    }
  }

  function goHome() {
    Sound.stopAmbience();
    state.mode = 'home';
    state.animating = false;
    state.won = false;
    state.hintMove = null;
    dom.app.classList.add('hidden');
    dom.homeScreen.classList.remove('hidden');
    toggleOverlay(dom.winOverlay, false);
    toggleOverlay(dom.dailyDoneOverlay, false);
    toggleOverlay(dom.shareOverlay, false);
    dom.tutorialBar.classList.add('hidden');
    updateHomeScreen();
    persistSave();
  }

  function showGameScreen(title) {
    dom.homeScreen.classList.add('hidden');
    dom.app.classList.remove('hidden');
    dom.hudLevel.textContent = title;
    Sound.startAmbience();
  }

  /* ================================================================
     START MODES
     ================================================================ */
  function startLevel(num) {
    state.mode = 'level';
    state.levelNum = num;
    state.won = false;
    state.moveCount = 0;
    state.history = [];
    state.selectedTube = -1;
    state.animating = false;
    state.undosLeft = state.FREE_UNDOS;
    state.hintMove = null;

    toggleOverlay(dom.winOverlay, false);

    const seed  = state._forcedSeed !== undefined ? state._forcedSeed : undefined;
    const level = generateLevel(num, seed);
    state.tubes  = level.tubes;
    state.target = level.target;
    state.par    = level.par;
    state._currentSeed = level.seed;
    state._currentDiff = level.target.length;

    showGameScreen('Level ' + num);
    renderAll();
    persistSave();
    maybeStartTutorial(num);
  }

  function startDaily() {
    const todayStr = getTodayStr();
    // If already completed today, show the done overlay
    if (dailyData.results[todayStr]) {
      showDailyDone(dailyData.results[todayStr]);
      return;
    }

    state.mode = 'daily';
    state.won = false;
    state.moveCount = 0;
    state.history = [];
    state.selectedTube = -1;
    state.animating = false;
    state.undosLeft = state.FREE_UNDOS;
    state.hintMove = null;

    const level = generateDailyLevel();
    state.tubes  = level.tubes;
    state.target = level.target;
    state.par    = level.par;
    state.dailyDayNum = level.dayNum;
    state.dailySeed   = level.seed;
    state._currentSeed = level.seed;
    state._currentDiff = level.target.length;

    showGameScreen('Daily #' + level.dayNum);
    renderAll();
  }

  function loadChallengeCode() {
    const raw = dom.codeInput.value.trim();
    if (!raw) return;
    const decoded = decodeChallenge(raw);
    if (!decoded) {
      Toast.show('Invalid code — check and try again');
      return;
    }

    const level = generateChallengeLevel(decoded.seed, decoded.difficulty);
    if (!level) {
      Toast.show('Could not load this puzzle');
      return;
    }

    state.mode = 'challenge';
    state.won = false;
    state.moveCount = 0;
    state.history = [];
    state.selectedTube = -1;
    state.animating = false;
    state.undosLeft = state.FREE_UNDOS;
    state.hintMove = null;
    state.challengeCode = raw.toUpperCase();
    state.challengeSeed = level.seed;
    state.challengeDiff = level.difficulty;

    state.tubes  = level.tubes;
    state.target = level.target;
    state.par    = level.par;
    state._currentSeed = level.seed;
    state._currentDiff = level.difficulty;

    showGameScreen('Challenge');
    renderAll();
    dom.codeInput.value = '';
  }

  /* ================================================================
     TUTORIAL
     ================================================================ */
  function maybeStartTutorial(levelNum) {
    if (levelNum > 3 || tutorialDone[levelNum]) {
      state.tutorialActive = false;
      dom.tutorialBar.classList.add('hidden');
      return;
    }
    state.tutorialActive = true;
    showTutorialHint();
  }

  function showTutorialHint() {
    if (!state.tutorialActive) return;
    const hint = getHint(state.tubes, state.target);
    if (!hint) {
      skipTutorial();
      return;
    }
    state.hintMove = hint;

    // Build tutorial text
    const srcTop = tubeTop(state.tubes[hint.src]);
    const dstTop = tubeTop(state.tubes[hint.dst]);
    let text;
    if (hint.type === 'fuse') {
      const result = getFusionResult(srcTop, dstTop);
      text = 'Pour ' + COLOR_INFO[srcTop].name + ' onto ' +
             COLOR_INFO[dstTop].name + ' to make ' + COLOR_INFO[result].name + '!';
    } else if (!state.tubes[hint.dst].length) {
      text = 'Move ' + COLOR_INFO[srcTop].name + ' to the empty tube';
    } else {
      text = 'Pour ' + COLOR_INFO[srcTop].name + ' to group the colors';
    }
    dom.tutorialText.textContent = text;
    dom.tutorialBar.classList.remove('hidden');

    // Highlight tubes
    renderTubes();
  }

  function skipTutorial() {
    state.tutorialActive = false;
    state.hintMove = null;
    dom.tutorialBar.classList.add('hidden');
    tutorialDone[state.levelNum] = true;
    persistSave();
    renderTubes();
  }

  /* ================================================================
     RENDER
     ================================================================ */
  function renderAll() {
    renderHUD();
    renderTarget();
    renderTubes();
  }

  function renderHUD() {
    dom.hudMoves.textContent = 'Moves: ' + state.moveCount;
    dom.hudPar.textContent   = 'Par: ' + state.par;
    dom.undoCount.textContent = '(' + state.undosLeft + ')';
  }

  function renderTarget() {
    dom.targetTubes.innerHTML = '';
    for (const color of state.target) {
      const info = COLOR_INFO[color];
      const tube = document.createElement('div');
      tube.className = 'target-tube';
      for (let i = 0; i < TUBE_CAPACITY; i++) {
        const u = document.createElement('div');
        u.className = 'target-unit';
        u.style.background = info.hex;
        const cb = document.createElement('span');
        cb.className = 'cb';
        cb.textContent = info.symbol;
        u.appendChild(cb);
        tube.appendChild(u);
      }
      dom.targetTubes.appendChild(tube);
    }
  }

  function renderTubes() {
    dom.tubeArea.innerHTML = '';
    state.tubes.forEach((tube, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'tube-wrapper';
      if (idx === state.selectedTube) wrapper.classList.add('selected');
      // Tutorial / hint highlights
      if (state.hintMove) {
        if (idx === state.hintMove.src) wrapper.classList.add('hint-src');
        if (idx === state.hintMove.dst) wrapper.classList.add('hint-dst');
      }
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('aria-label',
        'Tube ' + (idx + 1) + (tube.length ? ': ' + tube.map(c => COLOR_INFO[c].name).join(', ') : ': empty'));
      wrapper.addEventListener('click', () => onTubeTap(idx));

      const tubeEl = document.createElement('div');
      tubeEl.className = 'tube';
      tubeEl.id = 'tube-' + idx;

      tube.forEach((color, ui) => {
        const unit = document.createElement('div');
        unit.className = 'liquid-unit';
        unit.dataset.unitIndex = ui;
        const info = COLOR_INFO[color];
        unit.style.background = info.hex;
        const cb = document.createElement('span');
        cb.className = 'cb';
        cb.textContent = info.symbol;
        unit.appendChild(cb);
        tubeEl.appendChild(unit);
      });

      wrapper.appendChild(tubeEl);
      dom.tubeArea.appendChild(wrapper);
    });
  }

  /* ================================================================
     INTERACTION
     ================================================================ */
  function onTubeTap(idx) {
    if (state.animating || state.won) return;

    if (state.selectedTube < 0) {
      if (!state.tubes[idx].length) return;
      state.selectedTube = idx;
      Sound.select(); Haptic.select();
      renderTubes();
      return;
    }

    if (state.selectedTube === idx) {
      state.selectedTube = -1;
      renderTubes();
      return;
    }

    const si = state.selectedTube;
    const analysis = analyzePour(state.tubes, si, idx);

    if (analysis.type === 'illegal') {
      Sound.error(); Haptic.error();
      state.selectedTube = -1;
      renderTubes();
      shakeAnim(si, idx);
      return;
    }

    state.animating = true;
    state.selectedTube = -1;
    state.history.push(cloneTubes(state.tubes));

    if (analysis.type === 'move') animateMove(si, idx, analysis.units);
    else animateFuse(si, idx, analysis.result);
  }

  /* ---------- Animations ---------- */
  function getUnitRect(tubeIdx, unitIdx) {
    const tubeEl = document.getElementById('tube-' + tubeIdx);
    if (!tubeEl) return null;
    const units = tubeEl.querySelectorAll('.liquid-unit');
    return units[unitIdx] ? units[unitIdx].getBoundingClientRect() : null;
  }

  function animateMove(si, di, units) {
    const srcTube = state.tubes[si];
    const color = srcTube[srcTube.length - 1];
    const info = COLOR_INFO[color];
    const srcRects = [];
    for (let i = 0; i < units; i++) {
      const r = getUnitRect(si, srcTube.length - 1 - i);
      if (r) srcRects.push(r);
    }

    const result = executePour(state.tubes, si, di);
    state.tubes = result.newTubes;
    state.moveCount++;

    const dstFilled = state.tubes[di].length;
    const tubeEl = document.getElementById('tube-' + di);
    const tubeRect = tubeEl ? tubeEl.getBoundingClientRect() : null;
    const unitH = tubeRect ? tubeRect.height / TUBE_CAPACITY : 42;

    const flyers = srcRects.map((sr, i) => {
      const fly = document.createElement('div');
      fly.className = 'flying-unit';
      fly.style.background = info.hex;
      fly.style.width = sr.width + 'px';
      fly.style.height = sr.height + 'px';
      fly.style.left = sr.left + 'px';
      fly.style.top = sr.top + 'px';
      if (settings.colorblind) {
        const cb = document.createElement('span');
        cb.className = 'cb'; cb.style.display = 'block';
        cb.textContent = info.symbol; fly.appendChild(cb);
      }
      document.body.appendChild(fly);
      return { el: fly, index: i };
    });

    // Render source without poured units
    const tubesWithoutNew = cloneTubes(state.tubes);
    for (let i = 0; i < units; i++) tubesWithoutNew[di].pop();
    const saved = state.tubes;
    state.tubes = tubesWithoutNew;
    renderTubes();
    state.tubes = saved;

    Sound.pour(); Haptic.pour();

    requestAnimationFrame(() => {
      const destEl = document.getElementById('tube-' + di);
      const destRect = destEl ? destEl.getBoundingClientRect() : null;
      flyers.forEach(({ el, index }) => {
        const destUI = dstFilled - units + index;
        const dy = destRect ? destRect.bottom - (destUI + 1) * unitH : 0;
        const dx = destRect ? destRect.left + 2 : 0;
        el.style.transform = 'translate(' +
          (dx - parseFloat(el.style.left)) + 'px, ' +
          (dy - parseFloat(el.style.top)) + 'px)';
      });
    });

    setTimeout(() => {
      flyers.forEach(f => f.el.remove());
      renderAll();
      state.animating = false;
      afterMove();
    }, 380);
  }

  function animateFuse(si, di, fusionResult) {
    const srcColor = tubeTop(state.tubes[si]);
    const info = COLOR_INFO[srcColor];
    const srcRect = getUnitRect(si, state.tubes[si].length - 1);

    const result = executePour(state.tubes, si, di);
    state.tubes = result.newTubes;
    state.moveCount++;

    if (srcRect) {
      const fly = document.createElement('div');
      fly.className = 'flying-unit';
      fly.style.background = info.hex;
      fly.style.width = srcRect.width + 'px';
      fly.style.height = srcRect.height + 'px';
      fly.style.left = srcRect.left + 'px';
      fly.style.top = srcRect.top + 'px';
      if (settings.colorblind) {
        const cb = document.createElement('span');
        cb.className = 'cb'; cb.style.display = 'block';
        cb.textContent = info.symbol; fly.appendChild(cb);
      }
      document.body.appendChild(fly);
      Sound.pour(); Haptic.pour();

      const dstRect = getUnitRect(di, state.tubes[di].length - 1);
      if (dstRect) {
        requestAnimationFrame(() => {
          fly.style.transform = 'translate(' +
            (dstRect.left - srcRect.left) + 'px, ' +
            (dstRect.top - srcRect.top) + 'px)';
          fly.style.opacity = '0.5';
        });
      }

      setTimeout(() => {
        fly.remove();
        renderAll();
        // Glow on fused unit
        const tubeEl = document.getElementById('tube-' + di);
        const units = tubeEl ? tubeEl.querySelectorAll('.liquid-unit') : [];
        const topUnit = units[state.tubes[di].length - 1];
        if (topUnit) topUnit.classList.add('fusing');
        Sound.fuse(); Haptic.fuse();
        setTimeout(() => { state.animating = false; afterMove(); }, 500);
      }, 350);
    } else {
      renderAll();
      Sound.fuse(); Haptic.fuse();
      state.animating = false;
      setTimeout(() => afterMove(), 100);
    }
  }

  function shakeAnim(si, di) {
    const wrappers = dom.tubeArea.querySelectorAll('.tube-wrapper');
    [si, di].forEach(idx => {
      if (wrappers[idx]) {
        wrappers[idx].classList.add('shake');
        setTimeout(() => wrappers[idx].classList.remove('shake'), 400);
      }
    });
  }

  /* ---------- After every move ---------- */
  function afterMove() {
    // Clear hint highlight
    state.hintMove = null;

    // Update tutorial
    if (state.tutorialActive) showTutorialHint();

    // Check win
    if (checkWin(state.tubes, state.target)) {
      state.won = true;
      onWin();
    }
  }

  /* ================================================================
     WIN
     ================================================================ */
  function onWin() {
    const moves = state.moveCount;
    const par   = state.par;
    let stars = 1;
    if (moves <= par)         stars = 3;
    else if (moves <= par + 3) stars = 2;

    state.levelsCompleted++;

    // Skip tutorial for this level
    if (state.tutorialActive) skipTutorial();

    // Build challenge code
    const code = encodeChallenge(state._currentSeed, state._currentDiff);

    if (state.mode === 'daily') {
      onDailyWin(moves, par, stars, code);
      return;
    }

    // Record best
    const prev = bestResults[state.levelNum];
    if (!prev || stars > prev.stars || (stars === prev.stars && moves < prev.moves)) {
      bestResults[state.levelNum] = { moves, stars };
    }
    if (state.mode === 'level') state.levelNum++;
    persistSave();

    // Show win screen after a beat
    setTimeout(() => {
      renderStars(dom.winStars, stars);
      dom.winInfo.innerHTML =
        'Moves: <strong>' + moves + '</strong> &nbsp;|&nbsp; Par: <strong>' + par + '</strong>';
      dom.winCodeBox.textContent = code;
      state._winCode = code;
      state._winStars = stars;

      // Show remove-ads button if applicable
      if (!Monetization.isAdsRemoved() && state.levelsCompleted > 5) {
        dom.btnRemoveAdsWin.classList.remove('hidden');
      }

      Sound.win();
      toggleOverlay(dom.winOverlay, true);

      // Interstitial after every 4th level, never in first 5
      maybeShowInterstitial();
    }, 400);
  }

  function onDailyWin(moves, par, stars, code) {
    const todayStr = getTodayStr();
    dailyData.results[todayStr] = { moves, par, stars, code, dayNum: state.dailyDayNum };

    // Update streak
    const yesterday = getDateStr(new Date(Date.now() - 86400000));
    if (dailyData.lastDate === yesterday || dailyData.lastDate === todayStr) {
      dailyData.streak++;
    } else {
      dailyData.streak = 1;
    }
    dailyData.lastDate = todayStr;
    state._winCode = code;
    state._winStars = stars;
    persistSave();

    setTimeout(() => {
      showDailyDone({ moves, par, stars, code, dayNum: state.dailyDayNum });
      Sound.win();
    }, 400);
  }

  function showDailyDone(result) {
    renderStars(dom.dailyStars, result.stars);
    dom.dailyInfo.innerHTML =
      'Moves: <strong>' + result.moves + '</strong> &nbsp;|&nbsp; Par: <strong>' + result.par + '</strong>';
    dom.dailyStreakLine.textContent = '🔥 ' + dailyData.streak + ' day streak';

    // Countdown to next daily
    updateDailyCountdown();

    toggleOverlay(dom.dailyDoneOverlay, true);
  }

  function updateDailyCountdown() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const diff = tomorrow - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    dom.dailyCountdownLine.textContent =
      'Come back tomorrow! ⏱ ' + h + 'h ' + m + 'm ' + s + 's';
  }

  function renderStars(container, count) {
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      s.className = i < count ? 'star-on' : 'star-off';
      container.appendChild(s);
    }
  }

  /* ---------- Share ---------- */
  function shareResultText() {
    const code = state._winCode || '';
    const target = state.target;
    const emojis = target.map(c => COLOR_EMOJI[c] || '').join('');
    let title;
    if (state.mode === 'daily') {
      title = 'Hue Pour Daily #' + state.dailyDayNum;
    } else if (state.mode === 'challenge') {
      title = 'Hue Pour Challenge ' + state.challengeCode;
    } else {
      title = 'Hue Pour Level ' + (state.levelNum - 1);
    }
    const text = title + ' — solved in ' + state.moveCount +
                 ' moves (par ' + state.par + ') ' + emojis +
                 (code ? '\n' + code : '');
    shareText(text);
  }

  function shareDailyText() {
    const todayStr = getTodayStr();
    const result = dailyData.results[todayStr];
    if (!result) return;
    const emojis = state.target.map(c => COLOR_EMOJI[c] || '').join('');
    const text = 'Hue Pour #' + result.dayNum + ' — solved in ' +
                 result.moves + ' moves (par ' + result.par + ') ' + emojis;
    shareText(text);
  }

  function openShareCard() {
    const title = state.mode === 'daily'
      ? 'Daily #' + state.dailyDayNum
      : state.mode === 'challenge'
        ? 'Challenge'
        : 'Level ' + (state.mode === 'level' ? state.levelNum - 1 : state.levelNum);
    renderShareCard({
      title,
      target: state.target,
      moves: state.moveCount,
      par: state.par,
      stars: state._winStars || 1,
      code: state._winCode || '',
    });
    toggleOverlay(dom.shareOverlay, true);
  }

  /* ---------- Monetization integration ---------- */
  async function maybeShowInterstitial() {
    if (state.levelsCompleted <= 5) return;
    if (state.levelsCompleted % 4 !== 0) return;
    await Monetization.showInterstitial();
  }

  async function purchaseRemoveAds() {
    const ok = await Monetization.purchaseRemoveAds();
    if (ok) {
      Toast.show('Ads removed! Thank you!');
      applySettings();
    }
  }

  /* ---------- Undo ---------- */
  function onUndoClick() {
    Sound.btnClick();
    if (state.animating || state.won) return;

    if (state.undosLeft > 0 && state.history.length > 0) {
      state.tubes = state.history.pop();
      state.moveCount = Math.max(0, state.moveCount - 1);
      state.selectedTube = -1;
      state.undosLeft--;
      state.hintMove = null;
      renderAll();
      if (state.tutorialActive) showTutorialHint();
      return;
    }

    if (state.history.length === 0) {
      Toast.show('Nothing to undo');
      return;
    }

    // Out of free undos — offer rewarded ad
    Toast.show('Watch a short ad for 3 more undos');
    Monetization.showRewarded().then(ok => {
      if (ok) {
        state.undosLeft += 3;
        Toast.show('+3 undos!');
        renderHUD();
      }
    });
  }

  /* ---------- Hint ---------- */
  function onHintClick() {
    Sound.btnClick();
    if (state.animating || state.won) return;

    // Rewarded ad for hint
    Toast.show('Watch a short ad for a hint');
    Monetization.showRewarded().then(ok => {
      if (ok) {
        const hint = getHint(state.tubes, state.target);
        if (hint) {
          state.hintMove = hint;
          renderTubes();
          const srcTop = tubeTop(state.tubes[hint.src]);
          const dstStr = state.tubes[hint.dst].length
            ? COLOR_INFO[tubeTop(state.tubes[hint.dst])].name
            : 'empty tube';
          Toast.show('Try ' + COLOR_INFO[srcTop].name + ' → ' + dstStr, 3500);
        } else {
          Toast.show('No hint available');
        }
      }
    });
  }

  /* ---------- Controls ---------- */
  function restart() {
    if (state.animating) return;
    if (state.mode === 'daily')     startDaily();
    else if (state.mode === 'challenge') loadChallengeFromState();
    else startLevel(state.levelNum);
  }

  function loadChallengeFromState() {
    const level = generateChallengeLevel(state.challengeSeed, state.challengeDiff);
    if (!level) return;
    state.won = false; state.moveCount = 0; state.history = [];
    state.selectedTube = -1; state.animating = false;
    state.undosLeft = state.FREE_UNDOS; state.hintMove = null;
    state.tubes = level.tubes; state.target = level.target; state.par = level.par;
    renderAll();
  }

  function nextLevel() {
    state._forcedSeed = undefined;
    startLevel(state.levelNum);
  }

  /* ---------- Helpers ---------- */
  function getTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function getDateStr(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ---------- Boot ---------- */
  init();

  return { state, startLevel, goHome };
})();
