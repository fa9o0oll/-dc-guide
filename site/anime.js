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
import { readMalFile } from './anime-mal.js?v=__BUILD__';
import { simklStart, simklPoll, simklPull, simklToken, simklForget, simklAhead } from './anime-simkl.js?v=__BUILD__';
import './zoom.js?v=__BUILD__';
const BUILD = '__BUILD__', KEY = 'animeg.progress', UI = 'anime.ui', ASK = 'animeg.asked', PASS = 'animeg.pass';
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
// تصنيفات MyAnimeList وفئاتها العمرية ومصادر القصة بالعربية. ما لا مقابل له هنا يُعرض باسمه هناك
const GENRE = { Action: 'أكشن', Adventure: 'مغامرات', Comedy: 'كوميديا', Drama: 'دراما', Fantasy: 'فانتازيا', Horror: 'رعب', Mystery: 'غموض', Romance: 'رومانسي', 'Sci-Fi': 'خيال علمي', 'Slice of Life': 'شريحة من الحياة', Sports: 'رياضة', Supernatural: 'خوارق', Suspense: 'تشويق',
  'Award Winning': 'حائز جوائز', 'Avant Garde': 'طليعي', Gourmet: 'طعام', Ecchi: 'إيتشي', Shounen: 'شونين', Seinen: 'سينين', Shoujo: 'شوجو', Josei: 'جوسي', Kids: 'للأطفال', School: 'مدرسي', 'Adult Cast': 'أبطال بالغون', 'Super Power': 'قوى خارقة', Historical: 'تاريخي',
  Psychological: 'نفسي', Gore: 'دموي', Military: 'عسكري', Isekai: 'إيسيكاي', Mecha: 'ميكا', 'Urban Fantasy': 'فانتازيا حضرية', Mythology: 'أساطير', 'Martial Arts': 'فنون قتالية', Parody: 'محاكاة ساخرة', 'Team Sports': 'رياضات جماعية', Samurai: 'ساموراي', 'Gag Humor': 'فكاهة هزلية',
  Harem: 'حريم', 'Reverse Harem': 'حريم معكوس', Space: 'فضاء', Reincarnation: 'إعادة تجسّد', Vampire: 'مصاصو دماء', 'Organized Crime': 'جريمة منظمة', Music: 'موسيقى', 'Time Travel': 'سفر عبر الزمن', Survival: 'نجاة', Detective: 'تحرٍّ', Iyashikei: 'إياشيكي', 'Love Polygon': 'مضلّع حب',
  'Love Status Quo': 'حب معلَّق', Anthropomorphic: 'حيوانات بصفات بشرية', 'Video Game': 'ألعاب فيديو', CGDCT: 'فتيات لطيفات', 'Strategy Game': 'ألعاب استراتيجية', 'High Stakes Game': 'ألعاب مصيرية', Workplace: 'بيئة العمل', 'Otaku Culture': 'ثقافة الأوتاكو', 'Mahou Shoujo': 'فتيات ساحرات',
  Childcare: 'رعاية أطفال', Delinquents: 'جانحون', 'Combat Sports': 'رياضات قتالية', 'Performing Arts': 'فنون أدائية', Racing: 'سباقات', Medical: 'طبي', 'Visual Arts': 'فنون بصرية', Showbiz: 'عالم الفن', 'Idols (Female)': 'آيدول (فتيات)', 'Idols (Male)': 'آيدول (فتيان)', Educational: 'تعليمي', Villainess: 'الشريرة', Pets: 'حيوانات أليفة' };
