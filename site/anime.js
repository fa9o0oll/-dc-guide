// «أنمياتي»: قائمة الأنمي كلها بقوائمها الخمس كما في MyAnimeList: «أشاهده الآن»، «أكملته»، «مؤجَّل»، «تركته»، «سأشاهده»، بترتيبها هناك.
// لكل عمل «سِل» (ورقة التحريك) عليه تقدّمك بمخطط توقيت فيه خانة لكل حلقة، وزر «+» يعلّم الحلقة التالية. وبطاقته فيها سجلّك (الحالة والحلقات
// والتقييم والتاريخان) ونبذته وأين يُعرض في السعودية وسلسلته. «السلاسل» تجمع أعمال كل سلسلة بترتيبها، وفيها مدخل دليل Fate.
// السجل الشخصي في المتصفح بالمفتاح animeg.progress: { v: 1, a: { رقم العمل في MyAnimeList: { s: القائمة, p: الحلقات, r: التقييم, b: البداية, e: النهاية } } }
// ويُزامَن بين أجهزتك (site/sync.js). لا شيء منه في المستودع: يدخل باستيراد ملف تصدير MyAnimeList (site/anime-mal.js) أو بالربط بـSIMKL.
// البيانات العامة (الأسماء والصور والعلاقات وأماكن العرض) تُبنى في scripts/build-anime.mjs من MyAnimeList وTMDB.
// «ورقة التوقيت» في بطاقة العمل: حلقاته واحدة واحدة (data/eps/<رقم العمل>.json، يبنيها scripts/build-anime-episodes.mjs)، تبدأ من الحلقة التالية،
// وخانة كل حلقة تُعلَّم منها فيتحدّث التقدّم نفسه: الخانة التي تضغطها تصير آخر ما شاهدته.
import { initSync, touch as syncTouch } from './sync.js?v=__BUILD__';
import { miniDoor, portalBack } from './portal.js?v=__BUILD__';
import { prepare, find, fold } from './find.js?v=__BUILD__';
import { clock, spoken } from './count.js?v=__BUILD__';
import { readMalFile } from './anime-mal.js?v=__BUILD__';
import { describe, noun, model } from './anime-pos.js?v=__BUILD__';
import { themeOf } from './anime-theme.js?v=__BUILD__';
import { GENRE } from './anime-genres.js?v=__BUILD__';
import { simklStart, simklPoll, simklPull, simklToken, simklForget, simklAhead } from './anime-simkl.js?v=__BUILD__';
import { isOpen, setOpen, hides, covered, uncover, marks, markEl, showing, setShowing, drawEye, eyeBtn, cover, dockEye } from './adult.js?v=__BUILD__'; // فلتر +18 (E65)
import './zoom.js?v=__BUILD__';
import './rail.js?v=__BUILD__'; // الشرائط الأفقية: السحب بالماوس والسهمان على طرفيها
const BUILD = '__BUILD__', KEY = 'animeg.progress', UI = 'anime.ui', ASK = 'animeg.asked', PASS = 'animeg.pass', ADDK = 'animeg.added';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;

// ---------- الكلمات
const num = n => Number(n).toLocaleString('en-US');
const count = (n, [one, two, few, many, sing]) => { const m = n % 100; return n === 1 ? one : n === 2 ? two : m >= 3 && m <= 10 ? `${num(n)} ${few}` : m >= 11 ? `${num(n)} ${many}` : `${num(n)} ${sing}`; };
const nWorks = n => count(n, ['عمل واحد', 'عملان', 'أعمال', 'عملاً', 'عمل']);
const nEps = n => count(n, ['حلقة واحدة', 'حلقتان', 'حلقات', 'حلقة', 'حلقة']);
const nDays = n => count(n, ['يوم واحد', 'يومان', 'أيام', 'يوماً', 'يوم']);
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
// التاريخ قد يكون ناقصاً كما في MyAnimeList: سنة، أو سنة وشهر
const dateAr = d => { const [y, m, dd] = String(d).split('-').map(Number); return dd ? `${dd} ${MONTHS[m - 1]} ${y}` : m ? `${MONTHS[m - 1]} ${y}` : String(y); };
const LISTS = [['watching', 'أشاهده الآن', 'play'], ['completed', 'أكملته', 'check'], ['hold', 'مؤجَّل', 'pause'], ['dropped', 'تركته', 'drop'], ['plan', 'سأشاهده', 'mark']];
const LNAME = Object.fromEntries(LISTS.map(l => [l[0], l[1]]));
const TYPE = { TV: 'مسلسل', Movie: 'فيلم', OVA: 'OVA', ONA: 'ONA', Special: 'حلقة خاصة', 'TV Special': 'خاصة تلفزيونية', PV: 'عرض ترويجي', Music: 'موسيقي', CM: 'إعلان' };
const typeOf = a => TYPE[a.type] ? (/^[A-Z]+$/.test(TYPE[a.type]) ? ltr(TYPE[a.type]) : TYPE[a.type]) : esc(a.type || '');
const SEASON = { winter: 'شتاء', spring: 'ربيع', summer: 'صيف', fall: 'خريف' };
// تصنيفات MyAnimeList بالعربية في site/anime-genres.js (يشاركها دليل Fate). وهنا فئاتها العمرية ومصادر القصة. ما لا مقابل له يُعرض باسمه هناك
const genreOf = n => GENRE[n] || ltr(n);
const SOURCE = { Original: 'أصلي', Manga: 'مانغا', 'Web Manga': 'مانغا ويب', '4 Koma Manga': 'مانغا يونكوما', 'Light Novel': 'رواية خفيفة', Novel: 'رواية', 'Web Novel': 'رواية ويب', 'Visual Novel': 'رواية مرئية', Game: 'لعبة', 'Card Game': 'لعبة ورق', 'Mixed Media': 'وسائط متعددة', Book: 'كتاب', 'Picture Book': 'كتاب مصور', Music: 'موسيقى', Radio: 'إذاعة' };
const RATING = { G: 'لكل الأعمار', PG: 'للأطفال', 'PG-13': '+13', R: '+17', 'R+': '+17', Rx: '+18' };
const SCORE = ['', 'مروّع', 'فظيع', 'سيئ جداً', 'سيئ', 'متوسط', 'لا بأس به', 'جيد', 'جيد جداً', 'عظيم', 'تحفة'];
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const SPRITE = `<svg hidden aria-hidden="true"><defs>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" stroke-width="1.6" d="M8.5 6v12l10-6z"/></symbol><symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></symbol>
<symbol id="i-drop" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><path d="M6.8 6.8l10.4 10.4"/></symbol><symbol id="i-mark" viewBox="0 0 24 24"><path d="M7 4.5h10v15l-5-3.5-5 3.5z"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></symbol><symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.7 2.5 2.7 13.5 0 16M12 4c-2.7 2.5-2.7 13.5 0 16"/></symbol><symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></symbol><symbol id="i-in" viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></symbol><symbol id="i-ext" viewBox="0 0 24 24"><path d="M8 16l8-8M9.5 8H16v6.5"/></symbol><symbol id="i-warp" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.2v4.3h4.3"/><path d="M12 8.5V12l2.5 1.6"/></symbol><symbol id="i-line" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><path d="M7.2 12h2.6M14.2 12h2.6"/></symbol>
</defs></svg>`;

// ---------- السجل الشخصي
let P;
const sane = x => { const o = {}; if (!x || typeof x !== 'object') return null; if (LNAME[x.s]) o.s = x.s; else return null;
  if (Number.isInteger(x.p) && x.p > 0) o.p = x.p; if (Number.isInteger(x.r) && x.r >= 1 && x.r <= 10) o.r = x.r;
  for (const k of ['b', 'e']) if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(x[k] || '')) o[k] = x[k]; return o; };
function load() { let s; try { s = JSON.parse(store.get(KEY)); } catch {} P = { v: 1, a: {} };
  if (s && typeof s.a === 'object' && s.a) for (const [k, v] of Object.entries(s.a)) { const o = sane(v); if (o && /^\d+$/.test(k)) P.a[k] = o; } }
const save = () => { store.set(KEY, JSON.stringify(P)); syncTouch('anime'); };
const me = id => P.a[id];
const hasLog = () => { for (const _ in P.a) return true; return false; };
load();

// ---------- البيانات
// list وby: ما يظهر الآن: أعمالك، ومعها أعمال +18 حين يُرفع الفلتر (isOpen، وrelist تعيد بناءهما عند التبديل). all وknown: كل ما في الكتالوج، للاستيراد والمطابقة. adult: أرقام أعمال +18
const D = { list: [], by: new Map(), all: [], known: new Set(), adult: new Set(), worlds: [], wby: new Map(), prov: {}, genres: [], base: 'https://image.tmdb.org/t/p/', mal: 'https://cdn.myanimelist.net/images/anime/', texts: new Map(), found: null, eps: {}, epc: new Map() };
const ui = { list: 'watching', view: 'list', q: '', sort: 'mal', type: '', genre: -1, shown: 60, names: 'romaji' };
try { const u = JSON.parse(store.get(UI) || '{}'); for (const k of ['list', 'sort', 'names']) if (typeof u[k] === 'string') ui[k] = u[k]; } catch {}
const keep = () => store.set(UI, JSON.stringify({ list: ui.list, sort: ui.sort, names: ui.names }));
const get = async f => { const r = await fetch(`data/${f}?v=${BUILD}`); if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); };
const title = a => ui.names === 'english' && a.en ? a.en : a.t;
const poster = (a, big) => a.img ? `${D.mal}${a.img}${big ? 'l' : ''}.webp` : a.tp ? `${D.base}${big ? 'w500' : 'w342'}${a.tp}` : a.iu || '';   // iu: غلاف بعنوانه كاملاً (AniList) لبطاقة من MyAnimeList مباشرة بلا صورة هناك
const srcset = a => a.img ? `${D.mal}${a.img}.webp 225w, ${D.mal}${a.img}l.webp 425w` : a.tp ? `${D.base}w185${a.tp} 185w, ${D.base}w342${a.tp} 342w, ${D.base}w500${a.tp} 500w` : '';
// صورة عمل +18 مغطاة حتى تُكشف: مصغّرته وحدها مموّهة (cover في adult.js)، وحاويتها تأخذ الصنف x18
const hid = a => !!a.ad && covered(a.id) && !!poster(a), xc = a => hid(a) ? ' x18' : '', tiny = a => a.img ? `${D.mal}${a.img}t.webp` : a.tp ? `${D.base}w92${a.tp}` : a.iu || '';
const art = (a, sizes, eager, hint) => hid(a) ? cover(`<img ${eager ? '' : 'loading="lazy" '}decoding="async" alt="" src="${esc(tiny(a))}">`, hint) : poster(a) ? `<img ${eager ? '' : 'loading="lazy" '}decoding="async" alt="" src="${esc(poster(a))}" srcset="${esc(srcset(a))}" sizes="${sizes}">` : `<span class="ph">${esc((a.t.match(/[A-Za-z0-9]/) || ['؟'])[0].toUpperCase())}</span>`;
// مصغّرة عمل في شريط سلسلته وخطها الزمني (E73): صورة عمل +18 لم تُكشف مصغّرتها وحدها مغطاة بعين البوابة، كغلاف الشبكة
const thumb = a => hid(a) ? `<span class="th x18">${cover(`<img loading="lazy" decoding="async" alt="" src="${esc(tiny(a))}">`)}</span>` : poster(a) ? `<img loading="lazy" decoding="async" alt="" src="${esc(poster(a))}">` : `<span class="ph">${esc((a.t.match(/[A-Za-z0-9]/) || ['؟'])[0].toUpperCase())}</span>`;
// صور MyAnimeList كلها بصيغة webp، وإن تعذّرت واحدة فنسختها jpg
document.addEventListener('error', e => { const i = e.target; if (i.tagName === 'IMG' && /cdn\.myanimelist\.net/.test(i.src) && /\.webp$/.test(i.src) && !i.dataset.jpg) { i.dataset.jpg = 1; i.removeAttribute('srcset'); i.src = i.src.replace(/\.webp$/, '.jpg'); } }, true);
// في قائمتي: ما له سجل. وقبل الاستيراد على هذا الجهاز تُعرض القائمة العامة كلها بلا سجل
const mine = a => hasLog() ? !!P.a[a.id] : a.ord != null;
const inList = l => D.list.filter(a => P.a[a.id]?.s === l);
const daysTo = d => Math.ceil((Date.parse(d) - Date.parse(today)) / 864e5);
// ---------- موعد ما لم يُعرض بعد (E70): بدقة ما يُعرف منه في MyAnimeList (يوم، أو شهر، أو موسم، أو سنة). عليه ختم كختم الحبر الياباني:
// «قريباً» إن كان في الموسم القادم أو قبله، و«مستقبلاً» إن كان أبعد أو لم يُعلن موعده. وعدّه الحي (count.js) حين يُعرف اليوم نفسه، وإلا فالمدة
// تقريباً بالأشهر أو الأعوام، فلا يُدّعى يوم لا يُعرف. ومثله موعد الحلقة القادمة لما يُعرض الآن (من TMDB)
const SEASON_M = { winter: 1, spring: 4, summer: 7, fall: 10 };
const nMonths = n => count(n, ['شهر واحد', 'شهران', 'أشهر', 'شهراً', 'شهر']), nYears = n => count(n, ['عام واحد', 'عامان', 'أعوام', 'عاماً', 'عام']);
const weekday = d => new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long' });
function airOf(a) { if (a?.st !== 'soon') return null;
  const f = String(a.from || ''), [Y, M, d] = f.split('-').map(Number), y = Y || a.y || 0, m = M || (y && SEASON_M[a.se]) || 0, ny = +today.slice(0, 4), nm = +today.slice(5, 7);
  const exact = d && f >= today ? f : '', season = a.se && y ? `${SEASON[a.se]} ${y}` : '', mo = y && m ? (y - ny) * 12 + m - nm : null;
  const label = M ? dateAr(f) : season || (y ? String(y) : ''), near = exact ? daysTo(exact) <= 92 : d ? true : mo != null ? mo <= 3 : !!y && y <= ny;
  const rough = exact || d || !label ? '' : mo != null ? (mo <= 0 ? 'هذا الشهر' : mo === 1 ? 'الشهر القادم' : `بعد نحو ${nMonths(mo)}`) : y <= ny ? 'هذا العام' : y === ny + 1 ? 'العام القادم' : `بعد نحو ${nYears(y - ny)}`;
  return { exact, label, near, rough, season, word: near ? 'قريباً' : 'مستقبلاً', now: a.type === 'Movie' ? 'يُعرض اليوم' : 'يبدأ اليوم' }; }
const nextAir = a => a?.st === 'airing' && a.nx?.date >= today ? a.nx : null;
const hanko = (word, k, sm) => `<span class="hanko${sm ? ' sm' : ''} ${k}" aria-hidden="true"><b>${word}</b></span>`;
const ticker = (date, now) => `<span class="ck" aria-hidden="true">${clock(date, now)}</span><span class="sr sr-time">${spoken(date)}</span>`;
// في البطاقة: الختم، والموعد بيومه وموسمه، وعدّه الحي أو مدته تقريباً
function airHTML(a) { const s = airOf(a), n = s ? null : nextAir(a); if (!s && !n) return '';
  const date = s ? s.exact : n.date, now = s ? s.now : 'تُعرض اليوم', word = s ? s.word : 'يُعرض الآن', k = s ? (s.near ? 'near' : 'far') : 'on';
  const sub = [date ? weekday(date) : '', s?.season && s.label !== s.season ? s.season : ''].filter(Boolean).join(' · ');
  return `<section class="air ${k}"${date ? ` data-until="${date}" data-now="${now}"` : ''}>${hanko(word, k)}
    <div class="air-t"><small>${s ? 'موعد عرضه' : `الحلقة ${num(n.ep)}${a.eps ? ` من ${num(a.eps)}` : ''}`}<span class="sr">، ${word}</span></small><b class="air-d">${date ? dateAr(date) : s.label || 'لم يُعلن موعده'}</b>${sub ? `<span class="air-s">${sub}</span>` : ''}</div>
    ${date ? ticker(date, now) : s.rough ? `<span class="air-r">${s.rough}</span>` : ''}</section>`; }
// في خانته: الختم على الصورة، وشريط العدّ أسفلها حين يُعرف اليوم، وإلا فالمدة تقريباً
const airCel = s => hanko(s.word, s.near ? 'near' : 'far', 1) + (s.exact ? `<span class="next air-band" data-until="${s.exact}" data-now="${s.now}"><small>يُعرض بعد</small>${ticker(s.exact, s.now)}</span>`
  : `<span class="next">${s.rough || s.label || 'لم يُعلن موعده'}</span>`);
// في خط العالم: الختم والموعد وعدّه، سطراً تحت اسمه
const airTag = a => { const s = airOf(a); if (!s) return '';
  return `<span class="gn-air ${s.near ? 'near' : 'far'}"${s.exact ? ` data-until="${s.exact}" data-now="${s.now}"` : ''}>${hanko(s.word, s.near ? 'near' : 'far', 1)}<b class="gn-ad">${s.label || 'لم يُعلن موعده'}</b>${s.exact ? ticker(s.exact, s.now) : s.rough ? `<span class="gn-ar">${s.rough}</span>` : ''}</span>`; };

// ---------- الصفحة
document.body.insertAdjacentHTML('beforeend', `${SPRITE}
<section class="sky" id="sky"><div class="sky-art" aria-hidden="true"><i></i><i></i><b></b></div>
  <header class="top"><a class="home" href="../" aria-label="العودة إلى البوابات">${miniDoor}<span>البوابات</span></a><h1>أنمياتي</h1>
    ${eyeBtn()}<button class="btn ghost" data-act="import">${ic('in')}<span>قائمتي وحساباتي</span></button><button class="btn pri" data-act="add">${ic('plus')}<span>أضف أنمي</span></button></header>
  <p class="tally" id="tally"></p><div id="now"></div><div id="tonight"></div>
  <svg class="sky-line" viewBox="0 0 1200 96" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 96V70l60-3 40 4 70-9 50 6 90-4 60 5 80-8 70 6 110-5 60 4 90-7 70 6 120-4 80 5 150-6v36z"/>
    <g fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"><path d="M0 34q150 26 300 2t300 0 300 2 300-4"/><path d="M0 44q150 24 300 2t300 0 300 2 300-4"/><path d="M0 26q150 22 300 0"/></g>
    <g fill="currentColor"><path d="M297 14h6v70h-6zM282 22h36v3h-36zM286 34h28v3h-28zM597 18h6v62h-6zM584 26h32v3h-32zM897 12h6v72h-6zM880 20h40v3h-40zM886 32h28v3h-28z"/></g></svg></section>
<nav class="bar" aria-label="البحث والقوائم"><div class="row"><a class="gate" href="../" aria-label="العودة إلى البوابات" aria-hidden="true" tabindex="-1"><span class="gate-em">${miniDoor}</span><span class="gate-t">البوابات</span></a>
  <label class="search">${ic('search')}<span class="sr">ابحث في أنمياتي</span><input id="q" type="search" placeholder="ابحث: أنمي، استوديو، سنة" autocomplete="off" enterkeyhint="search"></label>
  <div class="views" role="group" aria-label="طريقة العرض"><button data-act="view" data-v="list" aria-pressed="true">الأعمال</button><button data-act="view" data-v="worlds" aria-pressed="false">السلاسل</button></div>${eyeBtn(true)}</div>
  <div class="lists" id="lists" role="group" aria-label="قوائمي"></div>
  <div class="tools" id="tools"><select id="sort" aria-label="الترتيب"><option value="mal">ترتيب قائمتي</option><option value="score">تقييمي، الأعلى أولاً</option><option value="pub">تقييم MyAnimeList</option><option value="new">الأحدث صدوراً</option><option value="old">الأقدم صدوراً</option><option value="prog">الأقرب إلى الإكمال</option></select>
    <select id="type" aria-label="النوع"><option value="">كل الأنواع</option></select>
    <div class="gchips" id="gchips" role="group" aria-label="التصنيفات" data-drag></div>
    <select id="names" class="names" aria-label="لغة الأسماء"><option value="romaji">الأسماء كما في MyAnimeList</option><option value="english">الأسماء بالإنجليزية</option></select></div></nav>
<p class="count" id="count" aria-live="polite"></p>
<main><div class="grid" id="grid"><p class="load">تُحمَّل القائمة…</p></div><div class="worlds" id="worlds" hidden></div></main>
<footer class="foot"><p>معلومات الأنمي وصوره وتقييماته من <a href="https://myanimelist.net/" target="_blank" rel="noopener">${ltr('MyAnimeList')}</a>، والبوسترات العالية الدقة والخلفيات من <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">${ltr('TMDB')}</a>، وبيانات أماكن العرض من <a href="https://www.justwatch.com/" target="_blank" rel="noopener">${ltr('JustWatch')}</a>، ومطابقة الأرقام بين المواقع من ${ltr('Fribb/anime-lists')}. ${ltr('This product uses the TMDB API but is not endorsed or certified by TMDB.')}</p>
  <p><button class="syncb" data-sync-open><span data-sync-label></span></button></p></footer>
<dialog id="addd" aria-labelledby="add-h"><button class="close" data-act="close" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="add-body"></div></dialog>
<dialog id="sheet" aria-label="بطاقة العمل"><button class="close" data-act="close" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="sheet-body"></div></dialog>
<dialog id="wsheet" aria-label="السلسلة"><button class="close" data-act="close" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="wsheet-body"></div></dialog>
<dialog id="imp" aria-labelledby="imp-h"><button class="close" data-act="close" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="imp-body"></div></dialog>
<div class="toast" id="toast" role="status"></div>`);
portalBack('anime');

