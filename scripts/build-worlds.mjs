// يبني «خريطة العوالم» لقائمة الأفلام: site/films/data/worlds.json (للبطاقات) و data/generated/films/worlds-report.json (تقرير التدقيق).
// يُشغَّل بعد build-films.mjs. إن تعذّر الوصول إلى Wikidata يبقى الملف السابق كما هو ولا يفشل البناء.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { worldsFor } from './lib-worlds.mjs';
if (!hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(1); }
const root = new URL('../', import.meta.url), OUT = new URL('site/films/data/', root), GEN = new URL('data/generated/films/', root);
const rd = (u, fb) => fs.existsSync(u) ? JSON.parse(fs.readFileSync(u)) : fb;
const films = rd(new URL('films.json', OUT)).films, fr = rd(new URL('franchises.json', OUT), { items: {} }), cols = rd(new URL('collections.json', OUT), {});
const keyOf = f => (f.kind === 'tv' ? 't' : 'm') + f.tmdb, focus = films.map(keyOf);
const known = Object.fromEntries(films.map(f => [keyOf(f), JSON.parse(JSON.stringify({ title: f.title, date: f.date, year: f.year, poster: f.poster, rating: f.rating, votes: f.votes, lang: f.lang, genres: f.genres, runtime: f.runtime, tv: f.kind === 'tv' || undefined }))]));

// ذاكرة TMDB للأعمال خارج القائمة: ما صدر يُحدَّث كل ١٤ يوماً، وما لم يصدر كل يومين (تتغير مواعيده)
const CACHE = new URL('tmdb-basic.json', GEN), cache = rd(CACHE, {}), now = Date.now(), today = new Date().toISOString().slice(0, 10);
const fresh = Object.fromEntries(Object.entries(cache).filter(([, v]) => now - (v.at || 0) < ((v.date && v.date <= today) ? 14 : 2) * 864e5));
const t0 = Date.now();
let res;
try { res = await worldsFor(focus, { tmdb, basicCache: fresh, known, onStage: (s, n) => console.log(`WORLDS stage ${s} ${n} (${Math.round((Date.now() - t0) / 1000)}s)`) }); }
catch (e) { console.log('WORLDS failed, keeping the previous worlds.json: ' + e.message); process.exit(0); }
for (const [k, v] of Object.entries(res.basic)) if (!known[k]) cache[k] = { ...v, at: cache[k] && fresh[k] ? cache[k].at : now };
fs.writeFileSync(CACHE, JSON.stringify(cache) + '\n');
const out = { generatedAt: new Date().toISOString(), worlds: res.worlds, works: res.works, info: res.info };
fs.writeFileSync(new URL('worlds.json', OUT), JSON.stringify(out) + '\n');

// ---------- تقرير التدقيق ----------
// ناقص: عمل في عالم أو سلسلة وليس له ترتيب مراجَع ولا مجموعة TMDB. فجوات المراجَع: أعضاء في العالم ليسوا في ترتيبه المراجَع.
const curOf = new Map(); for (const [k, g] of Object.entries(fr.items || {})) for (const s of g.order || []) { const id = s.m ? 'm' + s.m : s.t ? 't' + s.t : null; if (id) curOf.set(id, k); }
const colOf = f => { const c = f.col && cols[f.col]; return c && c.parts.length > 1 ? c : null; };
const title = k => known[k]?.title || res.info[k]?.title || k;
const released = k => { const d = known[k]?.date || res.info[k]?.date; return d && d <= today; };
const report = { generatedAt: out.generatedAt, counts: {}, missing: [], curatedGaps: [], collectionGaps: [], related: [], noItem: [], excludedGroups: res.report.excludedGroups, rejectedFollows: res.report.rejectedFollows };
const listed = new Set(focus);
for (const f of films) { const k = keyOf(f), w = res.works[k];
  if (!w) { report.noItem.push({ k, t: f.title, y: f.year }); continue; }
  const ws = (w.worlds || []).map(id => res.worlds[id]), cur = curOf.get(k), col = colOf(f);
  if (ws.length && !cur && !col) report.missing.push({ k, t: f.title, y: f.year, worlds: ws.map(x => ({ name: x.name, kind: x.kind, size: x.size, order: x.order.map(title) })) });
  if (cur) { const have = new Set(fr.items[cur].order.map(s => s.m ? 'm' + s.m : s.t ? 't' + s.t : null));
    const first = ws[0]; if (first && first.size <= 40) { const gap = first.order.filter(x => !have.has(x) && released(x)); if (gap.length) report.curatedGaps.push({ cur, k, t: f.title, world: first.name, kind: first.kind, gap: gap.map(x => `${x} ${title(x)}`) }); } }
  else if (col && ws[0]) { const parts = new Set(col.parts.map(p => 'm' + p.tmdb)), wo = new Set(ws[0].order);
    const extra = ws[0].order.filter(x => !parts.has(x)), lack = [...parts].filter(x => !wo.has(x));
    if (extra.length || lack.length) report.collectionGaps.push({ k, t: f.title, col: col.name, world: ws[0].name, extra: extra.map(x => `${x} ${title(x)}`), lack: lack.map(x => `${x} ${title(x)}`) }); }
  if (w.rel?.length || w.src?.length) report.related.push({ k, t: f.title, rel: (w.rel || []).map(r => `${r.r}:${title(r.k)}${listed.has(r.k) ? '*' : ''}`), src: (w.src || []).map(s => `${s.kind}:${s.label}`) });
}
report.counts = { works: focus.length, withItem: focus.length - report.noItem.length, inWorld: Object.values(res.works).filter(w => w.worlds?.length).length, worlds: Object.keys(res.worlds).length,
  chains: res.report.chains, withRelated: report.related.length, missing: report.missing.length, curatedGaps: report.curatedGaps.length, collectionGaps: report.collectionGaps.length,
  infoEntries: Object.keys(res.info).length, bytes: JSON.stringify(out).length, seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(new URL('worlds-report.json', GEN), JSON.stringify(report, null, 1) + '\n');
console.log('WORLDS counts ' + JSON.stringify(report.counts));
// فروع العمل: نسخة مضغوطة من الناتج في السجل (تحميل الملفات من GitHub غير متاح لأدوات المراجعة)
if (process.env.WORLDS_DUMP) { const zlib = await import('node:zlib');
  for (const [name, data] of [['worlds', out], ['report', report]]) { const b64 = zlib.gzipSync(JSON.stringify(data)).toString('base64'), n = Math.ceil(b64.length / 6000);
    for (let i = 0; i < n; i++) console.log(`WORLDSDUMP ${name} ${i + 1}/${n} ${b64.slice(i * 6000, (i + 1) * 6000)}`); } }
for (const m of report.missing) console.log('WORLDS missing ' + JSON.stringify(m));
for (const m of report.curatedGaps) console.log('WORLDS curated-gap ' + JSON.stringify(m));
for (const m of report.collectionGaps) console.log('WORLDS collection-gap ' + JSON.stringify(m));
