// ============================================================
// HUE POUR — UI Layer  v3
// Canvas liquid rendering · Pour/tilt animations · Particles
// Fusion effects · Sound · Input · Daily · Challenge
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
    bloop() {
      if (!enabled) return;
      ensure();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(400, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.2);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.3);
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

/* ========== LIQUID RENDERER (draws liquid bands on a canvas) ========== */
const LiquidRenderer = (() => {
  /**
   * Setup canvas for HiDPI.
   * @param {HTMLCanvasElement} cvs
   * @param {number} w CSS width
   * @param {number} h CSS height
   */
  function setup(cvs, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = w * dpr;
    cvs.height = h * dpr;
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  }

  /**
   * Draw liquid bands into a tube canvas.
   * @param {HTMLCanvasElement} cvs
   * @param {Array} bands  [{color, units}]  — units can be fractional
   * @param {object} opts  { w, h, waveAmp, wavePhase, colorblind }
   */
  function draw(cvs, bands, opts) {
    const w = opts.w, h = opts.h;
    const ctx = setup(cvs, w, h);
    ctx.clearRect(0, 0, w, h);

    if (!bands.length) return;

    const totalUnits = bands.reduce((s, b) => s + b.units, 0);
    if (totalUnits <= 0) return;

    const radius = Math.min(w * 0.35, 18);

    // Draw from bottom up
    let y = h; // current bottom position
    for (let bi = 0; bi < bands.length; bi++) {
      const band = bands[bi];
      const bandH = (band.units / TUBE_CAPACITY) * h;
      if (bandH <= 0) continue;

      const top = y - bandH;
      const isTopBand = (bi === bands.length - 1);

      ctx.save();

      // Clip to tube rounded-bottom shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h - radius);
      ctx.quadraticCurveTo(w, h, w - radius, h);
      ctx.lineTo(radius, h);
      ctx.quadraticCurveTo(0, h, 0, h - radius);
      ctx.closePath();
      ctx.clip();

      // Fill band
      ctx.fillStyle = COLOR_INFO[band.color].hex;
      ctx.beginPath();

      if (isTopBand && opts.waveAmp && opts.waveAmp > 0.5) {
        // Wavy top surface
        const amp = opts.waveAmp;
        const phase = opts.wavePhase || 0;
        ctx.moveTo(0, top);
        for (let x = 0; x <= w; x += 2) {
          const wy = top + Math.sin((x / w) * Math.PI * 2 + phase) * amp;
          ctx.lineTo(x, wy);
        }
      } else {
        ctx.moveTo(0, top);
        ctx.lineTo(w, top);
      }

      ctx.lineTo(w, y);
      ctx.lineTo(0, y);
      ctx.closePath();
      ctx.fill();

      // Subtle separator line between bands
      if (bi > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Glossy gradient overlay on band
      const glossGrad = ctx.createLinearGradient(0, top, w * 0.6, top + bandH);
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      glossGrad.addColorStop(0.4, 'rgba(255,255,255,0.06)');
      glossGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glossGrad;
      ctx.fillRect(0, top, w, bandH);

      // Colorblind symbol
      if (opts.colorblind) {
        const info = COLOR_INFO[band.color];
        const symSize = Math.min(14, bandH * 0.6);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.font = 'bold ' + symSize + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.symbol, w / 2, top + bandH / 2);
      }

      ctx.restore();
      y = top;
    }
  }

  return { setup, draw };
})();

/* ========== PARTICLE SYSTEM ========== */
const Particles = (() => {
  const MAX = 50;
  let pool = [];
  let enabled = true;

  function emit(x, y, color, count, opts) {
    if (!enabled) return;
    opts = opts || {};
    const actual = Math.min(count, MAX - pool.length);
    for (let i = 0; i < actual; i++) {
      pool.push({
        x, y,
        vx: (Math.random() - 0.5) * (opts.spread || 60),
        vy: -(Math.random() * (opts.upSpeed || 80) + 20),
        color: color,
        radius: Math.random() * 2.5 + 1,
        life: 1,
        decay: 0.6 + Math.random() * 0.8,
        gravity: opts.gravity !== undefined ? opts.gravity : 60,
      });
    }
  }

  function update(dt) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) pool.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of pool) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function clear() { pool.length = 0; }
  function active() { return pool.length > 0; }
  function setEnabled(v) { enabled = v; if (!v) clear(); }

  return { emit, update, draw, clear, active, setEnabled };
})();

