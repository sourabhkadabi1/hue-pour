// ============================================================
// HUE POUR — UI Layer  v8  (stuck rescue system)
// New tube geometry, lip-anchored pour, volume-based liquid
// Flat glass tubes, straight vertical stream, original doodle bg
// GAME LOGIC (game.js, monetization.js) UNTOUCHED
// ============================================================
'use strict';

/* ===================================================================
   COLOR HELPERS  — single source of truth from game.js COLOR_INFO
   =================================================================== */
function _hex(c) {
  const base = COLOR_INFO[c] ? COLOR_INFO[c].hex : '#ffffff';
  if (typeof Economy !== 'undefined' && Economy.getDisplayHex) {
    return Economy.getDisplayHex(c, base);
  }
  return base;
}

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

  // ---- Liquid Pour Synthesis: pink fluid stream + rising bottle cavity resonance + Minnaert bubbles ----
  let pourNodes = null;
  let _pinkNoiseBuf = null;
  let _pourDropTimer = null;
  let _curFillFrac = 0.2;

  function _getFluidNoiseBuffer() {
    if (_pinkNoiseBuf && _pinkNoiseBuf.sampleRate === actx.sampleRate) return _pinkNoiseBuf;
    const len = actx.sampleRate * 2;
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const out = buf.getChannelData(0);
    // Paul Kellet pink-noise approximation for smooth water turbulence (no white-noise hiss)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      out[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.16));
    }
    _pinkNoiseBuf = buf;
    return buf;
  }

  function _cavityFreqForFill(fillFrac) {
    const f = Math.max(0, Math.min(1, Number(fillFrac) || 0));
    return 320 + f * 760;
  }

  function _waterBloop(baseFreq, dur, gainPeak) {
    if (!enabled || !actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    const f0 = Math.max(240, baseFreq);
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    // Upward Minnaert bubble chirp (characteristic liquid/water acoustic signature)
    o.frequency.exponentialRampToValueAtTime(f0 * (1.45 + Math.random() * 0.35), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainPeak || 0.06, t + dur * 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst());
    o.start(t); o.stop(t + dur + 0.015);
  }

  function _scheduleDroplet() {
    if (!pourNodes || !enabled) { _pourDropTimer = null; return; }
    const base = _cavityFreqForFill(_curFillFrac) * (0.85 + Math.random() * 0.65);
    _waterBloop(base, 0.024 + Math.random() * 0.022, 0.032 + Math.random() * 0.030);
    if (Math.random() < 0.35) {
      _waterBloop(base * (1.2 + Math.random() * 0.4), 0.018 + Math.random() * 0.014, 0.022);
    }
    const nextDelay = 38 + Math.random() * 58;
    _pourDropTimer = setTimeout(_scheduleDroplet, nextDelay);
  }

  function startPour(fillFrac) {
    if (!enabled) return;
    ensure();
    _stopPour(0.02);
    const t = actx.currentTime;
    _curFillFrac = Math.max(0, Math.min(1, Number(fillFrac) || 0));

    const src = actx.createBufferSource();
    src.buffer = _getFluidNoiseBuffer();
    src.loop = true;

    // Bottle cavity resonator (pitch climbs naturally as liquid fills tube)
    const cavity = actx.createBiquadFilter();
    cavity.type = 'bandpass';
    cavity.frequency.value = _cavityFreqForFill(_curFillFrac);
    cavity.Q.value = 5.0;

    // Gentle splash stream shimmer
    const splash = actx.createBiquadFilter();
    splash.type = 'bandpass';
    splash.frequency.value = 1850;
    splash.Q.value = 1.4;

    const gCavity = actx.createGain();
    gCavity.gain.setValueAtTime(0.0001, t);
    gCavity.gain.linearRampToValueAtTime(0.11, t + 0.09);

    const gSplash = actx.createGain();
    gSplash.gain.setValueAtTime(0.0001, t);
    gSplash.gain.linearRampToValueAtTime(0.035, t + 0.08);

    src.connect(cavity); cavity.connect(gCavity); gCavity.connect(dst());
    src.connect(splash); splash.connect(gSplash); gSplash.connect(dst());
    src.start(t);

    pourNodes = { src, cavity, splash, gCavity, gSplash };
    // Initial liquid contact splash droplets + organic bubble stream
    _waterBloop(420 + _curFillFrac * 240, 0.032, 0.055);
    _pourDropTimer = setTimeout(_scheduleDroplet, 35);
  }

  function updatePourFill(fillFrac) {
    _curFillFrac = Math.max(0, Math.min(1, Number(fillFrac) || 0));
    if (!pourNodes) return;
    const freq = _cavityFreqForFill(_curFillFrac);
    if (actx && pourNodes.cavity.frequency.setTargetAtTime) {
      pourNodes.cavity.frequency.setTargetAtTime(freq, actx.currentTime, 0.04);
    } else {
      pourNodes.cavity.frequency.value = freq;
    }
  }

  function _stopPour(fadeT) {
    if (_pourDropTimer) {
      clearTimeout(_pourDropTimer);
      _pourDropTimer = null;
    }
    if (!pourNodes) return;
    const t = actx.currentTime, ft = fadeT !== undefined ? fadeT : 0.14;
    if (pourNodes.gCavity) {
      pourNodes.gCavity.gain.setValueAtTime(pourNodes.gCavity.gain.value || 0.08, t);
      pourNodes.gCavity.gain.linearRampToValueAtTime(0.0001, t + ft);
    }
    if (pourNodes.gSplash) {
      pourNodes.gSplash.gain.setValueAtTime(pourNodes.gSplash.gain.value || 0.03, t);
      pourNodes.gSplash.gain.linearRampToValueAtTime(0.0001, t + ft);
    }
    const pn = pourNodes; pourNodes = null;
    setTimeout(() => {
      try { pn.src.stop(); } catch (e) {}
    }, (ft + 0.08) * 1000);
  }

  function bubble() {
    if (!enabled) return;
    ensure();
    _waterBloop(480 + Math.random() * 540, 0.026 + Math.random() * 0.020, 0.045);
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

    // Clear continuous oscillator drones — zero background hum!
    startAmbience() {
      ambOscs = null;
    },
    stopAmbience() {
      if (!ambOscs) return;
      try { ambOscs.o1.stop(); ambOscs.o2.stop(); } catch (e) {}
      ambOscs = null;
    },

    _debugState() {
      return {
        hasAmbienceHum: !!ambOscs,
        pourActive:     !!pourNodes,
        cavityFreq:     pourNodes && pourNodes.cavity ? pourNodes.cavity.frequency.value : 0,
        dropletsActive: !!_pourDropTimer,
        fillFrac:       _curFillFrac,
      };
    },

    coin() {
      if (!enabled) return; ensure();
      const t = actx.currentTime;
      osc(1318.51, 0.10, 'triangle', 0.14, t);
      osc(1760.00, 0.18, 'sine',     0.15, t + 0.06);
    },

    coinSpend() {
      if (!enabled) return; ensure();
      const t = actx.currentTime;
      osc(987.77, 0.07, 'triangle', 0.10, t);
      osc(783.99, 0.10, 'sine',     0.08, t + 0.05);
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
   TUBE & BOTTLE GEOMETRY — multiple unlockable vessel shapes
   =================================================================== */

function _activeBottleShape() {
  if (typeof Economy !== 'undefined' && Economy.getActiveTube) {
    return Economy.getActiveTube().id || 'classic';
  }
  return 'classic';
}

/**
 * Trace closed interior/contour path for any vessel shape inside [left, top, w, h].
 * Set opts.closedMouth=false for open top pouring mouth, true for liquid clipping.
 */
function _vesselPath(ctx, shapeId, left, top, w, h, closedMouth) {
  const cx = left + w / 2;
  const r = w / 2;
  const id = shapeId || 'classic';

  if (id === 'nursing') {
    const mw = w * 0.62, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top + h * 0.04);
    if (closedMouth) ctx.lineTo(mR, top + h * 0.04);
    else ctx.moveTo(mR, top + h * 0.04);
    ctx.lineTo(mR, top + h * 0.18);
    ctx.bezierCurveTo(left + w * 0.98, top + h * 0.25, left + w * 1.02, top + h * 0.42, left + w * 0.92, top + h * 0.56);
    ctx.bezierCurveTo(left + w * 0.98, top + h * 0.72, left + w * 0.98, top + h * 0.94, left + w * 0.72, top + h);
    ctx.lineTo(left + w * 0.28, top + h);
    ctx.bezierCurveTo(left + w * 0.02, top + h * 0.94, left + w * 0.02, top + h * 0.72, left + w * 0.08, top + h * 0.56);
    ctx.bezierCurveTo(left - w * 0.02, top + h * 0.42, left + w * 0.02, top + h * 0.25, mL, top + h * 0.18);
    ctx.closePath();
    return;
  }

  if (id === 'soda') {
    const mw = w * 0.50, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top);
    if (closedMouth) ctx.lineTo(mR, top);
    else ctx.moveTo(mR, top);
    ctx.lineTo(mR, top + h * 0.16);
    ctx.quadraticCurveTo(left + w, top + h * 0.30, left + w, top + h * 0.44);
    ctx.quadraticCurveTo(left + w * 0.90, top + h * 0.62, left + w, top + h * 0.80);
    ctx.lineTo(left + w, top + h * 0.93);
    ctx.quadraticCurveTo(left + w, top + h, left + w * 0.80, top + h);
    ctx.lineTo(left + w * 0.20, top + h);
    ctx.quadraticCurveTo(left, top + h, left, top + h * 0.93);
    ctx.lineTo(left, top + h * 0.80);
    ctx.quadraticCurveTo(left + w * 0.10, top + h * 0.62, left, top + h * 0.44);
    ctx.quadraticCurveTo(left, top + h * 0.30, mL, top + h * 0.16);
    ctx.closePath();
    return;
  }

  if (id === 'champagne') {
    const mw = w * 0.44, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top);
    if (closedMouth) ctx.lineTo(mR, top);
    else ctx.moveTo(mR, top);
    ctx.lineTo(mR, top + h * 0.22);
    ctx.bezierCurveTo(left + w * 0.92, top + h * 0.34, left + w, top + h * 0.48, left + w, top + h * 0.60);
    ctx.lineTo(left + w, top + h * 0.94);
    ctx.quadraticCurveTo(left + w, top + h, left + w * 0.82, top + h);
    ctx.lineTo(left + w * 0.18, top + h);
    ctx.quadraticCurveTo(left, top + h, left, top + h * 0.94);
    ctx.lineTo(left, top + h * 0.60);
    ctx.bezierCurveTo(left, top + h * 0.48, left + w * 0.08, top + h * 0.34, mL, top + h * 0.22);
    ctx.closePath();
    return;
  }

  if (id === 'vase') {
    const mw = w * 0.72, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top);
    if (closedMouth) ctx.lineTo(mR, top);
    else ctx.moveTo(mR, top);
    ctx.quadraticCurveTo(left + w * 0.76, top + h * 0.18, left + w * 0.78, top + h * 0.28);
    ctx.bezierCurveTo(left + w * 1.06, top + h * 0.50, left + w * 1.02, top + h * 0.84, left + w * 0.76, top + h);
    ctx.lineTo(left + w * 0.24, top + h);
    ctx.bezierCurveTo(left - w * 0.02, top + h * 0.84, left - w * 0.06, top + h * 0.50, left + w * 0.22, top + h * 0.28);
    ctx.quadraticCurveTo(left + w * 0.24, top + h * 0.18, mL, top);
    ctx.closePath();
    return;
  }

  if (id === 'cocktail') {
    const bowlB = top + h * 0.72;
    ctx.moveTo(left + w * 0.06, top);
    if (closedMouth) ctx.lineTo(left + w * 0.94, top);
    else ctx.moveTo(left + w * 0.94, top);
    ctx.bezierCurveTo(left + w, top + h * 0.38, left + w * 0.84, bowlB, cx + w * 0.10, bowlB);
    if (closedMouth) {
      ctx.lineTo(cx - w * 0.10, bowlB);
    } else {
      ctx.lineTo(cx + w * 0.08, top + h * 0.94);
      ctx.lineTo(cx + w * 0.40, top + h);
      ctx.lineTo(cx - w * 0.40, top + h);
      ctx.lineTo(cx - w * 0.08, top + h * 0.94);
      ctx.lineTo(cx - w * 0.10, bowlB);
    }
    ctx.bezierCurveTo(left + w * 0.16, bowlB, left, top + h * 0.38, left + w * 0.06, top);
    ctx.closePath();
    return;
  }

  if (id === 'cork') {
    const mw = w * 0.58, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top + h * 0.06);
    if (closedMouth) ctx.lineTo(mR, top + h * 0.06);
    else ctx.moveTo(mR, top + h * 0.06);
    ctx.lineTo(mR, top + h * 0.16);
    ctx.lineTo(left + w * 0.94, top + h * 0.22);
    ctx.lineTo(left + w * 0.94, top + h * 0.92);
    ctx.quadraticCurveTo(left + w * 0.94, top + h, left + w * 0.76, top + h);
    ctx.lineTo(left + w * 0.24, top + h);
    ctx.quadraticCurveTo(left + w * 0.06, top + h, left + w * 0.06, top + h * 0.92);
    ctx.lineTo(left + w * 0.06, top + h * 0.22);
    ctx.lineTo(mL, top + h * 0.16);
    ctx.closePath();
    return;
  }

  if (id === 'pineapple') {
    const mw = w * 0.56, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top + h * 0.08);
    if (closedMouth) ctx.lineTo(mR, top + h * 0.08);
    else ctx.moveTo(mR, top + h * 0.08);
    ctx.lineTo(mR, top + h * 0.20);
    ctx.lineTo(left + w * 0.98, top + h * 0.36);
    ctx.lineTo(left + w * 0.98, top + h * 0.88);
    ctx.lineTo(left + w * 0.78, top + h);
    ctx.lineTo(left + w * 0.22, top + h);
    ctx.lineTo(left + w * 0.02, top + h * 0.88);
    ctx.lineTo(left + w * 0.02, top + h * 0.36);
    ctx.lineTo(mL, top + h * 0.20);
    ctx.closePath();
    return;
  }

  if (id === 'mushroom') {
    const mw = w * 0.50, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top + h * 0.12);
    if (closedMouth) ctx.lineTo(mR, top + h * 0.12);
    else ctx.moveTo(mR, top + h * 0.12);
    ctx.lineTo(mR, top + h * 0.28);
    ctx.bezierCurveTo(left + w * 1.06, top + h * 0.38, left + w * 1.04, top + h * 0.94, left + w * 0.74, top + h);
    ctx.lineTo(left + w * 0.26, top + h);
    ctx.bezierCurveTo(left - w * 0.04, top + h * 0.94, left - w * 0.06, top + h * 0.38, mL, top + h * 0.28);
    ctx.closePath();
    return;
  }

  if (id === 'winter') {
    const mw = w * 0.54, mL = cx - mw / 2, mR = cx + mw / 2;
    ctx.moveTo(mL, top + h * 0.08);
    if (closedMouth) ctx.lineTo(mR, top + h * 0.08);
    else ctx.moveTo(mR, top + h * 0.08);
    ctx.lineTo(mR, top + h * 0.22);
    ctx.bezierCurveTo(left + w * 0.96, top + h * 0.30, left + w, top + h * 0.56, left + w * 0.96, top + h * 0.90);
    ctx.quadraticCurveTo(left + w * 0.92, top + h, cx, top + h);
    ctx.quadraticCurveTo(left + w * 0.08, top + h, left + w * 0.04, top + h * 0.90);
    ctx.bezierCurveTo(left, top + h * 0.56, left + w * 0.04, top + h * 0.30, mL, top + h * 0.22);
    ctx.closePath();
    return;
  }

  // Default: Classic Test Tube
  ctx.moveTo(left, top);
  if (closedMouth) ctx.lineTo(left + w, top);
  else ctx.moveTo(left + w, top);
  ctx.lineTo(left + w, top + h - r);
  ctx.arcTo(left + w, top + h, left + w / 2, top + h, r);
  ctx.arcTo(left, top + h, left, top + h - r, r);
  ctx.lineTo(left, top);
  if (closedMouth) ctx.closePath();
}

