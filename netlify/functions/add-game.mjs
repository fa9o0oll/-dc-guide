// دالة «أضف لعبة» (/api/add-game): تقترح أثناء الكتابة (suggest)، وتبحث في IGDB عن سطر مكتوب بحرّية (اسم وسنة)، وتجلب بطاقة كاملة لأي لعبة للاطلاع (preview)،
// ثم تضيف المختارة إلى data/games/added.json في المستودع (add)، أو دفعة ألعاب سُحبت من حساباتك في المنصات (import) بإيداع واحد، فيعاد بناء القائمة وتظهر على كل الأجهزة.
// وتحذف لعبة منه (remove) فتختفي من كل الأجهزة مع البناء القادم.
// محمية بكلمة سر. المفاتيح تُقرأ من متغيرات Netlify ولا تُكتب في أي ملف:
//   IGDB_CLIENT_ID وIGDB_CLIENT_SECRET  تطبيق في لوحة مطوري تويتش        GH_TOKEN  رمز GitHub بصلاحية الكتابة على هذا المستودع
//   ADD_GAME_PASSWORD  كلمة السر (وإن لم توجد فكلمة سر «أضف فيلماً» ADD_FILM_PASSWORD)
import { createHash, timingSafeEqual } from 'node:crypto';
import { igdb, igdbHealth, hasIgdb, quote, year } from '../../scripts/lib-igdb.mjs';
import { meta, gameyIds, gamesFor, famOf, codeOf, ABBR, EROTIC } from '../../scripts/lib-games.mjs';
import story from '../../data/games/story-orders.mjs';

const REPO = process.env.GH_REPO || 'fa9o0oll/-dc-guide', BRANCH = 'main', FILE = 'data/games/added.json';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const wait = ms => new Promise(r => setTimeout(r, ms));
const password = () => process.env.ADD_GAME_PASSWORD || process.env.ADD_FILM_PASSWORD;
// سبب رفض تويتش للمفتاحين بلا أي سر: «invalid client secret» (السر) أو «invalid client» (المعرّف)
const igdbKeyError = msg => /invalid client secret/.test(msg) ? 'تويتش رفض السر: قيمة IGDB_CLIENT_SECRET في Netlify ليست سر التطبيق (ربما لُصق المعرّف مكانه، أو أُلغي بسر أحدث). عدّلها ثم أعد نشر الموقع.'
  : /invalid client/.test(msg) ? 'تويتش رفض المعرّف: قيمة IGDB_CLIENT_ID في Netlify غير صحيحة. عدّلها ثم أعد نشر الموقع.' : 'مفاتيح IGDB في Netlify غير صحيحة: راجع IGDB_CLIENT_ID وIGDB_CLIENT_SECRET.';

// يضيف الألعاب إلى ملف المضافات في المستودع (ما كان فيه يُترك). يعيد المحاولة إن تغيّر الملف بين القراءة والكتابة.
export async function record(entries, message) {
  const api = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'watch-guide-add-game' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await fetch(`${api}?ref=${BRANCH}`, { headers }); let doc = { games: [] }, sha;
    if (cur.status === 200) { const j = await cur.json(); sha = j.sha; doc = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); doc.games ||= []; }
    else if (cur.status !== 404) throw Object.assign(new Error('GitHub read ' + cur.status), { gh: cur.status });
    const have = new Set(doc.games.map(g => +g.igdb)), fresh = entries.filter(e => !have.has(+e.igdb) && have.add(+e.igdb));
    if (!fresh.length) return { added: 0, exists: entries.length };
    doc.games.push(...fresh);
    const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: message(fresh), branch: BRANCH, ...(sha ? { sha } : {}),
      content: Buffer.from(JSON.stringify(doc, null, 1) + '\n').toString('base64') }) });
    if (put.ok) return { added: fresh.length, exists: entries.length - fresh.length };
    if (put.status !== 409 && put.status !== 422) throw Object.assign(new Error('GitHub write ' + put.status), { gh: put.status });
    await wait(400);
  }
  throw new Error('GitHub conflict');
}

// يحذف لعبة من ملف المضافات (حذف «أضف لعبة»). يعيد المحذوفة، أو null إن لم تكن فيه
export async function unrecord(id, message) {
  const api = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'watch-guide-add-game' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await fetch(`${api}?ref=${BRANCH}`, { headers }); if (cur.status === 404) return null;
    if (cur.status !== 200) throw Object.assign(new Error('GitHub read ' + cur.status), { gh: cur.status });
    const j = await cur.json(), doc = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), list = doc.games || [], gone = list.find(g => +g.igdb === id);
    if (!gone) return null;
    doc.games = list.filter(g => +g.igdb !== id);
    const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: message(gone), branch: BRANCH, sha: j.sha, content: Buffer.from(JSON.stringify(doc, null, 1) + '\n').toString('base64') }) });
    if (put.ok) return gone;
    if (put.status !== 409 && put.status !== 422) throw Object.assign(new Error('GitHub write ' + put.status), { gh: put.status });
    await wait(400);
  }
  throw new Error('GitHub conflict');
}

