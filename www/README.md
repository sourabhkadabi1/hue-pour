# Hue Pour

A mobile-first, portrait-only liquid-sort puzzle game where colours **blend** across a 12-colour wheel.

## Files

| File | Purpose |
|------|---------|
| `www/index.html` | Entry point. Loads CSS & JS, defines DOM: home screen, game screen, overlays. |
| `www/style.css` | All styling: dark theme, glass tubes, animations, home screen, overlays, responsive breakpoints (320–500 px), compact 10-target row support. |
| `www/game.js` | **Pure game logic** — no DOM. 12-colour wheel, unified `FUSION_TABLE`, pour rules, fast BFS solver, reverse-move level generator with replay validation, daily puzzle, challenge codes, hints. |
| `www/ui.js` | UI layer — canvas tube rendering, touch handling, pour/fuse animations, WebAudio sound, haptics, settings, save/load, home screen, daily, tutorial, share card, monetization hooks. |
| `www/monetization.js` | Mock ads & IAP stubs (`showInterstitial`, `showRewarded`, `purchaseRemoveAds`, `isAdsRemoved`, `restorePurchases`). |
| `www/tests.html` | Browser test suite: validates colour/fusion rules and runs 200 seeds per config (1–10 targets) through replay validation, showing pass/fail counts and slowest generation time. |
| `www/README.md` | This file. |

## 12-Colour Wheel & Fusion Table

All fusion rules live in a single `FUSION_TABLE` object in `www/game.js` (order of parents does not matter):

- **Primaries**: Red (`#E53935` `●`), Yellow (`#FFD93B` `▲`), Blue (`#2F7DF6` `■`)
- **Secondaries**:
  - Red + Yellow → Orange (`#FF8A1F` `◆`)
  - Yellow + Blue → Green (`#2ECC71` `★`)
  - Blue + Red → Purple (`#8E44AD` `✚`)
- **Tertiaries** (cannot fuse further):
  - Red + Orange → Vermilion (`#FF5A36` `▼`)
  - Yellow + Orange → Amber (`#FFB020` `✕`)
  - Yellow + Green → Lime (`#A6D930` `≡`)
  - Blue + Green → Teal (`#1BB3A5` `○`)
  - Blue + Purple → Indigo (`#4B4BD6` `≈`)
  - Red + Purple → Magenta (`#D63384` `□`)

## How to Play

Open `www/index.html` in any modern browser or serve `www/` locally.

- **Same colour / empty** → top same-colour block flows over (up to free space).
- **Fusion pair** → one unit fuses with the destination's top unit into the resulting secondary or tertiary colour (destination height stays unchanged; works even on a full tube).
- **Anything else** (including pouring tertiaries onto different colours) → illegal; tubes shake.

Win by making every non-empty tube a full (4-unit) single colour matching the target palette (up to 10 targets and 14 tubes).

## Level Generator & Replay Validation

1. A **target palette** (1–10 colours) and empty tubes (up to 14 total tubes) are chosen by difficulty tier.
2. The **solved state** is built: one full tube per target colour plus empty tubes.
3. Strictly invertible **reverse moves** (`split` pours and `unfuse` of secondary/tertiary colours back into their two parent colours) scramble the state while recording the exact `forwardMoves` solution.
4. Every generated level is **validated by replaying** `forwardMoves` from the start state through `executePour` and verifying `checkWin`. If validation fails or the puzzle is trivial, the seed increments (`seed + 1`).
5. `par` starts as `forwardMoves.length` (an upper bound). For levels with **5 or fewer targets**, a capped BFS solver also runs and sets `par` to the shorter move count when it finishes.

## Solver & Hints

- Normalised-state BFS over compact 1-char-per-unit tube encodings with insertion-sorted canonical keys and parent pointers.
- Pruning: completed tubes locked, only first empty tube tried, no whole-uniform-tube moves to empty.
- Used for par tightening (≤ 5 targets) and hints (with recorded-path & greedy fallback for large 6–10 target boards).

## Tests

Open `www/tests.html` in a browser to run the automated test suite across 1–10 targets × 200 seeds (2,000 levels total) and verify rule integrity, pass/fail counts, and generation times (< 150 ms per level).

## URL Parameters

- `?level=NN` — jump to level NN
- `?seed=NNN` — force a specific PRNG seed

## Challenge Code Encoding

- `value = seed × 16 + (difficulty − 1)` (supporting 1–10 targets) → base-32 digits (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) → append checksum character (`HP-<payload><checksum>`).

## Capacitor

All web assets live under `www/` with `index.html` at its root. Ready for `npx cap sync`.
