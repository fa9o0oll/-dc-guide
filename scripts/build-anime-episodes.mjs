// يبني حلقات كل عمل في قائمة «أنمياتي»: site/anime/data/eps/<رقم العمل في MyAnimeList>.json وفهرسها eps/index.json (رقم العمل ← عدد حلقاته المبنية).
// المصدر مواسم المسلسل في TMDB قائمةً واحدة متصلة، وموضع حلقات العمل فيها من خريطة Fribb/anime-lists التي في الكتالوج (الموسم وإزاحة الحلقات)،
// والحكم تاريخ العرض وعدد الحلقات (placeEpisodes في lib-anime.mjs). يأخذ العمل عدد حلقاته في MyAnimeList من موضعه، ويعبر إلى الموسم التالي حين
// يقسمه TMDB مواسم (Cardcaptor Sakura، Pokemon…) ما دام ذلك الموسم قد بدأ قبل نهاية العمل، ويقف عند بداية عمل آخر ثبت موضعه. ولذلك يُوضع كل ما
// في الكتالوج على المسلسل، ولو من أقرباء السلاسل: بهم تُعرف الحدود. ما خريطته إلى «الحلقات الخاصة» (الموسم 0) أو لم يجد مكاناً في المواسم العادية
// تُؤخذ حلقاته من الموسم 0 حين يوافقه التاريخ والعدد معاً (pickSpecials). لا حلقات لـ: الأفلام وذوات الحلقة الواحدة، وما لا مطابقة له.
// تُبنى حلقات كل ما في الكتالوج: القائمة وأقرباء السلاسل (في التقرير أسماؤهم مسبوقة بـ~، وأعدادهم في relatives وrelEpisodes).
// وما لا مطابقة له في TMDB من القائمة، وما سقط، يُبحث عنه هناك باسمه وتُكتب المرشحات في data/generated/anime/tmdb-candidates.json:
// تُراجَع باليد ويُكتب الصحيح منها في data/anime/tmdb.json (يطبّقه بناء الكتالوج). لا يُقبل مرشح آلياً: اسم واحد قد يحمله مسلسلان.
// في ملف العمل: how طريقة الوضع، وfit حين لا يوافق العددُ عددَ MyAnimeList ('odd' فرق حلقات قليلة: تنبيه، 'loose' ترقيم آخر: تُعرض بلا تعليم).
// ترجماتنا في data/anime/episodes/tv-<رقم المسلسل في TMDB>.json: { "الموسمxالحلقة": { t: العنوان, o: الملخص, h: بصمة النص الإنجليزي } }، وتُلصق
// فقط حين تطابق بصمتها نص الحلقة الحالي. عند تعذّر TMDB لمسلسل تبقى ملفات أعماله السابقة كما هي. التقرير في data/generated/anime/episodes-report.json.
import fs from 'node:fs';
import crypto from 'node:crypto';
import net from 'node:net';
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { shapeEpisode, placeEpisodes, pickSpecials, epFit, epPrint, epKey } from './lib-anime.mjs';

const root = new URL('../', import.meta.url), OUT = new URL('site/anime/data/', root), EPS = new URL('eps/', OUT), GEN = new URL('data/generated/anime/', root), MAL = new URL('mal/', GEN), TR = new URL('data/anime/episodes/', root);
fs.mkdirSync(EPS, { recursive: true });
const rd = (u, fb) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')); } catch { return fb; } };
const sha = s => crypto.createHash('sha1').update(s).digest('hex');
const report = { generatedAt: new Date().toISOString(), problems: [], works: 0, episodes: 0, relatives: 0, relEpisodes: 0, how: {}, skipped: {}, withTitle: 0, withOverview: 0, withStill: 0, arabic: 0, staleArabic: [], moved: [], unsure: [], special: [], spans: [], dropped: [], short: [], over: [], loose: [], kept: 0, tmdbCalls: 0 };
const lists = ['moved', 'unsure', 'special', 'spans', 'dropped', 'short', 'over', 'loose', 'staleArabic'];
const done = () => { fs.writeFileSync(new URL('episodes-report.json', GEN), JSON.stringify(report) + '\n'); console.log(JSON.stringify({ ...report, ...Object.fromEntries(lists.map(k => [k, report[k].length])) }, null, 1)); };
const cat = rd(new URL('catalog.json', OUT), null), prevIndex = rd(new URL('index.json', EPS), {});
if (!cat?.anime?.length) { report.problems.push('لا كتالوج: يُبنى أولاً بـbuild-anime.mjs'); done(); process.exit(0); }
if (!hasKey()) { report.problems.push('TMDB_API_KEY غير موجود: تبقى الحلقات السابقة'); done(); process.exit(0); }

