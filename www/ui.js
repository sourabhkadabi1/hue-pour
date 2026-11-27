// ============================================================
// HUE POUR — UI Layer  v4
// Canvas liquid (clip-based horizontal liquid in rotated tube)
// Real pour animation with stream, waves, particles, fusion
// Tube-complete shine, bespoke sound design, full rework
// GAME LOGIC (game.js, monetization.js) UNTOUCHED
// ============================================================
'use strict';

/* ===================================================================
   COLOR HELPERS
   =================================================================== */
function _hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function _hexA(hex, a) {
  const [r,g,b] = _hexToRgb(hex);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
}
function _lighter(hex, t) {
  const [r,g,b] = _hexToRgb(hex);
  return 'rgb(' + Math.round(r+(255-r)*t) + ',' + Math.round(g+(255-g)*t) + ',' + Math.round(b+(255-b)*t) + ')';
}
function _darker(hex, t) {
  const [r,g,b] = _hexToRgb(hex);
  return 'rgb(' + Math.round(r*(1-t)) + ',' + Math.round(g*(1-t)) + ',' + Math.round(b*(1-t)) + ')';
}

/* ===================================================================
   SOUND ENGINE  (WebAudio, all synthesised)
   =================================================================== */
const Sound = (() => {
  let actx = null, master = null, enabled = true, vol = 0.65, ambOscs = null;

  function ensure() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = vol;
    master.connect(actx.destination);
    if (actx.state === 'suspended') actx.resume();
  }
  function dst() { return master; }

  function osc(freq, dur, type, v, t0) {
    if (!enabled) return;
    ensure();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t = t0 !== undefined ? t0 : actx.currentTime;
    g.gain.setValueAtTime(v || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst()); o.start(t); o.stop(t + dur + 0.01);
  }

  // ---- Pour sound: bandpass noise + glug LFO + plip bubbles ----
  let pourNodes = null;

  function startPour(fillFrac) {
    if (!enabled) return;
    ensure();
    _stopPour(0.02);
    const t = actx.currentTime;
    const bufLen = actx.sampleRate * 3;
    const buf = actx.createBuffer(1, bufLen, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    const src = actx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const filt = actx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 350 + fillFrac * 650;
    filt.Q.value = 2.8;

    // Glug LFO
    const lfo = actx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 2 + Math.random() * 5;
    const lfoG = actx.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG); lfoG.connect(filt.frequency);

    const g = actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.14);

    src.connect(filt); filt.connect(g); g.connect(dst());
    src.start(t); lfo.start(t);
    pourNodes = { src, filt, lfo, lfoG, g };
  }

  function updatePourFill(fillFrac) {
    if (pourNodes) pourNodes.filt.frequency.value = 350 + fillFrac * 650;
  }

  function _stopPour(fadeT) {
    if (!pourNodes) return;
    const t = actx.currentTime, ft = fadeT !== undefined ? fadeT : 0.18;
    pourNodes.g.gain.setValueAtTime(pourNodes.g.gain.value, t);
    pourNodes.g.gain.linearRampToValueAtTime(0.0001, t + ft);
    const pn = pourNodes; pourNodes = null;
    setTimeout(() => {
      try { pn.src.stop(); pn.lfo.stop(); } catch (e) {}
    }, (ft + 0.1) * 1000);
  }

  function bubble() {
    if (!enabled) return;
    ensure();
    osc(600 + Math.random() * 1500, 0.025 + Math.random() * 0.03, 'sine', 0.03);
  }

  return {
    setEnabled(v)  { enabled = v; if (!v) { Sound.stopAmbience(); _stopPour(0.05); } },
    setVolume(v)   { vol = v; if (master) master.gain.setTargetAtTime(v, actx.currentTime, 0.05); },
    isEnabled()    { return enabled; },
    getCtx()       { ensure(); return actx; },

    select()   { osc(1200, 0.07, 'sine', 0.10); },
    deselect() { osc(900,  0.06, 'sine', 0.07); },

    startPour, updatePourFill,
    stopPour() { _stopPour(); },

    bubble,

    fuse() {
      if (!enabled) return; ensure();
      // Warm bloop
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(500, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.3);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(dst()); o.start(t); o.stop(t + 0.4);
      // Shimmer sparkle
      [1800, 2400, 3100].forEach((f, i) => setTimeout(() => osc(f, 0.04, 'sine', 0.05), i * 35));
    },

    tubeDone() {
      if (!enabled) return; ensure();
      // Bright glass ting: two detuned partials
      [2000, 2214].forEach(f => osc(f, 0.65, 'sine', 0.14));
    },

    error() {
      if (!enabled) return; ensure();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
      g.gain.setValueAtTime(0.20, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(dst()); o.start(t); o.stop(t + 0.15);
    },

    win() {
      if (!enabled) return;
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => osc(f, 0.35, 'sine', 0.16), i * 150));
    },

    startAmbience() {
      if (!enabled || ambOscs) return; ensure();
      const g = actx.createGain(); g.gain.value = 0.01; g.connect(dst());
      const o1 = actx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
      const o2 = actx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 164.81;
      o1.connect(g); o2.connect(g); o1.start(); o2.start();
      ambOscs = { o1, o2, g };
    },
    stopAmbience() {
      if (!ambOscs) return;
      try { ambOscs.o1.stop(); ambOscs.o2.stop(); } catch (e) {}
      ambOscs = null;
    },
  };
})();

/* ===================================================================
   HAPTICS
   =================================================================== */
const Haptic = (() => {
  let enabled = true;
  function vib(p) { if (enabled && navigator.vibrate) navigator.vibrate(p); }
  return {
    setEnabled(v) { enabled = v; },
    select() { vib(8); },
    pour()   { vib(14); },
    fuse()   { vib([20,10,30]); },
    error()  { vib([10,5,10]); },
  };
})();

/* ===================================================================
   SAVE / LOAD
   =================================================================== */
const Save = (() => {
  const KEY = 'hue_pour_save';
  function load() {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  return { load, save };
})();

/* ===================================================================
   TOAST
   =================================================================== */
const Toast = (() => {
  const el = document.getElementById('toast');
  let timer = null;
  return {
    show(msg, ms) {
      if (timer) clearTimeout(timer);
      el.textContent = msg;
      el.classList.remove('hidden'); el.classList.add('show');
      timer = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.classList.add('hidden'), 350);
      }, ms || 2500);
    },
  };
})();

/* ===================================================================
   SHARE HELPERS  (unchanged from v2)
   =================================================================== */
async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) {}
  }
  try { await navigator.clipboard.writeText(text); Toast.show('Copied to clipboard!'); }
  catch (e) { Toast.show('Could not share'); }
}

async function shareOrDownloadCanvas(canvas, filename) {
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) {}
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    Toast.show('Image saved!');
  }, 'image/png');
}

function renderShareCard(info) {
  const canvas = document.getElementById('share-canvas');
  const c = canvas.getContext('2d');
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const cols = info.target.map(cl => COLOR_INFO[cl].hex);
  const grad = c.createLinearGradient(0, 0, W, H);
  cols.forEach((cl, i) => grad.addColorStop(i / Math.max(1, cols.length - 1), cl));
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.54)'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff'; c.textAlign = 'center';
  c.font = 'bold 108px sans-serif'; c.fillText('HUE POUR', W/2, 320);
  c.font = '54px sans-serif'; c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillText(info.title, W/2, 440);
  c.font = '120px sans-serif'; c.fillStyle = '#FFD700';
  c.fillText('\u2605'.repeat(info.stars) + '\u2606'.repeat(3 - info.stars), W/2, 680);
  c.font = '64px sans-serif'; c.fillStyle = '#fff';
  c.fillText(info.moves + ' moves  (par ' + info.par + ')', W/2, 840);
  const palW = 100, gap = 24;
  const totalW = cols.length * palW + (cols.length - 1) * gap;
  let sx = (W - totalW) / 2;
  cols.forEach((cl, i) => {
    c.fillStyle = cl;
    c.beginPath();
    const x = sx + i*(palW+gap), y = 960;
    c.moveTo(x+12, y); c.lineTo(x+palW-12, y);
    c.quadraticCurveTo(x+palW, y, x+palW, y+12);
    c.lineTo(x+palW, y+180);
    c.quadraticCurveTo(x+palW, y+200, x+palW-20, y+200);
    c.lineTo(x+20, y+200);
    c.quadraticCurveTo(x, y+200, x, y+180);
    c.lineTo(x, y+12);
    c.quadraticCurveTo(x, y, x+12, y);
    c.fill();
  });
  if (info.code) { c.fillStyle='rgba(255,255,255,0.6)'; c.font='44px monospace'; c.fillText(info.code, W/2, 1340); }
  c.fillStyle='rgba(255,255,255,0.35)'; c.font='36px sans-serif';
  c.fillText('Can you beat my score?', W/2, 1700);
}