function _strokeOpenVessel(ctx, shapeId, left, top, w, h) {
  const id = shapeId || 'classic';
  if (id === 'classic') {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, top + h - r);
    ctx.arcTo(left, top + h, left + r, top + h, r);
    ctx.arcTo(left + w, top + h, left + w, top + h - r, r);
    ctx.lineTo(left + w, top);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  _vesselPath(ctx, id, left, top, w, h, true);
  ctx.stroke();
}

function _drawVesselAccents(ctx, shapeId, left, top, w, h, opts) {
  const id = shapeId || 'classic';
  const cx = left + w / 2;
  if (id === 'classic') {
    // Classic glass highlight strip
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(left + w * 0.14, top + h * 0.06, Math.max(1.5, w * 0.08), h * 0.78);
    return;
  }
  ctx.save();
  if (id === 'nursing') {
    ctx.strokeStyle = 'rgba(77, 208, 225, 0.85)';
    ctx.lineWidth = Math.max(1.5, w * 0.055);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.34, top + h * 0.16);
    ctx.lineTo(cx + w * 0.34, top + h * 0.16);
    ctx.stroke();
    if (opts && opts.shopPreview) {
      ctx.fillStyle = '#4dd0e1';
      ctx.beginPath();
      ctx.ellipse(cx, top + h * 0.02, w * 0.18, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'soda') {
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(cx - w * 0.28, top - h * 0.01, w * 0.56, Math.max(3, h * 0.04));
  } else if (id === 'champagne') {
    ctx.fillStyle = '#f06292';
    ctx.fillRect(cx - w * 0.25, top + h * 0.19, w * 0.50, Math.max(3, h * 0.045));
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.20, top + h * 0.22);
    ctx.lineTo(cx - w * 0.28, top + h * 0.32);
    ctx.lineTo(cx - w * 0.08, top + h * 0.26);
    ctx.closePath(); ctx.fill();
  } else if (id === 'vase' && opts && opts.shopPreview) {
    ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx + w * 0.12, top + h * 0.06); ctx.lineTo(cx + w * 0.18, top - h * 0.04); ctx.stroke();
    ctx.fillStyle = '#ba68c8';
    ctx.beginPath(); ctx.arc(cx + w * 0.18, top - h * 0.05, Math.max(3, w * 0.11), 0, Math.PI * 2); ctx.fill();
  } else if (id === 'cocktail') {
    ctx.strokeStyle = '#ffca28'; ctx.lineWidth = Math.max(1.5, w * 0.045);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.18, top + h * 0.38);
    ctx.lineTo(cx + w * 0.34, top - h * 0.02);
    ctx.stroke();
    if (opts && opts.shopPreview) {
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath(); ctx.arc(cx + w * 0.34, top + h * 0.01, Math.max(3, w * 0.12), Math.PI, 0); ctx.fill();
    }
  } else if (id === 'cork') {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1.5, w * 0.045);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, top + h * 0.15);
    ctx.lineTo(cx + w * 0.32, top + h * 0.15);
    ctx.stroke();
    if (opts && opts.shopPreview) {
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(cx - w * 0.20, top, w * 0.40, h * 0.09);
    }
  } else if (id === 'pineapple') {
    ctx.strokeStyle = 'rgba(255, 183, 77, 0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.18, top + h * 0.42); ctx.lineTo(left + w * 0.82, top + h * 0.80);
    ctx.moveTo(left + w * 0.82, top + h * 0.42); ctx.lineTo(left + w * 0.18, top + h * 0.80);
    ctx.stroke();
    if (opts && opts.shopPreview) {
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath();
      ctx.moveTo(cx, top - h * 0.02);
      ctx.lineTo(cx - w * 0.18, top + h * 0.09);
      ctx.lineTo(cx + w * 0.18, top + h * 0.09);
      ctx.closePath(); ctx.fill();
    }
  } else if (id === 'mushroom' && opts && opts.shopPreview) {
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(cx, top + h * 0.12, w * 0.32, Math.PI, 0);
    ctx.fill();
  } else if (id === 'winter' && opts && opts.shopPreview) {
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.arc(cx, top + h * 0.08, w * 0.26, Math.PI, 0);
    ctx.fill();
  }
  // Specular gleam for all bottles
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(left + w * 0.18, top + h * 0.32, Math.max(1.2, w * 0.06), h * 0.45);
  ctx.restore();
}

function _tubePath(ctx, left, top, w, h) {
  _vesselPath(ctx, _activeBottleShape(), left, top, w, h, true);
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
  const shapeId = opts.shapeId || _activeBottleShape();
  const left = cx - w / 2;
  const top  = cy - h;
  const strokeW = w * 0.055;
  // Inner dimensions (inset by stroke)
  const iLeft = left + strokeW / 2;
  const iTop  = top + strokeW / 2;
  const iW    = w - strokeW;
  const iH    = h - strokeW / 2;
  const isStemmed = shapeId === 'cocktail';
  const unitH = isStemmed ? iH * 0.155 : iH * 0.22;   // keep cocktail bowl crisp
  const fillBottomY = isStemmed ? (top + h * 0.72) : cy;

  // ══ OUTER SAVE – apply tube rotation ═══════════════════════════
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);

  // ══ INNER SAVE – clip vessel interior, then counter-rotate for liquid ═══
  const totalUnits = bands.reduce((s, b) => s + b.units, 0);
  if (totalUnits > 0) {
    ctx.save();
    // Clip to vessel interior
    ctx.beginPath();
    _vesselPath(ctx, shapeId, iLeft, iTop, iW, iH, true);
    ctx.clip();

    // Counter-rotate: now in WORLD space, still clipped to tilted vessel
    ctx.translate(cx, cy); ctx.rotate(-angle); ctx.translate(-cx, -cy);

    // Draw liquid bands (horizontal rectangles in world space)
    let curY = fillBottomY;
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

  // ── Glass outline & subtle vessel decor ──
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
    _strokeOpenVessel(ctx, shapeId, left, top, w, h);
    _drawVesselAccents(ctx, shapeId, left, top, w, h, opts);
  }

  ctx.restore(); // end rotation
}

/**
 * Draw the dashed-outline empty "+" tube slot at the exact same dimensions
 * and proportions (square top, semicircular bottom) as real glass tubes.
 */
function drawPlusSlotOnCtx(ctx, cx, cy, w, h, isStuck) {
  const left = cx - w / 2;
  const top  = cy - h;
  const strokeW = Math.max(1.5, w * 0.05);
  const r = w / 2;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = isStuck ? 'rgba(79, 195, 247, 0.95)' : 'rgba(207, 207, 207, 0.65)';
  ctx.setLineDash([Math.max(4, w * 0.11), Math.max(3, w * 0.09)]);

  // Open-mouth dashed U-tube outline (matches real tubes)
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + h - r);
  ctx.arcTo(left, top + h, left + r, top + h, r);
  ctx.arcTo(left + w, top + h, left + w, top + h - r, r);
  ctx.lineTo(left + w, top);
  ctx.stroke();

  // Centered "+" vector icon in upper-mid interior (above cost/left badges)
  ctx.setLineDash([]);
  const plusSize = Math.max(6, w * 0.22);
  const plusCy = top + h * 0.40;
  ctx.lineWidth = Math.max(2, w * 0.065);
  ctx.strokeStyle = isStuck ? '#8ce0ff' : 'rgba(255, 255, 255, 0.78)';
  ctx.beginPath();
  ctx.moveTo(cx - plusSize, plusCy);
  ctx.lineTo(cx + plusSize, plusCy);
  ctx.moveTo(cx, plusCy - plusSize);
  ctx.lineTo(cx, plusCy + plusSize);
  ctx.stroke();

  ctx.restore();
}

/* ===================================================================
   ANIMATION STATE
   =================================================================== */
let _tubeEls  = [];        // [{wrapper, canvas, ctx}]
let _plusEl   = null;      // {wrapper, canvas, ctx, costEl, leftEl, tooltipEl}
let _renderedSlots = 0;
let _hasRenderedPlus = false;
let _tubeW    = 55;
let _tubeH    = 204;
let _tubePadX = 10;
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
  const colW = Math.min(480, area.clientWidth || window.innerWidth || 360);
  const availW = Math.max(200, colW - 24);
  const aH = (area.clientHeight || 500) - 16;

  // Layout rules:
  //   1..7 slots -> 1 row (shrunk to fit width)
  //   8..14 slots -> 2 rows, row 1 gets ceil(n/2) so no orphan tube ever appears
  const count = Math.max(1, n || 1);
  const rows = count <= 7 ? 1 : 2;
  const cols = count <= 7 ? count : Math.ceil(count / 2);
  const padX = cols >= 6 ? 6 : 10;
  const gapFrac = cols >= 7 ? 0.16 : (cols === 6 ? 0.22 : (cols === 5 ? 0.36 : 0.50));
  const rowGapFrac = rows === 2 ? (cols >= 6 ? 0.42 : 0.58) : 0.60;

  let w = Math.max(20, Math.round(colW * (cols >= 6 ? 0.105 : 0.115)));

  // Constrain horizontally so `cols` slots fit cleanly on one row
  const maxWForCols = Math.floor((availW - cols * padX - 2) / (cols + (cols - 1) * gapFrac));
  if (maxWForCols > 0 && w > maxWForCols) {
    w = Math.max(18, maxWForCols);
  }

  // Constrain vertically while keeping exact height = 3.7 * width
  if (aH > 0) {
    const maxHForRows = Math.floor((aH - rows * 14) / (rows + (rows - 1) * rowGapFrac));
    const maxWForRows = Math.floor(maxHForRows / 3.7);
    if (maxWForRows > 0 && w > maxWForRows) {
      w = Math.max(18, maxWForRows);
    }
  }

  let GAP = Math.max(4, Math.round(w * gapFrac));
  while (w > 18 && (cols * (w + padX) + (cols - 1) * GAP) > availW) {
    w--;
    GAP = Math.max(4, Math.round(w * gapFrac));
  }

  _tubeW = w;
  _tubeH = Math.round(_tubeW * 3.7);
  _tubePadX = padX;
  const rowGap = Math.round(_tubeH * rowGapFrac);

  document.documentElement.style.setProperty('--tube-w', _tubeW + 'px');
  document.documentElement.style.setProperty('--tube-h', _tubeH + 'px');
  document.documentElement.style.setProperty('--tube-pad-x', _tubePadX + 'px');
  document.documentElement.style.setProperty('--tube-gap', GAP + 'px');
  document.documentElement.style.setProperty('--row-gap', (rows > 1 ? rowGap : GAP) + 'px');
}

function _setupTubeCanvas(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cw = (_tubeW + _tubePadX) * dpr, ch = (_tubeH + 14) * dpr;
  canvas.width = cw; canvas.height = ch;
  canvas.style.width  = (_tubeW + _tubePadX) + 'px';
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
  const cW = _tubeW + _tubePadX, cH = _tubeH + 14;
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

function _redrawPlusSlot() {
  if (!_plusEl || !_plusEl.ctx) return;
  const ctx = _plusEl.ctx;
  const cW = _tubeW + _tubePadX, cH = _tubeH + 14;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cW, cH);
  const cx = cW / 2, cy = _tubeH + 7;
  const pulsing = _isPlusPulsing();
  drawPlusSlotOnCtx(ctx, cx, cy, _tubeW, _tubeH, pulsing);
}

function _buildPlusSlotEl() {
  const wrapper = document.createElement('div');
  wrapper.className = 'tube-wrapper tube-plus-slot';
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', 'Add extra tube');
  wrapper.addEventListener('click', _onAddPlusTube);

  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'plus-stuck-tooltip';
  tooltipEl.textContent = 'Need room? Tap +';
  wrapper.appendChild(tooltipEl);

  const canvas = document.createElement('canvas');
  canvas.className = 'tube-canvas';
  wrapper.appendChild(canvas);

  const meta = document.createElement('div');
  meta.className = 'plus-slot-meta';
  const costEl = document.createElement('span');
  costEl.className = 'plus-cost-badge';
  const leftEl = document.createElement('span');
  leftEl.className = 'plus-left-badge';
  meta.appendChild(costEl);
  meta.appendChild(leftEl);
  wrapper.appendChild(meta);

  const ctx = _setupTubeCanvas(canvas);
  return { wrapper, canvas, ctx, costEl, leftEl, tooltipEl };
}

function _buildTubeDOM(policy) {
  const area = document.getElementById('tube-area');
  if (!area) return;
  area.innerHTML = '';
  _tubeEls = [];
  _plusEl = null;

  const realCount = _st.tubes.length;
  const slots = realCount;
  const rows = slots <= 7 ? 1 : 2;
  const row1Limit = rows === 1 ? slots : Math.ceil(slots / 2);

  const row1 = document.createElement('div');
  row1.className = 'tube-row';
  area.appendChild(row1);
  let row2 = null;
  if (rows === 2) {
    row2 = document.createElement('div');
    row2.className = 'tube-row';
    area.appendChild(row2);
  }

  _st.tubes.forEach((_, ti) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tube-wrapper';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('aria-label', 'Tube ' + (ti+1));
    wrapper.addEventListener('click', () => _onTap(ti));

    const canvas = document.createElement('canvas');
    canvas.className = 'tube-canvas';
    wrapper.appendChild(canvas);
    (ti < row1Limit ? row1 : row2).appendChild(wrapper);

    const ctx = _setupTubeCanvas(canvas);
    _tubeEls.push({ wrapper, canvas, ctx });
  });

  _renderedSlots = slots;
  _hasRenderedPlus = false;
}

function _applyFlipReflow(prevRects, popIdx) {
  if (_reducedMotion()) return;
  if (prevRects && prevRects.tubes) {
    const nFlip = Math.min(prevRects.tubes.length, _tubeEls.length);
    for (let i = 0; i < nFlip; i++) {
      if (i === popIdx) continue;
      const oldR = prevRects.tubes[i];
      const w = _tubeEls[i] && _tubeEls[i].wrapper;
      if (!oldR || !w || !w.getBoundingClientRect) continue;
      const newR = w.getBoundingClientRect();
      if (!newR || !newR.width || !oldR.width) continue;
      const dx = oldR.left - newR.left;
      const dy = oldR.top - newR.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      w.style.transition = 'none';
      w.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      void w.offsetWidth;
      w.style.transition = '';
      w.style.transform = '';
    }
    if (_plusEl && prevRects.plus && _plusEl.wrapper.getBoundingClientRect) {
      const oldP = prevRects.plus;
      const newP = _plusEl.wrapper.getBoundingClientRect();
      if (newP && oldP && newP.width && oldP.width) {
        const dx = oldP.left - newP.left;
        const dy = oldP.top - newP.top;
        if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
          const pw = _plusEl.wrapper;
          pw.style.transition = 'none';
          pw.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
          void pw.offsetWidth;
          pw.style.transition = '';
          pw.style.transform = '';
        }
      }
    }
  }

  if (popIdx !== undefined && popIdx >= 0 && _tubeEls[popIdx]) {
    const popW = _tubeEls[popIdx].wrapper;
    popW.classList.add('tube-pop-in');
    const clearPop = () => popW.classList.remove('tube-pop-in');
    popW.addEventListener('animationend', clearPop, { once: true });
    if (_popInTimer) clearTimeout(_popInTimer);
    _popInTimer = setTimeout(() => { _popInTimer = null; clearPop(); }, 440);
  }
}