const mal = id => rd(new URL(id + '.json', MAL), null)?.d || null;
const skip = why => { report.skipped[why] = (report.skipped[why] || 0) + 1; };
// الأعمال التي تُبنى حلقاتها: ما في القائمة، مطابَق بمسلسل في TMDB، وليس فيلماً ولا ذا حلقة واحدة ولا منتظَراً
const wanted = [], ownsEpisodes = a => a.type !== 'Movie' && a.eps !== 1 && a.st !== 'soon', inList = a => a.ord != null, tag = a => inList(a) ? '' : '~';
for (const a of cat.anime) { const why = a.type === 'Movie' || a.eps === 1 ? 'فيلم أو حلقة واحدة' : a.st === 'soon' ? 'لم يُعرض بعد' : !a.tm ? 'بلا مطابقة في TMDB' : a.tm.k !== 'tv' ? 'مطابَق بفيلم' : '';
  if (!why) wanted.push(a); else if (inList(a)) skip(why); }
const shows = new Map(); for (const a of wanted) (shows.get(a.tm.id) || shows.set(a.tm.id, []).get(a.tm.id)).push(a);
// كل ما في الكتالوج على المسلسل نفسه (ولو من أقرباء السلاسل): به تُعرف حدود كل عمل حين يتشارك عملان موسماً أو مسلسلاً
const onShow = new Map(); for (const a of cat.anime) if (a.tm?.k === 'tv') (onShow.get(a.tm.id) || onShow.set(a.tm.id, []).get(a.tm.id)).push(a);

