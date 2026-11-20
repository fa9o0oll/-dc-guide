// يبني حلقات كل عمل في قائمة «أنمياتي»: site/anime/data/eps/<رقم العمل في MyAnimeList>.json وفهرسها eps/index.json (رقم العمل ← عدد حلقاته المبنية).
// المصدر مواسم المسلسل في TMDB، وموضع حلقات العمل فيها من خريطة Fribb/anime-lists التي في الكتالوج (الموسم وإزاحة الحلقات)، والحكم تاريخ العرض:
// يُقبل الموضع حين يوافق تاريخ بداية العمل أو نهايته في MyAnimeList، وإن خالفه يُبحث في المسلسل كله عن الحلقة التي عُرضت يوم بدأ العمل
// (placeEpisodes في lib-anime.mjs). العمل الذي يمتد على مواسم المسلسل كلها (One Piece، Naruto: Shippuuden…) تُرقَّم حلقاته متصلة عبر المواسم.
// لا حلقات لـ: الأفلام وذوات الحلقة الواحدة، وما خريطته إلى «الحلقات الخاصة» (الموسم 0: ترقيمه في TMDB لا يُعتمد عليه)، وما لا مطابقة له.
// ترجماتنا في data/anime/episodes/tv-<رقم المسلسل في TMDB>.json: { "الموسمxالحلقة": { t: العنوان, o: الملخص, h: بصمة النص الإنجليزي } }، وتُلصق
// فقط حين تطابق بصمتها نص الحلقة الحالي. عند تعذّر TMDB لمسلسل تبقى ملفات أعماله السابقة كما هي. التقرير في data/generated/anime/episodes-report.json.
import fs from 'node:fs';
import crypto from 'node:crypto';
import net from 'node:net';
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { shapeEpisode, placeEpisodes, epPrint, epKey } from './lib-anime.mjs';

const root = new URL('../', import.meta.url), OUT = new URL('site/anime/data/', root), EPS = new URL('eps/', OUT), GEN = new URL('data/generated/anime/', root), MAL = new URL('mal/', GEN), TR = new URL('data/anime/episodes/', root);
fs.mkdirSync(EPS, { recursive: true });
const rd = (u, fb) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')); } catch { return fb; } };
const sha = s => crypto.createHash('sha1').update(s).digest('hex');
const report = { generatedAt: new Date().toISOString(), problems: [], works: 0, episodes: 0, how: {}, skipped: {}, withTitle: 0, withOverview: 0, withStill: 0, arabic: 0, staleArabic: [], moved: [], unsure: [], dropped: [], uneven: [], short: [], kept: 0, tmdbCalls: 0 };
const done = () => { fs.writeFileSync(new URL('episodes-report.json', GEN), JSON.stringify(report) + '\n'); console.log(JSON.stringify({ ...report, moved: report.moved.length, unsure: report.unsure.length, dropped: report.dropped.length, uneven: report.uneven.length, short: report.short.length, staleArabic: report.staleArabic.length }, null, 1)); };
const cat = rd(new URL('catalog.json', OUT), null), prevIndex = rd(new URL('index.json', EPS), {});
if (!cat?.anime?.length) { report.problems.push('لا كتالوج: يُبنى أولاً بـbuild-anime.mjs'); done(); process.exit(0); }
if (!hasKey()) { report.problems.push('TMDB_API_KEY غير موجود: تبقى الحلقات السابقة'); done(); process.exit(0); }

const mal = id => rd(new URL(id + '.json', MAL), null)?.d || null;
const skip = why => { report.skipped[why] = (report.skipped[why] || 0) + 1; };
// الأعمال التي تُبنى حلقاتها: ما في القائمة، مطابَق بمسلسل في TMDB، وليس فيلماً ولا ذا حلقة واحدة ولا من «الحلقات الخاصة»
const wanted = [];
for (const a of cat.anime) { if (a.ord == null) continue;
  if (a.type === 'Movie' || a.eps === 1) skip('فيلم أو حلقة واحدة'); else if (a.st === 'soon') skip('لم يُعرض بعد'); else if (!a.tm) skip('بلا مطابقة في TMDB'); else if (a.tm.k !== 'tv') skip('مطابَق بفيلم');
  else if (a.tm.s === 0) skip('في الحلقات الخاصة (الموسم 0)'); else wanted.push(a); }