/* ===================================================================
   TUBE GEOMETRY
   =================================================================== */

/**
 * Build the outer glass path for the tube.
 * Origin: left,top of the tube bounding box.
 * flare: rim is wider by `flare` px each side.
 */
function _tubePath(ctx, left, top, w, h, r, flare) {
  flare = flare || 0;
  const neck = flare > 0 ? flare * 2 : 0;
  ctx.moveTo(left - flare, top);
  ctx.lineTo(left + w + flare, top);
  if (flare > 0) {
    ctx.lineTo(left + w, top + neck);
  }
  ctx.lineTo(left + w, top + h - r);
  ctx.arcTo(left + w, top + h, left + w - r, top + h, r);
  ctx.lineTo(left + r, top + h);
  ctx.arcTo(left, top + h, left, top + h - r, r);
  if (flare > 0) {
    ctx.lineTo(left, top + neck);
  }
  ctx.closePath();
}

/** Group consecutive same-colour units into bands (bottom-to-top). */
function _bands(tube) {
  if (!tube.length) return [];
  const out = [];
  let cur = tube[0], n = 1;
  for (let i = 1; i < tube.length; i++) {
    if (tube[i] === cur) n++;
    else { out.push({ color: cur, units: n }); cur = tube[i]; n = 1; }
  }
  out.push({ color: cur, units: n });
  return out;
}

/* ===================================================================
   CORE TUBE DRAW — horizontal liquid in rotated tube via clip
   ===================================================================
   Parameters:
     ctx       CanvasRenderingContext2D
     cx, cy    Bottom-centre of tube in canvas coordinates (rotation pivot)
     w, h      Tube width/height
     angle     Rotation in radians (0 = upright)
     bands     [{color, units}]  — units can be fractional
     waveState {amp, phase}
     opts      {selected, hintSrc, hintDst, completed, noShadow}
   =================================================================== */
function drawTubeOnCtx(ctx, cx, cy, w, h, angle, bands, waveState, opts) {
  opts = opts || {};
  const left = cx - w / 2;
  const top  = cy - h;
  const r    = Math.min(w * 0.38, 14);
  const fl   = Math.min(w * 0.07, 3); // rim flare

  // ── Shadow (world-space, below pivot) ──────────────────────────
  if (!opts.noShadow) {
    ctx.save();
    const sg = ctx.createRadialGradient(cx, cy + 3, 0, cx, cy + 4, w * 0.6);
    sg.addColorStop(0, 'rgba(0,0,0,0.30)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(cx, cy + 5, w * 0.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ══ OUTER SAVE – apply tube rotation ═══════════════════════════
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);

  // Glass background (very faint fill so tube interior is visible)
  ctx.save();
  ctx.beginPath(); _tubePath(ctx, left, top, w, h, r, fl);
  ctx.fillStyle = 'rgba(200,230,255,0.04)'; ctx.fill();
  ctx.restore();

  // ══ INNER SAVE – clip tube interior, then counter-rotate ═══════
  ctx.save();
  // Clip region = tube interior (slightly inset from glass outline)
  ctx.beginPath();
  _tubePath(ctx, left + 1.5, top + (fl > 0 ? fl*2 + 1 : 1), w - 3, h - (fl > 0 ? fl*2 : 0) - 1, r * 0.85, 0);
  ctx.clip();

  // Counter-rotate: now in WORLD space, still clipped to tilted tube interior
  ctx.translate(cx, cy); ctx.rotate(-angle); ctx.translate(-cx, -cy);

  // ── Draw liquid bands (horizontal rectangles in world space) ────
  const totalUnits = bands.reduce((s, b) => s + b.units, 0);
  if (totalUnits > 0) {
    let curY = cy;
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const bh   = (band.units / TUBE_CAPACITY) * h;
      const bt   = curY - bh;
      const isTop = (i === bands.length - 1);
      const hex   = COLOR_INFO[band.color].hex;

      // Vertical gradient – lighter at top (surface light), darker at depth
      const vg = ctx.createLinearGradient(0, bt, 0, curY);
      vg.addColorStop(0,   _lighter(hex, 0.22));
      vg.addColorStop(0.3,  hex);
      vg.addColorStop(1,    _darker(hex, 0.14));
      ctx.fillStyle = vg;
      ctx.fillRect(cx - w, bt, w * 2, bh + 1);

      // Horizontal gloss on left side
      const hg = ctx.createLinearGradient(cx - w/2, 0, cx + w/2, 0);
      hg.addColorStop(0,    'rgba(255,255,255,0)');
      hg.addColorStop(0.22, 'rgba(255,255,255,0.14)');
      hg.addColorStop(0.45, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(cx - w, bt, w * 2, bh);

      // Soft separator between bands
      if (i > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.fillRect(cx - w, curY - 1, w * 2, 2);
      }

      // Wave surface on topmost band
      if (isTop && waveState && waveState.amp > 0.3) {
        const amp   = waveState.amp;
        const phase = waveState.phase;
        const wl    = w * 1.6;
        ctx.fillStyle = _lighter(hex, 0.08);
        ctx.beginPath();
        ctx.moveTo(cx - wl, bt + amp);
        for (let px = cx - wl; px <= cx + wl; px += 1.5) {
          const wy = bt + amp * Math.sin((px - cx) / (w * 0.44) * Math.PI + phase);
          ctx.lineTo(px, wy);
        }
        ctx.lineTo(cx + wl, bt + amp);
        ctx.lineTo(cx + wl, bt + amp * 2.5);
        ctx.lineTo(cx - wl, bt + amp * 2.5);
        ctx.closePath();
        ctx.fill();
      }

      curY = bt;
    }
  }

  ctx.restore(); // ═══ END INNER – clip gone, back to rotated space ═══

  // ── Glass outline ───────────────────────────────────────────────
  const isHint = opts.hintSrc || opts.hintDst;
  ctx.strokeStyle =
    opts.selected  ? 'rgba(79,195,247,0.95)'  :
    opts.hintSrc   ? 'rgba(79,195,247,0.85)'  :
    opts.hintDst   ? 'rgba(105,240,174,0.85)' :
    opts.completed ? 'rgba(255,215,0,0.55)'   :
                     'rgba(255,255,255,0.26)';
  ctx.lineWidth = opts.selected ? 2.5 : (isHint ? 2.2 : 1.5);
  ctx.beginPath(); _tubePath(ctx, left, top, w, h, r, fl); ctx.stroke();

  // Bright rim line at top opening
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.46)';
  ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(left - fl + 2, top);
  ctx.lineTo(left + w + fl - 2, top);
  ctx.stroke();
  ctx.restore();

  // Left inner highlight streak
  ctx.save();
  const hl = ctx.createLinearGradient(left + 2, 0, left + 12, 0);
  hl.addColorStop(0,   'rgba(255,255,255,0)');
  hl.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  hl.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(left + 2, top + r + 5, 9, h - r - 16);
  // Subtle right reflection
  const hr = ctx.createLinearGradient(left + w - 11, 0, left + w - 2, 0);
  hr.addColorStop(0,   'rgba(255,255,255,0)');
  hr.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  hr.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = hr;
  ctx.fillRect(left + w - 10, top + r + 5, 8, h - r - 16);
  ctx.restore();

  ctx.restore(); // ═══ END OUTER – back to world space ═══════════
}