// ---------- التنبيه العابر، ومعه «تراجع» حين يُعطى ما يُتراجع عنه. يسكن أعلى نافذة مفتوحة حتى لا تحجبه
let undo = null, toastT = 0;
function toast(msg, back) { const t = $('#toast'), host = $$('dialog[open]').pop() || document.body; if (t.parentNode !== host) host.append(t);
  clearTimeout(toastT); undo = back || null; t.classList.toggle('act', !!back); t.innerHTML = `<span>${msg}</span>${back ? '<button data-act="undo">تراجع</button>' : ''}`;
  void t.offsetWidth; t.classList.add('on'); toastT = setTimeout(() => { t.classList.remove('on'); undo = null; }, back ? 7000 : 2800); }

// ---------- السِل
const flag = s => s ? `<span class="flag" data-l="${s}">${LNAME[s]}</span>` : '';
function progHTML(a, m, plus = true) { const tot = a.eps || 0, p = m?.p || 0, ticks = tot > 1 && tot <= 26;
  return `<div class="prog"><span class="tc" ${ticks ? `style="--n:${tot};--p:${p / tot}"` : `style="--p:${tot ? p / tot : p ? 1 : 0}"`}><i></i><span><b>${num(p)}</b>${tot ? ` من ${num(tot)}` : ' · العدد لم يُعلن'}</span></span>
    ${plus && (!tot || p < tot) ? `<button class="plus" data-act="plus" data-id="${a.id}" aria-label="شاهدت الحلقة ${p + 1} من ${esc(a.t)}">${ic('plus')}</button>` : ''}</div>`; }
function celHTML(a, where, i = 0) { const m = me(a.id), s = m?.s, live = s === 'watching' || s === 'hold', next = a.nx && live && a.nx.date >= today ? daysTo(a.nx.date) : null, air = airOf(a);
  const sizes = where === 'rail' ? '(max-width:560px) 150px, 206px' : '(max-width:560px) 46vw, 190px';
  const meta = (air ? [typeOf(a), air.label || 'لم يُعلن موعده'] : [typeOf(a), a.y || '', s === 'completed' && m.e ? `أكملته ${m.e.slice(0, 4)}` : a.type !== 'Movie' && a.eps ? nEps(a.eps) : a.st === 'airing' ? 'يُعرض الآن' : '']).filter(Boolean).join(' · ');
  return `<article class="cel${a.x && !m ? ' out' : ''}" data-id="${a.id}"${marks(a.id, a.ad)} style="--i:${i}${a.ac ? `;--ac:#${a.ac}` : ''}">
    <button class="cel-art${xc(a)}" data-act="open" data-id="${a.id}" aria-label="بطاقة ${esc(a.t)}">${art(a, sizes, where === 'rail' && i < 6)}
      ${where !== 'rail' && ui.list === 'all' && ui.view === 'list' ? flag(s) : ''}${m?.r ? `<span class="stamp${m.r === 10 ? ' top10' : ''}" title="تقييمك ${m.r} من 10">${m.r}</span>` : ''}
      ${next != null ? `<span class="next">الحلقة ${a.nx.ep} ${next <= 0 ? 'اليوم' : next === 1 ? 'غداً' : 'بعد ' + nDays(next)}</span>` : air ? airCel(air) : ''}</button>
    <h3>${esc(title(a))}</h3><p class="meta">${meta}</p>${live ? progHTML(a, m) : ''}</article>`; }

// ---------- السماء: أرقامك، ثم ما تشاهده الآن
function tallyHTML() { const all = Object.entries(P.a).filter(([id]) => isOpen() || !D.adult.has(+id)); if (!all.length) return '';   // سجل ما يظهر الآن: بلا أعمال +18 والفلتر قائم
  let eps = 0, min = 0, sum = 0, rated = 0; for (const [id, m] of all) { const a = D.by.get(+id); eps += m.p || 0; min += (m.p || 0) * (a?.dur || 24); if (m.r) { sum += m.r; rated++; } }
  const bold = (t, shown) => /^\d/.test(t) ? t.replace(/^[\d,]+/, m => `<b>${shown ?? m}</b>`) : `<b>${t}</b>`, days = Math.round(min / 144) / 10;
  return `<span>${bold(nWorks(all.length))} في قائمتك</span><span>${eps ? bold(nEps(eps)) + ' شاهدتها' : 'لم تسجّل حلقات بعد'}</span>${days >= .1 ? `<span>${days < 3 ? `<b>${num(days)}</b> يوم` : bold(nDays(Math.floor(days)), num(days))} من المشاهدة</span>` : ''}${rated ? `<span>متوسط تقييمك <b>${(sum / rated).toFixed(2)}</b></span>` : ''}`; }
// الأولوية لما بدأته (الأقرب إلى الإكمال أولاً)، ثم ما له حلقة قادمة، ثم الباقي بترتيب القائمة
function nowList() { const l = inList('watching'), k = a => { const m = me(a.id), p = m.p || 0; return p ? 2 + (a.eps ? p / a.eps : .5) : a.nx ? 1 : 0; };
  return l.sort((a, b) => k(b) - k(a) || (a.ord ?? 1e9) - (b.ord ?? 1e9)); }
function nowHTML() { if (!hasLog()) return D.list.length ? `<div class="invite"><h2>هذه قائمتك: ${nWorks(D.list.filter(a => a.ord != null).length)}</h2>
    <p>سجلّك (ما شاهدته وما أكملته وتقييماتك وتواريخك) لا يُحفظ في الموقع العام. استورده من ملف تصدير ${ltr('MyAnimeList')} مرة واحدة على أي جهاز، ثم اربط ${ltr('SIMKL')} ليكمله بما عنده، وتنقله المزامنة إلى بقية أجهزتك.</p>
    <button class="btn pri" data-act="import">${ic('in')}<span>استورد سجلّي</span></button></div>` : '';
  const l = nowList(); if (!l.length) return '';
  return `<div class="now"><h2>أكمل المشاهدة<small>${nWorks(l.length)}</small></h2><div class="rail" id="rail">${l.slice(0, 14).map((a, i) => celHTML(a, 'rail', i)).join('')}${l.length > 14 ? `<button class="rail-more" data-act="list" data-l="watching">كل ما أشاهده (${l.length})</button>` : ''}</div></div>`; }
function renderSky() { $('#tally').innerHTML = tallyHTML(); $('#now').innerHTML = nowHTML(); renderTonight(); }
// ---------- «اقتراح الليلة»: عمل تبدأه من «سأشاهده»، مما عُرض ويصلح بدايةً: أول أجزاء خطه، أو ما أكملت الجزء الذي قبله فيه (لا يُقترح موسم ثالث
// قبل الثاني). الأعلى تقييماً في MyAnimeList أولاً، و«اقتراح آخر» يأتي بغيره. ومزاجه تصنيفات تختار منها ما تشاء: لمسة تضيف ولمسة ترفع،
// ويُقدَّم ما يجمعها كلها ثم ما يجمع أكثرها، كما في الأفلام والألعاب
let tonightId = 0, amoods = []; try { amoods = (store.get('anime.mood') || '').split(',').filter(Boolean).map(Number); } catch {}
// يصلح بدايةً: ما قبله في خطه أكملته (أو هو أوله)، وما كان فرعاً (جانبياً، نسخة أخرى، ملخصاً…) فأصله أكملته أيضاً
const startable = a => { const w = D.wby.get(a.w); if (!w) return true; const M = model(w, D.by), L = M.lines[M.lineOf.get(a.id)]; if (!L) return true; const i = L.ids.indexOf(a.id), done = id => me(id)?.s === 'completed';
  if (i > 0 && !done(L.ids[i - 1])) return false; const root = M.refOf.get(L.ids[0]); return L.i === 0 || !root || done(root); };
const tonightOk = a => !a.ad && me(a.id)?.s === 'plan' && a.st !== 'soon' && !a.pending && (a.img || a.tp) && startable(a);
const gfits = a => amoods.filter(g => (a.g || []).includes(g)).length;
function pickTonight(fresh) { const all = D.list.filter(tonightOk); let best = 0; for (const a of all) best = Math.max(best, gfits(a)); const good = a => !amoods.length || !best || gfits(a) === best;
  const cur = D.by.get(tonightId); if (!fresh && cur && tonightOk(cur) && good(cur)) return { a: cur, best };
  const pool = all.filter(a => good(a) && a.id !== tonightId), from0 = pool.length ? pool : all.filter(good); if (!from0.length) return { a: null, best };
  const strong = from0.filter(a => (a.sc || 0) >= 7.8), from = strong.length >= 4 ? strong : from0, a = from[Math.floor(Math.random() * from.length)]; tonightId = a.id; return { a, best }; }
function renderTonight(fresh) { const box = $('#tonight'); if (!box) return; if (!hasLog()) { box.innerHTML = ''; return; }   // والاقتراح لا يختار عمل +18 (tonightOk)
  const n = new Map(); for (const a of D.list) if (tonightOk(a)) for (const g of a.g || []) n.set(g, (n.get(g) || 0) + 1); amoods = amoods.filter(g => n.has(g));
  const { a, best } = pickTonight(fresh), total = D.list.filter(tonightOk).length; if (!total) { box.innerHTML = ''; return; }
  const chip = (g, name, c) => `<button type="button" data-act="amood" data-g="${g}" aria-pressed="${g < 0 ? !amoods.length : amoods.includes(g)}"${g >= 0 ? ` style="--gh:${ghue(D.genres[g])}"` : ''}>${name}<b>${num(c)}</b></button>`;
  const w = a && D.wby.get(a.w), d = w ? pos(w, a.id) : null, wn = w ? (ui.names === 'english' && w.en ? w.en : w.name) : '', meta = a ? [typeOf(a), a.y || '', a.type !== 'Movie' && a.eps ? nEps(a.eps) : '', a.sc ? `${ltr('MyAnimeList')} ${a.sc.toFixed(2)}` : ''].filter(Boolean).join(' · ') : '';
  const gs = a ? [...(a.g || []).filter(g => amoods.includes(g)), ...(a.g || []).filter(g => !amoods.includes(g))].slice(0, 3).map(g => genreOf(D.genres[g])).join('، ') : '';
  const hint = amoods.length >= 2 ? (best === amoods.length ? `عمل يجمع ${amoods.map(g => genreOf(D.genres[g])).join(' و')}.` : best ? `لا عمل في «سأشاهده» يجمعها كلها، فهذا أقربها: يجمع ${best} من ${amoods.length}.` : 'لا عمل في «سأشاهده» من هذه التصنيفات.') : '';
  box.innerHTML = `<section class="tn" aria-label="اقتراح الليلة"${a?.ac ? ` style="--ac:#${a.ac}"` : ''}>${a?.bd ? `<div class="tn-bd"><img alt="" decoding="async" src="${D.base}w780${a.bd}"></div>` : ''}
    <div class="tn-t"><p class="tn-l">اقتراح الليلة من «سأشاهده»</p>${a ? `<h2 dir="ltr"${title(a).length > 34 ? ' class="long"' : ''}>${esc(title(a))}</h2>${d ? `<p class="tn-k">${d.badge}${wn && wn !== title(a) ? ` · ${ltr(wn)}` : ''}</p>` : '<p class="tn-k">عمل منفرد</p>'}<p class="tn-m">${meta}${gs ? ` · ${gs}` : ''}</p>
      <div class="acts"><button class="btn pri" data-act="open" data-id="${a.id}">افتح بطاقته</button><button class="btn ghost" data-act="treroll">${ic('warp')}<span>اقتراح آخر</span></button><button class="btn ghost" data-act="status" data-id="${a.id}" data-s="watching">${ic('play')}<span>سأبدأه الآن</span></button></div>` : '<h2>لا شيء بهذا المزاج</h2>'}
      <div class="tn-mood"><span>مزاجك الليلة</span><div class="gchips tn-c" data-drag>${chip(-1, 'أي تصنيف', total)}${[...n].sort((x, y) => y[1] - x[1]).map(([g, c]) => chip(g, genreOf(D.genres[g]), c)).join('')}</div></div>${hint ? `<p class="tn-h">${hint}</p>` : ''}</div></section>`; }

// ---------- القوائم والشبكة
function renderLists() { const n = l => inList(l).length, log = hasLog();
  $('#lists').innerHTML = (log ? LISTS.map(([k, name]) => `<button data-act="list" data-l="${k}" aria-pressed="${ui.list === k}">${name} <b>${num(n(k))}</b></button>`).join('') : '')
    + `<button data-act="list" data-l="all" aria-pressed="${ui.list === 'all' || !log}">الكل <b>${num(D.list.filter(mine).length)}</b></button>`; }
// الأسماء العربية (E70): أعمال «أنمياتي» تُعرف بأسمائها العربية في TMDB (an، يكتبها البناء)، فيُبحث بها وحدها ولا تُعرض أسماءً لها. تُقارن بلا «ال»
// التعريف وبلا فرق همزة وتاء وألف مقصورة، فمن كتب «العمالقة» وجد ما اسمه العربي «هجوم عمالقة». arHit: الاسم العربي الذي طابق ما كُتب
const isArQ = s => /[\u0621-\u064a]/.test(s || '');
const arKey = s => fold(s).split(' ').map(w => w.replace(/^(?:[وفبك]?ال|لل)(?=\S{2})/, '')).join(' ');
const arHit = (a, q) => { if (!a?.an || !isArQ(q)) return ''; const k = arKey(q); return (k && a.an.find(n => arKey(n).includes(k))) || ''; };
const hay = a => a.h ||= fold(`${a.t} ${a.en || ''} ${a.studio || ''} ${a.y || ''}`);
function visible() { const log = hasLog(), list = log ? ui.list : 'all'; let l = D.list.filter(a => list === 'all' ? mine(a) : P.a[a.id]?.s === list);
  if (ui.type) l = l.filter(a => a.type === ui.type);
  D.pool = l; if (ui.genre >= 0) l = l.filter(a => (a.g || []).includes(ui.genre));   // pool: ما قبل التصنيف، منه أعداد شريط التصنيفات
  D.found = null; const q = fold(ui.q || '').trim();
  if (q) { const hit = l.filter(a => hay(a).includes(q) || arHit(a, ui.q)); if (hit.length) l = hit; else { const r = find(D.prep ||= prepare(D.list.filter(mine), a => [a.t, a.en, ...(a.an || [])]), ui.q, { limit: 12, min: 50 }); const ids = new Set(r.hits.map(h => h.id)); l = l.filter(a => ids.has(a.id)); D.found = r.meant?.name || null; } }
  const sc = a => me(a.id)?.r || 0, ratio = a => { const m = me(a.id); return a.eps && m?.p ? m.p / a.eps : 0; }, ord = (a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || a.id - b.id;
  const S = { mal: ord, score: (a, b) => sc(b) - sc(a) || ord(a, b), pub: (a, b) => (b.sc || 0) - (a.sc || 0) || ord(a, b), new: (a, b) => (b.from || '0') < (a.from || '0') ? -1 : (b.from || '0') > (a.from || '0') ? 1 : ord(a, b),
    old: (a, b) => (a.from || '9') < (b.from || '9') ? -1 : (a.from || '9') > (b.from || '9') ? 1 : ord(a, b), prog: (a, b) => ratio(b) - ratio(a) || ord(a, b) };
  return l.sort(S[ui.sort] || ord); }
let cur = [];
function renderGrid(keepShown) { cur = visible(); if (!keepShown) ui.shown = 60; const g = $('#grid'), log = hasLog();
  $('#count').innerHTML = !D.list.length ? '' : ui.view === 'worlds' ? `${count(D.worlds.length, ['سلسلة واحدة', 'سلسلتان', 'سلاسل', 'سلسلة', 'سلسلة'])} فيها أعمال من قائمتك، الأكثر حضوراً فيها أولاً` : `${nWorks(cur.length)}${ui.genre >= 0 ? ` من تصنيف ${genreOf(D.genres[ui.genre])}` : ''}${ui.q ? ` تطابق «${esc(ui.q)}»` : ''}${D.found ? `، هل تقصد ${ltr(D.found)}؟` : ''}${log ? '' : ' · بلا سجل على هذا الجهاز'}`;
  g.innerHTML = cur.length ? cur.slice(0, ui.shown).map((a, i) => celHTML(a, 'grid', i)).join('') + (cur.length > ui.shown ? '<i class="more" id="more"></i>' : '')
    : `<p class="none">${ui.q ? 'لا عمل في هذه القائمة يطابق ما كتبت.' : log ? 'هذه القائمة فارغة.' : 'تُحمَّل القائمة…'}</p>`;
  const more = $('#more'); if (more) moreIO.observe(more); renderGenres(); }
// ---------- شريط التصنيفات: تصنيفات القائمة الظاهرة بأعدادها، الأكثر أولاً، ولكل تصنيف لون ثابت يُعرف به. لمسة تفرز بها الشبكة ولمسة ثانية ترفع الفرز،
// ويُسحب بالماوس كبقية الشرائط (site/rail.js). الأعداد من القائمة والنوع المختارين قبل التصنيف (D.pool)
// على الجوال يخرج الشريط من الشريط الثابت إلى ما تحته مباشرة، فلا يطول الثابت بسطر خامس يأكل الشاشة
const gmq = matchMedia('(max-width: 700px)'), placeChips = () => { const g = $('#gchips'); if (!g) return; if (gmq.matches) { if (g.nextElementSibling?.id !== 'count') $('#count').before(g); g.classList.add('out'); } else { $('#tools .names').before(g); g.classList.remove('out'); } };
gmq.addEventListener('change', placeChips);
const ghue = n => { let h = 7; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function renderGenres() { const box = $('#gchips'); if (!box) return; const n = new Map(); for (const a of D.pool || []) for (const g of a.g || []) n.set(g, (n.get(g) || 0) + 1);
  const gs = [...n].sort((a, b) => b[1] - a[1] || a[0] - b[0]); if (ui.genre >= 0 && !n.has(ui.genre)) gs.unshift([ui.genre, 0]);
  const x = box.scrollLeft, chip = (g, name, c) => `<button type="button" data-act="genre" data-g="${g}" aria-pressed="${ui.genre === g}"${g >= 0 ? ` style="--gh:${ghue(D.genres[g])}"` : ''}>${name}${c != null ? `<b>${num(c)}</b>` : ''}</button>`;
  box.innerHTML = chip(-1, 'كل التصنيفات') + gs.map(([g, c]) => chip(g, genreOf(D.genres[g]), c)).join(''); box.scrollLeft = x;
  const on = box.querySelector('[aria-pressed=true]'); if (on && ui.genre >= 0) { const r = on.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.left < b.left || r.right > b.right) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: calm ? 'auto' : 'smooth' }); } }
const moreIO = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; moreIO.disconnect(); const from = ui.shown; ui.shown += 60; const more = $('#more'); if (!more) return;
  more.insertAdjacentHTML('beforebegin', cur.slice(from, ui.shown).map((a, i) => celHTML(a, 'grid', i)).join('')); if (cur.length > ui.shown) moreIO.observe(more); else more.remove(); }, { rootMargin: '900px' });
function setView(v) { ui.view = v; $$('.views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  $('#grid').hidden = v !== 'list'; $('#worlds').hidden = v !== 'worlds'; $('#lists').hidden = $('#tools').hidden = $('#gchips').hidden = v !== 'list'; if (v === 'worlds') $('#worlds').innerHTML = worldsHTML(); renderGrid(); }
function renderAll(keepShown) { renderSky(); renderLists(); if (ui.view === 'worlds') $('#worlds').innerHTML = worldsHTML(); renderGrid(keepShown); if ($('#addd')?.open) drawAddRes(); }

// ---------- تعديل السجل. كل تعديل يُحفظ ويُزامَن فوراً، ومعه «تراجع»
function commit(id, before, say) { const m = P.a[id]; if (m) { if (!m.p) delete m.p; if (!m.r) delete m.r; if (!m.b) delete m.b; if (!m.e) delete m.e; if (!m.s) delete P.a[id]; }
  save(); const moved = (before?.s || '') !== (P.a[id]?.s || ''); redraw(id, moved);
  if (say) toast(say, () => { if (before) P.a[id] = before; else delete P.a[id]; save(); redraw(id, true); }); }
// ما تغيّر مكانه (دخل قائمة أو خرج منها) يُعاد رسم الصفحة له، وما تغيّر تقدّمه فقط يُحدَّث سِله في مكانه
function redraw(id, moved) { const a = D.by.get(id); if (moved) renderAll(true); else { renderLists(); $('#tally').innerHTML = tallyHTML();
    for (const c of $$(`.cel[data-id="${id}"]`)) { const rail = !!c.closest('.rail'), t = document.createElement('template'); t.innerHTML = celHTML(a, rail ? 'rail' : 'grid', +c.style.getPropertyValue('--i') || 0); const n = t.content.firstElementChild; n.style.animation = 'none'; c.replaceWith(n); } }
  if (open === id) { const box = $('#sheet-body .mine'); if (box) box.outerHTML = mineHTML(a); drawXs(a); }
  if (wopen && D.wby.get(wopen)?.ids.includes(id)) redrawGate(); }
function bump(id, d) { const a = D.by.get(id), before = me(id) ? { ...me(id) } : null, p0 = before?.p || 0, p = Math.max(0, a.eps ? Math.min(a.eps, p0 + d) : p0 + d); if (p === p0) return;
  const m = P.a[id] ||= {}; m.p = p; let say = d > 0 ? `شاهدت الحلقة ${num(p)} من ${ltr(a.t)}` : '';
  if (!m.s || m.s === 'plan') m.s = 'watching'; if (d > 0 && !p0 && !m.b) m.b = today;
  if (d > 0 && a.eps && p === a.eps) { m.s = 'completed'; if (!m.e) m.e = today; say = `أكملت ${ltr(a.t)}`; } else if (m.s === 'completed' && a.eps && p < a.eps) m.s = 'watching';
  commit(id, before, say); if (d > 0 && !calm) for (const c of $$(`.cel[data-id="${id}"]`)) c.classList.add('bump'); }
function setProgress(id, n) { const a = D.by.get(id), before = me(id) ? { ...me(id) } : null, p = Math.max(0, a.eps ? Math.min(a.eps, n) : n); if (!Number.isFinite(p) || p === (before?.p || 0)) return;
  const m = P.a[id] ||= {}, full = !!a.eps && p === a.eps; m.p = p; if (full && m.s !== 'dropped') m.s = 'completed'; else if (!m.s || (m.s === 'plan' && p > 0) || (m.s === 'completed' && a.eps && p < a.eps)) m.s = 'watching';   // الرقم المكتوب قد يكون لمشاهدة قديمة، فلا يُسجَّل معه تاريخ
  commit(id, before, full ? `أكملت ${ltr(a.t)}` : `الحلقات ${num(p)}${a.eps ? ' من ' + num(a.eps) : ''}`); }
function setStatus(id, s) { const a = D.by.get(id), before = me(id) ? { ...me(id) } : null; if (before?.s === s) return; const m = P.a[id] ||= {}; m.s = s;
  if (s === 'completed' && a.eps) m.p = a.eps; commit(id, before, `${ltr(a.t)} في «${LNAME[s]}»`); }
function setScore(id, r) { const before = me(id) ? { ...me(id) } : null; if (!before) return; P.a[id].r = before.r === r ? 0 : r; commit(id, before, P.a[id]?.r ? `تقييمك ${r} من 10: ${SCORE[r]}` : 'أُزيل تقييمك'); }
function setDate(id, k, v) { const before = me(id) ? { ...me(id) } : null; if (!before || (before[k] || '') === v) return; P.a[id][k] = v; commit(id, before, v ? `${k === 'b' ? 'البداية' : 'النهاية'}: ${dateAr(v)}` : `أُزيل تاريخ ${k === 'b' ? 'البداية' : 'النهاية'}`); }
function removeEntry(id) { const a = D.by.get(id), before = me(id) ? { ...me(id) } : null; if (!before) return; delete P.a[id]; commit(id, before, `أُزيل ${ltr(a.t)} من قائمتك`); }

// ---------- بطاقة العمل
let open = 0, wopen = 0, kept = null;   // kept: بطاقة أُغلقت لتُفتح سلسلتها أو بالرجوع، ومحتواها باقٍ: رقمها وموضع تمريرها
const texts = async id => { const k = id % 32; if (!D.texts.has(k)) D.texts.set(k, get(`texts/${k}.json`).catch(() => ({}))); return (await D.texts.get(k))[id] || null; };
function mineHTML(a) { const m = me(a.id);
  if (!m) return `<section class="sec mine"><h3>سجلّي</h3><p class="lbl">ليس في قائمتك.</p><div class="acts"><button class="btn pri" data-act="status" data-id="${a.id}" data-s="plan">${ic('mark')}<span>أضفه إلى «سأشاهده»</span></button><button class="btn ghost" data-act="status" data-id="${a.id}" data-s="watching">${ic('play')}<span>أشاهده الآن</span></button></div></section>`;
  const full = k => /^\d{4}-\d{2}-\d{2}$/.test(m[k] || '') ? m[k] : '', part = k => m[k] && !full(k) ? ` (${dateAr(m[k])})` : '';
  return `<section class="sec mine"><h3>سجلّي</h3>
    <div class="st5" role="group" aria-label="القائمة">${LISTS.map(([k, name, i]) => `<button data-act="status" data-id="${a.id}" data-s="${k}" data-l="${k}" aria-pressed="${m.s === k}">${ic(i)}<span>${name}</span></button>`).join('')}</div>
    ${a.type === 'Movie' && a.eps <= 1 ? '' : `<div class="epr"><button data-act="minus" data-id="${a.id}" aria-label="أنقص حلقة" ${m.p ? '' : 'disabled'}>−</button>${progHTML(a, m, false)}<button class="plus" data-act="plus" data-id="${a.id}" aria-label="شاهدت الحلقة التالية" ${a.eps && (m.p || 0) >= a.eps ? 'disabled' : ''}>${ic('plus')}</button></div>
    <div class="eprow"><label class="lbl" for="ep-n">أو اكتب رقم آخر حلقة شاهدتها</label><input id="ep-n" data-id="${a.id}" type="number" inputmode="numeric" min="0" ${a.eps ? `max="${a.eps}"` : ''} value="${m.p || 0}"></div>`}
    <div><span class="lbl">تقييمي${m.r ? `: ${m.r} من 10، ${SCORE[m.r]}` : ' (اضغط الرقم، واضغطه ثانية لإزالته)'}</span><div class="score" role="group" aria-label="تقييمي من 10">${Array.from({ length: 10 }, (_, i) => `<button data-act="score" data-id="${a.id}" data-r="${i + 1}" aria-pressed="${m.r === i + 1}" aria-label="${i + 1} من 10: ${SCORE[i + 1]}">${i + 1}</button>`).join('')}</div></div>
    <div class="dates"><label>بدأته${part('b')}<input type="date" data-id="${a.id}" data-k="b" value="${full('b')}" max="${today}"></label><label>أكملته${part('e')}<input type="date" data-id="${a.id}" data-k="e" value="${full('e')}" max="${today}"></label></div>
    <div class="acts"><button class="btn quiet" data-act="remove" data-id="${a.id}">أزله من قائمتي</button></div></section>`; }
const PROV = [['stream', 'باشتراك'], ['free', 'مجاناً'], ['rent', 'إيجار'], ['buy', 'شراء']];
function whereHTML(a) { if (a.pv === undefined || a.st === 'soon') return ''; const p = a.pv, show = `https://www.themoviedb.org/${a.tm.k}/${a.tm.id}/watch?locale=SA`, link = p?.link || show;
  const chip = (id, href) => `<a href="${esc(href)}" target="_blank" rel="noopener">${D.prov[id].logo ? `<img loading="lazy" width="32" height="32" alt="" src="${D.base}w92${D.prov[id].logo}">` : ''}${ltr(D.prov[id].name)}</a>`;
  const rows = p ? PROV.map(([k, t]) => { const ids = (p[k] || []).filter(id => D.prov[id]); return ids.length ? `<div class="wrow"><b>${t}</b><span class="wl">${ids.map(id => chip(id, link)).join('')}</span></div>` : ''; }).join('') : '';
  // pvs: المنصات لموسم العمل نفسه. pvo: لا منصة لهذا الموسم هنا، وهذه منصات مواسم أخرى من مسلسله
  const season = a.tm.k === 'tv' && a.tm.s != null, other = a.pvo ? [...new Set(PROV.flatMap(([k]) => a.pvo[k] || []))].filter(id => D.prov[id]) : [];
  return `<section class="sec where"><h3>أين تشاهده في السعودية</h3>${rows ? rows + `<p class="lbl">الأزرار تفتح صفحة أماكن العرض على ${ltr('TMDB')}، ومنها إلى المنصة. البيانات من ${ltr('JustWatch')} وتتحدث يومياً${!season ? '' : a.pvs ? '، وهي لهذا الموسم بعينه' : '، وهي للمسلسل كله لا لهذا الموسم وحده'}.</p>`
    : `<p class="lbl">لا تذكر بيانات ${ltr('JustWatch')} منصة تعرض${a.pvs ? ' هذا الموسم' : 'ه'} في السعودية حالياً.</p>${other.length ? `<div class="wrow"><b>مواسم أخرى من المسلسل</b><span class="wl">${other.map(id => chip(id, a.pvo.link || show)).join('')}</span></div>` : ''}`}</section>`; }
