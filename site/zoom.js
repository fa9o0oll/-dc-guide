// تكبير البوستر في كل البوابات (دي سي، Fate، أفلامي، وأي بوابة قادمة). استيراد هذا الملف يكفي: كل عنصر فيه data-zoom
// يُكبَّر بوستره عند الضغط عليه. العقد:
//   <button data-zoom="[رابط بدقة أعلى، اختياري]" data-zoom-title="[العنوان]" aria-label="تكبير بوستر …"><img src="…"></button>
// الحركة: البوستر يُرفع من مكانه (يبقى مكانه فارغاً) ويطير إلى وسط الشاشة بميلان خفيف ثم يستقر، والخلفية تعتم وتتلوّن
// بألوانه (نسخة منه مموّهة). بعدها يميل مع المؤشر أو الإصبع ويلمع سطحه كبطاقة مصقولة، ويُغلق بالضغط خارجه أو ✕ أو Esc
// أو زر الرجوع أو بسحبه لأعلى أو لأسفل، فيعود طائراً إلى مكانه. شكله شكل الصغير مكبَّراً (حواف دي سي، وقوس Fate).
// صور TMDB تُطلب بالدقة التي تحتاجها الشاشة (w500 أو w780 أو الأصلية) وتحل محل الصغيرة حين تصل.
// من يفضّل تقليل الحركة في نظامه يرى تلاشياً بسيطاً بلا طيران ولا ميلان.
const TMDB = /(\/t\/p\/)(?:w\d+|original)(\/)/, reduce = matchMedia('(prefers-reduced-motion: reduce)');
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5'/%3E%3C/svg%3E";
const CSS = `
dialog.pz{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:none;color:#fff;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;outline:0}
dialog.pz[open]{display:grid;place-items:center}
dialog.pz::backdrop{background:none}
.pz-scrim,.pz-amb{position:absolute;inset:0;pointer-events:none}
.pz-scrim{background:radial-gradient(125% 90% at 50% 44%,rgba(10,10,14,.72),rgba(3,3,5,.95));-webkit-backdrop-filter:blur(10px) saturate(.85);backdrop-filter:blur(10px) saturate(.85)}
/* الإضاءة المحيطة: نسخة صغيرة من البوستر بربع المقاس، مموّهة ثم مكبّرة أربع مرات لتغطي الشاشة تماماً (أخف من تمويه صورة كاملة) */
.pz-amb{overflow:hidden;mix-blend-mode:screen}
.pz-amb img{position:absolute;left:37.5%;top:37.5%;width:25%;height:25%;object-fit:cover;filter:blur(9px) saturate(1.8);transform:scale(4);opacity:.5}
.pz-fig{position:relative;z-index:1;margin:0;display:grid;justify-items:center;gap:16px}
.pz-fly{position:relative;perspective:1400px;will-change:transform}
.pz-card{position:relative;overflow:hidden;background:#15151b;box-shadow:0 36px 80px -18px rgba(0,0,0,.85),0 10px 28px rgba(0,0,0,.45);transition:transform .3s cubic-bezier(.2,.8,.2,1);will-change:transform;cursor:grab}
.pz-drag .pz-card{transition:none;cursor:grabbing}
.pz-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}
.pz-hi{opacity:0;transition:opacity .45s ease}.pz-hi.in{opacity:1}
.pz-sheen{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s ease;mix-blend-mode:soft-light;background:radial-gradient(circle at var(--sx,50%) var(--sy,30%),rgba(255,255,255,.38),rgba(255,255,255,.08) 30%,transparent 60%)}
.pz-cap{max-width:min(88vw,560px);font-weight:600;font-size:clamp(.95rem,2.6vw,1.1rem);line-height:1.45;text-align:center;color:rgba(255,255,255,.92);text-shadow:0 2px 14px rgba(0,0,0,.7);overflow-wrap:anywhere}
.pz-cap[hidden]{display:none}
.pz-x{position:absolute;z-index:2;top:max(14px,env(safe-area-inset-top));inset-inline-end:max(14px,env(safe-area-inset-left),env(safe-area-inset-right));width:44px;height:44px;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(18,18,24,.5);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;cursor:pointer}
.pz-x svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.pz-x:focus-visible{outline:2px solid #fff;outline-offset:3px}
@media (hover:hover){.pz-x:hover{background:rgba(255,255,255,.16)}}
[data-zoom]{position:relative;cursor:zoom-in;-webkit-tap-highlight-color:transparent}
[data-zoom]:focus-visible{outline:2px solid currentColor;outline-offset:3px}
[data-zoom]::after{content:"";position:absolute;inset-block-end:7px;inset-inline-start:7px;width:26px;height:26px;border-radius:50%;background:rgba(10,10,14,.6) url("${ICON}") center/13px no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.18);pointer-events:none;opacity:.9;transition:transform .2s ease,opacity .2s ease}
@media (hover:hover){[data-zoom]:hover::after{transform:scale(1.12);opacity:1}}
.pz-lifted{visibility:hidden}`;

