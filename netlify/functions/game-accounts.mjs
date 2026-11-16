// دالة «حساباتي» (/api/game-accounts): تسحب ما لعبته من حساباتك في المنصات وتطابقه بألعاب IGDB، لتسألك الصفحة عن كل لعبة: ختمتها؟ تلعبها؟ لاحقاً؟
//   Steam: رسمية. «ادخل عبر Steam» (OpenID) يعرّف حسابك بلا كلمة سر، ثم مكتبتك وساعات لعب كل لعبة من واجهة Steam بمفتاح STEAM_API_KEY.
//          يلزم أن تكون «تفاصيل الألعاب» في خصوصية ملفك على Steam عامة.
//   PlayStation: غير رسمية (مكتبة psn-api المفتوحة)، برمز NPSSO من حسابك: إما محفوظ في Netlify (PSN_NPSSO) أو تلصقه في الصفحة لمرة واحدة ولا يُحفظ.
//          تعطي الألعاب التي لعبتها على PS4 وPS5 وساعاتها، ونسبة الكؤوس والبلاتينيوم.
//   Xbox: عبر OpenXBL (خدمة وسيطة، مفتاحها من xbl.io): إما XBL_API_KEY في Netlify أو تلصقه لمرة واحدة.
//   Nintendo والجوال: لا واجهة تتيح سجل اللعب، فتُضاف يدوياً من «أضف لعبة».
// الطلبات (عدا رجوع Steam) محمية بكلمة سر «أضف لعبة». لا يُكتب أي رمز أو مفتاح في السجل أو في أي ملف.
import { createHash, timingSafeEqual } from 'node:crypto';
import { igdb, hasIgdb, quote, year } from '../../scripts/lib-igdb.mjs';
import { meta, gameyIds, igdbIn, EROTIC } from '../../scripts/lib-games.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const go = url => new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const wait = ms => new Promise(r => setTimeout(r, ms));
const password = () => process.env.ADD_GAME_PASSWORD || process.env.ADD_FILM_PASSWORD;
// سبب رفض تويتش للمفتاحين بلا أي سر: «invalid client secret» (السر) أو «invalid client» (المعرّف)
const igdbKeyError = msg => /invalid client secret/.test(msg) ? 'تويتش رفض السر: قيمة IGDB_CLIENT_SECRET في Netlify ليست سر التطبيق (ربما لُصق المعرّف مكانه، أو أُلغي بسر أحدث). عدّلها ثم أعد نشر الموقع.'
  : /invalid client/.test(msg) ? 'تويتش رفض المعرّف: قيمة IGDB_CLIENT_ID في Netlify غير صحيحة. عدّلها ثم أعد نشر الموقع.' : 'مفاتيح IGDB في Netlify غير صحيحة: راجع IGDB_CLIENT_ID وIGDB_CLIENT_SECRET.';
const STEAM_OP = 'https://steamcommunity.com/openid/login', NS = 'http://specs.openid.net/auth/2.0';
const fail = (msg, status = 400, extra = {}) => Object.assign(new Error(msg), { status, extra });

// ---------- تنظيف أسماء المتاجر قبل مطابقتها: علامات ™ و®، ومنصة الإصدار، والطبعات التي ليست لعبة مستقلة
export const clean = s => String(s || '').replace(/[™®©]/g, '').replace(/[’‘ʼ]/g, "'").replace(/\((?:ps[45]|playstation\s*[45]|xbox[^)]*|windows[^)]*|pc)\)/gi, '').replace(/\b(?:ps4\s*(?:&|and|\/)\s*ps5|ps5\s*(?:&|and|\/)\s*ps4)\b/gi, '')
  .replace(/\s*[-–—:]?\s*(?:digital\s+)?(?:standard|deluxe|digital deluxe|gold|ultimate|complete|premium|game of the year|goty|launch|cross-gen|ps[45]|playstation\s*[45])\s+edition\b/gi, '')
  .replace(/\s+(?:for|on)\s+(?:ps[45]|playstation\s*[45]|xbox(?: series x\|s| one)?|pc)\s*$/i, '').replace(/\s*[-–—]\s*(?:ps[45]|pc|xbox(?: series x\|s| one)?)\s*$/i, '').replace(/\s+/g, ' ').trim();
