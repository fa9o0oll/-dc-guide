// يبني بيانات «أنمياتي» في site/anime/data/ من data/anime/list.json (أرقام MyAnimeList بترتيب قائمة صاحب الموقع):
//   1) معلومات كل عمل من MyAnimeList: الأسماء، النوع، الحلقات، الموسم والسنة، الاستوديو، التصنيفات، التقييم، النبذة، والعلاقات
//      (جزء سابق، لاحق، قصة جانبية…) التي تُبنى منها السلاسل. المصدر واجهة MyAnimeList الرسمية بمفتاحها (MAL_CLIENT_ID)، وإن غاب المفتاح
//      أو تعذّرت فـJikan بلا مفتاح (طلب في الثانية؛ ومن خوادم GitHub لم يكن يُوصل إليه يوم كُتب هذا). لكل تشغيل حصة (ANIME_MAL_MAX)،
//      وما سُحب يُحفظ في data/generated/anime/mal/ فلا يُسحب ثانية إلا إذا قدُم: المعروض والقادم يومياً، والمنتهي كل 45 يوماً.
//   2) مطابقة كل عمل بـTMDB من خريطة Fribb/anime-lists (رقم المسلسل والموسم وإزاحة الحلقات)، ومن TMDB: البوستر بدقته العالية والخلفية،
//      والحلقة القادمة، وأين يُعرض رسمياً في السعودية (بيانات JustWatch) كما في بقية البوابات.
//   3) السلاسل: كل مجموعة أعمال تربطها علاقات القصة تصير «عالماً»، وأعماله التي ليست في القائمة تُسحب أيضاً ليكتمل الترتيب.
// أعمال +18 (تصنيف Rx في MyAnimeList): ما في القائمة منها يدخل الكتالوج موسوماً (ad) فيخفيه فلتر العين في الصفحة (E65)، بنبذته وترجمتها كغيره (E69)، بلا صور TMDB ولا حلقات ولا سلسلة،
// وما ليس في القائمة (قريب في سلسلة) لا يدخل أصلاً. السجل الشخصي (الحالة والحلقات والتقييم) ليس هنا: يبقى في متصفح صاحبه.
// عند تعذّر مصدر تبقى بياناته السابقة كما هي، ويُكتب ما حدث في data/generated/anime/report.json.
import fs from 'node:fs';
import net from 'node:net';
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { COUNTRY } from './lib-films.mjs';
import { shapeMal, shapeMalApi, MAL_FIELDS, worldsOf, curatedOrder, linesOf, packLines, pickTmdb, LINKS, arNames } from './lib-anime.mjs';

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

// ---------- الأعمال الداخلة: القائمة كلها (ولو لم تُسحب معلوماتها بعد) ثم أقرباء السلاسل المسحوبون. +18 يدخل منه ما في القائمة وحده، موسوماً
const basics = new Map(list.map(x => [x.mal, x]));
const rel = relatives(), all = [...list.map(x => x.mal), ...rel.filter(id => cache.get(id)?.d && !isAdult(cache.get(id)))].filter(id => !cache.get(id)?.gone);
// +18: ما يقوله سجله في MyAnimeList، أو ما وُسم في القائمة حين أُضيف من بحث +18 ولم تُسحب معلوماته بعد
const adult = new Set(all.filter(id => inList.has(id) && (isAdult(cache.get(id)) || basics.get(id)?.ad)));
report.adult = adult.size; report.adultExcluded = rel.filter(id => isAdult(cache.get(id))).length;

