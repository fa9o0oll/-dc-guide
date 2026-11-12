// الواجهة الرئيسية: تجلب صورة كل دليل وعدد أعماله، وتقرأ سجل المشاهدة المحفوظ في المتصفح لتعرض التقدم.
import { initSync } from './sync.js?v=__BUILD__';
const BUILD = '__BUILD__';
const works = (n) => { const m = n % 100; return n === 1 ? 'عمل واحد' : n === 2 ? 'عملين' : `${n} ${n === 0 || (m >= 3 && m <= 10) ? 'أعمال' : m >= 11 ? 'عملاً' : 'عمل'}`; };
const films = (n) => { const m = n % 100; return n === 1 ? 'فيلم واحد' : n === 2 ? 'فيلمين' : `${n} ${m >= 3 && m <= 10 ? 'أفلام' : m >= 11 ? 'فيلماً' : 'فيلم'}`; };
const stat = door => { if (!door.dataset.total) return; let seen = 0; try { const pr = JSON.parse(localStorage.getItem(door.dataset.key) || '{}'); seen = Object.values(pr.works || pr.films || {}).filter(v => v === 'watched').length; } catch {}
  door.querySelector('[data-stat]').textContent = seen ? `شاهدت ${seen} من ${door.dataset.total}` : door.dataset.total; };
// المزامنة تبدأ قبل تحميل الصور، وكل تغيير يصل من جهاز آخر يحدّث عدّاد بابه
initSync(id => { const door = document.querySelector(`.door[data-guide="${id}"]`); if (door) stat(door); });
for (const door of document.querySelectorAll('.door[data-key]')) {
  try {
    const cat = await (await fetch(`${door.dataset.guide}/data/${door.dataset.file || 'catalog.json'}?v=${BUILD}`)).json(), items = cat.works || cat.films, isFilms = !cat.works;
    const art = items.find(w => w.id === door.dataset.art) || items.find(w => w.backdrop);
    if (art?.backdrop) { const img = new Image(); img.decoding = 'async'; img.alt = ''; img.src = cat.imageBase + (innerWidth * devicePixelRatio > 1000 ? 'w1280' : 'w780') + art.backdrop;
      img.onload = () => img.classList.add('in'); door.querySelector('.art').append(img); }
    door.dataset.total = isFilms ? films(items.length) : works(items.length); stat(door);
  } catch { door.querySelector('[data-stat]').textContent = ''; }
}

// المؤشر يحرّك صورة الباب قليلاً (على الكمبيوتر)
if (matchMedia('(hover:hover)').matches) for (const door of document.querySelectorAll('a.door')) {
  let raf = 0; door.addEventListener('pointermove', e => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const r = door.getBoundingClientRect();
    door.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3)); door.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3)); }); });
}
// الدخول: الباب المضغوط يتمدد ليملأ الشاشة ثم ننتقل، والدليل يستقبلنا بنفس المشهد (انظر .veil في styles.css)
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('click', e => { const a = e.target.closest('a.door'); if (!a || calm || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault(); const r = a.getBoundingClientRect(), cs = getComputedStyle(a), vars = ['--bg', '--c1', '--ink', '--display', '--dw'].map(k => `${k}:${cs.getPropertyValue(k)}`).join(';');
  const c = Object.assign(document.createElement('div'), { className: 'curtain' }), t = Object.assign(document.createElement('div'), { className: 'curtain-title', textContent: a.querySelector('strong').textContent });
  c.style.cssText = t.style.cssText = vars; document.body.append(c, t); document.body.classList.add('leaving');
  c.animate({ transform: [`translate(${r.left}px,${r.top}px) scale(${r.width / innerWidth},${r.height / innerHeight})`, 'none'] }, { duration: 480, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both' });
  t.animate({ opacity: [0, 1], transform: ['scale(.92)', 'none'] }, { duration: 300, delay: 240, easing: 'ease-out', fill: 'both' });
  try { sessionStorage.setItem('portal', a.dataset.guide); } catch {}
  setTimeout(() => { location.href = a.href; }, 580);
});
addEventListener('pageshow', () => { document.querySelectorAll('.curtain,.curtain-title').forEach(x => x.remove()); document.body.classList.remove('leaving'); });
