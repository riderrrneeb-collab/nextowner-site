// Renders one 15s vertical (1080x1920) NextOwner ad with music.
// Each date gets its own variant (hook, featured listing, cards, words, colors, music).
//   node tools/ad/make-ad.mjs [--date YYYY-MM-DD] [--out file.mp4] [--frames t1,t2,...]
// Needs: playwright (Chromium), ffmpeg, python3 + numpy. Font: Inter Display if installed.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// Works with a local or global playwright install.
const { chromium } = createRequire(import.meta.url)('playwright');

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const date = arg('date') || new Date().toISOString().slice(0, 10);
const out = path.resolve(arg('out') || `nextowner-ad-${date}.mp4`);
const FPS = 30, W = 1080, H = 1920;

// ---- seeded variant ----
let s = [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const EX = [
  { n: 'Taco Food Truck', loc: 'Denver, CO', city: 'Denver', ask: 140, rev: 142, cf: 51, cat: 'Food & drink', g: ['#ffb36b', '#ff6b8b'], v: true, emoji: '🌮' },
  { n: 'Boutique Yoga Studio', loc: 'Austin, TX', city: 'Austin', ask: 175, rev: 188, cf: 62, cat: 'Fitness', g: ['#8ec5ff', '#b49cff'], v: true, emoji: '🧘' },
  { n: 'Lawn Care Route', loc: 'Charlotte, NC', city: 'Charlotte', ask: 125, rev: 121, cf: 47, cat: 'Routes', g: ['#9be7a8', '#3fb8a3'], v: false, emoji: '🌿' },
  { n: 'Neighborhood Coffee Bar', loc: 'Portland, OR', city: 'Portland', ask: 235, rev: 310, cf: 78, cat: 'Food & drink', g: ['#d9a77a', '#8a5a3b'], v: true, emoji: '☕' },
  { n: '24/7 Strength Gym', loc: 'Phoenix, AZ', city: 'Phoenix', ask: 340, rev: 420, cf: 112, cat: 'Fitness', g: ['#7f8cff', '#3a3f9e'], v: false, emoji: '🏋️' },
  { n: 'Coin Laundromat', loc: 'Columbus, OH', city: 'Columbus', ask: 240, rev: 205, cf: 69, cat: 'Services', g: ['#a0e9ff', '#5aa9e6'], v: true, emoji: '🧺' },
  { n: 'Mobile Dog Grooming', loc: 'Tampa, FL', city: 'Tampa', ask: 95, rev: 98, cf: 39, cat: 'Services', g: ['#ffd56b', '#ff9f6b'], v: false, emoji: '🐶' },
  { n: 'Snack Vending Route', loc: 'Seattle, WA', city: 'Seattle', ask: 75, rev: 76, cf: 29, cat: 'Routes', g: ['#ffb3c7', '#c77dff'], v: true, emoji: '🍫' },
];
const HOOKS = [
  ['Skip the *startup.*', 'Buy one that *works.*'],
  ['Your next business', 'is already *for sale.*'],
  ['Why build', 'from *zero?*'],
  ['Be your own boss.', '*Starting Monday.*'],
  ['Don\'t start a business.', '*Buy one.*'],
  ['Cash flow on', '*day one.*'],
  ['The 9-to-5', 'has an *exit.*'],
];
const MAP_HEADS = ['Find one<br><span class="grad">near you.</span>', 'For sale,<br><span class="grad">on a map.</span>', 'Search your<br><span class="grad">city.</span>', 'Every state.<br><span class="grad">Every price.</span>'];
const CARD_HEADS = [['Real numbers.', 'Asking price and cash flow, up front.'], ['Know what you\'re buying.', 'Every listing shows the numbers.'], ['Pick your <span class="grad">next move.</span>', 'Food trucks, gyms, routes and more.']];
const WORDS = ['<span class="grad">✓</span> Verified sellers.', 'Talk to owners <span class="grad">direct.</span>', 'No <span class="grad">middleman.</span>', 'Brokers list <span class="grad">free.</span>', 'Free to <span class="grad">browse.</span>', 'Small business,<br><span class="grad">big upside.</span>', 'Own the <span class="grad">upside.</span>'];
const TAGS = ['Your next business is waiting.', 'Buy a business that already works.', 'The marketplace for small businesses.', 'Find yours today.'];
const PALETTES = [['#0a84ff', '#7c5cff'], ['#0a84ff', '#30c48d'], ['#7c5cff', '#ff5ca8'], ['#ff7a45', '#ff3d77'], ['#00a6c8', '#5a6bff']];
const BLOBS = [['#9ec9ff', '#c7b6ff'], ['#a8e6cf', '#9ec9ff'], ['#ffc4dd', '#c7b6ff'], ['#ffd2b0', '#ffb3c7'], ['#a6e9f5', '#b8c2ff']];

const ex = shuffle(EX);
const featured = ex[0], cards = ex.slice(1, 4);
const pi = Math.floor(rnd() * PALETTES.length);
const MAP = JSON.parse(fs.readFileSync(path.join(DIR, 'us-map.json'), 'utf8'));
const exCities = new Set(EX.map(e => e.city));
const near = (a, b) => Math.hypot(MAP.pts[a][0] - MAP.pts[b][0], MAP.pts[a][1] - MAP.pts[b][1]) < 115;
const others = shuffle(Object.keys(MAP.pts).filter(c => c !== featured.city && !near(c, featured.city)));
const chosen = [];
for (const c of others) if (chosen.length < 8 && !chosen.some(o => near(o, c))) chosen.push(c);
const price = c => { const e = EX.find(x => x.city === c); return '$' + (e ? e.ask : 60 + Math.round(rnd() * 40) * 10) + 'K'; };
const pins = shuffle([...chosen, featured.city]).map(c => [c, price(c)]);
pins.sort((a, b) => MAP.pts[a[0]][0] - MAP.pts[b[0]][0]); // drop in west → east
const [ch, cs] = pick(CARD_HEADS);
const CFG = {
  date, timeline: [2, 5.5, 8.5, 11.5, 15],
  hook: pick(HOOKS), mapHead: pick(MAP_HEADS), cardHead: ch, cardSub: cs,
  words: shuffle(WORDS).slice(0, 3), tagline: pick(TAGS),
  palette: PALETTES[pi], blobs: BLOBS[pi], featured, cards, pins,
  musicSeed: Math.floor(rnd() * 1e6),
};
void exCities;

// ---- render ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nextowner-ad-'));
const html = fs.readFileSync(path.join(DIR, 'ad.html'), 'utf8')
  .replace('<script>', `<script>window.CFG=${JSON.stringify(CFG)};window.MAP=${JSON.stringify(MAP)};</script><script>`);
const pagePath = path.join(tmp, 'ad.html');
fs.writeFileSync(pagePath, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto('file://' + pagePath);
await page.evaluate(() => document.fonts.ready);

const framesArg = arg('frames');
if (framesArg) { // preview stills only
  for (const t of framesArg.split(',').map(Number)) {
    await page.evaluate(t => render(t), t);
    const f = out.replace(/\.mp4$/, '') + `-t${t}.jpg`;
    await page.screenshot({ path: f, type: 'jpeg', quality: 85 });
    console.log(f);
  }
  await browser.close(); process.exit(0);
}

const T = [0, ...CFG.timeline];
const parts = [];
for (let k = 0; k < T.length - 1; k++) {
  const n = Math.round((T[k + 1] - T[k]) * FPS), part = path.join(tmp, `scene${k}.mp4`), tmpPart = path.join(tmp, `scene${k}.part.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmpPart], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  for (let i = 0; i < n; i++) {
    const t = T[k] + i / FPS;
    await page.evaluate(t => render(t), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; fs.renameSync(tmpPart, part); parts.push(part);
  process.stdout.write(`scene ${k + 1}/${T.length - 1} done\n`);
}
await browser.close();

const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
const video = path.join(tmp, 'video.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
const wav = path.join(tmp, 'music.wav');
execFileSync('python3', [path.join(DIR, 'music.py'), String(CFG.musicSeed), String(CFG.timeline.at(-1)), wav, CFG.timeline.slice(0, 4).join(',')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ out, hook: CFG.hook, featured: featured.n, cards: cards.map(c => c.n), words: CFG.words }));
