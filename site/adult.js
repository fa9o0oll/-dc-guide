// فلتر +18 (E65، وكان مكتبة منفصلة في E61). أعمال +18 (تصنيف Rx في MyAnimeList، وadult في TMDB، وسمة Erotic في IGDB) تدخل البيانات العامة موسومة،
// وتبقى مخفية في كل صفحة حتى تُفتح «العين» أعلى بوابتها: زر بلا نص، مغمضاً والفلتر قائم، ومفتوحاً والفلتر مرفوع. وحين يُرفع تندمج أعمال +18
// في البوابة نفسها: قوائمها وبحثها وإضافتها وأعدادها. لا مكتبة ثانية ولا إعادة تحميل، والاقتراحات لا تختار منها أبداً.
// الحالة لهذه الجلسة وهذه البوابة (sessionStorage: adult.<البوابة>): زيارة جديدة للبوابة (من القاعة أو برابط) تبدأ والفلتر قائم دائماً،
// وتحديث الصفحة والرجوع إليها يبقيانه كما تُرك.
// أغلفة أعمال +18 مغطاة حتى تُكشف: زر مرافق بجانب العين (يظهر حين تُفتح) يكشفها كلها أو يغطيها، وغلاف العمل في بطاقته يُكشف بلمسه.
// وما كُشف لا يبقى (E74): إغلاق العين يغطي الصور كلها ثانية، وكل رفع للفلتر وكل تحميل للصفحة يبدأ والصور مغطاة، فلا يرى أحد ما لم يُقصد كشفه. التغطية بطبقتين: حاوية كل عمل +18 تحمل data-ad (marks ومarkEl)، وكل صورة فيها مموّهة بقاعدة واحدة
// (فلا تفلت صورة نُسيت في قالب) إلا إن حملت الحاوية data-r18-bare (عمل كُشف) أو حمل <html> السمة data-r18-open (كُشفت كلها).
// وفوقها غلاف الشبكة (cover): مصغّرة الصورة وحدها وعليها عين مغمضة، فلا تُحمَّل الصورة الكاملة قبل كشفها. والمكبّر (site/zoom.js) لا يفتح صورة مغطاة.
const root = document.documentElement, G = root.dataset.guide || 'site', K = 'adult.' + G;
const box = s => ({ get(k) { try { return s().getItem(k); } catch { return null; } }, set(k, v) { try { if (v == null) s().removeItem(k); else s().setItem(k, v); } catch {} } });
const ss = box(() => sessionStorage), ls = box(() => localStorage);
try { if (performance.getEntriesByType('navigation')[0]?.type === 'navigate') ss.set(K, null); } catch {}   // زيارة جديدة (لا تحديث ولا رجوع) تمحو ما حُفظ
let OPEN = ss.get(K) === '1', SHOW = false; const BARE = new Set(); ls.set('adult.show', null);   // اختيار «أظهر الصور» كان يُحفظ قبل E74
root.toggleAttribute('data-r18-open', OPEN && SHOW);
// الفلتر مرفوع؟ وتبديله: في مكانه، والصفحة تعيد قوائمها بعده
export const isOpen = () => OPEN;
export function setOpen(v) { OPEN = !!v; ss.set(K, OPEN ? '1' : null); if (!OPEN) { SHOW = false; BARE.clear(); } root.toggleAttribute('data-r18-open', OPEN && SHOW); }
// هل يُخفى هذا العمل الآن؟ (عمل +18 والفلتر قائم)
export const hides = w => !!(w && (w.ad || w.adult)) && !OPEN;
// هل صورة عمل +18 هذا مغطاة الآن؟ (يُسأل عن أعمال +18 وحدها)
export const covered = id => !SHOW && !BARE.has(String(id));
export const uncover = id => { BARE.add(String(id)); };
// سمات حاوية عمل +18 (بطاقته، خانته في الشبكة، صفه في البحث): data-ad دائماً، وdata-r18-bare حين يُكشف فتُعرض صوره كما هي
export const marks = (id, adult) => adult ? ` data-ad${covered(id) ? '' : ' data-r18-bare'}` : '';
export const markEl = (el, id, adult) => { el.toggleAttribute('data-ad', !!adult); el.toggleAttribute('data-r18-bare', !!adult && !covered(id)); };
export const showing = () => SHOW;
export function setShowing(v) { SHOW = !!v && OPEN; if (!SHOW) BARE.clear(); root.toggleAttribute('data-r18-open', OPEN && SHOW); }
// العين المغمضة لكل بوابة (في زرها، وفوق الصور المغطاة). أنمياتي: قوس برموش. أفلامي: قوس رموشه ثقوب شريط الفيلم. ألعابي: درج من البكسلات برموش ثلاثة
const LIDS = {
  anime: '<path d="M4 15.5c4 5.2 20 5.2 24 0" stroke-width="2.8"/><path d="M8.6 20.2l-1.5 2.6M16 21.4v3.1M23.4 20.2l1.5 2.6" stroke-width="1.8"/>',
  films: '<path d="M3.5 14.5c5 6 20 6 25 0" stroke-width="2.2"/><rect class="e-fill" x="7.2" y="20.4" width="2.8" height="2.2" rx=".5" transform="rotate(-24 8.6 21.5)"/><rect class="e-fill" x="14.6" y="22.2" width="2.8" height="2.2" rx=".5"/><rect class="e-fill" x="22" y="20.4" width="2.8" height="2.2" rx=".5" transform="rotate(24 23.4 21.5)"/>',
  games: '<path class="e-fill" d="M2 14h2v2H2zM28 14h2v2h-2zM4 16h4v2H4zM24 16h4v2h-4zM8 18h16v2H8zM6 20h2v2H6zM4 22h2v2H4zM24 20h2v2h-2zM26 22h2v2h-2zM15 21h2v4h-2z"/>',
}, LID = LIDS[G] || LIDS.anime;
// الصورة المغطاة: img (وسم الصورة المصغّرة) في غلاف يموّهها ويقصّ حوافها، وفوقه عين البوابة المغمضة ومعها تلميح إن أُعطي. حاويتها تأخذ الصنف x18
const SHUT = `<svg class="eye${G === 'games' ? ' px' : ''}" viewBox="0 9 32 20">${LID}</svg>`;
export const cover = (img, hint = '') => `<span class="x18-i">${img}</span><span class="x18-m" aria-hidden="true">${SHUT}${hint ? `<small>${hint}</small>` : ''}</span>`;