// عائلات المنصات (بتات) لنتائج البحث: 1 بلايستيشن، 2 إكس بوكس، 4 نينتندو، 8 كمبيوتر، 16 جوال
let PLAT = null;
const plats = () => PLAT ??= igdb('platforms', 'fields name,abbreviation,slug; limit 500;').then(list => new Map(list.map(p => [p.id, p]))).catch(e => { PLAT = null; throw e; });
const BIT = { ps: 1, xbox: 2, nin: 4, pc: 8, mobile: 16 };
const fams = (ids, P) => [...new Set((ids || []).map(id => BIT[famOf(P.get(id)?.name || '')] || 0))].reduce((a, b) => a | b, 0);
const abbrs = (ids, P) => [...new Set((ids || []).map(id => P.get(id)).filter(Boolean).map(p => ABBR[codeOf(p)] || p.abbreviation || p.name))].slice(0, 6);
// «Elden Ring 2022» أو «Elden Ring (2022)»: الاسم والسنة
export const parseLine = s => { s = String(s || '').replace(/\s+/g, ' ').trim(); const m = s.match(/^(.*?)[\s(]+((?:19[5-9]|20[0-4])\d)\)?$/); return m && m[1].trim() ? { title: m[1].trim(), year: +m[2] } : { title: s, year: null }; };
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// فحص بلا كلمة سر (GET /api/add-game): هل مفاتيح المنصات في Netlify صالحة؟ لا يكشف أي قيمة، والجواب السلبي يُحفظ عشرين ثانية فلا تُستنزف الخدمة
//   igdb: ok أو missing أو secret (تويتش رفض السر) أو id (رفض المعرّف) أو down
//   steam: ok أو missing أو bad (Steam رفض STEAM_API_KEY) أو down. الطلب بلا بيانات أي مستخدم (قائمة واجهات Steam)
async function steamHealth() {
  const key = String(process.env.STEAM_API_KEY || '').trim(); if (!key) return 'missing';
  try { const r = await fetch(`https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(6000) });
    return r.ok ? 'ok' : r.status === 401 || r.status === 403 ? 'bad' : 'down'; } catch { return 'down'; }
}
const memo = {};
const cached = async (k, f) => { const c = memo[k]; if (c && Date.now() < c.until) return c.v; const v = await f(); memo[k] = v === 'missing' ? null : { v, until: Date.now() + (v === 'ok' ? 600e3 : 20e3) }; return v; };
export default async req => {
  if (req.method === 'GET') { const [igdb, steam] = await Promise.all([cached('igdb', igdbHealth), cached('steam', steamHealth)]); return json(200, { igdb, steam }); }
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!password()) return json(500, { error: 'إعدادات الخادم ناقصة: كلمة السر (ADD_GAME_PASSWORD أو ADD_FILM_PASSWORD) غير موجودة في Netlify.' });
  let b; try { b = await req.json(); } catch { return json(400, { error: 'طلب غير صالح.' }); }
  if (!b?.password || !same(b.password, password())) { await wait(700); return json(401, { error: 'password' }); }
  // الحذف لا يحتاج IGDB: من ملف المضافات في المستودع مباشرة
  if (b.action === 'remove') {
    const id = +b.igdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
    if (!process.env.GH_TOKEN) return json(500, { error: 'إعدادات الخادم ناقصة: GH_TOKEN غير موجود في Netlify.' });
    try { const gone = await unrecord(id, g => `games: remove ${g.title || id}${g.year ? ` (${g.year})` : ''}`); return json(200, { state: gone ? 'removed' : 'absent' }); }
    catch (e) { if (e.gh === 401 || e.gh === 403 || e.gh === 404) return json(502, { error: 'تعذّر الحذف من GitHub: الرمز GH_TOKEN غير صالح أو بلا صلاحية الكتابة على المستودع.' }); console.error(e); return json(502, { error: 'تعذّر إكمال الحذف الآن. حاول بعد قليل.' }); }
  }
  if (!hasIgdb()) return json(503, { error: 'مفاتيح IGDB غير موجودة في Netlify بعد (IGDB_CLIENT_ID وIGDB_CLIENT_SECRET). أضفها ثم أعد نشر الموقع.', need: 'igdb' });
  try {
    const m = await meta(), types = gameyIds(m), T = types.length ? ` & game_type = (${types.join(',')})` : '';
    // اقتراحات أثناء الكتابة لما ليس في فهرس الصفحة: بحث IGDB نفسه بطلب واحد
    if (b.action === 'suggest') {
      const q = String(b.q || '').replace(/\s+/g, ' ').trim().slice(0, 80); if (q.length < 2) return json(200, { items: [] });
      const [list, P] = await Promise.all([igdb('games', `search ${quote(q)}; fields name,first_release_date,platforms,cover.image_id,themes; where version_parent = null${T}; limit 10;`), plats()]);
      return json(200, { items: list.filter(g => !(g.themes || []).includes(EROTIC)).slice(0, 6).map(g => ({ igdb: g.id, title: g.name, year: year(g.first_release_date), fams: fams(g.platforms, P), cover: g.cover?.image_id || null })) });
    }
    if (b.action === 'search') {
      const parsed = parseLine(String(b.q || '').slice(0, 200)); if (!parsed.title) return json(400, { error: 'اكتب اسم اللعبة.' });
      const F = `search ${quote(parsed.title)}; fields name,slug,first_release_date,game_type,cover.image_id,platforms,collections.name,themes,total_rating_count,hypes;`;
      const Y = parsed.year ? ` & first_release_date >= ${Date.UTC(parsed.year, 0, 1) / 1000} & first_release_date < ${Date.UTC(parsed.year + 1, 0, 1) / 1000}` : '';
      const P = await plats();
      let list = await igdb('games', `${F} where version_parent = null${T}${Y}; limit 15;`);
      if (!list.length && Y) list = await igdb('games', `${F} where version_parent = null${T}; limit 15;`);
      const want = norm(parsed.title), score = g => (norm(g.name) === want ? 1e6 : norm(g.name).startsWith(want) ? 1e5 : 0) + (g.total_rating_count || 0) * 10 + (g.hypes || 0);
      const candidates = list.filter(g => !(g.themes || []).includes(EROTIC)).sort((a, b) => score(b) - score(a)).slice(0, 8)
        .map(g => ({ igdb: g.id, title: g.name, year: year(g.first_release_date), cover: g.cover?.image_id || null, plats: abbrs(g.platforms, P), series: g.collections?.[0]?.name || undefined, type: m.type.get(g.game_type) || 'main' }));
      return json(200, { parsed, candidates });
    }
    // preview: بطاقة كاملة للعبة ليست في القائمة، دون إضافتها. add: البطاقة نفسها ثم الحفظ في المستودع
    if (b.action === 'preview' || b.action === 'add') {
      const id = +b.igdb; if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'معرّف غير صالح.' });
      if (b.action === 'add' && !process.env.GH_TOKEN) return json(500, { error: 'إعدادات الخادم ناقصة: GH_TOKEN غير موجود في Netlify.' });
      const r = await gamesFor([id], { wikidata: true, wdTimeout: 9000, story: story.series }), game = r.games[0];
      if (!game) return json(404, { error: 'هذه اللعبة غير موجودة في IGDB.' });
      if (b.action === 'preview') return json(200, { game, series: r.series, plats: r.plats, franchises: r.franchises });
      const at = new Date().toISOString(), state = await record([{ igdb: id, title: game.title, year: game.year, at }], f => `games: add ${f[0].title}${f[0].year ? ` (${f[0].year})` : ''}`);
      return json(200, { state: state.added ? 'added' : 'exists', game: { ...game, src: 'added', at }, series: r.series, plats: r.plats, franchises: r.franchises });
    }
    // دفعة من حساباتك في المنصات: كلها في إيداع واحد، وتعود بمعلوماتها (بلا Wikidata، يكملها البناء الليلي)
    if (b.action === 'import') {
      if (!process.env.GH_TOKEN) return json(500, { error: 'إعدادات الخادم ناقصة: GH_TOKEN غير موجود في Netlify.' });
      const ids = [...new Set((Array.isArray(b.items) ? b.items : []).map(x => +x?.igdb).filter(n => Number.isInteger(n) && n > 0))].slice(0, 400);
      if (!ids.length) return json(400, { error: 'لا ألعاب في الطلب.' });
      const r = await gamesFor(ids, { wikidata: false, story: story.series }), at = new Date().toISOString(), src = String(b.source || '').replace(/[^a-z]/g, '').slice(0, 10) || 'import';
      const state = await record(r.games.map(g => ({ igdb: g.id, title: g.title, year: g.year, at, from: src })), f => `games: import ${f.length} from ${src}`);
      return json(200, { state, games: r.games.map(g => ({ ...g, src: 'added', at })), series: r.series, plats: r.plats, franchises: r.franchises });
    }
    return json(400, { error: 'طلب غير معروف.' });
  } catch (e) {
    if (e.gh === 401 || e.gh === 403 || e.gh === 404) return json(502, { error: 'تعذّر الحفظ في GitHub: الرمز GH_TOKEN غير صالح أو بلا صلاحية الكتابة على المستودع.' });
    if (/twitch auth (400|401|403)/.test(e.message)) return json(502, { error: igdbKeyError(e.message), need: 'igdb' });
    console.error(e); return json(502, { error: 'تعذّر إكمال الطلب الآن. حاول بعد قليل.' });
  }
};
export const config = { path: '/api/add-game' };
