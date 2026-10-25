// The game's data, art, sounds, font and screenshots, from ../wordpuzzle (or $WORDFIT), into src/game.json,
// src/media.json, public/assets/game/ and public/fonts/. Nothing it writes is edited by hand.
//   npm run export-game            the data, art, sounds and font
//   npm run export-game -- --shots the screenshots as well: the game is run for each (it opens a window)
// Needs godot, cwebp, ffmpeg and sips (macOS).
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, copyFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = path.resolve(root, process.env.WORDFIT || '../wordpuzzle');
const out = path.join(root, 'public/assets/game');
const shots = process.argv.includes('--shots');
for (const dir of ['brand', 'sheets', 'audio', 'shots']) await mkdir(path.join(out, dir), { recursive: true });
await mkdir(path.join(root, 'public/fonts'), { recursive: true });

const size = file => {
  const text = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  return { width: Number(/pixelWidth: (\d+)/.exec(text)[1]), height: Number(/pixelHeight: (\d+)/.exec(text)[1]) };
};
// A picture as webp, at most `width` wide; the game's screenshots carry a stray alpha channel from the movie
// writer, so theirs is dropped.
const webp = (src, name, width, { quality = 82, opaque = false } = {}) => {
  const file = path.join(out, name);
  execFileSync('cwebp', ['-quiet', '-q', String(quality), ...(opaque ? ['-noalpha'] : ['-alpha_q', '90']), ...(width < size(src).width ? ['-resize', String(width), '0'] : []), src, '-o', file]);
  return { src: `assets/game/${name}`, ...size(file) };
};

// The data: the game's own generator, word lists and words (scripts/export-game.gd).
const data = path.join(root, 'src/game.json');
execFileSync('godot', ['--headless', '--path', game, '-s', path.join(root, 'scripts/export-game.gd'), '--', data], { stdio: 'ignore' });
const exported = JSON.parse(await readFile(data, 'utf8'));
console.log(`game.json: Word Fit ${exported.version}, ${Object.values(exported.puzzles).flat().length} puzzles`);

// The brand: the app icon (favicons, the manifest's) and TFINN's badge as the game draws it.
const icon = path.join(game, 'assets/art/app_icon.png');
for (const px of [180, 192, 512]) execFileSync('sips', ['-z', String(px), String(px), icon, '--out', path.join(out, `brand/icon-${px}.png`)], { stdio: 'ignore' });
const media = {
  icon: webp(icon, 'brand/icon.webp', 256),
  tfinn: webp(path.join(game, 'assets/brand/tfinn.png'), 'brand/tfinn.webp', 256),
  // The game's sprite sheets, used whole and cut by CSS: icons 4 × 4, the themes' decorations 4 × 4, symbols 6 × 6.
  sheets: {
    icons: webp(path.join(game, 'assets/art/icons.png'), 'sheets/icons.webp', 512),
    decor: webp(path.join(game, 'assets/art/decor.png'), 'sheets/decor.webp', 512),
    symbols: webp(path.join(game, 'assets/art/symbols.png'), 'sheets/symbols.webp', 576),
  },
  audio: {},
  shots: {},
};

// The sounds: the menu's tap, picking up and placing a word, a clash and the solve, and the menu's music.
for (const [name, from, rate] of [['tap', 'sfx/tap', '96k'], ['pickup', 'sfx/pickup', '96k'], ['place', 'sfx/place', '96k'], ['clash', 'sfx/clash', '96k'], ['solve', 'sfx/solve', '96k'], ['music', 'music/menu', '112k']]) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(game, `assets/audio/${from}.ogg`), '-ac', name === 'music' ? '2' : '1', '-b:a', rate, path.join(out, `audio/${name}.mp3`)]);
  media.audio[name] = `assets/game/audio/${name}.mp3`;
}

await copyFile(path.join(game, 'assets/fonts/Fredoka.ttf'), path.join(root, 'public/fonts/Fredoka.ttf'));
await copyFile(path.join(game, 'assets/fonts/Fredoka-OFL.txt'), path.join(root, 'public/fonts/Fredoka-OFL.txt'));

// The screenshots, from the game itself (tools/capture.sh): phones at 600 × 1300 (a taller window than the screen
// would be shrunk by the system, and the shot cropped), and a computer's window.
const PHONE = '600x1300';
// FRAMES is how long the game runs first (at 10 a second); the result card needs the puzzle solved and counted.
const SHOTS = [
  ['menu', PHONE, ['--device=phone']],
  ['drag', PHONE, ['--device=phone', '--mode=classic', '--difficulty=1', '--seed=4242', '--demo=6', '--demo-drag']],
  ['afrikaans', PHONE, ['--device=phone', '--mode=classic', '--difficulty=0', '--seed=31', '--language=af', '--demo=5']],
  ['symbols', PHONE, ['--device=phone', '--mode=classic', '--difficulty=0', '--seed=77', '--language=sym', '--demo=4']],
  ['ocean', PHONE, ['--device=phone', '--mode=zen', '--difficulty=2', '--seed=900', '--theme=ocean', '--demo=7']],
  ['night', PHONE, ['--device=phone', '--mode=attack', '--difficulty=1', '--seed=55', '--theme=night', '--demo=5']],
  ['candy', PHONE, ['--device=phone', '--mode=classic', '--difficulty=1', '--seed=808', '--theme=candy', '--demo=6']],
  ['result', PHONE, ['--device=phone', '--mode=classic', '--difficulty=1', '--seed=4242', '--demo-result'], 66],
  ['shop', PHONE, ['--device=phone', '--screen=shop', '--coins=640']],
  ['desktop', '1280x820', ['--device=desktop', '--mode=classic', '--difficulty=2', '--seed=2026', '--demo=12']],
];
const shotsFile = path.join(root, 'src/media.json');
const before = existsSync(shotsFile) ? JSON.parse(await readFile(shotsFile, 'utf8')).shots : {};
if (shots) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'wordfit-shots-'));
  for (const [name, res, args, frames = 30] of SHOTS) {
    const png = path.join(tmp, `${name}.png`);
    execFileSync(path.join(game, 'tools/capture.sh'), [png, res, ...args], { env: { ...process.env, FRAMES: String(frames) }, stdio: 'ignore' });
    media.shots[name] = webp(png, `shots/${name}.webp`, res === PHONE ? 540 : 1280, { opaque: true });
    console.log(`shot: ${name}`);
  }
  // The picture shared with a link: the computer's window, cut to 1200 × 630.
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(tmp, 'desktop.png'), '-vf', 'format=rgb24,scale=1200:-1,crop=1200:630:0:(ih-630)/2', path.join(out, 'shots/share.png')]);
  media.shots.share = { src: 'assets/game/shots/share.png', ...size(path.join(out, 'shots/share.png')) };
  await rm(tmp, { recursive: true, force: true });
} else {
  media.shots = before;
  if (!Object.keys(before).length) console.log('No screenshots yet: run npm run export-game -- --shots');
}
await writeFile(shotsFile, JSON.stringify(media, null, 1) + '\n');
console.log('media.json written');
