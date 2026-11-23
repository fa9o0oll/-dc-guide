// الشرائط الأفقية في البوابات (أشاهده الآن، سلسلة العمل، أجزاء السلسلة، الصور…): تُسحب بالماوس كما تُسحب باللمس، ولها سهمان على طرفيها يقلبانها
// صفحة صفحة، والوقوف على السهم ينسابها بهدوء. للماوس وحده: اللمس يسحبها أصلاً، والسهمان لا يظهران إلا لمؤشر دقيق يقف على العناصر.
// السحب يبدأ من البوستر أو فراغ الشريط فقط، فالاسم والتفاصيل تبقى قابلة للتحديد والنسخ. وبعد السحب لا يُعدّ الإفلات نقرة تفتح العمل.
// السهمان عنصران لاصقان داخل الشريط نفسه (position: sticky)، فلا غلاف يتغير به تنسيق الصفحات، وما يُعاد رسمه يُعاد تجهيزه تلقائياً.
const SEL = '.rail, .strip, .reel, .shots, .gchips';
// شكل السهمين في كل البوابات (تُحقن مرة واحدة بدل تكرارها في ملف كل بوابة): زجاج داكن بحافة فاتحة، يلمع بلون البوابة حين يقف عليه المؤشر
const CSS = `.rl-a{--s:var(--rl-s,44px);position:sticky;z-index:6;flex:none;align-self:flex-start;margin-top:var(--rl-y,0px);width:var(--s);height:var(--s);display:grid;place-items:center;border-radius:50%;cursor:pointer;
  color:#fff;background:rgba(10,12,30,.62);border:1px solid rgba(255,255,255,.26);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 18px -6px #000;
  transition:opacity .25s ease,transform .2s ease,background-color .2s ease}
.rl-a svg{width:calc(var(--s) * .5);height:calc(var(--s) * .5);fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.rl-a[data-d="1"]{right:6px}.rl-a[data-d="-1"]{left:6px}
[dir=rtl] .rl-a[data-d="1"],[dir=ltr] .rl-a[data-d="-1"]{margin-inline-end:calc(-1 * var(--s) - var(--rl-gap,0px))}
[dir=rtl] .rl-a[data-d="-1"],[dir=ltr] .rl-a[data-d="1"]{margin-inline-start:calc(-1 * var(--s) - var(--rl-gap,0px))}
.rl-a.off{opacity:0;pointer-events:none}
.rl-a:hover{background:color-mix(in srgb,var(--cel,var(--acc,#7fd4ff)) 34%,rgba(10,12,30,.8));transform:scale(1.06)}
.rl-a:focus-visible{outline:2px solid var(--cel,var(--acc,#7fd4ff));outline-offset:2px}
.rl-drag{cursor:grabbing;-webkit-user-select:none;user-select:none}.rl-drag *{pointer-events:none}
@media not ((hover:hover) and (pointer:fine)){.rl-a{display:none}}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
const fine = matchMedia('(hover: hover) and (pointer: fine)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
const ARROW = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d > 0 ? 'M9.5 6l6 6-6 6' : 'M14.5 6l-6 6 6 6'}"/></svg>`;
// حدود التمرير بإحداثيات المتصفح الحديثة: في RTL يبدأ من 0 ويقل إلى السالب يساراً
const bounds = el => { const span = el.scrollWidth - el.clientWidth, rtl = getComputedStyle(el).direction === 'rtl'; return rtl ? [-span, 0] : [0, span]; };
// السهمان: يختفي ما لا تمرير بعده، ويوضعان عند منتصف أول صورة في الشريط (لا منتصف البطاقة بنصها)
function sync(el) { const [lo, hi] = bounds(el), x = el.scrollLeft, L = el.querySelector(':scope > .rl-a[data-d="-1"]'), R = el.querySelector(':scope > .rl-a[data-d="1"]'); if (!L && !R) return;
  L?.classList.toggle('off', x <= lo + 2); R?.classList.toggle('off', x >= hi - 2);
  const img = el.querySelector('img, .ph'), top = img ? img.getBoundingClientRect().top - el.getBoundingClientRect().top + img.offsetHeight / 2 - 22 : 0;
  if (top > 0) el.style.setProperty('--rl-y', `${Math.round(top)}px`); }
function enhance(el) { arrows(el); if (el.dataset.rail) return requestAnimationFrame(() => sync(el)); el.dataset.rail = '1';
  let t = 0; el.addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(() => { t = 0; sync(el); }); }, { passive: true });
  requestAnimationFrame(() => sync(el)); el.querySelectorAll('img').forEach(i => { if (!i.complete) i.addEventListener('load', () => sync(el), { once: true }); }); }
