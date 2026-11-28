# Hue Pour

A mobile-first, portrait-only liquid-sort puzzle game where colours **blend** across a 12-colour wheel.

## Files

| File | Purpose |
|------|---------|
| `www/index.html` | Entry point. Loads CSS & JS (`progression.js`, `game.js`, `economy.js`, `monetization.js`, `coins.js`, `stuckdetect.js`, `ui.js`), defines DOM: home screen + wallet, shop overlay, game screen + HUD wallet, `?debug=tubes` overlay, win/daily coin overlays. |
| `www/style.css` | All styling: dark theme, glass tubes, animations, wallet pills & fly-to-wallet particles, color shop modal, `"+"` extra tube slot, stuck pulse/tooltip, home screen, overlays, responsive breakpoints (320–500 px). |
| `www/progression.js` | Data-driven realm & progression configuration (`getLevelConfig(levelNumber)`): 10 realms, 2 spare tubes (L1–30) / 1 spare tube (L31+), shorter scramble on intro & breather levels, and deterministic colour schedules. |
| `www/game.js` | **Pure game logic** — no DOM. 12-colour wheel, unified `FUSION_TABLE`, pour rules, packed-int BFS & chunked/capped solvability checker, reverse-move level generator (requiring 0 empty start tubes with 10-try fallback to ≤1 empty, free space, ≥2 legal moves) with replay validation, daily puzzle, challenge codes, hints. |
| `www/economy.js` | **Coin economy & ad rules** — single tunable `Economy.CONFIG` object for wallet persistence (`localStorage` in `try/catch`), earn/spend payouts, 30s/10-per-day rewarded-ad caps, interstitial gating, and shop colour palettes. |
| `www/stuckdetect.js` | **Stuck-detection engine & Web Worker** — runs after every move off the main thread (`new Worker('stuckdetect.js')` or time-sliced chunked fallback) returning `yes` (no legal moves or solver proven unsolvable), `no`, or `unknown` (timeout/cap). |
| `www/coins.js` | **Coins compatibility bridge** — delegates `getBalance`, `setBalance`, `canAfford`, `spend`, `earn` to `Economy` (`economy.js`) when present, with `localStorage` fallback. |
| `www/ui.js` | UI layer — canvas tube rendering, balanced slot FLIP layout, `"+"` extra tube slot, coin wallet count-up & fly-to-wallet particles, shop modal, free/coin/ad hints & undos, WebAudio sounds (incl. coin chimes), haptics, settings, save/load, home screen, daily, share card, monetization hooks. |
| `www/monetization.js` | Mock ads & IAP wrappers (`purchaseRemoveAds`, `restorePurchases`, `isAdsRemoved`, `showInterstitial`, `showRewarded(reason)`, `getLastRewardedAt`, `getInterstitialCooldownRemaining`); mock overlay displays `REPLACE WITH REAL SDK`. |
| `www/tests.html` | Automated test suite: colour/fusion rules, milestone levels, 200 seeds per config (1–10 targets) replay validation, levels 1–200 empty-tube audit, `"+"` slot checks, and economy/ad-rule checks. |
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

- **Spare tubes**: 2 spare tubes for levels 1–30, 1 spare tube from level 31 onward (`emptyTubes` in `getLevelConfig`). Every generated level pours into empty tubes during scrambling until none starts empty (with a 1-empty fallback only if 10 tries cannot pass validation), while keeping free space and at least 2 legal first moves.
- **Intro & Breather levels**: first 3 levels of each realm (`isIntro`) and every non-finale 5th level (`isBreather`) use shorter scramble depths (`~0.75×` / `~0.70×`).
- **Finale** (last level of a realm): max scramble depth.
- **Target colour selection**: deterministic seeded schedule per realm ensuring even pool coverage, no consecutive identical target sets, and at most half shared colours between consecutive levels.

## 12-Colour Wheel & Fusion Table

All fusion rules live in a single `FUSION_TABLE` object in `www/game.js` (order of parents does not matter):

