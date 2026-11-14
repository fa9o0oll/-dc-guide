// البوسترات في كل البوابات (دي سي، Fate، أفلامي، وأي بوابة قادمة). استيراد هذا الملف يكفي، والعقد علامتان على عنصر البوستر:
//   data-zoom        الضغط يكبّره (ومعه الرابط بدقة أعلى اختيارياً): <button data-zoom data-zoom-title="…"><img src="…"></button>
//   data-zoom-pinch  الضغط يبقى للبوابة (يفتح البطاقة)، والقرص بإصبعين عليه يكبّره
// وكلاهما يميل مع ميلان الجوال ويلمع سطحه كبطاقة مصقولة.
// المكبَّر: يُرفع البوستر من مكانه ويطير إلى الوسط بميلان خفيف ويستقر بشكله نفسه (حواف دي سي، قوس Fate)، والخلفية تعتم
// وتتلوّن بألوانه. يميل مع ميلان الجوال (أو المؤشر)، ويُقرَص بإصبعين للتكبير حتى خمسة أضعاف مع السحب للتنقل فيه، والنقر مرتين
// يكبّر عند موضع النقر ويعيده (وعلى الكمبيوتر العجلة، و+ و- و0 والأسهم). يُغلق بالسحب لأعلى أو لأسفل، أو بقرصه للداخل، أو بالضغط خارجه أو ✕ أو Esc أو زر الرجوع،
// فيعود طائراً إلى مكانه. صور TMDB تُطلب بالدقة التي تحتاجها الشاشة، والأصلية عند التكبير.
// تفضيل «تقليل الحركة» في النظام: تلاشٍ بسيط، بلا طيران ولا ميلان مع الجوال (القرص والسحب يبقيان لأنهما بيد المستخدم).
const TMDB = /(\/t\/p\/)(?:w\d+|original)(\/)/, reduce = matchMedia('(prefers-reduced-motion: reduce)'), SEL = '[data-zoom],[data-zoom-pinch]', MAX = 5;
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5'/%3E%3C/svg%3E";
const CSS = `
dialog.pz{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:none;color:#fff;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;outline:0}
dialog.pz[open]{display:grid;place-items:center}
dialog.pz::backdrop{background:none}
.pz-scrim,.pz-amb{position:absolute;inset:0;pointer-events:none}
.pz-scrim{background:radial-gradient(125% 90% at 50% 44%,rgba(10,10,14,.72),rgba(3,3,5,.95));-webkit-backdrop-filter:blur(10px) saturate(.85);backdrop-filter:blur(10px) saturate(.85)}
/* الإضاءة المحيطة: نسخة صغيرة من البوستر بربع المقاس، مموّهة ثم مكبّرة أربع مرات لتغطي الشاشة (أخف من تمويه صورة كاملة).
   بلا mix-blend-mode: الدمج يعزل المكبَّر فيتوقف تمويه الصفحة خلفه (backdrop-filter)، وفوق ستار داكن الدمج العادي يعطي اللون نفسه */
.pz-amb{overflow:hidden}
.pz-amb img{position:absolute;left:37.5%;top:37.5%;width:25%;height:25%;object-fit:cover;filter:blur(9px) saturate(1.8);transform:scale(4);opacity:.5}
.pz-fig{position:relative;z-index:1;margin:0;display:grid;justify-items:center;gap:16px}
.pz-fly{position:relative;will-change:transform}
.pz-zoom{position:relative;perspective:1400px;transform-origin:50% 50%}
.pz-zoom.pz-ease{transition:transform .34s cubic-bezier(.2,.8,.2,1)}
.pz-on .pz-zoom{will-change:transform}
.pz-card{position:relative;overflow:hidden;background:#15151b;box-shadow:0 36px 80px -18px rgba(0,0,0,.85),0 10px 28px rgba(0,0,0,.45);transition:transform .3s cubic-bezier(.2,.8,.2,1);cursor:grab}
.pz-on .pz-card,.pz-gyro .pz-card{transition:none}
.pz-on .pz-card{cursor:grabbing}
.pz-zoomed .pz-card{cursor:move}
.pz-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}
.pz-hi{opacity:0;transition:opacity .45s ease}.pz-hi.in{opacity:1}
.pz-sheen{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s ease;mix-blend-mode:soft-light;background:radial-gradient(circle at var(--sx,50%) var(--sy,30%),rgba(255,255,255,.38),rgba(255,255,255,.08) 30%,transparent 60%)}
.pz-gyro .pz-sheen{transition:none}
.pz-cap{max-width:min(88vw,560px);font-weight:600;font-size:clamp(.95rem,2.6vw,1.1rem);line-height:1.45;text-align:center;color:rgba(255,255,255,.92);text-shadow:0 2px 14px rgba(0,0,0,.7);overflow-wrap:anywhere;transition:opacity .25s ease}
.pz-cap[hidden]{display:none}
.pz-zoomed .pz-cap{opacity:0}
.pz-x{position:absolute;z-index:2;top:max(14px,env(safe-area-inset-top));inset-inline-end:max(14px,env(safe-area-inset-left),env(safe-area-inset-right));width:44px;height:44px;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(18,18,24,.5);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;cursor:pointer}
.pz-x svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.pz-x:focus-visible{outline:2px solid #fff;outline-offset:3px}
@media (hover:hover){.pz-x:hover{background:rgba(255,255,255,.16)}}
[data-zoom],[data-zoom-pinch]{position:relative;touch-action:pan-x pan-y;-webkit-tap-highlight-color:transparent}
[data-zoom]{cursor:zoom-in}
[data-zoom]:focus-visible{outline:2px solid currentColor;outline-offset:3px}
[data-zoom]::after{content:"";position:absolute;z-index:3;inset-block-end:7px;inset-inline-start:7px;width:26px;height:26px;border-radius:50%;background:rgba(10,10,14,.6) url("${ICON}") center/13px no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.18);pointer-events:none;opacity:.9;transition:transform .2s ease,opacity .2s ease}
@media (hover:hover){[data-zoom]:hover::after{transform:scale(1.12);opacity:1}}
.pz-lifted{visibility:hidden}
/* ميلان البوسترات مع الجوال: الصورة تميل وتنزاح داخل إطارها (كأن للبوستر عمقاً)، وخيط ضوء ينزلق على سطحه بعكس الميلان */
.pz-t>img{transform:perspective(520px) translate(calc(var(--pz-x,0) * -3%),calc(var(--pz-y,0) * -3%)) rotateX(calc(var(--pz-y,0) * -9deg)) rotateY(calc(var(--pz-x,0) * 9deg)) scale(1.12);transition:opacity .4s ease,filter .3s ease!important;will-change:transform}
.pz-t::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;mix-blend-mode:screen;opacity:var(--pz-m,0);background:linear-gradient(105deg,transparent 34%,rgba(255,255,255,.1) 42%,rgba(255,255,255,.42) 49%,rgba(255,255,255,.1) 56%,transparent 64%) calc(50% + var(--pz-x,0) * 70%) calc(50% + var(--pz-y,0) * 50%)/260% 260% no-repeat}
/* القرص على بوستر صغير: نسخة منه تكبر بين الإصبعين فوق ستار يعتم */
.pz-veil{position:fixed;inset:0;z-index:2147483646;background:rgba(5,5,8,.86);opacity:0;pointer-events:none}
.pz-ghost{position:fixed;z-index:2147483647;margin:0;overflow:hidden;pointer-events:none;box-shadow:0 30px 70px -16px rgba(0,0,0,.8);will-change:transform}
.pz-ghost img{width:100%;height:100%;object-fit:cover;display:block}`;

