// يفحص دالتي «أضف لعبة» و«حساباتي» بلا شبكة: تويتش وIGDB وWikidata وGitHub وSteam مُحاكاة. node tests/add-game.test.mjs
process.env.GH_TOKEN = 'test-token'; process.env.ADD_FILM_PASSWORD = 'open-sesame-42';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 600)}`); if (!ok) fails.push(n); };
const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const REQ = { branch: null, stored: null, puts: [] };
let stored = null, puts = [], twitch = 0, igdbAsked = [], wdAsked = 0, secretOk = true, mq = [], steamAsked = 0;
// ألعاب بأسمائها كما في IGDB: Resident Evil 4 لعبتان بالاسم نفسه (الأصلية 2005 والجديدة 2023)
const EXACT = { hades: [{ id: 5555, name: 'Hades', platforms: [6, 130], first_release_date: 1600300800, total_rating_count: 500 }],
  'uncharted: legacy of thieves collection': [{ id: 9100, name: 'UNCHARTED: Legacy of Thieves Collection', game_type: 3, platforms: [167, 6], first_release_date: 1643328000, total_rating_count: 150 }],
  // أسماء عامة فيها مداخل قديمة أو مجهولة بالاسم نفسه (كما في IGDB فعلاً)
  hitman: [{ id: 218314, name: 'Hitman', platforms: [26], first_release_date: 441763200, total_rating_count: 0 }, { id: 11157, name: 'Hitman', platforms: [48, 49, 6], first_release_date: 1457654400, total_rating_count: 605 }],
  batman: [{ id: 14288, name: 'Batman', platforms: [15, 26], first_release_date: 599616000, total_rating_count: 45 }, { id: 304097, name: 'Batman', platforms: [6], first_release_date: 1262304000, total_rating_count: 0 }],
  'never alone': [{ id: 273575, name: 'Never Alone' }],
  'far cry': [{ id: 306, name: 'Far Cry', platforms: [6], first_release_date: 1079913600, total_rating_count: 800 }],
  'resident evil 4': [{ id: 7001, name: 'Resident Evil 4', platforms: [6, 48, 21], first_release_date: 1105401600, total_rating_count: 2000 }, { id: 7002, name: 'Resident Evil 4', platforms: [167, 48, 6], first_release_date: 1679616000, total_rating_count: 900 }] };
const T = [{ id: 0, type: 'Main Game' }, { id: 1, type: 'DLC' }, { id: 8, type: 'Remake' }, { id: 4, type: 'Standalone Expansion' }, { id: 3, type: 'Bundle' }];
const PL = [{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }, { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }, { id: 130, name: 'Nintendo Switch', abbreviation: 'Switch' }, { id: 169, name: 'Xbox Series X|S', abbreviation: 'Series X|S' }];
const GAME = { id: 1942, name: 'The Witcher 3: Wild Hunt', slug: 'the-witcher-3-wild-hunt', first_release_date: 1431993600, game_type: 0, platforms: [6, 167, 130], cover: { image_id: 'co1wyy' }, artworks: [{ image_id: 'ar1', width: 1920 }],
  genres: [{ name: 'Role-playing (RPG)' }], themes: [{ id: 1, name: 'Action' }], collections: [42], release_dates: [{ date: 1431993600, platform: 6, human: 'May 19, 2015' }], external_games: [{ uid: '292030', external_game_source: 1 }],
  involved_companies: [{ company: { name: 'CD Projekt RED' }, developer: true }], aggregated_rating: 92.6, summary: 'Geralt.', websites: [{ url: 'https://store.steampowered.com/app/292030' }, { url: 'https://thewitcher.com' }] };
const UP = { id: 9001, name: 'The Witcher 4', slug: 'the-witcher-4', game_type: 0, platforms: [167], hypes: 300, release_dates: [{ human: 'TBD' }] };
const Q = { id: 9002, name: 'Witcher Quarter', slug: 'witcher-q', game_type: 0, first_release_date: Math.floor(Date.UTC(2099, 8, 30) / 1000), release_dates: [{ date: Math.floor(Date.UTC(2099, 8, 30) / 1000), human: 'Q3 2099' }] };
globalThis.fetch = async (url, opt = {}) => { const u = new URL(url);
  if (u.hostname === 'id.twitch.tv') { twitch++; return secretOk ? res(200, { access_token: 'tok', expires_in: 5000000 }) : res(403, { status: 403, message: 'invalid client secret' }); }
  if (u.hostname === 'api.igdb.com') { const ep = u.pathname.split('/').pop(), b = String(opt.body || ''); igdbAsked.push(ep + ': ' + b.slice(0, 90));
    if (opt.headers['Client-ID'] !== 'cid' || opt.headers.Authorization !== 'Bearer tok') return res(401, {});
    if (ep === 'game_types') return res(200, T); if (ep === 'game_statuses') return res(200, [{ id: 0, status: 'Released' }]);
    if (ep === 'platforms') return res(200, PL);
    if (ep === 'games' && /^search "witcher"/.test(b)) return res(200, [{ id: 1942, name: 'The Witcher 3: Wild Hunt', first_release_date: 1431993600, platforms: [6, 167], cover: { image_id: 'co1wyy' }, total_rating_count: 3000 },
      { id: 666, name: 'Witcher Adult Thing', themes: [42], platforms: [6] }, { id: 20, name: 'The Witcher', first_release_date: 1193875200, platforms: [6], total_rating_count: 900 }]);
    if (ep === 'games' && /^search "the witcher 3"/i.test(b)) return res(200, /first_release_date >= /.test(b) ? [] : [{ id: 20, name: 'The Witcher', total_rating_count: 900 }, { id: 1942, name: 'The Witcher 3: Wild Hunt', first_release_date: 1431993600, platforms: [6], collections: [{ name: 'The Witcher' }], total_rating_count: 3000 }]);
    if (ep === 'games' && /where id = \(1942\);/.test(b) && /storyline/.test(b)) return res(200, [GAME]);
    if (ep === 'games' && /where id = \(/.test(b) && /^fields name,first_release_date,cover/.test(b)) return res(200, b.match(/where id = \(([^)]*)\)/)[1].split(',').map(Number).map(id => ({ id, name: id === 5555 ? 'Hades' : 'Game ' + id, first_release_date: 1600000000, cover: { image_id: 'c' + id } })));
    if (ep === 'games' && /where id = \(/.test(b)) return res(200, [{ id: 1942, name: GAME.name, slug: GAME.slug, first_release_date: GAME.first_release_date, game_type: 0, platforms: [6], cover: { image_id: 'co1wyy' } }, UP, Q, { id: 20, name: 'The Witcher', slug: 'the-witcher', first_release_date: 1193875200, game_type: 0, platforms: [6] }, { id: 21, name: 'Witcher DLC', game_type: 1, first_release_date: 1200000000 }]);
    if (ep === 'collections') return res(200, [{ id: 42, name: 'The Witcher', slug: 'the-witcher', games: [20, 1942, 9001, 9002, 21] }]);
    if (ep === 'franchises') return res(200, []);
    if (ep === 'game_time_to_beats') return res(200, [{ game_id: 1942, hastily: 50 * 3600, normally: 100 * 3600, completely: 180 * 3600, count: 40 }]);
    if (ep === 'external_games') return res(200, /"292030"/.test(b) ? [{ game: 1942, uid: '292030' }] : []);
    // كـ IGDB الحقيقي: «search» داخل multiquery يرجع فارغاً بلا خطأ؛ والمطابقة بالاسم كما هو (name ~) تعمل
    if (ep === 'multiquery') { mq.push(b); if (/search /.test(b)) return res(200, []);
      return res(200, [...b.matchAll(/query games "(\d+)" \{[^}]*where name ~ "([^"]*)"/g)].map(([, n, name]) => ({ name: n, result: EXACT[name.toLowerCase()] || [] }))); }
    if (ep === 'games' && /^search "ghost of tsushima director's cut"/i.test(b)) return res(200, [{ id: 8001, name: "Ghost of Tsushima: Director's Cut", platforms: [167, 48], first_release_date: 1629417600, total_rating_count: 300 }, { id: 8000, name: 'Ghost of Tsushima', platforms: [48], first_release_date: 1594944000, total_rating_count: 900 }]);
    if (ep === 'games' && /^search "never alone"/i.test(b)) return res(200, [{ id: 273575, name: 'Never Alone' }, { id: 7618, name: 'Never Alone: Kisima Ingitchuna', platforms: [48, 49, 6], first_release_date: 1416268800, total_rating_count: 191 }]);
    if (ep === 'games' && /^search "/.test(b)) return res(200, []);
    return res(200, []); }
  if (u.hostname === 'query.wikidata.org') { wdAsked++; const q = decodeURIComponent(String(opt.body).slice(6));
    if (/P5794/.test(q)) return res(200, { results: { bindings: [{ g: { value: 'http://www.wikidata.org/entity/Q1' }, slug: { value: 'the-witcher-3-wild-hunt' }, ar: { value: 'ذا ويتشر 3' } }] } });
    return res(200, { results: { bindings: [{ g: { value: 'http://www.wikidata.org/entity/Q1' }, rel: { value: 'into' }, w: { value: 'http://www.wikidata.org/entity/Q2' }, en: { value: 'The Witcher' }, type: { value: 'http://www.wikidata.org/entity/Q5398426' }, tt: { value: '71912' }, y: { value: '2019' } }] } }); }
  if (u.hostname === 'api.github.com') { if (opt.headers.Authorization !== 'Bearer test-token') return res(401, {});
    // فرع الطلبات (requests): يُنشأ من رأس main أول مرة، وملفه مستقل عن ملف المضافات
    if (/\/git\/ref\/heads\/requests$/.test(u.pathname)) return REQ.branch ? res(200, { object: { sha: 'r' } }) : res(404, {});
    if (/\/git\/ref\/heads\/main$/.test(u.pathname)) return res(200, { object: { sha: 'm1' } });
    if (/\/git\/refs$/.test(u.pathname)) { const b = JSON.parse(opt.body); REQ.branch = b; return res(201, {}); }
    if (/requests\.json$/.test(u.pathname)) { if (!opt.method) return REQ.stored && u.searchParams.get('ref') === 'requests' ? res(200, { sha: 'q' + REQ.puts.length, content: Buffer.from(REQ.stored).toString('base64') }) : res(404, {});
      const b = JSON.parse(opt.body); if (!REQ.branch || b.branch !== 'requests') return res(404, {}); REQ.puts.push(b); REQ.stored = Buffer.from(b.content, 'base64').toString('utf8'); return res(200, {}); }
    if (!opt.method) return stored ? res(200, { sha: 's' + puts.length, content: Buffer.from(stored).toString('base64') }) : res(404, {});
    const b = JSON.parse(opt.body); puts.push(b); stored = Buffer.from(b.content, 'base64').toString('utf8'); return res(200, {}); }
  if (u.hostname === 'api.steampowered.com' && u.searchParams.get('key') === 'bad') return new Response('Forbidden', { status: 403 });
  if (u.hostname === 'api.steampowered.com' && /GetSupportedAPIList/.test(u.pathname)) { steamAsked++; return res(200, { apilist: { interfaces: [] } }); }
  if (u.hostname === 'api.steampowered.com') return res(200, u.searchParams.get('steamid') === '76561198000000009' ? { response: {} } : { response: { game_count: 3, games: [
    { appid: 292030, name: 'The Witcher 3: Wild Hunt', playtime_forever: 6000, rtime_last_played: 1700000000 }, { appid: 1145360, name: 'Hades', playtime_forever: 90, rtime_last_played: 1760000000 }, { appid: 7, name: 'Never Played', playtime_forever: 0 }] } });
  if (u.hostname === 'steamcommunity.com') return new Response(/openid\.sig=good/.test(String(opt.body)) ? 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n' : 'is_valid:false\n');
  throw new Error('unexpected fetch ' + url); };
const { default: add, config } = await import('../netlify/functions/add-game.mjs');
const { default: acc, config: cfg2, clean, isoHours, byName } = await import('../netlify/functions/game-accounts.mjs');
const call = async (h, body, path = '/api/add-game') => { const r = await h(new Request('https://site.test' + path, { method: 'POST', body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
const PW = 'open-sesame-42';
check('المساران /api/add-game و/api/game-accounts', config.path === '/api/add-game' && cfg2.path === '/api/game-accounts');
check('كلمة سر خاطئة تُرفض', (await call(add, { action: 'suggest', q: 'x', password: 'no' })).status === 401);
const nokey = await call(add, { action: 'suggest', q: 'witcher', password: PW });
check('بلا مفاتيح IGDB: رسالة واضحة بالعربي ونوع النقص (igdb)، بلا طلب إلى تويتش', nokey.status === 503 && nokey.body.need === 'igdb' && /IGDB_CLIENT_ID/.test(nokey.body.error) && twitch === 0, nokey);
// الفحص بلا كلمة سر (GET): حالة المفتاحين فقط، بلا أي قيمة
const health = async h => { const r = await h(new Request('https://site.test/api/add-game')); return { status: r.status, text: await r.text() }; };
const h0 = await health(add);
check('الفحص بلا كلمة سر: «missing» بلا مفاتيح (IGDB وSteam)، بلا طلب إلى تويتش ولا Steam', h0.status === 200 && JSON.parse(h0.text).igdb === 'missing' && JSON.parse(h0.text).steam === 'missing' && twitch === 0 && steamAsked === 0, h0);
process.env.IGDB_CLIENT_ID = ' cid\n'; process.env.IGDB_CLIENT_SECRET = 'sec \n';
secretOk = false;
const h1 = await health(add), t1 = twitch, h1b = await health(add);
check('الفحص: «secret» حين يرفض تويتش السر، ولا يكشف قيمة أي مفتاح، والجواب يُحفظ قليلاً فلا يُستنزف تويتش', JSON.parse(h1.text).igdb === 'secret' && !/cid|sec\b/.test(h1.text) && JSON.parse(h1b.text).igdb === 'secret' && twitch === t1, [h1, h1b, twitch, t1]);
const bad = await call(add, { action: 'suggest', q: 'witcher', password: PW });
check('سر IGDB مرفوض من تويتش: يقول أي المفتاحين المرفوض (السر) بلا تفاصيل سرية', bad.status === 502 && bad.body.need === 'igdb' && /رفض السر/.test(bad.body.error) && /IGDB_CLIENT_SECRET/.test(bad.body.error), bad);
secretOk = true;
const { default: add2 } = await import('../netlify/functions/add-game.mjs?fresh'), h2 = await health(add2);
check('الفحص: «ok» حين يقبل تويتش المفتاحين', JSON.parse(h2.text).igdb === 'ok', h2);
const sg = await call(add, { action: 'suggest', q: 'witcher', password: PW });
check('الاقتراحات: من IGDB بعائلات منصاتها، بلا المحتوى الإباحي، والمفتاحان بلا مسافات زائدة', sg.status === 200 && sg.body.items.length === 2 && sg.body.items[0].igdb === 1942 && sg.body.items[0].fams === (8 | 1) && !sg.body.items.some(x => x.igdb === 666), sg.body);
const se = await call(add, { action: 'search', q: 'The Witcher 3 2015', password: PW });
check('البحث: «الاسم والسنة» يُفهم، وإن لم يجد بالسنة يبحث بلا سنة، والمطابق أولاً', se.body.parsed.title === 'The Witcher 3' && se.body.parsed.year === 2015 && se.body.candidates[0].igdb === 1942 && se.body.candidates[0].series === 'The Witcher' && se.body.candidates[0].plats.join() === 'PC', se.body);
const pv = await call(add, { action: 'preview', igdb: 1942, password: PW }), g = pv.body.game, s = pv.body.series?.[42];
check('البطاقة: الاسم العربي والاقتباس إلى مسلسل برقم TMDB من Wikidata', g.titleAr === 'ذا ويتشر 3' && g.into[0]?.tmdb === 't71912' && g.into[0].kind === 'tv', g);
check('البطاقة: المنصات برموزها مرتبة (PS5 قبل PC قبل Switch)، والمتجر والموقع الرسمي، ورقم Steam، وكم تأخذ لتختمها بالساعات', g.plats.join() === 'ps5,pc,switch' && g.sites.map(x => x.t).join() === 'steam,official' && g.ext.steam === '292030' && g.ttb.n === 100 && g.critic === 93, g);
check('السلسلة: الأجزاء الرئيسية بترتيب الصدور بلا الإضافات، والمعلنة بلا موعد «tba»، وذات الربع «Q3» بلا موعد يومي', s && s.members.map(m => m.id).join() === '20,1942,9002,9001' && s.members.at(-1).status === 'tba' && s.members[2].prec === 'q' && s.members[2].status === 'upcoming', s);
const ad = await call(add, { action: 'add', igdb: 1942, password: PW });
check('الإضافة: تُكتب في data/games/added.json بإيداع واحد وتعود اللعبة', ad.body.state === 'added' && JSON.parse(stored).games[0].igdb === 1942 && /games: add The Witcher 3/.test(puts[0].message) && ad.body.game.src === 'added', { b: ad.body.state, stored });
check('إضافتها مرة ثانية لا تكررها', (await call(add, { action: 'add', igdb: 1942, password: PW })).body.state === 'exists' && JSON.parse(stored).games.length === 1);
const im = await call(add, { action: 'import', items: [{ igdb: 1942 }, { igdb: 1942 }, { igdb: 'x' }], source: 'steam', password: PW });
check('الدفعة من الحسابات: إيداع واحد بلا تكرار ولا قيم غير صالحة', im.status === 200 && im.body.state.added === 0 && im.body.state.exists === 1, im.body.state);
// الحذف: من ملف المضافات بإيداع واحد، وما ليس فيه لا يكتب شيئاً، ولا يحتاج مفاتيح IGDB
{ const before = puts.length, n0 = igdbAsked.length, tw0 = twitch;
  const noPw = await call(add, { action: 'remove', igdb: 1942, password: 'wrong' });
  const rm = await call(add, { action: 'remove', igdb: 1942, password: PW });
  check('الحذف: بكلمة السر فقط، ويُكتب الملف بلا اللعبة بإيداع واحد اسمه «games: remove …»', noPw.status === 401 && rm.status === 200 && rm.body.state === 'removed' && JSON.parse(stored).games.length === 0 && puts.length === before + 1 && /^games: remove The Witcher 3/.test(puts.at(-1).message), { rm: rm.body, stored, msg: puts.at(-1)?.message });
  const again = await call(add, { action: 'remove', igdb: 1942, password: PW }), bad = await call(add, { action: 'remove', igdb: 'x', password: PW });
  check('حذف ما ليس في القائمة لا يكتب شيئاً، والمعرّف غير الصالح مرفوض، وبلا أي طلب إلى IGDB', again.body.state === 'absent' && puts.length === before + 1 && bad.status === 400 && igdbAsked.length === n0 && twitch === tw0, { again: again.body, bad: bad.status });
  const back = await call(add, { action: 'add', igdb: 1942, password: PW });
  check('التراجع عن الحذف: إضافتها من جديد تعيدها إلى الملف', back.body.state === 'added' && JSON.parse(stored).games.length === 1, back.body.state); }
// «ترجمها لي»: الطلب يُكتب على فرع requests (يُنشأ من main أول مرة) لا على main، فلا يعاد بناء الموقع
{ const mainPuts = puts.length, n0 = igdbAsked.length;
  const a1 = await call(add, { action: 'ask', igdb: 1942, title: 'The Witcher 3: Wild Hunt <b>', password: PW }), doc1 = JSON.parse(REQ.stored || '{}');
  check('طلب الترجمة: يُنشأ فرع requests من رأس main، ويُكتب فيه الطلب برقم اللعبة واسمها ووقته، ولا يُمس main', a1.status === 200 && a1.body.state === 'asked' && REQ.branch?.ref === 'refs/heads/requests' && REQ.branch.sha === 'm1'
    && doc1.ar?.length === 1 && doc1.ar[0].igdb === 1942 && doc1.ar[0].title === 'The Witcher 3: Wild Hunt b' && /^\d{4}-/.test(doc1.ar[0].at) && REQ.puts[0].branch === 'requests' && /^games: translate The Witcher 3/.test(REQ.puts[0].message) && puts.length === mainPuts, { a1: a1.body, REQ });
  const a2 = await call(add, { action: 'ask', igdb: 1942, password: PW }), a3 = await call(add, { action: 'ask', igdb: 5555, title: 'Hades', password: PW }), doc3 = JSON.parse(REQ.stored);
  check('طلبها ثانية لا يكرر، وطلب لعبة أخرى يُضاف إلى الملف نفسه بلا إنشاء الفرع من جديد', a2.body.state === 'exists' && a3.body.state === 'asked' && REQ.puts.length === 2 && doc3.ar.map(x => x.igdb).join() === '1942,5555' && REQ.puts[1].sha === 'q1', { a2: a2.body, a3: a3.body, n: REQ.puts.length });
  const a4 = await call(add, { action: 'ask', igdb: 1942, password: 'wrong' }), a5 = await call(add, { action: 'ask', igdb: -3, password: PW });
  check('طلب الترجمة بكلمة السر فقط، والمعرّف غير الصالح مرفوض، وبلا أي طلب إلى IGDB', a4.status === 401 && a5.status === 400 && igdbAsked.length === n0, [a4.status, a5.status]); }
// حساباتي
const st = await call(acc, { action: 'status', password: PW }, '/api/game-accounts');
check('حساباتي: الحالة تقول ما المهيأ في Netlify (IGDB نعم، Steam وPSN وXbox لا)', st.body.igdb === true && st.body.steam === false && !st.body.psn && !st.body.xbox, st.body);
const login = await acc(new Request('https://site.test/api/game-accounts?steam=login'));
const to = new URL(login.headers.get('location'));
check('«ادخل عبر Steam»: تحويل إلى Steam OpenID ورجوع إلى الموقع نفسه', login.status === 302 && to.origin === 'https://steamcommunity.com' && to.searchParams.get('openid.return_to') === 'https://site.test/api/game-accounts?steam=back' && to.searchParams.get('openid.mode') === 'checkid_setup', to.href);
const back = q => acc(new Request('https://site.test/api/game-accounts?steam=back&' + new URLSearchParams({ 'openid.ns': 'http://specs.openid.net/auth/2.0', 'openid.mode': 'id_res', 'openid.op_endpoint': 'https://steamcommunity.com/openid/login', 'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000001', 'openid.return_to': 'https://site.test/api/game-accounts?steam=back', ...q })));
check('رجوع Steam بتوقيع صحيح يتحقق منه Steam نفسه ويعيدك برقم حسابك', (await back({ 'openid.sig': 'good' })).headers.get('location') === 'https://site.test/games/#steam=76561198000000001');
check('رجوع مزوّر (توقيع خاطئ أو رابط رجوع غريب) يُرفض', (await back({ 'openid.sig': 'forged' })).headers.get('location').endsWith('#steam-fail') && (await back({ 'openid.sig': 'good', 'openid.return_to': 'https://evil.test/x' })).headers.get('location').endsWith('#steam-fail'));
const nosk = await call(acc, { action: 'steam', steamid: '76561198000000001', password: PW }, '/api/game-accounts');
check('Steam بلا مفتاح في Netlify: رسالة واضحة', nosk.status === 503 && nosk.body.need === 'steam-key', nosk.body);
// فحص مفتاح Steam بلا كلمة سر: «bad» حين يرفضه Steam، و«ok» حين يقبله، ولا يظهر المفتاح في الجواب
process.env.STEAM_API_KEY = 'bad';
const { default: add3 } = await import('../netlify/functions/add-game.mjs?steam-bad'), hs1 = await health(add3);
process.env.STEAM_API_KEY = 'k';
const { default: add4 } = await import('../netlify/functions/add-game.mjs?steam-ok'), hs2 = await health(add4);
check('الفحص: مفتاح Steam «bad» حين يرفضه Steam و«ok» حين يقبله، بلا أي قيمة في الجواب', JSON.parse(hs1.text).steam === 'bad' && JSON.parse(hs2.text).steam === 'ok' && !/"k"|bad"?:/.test(hs2.text.replace(/"steam":"\w+"/, '')), [hs1.text, hs2.text]);
const sm = await call(acc, { action: 'steam', steamid: '76561198000000001', password: PW }, '/api/game-accounts');
check('Steam: ما لعبته فقط (لا «Never Played»)، مطابقاً برقم المتجر (Witcher 3) بساعاته ومتوسط ختمه، والبقية (Hades) تعود للمطابقة بالاسم', sm.status === 200 && sm.body.total === 2 && sm.body.items.find(x => x.name.startsWith('The Witcher'))?.igdb === 1942 && sm.body.items.find(x => x.name.startsWith('The Witcher')).hours === 100 && sm.body.items.find(x => x.name === 'Hades')?.todo === true && sm.body.todo === 1 && sm.body.items.find(x => x.igdb === 1942).ttb?.n === 100, sm.body);
// المطابقة بالاسم في دفعات: الاسم كما هو أولاً (multiquery بلا search)، ثم البحث لما بقي؛ وبين لعبتين بالاسم نفسه: التي على منصتك ولم تصدر بعد آخر لعب
mq.length = 0; igdbAsked.length = 0;
const mt = await call(acc, { action: 'match', source: 'psn', items: [{ key: 'steam:1145360', name: 'Hades', plat: 'pc' }, { key: 'psn:1', name: 'Resident Evil 4', plat: 'ps5', last: '2024-01-10' },
  { key: 'psn:2', name: 'Resident Evil 4', plat: 'ps4', last: '2019-05-01' }, { key: 'psn:3', name: "Ghost of Tsushima DIRECTOR’S CUT", plat: 'ps5' }, { key: 'psn:4', name: 'Totally Unknown Game', plat: 'ps5' }, { key: 'psn:5', name: 'UNCHARTED™: Legacy of Thieves Collection', plat: 'ps5' }, { key: '', name: 'x' }], password: PW }, '/api/game-accounts');
const M = k => mt.body.items?.find(x => x.key === k);
check('المطابقة بالاسم: Hades كما هو، وResident Evil 4 على PS5 الجديدة وعلى PS4 قبل 2023 الأصلية، والاسم بعلامات مختلفة بالبحث، وغير الموجودة «لم أجدها» لا «للمطابقة»',
  mt.status === 200 && M('steam:1145360')?.igdb === 5555 && M('steam:1145360').title === 'Hades' && M('psn:1')?.igdb === 7002 && M('psn:2')?.igdb === 7001 && M('psn:3')?.igdb === 8001 && M('psn:4')?.igdb === null && !M('psn:4').todo && M('psn:5')?.igdb === 9100 && mt.body.items.length === 6, mt.body);
check('المطابقة: لا «search» داخل multiquery (IGDB يرجعه فارغاً)، والمجموعات (Bundle) مقبولة، والبحث العادي لما لم يطابق اسمه فقط', mq.length >= 1 && mq.every(b => !/search /.test(b) && /where name ~ /.test(b) && /game_type = \([^)]*\b3\)/.test(b)) && igdbAsked.filter(x => /^games: search /.test(x)).length === 2, { mq, asked: igdbAsked });
// أسماء عامة: لا لعبة قديمة ولا مجهولة ولا بلا تاريخ بدل لعبتك
{ const r = await call(acc, { action: 'match', source: 'psn', items: [{ key: 'a', name: 'HITMAN', plat: 'ps4', last: '2016-02-20' }, { key: 'b', name: 'Batman', plat: 'ps4', last: '2018-01-01' }, { key: 'c', name: 'Never Alone', plat: 'ps4', last: '2017-01-01' },
    { key: 'd', name: 'Far Cry', plat: 'x360', last: '2015-01-01' }, { key: 'e', name: 'Resident Evil 4', plat: 'ps4', last: '2018-01-01' }], password: PW }, '/api/game-accounts'), R = k => r.body.items?.find(x => x.key === k);
  check('«HITMAN» على PS4 هي لعبة 2016 لا لعبة 1984، ولو لُعبت نسختها التجريبية قبل صدورها بأسابيع', R('a')?.igdb === 11157, R('a'));
  check('«Batman» على PS4 بلا لعبة تناسبها: «لم أجدها» لا لعبة 1989 ولا لعبة كمبيوتر مجهولة', R('b')?.igdb === null && !R('b').todo, R('b'));
  check('«Never Alone»: المدخل بلا تاريخ ولا منصات يُرفض، فتُطابق بالبحث لعبة 2014 (غير مؤكدة الاسم)', R('c')?.igdb === 7618 && R('c').sure === false, R('c'));
  check('لعبة معروفة ليست على منصتك في IGDB تُقبل (Far Cry على Xbox 360)، وResident Evil 4 لمن لعبها في 2018 ليست الجديدة', R('d')?.igdb === 306 && R('e')?.igdb === 7001, [R('d'), R('e')]); }
const late = await byName([{ key: 'a', name: 'Hades', plat: 'pc' }, { key: 'b', name: 'Somewhere Else', plat: 'pc' }], '', Date.now() - 1);
check('المطابقة: ما لم يُبحث عنه قبل مهلة الدالة يعود «للمطابقة» في الدفعة التالية', late.how.get('a')?.id === 5555 && late.todo.has('b') && !late.how.has('b'), { how: [...late.how], todo: [...late.todo] });
const priv = await call(acc, { action: 'steam', steamid: '76561198000000009', password: PW }, '/api/game-accounts');
check('ملف Steam خاص: يقول لك اجعل «تفاصيل الألعاب» عامة', priv.status === 422 && /عامة/.test(priv.body.error), priv.body);
check('PlayStation بلا رمز: يطلبه، ورمز بشكل خاطئ يُرفض قبل أي طلب', (await call(acc, { action: 'psn', password: PW }, '/api/game-accounts')).body.need === 'psn-npsso' && /لا يشبه/.test((await call(acc, { action: 'psn', npsso: 'abc"def', password: PW }, '/api/game-accounts')).body.error));
check('تنظيف أسماء المتاجر: ™ و® والمنصة والطبعات', clean("Marvel's Spider-Man 2 PS5™") === "Marvel's Spider-Man 2 PS5" && clean('ELDEN RING™ Digital Deluxe Edition') === 'ELDEN RING' && clean('Ghost of Tsushima PS4 & PS5') === 'Ghost of Tsushima' && clean('The Last of Us™ Part I') === 'The Last of Us Part I', [clean("Marvel's Spider-Man 2 PS5™"), clean('ELDEN RING™ Digital Deluxe Edition'), clean('Ghost of Tsushima PS4 & PS5'), clean('The Last of Us™ Part I')]);
check('مدة اللعب من PSN بالساعات', isoHours('PT228H56M33S') === 228.9 && isoHours('PT45M') === 0.8 && isoHours('P1DT2H') === 26, [isoHours('PT228H56M33S'), isoHours('PT45M'), isoHours('P1DT2H')]);
// منصات السجلات الشقيقة: IGDB يفرد للأركيد سجلاً ولنسخ المنزل سجلات بالاسم نفسه. تُضم منصاتها إلى الأساسي الأقرب قبلها، ولا تُخلط أساسيتان بالاسم نفسه
{ const { alsoPlatforms } = await import('../scripts/lib-games.mjs'), T = { 1247: 'main', 1236: 'expanded', 195868: 'port', 272551: 'port', 549: 'main', 19560: 'main', 900: 'port', 901: 'port', 7498: 'expanded', 77: 'main', 78: 'dlc' };
  const g = (id, name, y, platforms) => ({ id, name, first_release_date: y ? Date.UTC(y, 0, 1) / 1000 : undefined, platforms });
  const r = alsoPlatforms([[g(1247, 'Tekken 6', 2007, [52]), g(1236, 'Tekken 6', 2009, [9, 12]), g(195868, 'Tekken 6', 2009, [38]), g(272551, 'Tekken 6', 2023, [48, 167]), g(7498, 'Tekken 7', 2017, [6, 48])],
    [g(549, 'God of War', 2005, [8]), g(19560, 'God of War', 2018, [48, 6]), g(900, 'God of War', 2022, [14]), g(901, 'God of War', undefined, [3]), g(77, 'Solo', 2010, [6]), g(78, 'Solo: Extra', 2011, [9])]], x => T[x.id]), of = id => [...(r.get(id) || [])].join();
  check('منصات السجلات الشقيقة: نسخ PS3 وXbox 360 وPSP وPS5 من Tekken 6 تُضم إلى سجلها الرئيسي (الأركيد)', of(1247) === '9,12,38,48,167', of(1247));
  check('اسم واحد لأساسيتين (God of War 2005 و2018): النقل يذهب إلى الأقرب صدوراً قبله، وبلا تاريخ إلى الأولى، ولا تُخلط منصات الأساسيتين', of(19560) === '14' && of(549) === '3', [of(549), of(19560)]);
  check('لعبة موسّعة بلا أساسي بالاسم نفسه، ولعبة بلا سجلات شقيقة: لا يُضم شيء', !r.has(7498) && !r.has(77) && !r.has(78), [...r.keys()]);
  const r2 = alsoPlatforms([[g(1247, 'Tekken 6', 2007, [52]), g(1236, 'Tekken 6', 2009, [9, 12]), g(195868, 'Tekken 6', 2009, [38])]], x => T[x.id], x => x.id === 195868);
  check('سجل شقيق ملغى أو لم يصدر لا تُضم منصاته', [...r2.get(1247)].join() === '9,12', [...r2.get(1247)]); }
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص دالتي الألعاب نجحت'); process.exit(fails.length ? 1 : 0);