function _renderTubesAll(opts) {
  const policy = _getExtraPolicy();
  const slots = policy.slots;
  const needsRebuild = !_tubeEls.length ||
    _tubeEls.length !== _st.tubes.length ||
    _renderedSlots !== slots ||
    _hasRenderedPlus !== policy.hasPlusSlot ||
    (opts && opts.forceRebuild);

  _computeTubeSize(slots);
  if (needsRebuild) {
    _buildTubeDOM(policy);
  } else {
    _tubeEls.forEach(el => { el.ctx = _setupTubeCanvas(el.canvas); });
    if (_plusEl) _plusEl.ctx = _setupTubeCanvas(_plusEl.canvas);
  }

  _st.tubes.forEach((_, ti) => {
    if (_anim && ti === _anim.si) return;
    _redrawTube(ti);
    const wrapper = _tubeEls[ti].wrapper;
    wrapper.classList.toggle('selected',  ti === _st.selectedTube);
    wrapper.classList.toggle('hint-src',  !!(_st.hintMove && ti === _st.hintMove.src));
    wrapper.classList.toggle('hint-dst',  !!(_st.hintMove && ti === _st.hintMove.dst));
  });

  _updatePlusSlotVisual(policy);

  if (opts && (opts.prevRects || opts.popIdx !== undefined)) {
    _applyFlipReflow(opts.prevRects, opts.popIdx);
  }
  _updateDebugTubesOverlay(policy);
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

  // Compute timing scaled by Settings Speed (x1 / x2 / x3) & debug ?slowmo
  const units = moveResult.units;
  const speedDiv = _speedScale();
  const P1_DUR = Math.round(450 / speedDiv); // travel + tilt
  const P2_DUR = Math.round((600 + units * 100) / speedDiv); // pour
  const P3_DUR = Math.round(400 / speedDiv); // return

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
  hintsLeft: 1, FREE_HINTS: 1,
  dailyDayNum: 0, dailySeed: 0,
  challengeCode: '', challengeSeed: 0, challengeDiff: 0,
  tutorialActive: false, hintMove: null,
  levelsCompleted: 0,
  _currentSeed: 0, _currentDiff: 1,
  _winCode: '', _winStars: 1,
  _lastWinCoins: null, _winCoinsDoubled: false,
  _lastWonLevelNum: null, _lastWonIsFinale: false,
  _jumpLevel: 0, _forcedSeed: undefined,
  // ---- extra "+" slot & stuck state ----
  stuckStatus:      'unknown',  // 'yes' | 'no' | 'unknown'
  extraTubesAdded:  0,
  usedExtraTube:    false,
  emptyAtStart:     0,
  _forceStuck:      false,
  _debugTubes:      false,
  _addingTube:      false,
  _buyingUndo:      false,
  _buyingHint:      false,
  _watchingFreeAd:  false,
  _doublingCoins:   false,
  _stuckCheckSeq:   0,
  _levelConfig:     null,
};

let _settings = { sound: true, haptics: true, colorblind: false, reduceEffects: false, volume: 0.65, speed: 1 };
function _speedScale() {
  return _settings.speed === 3 ? 2.4 : (_settings.speed === 2 ? 1.65 : 1.0);
}
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
  btnHomeRemoveAds: $('btn-home-remove-ads'),
  btnHomeModes:     $('btn-home-modes'),
  homeDailyCaption: $('home-daily-caption'),
  homeSceneCanvas:  $('home-scene-canvas'),
  modesOverlay:     $('modes-overlay'),
  btnCloseModes:    $('btn-close-modes'),
  btnModesDaily:    $('btn-modes-daily'),
  tubeArea:         $('tube-area'),
  targetTubes:      $('target-tubes'),
  hudLevel:         $('hud-level'),
  hudMoves:         $('hud-moves'),
  hudPar:           $('hud-par'),
  hudWallet:        $('hud-wallet'),
  hudCoinsNum:      $('hud-coins-num'),
  undoCount:        $('undo-count'),
  hintCount:        $('hint-count'),
  homeWallet:       $('home-wallet'),
  homeCoinsNum:     $('home-coins-num'),
  btnHomeFreeCoins: $('btn-home-free-coins'),
  homeAdMeta:       $('home-ad-meta'),
  btnHomeShop:      $('btn-home-shop'),
  btnBack:          $('btn-back'),
  btnUndo:          $('btn-undo'),
  btnHint:          $('btn-hint'),
  btnAddTube:       $('btn-add-tube'),
  addTubeBadge:     $('add-tube-badge'),
  addTubeLeft:      $('add-tube-left'),
  topAddSlot0:      $('top-add-slot-0'),
  topAddBadge0:     $('top-add-badge-0'),
  topAddSlot1:      $('top-add-slot-1'),
  topAddBadge1:     $('top-add-badge-1'),
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
  btnSettingsHome:  $('btn-settings-home'),
  btnSpeed1:        $('btn-speed-1'),
  btnSpeed2:        $('btn-speed-2'),
  btnSpeed3:        $('btn-speed-3'),
  cheerText:        $('cheer-text'),
  comboFlash:       $('combo-flash'),
  progressText:     $('progress-text'),
  progressFill:     $('progress-fill'),
  progressWrap:     document.getElementById('progress-wrap'),
  winStarfield:     $('win-starfield'),
  winExtraBadge:    $('win-extra-badge'),
  dailyExtraBadge:  $('daily-extra-badge'),
  winCoinsRow:      $('win-coins-row'),
  winCoinsText:     $('win-coins-text'),
  btnWinDoubleCoins:$('btn-win-double-coins'),
  winUnlockTubeRow: $('win-unlock-tube-row'),
  winUnlockTubeLabel: $('win-unlock-tube-label'),
  winUnlockTubeFill:  $('win-unlock-tube-fill'),
  winUnlockTubeFrac:  $('win-unlock-tube-frac'),
  winUnlockTubeCard:  $('win-unlock-tube-card'),
  winUnlockTubeCanvas:$('win-unlock-tube-canvas'),
  winUnlockTubeNew:   $('win-unlock-tube-new'),
  winUnlockThemeRow:  $('win-unlock-theme-row'),
  winUnlockThemeLabel:$('win-unlock-theme-label'),
  winUnlockThemeFill: $('win-unlock-theme-fill'),
  winUnlockThemeFrac: $('win-unlock-theme-frac'),
  winUnlockThemeCard: $('win-unlock-theme-card'),
  winUnlockThemeCanvas:$('win-unlock-theme-canvas'),
  winUnlockThemeNew:  $('win-unlock-theme-new'),
  dailyCoinsRow:    $('daily-coins-row'),
  dailyCoinsText:   $('daily-coins-text'),
  btnDailyDoubleCoins: $('btn-daily-double-coins'),
  shopOverlay:      $('shop-overlay'),
  shopTitle:        $('shop-title'),
  shopWallet:       $('shop-wallet'),
  shopCoinsNum:     $('shop-coins-num'),
  shopGrid:         $('shop-grid'),
  tabTube:          $('tab-tube'),
  tabTheme:         $('tab-theme'),
  tabColor:         $('tab-color'),
  btnShopFreeCoins: $('btn-shop-free-coins'),
  shopAdMeta:       $('shop-ad-meta'),
  shopPalettesList: $('shop-palettes-list'),
  btnCloseShop:     $('btn-close-shop'),
  debugTubesOverlay:$('debug-tubes-overlay'),
};

/* ---- init ---- */
function _init() {
  Monetization.init();
  _loadSave();
  _parseURL();
  _applySettings();
  _bindEvents();
  _updateHome();
  _refreshWalletUI(false);
  _initOverlay();
  _initBg();
  _updateProgress();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _stopAdCooldownTimer();
      _stopHomeScene();
    } else {
      _updateRewardedAdButtons();
      if (_st.mode === 'home') _startHomeScene();
    }
  });
  window.addEventListener('resize', () => {
    _initOverlay();
    _initBg();
    if (_st.mode === 'home') _renderHomeSceneFrame(performance.now());
    else if (!_st.animating) _renderTubesAll();
  });
  if (_st._jumpLevel) _startLevel(_st._jumpLevel);
}

function _parseURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('level')) {
    const n = parseInt(p.get('level'), 10);
    if (n > 0) {
      _st.levelNum = n;
      _st._jumpLevel = n;
      if (typeof Economy !== 'undefined' && Economy.setHighestLevel) Economy.setHighestLevel(n);
    }
  }
  if (p.has('seed')) _st._forcedSeed = parseInt(p.get('seed'),10);
  if (p.has('slowmo')) _slowmo = parseFloat(p.get('slowmo')) || 1.0;
  if (p.has('coins')) {
    const c = parseInt(p.get('coins'), 10);
    const coinMod = _getCoinModule();
    if (coinMod && Number.isFinite(c) && c >= 0) {
      if (coinMod.setBalance) coinMod.setBalance(c);
      else coinMod.earn(c);
    }
  }
  const dbg = p.get('debug');
  if (dbg === 'levels') _debugPrintLevels();
  if (dbg === 'tubes') _st._debugTubes = true;
  if (p.get('forcestuck') === '1') _st._forceStuck = true;
}

function _debugPrintLevels() {
  const rows = [];
  let noEmptyCount = 0;
  let fallbackCount = 0;
  const first10Fallbacks = [];
  for (let lvl = 1; lvl <= 200; lvl++) {
    const lv = generateLevel(lvl, undefined, { quiet: true });
    const cfg = lv.config || (typeof getLevelConfig === 'function' ? getLevelConfig(lvl) : null);
    const emptyAtStart = lv.emptyAtStart !== undefined ? lv.emptyAtStart : lv.tubes.filter(t => !t.length).length;
    const isFallback = !!(lv.usedEmptyFallback || emptyAtStart > 0);
    if (!isFallback) noEmptyCount++;
    else {
      fallbackCount++;
      if (first10Fallbacks.length < 10) first10Fallbacks.push(lvl);
    }
    rows.push({
      level:        lvl,
      realm:        cfg ? cfg.realmName : '—',
      targets:      lv.target.length,
      colors:       lv.target.map(c => COLOR_INFO[c] ? COLOR_INFO[c].name : c).join(', '),
      tubes:        lv.tubes.length,
      emptyAtStart: emptyAtStart,
      fallback:     isFallback ? 'yes' : 'no',
      par:          lv.par,
    });
  }
  if (console.table) console.table(rows);
  else console.log(rows);
  console.log('Levels 1-200: no empty tube = ' + noEmptyCount + '/200, needed fallback = ' + fallbackCount + '/200');
  console.log('First 10 fallback levels:', first10Fallbacks);
}

function _loadSave() {
  const d = Save.load(); if (!d) return;
  if (d.levelNum)         _st.levelNum = d.levelNum;
  if (d.settings)         _settings = { ..._settings, ...d.settings };
  if (d.best)             _best = d.best;
  if (d.daily)            _daily = { ..._daily, ...d.daily };
  if (d.tutorialDone)     _tutDone = d.tutorialDone;
  if (d.levelsCompleted)  _st.levelsCompleted = d.levelsCompleted;
  if (typeof Economy !== 'undefined' && Economy.setHighestLevel) {
    Economy.setHighestLevel(Math.max(1, _st.levelNum || 1));
  }
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
  const spd = _settings.speed === 3 ? 3 : (_settings.speed === 2 ? 2 : 1);
  _settings.speed = spd;
  if (dom.btnSpeed1) dom.btnSpeed1.classList.toggle('is-active', spd === 1);
  if (dom.btnSpeed2) dom.btnSpeed2.classList.toggle('is-active', spd === 2);
  if (dom.btnSpeed3) dom.btnSpeed3.classList.toggle('is-active', spd === 3);
  if (Monetization.isAdsRemoved()) {
    dom.btnRemoveAds.textContent = 'Ads Removed ✓';
    dom.btnRemoveAds.disabled = true;
    dom.btnRemoveAdsWin.classList.add('hidden');
    if (dom.btnHomeRemoveAds) dom.btnHomeRemoveAds.classList.add('hidden');
  } else {
    if (dom.btnHomeRemoveAds) dom.btnHomeRemoveAds.classList.remove('hidden');
  }
  if (_st.mode === 'home') _startHomeScene();
}

/* ---- events ---- */
function _bindEvents() {
  dom.btnPlay.addEventListener('click',         () => { Sound.select(); _startLevel(_st.levelNum); });
  dom.btnDaily.addEventListener('click',        () => { Sound.select(); _startDaily(); });
  if (dom.btnHomeModes)     dom.btnHomeModes.addEventListener('click',  () => { Sound.select(); _showOverlay(dom.modesOverlay, true); });
  if (dom.btnCloseModes)    dom.btnCloseModes.addEventListener('click', () => { Sound.select(); _showOverlay(dom.modesOverlay, false); });
  if (dom.btnModesDaily)    dom.btnModesDaily.addEventListener('click', () => { Sound.select(); _showOverlay(dom.modesOverlay, false); _startDaily(); });
  if (dom.btnHomeRemoveAds) dom.btnHomeRemoveAds.addEventListener('click', _buyRemoveAds);
  dom.btnCodeGo.addEventListener('click',       () => { Sound.select(); _loadCode(); });
  dom.codeInput.addEventListener('keydown',     e  => { if(e.key==='Enter') _loadCode(); });
  dom.btnHomeSettings.addEventListener('click', () => { Sound.select(); _showOverlay(dom.settingsOverlay, true); });
  dom.btnBack.addEventListener('click',         () => { Sound.select(); _goHome(); });
  dom.btnUndo.addEventListener('click',         _onUndo);
  dom.btnHint.addEventListener('click',         _onHint);
  if (dom.btnAddTube)  dom.btnAddTube.addEventListener('click',  _onAddPlusTube);
  if (dom.topAddSlot0) dom.topAddSlot0.addEventListener('click', _onAddPlusTube);
  if (dom.topAddSlot1) dom.topAddSlot1.addEventListener('click', _onAddPlusTube);
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
  dom.btnCloseSettings.addEventListener('click', () => { Sound.select(); _showOverlay(dom.settingsOverlay,false); _persist(); });
  if (dom.btnSettingsHome) {
    dom.btnSettingsHome.addEventListener('click', () => {
      Sound.select();
      _showOverlay(dom.settingsOverlay, false);
      _goHome();
    });
  }
  [dom.btnSpeed1, dom.btnSpeed2, dom.btnSpeed3].forEach((btn, idx) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      Sound.select();
      _settings.speed = idx + 1;
      _applySettings();
      _persist();
    });
  });
  if (dom.homeWallet)       dom.homeWallet.addEventListener('click', () => { Sound.select(); _openShop('theme'); });
  if (dom.btnHomeShop)      dom.btnHomeShop.addEventListener('click', () => { Sound.select(); _openShop('theme'); });
  if (dom.tabTube)          dom.tabTube.addEventListener('click', () => { Sound.select(); _switchShopTab('tube'); });
  if (dom.tabTheme)         dom.tabTheme.addEventListener('click', () => { Sound.select(); _switchShopTab('theme'); });
  if (dom.tabColor)         dom.tabColor.addEventListener('click', () => { Sound.select(); _switchShopTab('color'); });
  if (dom.btnCloseShop)     dom.btnCloseShop.addEventListener('click', () => { Sound.select(); _closeShop(); });
  if (dom.btnHomeFreeCoins) dom.btnHomeFreeCoins.addEventListener('click', () => _onWatchFreeCoinsAd(dom.btnHomeFreeCoins));
  if (dom.btnShopFreeCoins) dom.btnShopFreeCoins.addEventListener('click', () => _onWatchFreeCoinsAd(dom.btnShopFreeCoins));
  if (dom.btnWinDoubleCoins)   dom.btnWinDoubleCoins.addEventListener('click',   () => _onDoubleWinCoins(false));
  if (dom.btnDailyDoubleCoins) dom.btnDailyDoubleCoins.addEventListener('click', () => _onDoubleWinCoins(true));
  document.addEventListener('pointerdown', e => { if (e.target.closest('button')) Sound.btnClick(); });
}