const clamp = (v, a) => Math.max(-a, Math.min(a, v)), lim = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
// أكبر مقاس يسعه العرض والارتفاع بنسبة البوستر الصغير نفسها، مع مكان للعنوان تحته
const fit = ar => { const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, pad = Math.max(16, Math.min(40, vw * .05));
  let w = Math.min(vw - pad * 2, 600), h = w / ar; const mh = vh - pad * 2 - 64; if (h > mh) { h = mh; w = h * ar; } return [w, h]; };
// صورة TMDB بالدقة التي تحتاجها الشاشة، وأي رابط آخر كما هو
const sized = (u, px) => TMDB.test(u) ? u.replace(TMDB, `$1${px > 900 ? 'original' : px > 560 ? 'w780' : 'w500'}$2`) : u;
const srcOf = t => { const im = t.querySelector('img'); return t.dataset.zoom || im?.currentSrc || im?.src || ''; };
// حواف البوستر الصغير مضروبة في نسبة التكبير، فيبقى شكله (القوس والزوايا) كما هو
const radius = (el, k) => { const cs = getComputedStyle(el), c = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(x => cs[`border${x}Radius`].split(' '));
  const f = v => v.endsWith('px') ? `${(parseFloat(v) * k).toFixed(1)}px` : v; return `${c.map(p => f(p[0])).join(' ')} / ${c.map(p => f(p[1] ?? p[0])).join(' ')}`; };
const shapeOf = (t, im) => [t, im].find(e => ['TopLeft', 'BottomLeft'].some(c => parseFloat(getComputedStyle(e)[`border${c}Radius`]))) || t;
const titleOf = (t, im) => t.dataset.zoomTitle || im?.alt.replace(/^بوستر\s+/, '') || '';