// السهمان (من جديد إن أُعيد رسم محتوى الشريط فمُحيا معه)
function arrows(el) {
  if (fine.matches && !el.querySelector(':scope > .rl-a')) {
    const mk = d => Object.assign(document.createElement('button'), { type: 'button', className: 'rl-a', innerHTML: ARROW(d), ariaLabel: d > 0 ? 'مرّر يميناً' : 'مرّر يساراً' });
    const a = mk(1), b = mk(-1); a.dataset.d = '1'; b.dataset.d = '-1';
    // اليمين أولاً في الترتيب البصري لصفحة عربية: السهم الأيمن ملتصق بالحافة اليمنى والأيسر بالحافة اليسرى
    const cs = getComputedStyle(el), rtl = cs.direction === 'rtl', gap = parseFloat(cs.columnGap) || 0; el.style.setProperty('--rl-gap', `${gap}px`); el.prepend(rtl ? a : b); el.append(rtl ? b : a); } }
addEventListener('resize', () => document.querySelectorAll('[data-rail]').forEach(sync), { passive: true });
export function rails(root = document) { if (root.matches?.(SEL)) enhance(root); root.querySelectorAll?.(SEL).forEach(enhance); }

// ---------- السحب بالماوس، مع اندفاع خفيف بعد الإفلات
let drag = null;
const canDrag = (el, t) => t === el || !!t.closest('img, picture, .cel-art, .ph, .p, .shot, [data-drag]');
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; const el = e.target.closest?.(SEL); if (!el || !el.dataset.rail || e.target.closest('.rl-a')) return;
  if (!canDrag(el, e.target) || el.scrollWidth <= el.clientWidth) return;
  stopGlide(); drag = { el, x: e.clientX, left: el.scrollLeft, moved: false, v: 0, t: performance.now(), lx: e.clientX }; });
addEventListener('pointermove', e => { if (!drag || e.pointerType !== 'mouse') return; const dx = e.clientX - drag.x;
  if (!drag.moved) { if (Math.abs(dx) < 5) return; drag.moved = true; drag.el.style.scrollSnapType = 'none'; drag.el.classList.add('rl-drag'); getSelection()?.removeAllRanges(); }
  const now = performance.now(), dt = Math.max(1, now - drag.t); drag.v = 0.8 * ((e.clientX - drag.lx) / dt) + 0.2 * drag.v; drag.t = now; drag.lx = e.clientX;
  drag.el.scrollLeft = drag.left - dx; });
const end = () => { if (!drag) return; const d = drag; drag = null; if (!d.moved) return;
  d.el.classList.remove('rl-drag'); const block = e => { e.stopPropagation(); e.preventDefault(); }; d.el.addEventListener('click', block, { capture: true, once: true }); setTimeout(() => d.el.removeEventListener('click', block, true), 60);
  let v = calm.matches ? 0 : -d.v, last = performance.now();   // سرعة المؤشر (بكسل/ملي ثانية) بعكس اتجاه التمرير
  const glide = now => { const dt = now - last; last = now; if (Math.abs(v) < 0.03) { d.el.style.scrollSnapType = ''; return; } d.el.scrollLeft += v * dt; v *= Math.pow(0.94, dt / 16); requestAnimationFrame(glide); };
  requestAnimationFrame(glide); };
addEventListener('pointerup', end); addEventListener('pointercancel', end);
document.addEventListener('dragstart', e => { if (e.target.closest?.(SEL)) e.preventDefault(); });

// ---------- السهمان: النقر يقلب صفحة، والوقوف ينساب بسرعة تتدرج حتى نحو 300 بكسل في الثانية
let gl = null;
const stopGlide = () => { if (gl) { cancelAnimationFrame(gl.raf); gl.el.style.scrollSnapType = ''; gl = null; } };
document.addEventListener('click', e => { const a = e.target.closest?.('.rl-a'); if (!a) return; const el = a.parentElement; stopGlide();
  el.scrollBy({ left: +a.dataset.d * el.clientWidth * 0.82, behavior: calm.matches ? 'auto' : 'smooth' }); });
document.addEventListener('pointerover', e => { const a = e.target.closest?.('.rl-a'); if (!a || e.pointerType !== 'mouse' || calm.matches || gl?.a === a) return; stopGlide();
  const el = a.parentElement, d = +a.dataset.d, t0 = performance.now(); let last = t0; el.style.scrollSnapType = 'none';
  const step = now => { if (!gl) return; const dt = now - last; last = now; const speed = Math.min(0.3, (now - t0) / 1600 * 0.3 + 0.04); el.scrollLeft += d * speed * dt; gl.raf = requestAnimationFrame(step); };
  gl = { a, el, raf: requestAnimationFrame(step) }; });
document.addEventListener('pointerout', e => { if (gl && e.target.closest?.('.rl-a') === gl.a && !gl.a.contains(e.relatedTarget)) stopGlide(); });

// ما يُرسم لاحقاً (البطاقات والنوافذ تُعاد كتابتها) يُجهَّز حين يظهر
new MutationObserver(ms => { for (const m of ms) { if (m.target.nodeType === 1 && m.target.dataset?.rail) enhance(m.target);
  for (const n of m.addedNodes) if (n.nodeType === 1 && !n.classList.contains('rl-a')) rails(n); } }).observe(document.documentElement, { childList: true, subtree: true });
rails();
