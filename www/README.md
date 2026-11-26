# Hue Pour

A mobile-first, portrait-only liquid-sort puzzle game where colours **blend**.

## Files

| File | Purpose |
|------|---------|
| `www/index.html` | Entry point. Loads CSS & JS, defines the DOM skeleton. |
| `www/style.css` | All styling: dark theme, glass tubes, animations, overlays, responsive breakpoints. |
| `www/game.js` | **Pure game logic** — no DOM, no UI. Exports colours, pour rules, solver, and level generator. |
| `www/ui.js` | UI layer — rendering, touch handling, pour/fuse animations, WebAudio sound, haptics, settings, save/load. |

## How to play

Open `www/index.html` in any modern browser.  Tap a tube to select it, then tap a destination tube to pour.

- **Same colour / empty** → liquid flows over (up to free space).
- **Fusion pair** (Red+Yellow → Orange, Yellow+Blue → Green, Red+Blue → Purple) → one unit fuses into the destination's top, changing its colour.  Works even when the tube is full.
- **Anything else** → illegal; tubes shake.

Win by making every non-empty tube a full (4-unit) single colour that matches the target palette.

## URL parameters

- `?level=NN` — jump to level NN
- `?seed=NNN` — force a specific PRNG seed

## Level generator

1. A **target palette** is chosen based on difficulty tier (1 colour for levels 1-5, 2 for 6-15, 3 for 16+).
2. The **solved state** is built: one full tube per target colour plus 1-2 empty tubes.
3. The solved state is **scrambled** by applying random *reverse* moves:
   - **Reverse pour**: shift units between tubes.
   - **Reverse fusion**: split a secondary-colour unit back into its two primaries on separate tubes.
4. The scrambled state is **verified** with a BFS solver (normalised state hashing, ≤ 200 k nodes). If unsolvable, the seed increments and step 3 repeats.
5. The solver's shortest path length becomes **par**.

The PRNG is **Mulberry32** — deterministic for a given `(levelNum, seed)` pair.

## Solver

- Breadth-first search over all legal forward pours.
- States are hashed by sorting tube contents (tube ordering is irrelevant to solvability), so permutations of the same tube set share one visited-set entry.
- Pruning: completed tubes are never poured from; only the first empty tube is tried as a destination; moving an entire uniform tube to an empty tube is skipped.
- The node cap (default 200 k) prevents the solver from running indefinitely on hard layouts.

## Capacitor

The project is set up for Capacitor. All web assets live under `www/` with `index.html` at its root.