function _showOverlay(el, show) {
  if (!el) return;
  el.classList.toggle('hidden', !show);
  el.setAttribute('aria-hidden', String(!show));
}

/* ===================================================================
   ECONOMY UI: WALLET, FLYING COINS, REWARDED ADS & SHOP
   =================================================================== */
let _walletRafId = null;
let _adCooldownTimer = null;
const _coinFx = { timers: [], nodes: [] };

function _economyCfg() {
  return (typeof Economy !== 'undefined' && Economy.CONFIG) ? Economy.CONFIG : null;
}

function _getCoinBalance() {
  const mod = _getCoinModule();
  return mod && mod.getBalance ? mod.getBalance() : 0;
}

function _setWalletNumbers(val) {
  const txt = String(Math.max(0, Math.round(val)));
  if (dom.homeCoinsNum) dom.homeCoinsNum.textContent = txt;
  if (dom.hudCoinsNum)  dom.hudCoinsNum.textContent  = txt;
  if (dom.shopCoinsNum) dom.shopCoinsNum.textContent = txt;
}

function _refreshWalletUI(immediate) {
  if (immediate === true && _walletRafId) {
    cancelAnimationFrame(_walletRafId);
    _walletRafId = null;
  }
  if (!_walletRafId) _setWalletNumbers(_getCoinBalance());
}

function _bumpVisibleWallet() {
  const pills = [dom.shopWallet, dom.hudWallet, dom.homeWallet];
  for (let i = 0; i < pills.length; i++) {
    const el = pills[i];
    if (!el || _reducedMotion()) continue;
    el.classList.remove('wallet-bump');
    void el.offsetWidth;
    el.classList.add('wallet-bump');
  }
}

function _animateWalletCount(fromBal, toBal) {
  if (_walletRafId) { cancelAnimationFrame(_walletRafId); _walletRafId = null; }
  if (_reducedMotion() || fromBal === toBal) {
    _setWalletNumbers(toBal);
    return;
  }
  const start = performance.now();
  const dur = 480;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    _setWalletNumbers(Math.round(fromBal + (toBal - fromBal) * eased));
    if (t < 1) {
      _walletRafId = requestAnimationFrame(step);
    } else {
      _walletRafId = null;
      _setWalletNumbers(toBal);
      _bumpVisibleWallet();
    }
  }
  _walletRafId = requestAnimationFrame(step);
}

function _pickVisibleWalletEl() {
  if (dom.shopOverlay && !dom.shopOverlay.classList.contains('hidden') && dom.shopWallet) return dom.shopWallet;
  if (dom.app && !dom.app.classList.contains('hidden') && dom.hudWallet) return dom.hudWallet;
  return dom.homeWallet || dom.hudWallet || null;
}

function _cleanupCoinFx() {
  if (_walletRafId) { cancelAnimationFrame(_walletRafId); _walletRafId = null; }
  while (_coinFx.timers.length) clearTimeout(_coinFx.timers.pop());
  while (_coinFx.nodes.length) {
    const n = _coinFx.nodes.pop();
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }
}

function _flyCoinsToWallet(originEl, count) {
  if (_reducedMotion() || typeof document === 'undefined' || !document.body) return;
  const targetEl = _pickVisibleWalletEl();
  if (!targetEl || !targetEl.getBoundingClientRect) return;
  const dstRect = targetEl.getBoundingClientRect();
  if (!dstRect || (dstRect.width === 0 && dstRect.height === 0)) return;
  const dstX = dstRect.left + dstRect.width / 2;
  const dstY = dstRect.top + dstRect.height / 2;

  let srcX = window.innerWidth / 2;
  let srcY = window.innerHeight * 0.55;
  if (originEl && originEl.getBoundingClientRect) {
    const r = originEl.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) {
      srcX = r.left + r.width / 2;
      srcY = r.top + r.height / 2;
    }
  }

  const total = Math.max(3, Math.min(8, count || 5));
  for (let i = 0; i < total; i++) {
    const coin = document.createElement('div');
    coin.className = 'flying-coin';
    coin.innerHTML =
      '<svg class="coin-icon-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10" fill="#ffd54f" stroke="#f57f17" stroke-width="1.8"/>' +
        '<circle cx="12" cy="12" r="7" fill="none" stroke="#fff8e1" stroke-opacity="0.6" stroke-width="1.2"/>' +
        '<path d="M12 7.2C13.9 10 15.2 11.7 15.2 13.4a3.2 3.2 0 1 1-6.4 0c0-1.7 1.3-3.4 3.2-6.2z" fill="#ff8f00"/>' +
      '</svg>';
    const jitterX = (Math.random() - 0.5) * 34;
    const jitterY = (Math.random() - 0.5) * 20;
    const sx = srcX + jitterX;
    const sy = srcY + jitterY;
    coin.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) scale(0.7)';
    coin.style.opacity = '0';
    document.body.appendChild(coin);
    _coinFx.nodes.push(coin);

    const delay = i * 55;
    const launchId = setTimeout(() => {
      if (!coin.parentNode) return;
      coin.style.transition = 'transform 0.52s cubic-bezier(0.22, 0.8, 0.32, 1), opacity 0.14s ease-out';
      coin.style.opacity = '1';
      void coin.offsetWidth;
      coin.style.transform = 'translate3d(' + dstX.toFixed(1) + 'px,' + dstY.toFixed(1) + 'px,0) scale(0.85)';
      const endId = setTimeout(() => {
        if (coin.parentNode) coin.parentNode.removeChild(coin);
        const idx = _coinFx.nodes.indexOf(coin);
        if (idx >= 0) _coinFx.nodes.splice(idx, 1);
      }, 550);
      _coinFx.timers.push(endId);
    }, delay);
    _coinFx.timers.push(launchId);
  }
}

function _onCoinBalanceChanged() {
  _refreshWalletUI(false);
  if (_st.mode !== 'home') {
    _renderHUD();
    _updatePlusSlotVisual();
  }
  if (dom.shopOverlay && !dom.shopOverlay.classList.contains('hidden')) {
    _renderShop();
  }
}

function _creditCoinsWithFX(amount, originEl) {
  const coinMod = _getCoinModule();
  if (!coinMod || amount <= 0) return _getCoinBalance();
  const prev = coinMod.getBalance();
  const next = coinMod.earn(amount);
  Sound.coin();
  _animateWalletCount(prev, next);
  _flyCoinsToWallet(originEl, Math.ceil(amount / 15));
  _onCoinBalanceChanged();
  return next;
}

function _stopAdCooldownTimer() {
  if (_adCooldownTimer) {
    clearInterval(_adCooldownTimer);
    _adCooldownTimer = null;
  }
}

function _updateRewardedAdButtons() {
  if (typeof Economy === 'undefined' || !Economy.getRewardedAdState) return;
  const st = Economy.getRewardedAdState();
  const pairs = [
    { btn: dom.btnHomeFreeCoins, meta: dom.homeAdMeta },
    { btn: dom.btnShopFreeCoins, meta: dom.shopAdMeta },
  ];
  for (let i = 0; i < pairs.length; i++) {
    const btn = pairs[i].btn, meta = pairs[i].meta;
    if (!btn) continue;
    const main = btn.querySelector('.reward-btn-main');
    if (main) main.textContent = 'Watch ad: +' + st.rewardAmount + ' coins';
    if (st.remainingToday <= 0) {
      btn.disabled = true;
      if (meta) meta.textContent = '0/' + st.dailyLimit + ' today';
    } else if (st.cooldownRemainingSec > 0) {
      btn.disabled = true;
      if (meta) meta.textContent = 'Wait ' + st.cooldownRemainingSec + 's';
    } else {
      btn.disabled = !!_st._watchingFreeAd;
      if (meta) meta.textContent = st.remainingToday + '/' + st.dailyLimit + ' today';
    }
  }
  const needsTicker = st.remainingToday > 0 && st.cooldownRemainingMs > 0 &&
    (!dom.homeScreen.classList.contains('hidden') ||
     (dom.shopOverlay && !dom.shopOverlay.classList.contains('hidden')));
  if (needsTicker && !_adCooldownTimer) {
    _adCooldownTimer = setInterval(() => _updateRewardedAdButtons(), 1000);
  } else if (!needsTicker) {
    _stopAdCooldownTimer();
  }
}

async function _onWatchFreeCoinsAd(originEl) {
  if (_st._watchingFreeAd || typeof Economy === 'undefined') return;
  const st = Economy.getRewardedAdState();
  if (!st.canWatch) {
    Toast.show(st.remainingToday <= 0
      ? 'Daily limit reached (' + st.dailyLimit + '/day)'
      : 'Wait ' + st.cooldownRemainingSec + 's before watching again');
    _updateRewardedAdButtons();
    return;
  }
  _st._watchingFreeAd = true;
  _updateRewardedAdButtons();
  let ok = false;
  try {
    ok = await Monetization.showRewarded('coins_150');
  } finally {
    _st._watchingFreeAd = false;
  }
  if (!ok) { _updateRewardedAdButtons(); return; }
  const prevBal = _getCoinBalance();
  const res = Economy.recordRewardedAdCoinClaim();
  if (res.ok) {
    Sound.coin();
    _animateWalletCount(prevBal, res.balance);
    _flyCoinsToWallet(originEl, 6);
    _onCoinBalanceChanged();
    Toast.show('+' + res.earned + ' coins!');
  } else {
    Toast.show('Ad reward unavailable right now');
  }
  _updateRewardedAdButtons();
}

let _shopTab = 'theme';

function _switchShopTab(tab) {
  _shopTab = (tab === 'tube' || tab === 'color') ? tab : 'theme';
  if (dom.shopTitle) dom.shopTitle.textContent = _shopTab.toUpperCase();
  if (dom.tabTube)  dom.tabTube.classList.toggle('is-active',  _shopTab === 'tube');
  if (dom.tabTheme) dom.tabTheme.classList.toggle('is-active', _shopTab === 'theme');
  if (dom.tabColor) dom.tabColor.classList.toggle('is-active', _shopTab === 'color');
  _renderShop();
}

function _makeLockOverlay(labelText, isCoinPrice) {
  const ov = document.createElement('div');
  ov.className = 'col-lock-overlay';
  const lockSvg =
    '<svg class="col-lock-svg" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">' +
      '<path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5" fill="#fff"/>' +
      '<circle cx="12" cy="15.5" r="1.4" fill="#180b38"/>' +
    '</svg>';
  if (isCoinPrice) {
    ov.innerHTML = lockSvg +
      '<span class="col-price-pill">' +
        '<svg class="coin-icon-svg" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="10.5" fill="#ffd54f" stroke="#f57f17" stroke-width="1.6"/>' +
          '<path d="M12 7.2C13.9 10 15.2 11.7 15.2 13.4a3.2 3.2 0 1 1-6.4 0c0-1.7 1.3-3.4 3.2-6.2z" fill="#e65100"/>' +
        '</svg>' +
        '<span>' + labelText + '</span>' +
      '</span>';
  } else {
    ov.innerHTML = lockSvg + '<span class="col-lock-level">' + labelText + '</span>';
  }
  return ov;
}