// ---------- 2) TMDB عبر خريطة Fribb/anime-lists
let fribb = null;
try { const res = await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json', { headers: UA, signal: AbortSignal.timeout(60000) }); if (!res.ok) throw new Error('HTTP ' + res.status);
  const arr = await res.json(), want = new Set(all); fribb = {};
  for (const e of arr) if (want.has(e.mal_id)) { const t = pickTmdb(e); if (t || e.simkl_id || e.anilist_id) fribb[e.mal_id] = { ...(t ? { tm: t } : {}), ...(e.simkl_id ? { simkl: e.simkl_id } : {}), ...(e.anilist_id ? { anilist: e.anilist_id } : {}), ...(e.imdb_id?.[0] ? { imdb: [].concat(e.imdb_id)[0] } : {}) }; }
  wr(new URL('map.json', GEN), fribb);
} catch (e) { report.problems.push(`خريطة Fribb/anime-lists: ${e.message}، تُستعمل الخريطة السابقة`); fribb = rd(new URL('map.json', GEN), {}); }
// تصحيح يدوي لمطابقة TMDB (data/anime/tmdb.json): { "<رقم العمل>": { k: 'tv'|'movie', id, s?, o? } }، وnull يلغي مطابقة خاطئة. الخريطة تتبع بنية TVDB،
// وبعض ما هو موسم هناك مسلسل مستقل في TMDB (KanColle: Itsuka Ano Umi de)، وبعض الأعمال لا مطابقة لها فيها أصلاً. يُطبَّق على نسخة، فملف الخريطة يبقى كما جاء
const tmdbFix = rd(new URL('tmdb.json', SRC), {}); report.tmdbFixed = 0; fribb = { ...fribb };
for (const [id, t] of Object.entries(tmdbFix)) { if (!/^\d+$/.test(id)) continue; const m = { ...(fribb[id] || {}) }; if (t && (t.k === 'tv' || t.k === 'movie') && Number.isInteger(t.id)) m.tm = { k: t.k, id: t.id, ...(Number.isInteger(t.s) ? { s: t.s } : {}), ...(t.o > 0 ? { o: t.o } : {}) }; else if (t === null) delete m.tm; else continue; fribb[id] = m; report.tmdbFixed++; }
for (const id of adult) if (fribb[id]?.tm) { fribb[id] = { ...fribb[id] }; delete fribb[id].tm; }   // +18: لا شيء من TMDB (لا بوستر ولا منصات ولا حلقات)

