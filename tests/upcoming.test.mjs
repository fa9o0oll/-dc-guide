// يفحص الأعمال القادمة في كل البوابات من بياناتها نفسها، فلا يفوته عمل يُضاف لاحقاً:
//   • كل عمل لم يصدر: عدّاد حي إن عُرف موعده، و«قريباً» بمرحلته إن لم يُعرف (دي سي وFate: لوحة بنقش العالم، الأفلام: لافتة سينما)
//   • كل حلقة أو موسم قادم لمسلسل صادر: عدّاده أو «قريباً»
//   • كل عمل بلا بوستر: ملصق بديل (دي سي وFate: ملصق تشويقي بحرف العمل، الأفلام: لوح تصوير)
//   • العدّ نفسه: يتحرك كل ثانية، والرقم المتغير وحده يتحرك، ويكتب «اليوم» حين يحين الموعد (بساعة مصطنعة)
//   • أبواب الصفحة الرئيسية متناسقة: إطار وحجم واحد، بلا ظل مائل، وأسطرها مصطفة على الشاشات العريضة
//   • ميلان البوستر مع المؤشر والضغط عليه على الكمبيوتر، وتوقف الحركة مع «تقليل الحركة»
// node tests/upcoming.test.mjs   (يحتاج playwright عبر NODE_PATH)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname), J = f => JSON.parse(fs.readFileSync(path.join(siteDir, f)));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { let f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 400)}`); if (!ok) fails.push(n); };
const ph = '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="#3a5f8f"/></svg>';
const TODAY = new Date().toISOString().slice(0, 10), soon = w => !w.date || w.date > TODAY;
// البيانات: موعد الحلقة القادمة لمسلسل يُعرض الآن يُحفظ مع المسلسل في قائمة الأفلام (لعدّاده)، ولا شيء لما انتهى أو للفيلم
{ const { shape } = await import('../scripts/lib-films.mjs');
  const tv = shape('tv', { id: 1, name: 'X', first_air_date: '2026-10-15', number_of_seasons: 1, number_of_episodes: 8, next_episode_to_air: { season_number: 1, episode_number: 7, air_date: '2026-11-21' } });
  check('البيانات: الحلقة القادمة للمسلسل تُحفظ بموسمها ورقمها وموعدها', JSON.stringify(tv.next) === '{"s":1,"e":7,"date":"2026-11-21"}' && shape('tv', { id: 2, name: 'Y', next_episode_to_air: null }).next === undefined && shape('movie', { id: 3, title: 'Z' }).next === undefined, tv.next); }
const browser = await chromium.launch();
async function open(width, height, mobile, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ar-SA', ...extra }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|404|Failed to load/.test(m.text()) && errs.push(m.text()));
  await page.route(/image\.tmdb\.org/, r => r.fulfill({ contentType: 'image/svg+xml', body: ph }));
  return { ctx, page, errs };
}

