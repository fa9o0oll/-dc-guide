// فحص مؤقت: ماذا تعرف Wikidata عن أعمال القائمة؟ يطبع في سجل البناء أسطراً تبدأ بـ WDP ولا يكتب ملفات.
// يُشغَّل في فروع العمل فقط (claude/**) بعد بناء القائمة.
import fs from 'node:fs';
import { relations, nodes, members } from './lib-worlds.mjs';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const films = read('site/films/data/films.json').films, cols = read('site/films/data/collections.json'), fr = read('data/films/franchises.json');
const colOf = id => { const c = (Array.isArray(cols) ? cols : Object.values(cols)).find(c => c.id === id); return c && c.parts.length > 1 ? c : null; };
const curated = new Map(); for (const [k, f] of Object.entries(fr)) for (const s of f.order || []) { if (s.m) curated.set('m' + s.m, k); if (s.t) curated.set('t' + s.t, k); if (s.all) curated.set('all' + s.all, k); }
const keyOf = f => (f.kind === 'tv' ? 't' : 'm') + f.tmdb;
const log = (tag, o) => console.log('WDP ' + tag + ' ' + JSON.stringify(o));
const t0 = Date.now();
const keys = films.map(keyOf);
const rel = await relations(keys);
const byWork = new Map(); for (const r of rel) { const w = byWork.get(r.tk) || byWork.set(r.tk, { item: r.item, p: {} }).get(r.tk); if (r.prop !== 'ITEM') (w.p[r.prop] ||= []).push(r.ord ? r.o + '#' + r.ord : r.o); }
const groupIds = new Set(), targets = new Set();
for (const w of byWork.values()) { for (const p of ['P179', 'P1434', 'P8345']) for (const o of w.p[p] || []) groupIds.add(o.split('#')[0]);
  for (const p of ['P155', 'P156', 'P144', 'P144i', 'P4969', 'P4969i']) for (const o of w.p[p] || []) targets.add(o); }
const info = await nodes([...groupIds, ...targets]);
const mem = await members([...groupIds]);
const size = {}; for (const r of mem) (size[r.g] ||= new Set()).add(r.m);
const inList = new Set(keys);
const lab = q => info[q]?.label || q;
const cov = { works: keys.length, withItem: byWork.size, ms: Date.now() - t0 };
for (const p of ['P179', 'P155', 'P156', 'P1434', 'P8345', 'P144', 'P144i', 'P4969', 'P4969i', 'MAL']) cov[p] = [...byWork.values()].filter(w => w.p[p]).length;
cov.groups = groupIds.size; cov.memberRows = mem.length;
log('coverage', cov);
// المجموعات بحجمها (أعضاء لهم رقم TMDB) وعدد أعضائها في القائمة
const gl = [...groupIds].map(g => ({ g, name: lab(g), types: info[g]?.types, size: size[g]?.size || 0,
  inList: [...(size[g] || [])].filter(m => mem.some(r => r.m === m && ((r.tm && inList.has('m' + r.tm)) || (r.tt && inList.has('t' + r.tt))))).length, up: (info[g]?.up || []).map(lab) })).sort((a, b) => b.size - a.size);
for (const g of gl) log('group', g);
// لكل عمل: ما عندنا الآن (مراجَع، مجموعة TMDB) وما تقوله Wikidata
const typesOf = q => (info[q]?.types || []).join('/');
let missing = 0, standaloneBoth = 0, noItem = 0;
for (const f of films) { const k = keyOf(f), w = byWork.get(k), cur = curated.get(k) || (f.col && curated.get('all' + f.col)) || null, col = f.col ? colOf(f.col) : null;
  if (!w) { noItem++; log('work', { k, t: f.title, y: f.year, cur, col: col?.name || null, wd: null }); continue; }
  const g = ['P179', 'P1434', 'P8345'].flatMap(p => (w.p[p] || []).map(o => `${p}:${lab(o.split('#')[0])}${o.includes('#') ? '#' + o.split('#')[1] : ''}`));
  const near = ['P155', 'P156'].flatMap(p => (w.p[p] || []).map(o => `${p}:${lab(o)}${info[o]?.tm ? '(m' + info[o].tm + ')' : info[o]?.tt ? '(t' + info[o].tt + ')' : ''}`));
  const based = ['P144', 'P4969i'].flatMap(p => (w.p[p] || []).map(o => `${lab(o)}[${typesOf(o)}]${info[o]?.tm ? '(m' + info[o].tm + ')' : info[o]?.tt ? '(t' + info[o].tt + ')' : ''}`));
  const derived = ['P144i', 'P4969'].flatMap(p => (w.p[p] || []).map(o => `${lab(o)}${info[o]?.tm ? '(m' + info[o].tm + ')' : info[o]?.tt ? '(t' + info[o].tt + ')' : ''}`));
  const linked = g.length || near.length || based.some(b => /\((m|t)\d+\)/.test(b)) || derived.length;
  if (linked && !cur && !col) missing++; if (!linked && !cur && !col) standaloneBoth++;
  log('work', { k, t: f.title, y: f.year, q: w.item, cur, col: col?.name || null, g, near, based, derived, mal: w.p.MAL || undefined });
}
log('summary', { missing, standaloneBoth, noItem, ms: Date.now() - t0 });
