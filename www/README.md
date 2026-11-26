# Hue Pour

A mobile-first, portrait-only liquid-sort puzzle game where colours **blend**.

## Files

| File | Purpose |
|------|---------|
| `www/index.html` | Entry point. Loads CSS & JS, defines DOM: home screen, game screen, overlays. |
| `www/style.css` | All styling: dark theme, glass tubes, animations, home screen, overlays, responsive breakpoints (320–500 px). |
| `www/game.js` | **Pure game logic** — no DOM. Colours, pour rules, solver, level generator, daily puzzle, challenge codes, hints. |
| `www/ui.js` | UI layer — rendering, touch handling, pour/fuse animations, WebAudio sound, haptics, settings, save/load, home screen, daily, tutorial, share card, monetization hooks. |
| `www/monetization.js` | Mock ads & IAP stubs. Clean interface (`showInterstitial`, `showRewarded`, `purchaseRemoveAds`, `restorePurchases`). Every mock is marked `REPLACE WITH REAL SDK`. |
| `www/README.md` | This file. |

## How to Play

Open `www/index.html` in any modern browser or serve via `npx serve www`.

- **Same colour / empty** → liquid flows over (up to free space).
- **Fusion pair** (Red+Yellow → Orange, Yellow+Blue → Green, Red+Blue → Purple) → one unit fuses into the destination's top. Works even when the tube is full.
- **Anything else** → illegal; tubes shake.

Win by making every non-empty tube a full (4-unit) single colour matching the target palette.

## Features

### Core Puzzle
- Deterministic level generation with seeded PRNG (Mulberry32)
- BFS solver verifies every puzzle is solvable; shortest path = par
- Difficulty tiers: 1 target (L1–5), 2 targets (L6–15), 3 targets (L16+)
- Interactive tutorial for levels 1–3 (solver-guided highlights)

### Daily Puzzle
- Seed = local date as YYYYMMDD — everyone gets the same puzzle, no server
- Streak tracking in localStorage
- One result per day; "Come back tomorrow" countdown after completion
- Share button: `Hue Pour #<day> – solved in X moves (par Y) 🟧🟩🟪`

### Challenge Codes
- Each win generates a code like `HP-7K2Q` (base-32 + checksum)
- Enter a code on the home screen to load the exact same puzzle
- Share codes with friends for head-to-head score comparison

### Share Card
- 1080×1920 canvas image with gradient, stars, moves, palette, and code
- Save image or share via `navigator.share` (with file support)

### Monetization Stubs (Mock)
- `showInterstitial()`: after every 4th level win (never in first 5), skipped if ads removed
- `showRewarded()`: watch ad for a Hint (solver highlights one move) or 3 extra undos
- `purchaseRemoveAds()` / `restorePurchases()`: IAP stubs
- 3 free undos per level; more via rewarded ad
- All mocks are 3-second countdown overlays — replace with AdMob / Play Billing

### Home Screen
- Play (continues current level), Daily, Enter Code, Settings
- Shows current level number and daily streak

### Quality
- 60 fps CSS animations; no `setInterval` render loops
- `aria-label` on all interactive elements
- Layout works 320 px – 430 px+ wide
- Safe-area insets for notch devices
- Touch targets ≥ 48 px; `touch-action: manipulation` disables double-tap zoom
- All sounds synthesized via WebAudio; subtle ambient pad
- All graphics CSS/SVG — no external assets
- 100% offline; `localStorage` save with `try/catch`

## URL Parameters

- `?level=NN` — jump to level NN
- `?seed=NNN` — force a specific PRNG seed

Open Developer Tools → Console to see generation logs: seed, par, BFS node count.

## Level Generator

1. A **target palette** is chosen by difficulty tier.
2. The **solved state** is built: one full tube per target colour + 1–2 empty tubes.
3. Random **reverse moves** scramble the solved state (split pours, reverse fusions).
4. A **BFS solver** (normalised state hashing, ≤ 200 k nodes) verifies solvability. If unsolvable, seed increments.
5. Shortest solution length = **par**.

## Solver

- BFS over all legal forward pours
- States normalised (tubes sorted) to collapse permutations
- Pruning: completed tubes locked, only first empty tube tried, no-op moves skipped
- Also used for hints (first move of optimal remaining path)

## Challenge Code Encoding

- `value = seed × 4 + (difficulty − 1)` → base-32 digits (alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) → append checksum character
- Format: `HP-<payload><checksum>`
- Decoding validates checksum before accepting

## Capacitor

All web assets live under `www/` with `index.html` at its root. Ready for `npx cap sync`.