const dot = id => { const s = me(id)?.s; return s ? `<i class="dot" data-l="${s}"></i>` : ''; };
function worldStrip(a) { const w = D.wby.get(a.w); if (!w) return ''; const order = (w.story || w.ids).filter(id => D.by.has(id)), at = order.indexOf(a.id) + 1;
  return `<section class="sec"><h3>من سلسلة ${ltr(w.name)}</h3><p class="lbl">العمل ${at} من ${order.length} بترتيب ${w.story ? 'القصة' : 'الصدور'}</p>
    <div class="strip">${order.map(id => D.by.get(id)).filter(Boolean).map(x => `<button data-act="open" data-id="${x.id}" aria-current="${x.id === a.id}" aria-label="${esc(x.t)}"${marks(x.id, x.ad)}>${dot(x.id)}${thumb(x)}<span>${esc(title(x))}</span></button>`).join('')}</div>
    <div class="acts"><button class="btn ghost" data-act="world" data-w="${w.id}">افتح السلسلة بترتيبها</button></div></section>`; }
// ---------- «موقعه من سلسلته»: لافتة محطة تحت العنوان تقول بجملة واضحة ما هذا الجزء من سلسلته وما يكمله وما بعده، وفوقها خريطة خطه
// (الجمل في site/anime-pos.js من خطوط السلسلة في الكتالوج). كل اسم فيها يفتح بطاقته، وما ليس في «أنمياتي» يُذكر باسمه
const chainLink = (id, name) => { const x = D.by.get(id); return x ? `<button type="button" class="ch-l" data-act="open" data-id="${id}" dir="ltr">${esc(title(x))}</button>` : name ? ltr(name) : ''; };
const POS = { esc, title: a => title(a), link: id => chainLink(id), name: w => ltr(ui.names === 'english' && w.en ? w.en : w.name), long: a => (a?.eps || 0) >= 100 || a?.st === 'airing' };
const pos = (w, id) => describe(w, id, Object.assign(POS, { by: D.by }));
// الخريطة: نقاط الخط الرئيسي بترتيب الأحداث من اليمين، وما أكملته ممتلئ، وموضع العمل نقطة مضيئة. الخط الطويل يُختصر حول الموضع،
// والفرع (قصة جانبية، نسخة أخرى…) معلّق تحت أصله
function posMap(d) { const { ids, at, branch } = d.map, n = ids.length, MAX = 13, f = branch ? Math.max(0, branch.from) : Math.max(0, at);
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const slots = n <= MAX ? range(0, n - 1) : (() => { const lo = Math.max(1, Math.min(f - 4, n - MAX + 3)), hi = Math.min(n - 2, lo + MAX - 5); return [0, ...(lo > 1 ? [-1] : []), ...range(lo, hi), ...(hi < n - 2 ? [-1] : []), n - 1]; })();
  if (!n && !branch) return ''; const S = Math.max(1, slots.length), X = k => S === 1 ? 50 : 94 - k * 88 / (S - 1), done = id => me(id)?.s === 'completed';
  const dot = (x, y, id, here) => here ? `<circle class="ring" cx="${x}%" cy="${y}" r="9"/><circle class="here" cx="${x}%" cy="${y}" r="5.5"/>` : `<circle class="d${done(id) ? ' done' : ''}" cx="${x}%" cy="${y}" r="3.6"/>`;
  let out = n > 1 ? `<line class="trk" x1="${X(0)}%" x2="${X(S - 1)}%" y1="12" y2="12"/>` : '';
  slots.forEach((i, k) => { out += i < 0 ? [-1.6, 0, 1.6].map(o => `<circle class="gap" cx="${X(k) + o}%" cy="12" r="1.1"/>`).join('') : dot(X(k), 12, ids[i], i === at && !branch); });
  if (branch) { const m = branch.ids.length, k0 = slots.indexOf(branch.from), px = k0 >= 0 ? X(k0) : n ? null : 94, step = Math.min(S > 1 ? 88 / (S - 1) : 9, 9), show = Math.min(m, 9);
    const first = Math.max(0, Math.min(branch.at - 4, m - show)), dir = px != null && px - step * show >= 4 ? -1 : 1, bx = j => (px ?? 94) + dir * step * (j + 1);
    if (px != null && n) out += `<line class="trk br" x1="${px}%" x2="${px}%" y1="12" y2="34"/><line class="trk br" x1="${px}%" x2="${bx(show - 1)}%" y1="34" y2="34"/>`;
    for (let j = 0; j < show; j++) { const id = branch.ids[first + j]; out += dot(bx(j), 34, id, first + j === branch.at); } }
  return `<svg class="pos-map" height="${branch ? 46 : 24}" aria-hidden="true">${out}</svg>`; }
// العمل المنفرد يُقال فيه ذلك صراحة: لا سلسلة له في علاقات MyAnimeList، فلا أجزاء قبله ولا بعده حتى الآن
function soloHTML(a) { if (a.pending || a.pk) return ''; const [n, g] = noun(a);
  return `<section class="pos" data-k="solo" aria-label="موقعه من سلسلته"><svg class="pos-map" height="24" aria-hidden="true"><line class="trk" x1="38%" x2="62%" y1="12" y2="12"/><circle class="ring" cx="50%" cy="12" r="9"/><circle class="here" cx="50%" cy="12" r="5.5"/></svg>
    <p class="pos-h"><b class="pos-b">عمل منفرد</b>${n !== 'عمل' && n !== 'جزء قادم' ? `<span class="pos-s">${n}</span>` : ''}</p><p class="pos-t">${g === 'f' ? 'قائمة بذاتها' : 'قائم بذاته'}: ليس جزءاً من سلسلة، فلا أجزاء قبله ولا بعده حتى الآن.</p></section>`; }
function posHTML(a) { const w = D.wby.get(a.w); if (!w || seen(w) < 2) return soloHTML(a); const d = pos(w, a.id); if (!d) return '';
  const order = (w.story || w.ids).filter(id => D.by.has(id)), at = order.indexOf(a.id) + 1;
  return `<section class="pos" data-k="${d.kind}" aria-label="موقعه من سلسلته">${posMap(d)}
    <p class="pos-h"><b class="pos-b">${d.badge}</b>${d.sub ? `<span class="pos-s">${d.sub}</span>` : ''}</p>
    ${d.says.map(t => `<p class="pos-t">${t}</p>`).join('')}${d.warp ? `<p class="pos-w">${ic('warp')}<span>${d.warp}</span></p>` : ''}
    ${d.next ? `<p class="pos-n"><b>التالي</b><span>${d.next.kind}</span> ${chainLink(d.next.id)}</p>` : ''}
    <button class="pos-f" data-act="world" data-w="${w.id}">${ic('line')}<span>${at} من ${order.length} في ${POS.name(w)}، بترتيب ${w.story ? 'الأحداث' : 'الصدور'}</span><b>السلسلة كاملة</b></button></section>`; }
