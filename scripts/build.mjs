// Renders every page into dist/: the templates are here, the copy in src/content.json, and the game's own data
// (its words for the modes, difficulties and themes, its colours, and the puzzles for "Try one", made by its own
// generator) in src/game.json, with its art, sounds and screenshots in src/media.json (npm run export-game).
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const c = JSON.parse(await readFile('src/content.json', 'utf8'));
const game = JSON.parse(await readFile('src/game.json', 'utf8'));
const media = JSON.parse(await readFile('src/media.json', 'utf8'));
const shots = media.shots;
if (!shots.drag) throw new Error('No screenshots in src/media.json: run npm run export-game -- --shots');

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const url = p => '/' + p;
const ext = (href, label, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}" rel="noopener">${label}</a>`;
const img = (pic, alt = '', cls = '', eager = false) => pic ? `<img${cls ? ` class="${cls}"` : ''} src="${url(pic.src)}" width="${pic.width}" height="${pic.height}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'}>` : '';
const button = (href, label, kind = '') => `<a class="button${kind ? ' ' + kind : ''}" href="${href}">${label}</a>`;
const list = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

// The stylesheet's and the script's addresses carry a hash of what's in them, so a browser that kept the old ones
// fetches them again when they change.
const version = async file => createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 10);
const styles = `/styles.css?v=${await version('public/styles.css')}`;
const script = `/app.js?v=${await version('public/app.js')}`;

// A cell of one of the game's sprite sheets, as CSS: the sheet is `grid` × `grid`, and `inset` (a share of a cell)
// is trimmed off each edge, past the glow round each picture, as the game trims it.
const SHEETS = { icons: [4, 0.06], decor: [4, 0.04], symbols: [6, 0.03] };
const ICONS = ['settings', 'hint', 'coin', 'star', 'star_empty', 'flame', 'sound', 'sound_off', 'music', 'music_off', 'vibrate', 'trophy', 'clock', 'calendar', 'sparkle', 'info'];
const sprite = (sheet, i) => {
  const [grid, inset] = SHEETS[sheet];
  const scale = grid / (1 - 2 * inset);
  const at = n => (((n + inset) * scale / grid) / (scale - 1) * 100).toFixed(3);
  return `background-image:url(/${media.sheets[sheet].src});background-size:${(scale * 100).toFixed(2)}%;background-position:${at(i % grid)}% ${at(Math.floor(i / grid))}%`;
};
const icon = (name, cls = '') => `<i class="sprite${cls ? ' ' + cls : ''}" style="${sprite('icons', ICONS.indexOf(name))}" aria-hidden="true"></i>`;

