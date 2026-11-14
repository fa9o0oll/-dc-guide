// يفحص البوسترات في البوابات (site/zoom.js): ميلانها مع الجوال، والقرص بإصبعين لفتحها وتكبيرها، والتنقل في المكبَّر،
// والنقر مرتين، والعجلة والسحب بالفأرة، والإغلاق بالقرص للداخل وبـEsc والرجوع.
// اللمس والميلان يمرّان بمسار المتصفح الحقيقي (CDP): لمسات حقيقية تمر بـtouch-action وكشف الإيماءات والتمرير الأصلي،
// وقراءات ميلان تصل حدثَ deviceorientation كما يرسله الجوال. فما ينجح هنا يتصرف كذلك على جهاز Chromium حقيقي.
// node tests/zoom.test.mjs   (يحتاج playwright عبر NODE_PATH)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((q, r) => { let f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;   // 127.0.0.1 سياق آمن، وحدث الميلان لا يصل إلا في سياق آمن
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 300)}`); if (!ok) fails.push(n); };
const ph = '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2533b"/><stop offset="1" stop-color="#2b3f8f"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>';
const helpers = () => { window.__zs = () => { const t = getComputedStyle(document.querySelector('.pz-zoom')).transform; if (t === 'none') return 1; const m = t.match(/matrix\(([^)]+)\)/); return m ? +m[1].split(',')[0] : 1; }; };
const sensors = ['accelerometer', 'gyroscope', 'magnetometer'];
const browser = await chromium.launch();

async function session(name, width, height, mobile, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ar-SA', permissions: mobile ? sensors : [], ...extra }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|404|401|Failed to load/.test(m.text()) && errs.push(m.text()));
  await page.route(/image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: ph }));
  await page.addInitScript(helpers);
  const cdp = mobile ? await ctx.newCDPSession(page) : null, pause = ms => page.waitForTimeout(ms);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 6, radiusY: 6, force: 1 })) });
  // ميلان الجوال يميناً بمقدار g درجة، أياً كان اتجاه الشاشة (عمودي: gamma، أفقي: beta)
  const tilt = async (g, beta = 40) => { const a = await page.evaluate(() => screen.orientation?.angle || 0);
    await cdp.send('DeviceOrientation.setDeviceOrientationOverride', a === 90 ? { alpha: 0, beta: g, gamma: -beta } : a === 270 ? { alpha: 0, beta: -g, gamma: beta } : { alpha: 0, beta, gamma: g }); };
  const sweep = async (from, to) => { const s = Math.sign(to - from) * 2; for (let g = from; s > 0 ? g <= to : g >= to; g += s) { await tilt(g); await pause(30); } };
  // قرص: الإصبعان يبدآن على بُعد d0 من النقطة ويصلان d1، والمنتصف ينزاح drift بكسل كما تفعل اليد
  const pinch = async (x, y, d0, d1, { n = 10, drift = 0, lift = true } = {}) => {
    await touch('touchStart', [[x - d0, y]]); await pause(16); await touch('touchStart', [[x - d0, y], [x + d0, y]]); await pause(16);
    for (let i = 1; i <= n; i++) { const d = d0 + (d1 - d0) * i / n, dy = drift * i / n; await touch('touchMove', [[x - d, y + dy], [x + d, y + dy]]); await pause(16); }
    if (lift) await touch('touchEnd', []); };
  const tapAt = async (x, y) => { await touch('touchStart', [[x, y]]); await pause(40); await touch('touchEnd', []); };
  const swipe = async (x, y, dx, dy, n = 8) => { await touch('touchStart', [[x, y]]); for (let i = 1; i <= n; i++) { await touch('touchMove', [[x + dx * i / n, y + dy * i / n]]); await pause(16); } await touch('touchEnd', []); };
  return { ctx, page, errs, pause, touch, tilt, sweep, pinch, tapAt, swipe,
    open: () => page.waitForSelector('dialog.pz[open]'), shut: () => page.waitForSelector('dialog.pz', { state: 'hidden' }),
    // مركز أول بوستر يظهر كاملاً في الشاشة
    target: async sel => { const box = () => page.evaluate(sel => { const b = [...document.querySelectorAll(sel)].find(e => { const q = e.getBoundingClientRect(); return q.width && q.top > 70 && q.bottom < innerHeight - 30; });
      if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width }; }, sel);
      let r = await box(); if (!r) { await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), sel); await pause(400); r = await box(); } return r; } };
}

const only = process.env.ONLY; // ONLY=desktop أو ONLY=fold-cover … لتشغيل جزء واحد
for (const [name, width, height] of [['fold-cover', 369, 905], ['fold-main-landscape', 823, 707]].filter(([n]) => !only || only === n)) {
  console.log('== ' + name);
  const { ctx, page, errs, pause, touch, sweep, pinch, tapAt, swipe, open, shut, target } = await session(name, width, height, true);
  const c = () => ({ x: width / 2, y: height / 2 });
  // ---------- الأفلام ----------
  await page.goto(base + '/films/'); await page.waitForSelector('.tk .poster img'); await pause(500);
  // ميلان الجوال: البوسترات الظاهرة تميل وتلمع، والبعيدة لا تُلمس
  await sweep(0, 12); await pause(400);
  const t1 = await page.evaluate(() => { const p = [...document.querySelectorAll('.tk .poster.pz-t')], a = p.find(e => e.getBoundingClientRect().top < innerHeight);
    return { n: p.length, x: a ? +a.style.getPropertyValue('--pz-x') : 0, tr: a ? getComputedStyle(a.querySelector('img')).transform : 'none', all: document.querySelectorAll('.tk .poster').length }; });
  check('الأفلام: ميلان الجوال يميناً يميل البوسترات الظاهرة، والبعيدة لا', t1.n >= 2 && t1.x > .2 && t1.tr !== 'none' && t1.n < t1.all, t1);
  await sweep(12, -10); await pause(400);
  check('الأفلام: والميلان يساراً يعكس الاتجاه', await page.evaluate(() => +document.querySelector('.tk .poster.pz-t').style.getPropertyValue('--pz-x') < -.1));
  // القرص بإصبعين على تذكرة (ومنتصفهما ينزاح لأعلى كما تفعل اليد): لا تتمرر الصفحة، ونسخة تكبر بين الإصبعين
  const r = await target('.tk .poster[data-zoom-pinch]'), y0 = await page.evaluate(() => scrollY);
  await pinch(r.x, r.y, 10, 130, { n: 14, drift: -60, lift: false });
  const mid = await page.evaluate(() => { const g = document.querySelector('.pz-ghost'), v = document.querySelector('.pz-veil'); return { ghost: !!g, w: g?.getBoundingClientRect().width, veil: v ? +getComputedStyle(v).opacity : 0, y: scrollY, zoom: visualViewport.scale }; });
  check('الأفلام: القرص على التذكرة يكبّر نسخة منها بين الإصبعين ويعتم ما خلفها، والصفحة ثابتة', mid.ghost && mid.w > r.w * 3 && mid.veil > .9 && mid.y === y0 && mid.zoom === 1, { mid, y0, w: r.w });
  await touch('touchEnd', []); await open(); await pause(900);
  const o1 = await page.evaluate(() => ({ s: __zs(), ghost: !!document.querySelector('.pz-ghost,.pz-veil'), sheet: document.querySelector('#sheet').open, zoomed: document.querySelector('dialog.pz').classList.contains('pz-zoomed') }));
  check('الأفلام: رفع الإصبعين يفتح المكبَّر مكبَّراً حيث تركاه، والنسخة تختفي وبطاقة الفيلم لا تُفتح', o1.s > 1.4 && !o1.ghost && !o1.sheet && o1.zoomed, o1);
  // إصبع واحد يتنقل في المكبَّر، والنقر مرتين يعيده إلى مقاسه ثم يكبّره عند موضع النقر
  const tx0 = await page.evaluate(() => getComputedStyle(document.querySelector('.pz-zoom')).transform);
  await swipe(c().x, c().y, 90, 60); await pause(450);
  check('الأفلام: إصبع واحد يتنقل في المكبَّر ولا يغلقه', await page.evaluate(t => getComputedStyle(document.querySelector('.pz-zoom')).transform !== t && document.querySelector('dialog.pz').open, tx0));
  await tapAt(c().x, c().y); await pause(90); await tapAt(c().x, c().y); await pause(600);
  check('الأفلام: النقر مرتين يعيد المكبَّر إلى مقاسه (مرة واحدة، لا يتكرر مع dblclick)', await page.evaluate(() => Math.abs(__zs() - 1) < .005 && !document.querySelector('dialog.pz').classList.contains('pz-zoomed')));
  await tapAt(c().x, c().y); await pause(90); await tapAt(c().x, c().y); await pause(600);
  const z25 = await page.evaluate(() => __zs());
  check('الأفلام: والنقر مرتين مرة أخرى يكبّره ضعفين ونصفاً', Math.abs(z25 - 2.5) < .01, z25);
  await tapAt(c().x, c().y); await pause(90); await tapAt(c().x, c().y); await pause(600);
  // الميلان في المكبَّر: البوستر يميل ويلمع والإضاءة خلفه تنزاح
  await sweep(0, 14); await pause(400);
  const gy = await page.evaluate(() => { const k = document.querySelector('.pz-card'), a = document.querySelector('.pz-amb'); return { t: k.style.transform, sheen: +getComputedStyle(document.querySelector('.pz-sheen')).opacity, amb: a.style.translate }; });
  check('الأفلام: ميلان الجوال يميل البوستر المكبَّر ويلمّعه ويزيح الإضاءة خلفه', /rotateY\(\d/.test(gy.t) && gy.sheen > .2 && /^-\d/.test(gy.amb), gy);
  // القرص داخل المكبَّر يكبّره مع الأصابع (حتى خمسة أضعاف)، ثم القرص للداخل يصغّره ويغلقه ويعيده مكانه
  await pinch(c().x, c().y - 40, 30, 110, { n: 8 }); await pause(500);
  const zin = await page.evaluate(() => __zs());
  check('الأفلام: القرص بإصبعين داخل المكبَّر يكبّره مع الأصابع', zin > 2.5 && zin <= 5, zin);
  await tapAt(c().x, c().y); await pause(90); await tapAt(c().x, c().y); await pause(600);
  await pinch(c().x, c().y, 120, 30, { n: 8, lift: false }); const sIn = await page.evaluate(() => __zs());
  await touch('touchEnd', []); await shut(); await pause(300);
  check('الأفلام: القرص للداخل يصغّره ثم يغلقه ويعيد البوستر مكانه', sIn < .85 && await page.evaluate(() => !document.querySelector('.pz-lifted') && !document.querySelector('.pz-ghost,.pz-veil') && !history.state?.pz), sIn);
  // قرص قصير لا يفتح شيئاً: النسخة تعود مكانها
  const r2 = await target('.tk .poster[data-zoom-pinch]'); await pinch(r2.x, r2.y, 20, 26, { n: 3 }); await pause(500);
  check('الأفلام: قرص قصير يعيد النسخة مكانها ولا يفتح شيئاً', await page.evaluate(() => !document.querySelector('dialog.pz')?.open && !document.querySelector('.pz-ghost,.pz-veil,.pz-lifted') && !document.querySelector('#sheet').open));
  // البوستر الصغير قد لا يتسع للإصبعين: الإصبع الثاني خارجه بقليل يكفي
  const r4 = await target('.tk .poster[data-zoom-pinch]'), edge = r4.x + r4.w / 2;
  await pinch(edge, r4.y, 18, 120, { n: 12 }); await open(); await pause(800);
  check('الأفلام: القرص يعمل والإصبع الثاني خارج البوستر بقليل', await page.evaluate(() => document.querySelector('dialog.pz').open && __zs() > 1.2 && !document.querySelector('#sheet').open));
  await page.locator('dialog.pz .pz-x').tap(); await shut(); await pause(300);
  check('الأفلام: زر ✕ يغلقه ويعيده مكانه', await page.evaluate(() => !document.querySelector('.pz-lifted') && !history.state?.pz));
  // إصبع واحد على البوستر يمرّر الصفحة كالعادة، والنقرة عليه تبقى للبوابة (تفتح بطاقة الفيلم)
  const y1 = await page.evaluate(() => scrollY); await swipe(r2.x, r2.y, 0, -160); await pause(500);
  check('الأفلام: السحب بإصبع على البوستر يمرّر الصفحة ولا يرفع شيئاً', await page.evaluate(y => scrollY > y + 40 && !document.querySelector('.pz-ghost,.pz-lifted,dialog.pz[open]'), y1));
  const r3 = await target('.tk .poster[data-zoom-pinch]'); await tapAt(r3.x, r3.y); await page.waitForSelector('#sheet[open] .sh-head [data-zoom]'); await pause(500);
  check('الأفلام: نقرة على البوستر تفتح بطاقة الفيلم كما كانت', await page.evaluate(() => document.querySelector('#sheet').open && !document.querySelector('dialog.pz')?.open && location.hash.length > 1));
  // بوستر البطاقة: يُكبَّر بالنقر، والرجوع يغلق المكبَّر وحده وتبقى البطاقة
  const hash = await page.evaluate(() => location.hash);
  await page.locator('#sheet .sh-head [data-zoom]').tap(); await open(); await pause(900);
  await page.goBack(); await shut(); await pause(350);
  check('الأفلام: الرجوع يغلق مكبَّر بوستر البطاقة وتبقى البطاقة مفتوحة', await page.evaluate(h => document.querySelector('#sheet').open && location.hash === h && !document.querySelector('.pz-lifted'), hash));
  // ---------- دي سي ----------
  await page.goto(base + '/dc/'); await page.waitForSelector('.chead .poster[data-zoom-pinch] img'); await pause(600);
  await page.evaluate(() => document.querySelector('.chead .poster[data-zoom-pinch]').scrollIntoView({ block: 'center' })); await pause(400);
  const d = await target('.chead .poster[data-zoom-pinch]');
  await pinch(d.x, d.y, 10, 70, { n: 10, drift: 20 }); await open(); await pause(900);
  check('دي سي: القرص على بطاقة العمل يفتح بوستره مكبَّراً لا نافذته', await page.evaluate(() => document.querySelector('dialog.pz').open && document.querySelector('#sheet').hidden && document.querySelector('.pz-cap').textContent.length > 0));
  await page.goBack(); await shut(); await pause(300);
  check('دي سي: الرجوع يغلقه ويعيده مكانه', await page.evaluate(() => !document.querySelector('.pz-lifted') && location.pathname.endsWith('/dc/') && document.querySelector('#sheet').hidden));
  await sweep(0, 12); await pause(400);
  check('دي سي: بوسترات البطاقات تميل مع الجوال', await page.evaluate(() => document.querySelectorAll('.chead .poster.pz-t').length >= 1 && +document.querySelector('.chead .poster.pz-t').style.getPropertyValue('--pz-x') > .2));
  check(`${name}: بلا أخطاء برمجية`, errs.length === 0, errs);
  await ctx.close();
}

if (!only || only === 'desktop') { console.log('== desktop');
  const { ctx, page, errs, pause, open, shut } = await session('desktop', 1440, 900, false);
  await page.goto(base + '/films/'); await page.waitForSelector('.tk .poster img'); await pause(500);
  const fid = await page.evaluate(() => document.querySelector('.tk .poster[data-zoom-pinch]').closest('.tk').id.slice(2));
  await page.evaluate(id => { location.hash = '#' + id; }, fid); await page.waitForSelector('#sheet[open] .sh-head [data-zoom]'); await pause(400);
  await page.locator('#sheet .sh-head [data-zoom]').click(); await open(); await pause(950);
  // دمج الألوان (mix-blend-mode) في عنصر لا يعزله سياق تكديس دون المكبَّر يعزل المكبَّر كله، فيتوقف تمويه الصفحة خلفه (حدث مع الإضاءة المحيطة وصُحّح)
  const iso = await page.evaluate(() => { const d = document.querySelector('dialog.pz'), sc = e => { const s = getComputedStyle(e); return s.transform !== 'none' || s.perspective !== 'none' || s.filter !== 'none' || +s.opacity < 1 || s.isolation === 'isolate' || (s.position !== 'static' && s.zIndex !== 'auto') || s.backdropFilter !== 'none' || /transform|opacity|filter|perspective/.test(s.willChange); };
    const bad = [...d.querySelectorAll('*')].filter(e => getComputedStyle(e).mixBlendMode !== 'normal').filter(e => { let p = e.parentElement; while (p && p !== d && !sc(p)) p = p.parentElement; return p === d; }).map(e => e.className);
    return { bad, bf: getComputedStyle(d.querySelector('.pz-scrim')).backdropFilter }; });
  check('الأفلام: الصفحة خلف المكبَّر مموّهة فعلاً (لا دمج ألوان يعزل الستار عنها)', !iso.bad.length && /blur/.test(iso.bf), iso);
  const b = await page.locator('dialog.pz .pz-card').boundingBox(), cx = b.x + b.width * .3, cy = b.y + b.height * .3;
  await page.mouse.move(cx - 30, cy - 30); await page.mouse.move(cx, cy, { steps: 4 }); await pause(450);
  const hv = await page.evaluate(() => ({ t: document.querySelector('.pz-card').style.transform, sheen: +getComputedStyle(document.querySelector('.pz-sheen')).opacity }));
  check('الأفلام: المؤشر فوق البوستر المكبَّر يميله ويلمّعه', /rotateY/.test(hv.t) && hv.sheen > .2, hv);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await pause(40); } await pause(300);
  const z1 = await page.evaluate(() => __zs());
  check('الأفلام: العجلة تكبّر حول المؤشر، والميلان يتوقف', z1 > 1.8 && await page.evaluate(() => !document.querySelector('.pz-card').style.transform), z1);
  await page.mouse.dblclick(cx, cy); await pause(500); check('الأفلام: النقر المزدوج يعيده', await page.evaluate(() => Math.abs(__zs() - 1) < .005));
  await page.mouse.dblclick(cx, cy); await pause(500); const z2 = await page.evaluate(() => __zs()); check('الأفلام: والنقر المزدوج مرة أخرى يكبّره ضعفين ونصفاً', Math.abs(z2 - 2.5) < .01, z2);
  const t0 = await page.evaluate(() => getComputedStyle(document.querySelector('.pz-zoom')).transform);
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy + 40, { steps: 6 }); await page.mouse.up(); await pause(450);
  check('الأفلام: السحب بالفأرة يتنقل في المكبَّر ولا يغلقه', await page.evaluate(t => getComputedStyle(document.querySelector('.pz-zoom')).transform !== t && document.querySelector('dialog.pz').open, t0));
  await page.mouse.move(cx + 40, cy + 20); await pause(100); check('الأفلام: لا ميلان والبوستر مكبَّر', await page.evaluate(() => !document.querySelector('.pz-card').style.transform));
  await page.keyboard.press('0'); await pause(450); const k0 = await page.evaluate(() => ({ s: __zs(), t: getComputedStyle(document.querySelector('.pz-zoom')).transform }));
  check('الأفلام: المفتاح 0 يعيده إلى مقاسه', Math.abs(k0.s - 1) < .005, k0);
  await page.keyboard.press('+'); await pause(450); const zk = await page.evaluate(() => __zs()); check('الأفلام: المفتاح + يكبّره', Math.abs(zk - 1.5) < .01, zk);
  const tk = await page.evaluate(() => getComputedStyle(document.querySelector('.pz-zoom')).transform);
  await page.keyboard.press('ArrowDown'); await pause(450); check('الأفلام: الأسهم تتنقل فيه وهو مكبَّر', await page.evaluate(t => getComputedStyle(document.querySelector('.pz-zoom')).transform !== t, tk));
  await page.keyboard.press('-'); await pause(450); const km = await page.evaluate(() => ({ s: __zs(), t: getComputedStyle(document.querySelector('.pz-zoom')).transform }));
  check('الأفلام: المفتاح - يصغّره', Math.abs(km.s - 1) < .005, km);
  await page.keyboard.press('+'); await page.keyboard.press('+'); await pause(450);
  await page.keyboard.press('Escape'); await shut(); await pause(350);
  check('الأفلام: Esc يغلق المكبَّر (ولو مكبَّراً) وتبقى البطاقة وبوسترها مكانه', await page.evaluate(id => document.querySelector('#sheet').open && location.hash === '#' + id && !document.querySelector('.pz-lifted') && getComputedStyle(document.querySelector('.pz-zoom')).transform === 'none', fid));
  check('desktop: بلا أخطاء برمجية', errs.length === 0, errs);
  await ctx.close(); }

// كل بوستر في كل عرض من البوابات يقبل التكبير (ما ليس بوستراً مستثنى: الخلفيات وشعارات المنصات وصور الحلقات ونتائج البحث)
if (!only || only === 'coverage') { console.log('== coverage');
  const { ctx, page, errs, pause } = await session('coverage', 1200, 900, false);
  const NOT = '.where,.wlist,.tonight,.sh-hero,.opener,.hero,.epthumb,.tile,.hit,.door,.pz,.pz-ghost';
  const bare = () => page.evaluate(x => [...document.querySelectorAll('img')].filter(i => /image\.tmdb\.org/.test(i.src) && !i.closest('[data-zoom],[data-zoom-pinch],' + x)).map(i => i.parentElement.className || i.parentElement.tagName).slice(0, 4), NOT);
  const marked = () => page.evaluate(() => document.querySelectorAll('[data-zoom],[data-zoom-pinch]').length);
  await page.goto(base + '/films/'); await page.waitForSelector('.tk .poster img'); await pause(400);
  let b = await bare(), n = await marked(); check('الأفلام: كل بوسترات الشبكة تقبل التكبير', !b.length && n > 50, { b, n });
  const ids = await page.evaluate(() => [...document.querySelectorAll('.tk')].map(t => t.id.slice(2)).slice(0, 25)), miss = new Set();
  for (const id of ids) { await page.evaluate(id => { location.hash = '#' + id; }, id); await pause(200); for (const x of await bare()) miss.add(x); }
  check('الأفلام: وبوسترات بطاقات الأفلام (الرأس والترتيب والأعمال المرتبطة)', !miss.size, [...miss]);
  await page.evaluate(() => { location.hash = ''; }); await pause(300); await page.evaluate(() => document.querySelector('.tabs button[data-v="series"]').click()); await pause(400);
  b = await bare(); check('الأفلام: وبوسترات عرض السلاسل', !b.length && await page.evaluate(() => document.querySelectorAll('#series [data-zoom-pinch]').length) > 5, b);
  for (const door of ['dc', 'fate']) { await page.goto(base + `/${door}/`); await page.waitForSelector('.chead .poster img'); await pause(500);
    for (const v of ['cards', 'timeline', 'arrow']) { const has = await page.evaluate(v => { const x = document.querySelector(`[data-act="view"][data-view="${v}"]`); x?.click(); return !!x; }, v); if (!has) continue; await pause(600);
      b = await bare(); check(`${door}: كل البوسترات في عرض ${v} تقبل التكبير`, !b.length && await marked() > 5, b); }
    await page.evaluate(() => document.querySelector('[data-act="view"][data-view="cards"]')?.click()); await pause(300);
    await page.evaluate(() => document.querySelector('.chead .poster').click()); await pause(800);
    check(`${door}: بوستر نافذة العمل يُكبَّر بالضغط`, await page.evaluate(() => !!document.querySelector('#sheet:not([hidden]) .dw-top .poster[data-zoom]') && ![...document.querySelectorAll('#sheet .dw img')].some(i => /image\.tmdb\.org/.test(i.src) && !i.closest('[data-zoom],[data-zoom-pinch],.epthumb'))));
  }
  check('coverage: بلا أخطاء برمجية', errs.length === 0, errs);
  await ctx.close(); }

// تقليل الحركة: لا ميلان مع الجوال، والقرص يبقى لأنه بيد المستخدم
if (!only || only === 'reduced-motion') { console.log('== reduced-motion');
  const { ctx, page, errs, pause, sweep, pinch, open, target } = await session('reduce', 369, 905, true, { reducedMotion: 'reduce' });
  await page.goto(base + '/films/'); await page.waitForSelector('.tk .poster img'); await pause(400);
  await sweep(0, 12); await pause(300);
  check('تقليل الحركة: لا ميلان مع الجوال', await page.evaluate(() => !document.querySelector('.pz-t')));
  const r = await target('.tk .poster[data-zoom-pinch]'); await pinch(r.x, r.y, 10, 130, { n: 12 }); await open(); await pause(400);
  check('تقليل الحركة: القرص يفتح المكبَّر مكبَّراً حيث تركته الأصابع', await page.evaluate(() => __zs() > 1.4 && !document.querySelector('.pz-ghost,.pz-veil')));
  check('reduced-motion: بلا أخطاء برمجية', errs.length === 0, errs);
  await ctx.close(); }
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص البوسترات نجحت'); process.exit(fails.length ? 1 : 0);
