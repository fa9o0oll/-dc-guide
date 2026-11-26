// دالة «أضف فيلماً»: تقترح أثناء الكتابة (suggest)، وتبحث في TMDB عن سطر مكتوب بحرّية (اسم وسنة)، وتجلب بطاقة كاملة لأي نتيجة للاطلاع (preview)، ثم تضيف المختار إلى data/films/added.json في المستودع،
// فيعاد بناء القائمة ويظهر الفيلم على كل الأجهزة. و worlds: سلسلة العمل وعالمه وأعماله المرتبطة من Wikidata (تطلبها الصفحة بعد فتح البطاقة، فلا تتأخر).
// adult في الطلب: الفلتر مرفوع في الصفحة (E65، العين). البحث والاقتراح يعودان حينها بنتائجهما المعتادة ومعها ما وسمه TMDB للبالغين (موسوماً adult)، وبدونه
// لا يعودان بشيء منه؛ والإضافة والاطلاع والعالم تُرفض لعمل +18 والفلتر قائم. والمضاف منها يُوسم adult في الملف، وعنوان إيداعه برقمه بلا اسمه،
// ومعلوماته كاملة كغيره: طاقمه وسلسلته ومنصاته وعالمه (E75).
// محمية بكلمة سر. المفاتيح تُقرأ من متغيرات Netlify ولا تُكتب في أي ملف:
//   TMDB_API_KEY  مفتاح TMDB        GH_TOKEN  رمز GitHub بصلاحية الكتابة على هذا المستودع        ADD_FILM_PASSWORD  كلمة السر
import { createHash, timingSafeEqual } from 'node:crypto';
import { tmdb, hasKey } from '../../scripts/lib-tmdb.mjs';
import { parseLine, search, shape, shapeCollection, detailPath, detailParams, ADULT_PAGES } from '../../scripts/lib-films.mjs';
import { worldsFor } from '../../scripts/lib-worlds.mjs';
import { gatherEvidence, chronoOrder } from '../../scripts/lib-chrono.mjs';

const REPO = process.env.GH_REPO || 'fa9o0oll/-dc-guide', BRANCH = 'main', FILE = 'data/films/added.json';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const wait = ms => new Promise(r => setTimeout(r, ms));
const year = c => +(c.release_date || c.first_air_date || '').slice(0, 4) || null;

// يضيف السطر إلى ملف المضافات في المستودع. يعيد المحاولة إن تغيّر الملف بين القراءة والكتابة.
async function record(entry) {
  const api = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'watch-guide-add-film' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await fetch(`${api}?ref=${BRANCH}`, { headers }); let list = [], sha;
    if (cur.status === 200) { const j = await cur.json(); sha = j.sha; list = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); }
    else if (cur.status !== 404) throw Object.assign(new Error('GitHub read ' + cur.status), { gh: cur.status });
    if (list.some(x => x.tmdb === entry.tmdb && (x.kind || 'movie') === entry.kind)) return 'exists';
    list.push(entry);
    const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: entry.adult ? `films: add +18 (${entry.kind === 'tv' ? 't' : 'm'}${entry.tmdb})` : `films: add ${entry.title}${entry.year ? ` (${entry.year})` : ''}`, branch: BRANCH, ...(sha ? { sha } : {}),
      content: Buffer.from(JSON.stringify(list, null, 1) + '\n').toString('base64') }) });
    if (put.ok) return 'added';
    if (put.status !== 409 && put.status !== 422) throw Object.assign(new Error('GitHub write ' + put.status), { gh: put.status });
    await wait(400);
  }
  throw new Error('GitHub conflict');
}

