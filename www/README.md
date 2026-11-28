# Hue Pour

A mobile-first, portrait-only liquid-sort puzzle game where colours **blend** across a 12-colour wheel.

## Files

| File | Purpose |
|------|---------|
| `www/index.html` | Entry point. Loads CSS & JS (`progression.js`, `game.js`, `monetization.js`, `coins.js`, `stuckdetect.js`, `ui.js`), defines DOM: home screen, game screen, stuck rescue banner, overlays. |
| `www/style.css` | All styling: dark theme, glass tubes, animations, home screen, stuck rescue banner, overlays, responsive breakpoints (320–500 px), compact 10-target row support. |
| `www/progression.js` | Data-driven realm & progression configuration (`getLevelConfig(levelNumber)`): 10 realms, smooth scramble/empty-tube ramp, breathers, intros, finales, and deterministic colour schedules. |
| `www/game.js` | **Pure game logic** — no DOM. 12-colour wheel, unified `FUSION_TABLE`, pour rules, packed-int BFS & chunked/capped solvability checker, reverse-move level generator with replay validation, daily puzzle, challenge codes, hints. |
| `www/stuckdetect.js` | **Stuck-detection engine & Web Worker** — runs off the main thread (`new Worker('stuckdetect.js')` or time-sliced chunked fallback via `createChunkedSolver`) to evaluate conditions `(a)–(e)`. |
| `www/coins.js` | **Coins stub (`TODO`)** — localStorage-backed balance helpers (`getBalance`, `spend`, `earn`) wrapped in `try/catch`. |
| `www/ui.js` | UI layer — canvas tube rendering, 2-row responsive layout (up to 7 tubes per row for 11–14 tubes), touch handling, pour/fuse animations, stuck rescue banner & extra-tube reflow, WebAudio sound, haptics, settings, save/load, home screen, daily, tutorial, share card, monetization hooks. |
| `www/monetization.js` | Mock ads & IAP stubs (`showInterstitial`, `showRewarded`, `purchaseRemoveAds`, `isAdsRemoved`, `restorePurchases`). |
| `www/tests.html` | Browser test suite: validates colour/fusion rules, milestone levels (1, 15, 16, 30, 50, 51, 100, 150, 200, 250), 200 seeds per config (1–10 targets) through replay validation, and stuck rescue checks (levels 1, 16, 51, 101 + conditions `a–e`). |
| `www/README.md` | This file. |

## Progression & Realms (`www/progression.js`)

`getLevelConfig(levelNumber)` returns `{ realmIndex, realmName, targets, colorPool, targetColors, emptyTubes, scrambleDepth, isBreather, isIntro, isFinale, introHint }`:

1. **Sunrise Meadow** (1–15): 1 target (1–5), 2 targets (6–15), 6 base colours.
2. **Whispering Grove** (16–30): 3 targets, 6 base colours.
3. **Crystal Caverns** (31–50): 4 targets, 6 base colours.
4. **Desert Oasis** (51–75): 4 targets, at least 2 tertiary colours (introduces tertiaries one at a time with hint banners).
5. **Neon Metropolis** (76–100): 5 targets, full 12-colour wheel.
6. **Starlit Cosmos** (101–125): 6 targets, full 12 colours.
7. **Sunken Kingdom** (126–150): 7 targets, full 12 colours.
8. **Candy Cloudland** (151–175): 8 targets, full 12 colours.
9. **Aurora Summit** (176–200): 9 targets (10 on levels 190, 195, 200), full 12 colours.
10. **Endless Spectrum** (201+): cycles 6–10 targets, full 12 colours, rising scramble depth.

- **Intro levels** (first 3 of each realm): 3 empty tubes.
- **Breather levels** (every 5th level, not finale): +1 empty tube and shorter scramble.
- **Finale** (last level of a realm): max scramble, 2 empty tubes.
- **Target colour selection**: deterministic seeded schedule per realm ensuring even pool coverage, no consecutive identical target sets, and at most half shared colours between consecutive levels.

## 12-Colour Wheel & Fusion Table

All fusion rules live in a single `FUSION_TABLE` object in `www/game.js` (order of parents does not matter):

- **Primaries**: Red (`#E53935` `●`), Yellow (`#FFD93B` `▲`), Blue (`#2F7DF6` `■`)
- **Secondaries**: Red+Yellow → Orange (`#FF8A1F` `◆`), Yellow+Blue → Green (`#2ECC71` `★`), Blue+Red → Purple (`#8E44AD` `✚`)
- **Tertiaries** (cannot fuse further): Red+Orange → Vermilion (`#FF5A36` `▼`), Yellow+Orange → Amber (`#FFB020` `✕`), Yellow+Green → Lime (`#A6D930` `≡`), Blue+Green → Teal (`#1BB3A5` `○`), Blue+Purple → Indigo (`#4B4BD6` `≈`), Red+Purple → Magenta (`#D63384` `□`)

## Stuck Rescue System (`www/stuckdetect.js`, `www/coins.js`, `www/ui.js`)

- **Off-main-thread detection** runs after every move via a Web Worker (`www/stuckdetect.js`), with automatic time-sliced chunked fallback (`createChunkedSolver`, ~6 ms slices) when Workers are unavailable (`file://`).
- **Stuck triggers** (never shown during the first 5 moves of a level unless `?forcestuck=1` is set):
  - **(a)** No legal move remains.
  - **(b)** Capped BFS (`30,000` nodes, `150 ms` time budget) proves the state unsolvable (`timeout` / node-cap is treated as unknown, never stuck).
  - **(c)** Player has restarted the level 2+ times.
  - **(d)** Move count exceeds `2.5 × par`.
  - **(e)** 60 seconds elapsed with no board progress after at least 10 moves.
- **Extra tube rules**:
  - Adds one empty tube with a pop-in animation and smooth layout re-flow, capped at `14` total tubes (`1` max extra in Realms 1–5; `2` max extra in Realms 6–10).
  - Levels 1–10: always free and offered automatically on first detection; Realms 1–2: first extra tube per level is free; otherwise watch a rewarded ad (`showRewarded`) or spend 100 coins (`Coins.spend(100)` stub with `TODO`).
  - Caps level stars at 2 and displays an original tube badge on the win / daily completion screen without altering seed, par, or challenge codes. Undo works seamlessly for moves made into extra tubes, and stuck detection re-runs normally afterward.

## URL Parameters

- `?level=N` — jump directly to level `N`
- `?seed=NNN` — force a specific PRNG seed
- `?forcestuck=1` — trigger the `"Stuck? Add a tube"` banner immediately (testable on levels `1`, `16`, `51`, `101`, etc.)
- `?debug=levels` — print a console table (`console.table`) of levels 1–200 (`level`, `realm`, `targets`, `colors`, `tubes`, `par`)

## Capacitor

All web assets live under `www/` with `index.html` at its root. Ready for `npx cap sync`.