const norm = s => clean(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(?:the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const words = s => new Set(norm(s).split(' ').filter(Boolean));
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(A.size, B.size, 1); };
// مدة ISO مثل PT228H56M33S إلى ساعات
export const isoHours = d => { const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/); return m ? Math.round(((+m[1] || 0) * 24 + (+m[2] || 0) + (+m[3] || 0) / 60 + (+m[4] || 0) / 3600) * 10) / 10 : 0; };

// ---------- المطابقة بـ IGDB: Steam برقم اللعبة في متجره، والبقية بالاسم
// IGDB لا يقبل «search» داخل multiquery (يرجع فارغاً بلا خطأ، تحقّقنا منه على IGDB نفسه)، فالمطابقة بالاسم على مرحلتين:
//   1) الاسم كما هو بلا فرق الحروف الكبيرة والصغيرة (name ~)، عشرة أسماء في كل multiquery، فتُطابق أغلب الأسماء في ثانية أو اثنتين
//   2) البحث العادي لكل اسم بقي، بحد IGDB (أربعة في الثانية)، حتى تقترب مهلة الدالة؛ وما لم يُبحث عنه يُعاد «للمطابقة» فتطلبه الصفحة في دفعة تالية
// وبين أكثر من لعبة بالاسم نفسه (Resident Evil 4 الأصلية والجديدة مثلاً): التي على منصتك، ولا لعبة صدرت بعد آخر مرة لعبتها
const PID = { ps5: 167, ps4: 48, xsx: 169, xone: 49, x360: 12, pc: 6 }, FAM = { ps5: [167, 48], ps4: [48, 167], xsx: [169, 49], xone: [49, 169], x360: [12], pc: [6] };
let BUNDLE = null;
// متى تُقبل لعبة بالاسم نفسه؟ التي على منصتك أو عائلتها تُقبل. وما ليست عليها يلزمها ثلاثة: تاريخ صدور، لا يسبق منصتك بأكثر من ثلاث سنوات،
// وأن تكون لعبة معروفة (عشرون تقييماً فأكثر) أو اسمها مميّز (كلمتان فأكثر): «Hitman» على PS4 ليست لعبة 1984 بالاسم نفسه، و«Batman» ليست لعبة
// كمبيوتر مجهولة من 2010، ولا مدخلاً بلا تاريخ ولا منصات. (IGDB يفصل بعض المنافذ في مداخل مستقلة، فلعبة أصلها أركيد 2007 تُقبل لـ Xbox 360)
const LAUNCH = { x360: 2005, ps4: 2013, xone: 2013, ps5: 2020, xsx: 2020 };
const plausible = (x, g) => { const ps = g.platforms || [];
  if (x.plat && (ps.includes(PID[x.plat]) || ps.some(p => (FAM[x.plat] || []).includes(p)))) return true;
  const y = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null, n = norm(g.name);
  return y != null && (!LAUNCH[x.plat] || y >= LAUNCH[x.plat] - 3) && ((g.total_rating_count || 0) >= 20 || (n.includes(' ') && n.length >= 8)); };
// لعبة صدرت بعد آخر مرة لعبتها بأكثر من أربعة أشهر ليست هي (Resident Evil 4 الجديدة لمن لعبها في 2018)؛ وما دون ذلك يُقبل: نسخ تجريبية ووصول مبكر
const pick = (x, list, base) => { const last = x.last ? Date.parse(x.last) / 1000 + 120 * 86400 : Infinity, want = norm(x.name);
  return list.filter(g => !(g.first_release_date > last) && plausible(x, g)).map(g => ({ g, s: base(g, want) + ((g.platforms || []).includes(PID[x.plat]) ? 30 : (g.platforms || []).some(p => (FAM[x.plat] || []).includes(p)) ? 20 : 0)
    + Math.min(10, Math.log10((g.total_rating_count || 0) + 1) * 4) - (g.game_type === BUNDLE ? 15 : 0) })).sort((a, b) => b.s - a.s)[0]; };