/* ========== VISUAL BANDS HELPER ========== */
function getVisualBands(tube) {
  if (!tube.length) return [];
  const bands = [];
  let cur = tube[0], count = 1;
  for (let i = 1; i < tube.length; i++) {
    if (tube[i] === cur) {
      count++;
    } else {
      bands.push({ color: cur, units: count });
      cur = tube[i];
      count = 1;
    }
  }
  bands.push({ color: cur, units: count });
  return bands;
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
    setReduce:    $('set-reduce'),
    btnRemoveAds: $('btn-remove-ads'),
    btnRestore:   $('btn-restore'),
    btnCloseSettings: $('btn-close-settings'),

    animOverlay: $('anim-overlay'),
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

  let settings = { sound: true, haptics: true, colorblind: false, reduceEffects: false };
  let bestResults = {};
  let dailyData = { streak: 0, lastDate: '', results: {} };
  let tutorialDone = {};

  // Animation state
  let tubeEls = [];   // [{wrapper, tube, canvas}] - cached DOM references
  let overlayCtx = null;
  let animRafId = null;
  let waves = {};  // tubeIdx -> { amp, phase, vel, lastTime }
  let lastFrameTime = 0;

  // Pour animation state
  let pourAnim = null;  // current pour animation data

  /* ---------- Tube sizing ---------- */
  function computeTubeSize(tubeCount) {
    const area = dom.tubeArea;
    const areaW = area.clientWidth - 16; // padding
    const areaH = area.clientHeight - 20;

    let cols, tubeW;
    if (tubeCount <= 4) {
      cols = tubeCount;
      tubeW = Math.min(90, Math.floor((areaW - (cols - 1) * 12) / cols));
    } else if (tubeCount <= 6) {
      cols = tubeCount;
      tubeW = Math.min(72, Math.floor((areaW - (cols - 1) * 10) / cols));
    } else {
      // Two rows
      cols = Math.ceil(tubeCount / 2);
      tubeW = Math.min(64, Math.floor((areaW - (cols - 1) * 10) / cols));
    }

    tubeW = Math.max(42, tubeW);
    const tubeH = Math.min(Math.floor(tubeW * 2.8), Math.floor(areaH * (tubeCount > 6 ? 0.42 : 0.7)));
    const gap = Math.max(6, Math.min(14, Math.floor((areaW - cols * tubeW) / Math.max(1, cols - 1))));

    document.documentElement.style.setProperty('--tube-w', tubeW + 'px');
    document.documentElement.style.setProperty('--tube-h', tubeH + 'px');
    document.documentElement.style.setProperty('--tube-gap', gap + 'px');

    return { tubeW, tubeH, gap };
  }

  /* ---------- Overlay canvas ---------- */
  function initOverlay() {
    const cvs = dom.animOverlay;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = window.innerWidth * dpr;
    cvs.height = window.innerHeight * dpr;
    cvs.style.width = window.innerWidth + 'px';
    cvs.style.height = window.innerHeight + 'px';
    overlayCtx = cvs.getContext('2d');
    overlayCtx.scale(dpr, dpr);
  }

  function clearOverlay() {
    if (!overlayCtx) return;
    const cvs = dom.animOverlay;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    overlayCtx.clearRect(0, 0, cvs.width, cvs.height);
    overlayCtx.scale(dpr, dpr);
  }

  /* ---------- Init ---------- */
  function init() {
    loadSave();
    parseURL();
    applySettings();
    bindEvents();
    Monetization.init();
    updateHomeScreen();
    initOverlay();
    window.addEventListener('resize', () => {
      initOverlay();
      if (state.mode !== 'home' && !state.animating) {
        renderTubes();
      }
    });

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
    document.body.classList.toggle('reduce-effects', settings.reduceEffects);
    Particles.setEnabled(!settings.reduceEffects);
    dom.setSound.checked     = settings.sound;
    dom.setHaptics.checked   = settings.haptics;
    dom.setColorblind.checked = settings.colorblind;
    dom.setReduce.checked    = settings.reduceEffects;
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
      if (state.mode !== 'home') renderTubes();
    });
    dom.setReduce.addEventListener('change', () => {
      settings.reduceEffects = dom.setReduce.checked; applySettings();
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
    pourAnim = null;
    if (animRafId) { cancelAnimationFrame(animRafId); animRafId = null; }
    Particles.clear();
    clearOverlay();
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
    initOverlay();
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
    waves = {};
    pourAnim = null;

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
    waves = {};
    pourAnim = null;

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
    waves = {};
    pourAnim = null;

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
    tubeEls = [];

    const size = computeTubeSize(state.tubes.length);

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

      // Canvas for liquid rendering
      const cvs = document.createElement('canvas');
      cvs.className = 'tube-liquid';
      tubeEl.appendChild(cvs);

      wrapper.appendChild(tubeEl);
      dom.tubeArea.appendChild(wrapper);

      tubeEls.push({ wrapper, tube: tubeEl, canvas: cvs });

      // Draw liquid
      const innerW = size.tubeW - 4;
      const innerH = size.tubeH - 2;
      const bands = getVisualBands(tube);
      const waveState = waves[idx];
      LiquidRenderer.draw(cvs, bands, {
        w: innerW, h: innerH,
        waveAmp: waveState ? waveState.amp : 0,
        wavePhase: waveState ? waveState.phase : 0,
        colorblind: settings.colorblind,
      });
    });
  }

  /** Redraw liquid in a single tube without rebuilding DOM */
  function redrawTubeLiquid(idx, bands, extraOpts) {
    const el = tubeEls[idx];
    if (!el) return;
    const tubeW = el.tube.clientWidth || 52;
    const tubeH = el.tube.clientHeight || 170;
    const innerW = tubeW - 4;
    const innerH = tubeH - 2;
    const waveState = waves[idx];
    const opts = {
      w: innerW, h: innerH,
      waveAmp: waveState ? waveState.amp : 0,
      wavePhase: waveState ? waveState.phase : 0,
      colorblind: settings.colorblind,
    };
    if (extraOpts) Object.assign(opts, extraOpts);
    LiquidRenderer.draw(el.canvas, bands || getVisualBands(state.tubes[idx]), opts);
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

  /* ================================================================
     POUR ANIMATION (real liquid pouring with tilt)
     ================================================================ */
  function animateMove(si, di, units) {
    const srcTube = state.tubes[si];
    const color = srcTube[srcTube.length - 1];

    // Execute game logic immediately
    const result = executePour(state.tubes, si, di);
    state.tubes = result.newTubes;
    state.moveCount++;
    renderHUD();

    // Deselect and rebuild tubes (but we'll animate over them)
    renderTubes();

    Sound.pour(); Haptic.pour();

    if (settings.reduceEffects || isReducedMotion()) {
      // Simple instant render for reduced effects
      triggerWave(di, 2);
      startWaveLoop();
      setTimeout(() => {
        state.animating = false;
        afterMove();
      }, 100);
      return;
    }

    // Get positions for animation
    const srcEl = tubeEls[si];
    const dstEl = tubeEls[di];
    if (!srcEl || !dstEl) {
      state.animating = false;
      afterMove();
      return;
    }

    const srcRect = srcEl.wrapper.getBoundingClientRect();
    const dstRect = dstEl.wrapper.getBoundingClientRect();

    // Store pre-pour state for the source (before the pour was executed)
    const prePourSrc = state.history[state.history.length - 1][si];
    const prePourDst = state.history[state.history.length - 1][di];
    const postPourSrc = state.tubes[si];
    const postPourDst = state.tubes[di];

    // Animate: source lifts, tilts, pours
    const totalDuration = 1000; // ms
    const liftDuration = 250;
    const pourDuration = 550;
    const settleDuration = 200;
    const startTime = performance.now();

    // Determine tilt direction (tilt toward destination)
    const tiltDir = dstRect.left > srcRect.left ? 1 : -1;
    const tiltAngle = 70; // degrees

    // Lift the source wrapper
    srcEl.wrapper.style.transition = 'none';
    srcEl.wrapper.style.zIndex = '50';
    srcEl.wrapper.style.position = 'relative';

    pourAnim = {
      si, di, units, color,
      prePourSrc, prePourDst,
      postPourSrc, postPourDst,
      startTime, totalDuration,
      liftDuration, pourDuration, settleDuration,
      tiltDir, tiltAngle,
      srcEl, dstEl, srcRect, dstRect,
      done: false,
    };

    function animFrame(now) {
      if (pourAnim && pourAnim.done) return;

      const elapsed = now - startTime;
      const t = Math.min(elapsed / totalDuration, 1);

      if (elapsed <= liftDuration) {
        // Phase A: Lift and move toward destination
        const lt = elapsed / liftDuration;
        const eased = easeOutCubic(lt);

        // Move horizontally toward dest and up
        const targetX = (dstRect.left - srcRect.left) * 0.5; // move halfway
        const dx = targetX * eased;
        const dy = -30 * eased;
        const rot = tiltDir * tiltAngle * eased;

        srcEl.wrapper.style.transform =
          'translate(' + dx + 'px, ' + dy + 'px) rotate(' + rot + 'deg)';
        srcEl.wrapper.style.transformOrigin = 'center bottom';

        // Draw source tube with pre-pour liquid (draining starts in next phase)
        redrawTubeLiquid(si, getVisualBands(prePourSrc));

      } else if (elapsed <= liftDuration + pourDuration) {
        // Phase B: Pour — drain source, fill dest, draw stream
        const pt = (elapsed - liftDuration) / pourDuration;
        const easedPour = easeInOutQuad(pt);

        // Source drains
        const drainedUnits = units * easedPour;
        const srcBands = getPartialDrainBands(prePourSrc, color, units, drainedUnits);
        redrawTubeLiquid(si, srcBands);

        // Destination fills
        const filledUnits = units * easedPour;
        const dstBands = getPartialFillBands(prePourDst, color, units, filledUnits);
        redrawTubeLiquid(di, dstBands);

        // Draw stream on overlay
        clearOverlay();
        if (overlayCtx) {
          const srcTubeRect = srcEl.tube.getBoundingClientRect();
          const dstTubeRect = dstEl.tube.getBoundingClientRect();

          // Stream from source lip to dest opening
          const streamStartX = tiltDir > 0 ?
            srcTubeRect.right : srcTubeRect.left;
          const streamStartY = srcTubeRect.top;
          const streamEndX = dstTubeRect.left + dstTubeRect.width / 2;
          const streamEndY = dstTubeRect.top + 5;

          // Tapered stream with gravity curve
          const streamWidth = 4 + (1 - pt) * 2;
          const ctrlY = Math.min(streamStartY, streamEndY) - 10;

          overlayCtx.strokeStyle = COLOR_INFO[color].hex;
          overlayCtx.lineWidth = streamWidth;
          overlayCtx.lineCap = 'round';
          overlayCtx.globalAlpha = 0.9;
          overlayCtx.beginPath();
          overlayCtx.moveTo(streamStartX, streamStartY);
          overlayCtx.quadraticCurveTo(
            (streamStartX + streamEndX) / 2, ctrlY,
            streamEndX, streamEndY
          );
          overlayCtx.stroke();
          overlayCtx.globalAlpha = 1;

          // Splash particles at landing point
          if (Math.random() < 0.3) {
            Particles.emit(streamEndX, streamEndY, COLOR_INFO[color].hex, 1, {
              spread: 20, upSpeed: 30, gravity: 80,
            });
          }
        }

        // Update particles
        const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
        if (Particles.active()) {
          Particles.update(dt);
          if (overlayCtx) Particles.draw(overlayCtx);
        }
        lastFrameTime = now;

      } else {
        // Phase C: Settle back
        const st = (elapsed - liftDuration - pourDuration) / settleDuration;
        const eased = easeOutBounce(Math.min(st, 1));

        const targetX = (dstRect.left - srcRect.left) * 0.5;
        const dx = targetX * (1 - eased);
        const dy = -30 * (1 - eased);
        const rot = tiltDir * tiltAngle * (1 - eased);

        srcEl.wrapper.style.transform =
          'translate(' + dx + 'px, ' + dy + 'px) rotate(' + rot + 'deg)';

        // Final state
        redrawTubeLiquid(si, getVisualBands(postPourSrc));
        redrawTubeLiquid(di, getVisualBands(postPourDst));

        clearOverlay();
        // Keep particles going
        const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
        if (Particles.active()) {
          Particles.update(dt);
          if (overlayCtx) Particles.draw(overlayCtx);
        }
        lastFrameTime = now;
      }

      if (t >= 1) {
        // Animation complete
        pourAnim = { done: true };
        srcEl.wrapper.style.transform = '';
        srcEl.wrapper.style.zIndex = '';
        srcEl.wrapper.style.position = '';
        srcEl.wrapper.style.transition = '';
        clearOverlay();

        // Trigger wave on destination
        triggerWave(di, 3);
        startWaveLoop();

        renderTubes();
        state.animating = false;
        afterMove();
        return;
      }

      animRafId = requestAnimationFrame(animFrame);
    }

    animRafId = requestAnimationFrame(animFrame);
  }

  /* ================================================================
     FUSION ANIMATION
     ================================================================ */
  function animateFuse(si, di, fusionResult) {
    const srcColor = tubeTop(state.tubes[si]);
    const dstColor = tubeTop(state.tubes[di]);

    // Execute game logic
    const result = executePour(state.tubes, si, di);
    state.tubes = result.newTubes;
    state.moveCount++;
    renderHUD();
    renderTubes();

    Sound.pour(); Haptic.pour();

    if (settings.reduceEffects || isReducedMotion()) {
      Sound.bloop(); Haptic.fuse();
      triggerWave(di, 2);
      startWaveLoop();
      setTimeout(() => {
        state.animating = false;
        afterMove();
      }, 100);
      return;
    }

    const srcEl = tubeEls[si];
    const dstEl = tubeEls[di];
    if (!srcEl || !dstEl) {
      state.animating = false;
      afterMove();
      return;
    }

    const srcRect = srcEl.wrapper.getBoundingClientRect();
    const dstRect = dstEl.wrapper.getBoundingClientRect();

    const prePourSrc = state.history[state.history.length - 1][si];
    const prePourDst = state.history[state.history.length - 1][di];
    const postPourSrc = state.tubes[si];
    const postPourDst = state.tubes[di];

    const totalDuration = 1200;
    const liftDuration = 200;
    const pourDuration = 400;
    const fuseDuration = 400;
    const settleDuration = 200;
    const startTime = performance.now();
    const tiltDir = dstRect.left > srcRect.left ? 1 : -1;
    const tiltAngle = 65;

    srcEl.wrapper.style.transition = 'none';
    srcEl.wrapper.style.zIndex = '50';
    srcEl.wrapper.style.position = 'relative';

    pourAnim = { done: false };

    function animFrame(now) {
      if (pourAnim && pourAnim.done) return;

      const elapsed = now - startTime;
      const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
      lastFrameTime = now;

      if (elapsed <= liftDuration) {
        // Lift phase
        const lt = easeOutCubic(elapsed / liftDuration);
        const targetX = (dstRect.left - srcRect.left) * 0.5;
        srcEl.wrapper.style.transform =
          'translate(' + (targetX * lt) + 'px, ' + (-25 * lt) + 'px) rotate(' + (tiltDir * tiltAngle * lt) + 'deg)';
        srcEl.wrapper.style.transformOrigin = 'center bottom';
        redrawTubeLiquid(si, getVisualBands(prePourSrc));

      } else if (elapsed <= liftDuration + pourDuration) {
        // Pour 1 unit
        const pt = easeInOutQuad((elapsed - liftDuration) / pourDuration);
        const srcBands = getPartialDrainBands(prePourSrc, srcColor, 1, pt);
        redrawTubeLiquid(si, srcBands);

        // Destination: show the dst color still (hasn't fused yet)
        redrawTubeLiquid(di, getVisualBands(prePourDst));

        // Stream
        clearOverlay();
        if (overlayCtx) {
          const srcTubeRect = srcEl.tube.getBoundingClientRect();
          const dstTubeRect = dstEl.tube.getBoundingClientRect();
          const sx = tiltDir > 0 ? srcTubeRect.right : srcTubeRect.left;
          const sy = srcTubeRect.top;
          const ex = dstTubeRect.left + dstTubeRect.width / 2;
          const ey = dstTubeRect.top + 5;
          overlayCtx.strokeStyle = COLOR_INFO[srcColor].hex;
          overlayCtx.lineWidth = 4;
          overlayCtx.lineCap = 'round';
          overlayCtx.globalAlpha = 0.9;
          overlayCtx.beginPath();
          overlayCtx.moveTo(sx, sy);
          overlayCtx.quadraticCurveTo((sx + ex) / 2, Math.min(sy, ey) - 10, ex, ey);
          overlayCtx.stroke();
          overlayCtx.globalAlpha = 1;
        }

      } else if (elapsed <= liftDuration + pourDuration + fuseDuration) {
        // Fusion effect
        const ft = (elapsed - liftDuration - pourDuration) / fuseDuration;

        // Return source
        const targetX = (dstRect.left - srcRect.left) * 0.5;
        const returnT = easeOutCubic(Math.min(ft * 2, 1));
        srcEl.wrapper.style.transform =
          'translate(' + (targetX * (1 - returnT)) + 'px, ' + (-25 * (1 - returnT)) + 'px) rotate(' +
          (tiltDir * tiltAngle * (1 - returnT)) + 'deg)';
        redrawTubeLiquid(si, getVisualBands(postPourSrc));

        // Swirl effect: blend colors on dest top
        clearOverlay();

        // Flash the dest tube through colors
        const dstBandsCopy = getVisualBands(postPourDst);
        // The top band now has the fusion result — animate the color transition
        if (ft < 0.5) {
          // Show blend of src+dst colors (use a gradient effect)
          const blendT = ft * 2;
          // Temporarily show original colors mixing
          if (dstBandsCopy.length > 0) {
            const topBand = dstBandsCopy[dstBandsCopy.length - 1];
            // For the first half, draw with the original dst color
            const mixColor = blendT < 0.5 ? dstColor : fusionResult;
            dstBandsCopy[dstBandsCopy.length - 1] = { color: mixColor, units: topBand.units };
          }
        }
        redrawTubeLiquid(di, dstBandsCopy);

        // Glow ring on overlay
        const dstTubeRect = dstEl.tube.getBoundingClientRect();
        const cx = dstTubeRect.left + dstTubeRect.width / 2;
        const cy = dstTubeRect.top + dstTubeRect.height * 0.3;
        if (overlayCtx) {
          const ringRadius = 10 + ft * 40;
          const ringAlpha = 1 - ft;
          overlayCtx.strokeStyle = COLOR_INFO[fusionResult].hex;
          overlayCtx.lineWidth = 3;
          overlayCtx.globalAlpha = ringAlpha * 0.7;
          overlayCtx.beginPath();
          overlayCtx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          overlayCtx.stroke();
          overlayCtx.globalAlpha = 1;
        }

        // Sparkle particles
        if (ft < 0.3 && Math.random() < 0.5) {
          Particles.emit(cx, cy, COLOR_INFO[fusionResult].hex, 2, {
            spread: 40, upSpeed: 60, gravity: 30,
          });
        }

        // Bloop sound at start of fusion
        if (ft < 0.05) {
          Sound.bloop(); Haptic.fuse();
        }

        // Update particles
        if (Particles.active()) {
          Particles.update(dt);
          if (overlayCtx) Particles.draw(overlayCtx);
        }

      } else {
        // Settle
        const st = (elapsed - liftDuration - pourDuration - fuseDuration) / settleDuration;
        const eased = Math.min(st, 1);
        srcEl.wrapper.style.transform = '';
        redrawTubeLiquid(si, getVisualBands(postPourSrc));
        redrawTubeLiquid(di, getVisualBands(postPourDst));

        clearOverlay();
        if (Particles.active()) {
          Particles.update(dt);
          if (overlayCtx) Particles.draw(overlayCtx);
        }
      }

      if (elapsed >= totalDuration) {
        pourAnim = { done: true };
        srcEl.wrapper.style.transform = '';
        srcEl.wrapper.style.zIndex = '';
        srcEl.wrapper.style.position = '';
        srcEl.wrapper.style.transition = '';
        clearOverlay();
        triggerWave(di, 4);
        startWaveLoop();
        renderTubes();
        state.animating = false;
        afterMove();
        return;
      }

      animRafId = requestAnimationFrame(animFrame);
    }

    animRafId = requestAnimationFrame(animFrame);
  }

  /* ---------- Animation helpers ---------- */

  /** Get bands for a tube that's partially drained (units being poured out) */
  function getPartialDrainBands(tube, pourColor, totalDrain, drained) {
    if (!tube.length) return [];
    const remaining = tube.slice();
    // We need to remove `drained` units from the top of the same color
    let toRemove = drained;
    for (let i = remaining.length - 1; i >= 0 && toRemove > 0; i--) {
      if (remaining[i] === pourColor) {
        const remove = Math.min(1, toRemove);
        toRemove -= remove;
        if (remove >= 1) {
          remaining.splice(i, 1);
        }
      } else {
        break;
      }
    }

    // Build bands with potential fractional top
    const bands = [];
    if (!remaining.length) return bands;

    let cur = remaining[0], count = 0;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] === cur) {
        count++;
      } else {
        bands.push({ color: cur, units: count });
        cur = remaining[i];
        count = 1;
      }
    }
    bands.push({ color: cur, units: count });

    // Add fractional remaining pour color on top
    const fractional = (totalDrain - drained);
    if (fractional > 0.01 && bands.length > 0) {
      const topBand = bands[bands.length - 1];
      if (topBand.color === pourColor) {
        topBand.units += fractional;
      } else {
        bands.push({ color: pourColor, units: fractional });
      }
    }

    return bands;
  }

  /** Get bands for a tube that's being filled */
  function getPartialFillBands(tube, fillColor, totalFill, filled) {
    const bands = getVisualBands(tube);
    if (filled <= 0.01) return bands;

    // Add filled amount on top
    if (bands.length > 0 && bands[bands.length - 1].color === fillColor) {
      bands[bands.length - 1].units += filled;
    } else {
      bands.push({ color: fillColor, units: filled });
    }
    return bands;
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOutBounce(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }

  function isReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Wave system ---------- */
  function triggerWave(tubeIdx, amplitude) {
    if (settings.reduceEffects || isReducedMotion()) return;
    waves[tubeIdx] = {
      amp: amplitude || 2,
      phase: 0,
      vel: 6,
      lastTime: performance.now(),
    };
  }

  function startWaveLoop() {
    if (animRafId) return; // already running
    lastFrameTime = performance.now();
    function waveFrame(now) {
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      let anyActive = false;

      // Update waves
      for (const idx in waves) {
        const w = waves[idx];
        w.phase += w.vel * dt;
        w.amp *= Math.pow(0.05, dt); // exponential decay
        if (w.amp < 0.3) {
          delete waves[idx];
        } else {
          anyActive = true;
          redrawTubeLiquid(parseInt(idx));
        }
      }

      // Update particles
      if (Particles.active()) {
        anyActive = true;
        Particles.update(dt);
        clearOverlay();
        if (overlayCtx) Particles.draw(overlayCtx);
      }

      if (anyActive) {
        animRafId = requestAnimationFrame(waveFrame);
      } else {
        animRafId = null;
        clearOverlay();
      }
    }
    animRafId = requestAnimationFrame(waveFrame);
  }

  /* ---------- Shake ---------- */
  function shakeAnim(si, di) {
    [si, di].forEach(idx => {
      const el = tubeEls[idx];
      if (el) {
        el.wrapper.classList.add('shake');
        setTimeout(() => el.wrapper.classList.remove('shake'), 400);
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
      waves = {};
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
    waves = {};
    pourAnim = null;
    if (animRafId) { cancelAnimationFrame(animRafId); animRafId = null; }
    Particles.clear();
    clearOverlay();
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
