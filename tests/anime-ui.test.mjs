// يفحص بوابة «أنمياتي» في متصفح حقيقي ببيانات tests/fixtures/anime.mjs، وSIMKL مُحاكى:
//   • قبل الاستيراد: القائمة العامة بلا سجل ودعوة الاستيراد
//   • استيراد ملف تصدير MyAnimeList (.xml.gz) في المتصفح: الملخص قبل التطبيق، ثم القوائم الخمس بأعدادها وأرقام السماء
//   • «أكمل المشاهدة»: الأقرب إلى الإكمال أولاً، وزر «+» يعلّم الحلقة التالية مع «تراجع»، وإكمال آخر حلقة ينقل العمل إلى «أكملته» بتاريخ اليوم
//   • بطاقة العمل: الحالة والحلقات والتقييم والتاريخان والإزالة، والنبذة العربية أو الإنجليزية، وأين يُعرض، وسلسلته؛ والرجوع يغلقها
//   • البحث الحرفي والمتسامح («هل تقصد»)، والفرز، والنوع، والأسماء بالإنجليزية
//   • السلاسل: مدخل دليل Fate أولاً، ونافذة السلسلة بترتيبها، وعمل ليس في القائمة يُضاف منها
//   • ورقة التوقيت: حلقات العمل تبدأ من التالية، وملخصها العربي أو الإنجليزي المعلَّم، وتعليم الحلقة منها (التالية، والقفز، والرجوع بسؤال)، وصفحاتها، وما لم يُعرض
//   • SIMKL: الربط بالرمز ثم السحب والمطابقة برقم MyAnimeList أو رقم SIMKL، والدمج «الأبعد تقدّماً يغلب»، و«تراجع عن آخر استيراد»
//   • الكمبيوتر وشاشتا الفولد: بلا تمدد أفقي، وأهداف اللمس، وبلا أخطاء برمجية
// NODE_PATH=$(npm root -g) node tests/anime-ui.test.mjs [مجلد اللقطات]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { catalog, texts, malGz, simklItems, epIndex, episodes } from './fixtures/anime.mjs';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname), shots = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const FX = catalog();
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), J = o => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
  if (u === '/anime/data/catalog.json') return J(FX);
  const m = u.match(/^\/anime\/data\/texts\/(\d+)\.json$/); if (m) return J(Object.fromEntries(Object.entries(texts).filter(([id]) => id % 32 === +m[1])));
  if (u === '/anime/data/eps/index.json') return J(epIndex());
  const e = u.match(/^\/anime\/data\/eps\/(\d+)\.json$/); if (e) { const j = episodes(+e[1]); if (j) return J(j); r.writeHead(404); return r.end(); }
  let f = path.join(siteDir, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 600)}`); if (!ok) fails.push(n); };
const svg = (w, h, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${c}"/></svg>`;
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const browser = await chromium.launch();