// شارة موقعه في صفوف ترتيب السلسلة: نوعه وما يكمله، بلا روابط (الصف كله زر)
const posTag = (w, id) => { const d = pos(w, id); return d ? `<span class="otag" data-k="${d.kind}">${d.badge}${d.hint ? `<span> · ${d.hint}</span>` : ''}</span>` : ''; };
function sheetHTML(a, x) { if (x?.ar) unask(a.id, 'about'); const big = a.tp ? `${D.base}w780${a.tp}` : poster(a, true), facts = [[typeOf(a)], a.type !== 'Movie' && a.eps ? [nEps(a.eps)] : a.eps === 0 && a.st === 'airing' ? ['مستمر'] : null, a.dur ? [`${a.dur} دقيقة${a.type === 'Movie' ? '' : ' للحلقة'}`] : null,
    a.se && a.y ? [`${SEASON[a.se]} ${a.y}`] : a.y ? [a.y] : null, a.st === 'airing' ? ['يُعرض الآن'] : null, a.studio ? [ltr(a.studio)] : null, x?.source ? [`المصدر: ${SOURCE[x.source] || ltr(x.source)}`] : null, a.rating ? [/^\+/.test(RATING[a.rating] || a.rating) ? ltr(RATING[a.rating] || a.rating) : RATING[a.rating] || ltr(a.rating)] : null].filter(Boolean);
  const alt = [a.en && a.en !== a.t ? a.en : '', ui.names === 'english' && a.en ? a.t : '', x?.jp || ''].filter(Boolean);
  const links = [['MyAnimeList', `https://myanimelist.net/anime/${a.id}`], a.sk ? ['SIMKL', `https://simkl.com/anime/${a.sk}`] : null, x?.anilist ? ['AniList', `https://anilist.co/anime/${x.anilist}`] : null, a.tm ? ['TMDB', `https://www.themoviedb.org/${a.tm.k}/${a.tm.id}`] : null, x?.yt ? ['YouTube', `https://www.youtube.com/watch?v=${encodeURIComponent(x.yt)}`] : null].filter(Boolean);
  return `<div class="hero">${a.bd && !hid(a) ? `<img decoding="async" alt="" src="${D.base}w1280${a.bd}">` : a.bn && !hid(a) ? `<img decoding="async" alt="" src="${esc(a.bn)}">` : ''}</div>
  <div class="body"><div class="head">${hid(a) ? `<button class="cel-art x18"${a.ac ? ` style="--ac:#${a.ac}"` : ''} data-act="bare" data-id="${a.id}" aria-label="أظهر صورة ${esc(a.t)}">${art(a, '170px', true, 'اضغط لإظهارها')}</button>`
      : `<button class="cel-art"${a.ac ? ` style="--ac:#${a.ac}"` : ''} ${poster(a) ? `data-zoom="${esc(big)}" data-zoom-title="${esc(a.t)}"` : 'disabled'} aria-label="تكبير بوستر ${esc(a.t)}">${art(a, '170px', true)}</button>`}
    <div><h2>${esc(title(a))}</h2>${alt.map(t => `<p class="alt">${esc(t)}</p>`).join('')}
      <div class="facts">${facts.map(f => `<span>${f[0]}</span>`).join('')}${a.sc ? `<span class="mal">${ltr('MyAnimeList')} <b>${a.sc.toFixed(2)}</b></span>${a.sv ? `<span>${num(a.sv)} تقييماً</span>` : ''}` : ''}</div></div></div>
    ${airHTML(a)}${posHTML(a)}${a.pk ? pkAddHTML(a) : mineHTML(a)}${a.pending || a.pk ? liveNote(a, x) : ''}
    ${D.eps[a.id] ? `<section class="sec xs" id="xs" aria-busy="true"><h3>الحلقات</h3><p class="lbl">تُحمَّل الحلقات…</p></section>` : ''}
    ${x?.ar ? `<section class="sec"><h3>القصة</h3><p class="ov">${esc(x.ar)}</p></section>` : x?.en ? `<section class="sec"><h3>القصة</h3><span class="lbl">النبذة بالإنجليزية من ${ltr('MyAnimeList')}${a.pk ? '' : '، ولم تُترجم بعد'}.</span><p class="ov en">${esc(x.en)}</p>${a.pk ? '' : trHTML(a, 'about')}</section>` : ''}
    ${(a.g || []).length ? `<div class="glinks" role="group" aria-label="تصنيفاته: اضغط تصنيفاً لترى أعماله في قائمتك">${a.g.map(i => `<button type="button" data-act="genre-go" data-g="${i}" style="--gh:${ghue(D.genres[i])}">${genreOf(D.genres[i])}</button>`).join('')}</div>` : ''}
    ${whereHTML(a)}${worldStrip(a)}${x?.live ? liveMore(a, x) : ''}
    <section class="sec"><h3>صفحاته</h3><div class="links">${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}${ic('ext')}</a>`).join('')}</div></section></div>`; }
// السجل: كل نافذة يفتحها الموقع خطوة فيه، وحالتها تصف ما هو مفتوح عندها: a العمل، وw السلسلة التي تحته إن فُتح منها، وp أنها خطوة أضافها الموقع فإغلاق نافذتها رجوع.
// الرابط المباشر والعنوان المكتوب أو الملصوق باليد خطوة بلا حالة: يُقرأ ما يُفتح من الرابط نفسه (at)، وإغلاق نافذتها يغلقها وينظف الرابط (shut).
// والبطاقة فوق سلسلتها دائماً، ولا تُفتح سلسلة فوق بطاقة: فتح السلسلة من بطاقة يطويها (stash) والرجوع يعيدها كما كانت (reshow)
async function openWork(id, push = true) { const a = D.by.get(id); if (!a) return; open = id; pkOpen = 0; kept = null; const d = $('#sheet'), body = $('#sheet-body');
  // فوق بوابة عالم تلبس البطاقة ألوانه
  const gw = GM && $('#wsheet').open && D.wby.get(wopen), th = gw && themeOf(gw, D.by, D.genres); d.classList.toggle('themed', !!th); if (th) { d.style.setProperty('--wbg', th.bg); d.style.setProperty('--wc1', th.c1); } delete body.dataset.full; markEl(body, a.id, a.ad); body.innerHTML = sheetHTML(a, null); body.scrollTo(0, 0); showEps(a);
  if (!d.open) { d.showModal(); body.scrollTo(0, 0); if (push) history.pushState({ a: id, w: $('#wsheet').open ? wopen : 0, add: $('#addd').open ? 1 : 0, p: 1, n: depth() + 1 }, '', `#a${id}`); }   // التصفير بعد العرض: المتصفح يعيد للنافذة موضع تمريرها السابق حين تُعرض، وتصفيره وهي مخفية لا يؤثر
  else if (push) history.replaceState(history.state?.p ? { ...history.state, a: id } : null, '', `#a${id}`);
  if (a.pending) { const v = await liveOf(id); if (open !== id) return; if (v && fillPending(a, v)) { keepLive(id, v); renderAll(true); }
    const top = body.scrollTop; markEl(body, a.id, a.ad); body.innerHTML = sheetHTML(a, v ? { ...v.x, live: 1 } : { failed: 1 }); body.scrollTop = top; body.dataset.full = id; return; }
  const x = await texts(id); if (open !== id) return; if (x) { const top = body.scrollTop; body.innerHTML = sheetHTML(a, x); body.scrollTop = top; showEps(a); } body.dataset.full = id; }
const stash = () => { const d = $('#sheet'); if (!d.open) return; kept = { id: open, y: $('#sheet-body').scrollTop }; d.close(); };
function reshow() { const a = D.by.get(kept.id), body = $('#sheet-body'), y = kept.y; kept = null; open = a.id; $('#sheet').showModal(); body.scrollTop = y; const box = body.querySelector('.mine'); if (box) box.outerHTML = mineHTML(a); drawXs(a); }
const at = () => { const st = history.state; if (st && (st.a || st.w || st.imp || st.add)) return st; const h = location.hash.slice(1); let m; return (m = h.match(/^a(\d+)$/)) ? { a: +m[1] } : (m = h.match(/^w(\d+)$/)) ? { w: +m[1] } : {}; };
// يجعل النوافذ المفتوحة كما تصفها خطوة السجل
function apply(st) { const sh = $('#sheet'), ws = $('#wsheet'), a = D.by.has(+st.a) ? +st.a : 0, pk = !a && +st.a > 0 && !D.known.has(+st.a) ? +st.a : 0, w = D.wby.has(+st.w) ? +st.w : 0;
  if (!st.imp && $('#imp').open) $('#imp').close();
  if (!st.add && $('#addd').open) $('#addd').close();
  if (sh.open && ((!a && !pk) || (w && !ws.open))) stash();
  if (ws.open && !w) ws.close();
  if (w && (wopen !== w || !ws.open)) openWorld(w, false);
  if (a && (open !== a || !sh.open)) { if (!sh.open && kept?.id === a && +$('#sheet-body').dataset.full === a) reshow(); else openWork(a, false); }
  else if (pk && (pkOpen !== pk || !sh.open)) peekWork(pk, false); }
