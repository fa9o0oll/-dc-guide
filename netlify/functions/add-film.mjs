// دالة «أضف فيلماً»: تبحث في TMDB عن سطر مكتوب بحرّية (اسم وسنة)، وتجلب بطاقة كاملة لأي نتيجة للاطلاع (preview)، ثم تضيف المختار إلى data/films/added.json في المستودع،
// فيعاد بناء القائمة ويظهر الفيلم على كل الأجهزة. و worlds: سلسلة العمل وعالمه وأعماله المرتبطة من Wikidata (تطلبها الصفحة بعد فتح البطاقة، فلا تتأخر).
// محمية بكلمة سر. المفاتيح تُقرأ من متغيرات Netlify ولا تُكتب في أي ملف:
//   TMDB_API_KEY  مفتاح TMDB        GH_TOKEN  رمز GitHub بصلاحية الكتابة على هذا المستودع        ADD_FILM_PASSWORD  كلمة السر
import { createHash, timingSafeEqual } from 'node:crypto';
import { tmdb, hasKey } from '../../scripts/lib-tmdb.mjs';
import { parseLine, search, shape, shapeCollection, detailPath, detailParams } from '../../scripts/lib-films.mjs';
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
    const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: `films: add ${entry.title}${entry.year ? ` (${entry.year})` : ''}`, branch: BRANCH, ...(sha ? { sha } : {}),
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
  try {
    if (b.action === 'search') {
      const parsed = parseLine(String(b.q || '').slice(0, 200)); if (!parsed.title) return json(400, { error: 'اكتب اسم الفيلم.' });
      const [mv, tv] = await Promise.all([search(tmdb, 'movie', parsed.title, parsed.year), search(tmdb, 'tv', parsed.title, parsed.year)]);
      const movies = mv.scored.slice(0, 5).map(x => ({ kind: 'movie', c: x.c })), shows = tv.scored.filter(x => x.exact).slice(0, 2).map(x => ({ kind: 'tv', c: x.c }));
      const candidates = await Promise.all([...movies, ...shows].map(async ({ kind, c }, i) => {
        const col = kind === 'movie' && i < 4 ? (await tmdb('/movie/' + c.id).catch(() => null))?.belongs_to_collection?.name?.replace(/\s+Collection$/i, '') : null;
        return { tmdb: c.id, kind, title: c.title || c.name, year: year(c), poster: c.poster_path || null, collection: col || undefined }; }));
      return json(200, { parsed, sure: mv.sure, candidates });
    }
    // preview: بطاقة كاملة لعمل ليس في القائمة، دون إضافته. add: البطاقة نفسها ثم الحفظ في المستودع
    if (b.action === 'add' || b.action === 'preview') {
      const kind = b.kind === 'tv' ? 'tv' : 'movie', id = +b.tmdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
      const providers = {}, film = shape(kind, await tmdb(detailPath(kind, id), detailParams(kind)), providers);
      const collection = film.col ? await tmdb('/collection/' + film.col, { language: 'en-US' }).then(shapeCollection).catch(() => null) : null;
      if (b.action === 'preview') return json(200, { film, collection, providers });
      const at = new Date().toISOString(), state = await record({ tmdb: id, kind, title: film.title, year: film.year, at });
      return json(200, { state, film: { ...film, src: 'added', addedAt: at }, collection, providers });
    }
    // العالم: مهلة كلية تحت حد Netlify (٦٠ ثانية)، واستعلامات أقصر من البناء اليومي. الفشل لا يعطّل البطاقة: الصفحة تعرض ما لديها.
    if (b.action === 'worlds') {
      const kind = b.kind === 'tv' ? 'tv' : 'movie', id = +b.tmdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
      const key = (kind === 'tv' ? 't' : 'm') + id, budget = new Promise((_, no) => setTimeout(() => no(new Error('worlds timeout')), 45000));
      const work = (async () => {
        const opt = { timeout: 20000, tries: 2 }, r = await worldsFor([key], { tmdb, opt }), cols = {};
        // ترتيب الأحداث لعوالم العمل ولمجموعته في TMDB، من أدلة Wikipedia وTMDB وWikidata (scripts/lib-chrono.mjs)
        const self = await tmdb(detailPath(kind, id), { language: 'en-US' }).catch(() => null), date = (kind === 'tv' ? self?.first_air_date : self?.release_date) || null;
        const groups = (r.works[key]?.worlds || []).map(w => ({ w, keys: r.worlds[w].order, wide: ['universe', 'franchise'].includes(r.worlds[w].kind) })).filter(g => g.keys.length >= 2 && g.keys.length <= 40);
        const col = kind === 'movie' && self?.belongs_to_collection?.id ? await tmdb('/collection/' + self.belongs_to_collection.id, { language: 'en-US' }).then(shapeCollection).catch(() => null) : null;
        if (col?.parts.length > 1) groups.push({ c: col.id, keys: col.parts.map(p => 'm' + p.tmdb) });
        if (groups.length) { const ev = await gatherEvidence([...new Set(groups.flatMap(g => g.keys))], { tmdb, opt }).catch(() => ({})), part = new Map((col?.parts || []).map(p => ['m' + p.tmdb, p]));
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