function _drawCollectionCardThumb(canvas, kind, item) {
  if (!canvas || !canvas.getContext) return;
  const W = 150, H = 156;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (kind === 'theme') {
    _paintSceneTheme(ctx, item.id, W, H, true);
    return;
  }

  if (kind === 'tube') {
    const bw = 24, bh = 88, cy = H * 0.80, xs = [34, 75, 116];
    for (let i = 0; i < xs.length; i++) {
      ctx.save();
      ctx.strokeStyle = item.unlocked ? '#dcd7f7' : 'rgba(220,215,247,0.72)';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      _strokeOpenVessel(ctx, item.id, xs[i] - bw / 2, cy - bh, bw, bh);
      _drawVesselAccents(ctx, item.id, xs[i] - bw / 2, cy - bh, bw, bh, { shopPreview: true });
      ctx.restore();
    }
    return;
  }

  if (kind === 'color') {
    const bw = 24, bh = 88, cy = H * 0.80, xs = [34, 75, 116];
    const sampleCols = [
      ['GREEN', 'ORANGE', 'BLUE'],
      ['PURPLE', 'YELLOW', 'BLUE'],
      ['VERMILION', 'TEAL', 'RED'],
    ];
    for (let i = 0; i < xs.length; i++) {
      const colNames = sampleCols[i];
      const bands = [];
      for (let u = 0; u < colNames.length; u++) {
        const key = colNames[u];
        const hex = (item.colors && item.colors[key]) || (COLOR_INFO[key] ? COLOR_INFO[key].hex : '#fff');
        bands.push({ color: key, units: 1.1, hexOverride: hex });
      }
      ctx.save();
      const left = xs[i] - bw / 2, top = cy - bh, r = bw / 2;
      ctx.beginPath();
      _vesselPath(ctx, 'classic', left + 1, top + 1, bw - 2, bh - 1.5, true);
      ctx.clip();
      let curY = cy;
      const uH = bh * 0.27;
      for (let b = 0; b < bands.length; b++) {
        ctx.fillStyle = bands[b].hexOverride;
        ctx.fillRect(left, curY - uH, bw, uH + 0.5);
        curY -= uH;
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = '#d4d0ea'; ctx.lineWidth = 1.7;
      _strokeOpenVessel(ctx, 'classic', left, top, bw, bh);
      ctx.restore();
    }
  }
}

function _renderShop() {
  _refreshWalletUI(false);
  _updateRewardedAdButtons();
  if (!dom.shopGrid || typeof Economy === 'undefined') return;
  if (dom.shopTitle) dom.shopTitle.textContent = _shopTab.toUpperCase();
  if (dom.tabTube)  dom.tabTube.classList.toggle('is-active',  _shopTab === 'tube');
  if (dom.tabTheme) dom.tabTheme.classList.toggle('is-active', _shopTab === 'theme');
  if (dom.tabColor) dom.tabColor.classList.toggle('is-active', _shopTab === 'color');

  const grid = dom.shopGrid;
  grid.innerHTML = '';

  const highestLvl = Math.max(_st.levelNum || 1, Economy.getHighestLevel ? Economy.getHighestLevel() : 1);
  let items = [];
  if (_shopTab === 'theme') items = Economy.getThemes(highestLvl);
  else if (_shopTab === 'tube') items = Economy.getTubes(highestLvl);
  else items = Economy.getPalettes();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'col-card' + (it.active ? ' is-active' : '');
    card.setAttribute('aria-label', it.name);

    const cvs = document.createElement('canvas');
    cvs.className = 'col-card-canvas';
    _drawCollectionCardThumb(cvs, _shopTab, it);
    card.appendChild(cvs);

    if (it.active) {
      const chk = document.createElement('span');
      chk.className = 'col-check-badge';
      chk.textContent = '✓';
      card.appendChild(chk);
    }

    const isUnlocked = _shopTab === 'color' ? !!it.owned : !!it.unlocked;
    if (!isUnlocked) {
      const lockMsg = _shopTab === 'color' ? String(it.price) : ('LEVEL ' + it.unlockLevel);
      card.appendChild(_makeLockOverlay(lockMsg, _shopTab === 'color'));
    }

    card.addEventListener('click', () => {
      if (_shopTab === 'theme') {
        if (!it.unlocked) { Toast.show('Unlocks at Level ' + it.unlockLevel + '!'); return; }
        Sound.select();
        Economy.selectTheme(it.id, highestLvl);
        _initBg();
        Toast.show('Theme: ' + it.name);
        _renderShop();
        return;
      }
      if (_shopTab === 'tube') {
        if (!it.unlocked) { Toast.show('Unlocks at Level ' + it.unlockLevel + '!'); return; }
        Sound.select();
        Economy.selectTube(it.id, highestLvl);
        if (_st.mode !== 'home') _renderTubesAll();
        Toast.show('Bottles: ' + it.name);
        _renderShop();
        return;
      }
      if (it.owned) {
        Sound.select();
        Economy.selectPalette(it.id);
        if (_st.mode !== 'home') { _renderTarget(); _renderTubesAll(); }
        Toast.show('Colors: ' + it.name);
        _renderShop();
        return;
      }
      const prev = _getCoinBalance();
      const res = Economy.buyPalette(it.id);
      if (!res.ok) {
        Toast.show('Need ' + it.price + ' coins');
        return;
      }
      Sound.coinSpend();
      _animateWalletCount(prev, res.balance);
      _onCoinBalanceChanged();
      if (_st.mode !== 'home') { _renderTarget(); _renderTubesAll(); }
      Toast.show('Unlocked ' + it.name + '!');
      _renderShop();
    });

    grid.appendChild(card);
  }
}

function _openShop(tabOpt) {
  if (tabOpt === 'tube' || tabOpt === 'theme' || tabOpt === 'color') _shopTab = tabOpt;
  _renderShop();
  _showOverlay(dom.shopOverlay, true);
  _updateRewardedAdButtons();
}

function _closeShop() {
  _showOverlay(dom.shopOverlay, false);
  _updateRewardedAdButtons();
}

/* ---- home diorama scene (cozy potion studio + heart flask + kitty mascot) ---- */
let _homeSceneRaf = null;

