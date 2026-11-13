// يبني «خريطة العوالم» لقائمة الأفلام: site/films/data/worlds.json (للبطاقات) و data/generated/films/worlds-report.json (تقرير التدقيق).
// يُشغَّل بعد build-films.mjs. إن تعذّر الوصول إلى Wikidata يبقى الملف السابق كما هو ولا يفشل البناء.
// WORLDS_RAW=ملف: يعيد التجميع من مدخلات خام محفوظة (من WORLDSDUMP raw) بلا شبكة، لتجربة قواعد التجميع.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { worldsFor, assemble } from './lib-worlds.mjs';
const RAW = process.env.WORLDS_RAW;
if (!RAW && !hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(1); }
const root = new URL('../', import.meta.url), dir = d => d && new URL(d.replace(/\/?$/, '/'), 'file://' + process.cwd() + '/');
// WORLDS_OUT: مجلد بديل للناتج (عند التجربة المحلية، كي لا تتغير ملفات الموقع)
const OUT = dir(process.env.WORLDS_OUT) || new URL('site/films/data/', root), GEN = dir(process.env.WORLDS_OUT) || new URL('data/generated/films/', root), SRC = dir(process.env.WORLDS_SRC) || new URL('site/films/data/', root);
const rd = (u, fb) => fs.existsSync(u) ? JSON.parse(fs.readFileSync(u)) : fb;
const films = rd(new URL('films.json', SRC)).films, fr = rd(new URL('franchises.json', SRC), { items: {} }), cols = rd(new URL('collections.json', SRC), {});
const keyOf = f => (f.kind === 'tv' ? 't' : 'm') + f.tmdb, focus = films.map(keyOf);
const known = Object.fromEntries(films.map(f => [keyOf(f), JSON.parse(JSON.stringify({ title: f.title, date: f.date, year: f.year, poster: f.poster, rating: f.rating, votes: f.votes, lang: f.lang, genres: f.genres, runtime: f.runtime, tv: f.kind === 'tv' || undefined }))]));

// ذاكرة TMDB للأعمال خارج القائمة: ما صدر يُحدَّث كل ١٤ يوماً، وما لم يصدر كل يومين (تتغير مواعيده)
const CACHE = new URL('data/generated/films/tmdb-basic.json', root), cache = rd(CACHE, {}), now = Date.now(), today = new Date().toISOString().slice(0, 10);
const fresh = Object.fromEntries(Object.entries(cache).filter(([, v]) => now - (v.at || 0) < ((v.date && v.date <= today) ? 14 : 2) * 864e5));
const t0 = Date.now();
let res;
if (RAW) { const raw = JSON.parse(fs.readFileSync(RAW)); res = { ...assemble({ focus, ...raw, basic: { ...raw.basic, ...known } }), basic: raw.basic, raw }; }
else {
  try { res = await worldsFor(focus, { tmdb, basicCache: fresh, known, keepRaw: !!process.env.WORLDS_DUMP, onStage: (s, n) => console.log(`WORLDS stage ${s} ${n} (${Math.round((Date.now() - t0) / 1000)}s)`) }); }
  catch (e) { console.log('WORLDS failed, keeping the previous worlds.json: ' + e.message); process.exit(0); }
  for (const [k, v] of Object.entries(res.basic)) if (!known[k]) cache[k] = { ...v, at: cache[k] && fresh[k] ? cache[k].at : now };
  fs.writeFileSync(CACHE, JSON.stringify(cache) + '\n'); }
// data/films/worlds-audit.json: skip أعمال تُركت عمداً خارج ترتيب مراجَع (للتقرير)، وhide أعمال لا تُعرض في «أعمال مرتبطة» لسببها المكتوب
const audit = rd(new URL('data/films/worlds-audit.json', root), {}), hide = new Set(audit.hide || []);
for (const w of Object.values(res.works)) if (w.rel) { w.rel = w.rel.filter(r => !hide.has(r.k)); if (!w.rel.length) delete w.rel; }
for (const k of hide) if (!Object.values(res.worlds).some(w => w.order.includes(k))) delete res.info[k];
// ربط البوابات: عمل في القائمة موجود في دليل DC أو Fate (المطابقة برقم IMDb لأنه لا يتكرر بين الأفلام والمسلسلات)
for (const [door, file] of [['dc', 'site/dc/data/catalog.json'], ['fate', 'site/fate/data/catalog.json']]) {
  const cat = rd(new URL(file, root), { works: [] }), byImdb = new Map((cat.works || []).filter(w => w.imdb).map(w => [w.imdb, w.id]));
  for (const f of films) { const id = f.imdb && byImdb.get(f.imdb); if (id) { const k = keyOf(f); (res.works[k] ||= { worlds: [] }).guide = { door, id }; } } }
const out = { generatedAt: new Date().toISOString(), worlds: res.worlds, works: res.works, info: res.info };
fs.writeFileSync(new URL('worlds.json', OUT), JSON.stringify(out) + '\n');