// ---------- دي سي وFate: كل عمل قادم في بطاقته ----------
for (const door of ['dc', 'fate']) {
  console.log(`== ${door}`);
  const base0 = J(`${door}/data/base.json`), cat = new Map(J(`${door}/data/catalog.json`).works.map(w => [w.id, w])), bw = new Map(base0.works.map(w => [w.id, w]));
  const work = id => ({ ...bw.get(id), ...cat.get(id) });
  const { ctx, page, errs } = await open(1280, 900, false);
  await page.goto(`${base}/${door}/`); await page.waitForSelector('.card'); await page.waitForTimeout(500);
  const ids = base0.placements.map(p => ({ p, w: work(p.work), id: `c-${p.universe}-${p.work}${p.season ? '-s' + p.season : ''}` }));
  const up = ids.filter(x => soon(x.w)), res = await page.evaluate(list => list.map(({ id, date, poster, stage }) => { const c = document.getElementById(id); if (!c) return { id, missing: true };
    const pm = c.querySelector('.pm'), tz = c.querySelector('.poster .tz');
    return { id, ok: date ? !!pm?.matches(`[data-until="${date}"]`) && pm.querySelectorAll('.ck .dg').length === 4 && pm.querySelector('.pm-cap').textContent === 'العرض الأول'
      : !!pm?.matches('.tba') && pm.querySelector('.pm-tba b')?.textContent === 'قريباً' && pm.querySelector('.pm-cap').textContent === (stage === 'development' ? 'قيد التطوير' : 'قيد الإنتاج'), art: poster || (!!tz && /^[A-Z0-9؟]$/.test(tz.querySelector('.tz-l').textContent)) }; }),
    up.map(({ id, w, p }) => ({ id, date: w.date, poster: !!w.poster, stage: p.upcoming?.stage })));
  const bad = res.filter(r => r.missing || !r.ok || !r.art);
  check(`${door}: كل عمل قادم (${up.length}) له عدّاد حي بموعده أو «قريباً» بمرحلته، وما لا بوستر له ملصق بديل`, !bad.length, bad.slice(0, 4));
  // حلقة قادمة أو موسم معلن لمسلسل صادر
  const nx = ids.filter(({ w }) => !soon(w) && w.seasons).map(({ id, w }) => ({ id, ep: w.nextEpisode?.date >= TODAY ? w.nextEpisode : null, fut: w.seasons.find(s => s.date && s.date > TODAY), ann: w.seasons.find(s => !s.date) })).filter(x => x.ep || x.fut || x.ann);
  const r2 = await page.evaluate(list => list.filter(({ id, ep, fut, ann }) => { const pm = document.getElementById(id)?.querySelector('.pm');
    return !(ep ? pm?.matches(`[data-until="${ep.date}"]`) && pm.querySelector('.pm-cap').textContent.includes(`الحلقة ${ep.episode}`) : fut ? pm?.matches(`[data-until="${fut.date}"]`) : pm?.matches('.tba') && pm.querySelector('.pm-cap').textContent === `الموسم ${ann.n}`); }).map(x => x.id), nx);
  check(`${door}: كل حلقة أو موسم قادم لمسلسل صادر (${nx.length}) له عدّاده أو «قريباً»`, !r2.length, r2);
  // اللوحة تأخذ نقش عالمها
  const motifs = await page.evaluate(() => [...document.querySelectorAll('section.uni .pm')].every(pm => [...pm.classList].some(c => c.startsWith('m-')) && pm.querySelector(':scope > .motif')));
  check(`${door}: كل لوحة عدّ بنقش عالمها وألوانه`, motifs);
  if (door === 'dc') {
    const dated = up.find(x => x.w.date), tba = up.find(x => !x.w.date && !x.w.poster);
    await page.goto(`${base}/dc/#w=${dated.p.work}`); await page.waitForSelector('#sheet:not([hidden]) .pm'); await page.waitForTimeout(300);
    check('دي سي: نافذة العمل القادم فيها عدّاده الحي أيضاً', await page.evaluate(d => !!document.querySelector(`#sheet .pm[data-until="${d}"] .ck .dg`), dated.w.date));
    await page.goto(`${base}/dc/#w=${tba.p.work}`); await page.waitForSelector('#sheet:not([hidden]) .pm'); await page.waitForTimeout(300);
    check('دي سي: نافذة عمل بلا موعد ولا بوستر: «قريباً» وملصق تشويقي', await page.evaluate(() => !!document.querySelector('#sheet .pm.tba') && !!document.querySelector('#sheet .dw-top .tz .tz-l')));
    await page.goto(`${base}/dc/`); await page.waitForSelector('.card'); await page.evaluate(() => document.querySelector('[data-act="view"][data-view="timeline"]').click()); await page.waitForTimeout(600);
    const noPoster = up.filter(x => !x.w.poster).map(x => `t-${x.p.universe}-${x.p.work}`);
    check('دي سي: في الخط الزمني، العمل بلا بوستر بملصق مصغّر', await page.evaluate(l => l.every(id => document.querySelector(`#${id} .thumb.tz .tz-l`)), noPoster), noPoster);
  }
  check(`${door}: بلا أخطاء برمجية`, !errs.length, errs);
  await ctx.close();
}