for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['fold-cover', { width: 369, height: 905 }, true], ['fold-main', { width: 707, height: 823 }, true]].filter(x => !process.env.SIZES || process.env.SIZES.split(',').includes(x[0]))) {
  console.log(`\n== ${name} ${viewport.width}×${viewport.height}`);
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: shots ? 2 : 1, locale: 'ar-SA' }), page = await ctx.newPage(), errs = [], asked = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.route(/cdn\.myanimelist\.net|image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: /w780|w1280/.test(r.request().url()) ? svg(640, 360, '#5a3d8a') : svg(300, 440, '#2f6f9f') }));
  // SIMKL المُحاكى: الرمز، ثم «لم يوافق بعد» مرة، ثم رمز الدخول، ثم النشاط والقائمة. كل طلب يجب أن يحمل معرّف التطبيق واسمه ونسخته
  let polls = 0; const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route('https://api.simkl.com/**', r => { const q = r.request(), u = new URL(q.url()), J = (o, status = 200) => r.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    asked.push(`${q.method()} ${u.pathname}${u.searchParams.get('client_id') && u.searchParams.get('app-name') && u.searchParams.get('app-version') ? '' : ' (بلا تعريف)'}${q.headers().authorization ? ' +auth' : ''}`);
    if (u.pathname === '/oauth2/device') return J({ device_code: 'dc-1', user_code: 'ABCD-1234', verification_uri: 'https://simkl.com/pin', verification_uri_complete: 'https://simkl.com/pin/ABCD-1234', expires_in: 900, interval: 1 });
    if (u.pathname === '/oauth2/token') return ++polls < 2 ? J({ error: 'authorization_pending' }, 400) : J({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 604800 });
    if (u.pathname === '/sync/activities') return J({ all: '2026-11-20T10:00:00Z', anime: { all: '2026-11-20T10:00:00Z' } });
    if (u.pathname === '/sync/all-items/anime') return q.headers().authorization === 'Bearer test-access' ? J(simklItems()) : J({ error: 'user_token_failed' }, 401);
    return J({ error: 'not_found' }, 404); });
  await page.route(u => !u.href.startsWith(base) && !/cdn\.myanimelist\.net|image\.tmdb\.org|api\.simkl\.com/.test(u.href), r => r.abort());
  const tap = async sel => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); return mobile ? l.tap() : l.click(); };
  const log = () => page.evaluate(() => JSON.parse(localStorage.getItem('animeg.progress') || '{"a":{}}').a);
  const lists = () => page.$$eval('#lists button', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  const toastText = () => page.evaluate(() => { const t = document.querySelector('#toast'); return t.classList.contains('on') ? t.textContent : ''; });
  const snap = async n => { if (shots) await page.screenshot({ path: `${shots}/anime-${name}-${n}.png` }); };
  // لا تمدد أفقي للصفحة، ولا عنصر في نافذة مفتوحة يخرج عن عرضها فيُقصّ (إلا ما في شريط يُمرَّر أفقياً)
  const overflow = async label => { const o = await page.evaluate(() => { const out = { sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, cut: [] };
    for (const d of document.querySelectorAll('dialog[open] > .scroll')) { const b = d.getBoundingClientRect();
      for (const e of d.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height || (r.right <= b.right + 1 && r.left >= b.left - 1) || e.closest('.x18-i')) continue;   // صورة +18 المغطاة مكبَّرة داخل غلاف يقصّها عمداً
        let p = e.parentElement, strip = false; while (p && p !== d) { if (/auto|scroll/.test(getComputedStyle(p).overflowX)) { strip = true; break; } p = p.parentElement; }
        if (!strip && out.cut.length < 6) out.cut.push(`${e.className || e.tagName} ${Math.round(r.left - b.left)}..${Math.round(r.right - b.right)}`); } }
    return out; }); check(`${label}: بلا تمدد أفقي ولا عنصر مقصوص`, o.sw <= o.iw && !o.cut.length, o); };

  await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel');
  check('قبل الاستيراد: القائمة العامة كلها بلا سجل، ودعوة الاستيراد', await page.evaluate(() => !!document.querySelector('.invite [data-act=import]') && document.querySelectorAll('#grid .cel').length === 13 && !document.querySelector('.prog') && !document.querySelector('.rail')
    && /بلا سجل على هذا الجهاز/.test(document.querySelector('#count').textContent)) && (await lists()).join('|') === 'الكل 13', await lists());
  check('عمل دخل لإكمال سلسلته (ليس في القائمة) لا يظهر في الأعمال', await page.locator('#grid .cel[data-id="137"]').count() === 0);
  await overflow('قبل الاستيراد'); await snap('1-empty');

  // ---------- الاستيراد
  await tap('.invite [data-act=import]'); await page.waitForSelector('#imp[open]');
  await page.setInputFiles('#imp-file', { name: 'animelist_1_-_7.xml.gz', mimeType: 'application/gzip', buffer: malGz() }); await page.waitForSelector('[data-act=imp-apply]');
  check('ملف التصدير المضغوط يُقرأ في المتصفح ويُعرض ملخصه قبل الاستيراد', (await page.$$eval('#imp .sum b', b => b.map(x => x.textContent))).join(',') === '13,3,4,1,1,4,1,833,8' && /tester/.test(await page.textContent('#imp-body')), await page.$$eval('#imp .sum b', b => b.map(x => x.textContent)));
  await snap('2-import'); await tap('[data-act=imp-apply]'); await page.waitForSelector('#imp .msg.ok');
  const L0 = await log();
  check('السجل يدخل كاملاً: الحالة والحلقات والتقييم والتاريخان، بلا حقول فارغة', Object.keys(L0).length === 13 && JSON.stringify(L0[11061]) === '{"s":"completed","p":148,"r":10,"b":"2016-02-03","e":"2016-02-21"}' && JSON.stringify(L0[21]) === '{"s":"hold","p":1155,"r":10,"b":"2004-02-28"}'
    && JSON.stringify(L0[52701]) === '{"s":"watching"}' && JSON.stringify(L0[356]) === '{"s":"dropped","p":3,"r":4}' && JSON.stringify(L0[13271]) === '{"s":"plan"}', L0);
  await page.keyboard.press('Escape'); await page.waitForSelector('#imp', { state: 'hidden' });
  // ألوان الصفحة: --ink لون الحبر، لا يطغى عليه متغير آخر بالاسم نفسه (كان نسيج ختم «قريباً» يحمله فصار الزر المضغوط صورةً داكنة)
  check('لون الحبر لون، والزر المضغوط في «الأعمال/السلاسل» لونه صريح لا صورة', await page.evaluate(() => { const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), b = document.querySelector('.views [aria-pressed=true]'), cs = b && getComputedStyle(b);
    return /^#[0-9a-f]{3,8}$|^rgb/i.test(ink) && !!cs && cs.backgroundImage === 'none' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'; }));
  check('القوائم الخمس بترتيب MyAnimeList وأعدادها، ثم الكل', (await lists()).join('|') === 'أشاهده الآن 3|أكملته 4|مؤجَّل 1|تركته 1|سأشاهده 4|الكل 13', await lists());
  check('أرقام السماء: الأعمال والحلقات والأيام ومتوسط التقييم', await page.evaluate(() => { const t = document.querySelector('#tally').textContent; return /13 عملاً في قائمتك/.test(t) && /1,833 حلقة شاهدتها/.test(t) && /30\.2 يوماً من المشاهدة/.test(t) && /متوسط تقييمك 8\.63/.test(t); }), await page.textContent('#tally'));
  check('«أكمل المشاهدة»: الأقرب إلى الإكمال أولاً، ثم ما لم يبدأ', (await page.$$eval('.rail .cel', c => c.map(x => x.dataset.id))).join(',') === '1735,37989,52701' && (await page.$$eval('.rail .tc span', s => s.map(x => x.textContent.trim()))).join('|') === '393 من 500|7 من 12|0 من 24', await page.$$eval('.rail .tc span', s => s.map(x => x.textContent.trim())));
  check('السِل: ختم تقييمك، ومخطط توقيت بخانة لكل حلقة حتى 26 وشريط متصل لما زاد', await page.evaluate(() => { const gk = document.querySelector('.rail .cel[data-id="37989"]'), na = document.querySelector('.rail .cel[data-id="1735"]');
    return gk.querySelector('.stamp').textContent === '8' && gk.querySelector('.tc').style.getPropertyValue('--n') === '12' && !na.querySelector('.tc').style.getPropertyValue('--n') && Math.abs(+na.querySelector('.tc').style.getPropertyValue('--p') - .786) < .001; }));
  // ---------- «اقتراح الليلة» (E62): عمل من «سأشاهده» مما عُرض ويصلح بداية، ومزاجه تصنيفات تختار منها ما تشاء (لمسة تضيف ولمسة ترفع)
  const tn = () => page.evaluate(() => { const b = document.querySelector('#tonight .tn'); return b && { id: b.querySelector('[data-act=open]')?.dataset.id || '', hint: b.querySelector('.tn-h')?.textContent || '',
    on: [...b.querySelectorAll('.tn-c [aria-pressed=true]')].map(x => x.dataset.g).sort().join(), chips: [...b.querySelectorAll('.tn-c button[data-g]')].map(x => x.dataset.g + ':' + x.querySelector('b').textContent).join() }; });
  let T = await tn();
  check('«اقتراح الليلة»: من «سأشاهده» مما عُرض (لا القادم ولا ما لم تُجلب معلوماته)، ومزاجه تصنيفات ما ينتظر بأعدادها', ['13271', '22297'].includes(T?.id) && T.on === '-1' && T.chips === '-1:2,0:2,1:1,2:1', T);
  await tap('#tonight [data-g="1"]'); T = await tn();
  check('مزاج واحد: الاقتراح منه، بلا سطر شرح', T.id === '13271' && T.on === '1' && !T.hint, T);
  await tap('#tonight [data-g="0"]'); T = await tn();
  check('مزاجان: لمسة تضيف الثاني، والاقتراح ما يجمعهما ويقال ذلك', T.id === '13271' && T.on === '0,1' && /^عمل يجمع /.test(T.hint), T);
  await tap('#tonight [data-g="2"]'); T = await tn();
  check('ثلاثة لا يجمعها عمل: يُقدَّم أقربها، ويقال كم يجمع وما فيه منها وما ليس فيه بأسمائها (E76)', ['13271', '22297'].includes(T.id) && T.on === '0,1,2' && /يجمع 2 من 3، فيه .+ وليس فيه .+\.$/.test(T.hint)
    && (T.id === '13271' ? /فيه أكشن ومغامرات وليس فيه كوميديا/ : /فيه أكشن وكوميديا وليس فيه مغامرات/).test(T.hint), T);
  check('والمختار من المزاج أول الشريط بترتيب اختياره، فلا يبقى منه شيء لا يُرى، وتحت العنوان من أين أعداده', T.chips.split(',').slice(0, 4).map(x => x.split(':')[0]).join() === '-1,1,0,2'
    && await page.evaluate(() => /مما تبدأه الآن من «سأشاهده»/.test(document.querySelector('#tonight .tn-mood > span small')?.textContent || '')), T.chips);
  await tap('#tonight [data-g="1"]'); T = await tn();
  check('لمسة ثانية على تصنيف ترفعه، والمزاج يُحفظ', T.id === '22297' && T.on === '0,2' && await page.evaluate(() => localStorage.getItem('anime.mood')) === '0,2', T);
  await tap('#tonight [data-g="-1"]'); T = await tn();
  check('«أي تصنيف» يرفعها كلها', T.on === '-1' && !T.hint && !(await page.evaluate(() => localStorage.getItem('anime.mood'))), T);
  { const was = T.id; await tap('#tonight [data-act=treroll]'); T = await tn(); check('«اقتراح آخر» يأتي بغيره', T.id !== was && ['13271', '22297'].includes(T.id), [was, T.id]); }
  await overflow('بعد الاستيراد'); await snap('3-home');
  const small = await page.evaluate(() => [...document.querySelectorAll('button,a,select,input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.width < 40) && !e.closest('.foot,[hidden]') && e.type !== 'file'; }).map(e => (e.textContent || e.id).trim().slice(0, 24)));
  check('أهداف اللمس ≥ 40px', small.length === 0, small.slice(0, 6));

  // ---------- «+»: الحلقة التالية، والتراجع، والإكمال
  await tap('.rail .cel[data-id="37989"] [data-act=plus]');
  check('«+» يعلّم الحلقة التالية في مكانها (في الشريط وفي الشبكة) ويحفظها', (await log())[37989].p === 8 && await page.evaluate(() => [...document.querySelectorAll('.cel[data-id="37989"] .tc b')].every(b => b.textContent === '8') && document.querySelectorAll('.cel[data-id="37989"]').length === 2) && /شاهدت الحلقة 8 من Golden Kamuy 2nd Season/.test(await toastText()), await toastText());
  await tap('#toast [data-act=undo]');
  check('«تراجع» يعيدها كما كانت', (await log())[37989].p === 7 && await page.textContent('.rail .cel[data-id="37989"] .tc b') === '7');
  for (let i = 0; i < 5; i++) { await tap('.rail .cel[data-id="37989"] [data-act=plus]'); await page.waitForTimeout(60); }
  const done = (await log())[37989];
  check('آخر حلقة تنقل العمل إلى «أكملته» بتاريخ اليوم وتخرجه من «أكمل المشاهدة»', done.s === 'completed' && done.p === 12 && done.e === today && done.b === '2025-06-10' && done.r === 8 && (await lists())[0] === 'أشاهده الآن 2' && (await lists())[1] === 'أكملته 5'
    && await page.locator('.rail .cel[data-id="37989"]').count() === 0 && /أكملت Golden Kamuy 2nd Season/.test(await toastText()), [done, await lists(), await toastText()]);
  await tap('#toast [data-act=undo]');
  check('والتراجع عنها يعيده إلى ما تشاهده بحلقاته', JSON.stringify((await log())[37989]) === '{"s":"watching","p":11,"r":8,"b":"2025-06-10"}' && await page.locator('.rail .cel[data-id="37989"]').count() === 1, (await log())[37989]);
  await tap('.rail .cel[data-id="52701"] [data-act=plus]');
  check('أول حلقة تسجّل تاريخ البداية اليوم', JSON.stringify((await log())[52701]) === `{"s":"watching","p":1,"b":"${today}"}`, (await log())[52701]);

  // ---------- بطاقة العمل
  await tap('#grid .cel[data-id="52701"] [data-act=open]'); await page.waitForSelector('#sheet[open]'); await page.waitForFunction(() => /النبذة بالإنجليزية/.test(document.querySelector('#sheet-body').textContent));
  check('البطاقة: الاسمان والحقائق وتقييم MyAnimeList، ونبذة إنجليزية معلَّمة حين لا ترجمة', await page.evaluate(() => { const b = document.querySelector('#sheet-body'), t = b.textContent; return b.querySelector('h2').textContent === 'Dungeon Meshi' && b.querySelector('.alt').textContent === 'Delicious in Dungeon'
    && /مسلسل/.test(t) && /24 حلقة/.test(t) && /25 دقيقة للحلقة/.test(t) && /شتاء 2024/.test(t) && /Trigger/.test(t) && /8\.60/.test(t) && !!b.querySelector('.ov.en') && location.hash === '#a52701'
    && b.querySelector('.pos')?.dataset.k === 'solo' && ![...b.querySelectorAll('h3')].some(h => /^من سلسلة/.test(h.textContent)); }));   // سلسلته لا يظهر منها والفلتر قائم إلا هو (E73): فهو عمل منفرد
  check('أين يُعرض في السعودية، وصفحاته في المواقع', await page.evaluate(() => { const w = document.querySelector('#sheet .where'); return w.querySelector('h3').textContent === 'أين تشاهده في السعودية' && w.querySelector('.wrow b').textContent === 'باشتراك' && w.querySelector('.wl a').textContent === 'Netflix'
    && [...document.querySelectorAll('#sheet .links a')].map(a => a.href).join(' ') === 'https://myanimelist.net/anime/52701 https://simkl.com/anime/1970434 https://www.themoviedb.org/tv/207784'; }));
  // «ترجمها لي»: الزر تحت النبذة الإنجليزية، وكلمة السر تُسأل مرة وتُحفظ بعد نجاحها، والطلب يحمل رقم العمل واسمه ونوعه فقط (لا شيء من السجل)
  const sent = []; let askOk = false;
  await page.route('**/api/anime-ask', r => { sent.push(JSON.parse(r.request().postData() || '{}')); return askOk ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"state":"asked"}' }) : r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"password"}' }); });
  const trBox = what => page.evaluate(w => { const b = document.querySelector(`#sheet .tr[data-what="${w}"]`); return b ? { btn: b.querySelector('[data-act=tr-ask]')?.textContent.trim() || '', field: !!b.querySelector('.tr-pass'), msg: b.querySelector('.msg')?.textContent || '', ok: b.querySelector('.tr-ok')?.textContent.trim() || '' } : null; }, what);
  check('نبذة لم تُترجم: زر «ترجمها لي» تحتها', (await trBox('about'))?.btn === 'ترجمها لي' && !(await trBox('about')).field, await trBox('about'));
  await tap('#sheet .tr[data-what=about] [data-act=tr-ask]');
  check('لا كلمة سر محفوظة: يظهر حقلها ولا يُرسل شيء', (await trBox('about')).field && !sent.length && await page.evaluate(() => document.activeElement?.classList.contains('tr-pass')), [await trBox('about'), sent]);
  await tap('#sheet .tr[data-what=about] [data-act=tr-ask]');
  check('الحقل فارغ: تنبيه ولا إرسال', /اكتب كلمة السر أولاً/.test((await trBox('about')).msg) && !sent.length);
  await page.fill('#sheet .tr-pass', 'wrong'); await tap('#sheet .tr[data-what=about] [data-act=tr-ask]'); await page.waitForFunction(() => /غير صحيحة/.test(document.querySelector('#sheet .tr .msg')?.textContent || ''));
  check('كلمة سر خاطئة: رسالة، والحقل يُفرَّغ، ولا تُحفظ', sent.length === 1 && await page.inputValue('#sheet .tr-pass') === '' && await page.evaluate(() => !localStorage.getItem('animeg.pass') && !localStorage.getItem('animeg.asked')), sent);
  askOk = true; await page.fill('#sheet .tr-pass', 'open-sesame'); await page.press('#sheet .tr-pass', 'Enter'); await page.waitForSelector('#sheet .tr[data-what=about] .tr-ok');
  check('الطلب يصل: رقم العمل واسمه ونوع الطلب وكلمة السر لا غير، وتظهر «وصل طلب ترجمة نبذته»، وتُحفظ كلمة السر', JSON.stringify(sent[1]) === JSON.stringify({ password: 'open-sesame', mal: 52701, what: 'about', title: 'Dungeon Meshi' })
    && /وصل طلب ترجمة نبذته وهو ينتظر/.test((await trBox('about')).ok) && !(await trBox('about')).btn && await page.evaluate(() => localStorage.getItem('animeg.pass') === 'open-sesame' && Object.keys(JSON.parse(localStorage.getItem('animeg.asked'))).join() === '52701:about'), [sent[1], await trBox('about')]);
  await snap('4-sheet'); await overflow('بطاقة العمل');
  await tap('#sheet [data-act=score][data-r="9"]');
  check('التقييم يُحفظ ويظهر ختماً على السِل', (await log())[52701].r === 9 && await page.getAttribute('#sheet [data-act=score][data-r="9"]', 'aria-pressed') === 'true' && await page.textContent('#grid .cel[data-id="52701"] .stamp') === '9');
  await tap('#sheet [data-act=score][data-r="9"]'); check('وضغط الرقم ثانية يزيله', !(await log())[52701].r && await page.locator('#grid .cel[data-id="52701"] .stamp').count() === 0);
  await page.fill('#ep-n', '10'); await page.dispatchEvent('#ep-n', 'change');
  await page.fill('#ep-n', '24'); await page.dispatchEvent('#ep-n', 'change');
  check('كتابة العدد كله تنقل العمل إلى «أكملته» بلا تاريخ مفترض', JSON.stringify((await log())[52701]) === `{"s":"completed","p":24,"b":"${today}"}` && /أكملت Dungeon Meshi/.test(await toastText()) && await page.getAttribute('#sheet [data-act=status][data-s=completed]', 'aria-pressed') === 'true', [(await log())[52701], await toastText()]);
  await page.fill('#ep-n', '10'); await page.dispatchEvent('#ep-n', 'change');
  check('رقم آخر حلقة يُكتب مباشرة، والنزول عن العدد كله يعيد العمل إلى ما تشاهده', (await log())[52701].p === 10 && (await log())[52701].s === 'watching' && /10 من 24/.test(await page.textContent('#sheet .mine .tc span')), (await log())[52701]);
  await page.fill('#sheet input[data-k=e]', '2026-11-01'); await page.dispatchEvent('#sheet input[data-k=e]', 'change');
  check('تاريخ النهاية يُحفظ', (await log())[52701].e === '2026-11-01');
  await tap('#sheet [data-act=status][data-s=hold]');
  check('تغيير الحالة ينقل العمل بين القوائم ولا يمس تواريخه', (await log())[52701].s === 'hold' && (await log())[52701].e === '2026-11-01' && (await lists())[2] === 'مؤجَّل 2' && await page.getAttribute('#sheet [data-act=status][data-s=hold]', 'aria-pressed') === 'true');
  await tap('#sheet [data-act=remove]');
  check('الإزالة من القائمة مع «تراجع»', !(await log())[52701] && /ليس في قائمتك/.test(await page.textContent('#sheet .mine')) && (await lists())[5] === 'الكل 12');
  await tap('#toast [data-act=undo]'); check('والتراجع يعيد سجله كله', JSON.stringify((await log())[52701]) === `{"s":"hold","p":10,"b":"${today}","e":"2026-11-01"}`, (await log())[52701]);
  await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' });
  check('الرجوع يغلق البطاقة ويعيد العنوان', await page.evaluate(() => !document.querySelector('#sheet').open && location.hash === ''));
  // «وين أشاهد» بدقة الموسم: منصات الموسم نفسه، أو «لا منصة لهذا الموسم» ومعها منصات المواسم الأخرى من مسلسله
  await page.goto('about:blank'); await page.goto(base + '/anime/#a5114'); await page.waitForSelector('#sheet[open] .where');
  check('منصات لموسم العمل نفسه: تُعرض ويقال إنها لهذا الموسم', await page.evaluate(() => { const w = document.querySelector('#sheet .where'); return w.querySelector('.wl a').textContent === 'Crunchyroll' && /وهي لهذا الموسم بعينه/.test(w.textContent) && !/للمسلسل كله/.test(w.textContent); }));
  await page.goto('about:blank'); await page.goto(base + '/anime/#a37989'); await page.waitForSelector('#sheet[open] .where');
  check('لا منصة لهذا الموسم هنا: يقال ذلك، وتُذكر منصات المواسم الأخرى برابط صفحة المسلسل', await page.evaluate(() => { const w = document.querySelector('#sheet .where'), r = w.querySelector('.wrow'); return /منصة تعرض هذا الموسم في السعودية حالياً/.test(w.textContent)
    && r?.querySelector('b').textContent === 'مواسم أخرى من المسلسل' && r.querySelector('a').textContent === 'Netflix' && r.querySelector('a').href === 'https://www.themoviedb.org/tv/1/watch?locale=SA'; }));
  await overflow('أين تشاهده بدقة الموسم');
  await page.goto('about:blank'); await page.goto(base + '/anime/#a11061'); await page.waitForSelector('#sheet[open]'); await page.waitForFunction(() => !!document.querySelector('#sheet-body .ov:not(.en)'));
  check('نبذة مترجمة: لا زر طلب', await page.evaluate(() => !document.querySelector('#sheet .tr[data-what=about]')));
  check('رابط مباشر يفتح العمل بنبذته العربية وسلسلته', await page.evaluate(() => /Gon Freecss/.test(document.querySelector('#sheet-body .ov').textContent) && /من سلسلة Hunter x Hunter/.test(document.querySelector('#sheet-body').textContent) && /العمل 3 من 4/.test(document.querySelector('#sheet-body').textContent)
    && document.querySelectorAll('#sheet .strip button:not(.rl-a)').length === 4 && document.querySelector('#sheet .strip [aria-current=true]').getAttribute('aria-label') === 'Hunter x Hunter (2011)'));
  // «موقعه من سلسلته» تحت العنوان (E53، E57): شارة نوعه وجملة صلته (الاسم يفتح بطاقته)، والتالي في خطه، وخريطة الخط بفرعه، ورقمه في سلسلته
  const ch = await page.evaluate(() => { const c = document.querySelector('#sheet .head + .pos'); return c && { k: c.dataset.k, b: c.querySelector('.pos-b')?.textContent, t: c.querySelector('.pos-t')?.textContent,
    ids: [...c.querySelectorAll('.ch-l')].map(x => x.dataset.id), next: c.querySelector('.pos-n')?.textContent, map: c.querySelectorAll('.pos-map circle.d, .pos-map circle.here').length, branch: !!c.querySelector('.pos-map .br'), f: c.querySelector('.pos-f span')?.textContent }; });
  check('موقعه تحت العنوان: «نسخة أخرى من القصة» تعيد حكاية Hunter x Hunter (والاسم زر)، والتالي فيلمه، والخريطة بفرعها، و«3 من 4 في Hunter x Hunter، بترتيب الصدور»',
    ch?.k === 'a' && ch.b === 'نسخة أخرى من القصة' && ch.t === 'تعيد حكاية Hunter x Hunter بمعالجة أخرى، فليست تكملة له.' && ch.ids.join() === '136,13271' && /^التالي\s*فيلم\s*Hunter x Hunter Movie 1: Phantom Rouge$/.test(ch.next)
    && ch.map === 4 && ch.branch && ch.f === '3 من 4 في Hunter x Hunter، بترتيب الصدور', ch);
  await tap('#sheet .pos .ch-l[data-id="136"]'); await page.waitForFunction(() => location.hash === '#a136');
  check('لمس اسم في سطر الموقع يفتح بطاقة ذلك العمل', await page.evaluate(() => /Hunter x Hunter/.test(document.querySelector('#sheet .head h2').textContent) && location.hash === '#a136'));
  // تصنيف في بطاقة العمل زر: يخرج إلى قائمتك كلها مفروزة به، ويُغلق البطاقة بالرجوع في السجل (E63)
  await page.goto('about:blank'); await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=all]'); await tap('#grid .cel[data-id="11061"] [data-act=open]'); await page.waitForFunction(() => document.querySelector('#sheet-body').dataset.full === '11061' && !!document.querySelector('#sheet .glinks'));
  { const g = await page.getAttribute('#sheet .glinks button >> nth=0', 'data-g'); await tap('#sheet .glinks button >> nth=0'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(150);
    check('تصنيف من البطاقة يفرز قائمتك كلها به ويغلق البطاقة بلا أثر في السجل', await page.evaluate(g => !location.hash && !history.state?.p && document.querySelector('#lists [data-l=all]').getAttribute('aria-pressed') === 'true'
      && document.querySelector(`#gchips [data-g="${g}"]`)?.getAttribute('aria-pressed') === 'true' && /من تصنيف/.test(document.querySelector('#count').textContent), g)); }
  await tap('#gchips [data-g="-1"]');
  // شريط التصنيفات (E76): يُختار منه أكثر من تصنيف كمزاج الاقتراح، والشبكة ما يجمعها كلها. المختار أولاً بلا عدد، وعدد غيره كم يبقى إن أضفته، وما لا يجتمع معه لا يظهر
  { const GX = new Map(FX.anime.map(a => [a.id, a.g || []])), cells = () => page.$$eval('#grid .cel', c => c.map(x => +x.dataset.id));
    const row = () => page.$$eval('#gchips button[data-g]', b => b.map(x => x.dataset.g + (x.getAttribute('aria-pressed') === 'true' ? '*' : '') + ':' + (x.querySelector('b')?.textContent || '')));
    const all = await cells(), want = gs => all.filter(id => gs.every(g => GX.get(id).includes(g))).sort((a, b) => a - b).join(), has = (r, g) => r.find(x => x.startsWith(g + ':') || x.startsWith(g + '*:'));
    await tap('#gchips [data-g="0"]'); let r = await row();
    check('شريط التصنيفات: تصنيف واحد يفرز به، ويصير أول الشريط بلا عدد، وعدد غيره ما يجمعه معه', (await cells()).sort((a, b) => a - b).join() === want([0]) && r[0] === '-1:' && r[1] === '0*:' && has(r, 1) === `1:${want([0, 1]).split(',').filter(Boolean).length}`, [r, await cells()]);
    await tap('#gchips [data-g="1"]'); r = await row();
    check('وتصنيف ثانٍ يضاف إليه كمزاج الاقتراح: الشبكة ما يجمعهما، والعدّ يقول ذلك، وما لا يجتمع معهما يغيب', (await cells()).sort((a, b) => a - b).join() === want([0, 1]) && r.slice(1, 3).join() === '0*:,1*:' && !has(r, 2) && /من تصنيفَي أكشن ومغامرات معاً/.test(await page.textContent('#count')),
      [r, await cells(), await page.textContent('#count')]);
    await tap('#gchips [data-g="0"]'); r = await row();
    check('ولمسة ثانية على المختار ترفعه وحده', (await cells()).sort((a, b) => a - b).join() === want([1]) && r[1] === '1*:' && !r.some(x => x.startsWith('0*')) && /من تصنيف مغامرات/.test(await page.textContent('#count')), [r, await cells()]);
    await tap('#gchips [data-g="-1"]'); r = await row();
    check('و«كل التصنيفات» يرفعها كلها', (await cells()).length === all.length && r[0] === '-1*:' && !r.some(x => /\*/.test(x.split(':')[0]) && !x.startsWith('-1')), r); }
  // بطاقة من بطاقة (E77): ما يُفتح من بطاقة خطوة في السجل، فالرجوع (زره بجانب ×، أو رجوع المتصفح والجوال، أو Esc) يعيد التي قبلها إلى موضعها، و× يغلقها كلها
  { const strip = id => `#sheet-body .strip button[data-id="${id}"]`, full = id => page.waitForFunction(id => document.querySelector('#sheet-body').dataset.full === id, String(id)), y = () => page.evaluate(() => Math.round(document.querySelector('#sheet-body').scrollTop));
    await tap('#grid .cel[data-id="11061"] [data-act=open]'); await full(11061); await page.locator(strip(136)).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); const y1 = await y();
    check('أول بطاقة: لا زر رجوع', await page.evaluate(() => document.querySelector('#sheet .sback').hidden));
    await tap(strip(136)); await full(136);
    check('بطاقة من بطاقة: زر رجوع بجانب × باسم التي قبلها، ورابطها رابط الجديدة', await page.evaluate(() => { const b = document.querySelector('#sheet .sback'), r = b.getBoundingClientRect(), x = document.querySelector('#sheet .close:not(.sback)').getBoundingClientRect();
      return !b.hidden && /^رجوع إلى «Hunter x Hunter \(2011\)»$/.test(b.getAttribute('aria-label')) && location.hash === '#a136' && Math.abs(r.top - x.top) < 2 && r.width >= 40; }));
    await snap('card-back');
    await tap('#sheet .sback'); await full(11061); let y2 = await y();
    check('زر الرجوع يعيد البطاقة السابقة إلى موضعها كما تُركت، ويختفي حين لا بطاقة قبلها', y1 > 100 && Math.abs(y2 - y1) <= 2 && await page.evaluate(() => document.getElementById('sheet').open && document.querySelector('#sheet .sback').hidden && location.hash === '#a11061'), [y1, y2]);
    await tap(strip(136)); await full(136); await page.goBack(); await full(11061); y2 = await y();
    check('ورجوع المتصفح والجوال مثله', Math.abs(y2 - y1) <= 2 && await page.evaluate(() => document.getElementById('sheet').open), [y1, y2]);
    await tap(strip(136)); await full(136); await page.keyboard.press('Escape'); await full(11061);
    check('وEsc مثله', await page.evaluate(() => document.getElementById('sheet').open && location.hash === '#a11061'));
    await tap(strip(136)); await full(136); await tap(strip(13271)); await full(13271);
    check('وثالثة فوقهما: زر الرجوع باسم الثانية', /^رجوع إلى «Hunter x Hunter»$/.test(await page.getAttribute('#sheet .sback', 'aria-label') || ''), await page.getAttribute('#sheet .sback', 'aria-label'));
    await tap('#sheet .close:not(.sback)'); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.waitForTimeout(250);
    check('و× يغلقها كلها، ولا يبقى في السجل ما يعيد فتح شيء منها', await page.evaluate(() => !document.getElementById('sheet').open && !location.hash && !history.state?.p)); }
  await page.goto('about:blank'); await page.goto(base + '/anime/#a37989'); await page.waitForSelector('#sheet[open]');
  check('السجل محفوظ بعد إعادة التحميل', (await log())[37989].p === 11 && (await lists())[0] === 'أشاهده الآن 2');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });

  // ---------- البحث والفرز والنوع والأسماء
  await tap('#lists [data-l=all]'); await page.fill('#q', 'madhouse'); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 2);
  check('البحث بالاستوديو', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '11061,13271');
  await page.fill('#q', 'هنتر'); await page.waitForFunction(() => /هل تقصد/.test(document.querySelector('#count').textContent)).catch(() => {});
  check('البحث بالحروف العربية يجد العمل ويقول «هل تقصد»', await page.evaluate(() => /هل تقصد Hunter x Hunter/.test(document.querySelector('#count').textContent) && [...document.querySelectorAll('#grid .cel')].every(c => /Hunter/.test(c.textContent)) && document.querySelectorAll('#grid .cel').length >= 2), await page.textContent('#count'));
  await page.fill('#q', 'المخطوفه'); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 1).catch(() => {});
  check('والبحث بالاسم العربي من TMDB (E70): بلا فرق التاء، ولا «هل تقصد»', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join() === '199' && !/هل تقصد/.test(await page.textContent('#count')), await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id)));
  await page.fill('#q', ''); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 13);
  await page.selectOption('#type', 'Movie'); check('تصفية النوع', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '13271,199'); await page.selectOption('#type', '');
  await tap('#lists [data-l=completed]'); await page.selectOption('#sort', 'pub');
  check('الفرز بتقييم MyAnimeList', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '5114,11061,199,136', await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id)));
  await page.selectOption('#sort', 'mal'); check('وترتيب القائمة هو ترتيبها في MyAnimeList', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '11061,136,5114,199');
  await page.selectOption('#names', 'english'); check('الأسماء بالإنجليزية لمن له اسم إنجليزي', await page.textContent('#grid .cel[data-id="11061"] h3') === 'Hunter x Hunter' && await page.textContent('#grid .cel[data-id="5114"] h3') === 'Fullmetal Alchemist: Brotherhood'); await page.selectOption('#names', 'romaji');

  // ---------- «أضف أنمي»: البحث في «أنمياتي» (ومعه أقرباء السلاسل)، ثم في MyAnimeList (Jikan مُحاكى)، والإضافة بكلمة السر (الدالة مُحاكاة)
  { const jik = [], adds = [], ars = [], alq = [];
    // تفاصيل العمل كاملة لبطاقة الاطلاع ولبطاقة ما أُضيف (E69): Frieren بصورته في MyAnimeList وأقربائه ومنصته، وجزؤه الثاني بلا صورة هناك فغلافه من AniList
    const NEXT_Y = new Date().getFullYear() + 1, FULL = { 52991: { mal_id: 52991, title: 'Sousou no Frieren', title_english: "Frieren: Beyond Journey's End", title_japanese: '葬送のフリーレン', type: 'TV', source: 'Manga', episodes: 28, status: 'Finished Airing', aired: { from: '2023-09-29T00:00:00+00:00', prop: { from: { year: 2023 } } },
        duration: '24 min per ep', rating: 'PG-13 - Teens 13 or older', score: 9.3, scored_by: 600000, season: 'fall', year: 2023, images: { webp: { image_url: 'https://cdn.myanimelist.net/images/anime/1015/138006.webp' } }, studios: [{ name: 'Madhouse' }],
        genres: [{ name: 'Adventure' }, { name: 'Drama' }, { name: 'Fantasy' }], themes: [], demographics: [{ name: 'Shounen' }], synopsis: "During their decade-long quest to defeat the Demon King, the members of the hero's party grew close.\n\n[Written by MAL Rewrite]", trailer: { youtube_id: 'qgQ3wBnB6dE' },
        relations: [{ relation: 'Sequel', entry: [{ mal_id: 56876, type: 'anime', name: 'Sousou no Frieren 2nd Season' }] }, { relation: 'Adaptation', entry: [{ mal_id: 126287, type: 'manga', name: 'Sousou no Frieren' }] }, { relation: 'Side Story', entry: [{ mal_id: 11061, type: 'anime', name: 'Hunter x Hunter (2011)' }] }],
        streaming: [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQX4' }] },
      56876: { mal_id: 56876, title: 'Sousou no Frieren 2nd Season', type: 'TV', episodes: null, status: 'Not yet aired', aired: { prop: { from: { year: NEXT_Y, month: null, day: null } } }, images: { jpg: { image_url: 'https://cdn.myanimelist.net/img/sp/icon/apple-touch-icon-256.png' } }, rating: 'PG-13 - Teens 13 or older', synopsis: null,
        relations: [{ relation: 'Prequel', entry: [{ mal_id: 52991, type: 'anime', name: 'Sousou no Frieren' }] }], streaming: [] } };
    const AL = { 52991: { id: 154587, title: { romaji: 'Sousou no Frieren' }, coverImage: { color: '#e4a15d' }, bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg', relations: { edges: [{ relationType: 'SEQUEL', node: { idMal: 56876, type: 'ANIME', title: { romaji: 'Sousou no Frieren 2nd Season' }, coverImage: { medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx182255.jpg' } } }] } },
      56876: { id: 182255, title: { romaji: 'Sousou no Frieren 2nd Season' }, description: 'The second season of <i>Frieren</i>.<br><br>(Source: Crunchyroll)', format: 'TV', status: 'NOT_YET_RELEASED', startDate: { year: NEXT_Y }, coverImage: { extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx182255.jpg', color: '#5d8fe4' }, relations: { edges: [] } } };
    const al = [];
    const ALS = { 'Attack on Titan': [{ idMal: 16498, title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan' }, format: 'TV', episodes: 25, startDate: { year: 2013 }, coverImage: { medium: '' } },
      { idMal: 25777, title: { romaji: 'Shingeki no Kyojin Season 2', english: 'Attack on Titan Season 2' }, format: 'TV', episodes: 12, startDate: { year: 2017 }, coverImage: { medium: '' } }] };
    await page.route('https://graphql.anilist.co/**', r => { const b = JSON.parse(r.request().postData() || '{}');
      if (b.variables && 'q0' in b.variables) { const v = Object.entries(b.variables); alq.push(v.map(x => x[1])); return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data: Object.fromEntries(v.map(([k, q]) => ['p' + k.slice(1), { media: ALS[q] || [] }])) }) }); }
      al.push(b.variables?.id); return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data: { Media: AL[b.variables?.id] || null } }) }); });
    await page.route('https://api.jikan.moe/**', r => { const u = new URL(r.request().url()); jik.push(u.pathname + u.search); const q = u.searchParams.get('q'), full = /\/anime\/(\d+)\/full$/.exec(u.pathname);
      if (full) return r.fulfill({ status: FULL[full[1]] ? 200 : 404, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(FULL[full[1]] ? { data: FULL[full[1]] } : { status: 404 }) });
      const im = n => ({ webp: { small_image_url: `https://cdn.myanimelist.net/images/anime/1/${n}t.webp` } });
      return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data: q === 'frieren' ? [
        { mal_id: 52991, title: 'Sousou no Frieren', title_english: "Frieren: Beyond Journey's End", type: 'TV', episodes: 28, year: 2023, images: im(1), rating: 'PG-13 - Teens 13 or older' },
        { mal_id: 11061, title: 'Hunter x Hunter (2011)', type: 'TV', episodes: 148, year: 2011, images: im(2), rating: 'PG-13 - Teens 13 or older' },
        { mal_id: 99990, title: 'Should Not Appear', type: 'OVA', episodes: 2, images: im(3), rating: 'Rx - Hentai' },
        { mal_id: 56876, title: 'Sousou no Frieren 2nd Season', type: 'TV', episodes: null, year: null, aired: { prop: { from: { year: 2026 } } }, images: {}, rating: 'PG-13 - Teens 13 or older' }] : [] }) }); });
    await page.route(base + '/api/anime-add', r => { const b = JSON.parse(r.request().postData() || '{}');
      if (b.action === 'ar') { ars.push(b); return b.password !== 'open-sesame' ? r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"password"}' })
        : r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: b.q === 'العمالقة' ? [{ tmdb: 1429, kind: 'tv', en: 'Attack on Titan', orig: '進撃の巨人', year: 2013 }] : [] }) }); }
      adds.push(b);
      return b.password !== 'open-sesame' ? r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"password"}' }) : r.fulfill({ contentType: 'application/json', body: '{"state":"added"}' }); });
    const rows = () => page.$$eval('#add-res .arow', r => r.map(x => (x.dataset.id || 'mal' + x.dataset.mal) + ':' + (x.querySelector('.astate')?.textContent.trim() || x.querySelectorAll('.aacts .btn').length)));
    const works = () => page.evaluate(() => +(document.querySelector('#tally b')?.textContent || '').replace(/\D/g, '') || 0);
    await tap('.top [data-act=add]'); await page.waitForSelector('#addd[open]');
    check('«أضف أنمي»: نافذة بعنوانها في الرابط، والمؤشر في خانة البحث', await page.evaluate(() => location.hash === '#add' && document.activeElement?.id === 'add-q' && /اكتب اسم العمل/.test(document.querySelector('#add-res').textContent)));
    await page.fill('#add-q', 'hunter'); await page.waitForFunction(() => document.querySelectorAll('#add-res .arow').length === 4);
    check('البحث في كل ما في «أنمياتي»: ما في قائمتك بحالته، والقريب الذي ليس فيها بزرّي الإضافة، بترتيب الصدور', (await rows()).join(' | ') === '136:في «أكملته» | 137:2 | 11061:في «أكملته» | 13271:في «سأشاهده»', await rows());
    await tap('#add-res .arow[data-id="137"] [data-act=add-to][data-s=plan]');
    check('إضافته إلى «سأشاهده» تدخل سجلّك وتتغير حالته في النافذة، ومعها «تراجع» ظاهر فوق النافذة', JSON.stringify((await log())[137]) === '{"s":"plan"}' && (await rows())[1] === '137:في «سأشاهده»' && /سأشاهده/.test(await toastText())
      && await page.evaluate(() => document.querySelector('#toast').closest('dialog')?.id === 'addd'), [await rows(), await toastText()]);
    await tap('#toast [data-act=undo]');
    check('و«تراجع» يعيده كما كان، والنافذة تتحدث', (await log())[137] === undefined && (await rows())[1] === '137:2', await rows());
    await tap('#add-res .arow[data-id="11061"] .aart'); await page.waitForSelector('#sheet[open]');
    const inCard = await page.evaluate(() => location.hash); await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' });
    check('بطاقة عمل من النافذة تُفتح فوقها، والرجوع يغلق البطاقة وحدها', inCard === '#a11061' && await page.evaluate(() => document.querySelector('#addd').open && location.hash === '#add'), inCard);
    await page.fill('#add-q', 'frieren'); await page.waitForFunction(() => /لا عمل في «أنمياتي» بهذا الاسم/.test(document.querySelector('#add-res').textContent));
    check('ما ليس في «أنمياتي»: لا يُسأل MyAnimeList حتى تطلب، وزر البحث فيه باسم ما كتبت', !jik.length && /ابحث في MyAnimeList عن «frieren»/.test(await page.textContent('#add-res [data-act=add-find]')), jik);
    await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arow[data-mal]');
    check('Enter يبحث في MyAnimeList: الجديد تحت عنوانه، وما في «أنمياتي» منه معه أعلاه، والإباحي لا يظهر', jik.length === 1 && /q=frieren/.test(jik[0]) && /sfw=true/.test(jik[0])
      && (await rows()).join(' | ') === '11061:في «أكملته» | mal52991:2 | mal56876:2' && /2026/.test(await page.textContent('#add-res .arow[data-mal="56876"] .meta')) && /28 حلقة/.test(await page.textContent('#add-res .arow[data-mal="52991"] .meta')), [jik, await rows()]);
    await snap('9-add'); await overflow('أضف أنمي');
    // بطاقة اطلاع لما ليس في «أنمياتي» (E69): اسمه أو غلافه في النتائج يفتحها فوق النافذة، معلوماته من MyAnimeList مباشرة، وأقرباؤه يُفتحون منها
    await tap('#add-res .arow[data-mal="52991"] .ainfo'); await page.waitForSelector('#sheet[open] .pkadd'); await page.waitForSelector('#sheet-body .strip.rel');
    const pk = () => page.evaluate(() => { const b = document.querySelector('#sheet-body'); return { hash: location.hash, h: b.querySelector('h2')?.textContent, alt: [...b.querySelectorAll('.alt')].map(x => x.textContent), facts: b.querySelector('.facts')?.textContent || '', ov: b.querySelector('.ov.en')?.textContent || '', tr: !!b.querySelector('.tr'),
      adds: [...b.querySelectorAll('.pkadd [data-act=add-live]')].map(x => x.dataset.s).join(), mine: !!b.querySelector('.mine:not(.pkadd)'), pos: !!b.querySelector('.pos'), rel: [...b.querySelectorAll('.strip.rel button[data-id]')].map(x => x.dataset.act + ':' + x.dataset.id + ':' + x.querySelector('small')?.textContent),
      stream: [...b.querySelectorAll('.where .wl a')].map(a => a.textContent).join(), links: [...b.querySelectorAll('.links a')].map(a => a.textContent.trim()).join(), img: b.querySelector('.cel-art img')?.getAttribute('src') || '', air: [...b.querySelectorAll('.air :is(.hanko, .air-d, .air-r)')].map(x => x.textContent).join('|'), hero: b.querySelector('.hero img')?.getAttribute('src') || '', note: [...b.querySelectorAll('.lbl')].map(x => x.textContent).join(' | ') }; });
    let v = await pk();
    check('بطاقة اطلاع من النتائج: فوق النافذة برابطها، باسمه ونوعه وحلقاته وتقييمه واستوديوه من MyAnimeList، والنبذة بالإنجليزية بلا توقيعها، ولا سجل ولا سلسلة من الكتالوج', v.hash === '#a52991' && v.h === 'Sousou no Frieren' && v.alt.includes("Frieren: Beyond Journey's End") && v.alt.includes('葬送のフリーレン')
      && /28 حلقة/.test(v.facts) && /24 دقيقة للحلقة/.test(v.facts) && /خريف 2023/.test(v.facts) && /Madhouse/.test(v.facts) && /9\.30/.test(v.facts) && /^During their decade-long quest/.test(v.ov) && !/Written by/.test(v.ov) && !v.tr && !v.mine && !v.pos
      && v.adds === 'plan,watching' && /ليس في «أنمياتي». هذه بطاقة للاطلاع/.test(v.note) && /cdn\.myanimelist\.net\/images\/anime\/1015\/138006\.webp$/.test(v.img) && /anilist\.co.*banner/.test(v.hero) && await page.evaluate(() => document.querySelector('#addd').open), v);
    check('وأقرباؤه كما في MyAnimeList: الأنمي وحده (لا المانغا)، بصلته، وما في «أنمياتي» يفتح بطاقته وما ليس فيها بطاقة اطلاع؛ ومنصته الرسمية، وصفحاته معها AniList والإعلان', v.rel.join() === 'peek:56876:الجزء التالي,open:11061:قصة جانبية' && v.stream === 'Crunchyroll' && v.links === 'MyAnimeList,AniList,YouTube', v);
    await overflow('بطاقة الاطلاع'); await snap('9b-peek');
    await tap('#sheet-body .strip.rel button[data-id="56876"]'); await page.waitForFunction(() => location.hash === '#a56876' && /second season/i.test(document.querySelector('#sheet-body .ov.en')?.textContent || ''));
    v = await pk();
    check('وقريب ليس في «أنمياتي» بطاقة اطلاع خطوةً في السجل: ما لا صورة له في MyAnimeList غلافه من AniList، ونبذته من هناك بلا وسومها ولا مصدرها، وموعده سنة بلا شهر: ختم «مستقبلاً» و«العام القادم» (E70)', /s4\.anilist\.co.*cover\/large\/bx182255/.test(v.img) && v.ov === 'The second season of Frieren.' && v.facts.includes(String(NEXT_Y)) && v.air === `مستقبلاً|${NEXT_Y}|العام القادم` && v.rel.join() === 'peek:52991:الجزء السابق', v);
    check('وزر الرجوع بجانب × باسم البطاقة التي فُتحت منها (E77)', await page.evaluate(() => { const b = document.querySelector('#sheet .sback'); return !b.hidden && b.getAttribute('aria-label') === 'رجوع إلى «Sousou no Frieren»'; }));
    await page.goBack(); await page.waitForFunction(() => location.hash === '#a52991' && document.querySelector('#sheet-body h2')?.textContent === 'Sousou no Frieren');
    await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' });
    check('والرجوع يعيد البطاقة التي فُتح منها، ثم يغلقها إلى النافذة', await page.evaluate(() => document.querySelector('#addd').open && location.hash === '#add'));
    // الاسم العربي (E70): أعمال «أنمياتي» تُعرف بأسمائها العربية من TMDB (an)، وما ليس فيها يُبحث عنه في TMDB عبر الموقع ثم في AniList بأسمائه الإنجليزية
    await page.fill('#add-q', 'مخطوفه'); await page.waitForFunction(() => document.querySelectorAll('#add-res .arow').length === 1 && !!document.querySelector('#add-res .aar'));
    check('اسم عربي لعمل في «أنمياتي»: يُعرف باسمه العربي من TMDB بلا «ال» ولا فرق التاء، والاسم المطابق تحت اسمه، وزر البحث خارجها باسمه العربي', await page.evaluate(() => { const r = document.querySelector('#add-res .arow'); return r.dataset.id === '199' && r.querySelector('.aar').textContent === 'المخطوفة'; })
      && /ابحث عن «مخطوفه» باسمه العربي/.test(await page.textContent('#add-res [data-act=add-find]')));
    await page.fill('#add-q', 'العمالقة'); await page.waitForFunction(() => /ابحث عن «العمالقة» باسمه العربي/.test(document.querySelector('#add-res').textContent));
    check('وما لا يطابق اسماً حرفياً فما يظهر من «أنمياتي» يقال إنه أقرب الأسماء نطقاً، لا العمل نفسه', await page.evaluate(() => { const n = document.querySelectorAll('#add-res .ares .arow').length, t = document.querySelector('#add-res').textContent; return n ? /أقرب الأسماء إليه نطقاً/.test(t) : /لا عمل في «أنمياتي» بهذا الاسم/.test(t); }));
    const j0 = jik.length; await page.evaluate(() => localStorage.removeItem('animeg.pass'));   // حفظها قسم «ترجمها لي»
    await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arpass .add-pass');
    check('وما ليس فيها: البحث باسمه العربي يمرّ بـTMDB عبر الموقع، فتُطلب كلمة السر أول مرة، ولا يُسأل MyAnimeList بالعربية', !ars.length && jik.length === j0 && /لا يعرف الأسماء العربية/.test(await page.textContent('#add-res .arpass')), [ars, jik.slice(j0)]);
    await page.fill('#add-res .arpass .add-pass', 'nope'); await page.press('#add-res .arpass .add-pass', 'Enter'); await page.waitForFunction(() => /كلمة السر غير صحيحة/.test(document.querySelector('#add-res .arpass')?.textContent || ''));
    await page.fill('#add-res .arpass .add-pass', 'open-sesame'); await tap('#add-res [data-act=ar-go]'); await page.waitForSelector('#add-res .arow[data-mal]');
    check('كلمة السر الصحيحة: يجد TMDB الاسم، وتُبحث أسماؤه الإنجليزية في AniList، فالنتائج بأرقام MyAnimeList ومعها ما وُجد في TMDB، وكلمة السر تُحفظ', ars.length === 2 && ars[1].q === 'العمالقة' && alq.at(-1)?.join() === 'Attack on Titan'
      && (await rows()).filter(r => r.startsWith('mal')).join(' | ') === 'mal16498:2 | mal25777:2' && /فوجدنا: Attack on Titan/.test(await page.textContent('#add-res')) && !!(await page.$('#add-res [data-act=add-as][data-q="Attack on Titan"]')) && await page.evaluate(() => localStorage.getItem('animeg.pass') === 'open-sesame'), [ars, alq, await rows()]);
    await snap('9c-ar'); await overflow('البحث بالاسم العربي');
    await page.fill('#add-q', 'غرابة'); await page.press('#add-q', 'Enter'); await page.waitForFunction(() => /لم يجد TMDB أنمي بهذا الاسم العربي/.test(document.querySelector('#add-res').textContent));
    check('وما لا يجده TMDB يقال ذلك ويُقترح اسمه بالإنجليزية أو اليابانية، بكلمة السر المحفوظة بلا سؤال', ars.length === 3 && ars[2].password === 'open-sesame', ars.length);
    await page.fill('#add-q', 'frieren'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arow[data-mal="52991"]');
    const w0 = await works(); await page.evaluate(() => localStorage.removeItem('animeg.pass'));   // حفظها قسم «ترجمها لي»
    await tap('#add-res .arow[data-mal="52991"] [data-act=add-mal][data-s=plan]'); await page.waitForSelector('#add-res .add-pass');
    check('أول إضافة من MyAnimeList بلا كلمة سر محفوظة: تُطلب كلمة السر ولا يُرسل شيء', !adds.length && await page.evaluate(() => document.activeElement?.classList.contains('add-pass')));
    await page.fill('#add-res .add-pass', 'nope'); await page.press('#add-res .add-pass', 'Enter'); await page.waitForFunction(() => /كلمة السر غير صحيحة/.test(document.querySelector('#add-res .msg')?.textContent || ''));
    check('كلمة سر خاطئة: تقال، وتُفرغ الخانة، ولا يدخل سجلّك شيء', adds.length === 1 && await page.inputValue('#add-res .add-pass') === '' && (await log())[52991] === undefined, adds);
    await page.fill('#add-res .add-pass', 'open-sesame'); await tap('#add-res .arow[data-mal="52991"] [data-act=add-mal][data-s=plan]'); await page.waitForSelector('#add-res .arow[data-mal="52991"] .astate');
    const sent = adds.at(-1), keys = Object.keys(sent).sort().join();
    check('تُرسل الإضافة رقم العمل واسمه ونوعه وحلقاته فقط، ويدخل سجلّك «سأشاهده»، وصفّه يبقى في موضعه بحالته ومعه «بطاقته»', keys === 'eps,mal,password,title,type' && sent.mal === 52991 && sent.title === 'Sousou no Frieren' && sent.type === 'TV' && sent.eps === 28
      && JSON.stringify((await log())[52991]) === '{"s":"plan"}' && /أُضيف إلى «سأشاهده»/.test(await page.textContent('#add-res .arow[data-mal="52991"] .astate')) && await page.locator('#add-res .arow[data-mal="52991"] .aacts [data-act=open][data-id="52991"]').count() === 1 && await page.locator('#add-res .arow[data-mal="52991"] :is(.aart, .ainfo)[data-act=open]').count() === 2 && await works() === w0 + 1
      && (await rows()).join(' | ') === '11061:في «أكملته» | mal52991:أُضيف إلى «سأشاهده» | mal56876:2' && /اضغط اسم العمل أو غلافه تفتح بطاقته/.test(await page.textContent('#add-res'))
      && await page.evaluate(() => { const a = JSON.parse(localStorage.getItem('animeg.added'))[52991]; return a?.s === 'plan' && a.ty === 'TV' && a.n === 28 && a.y === 2023 && a.ad === undefined && localStorage.getItem('animeg.pass') === 'open-sesame'; }), [sent, await works(), w0, await rows()]);
    await tap('#add-res .arow[data-mal="56876"] .aart'); await page.waitForSelector('#sheet[open] .pkadd'); await page.waitForFunction(() => /second season/i.test(document.querySelector('#sheet-body .ov.en')?.textContent || ''));
    await tap('#sheet-body .pkadd [data-act=add-live][data-s=watching]'); await page.waitForSelector('#sheet-body .mine:not(.pkadd)');
    v = await pk();
    check('ومن بطاقة الاطلاع: كلمة السر محفوظة فيُضاف بلا سؤال إلى القائمة التي اخترتها، وتصير البطاقة بطاقته في قائمتك بغلافه ونبذته (وطلب ترجمتها)، وصفّه في النافذة يتحدث', adds.length === 3 && adds[2].password === 'open-sesame' && adds[2].mal === 56876 && adds[2].eps === 0
      && JSON.stringify((await log())[56876]) === '{"s":"watching"}' && v.hash === '#a56876' && v.mine && v.tr && !v.adds && /أُضيف من MyAnimeList ولم يدخل بياناتك بعد/.test(v.note) && /s4\.anilist\.co/.test(v.img) && /أُضيف إلى «أشاهده الآن»/.test(await page.textContent('#add-res .arow[data-mal="56876"] .astate'))
      && await page.evaluate(() => /^https:\/\/s4\.anilist\.co\//.test(JSON.parse(localStorage.getItem('animeg.added'))[56876]?.iu || '')), [adds.slice(2), v]);
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    await page.keyboard.press('Escape'); await page.waitForSelector('#addd', { state: 'hidden' });
    await tap('#lists [data-l=plan]');
    check('Esc يغلق النافذة برابط نظيف، وما أضفته يظهر في قائمته فوراً ببطاقة مؤقتة مما عاد به البحث', await page.evaluate(() => { const c = document.querySelector('#grid .cel[data-id="52991"]');
      return location.hash === '' && !!c && c.querySelector('h3').textContent === 'Sousou no Frieren' && /2023/.test(c.querySelector('.meta').textContent) && /28 حلقة/.test(c.querySelector('.meta').textContent) && /s4\.anilist\.co/.test(document.querySelector('.rail .cel[data-id="56876"] img')?.getAttribute('src') || ''); }), await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id)));
    await tap('#grid .cel[data-id="52991"] [data-act=open]'); await page.waitForSelector('#sheet[open]');
    await page.waitForSelector('#sheet-body .ov.en'); v = await pk();
    check('وبطاقته ليست فارغة (E69): معلوماته من MyAnimeList مباشرة وتقول ذلك، ونبذته وطلب ترجمتها وأقرباؤه، وسجلّه فيها يُعدَّل، ولا سلسلة من الكتالوج بعد', /أُضيف من MyAnimeList ولم يدخل بياناتك بعد/.test(v.note) && /^During their decade-long quest/.test(v.ov) && v.tr && v.mine && !v.pos && /Madhouse/.test(v.facts)
      && v.rel.join() === 'open:56876:الجزء التالي,open:11061:قصة جانبية' && /1015\/138006\.webp$/.test(v.img), v);
    await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' });
    await page.reload(); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=plan]');
    check('وتبقى بطاقته المؤقتة بعد تحديث الصفحة حتى يدخل الكتالوج', await page.locator('#grid .cel[data-id="52991"]').count() === 1);
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('animeg.progress')); delete p.a[52991]; delete p.a[56876]; localStorage.setItem('animeg.progress', JSON.stringify(p)); localStorage.removeItem('animeg.added'); });
    await page.reload(); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=completed]'); }

  // ---------- موعد ما لم يُعرض بعد (E70): ختم «قريباً» أو «مستقبلاً»، والموعد بدقة ما يُعرف منه، وعدّه الحي حين يُعرف اليوم وإلا فالمدة تقريباً:
  // في خانته وبطاقته وخط عالمه. وعدّ الحلقة القادمة لما يُعرض الآن
  { const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], up = FX.anime.find(a => a.id === 61000), ova = FX.anime.find(a => a.id === 137), keep = [{ ...up }, { ...ova }];
    const atDay = n => new Date(Date.now() + n * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), arDate = d => { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MON[m - 1]} ${y}`; }, [uy, um] = up.from.split('-').map(Number);
    const cel = () => page.evaluate(() => { const c = document.querySelector('#grid .cel[data-id="61000"]'); return { seal: c.querySelector('.hanko')?.textContent, band: c.querySelector('.next')?.textContent.replace(/\s+/g, ' ').trim(), until: c.querySelector('.next')?.dataset.until || '', meta: c.querySelector('.meta').textContent, dg: c.querySelector('.ck-d .dg')?.textContent || '' }; });
    const air = () => page.evaluate(() => { const s = document.querySelector('#sheet-body .air'); return s && { k: s.className, seal: s.querySelector('.hanko').textContent, lbl: s.querySelector('.air-t small').textContent, d: s.querySelector('.air-d').textContent, sub: s.querySelector('.air-s')?.textContent || '', r: s.querySelector('.air-r')?.textContent || '', until: s.dataset.until || '',
      dg: s.querySelector('.ck-d .dg')?.textContent || '', t: s.querySelector('.ck-t')?.textContent || '', sr: s.querySelector('.sr-time')?.textContent || '', facts: document.querySelector('#sheet-body .facts').textContent }; });
    await tap('#lists [data-l=plan]'); await page.waitForSelector('#grid .cel[data-id="61000"]');
    let c = await cel();
    check('ما لم يُعرض وموعده شهر بلا يوم: ختم «مستقبلاً» على صورته، والمدة تقريباً بلا عدّاد يدّعي يوماً، والشهر في سطره', c.seal === 'مستقبلاً' && c.band === 'بعد نحو 5 أشهر' && !c.until && c.meta === `مسلسل · ${MON[um - 1]} ${uy}`, c);
    await tap('#grid .cel[data-id="61000"] [data-act=open]'); await page.waitForSelector('#sheet[open] .air');
    let s = await air();
    check('وفي بطاقته: الختم والشهر والمدة تقريباً، و«لم يُعرض بعد» لا تتكرر في حقائقه', s.k === 'air far' && s.seal === 'مستقبلاً' && s.lbl.startsWith('موعد عرضه') && s.d === `${MON[um - 1]} ${uy}` && s.r === 'بعد نحو 5 أشهر' && !s.until && !s.t && !/لم يُعرض بعد/.test(s.facts), s);
    const stamped = () => page.waitForFunction(() => [...document.querySelectorAll('#sheet-body .air .hanko')].every(h => h.getAnimations().every(a => a.playState === 'finished')));
    await stamped(); await snap('20-air-far'); await overflow('موعد بلا يوم');
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    // يُعرف اليوم: «قريباً» وعدّ حي، في الخانة والبطاقة وخط العالم
    const when = atDay(20); Object.assign(up, { from: when, y: +when.slice(0, 4) }); Object.assign(ova, { st: 'soon', from: when });
    await page.reload(); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=plan]'); await page.waitForSelector('#grid .cel[data-id="61000"] .air-band');
    c = await cel();
    check('ما عُرف يومه وهو قريب: ختم «قريباً»، وشريط عدّ حي على صورته بالأيام والساعات، وتاريخه في سطره', c.seal === 'قريباً' && c.until === when && /^(19|20)$/.test(c.dg) && /^يُعرض بعد/.test(c.band) && c.meta === `مسلسل · ${arDate(when)}`, c);
    await page.locator('#grid .cel[data-id="61000"]').scrollIntoViewIfNeeded(); await snap('21a-air-cel');
    await tap('#grid .cel[data-id="61000"] [data-act=open]'); await page.waitForSelector('#sheet[open] .air .ck'); s = await air();
    await page.waitForFunction(t => document.querySelector('#sheet-body .air .ck-t')?.textContent !== t, s.t, { timeout: 4000 }).catch(() => {}); const t2 = (await air()).t, vis = await page.evaluate(() => document.visibilityState);
    check('وفي بطاقته: الختم والتاريخ بيومه من الأسبوع، والعدّ يتحرك كل ثانية، ولقارئ الشاشة المدة بالكلمات', s.k === 'air near' && s.seal === 'قريباً' && s.d === arDate(when) && s.sub === new Date(when + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long' })
      && s.until === when && /^(19|20)$/.test(s.dg) && s.t !== t2 && /^باقٍ (19|20) يوماً/.test(s.sr), [s, t2, vis]);
    await stamped(); await snap('21-air-near'); await overflow('عدّ ما لم يُعرض');
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    await page.evaluate(() => { location.hash = '#a21'; }); await page.waitForSelector('#sheet[open] .air'); s = await air();
    check('ويُعرض الآن: الحلقة القادمة برقمها وتاريخها وعدّها، بختم «يُعرض الآن»', s.k === 'air on' && s.seal === 'يُعرض الآن' && s.lbl.startsWith('الحلقة 1,156') && s.d === arDate(atDay(3)) && /^[23]$/.test(s.dg), s);
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    await tap('[data-act=view][data-v=worlds]'); await page.waitForSelector('#worlds .wc'); await tap('#worlds button.wc'); await page.waitForSelector('#wsheet .gn');
    const g = await page.evaluate(() => { const n = document.querySelector('#wsheet .gn-b[data-id="137"]').closest('.gn'), a = n.querySelector('.gn-air'); return { k: a?.className, seal: a?.querySelector('.hanko').textContent, d: a?.querySelector('.gn-ad').textContent, until: a?.dataset.until, dg: a?.querySelector('.ck-d .dg')?.textContent || '', meta: n.querySelector('.gn-t small').textContent }; });
    check('وفي خط العالم: سطر تحت اسمه بالختم والتاريخ والعدّ، وسطر نوعه بلا «لم يُعرض بعد»', g.k === 'gn-air near' && g.seal === 'قريباً' && g.d === arDate(when) && g.until === when && /^(19|20)$/.test(g.dg) && !/لم يُعرض بعد/.test(g.meta), g);
    await page.locator('#wsheet .gn-b[data-id="137"]').scrollIntoViewIfNeeded(); await snap('22-air-gate'); await overflow('موعد في خط العالم');
    Object.assign(up, keep[0]); Object.assign(ova, keep[1]);
    await page.keyboard.press('Escape'); await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=completed]'); }

  // ---------- السلاسل
  await tap('[data-act=view][data-v=worlds]'); await page.waitForSelector('#worlds .wc');
  check('السلاسل: مدخل دليل Fate أولاً، ثم سلاسل القائمة بتقدّمك فيها', await page.evaluate(() => { const c = [...document.querySelectorAll('#worlds .wc')]; return c.length === 3 && c[0].matches('a.fate[href="../fate/"]') && !!c[0].querySelector('img') && c[1].querySelector('h3').textContent === 'Hunter x Hunter'
    && /4 أعمال · في قائمتك 3 · أكملت 2/.test(c[1].textContent) && document.querySelector('#lists').hidden && /سلسلتان فيها أعمال من قائمتك/.test(document.querySelector('#count').textContent); }), await page.$$eval('#worlds .wc', c => c.map(x => x.textContent.slice(0, 60))));
  await snap('5-worlds'); await overflow('السلاسل');
  // بوابة العالم (E57): تنفتح من بطاقته بثيمه، وفيها أرقامه وتقدّمك و«كمّل»، و«عن هذا العالم» و«الحكاية»، وخطه الزمني بمحطاته
  await tap('#worlds button.wc'); await page.waitForSelector('#wsheet[open].gw'); await page.waitForSelector('#wsheet .gn');
  const nodes = () => page.$$eval('#wsheet .gn', r => r.map(x => x.querySelector('.gn-b').dataset.id + ':' + (x.querySelector('.chip')?.textContent || '')));
  check('البوابة: محطات العالم بترتيب الصدور وحالة كل منها، وسنوات الصدور على السكة', (await nodes()).join('|') === '136:أكملته · 10|137:|11061:أكملته · 10|13271:سأشاهده'
    && (await page.$$eval('#wsheet .gy span', r => r.map(x => x.textContent))).join() === '1999,2002,2011,2013', await nodes());
  check('البوابة بثيم عالمها: ألوانه على النافذة، وسماؤها بنقشه وصورته', await page.evaluate(() => { const d = document.querySelector('#wsheet'), sky = d.querySelector('.gw-sky');
    return /--c1:/.test(d.style.cssText) && /--bg:/.test(d.style.cssText) && !!sky && /\bm-[a-z]+/.test(sky.className) && !!sky.querySelector('.gw-art'); }));
  check('محطة ما في الخط الرئيسي على السكة، والنسخة الأخرى فرع بلونها، وشارة موقع كل منها', await page.evaluate(() => { const g = id => document.querySelector(`#wsheet .gn-b[data-id="${id}"]`).closest('.gn');
    return !g(136).classList.contains('side') && g(11061).classList.contains('side') && g(11061).dataset.k === 'a' && g(136).querySelector('.gn-k').textContent.startsWith('بداية العالم') && /نسخة أخرى من القصة/.test(g(11061).querySelector('.gn-k').textContent); }));
  await page.waitForSelector('#gw-about .ov');
  check('البوابة: «عن هذا العالم» و«الحكاية» (نبذة العمل الذي يحمل اسمه)، وأرقامه وسنواته وتقدّمك فيه', await page.evaluate(() => { const t = document.querySelector('#wsheet-body').textContent, [about, tale] = document.querySelectorAll('#gw-about .gw-about');
    return about.querySelector('h2').textContent === 'عن هذا العالم' && /يوشيهيرو توغاشي/.test(about.querySelector('.ov').textContent) && tale.querySelector('h2').textContent === 'الحكاية' && /نبذة Hunter x Hunter \(2011\)/.test(tale.textContent)
      && [...document.querySelectorAll('#wsheet .gw-stats dd')].map(x => x.textContent).join() === '4,219,' + document.querySelectorAll('#wsheet .gw-stats dd')[2]?.textContent && /1999 إلى 2013/.test(t) && /أكملت 2 من 4 أعمال/.test(t) && /شاهدت منه 210 حلقات/.test(t); }), await page.textContent('#wsheet .gw-hero'));
  check('«كمّل»: أول ما لم تكمله من القصة الرئيسية', await page.evaluate(() => { const b = document.querySelector('#wsheet .gw-go'); return !!b && b.dataset.id === '137' && /التالي لك في هذا العالم/.test(b.textContent); }));
  check('محطة ما تكمله: شارتها «أنت هنا» لا يقصها صندوق المحطة', await page.evaluate(() => { const h = document.querySelector('#wsheet .gn.here'); return !!h && h.querySelector('.gn-b').dataset.id === '137' && h.querySelector('.gn-here').textContent === 'أنت هنا' && getComputedStyle(h).contentVisibility === 'visible'; }));
  if (!mobile) check('سهما شريط الخطوط لا يأخذان حشو أزراره ولا نقطتها', await page.evaluate(() => { const a = document.querySelector('#wsheet .gw-legend .rl-a'); if (!a) return 'no arrow'; const c = getComputedStyle(a); return c.paddingLeft === '0px' && c.width === c.height && getComputedStyle(a, '::before').content === 'none'; }) === true);
  check('عالم ترتيب أحداثه هو ترتيب صدوره: ترتيب واحد بلا تبديل', await page.locator('#wsheet [data-act=gw-order]').count() === 0 && /ترتيب الأحداث في هذا العالم هو ترتيب صدوره نفسه/.test(await page.textContent('#gw-line .gw-hint')));
  await snap('6-world'); await overflow('بوابة العالم'); await tap('#wsheet .gn-b[data-id="137"]'); await page.waitForSelector('#sheet[open]');
  check('البطاقة فوق البوابة تلبس ألوان عالمها', await page.evaluate(() => document.querySelector('#sheet').classList.contains('themed') && /--wc1/.test(document.querySelector('#sheet').style.cssText)));
  await tap('#sheet [data-act=status][data-s=plan]');
  check('عمل من العالم ليس في القائمة يُضاف منه، ومحطته تتحدّث', JSON.stringify((await log())[137]) === '{"s":"plan"}' && await page.textContent('#wsheet .gn-b[data-id="137"] .chip') === 'سأشاهده');
  await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.goBack(); await page.waitForSelector('#wsheet', { state: 'hidden' });
  check('الرجوع يغلق البطاقة ثم البوابة', await page.evaluate(() => !document.querySelector('#sheet').open && !document.querySelector('#wsheet').open));
  await tap('#worlds button.wc >> nth=1'); await page.waitForSelector('#wsheet[open].gw'); await page.waitForSelector('#wsheet .gn');
  const ord = () => page.$$eval('#wsheet .gn-b', r => r.map(x => x.dataset.id).join());
  const o1 = await ord(); await tap('#wsheet [data-act=gw-order][data-o=release]'); const o2 = await ord();
  check('عالم له ترتيب أحداث: تفتح بوابته عليه، و«ترتيب الصدور» يبدّله، وفيها مدخل دليل Fate', o1 === '22297,356' && o2 === '356,22297' && await page.getAttribute('#wsheet [data-o=release]', 'aria-pressed') === 'true' && await page.locator('#wsheet a.fate[href="../fate/"]').count() === 1, [o1, o2]);
  check('ترتيب مُراجَع: ملاحظته تظهر في الترتيبين، ويُقال إنه روجع حين يُعرض ترتيب الأحداث', /من يشاهد أول مرة يبدأ بترتيب الصدور/.test(await page.textContent('#wsheet .gw-note')) && !/راجعناه/.test(await page.textContent('#gw-line .gw-hint'))
    && await (async () => { await tap('#wsheet [data-act=gw-order][data-o=story]'); const t = await page.textContent('#gw-line .gw-hint'); await tap('#wsheet [data-act=gw-order][data-o=release]'); return /راجعناه عملاً عملاً/.test(t); })(), await page.textContent('#gw-line .gw-hint'));
  { const notes = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#wsheet .gn-b')].map(b => [b.dataset.id, b.querySelector('.gn-w')?.textContent.trim() || ''])));
    const rel = await notes(); await tap('#wsheet [data-act=gw-order][data-o=story]'); const sto = await notes(); await tap('#wsheet [data-act=gw-order][data-o=release]');
    check('في ترتيب الصدور «أحداثه قبل…» على ما صدر لاحقاً وأحداثه أسبق، وفي ترتيب الأحداث «صدر بعد ما يليه» عليه نفسه', rel[22297] === 'أحداثه قبل Fate/stay night' && !rel[356] && /^صدر بعد ما يليه، عام 2014$/.test(sto[22297]) && !sto[356], [rel, sto]); }
  await page.goBack(); await page.waitForSelector('#wsheet', { state: 'hidden' });
  await tap('[data-act=view][data-v=list]');

  // ---------- ورقة التوقيت: حلقات العمل في بطاقته
  { const before = JSON.stringify(await log()), rec = async id => (await log())[id], xr = () => page.$$eval('#xs .xr', r => r.map(x => x.dataset.n + (x.classList.contains('done') ? '✓' : '') + (x.classList.contains('upnext') ? '›' : '') + (x.classList.contains('fut') ? '~' : '')).join(' '));
    const undo = async () => { await tap('#toast [data-act=undo]'); await page.waitForTimeout(60); };
    await tap('.rail .cel[data-id="1735"] [data-act=open]'); await page.waitForSelector('#sheet[open]'); await page.waitForSelector('#xs .xr');
    check('ورقة التوقيت تفتح على الحلقة التالية وما حولها: آخر ما شوهد، ثم التالية، ثم ثلاث بعدها', await xr() === '393✓ 394› 395 396 397' && /500 حلقة · شاهدت 393/.test(await page.textContent('#xs h3')) && /كل الحلقات \(500\)/.test(await page.textContent('#xs [data-act=ep-all]')), await xr());
    check('عنوان الحلقة المترجم بالعربية وتحته الأصل، وغير المترجم بحروفه، وما لا عنوان له برقمه', await page.evaluate(() => { const r = n => document.querySelector(`#xs .xr[data-n="${n}"]`);
      return r(394).querySelector('.xt').textContent === 'اختبارات التشونين الجديدة' && r(394).querySelector('.xe').textContent === 'The New Chunin Exams' && /التالية/.test(r(394).querySelector('.xm').textContent) && /★ 8\.1/.test(r(394).querySelector('.xm').textContent)
        && r(395).querySelector('.xt bdi').textContent === 'The Chunin Exams Begin!' && !r(395).querySelector('.xe') && r(396).querySelector('.xt').textContent === 'الحلقة 396' && /2014/.test(r(393).querySelector('.xm').textContent); }));
    await tap('#xs .xr[data-n="394"] .xb');
    check('فتح الحلقة يعرض صورتها وملخصها العربي ورابط صفحتها', await page.evaluate(() => { const d = document.querySelector('#xs .xr[data-n="394"] .xd'); return !!d && d.querySelector('.ov:not(.en)').textContent === 'يتذكر ناروتو الاختبارات التي أقيمت وهو غائب عن القرية.' && !/قيد الإعداد/.test(d.textContent)
      && /\/w300\/still394\.jpg$/.test(d.querySelector('img').getAttribute('src')) && d.querySelector('a').href === 'https://www.themoviedb.org/tv/31910/season/16/episode/19' && document.querySelector('#xs .xr[data-n="394"] .xb').getAttribute('aria-expanded') === 'true'; }));
    await tap('#xs .xr[data-n="395"] .xb');
    check('ملخص لم يُترجم يُعرض بالإنجليزية معلَّماً، وفتح حلقة يطوي الأخرى', await page.evaluate(() => { const d = document.querySelector('#xs .xr[data-n="395"] .xd'); return !!d && /الملخص بالإنجليزية \(الترجمة العربية قيد الإعداد\)/.test(d.textContent) && !!d.querySelector('.ov.en') && document.querySelectorAll('#xs .xd').length === 1; }));
    await tap('#xs .xr[data-n="396"] .xb');
    check('حلقة بلا ملخص ولا صورة في المصدر يُقال عنها ذلك', await page.evaluate(() => { const d = document.querySelector('#xs .xr[data-n="396"] .xd'); return !!d && d.classList.contains('bare') && !d.querySelector('img') && /لا ملخص لهذه الحلقة في المصدر/.test(d.textContent); }));
    await snap('8-episodes'); await overflow('ورقة التوقيت');
    check('خانة الحلقة هدف لمس كافٍ', await page.evaluate(() => [...document.querySelectorAll('#xs .xk')].every(b => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
    check('حلقات لم تُترجم كلها: زر «ترجم لي حلقاته» تحت الورقة', (await trBox('eps'))?.btn === 'ترجم لي حلقاته', await trBox('eps'));
    await tap('#sheet .tr[data-what=eps] [data-act=tr-ask]'); await page.waitForSelector('#sheet .tr[data-what=eps] .tr-ok');
    check('كلمة السر محفوظة: يُرسل طلب الحلقات مباشرة باسم العمل ونوعه، ولا شيء عن موضع المشاهدة', JSON.stringify(sent.at(-1)) === JSON.stringify({ password: 'open-sesame', mal: 1735, what: 'eps', title: 'Naruto: Shippuuden' }) && /وصل طلب ترجمة حلقاته وهو ينتظر/.test((await trBox('eps')).ok), sent.at(-1));
    await tap('#xs .xr[data-n="394"] .xk');
    check('تعليم الحلقة التالية من خانتها: يتقدم العدّ، وتنتقل الورقة إلى ما بعدها، ومعه «تراجع»', (await rec(1735)).p === 394 && await xr() === '394✓ 395› 396 397 398' && /شاهدت الحلقة 394 من Naruto: Shippuuden/.test(await toastText()) && /394 من 500/.test(await page.textContent('#sheet .mine .tc span')), [await rec(1735), await xr(), await toastText()]);
    await undo(); check('والتراجع يعيد الورقة والعدّ', (await rec(1735)).p === 393 && await xr() === '393✓ 394› 395 396 397', await xr());
    check('الطلب المسجَّل يبقى ظاهراً بعد إعادة رسم الورقة', /وصل طلب ترجمة حلقاته/.test((await trBox('eps'))?.ok || ''), await trBox('eps'));
    await tap('#xs .xr[data-n="396"] .xk');
    check('القفز إلى حلقة أبعد يعلّم ما بينهما', (await rec(1735)).p === 396 && await xr() === '396✓ 397› 398 399 400' && /الحلقات 396 من 500/.test(await toastText()), [await rec(1735), await xr()]);
    await undo();
    await tap('#xs [data-act=ep-all]');
    check('«كل الحلقات»: الورقة صفحات، تفتح على صفحة الحلقة التالية', await page.evaluate(() => { const r = [...document.querySelectorAll('#xs .xr')], t = [...document.querySelectorAll('#xs .xpages button')]; return r.length === 50 && r[0].dataset.n === '351' && r[49].dataset.n === '400' && t.length === 10
      && t.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent).join() === '351–400' && document.querySelectorAll('#xs .xr.done').length === 43; }), await xr());
    await tap('#xs .xr[data-n="393"] .xk');
    check('خانة آخر ما شوهد تلغيه وحده', (await rec(1735)).p === 392 && /392 من 500/.test(await page.textContent('#sheet .mine .tc span')), await rec(1735)); await undo();
    await tap('#xs .xpages [data-from="1"]'); await page.waitForFunction(() => document.querySelector('#xs .xr')?.dataset.n === '1');
    await tap('#xs .xr[data-n="10"] .xk');
    check('الرجوع إلى حلقة قديمة يُسأل عنه قبل أن يُلغى ما بعدها', (await rec(1735)).p === 393 && /ترجع إلى الحلقة 10؟ يُلغى تعليم 383 حلقة بعدها/.test(await page.textContent('#xs .xr[data-n="10"] .xask')));
    await tap('#xs [data-act=ep-keep]'); check('«لا» تبقي كل شيء', (await rec(1735)).p === 393 && await page.locator('#xs .xask').count() === 0);
    await tap('#xs .xr[data-n="10"] .xk'); await tap('#xs [data-act=ep-back]');
    check('و«نعم» ترجع إليها، ومعها «تراجع»', (await rec(1735)).p === 10 && await page.locator('#xs .xr.done').count() === 10 && /الحلقات 10 من 500/.test(await toastText()), await rec(1735)); await undo();
    await tap('#xs [data-act=ep-less]'); check('والعودة إلى الحلقة التالية وما حولها', await xr() === '393✓ 394› 395 396 397', await xr());
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    await tap('#lists [data-l=hold]'); await tap('#grid .cel[data-id="21"] [data-act=open]'); await page.waitForSelector('#xs .xr');
    check('عمل لم يُعلن عدد حلقاته: حلقاته مما بُني، وما لم يُعرض بعد بموعده وبلا خانة', await xr() === '1155✓ 1156› 1157 1158~ 1159~' && /1,160 حلقة · شاهدت 1,155/.test(await page.textContent('#xs h3')) && await page.evaluate(() => { const r = n => document.querySelector(`#xs .xr[data-n="${n}"]`);
      return !r(1158).querySelector('.xk') && /تُعرض بعد 3 أيام/.test(r(1158).textContent) && !!r(1157).querySelector('.xk') && r(1156).querySelector('.xn').dataset.w === '4'; }), await xr());
    await tap('#xs [data-act=ep-all]'); check('والحلقة التي لا موعد لها بعد آخر ما عُرض لم تُعرض', await page.evaluate(() => { const r = document.querySelector('#xs .xr[data-n="1160"]'); return r.classList.contains('fut') && /لم يُحدَّد موعدها/.test(r.textContent) && document.querySelectorAll('#xs .xpages button').length === 24; }));
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    const head = () => page.$eval('#xs h3', h => h.textContent.replace(/\s+/g, ' ')), foot = () => page.$eval('#xs > .lbl', h => h.textContent);
    await tap('#lists [data-l=completed]'); await tap('#grid .cel[data-id="5114"] [data-act=open]'); await page.waitForSelector('#xs .xr');
    check('عدد الحلقات هنا أقل بقليل من عدد MyAnimeList: يُقال العددان وسببُ الفرق، والتعليم باقٍ', /62 حلقة هنا، و64 في MyAnimeList · شاهدت 62/.test(await head()) && await xr() === '58✓ 59✓ 60✓ 61✓ 62✓' && await page.locator('#xs .xk').count() === 5
      && /حلقات خاصة أو ملخصات/.test(await foot()) && /الخانة التي تضغطها/.test(await foot()), [await head(), await xr(), await foot()]);
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    await tap('#lists [data-l=dropped]'); await tap('#grid .cel[data-id="356"] [data-act=open]'); await page.waitForSelector('#xs .xr');
    check('المصدر يعدّ الحلقات عدّاً آخر: الورقة للقراءة من أولها، بلا خانات ولا علامات', await xr() === '1 2 3 4 5' && await page.locator('#xs .xk').count() === 0 && await page.locator('#xs .xsheet.ro').count() === 1 && /30 حلقة هنا، و24 في MyAnimeList$/.test((await head()).trim())
      && /للقراءة/.test(await foot()) && /العدّاد أعلاه/.test(await foot()) && !/الخانة التي تضغطها/.test(await foot()), [await head(), await xr(), await foot()]);
    await tap('#xs .xr[data-n="2"] .xb'); await tap('#xs [data-act=ep-all]');
    check('وتُفتح حلقاتها وتُقرأ كلها', await page.locator('#xs .xr').count() === 30 && await page.locator('#xs .xr[data-n="2"] .xd .ov').count() === 1 && /أول الحلقات فقط/.test(await page.textContent('#xs [data-act=ep-less]')) && (await rec(356)).p === 3, await rec(356));
    await snap('8-episodes-readonly'); await overflow('ورقة التوقيت للقراءة');
    { const y = () => page.evaluate(() => Math.round(document.querySelector('#sheet-body').scrollTop)), full = id => page.waitForFunction(id => document.querySelector('#sheet-body').dataset.full === id, String(id)), sib = '#sheet-body .strip button[data-id="22297"]';
      await page.locator(sib).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); const y1 = await y(); await tap(sib); await full(22297); await tap('#sheet .sback'); await full(356); await page.waitForTimeout(150);
      check('والرجوع إليها من بطاقة فتحتها منها يعيد حلقاتها كما تُركت (كلها، والثانية مفتوحة) وموضعها (E77)', await page.locator('#xs .xr').count() === 30 && await page.locator('#xs .xr[data-n="2"] .xd .ov').count() === 1 && /أول الحلقات فقط/.test(await page.textContent('#xs [data-act=ep-less]')) && Math.abs(await y() - y1) <= 2, [await page.locator('#xs .xr').count(), y1, await y()]); }
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
    await tap('#lists [data-l=completed]'); await tap('#grid .cel[data-id="199"] [data-act=open]'); await page.waitForSelector('#sheet[open]'); await page.waitForFunction(() => !!document.querySelector('#sheet-body .where, #sheet-body .links'));
    check('عمل بلا ملف حلقات (فيلم) بلا ورقة توقيت', await page.locator('#xs').count() === 0);
    await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' }); await tap('#lists [data-l=watching]');
    check('السجل بعد ورقة التوقيت كما كان قبلها', JSON.stringify(await log()) === before); }

  // ---------- SIMKL (على الكمبيوتر فقط: ينتظر ثواني الاستعلام)
  if (name === 'desktop') {
    await tap('.top [data-act=import]'); await page.waitForSelector('#imp[open]'); await tap('[data-act=sk-start]'); await page.waitForSelector('#imp .sum b[dir=ltr]');
    check('ربط SIMKL: يظهر الرمز ورابط الموافقة', await page.textContent('#imp .sum b[dir=ltr]') === 'ABCD-1234' && await page.getAttribute('#imp a.btn.pri', 'href') === 'https://simkl.com/pin/ABCD-1234');
    await page.waitForSelector('[data-act=sk-apply]', { timeout: 20000 });
    check('بعد الموافقة يُسحب السجل مرة واحدة، وكل طلب معرَّف، والرمز في المتصفح فقط', asked.join(' | ') === 'POST /oauth2/device | POST /oauth2/token | POST /oauth2/token | GET /sync/activities +auth | GET /sync/all-items/anime +auth'
      && await page.evaluate(() => JSON.parse(localStorage.getItem('animeg.simkl')).access === 'test-access' && !/test-access/.test(localStorage.getItem('animeg.progress')) && !/test-access/.test(localStorage.getItem('guides.sync') || '')), asked);
    check('المطابقة برقم MyAnimeList أو برقم SIMKL، وما لا رقم له يُذكر', (await page.$$eval('#imp .sum b', b => b.map(x => x.textContent))).slice(0, 3).join(',') === '5,2,3' && /طوبق 5 أعمال/.test(await page.textContent('#imp-body')) && /بقي عمل واحد بلا رقم/.test(await page.textContent('#imp-body')) && /0 جديد، 3 يختلف، 2 مطابق/.test(await page.textContent('#imp-body')), await page.textContent('#imp-body'));
    check('مدخل يجمع أجزاء لا يزيد حلقات العمل، ويوم النقل الجماعي يُذكر ولا يُحسب', /لا يتجاوز حلقات العمل هنا/.test(await page.textContent('#imp-body')) && /أيام نقل القائمة إلى SIMKL \(يوم واحد: أعمال كثيرة عُلّمت دفعة واحدة\) لا تُحسب تواريخ مشاهدة/.test(await page.textContent('#imp-body')) && (await page.$$eval('#imp .sum b', b => b.map(x => x.textContent)))[6] === '170', await page.$$eval('#imp .sum b', b => b.map(x => x.textContent)));
    await snap('7-simkl'); const before = await log(); await tap('[data-act=sk-apply][data-how=ahead]'); const L = await log();
    check('«الأبعد تقدّماً يغلب»: حلقات SIMKL الأبعد وحالته، وتقييمك وتواريخك تبقى، وما سبق أبعد لا يتراجع', JSON.stringify(L[37989]) === '{"s":"completed","p":12,"r":8,"b":"2025-06-10","e":"2026-10-02"}' && JSON.stringify(L[22297]) === '{"s":"watching","p":4}' && L[52701].s === 'hold' && L[52701].p === 10 && L[52701].r === 9
      && JSON.stringify(L[11061]) === JSON.stringify(before[11061]) && JSON.stringify(L[1735]) === JSON.stringify(before[1735]) && JSON.stringify(L[199]) === JSON.stringify(before[199]) && L[199].p === 1, [L[37989], L[22297], L[52701], L[199]]);
    check('رسالة الدمج تقول ما تغيّر فعلاً لا عدد ما قُرئ', /دُمج سجل SIMKL: تقدّم عملان، واستُكمل تاريخ أو تقييم في عمل واحد\. الباقي كما هو\./.test(await page.textContent('#imp .msg.ok')), await page.textContent('#imp .msg'));
    await tap('[data-act=restore]');
    check('«تراجع عن آخر استيراد» يعيد السجل كما كان', JSON.stringify(await log()) === JSON.stringify(before));
    await tap('[data-act=sk-forget]'); check('فصل الحساب يمحو رمزه من المتصفح', await page.evaluate(() => localStorage.getItem('animeg.simkl') === null));
    await page.keyboard.press('Escape'); await page.waitForSelector('#imp', { state: 'hidden' });
  }
  // ---------- السجل والنوافذ: الرجوع يغلق ما فُتح آخراً، والبطاقة فوق سلسلتها دائماً، والرابط المباشر والعنوان المكتوب باليد يفتحان ويُغلقان بلا خروج من البوابة
  { const st = () => page.evaluate(() => ({ a: document.querySelector('#sheet').open ? document.querySelector('#sheet h2').textContent : 0, w: document.querySelector('#wsheet').open ? 1 : 0, h: location.hash, y: Math.round(document.querySelector('#sheet-body').scrollTop), path: location.pathname }));
    const full = id => page.waitForFunction(id => document.querySelector('#sheet').open && document.querySelector('#sheet-body').dataset.full === String(id), id), shut = sel => page.waitForSelector(sel, { state: 'hidden' });
    await tap('#lists [data-l=all]'); await tap('#grid .cel[data-id="136"] [data-act=open]'); await full(136);
    const y0 = await page.evaluate(() => { const b = document.querySelector('#sheet-body'); b.scrollTop = 99999; return Math.round(b.scrollTop); });
    await tap('#sheet .acts [data-act=world]'); await page.waitForSelector('#wsheet[open]'); let s = await st();
    check('«افتح السلسلة بترتيبها» من بطاقة: تُطوى البطاقة وتُفتح السلسلة وحدها', !s.a && s.w && s.h === '#w136', s);
    await page.goBack(); await shut('#wsheet'); await page.waitForSelector('#sheet[open]'); s = await st();
    check('الرجوع من السلسلة يعيد البطاقة كما كانت وبموضع تمريرها', s.a === 'Hunter x Hunter' && !s.w && s.h === '#a136' && y0 > 0 && s.y === y0, [s, y0]);
    await tap('#sheet [data-act=world]'); await page.waitForSelector('#wsheet[open]'); await tap('#wsheet .gn-b[data-id="137"]'); await full(137); s = await st();
    check('عمل آخر من السلسلة: بطاقته فوقها، وتبدأ من أعلاها لا من موضع البطاقة السابقة', s.a === 'Hunter x Hunter: Original Video Animation' && s.w && s.y === 0 && s.h === '#a137'
      && await page.evaluate(() => { const r = document.querySelector('#sheet h2').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('dialog')?.id === 'sheet'; }), s);
    await tap('#sheet [data-act=world]'); await shut('#sheet'); s = await st();
    check('«افتح السلسلة» وسلسلته هي المفتوحة تحته: تُغلق البطاقة وتبقى السلسلة', !s.a && s.w && s.h === '#w136', s);
    await page.goBack(); await shut('#wsheet'); await page.waitForSelector('#sheet[open]'); s = await st(); const s2 = (await page.goBack(), await shut('#sheet'), await st());
    check('رجوع يعيد البطاقة الأولى، ورجوع آخر يغلقها', s.a === 'Hunter x Hunter' && !s.w && !s2.a && !s2.w && s2.h === '', [s, s2]);
    await tap('#grid .cel[data-id="136"] [data-act=open]'); await full(136); await page.evaluate(() => { document.querySelector('#sheet-body').scrollTop = 99999; }); await page.keyboard.press('Escape'); await shut('#sheet');
    await tap('#grid .cel[data-id="11061"] [data-act=open]'); await full(11061); s = await st();
    check('بطاقة تُفتح بعد أخرى أُغلقت وهي ممرَّرة: تبدأ من أعلاها', s.a === 'Hunter x Hunter (2011)' && s.y === 0, s); await page.keyboard.press('Escape'); await shut('#sheet');
    // رابط مباشر إلى عمل: شقيقه من الشريط ثم ✕ يغلق البطاقة ويبقى في البوابة برابط نظيف
    await page.goto('about:blank'); await page.goto(base + '/anime/#a136'); await full(136); await tap('#sheet .strip [data-id="137"]'); await full(137);
    await tap('#sheet [data-act=close]'); await shut('#sheet'); s = await st();
    check('رابط مباشر ثم عمل شقيق ثم ✕: تُغلق البطاقة ولا يخرج من البوابة، والرابط بلا علامتها', !s.a && s.path === '/anime/' && s.h === '' && await page.locator('#grid .cel').count() > 0, s);
    await tap('#grid .cel[data-id="11061"] [data-act=open]'); await full(11061); await tap('#sheet [data-act=close]'); await shut('#sheet'); s = await st();
    check('وبعده عمل آخر ثم ✕: يُغلق ولا يعود العمل الأول', !s.a && s.h === '' && s.path === '/anime/', s);
    // رابط مباشر إلى سلسلة: عمل منها ثم رجوع يبقي السلسلة، و✕ يغلقها
    await page.goto('about:blank'); await page.goto(base + '/anime/#w136'); await page.waitForSelector('#wsheet[open]'); await page.waitForSelector('#wsheet .gn'); await tap('#wsheet .gn-b[data-id="136"]'); await full(136);
    await page.goBack(); await shut('#sheet'); s = await st(); await tap('#wsheet [data-act=close]'); await shut('#wsheet'); const s3 = await st();
    check('رابط مباشر إلى سلسلة: الرجوع من عمل فيها يبقيها، و✕ يغلقها برابط نظيف', !s.a && s.w && s.h === '#w136' && !s3.w && s3.h === '' && s3.path === '/anime/', [s, s3]);
    // عنوان كُتب أو لُصق والصفحة مفتوحة
    await page.evaluate(() => { location.hash = '#a136'; }); await full(136); await page.evaluate(() => { location.hash = '#a11061'; }); await full(11061); s = await st();
    await page.keyboard.press('Escape'); await shut('#sheet'); const s4 = await st();
    check('عنوان عمل كُتب باليد والصفحة مفتوحة يفتحه، وعنوان آخر يبدّله، وEsc يغلقه', s.a === 'Hunter x Hunter (2011)' && s.h === '#a11061' && !s4.a && s4.h === '' && s4.path === '/anime/', [s, s4]);
    await page.goto('about:blank'); await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel'); }
  // ---------- ما أكملت ما بعده من القصة الرئيسية ولم تكمله «فاتك» لا «التالي» (شاهدت بترتيب آخر أو تخطيت جزءاً)
  const setLog = async o => { await page.evaluate(o => { const k = 'animeg.progress', j = JSON.parse(localStorage.getItem(k)); Object.assign(j.a, o); localStorage.setItem(k, JSON.stringify(j)); localStorage.removeItem('anime.mood'); }, o); await page.goto('about:blank'); };
  await setLog({ 11061: { s: 'completed', p: 148 }, 136: { s: 'plan' }, 137: { s: 'completed', p: 8 }, 13271: { s: 'plan' }, 22297: { s: 'plan' } });
  await page.goto(base + '/anime/#w136'); await page.waitForSelector('#wsheet[open] .gn');
  check('«فاتك من القصة الرئيسية» على أول ما لم تكمله وقد أكملت ما بعده، ومحطته «فاتك»', await page.evaluate(() => { const b = document.querySelector('#wsheet .gw-go'), h = document.querySelector('#wsheet .gn.here');
    return b?.dataset.id === '136' && /فاتك من القصة الرئيسية/.test(b.textContent) && h?.querySelector('.gn-b').dataset.id === '136' && h.querySelector('.gn-here').textContent === 'فاتك'; }), await page.textContent('#wsheet .gw-hero'));
  // ---------- «اقتراح الليلة» لا يقترح جزءاً قبل أن تكمل ما قبله في خطه (فيلم Hunter x Hunter يكمل مسلسل 2011)، و«سأبدأه الآن» ينقله إلى ما تشاهده
  await setLog({ 11061: { s: 'watching', p: 10 }, 136: { s: 'completed', p: 62 } }); await page.goto(base + '/anime/'); await page.waitForSelector('#tonight .tn');
  { const seen = new Set(); for (let i = 0; i < 6; i++) { seen.add(await page.getAttribute('#tonight [data-act=open]', 'data-id')); await tap('#tonight [data-act=treroll]'); await page.waitForTimeout(40); }
    check('لا يُقترح جزء قبل إكمال ما قبله في خطه', [...seen].join() === '22297', [...seen]); }
  await tap('#tonight [data-act=status]'); await page.waitForTimeout(150);
  check('«سأبدأه الآن» ينقله إلى ما تشاهده، ولا يبقى ما يُقترح', (await log())[22297].s === 'watching' && await page.locator('.rail .cel[data-id="22297"]').count() === 1 && await page.locator('#tonight .tn').count() === 0, await log());
  // ---------- فلتر +18 (E65): أعمال +18 (ad) لا تظهر حتى تُفتح العين أعلى البوابة، فتندمج في القائمة نفسها وبحثها وإضافتها وأعدادها، في مكانها بلا إعادة تحميل، وصورها مغطاة حتى تُكشف
  { const cells = () => page.$$eval('#grid .cel', c => c.map(x => +x.dataset.id)), tallyN = () => page.evaluate(() => +(document.querySelector('#tally b')?.textContent || '').replace(/\D/g, '') || 0);
    const lifted = () => page.evaluate(() => document.querySelector('.top .r18').getAttribute('aria-pressed') === 'true'), same = () => page.evaluate(() => window.__same === 1), sorted = a => [...a].sort((x, y) => x - y).join();
    // العين تبدّل في مكانها: علامة تُكتب في الصفحة قبل اللمس وتبقى بعده، فلا تحميل جديد
    const eye = async on => { await page.evaluate(() => { window.__same = 1; }); await tap('.top .r18'); await page.waitForFunction(on => document.querySelector('.top .r18').getAttribute('aria-pressed') === String(on), on); await page.waitForTimeout(150); };
    await setLog({ 70001: { s: 'completed', p: 2, r: 8 }, 70002: { s: 'plan' } }); await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=all]');
    const all0 = await cells(), n0 = await tallyN();
    check('الفلتر قائم: عين مغمضة في الرأس بلا نص ولا رقم، وأعمال +18 ليست في القائمة ولا في أعدادها ولو كان لها سجل', await page.evaluate(() => { const b = document.querySelector('.top .r18'), c = document.querySelector('.top .r18-eye');
        return !!b && b.getAttribute('aria-pressed') === 'false' && b.textContent.trim() === '' && !!b.querySelector('svg.eye') && !/\d/.test(b.getAttribute('aria-label') + b.title) && c.hidden && !/\+\s*18/.test(document.querySelector('.top').textContent) && !document.querySelector('.r18-bar'); })
      && !all0.includes(70001) && !all0.includes(70002) && all0.length === 14 && n0 === 14, [all0, n0]);
    await page.fill('#q', 'midnight'); await page.waitForFunction(() => /لا عمل في هذه القائمة يطابق/.test(document.querySelector('#grid').textContent));
    await page.fill('#q', ''); await page.evaluate(() => { location.hash = '#a70001'; }); await page.waitForTimeout(200);
    check('ولا يجدها بحث القائمة، ولا يفتحها رابطها', await page.evaluate(() => !document.querySelector('#sheet').open)); await page.evaluate(() => history.replaceState(null, '', location.pathname));
    await tap('.top [data-act=add]'); await page.waitForSelector('#addd[open]'); await page.fill('#add-q', 'midnight'); await page.waitForFunction(() => /لا عمل في «أنمياتي» بهذا الاسم/.test(document.querySelector('#add-res').textContent));
    check('ولا بحث «أضف أنمي» فيها', await page.locator('#add-res .arow').count() === 0); await tap('#addd [data-act=close]'); await page.waitForSelector('#addd', { state: 'hidden' });
    await page.goto(base + '/'); await page.waitForFunction(() => /\d/.test(document.querySelector('.door.anime [data-stat]')?.textContent || ''));
    check('وعدّاد باب «أنمياتي» في القاعة بلا أعمال +18: لا في المجموع ولا في ما أكملته', /^أكملت 4 من 13 عملاً$/.test((await page.textContent('.door.anime [data-stat]')).trim()), await page.textContent('.door.anime [data-stat]'));
    await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=all]');
    const pick0 = await page.evaluate(() => document.querySelector('#tonight [data-act=open]')?.dataset.id || '');
    // الرفع
    await eye(true);
    check('العين ترفع الفلتر في مكانها بلا تحميل: أعمال +18 تندمج في القائمة نفسها وأعدادها، والقوائم والسلاسل كما هي، والاقتراح يأخذ عمل +18 الذي في «سأشاهده» وكان فارغاً (E78)، ورسالة تقول ما جرى', await same() && sorted(await cells()) === sorted([...all0, 70001, 70002]) && await tallyN() === n0 + 2
      && /رُفع الفلتر/.test(await toastText()) && await page.evaluate(pick0 => { const b = document.querySelector('.top .r18'), c = document.querySelector('.top .r18-eye');
        return b.getAttribute('aria-pressed') === 'true' && b.textContent.trim() === '' && !c.hidden && !document.querySelector('.r18-bar') && !document.querySelector('.views').hidden && !/\+\s*18/.test(document.querySelector('.top').textContent)
          && !pick0 && (document.querySelector('#tonight [data-act=open]')?.dataset.id || '') === '70002' && document.querySelector('#lists [data-l=all]').getAttribute('aria-pressed') === 'true'; }, pick0), [await cells(), await tallyN(), await toastText()]);
    check('صور أعمال +18 مغطاة: مصغّرتها وحدها مموّهة وعليها عين مغمضة بلا نص، ولا تُحمَّل الصورة الكاملة، وصور غيرها كما هي', await page.evaluate(() => { const ad = [...document.querySelectorAll('#grid .cel[data-ad] .cel-art')], rest = [...document.querySelectorAll('#grid .cel:not([data-ad]) .cel-art')];
      return ad.length === 2 && ad.every(x => x.classList.contains('x18') && /\/7\/7000[12]t\.webp$/.test(x.querySelector('.x18-i img').getAttribute('src')) && !x.querySelector('img[srcset]') && x.querySelector('.x18-m').textContent === '' && !!x.querySelector('.x18-m svg') && /blur/.test(getComputedStyle(x.querySelector('img')).filter))
        && rest.length === 14 && rest.every(x => !x.classList.contains('x18') && [...x.querySelectorAll('img')].every(i => !/blur/.test(getComputedStyle(i).filter))); }));
    await snap('18-open'); await overflow('الفلتر مرفوع');
    await page.fill('#q', 'velvet'); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 1); check('وبحث القائمة يجدها', (await cells()).join() === '70002'); await page.fill('#q', ''); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 16);
    // السلاسل (E73): سلسلة +18 تظهر بأقربائها والفلتر مرفوع، وسلسلة فيها عمل +18 تُعدّ به
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.views [data-v=worlds]').click(); }); await page.waitForSelector('#worlds .wc[data-w="70001"]');   // والاقتراح فوق الشبكة الآن (E78)، فلمسها يمرّر الصفحة حتى يلتصق الشريط
    check('والفلتر مرفوع: سلسلة أعمال +18 بين السلاسل بأقربائها، وعمل +18 في سلسلة غيره يُعدّ فيها', await page.evaluate(() => { const c = w => document.querySelector(`#worlds .wc[data-w="${w}"]`)?.textContent || '';
      return /Midnight Sample/.test(c(70001)) && /عملان · في قائمتك 1/.test(c(70001)) && /5 أعمال/.test(c(136)) && /عملان · في قائمتك 1/.test(c(52701)); }), await page.evaluate(() => [...document.querySelectorAll('#worlds .wc')].map(x => x.textContent.trim())));
    await tap('#worlds .wc[data-w="70001"]'); await page.waitForSelector('#wsheet[open] .gw-tl');
    check('وتُفتح بترتيبها وفيها قريبها الذي ليس في القائمة', await page.evaluate(() => [...document.querySelectorAll('#wsheet .gw-tl [data-id]')].map(x => +x.dataset.id).filter((v, i, a) => a.indexOf(v) === i).join() === '70001,70003'),
      await page.evaluate(() => [...document.querySelectorAll('#wsheet .gw-tl [data-id]')].map(x => x.dataset.id)));
    check('وصور أعمال +18 فيها مغطاة: مصغّرتها وحدها بعين البوابة، ولا غلاف لها في رأس البوابة', await page.evaluate(() => { const n = [...document.querySelectorAll('#wsheet .gn-b')];
      return n.length >= 2 && n.every(b => b.hasAttribute('data-ad') && !!b.querySelector('.th.x18 .x18-m svg') && [...b.querySelectorAll('img')].every(i => /t\.webp$/.test(i.getAttribute('src')))) && !document.querySelector('#wsheet .gw-stack img'); }),
      await page.evaluate(() => [...document.querySelectorAll('#wsheet .gn-b')].map(b => b.outerHTML.slice(0, 240))));
    await page.goBack(); await page.waitForSelector('#wsheet', { state: 'hidden' });
    check('وبطاقة تلك السلسلة بلا صورة من أعمال +18 ما دامت مغطاة', await page.evaluate(() => !document.querySelector('#worlds .wc[data-w="70001"] img')));
    await tap('#worlds .wc[data-w="136"]'); await page.waitForSelector('#wsheet[open] .gw-tl');
    check('وفي سلسلة غيرها: عمل +18 بين أعمالها مغطى وحده', await page.evaluate(() => { const b = id => document.querySelector(`#wsheet .gn-b[data-id="${id}"]`);
      return !!b(70004)?.querySelector('.th.x18') && b(70004).hasAttribute('data-ad') && !!b(11061) && !b(11061).hasAttribute('data-ad') && !b(11061).querySelector('.x18'); }));
    await tap('#wsheet .gn-b[data-id="11061"]'); await page.waitForSelector('#sheet[open]'); await page.waitForFunction(() => document.querySelector('#sheet-body').dataset.full === '11061');
    check('وفي بطاقة عمل منها: عمل +18 في شريط سلسلتها مغطى وحده', await page.evaluate(() => { const b = id => document.querySelector(`#sheet-body .strip button[data-id="${id}"]`);
      return !!b(70004)?.querySelector('.th.x18') && b(70004).hasAttribute('data-ad') && [...b(70004).querySelectorAll('img')].every(i => /t\.webp$/.test(i.getAttribute('src'))) && !!b(11061)?.querySelector('img') && !b(11061).querySelector('.x18'); }),
      await page.evaluate(() => [...document.querySelectorAll('#sheet-body .strip button')].map(b => b.outerHTML.slice(0, 200))));
    await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.goBack(); await page.waitForSelector('#wsheet', { state: 'hidden' });
    await tap('.views [data-v=list]'); await page.waitForSelector('#grid .cel');
    // العين في الشريط اللاصق: تظهر مع البحث والقوائم حين يخرج الرأس من الشاشة، ومعها زر الأغلفة، وتعمل كعين الرأس
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#grid').offsetTop + 400)); await page.waitForFunction(() => document.querySelector('.bar').classList.contains('docked'));
    await page.waitForTimeout(350);
    check('نزلت بالصفحة: العين وزر الأغلفة معها في الشريط أعلى الصفحة، ظاهران ويُضغطان', await page.evaluate(() => { const w = document.querySelector('.bar .r18w.dock'), r = w.getBoundingClientRect(), e = w.querySelector('.r18'), c = w.querySelector('.r18-eye');
      return w.getAttribute('aria-hidden') === 'false' && e.tabIndex === 0 && r.width > 80 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(w).opacity === '1' && e.getAttribute('aria-pressed') === 'true' && !c.hidden && r.left >= 0 && r.right <= innerWidth; }));
    await snap('18-dock'); await overflow('العين في الشريط');
    if (viewport.width <= 480) {   // الشاشة الضيقة: البحث في الشريط زرّ بعدسته يتسع حين يُلمس وتغيب الأزرار حتى ينتهي، وعليه نقطة ما دام فيه بحث
      const qs = () => page.evaluate(() => { const w = s => Math.round(document.querySelector(s).getBoundingClientRect().width); return { s: w('.bar .search'), v: w('.bar .views'), d: w('.bar .r18w.dock'), dot: getComputedStyle(document.querySelector('.bar .search'), '::after').content }; });
      const a = await qs(); await page.locator('.bar #q').tap(); await page.waitForTimeout(150); const b = await qs();
      await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(150); const c = await qs();
      await page.evaluate(() => { document.querySelector('#q').value = 'velvet'; }); const d = await qs(); await page.evaluate(() => { document.querySelector('#q').value = ''; });
      check('الشاشة الضيقة: البحث في الشريط زرّ بعدسته، يتسع حين يُلمس وتغيب الأزرار حتى ينتهي، وعليه نقطة ما دام فيه بحث', a.s <= 46 && a.v > 100 && a.d > 80 && a.dot === 'none' && b.s > 200 && !b.v && !b.d && c.s <= 46 && c.d > 80 && d.dot !== 'none' && d.s <= 46, [a, b, c, d]); }
    await page.evaluate(() => { window.__same = 1; }); await page.locator('.bar .r18w.dock .r18').click(); await page.waitForFunction(() => document.querySelector('.top .r18').getAttribute('aria-pressed') === 'false');
    check('ضغطها هناك يعيد الفلتر في مكانه، وعين الرأس معها', await same() && await page.evaluate(() => document.querySelector('.bar .r18w.dock .r18').getAttribute('aria-pressed') === 'false' && document.querySelector('.bar .r18w.dock .r18-eye').hidden && !document.querySelector('#grid [data-ad]')));
    await tap('.views [data-v=worlds]'); await page.waitForSelector('#worlds .wc[data-w="136"]');
    check('والفلتر قائم: لا سلسلة +18 ولا رابطها، وسلسلة فيها عمل +18 تُعدّ بغيره، وما لا يبقى منها إلا عمل واحد ليس سلسلة', await page.evaluate(() => !document.querySelector('#worlds .wc[data-w="70001"]') && !document.querySelector('#worlds .wc[data-w="52701"]') && /4 أعمال/.test(document.querySelector('#worlds .wc[data-w="136"]').textContent) && !/Midnight|Hunter Night/.test(document.querySelector('#worlds').textContent)));
    await page.evaluate(() => { location.hash = '#w70001'; }); await page.waitForTimeout(200); check('ورابط سلسلة +18 لا يفتحها', await page.evaluate(() => !document.querySelector('#wsheet').open)); await page.evaluate(() => history.replaceState(null, '', location.pathname));
    await tap('.views [data-v=list]'); await page.waitForSelector('#grid .cel'); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForFunction(() => !document.querySelector('.bar').classList.contains('docked'));
    check('وعاد الرأس: نسخة الشريط مخفية لا تُضغط', await page.evaluate(() => document.querySelector('.bar .r18w.dock').getAttribute('aria-hidden') === 'true' && document.querySelector('.bar .r18w.dock .r18').tabIndex === -1));
    await eye(true); await tap('#lists [data-l=all]');
    // الاقتراح والعين مفتوحة (E78): عمل +18 في «سأشاهده» يدخله وعدّه، ومغطى فيه؛ وإغلاق العين يخرجه منه ومن عدّه
    { const anyN = () => page.evaluate(() => +(document.querySelector('#tonight [data-act=amood][data-g="-1"] b')?.textContent.replace(/\D/g, '') || 0)), pid = () => page.evaluate(() => document.querySelector('#tonight [data-act=open]')?.dataset.id || '');
      const open1 = await anyN(); let hit = false; for (let i = 0; i < 80 && !hit; i++) { if (await pid() === '70002') hit = true; else { await tap('#tonight [data-act=treroll]'); await page.waitForTimeout(20); } }
      check('والعين مفتوحة: عمل +18 في «سأشاهده» يدخل الاقتراح وعدّه، وقسمه موسوم مغطى', hit && await page.evaluate(() => { const t = document.querySelector('#tonight .tn'); return t.hasAttribute('data-ad') && !t.hasAttribute('data-r18-bare') && /Velvet Sample/.test(t.querySelector('h2').textContent); }), [hit, open1]);
      await eye(false); await page.waitForTimeout(100); const shut1 = await anyN();
      check('وإغلاق العين يخرجه من الاقتراح ومن عدّه', shut1 === open1 - 1 && await pid() !== '70002' && !await page.evaluate(() => document.querySelector('#tonight [data-ad]')), [open1, shut1, await pid()]);
      await eye(true); }
    // البطاقة
    await tap('#grid .cel[data-id="70001"] [data-act=open]'); await page.waitForSelector('#sheet[open]'); await page.waitForFunction(() => document.querySelector('#sheet-body').dataset.full === '70001');
    check('بطاقة عمل +18: سجلّه كغيره، ونبذته بالإنجليزية وطلب ترجمتها كغيره (E69)، وموقعه من سلسلته وحلقاته كغيره (E73)، وصورته مغطاة بزر يكشفها', await page.evaluate(() => { const b = document.querySelector('#sheet-body'), p = b.querySelector('.head .cel-art');
      return p.classList.contains('x18') && p.dataset.act === 'bare' && !p.hasAttribute('data-zoom') && /اضغط لإظهارها/.test(p.textContent) && !b.querySelector('.hero img') && !!b.querySelector('.pos') && /Midnight Sample/.test(b.querySelector('.pos')?.textContent || '') && !!b.querySelector('#xs') && !!b.querySelector('.mine') && !/لا تُعرض هنا/.test(b.textContent)
        && b.querySelector('.ov.en')?.textContent === 'Two strangers share one long night in a sleepless city.' && !!b.querySelector('.tr [data-act]') && [...b.querySelectorAll('.facts span')].some(x => x.textContent === '+18') && [...b.querySelectorAll('.links a')].map(a => a.textContent.trim()).join() === 'MyAnimeList,SIMKL,AniList,TMDB'; }), await page.evaluate(() => ({ pos: !!document.querySelector('#sheet-body .pos'), xs: !!document.querySelector('#sheet-body #xs'), links: [...document.querySelectorAll('#sheet-body .links a')].map(a => a.textContent.trim()) })));
    await snap('18-card'); await overflow('بطاقة +18');
    await tap('#sheet-body .head .cel-art'); await page.waitForFunction(() => !document.querySelector('#sheet-body .head .cel-art.x18'));
    check('لمس الصورة يكشفها وحدها: في بطاقته وفي خانته، والباقي مغطى، ولا يُفتح المكبّر بتلك اللمسة', await page.evaluate(() => { const b = document.querySelector('#sheet-body'), p = b.querySelector('.head .cel-art');
      return b.hasAttribute('data-r18-bare') && p.hasAttribute('data-zoom') && /\/7\/70001\.webp$/.test(p.querySelector('img').getAttribute('src')) && /ad70001bd\.jpg$/.test(b.querySelector('.hero img')?.getAttribute('src') || '') && getComputedStyle(p.querySelector('img')).filter === 'none' && !document.querySelector('.pz[open]')
        && !document.querySelector('#grid .cel[data-id="70001"] .x18') && document.querySelector('#grid .cel[data-id="70001"]').hasAttribute('data-r18-bare') && !!document.querySelector('#grid .cel[data-id="70002"] .cel-art.x18'); }));
    await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' });
    await tap('.r18-eye'); await page.waitForFunction(() => document.documentElement.hasAttribute('data-r18-open'));
    check('زر الأغلفة بجانب العين يكشف صور أعمال +18 كلها، ويصير «غطِّ الصور»', await page.evaluate(() => !document.querySelector('#grid .x18') && document.querySelectorAll('#grid .cel[data-ad] .cel-art img[srcset]').length === 2 && /غطِّ الصور/.test(document.querySelector('.r18-eye').textContent) && document.querySelector('.r18-eye').getAttribute('aria-pressed') === 'true'
      && getComputedStyle(document.querySelector('#grid .cel[data-ad] .cel-art img')).filter === 'none'));
    // E74: إغلاق العين يعيد التغطية، فرفع الفلتر بعده يبدأ والصور مغطاة ولو لم تُغطَّ قبل الإغلاق
    await eye(false); await eye(true);
    check('أُغلقت العين والصور مكشوفة ثم فُتحت: الصور مغطاة من جديد وزرها «أظهر الصور» (E74)', await page.evaluate(() => !document.documentElement.hasAttribute('data-r18-open') && document.querySelectorAll('#grid .cel-art.x18').length === 2
      && document.querySelector('.top .r18-eye').getAttribute('aria-pressed') === 'false' && /أظهر الصور/.test(document.querySelector('.top .r18-eye').textContent) && localStorage.getItem('adult.show') === null));
    await tap('#lists [data-l=all]'); await tap('.r18-eye'); await page.waitForFunction(() => document.documentElement.hasAttribute('data-r18-open'));
    await tap('.r18-eye'); await page.waitForFunction(() => !document.documentElement.hasAttribute('data-r18-open'));
    check('و«غطِّ الصور» يغطيها كلها ثانية، وما كُشف وحده معها', await page.evaluate(() => document.querySelectorAll('#grid .cel-art.x18').length === 2 && !document.querySelector('#grid [data-r18-bare]')));
    // البحث والإضافة: MyAnimeList بلا قيد حين يُرفع الفلتر، وما تصنيفه Rx منه يُوسم ويُغطى، والإضافة تحمل الوسم
    { const jik = [], adds = [], im = n => ({ webp: { image_url: `https://cdn.myanimelist.net/images/anime/9/${n}.webp`, small_image_url: `https://cdn.myanimelist.net/images/anime/9/${n}t.webp` } });
      await page.route('https://api.jikan.moe/**', r => { const u = new URL(r.request().url()); jik.push(u.search);
        return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data: [
          { mal_id: 70010, title: 'Velvet Found', type: 'OVA', episodes: 3, year: 2024, images: im(70010), rating: 'Rx - Hentai' }, { mal_id: 70002, title: 'Velvet Sample', type: 'OVA', episodes: 1, year: 2022, images: im(70002), rating: 'Rx - Hentai' },
          { mal_id: 70011, title: 'Velvet Clean', type: 'TV', episodes: 12, year: 2020, images: im(70011), rating: 'PG-13 - Teens 13 or older' }, { mal_id: 70012, title: 'Velvet Tagged', type: 'OVA', episodes: 2, year: 2018, images: im(70012), rating: null, explicit_genres: [{ name: 'Hentai' }] }] }) }); });
      await page.route(base + '/api/anime-add', r => { adds.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ contentType: 'application/json', body: '{"state":"added"}' }); });
      await tap('.top [data-act=add]'); await page.waitForSelector('#addd[open]');
      check('«أضف أنمي» والفلتر مرفوع: النافذة نفسها باسمها', (await page.textContent('#add-h')).trim() === 'أضف أنمي' && !/\+\s*18/.test(await page.textContent('#add-body')));
      await page.fill('#add-q', 'velvet'); await page.waitForSelector('#add-res .arow[data-id="70002"]'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arow[data-mal]');
      const rows = () => page.$$eval('#add-res .arow', r => r.map(x => (x.dataset.id || 'mal' + x.dataset.mal) + ':' + (x.querySelector('.astate')?.textContent.trim() || x.querySelectorAll('.aacts .btn').length)));
      check('بحث MyAnimeList والفلتر مرفوع: بلا قيد تصنيف وبلا sfw، فيعود بكل ما يطابق، وما في قائمتك منه أعلاه، وصور أعمال +18 وحدها مغطاة', jik.length === 1 && !/rating=/.test(jik[0]) && !/sfw/.test(jik[0]) && /limit=25/.test(jik[0])
        && (await rows()).join(' | ') === '70002:في «سأشاهده» | mal70010:2 | mal70011:2 | mal70012:2' && await page.evaluate(() => { const a = id => document.querySelector(`#add-res .arow[data-mal="${id}"]`), cov = r => r.hasAttribute('data-ad') && r.querySelector('.aart').classList.contains('x18') && !!r.querySelector('.x18-m svg') && r.querySelector('.x18-m').textContent === '';
          return cov(a(70010)) && cov(a(70012)) && cov(document.querySelector('#add-res .arow[data-id="70002"]')) && !a(70011).hasAttribute('data-ad') && !a(70011).querySelector('.x18') && getComputedStyle(a(70011).querySelector('img')).filter === 'none'; }), [jik, await rows()]);
      await snap('18-add'); await overflow('أضف والفلتر مرفوع');
      await tap('#add-res .arow[data-mal="70010"] [data-act=add-mal][data-s=watching]'); await page.waitForSelector('#add-res .arow[data-mal="70010"] .astate');
      check('إضافة عمل +18 تحمل الوسم ad، وتدخل القائمة والسجل فوراً ببطاقة مؤقتة مغطاة', adds.length === 1 && adds[0].ad === 1 && adds[0].mal === 70010 && Object.keys(adds[0]).sort().join() === 'ad,eps,mal,password,title,type' && (await log())[70010]?.s === 'watching'
        && await page.evaluate(() => { const a = JSON.parse(localStorage.getItem('animeg.added'))[70010], c = document.querySelector('.rail .cel[data-id="70010"]'); return a?.ad === 1 && a.im === '9/70010' && !!c && c.querySelector('.cel-art').classList.contains('x18') && /\/9\/70010t\.webp$/.test(c.querySelector('img').getAttribute('src')); }), [adds, await rows()]);
      await tap('#addd [data-act=close]'); await page.waitForSelector('#addd', { state: 'hidden' }); }
    await tap('.top .r18-eye'); await page.waitForFunction(() => document.documentElement.hasAttribute('data-r18-open'));
    await page.reload(); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=all]');
    check('تحديث الصفحة يبقي الفلتر مرفوعاً والصور مغطاة من جديد ولو كُشفت قبله (E74)، وما أُضيف باقٍ في القائمة وأعدادها', await lifted() && (await cells()).includes(70010) && await tallyN() === n0 + 3 && await page.evaluate(() => !document.documentElement.hasAttribute('data-r18-open') && !!document.querySelector('#grid .cel-art.x18')), [await lifted(), await cells(), await tallyN()]);
    // الإعادة
    await eye(false);
    check('العين نفسها تعيد الفلتر في مكانها: القائمة كما كانت، وأعمال +18 وما أُضيف منها لا تظهر', await same() && !(await lifted()) && sorted(await cells()) === sorted(all0) && await tallyN() === n0 && await page.locator('.rail .cel[data-id="70010"]').count() === 0 && /عاد الفلتر/.test(await toastText())
      && await page.evaluate(() => JSON.parse(localStorage.getItem('animeg.added'))[70010]?.ad === 1 && document.querySelector('.top .r18-eye').hidden && !document.querySelector('#grid [data-ad]')), [await cells(), await tallyN(), await toastText()]);
    await page.evaluate(() => sessionStorage.setItem('adult.anime', '1')); await page.goto('about:blank'); await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel');
    check('الدخول إلى البوابة من جديد يبدأ والفلتر قائم دائماً', !(await lifted()) && await page.evaluate(() => sessionStorage.getItem('adult.anime') === null));
    // ---------- E66: البحث لا يبقى معلّقاً. Jikan تعطّل فيُسأل AniList، ونتائجه بأرقام MyAnimeList ويقال من أين جاءت؛ وإن تعطّلا معاً فرسالة وزر يعيد البحث
    { const al = []; let alOk = true; const media = [
        { idMal: 88001, title: { romaji: 'Fallback Show', english: 'Fallback' }, format: 'TV', episodes: 24, startDate: { year: 2023 }, coverImage: { medium: 'https://s4.anilist.co/file/a/88001.jpg' }, isAdult: false },
        { idMal: null, title: { romaji: 'Fallback Without Number' }, format: 'ONA', episodes: 1, startDate: { year: 2020 }, coverImage: {}, isAdult: false },
        { idMal: 88002, title: { romaji: 'Fallback Short' }, format: 'TV_SHORT', episodes: 12, startDate: { year: 2021 }, coverImage: { medium: 'https://s4.anilist.co/file/a/88002.jpg' }, isAdult: false },
        { idMal: 88003, title: { romaji: 'Fallback Night' }, format: 'OVA', episodes: 2, startDate: { year: 2019 }, coverImage: { medium: 'https://s4.anilist.co/file/a/88003.jpg' }, isAdult: true }];
      await page.route(/s4\.anilist\.co/, r => r.fulfill({ contentType: 'image/svg+xml', body: svg(100, 140, '#7a4a2a') }));
      let jEmpty = false; await page.route('https://api.jikan.moe/**', r => jEmpty ? r.fulfill({ headers: cors, contentType: 'application/json', body: '{"data":[]}' }) : r.fulfill({ status: 503, headers: cors, contentType: 'application/json', body: '{"status":503}' }));
      await page.route(/graphql\.anilist\.co/, r => { const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
        al.push(JSON.parse(q.postData() || '{}')); return alOk ? r.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ data: { Page: { media } } }) }) : r.fulfill({ status: 500, headers: cors, contentType: 'application/json', body: '{}' }); });
      const rows = () => page.$$eval('#add-res .arow[data-mal]', r => r.map(x => x.dataset.mal).join());
      await tap('.top [data-act=add]'); await page.waitForSelector('#addd[open]'); await page.fill('#add-q', 'fallback'); await page.waitForSelector('#add-res [data-act=add-find]'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arow[data-mal]');
      check('Jikan لا يجيب: يُسأل AniList بلا أعمال +18، ونتائجه بأرقام MyAnimeList (وما لا رقم له يسقط)، ويقال من أين جاءت', al.length === 1 && al[0].variables?.q === 'fallback' && al[0].variables?.n === 12 && /isAdult:false/.test(al[0].query) && await rows() === '88001,88002'
        && /النتائج من\s*AniList/.test((await page.textContent('#add-res')).replace(/[⁦-⁩]/g, '')) && /24 حلقة/.test(await page.textContent('#add-res .arow[data-mal="88001"] .meta')) && /2021/.test(await page.textContent('#add-res .arow[data-mal="88002"] .meta')), [al, await rows(), await page.textContent('#add-res')]);
      alOk = false; await page.fill('#add-q', 'fallback two'); await page.waitForSelector('#add-res [data-act=add-find]'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .msg');
      check('والمصدران لا يجيبان: رسالة تقول ذلك، وزر البحث باقٍ ليعاد، ولا يبقى «يُبحث…» معلّقاً', /لم يُجب/.test(await page.textContent('#add-res .msg')) && /AniList/.test(await page.textContent('#add-res .msg')) && await page.locator('#add-res [data-act=add-find]').count() === 1 && !/يُبحث في/.test(await page.textContent('#add-res')), await page.textContent('#add-res'));
      alOk = true; await tap('#add-res [data-act=add-find]'); await page.waitForSelector('#add-res .arow[data-mal]'); check('والزر يعيد البحث فتأتي نتائجه', await rows() === '88001,88002', await rows());
      jEmpty = true; await page.fill('#add-q', 'fallback three'); await page.waitForSelector('#add-res [data-act=add-find]'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arow[data-mal]');
      check('وJikan يجيب بلا نتيجة: يُسأل AniList أيضاً، وتُعرض نتائجه ويقال إن بحث MyAnimeList لم يجد', await rows() === '88001,88002' && /لم يجد شيئاً بهذا الاسم/.test(await page.textContent('#add-res')) && !/لم يُجب الآن/.test(await page.textContent('#add-res')), await page.textContent('#add-res'));
      alOk = false; await page.fill('#add-q', 'fallback four'); await page.waitForSelector('#add-res [data-act=add-find]'); await page.press('#add-q', 'Enter'); await page.waitForFunction(() => /لا نتيجة هناك بهذا الاسم/.test(document.querySelector('#add-res').textContent));
      check('وإن لم يُجب AniList بعدها بقي جواب MyAnimeList: لا نتيجة، بلا رسالة خطأ', !(await page.locator('#add-res .msg').count()) && await rows() === '', await page.textContent('#add-res'));
      alOk = true; jEmpty = false;
      await tap('#addd [data-act=close]'); await page.waitForSelector('#addd', { state: 'hidden' });
      await eye(true); await tap('.top [data-act=add]'); await page.waitForSelector('#addd[open]'); await page.fill('#add-q', 'fallback'); await page.waitForSelector('#add-res [data-act=add-find]'); await page.press('#add-q', 'Enter'); await page.waitForSelector('#add-res .arow[data-mal="88003"]');
      check('والفلتر مرفوع: AniList يُسأل بلا قيد، وعمل +18 منه يظهر موسوماً مغطى', !/isAdult/.test(al.at(-1).query.split('{idMal')[0]) && al.at(-1).variables?.n === 25 && await rows() === '88001,88002,88003'
        && await page.evaluate(() => { const r = document.querySelector('#add-res .arow[data-mal="88003"]'); return r.hasAttribute('data-ad') && r.querySelector('.aart').classList.contains('x18') && !document.querySelector('#add-res .arow[data-mal="88001"]').hasAttribute('data-ad'); }), [al.at(-1), await rows()]);
      await tap('#addd [data-act=close]'); await page.waitForSelector('#addd', { state: 'hidden' }); await eye(false); } }
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' | ')}` : '\n✅ كل فحوص بوابة أنمياتي نجحت');
process.exit(fails.length ? 1 : 0);