/* ===================================================================
   PARTICLE SYSTEM  (max 120, pooled)
   =================================================================== */
const Particles = (() => {
  const MAX = 120;
  const pool = [];
  let enabled = true;

  function spawn(x, y, type, options) {
    if (!enabled || pool.length >= MAX) return;
    pool.push(Object.assign({ type, x, y, life: 1.0 }, options));
  }

  function update(dt) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.x  += (p.vx || 0) * dt;
      p.y  += (p.vy || 0) * dt;
      p.vy  = ((p.vy || 0) + (p.gravity || 0) * dt) * (p.drag || 1);
      p.vx  = (p.vx || 0) * (p.drag || 1);
      p.life -= p.decay * dt;
      if (p.life <= 0) pool.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of pool) {
      const alpha = Math.max(0, p.life) * (p.alpha !== undefined ? p.alpha : 1);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'sparkle') {
        const r = (p.radius || 3) * Math.min(p.life * 1.4, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.38, 0, Math.PI * 2); ctx.fill();

      } else if (p.type === 'ring') {
        const prog = 1 - p.life;
        const r = p.r0 + (p.r1 - p.r0) * prog;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * p.life;
        ctx.globalAlpha = alpha * 0.80;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();

      } else if (p.type === 'drop') {
        const r = Math.max(0.5, (p.radius || 2) * p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();

      } else if (p.type === 'bubble') {
        const r = p.radius || 2;
        ctx.strokeStyle = p.color; ctx.lineWidth = 1;
        ctx.globalAlpha = alpha * 0.45;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(p.x - r*0.3, p.y - r*0.3, r*0.4, 0, Math.PI * 2); ctx.fill();

      } else if (p.type === 'shine') {
        // Horizontal shine sweep: p.x moves, p.h = tube height
        const sg = ctx.createLinearGradient(p.x - p.hw, p.cy, p.x + p.hw, p.cy);
        sg.addColorStop(0,   'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.38)');
        sg.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(p.x - p.hw, p.top, p.hw * 2, p.height);
      }

      ctx.restore();
    }
  }

  return {
    spawn, update, draw,
    clear()     { pool.length = 0; },
    active()    { return pool.length > 0; },
    setEnabled(v) { enabled = v; if (!v) pool.length = 0; },
  };
})();

/* ===================================================================
   EASING
   =================================================================== */
function _easeOut(t)    { return 1 - (1-t)*(1-t); }
function _easeInOut(t)  { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
function _easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1/d1)         return n1*t*t;
  if (t < 2/d1)       { t -= 1.5/d1; return n1*t*t + 0.75; }
  if (t < 2.5/d1)     { t -= 2.25/d1; return n1*t*t + 0.9375; }
  t -= 2.625/d1; return n1*t*t + 0.984375;
}

/* ===================================================================
   ANIMATION STATE
   =================================================================== */
let _tubeEls  = [];        // [{wrapper, canvas, ctx}]
let _tubeW    = 60;
let _tubeH    = 180;
let _overlayEl  = null;
let _overlayCtx = null;
let _waves    = {};        // tubeIdx -> {amp, phase, freq, lastT}
let _rafId    = null;
let _lastRafT = 0;
let _anim     = null;      // current pour animation
let _reduceEff = false;