const genreOf = n => GENRE[n] || ltr(n);
const SOURCE = { Original: 'أصلي', Manga: 'مانغا', 'Web Manga': 'مانغا ويب', '4 Koma Manga': 'مانغا يونكوما', 'Light Novel': 'رواية خفيفة', Novel: 'رواية', 'Web Novel': 'رواية ويب', 'Visual Novel': 'رواية مرئية', Game: 'لعبة', 'Card Game': 'لعبة ورق', 'Mixed Media': 'وسائط متعددة', Book: 'كتاب', 'Picture Book': 'كتاب مصور', Music: 'موسيقى', Radio: 'إذاعة' };
const RATING = { G: 'لكل الأعمار', PG: 'للأطفال', 'PG-13': '+13', R: '+17', 'R+': '+17' };
const SCORE = ['', 'مروّع', 'فظيع', 'سيئ جداً', 'سيئ', 'متوسط', 'لا بأس به', 'جيد', 'جيد جداً', 'عظيم', 'تحفة'];
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const SPRITE = `<svg hidden aria-hidden="true"><defs>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" stroke-width="1.6" d="M8.5 6v12l10-6z"/></symbol><symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></symbol>
<symbol id="i-drop" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><path d="M6.8 6.8l10.4 10.4"/></symbol><symbol id="i-mark" viewBox="0 0 24 24"><path d="M7 4.5h10v15l-5-3.5-5 3.5z"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></symbol><symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.7 2.5 2.7 13.5 0 16M12 4c-2.7 2.5-2.7 13.5 0 16"/></symbol><symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></symbol><symbol id="i-in" viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></symbol><symbol id="i-ext" viewBox="0 0 24 24"><path d="M8 16l8-8M9.5 8H16v6.5"/></symbol>
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
const D = { list: [], by: new Map(), worlds: [], wby: new Map(), prov: {}, genres: [], base: 'https://image.tmdb.org/t/p/', mal: 'https://cdn.myanimelist.net/images/anime/', texts: new Map(), found: null, eps: {}, epc: new Map() };
const ui = { list: 'watching', view: 'list', q: '', sort: 'mal', type: '', shown: 60, names: 'romaji' };
try { const u = JSON.parse(store.get(UI) || '{}'); for (const k of ['list', 'sort', 'names']) if (typeof u[k] === 'string') ui[k] = u[k]; } catch {}
const keep = () => store.set(UI, JSON.stringify({ list: ui.list, sort: ui.sort, names: ui.names }));
const get = async f => { const r = await fetch(`data/${f}?v=${BUILD}`); if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); };
const title = a => ui.names === 'english' && a.en ? a.en : a.t;
const poster = (a, big) => a.img ? `${D.mal}${a.img}${big ? 'l' : ''}.webp` : a.tp ? `${D.base}${big ? 'w500' : 'w342'}${a.tp}` : '';
const srcset = a => a.img ? `${D.mal}${a.img}.webp 225w, ${D.mal}${a.img}l.webp 425w` : a.tp ? `${D.base}w185${a.tp} 185w, ${D.base}w342${a.tp} 342w, ${D.base}w500${a.tp} 500w` : '';
const art = (a, sizes, eager) => poster(a) ? `<img ${eager ? '' : 'loading="lazy" '}decoding="async" alt="" src="${esc(poster(a))}" srcset="${esc(srcset(a))}" sizes="${sizes}">` : `<span class="ph">${esc((a.t.match(/[A-Za-z0-9]/) || ['؟'])[0].toUpperCase())}</span>`;
// صور MyAnimeList كلها بصيغة webp، وإن تعذّرت واحدة فنسختها jpg
document.addEventListener('error', e => { const i = e.target; if (i.tagName === 'IMG' && /cdn\.myanimelist\.net/.test(i.src) && /\.webp$/.test(i.src) && !i.dataset.jpg) { i.dataset.jpg = 1; i.removeAttribute('srcset'); i.src = i.src.replace(/\.webp$/, '.jpg'); } }, true);
// في قائمتي: ما له سجل. وقبل الاستيراد على هذا الجهاز تُعرض القائمة العامة كلها بلا سجل
const mine = a => hasLog() ? !!P.a[a.id] : a.ord != null;
const inList = l => D.list.filter(a => P.a[a.id]?.s === l);
const daysTo = d => Math.ceil((Date.parse(d) - Date.parse(today)) / 864e5);

// ---------- الصفحة
document.body.insertAdjacentHTML('beforeend', `${SPRITE}
<section class="sky" id="sky"><div class="sky-art" aria-hidden="true"><i></i><i></i><b></b></div>
  <header class="top"><a class="home" href="../" aria-label="العودة إلى البوابات">${miniDoor}<span>البوابات</span></a><h1>أنمياتي</h1>
    <button class="btn ghost" data-act="import">${ic('in')}<span>قائمتي وحساباتي</span></button></header>
  <p class="tally" id="tally"></p><div id="now"></div>
  <svg class="sky-line" viewBox="0 0 1200 96" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 96V70l60-3 40 4 70-9 50 6 90-4 60 5 80-8 70 6 110-5 60 4 90-7 70 6 120-4 80 5 150-6v36z"/>
    <g fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"><path d="M0 34q150 26 300 2t300 0 300 2 300-4"/><path d="M0 44q150 24 300 2t300 0 300 2 300-4"/><path d="M0 26q150 22 300 0"/></g>
    <g fill="currentColor"><path d="M297 14h6v70h-6zM282 22h36v3h-36zM286 34h28v3h-28zM597 18h6v62h-6zM584 26h32v3h-32zM897 12h6v72h-6zM880 20h40v3h-40zM886 32h28v3h-28z"/></g></svg></section>
<nav class="bar" aria-label="البحث والقوائم"><div class="row"><a class="gate" href="../" aria-label="العودة إلى البوابات" aria-hidden="true" tabindex="-1"><span class="gate-em">${miniDoor}</span><span class="gate-t">البوابات</span></a>
  <label class="search">${ic('search')}<span class="sr">ابحث في أنمياتي</span><input id="q" type="search" placeholder="ابحث: أنمي، استوديو، سنة" autocomplete="off" enterkeyhint="search"></label>
  <div class="views" role="group" aria-label="طريقة العرض"><button data-act="view" data-v="list" aria-pressed="true">الأعمال</button><button data-act="view" data-v="worlds" aria-pressed="false">السلاسل</button></div></div>
  <div class="lists" id="lists" role="group" aria-label="قوائمي"></div>
  <div class="tools" id="tools"><select id="sort" aria-label="الترتيب"><option value="mal">ترتيب قائمتي</option><option value="score">تقييمي، الأعلى أولاً</option><option value="pub">تقييم MyAnimeList</option><option value="new">الأحدث صدوراً</option><option value="old">الأقدم صدوراً</option><option value="prog">الأقرب إلى الإكمال</option></select>
    <select id="type" aria-label="النوع"><option value="">كل الأنواع</option></select>
    <select id="names" class="names" aria-label="لغة الأسماء"><option value="romaji">الأسماء كما في MyAnimeList</option><option value="english">الأسماء بالإنجليزية</option></select></div></nav>