function _paintHomeWorkshop(ctx, W, H, tSec) {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a2257');
  bg.addColorStop(0.55, '#593b78');
  bg.addColorStop(1, '#261444');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Arched studio windows + soft sunlit rays
  ctx.save();
  for (let wIdx = 0; wIdx < 2; wIdx++) {
    const wx = wIdx === 0 ? W * 0.25 : W * 0.80;
    const wy = H * 0.28, ww = W * 0.19, wh = H * 0.16;
    const wg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    wg.addColorStop(0, '#fce9b5');
    wg.addColorStop(1, '#b8d7f5');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.arc(wx, wy + ww / 2, ww / 2, Math.PI, 0);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.lineTo(wx - ww / 2, wy + wh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(72,42,96,0.65)'; ctx.lineWidth = 3; ctx.stroke();

    // Sunbeam shaft gently pulsing
    const beamAlpha = 0.08 + 0.03 * Math.sin(tSec * 1.1 + wIdx);
    ctx.fillStyle = 'rgba(255, 240, 200, ' + beamAlpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(wx - ww * 0.4, wy + wh);
    ctx.lineTo(wx + ww * 0.4, wy + wh);
    ctx.lineTo(wx + ww * 0.9, H * 0.72);
    ctx.lineTo(wx - ww * 0.9, H * 0.72);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Curved glass potion tubes overhead with animated rising bubbles
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 190, 90, 0.28)'; ctx.lineWidth = Math.max(16, W * 0.048);
  ctx.beginPath(); ctx.moveTo(0, H * 0.18); ctx.quadraticCurveTo(W * 0.28, H * 0.08, W * 0.48, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(244, 143, 177, 0.26)'; ctx.lineWidth = Math.max(14, W * 0.042);
  ctx.beginPath(); ctx.moveTo(W * 0.22, H * 0.27); ctx.quadraticCurveTo(W * 0.62, H * 0.22, W, H * 0.12); ctx.stroke();
  for (let b = 0; b < 5; b++) {
    const p = ((tSec * 0.18 + b * 0.2) % 1);
    const bx = W * (0.24 + p * 0.72);
    const by = H * (0.26 - p * 0.13);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath(); ctx.arc(bx, by, 2.5 + (b % 2), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Swaying festival bunting flags across rafters
  const flagColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4fc3f7', '#ce93d8'];
  for (let f = 0; f < 6; f++) {
    const fx = W * (0.14 + f * 0.145);
    const fy = H * 0.14 + Math.sin(f * 0.6) * 8;
    const sway = Math.sin(tSec * 1.9 + f * 0.7) * 3.2;
    ctx.fillStyle = flagColors[f % flagColors.length];
    ctx.beginPath();
    ctx.moveTo(fx - 10, fy);
    ctx.lineTo(fx + 10, fy + 2);
    ctx.lineTo(fx + sway, fy + 18);
    ctx.closePath(); ctx.fill();
  }

  // Left glowing cauldron w/ soft rising mist
  ctx.save();
  ctx.fillStyle = '#3c2559';
  ctx.beginPath(); ctx.ellipse(W * 0.08, H * 0.56, 36, 30, 0, 0, Math.PI * 2); ctx.fill();
  const mistA = 0.22 + 0.12 * Math.sin(tSec * 2.0);
  ctx.fillStyle = 'rgba(224, 64, 251, ' + mistA.toFixed(3) + ')';
  ctx.beginPath(); ctx.ellipse(W * 0.08, H * 0.50 - Math.sin(tSec * 1.5) * 4, 28, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Wooden pedestal altar in center
  const cx = W * 0.50, pedY = H * 0.61;
  const rx = Math.min(165, W * 0.42), ry = 28;
  ctx.save();
  ctx.fillStyle = '#4e312c';
  ctx.beginPath(); ctx.ellipse(cx, pedY + 14, rx, ry + 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#754e41';
  ctx.beginPath(); ctx.ellipse(cx, pedY, rx * 0.94, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 224, 130, 0.35)'; ctx.lineWidth = 2; ctx.stroke();
  // Glowing rune badge on front rim
  const runeGlow = 0.7 + 0.3 * Math.sin(tSec * 2.4);
  ctx.fillStyle = 'rgba(255, 213, 79, ' + runeGlow.toFixed(2) + ')';
  ctx.beginPath(); ctx.moveTo(cx, pedY + 14); ctx.lineTo(cx + 8, pedY + 24); ctx.lineTo(cx, pedY + 34); ctx.lineTo(cx - 8, pedY + 24); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Crystal Heart Potion Flask centered on altar (sloshing liquid + fruit sparkles)
  const hCx = cx - W * 0.04, hBot = pedY - 4, hScale = Math.min(1.05, W / 370);
  const hW = 128 * hScale, hH = 126 * hScale;
  ctx.save();
  function traceHeart() {
    ctx.beginPath();
    ctx.moveTo(hCx, hBot);
    ctx.bezierCurveTo(hCx - hW * 0.62, hBot - hH * 0.28, hCx - hW * 0.62, hBot - hH * 0.88, hCx - hW * 0.22, hBot - hH * 0.88);
    ctx.bezierCurveTo(hCx - hW * 0.06, hBot - hH * 0.88, hCx, hBot - hH * 0.72, hCx, hBot - hH * 0.72);
    ctx.bezierCurveTo(hCx, hBot - hH * 0.72, hCx + hW * 0.06, hBot - hH * 0.88, hCx + hW * 0.22, hBot - hH * 0.88);
    ctx.bezierCurveTo(hCx + hW * 0.62, hBot - hH * 0.88, hCx + hW * 0.62, hBot - hH * 0.28, hCx, hBot);
    ctx.closePath();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  traceHeart(); ctx.fill();

  ctx.save();
  traceHeart(); ctx.clip();
  const liqTop = hBot - hH * 0.56;
  const liqG = ctx.createLinearGradient(0, liqTop, 0, hBot);
  liqG.addColorStop(0, '#ffe082');
  liqG.addColorStop(0.55, '#ffb74d');
  liqG.addColorStop(1, '#ff7043');
  ctx.fillStyle = liqG;
  ctx.beginPath();
  ctx.moveTo(hCx - hW, hBot + 5);
  for (let px = hCx - hW; px <= hCx + hW; px += 4) {
    const wy = liqTop + Math.sin((px - hCx) * 0.06 + tSec * 2.3) * 3.5;
    ctx.lineTo(px, wy);
  }
  ctx.lineTo(hCx + hW, hBot + 5); ctx.closePath(); ctx.fill();

  // Floating fruit-orb accents inside potion
  ctx.fillStyle = '#fff59d';
  ctx.beginPath(); ctx.arc(hCx - 22 * hScale, liqTop + 26 + Math.sin(tSec * 1.7) * 3, 6 * hScale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5252';
  ctx.beginPath(); ctx.arc(hCx - 28 * hScale, liqTop + 12 + Math.cos(tSec * 2.1) * 2.5, 5 * hScale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (let b = 0; b < 4; b++) {
    const by = hBot - ((tSec * 22 + b * 25) % (hH * 0.48));
    ctx.beginPath(); ctx.arc(hCx + (b - 1.5) * 16 * hScale, by, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  traceHeart();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)'; ctx.lineWidth = 2.6; ctx.stroke();
  // Glass neck & specular curve
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)'; ctx.lineWidth = 2.4;
  ctx.strokeRect(hCx - 14 * hScale, hBot - hH * 1.02, 28 * hScale, hH * 0.14);
  ctx.restore();

  // Original Cute Alchemist Wizard Kitty Mascot on right side of pedestal
  const kCx = cx + W * 0.17, kBot = pedY + 4 + Math.sin(tSec * 2.2) * 2.2, s = hScale;
  ctx.save();
  // Cape & body
  ctx.fillStyle = '#5e35b1';
  ctx.beginPath();
  ctx.moveTo(kCx - 24 * s, kBot); ctx.lineTo(kCx + 24 * s, kBot);
  ctx.lineTo(kCx + 15 * s, kBot - 36 * s); ctx.lineTo(kCx - 15 * s, kBot - 36 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5a25d';
  ctx.beginPath(); ctx.ellipse(kCx, kBot - 16 * s, 14 * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill();
  // Head + ears
  ctx.beginPath(); ctx.arc(kCx, kBot - 40 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(kCx - 16 * s, kBot - 48 * s); ctx.lineTo(kCx - 18 * s, kBot - 63 * s); ctx.lineTo(kCx - 5 * s, kBot - 54 * s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(kCx + 16 * s, kBot - 48 * s); ctx.lineTo(kCx + 18 * s, kBot - 63 * s); ctx.lineTo(kCx + 5 * s, kBot - 54 * s); ctx.closePath(); ctx.fill();
  // Eyes (periodic cute blink)
  const blinking = Math.sin(tSec * 0.85) > 0.96;
  ctx.fillStyle = '#2c1708';
  if (blinking) {
    ctx.fillRect(kCx - 9 * s, kBot - 41 * s, 5 * s, 2 * s);
    ctx.fillRect(kCx + 4 * s, kBot - 41 * s, 5 * s, 2 * s);
  } else {
    ctx.beginPath(); ctx.arc(kCx - 7 * s, kBot - 40 * s, 2.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(kCx + 7 * s, kBot - 40 * s, 2.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(kCx - 8 * s, kBot - 41 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(kCx + 6 * s, kBot - 41 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
  }
  // Pointy Wizard Hat with gold band
  ctx.fillStyle = '#673ab7';
  ctx.beginPath(); ctx.ellipse(kCx, kBot - 54 * s, 24 * s, 6 * s, -0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(kCx - 16 * s, kBot - 55 * s); ctx.lineTo(kCx + 6 * s, kBot - 84 * s); ctx.lineTo(kCx + 15 * s, kBot - 55 * s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(kCx - 13 * s, kBot - 57 * s); ctx.lineTo(kCx + 13 * s, kBot - 56 * s); ctx.stroke();
  // Wand & glowing tip spark
  const wandTipX = kCx - 29 * s, wandTipY = kBot - 46 * s;
  ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(kCx - 12 * s, kBot - 24 * s); ctx.lineTo(wandTipX, wandTipY); ctx.stroke();
  const sparkR = (4.5 + Math.sin(tSec * 5.0) * 2.0) * s;
  const sg = ctx.createRadialGradient(wandTipX, wandTipY, 0, wandTipX, wandTipY, sparkR * 2.5);
  sg.addColorStop(0, 'rgba(255, 245, 157, 0.95)');
  sg.addColorStop(1, 'rgba(255, 213, 79, 0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(wandTipX, wandTipY, sparkR * 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Floating ambient stardust motes
  for (let m = 0; m < 10; m++) {
    const mx = W * ((0.08 + m * 0.095 + Math.sin(tSec * 0.4 + m) * 0.03) % 1);
    const my = H * (0.72 - ((tSec * 0.05 + m * 0.11) % 0.62));
    const ma = 0.25 + 0.35 * Math.sin(tSec * 2.0 + m);
    ctx.fillStyle = 'rgba(255, 224, 130, ' + Math.max(0.05, ma).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(mx, my, 1.5 + (m % 2), 0, Math.PI * 2); ctx.fill();
  }
}

function _renderHomeSceneFrame(now) {
  const cvs = dom.homeSceneCanvas;
  if (!cvs || !cvs.getContext) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = window.innerWidth || 390;
  const H = window.innerHeight || 844;
  if (cvs.width !== W * dpr || cvs.height !== H * dpr) {
    cvs.width = W * dpr; cvs.height = H * dpr;
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  }
  const ctx = cvs.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _paintHomeWorkshop(ctx, W, H, (now || performance.now()) * 0.001);
}

function _stopHomeScene() {
  if (_homeSceneRaf) {
    cancelAnimationFrame(_homeSceneRaf);
    _homeSceneRaf = null;
  }
}

function _startHomeScene() {
  _stopHomeScene();
  if (_st.mode !== 'home') return;
  _renderHomeSceneFrame(performance.now());
  if (_reducedMotion() || document.hidden) return;
  function tick(now) {
    if (_st.mode !== 'home' || _reducedMotion() || document.hidden) {
      _homeSceneRaf = null;
      return;
    }
    _renderHomeSceneFrame(now);
    _homeSceneRaf = requestAnimationFrame(tick);
  }
  _homeSceneRaf = requestAnimationFrame(tick);
}

/* ---- home ---- */
function _updateHome() {
  const cfg = typeof getLevelConfig === 'function' ? getLevelConfig(_st.levelNum) : null;
  dom.homeLevelInfo.textContent = 'Level ' + _st.levelNum + (cfg ? ' · ' + cfg.realmName : '');
  dom.btnPlay.textContent = 'LEVEL ' + _st.levelNum;
  if (_daily.streak > 0) {
    dom.homeStreak.classList.remove('hidden');
    dom.streakNum.textContent = _daily.streak;
  } else { dom.homeStreak.classList.add('hidden'); }
  const dailyDone = !!_daily.results[_todayStr()];
  if (dom.homeDailyCaption) dom.homeDailyCaption.textContent = dailyDone ? 'Daily ✓' : 'Daily';
  if (dom.btnModesDaily) dom.btnModesDaily.textContent = dailyDone ? '📅 Daily ✓ Done' : '📅 Daily Puzzle';
  if (dom.btnHomeRemoveAds) dom.btnHomeRemoveAds.classList.toggle('hidden', Monetization.isAdsRemoved());
  _refreshWalletUI(false);
  _updateRewardedAdButtons();
  _updateProgress();
  _startHomeScene();
}

function _goHome() {
  Sound.stopAmbience();
  _st.mode = 'home'; _st.animating = false; _st.won = false; _st.hintMove = null;
  _anim = null;
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  _cleanupCoinFx();
  if (_celeb) {
    try { document.removeEventListener('pointerdown', _skipCelebration); } catch(e){}
    _celeb = null;
  }
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  Particles.clear(); Confetti.clear(); _waves = {};
  _comboCount = 0; _lastFuse = false;
  document.body.style.transform = '';
  _stopStuckActivity();
  if (dom.debugTubesOverlay) dom.debugTubesOverlay.classList.add('hidden');
  dom.app.classList.add('hidden');
  dom.homeScreen.classList.remove('hidden');
  _showOverlay(dom.winOverlay, false);
  _showOverlay(dom.dailyDoneOverlay, false);
  _showOverlay(dom.shareOverlay, false);
  _showOverlay(dom.shopOverlay, false);
  _showOverlay(dom.modesOverlay, false);
  dom.tutorialBar.classList.add('hidden');
  _updateHome(); _persist();
}

function _showGame(title) {
  _stopHomeScene();
  _showOverlay(dom.modesOverlay, false);
  _showOverlay(dom.shopOverlay, false);
  dom.homeScreen.classList.add('hidden');
  dom.app.classList.remove('hidden');
  dom.hudLevel.textContent = title;
  _initOverlay();
  Sound.startAmbience();
  _startRaf();
}

/** Shared session initializer used across Campaign, Daily, and Challenge modes. */
function _initPlaySession(lv, config, title) {
  const cfg = _economyCfg();
  _st.FREE_UNDOS = cfg ? cfg.free.undosPerLevel : 3;
  _st.FREE_HINTS = cfg ? cfg.free.hintsPerLevel : 1;
  _st.won = false; _st.moveCount = 0; _st.history = []; _st.selectedTube = -1;
  _st.animating = false; _st.undosLeft = _st.FREE_UNDOS; _st.hintsLeft = _st.FREE_HINTS;
  _st.hintMove = null;
  _st._lastWinCoins = null; _st._winCoinsDoubled = false;
  _st._lastWonLevelNum = null; _st._lastWonIsFinale = false;
  _waves = {}; _anim = null;
  if (_movesTimer) { clearInterval(_movesTimer); _movesTimer = null; }
  _stopAdCooldownTimer();
  _st.tubes = lv.tubes; _st.target = lv.target; _st.par = lv.par;
  _st.initialTubes = cloneTubes(lv.tubes);
  _st.forwardMoves = lv.forwardMoves || [];
  _st._levelConfig = config;
  _st.emptyAtStart = lv.emptyAtStart !== undefined
    ? lv.emptyAtStart
    : countEmptyTubes(lv.tubes);
  _st._currentSeed = lv.seed;
  _st._currentDiff = lv.target.length;
  _resetStuckState();
  _showGame(title);
  _refreshWalletUI(false);
  _renderAll();
  _updatePlusSlotVisual();
  _updateDebugTubesOverlay();
}

/* ---- start modes ---- */
function _startLevel(num) {
  _st.mode = 'level'; _st.levelNum = num;
  _showOverlay(dom.winOverlay, false);
  const seed = _st._forcedSeed !== undefined ? _st._forcedSeed : undefined;
  const lv = generateLevel(num, seed);
  const cfg = lv.config || (typeof getLevelConfig === 'function' ? getLevelConfig(num) : null);
  const title = 'LEVEL ' + num;
  _initPlaySession(lv, cfg, title);
  _persist();
  _maybeStartTut(num);
}

function _startDaily() {
  const ts = _todayStr();
  if (_daily.results[ts]) { _showDailyDone(_daily.results[ts]); return; }
  _st.mode = 'daily';
  const lv = generateDailyLevel();
  _st.dailyDayNum = lv.dayNum; _st.dailySeed = lv.seed;
  _initPlaySession(lv, null, 'Daily #' + lv.dayNum);
}

function _loadCode() {
  const raw = dom.codeInput.value.trim(); if (!raw) return;
  const dec = decodeChallenge(raw);
  if (!dec) { Toast.show('Invalid code — check and try again'); return; }
  const lv = generateChallengeLevel(dec.seed, dec.difficulty);
  if (!lv) { Toast.show('Could not load this puzzle'); return; }
  _st.mode = 'challenge';
  _st.challengeCode = raw.toUpperCase(); _st.challengeSeed = lv.seed; _st.challengeDiff = lv.difficulty;
  _showOverlay(dom.modesOverlay, false);
  _initPlaySession(lv, null, 'Challenge');
  dom.codeInput.value = '';
}

/* ---- tutorial ---- */
function _maybeStartTut(n) {
  if (n <= 3 && !_tutDone[n]) {
    _st.tutorialActive = true;
    dom.btnSkipTut.textContent = 'Skip';
    _showTutHint();
    return;
  }
  _st.tutorialActive = false;
  const cfg = _st._levelConfig;
  if (cfg && cfg.introHint && !_tutDone[n]) {
    dom.tutorialText.textContent = cfg.introHint;
    dom.btnSkipTut.textContent = 'Got it';
    dom.tutorialBar.classList.remove('hidden');
    _renderTubesAll();
  } else {
    dom.tutorialBar.classList.add('hidden');
    _renderTubesAll();
  }
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
  const cfg = _economyCfg();
  const undoCost = cfg ? cfg.spend.extraUndos : 30;
  const hintCost = cfg ? cfg.spend.extraHint : 40;
  const bal = _getCoinBalance();
  dom.hudMoves.textContent = 'Moves: ' + _st.moveCount;
  dom.hudPar.textContent   = 'Par: '   + _st.par;
  dom.undoCount.textContent = _st.undosLeft > 0
    ? String(_st.undosLeft)
    : (bal >= undoCost ? String(undoCost) : 'AD');
  if (dom.hintCount) {
    dom.hintCount.textContent = _st.hintsLeft > 0
      ? String(_st.hintsLeft)
      : (bal >= hintCost ? String(hintCost) : 'AD');
  }
  _refreshWalletUI(false);
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
  if (checkWin(_st.tubes, _st.target)) { _st.won = true; _onWin(); return; }
  _scheduleStuckCheck();
  _updateDebugTubesOverlay();
}

/* ---- win ---- */
function _onWin() {
  const moves = _st.moveCount, par = _st.par;
  let stars = moves <= par ? 3 : (moves <= par+3 ? 2 : 1);
  // Extra tube caps stars at 2
  const usedExtraTube = _st.usedExtraTube;
  if (usedExtraTube) stars = Math.min(stars, 2);
  _st.levelsCompleted++;
  if (_st.tutorialActive) _skipTut();
  else dom.tutorialBar.classList.add('hidden');
  _stopStuckActivity();
  const code = encodeChallenge(_st._currentSeed, _st._currentDiff);

  _st._winCode = code; _st._winStars = stars;
  const wonLevelNum = _st.mode === 'level' ? _st.levelNum : null;
  const wonIsFinale = _st.mode === 'level' && !!(_st._levelConfig && _st._levelConfig.isFinale);
  _st._lastWonLevelNum = wonLevelNum;
  _st._lastWonIsFinale = wonIsFinale;

  if (_st.mode === 'daily') {
    const ts = _todayStr();
    const yesterday = _dateStr(new Date(Date.now()-86400000));
    if (_daily.lastDate === yesterday || _daily.lastDate === ts) _daily.streak++;
    else _daily.streak = 1;
    _daily.lastDate = ts;
    const dEarn = typeof Economy !== 'undefined'
      ? Economy.calcDailyEarn(_daily.streak)
      : { total: 30 + Math.min(50, _daily.streak * 5), base: 30, streakBonus: Math.min(50, _daily.streak * 5) };
    _daily.results[ts] = {
      moves, par, stars, code, dayNum: _st.dailyDayNum, usedExtraTube,
      coinsEarned: dEarn.total, coinsDoubled: false,
    };
    _st._lastWinCoins = dEarn;
    _st._winCoinsDoubled = false;
    _creditCoinsWithFX(dEarn.total, dom.tubeArea);
  } else {
    const prev = _best[_st.levelNum];
    if (!prev || stars>prev.stars || (stars===prev.stars && moves<prev.moves))
      _best[_st.levelNum] = { moves, stars };
    if (_st.mode === 'level') {
      _st.levelNum++;
      if (typeof Economy !== 'undefined' && Economy.setHighestLevel) Economy.setHighestLevel(_st.levelNum);
      _checkMilestone();
    }
    const lEarn = typeof Economy !== 'undefined'
      ? Economy.calcLevelEarn({ stars, isFinale: wonIsFinale })
      : { win: 10, starBonus: stars === 3 ? 10 : 0, finaleBonus: wonIsFinale ? 100 : 0, total: 10 + (stars === 3 ? 10 : 0) + (wonIsFinale ? 100 : 0) };
    _st._lastWinCoins = lEarn;
    _st._winCoinsDoubled = false;
    _creditCoinsWithFX(lEarn.total, dom.tubeArea);
  }
  _persist();

  _startCelebration(stars, moves, par, _st.target, code, usedExtraTube);
}

function _onDailyWin(moves, par, stars, code) {
  const ts = _todayStr();
  const usedExtraTube = _st.usedExtraTube;
  if (usedExtraTube) stars = Math.min(stars, 2);
  const yesterday = _dateStr(new Date(Date.now()-86400000));
  if (_daily.lastDate === yesterday || _daily.lastDate === ts) _daily.streak++;
  else _daily.streak = 1;
  _daily.lastDate = ts; _st._winCode = code; _st._winStars = stars;
  const dEarn = typeof Economy !== 'undefined'
    ? Economy.calcDailyEarn(_daily.streak)
    : { total: 30 + Math.min(50, _daily.streak * 5), base: 30, streakBonus: Math.min(50, _daily.streak * 5) };
  _daily.results[ts] = {
    moves, par, stars, code, dayNum: _st.dailyDayNum, usedExtraTube,
    coinsEarned: dEarn.total, coinsDoubled: false,
  };
  _st._lastWinCoins = dEarn;
  _st._winCoinsDoubled = false;
  _creditCoinsWithFX(dEarn.total, dom.tubeArea);
  _persist();
  setTimeout(() => { _showDailyDone(_daily.results[ts]); Sound.win(); }, 400);
}

function _showDailyDone(r) {
  _renderStars(dom.dailyStars, r.stars);
  dom.dailyInfo.innerHTML = 'Moves: <strong>'+r.moves+'</strong> &nbsp;|&nbsp; Par: <strong>'+r.par+'</strong>';
  if (dom.dailyExtraBadge) dom.dailyExtraBadge.classList.toggle('hidden', !r.usedExtraTube);
  dom.dailyStreakLine.textContent = '🔥 ' + _daily.streak + ' day streak';
  const earned = r.coinsEarned || 0;
  if (dom.dailyCoinsRow && dom.dailyCoinsText) {
    dom.dailyCoinsRow.classList.toggle('hidden', earned <= 0);
    if (earned > 0) {
      dom.dailyCoinsText.textContent = '+' + (r.coinsDoubled ? earned * 2 : earned) +
        ' coins' + (r.coinsDoubled ? ' (2×!)' : '');
    }
  }
  if (dom.btnDailyDoubleCoins) {
    const canDouble = earned > 0 && !r.coinsDoubled;
    dom.btnDailyDoubleCoins.classList.toggle('hidden', !canDouble);
    dom.btnDailyDoubleCoins.disabled = false;
    if (canDouble) dom.btnDailyDoubleCoins.textContent = 'Watch ad: double coins (+' + earned + ')';
  }
  const now = new Date(), tmrw = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const diff = tmrw-now, h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
  dom.dailyCountdownLine.textContent = 'Come back tomorrow! ⏱ '+h+'h '+m+'m '+s+'s';
  _showOverlay(dom.dailyDoneOverlay, true);
}

async function _onDoubleWinCoins(isDaily) {
  if (_st._doublingCoins) return;
  let bonus = 0;
  if (isDaily) {
    const r = _daily.results[_todayStr()];
    if (!r || !r.coinsEarned || r.coinsDoubled) return;
    bonus = r.coinsEarned;
  } else {
    if (!_st._lastWinCoins || !_st._lastWinCoins.total || _st._winCoinsDoubled) return;
    bonus = _st._lastWinCoins.total;
  }
  _st._doublingCoins = true;
  const btn = isDaily ? dom.btnDailyDoubleCoins : dom.btnWinDoubleCoins;
  if (btn) btn.disabled = true;
  let ok = false;
  try {
    ok = await Monetization.showRewarded('double_coins');
  } finally {
    _st._doublingCoins = false;
  }
  if (!ok) {
    if (btn) btn.disabled = false;
    return;
  }
  const originEl = btn || (isDaily ? dom.dailyCoinsRow : dom.winCoinsRow);
  _creditCoinsWithFX(bonus, originEl);
  if (isDaily) {
    const r = _daily.results[_todayStr()];
    if (r) {
      r.coinsDoubled = true;
      _persist();
      if (dom.dailyCoinsText) dom.dailyCoinsText.textContent = '+' + (bonus * 2) + ' coins (2×!)';
    }
    if (dom.btnDailyDoubleCoins) dom.btnDailyDoubleCoins.classList.add('hidden');
  } else {
    _st._winCoinsDoubled = true;
    if (dom.winCoinsText) dom.winCoinsText.textContent = '+' + (bonus * 2) + ' coins (2×!)';
    if (dom.btnWinDoubleCoins) dom.btnWinDoubleCoins.classList.add('hidden');
  }
  Toast.show('Coins doubled! +' + bonus + ' bonus coins!');
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
  if (_celeb) return false;
  const lastRewardedAt = Monetization.getLastRewardedAt ? Monetization.getLastRewardedAt() : 0;
  const allowed = typeof Economy !== 'undefined' && Economy.canShowInterstitial
    ? Economy.canShowInterstitial({
        adsRemoved:      Monetization.isAdsRemoved(),
        isFinale:        !!_st._lastWonIsFinale,
        isCelebrating:   !!_celeb,
        levelsCompleted: _st.levelsCompleted,
        levelNum:        _st._lastWonLevelNum,
        lastRewardedAt:  lastRewardedAt,
      })
    : (!Monetization.isAdsRemoved() && _st.levelsCompleted > 5 && _st.levelsCompleted % 4 === 0 &&
       !_st._lastWonIsFinale && !(_st._lastWonLevelNum && _st._lastWonLevelNum <= 5));
  if (!allowed) return false;
  return Monetization.showInterstitial({
    isFinale:      !!_st._lastWonIsFinale,
    isCelebrating: !!_celeb,
    levelNum:      _st._lastWonLevelNum,
    reason:        'level_complete',
  });
}
async function _buyRemoveAds() {
  const ok = await Monetization.purchaseRemoveAds();
  if (ok) { Toast.show('Ads removed! Thank you!'); _applySettings(); }
}

/* ---- undo ---- */
function _applySingleUndo() {
  _st.tubes = _st.history.pop();
  _st.moveCount = Math.max(0, _st.moveCount - 1);
  _st.selectedTube = -1; _st.undosLeft--; _st.hintMove = null; _waves = {};
  _renderAll();
  if (_st.tutorialActive) _showTutHint();
  _scheduleStuckCheck();
}

async function _onUndo() {
  Sound.select();
  if (_st.animating || _st.won || _st._buyingUndo) return;
  if (!_st.history.length) { Toast.show('Nothing to undo'); return; }
  if (_st.undosLeft > 0) {
    _applySingleUndo();
    return;
  }
  const cfg = _economyCfg();
  const cost = cfg ? cfg.spend.extraUndos : 30;
  const pack = cfg ? cfg.spend.extraUndosCount : 3;
  const coinMod = _getCoinModule();
  if (coinMod && coinMod.getBalance() >= cost && coinMod.spend(cost)) {
    Sound.coinSpend();
    _st.undosLeft += pack;
    _onCoinBalanceChanged();
    _applySingleUndo();
    Toast.show('-' + cost + ' coins · +' + pack + ' undos!');
    return;
  }
  _st._buyingUndo = true;
  Toast.show('Watch ad for ' + pack + ' more undos');
  let ok = false;
  try { ok = await Monetization.showRewarded('extra_undo'); }
  finally { _st._buyingUndo = false; }
  if (_st.won || _st.mode === 'home' || !ok) return;
  _st.undosLeft += pack;
  if (_st.history.length > 0) {
    _applySingleUndo();
    Toast.show('+' + pack + ' undos!');
  } else {
    _renderHUD();
  }
}

/* ---- hint ---- */
function _showHintVisual(hint, suffix) {
  _st.hintMove = hint; _renderTubesAll();
  const st2 = tubeTop(_st.tubes[hint.src]);
  const dstStr = _st.tubes[hint.dst].length ? COLOR_INFO[tubeTop(_st.tubes[hint.dst])].name : 'empty tube';
  Toast.show('Try ' + COLOR_INFO[st2].name + ' → ' + dstStr + (suffix ? ' (' + suffix + ')' : ''), 3500);
}

async function _onHint() {
  Sound.select();
  if (_st.animating || _st.won || _st._buyingHint) return;
  const initialHint = getHint(_st.tubes, _st.target, {
    initialTubes: _st.initialTubes,
    forwardMoves: _st.forwardMoves,
  });
  if (!initialHint) { Toast.show('No hint available'); return; }

  if (_st.hintsLeft > 0) {
    _st.hintsLeft--;
    _renderHUD();
    _showHintVisual(initialHint);
    return;
  }

  const cfg = _economyCfg();
  const cost = cfg ? cfg.spend.extraHint : 40;
  const coinMod = _getCoinModule();
  if (coinMod && coinMod.getBalance() >= cost && coinMod.spend(cost)) {
    Sound.coinSpend();
    _onCoinBalanceChanged();
    _showHintVisual(initialHint, '-' + cost + ' coins');
    return;
  }

  _st._buyingHint = true;
  Toast.show('Watch ad for an extra hint');
  let ok = false;
  try { ok = await Monetization.showRewarded('extra_hint'); }
  finally { _st._buyingHint = false; }
  if (_st.won || _st.mode === 'home' || !ok) return;
  const liveHint = getHint(_st.tubes, _st.target, {
    initialTubes: _st.initialTubes,
    forwardMoves: _st.forwardMoves,
  });
  if (liveHint) _showHintVisual(liveHint);
  else Toast.show('No hint available');
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
  _stopStuckActivity();
  if (_st.mode === 'daily') _startDaily();
  else if (_st.mode === 'challenge') _restartChallenge();
  else _startLevel(_st.levelNum);
}

function _restartChallenge() {
  const lv = generateChallengeLevel(_st.challengeSeed, _st.challengeDiff); if(!lv) return;
  _st.mode = 'challenge';
  _initPlaySession(lv, null, 'Challenge');
}

function _nextLevel() {
  _st._forcedSeed = undefined;
  _startLevel(_st.levelNum);
}

/* ---- date helpers ---- */
function _todayStr() {
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _dateStr(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

/* ===================================================================
   EXTRA "+" SLOT & STUCK DETECTION SYSTEM
   =================================================================== */

const MAX_EXTRA_TUBES = 2;
let _stuckWorker        = null;
let _workerSupported    = (typeof Worker !== 'undefined');
let _pendingWorkerCheck = null;
let _sliceTimer         = null;
let _popInTimer         = null;

function _getCoinModule() {
  if (typeof Economy !== 'undefined') return Economy;
  if (typeof Coins !== 'undefined') return Coins;
  return null;
}

/**
 * Compute extra-tube availability & cost policy for current mode/level.
 * Rules:
 *   - Max 2 extra tubes per level in EVERY realm, total real tubes <= 14.
 *   - Levels 1-10: first extra always free.
 *   - Realms 1-2 (levels 1-30): first extra FREE, second AD or 100 coins.
 *   - Realms 3+: both AD or 100 coins.
 */
function _getExtraPolicy() {
  const cfg = _st._levelConfig;
  let realm = 2;
  if (cfg && cfg.realmIndex) {
    realm = cfg.realmIndex;
  } else if (_st.mode === 'challenge') {
    const d = _st._currentDiff || 2;
    realm = d <= 1 ? 1 : d <= 3 ? 2 : d <= 4 ? 4 : d <= 5 ? 5 : 6;
  } else if (_st.mode === 'daily') {
    realm = 2;
  }

  const extrasLeft = Math.max(0, Math.min(MAX_EXTRA_TUBES - _st.extraTubesAdded, MAX_TUBES - _st.tubes.length));
  const totalPossible = _st.extraTubesAdded + extrasLeft;
  const firstFreeEligible = _st.mode === 'level'
    ? (_st.levelNum <= 10 || realm <= 2)
    : (realm <= 2);
  const isFree = firstFreeEligible && _st.extraTubesAdded === 0;
  const coinMod = _getCoinModule();
  const coinBal = coinMod ? coinMod.getBalance() : 0;
  const tubeCost = _economyCfg() ? _economyCfg().spend.extraTube : 100;
  const costLabel = isFree ? 'FREE' : (coinBal >= tubeCost ? String(tubeCost) : 'AD');
  const slot0Label = _st.extraTubesAdded >= 1 ? '✓' : (firstFreeEligible ? 'FREE' : (coinBal >= tubeCost ? String(tubeCost) : 'AD'));
  const slot1Label = _st.extraTubesAdded >= 2 ? '✓' : (coinBal >= tubeCost ? String(tubeCost) : 'AD');
  const hasPlusSlot = false;
  const slots = _st.tubes.length;

  return { realm, extrasLeft, totalPossible, hasPlusSlot, isFree, costLabel, slot0Label, slot1Label, tubeCost, coinMod, coinBal, slots };
}

function _isPlusPulsing() {
  if (_st.won || _st.mode === 'home') return false;
  if (_st._forceStuck) return true;
  // Never pulse in the first 5 moves of a level
  return _st.stuckStatus === 'yes' && _st.moveCount > 5;
}

function _updatePlusSlotVisual(policyOpt) {
  const policy = policyOpt || _getExtraPolicy();
  const pulsing = _isPlusPulsing() && policy.extrasLeft > 0;
  const coinStr = String(policy.tubeCost || 100);

  if (dom.btnAddTube) {
    dom.btnAddTube.classList.toggle('is-stuck', pulsing);
    dom.btnAddTube.classList.toggle('is-ready', policy.extrasLeft > 0);
    dom.btnAddTube.classList.toggle('is-exhausted', policy.extrasLeft <= 0);
    dom.btnAddTube.classList.toggle('is-busy', !!_st._addingTube);
  }
  if (dom.addTubeBadge) {
    dom.addTubeBadge.textContent = policy.extrasLeft > 0 ? policy.costLabel : '0';
    dom.addTubeBadge.classList.toggle('cost-free', policy.extrasLeft > 0 && policy.costLabel === 'FREE');
    dom.addTubeBadge.classList.toggle('cost-coins', policy.extrasLeft > 0 && policy.costLabel === coinStr);
  }
  if (dom.addTubeLeft) {
    dom.addTubeLeft.textContent = policy.extrasLeft > 0 ? (policy.extrasLeft + ' left') : '0 left';
  }

  // Update top-shelf AD tube icons (Image 6)
  const slotEls = [
    { btn: dom.topAddSlot0, badge: dom.topAddBadge0, used: _st.extraTubesAdded >= 1 || policy.totalPossible < 1, label: policy.slot0Label, isNext: _st.extraTubesAdded === 0 && policy.extrasLeft > 0 },
    { btn: dom.topAddSlot1, badge: dom.topAddBadge1, used: _st.extraTubesAdded >= 2 || policy.totalPossible < 2, label: policy.slot1Label, isNext: _st.extraTubesAdded === 1 && policy.extrasLeft > 0 },
  ];
  for (let i = 0; i < slotEls.length; i++) {
    const s = slotEls[i];
    if (!s.btn) continue;
    s.btn.classList.toggle('is-used', s.used);
    s.btn.classList.toggle('is-stuck', pulsing && s.isNext);
    if (s.badge) {
      s.badge.textContent = s.used ? '✓' : s.label;
      s.badge.classList.toggle('cost-free', !s.used && s.label === 'FREE');
      s.badge.classList.toggle('cost-coins', !s.used && s.label === coinStr);
    }
  }
}

function _updateDebugTubesOverlay(policyOpt) {
  if (!dom.debugTubesOverlay) return;
  if (!_st._debugTubes || _st.mode === 'home') {
    dom.debugTubesOverlay.classList.add('hidden');
    return;
  }
  const policy = policyOpt || _getExtraPolicy();
  const baseCount = _st.initialTubes ? _st.initialTubes.length : _st.tubes.length;
  const effStuck = _st._forceStuck ? 'yes' : (_st.stuckStatus || 'unknown');
  dom.debugTubesOverlay.textContent =
    'base tubes ' + baseCount +
    ' | extra used ' + _st.extraTubesAdded + '/2' +
    ' | slots ' + policy.slots +
    ' | stuck: ' + effStuck +
    ' | empty at start: ' + _st.emptyAtStart;
  dom.debugTubesOverlay.classList.remove('hidden');
}

function _stopStuckActivity() {
  _st._stuckCheckSeq++;
  _pendingWorkerCheck = null;
  if (_sliceTimer) { clearTimeout(_sliceTimer); _sliceTimer = null; }
  if (_popInTimer) { clearTimeout(_popInTimer); _popInTimer = null; }
}

function _resetStuckState() {
  _stopStuckActivity();
  _st.stuckStatus     = 'unknown';
  _st.extraTubesAdded = 0;
  _st.usedExtraTube   = false;
  _st._addingTube     = false;
}

/* ---- Web Worker + Time-Sliced Chunked Solver ---- */
function _fallbackPendingWorkerCheck() {
  const pending = _pendingWorkerCheck;
  _pendingWorkerCheck = null;
  if (pending && pending.seq === _st._stuckCheckSeq) {
    _runChunkedCheck(pending.payload);
  }
}

function _getWorker() {
  if (!_workerSupported) return null;
  if (!_stuckWorker) {
    try {
      _stuckWorker = new Worker('stuckdetect.js');
      _stuckWorker.addEventListener('message', _onWorkerMessage);
      _stuckWorker.addEventListener('error', () => {
        _workerSupported = false;
        try { _stuckWorker.terminate(); } catch (_) {}
        _stuckWorker = null;
        _fallbackPendingWorkerCheck();
      });
    } catch (e) {
      _workerSupported = false;
      _stuckWorker = null;
      return null;
    }
  }
  return _stuckWorker;
}

function _applyStuckResult(status) {
  _st.stuckStatus = status || 'unknown';
  _updatePlusSlotVisual();
  _updateDebugTubesOverlay();
}

function _onWorkerMessage(e) {
  const r = e.data;
  if (!r || r.type !== 'result') return;
  if (_pendingWorkerCheck && r.seq === _pendingWorkerCheck.seq) {
    _pendingWorkerCheck = null;
  }
  if (r.seq !== _st._stuckCheckSeq || _st.won || _st.mode === 'home') return;
  _applyStuckResult(r.status || (r.stuck ? 'yes' : 'no'));
}

/** Time-sliced BFS fallback (~6ms per slice) so UI never freezes even without Workers. */
function _runChunkedCheck(d) {
  if (_sliceTimer) { clearTimeout(_sliceTimer); _sliceTimer = null; }
  const solver = createChunkedSolver(d.tubes, d.target, StuckDetect.NODE_CAP, StuckDetect.TIME_CAP);
  const tWallStart = Date.now();

  function stepSlice() {
    _sliceTimer = null;
    if (d.seq !== _st._stuckCheckSeq || _st.won || _st.mode === 'home') return;

    const res = solver.step(600, 6);
    if (res) {
      const interpreted = StuckDetect.interpretSolverResult(res);
      _applyStuckResult(interpreted.status);
      return;
    }

    if (Date.now() - tWallStart >= 900) {
      _applyStuckResult('unknown');
      return;
    }
    _sliceTimer = setTimeout(stepSlice, 0);
  }

  _sliceTimer = setTimeout(stepSlice, 0);
}

/** Run off-main-thread stuck detection after every move / undo / addTube. */
function _scheduleStuckCheck() {
  if (_st.won || _st.mode === 'home') return;

  const seq = ++_st._stuckCheckSeq;
  _pendingWorkerCheck = null;
  if (_sliceTimer) { clearTimeout(_sliceTimer); _sliceTimer = null; }

  const payload = {
    type:   'check',
    seq:    seq,
    tubes:  cloneTubes(_st.tubes),
    target: _st.target.slice(),
  };

  // (a) No legal move checked immediately via shared StuckDetect rules
  const fast = StuckDetect.checkFastConditions(payload);
  if (fast !== null) {
    _applyStuckResult(fast.status);
    return;
  }

  // (b) Off-main-thread capped solver (30k nodes / 150ms)
  const worker = _getWorker();
  if (worker) {
    _pendingWorkerCheck = { seq, payload };
    try {
      worker.postMessage(payload);
    } catch (e) {
      _pendingWorkerCheck = null;
      _workerSupported = false;
      _runChunkedCheck(payload);
    }
  } else {
    _runChunkedCheck(payload);
  }
}

/* ---- "+" Extra Tube Tap Handler ---- */
async function _onAddPlusTube() {
  if (_st._addingTube || _st.won || _st.animating || _st.mode === 'home') return;

  const policy = _getExtraPolicy();
  if (policy.extrasLeft <= 0) {
    Toast.show('No add-tube chances left');
    Sound.error();
    return;
  }

  if (!policy.isFree) {
    const tubeCost = policy.tubeCost || 100;
    if (policy.coinMod && policy.coinMod.getBalance() >= tubeCost) {
      if (!policy.coinMod.spend(tubeCost)) {
        Toast.show('Not enough coins');
        _updatePlusSlotVisual();
        return;
      }
      Sound.coinSpend();
      _onCoinBalanceChanged();
      Toast.show('-' + tubeCost + ' coins · Extra tube added!');
    } else {
      _st._addingTube = true;
      _updatePlusSlotVisual(policy);
      let ok = false;
      try { ok = await Monetization.showRewarded('extra_tube'); }
      finally {
        _st._addingTube = false;
        _updatePlusSlotVisual();
      }
      if (_st.won || _st.mode === 'home') return;
      if (!ok) { Toast.show('Watch the ad to add a tube'); return; }
    }
  }

  // Lower any raised selected tube before reflowing layout
  if (_st.selectedTube >= 0 && _tubeEls[_st.selectedTube]) {
    _tubeEls[_st.selectedTube].wrapper.style.transition = '';
    _tubeEls[_st.selectedTube].wrapper.style.transform = '';
    _st.selectedTube = -1;
  }

  // Capture FLIP rects before adding the new tube
  const prevRects = {
    tubes: _tubeEls.map(el => el && el.wrapper && el.wrapper.getBoundingClientRect ? el.wrapper.getBoundingClientRect() : null),
    plus:  _plusEl && _plusEl.wrapper && _plusEl.wrapper.getBoundingClientRect ? _plusEl.wrapper.getBoundingClientRect() : null,
  };

  // "+" slot turns into a real empty tube; Undo must never remove an added tube
  const newTubeIdx = _st.tubes.length;
  _st.tubes.push([]);
  for (let i = 0; i < _st.history.length; i++) {
    if (Array.isArray(_st.history[i])) _st.history[i].push([]);
  }
  _st.extraTubesAdded++;
  _st.usedExtraTube = true;
  _st.stuckStatus   = 'unknown';

  _renderTubesAll({ forceRebuild: true, prevRects, popIdx: newTubeIdx });
  Sound.ding(880);
  if (policy.isFree) Toast.show('Extra tube added!');

  // Re-run stuck detection normally afterward
  _scheduleStuckCheck();
}

/* ===================================================================
   END EXTRA "+" SLOT & STUCK DETECTION SYSTEM
   =================================================================== */

const _CHEERS = ['GREAT!', 'BRILLIANT!', 'SPLENDID!', 'AMAZING!'];

function _startCelebration(stars, moves, par, target, code, usedExtraTube) {
  if (_reducedMotion()) {
    setTimeout(() => {
      if (_st.mode === 'daily') {
        _showDailyDone(_daily.results[_todayStr()]);
      } else {
        _showWinOverlayAnimated(stars, moves, par, code,
          stars === 3 ? 'PERFECT!' : _CHEERS[Math.floor(Math.random()*_CHEERS.length)], usedExtraTube);
      }
      _maybeInterstitial();
    }, 300);
    Sound.win();
    return;
  }
  const colors = target.map(function(c){return _hex(c);});
  _celeb = {
    startTime: performance.now(),
    stars: stars, moves: moves, par: par, code: code, colors: colors, target: target,
    usedExtraTube: !!usedExtraTube,
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
    _showWinOverlayAnimated(c.stars, c.moves, c.par, c.code, c.cheer, c.usedExtraTube);
  }
  Sound.win();
  _maybeInterstitial();
}

function _showWinOverlayAnimated(stars, moves, par, code, cheer, usedExtraTube) {
  _populateStarfield();
  var ct = dom.cheerText;
  if (ct) {
    ct.textContent = cheer || 'GREAT!';
    ct.classList.remove('show', 'perfect');
    ct.classList.toggle('perfect', stars === 3);
  }
  dom.winCodeBox.textContent = code;
  dom.winInfo.innerHTML = 'Moves: <strong>0</strong> &nbsp;|&nbsp; Par: <strong>' + par + '</strong>';
  if (dom.winExtraBadge) {
    dom.winExtraBadge.classList.toggle('hidden', !usedExtraTube);
  }
  _updateWinUnlockMeters();
  if (dom.btnNext) {
    dom.btnNext.textContent = _st.mode === 'challenge' ? 'Next Challenge ▶' : ('LEVEL ' + _st.levelNum);
  }
  if (dom.winCoinsRow && dom.winCoinsText) {
    const wc = _st._lastWinCoins;
    const total = wc ? wc.total : 0;
    dom.winCoinsRow.classList.toggle('hidden', total <= 0);
    if (total > 0) {
      const parts = [];
      if (wc.win) parts.push('+' + wc.win + ' win');
      if (wc.starBonus) parts.push('+' + wc.starBonus + ' 3★');
      if (wc.finaleBonus) parts.push('+' + wc.finaleBonus + ' finale');
      const detail = parts.length > 1 ? ' (' + parts.join(', ') + ')' : '';
      dom.winCoinsText.textContent = '+' + (_st._winCoinsDoubled ? total * 2 : total) + ' coins' +
        (_st._winCoinsDoubled ? ' (2×!)' : detail);
    }
  }
  if (dom.btnWinDoubleCoins) {
    const wcTotal = _st._lastWinCoins ? _st._lastWinCoins.total : 0;
    const showDouble = wcTotal > 0 && !_st._winCoinsDoubled;
    dom.btnWinDoubleCoins.classList.toggle('hidden', !showDouble);
    dom.btnWinDoubleCoins.disabled = false;
    if (showDouble) dom.btnWinDoubleCoins.textContent = 'Watch ad: double coins (+' + wcTotal + ')';
  }
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

function _renderUnlockMeter(kind, info, rowEl, labelEl, fillEl, fracEl, cardBtn, cvsEl, newBadgeEl) {
  if (!rowEl) return;
  if (!info) {
    rowEl.classList.add('hidden');
    return;
  }
  rowEl.classList.remove('hidden');
  const cur = Math.min(info.current, info.unlockLevel);
  const startPct = Math.max(0, Math.min(100, ((Math.max(0, cur - 1)) / info.unlockLevel) * 100));
  const endPct = Math.max(0, Math.min(100, (cur / info.unlockLevel) * 100));
  if (labelEl) {
    labelEl.textContent = info.justUnlocked
      ? ('Unlocked ' + info.item.name + '!')
      : ('Unlocks at Lv. ' + info.unlockLevel);
  }
  if (fracEl) fracEl.textContent = cur + '/' + info.unlockLevel;
  if (newBadgeEl) newBadgeEl.classList.toggle('hidden', !info.justUnlocked);
  if (fillEl) {
    if (_reducedMotion()) {
      fillEl.style.width = endPct.toFixed(1) + '%';
    } else {
      fillEl.style.width = startPct.toFixed(1) + '%';
      setTimeout(() => { fillEl.style.width = endPct.toFixed(1) + '%'; }, 90);
    }
  }
  if (cvsEl) {
    const thumbItem = Object.assign({ unlocked: info.justUnlocked, active: false }, info.item);
    _drawCollectionCardThumb(cvsEl, kind, thumbItem);
  }
  if (cardBtn) {
    cardBtn.onclick = () => {
      if (info.justUnlocked && typeof Economy !== 'undefined') {
        Sound.select();
        if (kind === 'tube') { Economy.selectTube(info.item.id); Toast.show('Equipped ' + info.item.name + '!'); }
        else { Economy.selectTheme(info.item.id); _initBg(); Toast.show('Theme: ' + info.item.name + '!'); }
      } else {
        Toast.show('Unlocks at Level ' + info.unlockLevel + '!');
      }
    };
  }
}

function _updateWinUnlockMeters() {
  if (typeof Economy === 'undefined' || !Economy.getNextUnlock) return;
  const completedLvl = _st._lastWonLevelNum !== null ? _st._lastWonLevelNum : Math.max(1, _st.levelNum - 1);
  const tubeInfo = Economy.getNextUnlock('tube', completedLvl);
  const themeInfo = Economy.getNextUnlock('theme', completedLvl);
  _renderUnlockMeter(
    'tube', tubeInfo,
    dom.winUnlockTubeRow, dom.winUnlockTubeLabel, dom.winUnlockTubeFill,
    dom.winUnlockTubeFrac, dom.winUnlockTubeCard, dom.winUnlockTubeCanvas, dom.winUnlockTubeNew
  );
  _renderUnlockMeter(
    'theme', themeInfo,
    dom.winUnlockThemeRow, dom.winUnlockThemeLabel, dom.winUnlockThemeFill,
    dom.winUnlockThemeFrac, dom.winUnlockThemeCard, dom.winUnlockThemeCanvas, dom.winUnlockThemeNew
  );
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

function _paintSceneTheme(ctx, themeId, W, H, isMini) {
  const thList = typeof Economy !== 'undefined' && Economy.CONFIG ? Economy.CONFIG.themes : null;
  const theme = (thList && thList.find(t => t.id === themeId)) || {
    id: 'doodle', bgTop: '#12082b', bgBot: '#1d1242', hill1: '#23154d', hill2: '#170d36', accent: '#7c4dff',
  };
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.bgTop);
  g.addColorStop(1, theme.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (theme.id === 'doodle') {
    _drawDoodlePattern(ctx, W, H, isMini);
    return;
  }

  ctx.save();
  if (theme.id === 'forest' || theme.id === 'nightwoods') {
    if (theme.id === 'nightwoods') {
      ctx.fillStyle = '#e8e6ff';
      ctx.beginPath(); ctx.arc(W * 0.72, H * 0.22, W * 0.08, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(W * 0.22, H * 0.14); ctx.quadraticCurveTo(W * 0.25, H * 0.11, W * 0.28, H * 0.14);
      ctx.moveTo(W * 0.30, H * 0.17); ctx.quadraticCurveTo(W * 0.33, H * 0.14, W * 0.36, H * 0.17);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = theme.hill1;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.65); ctx.lineTo(W * 0.28, H * 0.36); ctx.lineTo(W * 0.56, H * 0.58);
    ctx.lineTo(W * 0.80, H * 0.34); ctx.lineTo(W, H * 0.56); ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.hill2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.74); ctx.quadraticCurveTo(W * 0.5, H * 0.68, W, H * 0.76);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // Stylized pine silhouettes
    const treeX = [0.09, 0.20, 0.80, 0.91];
    for (let i = 0; i < treeX.length; i++) {
      const tx = W * treeX[i], ty = H * 0.78, tw = W * 0.12, th = H * 0.24;
      ctx.beginPath();
      ctx.moveTo(tx, ty - th); ctx.lineTo(tx + tw, ty); ctx.lineTo(tx - tw, ty);
      ctx.closePath(); ctx.fill();
    }
    // Deer silhouette in center clearing
    ctx.beginPath();
    ctx.ellipse(W * 0.50, H * 0.71, W * 0.055, H * 0.025, 0, 0, Math.PI * 2);
    ctx.fillRect(W * 0.46, H * 0.71, W * 0.015, H * 0.08);
    ctx.fillRect(W * 0.52, H * 0.71, W * 0.015, H * 0.08);
    ctx.fillRect(W * 0.525, H * 0.62, W * 0.02, H * 0.10);
    ctx.arc(W * 0.54, H * 0.62, W * 0.024, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme.id === 'sunset' || theme.id === 'desert') {
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(W * 0.58, H * 0.52, W * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.hill1;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.76); ctx.lineTo(W * 0.34, H * 0.44); ctx.lineTo(W * 0.64, H * 0.76);
    ctx.lineTo(W * 0.80, H * 0.50); ctx.lineTo(W, H * 0.76); ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.hill2;
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
  } else if (theme.id === 'cosmos' || theme.id === 'aurora') {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let s = 0; s < 18; s++) {
      ctx.beginPath();
      ctx.arc(((s * 73) % 100) * 0.01 * W, ((s * 41) % 60) * 0.01 * H, (s % 2) + 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (theme.id === 'cosmos') {
      ctx.fillStyle = '#3f51b5';
      ctx.beginPath(); ctx.arc(W * 0.52, H * 0.46, W * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9fa8da'; ctx.lineWidth = Math.max(2, W * 0.02);
      ctx.beginPath(); ctx.ellipse(W * 0.52, H * 0.46, W * 0.28, W * 0.06, -0.25, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.45)'; ctx.lineWidth = Math.max(6, H * 0.07);
      ctx.beginPath(); ctx.moveTo(0, H * 0.32);
      ctx.quadraticCurveTo(W * 0.45, H * 0.16, W, H * 0.36); ctx.stroke();
      ctx.fillStyle = theme.hill2;
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H * 0.74); ctx.lineTo(W * 0.4, H * 0.56);
      ctx.lineTo(W * 0.75, H * 0.68); ctx.lineTo(W, H * 0.58); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
  } else if (theme.id === 'skyline') {
    ctx.fillStyle = theme.hill2;
    const blds = [0.12, 0.22, 0.16, 0.28, 0.18, 0.24, 0.15];
    const bw = W / blds.length;
    for (let i = 0; i < blds.length; i++) {
      const bh = H * (0.28 + blds[i]);
      ctx.fillRect(i * bw, H - bh, bw - 2, bh);
    }
  } else {
    // lilypad / abyss layered organic circles
    ctx.fillStyle = theme.hill1;
    const blobs = [[0.25, 0.32, 0.18], [0.74, 0.28, 0.15], [0.48, 0.66, 0.22], [0.18, 0.80, 0.16]];
    for (let i = 0; i < blobs.length; i++) {
      ctx.beginPath();
      ctx.arc(W * blobs[i][0], H * blobs[i][1], W * blobs[i][2], 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function _initBg() {
  _bgCanvas = document.getElementById('bg-canvas');
  if (!_bgCanvas) return;
  var dpr = Math.min(devicePixelRatio||1, 2);
  var W = window.innerWidth, H = window.innerHeight;
  _bgCanvas.width = W*dpr; _bgCanvas.height = H*dpr;
  _bgCanvas.style.width = W+'px'; _bgCanvas.style.height = H+'px';
  _bgCtx = _bgCanvas.getContext('2d');
  _bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Cache static active theme background onto offscreen canvas for 60fps
  const activeThemeId = (typeof Economy !== 'undefined' && Economy.getActiveTheme)
    ? Economy.getActiveTheme().id : 'doodle';
  _bgDoodleCache = document.createElement('canvas');
  _bgDoodleCache.width = W*dpr; _bgDoodleCache.height = H*dpr;
  var dCtx = _bgDoodleCache.getContext('2d');
  dCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _paintSceneTheme(dCtx, activeThemeId, W, H, false);
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

function _drawDoodlePattern(ctx, W, H, isMini) {
  // Draw simple line-art doodles at ~5% opacity, tiled
  ctx.save();
  ctx.strokeStyle = isMini ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const tileSize = isMini ? 42 : 80;
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