// Letters as the game's tiles; a word's tiles in a row.
// Words with spaces wrap between words, never inside one.
const tiles = (text, cls = '') => `<span class="tiles${cls ? ' ' + cls : ''}" aria-hidden="true">${text.split(' ').map(word => `<span class="tile-word">${[...word].map(ch => `<span class="tile">${esc(ch)}</span>`).join('')}</span>`).join('')}</span>`;
// A section's label: a word chip from the game's list, with its length beside it, as Symbols puzzles list them.
const label = word => `<p class="label"><b>${word.length}</b>${esc(word)}</p>`;
const heading = (word, title, lede = '') => `<header class="page-head">${label(word)}<h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
const phone = (pic, alt, cls = '') => `<figure class="phone${cls ? ' ' + cls : ''}"><div class="screen">${img(pic, alt)}</div></figure>`;

const nav = [['', 'Home'], ['#try', 'Try one'], ['downloads/', 'Download'], ['support/', 'Support']];

function layout(route, { title, description, body, image = shots.share.src, noindex = false, look = 'menu' }) {
  const full = title ? `${title} | ${c.site.name}` : `${c.site.name}: ${c.site.tagline}`;
  const canonical = `${c.site.url}/${route}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(c.site.name)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${c.site.url}/${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${game.menu[0]}">
<link rel="icon" href="/assets/game/brand/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/game/brand/icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/Fredoka.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="${styles}">
<script src="${script}" defer></script>
</head>
<body class="look-${look}">
<a class="skip" href="#main">Skip to the page</a>
<header class="site-head">
  <div class="shell head-row">
    <a class="brand" href="/" aria-label="${esc(c.site.name)}, home">${img(media.icon, '', 'brand-icon', true)}${tiles('WORD FIT', 'small')}</a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      ${nav.map(([href, name]) => `<a href="/${href}"${href && !href.startsWith('#') && route.startsWith(href) || (href === '' && route === '') ? ' aria-current="page"' : ''}>${name}</a>`).join('\n      ')}
    </nav>
    <div class="switches">
      <button class="switch sfx" type="button" aria-pressed="true" data-src="/${media.audio.tap}" title="The game's sounds, on buttons and in Try one">${icon('sound')}<span class="word">Sound</span> <b>On</b></button>
      <button class="switch music" type="button" aria-pressed="false" data-src="/${media.audio.music}" title="The game's menu music, off until you turn it on">${icon('music')}<span class="word">Music</span> <b>Off</b></button>
    </div>
    <a class="button small head-cta" href="/downloads/">Get the game</a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="shell foot-row">
    <a class="studio" href="${esc(c.contact.studioUrl)}" rel="noopener">${img(media.tfinn, c.contact.studio)}<span><strong>A ${esc(c.contact.studio)} production</strong><small>${esc(c.contact.company)}</small></span></a>
    <div>
      <nav aria-label="More">
        <a href="/credits/">Credits</a><a href="/privacy/">Privacy</a>
      </nav>
      <p class="small">Made in Knysna, South Africa. &copy; 2026 ${esc(c.contact.company)}. <a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></p>
      <p class="small dim">No cookies, no tracking.</p>
    </div>
  </div>
</footer>
</body>
</html>
`;
}

const builds = c.downloads.builds;
const status = b => b.url ? (b.store || 'Free download') : 'Coming soon';
// The platforms as a row of chips: each links to its download, dimmed until it has one.
const chips = () => `<ul class="chips">${builds.map(b => `<li${b.url ? '' : ' class="soon"'}><a href="/downloads/#${b.id}" title="${esc(status(b))}">${esc(b.platform)}</a></li>`).join('')}<li class="free">${builds.some(b => b.url) ? 'Free' : 'Free · coming soon'}</li></ul>`;

// ---- Home

// Letters drifting up the hero, as they drift up the game's backdrop.
const DRIFT = 'WORDFITPLAYGRIDS';
const drift = `<div class="drift" aria-hidden="true">${[...DRIFT].map((ch, i) => `<span style="--x:${(i * 61) % 100}%;--d:${14 + (i * 7) % 11}s;--delay:-${(i * 3.7) % 20}s;--s:${0.7 + (i % 4) * 0.2}">${ch}</span>`).join('')}</div>`;

const trailer = c.trailer.youtube
  ? `<a class="trailer" href="https://www.youtube.com/watch?v=${esc(c.trailer.youtube)}" rel="noopener" data-youtube="${esc(c.trailer.youtube)}" data-title="${esc(c.site.name)}: the trailer">${img(shots.desktop, '')}<span class="play-icon" aria-hidden="true"></span><span class="trailer-label">${esc(c.trailer.title)}<small>Plays from YouTube</small></span></a>`
  : '';

// The puzzles for Try one, as the game's generator made them, and what app.js needs to draw them.
const tryData = {
  puzzles: game.puzzles,
  symbols: { sheet: url(media.sheets.symbols.src), grid: SHEETS.symbols[0], inset: SHEETS.symbols[1] },
  audio: Object.fromEntries(['pickup', 'place', 'clash', 'solve'].map(k => [k, url(media.audio[k])])),
};
const LANGS = c.languages;

const difficultyFacts = d => [
  `${d.grid}% of the grid`,
  d.starters ? `${d.starters} word${d.starters > 1 ? 's' : ''} placed for you` : 'No words placed',
  d.grouped ? 'List grouped by length' : 'One long list',
  ...(d.decoys ? [`${d.decoys} decoys that fit nowhere`] : []),
];

const themeCard = t => `<li class="theme" style="--top:${t.palette[0] || game.menu[0]};--bottom:${t.palette[1] || game.menu[1]};--face:${t.tile[0]};--edge:${t.tile[1]};--ink:${t.tile[2]}">
        <div class="theme-art">${t.decor.length ? t.decor.map(i => `<i class="sprite" style="${sprite('decor', i)}"></i>`).join('') : game.difficulties.map(d => `<i class="swatch" style="background:linear-gradient(160deg,${d.colours[0]},${d.colours[1]})"></i>`).join('')}${tiles('ABC', 'theme-tiles')}</div>
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.text)}</p>
        <p class="price">${t.price ? `${icon('coin', 'inline')}${t.price}` : 'Free'}</p>
      </li>`;

const home = `<section class="hero">
  ${drift}
  <div class="shell hero-row">
    <div class="hero-copy">
      <h1 class="logo" aria-label="${esc(c.site.name)}">${tiles('WORD')}${tiles('FIT')}</h1>
      <p class="pitch">${esc(c.site.pitch)}</p>
      <p class="hero-text">${esc(c.hero)}</p>
      <p class="actions">${button('/downloads/', 'Get the game')}${button('#try', 'Try one here', 'light')}</p>
      ${chips()}
    </div>
    ${phone(shots.drag, 'Word Fit on a phone: a word being dragged into the grid, the rest of the words listed below it', 'hero-phone')}
  </div>
