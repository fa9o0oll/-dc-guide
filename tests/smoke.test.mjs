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
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ar-SA' }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|404|401/.test(m.text()) && errs.push(m.text()));
  await page.route(/image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="#345"/></svg>' }));
  const tap = async sel => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(550); return mobile ? l.tap() : l.click(); };
  const fits = async label => { await page.waitForTimeout(500); const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      small: [...document.querySelectorAll('button,a[href],summary,select,input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0 && (r.width < 40 || r.height < 40) && !e.closest('.foot,.hub-foot,.canon,.why,.note,[hidden]'); }).map(e => e.className || e.tagName).slice(0, 3) }));
    check(`${label}: بلا تمدد أفقي`, o.sw <= o.iw, `${o.sw}/${o.iw}`); if (mobile) check(`${label}: أهداف اللمس 40px فأكثر`, o.small.length === 0, o.small.join(' ')); };
  // الواجهة الرئيسية
  await page.goto(base + '/'); await page.waitForSelector('.door');
  check('الواجهة: ثلاثة أبواب بروابطها', await page.locator('a.door').count() === 3 && await page.getAttribute('.door.dc', 'href') === 'dc/' && (await page.getAttribute('.door.fate', 'href')) === 'fate/' && (await page.getAttribute('.door.films', 'href')) === 'films/');
  await page.waitForFunction(() => /\d/.test(document.querySelector('.door.dc [data-stat]').textContent)); check('الواجهة: عدد أعمال كل دليل ظاهر', /196/.test(await page.textContent('.door.dc [data-stat]')));
  await fits('الواجهة');
  // دليل Fate
  await page.goto(base + '/fate/'); await page.waitForSelector('.card'); await page.evaluate(() => { try { localStorage.removeItem('fateg.progress'); } catch {} }); await page.reload(); await page.waitForSelector('.card');
  check(`Fate: ${P.length} بطاقة في ${U.length} خطوط`, await page.locator('.card').count() === P.length && await page.locator('section.uni').count() === U.length);
  check('Fate: سجل منفصل عن دي سي والعودة للواجهة موجودة', await page.getAttribute('.top .home', 'href') === '../' && await page.title() === 'دليل عالم Fate');
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
  const FL = JSON.parse(fs.readFileSync(path.join(siteDir, 'films/data/films.json'))).films, inCol = FL.find(f => f.col && f.kind === 'movie' && f.prov);
  await page.route('**/api/add-film', async r => { const b = r.request().postDataJSON();
    if (b.password !== 'pw') return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"password"}' });
    if (b.action === 'search') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ parsed: { title: 'Test Film', year: 1999 }, sure: true, candidates: [{ tmdb: 999001, kind: 'movie', title: 'Test Film', year: 1999, poster: null, collection: 'Test Saga' }] }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ state: 'added', providers: {}, collection: { id: 999, name: 'Test Saga', parts: [{ tmdb: 999001, title: 'Test Film', year: 1999 }, { tmdb: 999002, title: 'Test Film 2', year: 2003 }] },
      film: { id: 'm999001', tmdb: 999001, kind: 'movie', title: 'Test Film', year: 1999, date: '1999-01-01', genres: [18], rating: 7.1, votes: 10, poster: null, col: 999, prov: null, src: 'added', overviewEn: 'A test.', directors: ['Someone'] } }) }); });
  await page.goto(base + '/films/'); await page.waitForSelector('.tk'); await page.evaluate(() => { try { ['filmsg.progress', 'filmsg.pending', 'filmsg.pass'].forEach(k => localStorage.removeItem(k)); } catch {} }); await page.reload(); await page.waitForSelector('.tk');
  check(`الأفلام: ${FL.length} تذكرة والعنوان صحيح`, await page.locator('.tk').count() === FL.length && await page.title() === 'قائمة أفلامي' && await page.getAttribute('.top .home', 'href') === '../');
  await fits('الأفلام: الشبكة');
  await page.fill('#q', inCol.title.toLowerCase()); await page.waitForTimeout(350);
  const vis = await page.locator('.tk:not([hidden])').count(); check('الأفلام: البحث يصفّي ويعرض العدد', vis >= 1 && vis < FL.length && (await page.textContent('#count')).includes(String(vis)));
  await tap(`#f-${inCol.id} .seen`); check('الأفلام: «شاهدته» يُحفظ ويُختم', await page.evaluate(id => JSON.parse(localStorage.getItem('filmsg.progress')).films[id] === 'watched' && document.getElementById('f-' + id).classList.contains('watched'), inCol.id));
  await tap(`#f-${inCol.id} .poster`); await page.waitForSelector('#sheet[open] .sh-head'); await page.waitForTimeout(350);
  check('الأفلام: النافذة فيها أين يُعرض وترتيب السلسلة والروابط', await page.evaluate(([t, imdb]) => { const h = [...document.querySelectorAll('#sheet .links a')].map(a => a.href), o = document.querySelectorAll('#sheet .order li');
    return o.length >= 2 && document.querySelectorAll('#sheet .order li.here').length === 1 && h.includes(`https://letterboxd.com/tmdb/${t}`) && h.includes(`https://www.imdb.com/title/${imdb}/`) && h.some(x => /whattawatch/.test(x)) && document.querySelectorAll('#sheet .wgroup').length >= 1; }, [inCol.tmdb, inCol.imdb]));
  check('الأفلام: رابط الفيلم في العنوان', (await page.evaluate(() => location.hash)) === '#' + inCol.id);
  await fits('الأفلام: النافذة'); await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  await tap('[data-act=reset]'); await tap('[data-v=series]'); await page.waitForSelector('.fr'); check('الأفلام: عرض السلاسل مرقّم', await page.locator('.fr').count() > 20 && (await page.textContent('.fr .part .n')).trim() === '1'); await fits('الأفلام: السلاسل');
  await tap('[data-v=grid]'); await tap('[data-act=add]'); await page.waitForSelector('#add[open]'); await page.fill('#add-q', 'test film 1999'); await page.fill('#add-pass', 'bad'); await tap('#add-form [type=submit]'); await page.waitForTimeout(300);
  check('الأفلام: كلمة سر خاطئة تُرفض برسالة', (await page.textContent('#add-msg')).includes('كلمة السر'));
  await page.fill('#add-pass', 'pw'); await tap('#add-form [type=submit]'); await page.waitForSelector('.cand'); check('الأفلام: الإضافة تعرض المرشح وسلسلته قبل الحفظ', (await page.textContent('.cand')).includes('Test Saga'));
  await fits('الأفلام: نافذة الإضافة'); await tap('.cand [data-act=add-pick]'); await page.waitForSelector('#f-m999001');
  check('الأفلام: المضاف يظهر فوراً بعلامة «جديد»', (await page.textContent('#f-m999001 .tag')).includes('جديد') && await page.locator('.tk').count() === FL.length + 1);
  await page.reload(); await page.waitForSelector('.tk'); check('الأفلام: المضاف يبقى بعد التحديث وكلمة السر لا تُطلب ثانية', await page.locator('#f-m999001').count() === 1 && await page.evaluate(() => localStorage.getItem('filmsg.pass') === 'pw'));
  await tap('#f-m999001 .poster'); await page.waitForSelector('#sheet[open] .order'); check('الأفلام: نافذة المضاف تعرض سلسلته وتنبيه عدم المراجعة', await page.locator('#sheet .order li').count() === 2 && (await page.textContent('#sheet-body')).includes('لم تُراجَع يدوياً'));
  await tap('#sheet .close'); await page.waitForSelector('#sheet', { state: 'hidden' });
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${[...new Set(fails)].join(' ؛ ')}` : '\n✅ كل الفحوص نجحت');
process.exit(fails.length ? 1 : 0);