<p class="count" id="count" aria-live="polite"></p>
<main><div class="grid" id="grid"><p class="load">تُحمَّل القائمة…</p></div><div class="worlds" id="worlds" hidden></div></main>
<footer class="foot"><p>معلومات الأنمي وصوره وتقييماته من <a href="https://myanimelist.net/" target="_blank" rel="noopener">${ltr('MyAnimeList')}</a>، والبوسترات العالية الدقة والخلفيات من <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">${ltr('TMDB')}</a>، وبيانات أماكن العرض من <a href="https://www.justwatch.com/" target="_blank" rel="noopener">${ltr('JustWatch')}</a>، ومطابقة الأرقام بين المواقع من ${ltr('Fribb/anime-lists')}. ${ltr('This product uses the TMDB API but is not endorsed or certified by TMDB.')}</p>
  <p><button class="syncb" data-sync-open><span data-sync-label></span></button></p></footer>
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
function celHTML(a, where, i = 0) { const m = me(a.id), s = m?.s, live = s === 'watching' || s === 'hold', next = a.nx && live && a.nx.date >= today ? daysTo(a.nx.date) : null;
  const sizes = where === 'rail' ? '(max-width:560px) 150px, 206px' : '(max-width:560px) 46vw, 190px';
  const meta = [typeOf(a), a.y || '', s === 'completed' && m.e ? `أكملته ${m.e.slice(0, 4)}` : a.type !== 'Movie' && a.eps ? nEps(a.eps) : a.st === 'airing' ? 'يُعرض الآن' : a.st === 'soon' ? 'لم يُعرض بعد' : ''].filter(Boolean).join(' · ');
  return `<article class="cel${a.x && !m ? ' out' : ''}" data-id="${a.id}" style="--i:${i}">
    <button class="cel-art" data-act="open" data-id="${a.id}" aria-label="بطاقة ${esc(a.t)}">${art(a, sizes, where === 'rail' && i < 6)}
      ${where !== 'rail' && ui.list === 'all' && ui.view === 'list' ? flag(s) : ''}${m?.r ? `<span class="stamp${m.r === 10 ? ' top10' : ''}" title="تقييمك ${m.r} من 10">${m.r}</span>` : ''}
      ${next != null ? `<span class="next">الحلقة ${a.nx.ep} ${next <= 0 ? 'اليوم' : next === 1 ? 'غداً' : 'بعد ' + nDays(next)}</span>` : ''}</button>
    <h3>${esc(title(a))}</h3><p class="meta">${meta}</p>${live ? progHTML(a, m) : ''}</article>`; }

// ---------- السماء: أرقامك، ثم ما تشاهده الآن
function tallyHTML() { const all = Object.entries(P.a); if (!all.length) return '';
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
function renderSky() { $('#tally').innerHTML = tallyHTML(); $('#now').innerHTML = nowHTML(); }

// ---------- القوائم والشبكة
function renderLists() { const n = l => inList(l).length, log = hasLog();
  $('#lists').innerHTML = (log ? LISTS.map(([k, name]) => `<button data-act="list" data-l="${k}" aria-pressed="${ui.list === k}">${name} <b>${num(n(k))}</b></button>`).join('') : '')
    + `<button data-act="list" data-l="all" aria-pressed="${ui.list === 'all' || !log}">الكل <b>${num(D.list.filter(mine).length)}</b></button>`; }
const hay = a => a.h ||= fold(`${a.t} ${a.en || ''} ${a.studio || ''} ${a.y || ''}`);
function visible() { const log = hasLog(), list = log ? ui.list : 'all'; let l = D.list.filter(a => list === 'all' ? mine(a) : P.a[a.id]?.s === list);
  if (ui.type) l = l.filter(a => a.type === ui.type);
  D.found = null; const q = fold(ui.q || '').trim();
  if (q) { const hit = l.filter(a => hay(a).includes(q)); if (hit.length) l = hit; else { const r = find(D.prep ||= prepare(D.list.filter(mine), a => [a.t, a.en]), ui.q, { limit: 12, min: 50 }); const ids = new Set(r.hits.map(h => h.id)); l = l.filter(a => ids.has(a.id)); D.found = r.meant?.name || null; } }
  const sc = a => me(a.id)?.r || 0, ratio = a => { const m = me(a.id); return a.eps && m?.p ? m.p / a.eps : 0; }, ord = (a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || a.id - b.id;
  const S = { mal: ord, score: (a, b) => sc(b) - sc(a) || ord(a, b), pub: (a, b) => (b.sc || 0) - (a.sc || 0) || ord(a, b), new: (a, b) => (b.from || '0') < (a.from || '0') ? -1 : (b.from || '0') > (a.from || '0') ? 1 : ord(a, b),
    old: (a, b) => (a.from || '9') < (b.from || '9') ? -1 : (a.from || '9') > (b.from || '9') ? 1 : ord(a, b), prog: (a, b) => ratio(b) - ratio(a) || ord(a, b) };
  return l.sort(S[ui.sort] || ord); }
let cur = [];
function renderGrid(keepShown) { cur = visible(); if (!keepShown) ui.shown = 60; const g = $('#grid'), log = hasLog();
  $('#count').innerHTML = !D.list.length ? '' : ui.view === 'worlds' ? `${count(D.worlds.length, ['سلسلة واحدة', 'سلسلتان', 'سلاسل', 'سلسلة', 'سلسلة'])} فيها أعمال من قائمتك، الأكثر حضوراً فيها أولاً` : `${nWorks(cur.length)}${ui.q ? ` تطابق «${esc(ui.q)}»` : ''}${D.found ? `، هل تقصد ${ltr(D.found)}؟` : ''}${log ? '' : ' · بلا سجل على هذا الجهاز'}`;
  g.innerHTML = cur.length ? cur.slice(0, ui.shown).map((a, i) => celHTML(a, 'grid', i)).join('') + (cur.length > ui.shown ? '<i class="more" id="more"></i>' : '')
    : `<p class="none">${ui.q ? 'لا عمل في هذه القائمة يطابق ما كتبت.' : log ? 'هذه القائمة فارغة.' : 'تُحمَّل القائمة…'}</p>`;
  const more = $('#more'); if (more) moreIO.observe(more); }
const moreIO = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; moreIO.disconnect(); const from = ui.shown; ui.shown += 60; const more = $('#more'); if (!more) return;
  more.insertAdjacentHTML('beforebegin', cur.slice(from, ui.shown).map((a, i) => celHTML(a, 'grid', i)).join('')); if (cur.length > ui.shown) moreIO.observe(more); else more.remove(); }, { rootMargin: '900px' });