const F = 'fields name,first_release_date,platforms,total_rating_count,game_type;';
async function byExact(items, T) {
  const out = new Map(), parts = []; for (let i = 0; i < items.length; i += 10) parts.push(items.slice(i, i + 10));
  await Promise.all(parts.map(async part => { const body = part.map((x, k) => `query games "${k}" { ${F} where name ~ ${quote(x.name)} & version_parent = null${T}; limit 15; };`).join('\n');
    for (const r of await igdb('multiquery', body)) { const x = part[+r.name], best = x && pick(x, r.result || [], () => 100); if (best) out.set(x.key, { id: best.g.id, sure: true }); } }));
  return out;
}
async function bySearch(x, T) {
  const best = pick(x, await igdb('games', `search ${quote(x.name)}; ${F} where version_parent = null${T}; limit 8;`), (g, want) => norm(g.name) === want ? 100 : overlap(g.name, x.name) * 80);
  return best && best.s >= 62 ? { id: best.g.id, sure: norm(best.g.name) === norm(x.name) } : null;
}
// يعيد ما طوبق (how) وما لم يُبحث عنه قبل المهلة (todo). خطأ IGDB في المرحلة الأولى يُرفع (لا يُعرض كأن الألعاب غير موجودة)
export async function byName(items, T, until = Infinity) {
  const how = await byExact(items, T), left = items.filter(x => !how.has(x.key)), todo = new Set(); let i = 0, fails = 0;
  const worker = async () => { while (i < left.length) { const x = left[i++]; if (Date.now() > until) { todo.add(x.key); continue; }
    try { const m = await bySearch(x, T); if (m) how.set(x.key, m); } catch { fails++; todo.add(x.key); } } };
  await Promise.all([0, 1, 2, 3].map(worker));
  if (fails && fails === left.length) throw new Error('igdb search failed');
  return { how, todo };
}
async function bySteam(appids) {
  const out = new Map(), list = [...new Set(appids.map(String))];
  for (let i = 0; i < list.length; i += 300) {
    const uids = list.slice(i, i + 300).map(u => quote(u)).join(',');
    let rows = await igdb('external_games', `fields game,uid; where uid = (${uids}) & external_game_source = 1; limit 500;`).catch(() => null);
    rows ??= await igdb('external_games', `fields game,uid; where uid = (${uids}) & category = 1; limit 500;`).catch(() => []);
    for (const r of rows) if (r.game && !out.has(String(r.uid))) out.set(String(r.uid), r.game);
  }
  return out;
}
// معلومات خفيفة لما طوبق: الاسم والغلاف والسنة، ومتوسط وقت الختم (لترجيح «ختمتها»)
async function describe(ids) {
  const [games, ttb] = await Promise.all([igdbIn('games', 'name,first_release_date,cover.image_id,themes', ids), igdbIn('game_time_to_beats', 'game_id,hastily,normally', ids, 'game_id').catch(() => [])]);
  const t = new Map(ttb.map(x => [x.game_id, { h: x.hastily ? Math.round(x.hastily / 360) / 10 : null, n: x.normally ? Math.round(x.normally / 360) / 10 : null }]));
  return new Map(games.filter(g => !(g.themes || []).includes(EROTIC)).map(g => [g.id, { title: g.name, year: year(g.first_release_date), cover: g.cover?.image_id || null, ttb: t.get(g.id) || null }]));
}
async function finish(source, items, how, todo = new Set()) {
  const ids = [...new Set([...how.values()].map(x => x.id))], info = ids.length ? await describe(ids) : new Map();
  const out = items.map(x => { const h = how.get(x.key), g = h && info.get(h.id); return g ? { ...x, igdb: h.id, sure: h.sure, ...g } : todo.has(x.key) ? { ...x, igdb: null, todo: true } : { ...x, igdb: null }; });
  return { source, total: out.length, matched: out.filter(x => x.igdb).length, todo: out.filter(x => x.todo).length, items: out };
}
// أنواع «اللعبة» ومعها المجموعات (Bundle): مجموعات مثل UNCHARTED: Legacy of Thieves Collection تُلعب كلعبة، وتأتي بعد اللعبة نفسها إن تشابه الاسمان
const typeFilter = async () => { const m = await meta(), t = gameyIds(m); BUNDLE = [...m.type].find(([, v]) => v === 'bundle')?.[0] ?? null;
  return t.length ? ` & game_type = (${[...t, ...(BUNDLE != null ? [BUNDLE] : [])].join(',')})` : ''; };
