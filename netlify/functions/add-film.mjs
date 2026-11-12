// دالة «أضف فيلماً»: تبحث في TMDB عن سطر مكتوب بحرّية (اسم وسنة)، ثم تضيف الفيلم المختار إلى data/films/added.json في المستودع،
// فيعاد بناء القائمة ويظهر الفيلم على كل الأجهزة. محمية بكلمة سر. المفاتيح تُقرأ من متغيرات Netlify ولا تُكتب في أي ملف:
//   TMDB_API_KEY  مفتاح TMDB        GH_TOKEN  رمز GitHub بصلاحية الكتابة على هذا المستودع        ADD_FILM_PASSWORD  كلمة السر
import { createHash, timingSafeEqual } from 'node:crypto';
import { tmdb, hasKey } from '../../scripts/lib-tmdb.mjs';
import { parseLine, search, shape, shapeCollection, detailPath, detailParams } from '../../scripts/lib-films.mjs';

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
    if (b.action === 'add') {
      const kind = b.kind === 'tv' ? 'tv' : 'movie', id = +b.tmdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
      const providers = {}, film = shape(kind, await tmdb(detailPath(kind, id), detailParams(kind)), providers);
      const collection = film.col ? await tmdb('/collection/' + film.col, { language: 'en-US' }).then(shapeCollection).catch(() => null) : null;
      const at = new Date().toISOString(), state = await record({ tmdb: id, kind, title: film.title, year: film.year, at });
      return json(200, { state, film: { ...film, src: 'added', addedAt: at }, collection, providers });
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
