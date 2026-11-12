// قياس السلاسة على مقاسات Galaxy Z Fold6 مع إبطاء المعالج 4× (محاكاة جوال).
// يقيس الخيط الرئيسي فقط: زمن الإطارات عند فتح البطاقة وإغلاقها، تغيير الحالة، والتمرير. كلفة كرت الشاشة لا تُقاس هنا.
// التشغيل: node tests/perf.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((q, r) => { const f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const url = `http://127.0.0.1:${server.address().port}/dc/`;
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#2a3550"/></svg>`;
// عرض الشاشتين محسوب من الدقة الرسمية (968×2376 و1856×2160) على كثافة 2.625
const SCREENS = [['الخارجية', 369, 905], ['الداخلية', 707, 823]];
const browser = await chromium.launch();
for (const [name, width, height] of SCREENS) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625, locale: 'ar-SA' });
  const page = await ctx.newPage(); const req = {};
  await page.route(/image\.tmdb\.org/, r => { const m = /\/t\/p\/(\w+)\//.exec(r.request().url()); req[m[1]] = (req[m[1]] || 0) + 1;
    return r.fulfill({ contentType: 'image/svg+xml', body: /w300|w780|w1280/.test(m[1]) ? svg(640, 360) : svg(342, 513) }); });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(url); await page.waitForSelector('.card'); await page.waitForTimeout(1500);
  const boot = { ...req };
  // يسجّل فواصل الإطارات والمهام الطويلة أثناء تنفيذ فعل
  const during = async (ms, act) => { await page.evaluate(() => { const w = window; w.__f = []; w.__lt = 0; let last = performance.now(); w.__run = true;
      const tick = t => { w.__f.push(t - last); last = t; if (w.__run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      w.__po?.disconnect(); w.__po = new PerformanceObserver(l => { for (const e of l.getEntries()) w.__lt = Math.max(w.__lt, e.duration); }); w.__po.observe({ entryTypes: ['longtask'] }); });
    await page.waitForTimeout(120); await act(); await page.waitForTimeout(ms);
    return page.evaluate(() => { window.__run = false; const f = window.__f.slice(2); return { worst: Math.round(Math.max(...f)), slow: f.filter(x => x > 34).length, frames: f.length, longTask: Math.round(window.__lt) }; }); };
  const fmt = (label, m) => console.log(`  ${label}: أسوأ إطار ${m.worst}ms · إطارات أبطأ من 34ms: ${m.slow}/${m.frames} · أطول مهمة ${m.longTask}ms`);
  console.log(`\n== الشاشة ${name} ${width}×${height}`);
  console.log('  صور طُلبت عند التحميل:', JSON.stringify(boot), '· عناصر الصفحة:', await page.evaluate(() => document.querySelectorAll('*').length));
  await page.evaluate(() => document.querySelector('#c-dcu-superman-2025').scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
  fmt('فتح بطاقة فيلم', await during(900, () => page.tap('#c-dcu-superman-2025 .poster')));
  fmt('إغلاقها', await during(700, () => page.tap('#sheet .close')));
  fmt('فتح بطاقة مسلسل', await during(1200, () => page.tap('#c-dcu-peacemaker-2022-s2 .poster')));
  fmt('تعليم حلقة ثم إغلاق', await during(900, async () => { await page.waitForSelector('.ep:not(.skel)'); await page.tap('.ep [data-act=ep]'); await page.tap('#sheet .close'); }));
  fmt('زر «شاهدته» على بطاقة', await during(700, () => page.tap('#c-dcu-superman-2025 [data-s=watched]')));
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  fmt('تمرير 14000px', await during(300, () => cdp.send('Input.synthesizeScrollGesture', { x: width / 2, y: height / 2, yDistance: -14000, speed: 3500, gestureSourceType: 'touch' })));
  await ctx.close();
}
await browser.close(); server.close();
