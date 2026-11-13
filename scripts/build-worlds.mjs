// يبني «خريطة العوالم» لقائمة الأفلام: site/films/data/worlds.json (للبطاقات) و data/generated/films/worlds-report.json (تقرير التدقيق).
// يُشغَّل بعد build-films.mjs. إن تعذّر الوصول إلى Wikidata يبقى الملف السابق كما هو ولا يفشل البناء.
// WORLDS_RAW=ملف: يعيد التجميع من مدخلات خام محفوظة (من WORLDSDUMP raw) بلا شبكة، لتجربة قواعد التجميع.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { worldsFor, assemble } from './lib-worlds.mjs';
import { gatherEvidence, chronoOrder } from './lib-chrono.mjs';
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
// ---------- ترتيب الأحداث (scripts/lib-chrono.mjs) ----------
// لكل عالم آلي (40 عملاً فأقل) ولكل مجموعة TMDB في القائمة: ترتيب أحداثه من أدلة Wikipedia وTMDB وWikidata، يُعرض حين لا ترتيب مراجَع.
// ويُحسب للترتيبات المراجَعة أيضاً لا للعرض، بل ليقيس التقرير دقة المحرك عليها ويكشف ما قد يفوت المراجعة.
const partOf = new Map(); for (const c of Object.values(cols)) for (const p of c.parts || []) partOf.set('m' + p.tmdb, p);
const meta = k => { const o = known[k] || res.info[k] || res.basic?.[k] || fr.extras?.[k] || partOf.get(k) || {}; return { k, title: o.title || k, date: o.date || null, year: o.year || (o.date ? +o.date.slice(0, 4) : null) }; };
const CHRONO = new URL('data/generated/films/chrono-cache.json', root), ccache = rd(CHRONO, {});
const cfresh = Object.fromEntries(Object.entries(ccache).filter(([k, v]) => now - (v.at || 0) < ((meta(k).date || '9999') <= today ? 14 : 2) * 864e5));
const groupsC = [];
for (const [id, w] of Object.entries(res.worlds)) if (w.order.length >= 2 && w.order.length <= 40) groupsC.push({ kind: 'world', id, keys: w.order, wide: w.kind === 'universe' || w.kind === 'franchise' });
for (const c of new Set(films.map(f => f.col).filter(c => c && cols[c]?.parts.length > 1))) groupsC.push({ kind: 'col', id: c, keys: cols[c].parts.map(p => 'm' + p.tmdb) });
for (const [id, g] of Object.entries(fr.items || {})) { const keys = g.order.map(s => s.m ? 'm' + s.m : s.t ? 't' + s.t : null).filter(Boolean); if (keys.length >= 2) groupsC.push({ kind: 'cur', id, keys, view: g.view, name: g.name }); }
const allKeys = [...new Set(groupsC.flatMap(g => g.keys))];
let evid = Object.fromEntries(allKeys.filter(k => cfresh[k]).map(k => [k, cfresh[k]]));
if (!RAW) { try { evid = await gatherEvidence(allKeys, { tmdb, cache: cfresh, log: m => console.log('CHRONO ' + m) }); console.log(`WORLDS stage chrono ${allKeys.length} (${Math.round((Date.now() - t0) / 1000)}s)`); }
  catch (e) { console.log('CHRONO evidence failed, using the cache: ' + e.message); }
  // ما تعذّر جلب بعض مصادره لا يُحفظ، فيُعاد جلبه في البناء التالي بدل أن يبقى ناقصاً أسبوعين
  fs.writeFileSync(CHRONO, JSON.stringify(Object.fromEntries(Object.entries(evid).filter(([k, v]) => allKeys.includes(k) && !v.miss).map(([k, v]) => [k, { ...v, at: cfresh[k]?.at || now }]))) + '\n');
  const miss = Object.values(evid).filter(v => v.miss).length; if (miss) console.log(`CHRONO evidence incomplete for ${miss} works (not cached)`); }
