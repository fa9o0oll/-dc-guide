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
      for (const e of d.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height || (r.right <= b.right + 1 && r.left >= b.left - 1)) continue;
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
  check('القوائم الخمس بترتيب MyAnimeList وأعدادها، ثم الكل', (await lists()).join('|') === 'أشاهده الآن 3|أكملته 4|مؤجَّل 1|تركته 1|سأشاهده 4|الكل 13', await lists());
  check('أرقام السماء: الأعمال والحلقات والأيام ومتوسط التقييم', await page.evaluate(() => { const t = document.querySelector('#tally').textContent; return /13 عملاً في قائمتك/.test(t) && /1,833 حلقة شاهدتها/.test(t) && /30\.2 يوماً من المشاهدة/.test(t) && /متوسط تقييمك 8\.63/.test(t); }), await page.textContent('#tally'));
  check('«أكمل المشاهدة»: الأقرب إلى الإكمال أولاً، ثم ما لم يبدأ', (await page.$$eval('.rail .cel', c => c.map(x => x.dataset.id))).join(',') === '1735,37989,52701' && (await page.$$eval('.rail .tc span', s => s.map(x => x.textContent.trim()))).join('|') === '393 من 500|7 من 12|0 من 24', await page.$$eval('.rail .tc span', s => s.map(x => x.textContent.trim())));
  check('السِل: ختم تقييمك، ومخطط توقيت بخانة لكل حلقة حتى 26 وشريط متصل لما زاد', await page.evaluate(() => { const gk = document.querySelector('.rail .cel[data-id="37989"]'), na = document.querySelector('.rail .cel[data-id="1735"]');
    return gk.querySelector('.stamp').textContent === '8' && gk.querySelector('.tc').style.getPropertyValue('--n') === '12' && !na.querySelector('.tc').style.getPropertyValue('--n') && Math.abs(+na.querySelector('.tc').style.getPropertyValue('--p') - .786) < .001; }));
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
    && /مسلسل/.test(t) && /24 حلقة/.test(t) && /25 دقيقة للحلقة/.test(t) && /شتاء 2024/.test(t) && /Trigger/.test(t) && /8\.60/.test(t) && !!b.querySelector('.ov.en') && location.hash === '#a52701'; }));
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
  await page.goto('about:blank'); await page.goto(base + '/anime/#a37989'); await page.waitForSelector('#sheet[open]');
  check('السجل محفوظ بعد إعادة التحميل', (await log())[37989].p === 11 && (await lists())[0] === 'أشاهده الآن 2');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });

  // ---------- البحث والفرز والنوع والأسماء
  await tap('#lists [data-l=all]'); await page.fill('#q', 'madhouse'); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 2);
  check('البحث بالاستوديو', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '11061,13271');
  await page.fill('#q', 'هنتر'); await page.waitForFunction(() => /هل تقصد/.test(document.querySelector('#count').textContent)).catch(() => {});
  check('البحث بالحروف العربية يجد العمل ويقول «هل تقصد»', await page.evaluate(() => /هل تقصد Hunter x Hunter/.test(document.querySelector('#count').textContent) && [...document.querySelectorAll('#grid .cel')].every(c => /Hunter/.test(c.textContent)) && document.querySelectorAll('#grid .cel').length >= 2), await page.textContent('#count'));
  await page.fill('#q', ''); await page.waitForFunction(() => document.querySelectorAll('#grid .cel').length === 13);
  await page.selectOption('#type', 'Movie'); check('تصفية النوع', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '13271,199'); await page.selectOption('#type', '');
  await tap('#lists [data-l=completed]'); await page.selectOption('#sort', 'pub');
  check('الفرز بتقييم MyAnimeList', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '5114,11061,199,136', await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id)));
  await page.selectOption('#sort', 'mal'); check('وترتيب القائمة هو ترتيبها في MyAnimeList', (await page.$$eval('#grid .cel', c => c.map(x => x.dataset.id))).join(',') === '11061,136,5114,199');
  await page.selectOption('#names', 'english'); check('الأسماء بالإنجليزية لمن له اسم إنجليزي', await page.textContent('#grid .cel[data-id="11061"] h3') === 'Hunter x Hunter' && await page.textContent('#grid .cel[data-id="5114"] h3') === 'Fullmetal Alchemist: Brotherhood'); await page.selectOption('#names', 'romaji');

  // ---------- «أضف أنمي»: البحث في «أنمياتي» (ومعه أقرباء السلاسل)، ثم في MyAnimeList (Jikan مُحاكى)، والإضافة بكلمة السر (الدالة مُحاكاة)
  { const jik = [], adds = [];
    await page.route('https://api.jikan.moe/**', r => { const u = new URL(r.request().url()); jik.push(u.pathname + u.search); const q = u.searchParams.get('q');
      const im = n => ({ webp: { small_image_url: `https://cdn.myanimelist.net/images/anime/1/${n}t.webp` } });
      return r.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ data: q === 'frieren' ? [
        { mal_id: 52991, title: 'Sousou no Frieren', title_english: "Frieren: Beyond Journey's End", type: 'TV', episodes: 28, year: 2023, images: im(1), rating: 'PG-13 - Teens 13 or older' },
        { mal_id: 11061, title: 'Hunter x Hunter (2011)', type: 'TV', episodes: 148, year: 2011, images: im(2), rating: 'PG-13 - Teens 13 or older' },
        { mal_id: 99990, title: 'Should Not Appear', type: 'OVA', episodes: 2, images: im(3), rating: 'Rx - Hentai' },
        { mal_id: 56876, title: 'Sousou no Frieren 2nd Season', type: 'TV', episodes: null, year: null, aired: { prop: { from: { year: 2026 } } }, images: {}, rating: 'PG-13 - Teens 13 or older' }] : [] }) }); });
    await page.route(base + '/api/anime-add', r => { const b = JSON.parse(r.request().postData() || '{}'); adds.push(b);
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
    const w0 = await works(); await page.evaluate(() => localStorage.removeItem('animeg.pass'));   // حفظها قسم «ترجمها لي»
    await tap('#add-res .arow[data-mal="52991"] [data-act=add-mal][data-s=plan]'); await page.waitForSelector('#add-res .add-pass');
    check('أول إضافة من MyAnimeList بلا كلمة سر محفوظة: تُطلب كلمة السر ولا يُرسل شيء', !adds.length && await page.evaluate(() => document.activeElement?.classList.contains('add-pass')));
    await page.fill('#add-res .add-pass', 'nope'); await page.press('#add-res .add-pass', 'Enter'); await page.waitForFunction(() => /كلمة السر غير صحيحة/.test(document.querySelector('#add-res .msg')?.textContent || ''));
    check('كلمة سر خاطئة: تقال، وتُفرغ الخانة، ولا يدخل سجلّك شيء', adds.length === 1 && await page.inputValue('#add-res .add-pass') === '' && (await log())[52991] === undefined, adds);
    await page.fill('#add-res .add-pass', 'open-sesame'); await tap('#add-res .arow[data-mal="52991"] [data-act=add-mal][data-s=plan]'); await page.waitForSelector('#add-res .arow[data-mal="52991"] .astate');
    const sent = adds.at(-1), keys = Object.keys(sent).sort().join();
    check('تُرسل الإضافة رقم العمل واسمه ونوعه وحلقاته فقط، ويدخل سجلّك «سأشاهده»، ويقال إنه يظهر مع البناء القادم', keys === 'eps,mal,password,title,type' && sent.mal === 52991 && sent.title === 'Sousou no Frieren' && sent.type === 'TV' && sent.eps === 28
      && JSON.stringify((await log())[52991]) === '{"s":"plan"}' && /أُضيف إلى «سأشاهده»، ويظهر مع البناء القادم/.test(await page.textContent('#add-res .arow[data-mal="52991"] .astate')) && await works() === w0 + 1
      && await page.evaluate(() => JSON.parse(localStorage.getItem('animeg.added'))[52991]?.s === 'plan' && localStorage.getItem('animeg.pass') === 'open-sesame'), [sent, await works(), w0]);
    await tap('#add-res .arow[data-mal="56876"] [data-act=add-mal][data-s=watching]'); await page.waitForSelector('#add-res .arow[data-mal="56876"] .astate');
    check('وكلمة السر محفوظة بعدها: إضافة أخرى بلا سؤال، وفي القائمة التي اخترتها', adds.length === 3 && adds[2].password === 'open-sesame' && adds[2].eps === 0 && JSON.stringify((await log())[56876]) === '{"s":"watching"}', adds.slice(2));
    await page.keyboard.press('Escape'); await page.waitForSelector('#addd', { state: 'hidden' });
    check('Esc يغلق النافذة برابط نظيف، وما أضفته لا يظهر في القوائم حتى يدخل الكتالوج', await page.evaluate(() => location.hash === '' && !document.querySelector('#grid .cel[data-id="52991"]')));
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('animeg.progress')); delete p.a[52991]; delete p.a[56876]; localStorage.setItem('animeg.progress', JSON.stringify(p)); localStorage.removeItem('animeg.added'); });
    await page.reload(); await page.waitForSelector('#grid .cel'); await tap('#lists [data-l=completed]'); }

  // ---------- السلاسل
  await tap('[data-act=view][data-v=worlds]'); await page.waitForSelector('#worlds .wc');
  check('السلاسل: مدخل دليل Fate أولاً، ثم سلاسل القائمة بتقدّمك فيها', await page.evaluate(() => { const c = [...document.querySelectorAll('#worlds .wc')]; return c.length === 3 && c[0].matches('a.fate[href="../fate/"]') && !!c[0].querySelector('img') && c[1].querySelector('h3').textContent === 'Hunter x Hunter'
    && /4 أعمال · في قائمتك 3 · أكملت 2/.test(c[1].textContent) && document.querySelector('#lists').hidden && /سلسلتان فيها أعمال من قائمتك/.test(document.querySelector('#count').textContent); }), await page.$$eval('#worlds .wc', c => c.map(x => x.textContent.slice(0, 60))));
  await snap('5-worlds'); await overflow('السلاسل');
  await tap('#worlds button.wc'); await page.waitForSelector('#wsheet[open]');
  check('نافذة السلسلة: أعمالها بترتيب الصدور وحالة كل منها', (await page.$$eval('#wsheet .orow', r => r.map(x => x.dataset.id + ':' + x.querySelector('.chip').textContent))).join('|') === '136:أكملته · 10|137:ليس في قائمتك|11061:أكملته · 10|13271:سأشاهده', await page.$$eval('#wsheet .orow', r => r.map(x => x.dataset.id + ':' + x.querySelector('.chip').textContent)));
  await page.waitForSelector('#wintro .ov');
  check('نافذة السلسلة: حكايتها نبذة العمل الذي تحمل اسمه، وأرقامها (أعمالها وحلقاتها ومدتها وسنواتها وما شاهدته منها)', await page.evaluate(() => { const t = document.querySelector('#wsheet-body').textContent, i = document.querySelector('#wintro');
    const [about, tale] = i.querySelectorAll('.sec');
    return about.classList.contains('wabout') && about.querySelector('h3').textContent === 'عن هذا العالم' && /يوشيهيرو توغاشي/.test(about.querySelector('.ov').textContent) && /نسخة 2011/.test(about.querySelector('.ov').textContent)
      && tale.querySelector('h3').textContent === 'الحكاية' && /نبذة Hunter x Hunter \(2011\)/.test(tale.textContent) && /Gon Freecss/.test(tale.querySelector('.ov').textContent) && /4 أعمال/.test(t) && /219 حلقة/.test(t) && /1999 إلى 2013/.test(t) && /في قائمتك 3/.test(t) && /أكملت 2/.test(t) && /شاهدت منها 210 حلقات/.test(t); }), await page.textContent('#wsheet-body .facts'));
  check('سلسلة ترتيب قصتها هو ترتيب صدورها: ترتيب واحد بلا تبديل', await page.locator('#wsheet [data-act=worder]').count() === 0 && /ترتيب القصة في هذه السلسلة هو ترتيب صدورها نفسه/.test(await page.textContent('#worder')));
  await snap('6-world'); await tap('#wsheet .orow[data-id="137"]'); await page.waitForSelector('#sheet[open]');
  await tap('#sheet [data-act=status][data-s=plan]');
  check('عمل من السلسلة ليس في القائمة يُضاف منها', JSON.stringify((await log())[137]) === '{"s":"plan"}' && await page.textContent('#wsheet .orow[data-id="137"] .chip') === 'سأشاهده');
  await page.goBack(); await page.waitForSelector('#sheet', { state: 'hidden' }); await page.goBack(); await page.waitForSelector('#wsheet', { state: 'hidden' });
  check('الرجوع يغلق البطاقة ثم السلسلة', await page.evaluate(() => !document.querySelector('#sheet').open && !document.querySelector('#wsheet').open));
  await tap('#worlds button.wc >> nth=1'); await page.waitForSelector('#wsheet[open]');
  const ord = () => page.$$eval('#wsheet .orow', r => r.map(x => x.dataset.id).join());
  const o1 = await ord(); await tap('#wsheet [data-act=worder][data-o=release]'); const o2 = await ord();
  check('سلسلة لها ترتيب قصة: تفتح عليه، وزر «ترتيب الصدور» يبدّله، وفيها مدخل دليل Fate', o1 === '22297,356' && o2 === '356,22297' && await page.getAttribute('#wsheet [data-o=release]', 'aria-pressed') === 'true' && await page.locator('#wsheet a.fate[href="../fate/"]').count() === 1, [o1, o2]);
  check('ترتيب مُراجَع: ملاحظته تظهر في الترتيبين، ويُقال إنه روجع حين يُعرض ترتيب القصة', /من يشاهد أول مرة يبدأ بترتيب الصدور/.test(await page.textContent('#wsheet .wnote')) && !/راجعناه/.test(await page.textContent('#worder'))
    && await (async () => { await tap('#wsheet [data-act=worder][data-o=story]'); const t = await page.textContent('#worder'); await tap('#wsheet [data-act=worder][data-o=release]'); return /راجعناه عملاً عملاً/.test(t) && /من يشاهد أول مرة/.test(t) && !/علاقات الأعمال/.test(t); })(), await page.textContent('#worder'));
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
    await tap('#sheet [data-act=world]'); await page.waitForSelector('#wsheet[open]'); await tap('#wsheet .orow[data-id="137"]'); await full(137); s = await st();
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
    await page.goto('about:blank'); await page.goto(base + '/anime/#w136'); await page.waitForSelector('#wsheet[open]'); await tap('#wsheet .orow[data-id="136"]'); await full(136);
    await page.goBack(); await shut('#sheet'); s = await st(); await tap('#wsheet [data-act=close]'); await shut('#wsheet'); const s3 = await st();
    check('رابط مباشر إلى سلسلة: الرجوع من عمل فيها يبقيها، و✕ يغلقها برابط نظيف', !s.a && s.w && s.h === '#w136' && !s3.w && s3.h === '' && s3.path === '/anime/', [s, s3]);
    // عنوان كُتب أو لُصق والصفحة مفتوحة
    await page.evaluate(() => { location.hash = '#a136'; }); await full(136); await page.evaluate(() => { location.hash = '#a11061'; }); await full(11061); s = await st();
    await page.keyboard.press('Escape'); await shut('#sheet'); const s4 = await st();
    check('عنوان عمل كُتب باليد والصفحة مفتوحة يفتحه، وعنوان آخر يبدّله، وEsc يغلقه', s.a === 'Hunter x Hunter (2011)' && s.h === '#a11061' && !s4.a && s4.h === '' && s4.path === '/anime/', [s, s4]);
    await page.goto('about:blank'); await page.goto(base + '/anime/'); await page.waitForSelector('#grid .cel'); }
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' | ')}` : '\n✅ كل فحوص بوابة أنمياتي نجحت');
process.exit(fails.length ? 1 : 0);
