// يفحص «ألعابي» ببيانات tests/fixtures/games.mjs، والخادم (/api/add-game و/api/game-accounts) مُحاكى:
//   • القائمة الرئيسية: القوائم الأربع بأعدادها والكل، و«ملف الحفظ» لكل قائمة (آخر ما تلعبه، اقتراح الليلة بمزاجه، آخر ما ختمته)
//   • علبة اللعبة: شريط منصتها بلون عائلتها، وملصق قائمتها، ولمعة ما ختمته، وعدّ تنازلي لما له موعد محدد، و«قريباً» بدقة الموعد لغيره
//   • «قادم في سلاسلك»، والسلاسل، وبطاقة اللعبة (ملف الحفظ، كم تأخذ لتختمها، ترتيب الصدور وترتيب القصة الرسمي، الاقتباسات موصولة ببوابة الأفلام)
//   • النقل السريع بين القوائم (⋮) مع التراجع، والبحث المتسامح («ذا ويتشر»، «eldin ring») بـ«هل تقصد»
//   • «أضف لعبة»: اقتراحات قبل Enter، ثم المرشحات، ثم اختيار القائمة والإضافة
//   • «حساباتي»: ربط Steam من رجوع الدخول، وسحب الألعاب، وصندوق الأسئلة بالأزرار ولوحة المفاتيح، والحفظ بدفعة واحدة
//   • المكرر: تنبيه «لعبتان بالاسم نفسه» و«نسختان من لعبة واحدة» بجوابيه، والمراجعة، والإسكات الدائم، والتوأم في البطاقة ولحظة الإضافة
//   • الجوال (غطاء الفولد) بلا تمدد أفقي، وتقليل الحركة، وبلا أخطاء برمجية
// NODE_PATH=$(npm root -g) node tests/games.test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fixture, progress, titles } from './fixtures/games.mjs';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const FX = fixture();
// العناية: نبذة مترجمة وموقع من الأحداث للعبة (God of War Ragnarök)، ونبذة إنجليزية فقط لأخرى (Elden Ring)، ورقمان صُحّحا (555001 ← 990001، و555002 ← 1942 التي لها سجل)
const TX = { 112875: { s: 'Ragnarök is coming.\n\nKratos and Atreus must journey to each of the Nine Realms.', t: 'Fimbulwinter is well underway.', sa: 'راغناروك قادم.\n\nعلى كريتوس وابنه أتريوس أن يجوبا العوالم التسعة، في God of War Ragnarök.', ta: 'شتاء فيمبولوينتر في ذروته.' }, 119133: { s: 'Rise, Tarnished.' } };
// منصات سجل شقيق في IGDB (نسخة الأجهزة المنزلية من لعبة سجلها الرئيسي للأركيد مثلاً)
FX.games.find(g => g.id === 1942).also = ['ps3'];
FX.games.find(g => g.id === 112875).place = { k: 'sequel', after: 'God of War (2018)', line: 'تكمل أحداث God of War بعد ثلاث سنوات: الشتاء العظيم يوشك أن ينتهي.', when: 'بعد ثلاث سنوات من الجزء السابق', where: 'العوالم التسعة', src: 'igdb' };
FX.moved = { 555001: 990001, 555002: 1942 };
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/games/data/games.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify(FX)); }
  if (u === '/games/data/texts.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ built: FX.built, texts: TX })); }
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
    if (b.action === 'add') return J({ state: 'added', game: { ...(FX.games.find(g => g.id === b.igdb) || newGame), src: 'added', at: new Date().toISOString() }, series: {}, plats: { switch: FX.plats.switch }, franchises: {} });
    if (b.action === 'remove') return J({ state: 'removed' });
    if (b.action === 'ask') return J({ state: 'asked' });
    if (b.action === 'preview') return J({ game: { ...FX.series[5].members[0], ...FX.games[0], id: b.igdb, title: 'Preview Game', series: [5] }, series: {}, plats: {}, franchises: {} });
    if (b.action === 'import') return J({ state: { added: b.items.length, exists: 0 }, games: b.items.map(x => ({ ...FX.games[3], id: x.igdb, title: 'Imported ' + x.igdb, slug: 'imp-' + x.igdb, series: [], src: 'added' })), series: {}, plats: {}, franchises: {} });
    return r.fulfill({ status: 400, body: '{}' }); });
  await page.route('**/api/game-accounts', async r => { const b = JSON.parse(r.request().postData() || '{}'); asked.push('acc:' + b.action + (b.steamid ? ':' + b.steamid : '') + (b.npsso ? ':npsso' : ''));
    const J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'status') return J({ igdb: true, steam: true, steamId: null, psn: false, xbox: false });
    // السحب يطابق برقم المتجر فقط ويعيد البقية «للمطابقة»، فتطلبها الصفحة بالاسم في دفعات
    if (b.action === 'steam') return J({ source: 'steam', total: 4, matched: 2, todo: 2, items: [
      { key: 'steam:1', name: 'Portal 2', plat: 'pc', hours: 12.4, last: '2025-01-03', igdb: 72, sure: true, title: 'Portal 2', year: 2011, cover: 'c72', ttb: { h: 6, n: 8.5 } },
      { key: 'steam:2', name: 'Hades', plat: 'pc', hours: 3, last: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10), igdb: null, todo: true },
      { key: 'steam:3', name: 'Elden Ring', plat: 'pc', hours: 80, last: '2026-11-10', igdb: 119133, sure: true, title: 'Elden Ring', year: 2022, cover: 'c119133' },
      { key: 'steam:4', name: 'Some Unknown Thing', plat: 'pc', hours: 1, last: null, igdb: null, todo: true }] });
    if (b.action === 'match') { asked.push('match:' + b.items.map(x => x.key + '/' + x.plat).join(',')); await new Promise(z => setTimeout(z, 250));
      return J({ source: b.source, items: b.items.map(x => x.key === 'steam:2' ? { key: x.key, name: x.name, igdb: 113112, sure: true, title: 'Hades', year: 2020, cover: 'c113112', ttb: { h: 20, n: 22 } } : { key: x.key, name: x.name, igdb: null }) }); }
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
  const qn = await page.evaluate(() => [...document.querySelectorAll('#qm button')].map(b => b.textContent.trim()));
  check('⋮ يفتح «حالتها عندي» بأربعة أزرار بوظيفتها، والحالية محددة والتركيز عليها، وتحتها «احذفها من مكتبتي»', q.open && q.items.filter(x => x[0]).length === 4 && q.items.find(x => x[0] === 'new')[1] === 'true' && q.focus === 'new'
    && qn.join('|') === 'ألعبها الآن|سألعبها لاحقاً|ختمتها|شاهدتها فقط|احذفها من مكتبتي', { q, qn });
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
  check('حالتها عندي: «ختمتها» محددة، وعلى PS5 من بين منصاتها، وشهرها وساعاتها', sh.checked === 'done' && sh.on === 'ps5' && sh.plats.join() === 'PS5,PS4,PC' && sh.at === '2026-10' && sh.h === '45', sh);
  const names = await page.evaluate(() => ({ h: document.querySelector('#sheet .save h3').textContent, b: [...document.querySelectorAll('#sheet .save .li')].map(x => x.querySelector('b').textContent + ' / ' + x.querySelector('small').textContent), rm: document.querySelector('#sheet .save .rm-b')?.textContent.trim() }));
  check('أزرار البطاقة بوظيفتها (ألعبها الآن، سألعبها لاحقاً، ختمتها، شاهدتها فقط)، وتحت كل زر اسم قائمته، وفي آخرها «احذفها من مكتبتي»',
    names.h === 'حالتها عندي' && names.b.join('|') === 'ألعبها الآن / في «متابعة»|سألعبها لاحقاً / في «لعبة جديدة»|ختمتها / في «شارة النهاية»|شاهدتها فقط / في «وضع المتفرج»' && names.rm === 'احذفها من مكتبتي', names);
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
  check('«أضفها» يسأل «ما وضعها عندك؟» بالأزرار الأربعة بوظيفتها', await page.locator('#cands .pickl [data-act=add-to]').count() === 4 && await page.evaluate(() => document.querySelector('#cands .pickl b').textContent === 'ما وضعها عندك؟' && document.querySelector('#cands .pickl [data-v=new]').textContent.trim() === 'سألعبها لاحقاً'));
  await page.click('#cands .pickl [data-v=play]'); await page.waitForSelector('#sheet[open]'); await page.waitForTimeout(300);
  const added = await page.evaluate(() => ({ card: !!document.getElementById('g-7346'), fresh: document.getElementById('g-7346')?.classList.contains('fresh'), s: JSON.parse(localStorage.getItem('gamesg.progress')).games[7346], pend: JSON.parse(localStorage.getItem('gamesg.pending') || '[]').length, title: document.querySelector('#sheet h2').textContent, note: /البناء القادم/.test(document.getElementById('sheet-body').textContent) }));
  check('الإضافة: علبتها في القائمة فوراً، في «متابعة»، ومحفوظة محلياً حتى يصلها البناء، وتُفتح بطاقتها', added.card && added.fresh && added.s?.s === 'play' && added.pend === 1 && added.title === newGame.title && added.note, added);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('#grid .gc:not([hidden])');
  check('بعد التحديث تبقى اللعبة المضافة ظاهرة من الحفظ المحلي', await page.evaluate(() => !!document.getElementById('g-7346')));
  // الحذف من البطاقة: تأكيد في مكانه، ثم تختفي من القائمة والسجل والحفظ المحلي، مع تراجع يعيدها بسجلها
  await page.evaluate(() => document.querySelector('#mm-menu [data-v=all]').click()); await page.click('#g-7346 .cover'); await page.waitForSelector('#sheet[open] .rm-b');
  await page.click('#sheet .rm-b'); await page.waitForTimeout(150);
  const ask = await page.evaluate(() => ({ t: document.querySelector('#sheet .rm.ask p')?.textContent || '', go: !!document.querySelector('#sheet [data-act=rm-go]'), pw: !!document.querySelector('#sheet .rm-pass') }));
  check('«احذفها من مكتبتي» يسأل أولاً في مكانه، باسم اللعبة وما سيحدث، وبلا كلمة سر ما دامت محفوظة', /Breath of the Wild/.test(ask.t) && /كل أجهزتك/.test(ask.t) && ask.go && !ask.pw && !asked.some(a => a.startsWith('remove')), ask);
  await page.click('#sheet [data-act=rm-no]'); await page.waitForTimeout(100);
  check('«تراجع» في التأكيد يعيد الزر ولا يحذف شيئاً', await page.evaluate(() => !!document.querySelector('#sheet .rm-b') && !document.querySelector('#sheet .rm.ask') && !!document.getElementById('g-7346')) && !asked.some(a => a.startsWith('remove')));
  await page.click('#sheet .rm-b'); await page.click('#sheet [data-act=rm-go]'); await page.waitForFunction(() => !document.getElementById('g-7346'));
  await page.waitForTimeout(400);
  const gone = await page.evaluate(() => ({ sheet: document.getElementById('sheet').open, rec: JSON.parse(localStorage.getItem('gamesg.progress')).games[7346], pend: JSON.parse(localStorage.getItem('gamesg.pending') || '[]').length, rm: Object.keys(JSON.parse(localStorage.getItem('gamesg.removed') || '{}')), toast: document.getElementById('toast').textContent, all: document.querySelector('#mm-menu [data-v=all] .n').textContent }));
  check('الحذف: طلب واحد إلى الخادم، وتختفي علبتها وسجلها وحفظها المحلي، وتُغلق بطاقتها، وتنبيه فيه «تراجع»', asked.includes('remove:7346') && !gone.sheet && !gone.rec && gone.pend === 0 && gone.rm.join() === '7346' && /حُذفت «The Legend of Zelda/.test(gone.toast) && /تراجع/.test(gone.toast) && gone.all === '10', gone);
  await page.click('#toast button'); await page.waitForFunction(() => !!document.getElementById('g-7346'));
  const back = await page.evaluate(() => ({ rec: JSON.parse(localStorage.getItem('gamesg.progress')).games[7346], rm: localStorage.getItem('gamesg.removed'), pend: JSON.parse(localStorage.getItem('gamesg.pending') || '[]').length }));
  check('التراجع عن الحذف يعيدها بسجلها كما كان («ألعبها الآن»)', asked.filter(a => a === 'add:7346').length === 2 && back.rec?.s === 'play' && back.rm === '{}' && back.pend === 1, back);
  // الحذف من ⋮، ثم التحديث: لعبة في ملف القائمة حُذفت من هذا الجهاز تبقى مخفية حتى يلحق البناء
  await page.waitForTimeout(300); await page.click('#g-1942 .qm-b'); await page.click('#qm [data-act=qm-rm]'); await page.waitForTimeout(150);
  check('⋮ ثم «احذفها»: التأكيد داخل القائمة نفسها باسم اللعبة', await page.evaluate(() => { const q = document.getElementById('qm'); return !q.hidden && q.classList.contains('ask') && /Witcher 3/.test(q.textContent) && !!q.querySelector('[data-act=rm-go]') && q.getBoundingClientRect().right <= innerWidth && q.getBoundingClientRect().bottom <= innerHeight; }));
  await page.click('#qm [data-act=rm-go]'); await page.waitForFunction(() => !document.getElementById('g-1942')); await page.waitForTimeout(200);
  await page.reload(); await page.waitForSelector('#grid .gc');
  check('بعد التحديث: المحذوفة لا تعود من ملف القائمة القديم، والعدد ينقصها', asked.includes('remove:1942') && await page.evaluate(() => !document.getElementById('g-1942') && document.querySelector('#mm-menu [data-v=all] .n').textContent === '10' && !!document.getElementById('g-7346')));
  // بناء أحدث من الحذف بعشرين دقيقة وما زالت فيه: أُعيدت من جهاز آخر فتظهر؛ ولعبة في الحفظ المحلي أقدم من البناء وليست فيه: حُذفت من جهاز آخر فلا تعود
  await page.evaluate(() => { localStorage.setItem('gamesg.removed', JSON.stringify({ 1942: Date.now() - 30 * 6e4 })); const p = JSON.parse(localStorage.getItem('gamesg.pending')); p[0].game.at = new Date(Date.now() - 40 * 6e4).toISOString(); localStorage.setItem('gamesg.pending', JSON.stringify(p)); });
  await page.reload(); await page.waitForSelector('#grid .gc');
  check('بناء أحدث من الحذف يُصدَّق: ما بقي فيه يظهر، وما أُضيف قبله وليس فيه لا يعود من الحفظ المحلي', await page.evaluate(() => !!document.getElementById('g-1942') && localStorage.getItem('gamesg.removed') === '{}' && !document.getElementById('g-7346') && localStorage.getItem('gamesg.pending') === '[]'));
  // منصة السحب تظهر بين المنصات ولو لم يذكرها IGDB (لعبة سُحبت من Xbox 360 وIGDB يذكر لها الكمبيوتر فقط)
  await page.evaluate(() => { const P = JSON.parse(localStorage.getItem('gamesg.progress')); P.games[1942] = { s: 'done', on: 'x360' }; localStorage.setItem('gamesg.progress', JSON.stringify(P)); });
  await page.reload(); await page.waitForSelector('#grid .gc'); await page.evaluate(() => document.querySelector('#mm-menu [data-v=all]').click()); await page.click('#g-1942 .cover'); await page.waitForSelector('#sheet[open] .pl');
  const pl = await page.evaluate(() => ({ all: [...document.querySelectorAll('#sheet .pl .pc')].map(x => x.dataset.v), on: document.querySelector('#sheet .pl [aria-checked=true]')?.dataset.v,
    note: [...document.querySelectorAll('#sheet .sec')].find(x => x.querySelector('.pls'))?.querySelector('.note')?.textContent || '', listed: [...document.querySelectorAll('#sheet .pls li b')].map(x => x.textContent) }));
  check('المنصة المحفوظة تظهر محددة بين منصات اللعبة ولو لم تكن في بياناتها', pl.all.includes('x360') && pl.on === 'x360' && pl.all.length === new Set(pl.all).size, pl);
  check('منصات السجل الشقيق في IGDB تُعرض للاختيار، وتُذكر تحت منصات اللعبة دون أن تُخلط بتواريخ صدورها', pl.all.includes('ps3') && /PS3/.test(pl.note) && /IGDB/.test(pl.note) && !pl.listed.includes('PS3'), pl);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // حساباتي: الرجوع من Steam، ثم السحب وصندوق الأسئلة
  await page.goto(`${base}/games/#steam=76561198000000001`); await page.waitForSelector('#acc[open] [data-act=pull][data-src=steam]');
  check('الرجوع من «ادخل عبر Steam» يحفظ الحساب ويفتح «حساباتي» مرتبطاً، ويزيل الرقم من الرابط', await page.evaluate(() => localStorage.getItem('gamesg.steam') === '76561198000000001' && !location.hash && /مرتبط/.test(document.querySelector('#acc .s-steam').textContent)));
  await page.click('#acc [data-act=pull][data-src=steam]');
  const prog = await page.waitForFunction(() => /أطابقها مع IGDB… 2 من 4/.test(document.querySelector('#acc [data-src=steam]')?.textContent || ''), null, { timeout: 3000 }).then(() => true).catch(() => false);
  await page.waitForSelector('#inbox[open] .ib-card.top');
  check('بعد السحب تُطابق البقية بالاسم في دفعة (بمنصتها)، والتقدّم ظاهر على الزر', prog && asked.includes('acc:match') && asked.includes('match:steam:2/pc,steam:4/pc'), asked);
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
  // الحذف على جهاز لم تُحفظ فيه كلمة السر: التأكيد يطلبها، والخاطئة لا تحذف
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(() => { localStorage.removeItem('gamesg.pass'); localStorage.setItem('gamesg.nofilm', '1'); }); await page.reload(); await page.waitForSelector('#grid .gc:not([hidden])');
  await page.goto(`${base}/games/#g119133`); await page.waitForSelector('#sheet[open] .rm-b'); await page.click('#sheet .rm-b'); await page.waitForSelector('#sheet .rm-pass');
  await page.click('#sheet [data-act=rm-go]'); await page.waitForTimeout(150);
  const np1 = await page.evaluate(() => document.querySelector('#sheet .rm .msg').textContent);
  await page.fill('#sheet .rm-pass', 'wrong'); await page.click('#sheet [data-act=rm-go]'); await page.waitForFunction(() => /غير صحيحة/.test(document.querySelector('#sheet .rm .msg')?.textContent || ''));
  const np2 = await page.evaluate(() => ({ there: !!document.getElementById('g-119133'), btn: document.querySelector('#sheet [data-act=rm-go]').disabled }));
  await page.fill('#sheet .rm-pass', 'test'); await page.click('#sheet [data-act=rm-go]'); await page.waitForFunction(() => !document.getElementById('g-119133')); await page.waitForTimeout(450);
  check('الحذف بلا كلمة سر محفوظة: يطلبها في التأكيد، والفارغة والخاطئة لا تحذفان، والصحيحة تحذف وتُحفظ للمرات القادمة', /كلمة السر أولاً/.test(np1) && np2.there && !np2.btn && await page.evaluate(() => localStorage.getItem('gamesg.pass') === 'test' && !document.getElementById('sheet').open), { np1, np2 });
  const tap = await page.evaluate(() => { const b = document.querySelector('#toast button').getBoundingClientRect(); return b.height >= 40 && b.width >= 40; });
  check('الجوال: زر «تراجع» بعد الحذف بمساحة لمس كافية', tap);
  check('cover: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- العناية: النبذة بالعربية وزر «ترجمها لي»، وموقع اللعبة من أحداث عالمها، وتصحيح رقم لعبة
{ console.log('== care');
  const { ctx, page, errs } = await open(1280, 900, false);
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded2')) { sessionStorage.setItem('seeded2', '1'); const P = JSON.parse(localStorage.getItem('gamesg.progress')); P.games[555001] = { s: 'done', on: 'pc', h: 90 }; P.games[555002] = { s: 'play' }; localStorage.setItem('gamesg.progress', JSON.stringify(P)); } });
  await page.goto(`${base}/games/#g112875`); await page.waitForSelector('#sheet[open] .about');
  const mv = await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('gamesg.progress')).games; return { old: g[555001], now: g[990001], old2: g[555002], kept: g[1942] }; });
  check('لعبة صُحّح رقمها: سجلها ينتقل إلى رقمها الصحيح ولا يبقى على القديم، وإن كان للصحيح سجل بقي سجله', !mv.old && mv.now?.s === 'done' && mv.now.on === 'pc' && mv.now.h === 90 && !mv.old2 && mv.kept?.s === 'new', mv);
  const ab = await page.evaluate(() => { const a = document.querySelector('#sheet .about'); return { ar: [...a.querySelectorAll(':scope > p.ar-t')].map(p => p.textContent), bdi: a.querySelector('p.ar-t bdi[dir=ltr]')?.textContent, dir: getComputedStyle(a.querySelector('p.ar-t')).direction,
    story: a.querySelector('.more-t p.ar-t')?.textContent, orig: [...a.querySelectorAll('.orig p.en')].map(p => p.textContent), origOpen: a.querySelector('.orig').open, note: a.querySelector(':scope > .note').textContent, tr: !!a.querySelector('.tr'), en: a.querySelectorAll(':scope > p.en').length }; });
  check('النبذة المترجمة تُعرض بالعربية بفقراتها، والاسم الإنجليزي فيها معزول الاتجاه، والقصة بالعربية تحت «القصة»', ab.ar.length === 2 && ab.ar[0] === 'راغناروك قادم.' && ab.bdi === 'God of War Ragnarök' && ab.dir === 'rtl' && ab.story === 'شتاء فيمبولوينتر في ذروته.' && !ab.en, ab);
  check('الأصل الإنجليزي مطويّ تحتها لمن أراده، ومصدر الترجمة مذكور، وبلا زر ترجمة', !ab.origOpen && ab.orig.length === 3 && ab.orig[0] === 'Ragnarök is coming.' && /ترجمتنا/.test(ab.note) && !ab.tr, ab);
  const pl = await page.evaluate(() => { const s = document.querySelector('#sheet .place'); return { cls: s.className, k: s.querySelector('.pl-k').textContent, line: s.querySelector('.pl-line').textContent, stops: [...s.querySelectorAll('.pl-track li')].map(li => [li.className, li.querySelector('small').textContent, li.querySelector('b').textContent, li.querySelector('button')?.dataset.act || '', li.querySelector('button')?.dataset.id || '']),
    facts: [...s.querySelectorAll('.pl-facts span')].map(x => x.textContent), note: s.querySelector('.note').textContent, before: !!(s.compareDocumentPosition(document.querySelector('#sheet .about')) & Node.DOCUMENT_POSITION_FOLLOWING),
    row: document.querySelector('#sheet .order li.here .t small').textContent, w: s.querySelector('.pl-track').scrollWidth <= s.querySelector('.pl-track').clientWidth + 1 }; });
  check('موقعها من أحداث عالمها: نوعه «تكملة» بلونه، وجملته، قبل «عن اللعبة»', /k-sequel/.test(pl.cls) && pl.k === 'تكملة' && /بعد ثلاث سنوات/.test(pl.line) && pl.before, pl);
  check('مسار الأحداث: «قبلها» God of War (2018) زراً يفتح بطاقة ذلك الجزء بعينه (لا جزء 2005 بالاسم نفسه)، ثم «هذه اللعبة»', pl.stops.length === 2 && pl.stops[0][0] === 'was' && pl.stops[0][2] === 'God of War (2018)' && pl.stops[0][3] === 'peek' && pl.stops[0][4] === '19560' && pl.stops[1][0] === 'here' && pl.stops[1][2] === 'God of War Ragnarök' && pl.w, pl.stops);
  check('زمن الأحداث ومكانها ومصدرها، ونوع موقعها بجانب سنتها في قائمة السلسلة', pl.facts.length === 2 && /زمن الأحداث/.test(pl.facts[0]) && /العوالم التسعة/.test(pl.facts[1]) && /IGDB/.test(pl.note) && /تكملة/.test(pl.row), pl);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // لعبة لم تُترجم: نبذتها بالإنجليزية وزر «ترجمها لي»، والطلب يُحفظ
  await page.goto(`${base}/games/#g119133`); await page.waitForSelector('#sheet[open] .about .tr');
  const en = await page.evaluate(() => { const a = document.querySelector('#sheet .about'); return { en: a.querySelector(':scope > p.en')?.textContent, btn: a.querySelector('[data-act=tr-ask]')?.textContent.trim(), orig: !!a.querySelector('.orig'), place: !!document.querySelector('#sheet .place') }; });
  check('غير المترجمة: نبذتها بالإنجليزية كما هي، وتحتها زر «ترجمها لي»، وبلا قسم موقع لما لم يُكتب موقعه', en.en === 'Rise, Tarnished.' && en.btn === 'ترجمها لي' && !en.orig && !en.place, en);
  await page.click('#sheet [data-act=tr-ask]'); await page.waitForSelector('#sheet .tr-ok');
  check('«ترجمها لي»: طلب واحد إلى الخادم برقم اللعبة، ثم «وصل طلب ترجمتها» ويُحفظ على الجهاز', asked.includes('ask:119133') && await page.evaluate(() => /وصل طلب ترجمتها/.test(document.querySelector('#sheet .tr-ok').textContent) && !!JSON.parse(localStorage.getItem('gamesg.asked'))[119133]));
  await page.reload(); await page.waitForSelector('#sheet[open] .about .tr-ok');
  check('بعد التحديث يبقى الطلب مذكوراً ولا يُطلب ثانية', asked.filter(a => a === 'ask:119133').length === 1 && await page.evaluate(() => !document.querySelector('#sheet [data-act=tr-ask]')));
  // لعبة نصها في سجلها (بلا ملف نصوص): تُعرض منه
  await page.goto(`${base}/games/#g11208`); await page.waitForSelector('#sheet[open]'); await page.waitForTimeout(300);
  check('لعبة نبذتها في سجلها لا في ملف النصوص (أُضيفت للتو) تُعرض منه مع زر الترجمة', await page.evaluate(() => { const a = document.querySelector('#sheet .about'); return !a || (!!a.querySelector('p.en') && !!a.querySelector('[data-act=tr-ask]')); }));
  // نبذة مترجمة وقصة لم تُترجم بعد: النبذة بالعربية والقصة بالإنجليزية، والزر يطلب القصة بعينها
  const taWas = TX[112875].ta; delete TX[112875].ta;
  await page.goto(`${base}/games/#g112875`); await page.reload(); await page.waitForSelector('#sheet[open] .about .tr');
  const part = await page.evaluate(() => { const a = document.querySelector('#sheet .about'); return { ar: a.querySelectorAll(':scope > p.ar-t').length, story: a.querySelector('.more-t p.en')?.textContent, btn: a.querySelector('[data-act=tr-ask]')?.textContent.trim(), note: a.querySelector('.tr .note')?.textContent, orig: !!a.querySelector('.orig') }; });
  check('نبذة مترجمة وقصة لم تُترجم: النبذة بالعربية والقصة بالإنجليزية، والزر «ترجم لي قصتها» والملاحظة تقول ما بقي', part.ar === 2 && part.story === 'Fimbulwinter is well underway.' && part.btn === 'ترجم لي قصتها' && /قصتها ما زالت بالإنجليزية/.test(part.note) && !part.orig, part);
  TX[112875].ta = taWas;
  check('care: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- المكرر: لعبتان بالاسم نفسه، ونسختان من لعبة واحدة. التنبيه سؤال بجوابين، و«لا» يُسكته نهائياً
{ console.log('== duplicates');
  const mk = (m, x = {}) => ({ ...FX.games[3], ...m, slug: 'd-' + m.id, titleAr: '', alt: [], series: [], rel: {}, from: [], into: [], art: null, shots: [], genres: ['قتال'], ord: 40, summary: '', at: '2026-02-01T00:00:00Z', ...x });
  const gowS = FX.series[5].members, tl = FX.series[7].members, RM = { ...tl[0], id: 6036, title: 'The Last of Us Remastered', date: '2014-07-29', year: 2014, plats: ['ps4'], type: 'remaster', cover: 'c6036' };
  // God of War (2005) وGod of War (2018): بالاسم نفسه. The Last of Us وريماسترها: نسختان. وPart I ريميك أصله في المكتبة: لعبة أخرى، فلا يدخل المجموعة
  const FXD = { ...FX, games: [...FX.games.map(g => g.id === 205780 ? { ...g, rel: { parent_game: tl[0] } } : g), mk(gowS[0], { series: [5], at: '2026-03-02T00:00:00Z' }), mk(gowS[6], { series: [5], at: '2026-03-03T00:00:00Z' }),
    mk(tl[0], { series: [7], rel: { remasters: [RM] } }), mk(RM, { series: [7], rel: { parent_game: tl[0] } })] };
  const erTwin = () => ({ ...mk({ ...FX.games[1], id: 555123, cover: 'c555123', date: '2025-06-05', year: 2025, plats: ['switch2'], type: 'port' }), src: 'added', at: new Date().toISOString() });
  const routes = async page => {
    await page.route('**/games/data/games.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(FXD) }));
    await page.route('**/api/add-game', async r => { const b = JSON.parse(r.request().postData() || '{}'), J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }), more = { series: {}, plats: {}, franchises: {} };
      if (b.action === 'search' && /elden/i.test(b.q)) return J({ parsed: { title: 'Elden Ring', year: null }, candidates: [{ igdb: 555123, title: 'Elden Ring', year: 2025, cover: 'c555123', plats: ['Switch 2'], type: 'port' }, { igdb: 119133, title: 'Elden Ring', year: 2022, cover: 'c119133', plats: ['PC'], type: 'main' }] });
      if (b.action === 'add' && b.igdb === 555123) { asked.push('add:555123'); return J({ state: 'added', game: erTwin(), ...more }); }
      if (b.action === 'add' && b.igdb === 19560) { asked.push('add:19560'); return J({ state: 'added', game: { ...mk(gowS[6], { series: [5] }), src: 'added', at: new Date().toISOString() }, ...more }); }
      if (b.action === 'preview' && b.igdb === 550) return J({ game: mk({ ...gowS[1], title: 'God of War' }, { series: [5] }), ...more });
      return r.fallback(); });
    await page.route('**/api/game-accounts', async r => { const b = JSON.parse(r.request().postData() || '{}');
      if (b.action === 'steam') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: 'steam', total: 1, matched: 1, todo: 0, items: [{ key: 'steam:77', name: 'Minecraft', plat: 'pc', hours: 5, last: '2026-01-01', igdb: 777001, sure: true, title: 'Minecraft', year: 2011, cover: 'c777001' }] }) });
      return r.fallback(); });
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded3')) { sessionStorage.setItem('seeded3', '1'); const P = JSON.parse(localStorage.getItem('gamesg.progress')); P.games[549] = { s: 'done', on: 'ps2', h: 12 }; localStorage.setItem('gamesg.progress', JSON.stringify(P)); } }); };
  const note = (page, sel) => page.evaluate(s => { const d = document.querySelector(s + ' .dup'); return d ? { h: d.querySelector('h2').textContent, names: [...d.querySelectorAll('.dup-n > span')].map(x => x.textContent), name: d.querySelector('.dup-n').textContent.replace(/\s+/g, ' ').trim(), q: d.querySelector('.dup-x > p:last-child').textContent.replace(/\s+/g, ' ').trim(), btns: [...d.querySelectorAll('.btn')].map(b => b.textContent), covers: d.querySelectorAll('.dup-st img').length } : null; }, sel);
  const inView = page => page.waitForFunction(() => { const r = document.getElementById('dupbar').getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && (window.__y === scrollY || ((window.__y = scrollY), false)); }, null, { timeout: 4000, polling: 120 }).then(() => true).catch(() => false);
  const dups = page => page.evaluate(() => JSON.parse(localStorage.getItem('gamesg.progress')).dups || {});
  const ids = async page => (await shown(page)).sort((a, b) => a - b).join();
  const { ctx, page, errs } = await open(1440, 900, false); await routes(page);
  await page.goto(`${base}/games/`); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(400);
  const n1 = await note(page, '#dup'), at1 = await page.evaluate(() => ({ bar: document.getElementById('dupbar').hidden, above: !!(document.getElementById('dup').compareDocumentPosition(document.getElementById('mm')) & Node.DOCUMENT_POSITION_FOLLOWING), top: document.getElementById('dup').getBoundingClientRect().top < innerHeight }));
  check('عند الفتح: تنبيه فوق القائمة الرئيسية «في مكتبتك لعبتان بالاسم نفسه» بالاسم وسنتيهما وغلافيهما، وسؤال بجوابين، وأن بعده تنبيهاً آخر',
    n1 && n1.h === 'في مكتبتك لعبتان بالاسم نفسه' && n1.name === 'God of War (2005 و2018)' && /^هل تريد تعديلهما؟/.test(n1.q) && /وبعده تنبيه آخر\.$/.test(n1.q) && n1.btns.join('|') === 'نعم، اعرضهما|لا، أبقِهما' && n1.covers === 2 && at1.bar && at1.above && at1.top, { n1, at1 });
  await page.click('#dup [data-act=dup-go]'); const v1 = await inView(page);
  const r1 = await page.evaluate(() => ({ top: document.getElementById('dup').hidden, h: document.querySelector('#dupbar h2')?.textContent, btns: [...document.querySelectorAll('#dupbar .btn')].map(x => x.textContent), count: document.getElementById('count').textContent, list: document.querySelector('#mm-menu [aria-pressed=true]').dataset.v,
    card: document.getElementById('g-549').getBoundingClientRect().top < innerHeight, hint: document.querySelector('#dupbar .dup-x > p:last-child').textContent.replace(/\s+/g, ' ').trim(), dots: !!document.querySelector('#dupbar .dup-x .ic') }));
  check('«نعم» يعرض اللعبتين وحدهما في الشبكة مهما كانت القائمة المختارة، وفوقهما شريط المراجعة في مرمى النظر بما يُفعل',
    await ids(page) === '549,19560' && v1 && r1.top && r1.h === 'مراجعة: لعبتان بالاسم نفسه' && r1.btns.join('|') === 'أبقِهما معاً|رجوع إلى قائمتي' && !r1.count && r1.list === 'play' && r1.card && /^احذف ما لا تريده من زر/.test(r1.hint) && /أو أبقِهما معاً\.$/.test(r1.hint) && r1.dots, { r1, v1, ids: await ids(page) });
  // بطاقة كل منهما تذكر توأمها
  const twin = () => page.evaluate(() => { const t = document.querySelector('#sheet .twin'); return t ? { head: t.querySelector('.twin-t').textContent, rows: [...t.querySelectorAll('.twin-g')].map(b => [b.dataset.id, b.querySelector('b').textContent, [...b.querySelectorAll('small span')].map(s => s.textContent).join('|'), b.querySelector('.go').textContent]), no: t.querySelector('.twin-no')?.textContent || '', first: t.parentNode.firstElementChild === t, pv: t.parentNode.classList.contains('pv') } : null; });
  await page.click('#g-549 .cover'); await page.waitForSelector('#sheet[open] .twin'); await page.waitForTimeout(300);
  const t1 = await twin();
  check('في بطاقة كل منهما: «في مكتبتك لعبة أخرى بالاسم نفسه» أعلى «حالتها عندي»، وصف توأمها بسنته ومنصاته وقائمته', t1.head === 'في مكتبتك لعبة أخرى بالاسم نفسه' && t1.rows.length === 1 && t1.rows[0].join('~') === '19560~God of War~2018|PS4 · PC|في «لعبة جديدة»~افتح بطاقتها' && t1.no === 'أبقِهما معاً' && t1.first && !t1.pv, t1);
  await page.click('#sheet .twin-g'); await page.waitForFunction(() => location.hash === '#g19560'); await page.waitForTimeout(250);
  const t2 = await twin();
  check('صف التوأم يفتح بطاقته، وفيها صف الأولى بما سُجّل لها: منصتها وقائمتها وساعاتها', t2?.rows[0].join('~') === '549~God of War~2005|PS2|في «شارة النهاية»|12 ساعة~افتح بطاقتها', t2);
  // التنبيه العابر يُرى ويُلمس والبطاقة مفتوحة
  await page.click('#sheet [data-act=set][data-v=play]'); await page.waitForTimeout(250);
  const ts = await page.evaluate(() => { const t = document.getElementById('toast'), b = t.querySelector('button'), r = b.getBoundingClientRect(); return { host: t.parentNode.id, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b, s: JSON.parse(localStorage.getItem('gamesg.progress')).games[19560]?.s }; });
  await page.click('#toast button', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(250);
  check('التنبيه العابر يسكن البطاقة المفتوحة: زر «تراجع» فيه ظاهر فوقها ويعمل', ts.host === 'sheet' && ts.hit && ts.s === 'play' && await page.evaluate(() => !JSON.parse(localStorage.getItem('gamesg.progress')).games[19560]), ts);
  // حذف إحداهما ينهي المراجعة، والتراجع يعيد التنبيه
  await page.click('#sheet .rm-b'); await page.click('#sheet [data-act=rm-go]'); await page.waitForFunction(() => !document.getElementById('g-19560')); await page.waitForTimeout(450);
  const d1 = await note(page, '#dupbar'), d1x = await page.evaluate(() => ({ top: document.getElementById('dup').hidden, toast: document.getElementById('toast').textContent, host: document.getElementById('toast').parentNode.tagName }));
  check('حذف إحداهما ينهي المراجعة: الشبكة تعود إلى قائمتك، والتنبيه التالي (نسختان من لعبة واحدة، كل اسم في سطره بسنته، بلا الريميك) يُسأل عنه فوق الشبكة',
    await ids(page) === '119133' && d1 && d1.h === 'في مكتبتك نسختان من لعبة واحدة' && d1.names.join('|') === 'The Last of Us (2013)|The Last of Us Remastered (2014)' && !/وبعده/.test(d1.q) && d1x.top && /حُذفت «God of War»/.test(d1x.toast) && d1x.host === 'BODY', { d1, d1x, ids: await ids(page) });
  await page.click('#toast button'); await page.waitForFunction(() => !!document.getElementById('g-19560')); await page.waitForTimeout(300);
  const d2 = await note(page, '#dupbar');
  check('التراجع عن الحذف يعيد اللعبة والتنبيه عنهما', asked.includes('add:19560') && d2?.h === 'في مكتبتك لعبتان بالاسم نفسه' && d2.name === 'God of War (2005 و2018)' && /وبعده تنبيه آخر/.test(d2.q), d2);
  // «لا»: يُسكت ويُحفظ، مع تراجع، ولا يعود بعد التحديث
  await page.click('#dupbar [data-act=dup-no]'); await page.waitForTimeout(250);
  const no1 = { dups: await dups(page), toast: await page.textContent('#toast'), next: (await note(page, '#dupbar'))?.h };
  check('«لا» يُسكت التنبيه عنهما ويحفظه في السجل، ويقول إنه لن يظهر ثانية مع «تراجع»، ويأتي التنبيه التالي', no1.dups['549-19560'] === 1 && /لن يظهر التنبيه عنهما ثانية/.test(no1.toast) && /تراجع/.test(no1.toast) && no1.next === 'في مكتبتك نسختان من لعبة واحدة', no1);
  await page.click('#toast button'); await page.waitForTimeout(250);
  check('«تراجع» يعيد التنبيه كما كان', !(await dups(page))['549-19560'] && (await note(page, '#dupbar'))?.name === 'God of War (2005 و2018)');
  await page.click('#dupbar [data-act=dup-no]'); await page.waitForTimeout(200); await page.reload(); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(400);
  const rl = await note(page, '#dup');
  check('بعد التحديث: ما أُسكت لا يعود، والتنبيه الباقي وحده فوق القائمة الرئيسية', rl?.h === 'في مكتبتك نسختان من لعبة واحدة' && !/وبعده/.test(rl.q) && await page.evaluate(() => document.getElementById('dupbar').hidden), rl);
  await page.evaluate(() => document.querySelector('#mm-menu [data-v=all]').click()); await page.click('#g-549 .cover'); await page.waitForSelector('#sheet[open] .save'); await page.waitForTimeout(250);
  check('وما أُسكت لا يُذكر في بطاقتيهما', await page.evaluate(() => !document.querySelector('#sheet .twin')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  // مراجعة النسختين: الرجوع بلا قرار، والخروج باختيار قائمة، ثم «أبقِهما معاً»
  await page.click('#dup [data-act=dup-go]'); await inView(page);
  const e1 = await ids(page); await page.click('#dupbar [data-act=dup-back]'); await page.waitForTimeout(200);
  const e2 = { n: (await shown(page)).length, ask: (await note(page, '#dupbar'))?.btns.join('|'), top: await page.evaluate(() => document.getElementById('dup').hidden) };
  check('مراجعة النسختين تعرضهما وحدهما، و«رجوع إلى قائمتي» يعيد القائمة ويبقي السؤال فوق الشبكة بلا قرار', e1 === '1009,6036' && e2.n === 14 && e2.ask === 'نعم، اعرضهما|لا، أبقِهما' && e2.top, { e1, e2 });
  await page.click('#dupbar [data-act=dup-go]'); await page.waitForTimeout(250); await page.evaluate(() => document.querySelector('#mm-menu [data-v=done]').click()); await page.waitForTimeout(250);
  check('اختيار قائمة أثناء المراجعة يخرج منها إلى تلك القائمة', await ids(page) === '549,1020,14593,112875' && (await note(page, '#dupbar'))?.btns[0] === 'نعم، اعرضهما', await ids(page));
  await page.click('#dupbar [data-act=dup-go]'); await page.waitForTimeout(250); await page.click('#dupbar [data-act=dup-no]'); await page.waitForTimeout(300);
  const e3 = await page.evaluate(() => ({ top: document.getElementById('dup').hidden, bar: document.getElementById('dupbar').hidden, dups: JSON.parse(localStorage.getItem('gamesg.progress')).dups, n: [...document.querySelectorAll('#grid .gc')].filter(e => !e.hidden).length }));
  check('«أبقِهما معاً» في المراجعة يُسكت التنبيه وينهيها، ولا يبقى تنبيه', e3.top && e3.bar && e3.dups['1009-6036'] === 1 && e3.dups['549-19560'] === 1 && e3.n === 4, e3);
  // «أضف لعبة»: التنبيه قبل الإضافة، ولحظتها في بطاقة المضافة، وبعدها في الصفحة
  await page.click('.top [data-act=add]'); await page.waitForSelector('#add[open]'); await page.fill('#add-q', 'elden ring'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#cands .cand');
  const cd = await page.evaluate(() => [...document.querySelectorAll('#cands .cand')].map(c => ({ tw: c.querySelector('small.tw')?.textContent || '', has: c.querySelector('.cbtns small')?.textContent || '', add: !!c.querySelector('[data-act=add-pick]') })));
  check('«أضف لعبة»: مرشحة ليست في القائمة وفيها لعبة بالاسم نفسه يُنبَّه عنها قبل الإضافة (وتبقى إضافتها ممكنة)، والتي في القائمة «في قائمتك» بلا تنبيه', cd[0].tw === 'في مكتبتك لعبة بهذا الاسم (2022)' && cd[0].add && cd[1].has === 'في قائمتك' && !cd[1].tw, cd);
  await page.click('#cands .cand:first-child [data-act=add-pick]'); await page.click('#cands .pickl [data-v=new]'); await page.waitForSelector('#sheet[open] .twin'); await page.waitForTimeout(600);
  const ad = { t: await twin(), toast: await page.evaluate(() => { const t = document.getElementById('toast'), r = t.getBoundingClientRect(); return { text: t.textContent, host: t.parentNode.id, on: getComputedStyle(t).opacity === '1' && r.width > 100, low: Math.abs(innerHeight - r.bottom - 18) < 2 }; }), title: await page.textContent('#sheet h2') };
  check('لحظة الإضافة: بطاقة المضافة تُفتح وفي أعلاها توأمها بما سُجّل له، و«أُضيفت…» ظاهر فوق البطاقة لا تحتها',
    ad.title === 'Elden Ring' && ad.t?.head === 'في مكتبتك لعبة أخرى بالاسم نفسه' && ad.t.rows[0].join('~') === '119133~Elden Ring~2022|PC|في «متابعة»|80 ساعة~افتح بطاقتها' && /أُضيفت «Elden Ring»/.test(ad.toast.text) && ad.toast.host === 'sheet' && ad.toast.on && ad.toast.low, ad);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const ad2 = await note(page, '#dupbar');
  check('وبعد إغلاقها: التنبيه عن المضافة وتوأمها في الصفحة', ad2?.h === 'في مكتبتك لعبتان بالاسم نفسه' && ad2.name === 'Elden Ring (2022 و2025)', ad2);
  // إسكات ثم حذف ثم إضافة من جديد: المكرر جديد فيُنبَّه عنه، والمضافة تبقى بعد التحديث
  await page.click('#dupbar [data-act=dup-no]'); await page.waitForTimeout(200); const k1 = (await dups(page))['119133-555123'];
  await page.evaluate(() => document.querySelector('#mm-menu [data-v=all]').click()); await page.click('#g-555123 .qm-b'); await page.click('#qm [data-act=qm-rm]'); await page.click('#qm [data-act=rm-go]'); await page.waitForFunction(() => !document.getElementById('g-555123')); await page.waitForTimeout(300);
  await page.click('.top [data-act=add]'); await page.waitForSelector('#add[open]'); await page.fill('#add-q', 'elden ring'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#cands .cand [data-act=add-pick]');
  await page.click('#cands .cand:first-child [data-act=add-pick]'); await page.click('#cands .pickl [data-v=new]'); await page.waitForSelector('#sheet[open] .twin'); await page.waitForTimeout(300);
  const rn = { k1, dups: await dups(page), rm: await page.evaluate(() => localStorage.getItem('gamesg.removed')), adds: asked.filter(a => a === 'add:555123').length };
  await page.keyboard.press('Escape'); await page.waitForTimeout(350); await page.reload(); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(400);
  const rn2 = { card: await page.evaluate(() => !!document.getElementById('g-555123')), n: await note(page, '#dup') };
  check('لعبة أُسكت تنبيهها ثم حُذفت ثم أُضيفت من جديد: الإسكات القديم لا يسري عليها فيعود التنبيه، وتبقى ظاهرة بعد التحديث (لا يخفيها حذفها السابق)',
    rn.k1 === 1 && !rn.dups['119133-555123'] && rn.dups['549-19560'] === 1 && rn.adds === 2 && !/555123/.test(rn.rm || '') && rn2.card && rn2.n?.name === 'Elden Ring (2022 و2025)', { rn, rn2 });
  // بطاقة الاطلاع وصندوق الأسئلة: ما في المكتبة بهذا الاسم يُذكر قبل الإضافة
  await page.goto(`${base}/games/#g112875`); await page.waitForSelector('#sheet[open] .order:not([hidden])'); await page.click('#sheet .order[data-ov=release] li:nth-child(2) .go'); await page.waitForSelector('#sheet .save.pv');
  const pv = await twin();
  check('بطاقة الاطلاع للعبة ليست في القائمة: «في مكتبتك لعبتان بهذا الاسم» بصفّيهما، وبلا زر إسكات', pv?.pv && pv.head === 'في مكتبتك لعبتان بهذا الاسم' && pv.rows.map(r => r[0]).join() === '549,19560' && !pv.no && pv.first, pv);
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  await page.evaluate(() => localStorage.setItem('gamesg.steam', '76561198000000001')); await page.click('.top [data-act=accounts]'); await page.waitForSelector('#acc[open] [data-act=pull][data-src=steam]'); await page.click('#acc [data-act=pull][data-src=steam]'); await page.waitForSelector('#inbox[open] .ib-card.top');
  const ibh = await page.evaluate(() => ({ t: document.querySelector('.ib-card.top h3').textContent, tw: document.querySelector('.ib-card.top .hints .tw')?.textContent || '' }));
  check('صندوق الأسئلة: لعبة مسحوبة وفي المكتبة لعبة باسمها تُعلَّم بذلك قبل أن تُضاف', ibh.t === 'Minecraft' && ibh.tw === 'في مكتبتك لعبة بهذا الاسم (2011)', ibh);
  await page.click('#inbox [data-act=ib-close]'); await page.waitForTimeout(200);
  check('duplicates: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close();
  // الجوال: التنبيه داخل الشاشة وأزراره بحجم اللمس، والمراجعة تظهر تحت الشريط الثابت
  const m = await open(369, 905, true); await routes(m.page);
  await m.page.goto(`${base}/games/`); await m.page.waitForSelector('#grid .gc:not([hidden])'); await m.page.waitForTimeout(400);
  const mb = await m.page.evaluate(() => { const d = document.querySelector('#dup .dup').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, fits: d.left >= 0 && d.right <= innerWidth, top: d.top < innerHeight, tap: [...document.querySelectorAll('#dup .btn')].every(b => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 90), over: document.querySelector('#dup .dup').scrollWidth <= document.querySelector('#dup .dup').clientWidth + 1 }; });
  check('الجوال: التنبيه داخل الشاشة بلا تمدد أفقي، ظاهر عند الفتح، وزراه بحجم اللمس', mb.sw <= mb.iw && mb.fits && mb.top && mb.tap && mb.over, mb);
  await m.page.tap('#dup [data-act=dup-go]'); const mv = await inView(m.page);
  const mr = await m.page.evaluate(() => { const bar = document.querySelector('.bar').getBoundingClientRect(), d = document.getElementById('dupbar').getBoundingClientRect(), c = document.getElementById('g-549').getBoundingClientRect(); return { under: d.top >= bar.bottom - 1, card: c.top < innerHeight, n: [...document.querySelectorAll('#grid .gc')].filter(e => !e.hidden).length, sw: document.documentElement.scrollWidth <= innerWidth, tap: [...document.querySelectorAll('#dupbar .btn')].every(b => b.getBoundingClientRect().height >= 44) }; });
  check('الجوال: «نعم» ينزل إلى شريط المراجعة تحت الشريط الثابت لا خلفه، واللعبتان ظاهرتان تحته', mv && mr.under && mr.card && mr.n === 2 && mr.sw && mr.tap, { mr, mv });
  await m.page.tap('#g-549 .cover'); await m.page.waitForSelector('#sheet[open] .twin'); await m.page.waitForTimeout(350);
  const ms = await m.page.evaluate(() => { const t = document.querySelector('#sheet .twin'), r = t.getBoundingClientRect(), b = document.getElementById('sheet-body'); return { seen: r.top < innerHeight, fits: r.left >= 0 && r.right <= innerWidth && b.scrollWidth <= b.clientWidth + 1, tap: t.querySelector('.twin-g').getBoundingClientRect().height >= 44 && t.querySelector('.twin-no').getBoundingClientRect().height >= 40 }; });
  check('الجوال: توأمها ظاهر في بطاقتها عند فتحها بلا تمرير ولا تمدد، وأزراره بحجم اللمس', ms.seen && ms.fits && ms.tap, ms);
  check('duplicates (cover): بلا أخطاء برمجية', !m.errs.length, m.errs);
  await m.ctx.close(); }

// ---------- تقليل الحركة
{ console.log('== reduced-motion');
  const { ctx, page, errs } = await open(1280, 860, false, { reducedMotion: 'reduce' });
  await page.goto(`${base}/games/`); await page.waitForSelector('#grid .gc:not([hidden])'); await page.waitForTimeout(500);
  check('تقليل الحركة: مؤشر القائمة والعدّ والبوابة الصغيرة ساكنة', await page.evaluate(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)));
  check('reduced-motion: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص ألعابي نجحت'); process.exit(fails.length ? 1 : 0);
