// ============================================================
// HUE POUR — UI Layer  v6
// New tube geometry, lip-anchored pour, volume-based liquid
// Flat glass tubes, straight vertical stream, original doodle bg
// GAME LOGIC (game.js, monetization.js) UNTOUCHED
// ============================================================
'use strict';

/* ===================================================================
   COLOR HELPERS  — single source of truth from game.js COLOR_INFO
   =================================================================== */
function _hex(c) { return COLOR_INFO[c].hex; }

function _hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function _hexA(hex, a) {
  const [r,g,b] = _hexToRgb(hex);
  return 'rgba('+r+','+g+','+b+','+a.toFixed(3)+')';
}
function _lighter(hex, t) {
  const [r,g,b] = _hexToRgb(hex);
  return 'rgb('+Math.round(r+(255-r)*t)+','+Math.round(g+(255-g)*t)+','+Math.round(b+(255-b)*t)+')';
}
function _darker(hex, t) {
  const [r,g,b] = _hexToRgb(hex);
  return 'rgb('+Math.round(r*(1-t))+','+Math.round(g*(1-t))+','+Math.round(b*(1-t))+')';
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

  // ---- Celebration sounds ----
  function pentatonic(i) {
    if (!enabled) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
    osc(scale[i % scale.length], 0.22, 'triangle', 0.14);
  }

  function victoryArpeggio() {
    if (!enabled) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => osc(f, 0.28, 'sine', 0.13), i * 75));
  }

  function whoosh() {
    if (!enabled) return; ensure();
    const len = actx.sampleRate;
    const bf = actx.createBuffer(1, len, actx.sampleRate);
    const dd = bf.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = Math.random() * 2 - 1;
    const s = actx.createBufferSource(); s.buffer = bf;
    const fl = actx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2.5;
    const t = actx.currentTime;
    fl.frequency.setValueAtTime(200, t);
    fl.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    fl.frequency.exponentialRampToValueAtTime(350, t + 0.38);
    const gg = actx.createGain();
    gg.gain.setValueAtTime(0.10, t);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    s.connect(fl); fl.connect(gg); gg.connect(dst());
    s.start(t); s.stop(t + 0.5);
  }

  function ding(pitch) {
    if (!enabled) return;
    osc(pitch || 1500, 0.35, 'sine', 0.16);
    osc((pitch || 1500) * 1.498, 0.22, 'sine', 0.07);
  }

  function btnClick() { if (!enabled) return; osc(900, 0.025, 'sine', 0.05); }

  return {
    setEnabled(v)  { enabled = v; if (!v) { Sound.stopAmbience(); _stopPour(0.05); } },
    setVolume(v)   { vol = v; if (master) master.gain.setTargetAtTime(v, actx.currentTime, 0.05); },
    isEnabled()    { return enabled; },
    getCtx()       { ensure(); return actx; },

    // Glass tap for select/deselect
    select()   { osc(1200, 0.07, 'sine', 0.10); },
    deselect() { osc(900,  0.06, 'sine', 0.07); },

    startPour, updatePourFill,
    stopPour() { _stopPour(); },

    bubble,

    fuse() {
      if (!enabled) return; ensure();
      // Warm bloop with pitch bend
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
      // Bright glass ting: two detuned sines
      [2000, 2214].forEach(f => osc(f, 0.65, 'sine', 0.14));
    },

    error() {
      if (!enabled) return; ensure();
      // Short low thud
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

    pentatonic, victoryArpeggio, whoosh, ding, btnClick,
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
   SHARE HELPERS
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
  const cols = info.target.map(cl => _hex(cl));
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
function _easeOutBack(t) { const c = 1.70158; return 1 + (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); }

/* ===================================================================
   PARTICLE SYSTEM  (max 80, pooled)
   =================================================================== */
const Particles = (() => {
  const MAX = 80;
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

      } else if (p.type === 'shine') {
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
   CONFETTI SYSTEM  (max 150, for celebrations)
   =================================================================== */
const Confetti = (() => {
  const MAX = 150;
  const pool = [];
  let enabled = true;

  function spawn(x, y, color, type) {
    if (!enabled || pool.length >= MAX) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 280;
    pool.push({
      type: type || ['rect','star','circle','ribbon'][Math.floor(Math.random()*4)],
      x, y,
      vx: Math.cos(angle) * speed * (0.3 + Math.random() * 0.7),
      vy: Math.sin(angle) * speed - 180 - Math.random() * 150,
      spin: Math.random() * Math.PI * 2,
      spinV: (Math.random() - 0.5) * 12,
      size: 4 + Math.random() * 7,
      color,
      life: 1.0,
      decay: 0.25 + Math.random() * 0.2,
      gravity: 320 + Math.random() * 80,
      drag: 0.985,
    });
  }

  function burst(cx, cy, colors, count) {
    for (let i = 0; i < count; i++) {
      spawn(cx + (Math.random()-0.5)*60, cy + (Math.random()-0.5)*40,
            colors[Math.floor(Math.random()*colors.length)]);
    }
  }

  function _star5(ctx, r1, r2) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? r1 : r2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
  }

  function update(dt) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.vy += p.gravity * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += p.spinV * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0 || p.y > window.innerHeight + 50) pool.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of pool) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      if (p.type === 'rect') {
        ctx.fillRect(-p.size/2, -p.size*0.3, p.size, p.size*0.6);
      } else if (p.type === 'star') {
        _star5(ctx, p.size * 0.5, p.size * 0.22);
      } else if (p.type === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.size * 0.4, 0, Math.PI*2); ctx.fill();
      } else if (p.type === 'ribbon') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-p.size, 0);
        ctx.quadraticCurveTo(0, p.size * Math.sin(p.spin * 2), p.size, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return {
    spawn, burst, update, draw,
    clear() { pool.length = 0; },
    active() { return pool.length > 0; },
    setEnabled(v) { enabled = v; if (!v) pool.length = 0; },
  };
})();

/* ===================================================================
   TUBE GEOMETRY — square top, semicircular bottom, thin outline
   =================================================================== */

/**
 * Build tube path.  Origin: (left, top) of bounding box.
 * Square top corners, semicircular bottom (radius = w/2).
 */