function _reducedMotion() {
  return _reduceEff || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Compute world-space position of the tube's pour-side lip when tilted. */
function _lipPos(cx, cy, w, h, angle) {
  // Pour side = the side that becomes lower when tube tilts
  // For +angle (clockwise), pour out right side: local offset (+w/2, -h)
  // For -angle (counter-clockwise), pour out left: local offset (-w/2, -h)
  const side = angle >= 0 ? 1 : -1;
  const lx = side * w / 2, ly = -h;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return { x: cx + lx*ca - ly*sa, y: cy + lx*sa + ly*ca };
}

/** Draw the liquid stream from lip to destination surface. */
function _drawStream(ctx, lip, destX, destY, color, shimT) {
  const hex = COLOR_INFO[color].hex;
  const ctrlX = lip.x + (destX - lip.x) * 0.4;
  const ctrlY = Math.max(lip.y, destY) + 8 + Math.abs(destX - lip.x) * 0.08;
  const sw = 5;

  // Outer translucent stream
  ctx.strokeStyle = _hexA(hex, 0.52);
  ctx.lineWidth = sw + 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(lip.x, lip.y);
  ctx.quadraticCurveTo(ctrlX, ctrlY, destX, destY); ctx.stroke();

  // Inner bright core
  ctx.strokeStyle = _lighter(hex, 0.32);
  ctx.lineWidth = sw * 0.35;
  ctx.beginPath(); ctx.moveTo(lip.x, lip.y);
  ctx.quadraticCurveTo(ctrlX, ctrlY, destX, destY); ctx.stroke();

  // Moving shimmer dot on the bezier
  const qs = (Math.sin(shimT * 9) * 0.5 + 0.5); // 0–1 oscillating
  const qx = (1-qs)*(1-qs)*lip.x + 2*(1-qs)*qs*ctrlX + qs*qs*destX;
  const qy = (1-qs)*(1-qs)*lip.y + 2*(1-qs)*qs*ctrlY + qs*qs*destY;
  ctx.save();
  ctx.globalAlpha = 0.35 * (Math.sin(shimT * 13) * 0.5 + 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(qx, qy, 2.2, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Splash drops at landing
  if (!_reducedMotion() && Math.random() < 0.22) {
    for (let i = 0; i < 2; i++) {
      Particles.spawn(destX + (Math.random()-0.5)*7, destY, 'drop', {
        vx: (Math.random()-0.5)*48, vy: -8 - Math.random()*24,
        color: hex, radius: 1.5+Math.random(), decay: 2.0, gravity: 100, drag: 0.95,
      });
    }
  }
}

/** Trigger fusion visual effect at world position cx, cy. */
function _fusionEffect(fusionColor, cx, cy) {
  if (_reducedMotion()) return;
  const hex = COLOR_INFO[fusionColor].hex;
  Particles.spawn(cx, cy, 'ring', { r0: 5, r1: 55, color: hex, decay: 1.4 });
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const spd = 28 + Math.random() * 42;
    Particles.spawn(cx, cy, 'sparkle', {
      vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 22,
      color: hex, radius: 2+Math.random()*2.2,
      decay: 0.9+Math.random()*0.5, gravity: 32, drag: 0.95,
    });
  }
}

/** Trigger tube-complete shine + sparkles. */
function _completeEffect(wrapperRect) {
  if (_reducedMotion()) return;
  const cx = wrapperRect.left + wrapperRect.width / 2;
  const top = wrapperRect.top + (wrapperRect.height - _tubeH) / 2;
  // Shine sweep particle: x moves across tube width + a bit
  Particles.spawn(cx - _tubeW * 0.7, 0, 'shine', {
    vx: _tubeW * 2.5, vy: 0,
    top: top, height: _tubeH, cy: top + _tubeH/2, hw: _tubeW * 0.4,
    decay: 1.1,
  });
  // Gold sparkles at top
  for (let i = 0; i < 7; i++) {
    Particles.spawn(cx + (Math.random()-0.5)*_tubeW, top, 'sparkle', {
      vx: (Math.random()-0.5)*35, vy: -22-Math.random()*32,
      color: '#FFD700', radius: 2.2+Math.random()*1.5,
      decay: 0.9+Math.random()*0.4, gravity: 55, drag: 0.95,
    });
  }
}

/** Trigger a wave on a tube. */
function _wave(ti, amp) {
  if (_reducedMotion()) return;
  _waves[ti] = { amp: amp || 3, phase: 0, freq: 7 + Math.random()*4, lastT: performance.now() };
  _startRaf();
}

/** Interpolate source-tube drain during pour (fractional units). */
function _drainBands(preBands, color, units, t) {
  if (t <= 0) return preBands.map(b => ({...b}));
  if (t >= 1) return _removedBands(preBands, color, units);
  const clone = preBands.map(b => ({...b}));
  let rem = units * t;
  for (let i = clone.length-1; i >= 0 && rem > 0.001; i--) {
    if (clone[i].color === color) {
      const take = Math.min(clone[i].units, rem);
      clone[i].units -= take; rem -= take;
      if (clone[i].units <= 0.001) clone.splice(i, 1);
    } else break;
  }
  return clone;
}

function _removedBands(bands, color, units) {
  const clone = bands.map(b => ({...b}));
  let rem = units;
  for (let i = clone.length-1; i >= 0 && rem > 0; i--) {
    if (clone[i].color === color) {
      const take = Math.min(clone[i].units, rem);
      clone[i].units -= take; rem -= take;
      if (clone[i].units <= 0) clone.splice(i, 1);
    } else break;
  }
  return clone;
}

/** Interpolate dest-tube fill during pour. */
function _fillBands(preBands, color, units, t) {
  if (t <= 0) return preBands.map(b => ({...b}));
  const clone = preBands.map(b => ({...b}));
  const adding = units * t;
  if (adding < 0.001) return clone;
  if (clone.length && clone[clone.length-1].color === color) {
    clone[clone.length-1].units += adding;
  } else {
    clone.push({ color, units: adding });
  }
  return clone;
}

/* ===================================================================
   RAF LOOP
   =================================================================== */
function _startRaf() {
  if (!_rafId) {
    _lastRafT = performance.now();
    _rafId = requestAnimationFrame(_tick);
  }
}

function _tick(now) {
  const dt = Math.min((now - _lastRafT) / 1000, 0.05);
  _lastRafT = now;
  let cont = false;

  // Clear overlay
  if (_overlayCtx && _overlayEl) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    _overlayCtx.setTransform(1,0,0,1,0,0);
    _overlayCtx.clearRect(0, 0, _overlayEl.width, _overlayEl.height);
    _overlayCtx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ── Pour animation ────────────────────────────────────────────
  if (_anim) {
    cont = true;
    const a      = _anim;
    const elapsed = now - a.startTime;
    const { P0, P1, P2, P3, P4 } = a;
    const total  = P0 + P1 + P2 + P3 + P4;
    const shimT  = now * 0.001;

    let angle = 0, offX = 0, offY = 0;
    let streamOn = false;
    let curSrc = a.preSrcBands;
    let curDst = a.preDstBands;

    if (elapsed < P0) {
      // Lift + approach
      const t = _easeOut(elapsed / P0);
      offY = -18 * t;
      offX = (a.dstCx - a.srcCx) * 0.28 * t;

    } else if (elapsed < P0 + P1) {
      // Tilt
      const t = _easeInOut((elapsed - P0) / P1);
      angle = a.pourAngle * t;
      offY = -18; offX = (a.dstCx - a.srcCx) * 0.28;
      streamOn = Math.abs(angle) >= Math.abs(a.streamStart);

    } else if (elapsed < P0 + P1 + P2) {
      // Pour: drain source, fill dest, draw stream
      const t = _easeInOut((elapsed - P0 - P1) / P2);
      angle = a.pourAngle; offY = -18; offX = (a.dstCx - a.srcCx) * 0.28;
      streamOn = true;

      curSrc = _drainBands(a.preSrcBands, a.srcColor, a.units, t);
      if (a.type === 'fuse') {
        // For fuse: dest stays same level; at midpoint swap color
        curDst = t < 0.5 ? a.preDstBands : a.postDstBands;
      } else {
        curDst = _fillBands(a.preDstBands, a.srcColor, a.units, t);
      }

      // Redraw dest canvas
      _redrawBands(a.di, curDst);
      Sound.updatePourFill(curDst.reduce((s,b)=>s+b.units,0) / TUBE_CAPACITY);

      // Bubble particles in dest
      if (!_reducedMotion() && Math.random() < 0.07 && _tubeEls[a.di]) {
        const dr = _tubeEls[a.di].wrapper.getBoundingClientRect();
        Particles.spawn(
          dr.left + dr.width/2 + (Math.random()-0.5)*_tubeW*0.4,
          dr.bottom - Math.random()*_tubeH*0.55,
          'bubble', {
            vx: (Math.random()-0.5)*5, vy: -18-Math.random()*28,
            color: 'rgba(255,255,255,0.4)',
            radius: 1+Math.random()*2, decay: 0.8+Math.random()*0.5, gravity: 0, drag: 0.99,
          }
        );
      }

      // Bubble audio plips
      if (Math.random() < 0.04) Sound.bubble();

      // Fusion trigger at midpoint
      if (a.type === 'fuse' && t >= 0.5 && !a.fuseDone) {
        a.fuseDone = true;
        const dr = _tubeEls[a.di] && _tubeEls[a.di].wrapper.getBoundingClientRect();
        if (dr) _fusionEffect(a.fusionResult, dr.left+dr.width/2, dr.top+dr.height*0.3);
        Sound.fuse(); Haptic.fuse();
      }

    } else if (elapsed < P0 + P1 + P2 + P3) {
      // Untilt
      const t = _easeOut((elapsed - P0 - P1 - P2) / P3);
      angle = a.pourAngle * (1 - t);
      offY = -18 * (1 - t * 0.5); offX = (a.dstCx - a.srcCx) * 0.28 * (1 - t);
      curSrc = a.postSrcBands; curDst = a.postDstBands;
      _redrawBands(a.di, curDst);

    } else if (elapsed < total) {
      // Return + bounce settle
      const t = _easeOutBounce((elapsed - P0 - P1 - P2 - P3) / P4);
      offY = -18 * (1-t) * 0.25; offX = 0;
      angle = 0;
      curSrc = a.postSrcBands; curDst = a.postDstBands;

    } else {
      _finishAnim();
      cont = false;
      // Fall through to continue particle/wave updates below
    }

    // Draw animated source tube on overlay
    if (_anim && _overlayCtx) {
      const animCx = a.srcCx + offX;
      const animCy = a.srcCy + offY;
      drawTubeOnCtx(_overlayCtx, animCx, animCy, _tubeW, _tubeH, angle, curSrc, _waves[a.si], {});

      if (streamOn) {
        const lip = _lipPos(animCx, animCy, _tubeW, _tubeH, angle);
        const dstEl = _tubeEls[a.di];
        if (dstEl) {
          const dr = dstEl.wrapper.getBoundingClientRect();
          const dstCx = dr.left + dr.width / 2;
          const dstUnits = curDst.reduce((s,b)=>s+b.units, 0);
          const dstSurfY = dr.bottom - (dstUnits / TUBE_CAPACITY) * _tubeH - 2;
          _drawStream(_overlayCtx, lip, dstCx, dstSurfY, a.srcColor, shimT);
        }
      }
    }
  }

  // ── Waves ─────────────────────────────────────────────────────
  for (const ti in _waves) {
    const w = _waves[ti];
    const dtt = (now - w.lastT) / 1000;
    w.lastT = now;
    w.phase += w.freq * dtt;
    w.amp   *= Math.pow(0.03, dtt);
    if (w.amp < 0.25) { delete _waves[ti]; }
    else { _redrawTube(parseInt(ti)); cont = true; }
  }

  // ── Particles ─────────────────────────────────────────────────
  if (Particles.active()) {
    cont = true;
    Particles.update(dt);
    if (_overlayCtx) Particles.draw(_overlayCtx);
  }

  if (cont) {
    _rafId = requestAnimationFrame(_tick);
  } else {
    _rafId = null;
    // Clear overlay if nothing active
    if (_overlayCtx && _overlayEl) {
      _overlayCtx.setTransform(1,0,0,1,0,0);
      _overlayCtx.clearRect(0, 0, _overlayEl.width, _overlayEl.height);
    }
  }
}

function _finishAnim() {
  if (!_anim) return;
  const a = _anim;
  _anim = null;
  Sound.stopPour();

  // Restore source tube canvas visibility
  if (_tubeEls[a.si]) _tubeEls[a.si].canvas.style.visibility = '';

  // Final redraw
  _renderTubesAll();

  // Tube-complete effect for newly completed tubes
  if (a.prevTubes && _st.tubes) {
    for (let i = 0; i < _st.tubes.length; i++) {
      if (isTubeComplete(_st.tubes[i]) && !isTubeComplete(a.prevTubes[i])) {
        const el = _tubeEls[i];
        if (el) _completeEffect(el.wrapper.getBoundingClientRect());
        Sound.tubeDone();
        _startRaf();
      }
    }
  }

  _st.animating = false;
  _afterMove();
}

/* ===================================================================
   TUBE CANVAS HELPERS
   =================================================================== */
function _initOverlay() {
  _overlayEl = document.getElementById('anim-overlay');
  if (!_overlayEl) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  _overlayEl.width  = window.innerWidth  * dpr;
  _overlayEl.height = window.innerHeight * dpr;
  _overlayEl.style.width  = window.innerWidth  + 'px';
  _overlayEl.style.height = window.innerHeight + 'px';
  _overlayCtx = _overlayEl.getContext('2d');
  _overlayCtx.setTransform(dpr,0,0,dpr,0,0);
}

function _computeTubeSize(n) {
  const area = document.getElementById('tube-area');
  if (!area) return;
  const aW = area.clientWidth  - 20;
  const aH = area.clientHeight - 16;
  const GAP = 10;
  const cols = n <= 5 ? n : Math.ceil(n / 2);
  const rows = n <= 5 ? 1 : 2;
  _tubeW = Math.max(44, Math.min(90, Math.floor((aW - (cols-1)*GAP) / cols)));
  _tubeH = Math.max(120, Math.min(220,
    Math.floor((_tubeW * 2.75)),
    Math.floor((aH - (rows-1)*18) / rows)
  ));
  document.documentElement.style.setProperty('--tube-w', _tubeW + 'px');
  document.documentElement.style.setProperty('--tube-h', _tubeH + 'px');
  document.documentElement.style.setProperty('--tube-gap', GAP + 'px');
}

function _setupTubeCanvas(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cw = (_tubeW + 10) * dpr, ch = (_tubeH + 14) * dpr;
  canvas.width = cw; canvas.height = ch;
  canvas.style.width  = (_tubeW + 10) + 'px';
  canvas.style.height = (_tubeH + 14) + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

/** Redraw tube i using its current game state bands. */
function _redrawTube(ti) {
  if (!_tubeEls[ti] || !_st.tubes) return;
  _redrawBands(ti, _bands(_st.tubes[ti]));
}

/** Redraw tube i using provided bands. */
function _redrawBands(ti, bands) {
  const el = _tubeEls[ti];
  if (!el) return;
  const ctx = el.ctx;
  const cW = _tubeW + 10, cH = _tubeH + 14;
  ctx.setTransform(Math.min(devicePixelRatio||1,2),0,0,Math.min(devicePixelRatio||1,2),0,0);
  ctx.clearRect(0, 0, cW, cH);
  const cx = cW / 2, cy = _tubeH + 7; // bottom-centre in canvas coords
  const tube = _st.tubes && _st.tubes[ti];
  drawTubeOnCtx(ctx, cx, cy, _tubeW, _tubeH, 0, bands, _waves[ti], {
    selected:  ti === _st.selectedTube,
    hintSrc:   _st.hintMove && ti === _st.hintMove.src,
    hintDst:   _st.hintMove && ti === _st.hintMove.dst,
    completed: tube && isTubeComplete(tube),
  });
}

function _buildTubeDOM() {
  const area = document.getElementById('tube-area');
  area.innerHTML = '';
  _tubeEls = [];
  _st.tubes.forEach((_, ti) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tube-wrapper';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('aria-label', 'Tube ' + (ti+1));
    wrapper.addEventListener('click', () => _onTap(ti));

    const canvas = document.createElement('canvas');
    canvas.className = 'tube-canvas';
    wrapper.appendChild(canvas);
    area.appendChild(wrapper);

    const ctx = _setupTubeCanvas(canvas);
    _tubeEls.push({ wrapper, canvas, ctx });
  });
}

function _renderTubesAll() {
  if (!_tubeEls.length || _tubeEls.length !== _st.tubes.length) {
    _computeTubeSize(_st.tubes.length);
    _buildTubeDOM();
  } else {
    _computeTubeSize(_st.tubes.length);
    // Re-setup canvases in case size changed
    _tubeEls.forEach(el => {
      const ctx = _setupTubeCanvas(el.canvas);
      el.ctx = ctx;
    });
  }
  _st.tubes.forEach((_, ti) => {
    if (_anim && ti === _anim.si) return; // animated on overlay
    _redrawTube(ti);
    // Apply hint / selected CSS classes
    const wrapper = _tubeEls[ti].wrapper;
    wrapper.classList.toggle('selected',  ti === _st.selectedTube);
    wrapper.classList.toggle('hint-src',  !!(  _st.hintMove && ti === _st.hintMove.src));
    wrapper.classList.toggle('hint-dst',  !!(  _st.hintMove && ti === _st.hintMove.dst));
  });
}

/* ===================================================================
   POUR ANIMATION KICK-OFF
   =================================================================== */
function _startPourAnim(si, di, moveResult) {
  const srcEl = _tubeEls[si], dstEl = _tubeEls[di];
  if (!srcEl || !dstEl) {
    // Fallback: instant
    _st.animating = false;
    _renderTubesAll();
    _afterMove();
    return;
  }

  const sRect = srcEl.wrapper.getBoundingClientRect();
  const dRect = dstEl.wrapper.getBoundingClientRect();

  const srcCx = sRect.left + sRect.width / 2;
  const srcCy = sRect.bottom - 7; // matches canvas bottom-centre offset
  const dstCx = dRect.left + dRect.width / 2;

  const tiltDir = dstCx >= srcCx ? 1 : -1;
  const srcFill = moveResult.prePourSrc.length / TUBE_CAPACITY;
  const pourDeg = 55 + (1 - srcFill) * 20;
  const pourAngle = tiltDir * pourDeg * Math.PI / 180;
  const streamStart = tiltDir * pourDeg * 0.60 * Math.PI / 180;

  // Hide source canvas (we draw it on the overlay during animation)
  srcEl.canvas.style.visibility = 'hidden';

  Sound.startPour(dRect.bottom - (moveResult.prePourDst.length / TUBE_CAPACITY) * _tubeH);
  Haptic.pour();

  _anim = {
    type:          moveResult.moveType,
    si, di,
    srcCx, srcCy, dstCx,
    pourAngle, streamStart, tiltDir,
    srcColor:      moveResult.srcColor || tubeTop(moveResult.prePourSrc),
    fillColor:     moveResult.moveType === 'fuse' ? moveResult.fusionResult : (moveResult.srcColor || tubeTop(moveResult.prePourSrc)),
    fusionResult:  moveResult.fusionResult,
    units:         moveResult.units,
    preSrcBands:   _bands(moveResult.prePourSrc),
    preDstBands:   _bands(moveResult.prePourDst),
    postSrcBands:  _bands(moveResult.postPourSrc),
    postDstBands:  _bands(moveResult.postPourDst),
    prevTubes:     moveResult.prevTubesAll,
    fuseDone:      false,
    startTime:     performance.now(),
    // Timeline (ms)
    P0: 150,  // lift + approach
    P1: 280,  // tilt
    P2: 520,  // pour
    P3: 160,  // untilt
    P4: 190,  // return + bounce
  };

  _startRaf();
}

/* ===================================================================
   SHAKE
   =================================================================== */
function _shake(si, di) {
  [si, di].forEach(idx => {
    const el = _tubeEls[idx];
    if (!el) return;
    el.wrapper.classList.add('shake');
    setTimeout(() => el.wrapper && el.wrapper.classList.remove('shake'), 400);
  });
}

/* ===================================================================
   APP STATE & FLOW
   =================================================================== */
let _st = {
  mode: 'home',
  levelNum: 1, tubes: [], target: [], par: 0,
  moveCount: 0, history: [], selectedTube: -1,
  animating: false, won: false,
  undosLeft: 3, FREE_UNDOS: 3,
  dailyDayNum: 0, dailySeed: 0,
  challengeCode: '', challengeSeed: 0, challengeDiff: 0,
  tutorialActive: false, hintMove: null,
  levelsCompleted: 0,
  _currentSeed: 0, _currentDiff: 1,
  _winCode: '', _winStars: 1,
  _jumpLevel: 0, _forcedSeed: undefined,
};

let _settings = { sound: true, haptics: true, colorblind: false, reduceEffects: false, volume: 0.65 };
let _best = {}, _daily = { streak: 0, lastDate: '', results: {} }, _tutDone = {};

const $ = id => document.getElementById(id);

const dom = {
  homeScreen:       $('home-screen'),
  app:              $('app'),
  homeLevelInfo:    $('home-level-info'),
  homeStreak:       $('home-streak'),
  streakNum:        $('streak-num'),
  btnPlay:          $('btn-play'),
  btnDaily:         $('btn-daily'),
  codeInput:        $('code-input'),
  btnCodeGo:        $('btn-code-go'),
  btnHomeSettings:  $('btn-home-settings'),
  tubeArea:         $('tube-area'),
  targetTubes:      $('target-tubes'),
  hudLevel:         $('hud-level'),
  hudMoves:         $('hud-moves'),
  hudPar:           $('hud-par'),
  undoCount:        $('undo-count'),
  btnBack:          $('btn-back'),
  btnUndo:          $('btn-undo'),
  btnHint:          $('btn-hint'),
  btnRestart:       $('btn-restart'),
  btnSettings:      $('btn-settings'),
  tutorialBar:      $('tutorial-bar'),
  tutorialText:     $('tutorial-text'),
  btnSkipTut:       $('btn-skip-tutorial'),
  winOverlay:       $('win-overlay'),
  winStars:         $('win-stars'),
  winInfo:          $('win-info'),
  winCodeBox:       $('win-code-box'),
  btnShareResult:   $('btn-share-result'),
  btnShareCard:     $('btn-share-card'),
  btnNext:          $('btn-next'),
  btnRemoveAdsWin:  $('btn-remove-ads-win'),
  dailyDoneOverlay: $('daily-done-overlay'),
  dailyStars:       $('daily-stars'),
  dailyInfo:        $('daily-info'),
  dailyStreakLine:  $('daily-streak-line'),
  dailyCountdownLine: $('daily-countdown-line'),
  btnDailyShare:    $('btn-daily-share'),
  btnDailyShareCard:$('btn-daily-share-card'),
  btnDailyHome:     $('btn-daily-home'),
  shareOverlay:     $('share-overlay'),
  btnSaveImage:     $('btn-save-image'),
  btnShareImage:    $('btn-share-image'),
  btnCloseShare:    $('btn-close-share'),
  settingsOverlay:  $('settings-overlay'),
  setSound:         $('set-sound'),
  setHaptics:       $('set-haptics'),
  setColorblind:    $('set-colorblind'),
  setReduce:        $('set-reduce'),
  volSlider:        $('vol-slider'),
  btnRemoveAds:     $('btn-remove-ads'),
  btnRestore:       $('btn-restore'),
  btnCloseSettings: $('btn-close-settings'),
};

/* ---- init ---- */
function _init() {
  _loadSave();
  _parseURL();
  _applySettings();
  _bindEvents();
  Monetization.init();
  _updateHome();
  _initOverlay();
  window.addEventListener('resize', () => {
    _initOverlay();
    if (_st.mode !== 'home' && !_st.animating) _renderTubesAll();
  });
  if (_st._jumpLevel) _startLevel(_st._jumpLevel);
}

function _parseURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('level')) { const n=parseInt(p.get('level'),10); if(n>0){_st.levelNum=n;_st._jumpLevel=n;} }
  if (p.has('seed')) _st._forcedSeed = parseInt(p.get('seed'),10);
}

