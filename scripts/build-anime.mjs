// يبني بيانات «أنمياتي» في site/anime/data/ من data/anime/list.json (أرقام MyAnimeList بترتيب قائمة صاحب الموقع):
//   1) معلومات كل عمل من MyAnimeList: الأسماء، النوع، الحلقات، الموسم والسنة، الاستوديو، التصنيفات، التقييم، النبذة، والعلاقات
//      (جزء سابق، لاحق، قصة جانبية…) التي تُبنى منها السلاسل. المصدر واجهة MyAnimeList الرسمية بمفتاحها (MAL_CLIENT_ID)، وإن غاب المفتاح
//      أو تعذّرت فـJikan بلا مفتاح (طلب في الثانية؛ ومن خوادم GitHub لم يكن يُوصل إليه يوم كُتب هذا). لكل تشغيل حصة (ANIME_MAL_MAX)،
//      وما سُحب يُحفظ في data/generated/anime/mal/ فلا يُسحب ثانية إلا إذا قدُم: المعروض والقادم يومياً، والمنتهي كل 45 يوماً.
//   2) مطابقة كل عمل بـTMDB من خريطة Fribb/anime-lists (رقم المسلسل والموسم وإزاحة الحلقات)، ومن TMDB: البوستر بدقته العالية والخلفية،
//      والحلقة القادمة، وأين يُعرض رسمياً في السعودية (بيانات JustWatch) كما في بقية البوابات.
//   3) السلاسل: كل مجموعة أعمال تربطها علاقات القصة تصير «عالماً»، وأعماله التي ليست في القائمة تُسحب أيضاً ليكتمل الترتيب.
// المحتوى الإباحي (تصنيف Rx في MyAnimeList) لا يدخل الكتالوج ولا السلاسل. السجل الشخصي (الحالة والحلقات والتقييم) ليس هنا: يبقى في متصفح صاحبه.
// عند تعذّر مصدر تبقى بياناته السابقة كما هي، ويُكتب ما حدث في data/generated/anime/report.json.
import fs from 'node:fs';
import net from 'node:net';
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { COUNTRY } from './lib-films.mjs';
import { shapeMal, shapeMalApi, MAL_FIELDS, worldsOf, pickTmdb, LINKS } from './lib-anime.mjs';

const root = new URL('../', import.meta.url), SRC = new URL('data/anime/', root), OUT = new URL('site/anime/data/', root), GEN = new URL('data/generated/anime/', root), MAL = new URL('mal/', GEN);
for (const d of [OUT, GEN, MAL, new URL('texts/', OUT)]) fs.mkdirSync(d, { recursive: true });
const rd = (u, fb) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')); } catch { return fb; } };
const wr = (u, o) => fs.writeFileSync(u, JSON.stringify(o) + '\n');
const TODAY = new Date().toISOString().slice(0, 10), daysAgo = d => Math.round((Date.parse(TODAY) - Date.parse(d)) / 864e5);
const PROBE = !!process.env.ANIME_PROBE, MAX = +(process.env.ANIME_MAL_MAX || (PROBE ? 40 : 600)), RELATIVES_CAP = 4000;
const report = { generatedAt: new Date().toISOString(), problems: [], mal: { asked: 0, ok: 0, failed: 0, gone: 0, via: {} } };
const list = rd(new URL('list.json', SRC), []), translations = rd(new URL('translations.json', SRC), {});
if (!list.length) { console.error('data/anime/list.json فارغ'); process.exit(1); }