let D = null, S = 'closed', cur = null, anims = [], skipPop = false, drag = null, raf = 0;
const clamp = (v, a) => Math.max(-a, Math.min(a, v));
// أكبر مقاس يسعه العرض والارتفاع بنسبة البوستر الصغير نفسها، مع مكان للعنوان تحته
const fit = ar => { const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, pad = Math.max(16, Math.min(40, vw * .05));
  let w = Math.min(vw - pad * 2, 600), h = w / ar; const mh = vh - pad * 2 - 64; if (h > mh) { h = mh; w = h * ar; } return [w, h]; };
// صورة TMDB بالدقة التي تحتاجها الشاشة، وأي رابط آخر كما هو
const hiOf = (t, px) => { const im = t.querySelector('img'), u = t.dataset.zoom || im?.currentSrc || im?.src || '';
  return TMDB.test(u) ? u.replace(TMDB, `$1${px > 900 ? 'original' : px > 560 ? 'w780' : 'w500'}$2`) : u; };
// حواف البوستر الصغير مضروبة في نسبة التكبير، فيبقى شكله (القوس والزوايا) كما هو
const radius = (el, k) => { const cs = getComputedStyle(el), c = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(x => cs[`border${x}Radius`].split(' '));
  const f = v => v.endsWith('px') ? `${(parseFloat(v) * k).toFixed(1)}px` : v; return `${c.map(p => f(p[0])).join(' ')} / ${c.map(p => f(p[1] ?? p[0])).join(' ')}`; };