// ---------- الأفلام: كل فيلم لم يصدر في تذكرته ونافذته ----------
{ console.log('== films');
  const films = J('films/data/films.json').films, un = films.filter(f => f.kind === 'movie' && soon(f)), tvNext = films.filter(f => f.kind === 'tv' && f.next?.date >= TODAY);
  const { ctx, page, errs } = await open(1280, 900, false);
  await page.goto(`${base}/films/`); await page.waitForSelector('.tk'); await page.waitForTimeout(400);
  const bad = await page.evaluate(list => list.filter(({ id, date, poster }) => { const t = document.getElementById('f-' + id), mq = t?.querySelector('.poster .mq');
    return !(date ? mq?.matches(`[data-until="${date}"]`) && mq.querySelectorAll('.ck .dg').length === 4 : mq?.matches('.tba') && mq.querySelector('b').textContent === 'قريباً') || (!poster && !t.querySelector('.poster .slate .sl-t')); }).map(x => x.id),
    [...un, ...tvNext].map(f => ({ id: f.id, date: f.kind === 'tv' ? f.next.date : f.date, poster: !!f.poster })));
  check(`الأفلام: كل فيلم لم يصدر (${un.length}) وكل حلقة قادمة (${tvNext.length}) بلافتة عدّ أو «قريباً»، وما لا بوستر له لوح تصوير`, !bad.length, bad);
  check('الأفلام: لا لافتة على فيلم صدر', await page.evaluate(ids => ids.every(id => !document.querySelector(`#f-${id} .mq`)), films.filter(f => f.kind === 'movie' && !soon(f)).slice(0, 80).map(f => f.id)));
  const dated = un.find(f => f.date), tba = un.find(f => !f.date);
  for (const [f, label] of [[dated, 'بموعد'], [tba, 'بلا موعد']]) { if (!f) continue;
    await page.evaluate(id => { location.hash = '#' + id; }, f.id); await page.waitForSelector('#sheet[open] .leader'); await page.waitForTimeout(300);
    check(`الأفلام: نافذة فيلم لم يصدر ${label}: شريط العدّ ${f.date ? 'بالأيام في وسطه وعقرب يدور' : 'وعلامة استفهام في وسطه'}`, await page.evaluate(d => { const l = document.querySelector('#sheet .leader'), sw = l.querySelector('.ld-sweep');
      return (d ? l.matches(`[data-until="${d}"]`) && !!l.querySelector('.ck-d .dg') && !!l.querySelector('.ck-t') : l.matches('.tba') && l.querySelector('.ld-q')?.textContent === '؟') && getComputedStyle(sw).animationName === 'ld-spin'; }, f.date));
    await page.evaluate(() => history.back()); await page.waitForTimeout(500); }
  check('الأفلام: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- العدّ نفسه بساعة مصطنعة: الرقم المتغير وحده يتحرك، و«اليوم» حين يحين ----------
{ console.log('== clock');
  const { ctx, page, errs } = await open(1280, 900, false, { timezoneId: 'Asia/Riyadh' });
  await page.clock.install({ time: new Date('2026-11-17T23:59:40+03:00') });
  // فيلم مصطنع موعده منتصف الليل التالي، حتى لا يتعلق الفحص ببيانات تتغير يومياً
  await page.route(/films\/data\/films\.json/, async r => { const res = await r.fetch(), j = await res.json();
    j.films.unshift({ id: 'm9999001', tmdb: 9999001, kind: 'movie', title: 'Clock Test Premiere', date: '2026-11-18', year: 2026, genres: [], poster: null, rating: null, votes: 0, src: 'list', ord: -1 }); return r.fulfill({ response: res, json: j }); });
  await page.goto(`${base}/films/`); await page.waitForSelector('#f-m9999001 .mq .ck');
  // الساعة تُوقف قبل منتصف الليل بست ثوانٍ، ثم تُقدَّم ثانية ثانية
  await page.clock.pauseAt(new Date('2026-11-17T23:59:54+03:00')); await page.clock.runFor(1000); await page.waitForTimeout(50);
  const read = () => page.evaluate(() => [...document.querySelectorAll('#f-m9999001 .ck .dg')].map(d => d.textContent));
  const r0 = await read(); await page.evaluate(() => document.querySelectorAll('.dg span').forEach(x => x.getAnimations().forEach(a => a.finish()))); await page.clock.runFor(1000); await page.waitForTimeout(50);
  const anim = await page.evaluate(() => { const s = [...document.querySelectorAll('#f-m9999001 .ck-t .dg')].pop().children; return [s[0].getAnimations().length, s[1].getAnimations().length]; });
  const r1 = await read();
  check('العدّ: يتحرك كل ثانية، والأيام مخفية حين يبقى أقل من يوم', +r0[3] - +r1[3] === 1 && +r1[3] <= 5 && r0[2] === '00' && r0[1] === '00' && await page.evaluate(() => document.querySelector('#f-m9999001 .ck-d').hidden), [r0, r1]);
  check('العدّ: الرقم الذي تغيّر وحده يصعد مكانه (والذي لم يتغير ثابت)', anim[0] === 0 && anim[1] === 1, anim);
  await page.clock.runFor(6000); await page.waitForTimeout(50);
  check('العدّ: حين يحين الموعد يكتب «يُعرض اليوم»', (await page.textContent('#f-m9999001 .mq .ck')).trim() === 'يُعرض اليوم');
  check('clock: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- الصفحة الرئيسية: أبواب متناسقة ----------
for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['fold-main', 707, 823, true], ['fold-landscape', 823, 707, true], ['fold-cover', 369, 905, true]]) {
  console.log(`== hub ${name}`);
  const { ctx, page, errs } = await open(w, h, mobile);
  await page.goto(`${base}/`); await page.waitForTimeout(700);
  const d = await page.evaluate(() => { const doors = [...document.querySelectorAll('.door')], cs = doors.map(x => getComputedStyle(x));
    return { size: doors.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }), radius: cs.map(c => c.borderTopLeftRadius), border: cs.map(c => c.borderTopStyle + ' ' + c.borderTopWidth),
      slab: cs.some(c => /-?\d+px -?\d+px 0px/.test(c.boxShadow) && !/0px 26px 50px -32px/.test(c.boxShadow)), frame: doors.map(x => getComputedStyle(x, '::before').inset),
      rows: doors.map(x => ['strong', 'bdi', '.say', '.stat'].map(s => x.querySelector(s).getBoundingClientRect()).map((r, i) => Math.round(i ? r.top : r.bottom))), sw: document.documentElement.scrollWidth, iw: innerWidth,
      dcTitle: document.querySelector('.door.dc strong').textContent.includes('دي سي') }; });
  check(`${name}: الأبواب بحجم واحد وإطار واحد وإطار داخلي على البعد نفسه`, new Set(d.size.map(String)).size === 1 && new Set(d.radius).size === 1 && new Set(d.border).size === 1 && new Set(d.frame).size === 1, d);
  check(`${name}: لا ظل مائل يميز باباً عن غيره`, !d.slab, d);
  if (w > 600) check(`${name}: أسطر الأبواب مصطفة (العنوان، اسمه الإنجليزي، الوصف، العدد)`, [0, 1, 2, 3].every(i => Math.max(...d.rows.map(r => r[i])) - Math.min(...d.rows.map(r => r[i])) <= 2), d.rows);
  check(`${name}: «دي سي» لا تنقسم على سطرين، وبلا تمدد أفقي`, d.dcTitle && d.sw <= d.iw, d);
  check(`hub ${name}: بلا أخطاء برمجية`, !errs.length, errs);
  await ctx.close(); }