const shut = d => { if (history.state?.p) return history.back(); d.close(); if (/^#[aw]\d+$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); };

// ---------- من MyAnimeList مباشرة (E69): عمل ليس في «أنمياتي» تُفتح له بطاقة اطلاع (peek) من نتائج البحث ومن أقرباء ما أُضيف، وعمل أُضيف للتو تمتلئ
// بطاقته المؤقتة بدل أن تبقى فارغة حتى البناء القادم. يُسأل Jikan وAniList معاً، ولكلٍّ مهلته: Jikan لما في MyAnimeList نفسه (النبذة والتقييم والتصنيفات
// والأقرباء والمنصات)، وAniList لغلاف عريض ولون ولرقم العمل هناك ولصور الأقرباء، وهو البديل كله إن لم يُجب Jikan. ما يعود يُحفظ للجلسة، وما أُضيف تُحفظ
// صورته وسنته وحلقاته مع إضافته (ADDK) فيظهر غلافه في القائمة من أول تحميل. وعمل +18 لا تُفتح له بطاقة والفلتر قائم، ولا يظهر بين الأقرباء
const LIVE = new Map(), SEED = new Map(); let pkOpen = 0;   // SEED: ما يُعرف عن قريب قبل أن تُفتح بطاقته (اسمه وصورته)، فتُرسم فوراً
const MAL = ltr('MyAnimeList'), malPath = u => (/\/images\/anime\/(\d+\/\d+)[a-z]?\.(?:jpe?g|webp)/.exec(u || '') || [])[1] || '';
const durMin = s => +(/(\d+)\s*hr/.exec(s || '') || [0, 0])[1] * 60 + +(/(\d+)\s*min/.exec(s || '') || [0, 0])[1];
const LST = { 'Currently Airing': 'airing', 'Not yet aired': 'soon', RELEASING: 'airing', NOT_YET_RELEASED: 'soon', HIATUS: 'airing' };
const ALSRC = { ORIGINAL: 'Original', MANGA: 'Manga', LIGHT_NOVEL: 'Light Novel', VISUAL_NOVEL: 'Visual Novel', VIDEO_GAME: 'Game', GAME: 'Game', NOVEL: 'Novel', WEB_NOVEL: 'Web Novel', DOUJINSHI: 'Manga', PICTURE_BOOK: 'Picture Book', MUSIC: 'Music', MULTIMEDIA_PROJECT: 'Mixed Media' };
const REL = { sequel: 'الجزء التالي', prequel: 'الجزء السابق', 'side story': 'قصة جانبية', 'alternative version': 'نسخة أخرى', alternative: 'نسخة أخرى', 'alternative setting': 'عالم بديل', summary: 'ملخص', compilation: 'تجميع', 'spin-off': 'عمل متفرع', 'spin off': 'عمل متفرع', 'parent story': 'القصة الأم', parent: 'القصة الأم', 'full story': 'القصة الكاملة', contains: 'يضمّه', character: 'شخصياته في عمل آخر' };
const relOf = k => REL[String(k || '').replace(/_/g, ' ').toLowerCase()] || 'عمل مرتبط', srcKey = s => Object.keys(SOURCE).find(k => k.toLowerCase().replace(/\W/g, '') === String(s || '').toLowerCase().replace(/\W/g, '')) || '';
const gIdx = n => { let i = D.genres.indexOf(n); if (i < 0) i = D.genres.push(n) - 1; return i; };
const plain = s => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s*\[Written by MAL Rewrite\]\s*$/, '').replace(/\s*\(Source: [^)]*\)\s*$/i, '').replace(/\n{3,}/g, '\n\n').trim();
function fromJikan(d) { const rx = /^Rx/.test(d.rating || '') || [...(d.genres || []), ...(d.explicit_genres || [])].some(g => g?.name === 'Hentai'), y = d.year || d.aired?.prop?.from?.year, img = malPath(d.images?.webp?.image_url || d.images?.jpg?.image_url), dur = durMin(d.duration), r = (d.rating || '').split(' - ')[0].trim();
  const a = { id: d.mal_id, t: d.title, type: d.type || '', eps: Number.isInteger(d.episodes) ? d.episodes : 0, st: LST[d.status] || 'finished' };
  if (d.title_english && d.title_english !== d.title) a.en = d.title_english; if (y) a.y = y; if (d.season) a.se = d.season; { const pf = d.aired?.prop?.from || {}, two = n => String(n).padStart(2, '0'); if (pf.year) a.from = `${pf.year}${pf.month ? `-${two(pf.month)}${pf.day ? `-${two(pf.day)}` : ''}` : ''}`; else if (/^\d{4}-\d{2}-\d{2}/.test(d.aired?.from || '')) a.from = d.aired.from.slice(0, 10); } if (img) a.img = img;
  if (d.score) { a.sc = d.score; a.sv = d.scored_by || 0; } if (dur) a.dur = dur; if (d.studios?.[0]?.name) a.studio = d.studios[0].name; if (RATING[r]) a.rating = r; if (rx) a.ad = 1;
  const g = [...(d.genres || []), ...(d.explicit_genres || []), ...(d.themes || []), ...(d.demographics || [])].map(z => z?.name).filter(Boolean); if (g.length) a.g = [...new Set(g)].map(gIdx);
  const x = { en: plain(d.synopsis) || null }; if (d.title_japanese) x.jp = d.title_japanese; if (srcKey(d.source)) x.source = srcKey(d.source); if (/^[\w-]{6,20}$/.test(d.trailer?.youtube_id || '')) x.yt = d.trailer.youtube_id;
  x.rel = (d.relations || []).flatMap(z => (z?.entry || []).filter(e => e?.type === 'anime' && Number.isInteger(e.mal_id) && e.name).map(e => ({ id: e.mal_id, t: e.name, k: relOf(z.relation) })));
  x.stream = (d.streaming || []).filter(s => s?.name && /^https:\/\//.test(s.url || '')).map(s => ({ n: s.name, u: s.url }));
  return { a, x }; }
const ALQ = 'query($id:Int){Media(idMal:$id,type:ANIME){id title{romaji english native} description(asHtml:false) format episodes duration status startDate{year month day} season seasonYear genres studios(isMain:true){nodes{name}} coverImage{extraLarge large color} bannerImage isAdult source trailer{id site} relations{edges{relationType node{idMal type title{romaji} startDate{year} coverImage{medium} isAdult}}}}}';
function fromAniList(m, id) { const sd = m.startDate || {}, two = n => String(n).padStart(2, '0'), y = m.seasonYear || sd.year;
  const a = { id, t: m.title?.romaji || String(id), type: AL_TYPE[m.format] || '', eps: Number.isInteger(m.episodes) ? m.episodes : 0, st: LST[m.status] || 'finished' };
  if (m.title?.english && m.title.english !== a.t) a.en = m.title.english; if (y) a.y = y; if (SEASON[String(m.season || '').toLowerCase()]) a.se = m.season.toLowerCase(); if (sd.year) a.from = `${sd.year}${sd.month ? `-${two(sd.month)}${sd.day ? `-${two(sd.day)}` : ''}` : ''}`;
  if (m.duration) a.dur = m.duration; if ((m.genres || []).length) a.g = m.genres.map(gIdx); if (m.studios?.nodes?.[0]?.name) a.studio = m.studios.nodes[0].name; if (m.isAdult) a.ad = 1;
  const x = { en: plain(m.description) || null, anilist: m.id }; if (m.title?.native) x.jp = m.title.native; if (ALSRC[m.source]) x.source = ALSRC[m.source]; if (m.trailer?.site === 'youtube' && /^[\w-]{6,20}$/.test(m.trailer.id || '')) x.yt = m.trailer.id;
  x.rel = (m.relations?.edges || []).filter(e => e?.node?.type === 'ANIME' && Number.isInteger(e.node.idMal)).map(e => ({ id: e.node.idMal, t: e.node.title?.romaji || String(e.node.idMal), k: relOf(e.relationType), ...(e.node.startDate?.year ? { y: e.node.startDate.year } : {}), ...(/^https:\/\//.test(e.node.coverImage?.medium || '') ? { iu: e.node.coverImage.medium } : {}), ...(e.node.isAdult ? { ad: 1 } : {}) }));
  const iu = m.coverImage?.extraLarge || m.coverImage?.large || ''; return { a, x, iu: /^https:\/\//.test(iu) ? iu : '', ac: /^#[0-9a-f]{6}$/i.test(m.coverImage?.color || '') ? m.coverImage.color.slice(1) : '', bn: /^https:\/\//.test(m.bannerImage || '') ? m.bannerImage : '' }; }
// يعود بـ{ a, x } (a بصيغة الكتالوج، x بصيغة النصوص ومعه rel وstream وyt) أو null إن لم يُجب أحدهما. الفشل لا يُحفظ: الفتح التالي يسأل من جديد
function liveOf(id) { if (!LIVE.has(id)) LIVE.set(id, (async () => {
    const [j, l] = await Promise.allSettled([
      timed(8000, async sig => { const r = await fetch(`https://api.jikan.moe/v4/anime/${id}/full`, { signal: sig }); if (!r.ok) throw new Error('http ' + r.status); const d = (await r.json())?.data; if (d?.mal_id !== id || !d.title) throw new Error('shape'); return fromJikan(d); }),
      timed(8000, async sig => { const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query: ALQ, variables: { id } }), signal: sig }); if (!r.ok) throw new Error('http ' + r.status);
        const m = (await r.json())?.data?.Media; if (!m) throw new Error('none'); return fromAniList(m, id); })]);
    const J = j.status === 'fulfilled' ? j.value : null, L = l.status === 'fulfilled' ? l.value : null; if (!J && !L) { LIVE.delete(id); return null; }
    const v = { a: { ...(J || L).a }, x: { ...(J || L).x } };
    if (L) { if (!v.a.img && L.iu) v.a.iu = L.iu; if (L.ac) v.a.ac = L.ac; if (L.bn) v.a.bn = L.bn; v.x.anilist = L.x.anilist; if (!v.x.en) v.x.en = L.x.en; if (L.a.ad) v.a.ad = 1;
      const pic = new Map(L.x.rel.map(r => [r.id, r])); v.x.rel = (J?.x.rel.length ? J.x.rel : L.x.rel).map(r => ({ ...pic.get(r.id), ...r })); }
    return v; })());
  return LIVE.get(id); }
// بطاقة ما أُضيف تأخذ مما عاد ما ينقصها (ولا يُمسّ سجلّه). تعود بـtrue إن تغيّر ما يُرى في القائمة
function fillPending(a, v) { let ch = 0; for (const k of ['img', 'iu', 'ac', 'bn', 'y', 'se', 'st', 'from', 'en', 'dur', 'sc', 'sv', 'g', 'studio', 'rating']) if (v.a[k] !== undefined && a[k] === undefined) { a[k] = v.a[k]; ch = 1; }
  if (!a.eps && v.a.eps) { a.eps = v.a.eps; ch = 1; } if (!a.type && v.a.type) { a.type = v.a.type; ch = 1; } return !!ch; }
const keepLive = (id, v) => { const m = addedMap(), e = m[id]; if (!e) return; let ch = 0; const set = (k, val) => { if (val && !e[k]) { e[k] = val; ch = 1; } };
  set('im', v.a.img); if (!v.a.img) set('iu', v.a.iu); set('y', v.a.y); set('n', v.a.eps); if (ch) store.set(ADDK, JSON.stringify(m)); };
const liveNote = (a, x) => x?.live ? (a.pending ? `<p class="lbl">أُضيف من ${MAL} ولم يدخل بياناتك بعد، فمعلوماته هنا من هناك مباشرة. حلقاته وأماكن عرضه في السعودية وموقعه من سلسلته تكتمل مع البناء القادم.</p>` : '')
  : `<p class="lbl" aria-live="polite">${x?.failed ? `تعذّر جلب معلوماته من ${MAL} الآن${a.pending ? '، وتكتمل مع البناء القادم' : '. أغلق البطاقة وافتحها بعد قليل'}.` : `تُجلب معلوماته من ${MAL}…`}</p>`;
const pkAddHTML = a => `<section class="sec mine pkadd" data-id="${a.id}"><h3>سجلّي</h3><p class="lbl">ليس في «أنمياتي». هذه بطاقة للاطلاع، ومعلوماته من ${MAL} مباشرة. ما تضيفه منها يدخل سجلّك وقائمتك الآن.</p>
  <div class="acts">${addBtns(a.id, 'add-live')}</div><div class="pk-pass" hidden><label class="pass-wrap">كلمة السر (كلمة سر «أضف لعبة» أو «أضف فيلماً»)<input class="add-pass" type="password" autocomplete="current-password"></label></div><p class="msg" aria-live="polite"></p></section>`;
// أقرباؤه ومنصاته كما يذكرها MyAnimeList: كل قريب يفتح بطاقته إن كان في «أنمياتي»، وإلا بطاقة اطلاع. والفلتر قائم: لا يظهر منها عمل +18
function liveMore(a, x) { const seen = new Set(), rel = (x.rel || []).filter(r => r.id !== a.id && !seen.has(r.id) && seen.add(r.id) && (D.by.has(r.id) || (!D.known.has(r.id) && !(r.ad && !isOpen())))), stream = x.stream || [];
  for (const r of rel) if (!D.by.has(r.id)) SEED.set(r.id, r);
  const item = r => { const b = D.by.get(r.id), img = b ? poster(b) && !hid(b) ? poster(b) : '' : r.iu && !r.ad ? r.iu : '', t = b ? title(b) : r.t;
    return `<button data-act="${b ? 'open' : 'peek'}" data-id="${r.id}" aria-label="${esc(r.k)}: ${esc(t)}">${b ? dot(r.id) : ''}${img ? `<img loading="lazy" alt="" src="${esc(img)}">` : `<span class="ph">${esc((t.match(/[A-Za-z0-9]/) || ['؟'])[0].toUpperCase())}</span>`}<small>${esc(r.k)}</small><span>${esc(t)}</span></button>`; };
  return (rel.length ? `<section class="sec"><h3>أقرباؤه</h3><p class="lbl">كما في ${MAL}. ما في «أنمياتي» يفتح بطاقته، وما ليس فيها بطاقة للاطلاع.</p><div class="strip rel">${rel.map(item).join('')}</div></section>` : '')
    + (stream.length ? `<section class="sec where"><h3>منصاته الرسمية</h3><div class="wl">${stream.map(s => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.n)}</a>`).join('')}</div><p class="lbl">كما يذكرها ${MAL}، وقد لا يكون كلها متاحاً في السعودية${a.pending ? '. أماكن عرضه في السعودية تظهر مع البناء القادم' : ''}.</p></section>` : ''); }
// بطاقة اطلاع: تُفتح فوراً بما يُعرف عن العمل (من نتيجة البحث أو من قريبه) وتمتلئ حين يعود MyAnimeList. فوق نافذة البحث أو فوق البطاقة التي فُتحت منها،
// وكل منها خطوة في السجل، فالرجوع يعيدك إلى ما كنت فيه. وما دخل «أنمياتي» تُفتح بطاقته هو
async function peekWork(id, push = true, seed = null) { if (D.by.has(id)) return openWork(id, push); if (!(id > 0) || D.known.has(id)) return;
  const d = $('#sheet'), body = $('#sheet-body'), s0 = seed?.id === id ? seed : null; if (s0?.ad && !isOpen()) return;
  open = 0; kept = null; pkOpen = id; d.classList.remove('themed'); delete body.dataset.full;
  const draw = (a, x) => { markEl(body, id, a.ad); body.innerHTML = sheetHTML(a, x); };
  const stub = { id, t: s0?.t || String(id), ...(s0?.en ? { en: s0.en } : {}), type: s0?.type || '', eps: s0?.eps || 0, ...(s0?.y ? { y: +s0.y } : {}), ...(/^\d+\/\d+$/.test(s0?.im || '') ? { img: s0.im } : s0?.iu ? { iu: s0.iu } : {}), ...(s0?.ad ? { ad: 1 } : {}), pk: 1 };
  draw(stub, null); const step = { ...(history.state?.p ? history.state : {}), a: id, pk: 1, w: $('#wsheet').open ? wopen : 0, add: $('#addd').open ? 1 : 0, p: 1, n: depth() + 1 };
  if (!d.open) { d.showModal(); body.scrollTo(0, 0); if (push) history.pushState(step, '', `#a${id}`); } else { body.scrollTo(0, 0); if (push) history.pushState(step, '', `#a${id}`); }
  const v = await liveOf(id); if (pkOpen !== id || !d.open) return;
  if (!v) return draw(stub, { failed: 1 });
  if (v.a.ad && !isOpen()) { pkOpen = 0; shut(d); toast('لا يُعرض هذا العمل الآن.'); return; }
  const top = body.scrollTop; draw({ ...v.a, pk: 1 }, { ...v.x, live: 1 }); body.scrollTop = top; }

// ---------- ورقة التوقيت: حلقات العمل. تفتح على الحلقة التالية وما حولها، و«كل الحلقات» تفتح الورقة كلها صفحةً صفحة.
// fit من البناء: 'odd' عدد الحلقات هنا أقل بقليل من عدد MyAnimeList (تنبيه)، و'loose' المصدر يعدّها عدّاً آخر، فلا يقابل رقمُ الخانة رقمَ الحلقة
// في سجله: تُعرض للقراءة بلا تعليم، ويبقى تقدّمه من عدّاد البطاقة
const X = { id: 0, list: null, tv: 0, fit: '', all: false, from: 1, open: 0, ask: 0, wave: null };
// ---------- «ترجمها لي»: طلب ترجمة نبذة عمل (about) أو حلقاته (eps). يصل المترجم عبر فرع requests في المستودع (دالة /api/anime-ask بكلمة سر «أضف لعبة»
// أو «أضف فيلماً»)، ولا يُرسل من السجل شيء: رقم العمل واسمه ونوع الطلب. لا مرور آلي للمترجم (قرار صاحب الموقع): الطلب ينتظر حتى يقول «ترجم الجديد»
const askedMap = () => { try { const m = JSON.parse(store.get(ASK) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
const askKey = (id, what) => `${id}:${what}`, unask = (id, what) => { const m = askedMap(); if (m[askKey(id, what)]) { delete m[askKey(id, what)]; store.set(ASK, JSON.stringify(m)); } };
const pass = () => store.get(PASS) || store.get('gamesg.pass') || store.get('filmsg.pass') || '';
const TRW = { about: ['ترجمها لي', 'نبذته'], eps: ['ترجم لي حلقاته', 'حلقاته'] };
const trBtn = what => `<button type="button" class="btn quiet" data-act="tr-ask">${ic('globe')}${TRW[what][0]}</button>`;
const trBox = (id, what) => askedMap()[askKey(id, what)] ? `<p class="tr-ok">${ic('check')}<span>وصل طلب ترجمة ${TRW[what][1]} وهو ينتظر. قل لـ${ltr('Claude')} «ترجم الجديد» فتُترجم، وتظهر هنا بالعربية.</span></p>` : trBtn(what);
const trHTML = (a, what) => `<div class="tr" data-id="${a.id}" data-what="${what}">${trBox(a.id, what)}</div>`;
async function askTr(btn) { const box = btn.closest('.tr'), id = +box.dataset.id, what = box.dataset.what, pw = box.querySelector('.tr-pass')?.value || pass(), label = btn.innerHTML;
  const field = msg => { if (!box.querySelector('.tr-pass')) box.innerHTML = `<label class="pass-wrap">كلمة السر (كلمة سر «أضف لعبة» أو «أضف فيلماً»)<input class="tr-pass" type="password" autocomplete="current-password"></label>${trBtn(what)}<p class="msg" aria-live="polite"></p>`;
    box.querySelector('.msg').textContent = msg; box.querySelector('.tr-pass').focus(); };
  if (!pw) { field(box.querySelector('.tr-pass') ? 'اكتب كلمة السر أولاً.' : ''); return; }
  btn.disabled = true; btn.textContent = 'يُرسل الطلب…';
  try { const r = await fetch('/api/anime-ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, mal: id, what, ...(D.by.get(id)?.ad ? { ad: 1 } : { title: D.by.get(id)?.t || '' }) }) }), j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.error === 'password') { store.del(PASS); throw Object.assign(new Error('كلمة السر غير صحيحة.'), { pw: true }); }
    if (r.status === 404 || r.status === 405) throw new Error(`طلب الترجمة يعمل من نسخة الموقع على ${ltr('Netlify')}، لا من هذه النسخة.`);
    if (!r.ok) throw new Error(j.error || 'تعذّر إرسال الطلب الآن. حاول بعد قليل.');
    store.set(PASS, pw); const m = askedMap(); m[askKey(id, what)] = Date.now(); store.set(ASK, JSON.stringify(m)); box.innerHTML = trBox(id, what);
  } catch (e) { btn.disabled = false; btn.innerHTML = label; if (e.pw) { field(e.message); box.querySelector('.tr-pass').value = ''; return; }
    let msg = box.querySelector('.msg'); if (!msg) { msg = Object.assign(document.createElement('p'), { className: 'msg' }); msg.setAttribute('aria-live', 'polite'); box.append(msg); }
    msg.innerHTML = e instanceof TypeError ? 'تعذّر الاتصال. تحقق من الشبكة ثم حاول.' : e.message; } }
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('.tr-pass')) { e.preventDefault(); e.target.closest('.tr').querySelector('[data-act=tr-ask]')?.click(); } });

// ---------- «أضف أنمي»: البحث في كل ما في «أنمياتي» (أعمالك وأقرباء سلاسلها)، وما ليس فيه ففي MyAnimeList (Jikan، من المتصفح بلا مفتاح).
// ما في «أنمياتي» يدخل سجلّك مباشرة. وما ليس فيه يُضاف رقمه إلى data/anime/list.json في المستودع (دالة /api/anime-add بكلمة سر «أضف لعبة»، بإيداع لا يعيد البناء)،
// ويدخل سجلّك وقائمتك من الآن ببطاقة مؤقتة مما عاد به البحث (localOf)، وتكتمل معلوماته مع البناء القادم. لا يُرسل من السجل شيء: رقم العمل واسمه ونوعه وعدد حلقاته.
// والفلتر مرفوع (isOpen): البحث في كل ما يظهر، وفي MyAnimeList بلا قيد، وما تصنيفه Rx مما يُضاف يُوسم ad في القائمة فلا يظهر والفلتر قائم
const ADD = { q: '', mal: null, malQ: '', busy: 0, via: '', msg: '', need: null, near: false, ar: null, arPass: null };   // ar: ما وجده TMDB بالاسم العربي، arPass: يُسأل عن كلمة السر له
const addedMap = () => { try { const m = JSON.parse(store.get(ADDK) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
// بطاقة مؤقتة لعمل أُضيف من MyAnimeList ولم يدخل الكتالوج بعد: مما حُفظ من نتيجة البحث (الاسم والنوع والحلقات والسنة والصورة)
const localOf = (id, m) => ({ id: +id, t: String(m.t || id), type: m.ty || '', eps: +m.n || 0, ...(m.y ? { y: +m.y } : {}), ...(/^\d+\/\d+$/.test(m.im || '') ? { img: m.im } : /^https:\/\/s\d*\.anilist\.co\//.test(m.iu || '') ? { iu: m.iu } : {}), ...(m.ad ? { ad: 1 } : {}), pending: 1, ord: 1e7 + +id });
// يُدخل عملاً في بيانات الصفحة: في all وknown دائماً، وفي ما يظهر إن لم يخفه الفلتر
function enroll(a) { if (D.known.has(a.id)) return; D.known.add(a.id); D.all.push(a); if (a.ad) D.adult.add(a.id); if (!hides(a)) { D.list.push(a); D.by.set(a.id, a); D.prep = D.prepAll = null; } }
// العين (site/adult.js) ترفع الفلتر أو تعيده في مكانها، بلا إعادة تحميل: list وby يُعاد بناؤهما من all، وكل ما بعدهما يُرسم من جديد
// السلاسل كما تُرى الآن (E73): أعمال +18 فيها كغيرها، والفلتر قائمٌ تُخفى هي وحدها، فسلسلة كلها +18 لا تظهر في قائمة ولا عدّاد ولا رابط،
// وسلسلة فيها بعضها تظهر بغيرها، واسمها من أول ما يُرى منها إن كان يحمله عمل +18. نسخ جديدة عند كل تبديل، فنموذج خطوطها (anime-pos) يُحسب بما يُرى
const seen = w => w.ids.filter(id => D.by.has(id)).length;
const worldName = t => String(t || '').replace(/\s*\((?:TV|\d{4})\)\s*$/i, '').replace(/\s*(?::|-)?\s*(?:Season\s*\d+|\d+(?:st|nd|rd|th)\s+Season|Part\s*\d+|First Season|S\d+)\s*$/i, '').trim() || String(t || '');   // كما في lib-anime
function worldsSync() { D.wby.clear(); D.worlds = [];
  for (const c of D.cw || []) { if (!c.ids.some(id => D.by.get(id)?.ord != null)) continue; const w = { ...c };
    if (!isOpen() && (D.adult.has(c.head ?? c.id) || D.adult.has(c.id))) { const f = D.by.get((c.story || c.ids).find(id => D.by.has(id))); w.name = worldName(f.t); w.en = f.en ? worldName(f.en) : undefined; }
    D.worlds.push(w); D.wby.set(w.id, w); } }
function relist() { D.list.length = 0; D.by.clear(); for (const a of D.all) if (!hides(a)) { D.list.push(a); D.by.set(a.id, a); } D.prep = D.prepAll = null; worldsSync(); }
function fillTypes() { const s = $('#type'), types = [...new Set(D.list.filter(a => a.ord != null).map(a => a.type).filter(Boolean))]; s.innerHTML = '<option value="">كل الأنواع</option>' + types.map(t => `<option value="${esc(t)}">${TYPE[t] || esc(t)}</option>`).join(''); s.value = types.includes(ui.type) ? ui.type : ''; ui.type = s.value; }
function toggleEye() { setOpen(!isOpen()); relist(); drawEye(); fillTypes(); if (hasLog() && ui.list !== 'all' && !inList(ui.list).length) ui.list = inList('watching').length ? 'watching' : 'all';
  renderAll(); toast(isOpen() ? 'رُفع الفلتر: تظهر الأعمال كلها.' : 'عاد الفلتر.'); }
const byFrom = (a, b) => (a.from || '9999') < (b.from || '9999') ? -1 : (a.from || '9999') > (b.from || '9999') ? 1 : a.id - b.id;
function addLocal(q) { const f = fold(q).trim(); if (!f) return [];
  const name = a => a.ht ||= fold(`${a.t} ${a.en || ''}`), rank = a => { const t = fold(a.t), e = fold(a.en || ''); return t === f || e === f ? 0 : t.startsWith(f) || e.startsWith(f) ? 1 : 2; };
  let hit = D.list.filter(a => name(a).includes(f) || arHit(a, q)); ADD.near = !hit.length;
  if (!hit.length) hit = find(D.prepAll ||= prepare(D.list, a => [a.t, a.en, ...(a.an || [])]), q, { limit: 8, min: 50 }).hits.map(h => D.by.get(h.id)).filter(Boolean);
  return hit.sort((a, b) => rank(a) - rank(b) || byFrom(a, b)).slice(0, 12); }
const metaOf = a => { const s = airOf(a); return (s ? [typeOf(a), s.label ? (/^\d{4}$/.test(s.label) ? 'يُعرض عام ' : 'يُعرض في ') + s.label : 'لم يُعلن موعده'] : [typeOf(a), a.y || '', a.type !== 'Movie' && a.eps ? nEps(a.eps) : a.st === 'airing' ? 'يُعرض الآن' : '']).filter(Boolean).join(' · '); };
const addBtns = (id, act) => `<button class="btn pri" data-act="${act}" data-id="${id}" data-s="plan">${ic('mark')}<span>سأشاهده</span></button><button class="btn ghost" data-act="${act}" data-id="${id}" data-s="watching">${ic('play')}<span>أشاهده الآن</span></button>`;
const LIC = Object.fromEntries(LISTS.map(l => [l[0], l[2]]));
function addRow(a) { const m = me(a.id);
  return `<li class="arow" data-id="${a.id}"${marks(a.id, a.ad)}><button class="aart${xc(a)}" data-act="open" data-id="${a.id}" aria-label="بطاقة ${esc(a.t)}">${art(a, '52px')}</button>
    <button class="ainfo" data-act="open" data-id="${a.id}"><b>${esc(title(a))}</b>${(h => h ? `<span class="aar" lang="ar">${esc(h)}</span>` : '')(arHit(a, ADD.q))}<span class="meta">${metaOf(a)}</span></button>
    <div class="aacts">${m ? `<span class="astate" data-l="${m.s}">${ic(LIC[m.s])}في «${LNAME[m.s]}»</span><button class="btn quiet" data-act="open" data-id="${a.id}">بطاقته</button>` : addBtns(a.id, 'add-to')}</div></li>`; }
function malRow(x) { const done = addedMap()[x.id], need = ADD.need?.id === x.id, ph = esc((x.t.match(/[A-Za-z0-9]/) || ['؟'])[0].toUpperCase()), go = `data-act="${D.by.has(x.id) ? 'open' : 'peek'}" data-id="${x.id}"`, name = ui.names === 'english' && x.en ? x.en : x.t;
  return `<li class="arow" data-mal="${x.id}"${marks(x.id, x.ad)}><button class="aart${x.img && x.ad && covered(x.id) ? ' x18' : ''}" ${go} aria-label="بطاقة ${esc(name)}">${x.img ? (i => x.ad && covered(x.id) ? cover(i) : i)(`<img loading="lazy" decoding="async" alt="" src="${esc(x.img)}">`) : `<span class="ph">${ph}</span>`}</button>
    <button class="ainfo" ${go}><b>${esc(name)}</b><span class="meta">${[x.type ? typeOf(x) : '', x.y || '', x.type !== 'Movie' && x.eps ? nEps(x.eps) : ''].filter(Boolean).join(' · ')}</span></button>
    <div class="aacts">${done ? `<span class="astate" data-l="${me(x.id)?.s || done.s}">${ic('check')}أُضيف إلى «${LNAME[me(x.id)?.s || done.s] || LNAME.plan}»</span>${D.by.has(x.id) ? `<button class="btn quiet" data-act="open" data-id="${x.id}">بطاقته</button>` : ''}` : addBtns(x.id, 'add-mal')}</div>
    ${need ? `<div class="apass"><label class="pass-wrap">كلمة السر (كلمة سر «أضف لعبة» أو «أضف فيلماً»)<input class="add-pass" type="password" autocomplete="current-password"></label><p class="msg" aria-live="polite">${ADD.need.msg || ''}</p></div>` : ''}</li>`; }
const HERE = '«أنمياتي»';
function addResHTML() { const q = ADD.q.trim(); if (!q) return `<p class="lbl">اكتب اسم العمل كما في ${ltr('MyAnimeList')} أو بالإنجليزية.</p>`;
  // ما أُضيف للتوّ من نتائج MyAnimeList يبقى في موضعه بينها بحالته (stay)، فلا يقفز الصف إلى أعلى النافذة تحت الإصبع
  const mal = ADD.malQ === q ? ADD.mal : null, am = addedMap(), stay = new Set((mal || []).filter(x => am[x.id] && D.by.get(x.id)?.pending).map(x => x.id));
  const loc = addLocal(q).filter(a => !stay.has(a.id)), shown = new Set(loc.map(a => a.id)), ar = isArQ(q), names = (ADD.ar || []).map(x => `<button type="button" class="lnk" data-act="add-as" data-q="${esc(x.en)}">${ltr(x.en)}</button>`).join('، ');
  const via = !mal || !ADD.via ? '' : ADD.via === 'ar' ? `<p class="lbl">${ltr('MyAnimeList')} لا يعرف الأسماء العربية، فبحثنا في ${ltr('TMDB')} فوجدنا: ${names}. وهذه نتائجها من ${ltr('AniList')} بأرقام أعمالها في ${ltr('MyAnimeList')}.</p>`
    : `<p class="lbl">${ADD.via === 'al0' ? `بحث ${ltr('MyAnimeList')} لم يجد شيئاً بهذا الاسم` : `${ltr('MyAnimeList')} لم يُجب الآن`}، فهذه النتائج من ${ltr('AniList')} بأرقام أعمالها في ${ltr('MyAnimeList')}.</p>`;
  const none = ADD.via === 'ar' ? (ADD.ar?.length ? `وجد ${ltr('TMDB')} بهذا الاسم: ${names}، ولم يجد ${ltr('AniList')} له شيئاً. اضغط الاسم تبحث به.` : `لم يجد ${ltr('TMDB')} أنمي بهذا الاسم العربي. اكتب اسمه بالإنجليزية أو اليابانية.`)
    : ADD.via === 'al' ? `${ltr('MyAnimeList')} لم يُجب الآن، و${ltr('AniList')} لم يجد شيئاً بهذا الاسم.` : 'لا نتيجة هناك بهذا الاسم.';
  const busy = { 2: `${ltr('MyAnimeList')} لم يُجب، فيُبحث في ${ltr('AniList')}…`, 3: `لا نتيجة في ${ltr('MyAnimeList')}، فيُبحث في ${ltr('AniList')}…`, 4: `يُبحث عن الاسم العربي في ${ltr('TMDB')}…`, 5: `وُجد في ${ltr('TMDB')}، فيُبحث عنه في ${ltr('MyAnimeList')}…` }[ADD.busy] || `يُبحث في ${ltr('MyAnimeList')}…`;
  const extra = mal ? mal.filter(x => D.by.has(x.id) && !shown.has(x.id) && !stay.has(x.id)).map(x => D.by.get(x.id)) : [], fresh = mal ? mal.filter(x => !D.by.has(x.id) || stay.has(x.id)) : [];
  // ما وُجد بالنطق وحده (لا بالاسم حرفياً) يقال إنه أقرب الأسماء نطقاً، فلا يُحسب العمل نفسه
  const near = ADD.near && loc.length ? `<p class="lbl">لا عمل في ${HERE} بهذا الاسم حرفياً${ar ? ' ولا باسمه العربي' : ''}. هذه أقرب الأسماء إليه نطقاً:</p>` : '';
  return `<h3 class="ah">في ${HERE}</h3>${loc.length + extra.length ? `${near}<ul class="ares">${[...loc, ...extra].map(addRow).join('')}</ul>` : `<p class="lbl">لا عمل في ${HERE} بهذا الاسم.</p>`}
    <h3 class="ah">في ${ltr('MyAnimeList')}</h3>${ADD.busy && ADD.malQ === q ? `<p class="lbl" aria-live="polite">${busy}</p>`
      : mal ? (fresh.length ? via + `<ul class="ares">${fresh.map(malRow).join('')}</ul><p class="lbl">اضغط اسم العمل أو غلافه تفتح بطاقته من ${ltr('MyAnimeList')}. وما تضيفه يدخل سجلّك وقائمتك الآن، وتكتمل حلقاته وأماكن عرضه مع البناء القادم.</p>` : (mal.length ? via : '') + `<p class="lbl">${mal.length ? `كل ما وُجد هناك في ${HERE} أعلاه.` : none}</p>`)
      : q.length < 2 ? `<p class="lbl">اكتب حرفين على الأقل.</p>` : ADD.arPass && ADD.malQ === q ? `<div class="apass arpass"><p class="lbl">${ltr('MyAnimeList')} لا يعرف الأسماء العربية، فيُبحث عنها في ${ltr('TMDB')} عبر الموقع بكلمة سر الإضافة، مرة واحدة ثم تُحفظ.</p>
        <label class="pass-wrap">كلمة السر (كلمة سر «أضف لعبة» أو «أضف فيلماً»)<input class="add-pass" type="password" autocomplete="current-password"></label><p class="msg" aria-live="polite">${ADD.arPass.msg || ''}</p><button type="button" class="btn ghost" data-act="ar-go">${ic('search')}<span>ابحث باسمه العربي</span></button></div>`
      : `${ADD.msg && ADD.malQ === q ? `<p class="msg" aria-live="polite">${ADD.msg}</p>` : ''}<button type="button" class="btn ghost" data-act="add-find">${ic('search')}<span>${ar ? `ابحث عن «${esc(q)}» باسمه العربي` : `ابحث في ${ltr('MyAnimeList')} عن «${esc(q)}»`}</span></button>`}`; }
// يُعاد رسم النتائج مع كل تعديل في السجل (وبالمزامنة)، وما كُتب في خانة كلمة السر يبقى
const drawAddRes = () => { const box = $('#add-res'); if (!box) return; const f = box.querySelector('.add-pass'), v = f?.value, foc = f && document.activeElement === f; box.innerHTML = addResHTML(); const g = box.querySelector('.add-pass'); if (g && v) g.value = v; if (g && foc) g.focus(); };
function openAdd() { ADD.need = null; $('#add-body').innerHTML = `<h2 id="add-h">أضف أنمي</h2><p class="lbl">ابحث في كل ما في «أنمياتي»: أعمالك وأقرباء سلاسلها. وما ليس هنا تجده في ${ltr('MyAnimeList')}.</p>
  <label class="search">${ic('search')}<span class="sr">اسم الأنمي</span><input id="add-q" type="search" placeholder="اسم الأنمي" autocomplete="off" enterkeyhint="search" value="${esc(ADD.q)}"></label><div id="add-res">${addResHTML()}</div>`;
  const d = $('#addd'); if (!d.open) { d.showModal(); history.pushState({ add: 1, p: 1, n: depth() + 1 }, '', '#add'); } const i = $('#add-q'); i.focus(); i.select(); }
// البحث عمّا ليس في «أنمياتي» من مصدرين: Jikan (واجهة MyAnimeList المفتوحة)، وإن تعطّل أو لم يُجب في 8 ثوانٍ فـAniList (يحمل رقم كل عمل في MyAnimeList).
// لكلٍّ مهلته، فلا يبقى البحث معلّقاً (E66)، والنافذة تقول أيهما يُسأل الآن ومن أيهما جاءت النتائج. والفلتر قائم: بلا أعمال +18 (sfw في Jikan، وisAdult:false
// في AniList). وحين يُرفع: كل ما يطابق، وأعمال +18 منه تُوسم ad. ولا يُطلب من Jikan بقيد rating=rx أبداً: ذلك الطلب يتأخر حتى ينقطع بلا جواب
const timed = (ms, run) => { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms); return run(ac.signal).finally(() => clearTimeout(t)); };
async function askJikan(q, lifted, signal) { const rx = x => /^Rx/.test(x.rating || '') || [...(x.genres || []), ...(x.explicit_genres || [])].some(g => g?.name === 'Hentai');
  const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=${lifted ? 25 : 12}${lifted ? '' : '&sfw=true'}`, { signal }); if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json(); if (!Array.isArray(j?.data)) throw new Error('shape');
  return j.data.filter(x => Number.isInteger(x?.mal_id) && x.title && (lifted || !rx(x))).slice(0, lifted ? 20 : 12)
    .map(x => ({ id: x.mal_id, t: x.title, en: x.title_english || '', type: x.type || '', eps: Number.isInteger(x.episodes) ? x.episodes : 0, y: x.year || x.aired?.prop?.from?.year || '', img: x.images?.webp?.small_image_url || x.images?.jpg?.small_image_url || '',
      im: (/\/images\/anime\/(\d+\/\d+)[a-z]?\.(?:jpe?g|webp)/.exec(x.images?.webp?.image_url || x.images?.jpg?.image_url || '') || [])[1] || '', ...(rx(x) ? { ad: 1 } : {}) })); }
const AL_TYPE = { TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' };
async function askAniList(q, lifted, signal) {
  const query = `query($q:String,$n:Int){Page(perPage:$n){media(search:$q,type:ANIME${lifted ? '' : ',isAdult:false'}){idMal title{romaji english} format episodes startDate{year} coverImage{medium} isAdult}}}`;
  const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables: { q, n: lifted ? 25 : 12 } }), signal }); if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json(), seen = new Set(); if (!Array.isArray(j?.data?.Page?.media)) throw new Error('shape');
  return j.data.Page.media.filter(x => Number.isInteger(x?.idMal) && x.title?.romaji && (lifted || !x.isAdult) && !seen.has(x.idMal) && seen.add(x.idMal)).slice(0, lifted ? 20 : 12).map(alRow); }
const alRow = x => ({ id: x.idMal, t: x.title.romaji, en: x.title.english || '', type: AL_TYPE[x.format] || '', eps: Number.isInteger(x.episodes) ? x.episodes : 0, y: x.startDate?.year || '', img: x.coverImage?.medium || '', im: '', ...(x.isAdult ? { ad: 1 } : {}) });
// بعدة أسماء معاً (ما وجده TMDB بالاسم العربي): صفحة لكل اسم في طلب واحد، والنتائج بترتيب الأسماء بلا تكرار
async function askAniListMany(names, lifted, signal) {
  const F = 'idMal title{romaji english} format episodes startDate{year} coverImage{medium} isAdult', query = `query(${names.map((_, i) => `$q${i}:String`).join(',')}){${names.map((_, i) => `p${i}:Page(perPage:10){media(search:$q${i},type:ANIME${lifted ? '' : ',isAdult:false'}){${F}}}`).join(' ')}}`;
  const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables: Object.fromEntries(names.map((n, i) => ['q' + i, n])) }), signal }); if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json(), seen = new Set(); if (!j?.data) throw new Error('shape');
  return names.flatMap((_, i) => j.data['p' + i]?.media || []).filter(x => Number.isInteger(x?.idMal) && x.title?.romaji && (lifted || !x.isAdult) && !seen.has(x.idMal) && seen.add(x.idMal)).slice(0, 20).map(alRow); }
// busy: 1 يُسأل Jikan، 2 لم يُجب فيُسأل AniList، 3 أجاب بلا نتيجة فيُسأل AniList (فهرس بحث Jikan يفوته أحياناً ما في MyAnimeList). via: النتائج من AniList: 'al' لأن Jikan لم يُجب، 'al0' لأنه لم يجد.
// وما كُتب في الخانة أثناء البحث لا يُفسد نتيجته: تُعرض لاسمها (malQ) وحده
async function findMal() { const q = ADD.q.trim(); if (q.length < 2 || (ADD.busy && ADD.malQ === q)) return; ADD.ar = null; ADD.arPass = null; if (isArQ(q)) return findAr(q); ADD.busy = 1; ADD.msg = ''; ADD.via = ''; ADD.malQ = q; ADD.mal = null; ADD.need = null; drawAddRes();
  const lifted = isOpen(); let list = null, via = '', msg = '';
  try { list = await timed(8000, s => askJikan(q, lifted, s)); } catch {}
  if (ADD.malQ !== q) return;
  if (!list?.length) { const none = !!list; ADD.busy = none ? 3 : 2; drawAddRes();
    try { const more = await timed(8000, s => askAniList(q, lifted, s)); if (more.length || !none) { list = more; via = none ? 'al0' : 'al'; } }
    catch { if (!none) msg = `لم يُجب ${ltr('MyAnimeList')} ولا ${ltr('AniList')} الآن. تحقق من الشبكة ثم ابحث ثانية.`; }
    if (ADD.malQ !== q) return; }
  ADD.busy = 0; ADD.mal = list; ADD.via = via; ADD.msg = msg; drawAddRes(); }
// الاسم العربي (E70): MyAnimeList وAniList لا يعرفانه، فيُسأل TMDB عبر دالة الإضافة (مفتاحه في الخادم، وبكلمة سرها) عن أعمال الأنمي بهذا الاسم، ثم يُبحث
// في AniList بأسمائها الإنجليزية عن أرقامها في MyAnimeList. typed: كلمة سر كُتبت للتو (تُحفظ إن صحّت)، وإلا فالمحفوظة، وإلا فتُسأل
async function findAr(q, typed = '') { const pw = typed || pass(), lifted = isOpen(); Object.assign(ADD, { msg: '', via: '', malQ: q, mal: null, need: null, ar: null, arPass: null });
  if (!pw) { ADD.arPass = { msg: '' }; drawAddRes(); $('#add-res .arpass .add-pass')?.focus(); return; }
  ADD.busy = 4; drawAddRes(); let items;
  try { const r = await timed(10000, signal => fetch('/api/anime-add', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, action: 'ar', q, ...(lifted ? { adult: 1 } : {}) }), signal }));
    const j = await r.json().catch(() => ({})); if (ADD.malQ !== q) return;
    if (r.status === 401) { ADD.busy = 0; ADD.arPass = { msg: typed ? 'كلمة السر غير صحيحة.' : '' }; if (!typed) store.del?.(PASS); drawAddRes(); $('#add-res .arpass .add-pass')?.focus(); return; }
    if (r.status === 404 || r.status === 405) throw new Error(`البحث بالاسم العربي يعمل من نسخة الموقع على ${ltr('Netlify')}، لا من هذه النسخة.`);
    if (!r.ok) throw new Error(j.error ? esc(j.error) : 'تعذّر البحث بالاسم العربي الآن. حاول بعد قليل.');
    if (typed) store.set(PASS, typed); items = Array.isArray(j.items) ? j.items.filter(x => x?.en) : []; }
  catch (e) { if (ADD.malQ !== q) return; ADD.busy = 0; ADD.msg = e.name === 'AbortError' ? 'لم يُجب البحث بالاسم العربي الآن. حاول بعد قليل.' : addFail(e); drawAddRes(); return; }
  ADD.ar = items; let list = items.length ? null : [];
  if (items.length) { ADD.busy = 5; drawAddRes();
    try { list = await timed(8000, s => askAniListMany([...new Set(items.slice(0, 3).map(x => x.en))], lifted, s)); } catch { ADD.msg = `وُجد في ${ltr('TMDB')} باسم ${ltr(items[0].en)}، ولم يُجب ${ltr('AniList')} الآن. حاول بعد قليل.`; }
    if (ADD.malQ !== q) return; }
  ADD.busy = 0; ADD.mal = list; ADD.via = list ? 'ar' : ''; drawAddRes(); }
// الإضافة: تُرسل رقم العمل واسمه ونوعه وحلقاته إلى /api/anime-add، ثم يدخل سجلّك وقائمتك ببطاقة مؤقتة (localOf) حتى يدخل الكتالوج. info: ما يُعرف عنه
// (من نتيجة البحث، أو من MyAnimeList مباشرة في بطاقة الاطلاع). ترمي خطأ رسالته للعرض، وخطأ كلمة السر يحمل pw
async function sendAdd(id, s, info, pw) {
  const r = await fetch('/api/anime-add', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, mal: id, title: info.t, type: info.type, eps: info.eps, ...(info.ad ? { ad: 1 } : {}) }) }), j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.error === 'password') { store.del(PASS); throw Object.assign(new Error('كلمة السر غير صحيحة.'), { pw: true }); }
  if (r.status === 404 || r.status === 405) throw new Error(`الإضافة تعمل من نسخة الموقع على ${ltr('Netlify')}، لا من هذه النسخة.`);
  if (!r.ok) throw new Error(j.error ? esc(j.error) : 'تعذّرت الإضافة الآن. حاول بعد قليل.');
  store.set(PASS, pw); const m = addedMap(); m[id] = { t: info.t, s, at: today, ty: info.type, n: info.eps, y: info.y, im: info.im, ...(!info.im && info.iu ? { iu: info.iu } : {}), ...(info.ad ? { ad: 1 } : {}) }; store.set(ADDK, JSON.stringify(m));
  enroll(localOf(id, m[id])); const v = LIVE.has(id) ? await LIVE.get(id) : null, a = D.by.get(id); if (v && a) fillPending(a, v);
  if (!P.a[id]) { P.a[id] = { s }; save(); } renderAll(true); drawAddRes(); toast(`${ltr(info.t)} في «${LNAME[s]}». تكتمل حلقاته وأماكن عرضه مع البناء القادم.`); }
const addFail = e => e instanceof TypeError ? 'تعذّر الاتصال. تحقق من الشبكة ثم حاول.' : e.message;
async function addMal(btn) { const row = btn.closest('.arow'), id = +row.dataset.mal, s = btn.dataset.s, x = ADD.mal?.find(m => m.id === id); if (!x || !LNAME[s]) return;
  const field = row.querySelector('.add-pass'), pw = field?.value || pass();
  if (!pw) { if (ADD.need?.id === id) ADD.need.msg = 'اكتب كلمة السر أولاً.'; else ADD.need = { id, msg: '' }; ADD.need.s = s; drawAddRes(); $(`.arow[data-mal="${id}"] .add-pass`)?.focus(); return; }
  for (const b of row.querySelectorAll('[data-act=add-mal]')) b.disabled = true; btn.querySelector('span').textContent = 'يُضاف…';
  try { await sendAdd(id, s, x, pw); ADD.need = null; drawAddRes(); }
  catch (e) { ADD.need = { id, s, msg: addFail(e) }; drawAddRes();
    const f = $(`.arow[data-mal="${id}"] .add-pass`); if (f) { if (e.pw) f.value = ''; else f.value = pw; f.focus(); } } }
// من بطاقة الاطلاع: بما عاد من MyAnimeList، ثم تصير البطاقة بطاقته في قائمتك (وخطوتها في السجل خطوة بطاقته)
async function addLive(btn) { const box = btn.closest('.pkadd'), id = +box.dataset.id, s = btn.dataset.s, v = LIVE.has(id) ? await LIVE.get(id) : null; if (!LNAME[s] || pkOpen !== id) return;
  const info = v ? { t: v.a.t, type: v.a.type, eps: v.a.eps, y: v.a.y, im: v.a.img, iu: v.a.iu, ad: v.a.ad } : SEED.get(id) || ADD.mal?.find(m => m.id === id); if (!info) return;
  const field = box.querySelector('.add-pass'), pw = field.value || pass(), msg = box.querySelector('.msg'); box.dataset.s = s;
  if (!pw) { box.querySelector('.pk-pass').hidden = false; msg.textContent = field.dataset.asked ? 'اكتب كلمة السر أولاً.' : ''; field.dataset.asked = 1; field.focus(); return; }
  const btns = [...box.querySelectorAll('[data-act=add-live]')], label = btn.innerHTML; for (const b of btns) b.disabled = true; btn.querySelector('span').textContent = 'يُضاف…'; msg.textContent = '';
  try { await sendAdd(id, s, info, pw); pkOpen = 0; if (history.state?.pk) history.replaceState({ ...history.state, pk: 0 }, '', `#a${id}`); openWork(id, false); }
  catch (e) { for (const b of btns) b.disabled = false; btn.innerHTML = label; box.querySelector('.pk-pass').hidden = false; msg.innerHTML = addFail(e); if (e.pw) field.value = ''; field.focus(); } }
let addT = 0; document.addEventListener('input', e => { if (e.target.id !== 'add-q') return; clearTimeout(addT); addT = setTimeout(() => { ADD.q = e.target.value; ADD.need = null; drawAddRes(); }, 140); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter') return;
  if (e.target.id === 'add-q') { e.preventDefault(); clearTimeout(addT); ADD.q = e.target.value; findMal(); }
  else if (e.target.matches?.('.add-pass')) { e.preventDefault(); const row = e.target.closest('.arow'), pk = e.target.closest('.pkadd');
    if (row) row.querySelector(`[data-act=add-mal][data-s="${ADD.need?.s || 'plan'}"]`)?.click(); else if (pk) pk.querySelector(`[data-act=add-live][data-s="${pk.dataset.s || 'plan'}"]`)?.click();
    else if (e.target.closest('.arpass')) arGo(); } });
const arGo = () => { const v = $('#add-res .arpass .add-pass')?.value || ''; if (!v) { ADD.arPass = { msg: 'اكتب كلمة السر أولاً.' }; drawAddRes(); $('#add-res .arpass .add-pass')?.focus(); return; } findAr(ADD.q.trim(), v); };

const pageOf = n => n <= 60 ? n : n <= 300 ? 25 : 50;
// ما لم يُعرض بعد: بتاريخه إن عُرف، وإلا فما بعد آخر حلقة عُرضت في عمل ما زال يُعرض
const lastAired = L => { let k = 0; for (const e of L) if (e.d && e.d <= today) k = e.n; return k; };
function xsHTML(a) { const L = X.list, tot = L.length, ro = X.fit === 'loose', p = ro ? 0 : Math.min(me(a.id)?.p || 0, tot), next = !ro && p < tot ? p + 1 : 0, size = pageOf(tot), aired = a.st === 'airing' ? lastAired(L) : tot;
  const fut = e => e.d ? e.d > today : e.n > aired;
  let rows; if (X.all) rows = L.slice(X.from - 1, X.from - 1 + size); else { const s = ro ? 1 : Math.max(1, Math.min(next || tot, tot) - 1); rows = L.slice(s - 1, s + 4); if (rows.length < 5) rows = L.slice(Math.max(0, tot - 5)); }
  const wave = X.wave; X.wave = null;
  const row = e => { const done = e.n <= p, nx = e.n === next, f = fut(e), on = X.open === e.n, k = wave && e.n >= wave[0] && e.n <= wave[1] ? Math.abs(e.n - wave[2]) : -1;
    const when = !e.d ? (f ? 'لم يُحدَّد موعدها' : '') : f ? `${daysTo(e.d) <= 0 ? 'تُعرض اليوم' : daysTo(e.d) === 1 ? 'تُعرض غداً' : 'تُعرض بعد ' + nDays(daysTo(e.d))}، ${dateAr(e.d)}` : dateAr(e.d);
    const ov = e.oa ? `<p class="ov">${esc(e.oa)}</p>` : e.ov ? `<span class="lbl">الملخص بالإنجليزية (الترجمة العربية قيد الإعداد)</span><p class="ov en">${esc(e.ov)}</p>` : '<p class="lbl">لا ملخص لهذه الحلقة في المصدر.</p>';
    return `<li class="xr${done ? ' done' : ''}${nx ? ' upnext' : ''}${f ? ' fut' : ''}${k >= 0 ? ' wave' : ''}" data-n="${e.n}"${k >= 0 ? ` style="--k:${Math.min(k, 14)}"` : ''}>
      <span class="xn"${e.n > 999 ? ' data-w="4"' : ''}>${e.n}</span>
      <button class="xb" data-act="ep-open" data-n="${e.n}" aria-expanded="${on}"><span class="xw"><span class="xt">${e.ta ? esc(e.ta) : e.t ? ltr(e.t) : `الحلقة ${num(e.n)}`}</span>${e.ta && e.t ? `<span class="xe">${esc(e.t)}</span>` : ''}
        <span class="xm">${[nx ? '<b>التالية</b>' : '', when && `<span>${when}</span>`, e.r ? `<span>${e.r} د</span>` : '', e.ra ? `<bdi dir="ltr">★ ${e.ra.toFixed(1)}</bdi>` : ''].filter(Boolean).join(' · ')}</span></span>
        ${e.st && !on ? `<img class="xi" loading="lazy" decoding="async" alt="" src="${D.base}w300${e.st}">` : ''}${ic('down')}</button>
      ${ro ? '' : f ? '<span></span>' : `<button class="xk" data-act="ep-tick" data-id="${a.id}" data-n="${e.n}" aria-pressed="${done}" aria-label="${done ? `الحلقة ${e.n}: شاهدتها. اضغط لتجعلها آخر ما شاهدت` : `شاهدت حتى الحلقة ${e.n}`}">${ic('check')}</button>`}
      ${X.ask === e.n ? `<div class="xask" role="group" aria-label="تأكيد"><p>ترجع إلى الحلقة ${num(e.n)}؟ يُلغى تعليم ${nEps(p - e.n)} بعدها.</p><div class="acts"><button class="btn pri" data-act="ep-back" data-id="${a.id}" data-n="${e.n}">نعم، ارجع إليها</button><button class="btn ghost" data-act="ep-keep">لا، أبقِها</button></div></div>` : ''}
      ${on ? `<div class="xd${e.st ? '' : ' bare'}">${e.st ? `<img loading="lazy" decoding="async" alt="" src="${D.base}w300${e.st}" srcset="${D.base}w300${e.st} 300w, ${D.base}original${e.st} 1280w" sizes="(max-width:560px) 92vw, 260px">` : ''}
        <div>${ov}<p class="lbl"><a href="https://www.themoviedb.org/tv/${X.tv}/season/${e.se}/episode/${e.ep}" target="_blank" rel="noopener">صفحة الحلقة في ${ltr('TMDB')}</a></p></div></div>` : ''}</li>`; };
  const pages = X.all && tot > size ? `<div class="xpages" role="group" aria-label="صفحات الحلقات">${Array.from({ length: Math.ceil(tot / size) }, (_, i) => { const f = i * size + 1, t = Math.min(tot, f + size - 1); return `<button data-act="ep-page" data-from="${f}" aria-pressed="${X.from === f}">${f}–${t}</button>`; }).join('')}</div>` : '';
  const untr = L.some(e => e.ov ? !e.oa : e.t && !e.ta); if (!untr) unask(a.id, 'eps');   // حلقة لها ملخص تُعدّ مترجمة بملخصها، وما لا ملخص لها فبعنوانها
  const count = !a.eps || tot === a.eps ? nEps(tot) : X.fit ? `${nEps(tot)} هنا، و${num(a.eps)} في ${ltr('MyAnimeList')}` : tot < a.eps ? `${nEps(tot)} من ${num(a.eps)}` : nEps(tot);
  const note = ro ? `عناوين الحلقات وملخصاتها وصورها من ${ltr('TMDB')}، وهو يعدّ حلقات هذا العمل عدّاً غير عدّ ${ltr('MyAnimeList')}، فلا يقابل رقمُ الحلقة هنا رقمَها في سجلك. الحلقات هنا للقراءة، وتقدّمك يُعلَّم من العدّاد أعلاه.`
    : `عناوين الحلقات وملخصاتها وصورها من ${ltr('TMDB')}. الخانة التي تضغطها تصير آخر ما شاهدت.${X.fit === 'odd' ? ` ما زاد في ${ltr('MyAnimeList')} حلقات خاصة أو ملخصات ليست في مواسم المصدر، فقد يختلف رقم الحلقة هنا عن رقمها هناك قليلاً.` : ''}`;
  return `<section class="sec xs" id="xs"><h3>الحلقات<small>${count}${p ? ` · شاهدت ${num(p)}` : ''}</small></h3>
    ${pages}<ol class="xsheet${ro ? ' ro' : ''}">${rows.map(row).join('')}</ol>
    <div class="acts">${X.all ? `<button class="btn quiet" data-act="ep-less">${ro ? 'أول الحلقات فقط' : next ? 'الحلقة التالية وما حولها فقط' : 'آخر الحلقات فقط'}</button>` : tot > rows.length ? `<button class="btn ghost" data-act="ep-all">كل الحلقات (${num(tot)})</button>` : ''}</div>
    <p class="lbl">${note}</p>${untr ? trHTML(a, 'eps') : ''}</section>`; }
const drawXs = a => { const b = $('#xs'); if (!b || X.id !== a.id || !X.list) return; b.outerHTML = xsHTML(a);
  const on = $('#xs .xpages [aria-pressed=true]'), bar = on?.parentNode; if (on) bar.scrollLeft += on.getBoundingClientRect().left + on.offsetWidth / 2 - (bar.getBoundingClientRect().left + bar.clientWidth / 2); };   // صفحة الحلقات الحالية في وسط شريطها
function showEps(a) { if (!$('#xs')) return; if (X.id === a.id && X.list) return drawXs(a);
  X.id = a.id; X.list = null; X.fit = ''; X.all = false; X.open = X.ask = 0; X.wave = null;
  const got = j => { if (X.id !== a.id) return; X.list = j.eps || []; X.tv = j.tv; X.fit = j.fit || ''; if (open === a.id) drawXs(a); };
  if (D.epc.has(a.id)) return got(D.epc.get(a.id));
  get(`eps/${a.id}.json`).then(j => { D.epc.set(a.id, j); if (D.epc.size > 24) D.epc.delete(D.epc.keys().next().value); got(j); })
    .catch(() => { if (X.id !== a.id) return; X.id = 0; const b = $('#xs'); if (b) { b.removeAttribute('aria-busy'); b.innerHTML = '<h3>الحلقات</h3><p class="lbl">تعذّر تحميل الحلقات. أغلق البطاقة وافتحها من جديد.</p>'; } }); }
// الخانة التي تُضغط تصير آخر ما شوهد: التالية تُعلَّم كزر «+» (بتاريخ البداية والإكمال)، والقفز إلى الأمام يعلّم ما بينهما، وآخر ما شوهد يُلغى،
// والرجوع إلى حلقة قديمة يُسأل عنه قبل أن يُلغى ما بعدها
function tickEp(id, n) { const a = D.by.get(id), p = me(id)?.p || 0; X.ask = 0;
  if (n === p) { X.wave = [n, n, n]; setProgress(id, n - 1); } else if (n === p + 1) { X.wave = [n, n, n]; bump(id, 1); }
  else if (n > p) { X.wave = [p + 1, n, p + 1]; setProgress(id, n); } else if (p - n <= 3) { X.wave = [n + 1, p, p]; setProgress(id, n); }
  else { X.ask = n; drawXs(a); } }

// ---------- السلاسل
const wArt = w => { const a = w.ids.map(id => D.by.get(id)).find(x => x?.bd && !(x.ad && covered(x.id))); return a ? `${D.base}w780${a.bd}` : ''; };
const wMine = w => w.ids.filter(id => D.by.has(id) && me(id)), wDone = w => w.ids.filter(id => D.by.has(id) && me(id)?.s === 'completed');
const isFate = w => /^Fate\//.test(w.name) || w.ids.some(id => /^Fate\//.test(D.by.get(id)?.t || ''));
// الأكثر حضوراً في قائمتك أولاً (ثم الأكبر، ثم بالاسم): سلاسلك الكبرى في أعلى الصفحة لا ما يبدأ اسمه بالألف
function worldsHTML() { const q = fold(ui.q || '').trim(), n = new Map(D.worlds.map(w => [w.id, w.ids.filter(id => D.by.has(id) && mine(D.by.get(id))).length]));
  const l = D.worlds.filter(w => !q || fold(w.name + ' ' + (w.en || '')).includes(q) || w.ids.some(id => D.by.has(id) && hay(D.by.get(id)).includes(q))).sort((a, b) => n.get(b.id) - n.get(a.id) || seen(b) - seen(a) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const fa = D.list.find(a => /^Fate\/stay night: Unlimited Blade Works/.test(a.t) && a.bd) || D.list.find(a => /^Fate\//.test(a.t) && a.bd);
  const fate = `<a class="wc fate" href="../fate/" data-fate>${fa ? `<img loading="lazy" alt="" src="${D.base}w780${fa.bd}">` : ''}<h3>${ltr('Fate')}</h3><p>دليل ${ltr('Fate')} الكامل: خطوط القصة كلها، ومن أين تبدأ، وبأي ترتيب تشاهد.</p></a>`;
  return (q && !/fate|فيت/i.test(ui.q) ? '' : fate) + l.map(w => { const n = seen(w), m = wMine(w).length, d = wDone(w).length, im = wArt(w);
    const th = themeOf(w, D.by, D.genres);
    return `<button class="wc" data-act="world" data-w="${w.id}" style="--wc1:${th.c1};--wbg:${th.bg};--wc2:${th.c2}">${im ? `<img loading="lazy" alt="" src="${im}">` : ''}<h3>${esc(ui.names === 'english' && w.en ? w.en : w.name)}</h3><p>${nWorks(n)} · في قائمتك ${num(m)} · أكملت ${num(d)}</p><i class="wbar" style="--p:${n ? d / n : 0}"></i></button>`; }).join('') || '<p class="none">لا سلسلة تطابق ما كتبت.</p>'; }
// مدة السلسلة كلها: مجموع حلقات كل عمل في مدة حلقته (والفيلم بطوله)
const span = min => { const h = Math.round(min / 60); return h >= 48 ? `${nDays(Math.floor(h / 24))}${h % 24 ? ` و${count(h % 24, ['ساعة', 'ساعتان', 'ساعات', 'ساعة', 'ساعة'])}` : ''}` : count(Math.max(1, h), ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة', 'ساعة']); };
// ---------- بوابة العالم (E57): وحدتها وتنسيقها يُحمَّلان حين تُفتح أول بوابة (site/anime-gate.js وanime-gate.css)، ونافذتها نافذة السلسلة (#wsheet) بسجلها
let GM = null;
const gateMod = () => GM ? Promise.resolve(GM) : Promise.all([import(`./anime-gate.js?v=${BUILD}`), new Promise(ok => { const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `../anime-gate.css?v=${BUILD}` }); l.onload = l.onerror = ok; document.head.append(l); })])
  .then(([m]) => { m.init({ D, ui, me, esc, ltr, num, nEps, nWorks, count, span, typeOf, ic, LNAME, poster, thumb, hid, marks, title, texts, art: wArt, isFate, calm, pos, air: airTag, model: w => model(w, D.by) }); return GM = m; });
async function openWorld(wid, push = true, from = null) { const w = D.wby.get(wid); if (!w) return; wopen = wid; const d = $('#wsheet'), fresh = !d.open, g = await gateMod(); if (wopen !== wid) return;
  if (fresh) g.resetView();
  const show = () => { if (wopen !== wid) return; d.className = 'gw'; d.style.cssText = g.themeStyle(w); d.querySelector('.gw-sky')?.remove(); d.insertAdjacentHTML('afterbegin', g.skyHTML(w));
    const body = $('#wsheet-body'); body.innerHTML = g.gateHTML(w); body.scrollTop = 0;
    if (!d.open) { d.showModal(); body.scrollTop = 0; d.classList.add('in'); if (push) history.pushState({ a: 0, w: wid, add: $('#addd').open ? 1 : 0, p: 1, n: depth() + 1 }, '', `#w${wid}`); }
    else if (push) history.replaceState(history.state?.p ? { ...history.state, a: 0, w: wid } : null, '', `#w${wid}`);
    // «عن هذا العالم» و«الحكاية» من نصوص العمل الذي يحمل العالم اسمه (يحدده البناء)، وإن غاب فأول عمل رئيسي فيه
    const all = w.ids.map(id => D.by.get(id)).filter(Boolean), head = D.by.get(w.head) || all.find(a => a.type === 'TV' || (a.eps || 1) > 3 || (a.type === 'Movie' && (a.dur || 0) >= 45)) || all[0];
    if (head) texts(head.id).then(x => { const box = $('#gw-about'); if (wopen === wid && box) box.innerHTML = g.aboutHTML(w, x, head); }); };
  if (fresh && from && !calm) g.portal(from, w, show); else show(); }
// ما يتغير في سجلك يتغير في البوابة المفتوحة: الواجهة (التقدم و«كمّل») والخط الزمني
function redrawGate() { const w = D.wby.get(wopen); if (!w || !GM || !$('#wsheet').open) return; const h = $('#wsheet-body .gw-hero'), tl = $('#wsheet-body .gw-tl'); if (h) h.outerHTML = GM.heroHTML(w); if (tl) tl.innerHTML = GM.lineHTML(w); }

// ---------- «قائمتي وحساباتي»: الاستيراد من ملف MyAnimeList، والربط بـSIMKL، ونسخة احتياطية
const IMP = { mal: null, msg: '', ok: false, simkl: null, sk: null };
const sumHTML = t => `<div class="sum">${[['الكل', t.all], ...LISTS.map(([k, n]) => [n, t[k]]), ['حلقة', t.episodes], ['تقييماً', t.scored]].map(([n, v]) => `<div><b>${num(v || 0)}</b><span>${n}</span></div>`).join('')}</div>`;
const sameCore = (m, o) => m.s === o.s && (m.p || 0) === (o.p || 0) && (!o.r || o.r === m.r);
function diff(entries, core) { let add = 0, change = 0, same = 0, unknown = 0; for (const e of entries) { const m = P.a[e.id], o = toMine(e); if (!o) continue; if (!D.known.has(e.id)) unknown++;
    if (!m) add++; else if (core ? sameCore(m, o) : JSON.stringify(sane(m)) === JSON.stringify(o)) same++; else change++; } return { add, change, same, unknown }; }
const toMine = e => sane({ s: e.status, p: e.watched, r: e.score, b: e.start, e: e.finish });
function impHTML() { const m = IMP.mal, log = hasLog(), n = Object.keys(P.a).length, tok = simklToken();
  const malBox = m ? (() => { const d = diff(m.entries), gone = log ? Object.keys(P.a).filter(id => !m.entries.some(e => e.id === +id)).length : 0;
      return `<p class="lbl">ملف ${ltr(m.user.name || 'MyAnimeList')}</p>${sumHTML(m.totals)}
      <p class="lbl">${log ? `مقارنةً بسجلّك هنا: ${num(d.add)} جديد، ${num(d.change)} تغيّر، ${num(d.same)} كما هو${gone ? `، و${num(gone)} في سجلّك وليس في الملف (يبقى)` : ''}.` : 'لا سجل على هذا الجهاز بعد: يدخل الملف كله.'}${d.unknown ? ` ${nWorks(d.unknown)} ليست في كتالوج الموقع بعد: تُحفظ في سجلّك، وتظهر بعد أن تُضاف إلى الكتالوج.` : ''}${m.skipped.length ? ` ${num(m.skipped.length)} سطراً بلا رقم أو حالة لم يُقرأ.` : ''}</p>
      <div class="acts"><button class="btn pri" data-act="imp-apply">${log ? 'حدّث سجلّي من الملف' : 'استورد سجلّي'}</button><button class="btn ghost" data-act="imp-clear">اختر ملفاً آخر</button></div>`; })()
    : `<ol><li>في ${ltr('MyAnimeList')}: القائمة ← ${ltr('Export')} ← ${ltr('Anime List')}. <a href="https://myanimelist.net/panel.php?go=export" target="_blank" rel="noopener">افتح صفحة التصدير</a></li><li>ينزل ملف اسمه ${ltr('animelist_….xml.gz')}. اختره هنا كما هو.</li></ol>
      <label class="drop" id="drop"><input class="sr" id="imp-file" type="file" accept=".gz,.xml,application/gzip,text/xml,application/xml"><b>اختر ملف التصدير</b><span>أو اسحبه إلى هنا. يُقرأ في متصفحك ولا يُرفع إلى أي مكان.</span></label>`;
  const sk = IMP.simkl ? `<p class="lbl">افتح صفحة ${ltr('SIMKL')} ووافق على الرمز، وهذه النافذة تكمل وحدها.</p><div class="sum"><div><b dir="ltr">${esc(IMP.simkl.user_code)}</b><span>رمز الربط</span></div></div>
      <div class="acts"><a class="btn pri" href="${esc(IMP.simkl.verification_uri_complete || IMP.simkl.verification_uri || 'https://simkl.com/pin')}" target="_blank" rel="noopener">افتح ${ltr('SIMKL')} للموافقة</a><button class="btn ghost" data-act="sk-cancel">ألغِ</button></div>`
    : IMP.sk ? (() => { const d = IMP.sk; return `${sumHTML(d.totals)}<p class="lbl">طوبق ${nWorks(d.matched)} من ${ltr('SIMKL')} بأعمال الموقع${d.unmatched ? `، وبقي ${nWorks(d.unmatched)} بلا رقم في ${ltr('MyAnimeList')} فلم يُطابَق` : ''}. مقارنةً بسجلّك هنا: ${num(d.diff.add)} جديد، ${num(d.diff.change)} يختلف، ${num(d.diff.same)} مطابق.${d.diff.unknown ? ` ${nWorks(d.diff.unknown)} ليست في كتالوج الموقع بعد: تُحفظ في سجلّك، وتظهر بعد أن تُضاف إلى الكتالوج.` : ''}</p>
      <div class="acts"><button class="btn pri" data-act="sk-apply" data-how="ahead">ادمج: الأبعد تقدّماً يغلب</button><button class="btn ghost" data-act="sk-apply" data-how="simkl">اعتمد ${ltr('SIMKL')} عند الاختلاف</button><button class="btn ghost" data-act="sk-apply" data-how="new">أضف الجديد فقط</button></div>
      <p class="lbl">«الأبعد تقدّماً»: لكل عمل يختلف تؤخذ الحالة والحلقات ممن شاهد أكثر، ويبقى تقييمك وتاريخاك إن وُجدت، وما تركته يبقى متروكاً ما لم تزد حلقاته. قبل أي دمج تُحفظ نسخة من سجلّك للتراجع.</p>
      <p class="lbl">عدد الحلقات لا يتجاوز حلقات العمل هنا (${ltr('SIMKL')} يجمع أحياناً أجزاء في مدخل واحد).${d.bulk ? ` وأيام نقل القائمة إلى ${ltr('SIMKL')} (${count(d.bulk, ['يوم واحد', 'يومان', 'أيام', 'يوماً', 'يوم'])}: أعمال كثيرة عُلّمت دفعة واحدة) لا تُحسب تواريخ مشاهدة.` : ''}</p>
      <div class="acts"><button class="btn quiet" data-act="sk-raw">نزّل ما أرسله ${ltr('SIMKL')} كاملاً (فيه تاريخ كل حلقة)</button></div>`; })()
    : tok ? `<p class="lbl">حسابك في ${ltr('SIMKL')} مربوط على هذا الجهاز.</p><div class="acts"><button class="btn pri" data-act="sk-pull">اسحب سجلّي من ${ltr('SIMKL')}</button><button class="btn quiet" data-act="sk-forget">افصل الحساب</button></div>`
    : `<p class="lbl">يسحب حالة كل عمل وحلقاته وتقييمه من حسابك، للقراءة فقط: الموقع لا يغيّر شيئاً في حسابك هناك. تضغط الزر، يظهر رمز، توافق عليه في صفحة ${ltr('SIMKL')}. رمز الدخول يبقى في هذا المتصفح فقط.</p><div class="acts"><button class="btn pri" data-act="sk-start">اربط ${ltr('SIMKL')}</button></div>`;
  return `<h2 id="imp-h">قائمتي وحساباتي</h2>
    <section class="sec"><h3>${ltr('MyAnimeList')}</h3>${malBox}</section>
    <section class="sec"><h3>${ltr('SIMKL')}</h3>${sk}</section>
    ${IMP.msg ? `<p class="msg${IMP.ok ? ' ok' : ''}" role="alert">${IMP.msg}</p>` : ''}
    <section class="sec"><h3>نسخة من سجلّي</h3><p class="lbl">${log ? `في سجلّك ${nWorks(n)}.` : 'سجلّك فارغ على هذا الجهاز.'} النسخة ملف ${ltr('JSON')} فيه حالاتك وحلقاتك وتقييماتك وتواريخك.</p>
      <div class="acts"><button class="btn ghost" data-act="backup" ${log ? '' : 'disabled'}>نزّل نسخة</button>${store.get(KEY + '.bak') ? '<button class="btn quiet" data-act="restore">تراجع عن آخر استيراد</button>' : ''}</div></section>`; }
function drawImp() { $('#imp-body').innerHTML = impHTML(); }
function openImport() { IMP.msg = ''; drawImp(); const d = $('#imp'); if (!d.open) { d.showModal(); history.pushState({ imp: 1, p: 1, n: depth() + 1 }, '', '#import'); } }
async function readFile(f) { if (!f) return; IMP.msg = ''; try { IMP.mal = await readMalFile(f); if (!IMP.mal.entries.length) { IMP.mal = null; IMP.msg = 'الملف سليم لكنه بلا أعمال.'; } }
  catch (e) { IMP.mal = null; IMP.ok = false; IMP.msg = esc(e.message || 'تعذّرت قراءة الملف.'); } drawImp(); }
// كل استيراد يحفظ قبله نسخة من السجل (animeg.progress.bak) يُرجع إليها بزر «تراجع عن آخر استيراد»
function applyEntries(list, how) { store.set(KEY + '.bak', JSON.stringify(P)); const r = { n: 0, added: 0, moved: 0, filled: 0 };
  for (const e of list) { const o = toMine(e), m = P.a[e.id]; if (!o) continue; r.n++;
    if (!m) { P.a[e.id] = o; r.added++; continue; } if (how === 'new') continue;
    if (how === 'ahead') { const go = simklAhead(m, o); if (go) { m.s = o.s; if (o.p) m.p = o.p; r.moved++; } let got = 0; for (const k of ['r', 'b', 'e']) if (!m[k] && o[k]) { m[k] = o[k]; got = 1; } if (got && !go) r.filled++; continue; }
    const was = JSON.stringify(m); P.a[e.id] = how === 'simkl' ? { ...o, ...(o.r ? {} : m.r ? { r: m.r } : {}), ...(o.b ? {} : m.b ? { b: m.b } : {}), ...(o.e ? {} : m.e ? { e: m.e } : {}) } : o; if (JSON.stringify(P.a[e.id]) !== was) r.moved++; }
  save(); renderAll(); return r; }

// ---------- الأحداث
document.addEventListener('click', async e => { const t = e.target.closest('[data-act]'); if (!t) return; const d = t.dataset, id = +d.id;
  switch (d.act) {
    case 'open': openWork(id); break;
    case 'peek': peekWork(id, true, ADD.mal?.find(m => m.id === id) || SEED.get(id)); break;
    case 'add-live': addLive(t); break;
    case 'plus': bump(id, 1); break;
    case 'minus': bump(id, -1); break;
    case 'status': setStatus(id, d.s); break;
    case 'score': setScore(id, +d.r); break;
    case 'remove': removeEntry(id); break;
    case 'undo': { const f = undo; undo = null; $('#toast').classList.remove('on'); f?.(); break; }
    case 'ep-tick': tickEp(id, +d.n); break;
    case 'tr-ask': askTr(t); break;
    case 'ep-back': { const n = +d.n; X.ask = 0; X.wave = [n + 1, me(id)?.p || n, me(id)?.p || n]; setProgress(id, n); break; }
    case 'ep-keep': X.ask = 0; drawXs(D.by.get(open)); break;
    case 'ep-open': X.open = X.open === +d.n ? 0 : +d.n; drawXs(D.by.get(open)); break;
    case 'ep-all': { const a = D.by.get(open), tot = X.list.length, size = pageOf(tot), at = X.fit === 'loose' ? 1 : Math.min(tot, (me(open)?.p || 0) + 1); X.all = true; X.from = Math.floor((at - 1) / size) * size + 1; drawXs(a); break; }
    case 'ep-less': X.all = false; drawXs(D.by.get(open)); $('#xs')?.scrollIntoView({ block: 'nearest' }); break;
    case 'ep-page': X.from = +d.from; X.open = 0; drawXs(D.by.get(open)); $('#xs')?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }); break;
    case 'list': ui.list = d.l; keep(); if (ui.view !== 'list') setView('list'); renderLists(); renderGrid(); if (t.closest('.rail')) $('.bar').scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); break;
    case 'view': setView(d.v); break;
    case 'genre': ui.genre = +d.g === ui.genre ? -1 : +d.g; renderGrid(); break;
    case 'amood': { const g = +d.g; amoods = g < 0 ? [] : amoods.includes(g) ? amoods.filter(x => x !== g) : [...amoods, g]; store.set('anime.mood', amoods.join()); renderTonight(true); break; }
    case 'treroll': renderTonight(true); break;
    case 'genre-go': showGenre(+d.g); break;
    case 'world': if ($('#sheet').open && $('#wsheet').open && wopen === +d.w) shut($('#sheet')); else { stash(); openWorld(+d.w, true, t.closest('.wc') || t); } break;   // سلسلته هي المفتوحة تحته: إغلاق البطاقة يكشفها
    case 'gw-order': case 'gw-line': { const w = D.wby.get(wopen), sec = $('#gw-line'); if (!w || !GM || !sec) break; if (d.act === 'gw-order') GM.setView('order', d.o); else GM.setView('line', +d.l);
      const y = $('#wsheet-body').scrollTop; sec.outerHTML = GM.timelineHTML(w); $('#wsheet-body').scrollTop = y; break; }
    case 'close': shut(t.closest('dialog')); break;
    case 'import': openImport(); break;
    case 'add': openAdd(); break;
    case 'room': toggleEye(); break;                                             // العين: ترفع الفلتر أو تعيده (site/adult.js)
    case 'room-show': setShowing(!showing()); drawEye(); renderAll(true); if (open) openWork(open, false); else if (pkOpen) peekWork(pkOpen, false); break;   // أغلفة أعمال +18 كلها: تُكشف أو تُغطى
    case 'bare': uncover(id); renderAll(true); if (open === id) openWork(id, false); else if (pkOpen === id) peekWork(id, false); break;                          // صورة هذا العمل وحده
    case 'add-to': setStatus(id, d.s); drawAddRes(); break;
    case 'add-find': findMal(); break;
    case 'ar-go': arGo(); break;
    case 'add-as': { const f = $('#add-q'); ADD.q = t.dataset.q || ''; if (f) f.value = ADD.q; findMal(); break; }
    case 'add-mal': addMal(t); break;
    case 'imp-clear': IMP.mal = null; IMP.msg = ''; drawImp(); break;
    case 'imp-apply': { const { n } = applyEntries(IMP.mal.entries, 'file'); IMP.ok = true; IMP.msg = `دخل سجلّك: ${nWorks(n)}. المزامنة تنقله إلى بقية أجهزتك.`; IMP.mal = null; ui.list = inList('watching').length ? 'watching' : 'all'; renderAll(); drawImp(); break; }
    case 'backup': { const u = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), source: 'أنمياتي', ...P }, null, 1)], { type: 'application/json' })); Object.assign(document.createElement('a'), { href: u, download: `anime-log-${today}.json` }).click(); setTimeout(() => URL.revokeObjectURL(u), 4000); break; }
    case 'restore': { const b = store.get(KEY + '.bak'); if (!b) break; const now = JSON.stringify(P); store.set(KEY, b); store.set(KEY + '.bak', now); load(); save(); renderAll(); IMP.ok = true; IMP.msg = 'رجع سجلّك كما كان قبل آخر استيراد.'; drawImp(); break; }
    case 'sk-start': await skStart(); break;
    case 'sk-cancel': IMP.simkl = null; IMP.msg = ''; drawImp(); break;
    case 'sk-pull': await skPull(); break;
    case 'sk-raw': { const u = URL.createObjectURL(new Blob([JSON.stringify(IMP.sk.raw, null, 1)], { type: 'application/json' })); Object.assign(document.createElement('a'), { href: u, download: `simkl-anime-${today}.json` }).click(); setTimeout(() => URL.revokeObjectURL(u), 4000); break; }
    case 'sk-forget': simklForget(); IMP.sk = null; IMP.ok = true; IMP.msg = 'فُصل الحساب عن هذا الجهاز.'; drawImp(); break;
    case 'sk-apply': { const r = applyEntries(IMP.sk.entries, d.how), inWorks = n => count(n, ['عمل واحد', 'عملين', 'أعمال', 'عملاً', 'عمل']);
      const did = [r.added && `أُضيف ${nWorks(r.added)}`, r.moved && `${d.how === 'ahead' ? 'تقدّم' : 'تغيّر'} ${nWorks(r.moved)}`, r.filled && `استُكمل تاريخ أو تقييم في ${inWorks(r.filled)}`].filter(Boolean);
      IMP.ok = true; IMP.msg = did.length ? `دُمج سجل ${ltr('SIMKL')}: ${did.join('، و')}. الباقي كما هو.` : `سجلّك يطابق ما في ${ltr('SIMKL')}: لم يتغير شيء.`; IMP.sk = null; drawImp(); break; }
  } });
// ---------- SIMKL: الربط بالرمز ثم السحب. كل طلب من المتصفح مباشرة (site/anime-simkl.js)
async function skStart() { IMP.msg = ''; try { const s = IMP.simkl = await simklStart(); drawImp();
    const ok = await simklPoll(s, () => IMP.simkl === s); if (IMP.simkl !== s) return; IMP.simkl = null; if (!ok) { IMP.ok = false; IMP.msg = 'انتهت مهلة الرمز قبل الموافقة. اضغط «اربط» من جديد.'; drawImp(); return; } await skPull(); }
  catch (e) { IMP.simkl = null; IMP.ok = false; IMP.msg = esc(e.message || 'تعذّر الاتصال بـSIMKL.'); drawImp(); } }
async function skPull() { IMP.ok = false; IMP.msg = `يُسحب سجلّك من ${ltr('SIMKL')}…`; drawImp();
  try { const r = await simklPull(D.all); IMP.sk = { ...r, diff: diff(r.entries, true) }; IMP.msg = ''; } catch (e) { IMP.msg = esc(e.message || 'تعذّر السحب من SIMKL.'); } drawImp(); }
document.addEventListener('change', e => { const t = e.target;
  if (t.id === 'sort') { ui.sort = t.value; keep(); renderGrid(); } else if (t.id === 'type') { ui.type = t.value; renderGrid(); }
  else if (t.id === 'names') { ui.names = t.value; keep(); renderAll(); if (open) openWork(open, false); else if (pkOpen) peekWork(pkOpen, false); }
  else if (t.id === 'imp-file') readFile(t.files[0]);
  else if (t.id === 'ep-n') setProgress(+t.dataset.id, parseInt(t.value, 10) || 0);
  else if (t.type === 'date' && t.dataset.k) setDate(+t.dataset.id, t.dataset.k, t.value); });
let qT = 0; $('#q').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => { ui.q = e.target.value; if (ui.view === 'worlds') $('#worlds').innerHTML = worldsHTML(); renderGrid(); }, 140); });
document.addEventListener('dragover', e => { const z = e.target.closest?.('#drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => e.target.closest?.('#drop')?.classList.remove('over'));
document.addEventListener('drop', e => { const z = e.target.closest?.('#drop'); if (z) { e.preventDefault(); z.classList.remove('over'); readFile(e.dataTransfer.files[0]); } });
// الرجوع (زر المتصفح أو إيماءة الجوال) يغلق النافذة المفتوحة، وEsc مثله
for (const d of $$('dialog')) { d.addEventListener('cancel', e => { e.preventDefault(); shut(d); });
  d.addEventListener('close', () => { if (d.open) return; if (d.id === 'sheet') { open = 0; pkOpen = 0; } if (d.id === 'wsheet') { wopen = 0; d.classList.remove('in'); } if (d.id === 'imp') IMP.simkl = null; });   // ما أُغلق وأُعيد فتحه في اللحظة نفسها مفتوح
  d.addEventListener('click', e => { if (e.target === d) shut(d); }); }
addEventListener('popstate', () => { apply(at()); if (leaving && !history.state?.p) { const f = leaving; leaving = null; f(); } });
// عمق النوافذ في السجل: كل نافذة يفتحها الموقع خطوة عليه (n). والخروج من النوافذ كلها إلى الصفحة يرجع بعددها فلا يبقى في السجل ما يعيد فتحها
const depth = () => history.state?.n || 0;
let leaving = null;
function leaveTo(fn) { const k = depth(); if (k) { leaving = fn; history.go(-k); return; }
  for (const id of ['#sheet', '#wsheet', '#addd', '#imp']) if ($(id).open) $(id).close(); if (location.hash) history.replaceState(null, '', location.pathname + location.search); fn(); }
// تصنيف من بطاقة عمل: يخرج إلى «أنمياتي» ويفرز قائمتك كلها بذلك التصنيف
function showGenre(g) { leaveTo(() => { ui.genre = g; ui.list = hasLog() ? 'all' : ui.list; ui.type = ''; $('#type').value = ''; ui.q = ''; $('#q').value = ''; if (ui.view !== 'list') setView('list'); renderLists(); renderGrid();
  requestAnimationFrame(() => $('#count').scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })); }); }

// ---------- الإقلاع
const liftVeil = () => { const v = $('#veil'); if (!v || v.hidden) return; requestAnimationFrame(() => requestAnimationFrame(() => { v.classList.add('lift'); setTimeout(() => v.remove(), calm ? 0 : 800); })); };
function route() { const h = location.hash.slice(1), st = at(); if (st.a || st.w) { if (st.w && !st.a && D.wby.has(+st.w)) setView('worlds'); apply(st); } else if (h === 'worlds') setView('worlds'); else if (h === 'import') { history.replaceState(null, '', location.pathname); openImport(); } else if (h === 'add') { history.replaceState(null, '', location.pathname); openAdd(); } }
try {
  const [cat, epi] = await Promise.all([get('catalog.json'), get('eps/index.json').catch(() => ({}))]); D.eps = epi || {}; D.base = cat.imageBase || D.base; D.mal = cat.malImages || D.mal; D.prov = cat.providers || {}; D.genres = cat.genres || [];
  for (const a of cat.anime || []) enroll(a);   // أعمال +18 (ad) تدخل all وحده حتى يُرفع الفلتر
  // ما أُضيف من MyAnimeList ولم يدخل الكتالوج بعد يبقى ببطاقته المؤقتة، ويُنسى ما دخل الكتالوج أو مضى عليه شهر
  { const m = addedMap(); let ch = 0; for (const k of Object.keys(m)) if (D.known.has(+k) || !(Date.parse(today) - Date.parse(m[k]?.at) < 30 * 864e5)) { delete m[k]; ch = 1; } else enroll(localOf(k, m[k])); if (ch) store.set(ADDK, JSON.stringify(m));
    for (const k of Object.keys(m)) { const a = D.by.get(+k); if (a?.pending && !a.img && !a.iu) liveOf(a.id).then(v => { if (v && fillPending(a, v)) { keepLive(a.id, v); renderAll(true); } }); } }
  D.cw = cat.worlds || []; worldsSync();
  fillTypes();
  $('#sort').value = ui.sort; $('#names').value = ui.names; if (!LNAME[ui.list] && ui.list !== 'all') ui.list = 'watching'; if (hasLog() && ui.list !== 'all' && !inList(ui.list).length) ui.list = inList('watching').length ? 'watching' : 'all';
  placeChips(); renderAll(); liftVeil();
  { const bar = $('.bar'), g = bar.querySelector('.gate'); new IntersectionObserver(([e]) => { const on = !e.isIntersecting; bar.classList.toggle('docked', on); g.tabIndex = on ? 0 : -1; g.setAttribute('aria-hidden', String(!on)); dockEye(on); }).observe($('.top')); }
  initSync(id => { if (id !== 'anime') return; load(); renderAll(true); if (open) { const box = $('#sheet-body .mine'); if (box) box.outerHTML = mineHTML(D.by.get(open)); drawXs(D.by.get(open)); } });
  route();
} catch (err) { $('#grid').innerHTML = '<p class="load">تعذّر تحميل القائمة. حدّث الصفحة.</p>'; liftVeil(); console.error(err); }
