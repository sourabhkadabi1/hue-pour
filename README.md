# Hue Pour 🎨

A color-mixing puzzle game — pour liquids between glass tubes to create target colors. 100% offline, no external libraries.

## Play

Open `www/index.html` in a browser, or serve it locally:

```bash
cd www
python -m http.server 8765
# open http://localhost:8765
```

## Features

### Core Gameplay
- **Color mixing**: Pour primary colors between tubes to create secondary/tertiary colors via realistic fusion rules.
- **Progressive levels**: Procedurally generated with increasing difficulty. Solver-verified par for every level.
- **Daily Puzzle**: Same puzzle for everyone each day (seeded by date). Streak tracking in localStorage.
- **Challenge Codes**: Encode any puzzle as a short `HP-XXXX` code to share with friends.
- **Tutorial**: Interactive hints for levels 1-3, skippable.
- **Undo / Hint / Restart**: 3 free undos per level; watch a (mock) rewarded ad for more. Hints highlight one optimal move.

### Visuals & Animation (v4)
- **Glass tubes**: Rounded bottom, flared rim, inner highlight, shadow — all canvas-drawn.
- **Liquid rendering**: Smooth vertical gradients with glossy highlights, soft layer boundaries, damped-sine surface wave.
- **Pour animation** (~1.0-1.4s): Tube lifts, tilts, streams liquid with a curved gravity path, splashes, drains/fills smoothly, returns with a settle bounce. Liquid surface stays horizontal in world space via clip-path.
- **Fusion moment**: Two colors swirl together, glowing ring pulses, sparkles float up in the new color.
- **Tube completed**: Glass "ting" sound, shine sweep, glowing cap with sparkles.
- **Layout**: Centered phone-width column (max 480px), tubes wrap to two rows when >5.

### Celebrations & Juice (v5)
- **Level complete sequence** (~3s, tap to skip):
  - Finished tubes hop one-by-one with rising pentatonic notes.
  - Confetti burst (rectangles, stars, circles, ribbons) with gravity, spin and fade-out (capped at 150).
  - Soft expanding shockwave ring and background brighten.
  - Ribbon banner with elastic bounce: "GREAT!", "BRILLIANT!", "SPLENDID!", "AMAZING!" (3-star: "PERFECT!" + extra screen shake).
  - Three stars pop in with a "ding" sound.
  - Animated moves count-up next to par.
  - Pulsing NEXT button.
  - Victory arpeggio + whoosh sound (all WebAudio synthesized).
- **Combo flash**: Consecutive fusions show "Chain x2!" text floating up with sparkle.
- **Idle life**: Tubes gently breathe (subtle scale/bob), slow liquid shimmer, soft drifting background shapes with parallax. Pauses when tab is hidden.
- **Hint arrow**: Glowing pulsing curved arrow between suggested source and destination tubes.
- **Progress bar**: Home screen shows levels completed in current world (groups of 10), with milestone celebration every 5 levels.
- **Button feel**: Every button squishes on press with a soft click sound.
- **Star sky**: Twinkling stars in the win overlay background.
- **Reduce effects**: Settings toggle disables particles, confetti, combo, idle breathing, screen shake. Also respects `prefers-reduced-motion`.

### Monetization (mock stubs)
- `showInterstitial()` — full-screen fake "Ad" overlay (3s countdown). Triggers after every 4th level, never in first 5.
- `showRewarded()` — fake 3s ad, resolves `true`. Used for extra hints and undos.
- `purchaseRemoveAds()` / `isAdsRemoved()` / `restorePurchases()` — mock flag in localStorage.
- All mock behavior marked with `// REPLACE WITH REAL SDK` comments in `monetization.js`.

### Share
- **Text share**: "Hue Pour #N — solved in X moves (par Y) 🟧🟩🟪" via `navigator.share` or clipboard.
- **Image share**: 1080×1920 canvas card with gradient, game name, level, moves, stars. Save or share as PNG.

## Files

| File | Purpose |
|---|---|
| `www/index.html` | Single-page app shell |
| `www/style.css` | All styles (responsive, accessibility) |
| `www/game.js` | Game logic, solver, level generator — **never modified by visual updates** |
| `www/ui.js` | Rendering, animation, sound, celebrations, all UI |
| `www/monetization.js` | Mock ad/IAP stubs |

## Accessibility
- ARIA labels on interactive elements.
- Responsive layout: 320px to 430px+ wide.
- Colorblind mode toggle.
- Reduce effects / prefers-reduced-motion support.

## Performance
- 60fps target on mid-range phones.
- Particle caps: 120 (sparkles) + 150 (confetti).
- `requestAnimationFrame` loop, cleaned up listeners and canvases.
- No memory leaks — all animations and event listeners properly torn down.

## License

MIT
