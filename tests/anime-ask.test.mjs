// يفحص دالة «ترجمها لي» في «أنمياتي» بلا شبكة: GitHub مُحاكى. node tests/anime-ask.test.mjs
process.env.GH_TOKEN = 'test-token'; process.env.ADD_FILM_PASSWORD = 'open-sesame-42'; delete process.env.ADD_GAME_PASSWORD;
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 600)}`); if (!ok) fails.push(n); };
const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// مستودع في الذاكرة: فرع requests قد لا يوجد، وملف الطلبات قد لا يوجد، والكتابة قد تصطدم مرة
const GH = { branch: false, file: null, sha: 0, puts: [], made: 0, clash: 0, deny: 0, calls: [] };
globalThis.fetch = async (url, opt = {}) => { const u = new URL(url), m = opt.method || 'GET'; GH.calls.push(`${m} ${u.pathname}${u.search}`);
  if (u.hostname !== 'api.github.com') return res(500, {}); if (opt.headers?.Authorization !== 'Bearer test-token' || GH.deny) return res(GH.deny || 401, {});
  if (m === 'GET' && u.pathname.endsWith('/contents/data/anime/requests.json')) { if (u.searchParams.get('ref') !== 'requests') return res(400, {});
    return GH.branch && GH.file ? res(200, { sha: 's' + GH.sha, content: Buffer.from(GH.file).toString('base64') }) : res(404, {}); }
  if (m === 'GET' && u.pathname.endsWith('/git/ref/heads/requests')) return GH.branch ? res(200, { object: { sha: 'r1' } }) : res(404, {});
  if (m === 'GET' && u.pathname.endsWith('/git/ref/heads/main')) return res(200, { object: { sha: 'main-sha' } });
  if (m === 'POST' && u.pathname.endsWith('/git/refs')) { const b = JSON.parse(opt.body); if (b.ref !== 'refs/heads/requests' || b.sha !== 'main-sha') return res(400, {}); GH.branch = true; GH.made++; return res(201, {}); }
  if (m === 'PUT' && u.pathname.endsWith('/contents/data/anime/requests.json')) { const b = JSON.parse(opt.body); if (b.branch !== 'requests') return res(400, {});
    if (GH.clash) { GH.clash--; return res(409, {}); } if ((GH.file ? 's' + GH.sha : undefined) !== b.sha) return res(409, {});
    GH.file = Buffer.from(b.content, 'base64').toString('utf8'); GH.sha++; GH.puts.push(b.message); return res(200, {}); }
  return res(404, {}); };
const { default: handler, config, WHAT } = await import('../netlify/functions/anime-ask.mjs');
const post = async body => { const r = await handler(new Request('https://x/api/anime-ask', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })); return { status: r.status, ...(await r.json()) }; };
const ok = { password: 'open-sesame-42' }, doc = () => JSON.parse(GH.file);

console.log('دالة «ترجمها لي» في أنمياتي');
check('المسار /api/anime-ask، والطلبان: نبذة وحلقات', config.path === '/api/anime-ask' && WHAT.join() === 'about,eps');
check('غير POST مرفوض', (await handler(new Request('https://x/api/anime-ask'))).status === 405);
check('طلب بلا JSON مرفوض', (await post('{oops')).status === 400);
let r = await post({ password: 'wrong', mal: 21, what: 'about' });
check('كلمة سر خاطئة: 401 ولا شيء يُكتب ولا يُسأل GitHub', r.status === 401 && r.error === 'password' && !GH.calls.length, r);
r = await post({ mal: 21, what: 'about' }); check('بلا كلمة سر: 401', r.status === 401);
for (const bad of [{ mal: 0, what: 'about' }, { mal: 'x', what: 'about' }, { mal: 1.5, what: 'eps' }, { mal: 21, what: 'all' }, { mal: 21 }, { mal: 99999999, what: 'eps' }]) { r = await post({ ...ok, ...bad }); check(`طلب غير صالح مرفوض: ${JSON.stringify(bad)}`, r.status === 400 && !GH.calls.length, r); }

r = await post({ ...ok, mal: 21, what: 'about', title: 'One Piece' });
check('أول طلب: يُنشأ فرع requests من رأس main ويُكتب الملف عليه', r.status === 200 && r.state === 'asked' && GH.made === 1 && doc().ar.length === 1 && doc().ar[0].mal === 21 && doc().ar[0].what === 'about' && doc().ar[0].title === 'One Piece' && /^\d{4}-\d\d-\d\dT/.test(doc().ar[0].at)
  && GH.puts[0] === 'anime: translate One Piece', [r, GH.file, GH.puts]);
r = await post({ ...ok, mal: 21, what: 'about', title: 'One Piece' });
check('الطلب نفسه ثانية: موجود ولا كتابة', r.state === 'exists' && GH.puts.length === 1, r);
r = await post({ ...ok, mal: 21, what: 'eps', title: 'One Piece' });
check('حلقات العمل نفسه طلب آخر', r.state === 'asked' && doc().ar.length === 2 && doc().ar[1].what === 'eps' && GH.puts[1] === 'anime: translate episodes of One Piece' && GH.made === 1, [r, GH.puts]);
r = await post({ ...ok, mal: '40748', what: 'eps', title: '  Jujutsu   Kaisen <script>alert(1)</script>\n"x"  ' });
check('الاسم يُنظَّف من الرموز ويُقصّ، والرقم النصي يُقبل', r.state === 'asked' && doc().ar[2].mal === 40748 && doc().ar[2].title === 'Jujutsu Kaisen scriptalert(1)/scriptx' && !/[<>"\n]/.test(GH.puts[2]), [doc().ar[2], GH.puts[2]]);
r = await post({ ...ok, mal: 70001, what: 'about', title: 'Midnight Sample', ad: 1 });
check('عمل +18 (E69): يُطلب برقمه وحده، فلا يدخل اسمه الطلب ولا عنوان الإيداع', r.state === 'asked' && doc().ar[3].mal === 70001 && doc().ar[3].title === '' && GH.puts[3] === 'anime: translate #70001', [doc().ar[3], GH.puts[3]]);
r = await post({ ...ok, mal: 5114, what: 'about', title: 'Fullmetal Alchemist: Brotherhood' });
GH.clash = 1; r = await post({ ...ok, mal: 30, what: 'about', title: 'Shinseiki Evangelion' });
check('اصطدام في الكتابة: تُعاد المحاولة وينجح الطلب', r.state === 'asked' && doc().ar.at(-1).mal === 30 && doc().ar.length === 6, r);
GH.file = '{oops'; r = await post({ ...ok, mal: 1, what: 'about', title: 'Cowboy Bebop' });
check('ملف طلبات تالف: يبدأ من جديد ولا يتعطل', r.state === 'asked' && doc().ar.length === 1 && doc().ar[0].mal === 1, [r, GH.file]);
GH.file = JSON.stringify({ ar: Array.from({ length: 800 }, (_, i) => ({ mal: 1000 + i, what: 'about', title: 't', at: 'x' })) }); r = await post({ ...ok, mal: 7, what: 'eps', title: 'Witch Hunter Robin' });
check('لا يتجاوز الملف 800 طلب: الأقدم يسقط', r.state === 'asked' && doc().ar.length === 800 && doc().ar[0].mal === 1001 && doc().ar.at(-1).mal === 7, doc().ar.length);
GH.deny = 403; r = await post({ ...ok, mal: 8, what: 'about', title: 'Bouken Ou Beet' });
check('رمز GitHub مرفوض: رسالة تقول ذلك بلا تفاصيل', r.status === 502 && /GH_TOKEN/.test(r.error), r); GH.deny = 0;
GH.deny = 500; const err = console.error; console.error = () => {}; r = await post({ ...ok, mal: 8, what: 'about', title: 'Bouken Ou Beet' }); console.error = err; check('عطل في GitHub: رسالة عامة', r.status === 502 && /حاول بعد قليل/.test(r.error), r); GH.deny = 0;
delete process.env.GH_TOKEN; r = await post({ ...ok, mal: 8, what: 'about' }); check('بلا GH_TOKEN: خطأ إعداد واضح', r.status === 500 && /GH_TOKEN/.test(r.error), r); process.env.GH_TOKEN = 'test-token';
process.env.ADD_GAME_PASSWORD = 'games-pass'; r = await post({ ...ok, mal: 8, what: 'about' }); const r2 = await post({ password: 'games-pass', mal: 8, what: 'about', title: 'Bouken Ou Beet' });
check('كلمة سر «أضف لعبة» تتقدم حين توجد', r.status === 401 && r2.state === 'asked', [r, r2]);
delete process.env.ADD_GAME_PASSWORD; delete process.env.ADD_FILM_PASSWORD; r = await post({ ...ok, mal: 8, what: 'about' }); check('بلا كلمة سر في الخادم: خطأ إعداد', r.status === 500 && /كلمة السر/.test(r.error), r);

console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' | ')}` : '\n✅ كل فحوص طلب الترجمة نجحت'); process.exit(fails.length ? 1 : 0);