const index = {}, keep = a => { if (prevIndex[a.id]) { index[a.id] = prevIndex[a.id]; report.kept++; } };
const call = (p, q) => { report.tmdbCalls++; return tmdb(p, q); };
const today = new Date().toISOString().slice(0, 10), isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || ''), days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
async function buildShow(tvId, works) { const seasons = new Map();
  const season = n => { if (!seasons.has(n)) seasons.set(n, call(`/tv/${tvId}/season/${n}`, { language: 'en-US' }).then(s => (s.episodes || []).map(shapeEpisode).sort((x, y) => x.ep - y.ep), e => { if (e.status === 404) return []; throw e; })); return seasons.get(n); };
  // المسلسل كله: مواسمه العادية بترتيبها (بلا الحلقات الخاصة)، قائمة واحدة متصلة
  const w = (await Promise.all(((await call(`/tv/${tvId}`, { language: 'en-US' })).seasons || []).filter(s => s.season_number >= 1 && s.episode_count > 0).map(s => s.season_number).sort((x, y) => x - y).map(season))).flat();
  const tr = rd(new URL(`tv-${tvId}.json`, TR), {}), sib = (onShow.get(tvId) || []).filter(ownsEpisodes), info = new Map(sib.map(x => [x.id, mal(x.id) || {}])), mine = new Set(works.map(x => x.id));
  const wantOf = a => { const m = info.get(a.id); return { eps: m.eps ?? a.eps ?? 0, from: m.from || a.from, to: m.to, airing: (m.status || a.st) === 'airing' }; };
  const shape = () => { const m = new Map(); for (const e of w) (m.get(e.se) || m.set(e.se, []).get(e.se)).push(e); return [...m].map(([n, l]) => `م${n} ${l.length} حلقة (${l[0].d || '؟'}…${l.at(-1).d || '؟'})`).join('، ') || 'لا مواسم عادية'; };
  // موضع التخمين لعمل بلا موسم في الخريطة: ما قبله من أعمال المسلسل نفسه بلا موسم، بترتيب بدايتها
  const chain = sib.filter(x => x.tm.s == null && (x.type === 'TV' || x.type === 'ONA')).sort((x, y) => (wantOf(x).from || '9') < (wantOf(y).from || '9') ? -1 : 1), guess = new Map(); let acc = 0;
  for (const x of chain) { guess.set(x.id, x.tm.o || acc); acc = (x.tm.o || acc) + wantOf(x).eps; }
  const emit = (a, how, list, fit) => { report.how[how] = (report.how[how] || 0) + 1;
    const out = { id: a.id, tv: tvId, how, ...(fit ? { fit } : {}), eps: list.map((e, i) => { const x = tr[epKey(e)], ok = x && x.h === epPrint(sha, e); if (x && !ok) report.staleArabic.push(`${a.id} ${a.t} الحلقة ${i + 1} (${epKey(e)})`); if (ok) report.arabic++;
      if (e.t) report.withTitle++; if (e.ov) report.withOverview++; if (e.st) report.withStill++;
      return { n: i + 1, se: e.se, ep: e.ep, ...(e.t ? { t: e.t } : {}), ...(e.d ? { d: e.d } : {}), ...(e.r ? { r: e.r } : {}), ...(e.ov ? { ov: e.ov } : {}), ...(e.st ? { st: e.st } : {}), ...(e.ra ? { ra: e.ra } : {}), ...(ok && x.t ? { ta: x.t } : {}), ...(ok && x.o ? { oa: x.o } : {}) }; }) };
    const file = new URL(a.id + '.json', EPS), text = JSON.stringify(out) + '\n'; let was = null; try { was = fs.readFileSync(file, 'utf8'); } catch {}
    if (was !== text) fs.writeFileSync(file, text);
    index[a.id] = list.length; if (inList(a)) { report.works++; report.episodes += list.length; } else { report.relatives++; report.relEpisodes += list.length; } };
  // كل ما على المسلسل يُوضع (ولو لم يكن في القائمة): بدايات الأعمال التي ثبت موضعها هي حدود جيرانها
  const placed = [];
  for (const a of sib) { const want = wantOf(a); let pl = null;
    if (a.tm.s !== 0 && w.length) { const b = a.tm.s != null ? w.findIndex(e => e.se === a.tm.s) : 0; pl = placeEpisodes(w, { ...want, start: a.tm.s != null ? (b < 0 ? -1 : b + (a.tm.o || 0)) : guess.get(a.id) ?? 0 }); }
    if (pl) { placed.push({ a, want, ...pl }); continue; }
    if (!mine.has(a.id)) continue;
    const sp = pickSpecials(await season(0), want);   // لا مكان له في المواسم العادية: لعله في الحلقات الخاصة
    if (sp) { emit(a, 'special', sp, null); report.special.push(`${tag(a)}${a.id} ${a.t}: tv/${tvId} ${sp.map(epKey).join(' ')}`); }
    else if (a.tm.s === 0) { if (inList(a)) skip('في الحلقات الخاصة (الموسم 0) بلا شاهد من التاريخ والعدد'); }
    else report.dropped.push(`${tag(a)}${a.id} ${a.t}: tv/${tvId}${a.tm.s != null ? ' الموسم ' + a.tm.s : ''}${a.tm.o ? ' +' + a.tm.o : ''}، ${want.eps || '؟'} حلقة ${want.from || '؟'}…${want.to || '؟'}، وفي TMDB ${shape()}`); }
  const firm = placed.filter(p => p.how !== 'map?').map(p => p.at), starts = placed.map(p => p.at);
  // العبور إلى الموسم الذي يبدأ عند j: يُسمح حين عُرضت أولى حلقاته المؤرَّخة قبل نهاية العمل (+أسبوع)؛ وعمل ما زال يُعرض بلا عدد معلن يعبر إلى ما عُرض فعلاً
  const cross = (j, t, open) => { let k = j; while (k < w.length && w[k].se === w[j].se && !w[k].d) k++; const d = k < w.length && w[k].se === w[j].se ? w[k].d : null;
    return !!d && (t ? days(d, t) <= 7 : open && d <= today); };
  for (const p of placed) { const { a, at, how, want } = p, eps = want.eps, t = isDay(want.to) ? want.to : null; if (!mine.has(a.id)) continue;
    // بعدد حلقاته حتى بداية عمل ثبت موضعه؛ وما لم يُعلن عدده: حتى آخر موسمه (أو المسلسل لمن لا موسم له في الخريطة) أو بداية العمل التالي
    const cap = Math.min(w.length, ...(eps > 0 ? [at + eps, ...firm.filter(i => i > at)] : starts.filter(i => i > at)));
    let end = at; while (end < cap && (end === at || w[end].se === w[end - 1].se || (eps > 0 || a.tm.s == null ? cross(end, t, want.airing) : want.airing && cross(end, t, true)))) end++;
    if (end === at) { report.dropped.push(`${tag(a)}${a.id} ${a.t}: لا حلقات عند الموضع ${at}`); continue; }
    // ما بقي في موسمه بعده وعُرض قبل نهايته ولم يأخذه عمل آخر: المصدر يعدّ أكثر من MyAnimeList في المدة نفسها، فتُؤخذ معه (وتُعرض بلا تعليم)
    let over = 0; if (eps > 0 && t && end - at === eps) { const stop = Math.min(w.length, ...firm.filter(i => i >= end)); for (let k = end; k < stop && w[k].se === w[end - 1].se && w[k].d && days(w[k].d, t) <= 3; k++) over++; }
    const list = w.slice(at, end + over), fit = t && t <= today ? epFit(eps, end - at, over) : null, tell = `${tag(a)}${a.id} ${a.t}: tv/${tvId} ${epKey(list[0])} (${list[0].d || 'بلا تاريخ'})، بدايته ${want.from || '؟'}`;
    if (how === 'date') report.moved.push(`${tell}، والخريطة تقول ${a.tm.s != null ? `الموسم ${a.tm.s}` : 'بلا موسم'}${a.tm.o ? ' +' + a.tm.o : ''}`); else if (how === 'map?') report.unsure.push(tell);
    if (list.at(-1).se !== list[0].se) report.spans.push(`${tag(a)}${a.id} ${a.t}: ${list.length} حلقة من ${epKey(list[0])} إلى ${epKey(list.at(-1))}`);
    if (eps > 0 && list.length < eps && fit) report.short.push(`${tag(a)}${a.id} ${a.t}: ${list.length} من ${eps}`);
    if (over) report.over.push(`${tag(a)}${a.id} ${a.t}: ${eps} حلقة، وبعدها في موسمه ${over} عُرضت قبل نهايته`);
    if (fit === 'loose') report.loose.push(`${tag(a)}${a.id} ${a.t}: ${list.length} هنا و${eps} في MyAnimeList`);
    emit(a, how, list, fit); } }

