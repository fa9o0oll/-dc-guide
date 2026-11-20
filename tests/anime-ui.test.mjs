// يفحص بوابة «أنمياتي» في متصفح حقيقي ببيانات tests/fixtures/anime.mjs، وSIMKL مُحاكى:
//   • قبل الاستيراد: القائمة العامة بلا سجل ودعوة الاستيراد
//   • استيراد ملف تصدير MyAnimeList (.xml.gz) في المتصفح: الملخص قبل التطبيق، ثم القوائم الخمس بأعدادها وأرقام السماء
//   • «أكمل المشاهدة»: الأقرب إلى الإكمال أولاً، وزر «+» يعلّم الحلقة التالية مع «تراجع»، وإكمال آخر حلقة ينقل العمل إلى «أكملته» بتاريخ اليوم
//   • بطاقة العمل: الحالة والحلقات والتقييم والتاريخان والإزالة، والنبذة العربية أو الإنجليزية، وأين يُعرض، وسلسلته؛ والرجوع يغلقها
//   • البحث الحرفي والمتسامح («هل تقصد»)، والفرز، والنوع، والأسماء بالإنجليزية
//   • السلاسل: مدخل دليل Fate أولاً، ونافذة السلسلة بترتيبها، وعمل ليس في القائمة يُضاف منها
//   • SIMKL: الربط بالرمز ثم السحب والمطابقة برقم MyAnimeList أو رقم SIMKL، والدمج «الأبعد تقدّماً يغلب»، و«تراجع عن آخر استيراد»
//   • الكمبيوتر وشاشتا الفولد: بلا تمدد أفقي، وأهداف اللمس، وبلا أخطاء برمجية
// NODE_PATH=$(npm root -g) node tests/anime-ui.test.mjs [مجلد اللقطات]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { catalog, texts, malGz, simklItems } from './fixtures/anime.mjs';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname), shots = process.argv[2];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const FX = catalog();
const server = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), J = o => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
  if (u === '/anime/data/catalog.json') return J(FX);
  const m = u.match(/^\/anime\/data\/texts\/(\d+)\.json$/); if (m) return J(Object.fromEntries(Object.entries(texts).filter(([id]) => id % 32 === +m[1])));
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
  const overflow = async label => { const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth })); check(`${label}: بلا تمدد أفقي`, o.sw <= o.iw, o); };

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
  await page.goto('about:blank'); await page.goto(base + '/anime/#a11061'); await page.waitForSelector('#sheet[open]'); await page.waitForFunction(() => !!document.querySelector('#sheet-body .ov:not(.en)'));
  check('رابط مباشر يفتح العمل بنبذته العربية وسلسلته', await page.evaluate(() => /Gon Freecss/.test(document.querySelector('#sheet-body .ov').textContent) && /من سلسلة Hunter x Hunter/.test(document.querySelector('#sheet-body').textContent) && /العمل 3 من 4/.test(document.querySelector('#sheet-body').textContent)
    && document.querySelectorAll('#sheet .strip button').length === 4 && document.querySelector('#sheet .strip [aria-current=true]').getAttribute('aria-label') === 'Hunter x Hunter (2011)'));
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

  // ---------- السلاسل
  await tap('[data-act=view][data-v=worlds]'); await page.waitForSelector('#worlds .wc');
  check('السلاسل: مدخل دليل Fate أولاً، ثم سلاسل القائمة بتقدّمك فيها', await page.evaluate(() => { const c = [...document.querySelectorAll('#worlds .wc')]; return c.length === 3 && c[0].matches('a.fate[href="../fate/"]') && !!c[0].querySelector('img') && c[1].querySelector('h3').textContent === 'Hunter x Hunter'
    && /4 أعمال · في قائمتك 3 · أكملت 2/.test(c[1].textContent) && document.querySelector('#lists').hidden && /سلسلتان فيها أعمال من قائمتك/.test(document.querySelector('#count').textContent); }), await page.$$eval('#worlds .wc', c => c.map(x => x.textContent.slice(0, 60))));
  await snap('5-worlds'); await overflow('السلاسل');
  await tap('#worlds button.wc'); await page.waitForSelector('#wsheet[open]');
  check('نافذة السلسلة: أعمالها بترتيب الصدور وحالة كل منها', (await page.$$eval('#wsheet .orow', r => r.map(x => x.dataset.id + ':' + x.querySelector('.chip').textContent))).join('|') === '136:أكملته · 10|137:ليس في قائمتك|11061:أكملته · 10|13271:سأشاهده', await page.$$eval('#wsheet .orow', r => r.map(x => x.dataset.id + ':' + x.querySelector('.chip').textContent)));
  await page.waitForSelector('#wintro .ov');
  check('نافذة السلسلة: حكايتها نبذة العمل الذي تحمل اسمه، وأرقامها (أعمالها وحلقاتها ومدتها وسنواتها وما شاهدته منها)', await page.evaluate(() => { const t = document.querySelector('#wsheet-body').textContent, i = document.querySelector('#wintro');
    return i.querySelector('h3').textContent === 'الحكاية' && /نبذة Hunter x Hunter \(2011\)/.test(i.textContent) && /Gon Freecss/.test(i.querySelector('.ov').textContent) && /4 أعمال/.test(t) && /219 حلقة/.test(t) && /1999 إلى 2013/.test(t) && /في قائمتك 3/.test(t) && /أكملت 2/.test(t) && /شاهدت منها 210 حلقات/.test(t); }), await page.textContent('#wsheet-body .facts'));
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
  await page.goBack(); await page.waitForSelector('#wsheet', { state: 'hidden' });
  await tap('[data-act=view][data-v=list]');

  // ---------- SIMKL (على الكمبيوتر فقط: ينتظر ثواني الاستعلام)
  if (name === 'desktop') {
    await tap('.top [data-act=import]'); await page.waitForSelector('#imp[open]'); await tap('[data-act=sk-start]'); await page.waitForSelector('#imp .sum b[dir=ltr]');
    check('ربط SIMKL: يظهر الرمز ورابط الموافقة', await page.textContent('#imp .sum b[dir=ltr]') === 'ABCD-1234' && await page.getAttribute('#imp a.btn.pri', 'href') === 'https://simkl.com/pin/ABCD-1234');
    await page.waitForSelector('[data-act=sk-apply]', { timeout: 20000 });
    check('بعد الموافقة يُسحب السجل مرة واحدة، وكل طلب معرَّف، والرمز في المتصفح فقط', asked.join(' | ') === 'POST /oauth2/device | POST /oauth2/token | POST /oauth2/token | GET /sync/activities +auth | GET /sync/all-items/anime +auth'
      && await page.evaluate(() => JSON.parse(localStorage.getItem('animeg.simkl')).access === 'test-access' && !/test-access/.test(localStorage.getItem('animeg.progress')) && !/test-access/.test(localStorage.getItem('guides.sync') || '')), asked);
    check('المطابقة برقم MyAnimeList أو برقم SIMKL، وما لا رقم له يُذكر', (await page.$$eval('#imp .sum b', b => b.map(x => x.textContent))).slice(0, 3).join(',') === '4,2,2' && /طوبق 4 أعمال/.test(await page.textContent('#imp-body')) && /بقي عمل واحد بلا رقم/.test(await page.textContent('#imp-body')) && /0 جديد، 3 يختلف، 1 مطابق/.test(await page.textContent('#imp-body')), await page.textContent('#imp-body'));
    await snap('7-simkl'); const before = await log(); await tap('[data-act=sk-apply][data-how=ahead]'); const L = await log();
    check('«الأبعد تقدّماً يغلب»: حلقات SIMKL الأبعد وحالته، وتقييمك وتواريخك تبقى، وما سبق أبعد لا يتراجع', JSON.stringify(L[37989]) === '{"s":"completed","p":12,"r":8,"b":"2025-06-10","e":"2026-10-02"}' && JSON.stringify(L[22297]) === '{"s":"watching","p":4}' && L[52701].s === 'hold' && L[52701].p === 10 && L[52701].r === 9
      && JSON.stringify(L[11061]) === JSON.stringify(before[11061]) && JSON.stringify(L[1735]) === JSON.stringify(before[1735]), [L[37989], L[22297], L[52701]]);
    await tap('[data-act=restore]');
    check('«تراجع عن آخر استيراد» يعيد السجل كما كان', JSON.stringify(await log()) === JSON.stringify(before));
    await tap('[data-act=sk-forget]'); check('فصل الحساب يمحو رمزه من المتصفح', await page.evaluate(() => localStorage.getItem('animeg.simkl') === null));
    await page.keyboard.press('Escape'); await page.waitForSelector('#imp', { state: 'hidden' });
  }
  check('بلا أخطاء برمجية', errs.length === 0, errs.slice(0, 3));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' | ')}` : '\n✅ كل فحوص بوابة أنمياتي نجحت');
process.exit(fails.length ? 1 : 0);