function _tubePath(ctx, left, top, w, h) {
  const r = w / 2;
  ctx.moveTo(left, top);
  ctx.lineTo(left + w, top);
  ctx.lineTo(left + w, top + h - r);
  ctx.arcTo(left + w, top + h, left + w / 2, top + h, r);
  ctx.arcTo(left, top + h, left, top + h - r, r);
  ctx.lineTo(left, top);
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
   CORE TUBE DRAW — flat colors, clip-based horizontal liquid
   ===================================================================
   Parameters:
     ctx       CanvasRenderingContext2D
     cx, cy    Bottom-centre of tube in canvas coordinates (rotation pivot)
     w, h      Tube outer width/height
     angle     Rotation in radians (0 = upright)
     bands     [{color, units}]  — units can be fractional
     waveState {amp, phase}
     opts      {selected, hintSrc, hintDst, completed, noGlass, colorblind}
   =================================================================== */
function drawTubeOnCtx(ctx, cx, cy, w, h, angle, bands, waveState, opts) {
  opts = opts || {};
  const left = cx - w / 2;
  const top  = cy - h;
  const strokeW = w * 0.055;
  // Inner dimensions (inset by stroke)
  const iLeft = left + strokeW / 2;
  const iTop  = top + strokeW / 2;
  const iW    = w - strokeW;
  const iH    = h - strokeW / 2;
  const unitH = iH * 0.22;   // each unit = 22% of inner height
  const r = w / 2;

  // ══ OUTER SAVE – apply tube rotation ═══════════════════════════
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);

  // ══ INNER SAVE – clip tube interior, then counter-rotate for liquid ═══
  const totalUnits = bands.reduce((s, b) => s + b.units, 0);
  if (totalUnits > 0) {
    ctx.save();
    // Clip to tube interior
    ctx.beginPath();
    _tubePath(ctx, iLeft, iTop, iW, iH);
    ctx.clip();

    // Counter-rotate: now in WORLD space, still clipped to tilted tube
    ctx.translate(cx, cy); ctx.rotate(-angle); ctx.translate(-cx, -cy);

    // Draw liquid bands (horizontal rectangles in world space)
    let curY = cy;
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const bh   = band.units * unitH;
      const bt   = curY - bh;
      const hex  = _hex(band.color);
      const isTop = (i === bands.length - 1);

      // Flat solid color
      ctx.fillStyle = hex;
      ctx.fillRect(cx - w * 1.5, bt, w * 3, bh + 0.5);

      // Crisp boundary line between bands so adjacent wheel colours stay distinct
      if (i > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(cx - w * 1.5, curY - 0.8, w * 3, 1.6);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(cx - w * 1.5, curY - 1.6, w * 3, 0.8);
      }

      // Surface wave on topmost band
      if (isTop && waveState && waveState.amp > 0.3 && !_reducedMotion()) {
        const amp = waveState.amp;
        const phase = waveState.phase;
        ctx.fillStyle = _lighter(hex, 0.08);
        ctx.beginPath();
        ctx.moveTo(cx - w * 1.5, bt + amp);
        for (let px = cx - w * 1.5; px <= cx + w * 1.5; px += 2) {
          const wy = bt + amp * Math.sin((px - cx) / (w * 0.44) * Math.PI + phase);
          ctx.lineTo(px, wy);
        }
        ctx.lineTo(cx + w * 1.5, bt + amp * 2.5);
        ctx.lineTo(cx - w * 1.5, bt + amp * 2.5);
        ctx.closePath();
        ctx.fill();
      }

      // Colorblind symbol on each unit (dark outline + white fill for high contrast on all 12 hues)
      if (opts.colorblind) {
        const sym = COLOR_INFO[band.color].symbol;
        const fs = Math.max(10, Math.round(w * 0.24));
        ctx.font = 'bold ' + fs + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, w * 0.055);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.68)';
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        for (let u = 0; u < Math.ceil(band.units); u++) {
          const symY = curY - (u + 0.5) * unitH;
          if (symY - bt >= unitH * 0.25) {
            ctx.strokeText(sym, cx, symY);
            ctx.fillText(sym, cx, symY);
          }
        }
      }

      curY = bt;
    }

    ctx.restore(); // end clip
  }

  // ── Glass outline (thin #CFCFCF, square top, semicircular bottom) ──
  if (!opts.noGlass) {
    const glassColor =
      opts.selected  ? 'rgba(79,195,247,0.95)'  :
      opts.hintSrc   ? 'rgba(79,195,247,0.85)'  :
      opts.hintDst   ? 'rgba(105,240,174,0.85)' :
      opts.completed ? 'rgba(255,215,0,0.55)'   :
                       '#CFCFCF';
    ctx.strokeStyle = glassColor;
    ctx.lineWidth = opts.selected ? strokeW * 1.5 : strokeW;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Draw open-mouth tube: sides + bottom, NO top line
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, top + h - r);
    ctx.arcTo(left, top + h, left + r, top + h, r);
    ctx.arcTo(left + w, top + h, left + w, top + h - r, r);
    ctx.lineTo(left + w, top);
    ctx.stroke();
  }

  ctx.restore(); // end rotation
}

/* ===================================================================
   ANIMATION STATE
   =================================================================== */
let _tubeEls  = [];        // [{wrapper, canvas, ctx}]
let _tubeW    = 55;
let _tubeH    = 204;
let _overlayEl  = null;
let _overlayCtx = null;
let _waves    = {};        // tubeIdx -> {amp, phase, freq, lastT}
let _rafId    = null;
let _lastRafT = 0;
let _anim     = null;      // current pour animation
let _reduceEff = false;
let _celeb     = null;
let _comboCount = 0;
let _lastFuse   = false;
let _bgCanvas   = null;
let _bgCtx      = null;
let _bgShapes   = [];
let _slowmo     = 1.0;     // ?slowmo=0.25 for debug

function _reducedMotion() {
  return _reduceEff || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* ===================================================================
   LIP POSITION — world-space position of pour-side mouth corner
   For lip-anchored rotation: the lip stays fixed, body rotates around it
   =================================================================== */
function _lipPos(cx, cy, w, h, angle, tiltDir) {
  // Lip is at the top corner on the destination side
  // Local offset from bottom-centre: (tiltDir * w/2, -h)
  const lx = tiltDir * w / 2;
  const ly = -h;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return { x: cx + lx*ca - ly*sa, y: cy + lx*sa + ly*ca };
}

/** Compute pour angle where liquid surface just reaches the lip.
 *  h = current liquid height, L = inner straight length, w = inner width */
function _computePourAngle(h, L, w) {
  if (h <= 0.001) return Math.PI * 100 / 180;
  let tanTheta;
  if (h >= L / 2) tanTheta = 2 * (L - h) / w;
  else tanTheta = (L * L) / (2 * w * h);
  if (tanTheta <= 0) return Math.PI * 100 / 180;
  return Math.min(Math.atan(tanTheta), Math.PI * 100 / 180);
}

/** Draw the liquid stream — straight vertical line from lip to dest surface. */
function _drawStream(ctx, lipX, lipY, destX, destY, color, streamWidth, streamAlpha) {
  const hex = _hex(color);
  const sw = streamWidth;

  // Straight vertical line from lip down
  ctx.save();
  ctx.strokeStyle = _hexA(hex, 0.85 * streamAlpha);
  ctx.lineWidth = sw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lipX, lipY);
  ctx.lineTo(lipX, destY);
  ctx.stroke();
  ctx.restore();

  // Impact droplets
  if (!_reducedMotion() && Math.random() < 0.18) {
    for (let i = 0; i < 3; i++) {
      Particles.spawn(lipX + (Math.random()-0.5)*6, destY, 'drop', {
        vx: (Math.random()-0.5)*40, vy: -6 - Math.random()*18,
        color: hex, radius: 1+Math.random(), decay: 2.0, gravity: 100, drag: 0.95,
      });
    }
  }
}

