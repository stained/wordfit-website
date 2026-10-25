# Word Fit website

The game's site, https://wordfit.tfinn.co.za (source: https://github.com/stained/wordfit-website; the game: https://github.com/stained/word-fit): a static site in the game's own look (Fredoka, cream letter tiles, white word chips, candy buttons that press down, and the backdrop's gradients: the menu's, and one per difficulty), with the Night Sky theme's ink as the paper in dark mode. Each section's label is a word chip with its length beside it, as the game lists Symbols words.

Requires Node.js 22 or later. No dependencies.

```sh
npm run dev                     # builds, then serves dist/ at http://127.0.0.1:4173
npm run build                   # renders every page into dist/
npm run check                   # every local link, image and font resolves; every page has metadata; no file over 25 MiB
npm run export-game             # the game's data, art, sounds and font, from ../wordpuzzle (or $WORDFIT): needs godot, cwebp, ffmpeg and sips
npm run export-game -- --shots  # the screenshots too: the game runs for each (tools/capture.sh opens a window)
```

## Pages

- `/`: the logo in tiles over the menu's gradient with letters drifting up it, as in the game; **Try one**, a small Easy puzzle to play in the page (below); how it plays; the four modes (with the menu and a result card); the four difficulties, each in its own gradient, with what makes it different; English, Afrikaans and Symbols; the Shop's themes (their decorations, tiles and prices) and three of them in play; bigger grids on bigger screens; and the way to the downloads. The trailer goes under "How it plays" once it has a YouTube id (`trailer.youtube`).
- `/downloads/`: iPhone and iPad, and Android (store links), and Mac, Windows and Linux (zips on MEGA, as Snoek'em's and Coldshift's), each "Coming soon" until it has a `url`.
- `/support/`, `/credits/`, `/privacy/`, `404.html`, `sitemap.xml`, `robots.txt`.

The pages are templates in `scripts/build.mjs`; the styles are `public/styles.css`, and `public/app.js` adds the phone menu, the Sound and Music switches, the trailer's player and Try one. The site works without JavaScript, except Try one, which says so.

## Try one

Twelve small puzzles, four each in English, Afrikaans and Symbols, made by the game's own generator (`PuzzleGenerator.generate` at Easy on a phone's 12 × 12, so 7 or 8 squares a side, with two words placed), with each Symbols puzzle's own cipher (`Symbols.cipher`). They're in `src/game.json` and go into the home page as JSON. It plays as the game does: drag a word into the grid (a finger's word floats above it), or tap a word and then a square; tap a placed word twice, or drag it off, to take it back; a word dropped on a placed one swaps it out; crossings that disagree turn red; any consistent fill solves it. Stars are for clashes: none is three. The game's own sounds play for picking up, placing, a clash and the solve.

## Content

- `src/game.json`, `src/media.json`, `public/assets/game/`, `public/fonts/`: exported from the game, never edited by hand. `scripts/export-game.mjs` runs `scripts/export-game.gd` in headless Godot against the game: its version, the modes, difficulties and themes in the game's own English (`Loc`), the difficulties' and themes' colours, the generator's settings, the word lists' sizes, the coins, and the puzzles. Then the app icon (favicons), TFINN's badge as the game draws it, the game's three sprite sheets (icons, the themes' decorations, the symbols; cut by CSS, trimmed as the game trims them), five sounds and the menu music as mp3, Fredoka and its licence. With `--shots`, the screenshots: the game itself, launched with its test options (`--demo`, `--theme`, `--screen`…) through its `tools/capture.sh`, phones at 600 × 1300 (the main screen is 1440 high: a taller window is shrunk by the system and the shot comes out cropped) and the computer's window at 1280 × 820; the movie writer's stray alpha is dropped. The shared-link picture is the computer's window cut to 1200 × 630.
- `src/content.json`: the site's own copy: the pitch, how it plays, the languages, the downloads (a version, a checksums link, and per build its file, size, MEGA or store `url`, sha256, a note and install steps; an empty `url` shows "Coming soon"), the questions, the studio's details (TFINN, tfinn.co.za, support@tfinn.co.za, as on the other games' sites) and the credits.

A new version of the game: `npm run export-game -- --shots`, then the downloads in `content.json` (sizes and sha256 from the build's `SHA256SUMS.txt` in TFINN's `tfinn-game-builds/Word Fit/<version>/`). A rebuilt file that replaces one in that MEGA-synced folder (a new build of the same version keeps the zips' names) gets a new MEGA node, and its old share link stops working: make new links once MEGAsync has uploaded it, and change each `url` (and `checksums`) here. MEGA's API gives each link's size (`POST https://g.api.mega.co.nz/cs` with `[{"a":"g","p":"<file id>"}]`), which tells the links apart and shows whether one serves the new build.

## Privacy

No cookies, analytics, tracking or third-party requests: the fonts, pictures and sounds are served from here, and Try one runs in the page. Once there's a trailer, it shows our own picture until it's pressed, then loads YouTube's privacy-enhanced player (youtube-nocookie.com). The Sound switch (the game's button tap on hover and press, and Try one's sounds; on) and Music switch (the game's menu music, carried across pages; off) are remembered for the tab in session storage. The privacy page also covers the game: no accounts, ads or analytics, and no internet use at all. Keep it in step with the game.

## Cloudflare Pages

The Pages project `wordfit-website` is connected to this repository through its Git integration, as Coldshift Racing's is, so every push to `main` goes live (about a minute):

- Production branch: `main`
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION` = `22`
- Custom domain: `wordfit.tfinn.co.za`, a proxied CNAME to `wordfit-website.pages.dev` that Pages added (the `tfinn.co.za` zone is in the same Cloudflare account; its wildcard `*.tfinn.co.za` record stays, and this name takes precedence over it). Also at https://wordfit-website.pages.dev.

The pages ask for `styles.css` and `app.js` by a hash of their contents (`?v=`), so a change shows at once. GitHub Actions (`.github/workflows/check.yml`) builds and checks every push and pull request.