function _loadSave() {
  const d = Save.load(); if (!d) return;
  if (d.levelNum)         _st.levelNum = d.levelNum;
  if (d.settings)         _settings = { ..._settings, ...d.settings };
  if (d.best)             _best = d.best;
  if (d.daily)            _daily = { ..._daily, ...d.daily };
  if (d.tutorialDone)     _tutDone = d.tutorialDone;
  if (d.levelsCompleted)  _st.levelsCompleted = d.levelsCompleted;
}

function _persist() {
  Save.save({ levelNum:_st.levelNum, settings:_settings, best:_best, daily:_daily, tutorialDone:_tutDone, levelsCompleted:_st.levelsCompleted });
}

/* ---- settings ---- */
function _applySettings() {
  Sound.setEnabled(_settings.sound);
  Haptic.setEnabled(_settings.haptics);
  Sound.setVolume(_settings.volume);
  _reduceEff = _settings.reduceEffects;
  Particles.setEnabled(!_reduceEff);
  document.body.classList.toggle('colorblind',      _settings.colorblind);
  document.body.classList.toggle('reduce-effects',  _settings.reduceEffects);
  dom.setSound.checked      = _settings.sound;
  dom.setHaptics.checked    = _settings.haptics;
  dom.setColorblind.checked = _settings.colorblind;
  dom.setReduce.checked     = _settings.reduceEffects;
  dom.volSlider.value       = _settings.volume;
  if (Monetization.isAdsRemoved()) {
    dom.btnRemoveAds.textContent = 'Ads Removed ✓';
    dom.btnRemoveAds.disabled = true;
    dom.btnRemoveAdsWin.classList.add('hidden');
  }
}