// ---------- 1) MyAnimeList: الواجهة الرسمية ثم Jikan
const cache = new Map();
for (const f of fs.readdirSync(MAL)) if (f.endsWith('.json')) { const r = rd(new URL(f, MAL), null); if (r?.id) cache.set(r.id, r); }
const wait = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'User-Agent': 'watch-guide-build/1.0 (https://github.com/fa9o0oll/-dc-guide)' }, CLIENT = (process.env.MAL_CLIENT_ID || '').trim();
// مصدر واحد: طلب بمهلة وإعادة محاولة عند 429 و5xx وانقطاع الشبكة، وبين كل طلبين فاصل المصدر. يعيد السجل مشكَّلاً، أو null إن حُذف العمل (404)
const source = (name, gapMs, url, headers, shape) => { let last = 0; return [name, async id => {
  for (let attempt = 1; ; attempt++) {
    const gap = gapMs - (Date.now() - last); if (gap > 0) await wait(gap); last = Date.now();
    let res; try { res = await fetch(url(id), { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (attempt >= 3) throw new Error(`network: ${e.cause?.code || e.name}`); await wait(1500 * attempt); continue; }
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) { if (attempt >= 4) throw new Error(`${name} ${res.status}`); await wait(res.status === 429 ? Math.min(30, +res.headers.get('retry-after') || 5) * 1000 : 2000 * attempt); continue; }
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    const j = await res.json(), d = shape(j); if (!d?.title) throw new Error(`${name}: رد بلا بيانات`); return d;
  } }]; };
const sources = [...(CLIENT ? [source('MAL API', 340, id => `https://api.myanimelist.net/v2/anime/${id}?fields=${MAL_FIELDS}`, { 'X-MAL-CLIENT-ID': CLIENT }, j => j?.id ? shapeMalApi(j) : null)] : []),
  source('Jikan', 1100, id => `https://api.jikan.moe/v4/anime/${id}/full`, {}, j => j?.data?.mal_id ? shapeMal(j.data) : null)];
const down = {};
const inList = new Set(list.map(x => x.mal));
const isAdult = r => r?.d?.rating === 'Rx' || r?.d?.nsfw === 1 || (r?.d?.genres || []).includes('Hentai');
// أقرباء السلسلة: ما تشير إليه علاقات القصة من أعمال ليست في القائمة، حتى الإغلاق
function relatives() { const seen = new Set(inList), out = [], queue = [...inList];
  while (queue.length && out.length < RELATIVES_CAP) { const r = cache.get(queue.shift()); if (!r?.d || isAdult(r)) continue;
    for (const x of r.d.rel || []) if (LINKS.has(x.r) && !seen.has(x.id)) { seen.add(x.id); out.push(x.id); queue.push(x.id); } }
  return out; }
const stale = id => { const r = cache.get(id); if (!r) return 1e6; if (r.gone) return daysAgo(r.at) > 90 ? 1 : 0;
  const live = r.d.status !== 'finished' || (r.d.to && daysAgo(r.d.to) < 21); const age = daysAgo(r.at); return live ? (age >= 1 ? 1000 + age : 0) : age > 45 ? age : 0; };
async function pull(ids, why) { for (const id of ids) { if (report.mal.asked >= MAX || sources.every(([n]) => down[n] >= 3)) return;
    report.mal.asked++; let got, errs = [];
    for (const [name, fn] of sources) { if (got !== undefined || down[name] >= 3) continue;
      try { got = await fn(id); down[name] = 0; report.mal.via[name] = (report.mal.via[name] || 0) + 1; } catch (e) { errs.push(e.message); down[name] = (down[name] || 0) + 1; } }
    if (got === undefined) { report.mal.failed++; if (report.problems.length < 40) report.problems.push(`MAL ${id} (${why}): ${errs.join(' | ')}`); continue; }
    const rec = got ? { id, at: TODAY, d: got } : { id, at: TODAY, gone: true }; if (got) report.mal.ok++; else report.mal.gone++;
    cache.set(id, rec); wr(new URL(id + '.json', MAL), rec); } }
// الترتيب: ما لم يُسحب قط من القائمة، ثم أقرباء السلاسل الناقصون، ثم ما قدُم (المعروض والقادم أولاً)
await pull(list.map(x => x.mal).filter(id => !cache.has(id)), 'جديد في القائمة');
await pull(relatives().filter(id => !cache.has(id)), 'قريب في سلسلة');
await pull([...cache.keys()].map(id => [id, stale(id)]).filter(x => x[1] > 0 && x[1] < 1e6).sort((a, b) => b[1] - a[1]).map(x => x[0]), 'تحديث');
if (sources.every(([n]) => down[n] >= 3)) report.problems.push(`MyAnimeList: لا مصدر متاح الآن (${sources.map(x => x[0]).join('، ')})، وتبقى البيانات السابقة`);

// ---------- الأعمال الداخلة: القائمة كلها (ولو لم تُسحب معلوماتها بعد) ثم أقرباء السلاسل المسحوبون. الإباحي يُستبعد
const rel = relatives(), all = [...list.map(x => x.mal), ...rel.filter(id => cache.get(id)?.d)].filter(id => !isAdult(cache.get(id)) && !cache.get(id)?.gone);
report.adultExcluded = [...list.map(x => x.mal), ...rel].filter(id => isAdult(cache.get(id))).length;
const basics = new Map(list.map(x => [x.mal, x]));

// ---------- 2) TMDB عبر خريطة Fribb/anime-lists
let fribb = null;
try { const res = await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json', { headers: UA, signal: AbortSignal.timeout(60000) }); if (!res.ok) throw new Error('HTTP ' + res.status);
  const arr = await res.json(), want = new Set(all); fribb = {};
  for (const e of arr) if (want.has(e.mal_id)) { const t = pickTmdb(e); if (t || e.simkl_id || e.anilist_id) fribb[e.mal_id] = { ...(t ? { tm: t } : {}), ...(e.simkl_id ? { simkl: e.simkl_id } : {}), ...(e.anilist_id ? { anilist: e.anilist_id } : {}), ...(e.imdb_id?.[0] ? { imdb: [].concat(e.imdb_id)[0] } : {}) }; }
  wr(new URL('map.json', GEN), fribb);
} catch (e) { report.problems.push(`خريطة Fribb/anime-lists: ${e.message}، تُستعمل الخريطة السابقة`); fribb = rd(new URL('map.json', GEN), {}); }

const providers = {}, provIds = l => [...new Set((l || []).map(p => { providers[p.provider_id] = { name: p.provider_name, logo: p.logo_path }; return p.provider_id; }))];
const provOf = wp => wp ? { link: wp.link || undefined, stream: provIds(wp.flatrate), free: provIds([...(wp.free || []), ...(wp.ads || [])]), rent: provIds(wp.rent), buy: provIds(wp.buy) } : null;
const tv = new Map(), movie = new Map(); let tmdbOk = hasKey();
if (!tmdbOk) report.problems.push('TMDB_API_KEY غير موجود: لا بوسترات عالية الدقة ولا أماكن عرض في هذا البناء');
else {
  const need = { tv: new Set(), movie: new Set() }; for (const id of all) { const t = fribb[id]?.tm; if (t) need[t.k].add(t.id); }
  const ids = { tv: [...need.tv], movie: [...need.movie] }; if (PROBE) { ids.tv.length = Math.min(ids.tv.length, 40); ids.movie.length = Math.min(ids.movie.length, 10); }
  let fails = 0;
  await Promise.all([...ids.tv.map(id => ['tv', id]), ...ids.movie.map(id => ['movie', id])].map(async ([k, id]) => {
    try { const d = await tmdb(`/${k}/${id}`, { language: 'en-US', append_to_response: 'watch/providers' });
      (k === 'tv' ? tv : movie).set(id, { poster: d.poster_path || null, backdrop: d.backdrop_path || null, prov: provOf(d['watch/providers']?.results?.[COUNTRY]),
        ...(k === 'tv' ? { seasons: Object.fromEntries((d.seasons || []).map(s => [s.season_number, { poster: s.poster_path || null, date: s.air_date || null, eps: s.episode_count || 0 }])),
          next: d.next_episode_to_air ? { season: d.next_episode_to_air.season_number, episode: d.next_episode_to_air.episode_number, date: d.next_episode_to_air.air_date } : null } : {}) }); }
    catch (e) { fails++; if (e.status !== 404 && report.problems.length < 60) report.problems.push(`TMDB ${k}/${id}: ${e.message}`); } }));
  report.tmdb = { tv: tv.size, movie: movie.size, failed: fails };
}
// غلاف بوابة «أنمياتي» في القاعة: للعمل المسمّى في data/anime/door.json بوستر بلا كتابة (الأعلى تقييماً بين بوسترات TMDB التي لا لغة لها) وخلفيته
let door = null;
if (tmdbOk) try { const t = fribb[rd(new URL('door.json', SRC), {}).mal]?.tm, T = t && (t.k === 'tv' ? tv : movie).get(t.id);
  if (T) { const im = await tmdb(`/${t.k}/${t.id}/images`, { include_image_language: 'null' }), best = (im.posters || []).filter(p => !p.iso_639_1 && p.height >= 1400).sort((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count || b.height - a.height)[0];
    door = { poster: best?.file_path || T.poster, backdrop: T.backdrop, textless: !!best }; } } catch (e) { report.problems.push(`غلاف البوابة: ${e.message}`); }
// عند تعذّر TMDB كله يبقى ما في الكتالوج السابق من صور ومنصات
const prevCat = rd(new URL('catalog.json', OUT), null), prevBy = new Map((prevCat?.anime || []).map(a => [a.id, a]));
if (!door && prevCat?.door) door = prevCat.door;
if (prevCat && tmdbOk && !tv.size && !movie.size) { tmdbOk = false; Object.assign(providers, prevCat.providers || {}); report.problems.push('TMDB لم يرد بشيء: تبقى صور الكتالوج السابق ومنصاته'); }

// ---------- 3) السلاسل
const worlds = worldsOf(all.map(id => { const d = cache.get(id)?.d, b = basics.get(id); return { id, rel: d?.rel || [], from: d?.from || null, type: d?.type || b?.type || '', eps: d ? d.eps : b?.eps || 0, title: d?.title || b?.title || '', en: d?.en || null, mine: inList.has(id) }; }));
const worldOf = new Map(); for (const w of worlds) for (const id of w.ids) worldOf.set(id, w.id);

// ---------- الكتالوج الخفيف (ما تحتاجه القوائم) والنصوص (ما تحتاجه بطاقة العمل)، موزعةً على 32 ملفاً
const genres = [], gi = name => { let i = genres.indexOf(name); if (i < 0) i = genres.push(name) - 1; return i; };
const texts = Array.from({ length: 32 }, () => ({}));
const anime = all.map((id, ord) => { const r = cache.get(id)?.d, b = basics.get(id), m = fribb[id] || {}, t = m.tm, prev = prevBy.get(id);
  const T = t && tmdbOk ? (t.k === 'tv' ? tv.get(t.id) : movie.get(t.id)) : null, S = T?.seasons?.[t?.s];
  const a = { id, t: r?.title || b?.title || String(id), type: r?.type || b?.type || '', eps: r ? r.eps : b?.eps || 0 };
  if (inList.has(id)) a.ord = ord; else a.x = 1;                 // x: ليس في القائمة، دخل لإكمال سلسلته
  if (r) { if (r.en && r.en !== a.t) a.en = r.en; if (r.year) a.y = r.year; if (r.season) a.se = r.season; a.st = r.status; if (r.from) a.from = r.from;
    if (r.img) a.img = r.img; if (r.score) { a.sc = r.score; a.sv = r.votes; } if (r.dur) a.dur = r.dur;
    const g = [...r.genres, ...r.themes, ...r.demo].map(gi); if (g.length) a.g = g; if (r.studios[0]) a.studio = r.studios[0]; if (r.rating) a.rating = r.rating; if (r.day) a.day = r.day; }
  else a.pending = 1;                                             // معلوماته تُسحب في بناء قادم
  if (worldOf.has(id)) a.w = worldOf.get(id);
  if (t) a.tm = t; if (m.simkl) a.sk = m.simkl;                    // رقم العمل في SIMKL: به يُطابَق سجل SIMKL حين لا يحمل رقم MyAnimeList
  if (tmdbOk) { const poster = (t?.k === 'tv' && t.s > 0 && S?.poster) || T?.poster; if (poster) a.tp = poster; if (T?.backdrop) a.bd = T.backdrop; if (T) a.pv = T.prov;
    if (T?.next && r?.status === 'airing' && (t.s == null || T.next.season === t.s)) a.nx = { ep: T.next.episode - (t.o || 0), date: T.next.date }; }
  else if (prev) for (const k of ['tp', 'bd', 'pv', 'nx']) if (prev[k] !== undefined) a[k] = prev[k];
  if (r) { const x = { en: r.synopsis || null }; if (translations[id]) x.ar = translations[id]; if (r.jp) x.jp = r.jp; if (r.syn.length) x.syn = r.syn; if (r.studios.length > 1) x.studios = r.studios; if (r.source) x.source = r.source;
    if (r.to) x.to = r.to; if (r.rank) x.rank = r.rank; if (r.trailer) x.trailer = r.trailer; if (r.stream.length) x.stream = r.stream; if (r.time) x.time = r.time;
    const rl = r.rel.filter(z => !isAdult(cache.get(z.id))); if (rl.length) x.rel = rl; if (m.simkl) x.simkl = m.simkl; if (m.anilist) x.anilist = m.anilist; if (m.imdb) x.imdb = m.imdb;
    texts[id % 32][id] = x; }
  return a; });
wr(new URL('catalog.json', OUT), { generatedAt: report.generatedAt, imageBase: 'https://image.tmdb.org/t/p/', malImages: 'https://cdn.myanimelist.net/images/anime/', country: COUNTRY, providers, genres, anime,
  worlds: worlds.map(w => ({ id: w.id, name: w.name, ...(w.en ? { en: w.en } : {}), head: w.head, ids: w.ids, ...(w.story ? { story: w.story } : {}) })), ...(door ? { door } : {}) });
texts.forEach((t, i) => wr(new URL(`texts/${i}.json`, OUT), t));

const mine = anime.filter(a => !a.x);
Object.assign(report, { list: list.length, catalog: anime.length, relatives: anime.length - mine.length, pending: mine.filter(a => a.pending).length, withMal: mine.filter(a => !a.pending).length,
  withTmdb: mine.filter(a => a.tm).length, withPoster: mine.filter(a => a.img || a.tp).length, withBackdrop: mine.filter(a => a.bd).length,
  withProviders: mine.filter(a => a.pv && ['stream', 'free', 'rent', 'buy'].some(k => a.pv[k].length)).length, providers: Object.keys(providers).length,
  airing: mine.filter(a => a.st === 'airing').length, withNext: mine.filter(a => a.nx).length, door, worlds: worlds.length, worldsWithStoryOrder: worlds.filter(w => w.story).length, worldsBiggest: worlds.slice().sort((a, b) => b.ids.length - a.ids.length).slice(0, 5).map(w => `${w.name} (${w.ids.length})`),
  arabic: mine.filter(a => translations[a.id]).length, cached: cache.size, missingRelatives: relatives().filter(id => !cache.has(id)).length });
if (PROBE) report.sample = { mal: cache.get(list[0].mal)?.d || null, entries: anime.slice(0, 3), text: texts[list[0].mal % 32][list[0].mal] || null }; // في فروع العمل: عيّنة تُقرأ في سجل البناء للتحقق من شكل البيانات
wr(new URL('report.json', GEN), report);
console.log(JSON.stringify(report, null, 1));