// ================= المكبَّر =================
let D = null, S = 'closed', cur = null, anims = [], skipPop = false, Z = { s: 1, x: 0, y: 0 };
const P = new Map(); let G = null, tap = null, single = 0, hover = false, lastType = 'mouse';   // المؤشرات النشطة، والحركة الجارية، والنقر
function build() {
  if (D) return D;
  const d = document.createElement('dialog'); d.className = 'pz'; d.setAttribute('aria-label', 'البوستر مكبّراً');
  d.innerHTML = `<div class="pz-scrim"></div><div class="pz-amb" aria-hidden="true"><img alt=""></div>
<figure class="pz-fig"><div class="pz-fly"><div class="pz-zoom"><div class="pz-card"><img class="pz-lo" alt=""><img class="pz-hi" alt="" decoding="async"><i class="pz-sheen"></i></div></div></div><figcaption class="pz-cap"><bdi dir="auto"></bdi></figcaption></figure>
<button class="pz-x" type="button" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  document.body.append(d);
  const q = s => d.querySelector(s);
  D = { d, scrim: q('.pz-scrim'), amb: q('.pz-amb'), ambImg: q('.pz-amb img'), fly: q('.pz-fly'), zoom: q('.pz-zoom'), card: q('.pz-card'), lo: q('.pz-lo'), hi: q('.pz-hi'), sheen: q('.pz-sheen'), cap: q('.pz-cap'), capT: q('.pz-cap bdi'), x: q('.pz-x') };
  D.hi.addEventListener('load', () => D.hi.classList.add('in'));
  d.addEventListener('cancel', e => { e.preventDefault(); unzoom(); });
  // Esc هنا لا يصل إلى البوابة (حتى لا تُغلق نافذتها تحته). ومن لوحة المفاتيح: + و- للتكبير والتصغير، و0 للمقاس، والأسهم للتنقل
  d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return unzoom(); } keys(e); });
  D.x.addEventListener('click', () => unzoom());
  d.addEventListener('wheel', wheel, { passive: false });
  // النقر المزدوج بالفأرة فقط: متصفح الجوال يرسل dblclick بعد نقرتي اللمس أيضاً، وهاتان تُعالَجان في up فلا يتكرر التبديل
  d.addEventListener('dblclick', e => { if (e.target.closest('.pz-x') || lastType !== 'mouse') return; e.preventDefault(); toggleZoom(e.clientX, e.clientY); });
  d.addEventListener('pointerdown', down); d.addEventListener('pointermove', move); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
  d.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !G) { hover = false; flat(); } });
  addEventListener('resize', () => { if (S === 'open') { size(); snapZ(false); } });
  return D;
}
function size() { const [w, h] = fit(cur.ar); D.card.style.width = `${w}px`; D.card.style.height = `${h}px`; D.card.style.borderRadius = radius(cur.shape, w / cur.w0); cur.w = w; cur.h = h; cur.c = null; return w; }
const setZ = (z, ease = false) => { Z = z; D.zoom.classList.toggle('pz-ease', ease); D.zoom.style.transform = z.s === 1 && !z.x && !z.y ? '' : `translate(${z.x.toFixed(1)}px,${z.y.toFixed(1)}px) scale(${z.s.toFixed(4)})`;
  D.d.classList.toggle('pz-zoomed', z.s > 1.01); if (z.s > 1.25) original(); };
// مركز البوستر وهو بلا تكبير (نقطة الأصل للتكبير)، يُقاس مرة ويُحفظ حتى يتغير المقاس
const center = () => cur.c ||= (() => { const t = D.zoom.style.transform, f = D.fly.style.transform; D.zoom.style.transform = D.fly.style.transform = ''; const r = D.zoom.getBoundingClientRect();
  D.zoom.style.transform = t; D.fly.style.transform = f; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
// حدود التنقل في المكبَّر: لا تظهر حافته داخل الشاشة ما دام أكبر منها، ويبقى في الوسط ما دام أصغر
function bounds(s) { const c = center(), vw = innerWidth, vh = innerHeight, w = cur.w * s, h = cur.h * s;
  return { x: w > vw ? [vw - c.x - w / 2, w / 2 - c.x] : [0, 0], y: h > vh ? [vh - c.y - h / 2, h / 2 - c.y] : [0, 0] }; }
const rubber = (v, [a, b]) => v < a ? a - (a - v) * .35 : v > b ? b + (v - b) * .35 : v;
function snapZ(ease = true) { if (!D || S === 'closed') return; const s = lim(Z.s, 1, MAX); if (s <= 1.01) return setZ({ s: 1, x: 0, y: 0 }, ease); const b = bounds(s);
  setZ({ s, x: lim(Z.x, ...b.x), y: lim(Z.y, ...b.y) }, ease); }
// تكبير حول نقطة: النقطة تحت الإصبعين (أو المؤشر) تبقى تحتهما
const around = (s, p, from = Z, at = p) => { const c = center(), k = s / from.s; return { s, x: at.x - c.x - k * (p.x - c.x - from.x), y: at.y - c.y - k * (p.y - c.y - from.y) }; };
function toggleZoom(x, y) { if (S !== 'open') return; if (Z.s > 1.01) return setZ({ s: 1, x: 0, y: 0 }, true); flat(); const z = around(2.5, { x, y }), b = bounds(2.5);
  setZ({ s: 2.5, x: lim(z.x, ...b.x), y: lim(z.y, ...b.y) }, true); }
function wheel(e) { e.preventDefault(); if (S !== 'open') return; flat();
  const s = lim(Z.s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0025)), 1, MAX), z = around(s, { x: e.clientX, y: e.clientY }), b = bounds(s);
  setZ(s <= 1.01 ? { s: 1, x: 0, y: 0 } : { s, x: lim(z.x, ...b.x), y: lim(z.y, ...b.y) }); }
function zoomBy(k) { const s = lim(Z.s * k, 1, MAX), z = around(s, { x: innerWidth / 2, y: innerHeight / 2 }), b = bounds(s); flat();
  setZ(s <= 1.01 ? { s: 1, x: 0, y: 0 } : { s, x: lim(z.x, ...b.x), y: lim(z.y, ...b.y) }, true); }
const STEP = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
function keys(e) { if (S !== 'open' || e.altKey || e.ctrlKey || e.metaKey) return; const k = e.key, m = STEP[k];
  if (k === '+' || k === '=') zoomBy(1.5); else if (k === '-' || k === '_') zoomBy(1 / 1.5); else if (k === '0') setZ({ s: 1, x: 0, y: 0 }, true);
  else if (m && Z.s > 1.01) { const b = bounds(Z.s); setZ({ s: Z.s, x: lim(Z.x + m[0] * 90, ...b.x), y: lim(Z.y + m[1] * 90, ...b.y) }, true); } else return;
  e.preventDefault(); }
// الصورة الأصلية عند التكبير (حين تصل تحل محل w780 بصمت)
function original() { const u = cur?.src; if (!u || !TMDB.test(u) || cur.orig) return; cur.orig = true; const o = u.replace(TMDB, '$1original$2'); if (D.hi.src === o) return;
  const i = new Image(); i.decoding = 'async'; i.onload = () => { if (cur?.src === u) { D.hi.src = o; D.hi.classList.add('in'); } }; i.src = o; }

export function zoom(t, opt = {}) {
  const im = t?.querySelector('img'); if (S !== 'closed' || !im || !(im.currentSrc || im.src) || im.dataset.failed) return false;
  build(); S = 'opening'; askMotion();
  const rt = im.getBoundingClientRect(), r0 = opt.from || rt, lo = opt.src || im.currentSrc || im.src;
  cur = { t, shape: shapeOf(t, im), w0: rt.width || 1, ar: rt.width && rt.height ? rt.width / rt.height : 2 / 3, src: srcOf(t), orig: false };
  const w = size(), hi = sized(cur.src, w * (devicePixelRatio || 1));
  setZ({ s: 1, x: 0, y: 0 }); D.lo.src = lo; D.ambImg.src = lo; D.hi.classList.remove('in'); D.hi.removeAttribute('src'); if (hi && hi !== lo) D.hi.src = hi;
  D.capT.textContent = titleOf(t, im); D.cap.hidden = !D.capT.textContent; D.lo.alt = D.capT.textContent ? `بوستر ${D.capT.textContent}` : '';
  D.d.showModal(); t.classList.add('pz-lifted'); gyro.rebase(8);
  history.pushState({ ...(history.state || {}), pz: 1 }, '');
  const E = 'cubic-bezier(.16,1,.3,1)', fade = (el, ms, delay = 0, from = 'none') => el.animate({ opacity: [0, 1], transform: [from, 'none'] }, { duration: ms, delay, easing: E, fill: 'backwards' });
  const r1 = D.fly.getBoundingClientRect(), dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2), dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2), big = opt.from && r0.width > r1.width * 1.12;
  if (big) setZ({ s: Math.min(r0.width / r1.width, MAX), x: dx, y: dy }); // انتهى القرص والبوستر أكبر من مقاسه: يفتح مكبَّراً حيث تركته الأصابع، بلا طيران
  if (reduce.matches) anims = opt.from ? [] : [D.d.animate({ opacity: [0, 1] }, { duration: 160, easing: 'ease-out' })];
  else { // الستار يبدأ من عتمة القرص إن جاء منه، فلا تومض الصفحة بينهما
    anims = [D.scrim.animate({ opacity: [opt.dim || 0, 1] }, { duration: 340, easing: 'ease-out', fill: 'backwards' }), fade(D.amb, 900, 0, 'scale(1.3)'),
      fade(D.cap, 420, 320, 'translateY(12px)'), fade(D.x, 380, 260, 'scale(.6) rotate(-90deg)')];
    if (!big) // يطير من مكانه (أو من حيث تركه القرص) إلى الوسط، ويميل في الطريق كبطاقة رُفعت باليد ثم يستقر
      anims.push(D.fly.animate({ transform: [`translate(${dx}px,${dy}px) scale(${r0.width / r1.width})`, 'none'] }, { duration: 620, easing: E, fill: 'backwards' }),
        D.card.animate([{ transform: 'none' }, { transform: 'rotateY(-13deg) rotateX(7deg) scale(1.015)', offset: .42 }, { transform: 'none' }], { duration: 780, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' })); }
  Promise.all(anims.map(a => a.finished)).then(() => { if (S === 'opening') { S = 'open'; snapZ(); } }, () => {});
  return true;
}

export function unzoom(fromPop = false) {
  if (!D || S === 'closed' || S === 'closing') return; S = 'closing'; G = null; P.clear(); clearTimeout(single); D.d.classList.remove('pz-on', 'pz-gyro');
  for (const a of anims) { try { a.commitStyles(); } catch {} a.cancel(); } anims = [];
  if (!fromPop && history.state?.pz) { skipPop = true; history.back(); }
  const t = cur?.t, im = t?.isConnected ? t.querySelector('img') : null, r0 = im?.getBoundingClientRect(), els = [D.d, D.fly, D.zoom, D.card, D.scrim, D.amb, D.cap, D.x, D.sheen];
  const seen = r0 && r0.width > 0 && r0.bottom > 0 && r0.top < innerHeight && r0.right > 0 && r0.left < innerWidth;
  const done = () => { if (S !== 'closing') return; t?.classList.remove('pz-lifted'); D.d.close(); for (const a of anims) a.cancel(); anims = [];
    for (const e of els) { e.style.transform = ''; e.style.opacity = ''; e.style.translate = ''; } D.zoom.classList.remove('pz-ease'); D.d.classList.remove('pz-zoomed'); Z = { s: 1, x: 0, y: 0 }; cur = null; S = 'closed'; gyro.rebase(2.5); };
  if (reduce.matches) { anims = [D.d.animate({ opacity: [getComputedStyle(D.d).opacity, 0] }, { duration: 140, easing: 'ease-in', fill: 'forwards' })]; anims[0].finished.then(done, done); return; }
  // يعود طائراً إلى مكانه إن كان مكانه ظاهراً، وإلا يهبط ويتلاشى. والتكبير يعود معه في الطريق
  const from = D.fly.style.transform || 'none', zf = getComputedStyle(D.zoom).transform; D.zoom.classList.remove('pz-ease');
  D.fly.style.transform = 'none'; D.zoom.style.transform = ''; const r1 = D.fly.getBoundingClientRect(); D.fly.style.transform = from;
  const to = seen ? `translate(${r0.left + r0.width / 2 - (r1.left + r1.width / 2)}px,${r0.top + r0.height / 2 - (r1.top + r1.height / 2)}px) scale(${r0.width / r1.width})` : `${from === 'none' ? '' : from} translateY(40px) scale(.8)`.trim();
  const op = e => getComputedStyle(e).opacity, T = 440, E = 'cubic-bezier(.5,0,.15,1)';
  anims = [D.fly.animate(seen ? { transform: [from, to] } : { transform: [from, to], opacity: [1, 0] }, { duration: T, easing: E, fill: 'forwards' }),
    D.zoom.animate({ transform: [zf === 'none' ? 'none' : zf, 'none'] }, { duration: T, easing: E, fill: 'forwards' }),
    D.card.animate({ transform: [D.card.style.transform || 'none', 'none'] }, { duration: 300, easing: 'ease-out', fill: 'forwards' }),
    D.sheen.animate({ opacity: [op(D.sheen), 0] }, { duration: 200, fill: 'forwards' }),
    D.scrim.animate({ opacity: [op(D.scrim), 0] }, { duration: T, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }),
    D.amb.animate({ opacity: [op(D.amb), 0] }, { duration: T * .8, easing: 'ease-in', fill: 'forwards' }),
    D.cap.animate({ opacity: [op(D.cap), 0] }, { duration: 160, fill: 'forwards' }), D.x.animate({ opacity: [op(D.x), 0] }, { duration: 160, fill: 'forwards' })];
  anims[0].finished.then(done, done);
}
export const zoomed = () => S !== 'closed';

// ---------- اللمس والمؤشر في المكبَّر ----------
// إصبع واحد: يسحبه للإغلاق (وهو بمقاسه) أو يتنقل فيه (وهو مكبَّر). إصبعان: قرص للتكبير، وللإغلاق إن صغُر كثيراً.
// نقرة خارجه تغلقه، ونقرتان تكبّران عند موضعهما. والمؤشر فوقه (على الكمبيوتر) يميله ويلمّعه
const pts = () => [...P.values()];
function down(e) {
  lastType = e.pointerType; if ((S !== 'open' && S !== 'opening') || e.button > 0 || e.target.closest('.pz-x')) return;
  P.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { D.d.setPointerCapture(e.pointerId); } catch {}
  if (P.size === 2 && S === 'open') { const [a, b] = pts(); rest(); G = { k: 'pinch', d0: Math.max(10, dist(a, b)), m0: mid(a, b), z0: { ...Z } }; D.d.classList.add('pz-on'); flat(); return; }
  if (P.size === 1) G = { k: 'tap', x: e.clientX, y: e.clientY, t: e.timeStamp, z0: { ...Z }, card: !!e.target.closest('.pz-card'), type: e.pointerType };
}
function move(e) {
  if (S === 'open' && !G && e.pointerType === 'mouse') { const r = cardBox(); hover = true; tiltTo((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5, 16); return; }
  if (!G || !P.has(e.pointerId) || S !== 'open') return;
  P.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (G.k === 'pinch') { if (P.size < 2) return; const [a, b] = pts(), m = mid(a, b), raw = G.z0.s * dist(a, b) / G.d0;
    const s = raw > MAX ? MAX + (raw - MAX) * .3 : raw < 1 ? 1 - (1 - raw) * .6 : raw; setZ(around(s, G.m0, G.z0, m));
    if (s < 1) { const p = lim((1 - s) / .35, 0, 1); D.scrim.style.opacity = (1 - p * .6).toFixed(3); D.amb.style.opacity = (1 - p * .7).toFixed(3); } else D.scrim.style.opacity = D.amb.style.opacity = '';
    return; }
  const dx = e.clientX - G.x, dy = e.clientY - G.y;
  if (G.k === 'tap') { if (Math.hypot(dx, dy) < 8) return; G.k = Z.s > 1.01 ? 'pan' : 'drag'; D.d.classList.add('pz-on'); hover = false; }
  if (G.k === 'pan') { const dt = Math.max(1, e.timeStamp - (G.lt ?? G.t)); G.vx = (e.clientX - (G.lx ?? G.x)) / dt; G.vy = (e.clientY - (G.ly ?? G.y)) / dt;
    G.lx = e.clientX; G.ly = e.clientY; G.lt = e.timeStamp; const b = bounds(Z.s); setZ({ s: Z.s, x: rubber(G.z0.x + dx, b.x), y: rubber(G.z0.y + dy, b.y) }); return; }
  if (G.k === 'drag') { const p = Math.min(Math.abs(dy) / 360, 1); shine(e.clientX, e.clientY);
    D.fly.style.transform = `translate(${(dx * .4).toFixed(1)}px,${dy.toFixed(1)}px) scale(${(1 - p * .14).toFixed(3)})`;
    D.card.style.transform = `rotateX(${clamp(-dy / 14, 16).toFixed(2)}deg) rotateY(${clamp(dx / 10, 18).toFixed(2)}deg)`;
    D.scrim.style.opacity = (1 - p * .75).toFixed(3); D.amb.style.opacity = (1 - p * .8).toFixed(3); D.cap.style.opacity = D.x.style.opacity = (1 - p).toFixed(3); }
}
function up(e) {
  if (!P.has(e.pointerId)) return; P.delete(e.pointerId); const g = G; if (!g) return;
  if (g.k === 'pinch') { if (Z.s < .8 && e.type === 'pointerup') { G = null; P.clear(); return unzoom(); } // قرص للداخل: يغلقه
    if (P.size === 1) { const [r] = pts(); G = { k: Z.s > 1.01 ? 'pan' : 'tap', x: r.x, y: r.y, t: e.timeStamp, z0: { ...Z }, card: true, type: 'touch' }; } else G = null;
    D.scrim.style.opacity = D.amb.style.opacity = ''; if (!G) D.d.classList.remove('pz-on'); snapZ(); return; }
  if (P.size) return; G = null; D.d.classList.remove('pz-on');
  if (g.k === 'tap' && e.type === 'pointerup') { // نقرة: خارج البوستر تغلق، ونقرتان متقاربتان تكبّران (اللمس فقط، والفأرة لها dblclick)
    if (g.type === 'mouse') { if (!g.card) unzoom(); return; }
    if (tap && e.timeStamp - tap.t < 300 && Math.hypot(g.x - tap.x, g.y - tap.y) < 40) { clearTimeout(single); tap = null; return toggleZoom(g.x, g.y); }
    tap = { x: g.x, y: g.y, t: e.timeStamp }; clearTimeout(single); if (!g.card && Z.s <= 1.01) single = setTimeout(() => { tap = null; unzoom(); }, 280); return; }
  if (g.k === 'pan') { const b = bounds(Z.s), k = 160; setZ({ s: Z.s, x: lim(Z.x + (g.vx || 0) * k, ...b.x), y: lim(Z.y + (g.vy || 0) * k, ...b.y) }, true); return; }
  if (g.k === 'drag') { const dy = e.clientY - g.y, v = Math.abs(dy) / Math.max(16, e.timeStamp - g.t);
    if (e.type === 'pointerup' && (Math.abs(dy) > 120 || (Math.abs(dy) > 40 && v > .5))) unzoom(); else rest(); }
}
// عودة البوستر المسحوب إلى مكانه بارتداد
function rest() { if (!D.fly.style.transform && !D.card.style.transform) return; const E = 'cubic-bezier(.2,1.3,.4,1)';
  for (const el of [D.fly, D.card]) { const f = el.style.transform || 'none'; el.style.transform = ''; el.animate({ transform: [f, 'none'] }, { duration: 460, easing: E }); }
  D.sheen.style.opacity = '';
  for (const el of [D.scrim, D.amb, D.cap, D.x]) { const o = el.style.opacity; el.style.opacity = ''; if (o) el.animate({ opacity: [o, 1] }, { duration: 300, easing: 'ease-out' }); } }
const cardBox = () => D.card.getBoundingClientRect();
function shine(x, y) { const r = cardBox(); D.card.style.setProperty('--sx', `${((x - r.left) / r.width * 100).toFixed(1)}%`); D.card.style.setProperty('--sy', `${((y - r.top) / r.height * 100).toFixed(1)}%`); D.sheen.style.opacity = '1'; }
// ميل البوستر المكبَّر: x وy بين -0.5 و0.5 تقريباً، والضوء ينعكس من الجهة المقابلة
function tiltTo(x, y, deg) { if (S !== 'open' || Z.s > 1.01 || G) return; if (Math.abs(x) > .8 || Math.abs(y) > .8) return flat();
  D.card.style.transform = `rotateY(${(x * deg).toFixed(2)}deg) rotateX(${(-y * deg).toFixed(2)}deg)`;
  D.card.style.setProperty('--sx', `${(50 - x * 90).toFixed(1)}%`); D.card.style.setProperty('--sy', `${(40 - y * 90).toFixed(1)}%`); D.sheen.style.opacity = Math.min(1, Math.hypot(x, y) * 3).toFixed(3); }
function flat() { if (!D) return; D.card.style.transform = ''; D.sheen.style.opacity = ''; D.amb.style.translate = ''; D.d.classList.remove('pz-gyro'); }

// ================= ميلان الجوال =================
// زاوية الجوال تُقرأ نسبةً إلى وضع «مرجعي» ينجرف ببطء نحو الوضع الحالي، فأي زاوية يُمسك بها الجوال تصير محايدة،
// والميلان الجديد هو ما يحرّك البوسترات. القراءة تُنعَّم في كل إطار فلا ارتجاف. في المكبَّر يُثبَّت المرجع عند فتحه وينجرف أبطأ
const gyro = { x: 0, y: 0, tx: 0, ty: 0, bx: null, by: null, last: 0, tau: 2.5, raf: 0, live: false,
  rebase(tau) { this.tau = tau; this.bx = null; },
  read(e) { if (e.gamma == null || e.beta == null || reduce.matches) return;
    const a = ((screen.orientation?.angle ?? window.orientation ?? 0) + 360) % 360, g = e.gamma, b = e.beta;
    const [x, y] = a === 90 ? [b, -g] : a === 180 ? [-g, -b] : a === 270 ? [-b, g] : [g, b];
    const now = performance.now(), dt = this.last ? Math.min(.25, (now - this.last) / 1000) : 0; this.last = now;
    if (this.bx == null || Math.abs(x - this.bx) > 50 || Math.abs(y - this.by) > 50) { this.bx = x; this.by = y; } // أول قراءة، أو قفزة (انقلاب المحاور حين يُرفع الجوال عمودياً)
    const k = 1 - Math.exp(-dt / this.tau); this.bx += (x - this.bx) * k; this.by += (y - this.by) * k;
    this.tx = clamp((x - this.bx) / 20, 1); this.ty = clamp((y - this.by) / 20, 1);
    if (!this.live) { this.live = true; track(); }
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame()); },
  frame() { this.raf = 0; this.x += (this.tx - this.x) * .16; this.y += (this.ty - this.y) * .16;
    if (S === 'open') { if (!hover && Z.s <= 1.01 && !G) { D.d.classList.add('pz-gyro'); tiltTo(this.x * .5, this.y * .5, 26); D.amb.style.translate = `${(-this.x * 18).toFixed(1)}px ${(-this.y * 18).toFixed(1)}px`; } }
    else if (S === 'closed') posters(this.x, this.y);
    if (Math.abs(this.tx - this.x) > .003 || Math.abs(this.ty - this.y) > .003) this.raf = requestAnimationFrame(() => this.frame()); } };
addEventListener('deviceorientation', e => gyro.read(e));
// iOS يطلب الإذن من لمسة المستخدم، فيُطلب أول ما يُكبَّر بوستر. أندرويد لا يحتاجه
let asked = false;
function askMotion() { if (asked) return; asked = true; const R = globalThis.DeviceOrientationEvent?.requestPermission; if (typeof R === 'function') R.call(DeviceOrientationEvent).catch(() => {}); }

// البوسترات الظاهرة على الشاشة فقط تميل (تتبعها IntersectionObserver)، وما خرج منها يعود مستوياً
let painted = '';   // آخر قيم كُتبت، فلا يُعاد رسم البوسترات ما دام الجوال ثابتاً
const vis = new Set(), io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { painted = ''; for (const e of es) { if (e.isIntersecting) vis.add(e.target); else { vis.delete(e.target); still(e.target); } } }, { rootMargin: '40px' }) : null;
const still = el => { el.classList.remove('pz-t'); el.style.removeProperty('--pz-x'); el.style.removeProperty('--pz-y'); el.style.removeProperty('--pz-m'); };
// كل بوستر في الصفحة (وما يُضاف لاحقاً): يُتابَع ظهوره للميلان إن كان للجهاز مستشعر، ويُمنع تمرير الصفحة أثناء القرص عليه في اللمس
const touchy = navigator.maxTouchPoints > 0 || 'ontouchstart' in window, hooked = new WeakSet();
const hold = e => { if (pin && e.cancelable) e.preventDefault(); }; // متصفح الجوال يمرّر الصفحة إن تحرك الإصبعان معاً فيقطع القرص
function watch(root) { const els = [...(root.matches?.(SEL) ? [root] : []), ...(root.querySelectorAll?.(SEL) || [])];
  for (const el of els) { if (gyro.live) io?.observe(el); if (touchy && !hooked.has(el)) { hooked.add(el); el.addEventListener('touchmove', hold, { passive: false }); } } }
let mo = null;
function track() { watch(document.body); if (mo) return; mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) watch(n); }); mo.observe(document.body, { childList: true, subtree: true }); }
function posters(x, y) { const m = (Math.min(1, Math.hypot(x, y)) * .9).toFixed(2), sx = x.toFixed(2), sy = y.toFixed(2), key = `${sx} ${sy} ${m}`;
  if (key === painted) return; painted = key;
  for (const el of vis) { if (!el.isConnected) { vis.delete(el); continue; } if (el.classList.contains('pz-lifted')) continue;
    el.classList.add('pz-t'); el.style.setProperty('--pz-x', sx); el.style.setProperty('--pz-y', sy); el.style.setProperty('--pz-m', m); } }

// ================= القرص على بوستر صغير =================
// إصبعان على بوستر في الصفحة: نسخة منه تكبر بينهما فوق ستار يعتم. إن كبُرت بما يكفي عند رفع الأصابع فُتح المكبَّر من حيث
// تركته (مكبَّراً إن كانت أكبر من مقاسه)، وإلا عادت إلى مكانها
const T = new Map(); let pin = null;
// والبوستر الصغير قد لا يتسع للإصبعين، فالإصبع الثاني يُقبل قريباً منه أيضاً
const near = (t, x, y, m = 56) => { const r = t.getBoundingClientRect(); return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m; };
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || S !== 'closed') return;
  let t = e.target.closest?.(SEL); if (!t && T.size === 1) { const [a] = T.values(); if (near(a.t, e.clientX, e.clientY)) t = a.t; } if (!t) return;
  T.set(e.pointerId, { x: e.clientX, y: e.clientY, t }); if (T.size === 2 && !pin) { const [a, b] = [...T.values()]; if (a.t === b.t) pinchStart(t, a, b); } }, true);
document.addEventListener('pointermove', e => { const p = T.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY; if (pin && T.size >= 2) pinchMove(); }, true);
const lift = e => { if (!T.has(e.pointerId)) return; T.delete(e.pointerId); if (pin) pinchEnd(e.type === 'pointerup'); };
document.addEventListener('pointerup', lift, true); document.addEventListener('pointercancel', lift, true);
function pinchStart(t, a, b) {
  const im = t.querySelector('img'); if (!im || !(im.currentSrc || im.src) || im.dataset.failed) return;
  const r = im.getBoundingClientRect(), host = t.closest('dialog[open]') || document.body, m = mid(a, b);
  const veil = Object.assign(document.createElement('div'), { className: 'pz-veil' }), g = Object.assign(document.createElement('figure'), { className: 'pz-ghost' });
  g.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${getComputedStyle(shapeOf(t, im)).borderRadius};transform-origin:${m.x - r.left}px ${m.y - r.top}px`;
  g.append(Object.assign(new Image(), { src: im.currentSrc || im.src, alt: '' })); host.append(veil, g); t.classList.add('pz-lifted');
  pin = { t, g, veil, d0: Math.max(10, dist(a, b)), m0: m, s: 1 };
  // الصورة الكبيرة تُطلب فوراً، وحين تجهز تحل محل الصغيرة في النسخة فيبقى البوستر حاداً وهو يكبر بين الإصبعين
  const u = sized(srcOf(t), fit(r.width / r.height)[0] * (devicePixelRatio || 1)), lo = im.currentSrc || im.src;
  if (u && u !== lo) { const i = new Image(); i.src = u; i.decode().then(() => { if (g.isConnected) g.firstChild.src = u; }, () => {}); }
}
function pinchMove() { const [a, b] = [...T.values()], m = mid(a, b), raw = dist(a, b) / pin.d0, s = raw > MAX ? MAX + (raw - MAX) * .3 : Math.max(.7, raw);
  pin.s = s; pin.g.style.transform = `translate(${(m.x - pin.m0.x).toFixed(1)}px,${(m.y - pin.m0.y).toFixed(1)}px) scale(${s.toFixed(4)})`; pin.veil.style.opacity = lim((s - 1) / 1.2, 0, 1).toFixed(3); }
