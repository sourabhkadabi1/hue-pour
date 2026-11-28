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
- `?forcestuck=1` — trigger the `"Stuck? Add a tube"` stuck-rescue banner immediately for testing
- `?debug=levels` — print a `console.table` summary of levels 1–200 (`level`, `realm`, `targets`, `colors`, `tubes`, `par`)

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
- **Smooth Ramp**: 3 empty tubes on realm intro levels (first 3 of each realm) and +1 empty tube with shorter scramble on breathers (every 5th level, non-finale); scramble rises from ~60% to 100% within each realm and resets slightly lower at the start of the next realm.
- **Deterministic Color Selection**: Even coverage across each realm, no identical consecutive target sets, and consecutive levels share at most half their colors.

### Core Gameplay & 12-Color Wheel
- **12-color wheel** stored in a single `FUSION_TABLE` data object in `www/game.js`:
  - **Primaries**: Red (`#E53935`), Yellow (`#FFD93B`), Blue (`#2F7DF6`)
  - **Secondaries**: Orange (`#FF8A1F`), Green (`#2ECC71`), Purple (`#8E44AD`)
  - **Tertiaries** (cannot fuse further): Vermilion (`#FF5A36`), Amber (`#FFB020`), Lime (`#A6D930`), Teal (`#1BB3A5`), Indigo (`#4B4BD6`), Magenta (`#D63384`)
- **Responsive Layout**: Up to 5 tubes per row for 1–10 tubes; 2 rows of up to 7 tubes for 11–14 tubes, dynamically scaled to fit screen width while preserving `height = 3.7 × width`.
- **Deterministic Reverse-Move Generator**: Records the forward solution, validates every generated level via `replayMoves`, and uses a capped BFS solver for tighter `par` on levels with ≤ 5 targets.
- **Stuck Rescue System (`www/stuckdetect.js`, `www/coins.js`)**: Off-main-thread Web Worker detection (with time-sliced chunked BFS fallback) checks no legal moves, capped solver unsolvability (30k nodes / 150ms, timeout treated as unknown), 2+ restarts, `> 2.5×par` moves, and 60s without progress after 10+ moves (never shown on the first 5 moves). Offers a slide-up banner to add an empty tube with pop-in animation (max 1 extra in Realms 1–5, max 2 in Realms 6–10, total ≤ 14; free in levels 1–10 and Realms 1–2 first extra; otherwise rewarded ad or 100-coin `Coins` stub), capping stars at 2 with a win badge while keeping seed/par/share codes intact and preserving Undo support.
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
| `www/style.css` | All styles (responsive 320px+, stuck rescue banner, accessibility, compact targets) |
| `www/progression.js` | Data-driven 10-realm progression and deterministic level config (`getLevelConfig`) |
| `www/game.js` | Pure game logic: 12-color wheel, `FUSION_TABLE`, pour rules, packed-int BFS & chunked solver, reverse-move generator, replay validator |
| `www/stuckdetect.js` | Stuck detection Web Worker + shared condition evaluator (`(a)–(e)`) |
| `www/coins.js` | LocalStorage coin balance stub with `TODO` for real economy |
| `www/ui.js` | Rendering, animation, stuck rescue & extra tube UI, WebAudio sound, celebrations, layout, debug URL flags, all UI |
| `www/monetization.js` | Mock ad/IAP stubs |
| `www/tests.html` | Automated test runner (rule checks, milestone levels 1–250, 1–10 targets × 200 seeds replay validation, stuck rescue checks) |
| `www/README.md` | Detailed generator, solver, progression, stuck rescue, and color system notes |

## License

MIT