const queue = [...shows], gone = []; let failed = 0;   // gone: أعمال حُذف مسلسلها من TMDB (404)، يُبحث لها عن مطابقة جديدة
await Promise.all(Array.from({ length: 10 }, async () => { for (let job; (job = queue.shift());) { const [tvId, works] = job;
  try { await buildShow(tvId, works); } catch (e) { failed++; works.forEach(keep); if (e.status === 404) gone.push(...works.map(w => w.id)); if (report.problems.length < 40) report.problems.push(`TMDB tv/${tvId} (${works.map(w => w.t).join('، ').slice(0, 80)}): ${e.message}`); } } }));
// ملف عمل لم يعد يُبنى (خرج من القائمة أو تغيّرت مطابقته) يُحذف. وما تعذّر مسلسله في هذا التشغيل يبقى
for (const f of fs.readdirSync(EPS)) { const id = +f.replace('.json', ''); if (id && !index[id]) fs.unlinkSync(new URL(f, EPS)); }
fs.writeFileSync(new URL('index.json', EPS), JSON.stringify(Object.fromEntries(Object.entries(index).sort((a, b) => a[0] - b[0]))) + '\n');
Object.assign(report, { shows: shows.size, showsFailed: failed, wanted: wanted.filter(inList).length, relWanted: wanted.length - wanted.filter(inList).length });

