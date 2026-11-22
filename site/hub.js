// الواجهة الرئيسية (قاعة البوابات): تجلب صورة كل دليل وعدد أعماله، وتقرأ سجل المشاهدة المحفوظ في المتصفح لتعرض التقدم.
import { initSync } from './sync.js?v=__BUILD__';
const BUILD = '__BUILD__';
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const works = (n) => { const m = n % 100; return n === 1 ? 'عمل واحد' : n === 2 ? 'عملين' : `${n} ${n === 0 || (m >= 3 && m <= 10) ? 'أعمال' : m >= 11 ? 'عملاً' : 'عمل'}`; };
const films = (n) => { const m = n % 100; return n === 1 ? 'فيلم واحد' : n === 2 ? 'فيلمين' : `${n} ${m >= 3 && m <= 10 ? 'أفلام' : m >= 11 ? 'فيلماً' : 'فيلم'}`; };
const games = (n) => { const m = n % 100; return n === 1 ? 'لعبة واحدة' : n === 2 ? 'لعبتين' : `${n} ${m >= 3 && m <= 10 ? 'ألعاب' : 'لعبة'}`; };
const progress = door => { try { return JSON.parse(localStorage.getItem(door.dataset.key) || '{}'); } catch { return {}; } };
// العدّاد: ما شاهدته من كل دليل، وفي ألعابي ما ختمته
const stat = door => { if (!door.dataset.total) return; const pr = progress(door), isGames = door.dataset.guide === 'games', isAnime = door.dataset.guide === 'anime';
  const seen = isGames ? Object.values(pr.games || {}).filter(v => v?.s === 'done').length : isAnime ? Object.values(pr.a || {}).filter(v => v?.s === 'completed').length : Object.values(pr.works || pr.films || {}).filter(v => v === 'watched').length;
  door.querySelector('[data-stat]').textContent = seen ? `${isGames ? 'ختمت' : isAnime ? 'أكملت' : 'شاهدت'} ${seen} من ${door.dataset.total}` : door.dataset.total; };

// ---------- القاعة على الشاشات الأضيق من 1024: تُمرَّر أفقياً، والبوابة في الوسط تواجهك وجاراها مائلان (الميل في hub.css)
const hall = document.getElementById('doors'), nav = document.querySelector('.hall-nav'), narrow = matchMedia('(max-width: 1023.98px)');
const slots = [...hall.querySelectorAll('.slot')], doorOf = s => s.querySelector('.door');
const mid = el => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
const off = s => mid(s) - mid(hall);   // بعد البوابة عن وسط القاعة (الخانة نفسها لا تميل، فقياسها صادق)
const go = (s, smooth = true) => hall.scrollBy({ left: off(s), behavior: smooth && !calm ? 'smooth' : 'instant' });
// أي بوابة في الوسط؟ من موضع التمرير ومراكز الخانات المحفوظة، ولا تُلمس الصفحة إلا حين تستقر القاعة وقد تبدلت البوابة
// التي في الوسط (فتبدأ حركتها وتسكن حركة جارتها ويتبدل ضوء العنوان)
let centers = [], cur;
const measure = () => { centers = slots.map(s => s.offsetLeft + s.offsetWidth / 2); };
const nearest = () => { const c = hall.scrollLeft + hall.clientWidth / 2; let k = 0; centers.forEach((x, i) => { if (Math.abs(x - c) < Math.abs(centers[k] - c)) k = i; }); return slots[k]; };
let onHere = () => {};
function mark() { const h = narrow.matches ? nearest() : null; if (h === cur) return; cur = h;
  for (const s of slots) doorOf(s).toggleAttribute('data-here', s === h);
  document.body.dataset.here = h ? doorOf(h).dataset.guide : '';
  nav?.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(!!h && b.dataset.to === doorOf(h).dataset.guide))); onHere(); }
// أثناء السحب (وحتى يستقر) لا يُكتب في الصفحة شيء، فكل إطار من الحركة على كرت الشاشة وحده؛ الاستقرار من scrollend، وإلا بعد سكون قصير
let still = 0, moving = false;
const settle = () => { clearTimeout(still); moving = false; mark(); onHere(); };
hall.addEventListener('scroll', () => { moving = true; clearTimeout(still); still = setTimeout(settle, 180); }, { passive: true });
hall.addEventListener('scrollend', settle);
nav?.addEventListener('click', e => { const b = e.target.closest('button[data-to]'); if (b) go(slots.find(s => doorOf(s).dataset.guide === b.dataset.to)); });
hall.addEventListener('focusin', e => { const s = e.target.closest('.slot'); if (s && narrow.matches) go(s); });
// تبدأ القاعة بالبوابة التي دخلتها آخر مرة، وإلا بالوسطى فيظهر جاراها على الجانبين
function start() { measure(); if (narrow.matches) { let last = null; try { last = localStorage.getItem('hub.last'); } catch {}
  go(slots.find(s => doorOf(s).dataset.guide === last) || slots[1], false); } cur = undefined; mark(); }
