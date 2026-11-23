// مكتبة +18 (E61). أعمال +18 (تصنيف Rx في MyAnimeList، وadult في TMDB، وسمة Erotic في IGDB) تدخل البيانات العامة موسومة، ولا تظهر في أي صفحة
// إلا بعد زر «+18» أعلى بوابتها: يفتح مكتبة ثانية بالواجهة نفسها، فيها أعمال +18 وحدها ومعها بحثها وإضافتها. وما فيها لا يدخل المكتبة العادية
// ولا بحثها ولا اقتراحاتها ولا أعدادها، والعكس.
// الحالة لهذه الجلسة وهذه البوابة (sessionStorage: adult.<البوابة>)، ويقرؤها السطر المضمَّن في index.html قبل أول رسم فيضع data-room="18" على <html>:
// الدخول من القاعة أو برابط يبدأ بالمكتبة العادية دائماً، وتحديث الصفحة يبقيك حيث أنت.
// التبديل يعيد تحميل الصفحة خلف ستارتها (flip)، فتُبنى القوائم والأعداد والفهارس كلها من مكتبة واحدة، ولا يبقى في الصفحة شيء من الأخرى.
// صور أعمال +18 مغطاة حتى تُكشف: زر في شريط المكتبة يكشفها كلها ما دمت فيها (كل دخول يبدأ مغطى)، وصورة العمل في بطاقته تُكشف بلمسها.
// التغطية بطبقتين: كل صورة في المكتبة مموّهة بقاعدة واحدة (فلا تفلت صورة نُسيت في قالب)، إلا ما في حاوية تحمل data-r18-bare (عمل كُشف)
// أو حين يحمل <html> السمة data-r18-open (كُشفت كلها). وفوقها غلاف الشبكة (cover): مصغّرة الصورة وحدها وعليها علامة «+18»، فلا تُحمَّل الصورة الكاملة قبل كشفها.
// والمكبّر (site/zoom.js) لا يفتح صورة مغطاة.
const root = document.documentElement, K = 'adult.' + (root.dataset.guide || 'site'), KS = 'adult.show';
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch {} } };
export const ROOM = root.dataset.room === '18';
let SHOW = ROOM && ss.get(KS) === '1'; const BARE = new Set();
root.toggleAttribute('data-r18-open', SHOW);
// هل صورة هذا العمل مغطاة الآن؟ (في المكتبة العادية لا عمل +18 أصلاً)
export const covered = id => ROOM && !SHOW && !BARE.has(String(id));
export const uncover = id => { BARE.add(String(id)); };
// سمة حاوية العمل المكشوف (بطاقته، خانته في الشبكة، صفه في البحث): صورها تُعرض كما هي
export const bare = id => ROOM && !covered(id) ? ' data-r18-bare' : '';
export const showing = () => SHOW;
export function setShowing(v) { SHOW = !!v; ss.set(KS, SHOW ? '1' : null); if (!SHOW) BARE.clear(); root.toggleAttribute('data-r18-open', SHOW); }
// الصورة المغطاة: img (وسم الصورة المصغّرة) في غلاف يموّهها ويقصّ حوافها، وفوقه علامة «+18» ومعها تلميح إن أُعطي. حاويتها تأخذ الصنف x18
export const cover = (img, hint = '') => `<span class="x18-i">${img}</span><span class="x18-m" aria-hidden="true"><bdi dir="ltr">+18</bdi>${hint ? `<small>${hint}</small>` : ''}</span>`;
const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.5M6.3 7.7A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5a9.2 9.2 0 0 0 3.6-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
// زر الرأس: يفتح المكتبة، وفيها يُخرج منها
export const roomBtn = () => `<button type="button" class="r18" data-act="room" aria-pressed="${ROOM}" aria-label="${ROOM ? 'اخرج من مكتبة +18' : 'افتح مكتبة +18'}" title="${ROOM ? 'اخرج من مكتبة +18' : 'مكتبة +18'}"><bdi dir="ltr">+18</bdi>${ROOM ? X : ''}</button>`;
// شريط المكتبة تحت الرأس: اسمها، وما تعنيه، وزر كشف الصور. usual: اسم المكتبة العادية في هذه البوابة
const eyeIn = () => `${SHOW ? EYE_OFF : EYE}<span>${SHOW ? 'غطِّ الصور' : 'أظهر الصور'}</span>`;
export const roomBar = (usual = 'قائمتك العادية') => !ROOM ? '' : `<div class="r18-bar"><b>مكتبة <bdi dir="ltr">+18</bdi></b><span>ما تضيفه هنا يبقى هنا<i>: لا يدخل ${usual} ولا بحثها ولا اقتراحاتها.</i></span><button type="button" class="r18-eye" data-act="room-show" aria-pressed="${SHOW}">${eyeIn()}</button></div>`;
export function drawEye() { const b = document.querySelector('.r18-eye'); if (b) { b.setAttribute('aria-pressed', String(SHOW)); b.innerHTML = eyeIn(); } }
// التبديل: الستارة تنزل على الصفحة الحالية ثم يُعاد التحميل خلفها، والصفحة الجديدة تبدأ بستارتها نفسها وترفعها. veil: محتوى الستارة وعليه اسم الوجهة
export function flip(veil = '') { ss.set(K, ROOM ? null : '1'); ss.set(KS, null); ss.set('portal', '1'); const go = () => { scrollTo(0, 0); location.reload(); };   // المكتبة تُفتح من أعلاها، لا من حيث كان التمرير
  if (!veil || matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
  document.body.insertAdjacentHTML('beforeend', `<div class="veil r18-go ${ROOM ? 'to0' : 'to18'}">${veil}</div>`); setTimeout(go, 240); }

const CSS = `:root{--r18:#ff4466}
.r18{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 13px;border-radius:12px;border:1px solid color-mix(in srgb,var(--r18) 55%,transparent);background:color-mix(in srgb,var(--r18) 9%,transparent);color:color-mix(in srgb,var(--r18) 80%,#fff);font-weight:700;font-size:.9rem;line-height:1;white-space:nowrap;cursor:pointer;transition:background .16s ease,color .16s ease,border-color .16s ease}
.r18 svg{width:1.05em;height:1.05em;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
.r18[aria-pressed=true]{background:var(--r18);border-color:var(--r18);color:#2a0410}
@media (hover:hover){.r18:hover{background:color-mix(in srgb,var(--r18) 22%,transparent)}.r18[aria-pressed=true]:hover{background:color-mix(in srgb,var(--r18) 86%,#fff)}}
.r18-bar{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;padding:9px 14px;border-radius:14px;border:1px solid color-mix(in srgb,var(--r18) 42%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--r18) 16%,transparent),color-mix(in srgb,var(--r18) 5%,transparent));font-size:.86rem;line-height:1.6}
.r18-bar b{font-weight:700;color:color-mix(in srgb,var(--r18) 70%,#fff);white-space:nowrap}
.r18-bar>span{flex:1 1 220px;min-width:0;opacity:.82}
.r18-bar i{font-style:normal}
@media (max-width:640px){.r18-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 12px;padding:9px 12px}.r18-bar i{display:none}.r18-eye{grid-column:2;grid-row:1/span 2;align-self:center}}
.r18-eye{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 13px;border-radius:10px;border:1px solid color-mix(in srgb,var(--r18) 45%,transparent);background:rgba(0,0,0,.22);color:inherit;font-weight:600;font-size:.84rem;white-space:nowrap;cursor:pointer}
.r18-eye svg{width:1.15em;height:1.15em;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.r18-eye[aria-pressed=true]{background:color-mix(in srgb,var(--r18) 30%,transparent)}
html[data-room="18"]:not([data-r18-open]) img:not([data-r18-bare] img):not(.pz img):not(.pz-ghost img){filter:blur(12px) saturate(.75) brightness(.72)!important}
.x18{position:relative}
.x18-i{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
.x18-i img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.3)!important}
.x18-m{position:absolute;inset:0;z-index:1;display:grid;place-content:center;justify-items:center;gap:6px;padding:8px;text-align:center;pointer-events:none;font-weight:700;font-size:.95rem;line-height:1.3;color:rgba(255,255,255,.94);text-shadow:0 1px 10px rgba(0,0,0,.65)}
.x18-m small{font-weight:600;font-size:.74rem;padding:3px 9px;border-radius:99px;background:rgba(0,0,0,.45);text-shadow:none}
.veil.r18-go{display:grid;animation:r18-go .22s ease both}
@keyframes r18-go{from{opacity:0}to{opacity:1}}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
