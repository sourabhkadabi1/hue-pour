// ============================================================
// HUE POUR — UI Layer  (rendering, sound, input, animations)
// ============================================================
'use strict';

/* ========== SOUND ENGINE (WebAudio) ========== */
const Sound = (() => {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function note(freq, dur, type, vol) {
    if (!enabled) return;
    ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  return {
    setEnabled(v) { enabled = v; },
    select()  { note(880, 0.07, 'sine', 0.12); },
    pour() {
      if (!enabled) return;
      ensure();
      const len = 0.28;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len | 0, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 1.5;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f); f.connect(g); g.connect(ctx.destination);
      s.start();
    },
    fuse() {
      if (!enabled) return;
      ensure();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(700, t);
      o.frequency.exponentialRampToValueAtTime(220, t + 0.35);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.45);
    },
    error() { note(160, 0.12, 'square', 0.08); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => note(f, 0.3, 'sine', 0.18), i * 140));
    },
  };
})();

/* ========== HAPTICS ========== */
const Haptic = (() => {
  let enabled = true;
  function vib(pattern) {
    if (enabled && navigator.vibrate) navigator.vibrate(pattern);
  }
  return {
    setEnabled(v) { enabled = v; },
    select()  { vib(8); },
    pour()    { vib(15); },
    fuse()    { vib([20, 15, 40]); },
    error()   { vib([8, 8, 8]); },
  };
})();

/* ========== SAVE / LOAD ========== */
const Save = (() => {
  const KEY = 'hue_pour_save';
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* */ }
  }
  return { load, save };
})();