requestAnimationFrame(start); narrow.addEventListener('change', start);
new ResizeObserver(() => { measure(); cur = undefined; mark(); }).observe(hall);

// ---------- ميلان الجوال يحرّك صورة البوابة التي في الوسط وحدها، في طبقتها (لا إعادة رسم)، ويسكن أثناء السحب.
// يُقرأ الميلان نسبةً إلى وضع مرجعي ينجرف ببطء (أي زاوية يُمسك بها الجوال تصير محايدة)، وارتجاف اليد الصغير لا يحرّك شيئاً
if (!calm) { let bx = null, by = null, last = 0, x = 0, y = 0, tx = 0, ty = 0, raf = 0, art = null, wx = NaN, wy = NaN;
  const frame = () => { raf = 0; if (moving || document.hidden) return;
    const a = cur ? doorOf(cur).querySelector('.art') : null;
    if (a !== art) { if (art) art.style.translate = ''; art = a; wx = wy = NaN; }
    x += (tx - x) * .12; y += (ty - y) * .12;
    const px = +(x * -16).toFixed(1), py = +(y * -12).toFixed(1);
    if (art && (px !== wx || py !== wy)) { art.style.translate = `${px}px ${py}px`; wx = px; wy = py; }
    if (Math.abs(tx - x) > .004 || Math.abs(ty - y) > .004) raf = requestAnimationFrame(frame); };
  onHere = () => { if (!raf && !moving) raf = requestAnimationFrame(frame); };
  addEventListener('deviceorientation', e => { if (e.gamma == null || e.beta == null) return;
    const a = ((screen.orientation?.angle ?? 0) + 360) % 360, [gx, gy] = a === 90 ? [e.beta, -e.gamma] : a === 180 ? [-e.gamma, -e.beta] : a === 270 ? [-e.beta, e.gamma] : [e.gamma, e.beta];
    const now = performance.now(), dt = last ? Math.min(.25, (now - last) / 1000) : 0; last = now;
    if (bx == null || Math.abs(gx - bx) > 50 || Math.abs(gy - by) > 50) { bx = gx; by = gy; }
    const k = 1 - Math.exp(-dt / 3); bx += (gx - bx) * k; by += (gy - by) * k;
    const nx = Math.max(-1, Math.min(1, (gx - bx) / 18)), ny = Math.max(-1, Math.min(1, (gy - by) / 18));
    if (Math.abs(nx - tx) < .012 && Math.abs(ny - ty) < .012) return;
    tx = nx; ty = ny; onHere(); });
}
// المؤشر يحرّك صورة البوابة قليلاً (على الكمبيوتر)
if (matchMedia('(hover:hover)').matches) for (const door of document.querySelectorAll('a.door')) {
  let raf = 0; door.addEventListener('pointermove', e => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const r = door.getBoundingClientRect();
    door.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3)); door.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3)); }); });
}
// الدخول: البوابة الجانبية تأتي إلى الوسط أولاً، والتي في الوسط تتمدد لتملأ الشاشة ثم ننتقل، والدليل يستقبلنا بنفس المشهد (.veil في styles.css)
document.addEventListener('click', e => { const a = e.target.closest('a.door'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const s = a.closest('.slot'); if (narrow.matches && s && Math.abs(off(s)) > s.offsetWidth * .25) { e.preventDefault(); return go(s); }
  try { localStorage.setItem('hub.last', a.dataset.guide); } catch {}
  if (calm) return;
  e.preventDefault(); const r = a.getBoundingClientRect(), cs = getComputedStyle(a), vars = ['--bg', '--c1', '--ink', '--display', '--dw'].map(k => `${k}:${cs.getPropertyValue(k)}`).join(';');
  const c = Object.assign(document.createElement('div'), { className: 'curtain' }), t = Object.assign(document.createElement('div'), { className: 'curtain-title', textContent: a.querySelector('strong').textContent });
  c.style.cssText = t.style.cssText = vars; document.body.append(c, t); document.body.classList.add('leaving');
  c.animate({ transform: [`translate(${r.left}px,${r.top}px) scale(${r.width / innerWidth},${r.height / innerHeight})`, 'none'] }, { duration: 480, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both' });
  t.animate({ opacity: [0, 1], transform: ['scale(.92)', 'none'] }, { duration: 300, delay: 240, easing: 'ease-out', fill: 'both' });
  try { sessionStorage.setItem('portal', a.dataset.guide); } catch {}
  setTimeout(() => { location.href = a.href; }, 580);
});
addEventListener('pageshow', () => { document.querySelectorAll('.curtain,.curtain-title').forEach(x => x.remove()); document.body.classList.remove('leaving'); });

// ---------- البيانات: المزامنة تبدأ قبل تحميل الصور، وكل تغيير يصل من جهاز آخر يحدّث عدّاد بابه
initSync(id => { const door = document.querySelector(`.door[data-guide="${id}"]`); if (door) stat(door); });
await Promise.all([...document.querySelectorAll('.door[data-key]')].map(async door => {
  try {
    // الصورة: على الشاشات العريضة لكل بوابة غلاف طولي بلا كتابة خاص بها (data-art-desk: مسار في TMDB بدقته الأصلية، أو بمقاس مسمّى
    // مثل w1280/… إن كان الأصل أكبر مما تحتاجه البوابة بكثير، أو رابط كامل)،
    // فالبوابة هناك طويلة والشاشات كبيرة (4K بتكبير 175٪). وحين يحمل تُعلَّم البوابة (data-poster) فتأخذ هيئة الغلاف الكاملة؛
    // وإن تعذّر رجعت إلى صورتها العادية بهيئتها. وعلى الأضيق: خلفية العمل بالدقة التي تحتاجها البوابة، وألعابي لوحتها من IGDB
    const cat = await (await fetch(`${door.dataset.guide}/data/${door.dataset.file || 'catalog.json'}?v=${BUILD}`)).json(), big = innerWidth * devicePixelRatio > 1000;
    const tmdbSize = !narrow.matches && door.offsetHeight * devicePixelRatio * 1.2 > 720 ? 'original' : big ? 'w1280' : 'w780';
    const own = door.dataset.artDesk; let desk = !narrow.matches && own ? (/^https:\/\//.test(own) ? own : (cat.imageBase || 'https://image.tmdb.org/t/p/') + (own[0] === '/' ? 'original' + own : own)) : null;
    let usual = null;
    if (cat.games) {
      if (door.dataset.artIgdb) usual = `${cat.img || 'https://images.igdb.com/igdb/image/upload/'}t_${big ? '1080p' : '720p'}/${door.dataset.artIgdb}.jpg`;
      if (cat.games.length) door.dataset.total = games(cat.games.length); else door.querySelector('[data-stat]').textContent = 'قائمتك تنتظر أول لعبة';
    } else if (cat.anime) {
      // أنمياتي: غلاف البوابة يختاره البناء (cat.door: بوستر بلا كتابة وخلفية للعمل المسمّى في data-art)، وإلا فبوستر العمل وخلفيته
      const mine = cat.anime.filter(a => a.ord != null), a = cat.anime.find(x => String(x.id) === door.dataset.art) || mine.find(x => x.bd), tall = cat.door?.poster || a?.tp, wide = cat.door?.backdrop || a?.bd;
      if (!narrow.matches && tall) desk = cat.imageBase + 'original' + tall;
      if (wide) usual = cat.imageBase + tmdbSize + wide;
      door.dataset.total = works(mine.length);
    } else {
      const items = cat.works || cat.films, art = items.find(w => w.id === door.dataset.art) || items.find(w => w.backdrop);
      if (art?.backdrop) usual = cat.imageBase + tmdbSize + art.backdrop;
      door.dataset.total = cat.works ? works(items.length) : films(items.length);
    }
    if (desk || usual) {
      const img = new Image(); let poster = !!desk; img.decoding = 'async'; img.alt = '';
      img.onload = () => { if (poster) door.dataset.poster = ''; img.classList.add('in'); };
      img.onerror = () => { if (poster && usual) { poster = false; img.src = usual; } };
      img.src = desk || usual; door.querySelector('.art').append(img);
    }
    stat(door);
  } catch { door.querySelector('[data-stat]').textContent = ''; }
}));