/** Trigger fusion visual effect. */
function _fusionEffect(fusionColor, cx, cy) {
  if (_reducedMotion()) return;
  const hex = _hex(fusionColor);
  Particles.spawn(cx, cy, 'ring', { r0: 5, r1: 50, color: hex, decay: 1.4 });
  const count = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const spd = 25 + Math.random() * 35;
    Particles.spawn(cx, cy, 'sparkle', {
      vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 20,
      color: hex, radius: 2+Math.random()*2,
      decay: 0.9+Math.random()*0.4, gravity: 30, drag: 0.95,
    });
  }
}

/** Tube-complete shine + sparkles. */
function _completeEffect(wrapperRect) {
  if (_reducedMotion()) return;
  const cx = wrapperRect.left + wrapperRect.width / 2;
  const top = wrapperRect.top + (wrapperRect.height - _tubeH) / 2;
  Particles.spawn(cx - _tubeW * 0.7, 0, 'shine', {
    vx: _tubeW * 2.5, vy: 0,
    top: top, height: _tubeH, cy: top + _tubeH/2, hw: _tubeW * 0.4,
    decay: 1.1,
  });
  for (let i = 0; i < 6; i++) {
    Particles.spawn(cx + (Math.random()-0.5)*_tubeW, top, 'sparkle', {
      vx: (Math.random()-0.5)*30, vy: -20-Math.random()*28,
      color: '#FFD700', radius: 2+Math.random()*1.5,
      decay: 0.9+Math.random()*0.4, gravity: 50, drag: 0.95,
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
  const rawDt = Math.min((now - _lastRafT) / 1000, 0.05);
  const dt = rawDt * _slowmo;
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
    const a = _anim;
    const rawElapsed = now - a.startTime;
    const elapsed = rawElapsed * _slowmo;

    const { P1_DUR, P2_DUR, P3_DUR } = a;
    const totalDur = P1_DUR + P2_DUR + P3_DUR;

    // Source tube dimensions
    const w = _tubeW;
    const h = _tubeH;
    const strokeW = w * 0.055;
    const innerW = w - strokeW;
    const innerH = h - strokeW / 2;
    const unitH = innerH * 0.22;
    const L = innerH - w / 2; // straight inner length (total - semicircle radius)

    let angle = 0;
    let streamOn = false;
    let streamAlpha = 1;
    let curSrc = a.preSrcBands;
    let curDst = a.preDstBands;
    let pourT = 0;

    // Current liquid height in source
    const srcUnitsStart = a.preSrcBands.reduce((s,b) => s + b.units, 0);
    const srcUnitsEnd = a.postSrcBands.reduce((s,b) => s + b.units, 0);
    const hStart = srcUnitsStart * unitH;
    const hEnd = srcUnitsEnd * unitH;

    // Target angle at start of pour (angle where liquid reaches lip at h_start)
    const angleStart = _computePourAngle(hStart, L, innerW);

    if (elapsed < P1_DUR) {
      // PHASE 1: travel + tilt to angleStart
      const t = _easeInOut(elapsed / P1_DUR);
      angle = a.tiltDir * angleStart * t;

    } else if (elapsed < P1_DUR + P2_DUR) {
      // PHASE 2: pour — angle computed from liquid level
      pourT = _easeInOut((elapsed - P1_DUR) / P2_DUR);
      const curH = hStart + (hEnd - hStart) * pourT;
      const curAngle = _computePourAngle(curH, L, innerW);
      angle = a.tiltDir * curAngle;
      streamOn = true;

      curSrc = _drainBands(a.preSrcBands, a.srcColor, a.units, pourT);
      if (a.type === 'fuse') {
        curDst = pourT < 0.5 ? a.preDstBands : a.postDstBands;
      } else {
        curDst = _fillBands(a.preDstBands, a.srcColor, a.units, pourT);
      }

      // Redraw dest canvas
      _redrawBands(a.di, curDst);
      Sound.updatePourFill(curDst.reduce((s,b) => s + b.units, 0) / TUBE_CAPACITY);

      // Bubble plips
      if (Math.random() < 0.04) Sound.bubble();

      // Fusion trigger at midpoint
      if (a.type === 'fuse' && pourT >= 0.5 && !a.fuseDone) {
        a.fuseDone = true;
        const dr = _tubeEls[a.di] && _tubeEls[a.di].wrapper.getBoundingClientRect();
        if (dr) _fusionEffect(a.fusionResult, dr.left+dr.width/2, dr.top+dr.height*0.3);
        Sound.fuse(); Haptic.fuse();
      }

    } else if (elapsed < totalDur) {
      // PHASE 3: return — tilt back to 0, return to slot
      const t = _easeInOut((elapsed - P1_DUR - P2_DUR) / P3_DUR);
      // Spring overshoot (6%)
      const springT = t < 0.7 ? t / 0.7 : 1.0 + 0.06 * Math.sin((t - 0.7) / 0.3 * Math.PI);
      const endAngle = _computePourAngle(hEnd, L, innerW);
      angle = a.tiltDir * endAngle * (1 - springT);
      curSrc = a.postSrcBands;
      curDst = a.postDstBands;
      _redrawBands(a.di, curDst);

      // Stream detach: top falls down
      if (t < 0.15) {
        streamOn = true;
        streamAlpha = 1 - t / 0.15;
      }

    } else {
      _finishAnim();
      cont = false;
    }

    // Draw animated source tube on overlay using lip-anchored transform
    if (_anim && _overlayCtx) {
      // Compute lip world position: lip stays at target position
      const lipWorldX = a.lipTargetX;
      const lipWorldY = a.lipTargetY;

      // The lip in tube-local coords (relative to bottom-centre):
      // lip = (tiltDir * w/2, -h)
      const lipLocalX = a.tiltDir * w / 2;
      const lipLocalY = -h;

      // Phase 1 interpolation: move lip from original to target
      let lipX, lipY;
      if (elapsed < P1_DUR) {
        const t = _easeInOut(elapsed / P1_DUR);
        lipX = a.srcLipOrigX + (lipWorldX - a.srcLipOrigX) * t;
        lipY = a.srcLipOrigY + (lipWorldY - a.srcLipOrigY) * t - 0.35 * w * Math.sin(t * Math.PI);
      } else if (elapsed < P1_DUR + P2_DUR) {
        lipX = lipWorldX;
        lipY = lipWorldY;
      } else {
        // Phase 3: return to original position
        const t = _easeInOut((elapsed - P1_DUR - P2_DUR) / P3_DUR);
        const springT = t < 0.7 ? t / 0.7 : 1.0 + 0.06 * Math.sin((t - 0.7) / 0.3 * Math.PI);
        lipX = lipWorldX + (a.srcLipOrigX - lipWorldX) * springT;
        lipY = lipWorldY + (a.srcLipOrigY - lipWorldY) * springT;
      }

      // Draw tube: translate so lip is at lipX,lipY, rotate around lip
      _overlayCtx.save();
      _overlayCtx.translate(lipX, lipY);
      _overlayCtx.rotate(angle);
      // Now draw tube with bottom-centre at (-lipLocalX, -lipLocalY) = (-lipLocalX, h)
      const drawCx = -lipLocalX;
      const drawCy = h; // bottom-centre in rotated space
      drawTubeOnCtx(_overlayCtx, drawCx, drawCy, w, h, 0, curSrc, _waves[a.si], {
        colorblind: document.body.classList.contains('colorblind'),
      });
      _overlayCtx.restore();

      // Draw stream
      if (streamOn) {
        // Stream from lip straight down to dest surface
        const dstEl = _tubeEls[a.di];
        if (dstEl) {
          const dr = dstEl.wrapper.getBoundingClientRect();
          const dstUnits = curDst.reduce((s,b) => s + b.units, 0);
          // Surface Y: bottom of tube canvas minus padding, then subtract liquid height
          const dstInnerH = _tubeH - _tubeW * 0.055 / 2;
          const dstLiqH = dstUnits * dstInnerH * 0.22;
          const dstBottomY = dr.bottom - 7; // bottom of tube in screen coords
          const dstSurfY = dstBottomY - dstLiqH;
          const streamW = w * 0.07;
          // Width eases in
          const streamElapsed = elapsed - P1_DUR;
          const widthFrac = Math.min(1, streamElapsed / 100);
          _drawStream(_overlayCtx, lipX, lipY, lipX,
            Math.max(lipY + 5, dstSurfY),
            a.srcColor, streamW * widthFrac, streamAlpha);
        }
      }
    }
  }

  // ── Waves ─────────────────────────────────────────────────────
  for (const ti in _waves) {
    const w = _waves[ti];
    const dtt = rawDt;
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

  // ── Confetti ──────────────────────────────────────────────────
  if (Confetti.active()) {
    cont = true;
    Confetti.update(dt);
    if (_overlayCtx) Confetti.draw(_overlayCtx);
  }

  // ── Celebration ───────────────────────────────────────────────
  if (_celeb) { cont = true; _tickCelebration(now); }

  // ── Hint arrow ────────────────────────────────────────────────
  if (_st.hintMove && !_anim && !_celeb && _overlayCtx) {
    _drawHintArrow(_overlayCtx, now); cont = true;
  }

  // ── Background ambient ────────────────────────────────────────
  if (_st.mode !== 'home' && !document.hidden && !_reducedMotion()) {
    _tickBg(now); cont = true;
  }

  if (cont) {
    _rafId = requestAnimationFrame(_tick);
  } else {
    _rafId = null;
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

  // Wave on dest
  _wave(a.di, 3);

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
  const colW = Math.min(480, area.clientWidth);
  const availW = Math.max(200, colW - 24);
  const aH = area.clientHeight - 16;

  const rows = n <= 5 ? 1 : (n <= 10 ? 2 : 3);
  const cols = Math.ceil(n / rows);
  const gapFrac = cols >= 5 ? 0.44 : 0.56;
  const rowGapFrac = rows > 2 ? 0.45 : (rows === 2 ? 0.7 : 0.6);

  _tubeW = Math.max(28, Math.round(colW * (n <= 10 ? 0.115 : 0.092)));

  // Constrain horizontally so `cols` tubes fit on one row without accidental wrapping
  const maxWForCols = (availW - cols * 10) / (cols + (cols - 1) * gapFrac);
  if (maxWForCols > 0 && _tubeW > maxWForCols) {
    _tubeW = Math.max(24, Math.floor(maxWForCols));
  }

  _tubeH = Math.round(_tubeW * 3.7);
  let GAP = Math.max(6, Math.round(_tubeW * gapFrac));
  let rowGap = Math.round(_tubeH * rowGapFrac);

  // Constrain vertically so all `rows` fit cleanly inside #tube-area
  const needH = rows * (_tubeH + 14) + (rows - 1) * rowGap;
  if (needH > aH && aH > 0) {
    const maxHPerTube = (aH - rows * 14) / (rows + (rows - 1) * rowGapFrac);
    _tubeH = Math.max(88, Math.floor(maxHPerTube));
    _tubeW = Math.max(24, Math.round(_tubeH / 3.7));
    GAP = Math.max(6, Math.round(_tubeW * gapFrac));
    rowGap = Math.round(_tubeH * rowGapFrac);
  }

  document.documentElement.style.setProperty('--tube-w', _tubeW + 'px');
  document.documentElement.style.setProperty('--tube-h', _tubeH + 'px');
  document.documentElement.style.setProperty('--tube-gap', GAP + 'px');
  document.documentElement.style.setProperty('--row-gap', (rows > 1 ? rowGap : GAP) + 'px');
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

function _redrawTube(ti) {
  if (!_tubeEls[ti] || !_st.tubes) return;
  _redrawBands(ti, _bands(_st.tubes[ti]));
}

function _redrawBands(ti, bands) {
  const el = _tubeEls[ti];
  if (!el) return;
  const ctx = el.ctx;
  const cW = _tubeW + 10, cH = _tubeH + 14;
  ctx.setTransform(Math.min(devicePixelRatio||1,2),0,0,Math.min(devicePixelRatio||1,2),0,0);
  ctx.clearRect(0, 0, cW, cH);
  const cx = cW / 2, cy = _tubeH + 7;
  const tube = _st.tubes && _st.tubes[ti];
  drawTubeOnCtx(ctx, cx, cy, _tubeW, _tubeH, 0, bands, _waves[ti], {
    selected:  ti === _st.selectedTube,
    hintSrc:   _st.hintMove && ti === _st.hintMove.src,
    hintDst:   _st.hintMove && ti === _st.hintMove.dst,
    completed: tube && isTubeComplete(tube),
    colorblind: document.body.classList.contains('colorblind'),
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
    _tubeEls.forEach(el => {
      const ctx = _setupTubeCanvas(el.canvas);
      el.ctx = ctx;
    });
  }
  _st.tubes.forEach((_, ti) => {
    if (_anim && ti === _anim.si) return;
    _redrawTube(ti);
    const wrapper = _tubeEls[ti].wrapper;
    wrapper.classList.toggle('selected',  ti === _st.selectedTube);
    wrapper.classList.toggle('hint-src',  !!(_st.hintMove && ti === _st.hintMove.src));
    wrapper.classList.toggle('hint-dst',  !!(_st.hintMove && ti === _st.hintMove.dst));
  });
}

/* ===================================================================
   POUR ANIMATION KICK-OFF — lip-anchored
   =================================================================== */
function _startPourAnim(si, di, moveResult) {
  const srcEl = _tubeEls[si], dstEl = _tubeEls[di];
  if (!srcEl || !dstEl) {
    _st.animating = false;
    _renderTubesAll();
    _afterMove();
    return;
  }

  const sRect = srcEl.wrapper.getBoundingClientRect();
  const dRect = dstEl.wrapper.getBoundingClientRect();

  const srcCx = sRect.left + sRect.width / 2;
  const srcCy = sRect.bottom - 7;
  const dstCx = dRect.left + dRect.width / 2;
  const dstCy = dRect.top + 7; // top of dest tube (mouth)

  const tiltDir = dstCx >= srcCx ? 1 : -1;

  // Lip target: directly above horizontal center of dest mouth
  const lipTargetX = dstCx;
  const lipTargetY = dstCy - _tubeW * 0.5;

  // Original lip position (upright source tube, lip side)
  const srcLipOrigX = srcCx + tiltDir * _tubeW / 2;
  const srcLipOrigY = srcCy - _tubeH;

  // Compute timing
  const units = moveResult.units;
  const P1_DUR = 450; // travel + tilt
  const P2_DUR = 600 + units * 100; // pour
  const P3_DUR = 400; // return

  // Hide source canvas
  srcEl.canvas.style.visibility = 'hidden';

  Sound.startPour(moveResult.prePourDst.length / TUBE_CAPACITY);
  Haptic.pour();

  _anim = {
    type:          moveResult.moveType,
    si, di,
    srcCx, srcCy, dstCx,
    tiltDir,
    lipTargetX, lipTargetY,
    srcLipOrigX, srcLipOrigY,
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
    P1_DUR, P2_DUR, P3_DUR,
  };

  _startRaf();
}

/* ===================================================================
   SHAKE — 3 oscillations, 250ms
   =================================================================== */
function _shake(si, di) {
  [si, di].forEach(idx => {
    const el = _tubeEls[idx];
    if (!el) return;
    el.wrapper.classList.add('shake');
    setTimeout(() => el.wrapper && el.wrapper.classList.remove('shake'), 260);
  });
}

/* ===================================================================
   APP STATE & FLOW
   =================================================================== */
let _st = {
  mode: 'home',
  levelNum: 1, tubes: [], target: [], par: 0,
  initialTubes: [], forwardMoves: [],
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
  cheerText:        $('cheer-text'),
  comboFlash:       $('combo-flash'),
  progressText:     $('progress-text'),
  progressFill:     $('progress-fill'),
  progressWrap:     document.getElementById('progress-wrap'),
  winStarfield:     $('win-starfield'),
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
  _initBg();
  _updateProgress();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { /* pause idle */ }
  });
  window.addEventListener('resize', () => {
    _initOverlay();
    _initBg();
    if (_st.mode !== 'home' && !_st.animating) _renderTubesAll();
  });
  if (_st._jumpLevel) _startLevel(_st._jumpLevel);
}

function _parseURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('level')) { const n=parseInt(p.get('level'),10); if(n>0){_st.levelNum=n;_st._jumpLevel=n;} }
  if (p.has('seed')) _st._forcedSeed = parseInt(p.get('seed'),10);
  if (p.has('slowmo')) _slowmo = parseFloat(p.get('slowmo')) || 1.0;
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
  Confetti.setEnabled(!_reduceEff);
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
  document.addEventListener('pointerdown', e => { if (e.target.closest('button')) Sound.btnClick(); });
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
  _updateProgress();
}

function _goHome() {
  Sound.stopAmbience();
  _st.mode = 'home'; _st.animating = false; _st.won = false; _st.hintMove = null;
  _anim = null;
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  if (_celeb) {
    try { document.removeEventListener('pointerdown', _skipCelebration); } catch(e){}
    _celeb = null;
  }
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  Particles.clear(); Confetti.clear(); _waves = {};
  _comboCount = 0; _lastFuse = false;
  document.body.style.transform = '';
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
  _startRaf();
}

/* ---- start modes ---- */
function _startLevel(num) {
  _st.mode = 'level'; _st.levelNum = num; _st.won = false;
  _st.moveCount = 0; _st.history = []; _st.selectedTube = -1;
  _st.animating = false; _st.undosLeft = _st.FREE_UNDOS; _st.hintMove = null;
  _waves = {}; _anim = null;
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  _showOverlay(dom.winOverlay, false);
  const seed = _st._forcedSeed !== undefined ? _st._forcedSeed : undefined;
  const lv = generateLevel(num, seed);
  _st.tubes = lv.tubes; _st.target = lv.target; _st.par = lv.par;
  _st.initialTubes = cloneTubes(lv.tubes);
  _st.forwardMoves = lv.forwardMoves || [];
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
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  const lv = generateDailyLevel();
  _st.tubes = lv.tubes; _st.target = lv.target; _st.par = lv.par;
  _st.initialTubes = cloneTubes(lv.tubes);
  _st.forwardMoves = lv.forwardMoves || [];
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
  _st.initialTubes = cloneTubes(lv.tubes);
  _st.forwardMoves = lv.forwardMoves || [];
  _st._currentSeed = lv.seed; _st._currentDiff = lv.difficulty;
  _waves = {}; _anim = null;
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
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
  const hint = getHint(_st.tubes, _st.target, {
    initialTubes: _st.initialTubes,
    forwardMoves: _st.forwardMoves,
  });
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
  const compact = _st.target.length > 7;
  dom.targetTubes.classList.toggle('compact', compact);
  for (const color of _st.target) {
    const info = COLOR_INFO[color];
    const tube = document.createElement('div');
    tube.className = 'target-tube' + (compact ? ' target-compact' : '');
    for (let i = 0; i < TUBE_CAPACITY; i++) {
      const u = document.createElement('div');
      u.className = 'target-unit'; u.style.background = _hex(color);
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
    // Lift selected tube
    const el = _tubeEls[idx];
    if (el) {
      el.wrapper.style.transition = 'transform 0.15s ease-out';
      el.wrapper.style.transform = 'translateY(-' + Math.round(_tubeW * 0.25) + 'px)';
    }
    _renderTubesAll(); return;
  }

  if (_st.selectedTube === idx) {
    Sound.deselect();
    // Lower tube back
    const el = _tubeEls[idx];
    if (el) {
      el.wrapper.style.transition = 'transform 0.15s ease-out';
      el.wrapper.style.transform = '';
    }
    _st.selectedTube = -1; _renderTubesAll(); return;
  }

  const si = _st.selectedTube;
  // Lower previously selected tube
  const prevEl = _tubeEls[si];
  if (prevEl) {
    prevEl.wrapper.style.transition = 'transform 0.15s ease-out';
    prevEl.wrapper.style.transform = '';
  }

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
  _checkCombo(result.moveType === 'fuse');
  _renderHUD();

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

  _st._winCode = code; _st._winStars = stars;

  if (_st.mode === 'daily') {
    const ts = _todayStr();
    _daily.results[ts] = { moves, par, stars, code, dayNum: _st.dailyDayNum };
    const yesterday = _dateStr(new Date(Date.now()-86400000));
    if (_daily.lastDate === yesterday || _daily.lastDate === ts) _daily.streak++;
    else _daily.streak = 1;
    _daily.lastDate = ts;
  } else {
    const prev = _best[_st.levelNum];
    if (!prev || stars>prev.stars || (stars===prev.stars && moves<prev.moves))
      _best[_st.levelNum] = { moves, stars };
    if (_st.mode === 'level') { _st.levelNum++; _checkMilestone(); }
  }
  _persist();

  _startCelebration(stars, moves, par, _st.target, code);
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
    const hint = getHint(_st.tubes, _st.target, {
      initialTubes: _st.initialTubes,
      forwardMoves: _st.forwardMoves,
    });
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
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  if (_celeb) {
    try { document.removeEventListener('pointerdown', _skipCelebration); } catch(e){}
    _celeb = null;
  }
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  Particles.clear(); Confetti.clear();
  _comboCount = 0; _lastFuse = false;
  document.body.style.transform = '';
  if (_st.mode==='daily') _startDaily();
  else if (_st.mode==='challenge') _restartChallenge();
  else _startLevel(_st.levelNum);
}

function _restartChallenge() {
  const lv = generateChallengeLevel(_st.challengeSeed, _st.challengeDiff); if(!lv) return;
  _st.won=false; _st.moveCount=0; _st.history=[]; _st.selectedTube=-1; _st.animating=false;
  _st.undosLeft=_st.FREE_UNDOS; _st.hintMove=null;
  _st.tubes=lv.tubes; _st.target=lv.target; _st.par=lv.par;
  _st.initialTubes=cloneTubes(lv.tubes); _st.forwardMoves=lv.forwardMoves||[];
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

/* ===================================================================
   CELEBRATION SEQUENCE  (~3s after level win, tap to skip)
   =================================================================== */
const _CHEERS = ['GREAT!', 'BRILLIANT!', 'SPLENDID!', 'AMAZING!'];

function _startCelebration(stars, moves, par, target, code) {
  if (_reducedMotion()) {
    setTimeout(() => _showWinOverlayAnimated(stars, moves, par, code,
      stars === 3 ? 'PERFECT!' : _CHEERS[Math.floor(Math.random()*_CHEERS.length)]), 300);
    Sound.win();
    return;
  }
  const colors = target.map(function(c){return _hex(c);});
  _celeb = {
    startTime: performance.now(),
    stars: stars, moves: moves, par: par, code: code, colors: colors, target: target,
    cheer: stars === 3 ? 'PERFECT!' : _CHEERS[Math.floor(Math.random()*_CHEERS.length)],
    tubeCount: _tubeEls.length,
    HOP_INT: 140, CONFETTI_T: 300, SHOCK_T: 500, BANNER_T: 1000, END_T: 2800,
    hoppedTubes: 0, confettiDone: false, shockStart: 0, bannerShown: false, done: false,
  };
  _celeb.skipHandler = function(){ _skipCelebration(); };
  document.addEventListener('pointerdown', _celeb.skipHandler, { once: true });
  Sound.victoryArpeggio();
  _startRaf();
}

function _tickCelebration(now) {
  if (!_celeb || _celeb.done) return;
  var c = _celeb, t = now - c.startTime;

  // Tube hops
  var hopIdx = Math.floor(t / c.HOP_INT);
  while (c.hoppedTubes < c.tubeCount && c.hoppedTubes <= hopIdx) {
    _hopTube(c.hoppedTubes); Sound.pentatonic(c.hoppedTubes);
    c.hoppedTubes++;
  }

  // Confetti burst
  if (t >= c.CONFETTI_T && !c.confettiDone) {
    c.confettiDone = true;
    var W = window.innerWidth, H = window.innerHeight;
    Confetti.burst(W/2, 20, c.colors, 50);
    Confetti.burst(40, H*0.3, c.colors, 20);
    Confetti.burst(W-40, H*0.3, c.colors, 20);
    if (c.stars === 3) {
      setTimeout(function(){ Confetti.burst(W/2, 50, c.colors, 30); }, 200);
      setTimeout(function(){ Confetti.burst(W/2, 30, ['#FFD700','#FFF'], 20); }, 400);
    }
  }

  // Shockwave ring
  if (t >= c.SHOCK_T && !c.shockStart) c.shockStart = now;
  if (c.shockStart && _overlayCtx) {
    var swT = (now - c.shockStart) / 800;
    if (swT < 1) {
      var W2 = window.innerWidth, H2 = window.innerHeight;
      var maxR = Math.max(W2, H2) * 0.55;
      _overlayCtx.save();
      _overlayCtx.strokeStyle = 'rgba(255,255,255,' + ((1-swT)*0.3).toFixed(3) + ')';
      _overlayCtx.lineWidth = 3 * (1 - swT);
      _overlayCtx.beginPath();
      _overlayCtx.arc(W2/2, H2/2, maxR * _easeOut(swT), 0, Math.PI*2);
      _overlayCtx.stroke();
      _overlayCtx.restore();
    }
  }

  // Screen shake for perfect
  if (c.stars === 3 && t >= c.SHOCK_T && t < c.SHOCK_T + 300) {
    var amp = 3 * (1 - (t - c.SHOCK_T) / 300);
    document.body.style.transform = 'translate(' +
      ((Math.random()-0.5)*amp*2).toFixed(1) + 'px,' +
      ((Math.random()-0.5)*amp*2).toFixed(1) + 'px)';
  } else if (document.body.style.transform) {
    document.body.style.transform = '';
  }

  // Brief background brighten
  if (t >= c.SHOCK_T && t < c.SHOCK_T + 500 && _overlayCtx) {
    var bri = Math.max(0, 1 - (t - c.SHOCK_T) / 500) * 0.06;
    _overlayCtx.save();
    _overlayCtx.fillStyle = 'rgba(255,255,255,' + bri.toFixed(4) + ')';
    _overlayCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    _overlayCtx.restore();
  }

  // Banner
  if (t >= c.BANNER_T && !c.bannerShown) {
    c.bannerShown = true; Sound.whoosh();
  }

  // End
  if (t >= c.END_T) _finishCelebration();
}

function _skipCelebration() {
  if (!_celeb || _celeb.done) return;
  _finishCelebration();
}

function _finishCelebration() {
  if (!_celeb) return;
  var c = _celeb;
  c.done = true; _celeb = null;
  document.body.style.transform = '';
  _tubeEls.forEach(function(el){ if(el){el.wrapper.style.transition='';el.wrapper.style.transform='';} });
  try { document.removeEventListener('pointerdown', c.skipHandler); } catch(e) {}

  if (_st.mode === 'daily') {
    _showDailyDone(_daily.results[_todayStr()]);
  } else {
    _showWinOverlayAnimated(c.stars, c.moves, c.par, c.code, c.cheer);
  }
  Sound.win();
  _maybeInterstitial();
}

function _showWinOverlayAnimated(stars, moves, par, code, cheer) {
  _populateStarfield();
  var ct = dom.cheerText;
  if (ct) {
    ct.textContent = cheer || 'GREAT!';
    ct.classList.remove('show', 'perfect');
    ct.classList.toggle('perfect', stars === 3);
  }
  dom.winCodeBox.textContent = code;
  dom.winInfo.innerHTML = 'Moves: <strong>0</strong> &nbsp;|&nbsp; Par: <strong>' + par + '</strong>';
  if (!Monetization.isAdsRemoved() && _st.levelsCompleted > 5) dom.btnRemoveAdsWin.classList.remove('hidden');
  _showOverlay(dom.winOverlay, true);
  setTimeout(function(){ if(ct) ct.classList.add('show'); }, 80);
  _renderStarsAnimated(dom.winStars, stars);
  setTimeout(function(){ _animateMovesCount(dom.winInfo, moves, par); }, 400 + 3*250);
}

function _hopTube(ti) {
  var el = _tubeEls[ti]; if (!el) return;
  var w = el.wrapper;
  w.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
  w.style.transform = 'translateY(-28px)';
  setTimeout(function(){
    w.style.transform = 'translateY(0)';
    setTimeout(function(){ w.style.transition=''; w.style.transform=''; }, 450);
  }, 280);
}

function _renderStarsAnimated(el, n) {
  el.innerHTML = '';
  for (var i = 0; i < 3; i++) {
    var s = document.createElement('span');
    s.textContent = '\u2605';
    s.className = i < n ? 'star-on' : 'star-off';
    if (i < n) {
      s.style.opacity = '0'; s.style.transform = 'scale(0)';
      (function(sp, idx){
        setTimeout(function(){
          sp.style.opacity = ''; sp.style.transform = '';
          sp.classList.add('star-pop');
          Sound.ding(1500 + idx * 300);
        }, 200 + idx * 250);
      })(s, i);
    }
    el.appendChild(s);
  }
}

let _movesTimer = null;
function _animateMovesCount(el, target, par) {
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  if (target <= 0) {
    el.innerHTML = 'Moves: <strong>' + target + '</strong> &nbsp;|&nbsp; Par: <strong>' + par + '</strong>';
    return;
  }
  var cur = 0;
  var interval = Math.max(25, Math.floor(400 / target));
  var strong = el.querySelector('strong');
  if (!strong) return;
  _movesTimer = setInterval(function(){
    cur++;
    strong.textContent = cur;
    strong.classList.remove('moves-countup');
    void strong.offsetWidth;
    strong.classList.add('moves-countup');
    if (cur >= target) { clearInterval(_movesTimer); _movesTimer = null; }
  }, interval);
}

function _populateStarfield() {
  var sf = dom.winStarfield; if (!sf) return;
  sf.innerHTML = '';
  for (var i = 0; i < 25; i++) {
    var star = document.createElement('div');
    star.className = 'twinkle-star';
    star.style.left = Math.random()*100 + '%';
    star.style.top = Math.random()*100 + '%';
    star.style.setProperty('--dur', (1.5 + Math.random()*2.5) + 's');
    star.style.setProperty('--delay', (Math.random()*3) + 's');
    var sz = 1 + Math.random()*2;
    star.style.width = sz+'px'; star.style.height = sz+'px';
    sf.appendChild(star);
  }
}

/* ===================================================================
   COMBO FLASH
   =================================================================== */
function _checkCombo(wasFusion) {
  if (wasFusion) {
    if (_lastFuse) { _comboCount++; _showCombo(_comboCount + 1); }
    _lastFuse = true;
  } else { _lastFuse = false; _comboCount = 0; }
}

function _showCombo(n) {
  if (_reducedMotion()) return;
  var el = dom.comboFlash; if (!el) return;
  el.textContent = 'Chain x' + n + '! \u2728';
  el.classList.remove('hidden', 'show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(function(){ el.classList.remove('show'); el.classList.add('hidden'); }, 1500);
  var rect = el.getBoundingClientRect();
  if (rect.width) {
    for (var i = 0; i < 5; i++) {
      Particles.spawn(rect.left+rect.width/2+(Math.random()-0.5)*40,
                      rect.top+rect.height/2, 'sparkle', {
        vx:(Math.random()-0.5)*60, vy:-30-Math.random()*40,
        color:'#FFD700', radius:2+Math.random()*2, decay:1.2, gravity:40, drag:0.96,
      });
    }
    _startRaf();
  }
}

/* ===================================================================
   BACKGROUND — faint doodle pattern + ambient shapes
   =================================================================== */
let _bgDoodleCache = null;

function _initBg() {
  _bgCanvas = document.getElementById('bg-canvas');
  if (!_bgCanvas) return;
  var dpr = Math.min(devicePixelRatio||1, 2);
  var W = window.innerWidth, H = window.innerHeight;
  _bgCanvas.width = W*dpr; _bgCanvas.height = H*dpr;
  _bgCanvas.style.width = W+'px'; _bgCanvas.style.height = H+'px';
  _bgCtx = _bgCanvas.getContext('2d');
  _bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Cache static tiled doodle pattern onto an offscreen canvas for 60fps performance
  _bgDoodleCache = document.createElement('canvas');
  _bgDoodleCache.width = W*dpr; _bgDoodleCache.height = H*dpr;
  var dCtx = _bgDoodleCache.getContext('2d');
  dCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _drawDoodlePattern(dCtx, W, H);
  _bgCtx.drawImage(_bgDoodleCache, 0, 0, W, H);

  _bgShapes = [];
  for (var i = 0; i < 7; i++) {
    _bgShapes.push({
      x: Math.random()*W, y: Math.random()*H,
      r: 35 + Math.random()*90,
      vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*4,
      alpha: 0.012 + Math.random()*0.018,
      hue: Math.random()*360,
    });
  }
}

function _drawDoodlePattern(ctx, W, H) {
  // Draw simple line-art doodles at ~5% opacity, tiled
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const tileSize = 80;
  const doodles = [_doodleDroplet, _doodleFlask, _doodleStar, _doodlePlanet, _doodleGem, _doodleRocket];

  for (let y = 0; y < H + tileSize; y += tileSize) {
    for (let x = 0; x < W + tileSize; x += tileSize) {
      const di = (Math.floor(x / tileSize) + Math.floor(y / tileSize) * 3) % doodles.length;
      ctx.save();
      ctx.translate(x + tileSize/2, y + tileSize/2);
      doodles[di](ctx, tileSize * 0.3);
      ctx.restore();
    }
  }
  ctx.restore();
}

function _doodleDroplet(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s*0.8, s*0.2, 0, s);
  ctx.quadraticCurveTo(-s*0.8, s*0.2, 0, -s);
  ctx.stroke();
}
function _doodleFlask(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(-s*0.2, -s); ctx.lineTo(s*0.2, -s);
  ctx.lineTo(s*0.2, -s*0.3); ctx.lineTo(s*0.6, s*0.6);
  ctx.quadraticCurveTo(s*0.6, s, 0, s);
  ctx.quadraticCurveTo(-s*0.6, s, -s*0.6, s*0.6);
  ctx.lineTo(-s*0.2, -s*0.3); ctx.closePath(); ctx.stroke();
}
function _doodleStar(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? s : s * 0.4;
    if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
    else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  ctx.closePath(); ctx.stroke();
}
function _doodlePlanet(ctx, s) {
  ctx.beginPath(); ctx.arc(0, 0, s*0.6, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, s, s*0.25, -0.3, 0, Math.PI*2); ctx.stroke();
}
function _doodleGem(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.lineTo(s*0.7, -s*0.3);
  ctx.lineTo(s*0.5, s*0.8); ctx.lineTo(0, s);
  ctx.lineTo(-s*0.5, s*0.8); ctx.lineTo(-s*0.7, -s*0.3);
  ctx.closePath(); ctx.stroke();
}
function _doodleRocket(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s*0.4, -s*0.3, s*0.3, s*0.5);
  ctx.lineTo(s*0.6, s*0.9); ctx.lineTo(0, s*0.6);
  ctx.lineTo(-s*0.6, s*0.9); ctx.lineTo(-s*0.3, s*0.5);
  ctx.quadraticCurveTo(-s*0.4, -s*0.3, 0, -s);
  ctx.stroke();
}

function _tickBg(now) {
  if (!_bgCtx || _reducedMotion()) return;
  var W = window.innerWidth, H = window.innerHeight;
  var dpr = Math.min(devicePixelRatio||1, 2);

  // Redraw: clear then blit cached doodle pattern + floating shapes
  _bgCtx.setTransform(1,0,0,1,0,0);
  _bgCtx.clearRect(0, 0, _bgCanvas.width, _bgCanvas.height);
  if (_bgDoodleCache) _bgCtx.drawImage(_bgDoodleCache, 0, 0);
  _bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Update and draw floating ambient shapes
  for (var i = 0; i < _bgShapes.length; i++) {
    var s = _bgShapes[i];
    s.x += s.vx * 0.016; s.y += s.vy * 0.016;
    if (s.x < -s.r) s.x = W + s.r;
    if (s.x > W + s.r) s.x = -s.r;
    if (s.y < -s.r) s.y = H + s.r;
    if (s.y > H + s.r) s.y = -s.r;
    s.hue = (s.hue + 0.008) % 360;

    // Draw soft radial gradient blob
    _bgCtx.save();
    var grad = _bgCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    grad.addColorStop(0, 'hsla(' + Math.round(s.hue) + ',60%,50%,' + s.alpha.toFixed(4) + ')');
    grad.addColorStop(1, 'hsla(' + Math.round(s.hue) + ',60%,50%,0)');
    _bgCtx.fillStyle = grad;
    _bgCtx.beginPath();
    _bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    _bgCtx.fill();
    _bgCtx.restore();
  }
}

/* ===================================================================
   HINT ARROW
   =================================================================== */
function _drawHintArrow(ctx, now) {
  var h = _st.hintMove;
  if (!h || !_tubeEls[h.src] || !_tubeEls[h.dst]) return;
  var sr = _tubeEls[h.src].wrapper.getBoundingClientRect();
  var dr = _tubeEls[h.dst].wrapper.getBoundingClientRect();
  var sx = sr.left + sr.width/2, sy = sr.top - 10;
  var dx = dr.left + dr.width/2, dy = dr.top - 10;
  var pulse = 0.5 + 0.5 * Math.sin(now * 0.004);

  ctx.save();
  ctx.globalAlpha = 0.35 + 0.3 * pulse;
  ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 5]); ctx.lineDashOffset = -now * 0.02;
  var midX = (sx+dx)/2, midY = Math.min(sy, dy) - 25 - pulse*8;
  ctx.beginPath(); ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(midX, midY, dx, dy); ctx.stroke();
  ctx.setLineDash([]);
  var angle = Math.atan2(dy - midY, dx - midX);
  ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.moveTo(dx, dy);
  ctx.lineTo(dx-11*Math.cos(angle-0.4), dy-11*Math.sin(angle-0.4));
  ctx.lineTo(dx-11*Math.cos(angle+0.4), dy-11*Math.sin(angle+0.4));
  ctx.closePath(); ctx.fill();
  var gr = 14 + pulse*5;
  var sg = ctx.createRadialGradient(sx, sy+12, 0, sx, sy+12, gr);
  sg.addColorStop(0, 'rgba(79,195,247,'+(0.2*pulse).toFixed(3)+')');
  sg.addColorStop(1, 'rgba(79,195,247,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy+12, gr, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ===================================================================
   PROGRESS BAR & MILESTONES
   =================================================================== */
function _updateProgress() {
  if (!dom.progressText || !dom.progressFill) return;
  var ws = 10;
  var done = Math.max(0, (_st.levelNum - 1) % ws);
  var wn = Math.floor((_st.levelNum - 1) / ws) + 1;
  dom.progressText.textContent = done + ' / ' + ws + '  \u2022  World ' + wn;
  dom.progressFill.style.width = (done / ws * 100) + '%';
}

function _checkMilestone() {
  if ((_st.levelNum - 1) > 0 && (_st.levelNum - 1) % 5 === 0) {
    var wrap = dom.progressWrap;
    if (wrap) { wrap.classList.add('milestone-flash'); setTimeout(function(){ wrap.classList.remove('milestone-flash'); }, 900); }
    Toast.show('\uD83C\uDF89 Milestone: Level ' + (_st.levelNum - 1) + ' cleared!');
  }
}

/* ---- BOOT ---- */
_init();

// Export for external access if needed
const App = { state: _st, startLevel: _startLevel, goHome: _goHome };
