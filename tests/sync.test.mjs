// اختبار المزامنة بين جهازين في متصفح حقيقي، بلا إنترنت: مكتبة Firebase تُستبدل بنسخة تقليد صغيرة تتكلم مع خادم محلي
// يحفظ الشجرة ويبثّ كل تغيير للجميع (كما تفعل Realtime Database). «الجهازان» سياقان منفصلان بتخزين منفصل: كمبيوتر وجوال Fold.
// التشغيل: node tests/sync.test.mjs [مجلد اللقطات] — يفشل بخروج 1 عند أي خلل.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname), shots = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const site = http.createServer((q, r) => { const f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const base = `http://127.0.0.1:${site.address().port}`;

// ---------- خادم القاعدة التقليد: GET /tree، POST /update، GET /events (بثّ حي)
const tree = {}, clients = new Set(); let deny = false, clock = Date.now();
const cors = { 'access-control-allow-origin': '*' };
const db = http.createServer((q, r) => {
  if (deny && q.url !== '/events') { r.writeHead(403, cors); return r.end(); }
  if (q.url === '/tree') { r.writeHead(200, { ...cors, 'content-type': 'application/json' }); return r.end(JSON.stringify(tree)); }
  if (q.url === '/events') { r.writeHead(200, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); r.write(':ok\n\n'); clients.add(r); q.on('close', () => clients.delete(r)); return; }
  if (q.url === '/update') { let body = ''; q.on('data', c => body += c).on('end', () => { const { path: p, obj } = JSON.parse(body), node = tree[p] ||= {};
    for (const [k, v] of Object.entries(obj)) node[k] = { ...v, t: ++clock };
    const msg = `data: ${JSON.stringify({ path: p, obj: Object.fromEntries(Object.keys(obj).map(k => [k, node[k]])) })}\n\n`; for (const c of clients) c.write(msg);
    r.writeHead(200, cors); r.end('ok'); }); return; }
  r.writeHead(404, cors); r.end();
}).listen(0);
const dbUrl = `http://127.0.0.1:${db.address().port}`;
const FAKE = {
  app: `export const initializeApp = (cfg, name) => ({ cfg, name }); export const deleteApp = async () => {};`,
  auth: `export const getAuth = app => ({ app }); export const signInAnonymously = async a => { if (a.app.cfg.apiKey === 'bad') throw Object.assign(new Error('bad key'), { code: 'auth/api-key-not-valid' }); return { user: { uid: 'u' } }; };`,
  database: `const TS = { '.sv': 'timestamp' }; export const serverTimestamp = () => TS;
    export const getDatabase = app => ({ url: app.cfg.databaseURL, tree: {}, subs: [], started: false, ready: false });
    export const ref = (d, path) => ({ d, path });
    const snap = (d, path) => { const v = path === '.info/connected' ? true : d.tree[path]; return { val: () => v ?? null }; };
    const emit = (d, path) => { for (const s of d.subs) if (s.path === path) s.cb(snap(d, path)); };
    async function connect(d) { d.started = true;
      const res = await fetch(d.url + '/tree'); if (!res.ok) { for (const s of d.subs) if (s.path[0] !== '.') s.err?.(Object.assign(new Error('permission_denied at /' + s.path), { code: 'PERMISSION_DENIED' })); return; }
      d.tree = await res.json(); d.ready = true; for (const s of d.subs) s.cb(snap(d, s.path));
      new EventSource(d.url + '/events').onmessage = e => { const m = JSON.parse(e.data); d.tree[m.path] = { ...(d.tree[m.path] || {}), ...m.obj }; emit(d, m.path); }; }
    export function onValue(r, cb, err) { const d = r.d; d.subs.push({ path: r.path, cb, err }); if (r.path === '.info/connected') return cb(snap(d, r.path)); if (d.ready) cb(snap(d, r.path)); else if (!d.started) connect(d); }
    export async function update(r, obj) { const d = r.d, node = d.tree[r.path] = { ...(d.tree[r.path] || {}) };
      for (const [k, v] of Object.entries(obj)) node[k] = { ...v, t: Date.now() }; emit(d, r.path); // الصدى المحلي الفوري كما في المكتبة الحقيقية
      const res = await fetch(d.url + '/update', { method: 'POST', body: JSON.stringify({ path: r.path, obj }) }); if (!res.ok) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); }`,
};
const fails = []; const check = (name, ok, extra = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails.push(name); };
const CONFIG = `const firebaseConfig = {\n  apiKey: "test-key",\n  authDomain: "t.firebaseapp.com",\n  databaseURL: "${dbUrl}",\n  projectId: "t",\n  appId: "1:2:web:3"\n};`;

