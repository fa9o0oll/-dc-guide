// تقييمات حية صحيحة (E93): تقييم الجمهور من IMDb، وتقييم النقاد من Rotten Tomatoes وMetacritic.
// - IMDb: ملف title.ratings.tsv.gz من ملفاتها الرسمية غير التجارية (datasets.imdbws.com، يتجدد كل يوم، للاستعمال الشخصي)، بلا مفتاح.
//   والتذييلات تنسبه إليها كما تشترط («Information courtesy of IMDb … Used with permission»).
// - النقاد: Rotten Tomatoes بلا واجهة مفتوحة، فيمرّان عبر OMDb بمفتاح OMDB_API_KEY (أسرار GitHub). المفتاح المجاني ألف طلب في اليوم،
//   فيُوزَّع: ما لم يُسأل عنه أولاً، ثم الأقدم سؤالاً (الحديث كل ثلاثة أيام، وغيره كل ثلاثة أسابيع)، ولا يتجاوز اليوم 950 طلباً مهما تكرر البناء.
//   والجواب يُحفظ في data/generated/ratings/omdb.json فلا يُسأل عنه كل مرة.
// يكتب لكل بوابة site/<البوابة>/data/ratings.json: { at, r: { رقم IMDb: [تقييم IMDb, أصواته, Rotten Tomatoes %, Metacritic] } }،
// وما تعذّر جلبه يبقى كما كان (لا يُمحى رقم لأن مصدره لم يُجب هذه المرة). والتقرير أعداد وأرقام بلا أسماء (data/generated/ratings/report.json).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import readline from 'node:readline';

const root = new URL('../', import.meta.url), GEN = new URL('data/generated/ratings/', root);
const rd = (u, fb) => { try { return fs.existsSync(u) ? JSON.parse(fs.readFileSync(u)) : fb; } catch { return fb; } };
const wr = (u, o) => { fs.mkdirSync(new URL('./', u), { recursive: true }); fs.writeFileSync(u, JSON.stringify(o)); };
const isId = x => typeof x === 'string' && /^tt\d{5,}$/.test(x);
const list = x => Array.isArray(x) ? x : x?.works || [];
export const IMDB_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';

// أرقام IMDb لكل بوابة: الأدلة من كتالوجها اليدوي، وقائمة أفلامي مما بناه build-films في هذا التشغيل
export function guideIds(base = root) {
  const u = p => new URL(p, base), ids = (p, f) => [...new Set(list(rd(u(p), [])).map(f).filter(isId))];
  return {
    dc: ids('data/works.json', w => w.ids?.imdb), marvel: ids('data/marvel/works.json', w => w.ids?.imdb), fate: ids('data/fate/works.json', w => w.ids?.imdb),
    films: [...new Set((rd(u('site/films/data/films.json'), {}).films || []).map(f => f.imdb).filter(isId))],
  };
}