/* ========== APP STATE ========== */
const App = (() => {
  // DOM refs
  const $ = id => document.getElementById(id);

  const dom = {
    tubeArea:    $('tube-area'),
    targetTubes: $('target-tubes'),
    hudLevel:    $('hud-level'),
    hudMoves:    $('hud-moves'),
    hudPar:      $('hud-par'),
    btnUndo:     $('btn-undo'),
    btnRestart:  $('btn-restart'),
    btnSettings: $('btn-settings'),
    winOverlay:  $('win-overlay'),
    winStars:    $('win-stars'),
    winInfo:     $('win-info'),
    btnNext:     $('btn-next'),
    settingsOverlay: $('settings-overlay'),
    setSound:     $('set-sound'),
    setHaptics:   $('set-haptics'),
    setColorblind:$('set-colorblind'),
    btnCloseSettings: $('btn-close-settings'),
  };

  let state = {
    levelNum: 1,
    tubes: [],
    target: [],
    par: 0,
    moveCount: 0,
    history: [],       // stack of tubes snapshots
    selectedTube: -1,
    animating: false,
    won: false,
  };

  let settings = { sound: true, haptics: true, colorblind: false };
  let bestResults = {};  // levelNum -> { moves, stars }

  /* ---------- Init ---------- */
  function init() {
    loadSave();
    parseURL();
    applySettings();
    bindEvents();
    loadLevel(state.levelNum);
  }

  function parseURL() {
    const p = new URLSearchParams(window.location.search);
    if (p.has('level')) {
      const n = parseInt(p.get('level'), 10);
      if (n > 0) state.levelNum = n;
    }
    if (p.has('seed')) {
      state._forcedSeed = parseInt(p.get('seed'), 10);
    }
  }

  function loadSave() {
    const data = Save.load();
    if (!data) return;
    if (data.levelNum) state.levelNum = data.levelNum;
    if (data.settings) settings = { ...settings, ...data.settings };
    if (data.best) bestResults = data.best;
  }

  function persistSave() {
    Save.save({
      levelNum: state.levelNum,
      settings,
      best: bestResults,
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
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    dom.btnUndo.addEventListener('click', undo);
    dom.btnRestart.addEventListener('click', restart);
    dom.btnSettings.addEventListener('click', () => toggleOverlay(dom.settingsOverlay, true));
    dom.btnCloseSettings.addEventListener('click', () => {
      toggleOverlay(dom.settingsOverlay, false);
      persistSave();
    });
    dom.btnNext.addEventListener('click', nextLevel);

    dom.setSound.addEventListener('change', () => {
      settings.sound = dom.setSound.checked;
      applySettings();
    });
    dom.setHaptics.addEventListener('change', () => {
      settings.haptics = dom.setHaptics.checked;
      applySettings();
    });
    dom.setColorblind.addEventListener('change', () => {
      settings.colorblind = dom.setColorblind.checked;
      applySettings();
    });
  }

  function toggleOverlay(el, show) {
    el.classList.toggle('hidden', !show);
    el.setAttribute('aria-hidden', String(!show));
  }

  /* ---------- Load a level ---------- */
  function loadLevel(num) {
    state.levelNum  = num;
    state.won       = false;
    state.moveCount = 0;
    state.history   = [];
    state.selectedTube = -1;
    state.animating = false;

    toggleOverlay(dom.winOverlay, false);

    const seed = state._forcedSeed !== undefined ? state._forcedSeed : undefined;
    const level = generateLevel(num, seed);

    state.tubes  = level.tubes;
    state.target = level.target;
    state.par    = level.par;

    renderAll();
    persistSave();
  }

  /* ---------- Render ---------- */
  function renderAll() {
    renderHUD();
    renderTarget();
    renderTubes();
  }

  function renderHUD() {
    dom.hudLevel.textContent = 'Level ' + state.levelNum;
    dom.hudMoves.textContent = 'Moves: ' + state.moveCount;
    dom.hudPar.textContent   = 'Par: ' + state.par;
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
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('aria-label', 'Tube ' + (idx + 1));
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

  /* ---------- Interaction ---------- */
  function onTubeTap(idx) {
    if (state.animating || state.won) return;

    // Nothing selected yet → select this tube (if non-empty)
    if (state.selectedTube < 0) {
      if (!state.tubes[idx].length) return;
      state.selectedTube = idx;
      Sound.select();
      Haptic.select();
      renderTubes();
      return;
    }

    // Tapped the same tube → deselect
    if (state.selectedTube === idx) {
      state.selectedTube = -1;
      renderTubes();
      return;
    }

    // Try pour from selected → idx
    const si = state.selectedTube;
    const analysis = analyzePour(state.tubes, si, idx);

    if (analysis.type === 'illegal') {
      // Shake both tubes
      Sound.error();
      Haptic.error();
      state.selectedTube = -1;
      renderTubes();
      shakeAnim(si, idx);
      return;
    }

    // Legal move — animate it
    state.animating = true;
    state.selectedTube = -1;

    // Save for undo
    state.history.push(cloneTubes(state.tubes));

    if (analysis.type === 'move') {
      animateMove(si, idx, analysis.units);
    } else {
      animateFuse(si, idx, analysis.result);
    }
  }

  /* ---------- Animations ---------- */
  function getUnitRect(tubeIdx, unitIdx) {
    const tubeEl = document.getElementById('tube-' + tubeIdx);
    if (!tubeEl) return null;
    // unitIdx goes bottom (0) to top; in column-reverse DOM, child 0 is bottom
    const units = tubeEl.querySelectorAll('.liquid-unit');
    const el = units[unitIdx];
    return el ? el.getBoundingClientRect() : null;
  }

  function getTubeTopRect(tubeIdx) {
    const tubeEl = document.getElementById('tube-' + tubeIdx);
    if (!tubeEl) return null;
    const r = tubeEl.getBoundingClientRect();
    // Top of the liquid column = top of tube + empty space
    const filled = state.tubes[tubeIdx].length;
    const unitH = r.height / TUBE_CAPACITY;
    return {
      left: r.left,
      top: r.bottom - (filled + 1) * unitH,
      width: r.width,
      height: unitH,
    };
  }

  function animateMove(si, di, units) {
    const srcTube = state.tubes[si];
    const color = srcTube[srcTube.length - 1];
    const info = COLOR_INFO[color];

    // Get source positions for the units to remove
    const srcRects = [];
    for (let i = 0; i < units; i++) {
      const ui = srcTube.length - 1 - i;
      const r = getUnitRect(si, ui);
      if (r) srcRects.push(r);
    }

    // Execute the pour in game state
    const result = executePour(state.tubes, si, di);
    state.tubes = result.newTubes;
    state.moveCount++;

    // Calculate destination position
    const dstFilled = state.tubes[di].length;
    const tubeEl = document.getElementById('tube-' + di);
    const tubeRect = tubeEl ? tubeEl.getBoundingClientRect() : null;
    const unitH = tubeRect ? tubeRect.height / TUBE_CAPACITY : 44;

    // Create flying units
    const flyers = [];
    srcRects.forEach((sr, i) => {
      const fly = document.createElement('div');
      fly.className = 'flying-unit';
      fly.style.background = info.hex;
      fly.style.width = sr.width + 'px';
      fly.style.height = sr.height + 'px';
      fly.style.left = sr.left + 'px';
      fly.style.top = sr.top + 'px';

      if (settings.colorblind) {
        const cb = document.createElement('span');
        cb.className = 'cb';
        cb.style.display = 'block';
        cb.textContent = info.symbol;
        fly.appendChild(cb);
      }

      document.body.appendChild(fly);
      flyers.push({ el: fly, index: i });
    });

    // Re-render tubes (source loses units, but dest doesn't show them yet)
    // We'll render the dest WITHOUT the new units, then animate them in
    const tubesWithoutNew = cloneTubes(state.tubes);
    for (let i = 0; i < units; i++) tubesWithoutNew[di].pop();
    const savedTubes = state.tubes;
    state.tubes = tubesWithoutNew;
    renderTubes();
    state.tubes = savedTubes;

    Sound.pour();
    Haptic.pour();

    // Animate to destination
    requestAnimationFrame(() => {
      const destTubeEl = document.getElementById('tube-' + di);
      const destRect = destTubeEl ? destTubeEl.getBoundingClientRect() : null;

      flyers.forEach(({ el, index }) => {
        // Destination position: bottom-up stacking
        const destUnitIdx = dstFilled - units + index;
        const dy = destRect
          ? destRect.bottom - (destUnitIdx + 1) * unitH
          : 0;
        const dx = destRect ? destRect.left + 2 : 0;

        el.style.transform =
          'translate(' +
          (dx - parseFloat(el.style.left)) + 'px, ' +
          (dy - parseFloat(el.style.top)) + 'px)';
      });
    });

    setTimeout(() => {
      flyers.forEach(f => f.el.remove());
      renderAll();
      state.animating = false;
      checkWinCondition();
    }, 380);
  }

  function animateFuse(si, di, fusionResult) {
    const srcColor = tubeTop(state.tubes[si]);
    const info = COLOR_INFO[srcColor];

    // Get source unit rect
    const srcRect = getUnitRect(si, state.tubes[si].length - 1);

    // Execute pour
    const result = executePour(state.tubes, si, di);
    state.tubes = result.newTubes;
    state.moveCount++;

    // Create flying unit
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
        cb.className = 'cb';
        cb.style.display = 'block';
        cb.textContent = info.symbol;
        fly.appendChild(cb);
      }

      document.body.appendChild(fly);

      Sound.pour();
      Haptic.pour();

      // Animate to destination top
      const dstRect = getUnitRect(di, state.tubes[di].length - 1);
      if (dstRect) {
        requestAnimationFrame(() => {
          fly.style.transform =
            'translate(' +
            (dstRect.left - srcRect.left) + 'px, ' +
            (dstRect.top - srcRect.top) + 'px)';
          fly.style.opacity = '0.5';
        });
      }

      setTimeout(() => {
        fly.remove();
        // Now show the fused result
        renderAll();

        // Glow on the fused unit
        const fusedEl = document.querySelector(
          '#tube-' + di + ' .liquid-unit:last-child'
        );
        // Actually, the fused unit is at the top — in column-reverse, it's the last child
        // We need the topmost unit which is at index tubes[di].length - 1
        const tubeEl = document.getElementById('tube-' + di);
        const units = tubeEl ? tubeEl.querySelectorAll('.liquid-unit') : [];
        const topUnit = units[state.tubes[di].length - 1];
        if (topUnit) topUnit.classList.add('fusing');

        Sound.fuse();
        Haptic.fuse();

        setTimeout(() => {
          state.animating = false;
          checkWinCondition();
        }, 500);
      }, 350);
    } else {
      renderAll();
      Sound.fuse();
      Haptic.fuse();
      state.animating = false;
      setTimeout(() => checkWinCondition(), 100);
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

  /* ---------- Win ---------- */
  function checkWinCondition() {
    if (!checkWin(state.tubes, state.target)) return;

    state.won = true;

    const moves = state.moveCount;
    const par   = state.par;
    let stars = 1;
    if (moves <= par)     stars = 3;
    else if (moves <= par + 3) stars = 2;

    // Record best
    const prev = bestResults[state.levelNum];
    if (!prev || stars > prev.stars || (stars === prev.stars && moves < prev.moves)) {
      bestResults[state.levelNum] = { moves, stars };
    }
    persistSave();

    // Show win screen
    setTimeout(() => {
      dom.winStars.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const s = document.createElement('span');
        s.textContent = '★';
        s.className = i < stars ? 'star-on' : 'star-off';
        dom.winStars.appendChild(s);
      }

      dom.winInfo.innerHTML =
        'Moves: <strong>' + moves + '</strong> &nbsp;|&nbsp; Par: <strong>' + par + '</strong>';

      Sound.win();
      toggleOverlay(dom.winOverlay, true);
    }, 350);
  }

  /* ---------- Controls ---------- */
  function undo() {
    if (state.animating || state.won || !state.history.length) return;
    state.tubes = state.history.pop();
    state.moveCount = Math.max(0, state.moveCount - 1);
    state.selectedTube = -1;
    renderAll();
  }

  function restart() {
    if (state.animating) return;
    loadLevel(state.levelNum);
  }

  function nextLevel() {
    state._forcedSeed = undefined;
    loadLevel(state.levelNum + 1);
  }

  /* ---------- Boot ---------- */
  init();

  return { state, loadLevel };
})();