const browser = await chromium.launch();
async function device(name, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: shots ? 2 : 1, locale: 'ar-SA' }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource|\[sync\]/.test(m.text())) errs.push(m.text()); });
  await ctx.route(/image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="#234"/></svg>' }));
  await ctx.route(/gstatic\.com\/firebasejs\/.*firebase-(app|auth|database)\.js/, r => r.fulfill({ contentType: 'text/javascript', headers: cors, body: FAKE[r.request().url().match(/firebase-(\w+)\.js/)[1]] }));
  const tap = async sel => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); return mobile ? l.tap() : l.click(); };
  const open = async p => { await page.goto(base + p); await page.waitForSelector(p.includes('films') ? '#grid .tk, #grid article' : '.card'); };
  const enable = async (via) => { await via(); await page.waitForSelector('#gsync[open]'); await page.fill('#gsync [data-gs=cfg]', CONFIG); await tap('#gsync [data-gs=on]'); };
  const pressed = sel => page.getAttribute(sel, 'aria-pressed');
  const local = key => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
  return { name, ctx, page, errs, tap, open, enable, pressed, local, mobile };
}
const A = await device('كمبيوتر', { width: 1440, height: 900 }, false), B = await device('Fold', { width: 369, height: 905 }, true);
const X = '#c-nolan-the-dark-knight-2008', Y = '#c-nolan-batman-begins-2005', W = '[data-s=watched]';
const viaLog = d => async () => { await d.tap('[data-act=backup]'); await d.page.waitForSelector('#sheet [data-sync-open]'); await d.tap('#sheet [data-sync-open]'); };

console.log('\n== جهاز أول يفعّل المزامنة وعليه تقدّم سابق');
await A.open('/dc/'); await A.tap(X + ' ' + W);
check('قبل التفعيل: لا اتصال بأي خادم ولا مكتبة', clients.size === 0 && Object.keys(tree).length === 0);
await A.enable(viaLog(A)); await A.page.waitForSelector('#gsync[data-state=on]');
check('التفعيل من «سجلّي» ينجح والحالة «تعمل»', (await A.page.textContent('#gsync [data-gs=state]')).includes('تعمل') && await A.page.isHidden('#gsync [data-gs=setup]'));
await A.page.waitForFunction(() => true); await new Promise(r => setTimeout(r, 300));
check('التقدّم السابق أُرسل إلى القاعدة', tree['guides/dc']?.['w|the-dark-knight-2008']?.v === 'watched');
check('الإعداد لا يُكتب إلا في متصفح صاحبه', (await A.local('guides.fb'))?.databaseURL === dbUrl);
if (shots) await A.page.screenshot({ path: `${shots}/sync-on-desktop.png` });
await A.tap('#gsync [data-gs=close]'); await A.tap('#sheet [data-act=close]'); await A.page.waitForSelector('#sheet', { state: 'hidden' });

console.log('\n== جهاز ثانٍ عليه تقدّم مختلف');
await B.open('/dc/'); await B.tap(Y + ' ' + W);
await viaLog(B)(); await B.page.waitForSelector('#gsync[open]');
const ov = await B.page.evaluate(() => { const d = document.querySelector('#gsync'), r = d.getBoundingClientRect(); return { fits: r.left >= 0 && r.right <= innerWidth + 1 && d.scrollWidth <= d.clientWidth + 1, small: [...d.querySelectorAll('button,input,textarea')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40).length }; });
check('نافذة المزامنة على الجوال: داخل الشاشة وأزرارها بحجم اللمس', ov.fits && ov.small === 0, JSON.stringify(ov));
if (shots) await B.page.screenshot({ path: `${shots}/sync-setup-fold.png` });
await B.page.fill('#gsync [data-gs=cfg]', CONFIG);
check('رابط القاعدة يُملأ من النص الملصوق', await B.page.inputValue('#gsync [data-gs=url]') === dbUrl);
await B.tap('#gsync [data-gs=on]'); await B.page.waitForSelector('#gsync[data-state=on]');
await B.tap('#gsync [data-gs=close]'); await B.tap('#sheet [data-act=close]'); await B.page.waitForSelector('#sheet', { state: 'hidden' });
await B.page.waitForFunction(s => document.querySelector(s)?.getAttribute('aria-pressed') === 'true', X + ' ' + W);
check('الدمج: الجهاز الثاني أخذ تقدّم الأول واحتفظ بتقدّمه', await B.pressed(X + ' ' + W) === 'true' && await B.pressed(Y + ' ' + W) === 'true');
await A.page.waitForFunction(s => document.querySelector(s)?.getAttribute('aria-pressed') === 'true', Y + ' ' + W);
check('والأول وصله تقدّم الثاني حيّاً بلا تحديث للصفحة', await A.pressed(Y + ' ' + W) === 'true' && await A.pressed(X + ' ' + W) === 'true');
check('نسخة قبل أول دمج محفوظة على الجهاز', await B.page.evaluate(() => !!localStorage.getItem('dcg.progress.presync')));