// دفعة مطابقة بالاسم تطلبها الصفحة بعد السحب (حتى لا تتجاوز أي دالة مهلتها مهما طالت قائمتك): حتى أربعين لعبة في كل مرة
async function match(b, until) {
  const PL = new Set(Object.keys(PID)), items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map(x => ({ key: String(x?.key || '').slice(0, 80), name: clean(String(x?.name || '').slice(0, 160)),
    plat: PL.has(x?.plat) ? x.plat : null, last: /^\d{4}-\d{2}-\d{2}$/.test(x?.last || '') ? x.last : null })).filter(x => x.key && x.name);
  if (!items.length) throw fail('لا ألعاب في الطلب.');
  const { how, todo } = await byName(items, await typeFilter(), until);
  return finish(String(b.source || 'match').replace(/[^a-z]/g, '').slice(0, 10), items, how, todo);
}

// ---------- المصادر
async function steam(b) {
  const key = process.env.STEAM_API_KEY; if (!key) throw fail('مفتاح Steam غير موجود في Netlify بعد (STEAM_API_KEY).', 503, { need: 'steam-key' });
  const id = /^\d{17}$/.test(String(b.steamid || '')) ? String(b.steamid) : process.env.STEAM_ID; if (!/^\d{17}$/.test(String(id || ''))) throw fail('ادخل عبر Steam أولاً ليُعرف حسابك.', 400, { need: 'steam-login' });
  const u = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/'); u.search = new URLSearchParams({ key, steamid: id, include_appinfo: '1', include_played_free_games: '1', format: 'json' });
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (r.status === 401 || r.status === 403) throw fail('مفتاح Steam في Netlify غير صالح (STEAM_API_KEY).', 502);
  if (!r.ok) throw fail('تعذّر الوصول إلى Steam الآن. حاول بعد قليل.', 502);
  const list = (await r.json())?.response?.games;
  if (!list) throw fail('Steam لم يُرجع مكتبتك: اجعل «تفاصيل الألعاب» عامة في إعدادات خصوصية ملفك على Steam ثم أعد المحاولة.', 422, { need: 'steam-private' });
  const items = list.filter(g => b.all || g.playtime_forever > 0).sort((a, b) => (b.rtime_last_played || 0) - (a.rtime_last_played || 0)).slice(0, 600)
    .map(g => ({ key: 'steam:' + g.appid, name: g.name, plat: 'pc', hours: Math.round((g.playtime_forever || 0) / 6) / 10, last: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString().slice(0, 10) : null }));
  const ids = await bySteam(items.map(x => x.key.slice(6))), how = new Map();
  for (const x of items) { const g = ids.get(x.key.slice(6)); if (g) how.set(x.key, { id: g, sure: true }); }
  return finish('steam', items, how, new Set(items.filter(x => !how.has(x.key)).map(x => x.key)));
}
async function psn(b) {
  const npsso = String(b.npsso || process.env.PSN_NPSSO || '').trim(); if (!npsso) throw fail('رمز NPSSO غير موجود: الصقه في الصفحة أو احفظه في Netlify (PSN_NPSSO).', 400, { need: 'psn-npsso' });
  if (!/^[A-Za-z0-9]{40,128}$/.test(npsso)) throw fail('هذا لا يشبه رمز NPSSO: انسخ قيمة npsso وحدها (حروف وأرقام بلا علامات تنصيص).', 400, { need: 'psn-npsso' });
  const api = await import('psn-api');
  let auth; try { auth = await api.exchangeAccessCodeForAuthTokens(await api.exchangeNpssoForAccessCode(npsso)); } catch { throw fail('رمز NPSSO غير صالح أو انتهت صلاحيته: خذ رمزاً جديداً وأعد المحاولة.', 401, { need: 'psn-npsso' }); }
  const played = []; for (let off = 0; off < 2000; off += 200) { const r = await api.getUserPlayedGames(auth, 'me', { limit: 200, offset: off, categories: 'ps4_game,ps5_native_game' }); played.push(...(r.titles || [])); if (!r.nextOffset || (r.titles || []).length < 200) break; }
  const trophies = []; for (let off = 0; off < 2400; off += 800) { const r = await api.getUserTitles(auth, 'me', { limit: 800, offset: off }).catch(() => null); trophies.push(...(r?.trophyTitles || [])); if (!r?.nextOffset) break; }
  const tro = new Map(trophies.map(t => [norm(t.trophyTitleName), t]));
  const seen = new Set(), items = [];
  for (const t of played) { const k = norm(t.name); if (!k || seen.has(k)) continue; seen.add(k);
    const tr = tro.get(k), plat = /ps5/i.test(t.category) ? 'ps5' : /pspc/i.test(t.category) ? 'pc' : 'ps4';
    items.push({ key: 'psn:' + (t.concept?.id || t.titleId), name: clean(t.localizedName || t.name) || t.name, plat, hours: isoHours(t.playDuration), last: t.lastPlayedDateTime ? t.lastPlayedDateTime.slice(0, 10) : null,
      progress: tr ? tr.progress : null, platinum: tr ? (tr.earnedTrophies?.platinum || 0) > 0 : false }); }
  const got = items.slice(0, 600); return finish('psn', got, new Map(), new Set(got.map(x => x.key)));
}
async function xbox(b) {
  const key = String(b.key || process.env.XBL_API_KEY || '').trim(); if (!key) throw fail('مفتاح OpenXBL غير موجود: الصقه في الصفحة أو احفظه في Netlify (XBL_API_KEY).', 400, { need: 'xbox-key' });
  const r = await fetch('https://xbl.io/api/v2/achievements', { headers: { 'X-Authorization': key, Accept: 'application/json', 'Accept-Language': 'en-US' }, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) throw fail('مفتاح OpenXBL غير صالح.', 401, { need: 'xbox-key' });
  if (r.status === 429) throw fail('تجاوزت حد OpenXBL للطلبات في الساعة. حاول بعد قليل.', 429);
  if (!r.ok) throw fail('تعذّر الوصول إلى Xbox عبر OpenXBL الآن.', 502);
  const j = await r.json(), list = j?.titles || j?.content?.titles || j?.data?.titles || (Array.isArray(j) ? j : []);
  const seen = new Set(), items = [];
  for (const t of list) { if (t?.type && !/game/i.test(t.type) && !/game/i.test(t.titleType || '')) continue; const k = norm(t?.name); if (!k || seen.has(k)) continue; seen.add(k);
    const dev = [...(t.devices || []), t.platform || ''].join(' '), a = t.achievement || {};
    const progress = a.progressPercentage ?? (t.maxGamerscore ? Math.round(100 * (t.currentGamerscore || 0) / t.maxGamerscore) : null);
    items.push({ key: 'xbox:' + (t.titleId || t.pfn || k), name: clean(t.name), plat: /series/i.test(dev) ? 'xsx' : /xboxone|xbox one/i.test(dev) ? 'xone' : /xbox360|xbox 360/i.test(dev) ? 'x360' : /pc|win32|windows/i.test(dev) ? 'pc' : 'xsx',
      hours: null, last: String(t.titleHistory?.lastTimePlayed || t.lastUnlock || '').slice(0, 10) || null, progress: progress ?? null }); }
  const got = items.slice(0, 600); return finish('xbox', got, new Map(), new Set(got.map(x => x.key)));
}

export default async req => {
  const t0 = Date.now(), url = new URL(req.url), origin = url.origin;
  // ---------- «ادخل عبر Steam» (OpenID 2.0): الذهاب، ثم الرجوع والتحقق من Steam نفسه، ثم إلى الصفحة برقم حسابك (رقم عام لا سرّي)
  if (req.method === 'GET' && url.searchParams.get('steam') === 'login') {
    const back = `${origin}/api/game-accounts?steam=back`, p = new URLSearchParams({ 'openid.ns': NS, 'openid.mode': 'checkid_setup', 'openid.return_to': back, 'openid.realm': origin + '/',
      'openid.identity': NS + '/identifier_select', 'openid.claimed_id': NS + '/identifier_select' });
    return go(`${STEAM_OP}?${p}`);
  }
  if (req.method === 'GET' && url.searchParams.get('steam') === 'back') {
    const q = url.searchParams, id = (q.get('openid.claimed_id') || '').match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)?.[1];
    const ok = id && q.get('openid.mode') === 'id_res' && q.get('openid.op_endpoint') === STEAM_OP && (q.get('openid.return_to') || '').startsWith(`${origin}/api/game-accounts?steam=back`);
    if (!ok) return go(`${origin}/games/#steam-fail`);
    const check = new URLSearchParams(); for (const [k, v] of q) if (k.startsWith('openid.')) check.set(k, v); check.set('openid.mode', 'check_authentication');
    const r = await fetch(STEAM_OP, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: check, signal: AbortSignal.timeout(15000) }).catch(() => null);
    return go(`${origin}/games/#${r?.ok && /is_valid\s*:\s*true/.test(await r.text()) ? 'steam=' + id : 'steam-fail'}`);
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!password()) return json(500, { error: 'إعدادات الخادم ناقصة: كلمة السر غير موجودة في Netlify.' });
  let b; try { b = await req.json(); } catch { return json(400, { error: 'طلب غير صالح.' }); }
  if (!b?.password || !same(b.password, password())) { await wait(700); return json(401, { error: 'password' }); }
  if (b.action === 'status') return json(200, { igdb: hasIgdb(), steam: !!process.env.STEAM_API_KEY, steamId: /^\d{17}$/.test(process.env.STEAM_ID || '') ? process.env.STEAM_ID : null, psn: !!process.env.PSN_NPSSO, xbox: !!process.env.XBL_API_KEY });
  if (!hasIgdb()) return json(503, { error: 'مفاتيح IGDB غير موجودة في Netlify بعد (IGDB_CLIENT_ID وIGDB_CLIENT_SECRET).', need: 'igdb' });
  try {
    if (b.action === 'steam') return json(200, await steam(b));
    if (b.action === 'psn') return json(200, await psn(b));
    if (b.action === 'xbox') return json(200, await xbox(b));
    if (b.action === 'match') return json(200, await match(b, t0 + 7000));
    return json(400, { error: 'طلب غير معروف.' });
  } catch (e) {
    if (e.status) return json(e.status, { error: e.message, ...e.extra });
    if (/twitch auth (400|401|403)/.test(e.message)) return json(502, { error: igdbKeyError(e.message), need: 'igdb' });
    console.error(e.name, e.message?.replace(/[A-Za-z0-9]{40,}/g, '…')); return json(502, { error: 'تعذّر إكمال الطلب الآن. حاول بعد قليل.' });
  }
};
export const config = { path: '/api/game-accounts' };