// يقرأ الملف المضغوط سطراً سطراً ويحتفظ بما نطلبه وحده (الملف كله ملايين الأسطر)
export async function imdbRatings(want, fetcher = fetch) {
  const r = await fetcher(IMDB_URL, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('IMDb ' + r.status);
  const out = {}, lines = readline.createInterface({ input: Readable.fromWeb(r.body).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const l of lines) { const t = l.indexOf('\t'); if (t < 0) continue; const id = l.slice(0, t); if (!want.has(id)) continue;
    const [, avg, n] = l.split('\t'); const v = +avg, c = +n; if (v > 0) out[id] = [v, c || 0]; }
  return out;
}

// OMDb: «94%» و«80/100» إلى أرقام؛ وخطأ الحصة أو المفتاح يوقف السؤال (ويُذكر في التقرير)
export function omdbParse(j) {
  if (!j || j.Response === 'False') { const e = String(j?.Error || 'غير معروف'); return { stop: /limit|invalid api key|no api key/i.test(e) ? e : '', none: /not found|incorrect imdb/i.test(e) }; }
  const by = Object.fromEntries((j.Ratings || []).map(x => [x.Source, x.Value]));
  const rt = /^(\d{1,3})%$/.exec(by['Rotten Tomatoes'] || '')?.[1], mc = /^(\d{1,3})\/100$/.exec(by.Metacritic || '')?.[1] || (/^\d{1,3}$/.test(j.Metascore || '') ? j.Metascore : null);
  return { rt: rt != null ? +rt : null, mc: mc != null ? +mc : null };
}
const DAY_CAP = 950, RUN_CAP = 500, FRESH = 3 * 864e5, STALE = 21 * 864e5;
export function omdbQueue(ids, cache, recent, now = Date.now()) {
  const due = id => { const c = cache.items[id]; if (!c) return 0; const age = now - c.at; return age > (recent.has(id) ? FRESH : STALE) ? c.at : Infinity; };
  return ids.map(id => [id, due(id)]).filter(([, d]) => d !== Infinity).sort((a, b) => a[1] - b[1]).map(([id]) => id);
}
export async function omdbFill(ids, cache, { key, recent = new Set(), fetcher = fetch, now = Date.now(), day = new Date(now).toISOString().slice(0, 10) } = {}) {
  if (cache.day !== day) { cache.day = day; cache.used = 0; }
  const room = Math.max(0, Math.min(RUN_CAP, DAY_CAP - (cache.used || 0))), queue = omdbQueue(ids, cache, recent, now).slice(0, room), rep = { asked: 0, got: 0, stop: '' };
  for (let i = 0; i < queue.length && !rep.stop; i += 4) {
    await Promise.all(queue.slice(i, i + 4).map(async id => { if (rep.stop) return; rep.asked++; cache.used = (cache.used || 0) + 1;
      try { const r = await fetcher(`https://www.omdbapi.com/?i=${id}&apikey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15000) });
        const p = omdbParse(await r.json().catch(() => null)); if (p.stop) { rep.stop = p.stop; return; }
        cache.items[id] = { rt: p.rt ?? null, mc: p.mc ?? null, at: now }; rep.got++; }
      catch { /* شبكة: يُعاد في البناء القادم */ } }));
  }
  return rep;
}

// ---------- التشغيل
if (import.meta.url === `file://${process.argv[1]}`) {
  const G = guideIds(), all = new Set(Object.values(G).flat()), rep = { at: new Date().toISOString(), ids: all.size, imdb: { ok: false, found: 0 }, omdb: { key: !!process.env.OMDB_API_KEY } };
  const prev = Object.fromEntries(Object.keys(G).map(g => [g, rd(new URL(`site/${g}/data/ratings.json`, root), {}).r || {}]));
  let im = null; try { im = await imdbRatings(all); rep.imdb = { ok: true, found: Object.keys(im).length }; } catch (e) { rep.imdb.error = String(e.message || e).slice(0, 120); console.log('ratings: IMDb unreachable, keeping previous values:', rep.imdb.error); }
  const cache = rd(new URL('omdb.json', GEN), { day: '', used: 0, items: {} });
  if (process.env.OMDB_API_KEY) {
    // الحديث (صدر في آخر 120 يوماً) تتغير آراء نقاده أسرع، فيُسأل عنه أكثر
    const films = rd(new URL('site/films/data/films.json', root), {}).films || [], cut = Date.now() - 120 * 864e5;
    const recent = new Set(films.filter(f => f.date && Date.parse(f.date) > cut).map(f => f.imdb).filter(isId));
    for (const p of ['data/works.json', 'data/marvel/works.json']) for (const w of list(rd(new URL(p, root), []))) if (isId(w.ids?.imdb) && w.date && Date.parse(w.date) > cut) recent.add(w.ids.imdb);
    rep.omdb = { key: true, ...await omdbFill([...all], cache, { key: process.env.OMDB_API_KEY, recent }) }; wr(new URL('omdb.json', GEN), cache);
  }
  rep.omdb.cached = Object.keys(cache.items).length; rep.guides = {};
  for (const [g, ids] of Object.entries(G)) { const r = {};
    for (const id of ids) { const old = prev[g][id] || [], i = im ? im[id] : old.length ? [old[0], old[1]] : null, c = cache.items[id];
      const row = [i?.[0] ?? null, i?.[1] ?? null, c ? c.rt : old[2] ?? null, c ? c.mc : old[3] ?? null]; if (row.some(x => x != null)) r[id] = row; }
    wr(new URL(`site/${g}/data/ratings.json`, root), { at: rep.at, r });
    rep.guides[g] = { ids: ids.length, imdb: Object.values(r).filter(x => x[0] != null).length, rt: Object.values(r).filter(x => x[2] != null).length, mc: Object.values(r).filter(x => x[3] != null).length }; }
  wr(new URL('report.json', GEN), rep);
  console.log('ratings:', JSON.stringify({ ids: rep.ids, imdb: rep.imdb, omdb: rep.omdb, guides: rep.guides }));
}