console.log('\n== تغييرات حيّة في الاتجاهين');
await B.tap('#c-dcu-peacemaker-2022-s2 [data-act=open]'); await B.page.waitForSelector('.ep:not(.skel)'); await B.tap('.ep [data-act=ep]');
await A.page.waitForFunction(() => document.querySelector('#c-dcu-peacemaker-2022-s2 .epprog')?.textContent.trim() === '1/8');
check('حلقة عُلّمت على الجوال تظهر على بطاقة الكمبيوتر', true);
await B.tap('#sheet [data-act=close]'); await B.page.waitForSelector('#sheet', { state: 'hidden' });
await A.tap('#c-dcu-peacemaker-2022-s2 ' + W); await A.page.waitForSelector('#toast.ask:not([hidden])'); await A.tap('#toast [data-act=askyes]');
await B.page.waitForFunction(() => document.querySelector('#c-dcu-peacemaker-2022-s2 .epprog')?.textContent.trim() === '8/8');
check('تعليم موسم كامل على الكمبيوتر يصل الجوال (الحالة والحلقات الثماني)', await B.pressed('#c-dcu-peacemaker-2022-s2 ' + W) === 'true');
await A.tap(X + ' ' + W);
await B.page.waitForFunction(s => document.querySelector(s)?.getAttribute('aria-pressed') === 'false', X + ' ' + W);
check('إلغاء العلامة يصل الجهاز الآخر', (await B.local('dcg.progress')).works['the-dark-knight-2008'] === undefined && tree['guides/dc']['w|the-dark-knight-2008'].v === 0);
check('مفاتيح القاعدة خالية من الحروف الممنوعة', Object.keys(tree['guides/dc']).every(k => !/[.#$\[\]\/]/.test(k)) && !!tree['guides/dc']['w|peacemaker-2022%232']);
check('صيغة السجل المحلي كما هي', await B.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('dcg.progress')); return s.v === 1 && typeof s.shield === 'boolean' && Object.keys(s.eps['peacemaker-2022']).length === 8 && s.works['peacemaker-2022#2'] === 'watched'; }));

console.log('\n== جهاز مغلق يأخذ ما فاته، وما عُلّم بلا اتصال يُرسل لاحقاً');
await B.page.goto('about:blank'); await new Promise(r => setTimeout(r, 200));
await A.tap('#c-nolan-the-dark-knight-rises-2012 ' + W); await new Promise(r => setTimeout(r, 300));
await B.open('/dc/');
await B.page.waitForFunction(() => document.querySelector('#c-nolan-the-dark-knight-rises-2012 [data-s=watched]')?.getAttribute('aria-pressed') === 'true');
check('الجوال فُتح بعد إغلاق فأخذ ما فاته دون أي ضغط', true);
await B.ctx.route(dbUrl + '/**', r => r.abort()); await B.ctx.route(/gstatic\.com\/firebasejs/, r => r.abort());
await B.page.reload(); await B.page.waitForSelector('.card'); await B.tap(X + ' ' + W); await new Promise(r => setTimeout(r, 300));
check('بلا اتصال: العلامة تُحفظ محلياً ولا تصل القاعدة بعد', (await B.local('dcg.progress')).works['the-dark-knight-2008'] === 'watched' && tree['guides/dc']['w|the-dark-knight-2008'].v === 0);
await B.ctx.unroute(dbUrl + '/**'); await B.ctx.unroute(/gstatic\.com\/firebasejs/);
await B.ctx.route(/gstatic\.com\/firebasejs\/.*firebase-(app|auth|database)\.js/, r => r.fulfill({ contentType: 'text/javascript', headers: cors, body: FAKE[r.request().url().match(/firebase-(\w+)\.js/)[1]] }));
await B.page.reload(); await B.page.waitForSelector('.card');
await A.page.waitForFunction(s => document.querySelector(s)?.getAttribute('aria-pressed') === 'true', X + ' ' + W);
check('عند عودة الاتصال: ما عُلّم بلا اتصال يصل الجهاز الآخر', tree['guides/dc']['w|the-dark-knight-2008'].v === 'watched');

