// دالة ربط الحسابات (/api/accounts، E84): الربط مرة واحدة على الخادم، والمزامنة بالاتجاهين بين «أنمياتي» وMyAnimeList وSIMKL،
// وقائمة أفلامي وLetterboxd (E86)، والمسلسلات في دليلَي DC ومارفل وقائمة أفلامي وTrakt (E87).
// المنطق كله في scripts/lib-accounts.mjs، والرموز في Netlify Blobs لا تخرج منها. كل طلب (عدا رجوع MyAnimeList بعد الموافقة)
// محمي بكلمة سر «أضف لعبة» أو «أضف فيلماً» في الترويسة x-pass. لا يُكتب رمز ولا سر في السجل ولا في الرد.
//   GET  /api/accounts                 حال كل خدمة (مربوطة؟ آخر مزامنة؟ خطأ؟)
//   POST /api/accounts/link   {svc, from}   يبدأ الربط: رابط موافقة MyAnimeList أو Trakt، أو رمز SIMKL ورابطه
//   POST /api/accounts/poll   {svc}    هل وافقت على رمز SIMKL؟
//   GET  /api/accounts/callback/mal    رجوع MyAnimeList بعد الموافقة، ثم إلى «أنمياتي»
//   GET  /api/accounts/callback/trakt  رجوع Trakt بعد الموافقة، ثم إلى الدليل الذي بدأ الربط (dc أو marvel)
//   POST /api/accounts/unlink {svc}    يفصل الخدمة ويمحو رموزها
//   POST /api/accounts/sync   {guide, edits, full, eps, known, build, since}   تعديلات الصفحة إلى المحور، وما تغيّر من الخدمات إليها
//        (guide: anime، أو films: Letterboxd وTrakt وsince لكل منهما { f, s }، أو dc وmarvel: Trakt)
//   POST /api/accounts/link   {svc: 'letterboxd', user}   Letterboxd باسم صفحتك العامة وحده (E86)
//   POST /api/accounts/films/sent {kind, ids}   ما نزّلته في ملف استيراد Letterboxd صار معروفاً له
import { createHash, timingSafeEqual } from 'node:crypto';
import { blobStore, linkStart, linkPoll, linkCallback, unlink, linksOf, syncAnime, syncFilms, syncSeries, filmsSent, linkLetterboxd, SVC } from '../../scripts/lib-accounts.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const password = () => process.env.ADD_GAME_PASSWORD || process.env.ADD_FILM_PASSWORD;
const site = req => (process.env.URL || new URL(req.url).origin).replace(/\/$/, '');
// الرجوع بعد الموافقة: MyAnimeList إلى «أنمياتي»، وTrakt إلى الدليل الذي بدأ الربط
const back = (req, q, k = 'mal', from = '') => new Response(null, { status: 302, headers: { location: `${site(req)}/${k === 'mal' ? 'anime' : ['dc', 'marvel'].includes(from) ? from : 'dc'}/?${q}`, 'cache-control': 'no-store' } });
let testStore = null; export const _useStore = s => { testStore = s; };