const providers = {}, provIds = l => [...new Set((l || []).map(p => { providers[p.provider_id] = { name: p.provider_name, logo: p.logo_path }; return p.provider_id; }))];
const provOf = wp => wp ? { link: wp.link || undefined, stream: provIds(wp.flatrate), free: provIds([...(wp.free || []), ...(wp.ads || [])]), rent: provIds(wp.rent), buy: provIds(wp.buy) } : null;
const tv = new Map(), movie = new Map(); let tmdbOk = hasKey();
if (!tmdbOk) report.problems.push('TMDB_API_KEY غير موجود: لا بوسترات عالية الدقة ولا أماكن عرض في هذا البناء');
else {
  const need = { tv: new Set(), movie: new Set() }; for (const id of all) { const t = fribb[id]?.tm; if (t) need[t.k].add(t.id); }
  const ids = { tv: [...need.tv], movie: [...need.movie] }; if (PROBE) { ids.tv.length = Math.min(ids.tv.length, 40); ids.movie.length = Math.min(ids.movie.length, 10); }
  let fails = 0;
  await Promise.all([...ids.tv.map(id => ['tv', id]), ...ids.movie.map(id => ['movie', id])].map(async ([k, id]) => {
    // ومعها أسماؤه العربية (ترجماته وأسماؤه الأخرى) للبحث بها في «أنمياتي» (E70)، في الطلب نفسه
    try { const d = await tmdb(`/${k}/${id}`, { language: 'en-US', append_to_response: 'watch/providers,translations,alternative_titles' }), an = arNames(d);
      (k === 'tv' ? tv : movie).set(id, { poster: d.poster_path || null, backdrop: d.backdrop_path || null, prov: provOf(d['watch/providers']?.results?.[COUNTRY]), ...(an.length ? { an } : {}),
        ...(k === 'tv' ? { seasons: Object.fromEntries((d.seasons || []).map(s => [s.season_number, { poster: s.poster_path || null, date: s.air_date || null, eps: s.episode_count || 0 }])),
          next: d.next_episode_to_air ? { season: d.next_episode_to_air.season_number, episode: d.next_episode_to_air.episode_number, date: d.next_episode_to_air.air_date } : null } : {}) }); }
    catch (e) { fails++; if (e.status !== 404 && report.problems.length < 60) report.problems.push(`TMDB ${k}/${id}: ${e.message}`); } }));
  report.tmdb = { tv: tv.size, movie: movie.size, failed: fails };
}
// «وين أشاهد» بدقة الموسم: منصات TMDB المرفقة بالمسلسل تجمع مواسمه كلها. فحين يكون له أكثر من موسم عادي وله منصات في بلدنا، تُسأل منصات موسم العمل نفسه
// (/tv/<id>/season/<n>/watch/providers). للموسم منصات هنا: هي ما يُعرض (pvs). للموسم بيانات في بلدان أخرى ولا شيء هنا: لا منصة لهذا الموسم، وتُذكر
// منصات المسلسل «مواسم أخرى» (pvo). لا بيانات للموسم أصلاً، أو تعذّر السؤال: منصات المسلسل كما كانت
const hasProv = p => !!p && ['stream', 'free', 'rent', 'buy'].some(k => p[k].length), seasonProv = new Map();
if (tmdbOk) { const keys = new Set(); for (const id of all) { const t = fribb[id]?.tm, T = t?.k === 'tv' ? tv.get(t.id) : null; if (T && t.s >= 1 && hasProv(T.prov) && Object.keys(T.seasons).filter(n => +n >= 1).length > 1) keys.add(`${t.id}:${t.s}`); }
  const list = PROBE ? [...keys].slice(0, 10) : [...keys], c = report.seasonProviders = { asked: list.length, here: 0, elsewhere: 0, none: 0, failed: 0 };
  await Promise.all(list.map(async key => { const [id, n] = key.split(':'); try { const res = (await tmdb(`/tv/${id}/season/${n}/watch/providers`)).results || {}, here = provOf(res[COUNTRY]);
      if (hasProv(here)) { seasonProv.set(key, { here }); c.here++; } else if (Object.keys(res).length) { seasonProv.set(key, { away: true }); c.elsewhere++; } else c.none++; }
    catch { c.failed++; } })); }
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
// أعمال +18 لا تدخل سلسلة ولا تُدخَل فيها: علاقاتها تُترك، وعلاقات غيرها بها تُحذف
const items = all.map(id => { const d = cache.get(id)?.d, b = basics.get(id); return { id, rel: adult.has(id) ? [] : (d?.rel || []).filter(z => !adult.has(z.id)), from: d?.from || null, type: d?.type || b?.type || '', eps: d ? d.eps : b?.eps || 0, title: d?.title || b?.title || '', en: d?.en || null, mine: inList.has(id) }; });
const worlds = worldsOf(items), itemBy = new Map(items.map(x => [x.id, x]));
// ترتيب القصة المُراجَع (data/anime/orders.json): { "<رقم العمل الذي تحمل السلسلة اسمه>": { order: [أرقام الأعمال], note: "ملاحظة تظهر تحت الترتيب" } }.
// الترتيب المحسوب من علاقات MyAnimeList يكفي أكثر السلاسل؛ وهذا لما يخالف فيه الترتيبُ الزمني المعروف تلك العلاقات (Dragon Ball GT بعد Super، Hanamonogatari في آخر Monogatari)
const orders = rd(new URL('orders.json', SRC), {}); report.ordersApplied = 0; report.ordersLoose = [];
for (const w of worlds) { const o = orders[w.head] || orders[w.id]; if (!o) continue; report.ordersApplied++;
  if (Array.isArray(o.order) && o.order.length) { const c = curatedOrder(w.story || w.ids, o.order); if (c.loose.length) report.ordersLoose.push(`${w.name}: ${c.loose.join(' ')}`);
    if (c.order.join() !== w.ids.join()) w.story = c.order; else delete w.story; w.sv = 1; }
  if (typeof o.note === 'string' && o.note.trim()) w.sn = o.note.trim(); }