// ---------- تقرير التدقيق ----------
// ناقص: عمل في عالم أو سلسلة وليس له ترتيب مراجَع ولا مجموعة TMDB. فجوات المراجَع: أعضاء في العالم ليسوا في ترتيبه المراجَع.
// أعمال تُركت عمداً خارج ترتيب مراجَع (قرار تحريري موثّق في worlds-audit.json)، فلا تُعدّ فجوة في كل تقرير.
const skip = audit.skip || {};
const curOf = new Map(); for (const [k, g] of Object.entries(fr.items || {})) for (const s of g.order || []) { const id = s.m ? 'm' + s.m : s.t ? 't' + s.t : null; if (id) curOf.set(id, k); }
const colOf = f => { const c = f.col && cols[f.col]; return c && c.parts.length > 1 ? c : null; };
const title = k => known[k]?.title || res.info[k]?.title || k;
const released = k => { const d = known[k]?.date || res.info[k]?.date; return d && d <= today; };
// uncurated: أعمال تُعرض سلسلتها من مجموعة TMDB أو عالم آلي بترتيب الصدور، وترتيب أحداثها لم يُراجَع (قد يكون فيها جزء يسبق القصة)
const report = { generatedAt: out.generatedAt, counts: {}, missing: [], uncurated: [], curatedGaps: [], collectionGaps: [], related: [], noItem: [], excludedGroups: res.report.excludedGroups, rejectedFollows: res.report.rejectedFollows };
const listed = new Set(focus);
for (const f of films) { const k = keyOf(f), w = res.works[k];
  if (!w) { report.noItem.push({ k, t: f.title, y: f.year }); continue; }
  const ws = (w.worlds || []).map(id => res.worlds[id]), cur = curOf.get(k), col = colOf(f);
  if (ws.length && !cur && !col) report.missing.push({ k, t: f.title, y: f.year, worlds: ws.map(x => ({ name: x.name, kind: x.kind, size: x.size, order: x.order.map(title) })) });
  if (!cur && (col || ws.length)) report.uncurated.push({ k, t: f.title, y: f.year, via: col ? 'collection' : 'world', name: col ? col.name : ws[0].name });
  if (cur) { const have = new Set(fr.items[cur].order.map(s => s.m ? 'm' + s.m : s.t ? 't' + s.t : null));
    for (const wd of ws.filter(x => x.size <= 40)) { const gap = wd.order.filter(x => !have.has(x) && released(x) && !(skip[cur] || []).includes(x));
      if (gap.length && !report.curatedGaps.some(g => g.cur === cur && g.world === wd.name)) report.curatedGaps.push({ cur, k, t: f.title, world: wd.name, kind: wd.kind, gap: gap.map(x => `${x} ${title(x)}`) }); } }
  else if (col && ws[0]) { const parts = new Set(col.parts.map(p => 'm' + p.tmdb)), wo = new Set(ws[0].order);
    const extra = ws[0].order.filter(x => !parts.has(x)), lack = [...parts].filter(x => !wo.has(x));
    if (extra.length || lack.length) report.collectionGaps.push({ k, t: f.title, col: col.name, world: ws[0].name, extra: extra.map(x => `${x} ${title(x)}`), lack: lack.map(x => `${x} ${title(x)}`) }); }
  if (w.rel?.length || w.src?.length) report.related.push({ k, t: f.title, rel: (w.rel || []).map(r => `${r.r}:${title(r.k)}${listed.has(r.k) ? '*' : ''}`), src: (w.src || []).map(s => `${s.kind}:${s.label}`) });
}
report.counts = { works: focus.length, withEntry: focus.length - report.noItem.length, inWorld: Object.values(res.works).filter(w => w.worlds?.length).length, worlds: Object.keys(res.worlds).length,
  chains: res.report.chains, withRelated: report.related.length, missing: report.missing.length, uncurated: report.uncurated.length, curatedGaps: report.curatedGaps.length, collectionGaps: report.collectionGaps.length,
  infoEntries: Object.keys(res.info).length, bytes: JSON.stringify(out).length, seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(new URL('worlds-report.json', GEN), JSON.stringify(report, null, 1) + '\n');
console.log('WORLDS counts ' + JSON.stringify(report.counts));
// فروع العمل: نسخة مضغوطة من الناتج في السجل (تحميل الملفات من GitHub غير متاح لأدوات المراجعة)
if (process.env.WORLDS_DUMP) { const zlib = await import('node:zlib');
  for (const [name, data] of [['worlds', out], ['report', report], ...(res.raw && !RAW ? [['raw', { ...res.raw, basic: Object.fromEntries(Object.entries(res.basic).filter(([k]) => !known[k])) }]] : [])]) { const b64 = zlib.gzipSync(JSON.stringify(data)).toString('base64'), n = Math.ceil(b64.length / 6000);
    for (let i = 0; i < n; i++) console.log(`WORLDSDUMP ${name} ${i + 1}/${n} ${b64.slice(i * 6000, (i + 1) * 6000)}`); } }
for (const m of report.missing) console.log('WORLDS missing ' + JSON.stringify(m));
for (const m of report.uncurated) console.log('WORLDS uncurated ' + JSON.stringify(m));
for (const m of report.curatedGaps) console.log('WORLDS curated-gap ' + JSON.stringify(m));
for (const m of report.collectionGaps) console.log('WORLDS collection-gap ' + JSON.stringify(m));