export default async req => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!process.env.ADD_FILM_PASSWORD || !process.env.GH_TOKEN || !hasKey()) return json(500, { error: 'إعدادات الخادم ناقصة: أحد المتغيرات الثلاثة غير موجود في Netlify.' });
  let b; try { b = await req.json(); } catch { return json(400, { error: 'طلب غير صالح.' }); }
  if (!b?.password || !same(b.password, process.env.ADD_FILM_PASSWORD)) { await wait(700); return json(401, { error: 'password' }); }
  const adult = b.adult === true || b.adult === 1;
  try {
    // اقتراحات أثناء الكتابة لما ليس في فهرس الصفحة: بحث TMDB الموحد (أفلام ومسلسلات، ويطابق العناوين المترجمة والبديلة) بطلب واحد
    if (b.action === 'suggest') {
      const q = String(b.q || '').replace(/\s+/g, ' ').trim().slice(0, 80); if (q.length < 2) return json(200, { items: [] });
      // والفلتر مرفوع تُقرأ خمس صفحات: ما وسمه TMDB للبالغين يغيب عن الأولى (lib-films: ADULT_PAGES). فالأربعة الأولى كما يرتبها TMDB، ثم اثنان مما وُسم ودُفن تحتها
      const rs = await Promise.all((adult ? ADULT_PAGES : [1]).map(page => tmdb('/search/multi', { query: q, include_adult: adult, language: 'en-US', ...(page > 1 ? { page } : {}) }).catch(e => { if (page === 1) throw e; return {}; }))), seen = new Set();
      const all = rs.flatMap(r => r.results || []).filter(x => (x.media_type === 'movie' || x.media_type === 'tv') && (adult || !x.adult) && !seen.has(x.media_type + x.id) && seen.add(x.media_type + x.id));
      const top = all.slice(0, adult ? 4 : 6), items = [...top, ...(adult ? all.filter(x => x.adult && !top.includes(x)).slice(0, 2) : [])]
        .map(x => ({ tmdb: x.id, kind: x.media_type, title: x.title || x.name, year: year(x), poster: x.poster_path || null, adult: x.adult ? 1 : undefined }));
      return json(200, { items });
    }
    if (b.action === 'search') {
      const parsed = parseLine(String(b.q || '').slice(0, 200)); if (!parsed.title) return json(400, { error: 'اكتب اسم الفيلم.' });
      const [mv, tv] = await Promise.all([search(tmdb, 'movie', parsed.title, parsed.year, adult), search(tmdb, 'tv', parsed.title, parsed.year, adult)]);
      // النتائج المعتادة: خمسة أفلام، ومن المسلسلات ما طابق اسمه تماماً فقط. والفلتر مرفوع: تُضاف إليها أقرب أعمال +18 (ثلاثة أفلام وثلاثة مسلسلات، ولو لم
      // يطابق اسمها تماماً: كثير منها مسلسلات قصيرة في TMDB)، وكلٌّ في موضعه من الترتيب
      const usual = s => s.filter(x => !x.c.adult), x18 = s => adult ? s.filter(x => x.c.adult).slice(0, 3) : [], byScore = (a, b) => b.score - a.score;
      const movies = [...usual(mv.scored).slice(0, 5), ...x18(mv.scored)].sort(byScore).map(x => ({ kind: 'movie', c: x.c })), shows = [...usual(tv.scored).filter(x => x.exact).slice(0, 2), ...x18(tv.scored)].sort(byScore).map(x => ({ kind: 'tv', c: x.c }));
      const candidates = await Promise.all([...movies, ...shows].map(async ({ kind, c }, i) => {
        const col = kind === 'movie' && i < 4 ? (await tmdb('/movie/' + c.id).catch(() => null))?.belongs_to_collection?.name?.replace(/\s+Collection$/i, '') : null;
        return { tmdb: c.id, kind, title: c.title || c.name, year: year(c), poster: c.poster_path || null, collection: col || undefined, adult: c.adult ? 1 : undefined }; }));
      return json(200, { parsed, sure: mv.sure, candidates });
    }
    // preview: بطاقة كاملة لعمل ليس في القائمة، دون إضافته. add: البطاقة نفسها ثم الحفظ في المستودع
    if (b.action === 'add' || b.action === 'preview') {
      const kind = b.kind === 'tv' ? 'tv' : 'movie', id = +b.tmdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
      const providers = {}, film = shape(kind, await tmdb(detailPath(kind, id), detailParams(kind)), providers);
      if (film.adult && !adult) return json(422, { error: 'هذا العمل مصنَّف للبالغين: افتح العين أعلى الصفحة ثم أضفه.' });
      const collection = film.col ? await tmdb('/collection/' + film.col, { language: 'en-US' }).then(shapeCollection).catch(() => null) : null;
      if (b.action === 'preview') return json(200, { film, collection, providers });
      const at = new Date().toISOString(), state = await record({ tmdb: id, kind, title: film.title, year: film.year, at, ...(film.adult ? { adult: 1 } : {}) });
      return json(200, { state, film: { ...film, src: 'added', addedAt: at }, collection, providers });
    }
    // العالم: مهلة كلية تحت حد Netlify (٦٠ ثانية)، واستعلامات أقصر من البناء اليومي. الفشل لا يعطّل البطاقة: الصفحة تعرض ما لديها.
    if (b.action === 'worlds') {
      const kind = b.kind === 'tv' ? 'tv' : 'movie', id = +b.tmdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
      const key = (kind === 'tv' ? 't' : 'm') + id, budget = new Promise((_, no) => setTimeout(() => no(new Error('worlds timeout')), 45000));
      // العمل نفسه أولاً: عمل +18 والفلتر قائم لا يُبحث له عن عالم، وعالم عمل +18 يدخله ما خارج القائمة من +18 (lib-worlds: known.adult)
      const self = await tmdb(detailPath(kind, id), { language: 'en-US' }).catch(() => null), date = (kind === 'tv' ? self?.first_air_date : self?.release_date) || null;
      if (self?.adult && !adult) return json(422, { error: 'هذا العمل مصنَّف للبالغين: افتح العين أعلى الصفحة.' });
      const t0 = Date.now(), work = (async () => {
        const opt = { timeout: 20000, tries: 2 }, r = await worldsFor([key], { tmdb, opt, known: self ? { [key]: { title: self.title || self.name, date, ...(self.adult ? { adult: true } : {}) } } : {} }), cols = {};
        // ترتيب الأحداث لعوالم العمل ولمجموعته في TMDB، من أدلة Wikipedia وTMDB وWikidata (scripts/lib-chrono.mjs)
        const groups = (r.works[key]?.worlds || []).map(w => ({ w, keys: r.worlds[w].order, wide: ['universe', 'franchise'].includes(r.worlds[w].kind) })).filter(g => g.keys.length >= 2 && g.keys.length <= 40);
        const col = kind === 'movie' && self?.belongs_to_collection?.id ? await tmdb('/collection/' + self.belongs_to_collection.id, { language: 'en-US' }).then(shapeCollection).catch(() => null) : null;
        if (col?.parts.length > 1) groups.push({ c: col.id, keys: col.parts.map(p => 'm' + p.tmdb) });
        // الأدلة في ما بقي من المهلة: إن تأخرت يُعاد العالم بلا ترتيب أحداث بدل أن يضيع كله
        const left = Math.max(3000, 40000 - (Date.now() - t0));
        const ev = groups.length ? await Promise.race([gatherEvidence([...new Set(groups.flatMap(g => g.keys))], { tmdb, opt: { timeout: Math.min(15000, left), tries: 1 } }).catch(() => null), new Promise(ok => setTimeout(() => ok(null), left))]) : null;
        if (ev) { const part = new Map((col?.parts || []).map(p => ['m' + p.tmdb, p]));
          const meta = k => { const o = k === key ? { title: self?.title || self?.name, date } : r.basic[k] || part.get(k) || {}; return { k, title: o.title || k, date: o.date || null }; };
          for (const g of groups) { const c = chronoOrder(g.keys.map(meta), ev, { wide: g.wide }), moved = Object.keys(c.moved).length;
            const seen = g.keys.every(k => ev[k] && !ev[k].miss); if (!moved && !seen) continue;
            if (g.c) cols[g.c] = moved ? c : { chk: 1 }; else if (moved) r.worlds[g.w].chrono = c; else r.worlds[g.w].chk = 1; } }
        return { ...r, cols }; })();
      const r = await Promise.race([work, budget]);
      return json(200, { key, worlds: r.worlds, works: r.works, info: r.info, cols: r.cols });
    }
    return json(400, { error: 'طلب غير معروف.' });
  } catch (e) {
    if (e.gh === 401 || e.gh === 403 || e.gh === 404) return json(502, { error: 'تعذّر الحفظ في GitHub: الرمز GH_TOKEN غير صالح أو بلا صلاحية الكتابة على المستودع.' });
    if (e.status === 401) return json(502, { error: 'مفتاح TMDB_API_KEY في Netlify غير صالح.' });
    if (e.status === 404) return json(422, { error: 'هذا العمل غير موجود في TMDB.' });
    console.error(e); return json(502, { error: 'تعذّر إكمال الطلب الآن. حاول بعد قليل.' });
  }
};
export const config = { path: '/api/add-film' };