// خطوط القصة في كل سلسلة وما يُعرَّف به كل عمل (lib-anime: linesOf)، بعد الترتيب المُراجَع لأنها تتبعه. وفي orders.json تصحيحان مُراجَعان لما تخطئ فيه
// علاقات MyAnimeList: «main» أعمال من القصة الرئيسية لا تصلها بها علاقة «سابق/لاحق» (Dragon Ball Super)، و«as» أعمال تُفصل إلى خط بنوع ومرجع
// ({ "<رقم العمل>": ["a", <رقم أصله>] }؛ a نسخة أخرى، t عالم بديل، f متفرع، s جانبي، r ملخص)
report.lines = { worlds: 0, side: 0 };
for (const w of worlds) { const o = orders[w.head] || orders[w.id], order = w.story || w.ids;
  try { const L = linesOf(w.ids.map(id => itemBy.get(id)), order, { main: Array.isArray(o?.main) ? o.main : [], as: o?.as && typeof o.as === 'object' ? o.as : {} });
    if (L.ln.length > 1 || Object.keys(L.rf).length) { Object.assign(w, packLines(order, L)); report.lines.worlds++; report.lines.side += L.ln.length - 1; } }
  catch (e) { report.problems.push(`خطوط ${w.name}: ${e.message}`); } }
const worldOf = new Map(); for (const w of worlds) for (const id of w.ids) worldOf.set(id, w.id);

// ---------- لون غلاف كل عمل من AniList (متوسط ألوان الغلاف كما يحسبه AniList: coverImage.color)، منه ألوان بوابة عالمه ولمسة بطاقته.
// يُسأل خمسون عملاً في الطلب برقم MyAnimeList (طلب كل ثانيتين: حدّ AniList ثلاثون في الدقيقة حين يزدحم)، وما عُرف يُحفظ في
// data/generated/anime/colors.json فلا يُسأل ثانية، وما لا لون له هناك يُعاد بعد 60 يوماً
const COLORS = new URL('colors.json', GEN), colors = rd(COLORS, {}); report.colors = { asked: 0, got: 0 };
{ const need = all.filter(id => { const c = colors[id]; return c === undefined || (c && typeof c === 'object' && daysAgo(c.at) > 60); });
  for (let i = 0; i < need.length && report.colors.asked < (PROBE ? 3 : 90); i += 50) { const ids = need.slice(i, i + 50); report.colors.asked++;
    try { const res = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...UA },
        body: JSON.stringify({ query: 'query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal coverImage{color}}}}', variables: { ids } }), signal: AbortSignal.timeout(20000) });
      if (res.status === 429) { report.problems.push('AniList 429: تُكمَل الألوان في بناء قادم'); break; }
      if (!res.ok) throw new Error(`AniList ${res.status}`);
      const j = await res.json(), got = new Set();
      for (const m of j?.data?.Page?.media || []) { const c = m?.coverImage?.color; if (m?.idMal && /^#[0-9a-f]{6}$/i.test(c || '')) { colors[m.idMal] = c.slice(1).toLowerCase(); got.add(m.idMal); report.colors.got++; } }
      for (const id of ids) if (!got.has(id)) colors[id] = { at: TODAY };
      await wait(2100); }
    catch (e) { report.problems.push(`AniList: ${e.message}`); break; } }
  fs.writeFileSync(COLORS, JSON.stringify(colors) + '\n'); }

