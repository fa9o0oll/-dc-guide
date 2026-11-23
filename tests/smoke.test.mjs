// فحص سريع للواجهة الرئيسية ودليل Fate على مقاسات الكمبيوتر والجوال وشاشتي الفولد: تحميل بلا أخطاء، بلا تمدد أفقي، والعناصر الأساسية تعمل.
// node tests/smoke.test.mjs   (دليل دي سي له اختباره المفصّل في ui.test.mjs)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { let f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`, fails = [];
const check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + d}`); if (!ok) fails.push(n); };
const P = JSON.parse(fs.readFileSync(new URL('../data/fate/placements.json', import.meta.url))), U = JSON.parse(fs.readFileSync(new URL('../data/fate/universes.json', import.meta.url)));
const browser = await chromium.launch();
for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['fold-cover', 369, 905, true], ['fold-cover-zoom', 323, 792, true], ['fold-main', 707, 823, true], ['fold-main-landscape', 823, 707, true]]) {
  console.log('== ' + name);
  // مقاس واحد بتفضيل «تقليل الحركة» في النظام، ليُختبر طريقه (تلاشٍ بلا طيران)
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ar-SA', reducedMotion: name === 'fold-cover-zoom' ? 'reduce' : 'no-preference' }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|404|401/.test(m.text()) && errs.push(m.text()));
  await page.route(/image\.tmdb\.org|images\.igdb\.com|store-images\.s-microsoft\.com|cdn\.myanimelist\.net/, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="#345"/></svg>' }));
  const tap = async sel => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(550); return mobile ? l.tap() : l.click(); };
  const fits = async label => { await page.waitForTimeout(500); const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      small: [...document.querySelectorAll('button,a[href],summary,select,input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0 && (r.width < 40 || r.height < 40) && !e.closest('.foot,.hub-foot,.canon,.why,.note,[hidden]'); }).map(e => (e.className || e.tagName) + ':' + (e.textContent || '').trim().slice(0, 24)).slice(0, 3) }));
    check(`${label}: بلا تمدد أفقي`, o.sw <= o.iw, `${o.sw}/${o.iw}`); if (mobile) check(`${label}: أهداف اللمس 40px فأكثر`, o.small.length === 0, o.small.join(' ')); };
  // الواجهة الرئيسية
  await page.goto(base + '/'); await page.waitForSelector('.door');
  check('الواجهة: أربعة أبواب بروابطها', await page.locator('a.door').count() === 4 && await page.getAttribute('.door.dc', 'href') === 'dc/' && (await page.getAttribute('.door.anime', 'href')) === 'anime/' && (await page.getAttribute('.door.films', 'href')) === 'films/' && (await page.getAttribute('.door.games', 'href')) === 'games/');
  await page.waitForFunction(() => /\d/.test(document.querySelector('.door.dc [data-stat]').textContent)); check('الواجهة: عدد أعمال كل دليل ظاهر', /196/.test(await page.textContent('.door.dc [data-stat]')));
  await page.waitForFunction(() => /\d/.test(document.querySelector('.door.anime [data-stat]').textContent)); check('الواجهة: عدد أعمال «أنمياتي» ظاهر', /\d{3,} عمل/.test(await page.textContent('.door.anime [data-stat]')), await page.textContent('.door.anime [data-stat]'));
  await fits('الواجهة');
  // أنمياتي ببياناتها المبنية فعلاً: القائمة تُحمَّل، وقبل الاستيراد دعوته، والسلاسل فيها مدخل Fate
  await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel');
  check('أنمياتي: القائمة المبنية تُحمَّل بأعمالها وصورها، وقبل الاستيراد دعوته', await page.evaluate(() => document.querySelectorAll('#grid .cel').length === 60 && !!document.querySelector('.invite [data-act=import]') && /^https:\/\/(cdn\.myanimelist\.net|image\.tmdb\.org)\//.test(document.querySelector('#grid .cel img')?.src || '') && /\d{3,} عمل/.test(document.querySelector('#count').textContent)));
  await page.evaluate(() => document.querySelector('[data-act=view][data-v=worlds]').click()); await page.waitForSelector('#worlds .wc');
  check('أنمياتي: السلاسل مبنية من علاقات الأعمال، وأولها مدخل دليل Fate', await page.evaluate(() => document.querySelectorAll('#worlds button.wc').length >= 20 && document.querySelector('#worlds .wc').matches('a.fate[href="../fate/"]')));
  await fits('أنمياتي');
  // دليل Fate
  await page.goto(base + '/fate/'); await page.waitForSelector('.card'); await page.evaluate(() => { try { localStorage.removeItem('fateg.progress'); } catch {} }); await page.reload(); await page.waitForSelector('.card');
  check(`Fate: ${P.length} بطاقة في ${U.length} خطوط`, await page.locator('.card').count() === P.length && await page.locator('section.uni').count() === U.length);
  check('Fate: سجل منفصل عن دي سي، والعودة إلى «أنمياتي» التي يسكن داخلها', await page.getAttribute('.top .home', 'href') === '../anime/#worlds' && (await page.textContent('.top .home')).trim() === 'أنمياتي' && await page.title() === 'دليل عالم Fate');
  // ---------- «اقتراح الليلة» في دليل Fate (E62): بترتيب الدليل نفسه، ومزاج بأكثر من تصنيف. البيانات كما سيكتبها البناء: after من placements.json، وتصنيفات g في mal.json
  { const baseJ = JSON.parse(fs.readFileSync(path.join(siteDir, 'fate/data/base.json'))), malJ = JSON.parse(fs.readFileSync(path.join(siteDir, 'fate/data/mal.json'))); baseJ.placements = P;
    const G0 = { fuyuki: ['Action', 'Fantasy'], deen: ['Action', 'Romance'], fgo: ['Action', 'Fantasy'], illya: ['Comedy', 'Fantasy'], apocrypha: ['Action'], strangefake: ['Action', 'Mystery'], extra: ['Fantasy'], side: ['Comedy'] };
    for (const x of P) if (x.mal) malJ.anime[x.mal] = { score: 7, votes: 10, ...malJ.anime[x.mal], g: G0[x.universe] };
    await page.route(/\/fate\/data\/base\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(baseJ) })); await page.route(/\/fate\/data\/mal\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(malJ) }));
    await page.evaluate(() => { try { localStorage.removeItem('fateg.progress.mood'); } catch {} }); await page.reload(); await page.waitForSelector('#pick');
    const pk = () => page.evaluate(() => { const b = document.querySelector('#pick'); return b && { t: b.querySelector('h2').textContent, why: b.querySelector('.pick-w b').textContent, n: b.querySelector('.pick-l small')?.textContent || '', on: [...b.querySelectorAll('.chip[aria-pressed=true]')].map(x => x.dataset.g).sort().join('|'), hint: b.querySelector('.pick-h')?.textContent || '', start: !!b.querySelector('[data-act=pick-start]'), id: b.querySelector('[data-act=open]').dataset.id }; });
    let k = await pk(); const side = new Set(P.filter(x => x.after).map(x => x.work)), serial = new Set(U.filter(u => u.serial).map(u => u.id)), starts = P.filter(x => serial.has(x.universe) ? x.position === 1 : !x.after).length;
    check('Fate: «اقتراح الليلة» أعلى البطاقات يبدأ ببداية ترتيب المشاهدة الموصى به، وعدده بدايات الخطوط والأعمال المنفردة بلا شرط', k?.id === P[0].work && k.why === 'بداية ترتيب المشاهدة الموصى به' && k.n === `1 من ${starts}` && k.on === '' && k.start, [k, starts]);
    { const seen = []; for (let i = 0; i < starts; i++) { seen.push((await pk()).id); await tap('#pick [data-act=pick-next]'); await page.waitForTimeout(40); }
      check('Fate: «اقتراح آخر» يدور على ما يصلح بدايةً فقط: لا جزء قبل ما قبله في خطه، ولا عمل جانبي قبل إكمال خطه', new Set(seen).size === starts && seen.every(id => !side.has(id) && P.some(x => x.work === id && (serial.has(x.universe) ? x.position === 1 : true))) && (await pk()).id === P[0].work, seen); }
    await tap('#pick .chip[data-g="Comedy"]'); k = await pk();
    check('Fate: مزاج واحد يأتي بما فيه (Prisma☆Illya أول خطها)', k.on === 'Comedy' && k.id === P.find(x => x.universe === 'illya' && x.position === 1).work && !k.hint, k);
    await tap('#pick .chip[data-g="Mystery"]'); k = await pk();
    check('Fate: مزاجان لا يجمعهما عمل: يُقدَّم أقربها ويقال كم يجمع، ويُحفظان', k.on === 'Comedy|Mystery' && /يجمع 1 من 2/.test(k.hint) && await page.evaluate(() => localStorage.getItem('fateg.progress.mood')) === 'Comedy|Mystery', k);
    await tap('#pick .chip[data-g="Comedy"]'); await tap('#pick .chip[data-g="Action"]'); k = await pk();
    check('Fate: لمسة ثانية ترفع التصنيف، ومزاجان يجمعهما عمل يُقال فيه ذلك', k.on === 'Action|Mystery' && k.id === P.find(x => x.universe === 'strangefake' && x.position === 1).work && /^عمل يجمع /.test(k.hint), k);
    await tap('#pick .chip[data-g=""]'); k = await pk(); check('Fate: «أي شيء» يرفعها كلها ويعود إلى الأول', k.on === '' && k.id === P[0].work && !k.hint, k);
    await tap('#pick [data-act=pick-start]'); k = await pk();
    check('Fate: «سأبدأه الآن» يجعله «أشاهده» فيصير الاقتراح «كمّل من حيث وقفت»', k.id === P[0].work && /^تشاهده الآن/.test(k.why) && !k.start && await page.evaluate(key => JSON.parse(localStorage.getItem('fateg.progress')).works[key] === 'watching', `${P[0].work}#${P[0].season}`), k);
    await tap(`#${await page.locator('.card').first().getAttribute('id')} [data-s=watched]`); k = await pk();
    check('Fate: بعد مشاهدته يصير الاقتراح التالي في الترتيب الموصى به، بلا إعادة رسم الصفحة', /Season 2$/.test(k.t) && k.why === 'التالي في ترتيب المشاهدة الموصى به', k);
    await tap('#unibar [data-uni=fgo]'); await page.waitForTimeout(150); k = await pk();
    check('Fate: مع اختيار خط من الشريط يأتي الاقتراح منه', k.id === P.find(x => x.universe === 'fgo' && x.position === 1).work && k.why === 'بداية خط قصته مستقلة' && k.n === '', k);
    await tap('#unibar [data-uni=all]'); await page.fill('#q', 'zero'); await page.waitForTimeout(350);
    check('Fate: مع البحث أو التصفية لا اقتراح', await page.locator('#pick').count() === 0 && await page.locator('.card').count() >= 1);
    await tap('.tools [data-act=tonight]'); await page.waitForSelector('#pick'); await page.waitForTimeout(200);
    check('Fate: «ماذا أشاهد؟» يمسح التصفية ويأخذك إلى الاقتراح', await page.inputValue('#q') === '' && await page.evaluate(() => { const r = document.querySelector('#pick').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
    await fits('Fate اقتراح الليلة');
    await page.unroute(/\/fate\/data\/base\.json/); await page.unroute(/\/fate\/data\/mal\.json/);
    await page.evaluate(() => { try { localStorage.removeItem('fateg.progress'); localStorage.removeItem('fateg.progress.mood'); } catch {} }); await page.reload(); await page.waitForSelector('.card'); }
  const first = P[0], sel = '#' + await page.locator('.card').first().getAttribute('id');
  check('Fate: زرّا MyAnimeList وSimkl بروابط الإدراج نفسه', await page.evaluate(([s, mal, simkl]) => { const h = [...document.querySelectorAll(`${s} .xlinks a`)].map(a => a.href); return h.includes(`https://myanimelist.net/anime/${mal}`) && h.includes(`https://simkl.com/anime/${simkl}`); }, [sel, first.mal, first.simkl]));
  { const hasMal = !!JSON.parse(fs.readFileSync(path.join(siteDir, 'fate/data/mal.json'))).anime?.[first.mal]?.score, src = await page.textContent(sel + ' .rates .src');
    check(hasMal ? 'Fate: التقييم من MAL' : 'Fate: تقييم MAL غير متوفر في البيانات، والمعروض TMDB باسمه', src.includes(hasMal ? 'MAL' : 'TMDB')); }
  await fits('Fate البطاقات');
  await tap(sel + ' [data-s=watched]'); check('Fate: تغيير الحالة يُحفظ في مفتاحه', await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('fateg.progress')).works).includes('watched')) && await page.evaluate(() => !(localStorage.getItem('dcg.progress') || '').includes('fate-')));
  await tap(sel + ' .cta'); await page.waitForSelector('.ep:not(.skel)'); await page.waitForTimeout(450);
  check('Fate: تبويب الحلقات الخاصة موجود', await page.locator('#seasonTabs [data-season="0"]').count() === 1);
  await tap('#seasonTabs [data-season="0"]'); await page.waitForTimeout(200); check('Fate: الحلقات الخاصة تُعرض وتُعلَّم', (await page.textContent('.ep h4')).includes('خاصة'));
  await page.locator('.ep [data-act=ep]').first().evaluate(b => b.click()); check('Fate: حلقة خاصة لا تدخل في عدّاد البطاقة', (await page.textContent(sel + ' .epprog')).trim().startsWith('0/'));
  await fits('Fate نافذة الحلقات'); await tap('#sheet [data-act=close]'); await page.waitForSelector('#sheet', { state: 'hidden' });
  await tap('.views [data-view=arrow]'); await page.waitForSelector('.paths');
  check('Fate: ترتيب المشاهدة بثلاثة مسارات ومصدر', await page.locator('.paths button').count() === 3 && /^https:/.test(await page.getAttribute('.av-intro .why a', 'href')));
  const n1 = await page.locator('.tl .node').count(); await tap('.paths [data-path=release]'); await page.waitForTimeout(250);
  check('Fate: تبديل المسار يغيّر الخطوات', await page.getAttribute('.paths .on', 'data-path') === 'release' && (await page.textContent('.tl .node .t')).includes('Fate/stay night') && n1 > 5);
  await fits('Fate ترتيب المشاهدة');
  await tap('.views [data-view=timeline]'); await page.waitForSelector('.tl .node'); await fits('Fate الخط الزمني');
  // قائمة الأفلام
  let previewCalls = 0, worldsCalls = 0; const FL = JSON.parse(fs.readFileSync(path.join(siteDir, 'films/data/films.json'))).films.filter(f => !f.adult), inCol = FL.find(f => f.col && f.kind === 'movie' && f.prov);
  // خريطة عوالم للاختبار: فيلم من القائمة بلا ترتيب مراجَع ولا مجموعة TMDB، في عالم صغير (مع أنمي خارج القائمة) وسلسلة أوسع طويلة، وله أصل ورواية ورابط في دليل DC
  const FR = JSON.parse(fs.readFileSync(path.join(siteDir, 'films/data/franchises.json'))), cur = new Set(Object.values(FR.items || {}).flatMap(g => g.order.map(x => x.m ? 'm' + x.m : x.t ? 't' + x.t : null)));
  const solo = FL.find(f => f.kind === 'movie' && !f.col && !cur.has(f.id) && f.poster), big = Array.from({ length: 20 }, (_, i) => 'm' + (888000 + i)); big.splice(10, 0, solo.id);
  // ومحرّك الأحداث قدّم الأنمي (Out Show) على Out Film بدليلين، وفي مجموعة TMDB مصطنعة قدّم فيلماً من القائمة على أصلها
  const QUOTE = 'Out Show is a prequel to Out Film (1990), set in 1850.';
  const cf = FL.find(f => f.kind === 'movie' && !f.col && !cur.has(f.id) && f.id !== solo.id && f.poster && f.date > '1990'), CID = 999777;
  const WORLDS = { worlds: { Q_T: { name: 'Test Universe', kind: 'universe', by: 'date', wd: 'Q_T', wiki: 'https://en.wikipedia.org/wiki/Test', order: ['m777001', solo.id, 't777002'], size: 3,
        chrono: { order: ['t777002', 'm777001', solo.id], moved: { t777002: { w: 'prequel', ref: ['m777001'], y: 1850, src: ['wikipedia', 'tmdb'], q: [{ s: 'wikipedia', t: QUOTE, u: 'https://en.wikipedia.org/wiki/Out_Show' }, { s: 'tmdb', t: 'keyword: prequel' }] } } } },
      Q_B: { name: 'Big Test Series', kind: 'series', by: 'ord', wd: 'Q_B', wiki: null, order: big, size: 21 } },
    works: { [solo.id]: { q: 'Q_S', worlds: ['Q_T', 'Q_B'], rel: [{ k: 'm777003', r: 'original' }, { k: 'm777001', r: 'derived' }], src: [{ q: 'Q_N', label: 'Some Novel', kind: 'novel', year: 1950, wiki: 'https://en.wikipedia.org/wiki/Some_Novel' }], guide: { door: 'dc', id: 'the-dark-knight-rises-2012' } } },
    info: { m777001: { title: 'Out Film', year: 1990, date: '1990-05-01', genres: [28] }, t777002: { title: 'Out Show', year: 2005, date: '2005-01-01', genres: [16], lang: 'ja', tv: true }, m777003: { title: 'Old Original', year: 1960, date: '1960-01-01', genres: [18] },
      ...Object.fromEntries(big.filter(k => k !== solo.id).map((k, i) => [k, { title: 'Big Part ' + (i + 1), year: 1980 + i, date: `${1980 + i}-01-01` }])) },
    cols: { [CID]: { order: [cf.id, 'm777101'], moved: { [cf.id]: { w: 'prequel', ref: ['m777101'], src: ['wikipedia'], q: [{ s: 'wikipedia', t: 'It is a prequel to Col Original (1980).', u: 'https://en.wikipedia.org/wiki/X' }] } } } } };
  await page.route('**/films/data/worlds.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(WORLDS) }));
  // فيلمان +18 (adult) بأسماء مختلَقة كما يكتبهما البناء: لا يظهران إلا في مكتبة +18 (E61)
  const AD = [1, 2].map(k => ({ id: 'm' + (9900000 + k), tmdb: 9900000 + k, kind: 'movie', title: ['Sample Late Feature', 'Sample Velvet Hours'][k - 1], year: 2017 + k, date: `${2017 + k}-03-01`, status: 'Released', runtime: 80, genres: [18], lang: 'ja', rating: 5.5 + k / 2, votes: 100, poster: `/ad${k}.jpg`, backdrop: `/ad${k}b.jpg`, imdb: null, adult: 1, prov: null, src: 'added', ord: 2000000 + k }));
  await page.route('**/films/data/films.json*', async r => { const res = await r.fetch(), j = await res.json(); j.films = [...j.films.filter(f => !f.adult), ...AD]; j.films.find(f => f.id === cf.id).col = CID; return r.fulfill({ response: res, json: j }); });
  await page.route('**/films/data/collections.json*', async r => { const res = await r.fetch(), j = await res.json();
    j[CID] = { id: CID, name: 'Chrono Test Collection', parts: [{ tmdb: 777101, title: 'Col Original', date: '1980-01-01', year: 1980 }, { tmdb: cf.tmdb, title: cf.title, date: cf.date, year: cf.year }] }; return r.fulfill({ response: res, json: j }); });
  // سلسلة مراجَعة بترتيب أحداثها: Prey (1719) أولاً، والصدور يصح أيضاً
  const PRED = [766507, 106, 169, 34851, 346910, 1242898];
  await page.route('**/films/data/franchises.json*', async r => { const res = await r.fetch(), j = await res.json(), p = j.items.predator;
    p.order = [...PRED.map(m => p.order.find(x => x.m === m)), ...p.order.filter(x => !PRED.includes(x.m))]; p.view = 'either'; return r.fulfill({ response: res, json: j }); });
  await page.route('**/api/add-film', async r => { const b = r.request().postDataJSON();
    if (b.password !== 'pw') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"password"}' });
    if (b.action === 'search') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ parsed: { title: 'Test Film', year: 1999 }, sure: true, candidates: [{ tmdb: 999001, kind: 'movie', title: 'Test Film', year: 1999, poster: null, collection: 'Test Saga' }, { tmdb: inCol.tmdb, kind: 'movie', title: inCol.title, year: inCol.year, poster: null }] }) });
    previewCalls += b.action === 'preview'; worldsCalls += b.action === 'worlds';
    // عالم الفيلم الجديد: سلسلة تضم مجموعته في TMDB وجزءاً ثالثاً بلا موعد، فتتقدم على المجموعة
    if (b.action === 'worlds') return r.fulfill({ contentType: 'application/json', body: JSON.stringify(b.tmdb !== 999001 ? { key: 'm' + b.tmdb, worlds: {}, works: {}, info: {} } : { key: 'm999001',
      worlds: { Q_SAGA: { name: 'Test Saga World', kind: 'series', by: 'ord', wd: 'Q_SAGA', wiki: null, order: ['m999001', 'm999002', 'm999004'], size: 3 } }, works: { m999001: { q: 'Q_TF', worlds: ['Q_SAGA'] } },
      info: { m999002: { title: 'Test Film 2', year: 2003, date: '2003-01-01' }, m999004: { title: 'Test Film 4', year: null, date: null } } }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...(b.action === 'add' ? { state: 'added' } : {}), providers: {}, collection: { id: 999, name: 'Test Saga', parts: [{ tmdb: 999001, title: 'Test Film', year: 1999 }, { tmdb: 999002, title: 'Test Film 2', year: 2003 }] },
      film: { id: 'm999001', tmdb: 999001, kind: 'movie', title: 'Test Film', year: 1999, date: '1999-01-01', genres: [18], rating: 7.1, votes: 10, poster: null, col: 999, prov: null, src: 'added', overviewEn: 'A test.', directors: ['Someone'] } }) }); });
  await page.goto(base + '/films/'); await page.waitForSelector('.tk'); await page.evaluate(() => { try { ['filmsg.progress', 'filmsg.pending', 'filmsg.pass'].forEach(k => localStorage.removeItem(k)); } catch {} }); await page.reload(); await page.waitForSelector('.tk');
  check(`الأفلام: ${FL.length} تذكرة والعنوان صحيح`, await page.locator('.tk').count() === FL.length && await page.title() === 'قائمة أفلامي' && await page.getAttribute('.top .home', 'href') === '../');
  await fits('الأفلام: الشبكة');
  // «مزاج السهرة» بأكثر من نوع (E62): لمسة تضيف ولمسة ترفع، ويُقدَّم ما يجمعها ويقال ذلك، ويُحفظ الاختيار
  { const gs = await page.$$eval('#mood .chip', c => c.map(x => x.dataset.g)), mood = () => page.evaluate(() => { const on = [...document.querySelectorAll('#mood .chip[aria-pressed=true]')], h = document.querySelector('#mood-hint');
      return { on: on.map(x => x.dataset.g).join(), names: on.map(x => x.firstChild.textContent), hint: h.hidden ? '' : h.textContent, meta: document.querySelector('#tonight .meta').textContent, saved: localStorage.getItem('films.mood') || '' }; });
    await tap(`#mood .chip[data-g="${gs[1]}"]`); await tap(`#mood .chip[data-g="${gs[2]}"]`); let m = await mood();
    check('الأفلام: مزاج السهرة بنوعين: الاثنان مضغوطان ومحفوظان، والاقتراح يجمعهما ويقال ذلك ونوعاه أول سطره', m.on === `${gs[1]},${gs[2]}` && /^فيلم يجمع /.test(m.hint) && m.names.every(n => m.meta.includes(n)) && m.saved === m.on, m);
    await tap(`#mood .chip[data-g="${gs[1]}"]`); m = await mood(); check('الأفلام: لمسة ثانية ترفع النوع', m.on === gs[2] && !m.hint && m.saved === gs[2], m);
    await tap('#mood .chip[data-g=""]'); m = await mood(); check('الأفلام: «أي نوع» يرفعها كلها', m.on === '' && !m.hint && !m.saved, m); }
  check('الأفلام: أجزاء السلسلة متجاورة في «ترتيب قائمتي» بترتيب أحداثها مهما كان ترتيب إضافتها', await page.evaluate(ids => { const all = [...document.querySelectorAll('#grid .tk')].map(e => e.id), at = ids.map(m => all.indexOf('f-m' + m));
    return at.every((x, i) => x >= 0 && (i === 0 || x === at[i - 1] + 1)); }, PRED));
  check('الأفلام: تذكرة الجزء الذي تبدأ به الأحداث موسومة «بداية الأحداث»، وغيره بموضعه', (await page.textContent('#f-m766507 .tag')) === 'بداية الأحداث' && /^\d+\/\d+$/.test((await page.textContent('#f-m106 .tag')).trim()));
  check('الأفلام: ترتيب أحداث مجموعة TMDB من المحرّك يصل مع خريطة العوالم ويسِم أول الأحداث', await page.waitForFunction(id => document.querySelector(`#f-${id} .poster > .tag`)?.textContent === 'بداية الأحداث', cf.id, { timeout: 5000 }).then(() => true, () => false));
  await page.fill('#q', inCol.title.toLowerCase()); await page.waitForTimeout(350);
  const vis = await page.locator('.tk:not([hidden])').count(); check('الأفلام: البحث يصفّي ويعرض العدد', vis >= 1 && vis < FL.length && (await page.textContent('#count')).includes(String(vis)));
  await tap(`#f-${inCol.id} .seen`); check('الأفلام: «شاهدته» يُحفظ ويُختم', await page.evaluate(id => JSON.parse(localStorage.getItem('filmsg.progress')).films[id] === 'watched' && document.getElementById('f-' + id).classList.contains('watched'), inCol.id));
  await tap(`#f-${inCol.id} .poster`); await page.waitForSelector('#sheet[open] .sh-head'); await page.waitForTimeout(350);
  check('الأفلام: النافذة فيها أين يُعرض وترتيب السلسلة والروابط', await page.evaluate(([t, imdb]) => { const h = [...document.querySelectorAll('#sheet .links a')].map(a => a.href), o = document.querySelectorAll('#sheet .order li');
    return o.length >= 2 && [...document.querySelectorAll('#sheet .order li.here')].filter(li => li.offsetParent).length === 1 && h.includes(`https://letterboxd.com/tmdb/${t}`) && h.includes(`https://www.imdb.com/title/${imdb}/`) && h.some(x => /whattawatch/.test(x)) && document.querySelectorAll('#sheet .wgroup').length >= 1; }, [inCol.tmdb, inCol.imdb]));
  check('الأفلام: رابط الفيلم في العنوان', (await page.evaluate(() => location.hash)) === '#' + inCol.id);
  check('الأفلام: لافتة موقعه تحت العنوان (E53، E58): شارته وجملته، وخريطتها بنقطة مضيئة واحدة، ورقمه يطابق موضعه في ترتيب المشاهدة الظاهر، وما قبله أو بعده أزرار', await page.evaluate(() => { const c = document.querySelector('#sheet #chslot .chain'), li = [...document.querySelectorAll('#sheet .order li.here')].find(x => x.offsetParent), ol = li?.closest('ol');
    return !!c && !!li && c.querySelector('.ch-n span').textContent.startsWith(`${li.dataset.n} من ${ol.children.length} في `) && /بترتيب/.test(c.querySelector('.ch-n').textContent) && /\S/.test(c.querySelector('.ch-k').textContent) && !!c.querySelector('.ch-t')
      && c.querySelectorAll('.pos-map .here').length === 1 && c.querySelectorAll('.pos-map .d, .pos-map .here').length >= 2 && c.querySelectorAll('.ch-l').length >= 1; }), await page.evaluate(() => document.querySelector('#sheet #chslot')?.textContent));
  await tap('#sheet .chain .ch-n'); await page.waitForTimeout(900);
  check('الأفلام: «الترتيب كاملاً» في اللافتة ينزل إلى ترتيب المشاهدة', await page.evaluate(() => { const r = document.querySelector('#wslot').getBoundingClientRect(), b = document.getElementById('sheet-body').getBoundingClientRect(); return r.top >= b.top - 4 && r.top < b.top + b.height * .7; }));
  { await page.evaluate(() => { document.getElementById('sheet-body').scrollTop = 99999; }); const y = await page.evaluate(() => document.getElementById('sheet-body').scrollTop);
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(300);
    await tap(`#f-${inCol.id} .poster`); await page.waitForSelector('#sheet[open] .sh-head'); await page.waitForTimeout(350);
    check('الأفلام: نافذة تُفتح بعد أخرى أُغلقت وهي ممرَّرة تبدأ من أعلاها', y > 0 && await page.evaluate(() => document.getElementById('sheet-body').scrollTop) === 0, y); }
  // الفيلم الذي لا تجمعه سلسلة ولا عالم يُقال فيه ذلك صراحة (E58)
  { await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(250); let solo = null;
    for (const f of FL.filter(f => !f.col && f.kind === 'movie').slice(0, 10)) { await page.evaluate(id => { location.hash = '#' + id; }, f.id); await page.waitForSelector('#sheet[open] #chslot'); await page.waitForTimeout(250);
      solo = await page.evaluate(() => { const c = document.querySelector('#sheet #chslot .chain.solo'); return c && { k: c.querySelector('.ch-k').textContent, t: c.querySelector('.ch-t')?.textContent, dots: c.querySelectorAll('.pos-map .here').length, n: !!c.querySelector('.ch-n') }; });
      await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(200); if (solo) break; }
    check('الأفلام: الفيلم الذي لا سلسلة له لافتته «فيلم منفرد: قائم بذاته» بنقطة وحدها', solo?.k === 'فيلم منفرد' && /^قائم بذاته/.test(solo.t) && solo.dots === 1 && !solo.n, solo);
    await tap(`#f-${inCol.id} .poster`); await page.waitForSelector('#sheet[open] .sh-head'); await page.waitForTimeout(350); }
  // تكبير البوستر (zoom.js المشترك): يُرفع من مكانه فوق النافذة، وEsc والرجوع والسحب تغلقه وحده وتبقى نافذة الفيلم ورابطها
  await tap('#sheet .sh-head [data-zoom]'); await page.waitForSelector('dialog.pz[open]'); await page.waitForTimeout(950);
  check('الأفلام: البوستر يُكبَّر فوق النافذة بعنوانه وبدقة أعلى، ومكانه فارغ', await page.evaluate(t => { const d = document.querySelector('dialog.pz'), r = d.querySelector('.pz-card').getBoundingClientRect();
    return document.querySelector('#sheet .sh-head .poster').classList.contains('pz-lifted') && d.querySelector('.pz-cap').textContent === t && /\/(w500|w780|original)\//.test(d.querySelector('.pz-hi').src)
      && r.width > 200 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && Math.abs(r.width / r.height - 2 / 3) < .02; }, inCol.title));
  await fits('الأفلام: البوستر المكبّر');
  await page.keyboard.press('Escape'); await page.waitForSelector('dialog.pz', { state: 'hidden' }); await page.waitForTimeout(350);
  check('الأفلام: Esc يغلق البوستر وحده ويعيده مكانه', await page.evaluate(id => document.querySelector('#sheet').open && location.hash === '#' + id && !document.querySelector('.pz-lifted') && history.state?.film === id && !history.state?.pz, inCol.id));
  await tap('#sheet .sh-head [data-zoom]'); await page.waitForSelector('dialog.pz[open]'); await page.waitForTimeout(950);
  await page.goBack(); await page.waitForSelector('dialog.pz', { state: 'hidden' }); await page.waitForTimeout(350);
  check('الأفلام: الرجوع يغلق البوستر وحده', await page.evaluate(id => document.querySelector('#sheet').open && location.hash === '#' + id && !document.querySelector('.pz-lifted'), inCol.id));
  if (!mobile) { // السحب القصير يعيده مكانه بارتداد، والسحب لأسفل يغلقه
    await tap('#sheet .sh-head [data-zoom]'); await page.waitForSelector('dialog.pz[open]'); await page.waitForTimeout(950);
    const c = await page.locator('dialog.pz .pz-card').boundingBox(), cx = c.x + c.width / 2, cy = c.y + c.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy + 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(700);
    check('الأفلام: السحب القصير يعيد البوستر مكانه', await page.evaluate(() => document.querySelector('dialog.pz').open && !document.querySelector('.pz-fly').style.transform));
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy + 240, { steps: 10 }); await page.mouse.up(); await page.waitForSelector('dialog.pz', { state: 'hidden' }); await page.waitForTimeout(350);
    check('الأفلام: سحب البوستر لأسفل يغلقه وحده', await page.evaluate(id => document.querySelector('#sheet').open && location.hash === '#' + id && !document.querySelector('.pz-lifted'), inCol.id)); }
  await fits('الأفلام: النافذة'); await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  await page.waitForTimeout(400); await page.evaluate(() => { location.hash = '#m218'; }); await page.waitForSelector('#sheet[open] .order .rc'); await page.waitForTimeout(300);
  check('الأفلام: سلسلة مراجَعة تعرض التوصيات والمسلسل المرتبط بتقييمه', await page.evaluate(() => { const o = document.querySelector('#sheet .order'), t = o.textContent; return o.querySelectorAll('.rc.watch').length >= 2 && o.querySelectorAll('.rc.skip').length >= 1 && t.includes('Sarah Connor') && t.includes('مسلسل') && /\d\.\d/.test(t) && document.querySelector('#wslot .sec > .note').textContent.includes('توصيات'); }));
  await fits('الأفلام: نافذة سلسلة مراجَعة'); await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  // ترتيب الأحداث وترتيب الصدور في البطاقة
  await page.waitForTimeout(300); await page.evaluate(() => { location.hash = '#m106'; }); await page.waitForSelector('#sheet[open] .ordv'); await page.waitForTimeout(250);
  check('الأفلام: ترتيب الأحداث أولاً مع تبديل إلى ترتيب الصدور', await page.evaluate(() => { const vis = [...document.querySelectorAll('#wslot [data-ov]')].filter(d => !d.hidden);
    return vis.length === 1 && vis[0].dataset.ov === 'chrono' && vis[0].querySelector('li .t b').textContent === 'Prey' && document.querySelector('[data-act=ordv][aria-pressed=true]').dataset.v === 'chrono'; }));
  await tap('#wslot [data-act=ordv][data-v=release]'); await page.waitForTimeout(150);
  check('الأفلام: ترتيب الصدور يبدأ بالأصل، والاختيار يبقى للبطاقة التالية', await page.evaluate(() => { const vis = [...document.querySelectorAll('#wslot [data-ov]')].filter(d => !d.hidden);
    return vis.length === 1 && vis[0].dataset.ov === 'release' && vis[0].querySelector('li .t b').textContent === 'Predator'; }));
  await fits('الأفلام: تبديل الترتيب'); await tap('#wslot [data-act=ordv][data-v=chrono]'); await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  // خريطة العوالم في بطاقة فيلم من القائمة
  await page.waitForTimeout(300); await page.evaluate(id => { location.hash = '#' + id; }, solo.id); await page.waitForSelector('#sheet[open] #wslot .wk'); await page.waitForTimeout(300);
  check('الأفلام: عالم آلي بنوعه وترتيب أحداثه، والأنمي خارج القائمة موصوف وسبب تقدّمه مذكور', await page.evaluate(() => { const o = document.querySelector('#wslot [data-ov=chrono] .order'), rows = o.querySelectorAll(':scope > li');
    return rows.length === 3 && o.querySelectorAll('li.here').length === 1 && document.querySelector('#wslot .wk').textContent === 'عالم مشترك' && rows[0].textContent.includes('أنمي') && rows[0].textContent.includes('خارج قائمتك')
      && rows[0].textContent.includes('قبل «Out Film»، عام 1850 · مؤكد من مصدرين') && rows[1].textContent.includes('Out Film') && rows[2].classList.contains('here'); }));
  check('الأفلام: العالم المرتّب بالأحداث يبدّل إلى الصدور، والصدور هو المُوصى به للمشاهدة الأولى', await page.evaluate(() => { const rel = document.querySelector('#wslot [data-act=ordv][data-v=release]');
    return !!rel && rel.textContent.includes('المُوصى به') && !document.querySelector('#wslot [data-act=ordv][data-v=chrono] small') && document.querySelector('#wslot .sec > .note').textContent.includes('حسب أحداث القصة'); }));
  await tap('#wslot .why summary'); await page.waitForTimeout(200);
  check('الأفلام: «كيف رُتّب حسب الأحداث؟» يعرض الجملة بلغتها ورابط مصدرها', await page.evaluate(q => { const d = document.querySelector('#wslot .why'), b = d.querySelectorAll('blockquote');
    return d.open && b.length === 2 && d.querySelector('li small').textContent.startsWith('مؤكد من مصدرين:') && !d.querySelector('li').firstChild.parentNode.textContent.includes('· مؤكد') && b[0].textContent.includes(q) && b[0].getAttribute('dir') === 'ltr' && b[0].querySelector('a').href === 'https://en.wikipedia.org/wiki/Out_Show' && b[1].textContent.includes('keyword: prequel'); }, QUOTE));
  await fits('الأفلام: دليل ترتيب الأحداث');
  check('الأفلام: العالم الآلي يذكر أنه بلا مراجعة ويربط مصادره', await page.evaluate(() => { const n = document.querySelector('#wslot .sec > .note'), h = [...n.querySelectorAll('a')].map(a => a.href);
    return n.textContent.includes('لم يُراجَع يدوياً') && h.includes('https://www.wikidata.org/wiki/Q_T') && h.includes('https://en.wikipedia.org/wiki/Test') && !document.querySelector('#wslot .order .rc.watch'); }));
  check('الأفلام: رابط بطاقته في دليل DC', (await page.getAttribute('#wslot .xdoor', 'href')) === '../dc/#w=the-dark-knight-rises-2012');
  check('الأفلام: أعمال مرتبطة بالأصل والرواية، بلا تكرار ما في الترتيب', await page.evaluate(() => { const r = document.querySelectorAll('#wslot .rels .part'), s = document.querySelector('#wslot .srcs');
    return r.length === 1 && r[0].textContent.includes('Old Original') && r[0].querySelector('.rl.original').textContent === 'الأصل' && s.textContent.includes('مقتبس عن رواية') && s.querySelector('a').href.includes('Some_Novel'); }));
  await tap('#wslot .wider summary'); await page.waitForTimeout(250);
  check('الأفلام: السلسلة الأوسع مطوية ومختصرة حول هذا العمل', await page.evaluate(() => { const w = document.querySelector('#wslot .wider'), o = w.querySelector('.order'), vis = [...o.children].filter(li => li.offsetHeight > 0);
    return w.open && w.querySelector('summary').textContent.includes('سلسلة أوسع') && o.classList.contains('clip') && vis.length === 9 && vis.some(li => li.classList.contains('here')) && vis[0].dataset.n === '7'; }));
  await fits('الأفلام: نافذة العالم الآلي'); await tap('#wslot .wider .more'); await page.waitForTimeout(200);
  check('الأفلام: «اعرض الترتيب كاملاً» يعرض الأعمال كلها بأرقامها', await page.evaluate(() => { const o = document.querySelector('#wslot .wider .order'), vis = [...o.children].filter(li => li.offsetHeight > 0);
    return vis.length === 21 && vis[20].dataset.n === '21' && document.querySelector('#wslot .wider .more').getAttribute('aria-expanded') === 'true'; }));
  await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  await page.waitForTimeout(300); await page.evaluate(id => { location.hash = '#' + id; }, cf.id); await page.waitForSelector('#sheet[open] #wslot .ordv'); await page.waitForTimeout(250);
  check('الأفلام: مجموعة TMDB مرتّبة بالأحداث: الفيلم أولاً بسببه، والملاحظة تذكر المصدر', await page.evaluate(() => { const rows = document.querySelectorAll('#wslot [data-ov=chrono] .order > li'), n = document.querySelector('#wslot .sec > .note').textContent;
    return rows.length === 2 && rows[0].classList.contains('here') && rows[0].textContent.includes('قبل «Col Original» · مصدره Wikipedia فقط') && !rows[0].textContent.includes('مؤكد') && n.includes('مجموعة') && n.includes('حسب أحداث القصة') && !!document.querySelector('#wslot .why'); }));
  await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  await tap('[data-act=reset]'); await page.waitForTimeout(300);
  check('الأفلام: ما شاهدته يختفي من القائمة ويُذكر عدده', await page.evaluate(id => document.getElementById('f-' + id).hidden && document.querySelector('#count').textContent.includes('مخفي') && document.querySelector('#tally').textContent.includes('بقي'), inCol.id));
  await tap('[data-act=show-all]'); await page.waitForTimeout(250);
  check('الأفلام: «أظهر الكل» يعيده مختوماً', await page.evaluate(id => { const el = document.getElementById('f-' + id); return !el.hidden && el.classList.contains('watched') && document.querySelector('[data-v=all]').getAttribute('aria-pressed') === 'true'; }, inCol.id));
  await tap('[data-act=reset]'); await page.waitForTimeout(250);
  const other = FL.find(f => f.id !== inCol.id && f.kind === 'movie' && f.poster); await tap(`#f-${other.id} .seen`); await page.waitForTimeout(1300);
  check('الأفلام: التعليم من القائمة يُخرج التذكرة منها مع زر تراجع', await page.evaluate(id => document.getElementById('f-' + id).hidden && !!document.querySelector('#toast.act button'), other.id));
  await page.evaluate(() => document.querySelector('#toast button').click()); await page.waitForTimeout(300);
  check('الأفلام: التراجع يعيدها', await page.evaluate(id => !document.getElementById('f-' + id).hidden && !JSON.parse(localStorage.getItem('filmsg.progress')).films[id], other.id));
  await tap('[data-v=series]'); await page.waitForSelector('.fr'); check('الأفلام: عرض السلاسل مرقّم', await page.locator('.fr').count() > 20 && (await page.textContent('.fr .part .n')).trim() === '1'); await fits('الأفلام: السلاسل');
  check('الأفلام: العالم الآلي في عرض السلاسل بوصفه', await page.evaluate(() => [...document.querySelectorAll('.fr')].some(f => f.querySelector('h3').textContent === 'Test Universe' && f.querySelector('header span').textContent.includes('مرتّب آلياً'))));
  await tap('[data-v=grid]'); await tap('[data-act=add]'); await page.waitForSelector('#add[open]'); await page.fill('#add-q', 'test film 1999'); await page.fill('#add-pass', 'bad'); await tap('#add-form [type=submit]'); await page.waitForTimeout(300);
  check('الأفلام: كلمة سر خاطئة تُرفض برسالة', (await page.textContent('#add-msg')).includes('كلمة السر'));
  await page.fill('#add-pass', 'pw'); await tap('#add-form [type=submit]'); await page.waitForSelector('.cand'); check('الأفلام: الإضافة تعرض المرشح وسلسلته قبل الحفظ', (await page.textContent('.cand')).includes('Test Saga'));
  await fits('الأفلام: نافذة الإضافة');
  check('الأفلام: نتيجة في القائمة لها «افتح بطاقته»، وغيرها «التفاصيل» و«أضفه»', await page.locator(`.cand [data-act=cand-open][data-id=${inCol.id}]`).count() === 1 && await page.locator('.cand [data-act=preview][data-tmdb="999001"]').count() === 1 && await page.locator('.cand [data-act=add-pick]').count() === 1);
  await tap('.cand [data-act=cand-open]'); await page.waitForSelector('#sheet[open] .sh-acts [data-act=set]');
  check('الأفلام: «افتح بطاقته» يغلق البحث ويفتح بطاقة الفيلم من القائمة', !(await page.evaluate(() => document.querySelector('#add').open)) && (await page.evaluate(() => location.hash)) === '#' + inCol.id);
  await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(300);
  await tap('[data-act=add]'); await page.waitForSelector('#add[open]'); await page.fill('#add-q', 'test film 1999'); await tap('#add-form [type=submit]'); await page.waitForSelector('.cand [data-act=preview]');
  await tap('.cand [data-act=preview]'); await page.waitForSelector('#sheet[open] [data-act=preview-add]'); await page.waitForTimeout(350);
  check('الأفلام: «التفاصيل» يفتح بطاقة كاملة من TMDB دون إضافة', await page.evaluate(() => { const b = document.querySelector('#sheet-body'), t = b.textContent;
    return t.includes('A test.') && t.includes('ليس في قائمتك') && b.querySelectorAll('.order li').length >= 2 && [...b.querySelectorAll('.order li.here')].filter(li => li.offsetParent).length === 1 && !b.querySelector('[data-act=set]') && !document.getElementById('f-m999001'); }) && previewCalls === 1);
  await page.waitForSelector('#sheet[open] #wslot .wk');
  check('الأفلام: بطاقة الاطلاع تجلب عالمه وتعرضه بدل مجموعة TMDB حين يضمها', await page.evaluate(() => { const rows = document.querySelectorAll('#wslot .order li');
    return rows.length === 3 && rows[0].classList.contains('here') && rows[2].textContent.includes('Test Film 4') && rows[2].querySelector('.rc.soon') && document.querySelector('#wslot .wk').textContent === 'سلسلة'; }) && worldsCalls === 1);
  await fits('الأفلام: بطاقة الاطلاع'); await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(300);
  check('الأفلام: إغلاق بطاقة الاطلاع يعيدك إلى نتائج البحث', await page.evaluate(() => document.querySelector('#add').open && document.querySelectorAll('.cand').length === 2));
  await tap('.cand [data-act=preview]'); await page.waitForSelector('#sheet[open] [data-act=preview-add]'); check('الأفلام: بطاقة الاطلاع تُحفظ ولا يتكرر طلبها ولا طلب عالمها', previewCalls === 1 && worldsCalls === 1);
  await tap('#sheet [data-act=preview-add]'); await page.waitForSelector('#f-m999001'); await page.waitForSelector('#sheet[open] .sh-acts [data-act=set]');
  check('الأفلام: «أضفه إلى قائمتي» يضيفه ويحوّل البطاقة إلى بطاقته في القائمة', !(await page.evaluate(() => document.querySelector('#add').open)) && (await page.textContent('#sheet-body')).includes('لم تُراجَع يدوياً'));
  await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(300);
  check('الأفلام: المضاف يظهر فوراً بعلامة «جديد»', (await page.textContent('#f-m999001 .tag')).includes('جديد') && await page.locator('.tk').count() === FL.length + 1);
  await page.reload(); await page.waitForSelector('.tk'); check('الأفلام: المضاف يبقى بعد التحديث وكلمة السر لا تُطلب ثانية', await page.locator('#f-m999001').count() === 1 && await page.evaluate(() => localStorage.getItem('filmsg.pass') === 'pw'));
  await tap('#f-m999001 .poster'); await page.waitForSelector('#sheet[open] .order'); check('الأفلام: نافذة المضاف تعرض عالمه المحفوظ معه وتنبيه عدم المراجعة دون طلب جديد', await page.locator('#sheet .order li').count() === 3 && (await page.textContent('#sheet-body')).includes('لم تُراجَع يدوياً') && worldsCalls === 1);
  await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  // ---------- مكتبة +18 في الأفلام (E61): ما وسمه TMDB للبالغين لا يظهر حتى يُضغط زر «+18»، فتُفتح مكتبة فيها هو وحده وبحثه وإضافته، وبوستراته مغطاة
  { const sent = []; await page.route('**/api/add-film', async r => { const b = r.request().postDataJSON(); if (!b.adult) return r.fallback(); sent.push(b);
      const film = { id: 'm9900009', tmdb: 9900009, kind: 'movie', title: 'Sample Found Feature', year: 2021, date: '2021-01-01', genres: [18], rating: 6.1, votes: 9, poster: '/ad9.jpg', backdrop: '/ad9b.jpg', adult: 1, prov: null, src: 'added', overviewEn: null, cast: [], directors: [] };
      if (b.action === 'search') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ parsed: { title: 'Sample', year: null }, sure: false, candidates: [{ tmdb: 9900009, kind: 'movie', title: film.title, year: 2021, poster: '/ad9.jpg' }, { tmdb: 9900001, kind: 'movie', title: AD[0].title, year: AD[0].year, poster: AD[0].poster }] }) });
      if (b.action === 'suggest') return r.fulfill({ contentType: 'application/json', body: '{"items":[]}' });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...(b.action === 'add' ? { state: 'added' } : {}), providers: {}, collection: null, film }) }); });
    const flipTo = async on => { const nav = page.waitForEvent('load'); await tap('.top .r18'); await nav; await page.waitForFunction(on => (document.documentElement.dataset.room === '18') === on && !!document.querySelector('.tk'), on); };
    const n0 = await page.locator('.tk').count();
    check('الأفلام: زر «+18» في الرأس، وأعمال +18 ليست في القائمة العادية ولا تُفتح برابطها', await page.evaluate(() => document.querySelector('.top .r18')?.getAttribute('aria-pressed') === 'false' && !document.getElementById('f-m9900001') && !document.querySelector('.r18-bar')) && n0 === FL.length + 1, String(n0));
    await flipTo(true);
    check('الأفلام: الزر يفتح مكتبة +18: أعمالها وحدها بعددها، وشريطها، بلا اقتراح ولا سلاسل', await page.evaluate(() => document.querySelectorAll('.tk').length === 2 && !!document.getElementById('f-m9900001') && !!document.querySelector('.r18-bar') && document.querySelector('.top .r18').getAttribute('aria-pressed') === 'true'
      && document.querySelector('#tonight').hidden && document.querySelector('.tabs').hidden && /^فيلمان/.test(document.querySelector('#tally').textContent)), await page.textContent('#tally'));
    check('الأفلام: بوستراتها مغطاة بمصغّرتها وعليها «+18»، ولا تُكبَّر بالقرص', await page.evaluate(() => [...document.querySelectorAll('.tk .poster')].every(p => p.classList.contains('x18') && /\/w92\/ad\d\.jpg$/.test(p.querySelector('.x18-i img').getAttribute('src')) && p.querySelector('.x18-m').textContent === '+18' && !p.hasAttribute('data-zoom-pinch') && /blur/.test(getComputedStyle(p.querySelector('img')).filter))));
    await fits('الأفلام: مكتبة +18');
    await tap('#f-m9900001 .poster'); await page.waitForSelector('#sheet[open] .sh-head .poster.x18');
    check('الأفلام: بطاقة عمل +18 بلا نبذة ولا موقع من سلسلة ولا منصات، وبوسترها بزر يكشفه', await page.evaluate(() => { const b = document.querySelector('#sheet-body'), p = b.querySelector('.sh-head .poster');
      return p.dataset.act === 'bare' && !p.hasAttribute('data-zoom') && !b.querySelector('.sh-hero img') && !b.querySelector('#chslot').innerHTML && !b.querySelector('#wslot').innerHTML && /لا تُعرض هنا ولا تُترجم/.test(b.textContent) && !/أين تشاهده/.test(b.textContent) && !!b.querySelector('[data-act=set]'); }));
    await tap('#sheet .sh-head .poster'); await page.waitForSelector('#sheet[open] .sh-head .poster[data-zoom]');
    check('الأفلام: لمس البوستر يكشفه في بطاقته وتذكرته وحدهما', await page.evaluate(() => document.querySelector('#sheet-body').hasAttribute('data-r18-bare') && !!document.querySelector('#sheet-body .sh-hero img') && !document.querySelector('#f-m9900001 .x18') && document.getElementById('f-m9900001').hasAttribute('data-r18-bare')
      && !!document.querySelector('#f-m9900002 .poster.x18') && getComputedStyle(document.querySelector('#f-m9900001 .poster img')).filter === 'none' && !document.querySelector('.pz[open]')));
    await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(300);
    await tap('.r18-eye'); await page.waitForFunction(() => document.documentElement.hasAttribute('data-r18-open')); check('الأفلام: «أظهر الصور» يكشفها كلها', await page.evaluate(() => !document.querySelector('.tk .x18') && document.querySelectorAll('.tk .poster img[srcset]').length === 2));
    await tap('.r18-eye'); await page.waitForFunction(() => !document.documentElement.hasAttribute('data-r18-open')); check('الأفلام: و«غطِّ الصور» يغطيها كلها', await page.evaluate(() => document.querySelectorAll('.tk .poster.x18').length === 2));
    await tap('.top [data-act=add]'); await page.waitForSelector('#add[open]'); check('الأفلام: نافذة الإضافة فيها باسم المكتبة', /مكتبة/.test(await page.textContent('#add-h')) && /\+18/.test(await page.textContent('#add-h')));
    await page.fill('#add-q', 'Sample'); await page.press('#add-q', 'Enter'); await page.waitForSelector('.cand');
    check('الأفلام: بحثها يُرسل موسوماً adult، وما في المكتبة من نتائجه يقال إنه فيها', sent.some(b => b.action === 'search' && b.adult === true) && await page.evaluate(() => { const c = [...document.querySelectorAll('.cand')]; return c.length === 2 && !!c[0].querySelector('[data-act=add-pick]') && /في قائمتك/.test(c[1].textContent); }), JSON.stringify(sent.map(b => [b.action, b.adult])));
    await tap('.cand [data-act=add-pick]'); await page.waitForSelector('#f-m9900009'); await page.waitForSelector('#sheet[open]');
    check('الأفلام: الإضافة منها موسومة adult، والمضاف يظهر فيها فوراً مغطى', sent.some(b => b.action === 'add' && b.adult === true && b.tmdb === 9900009) && await page.evaluate(() => document.querySelectorAll('.tk').length === 3 && !!document.querySelector('#f-m9900009 .poster.x18')));
    await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(300);
    await page.reload(); await page.waitForSelector('.tk'); check('الأفلام: تحديث الصفحة يبقيك في المكتبة وما أُضيف فيها باقٍ', await page.evaluate(() => document.documentElement.dataset.room === '18' && !!document.getElementById('f-m9900009')));
    await flipTo(false);
    check('الأفلام: الزر نفسه يُخرج منها، والقائمة العادية كما كانت بلا ما أُضيف في المكتبة', await page.evaluate(() => !document.documentElement.dataset.room && !document.getElementById('f-m9900009') && !document.getElementById('f-m9900001') && !document.querySelector('#tonight').hidden) && await page.locator('.tk').count() === n0, String(await page.locator('.tk').count())); }
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${[...new Set(fails)].join(' ؛ ')}` : '\n✅ كل الفحوص نجحت');
process.exit(fails.length ? 1 : 0);