function pinchEnd(ok) { const p = pin; pin = null; T.clear();
  const clean = () => { p.g.remove(); p.veil.remove(); };
  if (ok && p.s >= 1.35 && zoom(p.t, { from: p.g.getBoundingClientRect(), dim: +p.veil.style.opacity || 0, src: p.g.firstChild.currentSrc })) return clean();
  p.t.classList.add('pz-lifted'); const a = p.g.animate({ transform: [p.g.style.transform || 'none', 'none'] }, { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  p.veil.animate({ opacity: [p.veil.style.opacity || 0, 0] }, { duration: 240, fill: 'forwards' });
  a.finished.then(() => { p.t.classList.remove('pz-lifted'); clean(); }, clean); }

// ================= التشغيل =================
document.head.insertAdjacentHTML('beforeend', `<style id="pz-css">${CSS}</style>`);
if (touchy) track();
// يُسجَّل قبل مستمعي البوابة (الاستيراد يُنفَّذ أولاً)، فالرجوع يغلق المكبَّر وحده ولا يصل إلى نافذة البوابة تحته
addEventListener('popstate', e => { if (skipPop) { skipPop = false; e.stopImmediatePropagation(); return; } if (S === 'open' || S === 'opening') { e.stopImmediatePropagation(); unzoom(true); } });
document.addEventListener('click', e => { const t = e.target.closest?.('[data-zoom]'); if (!t || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; if (zoom(t)) e.preventDefault(); });
// تجهيز الصورة الكبيرة قبل الضغط (عند مرور المؤشر أو لمس البوستر)، فتصل أسرع
document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-zoom]'); if (!t || t.dataset.pzPre) return; t.dataset.pzPre = '1';
  const im = t.querySelector('img'), r = im?.getBoundingClientRect(), u = im && sized(srcOf(t), fit(r?.width && r.height ? r.width / r.height : 2 / 3)[0] * (devicePixelRatio || 1));
  if (u) { const i = new Image(); i.decoding = 'async'; i.src = u; } }, { passive: true });