// ---------- الكمبيوتر: البوستر يميل مع المؤشر ويُضغط ----------
{ console.log('== mouse');
  const { ctx, page, errs } = await open(1440, 900, false);
  await page.goto(`${base}/films/`); await page.waitForSelector('.tk .poster img'); await page.waitForTimeout(400);
  const sel = '.tk .poster[data-zoom-pinch]', b = await page.locator(sel).nth(2).boundingBox(), v = k => page.evaluate(([s, k]) => document.querySelectorAll(s)[2].style.getPropertyValue('--pz-' + k), [sel, k]);
  await page.mouse.move(b.x + b.width * .9, b.y + b.height * .1, { steps: 6 }); await page.waitForTimeout(700);
  const on = await page.evaluate(s => { const t = document.querySelectorAll(s)[2]; return { c: t.classList.contains('pz-t'), tr: getComputedStyle(t.querySelector('img')).transform, glare: +getComputedStyle(t, '::before').opacity }; }, sel);
  check('المؤشر فوق البوستر: يميل نحو موضعه ويمر عليه الضوء (ولا يغلبه تكبير التذكرة القديم)', on.c && +await v('k') > .9 && +await v('x') > .5 && +await v('y') < -.5 && /^matrix3d/.test(on.tr) && on.glare > .3, on);
  await page.mouse.down(); await page.waitForTimeout(250); const p1 = +await v('p'); await page.mouse.up(); await page.waitForTimeout(400);
  check('الضغط على البوستر يدفعه للداخل، ويعود حين يُرفع الزر', p1 > .7 && +await v('p') < .3, p1);
  await page.waitForTimeout(300); if (await page.evaluate(() => document.querySelector('#sheet')?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await page.mouse.move(8, 400, { steps: 4 }); await page.waitForTimeout(1200);
  check('مغادرة المؤشر تعيده مستوياً بنعومة ثم يُزال الميلان', await page.evaluate(s => !document.querySelectorAll(s)[2].classList.contains('pz-t'), sel));
  check('mouse: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

// ---------- تقليل الحركة: لا حركة في العدّ ولا في اللافتة ----------
{ console.log('== reduced-motion');
  const { ctx, page, errs } = await open(369, 905, true, { reducedMotion: 'reduce' });
  await page.goto(`${base}/films/`); await page.waitForSelector('.mq'); await page.waitForTimeout(1300);
  check('تقليل الحركة: الأرقام تتغير بلا حركة، ومصابيح اللافتة ثابتة', await page.evaluate(() => [...document.querySelectorAll('.dg span')].every(s => !s.getAnimations().length) && [...document.querySelectorAll('.mq')].every(m => getComputedStyle(m, '::before').animationName === 'none')));
  await page.goto(`${base}/dc/`); await page.waitForSelector('.pm'); await page.waitForTimeout(1300);
  check('تقليل الحركة: لوحة العدّ بلا ضوء يمر ولا نبض', await page.evaluate(() => [...document.querySelectorAll('.pm')].every(p => getComputedStyle(p, '::after').animationName === 'none') && [...document.querySelectorAll('.dg span')].every(s => !s.getAnimations().length)));
  check('reduced-motion: بلا أخطاء برمجية', !errs.length, errs);
  await ctx.close(); }

await browser.close(); server.close();
console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص الأعمال القادمة نجحت'); process.exit(fails.length ? 1 : 0);