// ---------- العين: لكل بوابة عينها. e-shut: مغمضة، e-open: مفتوحة (الصنفان في الرسمة نفسها، والتبديل بينهما بالأنماط)
const EYES = {
  // أنمياتي: عين المانغا. جفن عريض بطرف مرفوع وحدقة طويلة بلمعتين، ومغمضةً قوس برموش
  anime: `<svg class="eye" viewBox="0 0 32 32" aria-hidden="true"><g class="e-shut">${LIDS.anime}</g>
<g class="e-open"><ellipse class="e-iris" cx="16" cy="17.2" rx="5.6" ry="7"/><ellipse class="e-deep" cx="16" cy="17.8" rx="2.5" ry="3.6"/><circle class="e-glint" cx="18.4" cy="13.9" r="1.7"/><circle class="e-glint" cx="13.7" cy="20.6" r=".9"/><path d="M3.6 15.4C8 8.2 23 6.4 28.2 12.4" stroke-width="2.8"/><path d="M28.2 12.4l2.2-2.4" stroke-width="2"/><path d="M9.5 25.2c4 1.8 9 1.8 13 0" stroke-width="1.4"/></g></svg>`,
  // أفلامي: عين العدسة. حدقتها فتحة عدسة بست شفرات يملأ وسطها ضوء العرض، ومغمضةً قوس رموشه ثقوب شريط الفيلم
  films: `<svg class="eye" viewBox="0 0 32 32" aria-hidden="true"><g class="e-shut">${LIDS.films}</g>
<g class="e-open"><path d="M3 16C8 8.4 24 8.4 29 16 24 23.6 8 23.6 3 16z" stroke-width="1.9"/><circle cx="16" cy="16" r="6.2" stroke-width="1.5"/><path class="e-iris" d="M18.6 16l-1.3 2.25h-2.6L13.4 16l1.3-2.25h2.6z"/><path d="M18.6 16l-3.54 6.13M17.3 18.25h-7.08M14.7 18.25l-3.54-6.13M13.4 16l3.54-6.13M14.7 13.75h7.08M17.3 13.75l3.54 6.13" stroke-width="1.2"/></g></svg>`,
  // ألعابي: عين البكسل. مربعات على شبكة، حدقتها بلون الشاشة ولمعتها بكسل واحد، ومغمضةً درج من البكسلات برموش ثلاثة
  games: `<svg class="eye px" viewBox="0 0 32 32" aria-hidden="true"><g class="e-shut">${LIDS.games}</g>
<g class="e-open"><path class="e-iris" d="M12 12h8v2h-8zM10 14h12v4H10zM12 18h8v2h-8z"/><path class="e-deep" d="M14 14h4v4h-4z"/><path class="e-glint" d="M18 12h2v2h-2z"/><path class="e-fill" d="M10 8h12v2H10zM6 10h4v2H6zM22 10h4v2h-4zM4 12h2v2H4zM26 12h2v2h-2zM2 14h2v4H2zM28 14h2v4h-2zM4 18h2v2H4zM26 18h2v2h-2zM6 20h4v2H6zM22 20h4v2h-4zM10 22h12v2H10z"/></g></svg>`,
};
// الزر المرافق: الأغلفة. إطار صورة، وعليه شطبة ما دامت مغطاة
const PIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M6.5 16l3.6-4 2.7 2.8 1.9-1.9 2.8 3.1"/><circle cx="8.6" cy="9.6" r="1.1"/></svg>';
const PIC_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 5.5h9.6a2.5 2.5 0 0 1 2.5 2.5v8.2M18.5 18.5H6A2.5 2.5 0 0 1 3.5 16V8a2.5 2.5 0 0 1 1.1-2.1M4 4l16 16"/></svg>';
const say = () => OPEN ? 'أعد الفلتر' : 'ارفع الفلتر', picIn = () => `${SHOW ? PIC : PIC_OFF}<span>${SHOW ? 'غطِّ الصور' : 'أظهر الصور'}</span>`;
// زرا الرأس: العين (الفلتر)، وبجانبها زر الأغلفة ما دامت مفتوحة. بلا نص ظاهر. وزر الأغلفة يظهر في الجهة الخالية من الرأس (row-reverse)، فتبقى العين في مكانها تحت المؤشر
// dock: نسخة ثانية في الشريط اللاصق أعلى الصفحة، تظهر ما دام الرأس خارج الشاشة (E73)، فالعين وزر الأغلفة في متناولك وأنت في أي موضع
export const eyeBtn = (dock = false) => { const t = dock ? ' tabindex="-1"' : '';
  return `<span class="r18w${dock ? ' dock' : ''}"${dock ? ' aria-hidden="true"' : ''}><button type="button" class="r18" data-act="room" aria-pressed="${OPEN}" aria-label="${say()}" title="${say()}"${t}>${EYES[G] || EYES.anime}</button><button type="button" class="r18-eye" data-act="room-show" aria-pressed="${SHOW}" title="${SHOW ? 'غطِّ الصور' : 'أظهر الصور'}"${t}${OPEN ? '' : ' hidden'}>${picIn()}</button></span>`; };
