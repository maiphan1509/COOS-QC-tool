# Mini Games — Playable Ads

17 HTML5 mini games built as interactive ad creatives. Every game ships in the same 4 formats as the sample creatives in this workspace (Popup, Side Rail, Premium Top Banner, Sticky Bottom Banner): 68 creatives in total, each with a `.zip` next to its folder.

Developed by Thanh Mai.

## Quick start

1. Open a terminal in the `HTML Interaction` root folder and start a static server:

   ```bash
   python3 -m http.server 8765
   ```

2. Open the gallery in a browser:

   ```
   http://localhost:8765/Mini%20Games/index.html
   ```

3. Stop the server with `Ctrl + C`.

In the Claude desktop app you can also start the `mini-games` configuration from `.claude/launch.json`, which runs the same command.

> The gallery has to be served over `http://`. Opened from `file://`, the browser blocks access to the iframes, so the event log and the Start / Force win buttons stop working. A single creative still works from `file://`.

## Gallery (`index.html`)

- **View by → Game**: pick one game to see all 4 formats.
- **View by → Format**: pick one format to see all 17 games.
- **Size**:
  - *Served (mobile)*: the size people actually see on a phone.
  - *Served ×2*: twice that size, easier to play with a mouse.
  - *Authored (ad.size)*: the creative's real size.
- **clickTag**: type a URL, then press *Reload all* to test click-through.
- **Buttons under each creative**:
  - *Start*: jump straight into the game.
  - *Force win*: skip to the win screen to check the CTA.
  - *Reload*: reload the creative.
  - *Open ↗*: open the creative in a new tab.
  - *Zip ↓*: download the zip.
- **Log line** under each creative shows the latest event: `start`, `end` (WIN/LOSE + score + time), `click`, `close`.

## Folder structure

```
Mini Games/
├── index.html                  Test gallery
├── README.md
├── Popup Banner/               PB-SM-300x250-<nn>-<game>-interactive/ + .zip
├── Side Rail/                  SR-LG-200x480-<nn>-<game>-interactive/ + .zip
├── Premium Top Banner/         BT-LG-1456x180-<nn>-<game>-interactive/ + .zip
├── Sticky Bottom Banner/       CF-LG-1456x180-<nn>-<game>-interactive/ + .zip
├── _src/MG-<nn>-<game>/        Source of each game (index.html + main.js) — EDIT HERE
├── _template/                  Shell to start a new game from
└── _tools/
    ├── build.py                Builds the 4 formats + zips from _src, updates the manifest
    ├── manifest.js             Creative list for the gallery (generated)
    └── smoke.js                Headless test: plays a game with random input, reports errors
```

Each creative folder holds only `index.html` and `main.js`. There are no images, fonts or external libraries; all art is drawn on canvas.

## Formats

| Folder | `ad.size` | Shown on mobile | `k` | Notes |
|---|---|---|---|---|
| Popup Banner | 300x250 | 300x250 | 1 | HUD is a row along the top |
| Side Rail | 200x480 | 100x240 | 2 | Two-row HUD, vertical play area |
| Premium Top Banner | 1456x180 | 430x53 | ≈3.39 | HUD is a column on the left, horizontal play area |
| Sticky Bottom Banner | 1456x180 | 430x53 | ≈3.39 | Same as Top Banner plus a close (×) button |

As with the samples' `--k`, each creative is laid out at the size shown on mobile and scaled up `k` times to match `ad.size`. Every game rearranges itself per format. For example, Mine Sweep uses a 9x8 grid in the popup, 5x8 in the side rail and 16x3 in the banners.

## Games

| # | Game | Genre |
|---|---|---|
| 01 | Hen Raiders | Chicken-fleet space shooter |
| 02 | Sling Smash | Slingshot vs. tower (physics) |
| 03 | Pixel Jumper | Side-scrolling platformer |
| 04 | Rail Rush | 3-lane endless runner |
| 05 | Block Burst | Drag-and-drop block puzzle |
| 06 | Line Drop | Falling tetromino puzzle |
| 07 | Mine Sweep | Minesweeper |
| 08 | Sky Flap | Tap to fly through gaps |
| 09 | Fruit Slash | Swipe to slice fruit |
| 10 | Brick Breaker | Paddle and ball brick breaker |
| 11 | Gem Swap | Match-3 |
| 12 | Stack Tower | Timing stack tower |
| 13 | Neon Snake | Snake |
| 14 | Merge Up | 2048-style number merge |
| 15 | Whack-a-Mole | Whack-a-mole |
| 16 | Hoop Flick | Basketball flick |
| 17 | Prize Drop | Peg-board prize drop |

