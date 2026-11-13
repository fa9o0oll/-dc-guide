// يفحص دالة «أضف فيلماً» بلا شبكة: TMDB و GitHub مُحاكيان. node tests/add-film.test.mjs
process.env.TMDB_API_KEY = 'k'.repeat(32); process.env.GH_TOKEN = 'test-token'; process.env.ADD_FILM_PASSWORD = 'open-sesame-42';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d)}`); if (!ok) fails.push(n); };
let stored = null, puts = [], conflictOnce = true;
const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => { const u = new URL(url);
  if (u.hostname === 'api.themoviedb.org') { const p = u.pathname.replace('/3', '');
    if (p === '/search/movie') return res(200, { results: u.searchParams.get('query').toLowerCase() === 'heat' ? [{ id: 949, title: 'Heat', release_date: '1995-12-15', vote_count: 7000, poster_path: '/h.jpg' }, { id: 1, title: 'The Heat', release_date: '2013-06-27', vote_count: 5000 }] : [] });
    if (p === '/search/tv') return res(200, { results: [] });
    if (p === '/movie/949') return res(200, { id: 949, title: 'Heat', original_title: 'Heat', release_date: '1995-12-15', runtime: 170, genres: [{ id: 80 }], vote_average: 7.9, vote_count: 7000, poster_path: '/h.jpg', imdb_id: 'tt0113277', status: 'Released', original_language: 'en',
      belongs_to_collection: { id: 77, name: 'Heat Collection' }, credits: { crew: [{ job: 'Director', name: 'Michael Mann' }], cast: [{ name: 'Al Pacino' }] }, 'watch/providers': { results: { SA: { link: 'https://tmdb/watch', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }] } } }, translations: { translations: [] } });
    if (p === '/movie/1') return res(200, { id: 1, title: 'The Heat' });
    if (p === '/collection/77') return res(200, { id: 77, name: 'Heat Collection', parts: [{ id: 950, title: 'Heat 2', release_date: '' }, { id: 949, title: 'Heat', release_date: '1995-12-15', vote_count: 5, vote_average: 7.9 }] });
    return res(404, {}); }
  if (u.hostname === 'api.github.com') { if (opt.headers.Authorization !== 'Bearer test-token') return res(401, {});
    if (!opt.method) return stored ? res(200, { sha: 's' + puts.length, content: Buffer.from(stored).toString('base64') }) : res(404, {});
    if (conflictOnce) { conflictOnce = false; return res(409, {}); }
    const b = JSON.parse(opt.body); puts.push(b); stored = Buffer.from(b.content, 'base64').toString('utf8'); return res(200, {}); }
  throw new Error('unexpected fetch ' + url); };
const { default: handler, config } = await import('../netlify/functions/add-film.mjs');
const call = async body => { const r = await handler(new Request('https://x/api/add-film', { method: 'POST', body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
check('المسار /api/add-film', config.path === '/api/add-film');
check('GET مرفوض', (await handler(new Request('https://x/api/add-film'))).status === 405);
check('كلمة سر خاطئة تُرفض', (await call({ action: 'search', q: 'Heat 1995', password: 'nope' })).status === 401);
check('بلا كلمة سر تُرفض', (await call({ action: 'add', tmdb: 949 })).status === 401);
const s = await call({ action: 'search', q: 'فيلم Heat (١٩٩٥)', password: 'open-sesame-42' });
check('البحث يفهم الاسم والسنة بالأرقام العربية', s.status === 200 && s.body.parsed.title === 'Heat' && s.body.parsed.year === 1995, s);
check('المرشح الأول هو المطابق ومعه اسم سلسلته', s.body.candidates?.[0]?.tmdb === 949 && s.body.candidates[0].collection === 'Heat' && s.body.sure === true, s.body);
const pv = await call({ action: 'preview', tmdb: 949, kind: 'movie', password: 'open-sesame-42' });
check('بطاقة الاطلاع تعيد الفيلم كاملاً بلا حفظ في المستودع', pv.status === 200 && pv.body.film.id === 'm949' && pv.body.film.overviewEn !== undefined && pv.body.collection?.id === 77 && !pv.body.state && puts.length === 0 && stored === null, pv.body);
check('بطاقة الاطلاع تحتاج كلمة السر', (await call({ action: 'preview', tmdb: 949, kind: 'movie', password: 'x' })).status === 401);
const a = await call({ action: 'add', tmdb: 949, kind: 'movie', password: 'open-sesame-42' });
check('الإضافة تعيد الفيلم بصيغة الموقع', a.status === 200 && a.body.film.id === 'm949' && a.body.film.src === 'added' && a.body.film.prov.stream[0] === 8 && a.body.providers[8].name === 'Netflix' && a.body.film.directors[0] === 'Michael Mann', a);
check('السلسلة مرتبة بالصدور والجزء بلا موعد آخراً', a.body.collection?.parts.map(p => p.tmdb).join() === '949,950', a.body.collection);
check('كُتب في المستودع بعد إعادة المحاولة عند التعارض', puts.length === 1 && JSON.parse(stored)[0].tmdb === 949 && puts[0].branch === 'main' && /films: add Heat \(1995\)/.test(puts[0].message), puts);
const again = await call({ action: 'add', tmdb: 949, kind: 'movie', password: 'open-sesame-42' });
check('إضافة الفيلم نفسه مرتين لا تكرره', again.body.state === 'exists' && puts.length === 1, again.body);
check('عمل غير موجود في TMDB برسالة واضحة', (await call({ action: 'add', tmdb: 123456, password: 'open-sesame-42' })).status === 422);
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل الفحوص نجحت'); process.exit(fails.length ? 1 : 0);
