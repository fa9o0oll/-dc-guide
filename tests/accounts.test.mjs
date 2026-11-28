// يفحص خادم ربط الحسابات (E84): الربط، والمزامنة بالاتجاهين بين «أنمياتي» وMyAnimeList وSIMKL، بخدمتين مُحاكاتين ومخزن في الذاكرة.
// node tests/accounts.test.mjs
process.env.URL = 'https://watch.example'; process.env.ADD_FILM_PASSWORD = 'pw'; process.env.MAL_CLIENT_ID_SYNC = 'mal-client'; process.env.TRAKT_GAP_MS = '20';
const { memStore, simklOps, syncSeries } = await import('../scripts/lib-accounts.mjs');
const { createHash } = await import('node:crypto');
const fn = await import('../netlify/functions/accounts.mjs');
let fail = 0; const check = (name, ok, info) => { console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ' — ' + JSON.stringify(info)}`); if (!ok) fail++; };
const J = x => JSON.stringify(x);

// ---------- الخدمتان المحاكاتان
const MAL = new Map(), SK = new Map(), sent = []; let skAct = 1, skPolls = 0, malTok = 0;
const malRow = (id, status, n, score = 0, at = '2026-01-01T00:00:00Z') => MAL.set(id, { status, num_episodes_watched: n, score, updated_at: at });
const skRow = (id, status, n, rating = null) => { SK.set(id, { status, watched_episodes_count: n, user_rating: rating }); skAct++; };
const res = (o, status = 200) => new Response(J(o), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (u, init = {}) => { const url = new URL(u), m = init.method || 'GET', body = init.body;
  const auth = (init.headers?.Authorization || init.headers?.authorization || '');
  if (url.host === 'myanimelist.net' && url.pathname === '/v1/oauth2/token') { const f = new URLSearchParams(body); sent.push(['mal-token', f.get('grant_type'), f.get('code_verifier') ? 'verifier' : '', f.get('client_secret') ? 'SECRET' : '']);
    return res({ access_token: 'tok-mal-' + (++malTok), refresh_token: 'ref-mal', expires_in: 2678400 }); }
  if (url.host === 'api.myanimelist.net') { if (!/^Bearer tok-mal-/.test(auth)) return res({ error: 'invalid_token' }, 401);
    if (url.pathname === '/v2/users/@me/animelist') { check('سحب MyAnimeList يطلب أعمال +18 أيضاً وحالة القائمة', url.searchParams.get('nsfw') === 'true' && url.searchParams.get('fields') === 'list_status');
      return res({ data: [...MAL].map(([id, L]) => ({ node: { id, title: 'w' + id }, list_status: L })), paging: {} }); }
    const id = +url.pathname.split('/')[3];
    if (m === 'PATCH') { const f = new URLSearchParams(body); sent.push(['mal', id, f.get('status'), +f.get('num_watched_episodes'), +f.get('score')]); malRow(id, f.get('status'), +f.get('num_watched_episodes'), +f.get('score'), new Date().toISOString()); return res({}); }
    if (m === 'DELETE') { sent.push(['mal-del', id]); MAL.delete(id); return res({}); } }
  if (url.host === 'api.simkl.com') { if (!url.searchParams.get('client_id') || !url.searchParams.get('app-name')) return res({ error: 'no client' }, 400);
    if (url.pathname === '/oauth2/device') { const f = new URLSearchParams(body); sent.push(['sk-device', f.get('scope')]); return res({ device_code: 'dev', user_code: 'ABCD-1234', verification_uri: 'https://simkl.com/pin', expires_in: 900, interval: 2 }); }
    if (url.pathname === '/oauth2/token') return ++skPolls < 2 ? res({ error: 'authorization_pending' }, 400) : res({ access_token: 'tok-sk', refresh_token: 'ref-sk', expires_in: 604800, scope: 'media:read media:write' });
    if (auth !== 'Bearer tok-sk') return res({ error: 'user_token_failed' }, 401);
    if (url.pathname === '/sync/activities') return res({ anime: { all: 'act-' + skAct } });
    if (url.pathname === '/sync/all-items/anime') return res({ anime: [...SK].map(([id, x]) => ({ ...x, show: { title: 's' + id, ids: { mal: id, simkl: 9000 + id } } })) });
    const b = JSON.parse(body || '{}'); sent.push(['sk', url.pathname, b]);
    for (const it of b.shows || []) { const id = it.ids.mal, cur = SK.get(id) || { status: 'watching', watched_episodes_count: 0, user_rating: null }, eps = (it.seasons?.[0]?.episodes || []).map(e => e.number);
      if (url.pathname === '/sync/history') cur.watched_episodes_count = Math.max(cur.watched_episodes_count, ...eps);
      if (url.pathname === '/sync/history/remove') { if (!eps.length) { SK.delete(id); skAct++; continue; } cur.watched_episodes_count = Math.min(cur.watched_episodes_count, Math.min(...eps) - 1); }
      if (url.pathname === '/sync/add-to-list') { if (!it.to) return res({ error: 'Missed "to" parameter' }, 400); cur.status = it.to; }
      if (url.pathname === '/sync/ratings') cur.user_rating = it.rating; if (url.pathname === '/sync/ratings/remove') cur.user_rating = null;
      SK.set(id, cur); skAct++; }
    return res({}); }
  if (url.host === 'letterboxd.com') { const user = url.pathname.split('/')[1]; sent.push(['lb', user]); if (user !== 'faisal_test') return new Response('not found', { status: 404 });
    return new Response(`<?xml version='1.0' encoding='utf-8'?><rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org"><channel><title>Letterboxd - Faisal</title>${LBX.map(([id, d, r]) =>
      `<item><title>Film ${id}</title><guid isPermaLink="false">letterboxd-review-${id}</guid><pubDate>${new Date(d).toUTCString()}</pubDate><letterboxd:watchedDate>${d}</letterboxd:watchedDate><letterboxd:rewatch>No</letterboxd:rewatch>${r ? `<letterboxd:memberRating>${r}</letterboxd:memberRating>` : ''}<tmdb:movieId>${id}</tmdb:movieId></item>`).join('')}<item><title>A list</title><guid>letterboxd-list-9</guid></item></channel></rss>`, { status: 200, headers: { 'content-type': 'application/rss+xml' } }); }
  // Trakt: الربط في auth.trakt.tv بتحدٍّ S256 ومتحقق بلا سر، ورمز التجديد لمرة واحدة
  if (url.host === 'auth.trakt.tv' && url.pathname === '/oauth/token') { const b = JSON.parse(body || '{}'); sent.push(['tr-token', b.grant_type, b.client_secret ? 'SECRET' : '', b.code_verifier ? 'verifier' : '', b.redirect_uri]);
    if (b.client_id !== process.env.TRAKT_CLIENT_ID) return res({ error: 'invalid_client' }, 401);
    if (b.grant_type === 'authorization_code') return TR.challenge && TR.challenge === createHash('sha256').update(b.code_verifier || '').digest('base64url') ? res({ access_token: 'tok-trakt', refresh_token: TR.refresh, expires_in: 604800 }) : res({ error: 'invalid_grant' }, 400);
    if (TR.down) return res({ error: 'server' }, 503); if (b.refresh_token !== TR.refresh) return res({ error: 'invalid_grant' }, 400);
    TR.refresh = 'ref-trakt-' + (++TR.refs); return res({ access_token: 'tok-trakt', refresh_token: TR.refresh, expires_in: 604800 }); }
  if (url.host === 'api.trakt.tv') { const h = init.headers || {}, b = body ? JSON.parse(body) : {};
    if (h['trakt-api-key'] !== process.env.TRAKT_CLIENT_ID || h['trakt-api-version'] !== '2' || !h['user-agent']) return res({ error: 'bad headers' }, 403);
    if (h.authorization !== 'Bearer tok-trakt') return res({ error: 'invalid_token' }, 401);
    if (url.pathname === '/sync/last_activities') return res({ all: 'tr-' + TR.act });
    if (url.pathname === '/sync/watched/shows') { if (url.searchParams.get('extended') !== 'progress') return res([]); TR.gets.push(+url.searchParams.get('page')); return pageOf(trProgress(), url); }
    if (url.pathname === '/sync/watchlist/shows') return pageOf([...TR.wl].map(([id, at]) => ({ listed_at: at, type: 'show', show: { ids: { tmdb: id } } })), url);
    TR.posts.push([url.pathname, Date.now()]); sent.push(['tr', url.pathname, b]);
    const nf = { shows: [] }, at = x => x === 'released' ? '2000-01-01T00:00:00.000Z' : x || new Date().toISOString();
    for (const it of b.shows || []) { const id = it.ids.tmdb, sh = TR.shows.get(id); if (TR.unknown.has(id) || (!sh && !url.pathname.includes('watchlist'))) { nf.shows.push({ ids: { tmdb: id } }); continue; }
      const mark = (k, w) => { if (sh.w.has(k)) TR.dups.push(id + '|' + k); sh.w.set(k, at(w)); };
      if (url.pathname === '/sync/history') { if (!it.seasons) sh.aired.forEach((n, i) => { for (let e = 1; e <= n; e++) mark(`${i + 1}-${e}`, it.watched_at); }); else for (const se of it.seasons) for (const ep of se.episodes) mark(`${se.number}-${ep.number}`, ep.watched_at); }
      if (url.pathname === '/sync/history/remove') for (const se of it.seasons || []) for (const ep of se.episodes) sh.w.delete(`${se.number}-${ep.number}`);
      if (url.pathname === '/sync/watchlist') TR.wl.set(id, new Date().toISOString()); if (url.pathname === '/sync/watchlist/remove') TR.wl.delete(id); }
    TR.act++; return res({ added: {}, not_found: nf }, 201); }
  throw new Error('unexpected fetch ' + u); };
const LBX = [];
// Trakt المحاكى (E87): سجل المشاهدة بصيغة extended=progress (كل حلقة معروضة وcompleted، والحلقات الخاصة لا تعود فيه)، صفحات من اثنين ليُفحص تتبّعها
const TR = { shows: new Map(), wl: new Map(), act: 1, refresh: 'ref-trakt-1', refs: 1, challenge: '', down: false, posts: [], gets: [], dups: [], unknown: new Set([404]) };
const trShow = (id, aired, w = {}) => { TR.shows.set(id, { aired, w: new Map(Object.entries(w)) }); TR.act++; };
const trProgress = () => [...TR.shows].filter(([, x]) => x.w.size).map(([id, x]) => ({ last_watched_at: [...x.w.values()].sort().at(-1), show: { title: 'Show ' + id, ids: { trakt: id + 7000, tmdb: id }, aired_episodes: x.aired.reduce((a, b) => a + b, 0) },
  seasons: x.aired.map((n, i) => ({ number: i + 1, aired: n, episodes: [...Array(n)].map((_, e) => { const w = x.w.get(`${i + 1}-${e + 1}`); return { number: e + 1, completed: !!w, last_watched_at: w || null }; }) })) }));
const pageOf = (list, url) => { const per = Math.min(2, +url.searchParams.get('limit') || 100), page = +url.searchParams.get('page') || 1, pages = Math.max(1, Math.ceil(list.length / per));
  return new Response(J(list.slice((page - 1) * per, page * per)), { status: 200, headers: { 'content-type': 'application/json', 'x-pagination-page': String(page), 'x-pagination-page-count': String(pages) } }); };

const S = memStore(); fn._useStore(S);
const call = async (path, { method = 'POST', body, pass = 'pw' } = {}) => { const r = await fn.default(new Request('https://watch.example/api/accounts' + path, { method, headers: { 'x-pass': pass, 'content-type': 'application/json' }, body: body ? J(body) : undefined }));
  return { status: r.status, location: r.headers.get('location'), j: r.headers.get('content-type')?.includes('json') ? await r.json() : null }; };
const noTok = o => !/tok-|ref-/.test(J(o));

console.log('\n== الربط');
check('بلا كلمة السر لا شيء', (await call('', { method: 'GET', pass: '' })).status === 401 && (await call('/sync', { body: {}, pass: 'x' })).status === 401);
const ml = await call('/link', { body: { svc: 'mal' } }), au = new URL(ml.j.url);
check('ربط MyAnimeList: رابط موافقة برقم التطبيق وحده (بلا سر)، ورابط رجوع إلى الخادم، وتحدٍّ بصيغة plain', au.host === 'myanimelist.net' && au.searchParams.get('client_id') === 'mal-client' && au.searchParams.get('redirect_uri') === 'https://watch.example/api/accounts/callback/mal'
  && au.searchParams.get('code_challenge_method') === 'plain' && au.searchParams.get('code_challenge').length >= 43 && !!au.searchParams.get('state'), ml.j);
const bad = await call(`/callback/mal?code=c1&state=wrong`, { method: 'GET', pass: '' });
check('رجوع بحالة غير مطابقة يُرفض ولا يُحفظ شيء', /fail=state/.test(bad.location) && !(await S.get('tok/mal')));
const cb = await call(`/callback/mal?code=c1&state=${au.searchParams.get('state')}`, { method: 'GET', pass: '' });
check('والرجوع الصحيح يحفظ الرمز على الخادم ويعيدك إلى «أنمياتي»، والتبادل بالمتحقق بلا سر', cb.location === 'https://watch.example/anime/?linked=mal' && (await S.get('tok/mal'))?.access === 'tok-mal-1'
  && J(sent.find(x => x[0] === 'mal-token')) === J(['mal-token', 'authorization_code', 'verifier', '']), [cb.location, sent]);
const sk = await call('/link', { body: { svc: 'simkl' } });
check('ربط SIMKL: رمز ورابط، ويطلب القراءة والكتابة', sk.j.code === 'ABCD-1234' && /simkl\.com/.test(sk.j.url) && J(sent.find(x => x[0] === 'sk-device')) === J(['sk-device', 'media:read media:write']), sk.j);
const p1 = await call('/poll', { body: { svc: 'simkl' } }), p2 = await call('/poll', { body: { svc: 'simkl' } });
check('وينتظر موافقتك ثم يتم', !!p1.j.wait && p2.j.done === true, [p1.j, p2.j]);
const st = await call('', { method: 'GET' });
check('الحال: الخدمتان مربوطتان، ولا رمز في أي رد', st.j.links.mal.on && st.j.links.simkl.on && noTok([ml, cb, sk, p1, p2, st]), st.j);

console.log('\n== أول مزامنة: مصالحة بلا محو، يغلب الأبعد تقدّماً');
malRow(1, 'watching', 5, 8); malRow(3, 'completed', 12, 9); skRow(1, 'watching', 3); sent.length = 0;
const eps = { 1: 12, 2: 24, 3: 12, 4: -1 };
let r = await call('/sync', { body: { since: 0 } });
check('قبل أن يصل سجلّ الصفحة لا مزامنة: يُطلب السجل كله', r.j.needFull === true && !sent.length, r.j);
r = await call('/sync', { body: { since: 0, full: {}, eps } });
check('وسجلّ فارغ لا يبدأ منه شيء', r.j.needFull === true && !sent.length, r.j);
r = await call('/sync', { body: { since: 0, full: { 1: { s: 'watching', p: 3 }, 2: { s: 'plan' }, 4: { s: 'plan' } }, eps, build: 'b1' } });
const byId = a => Object.fromEntries(a.map(x => [x.id, x]));
let ch = byId(r.j.changes);
check('ما في MAL أبعد يدخل سجلّك (عمل 1: 5 حلقات وتقييمه)، وما فيه وليس عندك يدخل (عمل 3)', ch[1]?.p === 5 && ch[1].s === 'watching' && ch[1].r === 8 && ch[3]?.s === 'completed' && ch[3].p === 12 && !ch[2] && !ch[4], r.j.changes);
check('وما عندك وليس في MAL يُضاف إليه (2 و4)', J(sent.filter(x => x[0] === 'mal').map(x => x.slice(1)).sort()) === J([[2, 'plan_to_watch', 0, 0], [4, 'plan_to_watch', 0, 0]]), sent.filter(x => x[0] === 'mal'));
check('وSIMKL يلحق: حلقتا 1 الزائدتان وحدهما، و3 بحلقاته وإكماله وتقييمه، و2 و4 في «سأشاهده» (والفيلم بلا حلقات)', SK.get(1).watched_episodes_count === 5 && SK.get(1).user_rating === 8 && SK.get(3).status === 'completed' && SK.get(3).watched_episodes_count === 12
  && SK.get(2).status === 'plantowatch' && SK.get(4).status === 'plantowatch' && SK.get(4).watched_episodes_count === 0 && J(sent.find(x => x[0] === 'sk' && x[1] === '/sync/history')[2].shows.find(s => s.ids.mal === 1).seasons[0].episodes) === J([{ number: 4 }, { number: 5 }]), [...SK]);
const rev1 = r.j.rev;

console.log('\n== تعديل في الصفحة يصل الحسابين');
sent.length = 0; r = await call('/sync', { body: { since: rev1, edits: [{ id: 1, s: 'watching', p: 6, r: 8, t: Date.now() }] } });
check('«+» على عمل 1: MAL بقيمه كلها، وSIMKL بالحلقة 6 وحدها، ولا يرجع إلى الصفحة شيء', J(sent.filter(x => x[0] === 'mal')) === J([['mal', 1, 'watching', 6, 8]]) && J(sent.filter(x => x[0] === 'sk').map(x => [x[1], x[2].shows[0].seasons?.[0].episodes])) === J([['/sync/history', [{ number: 6 }]]]) && !r.j.changes.length, [sent, r.j.changes]);

console.log('\n== تعديل في MAL يصل SIMKL والصفحة (المزامنة المجدولة والصفحة مغلقة)');
malRow(1, 'completed', 12, 9, new Date(Date.now() + 1000).toISOString()); sent.length = 0;
const { syncAnime } = await import('../scripts/lib-accounts.mjs');
await syncAnime(S, { pull: true });
check('المزامنة المجدولة: SIMKL يُكمل عمل 1 بحلقاته 7 إلى 12 وتقييمه، وMAL لا يُلمس', SK.get(1).status === 'completed' && SK.get(1).watched_episodes_count === 12 && SK.get(1).user_rating === 9 && !sent.some(x => x[0] === 'mal'), [SK.get(1), sent]);
r = await call('/sync', { body: { since: rev1 } }); ch = byId(r.j.changes);
check('وحين تُفتح الصفحة يصلها التعديل من MAL', ch[1]?.s === 'completed' && ch[1].p === 12 && ch[1].r === 9 && ch[1].src === 'mal', r.j.changes);
const rev2 = r.j.rev;

console.log('\n== تعديل في SIMKL يصل MAL');
skRow(2, 'watching', 2); sent.length = 0; r = await call('/sync', { body: { since: rev2 } }); ch = byId(r.j.changes);
check('بدأت عمل 2 في SIMKL: MAL يصير «أشاهده» بحلقتين، والصفحة كذلك', J(sent.filter(x => x[0] === 'mal')) === J([['mal', 2, 'watching', 2, 0]]) && ch[2]?.s === 'watching' && ch[2].p === 2 && ch[2].src === 'simkl', [sent, r.j.changes]);

console.log('\n== التعارض: الأحدث يغلب');
const old = Date.now() - 60e3; malRow(4, 'watching', 0, 0, new Date().toISOString()); sent.length = 0;
r = await call('/sync', { body: { since: r.j.rev, edits: [{ id: 4, s: 'dropped', p: 0, r: 0, t: old }] } }); ch = byId(r.j.changes);
check('تعديل قديم من جهاز كان بلا اتصال لا يغلب تعديلاً أحدث في MAL', ch[4]?.s === 'watching' && MAL.get(4).status === 'watching' && SK.get(4).status === 'watching', [r.j.changes, MAL.get(4), SK.get(4)]);

console.log('\n== الإزالة');
sent.length = 0; r = await call('/sync', { body: { since: r.j.rev, edits: [{ id: 3, s: null, t: Date.now() }] } });
check('إزالة عمل من سجلّك تزيله من الحسابين', J(sent.filter(x => x[0] === 'mal-del')) === J([['mal-del', 3]]) && !SK.has(3) && !MAL.has(3), sent);
const keepMal = new Map(MAL); MAL.clear(); sent.length = 0; r = await call('/sync', { body: { since: r.j.rev } });
check('واختفاء أعمال كثيرة من MAL دفعة واحدة خلل لا يُمحى به شيء', !r.j.changes.some(c => c.s === null) && SK.has(1) && SK.has(2) && SK.has(4), r.j.changes);
for (const [k, v] of keepMal) MAL.set(k, v);
r = await call('/sync', { body: { since: r.j.rev } }); MAL.delete(2); sent.length = 0;
r = await call('/sync', { body: { since: r.j.rev } }); ch = byId(r.j.changes);
check('وإزالة عمل واحد في MAL تصل SIMKL والصفحة', ch[2]?.s === null && !SK.has(2), [r.j.changes, [...SK.keys()]]);

console.log('\n== مهلة الدالة');
{ const { syncAnime } = await import('../scripts/lib-accounts.mjs'); for (const id of [21, 22, 23]) await call('/sync', { body: { since: 0, edits: [{ id, s: 'plan', p: 0, r: 0, t: Date.now() }] } }).catch(() => {});
  for (const id of [31, 32, 33]) { const st0 = await S.get('anime'); st0.items[id] = { s: 'plan', p: 0, r: 0, t: Date.now(), src: 'site', rev: ++st0.rev }; await S.set('anime', st0); }
  sent.length = 0; await syncAnime(S, { pull: false, deadline: Date.now() - 1 });
  check('مهلة انقضت: لا يُرسل شيء ويُحفظ الحال كما هو', !sent.some(x => x[0] === 'mal') && !!(await S.get('anime')).items[31]);
  sent.length = 0; await syncAnime(S, { pull: false, budget: 2 });
  check('وحصة الإرسال: عملان في المرة، والباقي في المرة القادمة', sent.filter(x => x[0] === 'mal').length === 2, sent.filter(x => x[0] === 'mal'));
  sent.length = 0; await syncAnime(S, { pull: false }); check('ثم يكمل الباقي', sent.filter(x => x[0] === 'mal').length === 1 && [31, 32, 33].every(id => MAL.has(id)), sent.filter(x => x[0] === 'mal')); }

console.log('\n== الأفلام ↔ Letterboxd (E86)');
{ const { parseLb } = await import('../scripts/lib-accounts.mjs');
  check('قراءة يوميات Letterboxd: رقم TMDB وتاريخ المشاهدة والتقييم، وما ليس فيلماً (قائمة) يُترك', J(parseLb(`<item><tmdb:movieId>27205</tmdb:movieId><letterboxd:watchedDate>2026-11-20</letterboxd:watchedDate><letterboxd:memberRating>4.5</letterboxd:memberRating><pubDate>Fri, 20 Nov 2026 20:00:00 +0000</pubDate></item><item><guid>letterboxd-list-1</guid></item>`).map(i => [i.tmdb, i.date, i.rating]))
    === J([[27205, '2026-11-20', 4.5]]));
  let l = await call('/link', { body: { svc: 'letterboxd', user: 'nobody_here' } });
  check('ربط Letterboxd باسم لا صفحة له: يقال ذلك ولا يُحفظ', l.status === 400 && /لا حساب/.test(l.j.error) && !(await S.get('tok/letterboxd')), l.j);
  l = await call('/link', { body: { svc: 'letterboxd', user: 'https://letterboxd.com/Faisal_Test/' } });
  check('وبرابط صفحته أو اسمه يُربط (بلا كلمة سر ولا رمز: يومياته عامة)', l.j.done === true && l.j.user === 'faisal_test' && (await S.get('tok/letterboxd')).user === 'faisal_test', l.j);
  let f = await call('/sync', { body: { guide: 'films', since: 0 } });
  check('الأفلام: قبل سجلّ الصفحة يُطلب كله', f.j.needFull === true && f.j.lb?.user === 'faisal_test', f.j);
  LBX.push([27205, '2026-11-20', 4.5], [603, '2026-11-22', 0]);
  f = await call('/sync', { body: { guide: 'films', since: 0, full: { m550: 'watched', m27205: 'next', m13: 'next', t1399: 'watched' } } });
  const fc = Object.fromEntries(f.j.changes.map(c => [c.id, c.s]));
  check('ما سجّلته في Letterboxd يصير هنا «شاهدته» (ولو كان في «سأشاهده»)، وما شاهدته هنا وحده يبقى', fc.m27205 === 'watched' && fc.m603 === 'watched' && !fc.m550 && !fc.m13 && !fc.t1399, f.j.changes);
  check('وما يعرفه Letterboxd: ما في يومياته (فلا يُعاد في ملف الاستيراد)', J(f.j.lb.known.sort((a, b) => a - b)) === J([603, 27205]) && J(f.j.lb.wl) === '[]', f.j.lb);
  const s1 = await call('/films/sent', { body: { kind: 'watched', ids: [550] } }), s2 = await call('/films/sent', { body: { kind: 'next', ids: [13] } });
  f = await call('/sync', { body: { guide: 'films', since: f.j.rev, edits: [{ id: 'm680', s: 'watched', t: Date.now() }] } });
  check('ملف نزّلته صار معروفاً له، وتعديلك الجديد ينتظر الملف التالي', s1.j.known === 3 && s2.j.wl === 1 && f.j.lb.known.includes(550) && f.j.lb.wl.includes(13) && !f.j.lb.known.includes(680) && !f.j.changes.length, [s1.j, s2.j, f.j.lb]);
  f = await call('/sync', { body: { guide: 'films', since: 0, edits: [{ id: 'm603', s: null, t: Date.now() }] } });
  check('وفيلم أزلت علامته هنا بعد تسجيله هناك لا تعيده اليوميات', !f.j.changes.some(c => c.id === 'm603' && c.s === 'watched'), f.j.changes);
  const links = (await call('', { method: 'GET' })).j.links;
  check('حال Letterboxd: مربوط باسمه وآخر قراءة', links.letterboxd.on && links.letterboxd.user === 'faisal_test' && links.letterboxd.at > 0, links.letterboxd);
  await call('/unlink', { body: { svc: 'letterboxd' } });
  check('وفصله يمحو اسمه وما يعرفه', !(await S.get('tok/letterboxd')) && J((await S.get('films')).lb) === J({ known: {}, wl: {} })); }

console.log('\n== المسلسلات ↔ Trakt (E87)');
{ let B = 'b1'; const dc = (body = {}) => call('/sync', { body: { guide: 'dc', build: B, ...body } }), byId = r => Object.fromEntries(r.j.changes.map(c => [c.id, c])), posts = p => sent.filter(x => x[0] === 'tr' && x[1] === p).map(x => x[2]);
  let l = await call('/link', { body: { svc: 'trakt', from: 'marvel' } });
  check('Trakt قبل لصق رقم التطبيق في Netlify: «لم يُجهَّز بعد»، والحال تقول ذلك', l.status === 400 && /لم يُجهَّز/.test(l.j.error) && (await call('', { method: 'GET' })).j.links.trakt.ready === false, l.j);
  process.env.TRAKT_CLIENT_ID = 'trakt-client'; sent.length = 0;
  l = await call('/link', { body: { svc: 'trakt', from: 'marvel' } }); const ta = new URL(l.j.url); TR.challenge = ta.searchParams.get('code_challenge');
  check('ربط Trakt: صفحة موافقته في auth.trakt.tv برقم التطبيق وحده، ورجوع إلى الخادم كما سُجّل في التطبيق، وتحدٍّ S256', ta.origin + ta.pathname === 'https://auth.trakt.tv/oauth/authorize' && ta.searchParams.get('client_id') === 'trakt-client'
    && ta.searchParams.get('redirect_uri') === 'https://watch.example/api/accounts/callback/trakt' && ta.searchParams.get('response_type') === 'code' && ta.searchParams.get('code_challenge_method') === 'S256' && /^[A-Za-z0-9_-]{43}$/.test(TR.challenge) && !!ta.searchParams.get('state') && !sent.length, l.j);
  const tb = await call('/callback/trakt?code=c1&state=wrong', { method: 'GET', pass: '' });
  check('رجوع بحالة غير مطابقة يُرفض ويعود إلى الدليل الذي بدأ الربط', /\/marvel\/\?linked=trakt&fail=state$/.test(tb.location) && !(await S.get('tok/trakt')), tb.location);
  const tg = await call(`/callback/trakt?code=c1&state=${ta.searchParams.get('state')}`, { method: 'GET', pass: '' });
  check('والرجوع الصحيح يحفظ الرمز على الخادم ويعيدك إلى دليل مارفل، والتبادل بالمتحقق بلا سر', tg.location === 'https://watch.example/marvel/?linked=trakt' && (await S.get('tok/trakt'))?.access === 'tok-trakt'
    && J(sent.find(x => x[0] === 'tr-token')) === J(['tr-token', 'authorization_code', '', 'verifier', 'https://watch.example/api/accounts/callback/trakt']) && !(await S.get('pend/trakt')), [tg.location, sent]);
  trShow(100, [4, 2], { '1-2': '2025-03-01T10:00:00.000Z', '1-3': '2025-03-02T10:00:00.000Z' }); trShow(200, [3]); trShow(300, [2], { '1-1': '2025-04-01T10:00:00.000Z' }); TR.wl.set(300, '2025-05-01T00:00:00.000Z');
  trShow(999, [1], { '1-1': '2025-01-01T00:00:00.000Z' });   // ليس في الدليل
  sent.length = 0; let r = await dc();
  check('أول مزامنة لدليل DC: يُطلب سجلّه وأرقام مسلسلاته (ولو كان سجلّه فارغاً)، ولا يُرسل شيء قبلها', r.j.needAll === true && r.j.needKnown === true && !sent.some(x => x[0] === 'tr'), r.j);
  r = await dc({ full: { tv100: { e: ['1-1', '1-2'], l: 0 }, tv200: { e: [], l: 1 }, tv404: { e: ['1-1'] } }, known: [100, 200, 300, 404] }); let ch = byId(r);
  check('ما شوهد في Trakt وليس هنا يصل الدليل (100: 1-3، و300: حلقته وقائمة المشاهدة)، ولا شيء من مسلسل ليس فيه', J(ch[100]?.e) === J(['1-3']) && J(ch[300]?.e) === J(['1-1']) && ch[300]?.l === 1 && !ch[999] && !r.j.needAll && !r.j.needKnown, r.j.changes);
  const h0 = posts('/sync/history')[0];
  check('وما شوهد هنا وليس في Trakt يُضاف إليه بتاريخ عرضه (100: 1-1)، بلا تكرار لما فيه (1-2)', J(h0?.shows?.find(x => x.ids.tmdb === 100)?.seasons) === J([{ number: 1, episodes: [{ number: 1, watched_at: 'released' }] }]) && !TR.dups.length && TR.shows.get(100).w.has('1-1'), h0);
  check('و«سأشاهده» هنا يصير في قائمة المشاهدة هناك (200)، والكتابة طلباً بعد طلب بمهلة بينهما', TR.wl.has(200) && TR.posts.length >= 2 && TR.posts.every((x, i) => !i || x[1] - TR.posts[i - 1][1] >= 20), TR.posts);
  check('وسجل Trakt يُقرأ صفحة صفحة حتى آخرها، بحلقاته (extended=progress)', J(TR.gets) === J([1, 2]), TR.gets);
  sent.length = 0; r = await dc({ since: r.j.rev });
  check('ومسلسل لا يعرفه Trakt (404) لا يُعاد إرساله كل مرة', !sent.some(x => x[0] === 'tr' && J(x[2]).includes('"tmdb":404')), sent);
  sent.length = 0; r = await dc({ since: r.j.rev, full: { tv100: { e: ['1-2', '2-2'] } } });
  check('وسجلّ جهاز آخر يُجمع أيضاً (2-2 لم يكن في أول جهاز)، بلا تكرار لما في Trakt', J(posts('/sync/history')[0]?.shows?.find(x => x.ids.tmdb === 100)?.seasons) === J([{ number: 2, episodes: [{ number: 2, watched_at: 'released' }] }]) && !TR.dups.length, posts('/sync/history'));
  const t0 = Date.now(); sent.length = 0;
  r = await dc({ since: r.j.rev, edits: [{ id: 'tv100|1-4', on: 1, t: t0 }, { id: 'tv100|1-1', on: 0, t: t0 }, { id: 'tv200|l', on: 0, t: t0 }] });
  const h1 = posts('/sync/history')[0], hr = posts('/sync/history/remove')[0];
  check('حلقة تعلّمها في الدليل تصل Trakt بوقت تعليمك، وحلقة تزيل علامتها تُزال منه، ولا يرجع إلى الدليل شيء', h1?.shows?.[0]?.seasons?.[0]?.episodes?.[0]?.watched_at === new Date(t0).toISOString() && TR.shows.get(100).w.has('1-4') && !TR.shows.get(100).w.has('1-1')
    && J(hr?.shows?.[0]?.seasons) === J([{ number: 1, episodes: [{ number: 1 }] }]) && !r.j.changes.length, [h1, hr, r.j.changes]);
  check('وإخراجه من «سأشاهده» يخرجه من قائمة المشاهدة', !TR.wl.has(200), [...TR.wl.keys()]);
  TR.shows.get(100).w.set('2-1', '2026-11-27T20:00:00.000Z'); TR.shows.get(100).w.delete('1-3'); TR.act++;
  await syncSeries(S, { pull: true }); r = await dc({ since: r.j.rev }); ch = byId(r);
  check('حلقة شاهدتها في Trakt وأخرى أزلتها هناك تصلان الدليل (المزامنة الدورية والصفحة مغلقة)', J(ch[100]?.e) === J(['2-1']) && J(ch[100]?.x) === J(['1-3']), r.j.changes);
  for (const id of [501, 502, 503, 504]) trShow(id, [2], { '1-1': '2025-01-01T00:00:00.000Z' }); B = 'b2';
  r = await dc({ since: r.j.rev, known: [100, 200, 300, 404, 501, 502, 503, 504] });
  check('مسلسلات صارت في الدليل بعد بنائه الجديد تدخل المزامنة بما شوهد منها', [501, 502, 503, 504].every(id => J(byId(r)[id]?.e) === J(['1-1'])), r.j.changes);
  for (const id of [501, 502, 503, 504]) TR.shows.get(id).w.clear(); TR.act++; r = await dc({ since: r.j.rev });
  check('واختفاء حلقات مسلسلات كثيرة من Trakt دفعة واحدة خلل لا يُمحى به شيء', !r.j.changes.some(c => c.x?.length), r.j.changes);
  for (const id of [501, 502, 503, 504]) TR.shows.get(id).w.set('1-1', '2025-01-01T00:00:00.000Z'); TR.act++; r = await dc({ since: r.j.rev });
  r = await dc({ since: r.j.rev, edits: [{ id: 'tv100|0-1', on: 1, t: Date.now() }] });   // حلقة خاصة: Trakt يقبلها ولا يعيدها في سجله
  const s0 = await S.get('series'); check('حلقة أُرسلت تنتظر ظهورها في سجل Trakt', !!s0.pend['100|0-1'], s0.pend);
  s0.pend['100|0-1'] = Date.now() - 16 * 60e3; await S.set('series', s0); TR.act++; sent.length = 0; r = await dc({ since: r.j.rev }); const s1 = await S.get('series');
  check('وما لم يظهر بعد ربع ساعة لا يُعاد إرساله ولا يُحسب إزالة منك', s1.nf['100|0-1'] === 1 && !s1.pend['100|0-1'] && !posts('/sync/history').length && !r.j.changes.some(c => c.x?.includes('0-1')), [s1.nf, sent]);
  // قائمة أفلامي: مسلسلاتها مع Trakt، وأفلامها مع Letterboxd، ولكلٍّ رقم مراجعته
  trShow(500, [3], { '1-1': '2025-02-01T00:00:00.000Z' }); trShow(600, [2]); trShow(700, [5]); TR.dups.length = 0; sent.length = 0;
  r = await call('/sync', { body: { guide: 'films', build: 'f1', since: 0 } });
  check('قائمة أفلامي وTrakt مربوط: يُطلب سجلّها وأرقام مسلسلاتها، ورقم المراجعة صار لكلٍّ منهما', r.j.needAll === true && r.j.needKnown === true && typeof r.j.rev === 'object' && 'f' in r.j.rev && 's' in r.j.rev, r.j);
  r = await call('/sync', { body: { guide: 'films', build: 'f1', since: r.j.rev, full: { t500: 'watched', t600: 'watched', t700: 'next', m27205: 'watched' }, known: [500, 600, 700] } });
  const fh = posts('/sync/history').at(-1), f500 = fh?.shows?.find(x => x.ids.tmdb === 500), f600 = fh?.shows?.find(x => x.ids.tmdb === 600);
  check('«شاهدته» على مسلسل يُرسل حلقاته المعروضة التي لم تُشاهد هناك (500: 1-2 و1-3 بتاريخ عرضهما)، وما لم يُشاهد منه شيء كاملاً (600)', J(f500?.seasons) === J([{ number: 1, episodes: [{ number: 2, watched_at: 'released' }, { number: 3, watched_at: 'released' }] }])
    && J(f600) === J({ ids: { tmdb: 600 }, watched_at: 'released' }) && !TR.dups.length, fh);
  check('و«سأشاهده» على مسلسل في القائمة قائمة المشاهدة (700)', TR.wl.has(700), [...TR.wl.keys()]);
  r = await call('/sync', { body: { guide: 'films', build: 'f1', since: r.j.rev } }); ch = byId(r);
  check('وما اكتمل في Trakt يصير «شاهدته» في القائمة (بمفاتيحها t500 وt600)', ch.t500?.done === true && ch.t600?.done === true && !ch.t700?.done, r.j.changes);
  const tk = await S.get('tok/trakt'); await S.set('tok/trakt', { ...tk, exp: Date.now() + 60e3 }); sent.length = 0; r = await dc({ since: r.j.rev }); const tk2 = await S.get('tok/trakt');
  check('الرمز يُجدَّد قبل انتهائه بلا سر، ورمز التجديد الجديد يُحفظ في الحال (لمرة واحدة)', J(sent.find(x => x[0] === 'tr-token')) === J(['tr-token', 'refresh_token', '', '', 'https://watch.example/api/accounts/callback/trakt'])
    && tk2.refresh === TR.refresh && tk2.refresh !== tk.refresh && tk2.exp > Date.now() + 86400e3 && r.status === 200, [sent.filter(x => x[0] === 'tr-token'), tk2.refresh, TR.refresh]);
  TR.down = true; await S.set('tok/trakt', { ...tk2, access: 'old-access', exp: Date.now() - 60e3 }); TR.act++; r = await dc({ since: r.j.rev }); TR.down = false;
  check('وتعذّر التجديد لعطل عندهم ليس انتهاء ربط: يقال «تعذّر الاتصال» ويُعاد وحده', r.j.links.trakt.on === true && !r.j.links.trakt.dead && r.j.links.trakt.err === 'net', r.j.links.trakt);
  r = await dc({ since: r.j.rev }); check('ثم يتجدد في المرة التالية ويعود', (await S.get('tok/trakt')).access === 'tok-trakt' && r.j.links.trakt.err === '' && !r.j.links.trakt.dead, r.j.links.trakt);
  await call('/unlink', { body: { svc: 'trakt' } }); const su = await S.get('series');
  check('فصل Trakt يمحو رمزه وينسى ظله، ويبقي المحور', !su.sh && !su.shOk && Object.keys(su.items).length > 0 && !(await S.get('tok/trakt')) && (await call('', { method: 'GET' })).j.links.trakt.on === false, su.shOk);
  check('ولا رمز في حال المسلسلات المحفوظة', noTok(su)); }

console.log('\n== أفلام دليلَي DC ومارفل ↔ قائمة أفلامي وLetterboxd (E90)');
{ await call('/link', { body: { svc: 'letterboxd', user: 'faisal_test' } });
  const fm = r => Object.fromEntries(r.j.changes.filter(c => /^m\d+$/.test(c.id)).map(c => [c.id, c]));
  let f0 = await call('/sync', { body: { guide: 'films', since: { f: 0, s: 0 } } }); const hub0 = (await S.get('films')).items;
  check('قبل الدليلين: في المحور ما شاهدته في القائمة (550)، وما في «سأشاهده» (13)، وما أزلت علامته (603)', hub0[550]?.s === 'watched' && hub0[13]?.s === 'next' && hub0[603]?.s === null, [hub0[550], hub0[13], hub0[603]]);
  let d = await call('/sync', { body: { guide: 'dc', build: 'b1', since: 0, full: { m414906: 'watched', m550: 'next', m13: 'watched', m603: 'watched', tv1: { e: [], l: 0 } } } }); let dc = fm(d), hub = (await S.get('films')).items;
  check('سجل دليل DC يُجمع إلى المحور: فيلم جديد يُضاف، و«شاهدته» يغلب «سأشاهده»، ولا ينزل «شاهدته» بـ«سأشاهده»، ولا يعود فيلم أُزيلت علامته صراحة',
    hub[414906]?.s === 'watched' && hub[414906].src === 'dc' && hub[13]?.s === 'watched' && hub[550]?.s === 'watched' && hub[603]?.s === null, [hub[414906], hub[13], hub[550], hub[603]]);
  check('ويصل الدليلَ ما في المحور من غيره (يومياتك وقائمة أفلامي)، ولا يعود إليه ما جاء منه، ورقم المراجعة للمسلسلات والأفلام معاً',
    dc.m27205?.s === 'watched' && dc.m27205.src === 'letterboxd' && dc.m550?.s === 'watched' && !dc.m414906 && !dc.m13 && typeof d.j.rev === 'object' && d.j.rev.f > 0 && d.j.rev.s >= 0, [d.j.rev, Object.keys(dc)]);
  let f = await call('/sync', { body: { guide: 'films', since: f0.j.rev } }); let fc = fm(f);
  check('وقائمة أفلامي يصلها ما جاء من الدليل بمصدره (414906 و13 من DC)', fc.m414906?.s === 'watched' && fc.m414906.src === 'dc' && fc.m13?.s === 'watched' && fc.m13.src === 'dc', f.j.changes);
  d = await call('/sync', { body: { guide: 'dc', build: 'b1', since: d.j.rev, edits: [{ id: 'm414906', s: null, t: Date.now() }, { id: 'm268', s: 'next', t: Date.now() }] } });
  f = await call('/sync', { body: { guide: 'films', since: f.j.rev, edits: [{ id: 'm299534', s: 'watched', t: Date.now() }] } }); fc = fm(f);
  check('وتعديل في الدليل يصل قائمة أفلامي: إزالة «شاهدته» (414906) و«قائمتي» «سأشاهده» (268)', fc.m414906?.s === null && fc.m268?.s === 'next' && fc.m268.src === 'dc', f.j.changes);
  let mv = await call('/sync', { body: { guide: 'marvel', build: 'b1', since: 5 } }); const mc = fm(mv);
  check('ودليل مارفل يصله ما في قائمة أفلامي (299534) وما في دليل DC، وصفحة قديمة ترسل رقماً واحداً فيُقرأ رقم المسلسلات', mc.m299534?.s === 'watched' && mc.m299534.src === 'site' && mc.m268?.src === 'dc' && mv.status === 200 && typeof mv.j.rev === 'object', [mv.j.rev, Object.keys(mc).length]);
  LBX.push([299534, '2026-11-27', 5], [24428, '2026-11-27', 4]); sent.length = 0; mv = await call('/sync', { body: { guide: 'marvel', build: 'b1', since: mv.j.rev } });
  check('والدليلان لا يطلبان يومياتك مع كل تعديل: قُرئت قبل أقل من دقيقتين فلا تُقرأ', !sent.some(x => x[0] === 'lb') && !fm(mv).m24428, sent.filter(x => x[0] === 'lb'));
  { const fs0 = await S.get('films'); fs0.at.letterboxd = Date.now() - 180e3; await S.set('films', fs0); } mv = await call('/sync', { body: { guide: 'marvel', build: 'b1', since: mv.j.rev } });
  check('وبعدهما تُقرأ، فما سجّلته فيها يصل الدليل (24428)، ولا يتكرر ما وصله', fm(mv).m24428?.s === 'watched' && fm(mv).m24428.src === 'letterboxd' && !fm(mv).m299534, mv.j.changes);
  check('والمسلسلات في الرد نفسه كما كانت (لا مفتاح فيلم فيها، ولا شيء يُطلب)', mv.j.changes.every(c => /^m\d+$/.test(c.id) || typeof c.id === 'number') && !mv.j.needFull, mv.j);
  await call('/unlink', { body: { svc: 'letterboxd' } }); }

console.log('\n== الفصل وانتهاء الربط');
await call('/unlink', { body: { svc: 'simkl' } }); skRow(1, 'hold', 12); sent.length = 0; r = await call('/sync', { body: { since: r.j.rev } });
check('بعد فصل SIMKL لا يُسحب منه ولا يُرسل إليه', !sent.some(x => x[0] === 'sk') && !r.j.changes.some(c => c.id === 1 && c.s === 'hold') && !(await S.get('tok/simkl')), sent);
await S.set('tok/mal', { ...(await S.get('tok/mal')), access: 'expired-token', exp: Date.now() + 3600e3 }); r = await call('/sync', { body: { since: r.j.rev } });
check('رمز رُفض: يقال «أعد الربط» ولا يتوقف الباقي', r.status === 200 && r.j.links.mal.dead && r.j.links.mal.err === 'auth', r.j.links);
check('simklOps: الفيلم بلا حلقات، والحالة لكل عمل في مدخله، والإنقاص يزيل علامات حلقاته وحدها', J(simklOps([{ id: 9, from: { s: 'plan', p: 0 }, to: { s: 'completed', p: 1 }, movie: true }, { id: 7, from: null, to: { s: 'plan', p: 0 } }])) === J([['/sync/add-to-list', { shows: [{ to: 'completed', ids: { mal: 9 } }, { to: 'plantowatch', ids: { mal: 7 } }] }]])
  && J(simklOps([{ id: 8, from: { s: 'watching', p: 5 }, to: { s: 'watching', p: 3 } }])) === J([['/sync/history/remove', { shows: [{ ids: { mal: 8 }, seasons: [{ number: 1, episodes: [{ number: 4 }, { number: 5 }] }] }] }]]));
check('ولا رمز ولا سر في حال المزامنة المحفوظة', noTok(await S.get('anime')));

console.log(fail ? `\n❌ فشل ${fail}` : '\n✅ كل فحوص ربط الحسابات نجحت');
process.exit(fail ? 1 : 0);