// ---------- الكتالوج الخفيف (ما تحتاجه القوائم) والنصوص (ما تحتاجه بطاقة العمل)، موزعةً على 32 ملفاً
const genres = [], gi = name => { let i = genres.indexOf(name); if (i < 0) i = genres.push(name) - 1; return i; };
const texts = Array.from({ length: 32 }, () => ({}));
const anime = all.map((id, ord) => { const r = cache.get(id)?.d, b = basics.get(id), ad = adult.has(id), m = fribb[id] || {}, t = ad ? null : m.tm, prev = ad ? null : prevBy.get(id);
  const T = t && tmdbOk ? (t.k === 'tv' ? tv.get(t.id) : movie.get(t.id)) : null, S = T?.seasons?.[t?.s];
  const a = { id, t: r?.title || b?.title || String(id), type: r?.type || b?.type || '', eps: r ? r.eps : b?.eps || 0 };
  if (inList.has(id)) a.ord = ord; else a.x = 1;                 // x: ليس في القائمة، دخل لإكمال سلسلته
  if (ad) a.ad = 1;                                               // +18: يخفيه فلتر العين. صورته من MyAnimeList، ولا شيء له من TMDB
  if (r) { if (r.en && r.en !== a.t) a.en = r.en; if (r.year) a.y = r.year; if (r.season) a.se = r.season; a.st = r.status; if (r.from) a.from = r.from;
    if (r.img) a.img = r.img; if (r.score) { a.sc = r.score; a.sv = r.votes; } if (r.dur) a.dur = r.dur;
    const g = [...r.genres, ...r.themes, ...r.demo].map(gi); if (g.length) a.g = g; if (r.studios[0]) a.studio = r.studios[0]; if (r.rating) a.rating = r.rating; if (r.day) a.day = r.day; }
  else a.pending = 1;                                             // معلوماته تُسحب في بناء قادم
  if (worldOf.has(id)) a.w = worldOf.get(id);
  if (typeof colors[id] === 'string') a.ac = colors[id];          // لون غلافه (AniList)، بلا #
  if (t) a.tm = t; if (m.simkl) a.sk = m.simkl;                    // رقم العمل في SIMKL: به يُطابَق سجل SIMKL حين لا يحمل رقم MyAnimeList
  // من TMDB: البوستر والخلفية، وأسماؤه العربية للبحث بها وحده (an، E70)، وأماكن العرض والحلقة القادمة
  if (tmdbOk) { const poster = (t?.k === 'tv' && t.s > 0 && S?.poster) || T?.poster; if (poster) a.tp = poster; if (T?.backdrop) a.bd = T.backdrop; if (T?.an) a.an = T.an; if (T) { a.pv = T.prov; const sp = t.k === 'tv' && t.s >= 1 ? seasonProv.get(`${t.id}:${t.s}`) : null;
      if (sp?.here) { a.pv = sp.here; a.pvs = 1; } else if (sp?.away) { a.pvo = T.prov; a.pv = { stream: [], free: [], rent: [], buy: [] }; a.pvs = 1; } }
    if (T?.next && r?.status === 'airing' && (t.s == null || T.next.season === t.s)) a.nx = { ep: T.next.episode - (t.o || 0), date: T.next.date }; }
  else if (prev) for (const k of ['tp', 'bd', 'pv', 'pvs', 'pvo', 'nx', 'an']) if (prev[k] !== undefined) a[k] = prev[k];
  if (r && ad) { const x = { en: r.synopsis || null }; if (translations[id]) x.ar = translations[id]; if (r.jp) x.jp = r.jp; if (r.syn.length) x.syn = r.syn; if (r.studios.length > 1) x.studios = r.studios; if (r.source) x.source = r.source; if (r.to) x.to = r.to;
    if (m.simkl) x.simkl = m.simkl; if (m.anilist) x.anilist = m.anilist; texts[id % 32][id] = x; }   // نبذته وترجمتها (E69)، بلا عرض دعائي ولا منصات ولا روابط أقرباء
  else if (r) { const x = { en: r.synopsis || null }; if (translations[id]) x.ar = translations[id]; if (r.jp) x.jp = r.jp; if (r.syn.length) x.syn = r.syn; if (r.studios.length > 1) x.studios = r.studios; if (r.source) x.source = r.source;
    if (r.to) x.to = r.to; if (r.rank) x.rank = r.rank; if (r.trailer) x.trailer = r.trailer; if (r.stream.length) x.stream = r.stream; if (r.time) x.time = r.time;
    const rl = r.rel.filter(z => !isAdult(cache.get(z.id)) && !adult.has(z.id)); if (rl.length) x.rel = rl; if (m.simkl) x.simkl = m.simkl; if (m.anilist) x.anilist = m.anilist; if (m.imdb) x.imdb = m.imdb;
    texts[id % 32][id] = x; }
  return a; });