/* ---- events ---- */
function _bindEvents() {
  dom.btnPlay.addEventListener('click',         () => { Sound.select(); _startLevel(_st.levelNum); });
  dom.btnDaily.addEventListener('click',        () => { Sound.select(); _startDaily(); });
  dom.btnCodeGo.addEventListener('click',       () => { Sound.select(); _loadCode(); });
  dom.codeInput.addEventListener('keydown',     e  => { if(e.key==='Enter') _loadCode(); });
  dom.btnHomeSettings.addEventListener('click', () => { Sound.select(); _showOverlay(dom.settingsOverlay, true); });
  dom.btnBack.addEventListener('click',         () => { Sound.select(); _goHome(); });
  dom.btnUndo.addEventListener('click',         _onUndo);
  dom.btnHint.addEventListener('click',         _onHint);
  dom.btnRestart.addEventListener('click',      () => { Sound.select(); _restart(); });
  dom.btnSettings.addEventListener('click',     () => { Sound.select(); _showOverlay(dom.settingsOverlay, true); });
  dom.btnSkipTut.addEventListener('click',      _skipTut);
  dom.btnNext.addEventListener('click',         () => { Sound.select(); _nextLevel(); });
  dom.btnShareResult.addEventListener('click',  _shareResult);
  dom.btnShareCard.addEventListener('click',    _openShareCard);
  dom.btnRemoveAdsWin.addEventListener('click', _buyRemoveAds);
  dom.btnDailyShare.addEventListener('click',   _shareDailyText);
  dom.btnDailyShareCard.addEventListener('click',_openShareCard);
  dom.btnDailyHome.addEventListener('click',    () => { Sound.select(); _goHome(); });
  dom.btnSaveImage.addEventListener('click',    () => shareOrDownloadCanvas($('share-canvas'),'hue-pour-share.png'));
  dom.btnShareImage.addEventListener('click',   () => shareOrDownloadCanvas($('share-canvas'),'hue-pour-share.png'));
  dom.btnCloseShare.addEventListener('click',   () => _showOverlay(dom.shareOverlay, false));
  dom.setSound.addEventListener('change',       () => { _settings.sound     =dom.setSound.checked;      _applySettings(); });
  dom.setHaptics.addEventListener('change',     () => { _settings.haptics   =dom.setHaptics.checked;    _applySettings(); });
  dom.setColorblind.addEventListener('change',  () => { _settings.colorblind=dom.setColorblind.checked; _applySettings(); _renderTubesAll(); });
  dom.setReduce.addEventListener('change',      () => { _settings.reduceEffects=dom.setReduce.checked;  _applySettings(); });
  dom.volSlider.addEventListener('input',       () => { _settings.volume=parseFloat(dom.volSlider.value); Sound.setVolume(_settings.volume); });
  dom.btnRemoveAds.addEventListener('click',    _buyRemoveAds);
  dom.btnRestore.addEventListener('click',      async () => {
    await Monetization.restorePurchases(); _applySettings();
    Toast.show(Monetization.isAdsRemoved() ? 'Purchases restored!' : 'No purchases found');
  });
  dom.btnCloseSettings.addEventListener('click', () => { _showOverlay(dom.settingsOverlay,false); _persist(); });
}