- **Primaries**: Red (`#E53935` `●`), Yellow (`#FFD93B` `▲`), Blue (`#2F7DF6` `■`)
- **Secondaries**: Red+Yellow → Orange (`#FF8A1F` `◆`), Yellow+Blue → Green (`#2ECC71` `★`), Blue+Red → Purple (`#8E44AD` `✚`)
- **Tertiaries** (cannot fuse further): Red+Orange → Vermilion (`#FF5A36` `▼`), Yellow+Orange → Amber (`#FFB020` `✕`), Yellow+Green → Lime (`#A6D930` `≡`), Blue+Green → Teal (`#1BB3A5` `○`), Blue+Purple → Indigo (`#4B4BD6` `≈`), Red+Purple → Magenta (`#D63384` `□`)

## Extra `"+"` Tube Slot & Stuck Help (`www/stuckdetect.js`, `www/coins.js`, `www/ui.js`)

- **Inline `"+"` tube slot**: Rendered at the end of the tube layout inside `#tube-area` using the same tube dimensions (`height = 3.7 × width`), with a dashed outline, `"+"` icon, cost badge (`FREE`, `AD`, or `100`), and remaining count (`2 left` / `1 left`).
- **Hard cap & costs**: Max `2` extra tubes per level in every realm (and total tubes ≤ `14`); restarting resets extra count to `0`, and Undo never removes an added extra tube. Levels `1–30` (Realms 1–2): 1st extra `FREE`, 2nd `AD` (`showRewarded`) or `100` coins (`Economy`/`Coins` stub); Realms `3+` (levels `31+`): both `AD` or `100` coins.
- **Subtle stuck signal**: Runs `stuckdetect.js` off the main thread after every move (`no-legal-move` or capped BFS `30,000` nodes / `150 ms` proving unsolvable; timeout/cap = `unknown`). When stuck after move 5 (`moveCount > 5`), the `"+"` slot gently pulses/glows with a `"Need room? Tap +"` tooltip (no banners, no popups, no auto-add). Using an extra tube caps level stars at `2` and displays a small tube icon on the win screen.
- **Responsive Slot Layout**: `slots = realTubes + (hasPlusSlot ? 1 : 0)`. Up to `7` slots fit in one row; `8–14` slots split into two rows with `ceil(slots / 2)` in the top row (never leaving a single orphan tube), centered above bottom UI with smooth FLIP re-flow animation.

## Economy, Coins & Ads (`www/economy.js`, `www/monetization.js`)

All coin rewards, spend costs, ad caps, and shop palette prices are defined in one `Economy.CONFIG` object in `www/economy.js`:

- **Wallet**: Saved in `localStorage` (`try/catch`), rendered with an original SVG coin icon in `#home-wallet` and `#hud-wallet`, featuring a count-up animation and coin fly-to-wallet particles (disabled under Reduce Effects / `prefers-reduced-motion`).
- **Earn**: `+10` per level win, `+10` extra for 3 stars, `+100` for clearing a realm finale (`isFinale`), and `30 + 5 × streak` (streak bonus capped at `+50`) for daily puzzles.
- **Spend**: Extra hint `40`, 3 extra undos `30`, extra tube `100`, colour palettes `800` (shop). Every level keeps `1` free hint and `3` free undos.
- **Rewarded Ads (`showRewarded(reason)`)**:
  - `"Watch ad: +150 coins"` on home screen and in the shop (`30s` cooldown, max `10/day`).
  - `"Watch ad: double coins"` on campaign win & daily done screens.
  - `"Watch ad"` fallback for extra hint, extra undos, and extra tube when coin balance is too low.
  - Always remains available even when `isAdsRemoved()` is `true`; mock overlay displays `REPLACE WITH REAL SDK`.
- **Interstitials**: Every 4th level completion (`levelsCompleted > 5`), and never in the first 5 levels, never within `2 minutes` after a rewarded ad, and never during a realm finale or active celebration.

## URL Parameters

- `?level=N` — jump directly to level `N`
- `?seed=NNN` — force a specific PRNG seed
- `?coins=1000` — set wallet coin balance for testing
- `?forcestuck=1` — force the `"+"` slot stuck pulse & tooltip (`"Need room? Tap +"`) for testing
- `?debug=tubes` — show live overlay `"base tubes N | extra used E/2 | slots S | stuck: yes/no/unknown | empty at start: N"`
- `?debug=levels` — print a console table (`console.table`) of levels 1–200 plus counts of no-empty-tube vs 1-empty fallback levels and the first 10 fallback levels

## Capacitor

All web assets live under `www/` with `index.html` at its root. Ready for `npx cap sync`.