A session lasts about 20–45 seconds and always has a time limit (`maxPlayMs`). Winning and losing both end on a screen with a CTA button. The intro screen has a *Skip to offer* link that goes straight to the landing page.

## Editing a game and rebuilding

1. Edit the files in `_src/MG-<nn>-<game>/`:
   - The `CONFIG` block at the top of `main.js` holds the offer, the win/lose titles, the score goal (`goal`) and the time limit (`maxPlayMs`).
   - `index.html` holds the title, the how-to line, the HUD and the colours (CSS variables `--accent`, `--bg`, `--cta-*`).
2. Rebuild from the `HTML Interaction` root folder:

   ```bash
   python3 "Mini Games/_tools/build.py"
   ```

   To build a single game, pass its slug, e.g. `mine-sweep`:

   ```bash
   python3 "Mini Games/_tools/build.py" mine-sweep
   ```

   A build overwrites that game's 4 folders and 4 zips. `manifest.js` (used by the gallery) is only updated by a full build.
3. Run the smoke test. It plays the game for 60 seconds with random taps and keys, and fails on any JS error, NaN drawing values, or a loop that keeps running after the end screen.

   ```bash
   node "Mini Games/_tools/smoke.js" "Mini Games/Side Rail/SR-LG-200x480-07-mine-sweep-interactive" 60
   ```

   For a folder in `_src`, add the format as the last argument: `popup`, `rail`, `strip` or `strip-close`.

   ```bash
   node "Mini Games/_tools/smoke.js" "Mini Games/_src/MG-07-mine-sweep" 60 strip
   ```

> Don't edit files directly in `Popup Banner/`, `Side Rail/` and the other format folders: the next build overwrites them.

**The "Developed by Thanh Mai" credit** under the Tap to play button is inserted into every creative by `build.py`. To change it, edit `CREDIT_HTML` in `_tools/build.py` and rebuild.

## Making a new game

1. Copy `_template/` to `_src/MG-18-<game-name>/`.
2. Update `CONFIG` (`eventPrefix: "mg-<game-name>"`, `api: "mg<GameName>"`, offer, goal…) and rewrite the `GAME` section of `main.js`.
   - Coordinates are in on-screen (served) pixels. Use `FORMAT` (`popup` / `rail` / `strip`), `WIDTH`, `HEIGHT` and `SAFE` (the play area not covered by the HUD) to lay the game out for each format.
   - Leave the SHELL / LOOP / LIFECYCLE / INPUT / BOOT sections unchanged.
3. Add a genre line for the game to `GENRES` in `_tools/build.py`.
4. Build and smoke test as above.

## Ad server integration

- **Click-through**: reads `?clickTag=<url>` from the creative's URL, falling back to `data-click-url` on the `#ad` element. Opens the link with `window.open(url, "_blank")`.
- **Events**: dispatched on `#ad` (bubbling) as `<eventPrefix>:start | end | click | close`, e.g. `mg-mine-sweep:end`, with `detail = { format, won, score, ms }`.
- **API**: `window.mg<Game>`, e.g. `window.mgMineSweep`, with `start()`, `end(won)`, `openOffer()`, `show()` and `hide()`.
- **Sticky Bottom**: the × button calls `hide()` and dispatches `close`. The host page should listen for this event to collapse the slot.
- **Size**: each folder is 37–84 KB and each zip 12–24 KB. Creatives make no external requests.
- **Performance**: the intro animation runs for at most 30 seconds, then stops until the ad is touched. The end screen stops the loop after about 2.5 seconds. Everything pauses while the tab is hidden.

## Notes

- In the Top/Sticky Banners on mobile (430x53), characters are quite small, especially in Sling Smash and Hoop Flick. On desktop (1456x180) they read clearly.
- Hoop Flick, Prize Drop and Mine Sweep quietly help the player (the ball is nudged toward the target; the first mine dug is forgiven). Each assist is commented in the code, the same way the sample tank duel discloses its own.
- Game names, characters and brands are all made up; no real trademarks are used.