// reviewed: تقديمات راجعتها المراجعة وتركتها عمداً (worlds-audit.json ← chrono)، بسببها
const outCols = {}, chronoAudit = { agree: [], conflict: [], reviewed: [], missed: [], auto: [] }, chronoKeep = audit.chrono || {};
for (const g of groupsC) { const ms = g.keys.map(meta), r = chronoOrder(ms, evid, { wide: g.wide }), moved = Object.entries(r.moved), seen = g.keys.every(k => evid[k] && !evid[k].miss);
  // chk: فُحصت أدلة كل الأجزاء ولم يُذكر جزء يسبق القصة. إن تعذّر جلب دليل جزء لا يُدّعى ذلك
  if (g.kind === 'world') { if (moved.length) res.worlds[g.id].chrono = r; else if (seen) res.worlds[g.id].chk = 1; }
  else if (g.kind === 'col' && (moved.length || seen)) outCols[g.id] = moved.length ? r : { chk: 1 };
  if (g.kind !== 'cur') { if (moved.length) chronoAudit.auto.push({ group: g.kind === 'col' ? 'col ' + (cols[g.id]?.name || g.id) : res.worlds[g.id].name, order: r.order.map(k => meta(k).title), moved: moved.map(([k, m]) => `${meta(k).title} ← ${m.w} ${m.ref.map(t => meta(t).title).join(' / ')} [${m.src}]`) }); continue; }
  // المراجَع: هل يضع كل جزء حرّكه المحرك قبل ما يسبقه في دليله؟ وأي جزء قدّمته المراجعة ولم يقدّمه المحرك؟
  const pos = new Map(g.keys.map((k, i) => [k, i]));
  const fits = (k, m) => m.w === 'between' && m.ref.length >= 2 ? pos.get(m.ref[0]) < pos.get(k) && pos.get(k) < pos.get(m.ref.at(-1)) : m.ref.every(t => pos.get(k) < pos.get(t));
  for (const [k, m] of moved) (fits(k, m) ? chronoAudit.agree : chronoKeep[g.id]?.[k] ? chronoAudit.reviewed : chronoAudit.conflict).push({ cur: g.id, view: g.view || null, t: meta(k).title, w: m.w, before: m.ref.map(t => meta(t).title), src: m.src });
  if (g.view) for (const k of g.keys) { const d = meta(k).date || '9999'; if (g.keys.some(j => pos.get(j) > pos.get(k) && (meta(j).date || '9999') < d) && !r.moved[k]) chronoAudit.missed.push({ cur: g.id, t: meta(k).title }); } }
const out = { generatedAt: new Date().toISOString(), worlds: res.worlds, works: res.works, info: res.info, cols: outCols };
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
const report = { generatedAt: out.generatedAt, counts: {}, missing: [], uncurated: [], chronoAudit, curatedGaps: [], collectionGaps: [], related: [], noItem: [], excludedGroups: res.report.excludedGroups, rejectedFollows: res.report.rejectedFollows };
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
  chronoAgree: chronoAudit.agree.length, chronoConflict: chronoAudit.conflict.length, chronoReviewed: chronoAudit.reviewed.length, chronoMissed: chronoAudit.missed.length, chronoAuto: chronoAudit.auto.length,
  infoEntries: Object.keys(res.info).length, bytes: JSON.stringify(out).length, seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(new URL('worlds-report.json', GEN), JSON.stringify(report, null, 1) + '\n');
console.log('WORLDS counts ' + JSON.stringify(report.counts));
// فروع العمل: نسخة مضغوطة من الناتج في السجل (تحميل الملفات من GitHub غير متاح لأدوات المراجعة)
if (process.env.WORLDS_DUMP) { const zlib = await import('node:zlib');
  // chrono: أدلة محرّك الأحداث ومجموعاته، لضبط قواعده محلياً على البيانات الحقيقية
  const chronoDump = { evid, groups: groupsC.map(g => ({ kind: g.kind, id: g.id, keys: g.keys, view: g.view, wide: g.wide })), meta: Object.fromEntries(allKeys.map(k => [k, meta(k)])) };
  for (const [name, data] of [['worlds', out], ['report', report], ['chrono', chronoDump], ...(res.raw && !RAW ? [['raw', { ...res.raw, basic: Object.fromEntries(Object.entries(res.basic).filter(([k]) => !known[k])) }]] : [])]) { const b64 = zlib.gzipSync(JSON.stringify(data)).toString('base64'), n = Math.ceil(b64.length / 6000);
    for (let i = 0; i < n; i++) console.log(`WORLDSDUMP ${name} ${i + 1}/${n} ${b64.slice(i * 6000, (i + 1) * 6000)}`); } }
for (const m of report.missing) console.log('WORLDS missing ' + JSON.stringify(m));
for (const m of report.uncurated) console.log('WORLDS uncurated ' + JSON.stringify(m));
for (const m of report.curatedGaps) console.log('WORLDS curated-gap ' + JSON.stringify(m));
for (const m of report.collectionGaps) console.log('WORLDS collection-gap ' + JSON.stringify(m));
for (const [kind, list] of Object.entries(chronoAudit)) for (const m of list) console.log(`CHRONO ${kind} ` + JSON.stringify(m));
