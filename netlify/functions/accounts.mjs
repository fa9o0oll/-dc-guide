// دالة ربط الحسابات (/api/accounts، E84): الربط مرة واحدة على الخادم، والمزامنة بالاتجاهين بين «أنمياتي» وMyAnimeList وSIMKL.
// المنطق كله في scripts/lib-accounts.mjs، والرموز في Netlify Blobs لا تخرج منها. كل طلب (عدا رجوع MyAnimeList بعد الموافقة)
// محمي بكلمة سر «أضف لعبة» أو «أضف فيلماً» في الترويسة x-pass. لا يُكتب رمز ولا سر في السجل ولا في الرد.
//   GET  /api/accounts                 حال كل خدمة (مربوطة؟ آخر مزامنة؟ خطأ؟)
//   POST /api/accounts/link   {svc}    يبدأ الربط: رابط موافقة MyAnimeList، أو رمز SIMKL ورابطه
//   POST /api/accounts/poll   {svc}    هل وافقت على رمز SIMKL؟
//   GET  /api/accounts/callback/mal    رجوع MyAnimeList بعد الموافقة، ثم إلى «أنمياتي»
//   POST /api/accounts/unlink {svc}    يفصل الخدمة ويمحو رموزها
//   POST /api/accounts/sync   {edits, full, eps, build, since}   تعديلات الصفحة إلى المحور، وما تغيّر من الخدمات إليها
import { createHash, timingSafeEqual } from 'node:crypto';
import { blobStore, linkStart, linkPoll, linkCallback, unlink, linksOf, syncAnime, SVC } from '../../scripts/lib-accounts.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const password = () => process.env.ADD_GAME_PASSWORD || process.env.ADD_FILM_PASSWORD;
const site = req => (process.env.URL || new URL(req.url).origin).replace(/\/$/, '');
const back = (req, q) => new Response(null, { status: 302, headers: { location: `${site(req)}/anime/?${q}`, 'cache-control': 'no-store' } });
let testStore = null; export const _useStore = s => { testStore = s; };

export default async req => {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/accounts\/?/, '').replace(/\/$/, ''), S = testStore || await blobStore();
  const redirect = `${site(req)}/api/accounts/callback/mal`;
  if (path === 'callback/mal') { const err = url.searchParams.get('error');
    if (err) return back(req, 'linked=mal&fail=' + encodeURIComponent(err === 'access_denied' ? 'denied' : 'mal'));
    try { await linkCallback(S, 'mal', url.searchParams.get('code') || '', url.searchParams.get('state') || '', redirect); return back(req, 'linked=mal'); }
    catch (e) { return back(req, 'linked=mal&fail=' + encodeURIComponent(e.code || 'mal')); } }
  if (!password()) return json(500, { error: 'إعدادات الخادم ناقصة: كلمة السر (ADD_GAME_PASSWORD أو ADD_FILM_PASSWORD) غير موجودة في Netlify.' });
  const pass = req.headers.get('x-pass') || ''; if (!pass || !same(pass, password())) return json(401, { error: 'كلمة السر غير صحيحة.', pass: true });
  let body = {}; if (req.method === 'POST') { try { body = await req.json(); } catch { return json(400, { error: 'طلب غير مفهوم.' }); } }
  const svc = body.svc; if (['link', 'poll', 'unlink'].includes(path) && !SVC[svc]) return json(400, { error: 'خدمة غير معروفة.' });
  try {
    if (req.method === 'GET' && !path) return json(200, { links: await linksOf(S) });
    if (path === 'link') return json(200, await linkStart(S, svc, redirect));
    if (path === 'poll') return json(200, await linkPoll(S, svc));
    if (path === 'unlink') { await unlink(S, svc); return json(200, { links: await linksOf(S) }); }
    if (path === 'sync') { if (!await S.lock()) return json(202, { busy: true });
      // السحب يسبق الدفع دائماً، فلا يغلب تعديلٌ قديم من جهاز كان بلا اتصال تعديلاً أحدث منه في حسابك
      try { const r = await syncAnime(S, { edits: Array.isArray(body.edits) ? body.edits.slice(0, 500) : [], full: body.full || null, eps: body.eps || null, build: body.build || '', since: +body.since || 0, pull: true, budget: 15, deadline: Date.now() + 6500 });
        return json(200, { ...r, links: await linksOf(S) }); }
      finally { await S.unlock(); } }
    return json(404, { error: 'غير موجود.' });
  } catch (e) { return json(e.code === 'setup' || e.code === 'state' ? 400 : 502, { error: e.message || 'تعذّر الطلب.', code: e.code || '' }); }
};
export const config = { path: ['/api/accounts', '/api/accounts/*'] };
