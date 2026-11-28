# Hue Pour 🎨

A 12-color mixing puzzle game — pour liquids between glass tubes to blend and create target colors across 10 themed realms. 100% offline, Capacitor-ready, no external libraries.

## Play & Test

Open `www/index.html` in a browser (or `www/tests.html` for the rules, milestone, and 2,000-seed validation suite), or serve locally:

```bash
cd www
python -m http.server 8765
# open http://localhost:8765
```

URL debug parameters:
- `?level=N` — jump directly to level `N`
- `?seed=NNN` — force a specific PRNG seed
- `?forcestuck=1` — force the `"+"` tube slot pulse & `"Need room? Tap +"` tooltip for testing
- `?debug=tubes` — show live overlay (`base tubes N | extra used E/2 | slots S | stuck: yes/no/unknown | empty at start: N`)
- `?debug=levels` — print a `console.table` summary of levels 1–200 (`level`, `realm`, `targets`, `colors`, `tubes`, `emptyAtStart`, `fallback`, `par`) plus no-empty / fallback counts and first 10 fallback levels

## Features

### Progression & 10 Realms (`www/progression.js`)
- **`getLevelConfig(levelNumber)`** returns `{ realmIndex, realmName, targets, colorPool, targetColors, emptyTubes, scrambleDepth, isBreather, isIntro, isFinale, introHint }`:
  1. **Sunrise Meadow** (1–15): 1 target (1–5), 2 targets (6–15), 6 base colors
  2. **Whispering Grove** (16–30): 3 targets, 6 base colors
  3. **Crystal Caverns** (31–50): 4 targets, 6 base colors
  4. **Desert Oasis** (51–75): 4 targets, at least 2 tertiary colors (introduces tertiaries one at a time with hint banners)
  5. **Neon Metropolis** (76–100): 5 targets, full 12 colors
  6. **Starlit Cosmos** (101–125): 6 targets, full 12 colors
  7. **Sunken Kingdom** (126–150): 7 targets, full 12 colors
  8. **Candy Cloudland** (151–175): 8 targets, full 12 colors
  9. **Aurora Summit** (176–200): 9 targets (10 on levels 190, 195, 200), full 12 colors
  10. **Endless Spectrum** (201+): cycles 6–10 targets, full 12 colors, rising scramble
- **Smooth Ramp**: 2 spare tubes beyond target count for levels `1–30` and 1 spare tube from level `31+`; levels start with liquid in every tube (no completely empty starting tube across 199/200 campaign levels, with a 10-try fallback to ≤1 empty tube), keeping free space and ≥2 legal first moves. Intro and breather levels stay approachable with shorter scramble depths, while scramble rises from ~60% to 100% within each realm.
- **Deterministic Color Selection**: Even coverage across each realm, no identical consecutive target sets, and consecutive levels share at most half their colors.

### Core Gameplay & 12-Color Wheel
- **12-color wheel** stored in a single `FUSION_TABLE` data object in `www/game.js`:
  - **Primaries**: Red (`#E53935`), Yellow (`#FFD93B`), Blue (`#2F7DF6`)
  - **Secondaries**: Orange (`#FF8A1F`), Green (`#2ECC71`), Purple (`#8E44AD`)
  - **Tertiaries** (cannot fuse further): Vermilion (`#FF5A36`), Amber (`#FFB020`), Lime (`#A6D930`), Teal (`#1BB3A5`), Indigo (`#4B4BD6`), Magenta (`#D63384`)
- **Responsive Slot Layout**: Counts total slots (`real tubes + "+" slot if shown`): up to `7` slots sit on one row; `8–14` slots split across two rows (`ceil(n/2)` in top row so no orphan tube ever appears), centered above bottom UI while preserving `height = 3.7 × width` and smooth FLIP re-flow on tube add.
- **Deterministic Reverse-Move Generator**: Records the forward solution, validates every generated level via `replayMoves`, and uses a capped BFS solver for tighter `par` on levels with ≤ 5 targets.
- **Inline `"+"` Extra Tube Slot & Stuck Help (`www/stuckdetect.js`, `www/coins.js`)**: Visible dashed empty tube slot with cost (`FREE`, `AD`, or `100`) and remaining count (`2 left` / `1 left`; max 2 extra per level in every realm, total ≤ 14; first extra free in levels 1–30, ad or 100 coins afterward; caps stars at 2 with a win badge; Undo preserves added tubes). Off-main-thread detection (`Worker` or chunked fallback) runs after every move and pulses the `"+"` slot (`"Need room? Tap +"`) after move 5 only when no legal move exists or the 30k/150ms solver proves unsolvable (timeouts = `unknown`).
- **Daily Puzzle, Challenge Codes, Tutorial, Undo, Hint, Restart, Share Cards**.

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
| `www/style.css` | All styles (responsive 320px+, `"+"` tube slot & stuck pulse, accessibility, compact targets) |
| `www/progression.js` | Data-driven 10-realm progression and deterministic level config (`getLevelConfig`) |
| `www/game.js` | Pure game logic: 12-color wheel, `FUSION_TABLE`, pour rules, packed-int BFS & chunked solver, reverse-move generator, replay validator |
| `www/stuckdetect.js` | Stuck detection Web Worker (`no-legal-move` & `30k/150ms` solver -> `yes/no/unknown`) |
| `www/coins.js` | LocalStorage coin balance stub with `TODO` for `economy.js` integration |
| `www/ui.js` | Rendering, animation, inline `"+"` extra tube slot, balanced 7/14-slot FLIP layout, WebAudio sound, celebrations, debug URL flags, all UI |
| `www/monetization.js` | Mock ad/IAP stubs |
| `www/tests.html` | Automated test runner (rule checks, milestone levels 1–250, 1–10 targets × 200 seeds replay validation, 1–200 empty-tube audit, `"+"` slot / orphan checks) |
| `www/README.md` | Detailed generator, solver, progression, `"+"` slot, and color system notes |

## License

MIT