</section>

<section class="band look-medium try" id="try" aria-labelledby="try-title">
  <div class="shell">
    ${label('TRY')}
    <h2 id="try-title">Try one</h2>
    <p class="lede">A small Easy puzzle, made by the game's own generator. Drag each word into the grid, or tap a word and then a square. Two are placed for you.</p>
    <div class="play card" data-play>
      <div class="play-bar">
        <div class="lang-tabs" role="group" aria-label="Language">${LANGS.map((l, i) => `<button type="button" data-lang="${l.id}" aria-pressed="${i === 0}">${esc(l.name)}</button>`).join('')}</div>
        <p class="play-status" aria-live="polite"><span data-left>Words to place</span> <span class="clock" data-clock>0:00</span></p>
      </div>
      <div class="play-body">
        <div class="board-wrap"><div class="board" data-board role="group" aria-label="The puzzle's grid"></div></div>
        <div class="bank" data-bank role="group" aria-label="The words to place"></div>
      </div>
      <p class="play-actions"><button class="button small light" type="button" data-new>Another puzzle</button><button class="button small ghost" type="button" data-reset>Start again</button></p>
      <div class="solved" data-solved hidden>
        <div class="solved-card">
          <p class="solved-title">Solved!</p>
          <p class="stars" data-stars aria-hidden="true">${icon('star')}${icon('star')}${icon('star')}</p>
          <p data-summary></p>
          <p class="actions">${button('/downloads/', 'Get the game')}<button class="button light" type="button" data-again>Another one</button></p>
        </div>
      </div>
      <noscript><p class="noscript">Turn on JavaScript to play one here, or <a href="/downloads/">get the game</a>.</p></noscript>
    </div>
    <script type="application/json" id="try-data">${JSON.stringify(tryData).replace(/</g, '\\u003c')}</script>
  </div>
</section>

<section class="band paper" aria-labelledby="how-title">
  <div class="shell">
    ${label('HOW')}
    <h2 id="how-title">How it plays</h2>
    <ol class="how">
      ${c.how.map((h, i) => `<li class="card"><span class="step">${i + 1}</span>${icon(h.icon, 'big')}<h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></li>`).join('\n      ')}
    </ol>
    ${trailer}
  </div>
