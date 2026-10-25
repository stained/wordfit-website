// The menu on a phone, the Sound and Music switches, the trailer's player (loaded only when pressed), and Try one:
// a small puzzle from the game's own generator, played as in the game (drag a word into the grid, or tap a word and
// then a square; tap a placed word twice, or drag it off, to take it back). The site works without it.
document.documentElement.classList.add('js');

const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav?.addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); } });

const store = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };

// Music: the game's menu music, off until it's switched on, then remembered for the tab and carried from page to
// page. It fades out while the trailer plays.
const musicButton = document.querySelector('.switch.music');
const music = { hold() {} };
if (musicButton) {
  const VOLUME = 0.3;
  let theme = null, on = false, fade = 0, held = false;
  const label = text => { musicButton.querySelector('b').textContent = text; };
  const show = () => { musicButton.setAttribute('aria-pressed', String(on)); musicButton.classList.remove('waiting'); label(on ? 'On' : 'Off'); };
  const ramp = to => {
    cancelAnimationFrame(fade);
    const from = theme.volume, start = performance.now();
    const step = now => { const x = Math.max(0, Math.min(1, (now - start) / 600)); theme.volume = from + (to - from) * x; if (x < 1) fade = requestAnimationFrame(step); else if (to === 0) theme.pause(); };
    fade = requestAnimationFrame(step);
  };
  const start = () => {
    theme ||= Object.assign(new Audio(musicButton.dataset.src), { loop: true, volume: 0 });
    const at = Number(store.get('music-at'));
    if (at && !theme.currentTime) theme.currentTime = at;
    if (held) return Promise.resolve();
    return theme.play().then(() => ramp(VOLUME));
  };
  musicButton.addEventListener('click', () => {
    on = !on; store.set('music', on ? 'on' : 'off'); show();
    if (on) start().catch(() => {}); else if (theme) ramp(0);
  });
  // On from an earlier page: the browser may want a press before it plays sound again.
  if (store.get('music') === 'on') {
    on = true; show();
    start().catch(() => {
      musicButton.classList.add('waiting'); label('Tap');
      const resume = e => { if (e.target.closest('.switch')) return; removeEventListener('pointerdown', resume, true); show(); start().catch(() => {}); };
      addEventListener('pointerdown', resume, true);
    });
  }
  addEventListener('pagehide', () => { if (theme) store.set('music-at', String(theme.currentTime)); });
  music.hold = () => { held = true; if (on && theme) ramp(0); };
}