function _showOverlay(el, show) {
  el.classList.toggle('hidden', !show);
  el.setAttribute('aria-hidden', String(!show));
}

/* ---- home ---- */
function _updateHome() {
  dom.homeLevelInfo.textContent = 'Level ' + _st.levelNum;
  if (_daily.streak > 0) {
    dom.homeStreak.classList.remove('hidden');
    dom.streakNum.textContent = _daily.streak;
  } else { dom.homeStreak.classList.add('hidden'); }
  dom.btnDaily.textContent = _daily.results[_todayStr()]
    ? '📅 Daily ✓ Done' : '📅 Daily Puzzle';
}

function _goHome() {
  Sound.stopAmbience();
  _st.mode = 'home'; _st.animating = false; _st.won = false; _st.hintMove = null;
  _anim = null;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  Particles.clear(); _waves = {};
  dom.app.classList.add('hidden');
  dom.homeScreen.classList.remove('hidden');
  _showOverlay(dom.winOverlay, false);
  _showOverlay(dom.dailyDoneOverlay, false);
  _showOverlay(dom.shareOverlay, false);
  dom.tutorialBar.classList.add('hidden');
  _updateHome(); _persist();
}

function _showGame(title) {
  dom.homeScreen.classList.add('hidden');
  dom.app.classList.remove('hidden');
  dom.hudLevel.textContent = title;
  _initOverlay();
  Sound.startAmbience();
}

/* ---- start modes ---- */
function _startLevel(num) {
  _st.mode = 'level'; _st.levelNum = num; _st.won = false;
  _st.moveCount = 0; _st.history = []; _st.selectedTube = -1;
  _st.animating = false; _st.undosLeft = _st.FREE_UNDOS; _st.hintMove = null;
  _waves = {}; _anim = null;
  _showOverlay(dom.winOverlay, false);
  const seed = _st._forcedSeed !== undefined ? _st._forcedSeed : undefined;
  const lv = generateLevel(num, seed);
  _st.tubes = lv.tubes; _st.target = lv.target; _st.par = lv.par;
  _st._currentSeed = lv.seed; _st._currentDiff = lv.target.length;
  _showGame('Level ' + num);
  _renderAll(); _persist(); _maybeStartTut(num);
}

function _startDaily() {
  const ts = _todayStr();
  if (_daily.results[ts]) { _showDailyDone(_daily.results[ts]); return; }
  _st.mode = 'daily'; _st.won = false; _st.moveCount = 0; _st.history = [];
  _st.selectedTube = -1; _st.animating = false; _st.undosLeft = _st.FREE_UNDOS; _st.hintMove = null;
  _waves = {}; _anim = null;
  const lv = generateDailyLevel();
  _st.tubes = lv.tubes; _st.target = lv.target; _st.par = lv.par;
  _st.dailyDayNum = lv.dayNum; _st.dailySeed = lv.seed;
  _st._currentSeed = lv.seed; _st._currentDiff = lv.target.length;
  _showGame('Daily #' + lv.dayNum); _renderAll();
}

function _loadCode() {
  const raw = dom.codeInput.value.trim(); if (!raw) return;
  const dec = decodeChallenge(raw);
  if (!dec) { Toast.show('Invalid code — check and try again'); return; }
  const lv = generateChallengeLevel(dec.seed, dec.difficulty);
  if (!lv) { Toast.show('Could not load this puzzle'); return; }
  _st.mode = 'challenge'; _st.won = false; _st.moveCount = 0; _st.history = [];
  _st.selectedTube = -1; _st.animating = false; _st.undosLeft = _st.FREE_UNDOS; _st.hintMove = null;
  _st.challengeCode = raw.toUpperCase(); _st.challengeSeed = lv.seed; _st.challengeDiff = lv.difficulty;
  _st.tubes = lv.tubes; _st.target = lv.target; _st.par = lv.par;
  _st._currentSeed = lv.seed; _st._currentDiff = lv.difficulty;
  _waves = {}; _anim = null;
  _showGame('Challenge'); _renderAll(); dom.codeInput.value = '';
}

/* ---- tutorial ---- */
function _maybeStartTut(n) {
  if (n > 3 || _tutDone[n]) {
    _st.tutorialActive = false; dom.tutorialBar.classList.add('hidden'); return;
  }
  _st.tutorialActive = true; _showTutHint();
}

function _showTutHint() {
  if (!_st.tutorialActive) return;
  const hint = getHint(_st.tubes, _st.target);
  if (!hint) { _skipTut(); return; }
  _st.hintMove = hint;
  const st = tubeTop(_st.tubes[hint.src]), dt = tubeTop(_st.tubes[hint.dst]);
  let txt;
  if (hint.type === 'fuse') {
    const res = getFusionResult(st, dt);
    txt = 'Pour ' + COLOR_INFO[st].name + ' onto ' + COLOR_INFO[dt].name + ' to make ' + COLOR_INFO[res].name + '!';
  } else if (!_st.tubes[hint.dst].length) {
    txt = 'Move ' + COLOR_INFO[st].name + ' to the empty tube';
  } else {
    txt = 'Pour ' + COLOR_INFO[st].name + ' to group the colors';
  }
  dom.tutorialText.textContent = txt;
  dom.tutorialBar.classList.remove('hidden');
  _renderTubesAll();
}

function _skipTut() {
  _st.tutorialActive = false; _st.hintMove = null;
  dom.tutorialBar.classList.add('hidden');
  _tutDone[_st.levelNum] = true; _persist(); _renderTubesAll();
}

/* ---- render ---- */
function _renderAll() { _renderHUD(); _renderTarget(); _renderTubesAll(); }

function _renderHUD() {
  dom.hudMoves.textContent = 'Moves: ' + _st.moveCount;
  dom.hudPar.textContent   = 'Par: '   + _st.par;
  dom.undoCount.textContent = '(' + _st.undosLeft + ')';
}

function _renderTarget() {
  dom.targetTubes.innerHTML = '';
  for (const color of _st.target) {
    const info = COLOR_INFO[color];
    const tube = document.createElement('div');
    tube.className = 'target-tube';
    for (let i = 0; i < TUBE_CAPACITY; i++) {
      const u = document.createElement('div');
      u.className = 'target-unit'; u.style.background = info.hex;
      const cb = document.createElement('span'); cb.className = 'cb'; cb.textContent = info.symbol;
      u.appendChild(cb); tube.appendChild(u);
    }
    dom.targetTubes.appendChild(tube);
  }
}

/* ---- interaction ---- */
function _onTap(idx) {
  if (_st.animating || _st.won) return;

  if (_st.selectedTube < 0) {
    if (!_st.tubes[idx].length) return;
    _st.selectedTube = idx;
    Sound.select(); Haptic.select();
    _renderTubesAll(); return;
  }

  if (_st.selectedTube === idx) {
    Sound.deselect();
    _st.selectedTube = -1; _renderTubesAll(); return;
  }

  const si = _st.selectedTube;
  const analysis = analyzePour(_st.tubes, si, idx);

  if (analysis.type === 'illegal') {
    Sound.error(); Haptic.error();
    _st.selectedTube = -1; _renderTubesAll(); _shake(si, idx); return;
  }

  _st.animating = true;
  _st.selectedTube = -1;

  const prevTubes = cloneTubes(_st.tubes);
  _st.history.push(prevTubes);

  const result = executePour(_st.tubes, si, idx);
  const prevSrc = prevTubes[si];
  const prevDst = prevTubes[idx];
  _st.tubes = result.newTubes;
  _st.moveCount++;
  _renderHUD();

  // Gather info for animation
  const moveResult = {
    moveType:     result.moveType,
    srcColor:     result.moveType === 'fuse' ? result.srcColor : (result.color || tubeTop(prevSrc)),
    units:        result.units,
    fusionResult: result.fusionResult,
    prePourSrc:   prevSrc,
    prePourDst:   prevDst,
    postPourSrc:  _st.tubes[si],
    postPourDst:  _st.tubes[idx],
    prevTubesAll: prevTubes,
  };

  if (_reducedMotion()) {
    // Instant, no animation
    _renderTubesAll();
    _st.animating = false;
    _afterMove();
    return;
  }

  _startPourAnim(si, idx, moveResult);
}