function setView(v) { ui.view = v; $$('.views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  $('#grid').hidden = v !== 'list'; $('#worlds').hidden = v !== 'worlds'; $('#lists').hidden = $('#tools').hidden = v !== 'list'; if (v === 'worlds') $('#worlds').innerHTML = worldsHTML(); renderGrid(); }
function renderAll(keepShown) { renderSky(); renderLists(); if (ui.view === 'worlds') $('#worlds').innerHTML = worldsHTML(); renderGrid(keepShown); }

// ---------- تعديل السجل. كل تعديل يُحفظ ويُزامَن فوراً، ومعه «تراجع»
function commit(id, before, say) { const m = P.a[id]; if (m) { if (!m.p) delete m.p; if (!m.r) delete m.r; if (!m.b) delete m.b; if (!m.e) delete m.e; if (!m.s) delete P.a[id]; }
  save(); const moved = (before?.s || '') !== (P.a[id]?.s || ''); redraw(id, moved);
  if (say) toast(say, () => { if (before) P.a[id] = before; else delete P.a[id]; save(); redraw(id, true); }); }
// ما تغيّر مكانه (دخل قائمة أو خرج منها) يُعاد رسم الصفحة له، وما تغيّر تقدّمه فقط يُحدَّث سِله في مكانه
function redraw(id, moved) { const a = D.by.get(id); if (moved) renderAll(true); else { renderLists(); $('#tally').innerHTML = tallyHTML();
    for (const c of $$(`.cel[data-id="${id}"]`)) { const rail = !!c.closest('.rail'), t = document.createElement('template'); t.innerHTML = celHTML(a, rail ? 'rail' : 'grid', +c.style.getPropertyValue('--i') || 0); const n = t.content.firstElementChild; n.style.animation = 'none'; c.replaceWith(n); } }
  if (open === id) { const box = $('#sheet-body .mine'); if (box) box.outerHTML = mineHTML(a); drawXs(a); }
  if (wopen && D.wby.get(wopen)?.ids.includes(id)) { const o = $('#wsheet-body .order'); if (o) o.innerHTML = orderHTML(D.wby.get(wopen)); } }
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
let open = 0, wopen = 0;
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
function whereHTML(a) { if (a.pv === undefined || a.st === 'soon') return ''; const p = a.pv, link = p?.link || `https://www.themoviedb.org/${a.tm.k}/${a.tm.id}/watch?locale=SA`;
  const rows = p ? PROV.map(([k, t]) => { const ids = (p[k] || []).filter(id => D.prov[id]); return ids.length ? `<div class="wrow"><b>${t}</b><span class="wl">${ids.map(id => `<a href="${esc(link)}" target="_blank" rel="noopener">${D.prov[id].logo ? `<img loading="lazy" width="32" height="32" alt="" src="${D.base}w92${D.prov[id].logo}">` : ''}${ltr(D.prov[id].name)}</a>`).join('')}</span></div>` : ''; }).join('') : '';
  return `<section class="sec where"><h3>أين تشاهده في السعودية</h3>${rows ? rows + `<p class="lbl">الأزرار تفتح صفحة أماكن العرض على ${ltr('TMDB')}، ومنها إلى المنصة. البيانات من ${ltr('JustWatch')} وتتحدث يومياً${a.tm.k === 'tv' && a.tm.s == null ? '' : a.tm.k === 'tv' ? '، وهي للمسلسل كله لا لهذا الموسم وحده' : ''}.</p>`
    : `<p class="lbl">لا تذكر بيانات ${ltr('JustWatch')} منصة تعرضه في السعودية حالياً.</p>`}</section>`; }
const dot = id => { const s = me(id)?.s; return s ? `<i class="dot" data-l="${s}"></i>` : ''; };
function worldStrip(a) { const w = D.wby.get(a.w); if (!w) return ''; const order = w.story || w.ids, at = order.indexOf(a.id) + 1;
  return `<section class="sec"><h3>من سلسلة ${ltr(w.name)}</h3><p class="lbl">العمل ${at} من ${order.length} بترتيب ${w.story ? 'القصة' : 'الصدور'}</p>
    <div class="strip">${order.map(id => D.by.get(id)).filter(Boolean).map(x => `<button data-act="open" data-id="${x.id}" aria-current="${x.id === a.id}" aria-label="${esc(x.t)}">${dot(x.id)}${poster(x) ? `<img loading="lazy" alt="" src="${esc(poster(x))}">` : `<span class="ph">${esc(x.t[0])}</span>`}<span>${esc(title(x))}</span></button>`).join('')}</div>
    <div class="acts"><button class="btn ghost" data-act="world" data-w="${w.id}">افتح السلسلة بترتيبها</button></div></section>`; }
function sheetHTML(a, x) { if (x?.ar) unask(a.id, 'about'); const big = a.tp ? `${D.base}w780${a.tp}` : poster(a, true), facts = [[typeOf(a)], a.type !== 'Movie' && a.eps ? [nEps(a.eps)] : a.eps === 0 && a.st === 'airing' ? ['مستمر'] : null, a.dur ? [`${a.dur} دقيقة${a.type === 'Movie' ? '' : ' للحلقة'}`] : null,
    a.se && a.y ? [`${SEASON[a.se]} ${a.y}`] : a.y ? [a.y] : null, a.st === 'airing' ? ['يُعرض الآن'] : a.st === 'soon' ? ['لم يُعرض بعد'] : null, a.studio ? [ltr(a.studio)] : null, x?.source ? [`المصدر: ${SOURCE[x.source] || ltr(x.source)}`] : null, a.rating ? [/^\+/.test(RATING[a.rating] || a.rating) ? ltr(RATING[a.rating] || a.rating) : RATING[a.rating] || ltr(a.rating)] : null].filter(Boolean);
  const alt = [a.en && a.en !== a.t ? a.en : '', ui.names === 'english' && a.en ? a.t : '', x?.jp || ''].filter(Boolean);
  const links = [['MyAnimeList', `https://myanimelist.net/anime/${a.id}`], a.sk ? ['SIMKL', `https://simkl.com/anime/${a.sk}`] : null, x?.anilist ? ['AniList', `https://anilist.co/anime/${x.anilist}`] : null, a.tm ? ['TMDB', `https://www.themoviedb.org/${a.tm.k}/${a.tm.id}`] : null].filter(Boolean);
  return `<div class="hero">${a.bd ? `<img decoding="async" alt="" src="${D.base}w1280${a.bd}">` : ''}</div>
  <div class="body"><div class="head"><button class="cel-art" ${poster(a) ? `data-zoom="${esc(big)}" data-zoom-title="${esc(a.t)}"` : 'disabled'} aria-label="تكبير بوستر ${esc(a.t)}">${art(a, '170px', true)}</button>
    <div><h2>${esc(title(a))}</h2>${alt.map(t => `<p class="alt">${esc(t)}</p>`).join('')}
      <div class="facts">${facts.map(f => `<span>${f[0]}</span>`).join('')}${a.sc ? `<span class="mal">${ltr('MyAnimeList')} <b>${a.sc.toFixed(2)}</b></span>${a.sv ? `<span>${num(a.sv)} تقييماً</span>` : ''}` : ''}</div></div></div>
    ${mineHTML(a)}
    ${D.eps[a.id] ? `<section class="sec xs" id="xs" aria-busy="true"><h3>الحلقات</h3><p class="lbl">تُحمَّل الحلقات…</p></section>` : ''}
    ${a.pending ? '<p class="lbl">معلومات هذا العمل تُجلب في البناء القادم.</p>' : x?.ar ? `<section class="sec"><h3>القصة</h3><p class="ov">${esc(x.ar)}</p></section>` : x?.en ? `<section class="sec"><h3>القصة</h3><span class="lbl">النبذة بالإنجليزية من ${ltr('MyAnimeList')}، ولم تُترجم بعد.</span><p class="ov en">${esc(x.en)}</p>${trHTML(a, 'about')}</section>` : ''}
    ${(a.g || []).length ? `<div class="facts">${a.g.map(i => `<span>${genreOf(D.genres[i])}</span>`).join('')}</div>` : ''}
    ${whereHTML(a)}${worldStrip(a)}
    <section class="sec"><h3>صفحاته</h3><div class="links">${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}${ic('ext')}</a>`).join('')}</div></section></div>`; }
async function openWork(id, push = true) { const a = D.by.get(id); if (!a) return; open = id; const d = $('#sheet'), body = $('#sheet-body'); body.innerHTML = sheetHTML(a, null); body.scrollTop = 0; showEps(a);
  if (!d.open) { d.showModal(); if (push) history.pushState({ a: id }, '', `#a${id}`); } else history.replaceState({ a: id }, '', `#a${id}`);
  const x = await texts(id); if (open === id && x) { const top = body.scrollTop; body.innerHTML = sheetHTML(a, x); body.scrollTop = top; showEps(a); } }

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
  try { const r = await fetch('/api/anime-ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw, mal: id, what, title: D.by.get(id)?.t || '' }) }), j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.error === 'password') { store.del(PASS); throw Object.assign(new Error('كلمة السر غير صحيحة.'), { pw: true }); }
    if (r.status === 404 || r.status === 405) throw new Error(`طلب الترجمة يعمل من نسخة الموقع على ${ltr('Netlify')}، لا من هذه النسخة.`);
    if (!r.ok) throw new Error(j.error || 'تعذّر إرسال الطلب الآن. حاول بعد قليل.');
    store.set(PASS, pw); const m = askedMap(); m[askKey(id, what)] = Date.now(); store.set(ASK, JSON.stringify(m)); box.innerHTML = trBox(id, what);
  } catch (e) { btn.disabled = false; btn.innerHTML = label; if (e.pw) { field(e.message); box.querySelector('.tr-pass').value = ''; return; }
    let msg = box.querySelector('.msg'); if (!msg) { msg = Object.assign(document.createElement('p'), { className: 'msg' }); msg.setAttribute('aria-live', 'polite'); box.append(msg); }
    msg.innerHTML = e instanceof TypeError ? 'تعذّر الاتصال. تحقق من الشبكة ثم حاول.' : e.message; } }
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('.tr-pass')) { e.preventDefault(); e.target.closest('.tr').querySelector('[data-act=tr-ask]')?.click(); } });

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
const wArt = w => { const a = w.ids.map(id => D.by.get(id)).find(x => x?.bd); return a ? `${D.base}w780${a.bd}` : ''; };
const wMine = w => w.ids.filter(id => me(id)), wDone = w => w.ids.filter(id => me(id)?.s === 'completed');
const isFate = w => /^Fate\//.test(w.name) || w.ids.some(id => /^Fate\//.test(D.by.get(id)?.t || ''));
// الأكثر حضوراً في قائمتك أولاً (ثم الأكبر، ثم بالاسم): سلاسلك الكبرى في أعلى الصفحة لا ما يبدأ اسمه بالألف
function worldsHTML() { const q = fold(ui.q || '').trim(), n = new Map(D.worlds.map(w => [w.id, w.ids.filter(id => mine(D.by.get(id))).length]));
  const l = D.worlds.filter(w => !q || fold(w.name + ' ' + (w.en || '')).includes(q) || w.ids.some(id => hay(D.by.get(id)).includes(q))).sort((a, b) => n.get(b.id) - n.get(a.id) || b.ids.length - a.ids.length || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const fa = D.list.find(a => /^Fate\/stay night: Unlimited Blade Works/.test(a.t) && a.bd) || D.list.find(a => /^Fate\//.test(a.t) && a.bd);
  const fate = `<a class="wc fate" href="../fate/" data-fate>${fa ? `<img loading="lazy" alt="" src="${D.base}w780${fa.bd}">` : ''}<h3>${ltr('Fate')}</h3><p>دليل ${ltr('Fate')} الكامل: خطوط القصة كلها، ومن أين تبدأ، وبأي ترتيب تشاهد.</p></a>`;
  return (q && !/fate|فيت/i.test(ui.q) ? '' : fate) + l.map(w => { const n = w.ids.length, m = wMine(w).length, d = wDone(w).length, im = wArt(w);
    return `<button class="wc" data-act="world" data-w="${w.id}">${im ? `<img loading="lazy" alt="" src="${im}">` : ''}<h3>${esc(ui.names === 'english' && w.en ? w.en : w.name)}</h3><p>${nWorks(n)} · في قائمتك ${num(m)} · أكملت ${num(d)}</p><i class="wbar" style="--p:${n ? d / n : 0}"></i></button>`; }).join('') || '<p class="none">لا سلسلة تطابق ما كتبت.</p>'; }
// للسلسلة ترتيبان حين يختلفان: ترتيب القصة (الافتراضي) وترتيب الصدور
const orderOf = w => (ui.worder !== 'release' && w.story) || w.ids;
function orderHTML(w) { return orderOf(w).map(id => D.by.get(id)).filter(Boolean).map(a => { const m = me(a.id);
  return `<button class="orow" data-act="open" data-id="${a.id}">${poster(a) ? `<img loading="lazy" alt="" src="${esc(poster(a))}">` : `<span class="ph">${esc(a.t[0])}</span>`}<div><h4>${esc(title(a))}</h4><p>${[typeOf(a), a.y || '', a.type !== 'Movie' && a.eps ? nEps(a.eps) : ''].filter(Boolean).join(' · ')}${m?.p && m.s !== 'completed' ? ` · شاهدت ${num(m.p)}` : ''}</p></div>
    ${m ? `<span class="chip" data-l="${m.s}">${LNAME[m.s]}${m.r ? ` · ${m.r}` : ''}</span>` : '<span class="chip no">ليس في قائمتك</span>'}</button>`; }).join(''); }
function worderHTML(w) { const story = ui.worder !== 'release' && !!w.story;
  return `<h3>ترتيب المشاهدة</h3>${w.story ? `<div class="views" role="group" aria-label="الترتيب"><button data-act="worder" data-o="story" aria-pressed="${story}">ترتيب القصة</button><button data-act="worder" data-o="release" aria-pressed="${!story}">ترتيب الصدور</button></div>` : ''}
    <p class="lbl">${story ? (w.sv ? 'أحداث القصة بتسلسلها الزمني: الجزء السابق قبل اللاحق ولو صدر بعده. ترتيب هذه السلسلة راجعناه عملاً عملاً.' : `أحداث القصة بتسلسلها: الجزء السابق قبل اللاحق ولو صدر بعده، والقصة الجانبية بعد أصلها. مأخوذ من علاقات الأعمال في ${ltr('MyAnimeList')}.`) : w.story ? 'كما صدرت الأعمال، وهو الترتيب الآمن للمشاهدة الأولى: لا يحرق عملٌ ما قبله.' : 'ترتيب القصة في هذه السلسلة هو ترتيب صدورها نفسه.'}</p>${w.sn ? `<p class="wnote">${esc(w.sn)}</p>` : ''}<div class="order">${orderHTML(w)}</div>`; }
// مدة السلسلة كلها: مجموع حلقات كل عمل في مدة حلقته (والفيلم بطوله)
const span = min => { const h = Math.round(min / 60); return h >= 48 ? `${nDays(Math.floor(h / 24))}${h % 24 ? ` و${count(h % 24, ['ساعة', 'ساعتان', 'ساعات', 'ساعة', 'ساعة'])}` : ''}` : count(Math.max(1, h), ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة', 'ساعة']); };
function openWorld(wid, push = true) { const w = D.wby.get(wid); if (!w) return; wopen = wid; const d = $('#wsheet'), im = wArt(w), n = w.ids.length, all = w.ids.map(id => D.by.get(id)).filter(Boolean), eps = all.reduce((s, a) => s + (a.eps || 0), 0);
  const min = all.reduce((s, a) => s + (a.dur || 0) * (a.eps || 1), 0), ys = all.map(a => a.y).filter(Boolean), y0 = Math.min(...ys), y1 = Math.max(...ys), seen = all.reduce((s, a) => s + (me(a.id)?.p || 0), 0);
  $('#wsheet-body').innerHTML = `<div class="hero">${im ? `<img decoding="async" alt="" src="${im.replace('/w780/', '/w1280/')}">` : ''}</div>
    <div class="body"><div><h2 class="wname">${esc(w.name)}</h2>${w.en && w.en !== w.name ? `<p class="wen">${esc(w.en)}</p>` : ''}
      <div class="facts"><span>${nWorks(n)}</span>${eps ? `<span>${nEps(eps)}</span>` : ''}${min ? `<span>مدتها كلها ${span(min)}</span>` : ''}${ys.length ? `<span>${y0 === y1 ? y0 : `${y0} إلى ${y1}`}</span>` : ''}<span>في قائمتك <b>${num(wMine(w).length)}</b></span><span>أكملت <b>${num(wDone(w).length)}</b></span>${seen ? `<span>شاهدت منها ${nEps(seen)}</span>` : ''}</div></div>
    <div id="wintro"></div>
    ${isFate(w) ? `<a class="wc fate in" href="../fate/"><h3>${ltr('Fate')}</h3><p>لهذا العالم دليل كامل بخطوط قصته وترتيب مشاهدته. افتحه.</p></a>` : ''}
    <section class="sec" id="worder">${worderHTML(w)}</section></div>`;
  $('#wsheet-body').scrollTop = 0; if (!d.open) { d.showModal(); if (push) history.pushState({ w: wid }, '', `#w${wid}`); }
  // «عن هذا العالم»: نبذة السلسلة المكتوبة (wa، تُحمل مع نصوص العمل الذي تحمل اسمه). و«الحكاية»: نبذة ذلك العمل (يحدده البناء)، وإن غاب فأول عمل رئيسي
  // فيها (مسلسل، أو ما زاد على ثلاث حلقات، أو فيلم طويل)
  const first = D.by.get(w.head) || all.find(a => a.type === 'TV' || (a.eps || 1) > 3 || (a.type === 'Movie' && (a.dur || 0) >= 45)) || all[0];
  if (first) texts(first.id).then(x => { const box = $('#wintro'); if (wopen !== wid || !box || !(x?.wa || x?.ar || x?.en)) return;
    box.innerHTML = `${x.wa ? `<section class="sec wabout"><h3>عن هذا العالم</h3><p class="ov">${esc(x.wa)}</p></section>` : ''}${x.ar || x.en ? `<section class="sec"><h3>الحكاية</h3><p class="lbl">نبذة ${ltr(title(first))}، العمل الذي تحمل السلسلة اسمه.</p>${x.ar ? `<p class="ov">${esc(x.ar)}</p>` : `<span class="lbl">النبذة بالإنجليزية من ${ltr('MyAnimeList')} (الترجمة العربية قيد الإعداد)</span><p class="ov en">${esc(x.en)}</p>`}</section>` : ''}`; }); }

// ---------- «قائمتي وحساباتي»: الاستيراد من ملف MyAnimeList، والربط بـSIMKL، ونسخة احتياطية
const IMP = { mal: null, msg: '', ok: false, simkl: null, sk: null };
const sumHTML = t => `<div class="sum">${[['الكل', t.all], ...LISTS.map(([k, n]) => [n, t[k]]), ['حلقة', t.episodes], ['تقييماً', t.scored]].map(([n, v]) => `<div><b>${num(v || 0)}</b><span>${n}</span></div>`).join('')}</div>`;
const sameCore = (m, o) => m.s === o.s && (m.p || 0) === (o.p || 0) && (!o.r || o.r === m.r);
function diff(entries, core) { let add = 0, change = 0, same = 0, unknown = 0; for (const e of entries) { const m = P.a[e.id], o = toMine(e); if (!o) continue; if (!D.by.has(e.id)) unknown++;
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
function openImport() { IMP.msg = ''; drawImp(); const d = $('#imp'); if (!d.open) { d.showModal(); history.pushState({ imp: 1 }, '', '#import'); } }
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
    case 'world': openWorld(+d.w); break;
    case 'worder': { ui.worder = d.o; const w = D.wby.get(wopen), box = $('#worder'); if (w && box) box.innerHTML = worderHTML(w); break; }
    case 'close': history.state && (history.state.a || history.state.w || history.state.imp) ? history.back() : t.closest('dialog').close(); break;
    case 'import': openImport(); break;
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
  try { const r = await simklPull(D.list); IMP.sk = { ...r, diff: diff(r.entries, true) }; IMP.msg = ''; } catch (e) { IMP.msg = esc(e.message || 'تعذّر السحب من SIMKL.'); } drawImp(); }
document.addEventListener('change', e => { const t = e.target;
  if (t.id === 'sort') { ui.sort = t.value; keep(); renderGrid(); } else if (t.id === 'type') { ui.type = t.value; renderGrid(); }
  else if (t.id === 'names') { ui.names = t.value; keep(); renderAll(); if (open) openWork(open, false); }
  else if (t.id === 'imp-file') readFile(t.files[0]);
  else if (t.id === 'ep-n') setProgress(+t.dataset.id, parseInt(t.value, 10) || 0);
  else if (t.type === 'date' && t.dataset.k) setDate(+t.dataset.id, t.dataset.k, t.value); });
let qT = 0; $('#q').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => { ui.q = e.target.value; if (ui.view === 'worlds') $('#worlds').innerHTML = worldsHTML(); renderGrid(); }, 140); });
document.addEventListener('dragover', e => { const z = e.target.closest?.('#drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => e.target.closest?.('#drop')?.classList.remove('over'));
document.addEventListener('drop', e => { const z = e.target.closest?.('#drop'); if (z) { e.preventDefault(); z.classList.remove('over'); readFile(e.dataTransfer.files[0]); } });
// الرجوع (زر المتصفح أو إيماءة الجوال) يغلق النافذة المفتوحة، وEsc مثله
for (const d of $$('dialog')) { d.addEventListener('cancel', e => { e.preventDefault(); history.state && (history.state.a || history.state.w || history.state.imp) ? history.back() : d.close(); });
  d.addEventListener('close', () => { if (d.id === 'sheet') open = 0; if (d.id === 'wsheet') wopen = 0; if (d.id === 'imp') IMP.simkl = null; });
  d.addEventListener('click', e => { if (e.target === d) history.state && (history.state.a || history.state.w || history.state.imp) ? history.back() : d.close(); }); }
addEventListener('popstate', () => { const st = history.state || {}; if (!st.a && $('#sheet').open) $('#sheet').close(); if (!st.w && !st.a && $('#wsheet').open) $('#wsheet').close(); if (!st.imp && $('#imp').open) $('#imp').close();
  if (st.a && !$('#sheet').open) openWork(st.a, false); });

// ---------- الإقلاع
const liftVeil = () => { const v = $('#veil'); if (!v || v.hidden) return; requestAnimationFrame(() => requestAnimationFrame(() => { v.classList.add('lift'); setTimeout(() => v.remove(), calm ? 0 : 800); })); };
function route() { const h = location.hash.slice(1); let m; if ((m = h.match(/^a(\d+)$/)) && D.by.has(+m[1])) openWork(+m[1], false); else if ((m = h.match(/^w(\d+)$/)) && D.wby.has(+m[1])) { setView('worlds'); openWorld(+m[1], false); } else if (h === 'worlds') setView('worlds'); else if (h === 'import') { history.replaceState(null, '', location.pathname); openImport(); } }
try {
  const [cat, epi] = await Promise.all([get('catalog.json'), get('eps/index.json').catch(() => ({}))]); D.eps = epi || {}; D.base = cat.imageBase || D.base; D.mal = cat.malImages || D.mal; D.prov = cat.providers || {}; D.genres = cat.genres || [];
  D.list = cat.anime || []; for (const a of D.list) D.by.set(a.id, a);
  D.worlds = (cat.worlds || []).filter(w => w.ids.some(id => D.by.get(id)?.ord != null)); for (const w of D.worlds) D.wby.set(w.id, w);
  const types = [...new Set(D.list.filter(a => a.ord != null).map(a => a.type).filter(Boolean))]; $('#type').insertAdjacentHTML('beforeend', types.map(t => `<option value="${esc(t)}">${TYPE[t] || esc(t)}</option>`).join(''));
  $('#sort').value = ui.sort; $('#names').value = ui.names; if (!LNAME[ui.list] && ui.list !== 'all') ui.list = 'watching'; if (hasLog() && ui.list !== 'all' && !inList(ui.list).length) ui.list = inList('watching').length ? 'watching' : 'all';
  renderAll(); liftVeil();
  { const bar = $('.bar'), g = bar.querySelector('.gate'); new IntersectionObserver(([e]) => { const on = !e.isIntersecting; bar.classList.toggle('docked', on); g.tabIndex = on ? 0 : -1; g.setAttribute('aria-hidden', String(!on)); }).observe($('.top')); }
  initSync(id => { if (id !== 'anime') return; load(); renderAll(true); if (open) { const box = $('#sheet-body .mine'); if (box) box.outerHTML = mineHTML(D.by.get(open)); drawXs(D.by.get(open)); } });
  route();
} catch (err) { $('#grid').innerHTML = '<p class="load">تعذّر تحميل القائمة. حدّث الصفحة.</p>'; liftVeil(); console.error(err); }