// The trailer: our own picture until it's pressed, then YouTube's privacy-enhanced player in its place.
document.addEventListener('click', event => {
  const link = event.target.closest('[data-youtube]');
  if (!link) return;
  event.preventDefault();
  const frame = document.createElement('iframe');
  frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(link.dataset.youtube)}?autoplay=1&rel=0`;
  frame.title = link.dataset.title;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const box = document.createElement('div');
  box.className = 'trailer';
  box.append(frame);
  link.replaceWith(box);
  music.hold();
});

// Sound: the game's own sounds. Its button tap on a click (quieter and higher on hover with a mouse), and in Try
// one, picking up and placing a word, a clash and the solve. On until the switch turns it off; silent until the
// first press, as browsers require.
const sfxButton = document.querySelector('.switch.sfx');
const sound = { play() {} };
if (sfxButton) {
  const HOVER = '.site-nav a, .brand, .button, .switch, .lang-tabs button, .site-foot a';
  const files = { tap: sfxButton.dataset.src, ...(JSON.parse(document.getElementById('try-data')?.textContent || '{}').audio || {}) };
  const buffers = {};
  let on = store.get('sfx') !== 'off';
  let ctx = null;
  const wake = () => {
    if (ctx) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    ctx = new Context();
    for (const [name, src] of Object.entries(files))
      fetch(src).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(d => { buffers[name] = d; }).catch(() => {});
  };
  sound.play = (name, rate = 1, gain = 0.6) => {
    if (!on || !ctx || !buffers[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createBufferSource(), level = ctx.createGain();
    source.buffer = buffers[name]; source.playbackRate.value = rate; level.gain.value = gain;
    source.connect(level).connect(ctx.destination); source.start();
  };
  const show = () => { sfxButton.setAttribute('aria-pressed', String(on)); sfxButton.querySelector('b').textContent = on ? 'On' : 'Off'; };
  show();
  sfxButton.addEventListener('click', () => { on = !on; store.set('sfx', on ? 'on' : 'off'); show(); });
  addEventListener('pointerdown', wake, { capture: true, passive: true });
  addEventListener('keydown', wake, { capture: true });
  let last = null;
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const target = e.target.closest(HOVER);
    if (target && target !== last) sound.play('tap', 1.5, 0.2);
    last = target;
  });
  // A tap or click on a button or link: the press. A link to another page waits a moment, so it's heard.
  document.addEventListener('click', e => {
    const target = e.target.closest('a, button');
    if (!target || target.closest('[data-board], [data-bank]')) return;
    sound.play('tap');
    const href = target.tagName === 'A' && target.getAttribute('href');
    if (!on || !ctx || !href || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || target.target || href.startsWith('#') || href.startsWith('mailto:')) return;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    setTimeout(() => { location.href = url.href; }, 120);
  });
}

// ---- Try one

const playEl = document.querySelector('[data-play]');
if (playEl) {
  const data = JSON.parse(document.getElementById('try-data').textContent);
  const boardEl = playEl.querySelector('[data-board]');
  const bankEl = playEl.querySelector('[data-bank]');
  const leftEl = playEl.querySelector('[data-left]');
  const clockEl = playEl.querySelector('[data-clock]');
  const solvedEl = playEl.querySelector('[data-solved]');
  const touchLift = 64;  // a word dragged by a finger floats this far above it, as in the game
  const at = { en: 0, af: 0, sym: 0 };
  let lang = 'en', P = null, cipher = null;
  let cellMap, cellEls, slotWord, wordSlot, stamp, locked, stampCount, selected, preview, mistakes, started, ticker, done;

  const key = (x, y) => `${x},${y}`;
  const cellsOf = s => [...P.slots[s].word].map((_, k) => P.slots[s].down ? [P.slots[s].x, P.slots[s].y + k] : [P.slots[s].x + k, P.slots[s].y]);
  // A letter as Symbols draws it: its picture, cut from the game's sheet as the game cuts it.
  const glyph = letter => {
    const { sheet, grid, inset } = data.symbols, i = cipher[letter];
    const scale = grid / (1 - 2 * inset), pos = n => (((n + inset) * scale / grid) / (scale - 1) * 100).toFixed(3);
    const el = document.createElement('i');
    el.className = 'glyph';
    el.style.cssText = `background-image:url(${sheet});background-size:${(scale * 100).toFixed(2)}%;background-position:${pos(i % grid)}% ${pos(Math.floor(i / grid))}%`;
    return el;
  };
  const letterInto = (el, letter) => { el.replaceChildren(cipher ? glyph(letter) : letter); };
  const wordLabel = w => cipher ? `a ${P.slots[w].word.length}-symbol word` : P.slots[w].word;

  function load() {
    P = data.puzzles[lang][at[lang]];
    cipher = P.cipher || null;
    cellMap = new Map();
    P.slots.forEach((_, s) => cellsOf(s).forEach(([x, y], k) => {
      const list = cellMap.get(key(x, y)) || [];
      list.push({ s, k });
      cellMap.set(key(x, y), list);
    }));
    slotWord = P.slots.map(() => -1);
    wordSlot = P.slots.map(() => -1);
    stamp = P.slots.map(() => 0);
    locked = P.slots.map((_, s) => P.starters.includes(s));
    stampCount = 0; selected = -1; preview = null; mistakes = 0; started = 0; done = false;
    clearInterval(ticker); clockEl.textContent = '0:00';
    locked.forEach((l, s) => { if (l) { slotWord[s] = s; wordSlot[s] = s; stamp[s] = ++stampCount; } });
    solvedEl.hidden = true;
    // The grid.
    boardEl.style.setProperty('--w', P.width);
    boardEl.replaceChildren();
    cellEls = new Map();
    for (let y = 0; y < P.height; y++) for (let x = 0; x < P.width; x++) {
      const used = cellMap.has(key(x, y));
      const el = document.createElement(used ? 'button' : 'div');
      el.className = used ? 'cell slot' : 'cell';
      if (used) { el.type = 'button'; el.dataset.x = x; el.dataset.y = y; cellEls.set(key(x, y), el); }
      boardEl.append(el);
    }
    // The words, grouped by length as Easy lists them, each group in alphabetical order.
    bankEl.replaceChildren();
    const lengths = [...new Set(P.slots.map(s => s.word.length))].sort((a, b) => a - b);
    for (const n of lengths) {
      const row = document.createElement('div');
      row.className = 'bank-row';
      row.innerHTML = `<span>${n} ${cipher ? 'symbols' : 'letters'}</span>`;
      P.slots.map((s, w) => w).filter(w => P.slots[w].word.length === n).sort((a, b) => P.slots[a].word.localeCompare(P.slots[b].word)).forEach(w => {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'chip'; chip.dataset.word = w;
        chip.setAttribute('aria-label', wordLabel(w));
        for (const ch of P.slots[w].word) chip.append(cipher ? glyph(ch) : ch);
        row.append(chip);
      });
      bankEl.append(row);
    }
    for (const b of playEl.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    draw();
  }

  // What a square shows: the letter of the word placed there last, and whether the words crossing it disagree.
  function lettersAt(x, y) {
    return cellMap.get(key(x, y)).filter(({ s }) => slotWord[s] >= 0).sort((a, b) => stamp[a.s] - stamp[b.s])
      .map(({ s, k }) => ({ s, letter: P.slots[slotWord[s]].word[k] }));
  }
  function draw() {
    const previewAt = new Map();
    if (preview) cellsOf(preview.s).forEach(([x, y], k) => previewAt.set(key(x, y), P.slots[preview.w].word[k]));
    for (const [k, el] of cellEls) {
      const [x, y] = k.split(',').map(Number);
      const here = lettersAt(x, y);
      const top = here.at(-1);
      const clash = new Set(here.map(h => h.letter)).size > 1;
      el.classList.toggle('filled', !!top);
      el.classList.toggle('locked', !!top && here.every(h => locked[h.s]));
      el.classList.toggle('clash', clash);
      el.classList.toggle('preview', previewAt.has(k));
      const letter = previewAt.get(k) ?? top?.letter;
      if ((el.dataset.letter || '') !== (letter || '')) { el.dataset.letter = letter || ''; if (letter) letterInto(el, letter); else el.replaceChildren(); }
      el.setAttribute('aria-label', `Row ${y + 1}, column ${x + 1}: ${letter ? (cipher ? 'a symbol' : letter) : 'empty'}${clash ? ', clashing' : ''}`);
    }
    for (const chip of bankEl.querySelectorAll('.chip')) {
      const w = Number(chip.dataset.word);
      chip.classList.toggle('used', wordSlot[w] >= 0);
      chip.classList.toggle('selected', w === selected);
      chip.disabled = locked[w];
    }
    const left = slotWord.filter(w => w < 0).length;
    leftEl.textContent = left ? `${left} word${left > 1 ? 's' : ''} left` : 'All placed';
  }

  const clock = () => { const t = Math.floor((performance.now() - started) / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const begin = () => { if (started) return; started = performance.now(); ticker = setInterval(() => { clockEl.textContent = clock(); }, 500); };

  // The slot a word goes into from a square: one of the word's length through it, not locked; an empty one first.
  function slotFor(w, x, y) {
    const fits = (cellMap.get(key(x, y)) || []).map(c => c.s).filter(s => !locked[s] && P.slots[s].word.length === P.slots[w].word.length);
    return fits.find(s => slotWord[s] < 0 || slotWord[s] === w) ?? fits[0] ?? -1;
  }
  function take(w) { if (wordSlot[w] >= 0) { slotWord[wordSlot[w]] = -1; wordSlot[w] = -1; } }
  function place(w, s) {
    begin();
    take(w);
    if (slotWord[s] >= 0) wordSlot[slotWord[s]] = -1;  // the word there goes back to the list
    slotWord[s] = w; wordSlot[w] = s; stamp[s] = ++stampCount;
    selected = -1; preview = null;
    draw();
    const cells = cellsOf(s).map(([x, y]) => cellEls.get(key(x, y)));
    const clash = cells.some(el => el.classList.contains('clash'));
    if (clash) mistakes++;
    sound.play(clash ? 'clash' : 'place');
    cells.forEach((el, i) => { el.classList.remove('pop'); void el.offsetWidth; el.style.animationDelay = `${i * 30}ms`; el.classList.add('pop'); });
    if (slotWord.every(v => v >= 0) && !boardEl.querySelector('.clash')) solve();
  }
  function giveBack(w) { take(w); selected = -1; sound.play('pickup', 0.8); draw(); }

  function solve() {
    done = true;
    clearInterval(ticker);
    const time = clock();
    clockEl.textContent = time;
    sound.play('solve', 1, 0.8);
    [...cellEls.values()].forEach(el => { el.classList.remove('pop', 'wave'); void el.offsetWidth; el.style.animationDelay = `${(Number(el.dataset.x) + Number(el.dataset.y)) * 45}ms`; el.classList.add('wave'); });
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const starEls = playEl.querySelectorAll('[data-stars] .sprite');
    starEls.forEach((el, i) => { el.style.opacity = i < stars ? '1' : '.25'; el.style.filter = i < stars ? '' : 'grayscale(1)'; });
    playEl.querySelector('[data-summary]').textContent = `In ${time}, ${mistakes ? `with ${mistakes} clash${mistakes > 1 ? 'es' : ''}` : 'with no mistakes'}. The game has endless more, up to 20 × 20.`;
    setTimeout(() => { solvedEl.hidden = false; solvedEl.querySelector('.button')?.focus({ preventScroll: true }); }, 900);
  }

  // Pointer: a press on a word (in the list, or placed and not locked) may become a drag; without moving, a tap.
  let press = null, ghost = null, lastTap = { el: null, t: 0 };
  const targetAt = (e, touch) => ({ x: e.clientX, y: e.clientY - (touch ? touchLift : 0) });
  const squareAt = p => {
    const el = document.elementFromPoint(p.x, p.y)?.closest('.cell.slot');
    return el && boardEl.contains(el) ? [Number(el.dataset.x), Number(el.dataset.y)] : null;
  };
  function liftGhost(w) {
    ghost = document.createElement('div');
    ghost.className = 'ghost-word';
    ghost.innerHTML = '<span class="tiles"><span class="tile-word"></span></span>';
    for (const ch of P.slots[w].word) { const t = document.createElement('span'); t.className = 'tile'; letterInto(t, ch); ghost.firstChild.firstChild.append(t); }
    document.body.append(ghost);
  }
  const moveGhost = p => { ghost.style.transform = `translate(${p.x - ghost.offsetWidth / 2}px, ${p.y - ghost.offsetHeight / 2}px)`; };

  playEl.addEventListener('pointerdown', e => {
    if (done || e.button > 0) return;
    const chip = e.target.closest('.chip');
    const cell = e.target.closest('.cell.slot');
    let w = -1;
    if (chip && !chip.disabled) w = Number(chip.dataset.word);
    else if (cell) {
      const top = lettersAt(Number(cell.dataset.x), Number(cell.dataset.y)).filter(h => !locked[h.s]).at(-1);
      if (top) w = slotWord[top.s];
    }
    if (!chip && !cell) return;
    press = { w, el: chip || cell, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', dragging: false, id: e.pointerId };
    if (w >= 0) e.preventDefault();
  });
  addEventListener('pointermove', e => {
    if (!press || e.pointerId !== press.id || press.w < 0) return;
    if (!press.dragging) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
      press.dragging = true;
      begin();
      selected = -1;
      take(press.w);  // a placed word comes off the grid as it's picked up
      liftGhost(press.w);
      bankEl.querySelector(`[data-word="${press.w}"]`)?.classList.add('lifted');
      sound.play('pickup');
    }
    const p = targetAt(e, press.touch);
    moveGhost(p);
    const sq = squareAt(p);
    const s = sq ? slotFor(press.w, ...sq) : -1;
    preview = s >= 0 ? { s, w: press.w } : null;
    draw();
  });
  const release = e => {
    if (!press || e.pointerId !== press.id) return;
    const p = press; press = null;
    if (p.dragging) {
      ghost?.remove(); ghost = null;
      bankEl.querySelector(`[data-word="${p.w}"]`)?.classList.remove('lifted');
      const target = preview; preview = null;
      if (e.type === 'pointerup' && target) { place(target.w, target.s); return; }
      sound.play('pickup', 0.8);  // dropped off the grid: back to the list
      draw();
      return;
    }
    if (e.type === 'pointerup') tap(p.el);
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  // Keyboard: Enter or Space on a word, then on a square.
  playEl.addEventListener('click', e => { if (e.detail === 0 && e.target.closest('.chip, .cell.slot')) tap(e.target.closest('.chip, .cell.slot')); });

  function tap(el) {
    if (done) return;
    if (el.classList.contains('chip')) {
      const w = Number(el.dataset.word);
      selected = selected === w ? -1 : w;
      if (selected >= 0) sound.play('pickup', 1.1, 0.4);
      draw();
      return;
    }
    const x = Number(el.dataset.x), y = Number(el.dataset.y);
    if (selected >= 0) {
      const s = slotFor(selected, x, y);
      if (s >= 0) place(selected, s);
      return;
    }
    // A placed word, tapped twice: back to the list.
    const now = performance.now();
    if (lastTap.el === el && now - lastTap.t < 400) {
      const top = lettersAt(x, y).filter(h => !locked[h.s]).at(-1);
      if (top) giveBack(slotWord[top.s]);
      lastTap = { el: null, t: 0 };
    } else lastTap = { el, t: now };
  }

  for (const b of playEl.querySelectorAll('[data-lang]')) b.addEventListener('click', () => { if (lang !== b.dataset.lang) { lang = b.dataset.lang; load(); } });
  const next = () => { at[lang] = (at[lang] + 1) % data.puzzles[lang].length; load(); };
  playEl.querySelector('[data-new]').addEventListener('click', next);
  playEl.querySelector('[data-again]').addEventListener('click', next);
  playEl.querySelector('[data-reset]').addEventListener('click', load);
  load();
}
