// يفحص «ألعابي» ببيانات tests/fixtures/games.mjs، والخادم (/api/add-game و/api/game-accounts) مُحاكى:
//   • القائمة الرئيسية: القوائم الأربع بأعدادها والكل، و«ملف الحفظ» لكل قائمة (آخر ما تلعبه، اقتراح الليلة بمزاجه، آخر ما ختمته)
//   • علبة اللعبة: شريط منصتها بلون عائلتها، وملصق قائمتها، ولمعة ما ختمته، وعدّ تنازلي لما له موعد محدد، و«قريباً» بدقة الموعد لغيره
//   • «قادم في سلاسلك»، والسلاسل، وبطاقة اللعبة (ملف الحفظ، كم تأخذ لتختمها، ترتيب الصدور وترتيب القصة الرسمي، الاقتباسات موصولة ببوابة الأفلام)
//   • النقل السريع بين القوائم (⋮) مع التراجع، والبحث المتسامح («ذا ويتشر»، «eldin ring») بـ«هل تقصد»
//   • «أضف لعبة»: اقتراحات قبل Enter، ثم المرشحات، ثم اختيار القائمة والإضافة
//   • «حساباتي»: ربط Steam من رجوع الدخول، وسحب الألعاب، وصندوق الأسئلة بالأزرار ولوحة المفاتيح، والحفظ بدفعة واحدة
//   • الجوال (غطاء الفولد) بلا تمدد أفقي، وتقليل الحركة، وبلا أخطاء برمجية
// NODE_PATH=$(npm root -g) node tests/games.test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fixture, progress, titles } from './fixtures/games.mjs';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const FX = fixture();
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/games/data/games.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify(FX)); }
  if (u === '/games/data/titles.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify(titles)); }
  let f = path.join(siteDir, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 500)}`); if (!ok) fails.push(n); };
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#3a5f8f"/></svg>`;
// الخادم المُحاكى: يسجل ما طُلب منه ويرد كما ترد الدوال الحقيقية
const asked = [];
const newGame = { ...FX.games[2], id: 7346, slug: 'zelda-botw', title: 'The Legend of Zelda: Breath of the Wild', plats: ['switch'], series: [], into: [], from: [], cover: 'c7346', art: 'a7346', ord: undefined };
async function mockApi(page) {
  await page.route('**/api/add-game', async r => { const b = JSON.parse(r.request().postData() || '{}'); asked.push(b.action + ':' + (b.q || b.igdb || (b.items || []).map(x => x.igdb).join(',')));
    if (b.password !== 'test') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"password"}' });
    const J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'suggest') return J({ items: [{ igdb: 999123, title: 'Obscure Gem', year: 2019, fams: 8, cover: null }] });
    if (b.action === 'search') return J({ parsed: { title: b.q.replace(/\s+\d{4}$/, ''), year: +(b.q.match(/(\d{4})$/)?.[1] || 0) || null }, candidates: [{ igdb: 7346, title: newGame.title, year: 2017, cover: 'c7346', plats: ['Switch', 'Wii U'], type: 'main' }, { igdb: 1942, title: 'The Witcher 3: Wild Hunt', year: 2015, cover: 'c1942', plats: ['PC'], type: 'main' }] });
    if (b.action === 'add') return J({ state: 'added', game: { ...newGame, src: 'added', at: new Date().toISOString() }, series: {}, plats: { switch: FX.plats.switch }, franchises: {} });
    if (b.action === 'preview') return J({ game: { ...FX.series[5].members[0], ...FX.games[0], id: b.igdb, title: 'Preview Game', series: [5] }, series: {}, plats: {}, franchises: {} });
    if (b.action === 'import') return J({ state: { added: b.items.length, exists: 0 }, games: b.items.map(x => ({ ...FX.games[3], id: x.igdb, title: 'Imported ' + x.igdb, slug: 'imp-' + x.igdb, series: [], src: 'added' })), series: {}, plats: {}, franchises: {} });
    return r.fulfill({ status: 400, body: '{}' }); });
  await page.route('**/api/game-accounts', async r => { const b = JSON.parse(r.request().postData() || '{}'); asked.push('acc:' + b.action + (b.steamid ? ':' + b.steamid : '') + (b.npsso ? ':npsso' : ''));
    const J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'status') return J({ igdb: true, steam: true, steamId: null, psn: false, xbox: false });
    if (b.action === 'steam') return J({ source: 'steam', total: 4, matched: 3, items: [
      { key: 'steam:1', name: 'Portal 2', plat: 'pc', hours: 12.4, last: '2025-01-03', igdb: 72, sure: true, title: 'Portal 2', year: 2011, cover: 'c72', ttb: { h: 6, n: 8.5 } },
      { key: 'steam:2', name: 'Hades', plat: 'pc', hours: 3, last: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10), igdb: 113112, sure: true, title: 'Hades', year: 2020, cover: 'c113112', ttb: { h: 20, n: 22 } },
      { key: 'steam:3', name: 'Elden Ring', plat: 'pc', hours: 80, last: '2026-11-10', igdb: 119133, sure: true, title: 'Elden Ring', year: 2022, cover: 'c119133' },
      { key: 'steam:4', name: 'Some Unknown Thing', plat: 'pc', hours: 1, last: null, igdb: null }] });
    return r.fulfill({ status: 400, body: '{}' }); });
}
const browser = await chromium.launch();
async function open(width, height, mobile, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ar-SA', ...extra }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|404|Failed to load/.test(m.text()) && errs.push(m.text()));
  await page.route(/images\.igdb\.com/, r => r.fulfill({ contentType: 'image/svg+xml', body: /t_cover/.test(r.request().url()) ? svg(264, 374) : svg(1280, 720) }));
  await page.route(/image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: svg(342, 513) }));
  await page.addInitScript(p => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('gamesg.progress', p); localStorage.setItem('gamesg.pass', 'test'); } }, JSON.stringify(progress));
  await mockApi(page); return { ctx, page, errs };
}
const shown = page => page.evaluate(() => [...document.querySelectorAll('#grid .gc')].filter(e => !e.hidden).map(e => +e.dataset.id));

