// يفحص دالتي «أضف لعبة» و«حساباتي» بلا شبكة: تويتش وIGDB وWikidata وGitHub وSteam مُحاكاة. node tests/add-game.test.mjs
process.env.GH_TOKEN = 'test-token'; process.env.ADD_FILM_PASSWORD = 'open-sesame-42';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 600)}`); if (!ok) fails.push(n); };
const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let stored = null, puts = [], twitch = 0, igdbAsked = [], wdAsked = 0, secretOk = true;
const T = [{ id: 0, type: 'Main Game' }, { id: 1, type: 'DLC' }, { id: 8, type: 'Remake' }, { id: 4, type: 'Standalone Expansion' }];
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
    if (ep === 'multiquery') return res(200, [{ name: '0', result: [{ id: 5555, name: 'Hades', total_rating_count: 500 }] }]);
    return res(200, []); }
  if (u.hostname === 'query.wikidata.org') { wdAsked++; const q = decodeURIComponent(String(opt.body).slice(6));
    if (/P5794/.test(q)) return res(200, { results: { bindings: [{ g: { value: 'http://www.wikidata.org/entity/Q1' }, slug: { value: 'the-witcher-3-wild-hunt' }, ar: { value: 'ذا ويتشر 3' } }] } });
    return res(200, { results: { bindings: [{ g: { value: 'http://www.wikidata.org/entity/Q1' }, rel: { value: 'into' }, w: { value: 'http://www.wikidata.org/entity/Q2' }, en: { value: 'The Witcher' }, type: { value: 'http://www.wikidata.org/entity/Q5398426' }, tt: { value: '71912' }, y: { value: '2019' } }] } }); }
  if (u.hostname === 'api.github.com') { if (opt.headers.Authorization !== 'Bearer test-token') return res(401, {});
    if (!opt.method) return stored ? res(200, { sha: 's' + puts.length, content: Buffer.from(stored).toString('base64') }) : res(404, {});
    const b = JSON.parse(opt.body); puts.push(b); stored = Buffer.from(b.content, 'base64').toString('utf8'); return res(200, {}); }
  if (u.hostname === 'api.steampowered.com') return res(200, u.searchParams.get('steamid') === '76561198000000009' ? { response: {} } : { response: { game_count: 3, games: [
    { appid: 292030, name: 'The Witcher 3: Wild Hunt', playtime_forever: 6000, rtime_last_played: 1700000000 }, { appid: 1145360, name: 'Hades', playtime_forever: 90, rtime_last_played: 1760000000 }, { appid: 7, name: 'Never Played', playtime_forever: 0 }] } });
  if (u.hostname === 'steamcommunity.com') return new Response(/openid\.sig=good/.test(String(opt.body)) ? 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n' : 'is_valid:false\n');
  throw new Error('unexpected fetch ' + url); };
const { default: add, config } = await import('../netlify/functions/add-game.mjs');
const { default: acc, config: cfg2, clean, isoHours } = await import('../netlify/functions/game-accounts.mjs');
const call = async (h, body, path = '/api/add-game') => { const r = await h(new Request('https://site.test' + path, { method: 'POST', body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
const PW = 'open-sesame-42';
check('المساران /api/add-game و/api/game-accounts', config.path === '/api/add-game' && cfg2.path === '/api/game-accounts');
check('كلمة سر خاطئة تُرفض', (await call(add, { action: 'suggest', q: 'x', password: 'no' })).status === 401);
const nokey = await call(add, { action: 'suggest', q: 'witcher', password: PW });
check('بلا مفاتيح IGDB: رسالة واضحة بالعربي ونوع النقص (igdb)، بلا طلب إلى تويتش', nokey.status === 503 && nokey.body.need === 'igdb' && /IGDB_CLIENT_ID/.test(nokey.body.error) && twitch === 0, nokey);
process.env.IGDB_CLIENT_ID = ' cid\n'; process.env.IGDB_CLIENT_SECRET = 'sec \n';
secretOk = false;
const bad = await call(add, { action: 'suggest', q: 'witcher', password: PW });
check('سر IGDB مرفوض من تويتش: يقول أي المفتاحين المرفوض (السر) بلا تفاصيل سرية', bad.status === 502 && bad.body.need === 'igdb' && /رفض السر/.test(bad.body.error) && /IGDB_CLIENT_SECRET/.test(bad.body.error), bad);
secretOk = true;
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
process.env.STEAM_API_KEY = 'k';
const sm = await call(acc, { action: 'steam', steamid: '76561198000000001', password: PW }, '/api/game-accounts');
check('Steam: ما لعبته فقط (لا «Never Played»)، مطابقاً برقم المتجر (Witcher 3) وبالاسم (Hades)، بساعاته ومتوسط ختمه', sm.status === 200 && sm.body.total === 2 && sm.body.items.find(x => x.name.startsWith('The Witcher'))?.igdb === 1942 && sm.body.items.find(x => x.name.startsWith('The Witcher')).hours === 100 && sm.body.items.find(x => x.name === 'Hades')?.igdb === 5555 && sm.body.items.find(x => x.igdb === 1942).ttb?.n === 100, sm.body);
const priv = await call(acc, { action: 'steam', steamid: '76561198000000009', password: PW }, '/api/game-accounts');
check('ملف Steam خاص: يقول لك اجعل «تفاصيل الألعاب» عامة', priv.status === 422 && /عامة/.test(priv.body.error), priv.body);
check('PlayStation بلا رمز: يطلبه، ورمز بشكل خاطئ يُرفض قبل أي طلب', (await call(acc, { action: 'psn', password: PW }, '/api/game-accounts')).body.need === 'psn-npsso' && /لا يشبه/.test((await call(acc, { action: 'psn', npsso: 'abc"def', password: PW }, '/api/game-accounts')).body.error));
check('تنظيف أسماء المتاجر: ™ و® والمنصة والطبعات', clean("Marvel's Spider-Man 2 PS5™") === "Marvel's Spider-Man 2 PS5" && clean('ELDEN RING™ Digital Deluxe Edition') === 'ELDEN RING' && clean('Ghost of Tsushima PS4 & PS5') === 'Ghost of Tsushima' && clean('The Last of Us™ Part I') === 'The Last of Us Part I', [clean("Marvel's Spider-Man 2 PS5™"), clean('ELDEN RING™ Digital Deluxe Edition'), clean('Ghost of Tsushima PS4 & PS5'), clean('The Last of Us™ Part I')]);
check('مدة اللعب من PSN بالساعات', isoHours('PT228H56M33S') === 228.9 && isoHours('PT45M') === 0.8 && isoHours('P1DT2H') === 26, [isoHours('PT228H56M33S'), isoHours('PT45M'), isoHours('P1DT2H')]);
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص دالتي الألعاب نجحت'); process.exit(fails.length ? 1 : 0);