export default async req => {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/accounts\/?/, '').replace(/\/$/, ''), S = testStore || await blobStore();
  const redirect = k => `${site(req)}/api/accounts/callback/${k}`;
  if (path === 'callback/mal' || path === 'callback/trakt') { const k = path.slice(9), err = url.searchParams.get('error'), from = (await S.get('pend/' + k))?.from || '';
    if (err) return back(req, `linked=${k}&fail=` + encodeURIComponent(err === 'access_denied' ? 'denied' : k), k, from);
    try { await linkCallback(S, k, url.searchParams.get('code') || '', url.searchParams.get('state') || '', redirect(k)); return back(req, `linked=${k}`, k, from); }
    catch (e) { return back(req, `linked=${k}&fail=` + encodeURIComponent(e.code || k), k, from); } }
  if (!password()) return json(500, { error: 'إعدادات الخادم ناقصة: كلمة السر (ADD_GAME_PASSWORD أو ADD_FILM_PASSWORD) غير موجودة في Netlify.' });
  const pass = req.headers.get('x-pass') || ''; if (!pass || !same(pass, password())) return json(401, { error: 'كلمة السر غير صحيحة.', pass: true });
  let body = {}; if (req.method === 'POST') { try { body = await req.json(); } catch { return json(400, { error: 'طلب غير مفهوم.' }); } }
  const svc = body.svc; if (['link', 'poll', 'unlink'].includes(path) && !SVC[svc] && !(svc === 'letterboxd' && path !== 'poll')) return json(400, { error: 'خدمة غير معروفة.' });
  try {
    if (req.method === 'GET' && !path) return json(200, { links: await linksOf(S) });
    if (path === 'link' && svc === 'letterboxd') return json(200, await linkLetterboxd(S, body.user));
    if (path === 'link') return json(200, await linkStart(S, svc, redirect(svc), String(body.from || '')));
    if (path === 'films/sent') { if (!await S.lock()) return json(202, { busy: true }); try { return json(200, await filmsSent(S, body.kind === 'next' ? 'next' : 'watched', Array.isArray(body.ids) ? body.ids.slice(0, 5000) : [])); } finally { await S.unlock(); } }
    if (path === 'poll') return json(200, await linkPoll(S, svc));
    if (path === 'unlink') { await unlink(S, svc); return json(200, { links: await linksOf(S) }); }
    if (path === 'sync') { if (!await S.lock()) return json(202, { busy: true });
      // السحب يسبق الدفع دائماً، فلا يغلب تعديلٌ قديم من جهاز كان بلا اتصال تعديلاً أحدث منه في حسابك
      try { const edits = Array.isArray(body.edits) ? body.edits.slice(0, 5000) : [], g = String(body.guide || 'anime'), dl = Date.now() + 6500, full = body.full || null;
        const known = Array.isArray(body.known) ? body.known.slice(0, 5000) : null, build = String(body.build || '');
        // قائمة أفلامي: أفلامها مع Letterboxd ومسلسلاتها مع Trakt، ولكلٍّ رقم مراجعته (since { f, s }؛ والرقم وحده من صفحة قديمة رقم الأفلام)
        if (g === 'films') { const sv = body.since && typeof body.since === 'object' ? body.since : { f: +body.since || 0, s: 0 }, lb = await S.get('tok/letterboxd'), tr = await S.get('tok/trakt');
          const F = await syncFilms(S, { edits, full, since: +sv.f || 0, pull: true }), R = tr ? await syncSeries(S, { guide: g, edits, full, known, build, since: +sv.s || 0, deadline: dl }) : null;
          return json(200, { rev: { f: F.rev, s: R ? R.rev : +sv.s || 0 }, changes: [...F.changes, ...(R?.changes || [])], lb: F.lb, needFull: !!F.needFull && !!lb, needAll: !!R?.needAll, needKnown: !!R?.needKnown, links: await linksOf(S) }); }
        // دليلا DC ومارفل: مسلسلاتهما مع Trakt، وأفلامهما مع محور الأفلام (قائمة أفلامي وLetterboxd، E90)، ولكلٍّ رقم مراجعته
        // (since { s, f }؛ والرقم وحده من صفحة قديمة رقم المسلسلات)
        if (g === 'dc' || g === 'marvel') { const sv = body.since && typeof body.since === 'object' ? body.since : { s: +body.since || 0, f: 0 };
          const R = await syncSeries(S, { guide: g, edits, full, known, build, since: +sv.s || 0, deadline: dl }), F = await syncFilms(S, { guide: g, edits, full, since: +sv.f || 0, pull: true, fresh: 120e3 });
          return json(200, { rev: { s: R.rev, f: F.rev }, changes: [...R.changes, ...F.changes], needAll: !!R.needAll, needKnown: !!R.needKnown, links: await linksOf(S) }); }
        const r = await syncAnime(S, { edits, full, eps: body.eps || null, build, since: +body.since || 0, pull: true, budget: 15, deadline: dl });
        return json(200, { ...r, links: await linksOf(S) }); }
      finally { await S.unlock(); } }
    return json(404, { error: 'غير موجود.' });
  } catch (e) { return json(['setup', 'state', 'user', 'gone'].includes(e.code) ? 400 : 502, { error: e.message || 'تعذّر الطلب.', code: e.code || '' }); }
};
export const config = { path: ['/api/accounts', '/api/accounts/*'] };