console.log('\n== الأفلام والواجهة الرئيسية');
await B.open('/films/'); const fid = await B.page.evaluate(() => document.querySelector('#grid article').id.slice(2));
await B.tap(`#f-${fid} [data-act=seen]`); await new Promise(r => setTimeout(r, 400));
check('فيلم عُلّم على الجوال وصل القاعدة', tree['guides/films']?.['f|' + fid]?.v === 'watched');
check('ووصل سجل الأفلام على الكمبيوتر وهو في صفحة أخرى', (await A.local('filmsg.progress'))?.films?.[fid] === 'watched');
check('زر المزامنة في صفحة الأفلام يعرض الحالة', (await B.page.textContent('.foot [data-sync-label]')).includes('تعمل'));
await A.page.goto(base + '/'); await A.page.waitForFunction(() => /شاهدت 1 من/.test(document.querySelector('.door.films [data-stat]')?.textContent || ''));
check('الواجهة الرئيسية تعرض التقدّم المزامَن وزر المزامنة', (await A.page.textContent('.hub-top [data-sync-label]')).includes('تعمل'));
await B.tap('#toast button'); // تراجع عن تعليم الفيلم
await A.page.waitForFunction(() => !/شاهدت/.test(document.querySelector('.door.films [data-stat]')?.textContent || 'شاهدت'));
check('التراجع على الجوال يحدّث عدّاد الباب على الكمبيوتر حيّاً', true);
await A.open('/films/'); check('صفحة الأفلام على الكمبيوتر تفتح بلا أخطاء والمزامنة تعمل', (await A.page.textContent('.foot [data-sync-label]')).includes('تعمل'));

console.log('\n== الأعطال والإيقاف');
const C = await device('جهاز ثالث', { width: 390, height: 844 }, true); deny = true;
await C.open('/fate/'); await C.enable(viaLog(C)); await C.page.waitForSelector('#gsync[data-state=err]');
check('قاعدة ترفض الوصول: رسالة واضحة وفيها سطر القواعد المطلوب', (await C.page.textContent('#gsync [data-gs=err]')).includes('"guides"') && await C.page.isVisible('#gsync [data-gs=setup]'));
if (shots) await C.page.screenshot({ path: `${shots}/sync-denied-mobile.png` });
deny = false; await C.tap('#gsync [data-gs=on]'); await C.page.waitForSelector('#gsync[data-state=on]');
check('بعد إصلاح القواعد: «فعّل المزامنة» يعمل بالإعداد المحفوظ دون لصق جديد', await C.page.isHidden('#gsync [data-gs=err]'));
await C.tap('#gsync [data-gs=off]'); await C.page.waitForSelector('.card'); await C.page.waitForTimeout(300);
check('الإيقاف يحذف الإعداد من الجهاز ويُبقي السجل', await C.local('guides.fb') === null && (await C.page.evaluate(() => document.querySelector('#gsync') === null)));
const D2 = await device('جهاز رابع', { width: 1280, height: 800 }, false);
await D2.open('/dc/'); await viaLog(D2)(); await D2.page.waitForSelector('#gsync[open]'); await D2.page.fill('#gsync [data-gs=cfg]', 'projectId: "x"'); await D2.tap('#gsync [data-gs=on]');
check('إعداد ناقص: رسالة ولا اتصال', (await D2.page.textContent('#gsync [data-gs=err]')).includes('ناقص') && await D2.local('guides.fb') === null);

for (const d of [A, B, C, D2]) check(`بلا أخطاء برمجية (${d.name})`, d.errs.length === 0, d.errs.slice(0, 2).join(' | '));
await browser.close(); site.close(); db.close(); for (const c of clients) c.end();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join('، ')}` : '\n✅ كل فحوص المزامنة نجحت');
process.exit(fails.length ? 1 : 0);
