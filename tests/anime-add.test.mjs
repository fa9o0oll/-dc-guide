// يفحص دالة «أضف أنمي» في «أنمياتي» بلا شبكة: GitHub مُحاكى. node tests/anime-add.test.mjs
process.env.GH_TOKEN = 'test-token'; process.env.ADD_FILM_PASSWORD = 'open-sesame-42'; delete process.env.ADD_GAME_PASSWORD; process.env.TMDB_API_KEY = 'test-tmdb';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 600)}`); if (!ok) fails.push(n); };
const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const write = list => '[\n' + list.map(x => JSON.stringify(x)).join(',\n') + '\n]\n';
// مستودع في الذاكرة: قائمة الأعمال على main، والكتابة قد تصطدم مرة
const START = [{ mal: 5525, title: '07-Ghost', type: 'TV', eps: 25 }, { mal: 21, title: 'One Piece', type: 'TV', eps: 0 }, { mal: 1535, title: 'Death Note', type: 'TV', eps: 37 }].sort((a, b) => a.title.toUpperCase() < b.title.toUpperCase() ? -1 : 1);
const GH = { file: write(START), sha: 0, puts: [], clash: 0, deny: 0, calls: [] };
// TMDB مُحاكى للبحث بالاسم العربي (E70): المسلسل والفيلم بالاسم كما كُتب، ثم بلا «ال»؛ وفيها ما ليس أنمي (أمريكي، وغير رسوم)
const AOT = { id: 1429, name: 'Attack on Titan', original_name: '進撃の巨人', original_language: 'ja', origin_country: ['JP'], genre_ids: [16, 10759], first_air_date: '2013-04-07' };
const TM = { calls: [], deny: 0, results: { 'tv العمالقة': [AOT, { id: 1, name: 'Titans', original_language: 'en', origin_country: ['US'], genre_ids: [10759] }],
  'movie العمالقة': [{ id: 5, title: 'Attack on Titan: The Last Attack', original_title: '劇場版 進撃の巨人 完結編 THE LAST ATTACK', original_language: 'ja', genre_ids: [16], release_date: '2024-11-08' }, { id: 6, title: 'Clash of the Titans', original_language: 'en', genre_ids: [28] }],
  'tv عمالقة': [AOT, { id: 77, name: 'Star of the Giants', original_name: '巨人の星', original_language: 'ja', origin_country: ['JP'], genre_ids: [16], first_air_date: '1968-03-30' }], 'movie عمالقة': [] } };
globalThis.fetch = async (url, opt = {}) => { const u = new URL(url), m = opt.method || 'GET';
  if (u.hostname === 'api.themoviedb.org') { const k = /\/search\/(tv|movie)$/.exec(u.pathname)?.[1]; TM.calls.push(`${k} ${u.searchParams.get('query')} ${u.searchParams.get('include_adult')}`);
    if (TM.deny) return res(TM.deny, {}); return u.searchParams.get('api_key') === 'test-tmdb' && k ? res(200, { results: TM.results[`${k} ${u.searchParams.get('query')}`] || [] }) : res(404, {}); }
  GH.calls.push(`${m} ${u.pathname}${u.search}`);
  if (u.hostname !== 'api.github.com') return res(500, {}); if (opt.headers?.Authorization !== 'Bearer test-token' || GH.deny) return res(GH.deny || 401, {});
  if (m === 'GET' && u.pathname.endsWith('/contents/data/anime/list.json')) { if (u.searchParams.get('ref') !== 'main') return res(400, {});
    return GH.file === null ? res(404, {}) : res(200, { sha: 's' + GH.sha, content: Buffer.from(GH.file).toString('base64') }); }
  if (m === 'PUT' && u.pathname.endsWith('/contents/data/anime/list.json')) { const b = JSON.parse(opt.body); if (b.branch !== 'main') return res(400, {});
    if (GH.clash) { GH.clash--; GH.sha++; return res(409, {}); } if ('s' + GH.sha !== b.sha) return res(409, {});
    GH.file = Buffer.from(b.content, 'base64').toString('utf8'); GH.sha++; GH.puts.push(b.message); return res(200, {}); }
  return res(404, {}); };
const { default: handler, config, place, TYPES } = await import('../netlify/functions/anime-add.mjs');
const post = async body => { const r = await handler(new Request('https://x/api/anime-add', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })); return { status: r.status, ...(await r.json()) }; };
const ok = { password: 'open-sesame-42' }, list = () => JSON.parse(GH.file);

console.log('دالة «أضف أنمي» في أنمياتي');
check('المسار /api/anime-add', config.path === '/api/anime-add' && TYPES.includes('TV') && TYPES.includes('Movie'));
check('غير POST مرفوض', (await handler(new Request('https://x/api/anime-add'))).status === 405);
check('طلب بلا JSON مرفوض', (await post('{oops')).status === 400);
let r = await post({ password: 'wrong', mal: 52991, title: 'Sousou no Frieren' });
check('كلمة سر خاطئة: 401 ولا شيء يُكتب ولا يُسأل GitHub', r.status === 401 && r.error === 'password' && !GH.calls.length, r);
r = await post({ mal: 52991, title: 'Sousou no Frieren' }); check('بلا كلمة سر: 401', r.status === 401);
for (const bad of [{ mal: 0, title: 'x' }, { mal: 'x', title: 'x' }, { mal: 1.5, title: 'x' }, { mal: 99999999, title: 'x' }, { mal: 52991 }, { mal: 52991, title: '   ' }]) { r = await post({ ...ok, ...bad }); check(`طلب غير صالح مرفوض: ${JSON.stringify(bad)}`, r.status === 400 && !GH.calls.length, r); }

r = await post({ ...ok, mal: 52991, title: 'Sousou no Frieren', type: 'TV', eps: 28 });
check('عمل جديد: يُكتب في القائمة على main بإيداع يحمل [skip ci]، في موضعه من ترتيب الأسماء', r.status === 200 && r.state === 'added' && GH.puts[0] === 'anime: add Sousou no Frieren (#52991) [skip ci]'
  && list().map(x => x.mal).join() === '5525,1535,21,52991' && JSON.stringify(list()[3]) === '{"mal":52991,"title":"Sousou no Frieren","type":"TV","eps":28}', [r, GH.puts, list()]);
check('شكل الملف كما يكتبه scripts/anime-list.mjs: سطر لكل عمل', GH.file === write(list()) && GH.file.split('\n').length === list().length + 3, GH.file);
r = await post({ ...ok, mal: 52991, title: 'Sousou no Frieren' });
check('العمل نفسه ثانية: موجود ولا كتابة', r.state === 'exists' && GH.puts.length === 1, r);
r = await post({ ...ok, mal: '32281', title: 'Kimi no Na wa.', type: 'Movie', eps: 1 });
check('الرقم النصي يُقبل، والفيلم بنوعه، والموضع بين ما قبله وما بعده', r.state === 'added' && list().map(x => x.mal).join() === '5525,1535,32281,21,52991', list().map(x => x.title));
r = await post({ ...ok, mal: 61001, title: '  The iDOLM@STER <script>"x"</script>\n【Oshi no Ko】  ', type: 'Hentai', eps: -3 });
const last = list().find(x => x.mal === 61001);
check('الاسم يُنظَّف من وسوم HTML والأسطر ويبقي رموز MyAnimeList، والنوع المجهول مسلسل، والعدد السالب صفر', r.state === 'added' && last.title === 'The iDOLM@STER script x /script 【Oshi no Ko】' && last.type === 'TV' && last.eps === 0 && !/[<>"\n]/.test(GH.puts.at(-1)), [last, GH.puts.at(-1)]);
GH.clash = 1; r = await post({ ...ok, mal: 30, title: 'Shinseiki Evangelion', type: 'TV', eps: 26 });
check('اصطدام في الكتابة: تُعاد القراءة والمحاولة وينجح', r.state === 'added' && list().some(x => x.mal === 30), r);
const before = GH.file; GH.file = '{oops'; r = await post({ ...ok, mal: 1, title: 'Cowboy Bebop' });
check('ملف قائمة تالف: لا يُكتب فوقه شيء', r.status === 502 && /لم يُكتب شيء/.test(r.error) && GH.file === '{oops', r);
GH.file = '[]\n'; r = await post({ ...ok, mal: 1, title: 'Cowboy Bebop' }); check('ملف قائمة فارغ: لا يُكتب فوقه شيء', r.status === 502 && GH.file === '[]\n', r); GH.file = before;
GH.deny = 403; r = await post({ ...ok, mal: 8, title: 'Bouken Ou Beet' });
check('رمز GitHub مرفوض: رسالة تقول ذلك بلا تفاصيل', r.status === 502 && /GH_TOKEN/.test(r.error), r); GH.deny = 0;
GH.deny = 500; const err = console.error; console.error = () => {}; r = await post({ ...ok, mal: 8, title: 'Bouken Ou Beet' }); console.error = err; check('عطل في GitHub: رسالة عامة', r.status === 502 && /حاول بعد قليل/.test(r.error), r); GH.deny = 0;
delete process.env.GH_TOKEN; r = await post({ ...ok, mal: 8, title: 'Bouken Ou Beet' }); check('بلا GH_TOKEN: خطأ إعداد واضح', r.status === 500 && /GH_TOKEN/.test(r.error), r); process.env.GH_TOKEN = 'test-token';
process.env.ADD_GAME_PASSWORD = 'games-pass'; r = await post({ ...ok, mal: 8, title: 'Bouken Ou Beet' }); const r2 = await post({ password: 'games-pass', mal: 8, title: 'Bouken Ou Beet' });
check('كلمة سر «أضف لعبة» تتقدم حين توجد', r.status === 401 && r2.state === 'added', [r, r2]);
delete process.env.ADD_GAME_PASSWORD; delete process.env.ADD_FILM_PASSWORD; r = await post({ ...ok, mal: 9, title: 'x' }); check('بلا كلمة سر في الخادم: خطأ إعداد', r.status === 500 && /كلمة السر/.test(r.error), r);
// فلتر +18 (E65): عمل +18 يُضاف والفلتر مرفوع يُوسم ad في القائمة، وعنوان إيداعه برقمه بلا اسمه
process.env.ADD_FILM_PASSWORD = 'open-sesame-42'; process.env.GH_TOKEN = 'test-token';
r = await post({ ...ok, mal: 70010, title: 'Velvet Found', type: 'OVA', eps: 3, ad: 1 });
check('عمل +18: يُوسم ad في القائمة، وعنوان إيداعه برقمه بلا اسمه ويحمل [skip ci]', r.state === 'added' && JSON.stringify(list().find(x => x.mal === 70010)) === '{"mal":70010,"title":"Velvet Found","type":"OVA","eps":3,"ad":1}' && GH.puts.at(-1) === 'anime: add +18 (#70010) [skip ci]', [r, GH.puts.at(-1), list().find(x => x.mal === 70010)]);
r = await post({ ...ok, mal: 70011, title: 'Plain Thing', ad: 'yes' });
check('وسم غير صريح (ليس 1 ولا true) لا يُكتب، والعمل عادي باسمه في العنوان', r.state === 'added' && !('ad' in list().find(x => x.mal === 70011)) && GH.puts.at(-1) === 'anime: add Plain Thing (#70011) [skip ci]', [list().find(x => x.mal === 70011), GH.puts.at(-1)]);
check('ترتيب الأسماء كما في scripts/anime-list.mjs', place([{ title: 'b' }, { title: 'D' }], { title: 'C' }).map(x => x.title).join() === 'b,C,D' && place([{ title: 'a' }], { title: 'z' }).map(x => x.title).join() === 'a,z');

// ---------- البحث بالاسم العربي (E70)
{ const n0 = GH.calls.length; let a = await post({ action: 'ar', q: 'العمالقة' });
  check('البحث بالاسم العربي بكلمة السر وحدها', a.status === 401 && !TM.calls.length, a);
  a = await post({ ...ok, action: 'ar', q: 'Shingeki' }); check('وما ليس فيه حرف عربي مرفوض بلا سؤال TMDB', a.status === 400 && !TM.calls.length, a);
  a = await post({ ...ok, action: 'ar', q: '  العمالقة  ' });
  check('يُسأل TMDB عن المسلسلات والأفلام بالاسم كما كُتب وبلا «ال»، ويعود الأنمي وحده (رسوم متحركة يابانية) بأسمائه الإنجليزية والأصلية وسنته، بلا تكرار ولا كتابة في GitHub', a.status === 200
    && JSON.stringify(a.items) === JSON.stringify([{ tmdb: 1429, kind: 'tv', en: 'Attack on Titan', orig: '進撃の巨人', year: 2013 }, { tmdb: 5, kind: 'movie', en: 'Attack on Titan: The Last Attack', orig: '劇場版 進撃の巨人 完結編 THE LAST ATTACK', year: 2024 }, { tmdb: 77, kind: 'tv', en: 'Star of the Giants', orig: '巨人の星', year: 1968 }])
    && TM.calls.sort().join(' | ') === 'movie العمالقة false | movie عمالقة false | tv العمالقة false | tv عمالقة false' && GH.calls.length === n0, [a, TM.calls]);
  TM.calls = []; a = await post({ ...ok, action: 'ar', q: 'العمالقة', adult: 1 }); check('والفلتر مرفوع: يُسأل بما وُسم للبالغين أيضاً', a.status === 200 && TM.calls.every(c => / true$/.test(c)) && TM.calls.length === 4, TM.calls);
  TM.deny = 401; const err = console.error; console.error = () => {}; a = await post({ ...ok, action: 'ar', q: 'العمالقة' }); console.error = err; TM.deny = 0;
  check('ومفتاح TMDB مرفوض: رسالة تقول ذلك', a.status === 502 && /TMDB_API_KEY/.test(a.error), a); }
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' | ')}` : '\n✅ كل فحوص «أضف أنمي» نجحت'); process.exit(fails.length ? 1 : 0);