/* ---- after each move ---- */
function _afterMove() {
  _st.hintMove = null;
  if (_st.tutorialActive) _showTutHint();
  if (checkWin(_st.tubes, _st.target)) { _st.won = true; _onWin(); }
}

/* ---- win ---- */
function _onWin() {
  const moves = _st.moveCount, par = _st.par;
  let stars = moves <= par ? 3 : (moves <= par+3 ? 2 : 1);
  _st.levelsCompleted++;
  if (_st.tutorialActive) _skipTut();
  const code = encodeChallenge(_st._currentSeed, _st._currentDiff);

  if (_st.mode === 'daily') { _onDailyWin(moves, par, stars, code); return; }

  const prev = _best[_st.levelNum];
  if (!prev || stars>prev.stars || (stars===prev.stars && moves<prev.moves))
    _best[_st.levelNum] = { moves, stars };
  if (_st.mode === 'level') _st.levelNum++;
  _persist();

  setTimeout(() => {
    _renderStars(dom.winStars, stars);
    dom.winInfo.innerHTML = 'Moves: <strong>' + moves + '</strong> &nbsp;|&nbsp; Par: <strong>' + par + '</strong>';
    dom.winCodeBox.textContent = code;
    _st._winCode = code; _st._winStars = stars;
    if (!Monetization.isAdsRemoved() && _st.levelsCompleted > 5) dom.btnRemoveAdsWin.classList.remove('hidden');
    Sound.win(); _showOverlay(dom.winOverlay, true);
    _maybeInterstitial();
  }, 400);
}

function _onDailyWin(moves, par, stars, code) {
  const ts = _todayStr();
  _daily.results[ts] = { moves, par, stars, code, dayNum: _st.dailyDayNum };
  const yesterday = _dateStr(new Date(Date.now()-86400000));
  if (_daily.lastDate === yesterday || _daily.lastDate === ts) _daily.streak++;
  else _daily.streak = 1;
  _daily.lastDate = ts; _st._winCode = code; _st._winStars = stars;
  _persist();
  setTimeout(() => { _showDailyDone({ moves, par, stars, code, dayNum: _st.dailyDayNum }); Sound.win(); }, 400);
}

function _showDailyDone(r) {
  _renderStars(dom.dailyStars, r.stars);
  dom.dailyInfo.innerHTML = 'Moves: <strong>'+r.moves+'</strong> &nbsp;|&nbsp; Par: <strong>'+r.par+'</strong>';
  dom.dailyStreakLine.textContent = '🔥 ' + _daily.streak + ' day streak';
  const now = new Date(), tmrw = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const diff = tmrw-now, h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
  dom.dailyCountdownLine.textContent = 'Come back tomorrow! ⏱ '+h+'h '+m+'m '+s+'s';
  _showOverlay(dom.dailyDoneOverlay, true);
}

function _renderStars(el, n) {
  el.innerHTML = '';
  for (let i=0;i<3;i++) {
    const s=document.createElement('span'); s.textContent='★'; s.className=i<n?'star-on':'star-off'; el.appendChild(s);
  }
}

/* ---- share ---- */
function _shareResult() {
  const code = _st._winCode||'', emojis=_st.target.map(c=>COLOR_EMOJI[c]||'').join('');
  let title;
  if (_st.mode==='daily') title='Hue Pour Daily #'+_st.dailyDayNum;
  else if (_st.mode==='challenge') title='Hue Pour Challenge '+_st.challengeCode;
  else title='Hue Pour Level '+(_st.levelNum-1);
  shareText(title+' — solved in '+_st.moveCount+' moves (par '+_st.par+') '+emojis+(code?'\n'+code:''));
}

function _shareDailyText() {
  const r=_daily.results[_todayStr()]; if(!r) return;
  const emojis=_st.target.map(c=>COLOR_EMOJI[c]||'').join('');
  shareText('Hue Pour #'+r.dayNum+' — solved in '+r.moves+' moves (par '+r.par+') '+emojis);
}

function _openShareCard() {
  const title = _st.mode==='daily' ? 'Daily #'+_st.dailyDayNum
              : _st.mode==='challenge' ? 'Challenge' : 'Level '+(_st.mode==='level'?_st.levelNum-1:_st.levelNum);
  renderShareCard({ title, target:_st.target, moves:_st.moveCount, par:_st.par, stars:_st._winStars||1, code:_st._winCode||'' });
  _showOverlay(dom.shareOverlay, true);
}

/* ---- monetization ---- */
async function _maybeInterstitial() {
  if (_st.levelsCompleted<=5) return;
  if (_st.levelsCompleted%4!==0) return;
  await Monetization.showInterstitial();
}
async function _buyRemoveAds() {
  const ok = await Monetization.purchaseRemoveAds();
  if (ok) { Toast.show('Ads removed! Thank you!'); _applySettings(); }
}

/* ---- undo ---- */
function _onUndo() {
  Sound.select();
  if (_st.animating || _st.won) return;
  if (_st.undosLeft>0 && _st.history.length>0) {
    _st.tubes = _st.history.pop();
    _st.moveCount = Math.max(0,_st.moveCount-1);
    _st.selectedTube = -1; _st.undosLeft--; _st.hintMove = null; _waves = {};
    _renderAll();
    if (_st.tutorialActive) _showTutHint();
    return;
  }
  if (!_st.history.length) { Toast.show('Nothing to undo'); return; }
  Toast.show('Watch a short ad for 3 more undos');
  Monetization.showRewarded().then(ok => {
    if (ok) { _st.undosLeft+=3; Toast.show('+3 undos!'); _renderHUD(); }
  });
}

/* ---- hint ---- */
function _onHint() {
  Sound.select();
  if (_st.animating || _st.won) return;
  Toast.show('Watch a short ad for a hint');
  Monetization.showRewarded().then(ok => {
    if (!ok) return;
    const hint = getHint(_st.tubes, _st.target);
    if (hint) {
      _st.hintMove = hint; _renderTubesAll();
      const st2=tubeTop(_st.tubes[hint.src]);
      const dstStr=_st.tubes[hint.dst].length?COLOR_INFO[tubeTop(_st.tubes[hint.dst])].name:'empty tube';
      Toast.show('Try '+COLOR_INFO[st2].name+' → '+dstStr, 3500);
    } else { Toast.show('No hint available'); }
  });
}

/* ---- restart ---- */
function _restart() {
  if (_st.animating) return;
  _waves = {}; _anim = null;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  Particles.clear();
  if (_st.mode==='daily') _startDaily();
  else if (_st.mode==='challenge') _restartChallenge();
  else _startLevel(_st.levelNum);
}

function _restartChallenge() {
  const lv = generateChallengeLevel(_st.challengeSeed, _st.challengeDiff); if(!lv) return;
  _st.won=false; _st.moveCount=0; _st.history=[]; _st.selectedTube=-1; _st.animating=false;
  _st.undosLeft=_st.FREE_UNDOS; _st.hintMove=null;
  _st.tubes=lv.tubes; _st.target=lv.target; _st.par=lv.par;
  _renderAll();
}

function _nextLevel() { _st._forcedSeed=undefined; _startLevel(_st.levelNum); }

/* ---- date helpers ---- */
function _todayStr() {
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _dateStr(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

/* ---- BOOT ---- */
_init();

// Export for external access if needed
const App = { state: _st, startLevel: _startLevel, goHome: _goHome };