// يعيد رسم الأزرار في أماكنها بعد كل تبديل (سمات لا عناصر جديدة، فتتحرك العين وهي تنفتح)، في الرأس وفي الشريط معاً
export function drawEye() { for (const b of document.querySelectorAll('.r18')) { b.setAttribute('aria-pressed', String(OPEN)); b.setAttribute('aria-label', say()); b.title = say(); }
  for (const c of document.querySelectorAll('.r18-eye')) { c.hidden = !OPEN; c.setAttribute('aria-pressed', String(SHOW)); c.title = SHOW ? 'غطِّ الصور' : 'أظهر الصور'; c.innerHTML = picIn(); } }
// الشريط التصق أعلى الصفحة (on) أو عاد الرأس: نسخة الشريط تُضغط وتُبلغ لقارئ الشاشة ما دامت ظاهرة وحدها
export function dockEye(on) { const w = document.querySelector('.bar .r18w.dock'); if (!w) return; w.setAttribute('aria-hidden', String(!on)); for (const b of w.querySelectorAll('button')) b.tabIndex = on ? 0 : -1; }

const CSS = `:root{--eye-iris:#7fd4ff;--eye-deep:#12142e;--eye-bg:rgba(255,255,255,.06);--eye-r:12px}
html[data-guide=anime]{--eye-iris:var(--cel);--eye-deep:var(--bg);--eye-bg:color-mix(in srgb,var(--card) 70%,transparent)}
html[data-guide=films]{--eye-iris:var(--acc);--eye-deep:var(--bg);--eye-bg:var(--card2);--eye-r:10px}
html[data-guide=games]{--eye-iris:var(--cy);--eye-deep:var(--bg);--eye-bg:var(--card2);--eye-r:10px}
.r18w{display:inline-flex;flex-direction:row-reverse;align-items:center;gap:6px}
.bar .r18w.dock>*{flex:none}
.bar .r18w.dock{flex:none;max-width:0;margin-inline-start:-8px;opacity:0;overflow:hidden;pointer-events:none;transition:max-width .28s ease,opacity .2s ease,margin .28s ease}
.bar.docked .r18w.dock{max-width:100px;margin-inline-start:0;opacity:1;overflow:visible;pointer-events:auto}
@media (max-width:560px){.bar .r18w.dock{gap:4px}.bar .r18w.dock :is(.r18,.r18-eye){width:40px;height:40px}.bar .r18w.dock .r18 .eye{width:25px;height:25px}}
@media (prefers-reduced-motion:reduce){.bar .r18w.dock{transition:none}}
.r18,.r18-eye{display:inline-grid;place-items:center;width:44px;height:44px;padding:0;border-radius:var(--eye-r);border:1px solid var(--line,rgba(255,255,255,.2));background:var(--eye-bg);color:var(--dim,#b6bce0);cursor:pointer;transition:color .16s ease,border-color .16s ease}
.r18:focus-visible,.r18-eye:focus-visible{outline:2px solid var(--eye-iris);outline-offset:2px}
.r18[aria-pressed=true]{color:var(--ink,#fff);border-color:color-mix(in srgb,var(--eye-iris) 55%,var(--line,transparent))}
@media (hover:hover){.r18:hover,.r18-eye:hover{color:var(--ink,#fff);border-color:var(--eye-iris)}}
.r18 .eye{width:28px;height:28px;overflow:visible;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}
.r18 .eye.px{shape-rendering:crispEdges}
.r18 .e-fill{fill:currentColor;stroke:none}.r18 .e-iris{fill:var(--eye-iris);stroke:none}.r18 .e-deep{fill:var(--eye-deep);stroke:none}.r18 .e-glint{fill:#fff;stroke:none}
.r18 .e-shut,.r18 .e-open{transform-box:view-box;transform-origin:50% 56%}
.r18 .e-shut{transition:opacity .14s ease,transform .2s ease}
.r18 .e-open{opacity:0;transform:scaleY(.1);transition:opacity .18s ease,transform .28s cubic-bezier(.2,.8,.2,1)}
.r18[aria-pressed=true] .e-open{opacity:1;transform:none}
.r18[aria-pressed=true] .e-shut{opacity:0}
@media (hover:hover){.r18[aria-pressed=false]:hover .e-shut{transform:translateY(-1.5px)}}
@media (prefers-reduced-motion:reduce){.r18 .e-shut,.r18 .e-open{transition:none}}
.r18-eye svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.r18-eye{position:relative}
.r18-eye span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.r18-eye[aria-pressed=true]{color:var(--ink,#fff)}
html:not([data-r18-open]) [data-ad]:not([data-r18-bare]) img:not(.pz img):not(.pz-ghost img){filter:blur(12px) saturate(.75) brightness(.72)!important}
.x18{position:relative}
.x18-i{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
.x18-i img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.3)!important;filter:blur(12px) saturate(.75) brightness(.72)!important}
.x18-m{position:absolute;inset:0;z-index:1;display:grid;place-content:center;justify-items:center;gap:6px;padding:8px;text-align:center;pointer-events:none;font-weight:700;font-size:.95rem;line-height:1.3;color:rgba(255,255,255,.94);text-shadow:0 1px 10px rgba(0,0,0,.65)}
.x18-m svg{width:3.2em;height:2em;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 6px rgba(0,0,0,.6))}
.x18-m .e-fill{fill:currentColor;stroke:none}.x18-m .px{shape-rendering:crispEdges}
.x18-m small{font-weight:600;font-size:.74rem;padding:3px 9px;border-radius:99px;background:rgba(0,0,0,.45);text-shadow:none}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
