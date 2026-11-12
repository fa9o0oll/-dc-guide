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
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|404/.test(m.text()) && errs.push(m.text()));
  await page.route(/image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="#345"/></svg>' }));
  const tap = async sel => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(550); return mobile ? l.tap() : l.click(); };
  const fits = async label => { await page.waitForTimeout(500); const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      small: [...document.querySelectorAll('button,a[href],summary,select,input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0 && (r.width < 40 || r.height < 40) && !e.closest('.foot,.hub-foot,.canon,.why,[hidden]'); }).map(e => e.className || e.tagName).slice(0, 3) }));
    check(`${label}: بلا تمدد أفقي`, o.sw <= o.iw, `${o.sw}/${o.iw}`); if (mobile) check(`${label}: أهداف اللمس 40px فأكثر`, o.small.length === 0, o.small.join(' ')); };
  // الواجهة الرئيسية
  await page.goto(base + '/'); await page.waitForSelector('.door');
  check('الواجهة: ثلاثة أبواب، وروابط دي سي وFate صحيحة', await page.locator('.door').count() === 3 && await page.getAttribute('.door.dc', 'href') === 'dc/' && (await page.getAttribute('.door.fate', 'href')) === 'fate/');
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
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${[...new Set(fails)].join(' ؛ ')}` : '\n✅ كل الفحوص نجحت');
process.exit(fails.length ? 1 : 0);
