// يفحص خادم ربط الحسابات (E84): الربط، والمزامنة بالاتجاهين بين «أنمياتي» وMyAnimeList وSIMKL، بخدمتين مُحاكاتين ومخزن في الذاكرة.
// node tests/accounts.test.mjs
process.env.URL = 'https://watch.example'; process.env.ADD_FILM_PASSWORD = 'pw'; process.env.MAL_CLIENT_ID_SYNC = 'mal-client';
const { memStore, simklOps } = await import('../scripts/lib-accounts.mjs');
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
      if (url.pathname === '/sync/add-to-list') cur.status = b.to;
      if (url.pathname === '/sync/ratings') cur.user_rating = it.rating; if (url.pathname === '/sync/ratings/remove') cur.user_rating = null;
      SK.set(id, cur); skAct++; }
    return res({}); }
  throw new Error('unexpected fetch ' + u); };

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

console.log('\n== الفصل وانتهاء الربط');
await call('/unlink', { body: { svc: 'simkl' } }); skRow(1, 'hold', 12); sent.length = 0; r = await call('/sync', { body: { since: r.j.rev } });
check('بعد فصل SIMKL لا يُسحب منه ولا يُرسل إليه', !sent.some(x => x[0] === 'sk') && !r.j.changes.some(c => c.id === 1 && c.s === 'hold') && !(await S.get('tok/simkl')), sent);
await S.set('tok/mal', { ...(await S.get('tok/mal')), access: 'expired-token', exp: Date.now() + 3600e3 }); r = await call('/sync', { body: { since: r.j.rev } });
check('رمز رُفض: يقال «أعد الربط» ولا يتوقف الباقي', r.status === 200 && r.j.links.mal.dead && r.j.links.mal.err === 'auth', r.j.links);
check('simklOps: الفيلم بلا حلقات، والإنقاص يزيل علامات حلقاته وحدها', J(simklOps([{ id: 9, from: { s: 'plan', p: 0 }, to: { s: 'completed', p: 1 }, movie: true }])) === J([['/sync/add-to-list', { to: 'completed', shows: [{ ids: { mal: 9 } }] }]])
  && J(simklOps([{ id: 8, from: { s: 'watching', p: 5 }, to: { s: 'watching', p: 3 } }])) === J([['/sync/history/remove', { shows: [{ ids: { mal: 8 }, seasons: [{ number: 1, episodes: [{ number: 4 }, { number: 5 }] }] }] }]]));
check('ولا رمز ولا سر في حال المزامنة المحفوظة', noTok(await S.get('anime')));

console.log(fail ? `\n❌ فشل ${fail}` : '\n✅ كل فحوص ربط الحسابات نجحت');
process.exit(fail ? 1 : 0);