</section>

<section class="band paper modes-band" aria-labelledby="modes-title">
  <div class="shell split">
    <div>
      ${label('MODES')}
      <h2 id="modes-title">Four ways to play</h2>
      <ul class="modes">
        ${game.modes.map(m => `<li class="card mode">${icon(c.modeIcons[m.id], 'big')}<div><h3>${esc(m.name)}</h3><p>${esc(/[.!?]$/.test(m.text) ? m.text : m.text + '.')}</p></div></li>`).join('\n        ')}
      </ul>
      <p class="small">Puzzles never run out: Classic numbers its levels, and every one is made from its own seed, so a level is the same puzzle on every device.</p>
    </div>
    <div class="phone-pair">
      ${phone(shots.menu, 'The game\'s menu: the difficulties, the daily puzzle, Zen, Classic, Time Attack and the Shop')}
      ${phone(shots.result, 'A solved puzzle: three stars, the score worked out and coins earned')}
    </div>
  </div>
</section>

<section class="band" aria-labelledby="levels-title">
  <div class="shell">
    ${label('LEVELS')}
    <h2 id="levels-title">Four difficulties that really play differently</h2>
    <p class="lede">Not just bigger grids. Easy and Medium can always be solved by logic alone; Hard and Expert are built so you'll have to try a word and see.</p>
    <ul class="levels">
      ${game.difficulties.map(d => `<li class="level" style="--top:${d.colours[0]};--bottom:${d.colours[1]}"><h3>${esc(d.name)}</h3><p>${esc(d.text)}</p><ul>${difficultyFacts(d).map(f => `<li>${esc(f)}</li>`).join('')}</ul></li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="band look-easy" aria-labelledby="words-title">
  <div class="shell">
    ${label('WORDS')}
    <h2 id="words-title">English, Afrikaans, or no letters at all</h2>
    <ul class="languages">
      ${LANGS.map(l => `<li>${phone(shots[l.shot], `A ${l.name} puzzle in the game`)}<h3>${esc(l.name)}</h3><p>${esc(l.text)}</p></li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="band paper" aria-labelledby="shop-title">
  <div class="shell">
    ${label('SHOP')}
    <h2 id="shop-title">Spend your coins on a new look</h2>
    <p class="lede">Every puzzle you solve earns coins: ${game.coins.base} for the solve, ${game.coins.perStar} more for each star, and ${game.coins.daily} extra for the daily puzzle. Spend them on hints, or on themes with their own backgrounds, tiles and music.</p>
    <ul class="themes">
      ${game.themes.map(themeCard).join('\n      ')}
    </ul>
    <ul class="phones">
      ${['ocean', 'night', 'candy'].map(k => `<li>${phone(shots[k], `A puzzle with the ${game.themes.find(t => t.id === k).name} theme`)}</li>`).join('')}
    </ul>
  </div>
</section>

<section class="band look-hard" aria-labelledby="big-title">
  <div class="shell">
    ${label('BIGGER')}
    <h2 id="big-title">Bigger grids on bigger screens</h2>
    <p class="lede">On a phone, puzzles go up to ${game.grids.phone.join(' × ')}. On an iPad or a computer they go up to ${game.grids.tablet.join(' × ')}, with up to seventy words.</p>
    <figure class="computer">${img(shots.desktop, 'A Hard puzzle in the game on a computer: a large grid beside its word list')}</figure>
  </div>
</section>

<section class="finale" aria-labelledby="finale-title">
  ${drift}
  <div class="shell finale-copy">
    ${tiles('MAKE IT FIT', 'finale-tiles')}
    <h2 id="finale-title" class="sr-only">Make it fit</h2>
    <p>Free, on phones, tablets and computers. No ads, no account, and no internet needed.</p>
    <p class="actions">${button('/downloads/', 'Get the game')}${button('#try', 'Try one first', 'light')}</p>
    ${chips()}
  </div>
</section>`;

// ---- Downloads, credits, support, privacy, 404

// Plain outlines of a phone and a computer: no makers' logos.
const DEVICE = {
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M1 20h22M9 16l-1 4m7-4 1 4"/>',
};
const buildCard = b => `<li class="card build${b.url ? '' : ' soon'}" id="${b.id}">
      <svg class="device" viewBox="0 0 24 24" aria-hidden="true">${DEVICE[b.kind]}</svg>
      <h2>${esc(b.platform)}</h2>
      <p class="meta">${esc(b.detail)}</p>
      ${b.url ? `<p>${ext(b.url, b.store ? `Get it on ${esc(b.store)}` : `Download${b.size ? ` (${esc(b.size)})` : ''}`, 'button')}</p>
      ${b.file ? `<p class="mono small">${esc(b.file)}${b.sha256 ? `<br>SHA-256 ${esc(b.sha256)}` : ''}</p>` : ''}
      ${b.note ? `<p class="small">${esc(b.note)}</p>` : ''}
      ${b.steps?.length ? `<details><summary>How to install</summary><ol class="steps">${b.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>` : ''}` : '<p class="tag">Coming soon</p>'}
    </li>`;
const downloads = `<div class="shell page">
  <div class="dl-head">
    <div>
      ${heading('GET', 'Get the game', `Word Fit is free, for phones, tablets and computers${c.downloads.version ? `: version ${esc(c.downloads.version)}` : ''}. No ads, no account, and no internet needed.`)}
      <p class="actions">${button('#phones', 'Phones and tablets')}${button('#computers', 'Computers', 'light')}</p>
    </div>
    <div class="phone-pair" aria-hidden="true">${phone(shots.ocean, '')}${phone(shots.symbols, '')}</div>
  </div>
  <h2 class="group" id="phones">Phones and tablets</h2>
  <ul class="builds">${builds.filter(b => b.kind === 'phone').map(buildCard).join('')}</ul>
  <h2 class="group" id="computers">Computers</h2>
  <ul class="builds">${builds.filter(b => b.kind === 'desktop').map(buildCard).join('')}</ul>
  <p class="small dim">The computer builds are zips hosted on MEGA${c.downloads.checksums ? `, with ${ext(c.downloads.checksums, 'their checksums')}` : ''}.${builds.some(b => b.kind === 'desktop' && b.url) ? ' Or <a href="/#try">try one here</a> first.' : ' Until they\'re up, <a href="/#try">try one here</a>.'}</p>
</div>`;

const credits = `<div class="shell page narrow">
  ${heading('CREDITS', `A ${esc(c.contact.studio)} production`)}
  <p>Game and website by ${esc(c.contact.studio)} (${esc(c.contact.company)}), made in Knysna. ${ext(c.contact.studioUrl, esc(c.contact.studioUrl.replace(/^https:\/\//, '')))} / <a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></p>
  <ul class="credits">
    ${c.credits.map(cr => `<li><b>${cr.url ? (cr.url.includes('://') ? ext(cr.url, esc(cr.name)) : `<a href="/${esc(cr.url)}">${esc(cr.name)}</a>`) : esc(cr.name)}</b><span>${esc(cr.what)}</span></li>`).join('\n    ')}
  </ul>
  <p class="small">The word lists are derived from FrequencyWords by Hermit Dave (OpenSubtitles 2018 data; P. Lison and J. Tiedemann, 2016) and Afrikaans Wikipedia word frequencies, filtered with Hunspell, SCOWL and LDNOOBW, and are licensed ${ext('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0')}. The game's code and art are TFINN's own.</p>
</div>`;

const support = `<div class="shell page support">
  ${heading('HELP', 'Help and questions', 'The questions people ask most, and how to reach us when something goes wrong.')}
  <div class="support-row">
    <div class="faq">${c.faq.map(([q, a], i) => `<details class="card"${i ? '' : ' open'}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
    <aside class="help">
      ${phone(shots.shop, 'The Shop in the game: the themes and their prices in coins')}
      <section class="card"><h2>Something wrong?</h2><p>Email <a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a> with your device's model, the game's version (Settings, About) and what happened. A screenshot helps.</p></section>
    </aside>
  </div>
</div>`;

const privacy = `<div class="shell page narrow prose">
  ${heading('PRIVACY', 'Privacy policy', `Effective ${esc(c.contact.effective)}; updated ${esc(c.contact.updated)}.`)}
  <p>Word Fit is made by ${esc(c.contact.studio)} (${esc(c.contact.company)}), an independent studio in South Africa, which is responsible for this policy. It covers the game on every platform, and this website.</p>
  <h2>The game</h2>
  <p>Word Fit has no accounts, no ads, no analytics and no tracking, and it doesn't collect or send any personal information. It doesn't use the internet at all: puzzles are made on your device. Your progress, coins, themes and settings stay on your device, and uninstalling the game removes them.</p>
  <h2>This website</h2>
  <p>No cookies, no analytics, and no third-party requests${c.trailer.youtube ? ' until you press play on the trailer' : ''}: the fonts, pictures and sounds are served from here, and the puzzle you can try here is played entirely in your browser.${c.trailer.youtube ? ' The trailer shows our own picture until it\'s pressed; then YouTube\'s privacy-enhanced player loads from youtube-nocookie.com, under YouTube\'s privacy policy.' : ''} The Sound and Music switches in the header are remembered by your browser for the tab only (session storage), and never leave your device. The site is hosted on Cloudflare Pages, whose servers handle each request (including your IP address) to deliver the page, under Cloudflare's privacy policy.</p>
  <h2>Children</h2>
  <p>The game is suitable for all ages and collects nothing from anyone, children included.</p>
  <h2>Contact</h2>
  <p>Questions about this policy: <a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a>. If it changes, the new version is posted here with its date.</p>
</div>`;

const notFound = `<div class="shell page narrow lost">
  ${heading('LOST', `${tiles('404')}<span class="sr-only">404</span>`, 'That page doesn\'t fit anywhere. Try another word.')}
  <p class="actions">${button('/', 'Back to the start')}${button('/#try', 'Try one', 'light')}</p>
</div>`;

// ---- Write

const pages = [
  ['', { description: c.site.description, body: home }],
  ['downloads/', { title: 'Download', description: `Get Word Fit, free, for ${list(builds.map(b => b.platform))}.`, body: downloads, look: 'paper' }],
  ['support/', { title: 'Support', description: 'Help with Word Fit: moving words, coins, hints, the daily puzzle, Symbols, and how to reach us.', body: support, look: 'paper' }],
  ['credits/', { title: 'Credits', description: 'Who and what made Word Fit.', body: credits, look: 'paper' }],
  ['privacy/', { title: 'Privacy', description: 'Word Fit collects no personal information: no accounts, ads, analytics or tracking, and it works offline.', body: privacy, look: 'paper' }],
];

await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
for (const [route, page] of pages) {
  await mkdir(path.join('dist', route), { recursive: true });
  await writeFile(path.join('dist', route, 'index.html'), layout(route, page));
}
await writeFile('dist/404.html', layout('404.html', { title: 'Not found', description: 'This page is not here.', body: notFound, noindex: true, look: 'paper' }));
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter(([, p]) => !p.noindex).map(([r]) => `  <url><loc>${c.site.url}/${r}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${c.site.url}/sitemap.xml\n`);
console.log(`Built ${pages.length + 1} pages into dist/, with ${Object.values(game.puzzles).flat().length} puzzles to try.`);