function build() {
  if (D) return D;
  const d = document.createElement('dialog'); d.className = 'pz'; d.setAttribute('aria-label', 'البوستر مكبّراً');
  d.innerHTML = `<div class="pz-scrim"></div><div class="pz-amb" aria-hidden="true"><img alt=""></div>
<figure class="pz-fig"><div class="pz-fly"><div class="pz-card"><img class="pz-lo" alt=""><img class="pz-hi" alt="" decoding="async"><i class="pz-sheen"></i></div></div><figcaption class="pz-cap"><bdi dir="auto"></bdi></figcaption></figure>
<button class="pz-x" type="button" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  document.body.append(d);
  const q = s => d.querySelector(s);
  D = { d, scrim: q('.pz-scrim'), amb: q('.pz-amb'), ambImg: q('.pz-amb img'), fly: q('.pz-fly'), card: q('.pz-card'), lo: q('.pz-lo'), hi: q('.pz-hi'), sheen: q('.pz-sheen'), cap: q('.pz-cap'), capT: q('.pz-cap bdi'), x: q('.pz-x') };
  D.hi.addEventListener('load', () => D.hi.classList.add('in'));
  d.addEventListener('cancel', e => { e.preventDefault(); unzoom(); });
  // Esc هنا لا يصل إلى البوابة (حتى لا تُغلق نافذتها تحته)
  d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); unzoom(); } });
  D.x.addEventListener('click', () => unzoom());
  d.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  d.addEventListener('pointerdown', down); d.addEventListener('pointermove', move); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', () => { if (drag?.moved) settle(); drag = null; });
  d.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) flat(); });
  addEventListener('resize', () => { if (S === 'open') size(); });
  return D;
}
function size() { const [w, h] = fit(cur.ar); D.card.style.width = `${w}px`; D.card.style.height = `${h}px`; D.card.style.borderRadius = radius(cur.shape, w / cur.w0); return w; }

export function zoom(t) {
  const im = t?.querySelector('img'); if (S !== 'closed' || !im || !(im.currentSrc || im.src) || im.dataset.failed) return false;
  build(); S = 'opening';
  const r0 = im.getBoundingClientRect(), shape = [t, im].find(e => ['TopLeft', 'BottomLeft'].some(c => parseFloat(getComputedStyle(e)[`border${c}Radius`]))) || t;
  cur = { t, shape, w0: r0.width || 1, ar: r0.width && r0.height ? r0.width / r0.height : 2 / 3 };
  const w = size(), lo = im.currentSrc || im.src, hi = hiOf(t, w * (devicePixelRatio || 1));
  D.lo.src = lo; D.ambImg.src = lo; D.hi.classList.remove('in'); D.hi.removeAttribute('src'); if (hi && hi !== lo) D.hi.src = hi;
  D.capT.textContent = t.dataset.zoomTitle || im.alt.replace(/^بوستر\s+/, ''); D.cap.hidden = !D.capT.textContent; D.lo.alt = D.capT.textContent ? `بوستر ${D.capT.textContent}` : '';
  D.d.showModal(); t.classList.add('pz-lifted');
  history.pushState({ ...(history.state || {}), pz: 1 }, '');
  if (reduce.matches) anims = [D.d.animate({ opacity: [0, 1] }, { duration: 160, easing: 'ease-out' })];
  else { // يطير من مكانه إلى الوسط، ويميل في الطريق كبطاقة رُفعت باليد ثم يستقر
    const r1 = D.fly.getBoundingClientRect(), dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2), dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2), E = 'cubic-bezier(.16,1,.3,1)';
    anims = [D.fly.animate({ transform: [`translate(${dx}px,${dy}px) scale(${r0.width / r1.width})`, 'none'] }, { duration: 620, easing: E, fill: 'backwards' }),
      D.card.animate([{ transform: 'none' }, { transform: 'rotateY(-13deg) rotateX(7deg) scale(1.015)', offset: .42 }, { transform: 'none' }], { duration: 780, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' }),
      D.scrim.animate({ opacity: [0, 1] }, { duration: 340, easing: 'ease-out', fill: 'backwards' }),
      D.amb.animate({ opacity: [0, 1], transform: ['scale(1.3)', 'none'] }, { duration: 900, easing: E, fill: 'backwards' }),
      D.cap.animate({ opacity: [0, 1], transform: ['translateY(12px)', 'none'] }, { duration: 420, delay: 320, easing: E, fill: 'backwards' }),
      D.x.animate({ opacity: [0, 1], transform: ['scale(.6) rotate(-90deg)', 'none'] }, { duration: 380, delay: 260, easing: E, fill: 'backwards' })]; }
  Promise.all(anims.map(a => a.finished)).then(() => { if (S === 'opening') S = 'open'; }, () => {});
  return true;
}

export function unzoom(fromPop = false) {
  if (!D || S === 'closed' || S === 'closing') return; S = 'closing'; drag = null; cancelAnimationFrame(raf);
  for (const a of anims) { try { a.commitStyles(); } catch {} a.cancel(); } anims = [];
  if (!fromPop && history.state?.pz) { skipPop = true; history.back(); }
  const t = cur?.t, im = t?.isConnected ? t.querySelector('img') : null, r0 = im?.getBoundingClientRect(), els = [D.d, D.fly, D.card, D.scrim, D.amb, D.cap, D.x, D.sheen];
  const seen = r0 && r0.width > 0 && r0.bottom > 0 && r0.top < innerHeight && r0.right > 0 && r0.left < innerWidth;
  const done = () => { if (S !== 'closing') return; t?.classList.remove('pz-lifted'); D.d.close(); for (const a of anims) a.cancel(); anims = [];
    for (const e of els) { e.style.transform = ''; e.style.opacity = ''; } D.fly.classList.remove('pz-drag'); cur = null; S = 'closed'; };
  if (reduce.matches) { anims = [D.d.animate({ opacity: [getComputedStyle(D.d).opacity, 0] }, { duration: 140, easing: 'ease-in', fill: 'forwards' })]; anims[0].finished.then(done, done); return; }
  // يعود طائراً إلى مكانه إن كان مكانه ظاهراً، وإلا يهبط ويتلاشى
  const from = D.fly.style.transform || 'none'; D.fly.style.transform = 'none'; const r1 = D.fly.getBoundingClientRect(); D.fly.style.transform = from;
  const to = seen ? `translate(${r0.left + r0.width / 2 - (r1.left + r1.width / 2)}px,${r0.top + r0.height / 2 - (r1.top + r1.height / 2)}px) scale(${r0.width / r1.width})` : `${from === 'none' ? '' : from} translateY(40px) scale(.8)`.trim();
  const op = e => getComputedStyle(e).opacity, T = 440;
  anims = [D.fly.animate(seen ? { transform: [from, to] } : { transform: [from, to], opacity: [1, 0] }, { duration: T, easing: 'cubic-bezier(.5,0,.15,1)', fill: 'forwards' }),
    D.card.animate({ transform: [D.card.style.transform || 'none', 'none'] }, { duration: 300, easing: 'ease-out', fill: 'forwards' }),
    D.sheen.animate({ opacity: [op(D.sheen), 0] }, { duration: 200, fill: 'forwards' }),
    D.scrim.animate({ opacity: [op(D.scrim), 0] }, { duration: T, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }),
    D.amb.animate({ opacity: [op(D.amb), 0] }, { duration: T * .8, easing: 'ease-in', fill: 'forwards' }),
    D.cap.animate({ opacity: [op(D.cap), 0] }, { duration: 160, fill: 'forwards' }), D.x.animate({ opacity: [op(D.x), 0] }, { duration: 160, fill: 'forwards' })];
  anims[0].finished.then(done, done);
}
export const zoomed = () => S !== 'closed';

// اللمس والمؤشر: سحب البوستر لأعلى أو لأسفل يغلقه (والخلفية تصفو مع السحب)، والسحب القصير يعيده مكانه بارتداد،
// والضغط خارجه يغلقه. والمؤشر فوقه (على الكمبيوتر) يميله ويلمّعه
function down(e) { if ((S !== 'open' && S !== 'opening') || e.button > 0 || e.target.closest('.pz-x')) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dy: 0, moved: false, card: !!e.target.closest('.pz-card') }; }
function shine(e) { const r = D.card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  D.card.style.setProperty('--sx', `${(x * 100).toFixed(1)}%`); D.card.style.setProperty('--sy', `${(y * 100).toFixed(1)}%`); D.sheen.style.opacity = '1'; return [x - .5, y - .5]; }
function move(e) {
  if (S !== 'open' && !drag) return;
  if (!drag) { if (e.pointerType === 'mouse') { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const [x, y] = shine(e); if (Math.abs(x) > .75 || Math.abs(y) > .75) return flat();
      D.card.style.transform = `rotateY(${(x * 16).toFixed(2)}deg) rotateX(${(-y * 16).toFixed(2)}deg)`; }); } return; }
  if (e.pointerId !== drag.id || S !== 'open') return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved) { if (Math.hypot(dx, dy) < 8) return; drag.moved = true; try { D.d.setPointerCapture(e.pointerId); } catch {} D.fly.classList.add('pz-drag'); }
  drag.dx = dx; drag.dy = dy; cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { const p = Math.min(Math.abs(dy) / 360, 1); shine(e);
    D.fly.style.transform = `translate(${(dx * .4).toFixed(1)}px,${dy.toFixed(1)}px) scale(${(1 - p * .14).toFixed(3)})`;
    D.card.style.transform = `rotateX(${clamp(-dy / 14, 16).toFixed(2)}deg) rotateY(${clamp(dx / 10, 18).toFixed(2)}deg)`;
    D.scrim.style.opacity = (1 - p * .75).toFixed(3); D.amb.style.opacity = (1 - p * .8).toFixed(3); D.cap.style.opacity = D.x.style.opacity = (1 - p).toFixed(3); });
}
function up(e) { const g = drag; drag = null; if (!g || e.pointerId !== g.id) return;
  if (!g.moved) { if (!g.card && (S === 'open' || S === 'opening')) unzoom(); return; }
  if (S !== 'open') return;
  cancelAnimationFrame(raf); D.fly.classList.remove('pz-drag'); const v = Math.abs(g.dy) / Math.max(16, e.timeStamp - g.t);
  if (Math.abs(g.dy) > 120 || (Math.abs(g.dy) > 40 && v > .5)) unzoom(); else settle(); }
function settle() { cancelAnimationFrame(raf); D.fly.classList.remove('pz-drag'); const E = 'cubic-bezier(.2,1.3,.4,1)';
  for (const el of [D.fly, D.card]) { const f = el.style.transform || 'none'; el.style.transform = ''; el.animate({ transform: [f, 'none'] }, { duration: 460, easing: E }); }
  D.sheen.style.opacity = '';
  for (const el of [D.scrim, D.amb, D.cap, D.x]) { const o = el.style.opacity; el.style.opacity = ''; if (o) el.animate({ opacity: [o, 1] }, { duration: 300, easing: 'ease-out' }); } }
function flat() { cancelAnimationFrame(raf); if (!D) return; D.card.style.transform = ''; D.sheen.style.opacity = ''; }

document.head.insertAdjacentHTML('beforeend', `<style id="pz-css">${CSS}</style>`);
// يُسجَّل قبل مستمعي البوابة (الاستيراد يُنفَّذ أولاً)، فالرجوع يغلق التكبير وحده ولا يصل إلى نافذة البوابة تحته
addEventListener('popstate', e => { if (skipPop) { skipPop = false; e.stopImmediatePropagation(); return; } if (S === 'open' || S === 'opening') { e.stopImmediatePropagation(); unzoom(true); } });
document.addEventListener('click', e => { const t = e.target.closest?.('[data-zoom]'); if (!t || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; if (zoom(t)) e.preventDefault(); });
// تجهيز الصورة الكبيرة قبل الضغط (عند مرور المؤشر أو لمس البوستر)، فتصل أسرع
document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-zoom]'); if (!t || t.dataset.pzPre) return; t.dataset.pzPre = '1';
  const im = t.querySelector('img'), r = im?.getBoundingClientRect(), u = im && hiOf(t, fit(r?.width && r.height ? r.width / r.height : 2 / 3)[0] * (devicePixelRatio || 1));
  if (u) { const i = new Image(); i.decoding = 'async'; i.src = u; } }, { passive: true });
