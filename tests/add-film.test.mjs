// يفحص دالة «أضف فيلماً» بلا شبكة: TMDB و GitHub مُحاكيان. node tests/add-film.test.mjs
process.env.TMDB_API_KEY = 'k'.repeat(32); process.env.GH_TOKEN = 'test-token'; process.env.ADD_FILM_PASSWORD = 'open-sesame-42';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d)}`); if (!ok) fails.push(n); };
let stored = null, puts = [], conflictOnce = true, wdDown = false, wdAsked = 0;
const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opt = {}) => { const u = new URL(url);
  if (u.hostname === 'api.themoviedb.org') { const p = u.pathname.replace('/3', '');
    if (p === '/search/movie') return res(200, { results: u.searchParams.get('query').toLowerCase() === 'heat' ? [{ id: 949, title: 'Heat', release_date: '1995-12-15', vote_count: 7000, poster_path: '/h.jpg' }, { id: 1, title: 'The Heat', release_date: '2013-06-27', vote_count: 5000 }] : [] });
    if (p === '/search/tv') return res(200, { results: [] });
    if (p === '/movie/949') return res(200, { id: 949, title: 'Heat', original_title: 'Heat', release_date: '1995-12-15', runtime: 170, genres: [{ id: 80 }], vote_average: 7.9, vote_count: 7000, poster_path: '/h.jpg', imdb_id: 'tt0113277', status: 'Released', original_language: 'en',
      belongs_to_collection: { id: 77, name: 'Heat Collection' }, credits: { crew: [{ job: 'Director', name: 'Michael Mann' }], cast: [{ name: 'Al Pacino' }] }, 'watch/providers': { results: { SA: { link: 'https://tmdb/watch', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }] } } }, translations: { translations: [] } });
    if (p === '/movie/1') return res(200, { id: 1, title: 'The Heat' });
    if (p === '/movie/950') return res(200, { id: 950, title: 'Heat 2', release_date: '', vote_count: 0, poster_path: '/h2.jpg', genres: [{ id: 80 }] });
    if (p === '/collection/77') return res(200, { id: 77, name: 'Heat Collection', parts: [{ id: 950, title: 'Heat 2', release_date: '' }, { id: 949, title: 'Heat', release_date: '1995-12-15', vote_count: 5, vote_average: 7.9 }] });
    return res(404, {}); }
  // Wikidata: Heat يليه Heat 2 (المخرج نفسه، والعنوانان متشابهان، فهي تكملة)
  if (u.hostname === 'query.wikidata.org') { wdAsked++; if (opt.headers['User-Agent']?.indexOf('dc-guide') !== 0) return res(403, {}); if (wdDown) return new Response('bad', { status: 400 });
    const q = decodeURIComponent(opt.body.slice(6)), U = v => ({ type: 'uri', value: 'http://www.wikidata.org/entity/' + v }), L = v => ({ type: 'literal', value: String(v) }), B = b => res(200, { results: { bindings: b } });
    if (q.includes('P2408')) return B([{ tid: L(950), item: U('Q2'), wiki: U('https://en.wikipedia.org/wiki/Heat_2') }, { tid: L(949), item: U('Q1'), wiki: U('https://en.wikipedia.org/wiki/Heat_(1995_film)') }]);
    if (q.includes('VALUES ?tid')) return B([{ tid: L(949), item: U('Q1'), prop: L('ITEM') }, { tid: L(949), item: U('Q1'), prop: L('P156'), o: U('Q2') }, { tid: L(949), item: U('Q1'), prop: L('DIR'), o: U('Q9') }]);
    if (q.includes('(MIN(?d) AS ?date) (SAMPLE(?w) AS ?wiki)')) return B([...q.includes('wd:Q2') ? [{ o: U('Q2'), label: L('Heat 2'), tm: L(950), prev: L('Q1'), dir: L('Q9') }] : [], ...q.includes('wd:Q1 ') || q.includes('wd:Q1 }') ? [{ o: U('Q1'), label: L('Heat'), tm: L(949), next: L('Q2'), dir: L('Q9'), date: L('1995-12-15T00:00:00Z') }] : []]);
    return B([]); }
  // Wikipedia: مقدمة Heat 2 تقول إنه يسبق Heat ويليه (رواية مايكل مان)
  if (u.hostname === 'en.wikipedia.org') return res(200, { query: { pages: [{ title: 'Heat 2', extract: 'Heat 2 is an upcoming American crime film. It serves as a prequel and sequel to Heat (1995).' }, { title: 'Heat (1995 film)', extract: 'Heat is a 1995 American crime film.' }] } });
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
const wl = await call({ action: 'worlds', tmdb: 949, kind: 'movie', password: 'open-sesame-42' });
check('العالم: Heat ثم Heat 2 أعمالاً متتالية، بمعلومات الجزء الثاني من TMDB', wl.status === 200 && wl.body.key === 'm949' && wl.body.works.m949?.worlds?.[0] === 'c:m949' && wl.body.worlds['c:m949']?.order.join() === 'm949,m950' && wl.body.info.m950?.title === 'Heat 2' && wdAsked >= 2, wl.body);
check('ترتيب الأحداث: Heat 2 قبل Heat بدليل من Wikipedia، في العالم ومجموعة TMDB معاً', wl.body.worlds['c:m949']?.chrono?.order.join() === 'm950,m949' && wl.body.worlds['c:m949'].chrono.moved.m950?.src.includes('wikipedia') && wl.body.cols?.[77]?.order?.join() === 'm950,m949', { w: wl.body.worlds, c: wl.body.cols });
check('العالم يحتاج كلمة السر ولا يسأل Wikidata بدونها', await (async () => { const n = wdAsked, r = await call({ action: 'worlds', tmdb: 949, kind: 'movie', password: 'x' }); return r.status === 401 && wdAsked === n; })());
wdDown = true; const wd = await call({ action: 'worlds', tmdb: 949, kind: 'movie', password: 'open-sesame-42' }); wdDown = false;
check('تعطّل Wikidata يعيد خطأً واضحاً ولا يكتب شيئاً', wd.status === 502 && wd.body.error && puts.length === 1, wd);
check('عمل غير موجود في TMDB برسالة واضحة', (await call({ action: 'add', tmdb: 123456, password: 'open-sesame-42' })).status === 422);
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل الفحوص نجحت'); process.exit(fails.length ? 1 : 0);