// ---------- مرشحو المطابقة: أعمال القائمة التي لا مطابقة لها (فيلم أو مسلسل أو ONA أو OVA، لا الحلقات الخاصة والملخصات: مكانها الموسم 0 في مسلسلها)، وما سقط
// من القائمة أو من أقربائها، وما حُذف مسلسله من TMDB. يُبحث بالاسم وبالاسم الإنجليزي وبهما بلا لاحقة الموسم وبالعنوان الفرعي، والعمل ذو الحلقة الواحدة يُبحث عنه فيلماً أيضاً
const fixed = rd(new URL('data/anime/tmdb.json', root), {}), lost = new Set([...report.dropped.map(l => +l.replace(/^~/, '').split(' ')[0]), ...gone]);
const orphans = cat.anime.filter(a => lost.has(a.id) || (inList(a) && a.st !== 'soon' && !a.tm && !(a.id in fixed) && ['Movie', 'TV', 'ONA', 'OVA'].includes(a.type)));
const yearOf = d => +(d || '').slice(0, 4) || 0, cands = [];
const variants = names => { const out = []; for (const n of names.filter(Boolean)) { out.push(n);
    const base = n.replace(/\s*[:\-–]?\s*(?:\d+(?:st|nd|rd|th) Season|Season \d+|Part \d+|\(\d{4}\)|\(TV\))\s*$/i, '').trim(); if (base && base !== n) out.push(base);
    const m = /^(.*?)(?: Movie(?: \d+)?)?:\s+(.+)$/.exec(n); if (m) out.push(m[2], m[1]); }
  return [...new Set(out)].slice(0, 5); };
await Promise.all(Array.from({ length: 6 }, async () => { for (let a; (a = orphans.shift());) { const m = mal(a.id) || {}, y = yearOf(m.from || a.from), out = [];
  for (const kind of a.type === 'Movie' ? ['movie'] : a.eps === 1 ? ['tv', 'movie'] : ['tv']) { const seen = new Map();
    for (const q of variants([a.t, a.en, m.en])) { try { for (const x of ((await call(`/search/${kind}`, { query: q, language: 'en-US', include_adult: 'false' })).results || []).slice(0, 6)) if (!seen.has(x.id)) seen.set(x.id, x); } catch {} }
    const near = x => Math.abs(yearOf(x.first_air_date || x.release_date) - y);
    for (const x of [...seen.values()].sort((x, z) => near(x) - near(z) || z.popularity - x.popularity).slice(0, 4)) { try { const d = await call(`/${kind}/${x.id}`, { language: 'en-US' });
      out.push(kind === 'movie' ? { k: 'movie', id: x.id, name: d.title, orig: d.original_title, date: d.release_date, min: d.runtime, genres: (d.genres || []).map(g => g.name).join('/') }
        : { k: 'tv', id: x.id, name: d.name, orig: d.original_name, date: d.first_air_date, eps: d.number_of_episodes, genres: (d.genres || []).map(g => g.name).join('/'), seasons: (d.seasons || []).map(s => `${s.season_number}:${s.episode_count}(${s.air_date || '?'})`).join(' ') }); } catch {} } }
  cands.push({ id: a.id, t: a.t, en: a.en || m.en || null, type: a.type, eps: m.eps ?? a.eps ?? 0, from: m.from || a.from || null, to: m.to || null, was: a.tm || null, cands: out }); } }));
fs.writeFileSync(new URL('tmdb-candidates.json', GEN), JSON.stringify(cands.sort((a, b) => a.id - b.id), null, 1) + '\n'); report.candidates = cands.length;
done();