wr(new URL('catalog.json', OUT), { generatedAt: report.generatedAt, imageBase: 'https://image.tmdb.org/t/p/', malImages: 'https://cdn.myanimelist.net/images/anime/', country: COUNTRY, providers, genres, anime,
  worlds: worlds.map(w => ({ id: w.id, name: w.name, ...(w.en ? { en: w.en } : {}), head: w.head, ids: w.ids, ...(w.story ? { story: w.story } : {}), ...(w.sv ? { sv: 1 } : {}), ...(w.sn ? { sn: w.sn } : {}), ...(w.lk ? { lk: w.lk, li: w.li, ri: w.ri } : {}) })), ...(door ? { door } : {}) });
// نبذة العالم المكتوبة (data/anime/worlds.json: رقم العمل الذي تحمل السلسلة اسمه ← النص) تُحمل مع نصوص ذلك العمل (wa)، فتُقرأ حين تُفتح نافذة السلسلة
const about = rd(new URL('worlds.json', SRC), {}); report.worldsAbout = 0;
for (const w of worlds) { const t = about[w.head] || about[w.id], x = texts[w.head % 32][w.head]; if (typeof t === 'string' && t.trim() && x) { x.wa = t.trim(); report.worldsAbout++; } }
texts.forEach((t, i) => wr(new URL(`texts/${i}.json`, OUT), t));

const mine = anime.filter(a => !a.x);
Object.assign(report, { list: list.length, catalog: anime.length, relatives: anime.length - mine.length, pending: mine.filter(a => a.pending).length, withMal: mine.filter(a => !a.pending).length,
  withTmdb: mine.filter(a => a.tm).length, withPoster: mine.filter(a => a.img || a.tp).length, withBackdrop: mine.filter(a => a.bd).length,
  withProviders: mine.filter(a => a.pv && ['stream', 'free', 'rent', 'buy'].some(k => a.pv[k].length)).length, providers: Object.keys(providers).length,
  airing: mine.filter(a => a.st === 'airing').length, withNext: mine.filter(a => a.nx).length, door, worlds: worlds.length, worldsWithStoryOrder: worlds.filter(w => w.story).length, worldsBiggest: worlds.slice().sort((a, b) => b.ids.length - a.ids.length).slice(0, 5).map(w => `${w.name} (${w.ids.length})`),
  arabic: mine.filter(a => translations[a.id]).length, arabicNames: { mine: mine.filter(a => a.an).length, all: anime.filter(a => a.an).length }, cached: cache.size, missingRelatives: relatives().filter(id => !cache.has(id)).length });
if (PROBE) report.sample = { mal: cache.get(list[0].mal)?.d || null, entries: anime.slice(0, 3), text: texts[list[0].mal % 32][list[0].mal] || null }; // في فروع العمل: عيّنة تُقرأ في سجل البناء للتحقق من شكل البيانات
wr(new URL('report.json', GEN), report);
console.log(JSON.stringify(report, null, 1));