const shows = new Map(); for (const a of wanted) (shows.get(a.tm.id) || shows.set(a.tm.id, []).get(a.tm.id)).push(a);
// كل ما في الكتالوج على المسلسل نفسه (ولو من أقرباء السلاسل): به تُعرف حدود كل عمل حين يتشارك عملان موسماً أو مسلسلاً
const onShow = new Map(); for (const a of cat.anime) if (a.tm?.k === 'tv') (onShow.get(a.tm.id) || onShow.set(a.tm.id, []).get(a.tm.id)).push(a);

const index = {}, built = new Set(), keep = a => { if (prevIndex[a.id]) { index[a.id] = prevIndex[a.id]; report.kept++; } };
const call = (p, q) => { report.tmdbCalls++; return tmdb(p, q); };
async function buildShow(tvId, works) { const seasons = new Map(); let nums = null;   // nums: وعد المسلسل كله، يُطلب مرة واحدة حين يُحتاج
  const season = async n => { if (!seasons.has(n)) seasons.set(n, call(`/tv/${tvId}/season/${n}`, { language: 'en-US' }).then(s => (s.episodes || []).map(shapeEpisode).sort((x, y) => x.ep - y.ep), e => { if (e.status === 404) return []; throw e; })); return seasons.get(n); };
  // المسلسل كله: مواسمه العادية بترتيبها (بلا الحلقات الخاصة)، قائمة واحدة متصلة
  const whole = () => nums ||= call(`/tv/${tvId}`, { language: 'en-US' }).then(async d => (await Promise.all((d.seasons || []).filter(s => s.season_number >= 1 && s.episode_count > 0).map(s => s.season_number).sort((x, y) => x - y).map(season))).flat());
  const tr = rd(new URL(`tv-${tvId}.json`, TR), {}), sib = onShow.get(tvId) || [], info = new Map(sib.map(x => [x.id, mal(x.id)]));
  // موضع التخمين لعمل بلا موسم: ما قبله من أعمال المسلسل نفسه بلا موسم، بترتيب بدايتها
  const loose = sib.filter(x => x.tm.s == null && (x.type === 'TV' || x.type === 'ONA') && x.eps !== 1).sort((x, y) => (info.get(x.id)?.from || '9') < (info.get(y.id)?.from || '9') ? -1 : 1), guess = new Map(); let acc = 0;
  for (const x of loose) { guess.set(x.id, x.tm.o || acc); acc = (x.tm.o || acc) + (info.get(x.id)?.eps || x.eps || 0); }
  const placed = [];
  for (const a of works) { const m = info.get(a.id) || {}, eps = m.eps ?? a.eps ?? 0, want = { eps, from: m.from || a.from, to: m.to };
    let flat, pl, all = false;
    if (a.tm.s != null) { flat = await season(a.tm.s); pl = placeEpisodes(flat, { ...want, start: a.tm.o || 0 });
      if (!pl || pl.how === 'map?') { const w = await whole(), base = w.findIndex(e => e.se === a.tm.s), p2 = placeEpisodes(w, { ...want, start: base < 0 ? -1 : base + (a.tm.o || 0) });   // التاريخ لم يوافق الخريطة: يُبحث في المسلسل كله
        if (p2 && (p2.how !== 'map?' || !pl)) { pl = p2; flat = w; all = true; } } }
    else { flat = await whole(); all = true; pl = placeEpisodes(flat, { ...want, start: guess.get(a.id) ?? 0 }); }
    if (!pl) { report.dropped.push(`${a.id} ${a.t}: tv/${tvId}${a.tm.s != null ? ' الموسم ' + a.tm.s : ''}، بدايته ${want.from || '؟'} ولا حلقة توافقها`); continue; }
    placed.push({ a, eps, flat, all, ...pl, want }); }
  for (const p of placed) { const { a, eps, flat, at, how } = p;
    // عدد لم يُعلن: حتى آخر الموسم (أو المسلسل)، أو حتى بداية العمل التالي عليه
    const nexts = placed.filter(q => q !== p && q.flat === flat && q.at > at).map(q => q.at), limit = Math.min(flat.length, ...nexts);
    let end = eps > 0 ? Math.min(flat.length, at + eps) : limit; if (!eps && a.tm.s != null) { let j = at; while (j < end && flat[j].se === flat[at].se) j++; end = j; }   // وعمل له موسم لا يتجاوز موسمه
    const list = flat.slice(at, end);
    if (!list.length) { report.dropped.push(`${a.id} ${a.t}: لا حلقات عند الموضع ${at}`); continue; }
    report.how[how] = (report.how[how] || 0) + 1;
    const tell = `${a.id} ${a.t}: tv/${tvId} ${list[0].se}x${list[0].ep} (${list[0].d || 'بلا تاريخ'})، بدايته ${p.want.from || '؟'}`;
    if (how === 'date') report.moved.push(`${tell}، والخريطة تقول ${a.tm.s != null ? `الموسم ${a.tm.s}` : 'بلا موسم'}${a.tm.o ? ' +' + a.tm.o : ''}`); else if (how === 'map?') report.unsure.push(tell);
    if (eps > 0 && list.length < eps) report.short.push(`${a.id} ${a.t}: ${list.length} من ${eps}`);
    if (a.tm.s != null && !p.all && eps > 0 && flat.length !== eps && !sib.some(x => x.id !== a.id && x.tm.s === a.tm.s)) report.uneven.push(`${a.id} ${a.t}: الموسم ${a.tm.s} في TMDB ${flat.length} حلقة، والعمل ${eps}`);
    const out = { id: a.id, tv: tvId, how, eps: list.map((e, i) => { const x = tr[epKey(e)], ok = x && x.h === epPrint(sha, e); if (x && !ok) report.staleArabic.push(`${a.id} ${a.t} الحلقة ${i + 1} (${epKey(e)})`); if (ok) report.arabic++;
      if (e.t) report.withTitle++; if (e.ov) report.withOverview++; if (e.st) report.withStill++;
      return { n: i + 1, se: e.se, ep: e.ep, ...(e.t ? { t: e.t } : {}), ...(e.d ? { d: e.d } : {}), ...(e.r ? { r: e.r } : {}), ...(e.ov ? { ov: e.ov } : {}), ...(e.st ? { st: e.st } : {}), ...(e.ra ? { ra: e.ra } : {}), ...(ok && x.t ? { ta: x.t } : {}), ...(ok && x.o ? { oa: x.o } : {}) }; }) };
    const file = new URL(a.id + '.json', EPS), text = JSON.stringify(out) + '\n'; let was = null; try { was = fs.readFileSync(file, 'utf8'); } catch {}
    if (was !== text) fs.writeFileSync(file, text);
    index[a.id] = list.length; built.add(a.id); report.works++; report.episodes += list.length; } }

const queue = [...shows]; let failed = 0;
await Promise.all(Array.from({ length: 10 }, async () => { for (let job; (job = queue.shift());) { const [tvId, works] = job;
  try { await buildShow(tvId, works); } catch (e) { failed++; works.forEach(keep); if (report.problems.length < 40) report.problems.push(`TMDB tv/${tvId} (${works.map(w => w.t).join('، ').slice(0, 80)}): ${e.message}`); } } }));
// ملف عمل لم يعد يُبنى (خرج من القائمة أو تغيّرت مطابقته) يُحذف. وما تعذّر مسلسله في هذا التشغيل يبقى
for (const f of fs.readdirSync(EPS)) { const id = +f.replace('.json', ''); if (id && !index[id]) fs.unlinkSync(new URL(f, EPS)); }
fs.writeFileSync(new URL('index.json', EPS), JSON.stringify(Object.fromEntries(Object.entries(index).sort((a, b) => a[0] - b[0]))) + '\n');
Object.assign(report, { shows: shows.size, showsFailed: failed, wanted: wanted.length });
done();
