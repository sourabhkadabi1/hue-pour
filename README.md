# Hue Pour 🎨

A 12-color mixing puzzle game — pour liquids between glass tubes to blend and create target colors. 100% offline, Capacitor-ready, no external libraries.

## Play & Test

Open `www/index.html` in a browser (or `www/tests.html` for the 2,000-seed generator validation suite), or serve locally:

```bash
cd www
python -m http.server 8765
# open http://localhost:8765
```

## Features

### Core Gameplay & 12-Color Wheel
- **12-color wheel** stored in a single `FUSION_TABLE` data object in `www/game.js`:
  - **Primaries**: Red (`#E53935`), Yellow (`#FFD93B`), Blue (`#2F7DF6`)
  - **Secondaries**: Orange (`#FF8A1F`), Green (`#2ECC71`), Purple (`#8E44AD`)
  - **Tertiaries** (cannot fuse further): Vermilion (`#FF5A36`), Amber (`#FFB020`), Lime (`#A6D930`), Teal (`#1BB3A5`), Indigo (`#4B4BD6`), Magenta (`#D63384`)
- **Fusion rules**: Red+Yellow=Orange, Yellow+Blue=Green, Blue+Red=Purple, Red+Orange=Vermilion, Yellow+Orange=Amber, Yellow+Green=Lime, Blue+Green=Teal, Blue+Purple=Indigo, Red+Purple=Magenta (order-independent).
- **Large levels**: Supports up to **10 targets** and **14 tubes** with responsive multi-row and compact target palette layouts.
- **Deterministic reverse-move generator**: Generates levels by reverse moves from the solved state while recording the forward solution, validates every level via `replayMoves`, and tightens `par` with a capped BFS solver for levels with ≤ 5 targets.
- **Daily Puzzle**: Same puzzle for everyone each day (seeded by date). Streak tracking in `localStorage`.
- **Challenge Codes**: Encode puzzles (1–10 targets) as short `HP-XXXX` codes with checksum to share with friends.
- **Tutorial, Undo, Hint, Restart**: 3 free undos per level + rewarded ad option; solver/heuristic hints; skippable tutorial for levels 1–3.

### Visuals, Accessibility & Performance
- **60 fps canvas rendering**: Lip-anchored pour animation, fusion particle bursts, cached background doodle layer, crisp band separators between neighboring colors.
- **Colorblind mode**: 12 distinct high-contrast symbols (`● ▼ ◆ ✕ ▲ ≡ ★ ○ ■ ≈ ✚ □`), chosen so no neighboring wheel colors share similar shapes.
- **Reduce effects**: Disables particles, confetti, combo flash, idle breathing, and screen shake; also respects `prefers-reduced-motion`.
- **Audio & Saves**: All sounds synthesized via WebAudio; all `localStorage` access wrapped in `try/catch`.

### Monetization (mock stubs)
- `monetization.js` exposes `purchaseRemoveAds`, `restorePurchases`, `isAdsRemoved`, `showInterstitial`, and `showRewarded` (marked with `// REPLACE WITH REAL SDK`).

## Files

| File | Purpose |
|---|---|
| `www/index.html` | Single-page app shell |
| `www/style.css` | All styles (responsive 320px+, accessibility, compact targets) |
| `www/game.js` | Pure game logic: 12-color wheel, `FUSION_TABLE`, pour rules, BFS solver, reverse-move generator, replay validator |
| `www/ui.js` | Rendering, animation, WebAudio sound, celebrations, all UI |
| `www/monetization.js` | Mock ad/IAP stubs |
| `www/tests.html` | Automated test runner (rule checks + 1–10 targets × 200 seeds replay validation) |
| `www/README.md` | Detailed generator, solver, and color system notes |

## License

MIT
