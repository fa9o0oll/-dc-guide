// اختبار الواجهة في متصفح حقيقي على مقاسين: كمبيوتر (ماوس) وجوال (لمس).
// التشغيل: node tests/ui.test.mjs [مجلد اللقطات]   — يفشل بخروج 1 عند أي خلل.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // يُحل من التثبيت العام عبر NODE_PATH
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname), shots = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((q, r) => { const f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const ph = (w, h, t) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#22304a"/><text x="50%" y="50%" fill="#7f93b5" font-size="${Math.round(w / 9)}" text-anchor="middle">${t}</text></svg>`;
const fails = []; const check = (name, ok, extra = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };
const legacy = Buffer.from(JSON.stringify({ trackerState: { w_2: 'watched', w_6: 'watching', w_21: 'watched', w_30: 'watched', w_45: 'watchlist' }, epState: {} })).toString('base64');

const browser = await chromium.launch();
for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  console.log(`\n== ${name} ${viewport.width}×${viewport.height}`);
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: shots ? 2 : 1, locale: 'ar-SA' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.route(/image\.tmdb\.org/, r => { const s = r.request().url(); const wide = /w300|w780\/.*|w1280/.test(s) && !/w780\/[^/]+$/.test(s) ? 1 : /w300|w1280/.test(s); return r.fulfill({ contentType: 'image/svg+xml', body: wide ? ph(640, 360, 'صورة') : ph(342, 513, 'بوستر') }); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const tap = sel => mobile ? page.locator(sel).first().tap() : page.locator(sel).first().click();
  const snap = async n => { if (shots) await page.screenshot({ path: `${shots}/${name}-${n}.png` }); };
  const overflow = async label => { await page.waitForTimeout(350); const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      out: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.unibar,.seasons,[hidden]'); }).length }));
    check(`${label}: بلا تمدد أفقي`, o.sw <= o.iw && o.out === 0, `عرض الصفحة ${o.sw}/${o.iw}، عناصر خارجة ${o.out}`);
    const spill = await page.evaluate(() => [...document.querySelectorAll('.card,.step,.row,.node,.ep,.uni-head,.rates a,.status button,.chip,.top button,.unibar button')].filter(e => e.getBoundingClientRect().width > 0 && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2)).map(e => e.className + ':' + e.textContent.trim().slice(0, 18)));
    check(`${label}: لا محتوى يخرج من إطاره`, spill.length === 0, spill.slice(0, 4).join(' | '));
    const lap = await page.evaluate(() => { const b = [...document.querySelectorAll('.card,.step,.node,.ep')].map(e => e.getBoundingClientRect()).filter(r => r.width); let n = 0; for (let i = 1; i < b.length; i++) if (b[i].top < b[i - 1].bottom - 1 && b[i].left < b[i - 1].right - 1 && b[i].right > b[i - 1].left + 1 && b[i].top >= b[i - 1].top + 1) n++; return n; });
    check(`${label}: لا عناصر متراكبة`, lap === 0, String(lap)); };

  await page.goto(url); await page.waitForSelector('.card');
  check('تحميل البطاقات: 185 بطاقة في 19 عالماً', await page.locator('.card').count() === 185 && await page.locator('section.uni').count() === 19);
  await overflow('البطاقات'); await snap('1-cards');
  const small = await page.evaluate(() => [...document.querySelectorAll('button,a,select,input,summary')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.width < 40) && !e.closest('.foot,.canon,[hidden]'); }).map(e => (e.textContent || e.id).trim().slice(0, 20)));
  check('أهداف اللمس ≥ 40px', small.length === 0, small.slice(0, 5).join(' | '));
  check('عمل في عالمين له سجل واحد', await page.evaluate(() => document.querySelectorAll('[data-k="the-suicide-squad-2021"]').length === 2));
  check('عمل قادم بعدّاد تنازلي', await page.locator('#c-anim_mv_st-batman-knightfall-part-2-2026 .count b').count() === 1);
  // حالة المشاهدة تنعكس في العالمين
  await tap('#c-dcu-the-suicide-squad-2021 [data-s=watched]');
  check('«شاهدته» تنعكس على نفس العمل في العالم الآخر', await page.getAttribute('#c-dceu-the-suicide-squad-2021 [data-s=watched]', 'aria-pressed') === 'true');
  // نافذة فيلم
  await tap('#c-nolan-the-dark-knight-2008 [data-act=open]'); await page.waitForSelector('#sheet:not([hidden])');
  check('نافذة الفيلم: نبذة عربية وروابط دقيقة', await page.locator('#sheet .ov').count() === 1 && (await page.getAttribute('#sheet .rates a[href*="imdb.com/title/tt0468569"]', 'href')) !== null && await page.locator('#sheet .rates a[href*="rottentomatoes.com/m/"]').count() === 1);
  await overflow('نافذة الفيلم'); await snap('2-film');
  await tap('#sheet [data-act=light]'); await page.waitForSelector('#lightbox:not([hidden])');
  await page.goBack(); check('الرجوع يغلق البوستر المكبّر فقط', await page.isHidden('#lightbox') && await page.isVisible('#sheet'));
  await page.goBack(); check('الرجوع يغلق النافذة', await page.isHidden('#sheet'));
  // نافذة مسلسل + حلقات
  await tap('#c-dcu-peacemaker-2022-s2 [data-act=open]'); await page.waitForSelector('.ep');
  check('نافذة المسلسل تفتح على الموسم الصحيح', (await page.textContent('#seasonTabs .on')).includes('2') && await page.locator('.ep').count() === 8);
  check('درع الحرق يموّه ملخصات غير المشاهَد', await page.locator('.ep .ov.blur').count() > 0);
  await tap('.ep [data-act=ep]'); check('تعليم حلقة', await page.locator('.ep.done').count() === 1);
  await overflow('نافذة المسلسل'); await snap('3-series');
  await tap('#sheet [data-act=close]'); await page.waitForSelector('#sheet', { state: 'hidden' });
  check('تقدم الحلقات يظهر على البطاقة', (await page.textContent('#c-dcu-peacemaker-2022-s2')).includes('الحلقات: 1 من 8'));
  // البطاقة ← الخط الزمني ← البطاقة
  await tap('#c-dceu-man-of-steel-2013 [data-act=goto]'); await page.waitForSelector('#t-dceu-man-of-steel-2013');
  check('الانتقال من البطاقة إلى موقعها في الخط الزمني', await page.evaluate(() => { const r = document.querySelector('#t-dceu-man-of-steel-2013').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await overflow('الخط الزمني'); await snap('4-timeline');
  await tap('#t-dceu-man-of-steel-2013 [data-act=goto]'); await page.waitForSelector('#c-dceu-man-of-steel-2013');
  check('العودة من الخط الزمني إلى البطاقة', await page.evaluate(() => { const r = document.querySelector('#c-dceu-man-of-steel-2013').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  // آروفيرس
  await tap('.views [data-view=arrow]'); await page.waitForSelector('.step');
  check('ترتيب آروفيرس: 23 خطوة و6 تقاطعات', await page.locator('.step').count() === 23 && await page.locator('.step.cross').count() === 6);
  await tap('#av-2014-a [data-act=avblock]'); check('تعليم مجموعة حلقات', (await page.textContent('#av-2014-a .row')).includes('شاهدت 7'));
  await overflow('آروفيرس'); await page.locator('#av-2014-a').scrollIntoViewIfNeeded(); await snap('5-arrowverse');
  await page.locator('#av-2019-x').scrollIntoViewIfNeeded(); await snap('6-crossover');
  // الفهرس والبحث
  await tap('[data-act=jump]'); await page.fill('#jq', 'penguin'); await tap('#jres [data-act=goto]'); await page.waitForSelector('#c-reeves-the-penguin-2024');
  check('الفهرس يوصل للعمل مباشرة', await page.evaluate(() => { const r = document.querySelector('#c-reeves-the-penguin-2024').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  await overflow('عالم واحد'); await snap('7-universe');
  // استيراد سجل النسخة القديمة
  await tap('[data-act=backup]'); await page.fill('#bk', legacy); await tap('[data-act=bkimport]');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dcg.progress')).works);
  check('استيراد سجل النسخة القديمة', st['peacemaker-2022#1'] === 'watched' && st['peacemaker-2022#2'] === 'watching' && st['the-dark-knight-2008'] === 'watched' && st['the-flash-2014'] === 'list');
  await page.reload(); await page.waitForSelector('.card');
  check('السجل محفوظ بعد إعادة التحميل', await page.getAttribute('#c-nolan-the-dark-knight-2008 [data-s=watched]', 'aria-pressed') === 'true');
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' ؛ ')}` : '\n✅ كل الفحوص نجحت على المقاسين');
process.exit(fails.length ? 1 : 0);