// ---------- الكمبيوتر
{ console.log('== desktop');
  const { ctx, page, errs } = await open(1440, 900, false);
  await page.goto(`${base}/games/`); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({ items: [...document.querySelectorAll('#mm-menu .mi')].map(b => [b.dataset.v, b.querySelector('.n').textContent, b.getAttribute('aria-pressed')]),
    font: getComputedStyle(document.querySelector('.mi .mt b')).fontFamily, h1: getComputedStyle(document.querySelector('.top h1')).fontFamily, fontOk: document.fonts.check('30px Handjet', 'متابعة'),
    slot: document.querySelector('#slot h2')?.textContent, lbl: document.querySelector('#slot .lbl')?.textContent }));
  check('القائمة الرئيسية: متابعة 1، لعبة جديدة 5، شارة النهاية 3، وضع المتفرج 1، والكل 10، وتبدأ على «متابعة» لأن فيها لعبة', JSON.stringify(m.items) === JSON.stringify([['play', '1', 'true'], ['new', '5', 'false'], ['done', '3', 'false'], ['seen', '1', 'false'], ['all', '10', 'false']]), m);
  check('خط القوائم والعنوان Handjet، محمّلاً', /Handjet/.test(m.font) && /Handjet/.test(m.h1) && m.fontOk, m);
  check('ملف الحفظ في «متابعة»: آخر ما تلعبه (Elden Ring) بعنوان «تابع من حيث توقفت»', m.slot === 'Elden Ring' && m.lbl === 'تابع من حيث توقفت', m);
  check('الشبكة تعرض ما في «متابعة» وحده', JSON.stringify(await shown(page)) === '[119133]', await shown(page));
  await page.click('#mm-menu [data-v=new]'); await page.waitForTimeout(400);
  const n = await page.evaluate(() => ({ lbl: document.querySelector('#slot .lbl').textContent, t: document.querySelector('#slot h2')?.textContent, moods: [...document.querySelectorAll('#slot .mood .chip')].map(c => c.textContent), ids: [...document.querySelectorAll('#grid .gc')].filter(e => !e.hidden).map(e => +e.dataset.id) }));
  check('«لعبة جديدة»: اقتراح الليلة مما صدر فيها (لا GTA VI القادمة)، ومزاجك الليلة بأنواعها، والشبكة بخمس ألعاب', n.lbl === 'ماذا ألعب الليلة؟' && ['The Witcher 3: Wild Hunt', 'The Last of Us Part I', 'Minecraft', 'Tiny Obscure Indie'].includes(n.t) && n.moods[0].startsWith('أي نوع') && n.moods.length >= 3 && n.ids.length === 5, n);
  await page.click('#slot .mood .chip:has-text("نجاة")'); await page.waitForTimeout(300);
  check('اختيار مزاج «نجاة» يأتي بلعبة منه (The Last of Us Part I) ويُحفظ', await page.textContent('#slot h2') === 'The Last of Us Part I' && await page.evaluate(() => localStorage.getItem('games.mood')) === 'نجاة');
  await page.click('#slot .mood .chip >> nth=0'); await page.waitForTimeout(200);
  // الكل: العلب وشرائط المنصات والملصقات واللمعة والعدّ
  await page.click('#mm-menu [data-v=all]'); await page.waitForTimeout(400);
  const c = await page.evaluate(() => { const g = id => document.getElementById('g-' + id), band = id => [g(id).querySelector('.band b')?.textContent, getComputedStyle(g(id).querySelector('.band')).backgroundImage.includes('gradient')];
    return { n: [...document.querySelectorAll('#grid .gc')].filter(e => !e.hidden).length, rag: band(112875), hk: band(14593), mc: band(11208), sw: band(117170), badges: ['112875', '119133', '117170', '1942'].map(id => g(id).querySelector('.badge b')?.textContent || ''),
      holo: getComputedStyle(g(112875).querySelector('.cover'), '::after').backgroundImage.includes('gradient'), noHolo: getComputedStyle(g(1942).querySelector('.cover'), '::after').content,
      gta: (e => e && { until: e.dataset.until, dg: e.querySelectorAll('.ck .dg').length, sr: e.querySelector('.sr-time').textContent })(g(136625).querySelector('.cd[data-until]')), cart: !!g(990001).querySelector('.ph .ph-l b'),
      meta: g(112875).querySelector('.meta').textContent }; });
  check('«كل الألعاب»: العشر كلها', c.n === 10, c);
  check('شريط المنصة: ما لعبتها عليه (Ragnarök على PS5، Hollow Knight على Switch)، وإلا أولى منصاتها (Minecraft)', c.rag[0] === 'PS5' && c.hk[0] === 'Switch' && c.mc[0] === 'Android' && c.rag[1], c);
  check('ملصق القائمة: ختمتها، تلعبها، شاهدتها، ولا ملصق لـ«لعبة جديدة»', JSON.stringify(c.badges) === JSON.stringify(['ختمتها', 'تلعبها', 'شاهدتها', '']), c.badges);
  check('ما ختمته يلمع بطبقة هولوغرامية، وغيره بلا لمعة', c.holo && c.noHolo === 'none', c);
  check('GTA VI (موعد محدد): عدّ تنازلي حي بأيامه وساعاته، ونص مقروء لقارئ الشاشة', c.gta && c.gta.dg === 4 && /^باقٍ \d+ يوماً/.test(c.gta.sr), c.gta);
  check('لعبة بلا غلاف: خرطوشة باسمها', c.cart);
  check('سطر العلبة: السنة وساعات لعبك', /2022/.test(c.meta) && /لعبتها 45 ساعة/.test(c.meta), c.meta);
  const soon = await page.evaluate(() => ({ on: !document.getElementById('soon').hidden, items: [...document.querySelectorAll('#soon .part')].map(p => [p.querySelector(':scope>b').textContent, p.querySelector('.cd')?.dataset.until ? 'count' : p.querySelector('.cd.tba b')?.textContent, p.classList.contains('out')]) }));
  check('«قادم في سلاسلك»: GTA VI بعدّها (في قائمتك)، وSilksong من سلسلة Hollow Knight «الربع الأول» بلا عدّ (خارج قائمتك)',
    soon.on && soon.items.length === 2 && soon.items[0][0] === 'Grand Theft Auto VI' && soon.items[0][1] === 'count' && !soon.items[0][2] && soon.items[1][0] === 'Hollow Knight: Silksong' && /^الربع الأول من \d{4}$/.test(soon.items[1][1]) && soon.items[1][2], soon);
  // النقل السريع
  await page.click('#g-1942 .qm-b'); await page.waitForTimeout(150);
  const q = await page.evaluate(() => ({ open: !document.getElementById('qm').hidden, items: [...document.querySelectorAll('#qm button')].map(b => [b.dataset.v, b.getAttribute('aria-checked')]), focus: document.activeElement?.dataset.v }));
  check('⋮ يفتح «انقلها إلى» بالقوائم الأربع، والحالية محددة والتركيز عليها', q.open && q.items.length === 4 && q.items.find(x => x[0] === 'new')[1] === 'true' && q.focus === 'new', q);
  await page.click('#qm [data-v=done]'); await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('gamesg.progress')).games[1942], badge: document.querySelector('#g-1942 .badge b')?.textContent, toast: document.getElementById('toast').textContent, n: document.querySelector('#mm-menu [data-v=done] .n').textContent }));
  check('النقل إلى «شارة النهاية» يحفظ ويضع الملصق ويحدّث العدد، مع تراجع', after.s?.s === 'done' && after.badge === 'ختمتها' && /شارة النهاية/.test(after.toast) && after.n === '4', after);
  await page.click('#toast button'); await page.waitForTimeout(250);
  check('التراجع يعيدها كما كانت', await page.evaluate(() => JSON.parse(localStorage.getItem('gamesg.progress')).games[1942]?.s === 'new' && !document.querySelector('#g-1942 .badge') && document.querySelector('#mm-menu [data-v=done] .n').textContent === '3'));
  // البحث المتسامح
  const find = async q => { await page.fill('#q', q); await page.waitForTimeout(350); return page.evaluate(() => ({ ids: [...document.querySelectorAll('#grid .gc')].filter(e => !e.hidden).map(e => +e.dataset.id), meant: document.querySelector('#count [data-act=meant]')?.dataset.q || null })); };
  const s1 = await find('ذا ويتشر'), s2 = await find('eldin ring'), s3 = await find('gta'), s4 = await find('Santa Monica'), s5 = await find('witchr');
  check('البحث: «ذا ويتشر» باسمها العربي، و«eldin ring» و«witchr» بالخطأ مع «هل تقصد»، و«gta» باختصارها، و«Santa Monica» بمطوّرها',
    JSON.stringify(s1.ids) === '[1942]' && !s1.meant && s2.ids[0] === 119133 && s2.meant === 'Elden Ring' && s5.ids[0] === 1942 && s5.meant === 'The Witcher 3: Wild Hunt' && s3.ids.includes(1020) && !s3.meant && JSON.stringify(s4.ids) === '[112875]', { s1, s2, s3, s4, s5 });
  await page.fill('#q', ''); await page.waitForTimeout(300);
  await page.selectOption('select[data-k=plat]', 'f:nin'); await page.waitForTimeout(250);
  check('تصفية المنصة: عائلة نينتندو', JSON.stringify((await shown(page)).sort((a, b) => a - b)) === '[1942,11208,14593]', await shown(page));
  await page.selectOption('select[data-k=plat]', ''); await page.waitForTimeout(200);
  // البطاقة
  await page.click('#g-112875 .cover'); await page.waitForSelector('#sheet[open] .save'); await page.waitForTimeout(300);
  const sh = await page.evaluate(() => { const b = document.getElementById('sheet-body');
    return { hash: location.hash, title: b.querySelector('h2').textContent, ar: b.querySelector('.sh-head .ar')?.textContent, zoom: b.querySelector('.sh-head .cover').dataset.zoom, checked: b.querySelector('.lists [aria-checked=true]')?.dataset.v,
      on: b.querySelector('.pl [aria-checked=true]')?.dataset.v, plats: [...b.querySelectorAll('.pl .pc')].map(x => x.textContent), at: b.querySelector('input[data-k=at]')?.value, h: b.querySelector('input[data-k=h]')?.value,
      ttb: [...b.querySelectorAll('.ttb li')].map(li => li.className), ord: [...b.querySelectorAll('.order[data-ov=release] li')].map(li => li.dataset.n + (li.classList.contains('here') ? '*' : '')),
      story: [...b.querySelectorAll('.order[data-ov=story] li .t b')].map(x => x.textContent), storyHidden: b.querySelector('.order[data-ov=story]').hidden, src: b.querySelector('.ordv')?.closest('.sec')?.querySelector('.note a')?.href,
      tv: [...b.querySelectorAll('.adapt a')].map(a => a.getAttribute('href')), dlc: b.querySelector('.relg .part b')?.textContent, links: [...b.querySelectorAll('.links a b')].map(x => x.textContent) }; });
  check('البطاقة: العنوان والاسم العربي، والغلاف يُكبَّر بدقة 1080p، ورابطها #g112875', sh.title === 'God of War Ragnarök' && sh.ar === 'إله الحرب: راغناروك' && /t_1080p\/c112875\.jpg$/.test(sh.zoom) && sh.hash === '#g112875', sh);
  check('ملف الحفظ: «شارة النهاية» محددة، وعلى PS5 من بين منصاتها، وشهرها وساعاتها', sh.checked === 'done' && sh.on === 'ps5' && sh.plats.join() === 'PS5,PS4,PC' && sh.at === '2026-10' && sh.h === '45', sh);
  check('كم تأخذ لتختمها: ثلاثة أشرطة وشريط ساعاتك', sh.ttb.join() === 't-h,t-n,t-c,t-m', sh.ttb);
  check('السلسلة بترتيب الصدور وهذه اللعبة في موضعها (8 من 8)، وترتيب القصة الرسمي مخفي حتى يُختار ويبدأ بـ Ascension، ومصدره رابط', sh.ord.length === 8 && sh.ord[7] === '8*' && sh.storyHidden && sh.story[0] === 'God of War: Ascension' && sh.story[7] === 'God of War Ragnarök' && /playstation/.test(sh.src || ''), sh);
  check('المحتوى الإضافي، والاقتباس إلى مسلسل (خارج أفلامي): TMDB و«أضفه إلى أفلامي»، وروابط المتاجر والتختيم', sh.dlc === 'God of War Ragnarök: Valhalla' && sh.tv.includes('https://www.themoviedb.org/tv/999001') && sh.tv.some(h => /^\.\.\/films\/#add=God%20of%20War%202027$/.test(h)) && sh.links.includes('YouTube') && sh.links.includes('HowLongToBeat'), sh);
  await page.click('#sheet [data-act=ordv][data-v=story]'); await page.waitForTimeout(150);
  check('اختيار «ترتيب القصة» يظهره ويخفي ترتيب الصدور', await page.evaluate(() => !document.querySelector('#sheet .order[data-ov=story]').hidden && document.querySelector('#sheet .order[data-ov=release]').hidden));
  await page.click('#sheet .pl [data-v=pc]'); await page.fill('#sheet input[data-k=h]', '52'); await page.press('#sheet input[data-k=h]', 'Tab'); await page.waitForTimeout(200);
  check('تغيير المنصة والساعات يُحفظ في السجل ويظهر على العلبة', await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('gamesg.progress')).games[112875]; return r.on === 'pc' && r.h === 52 && document.querySelector('#g-112875 .band b').textContent === 'PC' && /لعبتها 52 ساعة/.test(document.querySelector('#g-112875 .meta').textContent); }));
  await page.click('#sheet [data-act=set][data-v=seen]'); await page.waitForTimeout(250);
  const sv = await page.evaluate(() => ({ r: JSON.parse(localStorage.getItem('gamesg.progress')).games[112875], opts: [...document.querySelectorAll('#sheet .pl .pc')].map(x => x.dataset.v) }));
  check('«وضع المتفرج»: منصات المشاهدة (يوتيوب، تويتش، الإنترنت) بدل منصات اللعب، والمنصة السابقة تُنسى', sv.r.s === 'seen' && !sv.r.on && sv.opts.join() === 'yt,twitch,web', sv);
  await page.click('#sheet [data-act=set][data-v=done]'); await page.click('#sheet .pl [data-v=ps5]'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  check('Esc يغلق البطاقة ويزيل رابطها', await page.evaluate(() => !document.getElementById('sheet').open && !location.hash));
  // عمل خارج القائمة من السلسلة: بطاقة اطلاع وزر الإضافة إلى قائمة
  await page.goto(`${base}/games/#g112875`); await page.waitForSelector('#sheet[open] .order:not([hidden])'); await page.click('#sheet [data-act=ordv][data-v=release]'); await page.click('#sheet .order[data-ov=release] li:first-child .go'); await page.waitForSelector('#sheet [data-act=pv-add]');
  check('جزء خارج القائمة من السلسلة: بطاقة اطلاع من الخادم، وبدل ملف الحفظ «أضفها إلى» بالقوائم الأربع', asked.includes('preview:549') && await page.locator('#sheet [data-act=pv-add]').count() === 4);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // السلاسل
  await page.click('[data-act=view][data-v=series]'); await page.waitForTimeout(300);
  const sr = await page.evaluate(() => [...document.querySelectorAll('#series .fr')].map(f => [f.querySelector('h3').textContent, f.querySelectorAll('.part').length, f.querySelectorAll('.part.out').length]));
  check('عرض السلاسل: أربع سلاسل بأجزائها، وما ليس في قائمتك باهت', sr.length === 4 && sr.find(x => x[0] === 'God of War')?.[1] === 8 && sr.find(x => x[0] === 'God of War')?.[2] === 7, sr);
  await page.click('[data-act=view][data-v=grid]');
  // أضف لعبة
  await page.click('.top [data-act=add]'); await page.waitForSelector('#add[open]');
  const sug = async q => { await page.fill('#add-q', ''); await page.type('#add-q', q, { delay: 15 }); await page.waitForTimeout(500); return page.evaluate(() => [...document.querySelectorAll('#add-sug li')].map(li => [li.querySelector('b').textContent, li.classList.contains('meant'), li.classList.contains('srv')])); };
  const a1 = await sug('قود اوف وور'), a2 = await sug('gta 5'), a3 = await sug('ماينكرافت'), a4 = await sug('obscur gem');
  check('اقتراحات قبل Enter: «قود اوف وور» ← God of War، و«gta 5» ← Grand Theft Auto V باختصاره، و«ماينكرافت» باسمها العربي، وما ليس في الفهرس من IGDB عبر الخادم',
    a1[0]?.[0] === 'God of War' && a2[0]?.[0] === 'Grand Theft Auto V' && a3[0]?.[0] === 'Minecraft' && !a3[0][1] && a4.some(x => x[0] === 'Obscure Gem') && a1.at(-1)?.[2] && asked.includes('suggest:obscur gem'), { a1, a2, a3, a4 });
  await page.fill('#add-q', 'zelda breath'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#cands .cand');
  const cands = await page.evaluate(() => [...document.querySelectorAll('#cands .cand')].map(c => [c.querySelector('b').textContent, !!c.querySelector('[data-act=add-pick]'), c.querySelector('.cbtns small')?.textContent || '']));
  check('المرشحات: الجديدة بزري «التفاصيل» و«أضفها»، وما في قائمتك «في قائمتك»', cands[0][0] === newGame.title && cands[0][1] && cands[1][2] === 'في قائمتك', cands);
  await page.click('#cands .cand:first-child [data-act=add-pick]'); await page.waitForTimeout(150);
  check('«أضفها» يسأل «إلى أي قائمة؟» بالقوائم الأربع', await page.locator('#cands .pickl [data-act=add-to]').count() === 4);
  await page.click('#cands .pickl [data-v=play]'); await page.waitForSelector('#sheet[open]'); await page.waitForTimeout(300);
  const added = await page.evaluate(() => ({ card: !!document.getElementById('g-7346'), fresh: document.getElementById('g-7346')?.classList.contains('fresh'), s: JSON.parse(localStorage.getItem('gamesg.progress')).games[7346], pend: JSON.parse(localStorage.getItem('gamesg.pending') || '[]').length, title: document.querySelector('#sheet h2').textContent, note: /البناء القادم/.test(document.getElementById('sheet-body').textContent) }));
  check('الإضافة: علبتها في القائمة فوراً، في «متابعة»، ومحفوظة محلياً حتى يصلها البناء، وتُفتح بطاقتها', added.card && added.fresh && added.s?.s === 'play' && added.pend === 1 && added.title === newGame.title && added.note, added);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('#grid .gc:not([hidden])');
  check('بعد التحديث تبقى اللعبة المضافة ظاهرة من الحفظ المحلي', await page.evaluate(() => !!document.getElementById('g-7346')));
  // حساباتي: الرجوع من Steam، ثم السحب وصندوق الأسئلة
  await page.goto(`${base}/games/#steam=76561198000000001`); await page.waitForSelector('#acc[open] [data-act=pull][data-src=steam]');
  check('الرجوع من «ادخل عبر Steam» يحفظ الحساب ويفتح «حساباتي» مرتبطاً، ويزيل الرقم من الرابط', await page.evaluate(() => localStorage.getItem('gamesg.steam') === '76561198000000001' && !location.hash && /مرتبط/.test(document.querySelector('#acc .s-steam').textContent)));
  await page.click('#acc [data-act=pull][data-src=steam]'); await page.waitForSelector('#inbox[open] .ib-card.top');
  const ib = await page.evaluate(() => ({ h: document.querySelector('.ib-h h2').textContent, n: document.querySelector('.ib-h p').textContent, t: document.querySelector('.ib-card.top h3').textContent, rec: document.querySelector('.ib-a .rec')?.dataset.v, why: document.querySelector('.ib-q small').textContent }));
  check('السحب من Steam: صندوق الأسئلة بما ليس في قائمتك (Elden Ring موجودة فتُستبعد)، وأولها Portal 2 والأرجح «ختمتها» لأن ساعاتك تجاوزت متوسط ختمها',
    asked.includes('acc:steam:76561198000000001') && ib.h === 'من Steam' && /1 من 2/.test(ib.n) && /لعبة واحدة في قائمتك/.test(ib.n) && ib.t === 'Portal 2' && ib.rec === 'done' && /متوسط ختمها/.test(ib.why), ib);
  await page.keyboard.press('1'); await page.waitForTimeout(400);
  const ib2 = await page.evaluate(() => ({ t: document.querySelector('.ib-card.top h3')?.textContent, rec: document.querySelector('.ib-a .rec')?.dataset.v }));
  check('الجواب بالرقم 1 (ختمتها) ينقل إلى التالية: Hades، والأرجح «ما زلت ألعبها» لأنك لعبتها هذه الأيام', ib2.t === 'Hades' && ib2.rec === 'play', ib2);
  await page.click('.ib-a [data-v=play]'); await page.waitForTimeout(400);
  const end = await page.evaluate(() => ({ h: document.querySelector('.ib-end h3')?.textContent, miss: document.querySelector('.miss summary')?.textContent, save: document.querySelector('[data-act=ib-save]')?.textContent }));
  check('النهاية: «انتهت الأسئلة» وزر «احفظ لعبتين»، وما لم يُطابق في IGDB مذكور للبحث عنه', end.h === 'انتهت الأسئلة' && /لعبتان|لعبتين/.test(end.save) && /لعبة واحدة/.test(end.miss), end);
  await page.click('[data-act=ib-save]'); await page.waitForTimeout(500);
  const imp = await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('gamesg.progress')).games; return { a: g[72], b: g[113112], cards: !!document.getElementById('g-72') && !!document.getElementById('g-113112'), open: document.getElementById('inbox').open, toast: document.getElementById('toast').textContent }; });
  check('الحفظ: طلب واحد يضيف الاثنتين، Portal 2 «ختمتها» على PC بساعاتها مقرّبة وتاريخ آخر لعب، وHades «متابعة»', asked.includes('import:72,113112') && imp.a?.s === 'done' && imp.a.on === 'pc' && imp.a.h === 12 && imp.a.at === '2025-01-03' && imp.b?.s === 'play' && imp.cards && !imp.open && /لعبتان/.test(imp.toast), imp);
  check('desktop: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- الجوال: غطاء الفولد
{ console.log('== cover (369×905)');
  const { ctx, page, errs } = await open(369, 905, true);
  await page.goto(`${base}/games/`); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, menu: getComputedStyle(document.getElementById('mm-menu')).display, rows: new Set([...document.querySelectorAll('#mm-menu .mi')].map(b => Math.round(b.getBoundingClientRect().top))).size,
    tap: [...document.querySelectorAll('#mm-menu .mi, .top .btn, .qm-b')].filter(b => b.offsetParent).every(b => b.getBoundingClientRect().height >= 40 && b.getBoundingClientRect().width >= 40) }));
  check('الجوال: بلا تمدد أفقي، والقوائم صف واحد يُمرَّر، وكل زر بمساحة لمس كافية', m.sw <= m.iw && m.menu === 'flex' && m.rows === 1 && m.tap, m);
  await page.click('#g-119133 .cover'); await page.waitForSelector('#sheet[open]'); await page.waitForTimeout(400);
  const s = await page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), sw: document.getElementById('sheet-body').scrollWidth <= document.getElementById('sheet-body').clientWidth + 1, cols: getComputedStyle(document.querySelector('#sheet .lists')).gridTemplateColumns.split(' ').length }; });
  check('الجوال: البطاقة تملأ الشاشة بلا تمدد، وقوائم ملف الحفظ عمودان', s.w === 369 && s.h === 905 && s.sw && s.cols === 2, s);
  check('cover: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- تقليل الحركة
{ console.log('== reduced-motion');
  const { ctx, page, errs } = await open(1280, 860, false, { reducedMotion: 'reduce' });
  await page.goto(`${base}/games/`); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(500);
  check('تقليل الحركة: مؤشر القائمة والعدّ والبوابة الصغيرة ساكنة', await page.evaluate(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)));
  check('reduced-motion: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص ألعابي نجحت'); process.exit(fails.length ? 1 : 0);
