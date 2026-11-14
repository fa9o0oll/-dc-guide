// قائمة أفلامي: شبكة تذاكر، بحث وتصفية، نافذة لكل فيلم (معلوماته، أين يُعرض في السعودية، ترتيب سلسلته أو عالمه، وأعماله المرتبطة)، وزر «أضف فيلماً».
// البيانات تُبنى في scripts/build-films.mjs، وخريطة العوالم في scripts/build-worlds.mjs (Wikidata). سجل المشاهدة يُحفظ في المتصفح بالمفتاح filmsg.progress.
import { initSync, touch as syncTouch } from './sync.js?v=__BUILD__';
import { ar } from './bidi.js?v=__BUILD__';
import { clock, spoken, left } from './count.js?v=__BUILD__';
import './zoom.js?v=__BUILD__'; // البوسترات المشتركة بين البوابات: التكبير والقرص بإصبعين والميلان مع الجوال (data-zoom وdata-zoom-pinch)
const BUILD = '__BUILD__', KEY = 'filmsg.progress', PEND = 'filmsg.pending', PASS = 'filmsg.pass', IMG = 'https://image.tmdb.org/t/p/';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GENRES = { 28: 'أكشن', 12: 'مغامرة', 16: 'رسوم متحركة', 35: 'كوميديا', 80: 'جريمة', 99: 'وثائقي', 18: 'دراما', 10751: 'عائلي', 14: 'فانتازيا', 36: 'تاريخي', 27: 'رعب', 10402: 'موسيقي', 9648: 'غموض', 10749: 'رومانسي', 878: 'خيال علمي', 10770: 'فيلم تلفزيوني', 53: 'إثارة', 10752: 'حربي', 37: 'ويسترن', 10759: 'أكشن ومغامرة', 10765: 'خيال علمي وفانتازيا', 10768: 'حرب وسياسة', 10762: 'أطفال', 10764: 'واقع' };
const LANGS = { en: 'الإنجليزية', ko: 'الكورية', ja: 'اليابانية', fr: 'الفرنسية', es: 'الإسبانية', it: 'الإيطالية', de: 'الألمانية', hi: 'الهندية', da: 'الدنماركية', pt: 'البرتغالية', zh: 'الصينية', cn: 'الكانتونية', sv: 'السويدية', ar: 'العربية', te: 'التيلوغو', id: 'الإندونيسية', ru: 'الروسية', tr: 'التركية', fa: 'الفارسية', no: 'النرويجية', nl: 'الهولندية', pl: 'البولندية', th: 'التايلندية' };
const XKIND = { tv: 'مسلسل', anime: 'أنمي', game: 'لعبة', short: 'فيلم قصير', book: 'كتاب', film: 'فيلم', comic: 'قصص مصورة' };
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol><symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6.5 9.5V20h11V9.5"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></symbol><symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol><symbol id="i-mark" viewBox="0 0 24 24"><path d="M7 4.5h10v15l-5-3.5-5 3.5z"/></symbol>
<symbol id="i-roll" viewBox="0 0 24 24"><path d="M4 7.5h3c2 0 3.2 1.2 4.5 4.5s2.5 4.5 4.5 4.5h4M4 16.5h3c1.1 0 1.9-.4 2.7-1.3M20 7.5h-4c-1.1 0-1.9.4-2.7 1.3M17.5 5L20 7.5 17.5 10M17.5 14l2.5 2.5-2.5 2.5"/></symbol></defs></svg>`;

// عدّ عربي: 1 فيلم واحد، 2 فيلمان، 3 إلى 10 أفلام، 11 فأكثر فيلماً
const count = (n, [one, two, few, many, sing]) => { const m = n % 100; return n === 1 ? one : n === 2 ? two : m >= 3 && m <= 10 ? `${n} ${few}` : m >= 11 ? `${n} ${many}` : `${n} ${sing}`; };
const nFilms = n => count(n, ['فيلم واحد', 'فيلمان', 'أفلام', 'فيلماً', 'فيلم']), nParts = n => count(n, ['جزء واحد', 'جزءان', 'أجزاء', 'جزءاً', 'جزء']);
const rt = m => !m ? '' : m < 60 ? `${m}د` : `${Math.floor(m / 60)}س${m % 60 ? ` ${m % 60}د` : ''}`;
const today = new Date().toISOString().slice(0, 10);
const unreleased = f => f.kind === 'movie' && (!f.date || f.date > today);
const daysTo = d => Math.ceil((new Date(d + 'T00:00:00') - Date.now()) / 864e5);
const nDays = n => count(n, ['يوم واحد', 'يومان', 'أيام', 'يوماً', 'يوم']);
const dateAr = d => new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
// المسلسل الذي يُعرض الآن: موعد حلقته القادمة من TMDB
const nextEp = f => f.kind === 'tv' && f.next?.date && f.next.date >= today ? f.next : null;
// عمل لم يصدر (أو حلقة قادمة): لافتة سينما أسفل البوستر، بمصابيح تجري وعدّ حي تحرّكه count.js، أو «قريباً» إن لم يُعلن موعده
function marquee(f) { const n = nextEp(f); if (!n && !unreleased(f)) return '';
  const date = n ? n.date : f.date, now = !n ? 'يُعرض اليوم' : n.e === 1 ? 'يبدأ اليوم' : 'تُعرض اليوم';
  if (!date) return '<span class="mq tba" aria-hidden="true"><b>قريباً</b><small>لم يُعلن موعده</small></span>';
  return `<span class="mq" data-until="${date}" data-now="${now}"><small>${!n ? 'يُعرض بعد' : n.e === 1 ? `الموسم ${n.s} بعد` : `الحلقة ${n.e} بعد`}</small><span class="ck" aria-hidden="true">${clock(date, now)}</span><span class="sr sr-time">${spoken(date)}</span></span>`; }
// موعد الصدور في البطاقة: شريط العدّ في أول بكرات الأفلام القديمة، عقربه يدور مع الثواني وفي وسطه الأيام الباقية
function leader(date, note, now = 'يُعرض اليوم') { const t = date && left(date);
  return `<div class="leader${date ? '' : ' tba'}"${date ? ` data-until="${date}" data-now="${now}"` : ''}><span class="ld-dial" aria-hidden="true"><i class="ld-sweep" style="animation-delay:-${t ? 60 - t.s : 0}s"></i>${date ? '' : '<b class="ld-q">؟</b>'}</span>${date ? `<span class="ck" aria-hidden="true">${clock(date, now)}</span><span class="sr sr-time">${spoken(date)}</span>` : ''}<p class="note">${note}</p></div>`; }
// بلا بوستر بعد: لوح تصوير (كلاكيت) عليه اسم العمل وحالته، يُطبق ذراعه حين يمر عليه المؤشر
const slate = o => `<span class="ph slate" aria-hidden="true"><span class="sl-top"><i class="sl-arm"></i><i class="sl-base"></i></span><span class="sl-body"><bdi class="sl-t" dir="ltr">${esc(o.title || '')}</bdi><span class="sl-f"><span><small>الحالة</small><b>${!o.date || o.date > today ? 'قريباً' : 'صدر'}</b></span><span><small>الموعد</small><b>${o.date ? `<bdi>${o.date.slice(0, 4)}</bdi>` : 'لم يُعلن'}</b></span></span></span></span>`;
const poster = (p, sizes) => p ? `<img loading="lazy" decoding="async" alt="" src="${IMG}w342${p}" srcset="${IMG}w185${p} 185w, ${IMG}w342${p} 342w, ${IMG}w500${p} 500w" sizes="${sizes}">` : '';

const D = { films: [], byId: new Map(), byTmdb: new Map(), more: null, cols: {}, prov: {}, fr: {}, fx: {}, frOf: new Map(), recOf: new Map(), part: new Map(),
  // خريطة العوالم (worlds.json): العوالم وترتيبها، وعوالم كل عمل وأعماله المرتبطة، ومعلومات الأعمال خارج القائمة. wlive: البحث المباشر لعمل جديد
  worlds: {}, wworks: {}, winfo: {}, memberOf: new Map(), wok: false, wlive: new Map(), wres: new Map(),
  // ترتيب أحداث مجموعات TMDB (من محرّك الأحداث): { رقم المجموعة: { order, moved } أو { chk } }
  colChrono: {} };
let P = { films: {} };
try { P = { films: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const save = () => { try { P.at = Date.now(); localStorage.setItem(KEY, JSON.stringify(P)); } catch {} syncTouch('films'); };
const st = id => P.films[id] || '';
// ov: ترتيب عرض السلسلة في البطاقة (الأحداث أولاً، ويمكن التبديل إلى الصدور)
const ui = { q: '', status: 'todo', genre: '', decade: '', prov: '', sort: 'list', view: 'grid', series: false, ov: 'chrono' };

document.body.insertAdjacentHTML('beforeend', `${SPRITE}
<header class="top"><a class="home" href="../" aria-label="العودة إلى البوابات">${ic('home')}<span>البوابات</span></a><h1>قائمة أفلامي</h1>
  <button class="btn pri add" data-act="add">${ic('plus')}<span>أضف فيلماً</span><span class="sr">أضف فيلماً</span></button><p class="tally" id="tally"></p></header>
<section class="tonight" id="tonight" hidden><div class="bd"></div><p class="lbl">اقتراح الليلة</p><h2 dir="ltr"></h2><p class="meta"></p>
  <div class="acts"><button class="btn pri" data-act="open-tonight">افتح بطاقته</button><button class="btn sec" data-act="reroll">${ic('roll')}اقتراح آخر</button></div></section>
<nav class="bar" aria-label="البحث والتصفية"><div class="row"><a class="gate" href="../" aria-label="العودة إلى البوابات" aria-hidden="true" tabindex="-1"><span class="gate-em"><span class="gate-logo">${ic('home')}</span></span><span class="gate-t">البوابات</span></a><label class="search">${ic('search')}<span class="sr">ابحث في القائمة</span><input id="q" type="search" placeholder="ابحث: فيلم، مخرج، سنة" autocomplete="off" enterkeyhint="search"></label>
  <div class="tabs" role="group" aria-label="طريقة العرض"><button data-act="view" data-v="grid" aria-pressed="true">الأفلام</button><button data-act="view" data-v="series" aria-pressed="false">السلاسل</button></div></div>
  <div class="chips" id="chips"></div></nav>
<p class="count" id="count" aria-live="polite"></p>
<main><div class="grid" id="grid"><p class="load">تُحمَّل القائمة…</p></div><div class="series" id="series" hidden></div></main>
<footer class="foot"><p>البوسترات وبيانات الأفلام من <a href="https://www.themoviedb.org/" target="_blank" rel="noopener"><bdi dir="ltr">TMDB</bdi></a>، وبيانات أماكن العرض من <a href="https://www.justwatch.com/" target="_blank" rel="noopener"><bdi dir="ltr">JustWatch</bdi></a>. <bdi dir="ltr">This product uses the TMDB API but is not endorsed or certified by TMDB.</bdi></p>
  <p><button class="syncb" data-sync-open><span data-sync-label></span></button></p></footer>
<dialog id="sheet" aria-label="بطاقة الفيلم"><button class="close" data-act="close" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="sheet-body"></div></dialog>
<dialog id="add" aria-labelledby="add-h"><button class="close" data-act="close-add" aria-label="إغلاق">${ic('x')}</button>
  <form id="add-form"><h2 id="add-h">أضف فيلماً</h2>
  <label>اسم الفيلم وسنته في سطر واحد<input id="add-q" dir="auto" placeholder="Heat 1995" autocomplete="off" required></label>
  <label id="add-pass-wrap">كلمة السر (تُطلب مرة واحدة على هذا الجهاز)<input id="add-pass" type="password" autocomplete="current-password"></label>
  <button class="btn pri" type="submit">ابحث عنه</button><p class="msg" id="add-msg" aria-live="polite"></p><div class="cands" id="cands"></div>
  <p class="hint">الفيلم يظهر هنا فوراً، ويصل إلى بقية أجهزتك خلال دقائق. سلسلته وعالمه وأعماله المرتبطة تُجلب آلياً من <bdi dir="ltr">TMDB</bdi> و<bdi dir="ltr">Wikidata</bdi>.</p></form></dialog>
<div class="toast" id="toast" role="status"></div>`);

const toast = (t, undo) => { const el = $('#toast'); el.textContent = t; if (undo) { const b = Object.assign(document.createElement('button'), { textContent: 'تراجع', onclick: () => { el.classList.remove('on', 'act'); el.textContent = ''; undo(); } }); el.append(b); }
  el.classList.toggle('act', !!undo); el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => { el.classList.remove('on', 'act'); setTimeout(() => { if (!el.classList.contains('on')) el.textContent = ''; }, 300); }, undo ? 5000 : 2600); };
const get = (f) => fetch(`data/${f}?v=${BUILD}`).then(r => { if (!r.ok) throw new Error(f); return r.json(); });

function register(f, heavy) { if (D.byId.has(f.id)) return; D.films.push(f); D.byId.set(f.id, f); if (f.kind === 'movie') D.byTmdb.set(f.tmdb, f); if (heavy) (D.more ||= {})[f.id] = heavy; }
const HEAVY = ['overviewEn', 'overviewAr', 'cast', 'countries', 'arSource', 'titleAr', 'directors'];
const split = full => { const light = {}, heavy = {}; for (const [k, v] of Object.entries(full)) (HEAVY.includes(k) ? heavy : light)[k] = v; return [light, heavy]; };

// ---------- البطاقة ----------
function whereHTML(f) { const p = f.prov; if (!p) return '';
  const s = [...new Set([...p.stream, ...p.free])];
  if (s.length) return s.slice(0, 4).map(id => D.prov[id]?.logo ? `<img loading="lazy" alt="${esc(D.prov[id].name)}" title="${esc(D.prov[id].name)}" src="${IMG}w92${D.prov[id].logo}">` : '').join('') + (s.length > 4 ? `<span>+${s.length - 4}</span>` : '');
  return p.rent.length || p.buy.length ? '<span>إيجار أو شراء</span>' : ''; }
// وسم التذكرة: «بداية الأحداث» لجزء صدر لاحقاً وتبدأ به القصة، ثم «اختياري/تجاوزه»، ثم موضعه في ترتيب سلسلته
function partTag(f) { const g = groupOf(f), i = g ? g.order.findIndex(s => isHere(f, s)) : -1;
  if (g?.view && i === 0 && firstReleased(g) !== 0) return '<span class="tag start">بداية الأحداث</span>';
  const r = D.recOf.get(f.id); if (r === 'skip' || r === 'optional') return `<span class="tag">${r === 'skip' ? 'تجاوزه' : 'اختياري'}</span>`;
  return g && i >= 0 && g.order.length > 1 ? `<span class="tag"><bdi dir="ltr">${i + 1}/${g.order.length}</bdi></span>` : ''; }
const tagOf = f => f.fresh ? '<span class="tag new">جديد</span>' : f.kind === 'tv' ? '<span class="tag">مسلسل</span>' : partTag(f); // موعد ما لم يصدر في لافتته أسفل البوستر
// خريطة العوالم تصل بعد رسم القائمة وقد تغيّر ترتيب سلسلة (عالم آلي أو ترتيب أحداث مجموعة)، فتُحدَّث الوسوم التي تغيّرت فقط
function retag() { for (const f of D.films) { const el = document.querySelector(`#f-${f.id} .poster`); if (!el) continue; const old = el.querySelector(':scope > .tag'), html = tagOf(f);
  if ((old?.outerHTML || '') === html) continue; old?.remove(); if (html) el.querySelector('.stamp').insertAdjacentHTML('beforebegin', html); } }
function card(f) { const s = st(f.id);
  return `<article class="tk${s ? ' ' + s : ''}" id="f-${f.id}" data-id="${f.id}">
<button class="poster" data-act="open" ${f.poster ? `data-zoom-pinch data-zoom-title="${esc(f.title)}" ` : ''}aria-label="افتح بطاقة ${esc(f.title)}">${poster(f.poster, '(max-width:520px) 45vw, 180px') || slate(f)}${tagOf(f)}${marquee(f)}<span class="stamp" aria-hidden="true">شوهد</span></button>
<div class="stub"><h3>${esc(f.title)}</h3><p class="meta">${f.year ? `<bdi>${f.year}</bdi>` : '<span>بلا موعد</span>'}${f.rating ? `<span class="rate"><bdi dir="ltr">${f.rating.toFixed(1)}</bdi></span>` : ''}${f.runtime ? `<span>${rt(f.runtime)}</span>` : f.seasons ? `<span>${count(f.seasons, ['موسم واحد', 'موسمان', 'مواسم', 'موسماً', 'موسم'])}</span>` : ''}</p>
<button class="seen" data-act="seen" aria-pressed="${s === 'watched'}" aria-label="شاهدته: ${esc(f.title)}">${ic('check')}</button><div class="where">${whereHTML(f)}</div></div></article>`; }

// ---------- التصفية والترتيب ----------
// ترتيب قائمتي: أجزاء السلسلة الواحدة متجاورة بترتيب أحداثها، في موضع أقدم جزء منها في القائمة، مهما كان ترتيب إضافتها
const listKey = f => f._lk ??= (() => { const g = groupOf(f), i = g ? g.order.findIndex(s => isHere(f, s)) : -1; if (i < 0 || g.order.length < 2) return [f.ord, 0];
  return [Math.min(...g.order.map(listedOf).filter(Boolean).map(m => m.ord)), i]; })();
const SORTS = { list: ['ترتيب قائمتي', (a, b) => { const x = listKey(a), y = listKey(b); return x[0] - y[0] || x[1] - y[1] || a.ord - b.ord; }], new: ['الأحدث صدوراً', (a, b) => (b.date || '0').localeCompare(a.date || '0')], old: ['الأقدم صدوراً', (a, b) => (a.date || '9').localeCompare(b.date || '9')],
  rate: ['الأعلى تقييماً', (a, b) => (b.votes >= 50 ? b.rating || 0 : 0) - (a.votes >= 50 ? a.rating || 0 : 0)], short: ['الأقصر مدة', (a, b) => (a.runtime || 9999) - (b.runtime || 9999)], az: ['أبجدياً', (a, b) => a.title.localeCompare(b.title, 'en')] };
const hay = f => f._h ??= [f.title, f.orig, f.year, ...(D.more?.[f.id]?.directors || []), D.more?.[f.id]?.titleAr, f.col && D.cols[f.col]?.name, D.fr[D.frOf.get(f.id)]?.name, ...worldIds(f.id).map(id => D.worlds[id].name)].filter(Boolean).join(' ').toLowerCase();
function match(f) { const s = st(f.id);
  if (ui.status === 'soon' ? !unreleased(f) : ui.status === 'todo' ? s === 'watched' && !ui.q : ui.status !== 'all' && s !== ui.status) return false;
  if (ui.genre && !f.genres.includes(+ui.genre)) return false;
  if (ui.decade && Math.floor((f.year || 0) / 10) * 10 !== +ui.decade) return false;
  if (ui.prov && !(ui.prov === 'any' ? f.prov && (f.prov.stream.length || f.prov.free.length) : f.prov && [...f.prov.stream, ...f.prov.free].includes(+ui.prov))) return false;
  if (ui.series && !groupOf(f)) return false;
  if (ui.q && !ui.q.split(/\s+/).every(w => hay(f).includes(w))) return false;
  return true; }
function chipsHTML() { const c = (k, v, t) => `<button class="chip" data-act="status" data-v="${v}" aria-pressed="${ui[k] === v}">${t}</button>`;
  const sel = (k, label, opts) => `<select class="pick${ui[k] ? ' on' : ''}" data-k="${k}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, t]) => `<option value="${v}"${String(ui[k]) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const provs = {}; for (const f of D.films) for (const id of new Set([...(f.prov?.stream || []), ...(f.prov?.free || [])])) provs[id] = (provs[id] || 0) + 1;
  const genres = {}; for (const f of D.films) for (const g of f.genres) genres[g] = (genres[g] || 0) + 1;
  const decades = [...new Set(D.films.map(f => Math.floor((f.year || 0) / 10) * 10).filter(Boolean))].sort((a, b) => b - a);
  const nSeen = D.films.filter(f => st(f.id) === 'watched').length;
  return c('status', 'todo', 'لم أشاهده') + c('status', 'next', 'التالي') + c('status', 'watched', `شاهدته${nSeen ? ` <bdi>${nSeen}</bdi>` : ''}`) + c('status', 'all', 'الكل مع ما شاهدته') + (D.films.some(unreleased) ? c('status', 'soon', 'لم يصدر بعد') : '')
    + sel('prov', 'أين يُعرض', [['any', 'متاح باشتراك أو مجاناً'], ...Object.entries(provs).sort((a, b) => b[1] - a[1]).map(([id]) => [id, D.prov[id]?.name || id])])
    + sel('genre', 'النوع', Object.entries(genres).sort((a, b) => b[1] - a[1]).map(([g]) => [g, GENRES[g] || g]))
    + sel('decade', 'العقد', decades.map(d => [d, `${d} – ${d + 9}`]))
    + `<button class="chip" data-act="only-series" aria-pressed="${ui.series}">ضمن سلسلة</button>`
    + `<select class="pick on" data-k="sort" aria-label="الترتيب">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}"${ui.sort === k ? ' selected' : ''}>${t}</option>`).join('')}</select>`; }
const filtered = () => ui.status !== 'todo' || ui.genre || ui.decade || ui.prov || ui.series || ui.q;
function apply(resort) { const grid = $('#grid');
  if (resort) { const sorted = [...D.films].sort(SORTS[ui.sort][1]), frag = document.createDocumentFragment(); for (const f of sorted) { const el = document.getElementById('f-' + f.id); if (el) frag.append(el); } grid.append(frag); }
  let shown = 0; for (const f of D.films) { const el = document.getElementById('f-' + f.id); if (!el) continue; const ok = match(f); el.hidden = !ok; if (ok) shown++; }
  let empty = $('.empty', grid); if (!shown && !empty) grid.insertAdjacentHTML('beforeend', '<p class="empty">لا شيء يطابق هذه التصفية. جرّب إزالة أحد الشروط.</p>'); else if (shown && empty) empty.remove();
  const hid = D.films.filter(f => st(f.id) === 'watched').length;
  $('#count').innerHTML = ui.view === 'series' ? '' : filtered() ? `يظهر ${shown} من ${D.films.length} <button data-act="reset">${ui.status === 'all' && !(ui.genre || ui.decade || ui.prov || ui.series || ui.q) ? 'أخفِ ما شاهدته' : 'أزل التصفية'}</button>` : hid ? `ما شاهدته مخفي (${hid}) <button data-act="show-all">أظهر الكل</button>` : '';
  const seen = hid, tv = D.films.filter(f => f.kind === 'tv').length, mv = D.films.length - tv;
  $('#tally').textContent = `${nFilms(mv)}${tv ? ` و${count(tv, ['مسلسل واحد', 'مسلسلان', 'مسلسلات', 'مسلسلاً', 'مسلسل'])}` : ''}${seen ? ` · شاهدت ${seen} · بقي ${D.films.length - seen}` : ''}`;
  const wc = $('[data-act=status][data-v=watched]'); if (wc) wc.innerHTML = `شاهدته${seen ? ` <bdi>${seen}</bdi>` : ''}`; }
function renderGrid() { $('#grid').innerHTML = [...D.films].sort(SORTS[ui.sort][1]).map(card).join(''); $('#chips').innerHTML = chipsHTML(); apply(false); }

// ---------- اقتراح الليلة ----------
let tonightId = null;
function reroll(first) { const ok = f => f.backdrop && f.kind === 'movie' && !unreleased(f) && st(f.id) !== 'watched' && f.id !== tonightId;
  let pool = D.films.filter(f => ok(f) && match(f)); if (!pool.length) pool = D.films.filter(ok); const box = $('#tonight'); if (!pool.length) { box.hidden = true; return; }
  const next = pool.filter(f => st(f.id) === 'next'), strong = pool.filter(f => f.rating >= 7 && f.votes >= 500);
  const from = first && next.length ? next : strong.length >= 5 ? strong : pool, f = from[Math.floor(Math.random() * from.length)];
  tonightId = f.id; box.hidden = false; $('h2', box).textContent = f.title;
  $('.meta', box).textContent = [f.year, rt(f.runtime), f.genres.slice(0, 2).map(g => GENRES[g]).filter(Boolean).join('، '), f.rating ? `التقييم ${f.rating.toFixed(1)}` : ''].filter(Boolean).join(' · ');
  const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = IMG + (innerWidth * devicePixelRatio > 1000 ? 'w1280' : 'w780') + f.backdrop;
  img.onload = () => { $('.bd', box).replaceChildren(img); requestAnimationFrame(() => img.classList.add('in')); };
  if (!first) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); } }

// ---------- السلاسل والعوالم ----------
// مجموعة العرض بالأولوية: ترتيب مراجَع يدوياً (توصيات ومسلسلات مرتبطة ومصادر)، ثم عالم من «خريطة العوالم» (Wikidata) إن ضمّ أجزاء مجموعة TMDB كلها،
// ثم مجموعة TMDB كما هي (أفلام فقط بترتيب الصدور). العالم الآلي بلا توصيات، ويُذكر مصدره.
const REC = { watch: 'شاهده', optional: 'اختياري', skip: 'تجاوزه', soon: 'قادم' };
const WKIND = { series: 'سلسلة', universe: 'عالم مشترك', franchise: 'امتياز إعلامي', chain: 'أعمال متتالية' };
const SRCK = { novel: 'رواية', novels: 'سلسلة روايات', book: 'كتاب', manga: 'مانغا', comic: 'قصص مصورة', game: 'لعبة فيديو', games: 'سلسلة ألعاب فيديو', toy: 'خط ألعاب', musical: 'مسرحية موسيقية', teleplay: 'تمثيلية تلفزيونية', play: 'مسرحية',
  epic: 'ملحمة', tale: 'حكاية', story: 'قصة قصيرة', article: 'مقال', song: 'أغنية', tvshow: 'مسلسل', films: 'سلسلة أفلام', film: 'فيلم' };
const RELN = { original: 'الأصل', derived: 'اقتُبس عنه', sibling: 'اقتباس آخر' };
const nWorks = n => count(n, ['عمل واحد', 'عملان', 'أعمال', 'عملاً', 'عمل']);
const whenOf = o => o.date && o.date > today ? 'بعد ' + nDays(daysTo(o.date)) : o.year || 'لم يُعلن موعده';
const keyOf = f => f.id || (f.kind === 'tv' ? 't' : 'm') + f.tmdb;
const stepOf = k => k[0] === 't' ? { t: +k.slice(1) } : { m: +k.slice(1) };
const keyOfStep = s => s.m ? 'm' + s.m : s.t ? 't' + s.t : null;
const ext = (name, url) => `<a href="${esc(url)}" target="_blank" rel="noopener"><bdi dir="ltr">${esc(name)}</bdi></a>`;
function mergeWorlds(w) { if (!w?.worlds) return;
  Object.assign(D.worlds, w.worlds); Object.assign(D.winfo, w.info || {}); Object.assign(D.colChrono, w.cols || {}); for (const [k, v] of Object.entries(w.works || {})) D.wworks[k] = { ...D.wworks[k], ...v };
  for (const [id, x] of Object.entries(w.worlds)) for (const k of x.order) { const a = D.memberOf.get(k) || D.memberOf.set(k, []).get(k); if (!a.includes(id)) a.push(id); }
  stale(); retag(); }
// ما يُحسب من السلاسل (البحث وموضع التذكرة في ترتيب القائمة) يُعاد حسابه حين تتغير البيانات
const stale = () => { for (const f of D.films) { delete f._h; delete f._lk; } };
// عوالم عمل: ما حدده البناء له (الأخص أولاً)، أو لعمل خارج القائمة العوالم التي تضمه
const RANK = { series: 0, universe: 1, franchise: 2, chain: 3 };
const worldIds = k => { const own = D.wworks[k]; if (own?.worlds) return own.worlds.filter(id => D.worlds[id]);
  return (D.memberOf.get(k) || []).filter(id => D.worlds[id]).sort((a, b) => D.worlds[a].order.length - D.worlds[b].order.length || RANK[D.worlds[a].kind] - RANK[D.worlds[b].kind]); };
const colOf = f => { const c = f.col && D.cols[f.col]; return c && c.parts.length > 1 ? c : null; };
const autoOf = f => { const c = colOf(f), parts = c ? c.parts.map(p => 'm' + p.tmdb) : [];
  return worldIds(keyOf(f)).find(id => { const o = D.worlds[id].order; return o.length > 1 && parts.every(p => o.includes(p)); }) || null; };
// العالم الآلي ومجموعة TMDB: إن وجد محرّك الأحداث دليلاً على جزء يسبق القصة صار الترتيب ترتيب الأحداث، والمُوصى به للمشاهدة الأولى الصدور
const chronoOf = c => c?.order ? { view: 'release', chrono: c } : c?.chk ? { chk: true } : {};
const worldGroup = id => { const w = D.worlds[id]; return { key: 'w:' + id, auto: true, id, name: w.name, kind: w.kind, by: w.by, wd: w.wd, wiki: w.wiki, order: (w.chrono?.order || w.order).map(stepOf), ...chronoOf(w.chrono || (w.chk && { chk: 1 })) }; };
const groupOf = f => { const k = D.frOf.get(keyOf(f)); if (k) return { key: k, curated: true, ...D.fr[k] }; const id = autoOf(f); if (id) return worldGroup(id);
  const c = colOf(f); if (!c) return null; const parts = c.parts.map(p => 'm' + p.tmdb), w = worldIds(keyOf(f)).map(id => D.worlds[id]).find(x => x.order.every(k => parts.includes(k)));
  const cc = D.colChrono[c.id]; return { key: 'c' + c.id, name: c.name, order: (cc?.order || parts).map(stepOf), wiki: w?.wiki || null, ...chronoOf(cc) }; };
const listedOf = s => s.m ? D.byTmdb.get(s.m) : s.t ? D.byId.get('t' + s.t) : null;
const infoOf = s => listedOf(s) || (s.m ? D.fx['m' + s.m] || D.part.get(s.m) || D.winfo['m' + s.m] : s.t ? D.fx['t' + s.t] || D.winfo['t' + s.t] : s) || {};
// عمل خارج القائمة له رقم في TMDB: زره يفتح بطاقة اطلاع مباشرة بدل البحث
const outRef = s => s.m ? ` data-tmdb="${s.m}" data-kind="movie"` : s.t ? ` data-tmdb="${s.t}" data-kind="tv"` : '';
// نوع العمل في الترتيب: مسلسل، أنمي، فيلم رسوم، فيلم قصير (٤٠ دقيقة فأقل). الفيلم الحي بلا وصف
const kindOf = s => { if (s.x) return XKIND[s.x] || ''; const o = infoOf(s), w = D.winfo[keyOfStep(s)] || {}, g = o.genres || w.genres || [], anim = g.includes(16), ja = (o.lang || w.lang) === 'ja', run = o.runtime || w.runtime;
  if (s.t) return anim ? (ja ? 'أنمي' : 'مسلسل رسوم') : 'مسلسل';
  if (run && run <= 40) return 'فيلم قصير';
  return anim ? (ja ? 'فيلم أنمي' : 'فيلم رسوم') : ''; };
function groups() { const out = new Map(Object.entries(D.fr).map(([key, fr]) => [key, { key, curated: true, ...fr }]));
  for (const f of D.films) { if (D.frOf.has(f.id)) continue; const g = groupOf(f); if (g && !out.has(g.key)) out.set(g.key, g); }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')); }
function seriesHTML() { const gs = groups().filter(g => !ui.q || g.name.toLowerCase().includes(ui.q) || g.order.some(s => (infoOf(s).title || '').toLowerCase().includes(ui.q)));
  if (!gs.length) return '<p class="empty">لا سلسلة تطابق البحث.</p>';
  return gs.map(g => { const mine = g.order.map(listedOf).filter(Boolean), seen = mine.filter(f => st(f.id) === 'watched').length;
    return `<section class="fr"><header><h3 dir="ltr">${esc(g.name)}</h3><span>${nWorks(g.order.length)}${seen ? ` · شاهدت ${seen}` : ''}${mine.length < g.order.length ? ` · ${mine.length} في قائمتك` : ''}${g.curated ? ` · بتوصيات الدليل${g.view ? '، بترتيب الأحداث' : ''}` : g.auto ? ` · ${WKIND[g.kind]}، مرتّب آلياً${g.chrono ? ' حسب الأحداث' : ''}` : g.chrono ? ' · مرتّب آلياً حسب الأحداث' : ''}</span></header>${g.note ? `<p class="fr-note">${ar(g.note)}</p>` : ''}<div class="reel">${
      g.order.map((s, i) => { const f = listedOf(s), o = infoOf(s), k = kindOf(s); return `<button class="part${f ? '' : ' out'}${f && st(f.id) === 'watched' ? ' watched' : ''}${s.rec ? ' r-' + s.rec : ''}" data-act="${f ? 'open' : 'add-part'}" data-id="${f ? f.id : ''}"${f ? '' : outRef(s)} data-q="${esc(o.title || '')}${o.year ? ' ' + o.year : ''}">
<span class="p"${o.poster ? ` data-zoom-pinch data-zoom-title="${esc(o.title || '')}"` : ''}>${poster(o.poster, '118px') || slate(o)}<span class="n">${i + 1}</span>${s.rec && s.rec !== 'watch' ? `<span class="rc ${s.rec}">${REC[s.rec]}</span>` : ''}</span><b>${esc(o.title || '')}</b><small>${[k, whenOf(o), f ? '' : 'خارج قائمتك'].filter(Boolean).join(' · ')}</small></button>`; }).join('')}</div></section>`; }).join(''); }
function setView(v) { ui.view = v; $$('.tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); $('#grid').hidden = v !== 'grid'; $('#series').hidden = v !== 'series'; $('#chips').hidden = v !== 'grid';
  if (v === 'series') $('#series').innerHTML = seriesHTML(); apply(false); }

// ---------- نافذة الفيلم ----------
const sheet = $('#sheet'), addDlg = $('#add');
let openId = null;
const isHere = (f, s) => { const l = listedOf(s); return l ? l.id === f.id : (s.m && f.kind === 'movie' && s.m === f.tmdb) || (s.t && f.kind === 'tv' && s.t === f.tmdb); };
// سبب تقدّم جزء على ما صدر قبله، من دليل محرّك الأحداث: «قبل «Predator»، عام 1719 · مؤكد من مصدرين»
const titleOfKey = k => infoOf(stepOf(k)).title || '';
// زمن القصة بالعربية: سنة، أو حقبة من Wikidata (عقد، قرن، حرب…) باسمها العربي إن عُرف، وإلا باسمها الإنجليزي
const DECADES = { 1920: 'العشرينيات', 1930: 'الثلاثينيات', 1940: 'الأربعينيات', 1950: 'الخمسينيات', 1960: 'الستينيات', 1970: 'السبعينيات', 1980: 'الثمانينيات', 1990: 'التسعينيات' };
const CENTS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرين', 'الحادي والعشرين'];
const ERAS = { 'world war i': 'الحرب العالمية الأولى', 'world war ii': 'الحرب العالمية الثانية', 'american civil war': 'الحرب الأهلية الأمريكية', 'vietnam war': 'حرب فيتنام', 'cold war': 'الحرب الباردة', 'korean war': 'الحرب الكورية',
  'great depression': 'الكساد الكبير', 'middle ages': 'العصور الوسطى', 'ancient egypt': 'مصر القديمة', 'ancient rome': 'روما القديمة', 'ancient greece': 'اليونان القديمة', 'victorian era': 'العصر الفيكتوري', 'prehistory': 'ما قبل التاريخ', 'wild west': 'الغرب الأمريكي القديم' };
const yearText = m => { const l = String(m.yl || '').trim(); let d;
  if (l) { if ((d = l.match(/^(\d{3})0s$/))) return 'في ' + (DECADES[+d[1] * 10] || `عقد ${d[1]}0`); if ((d = l.match(/^(\d{1,2})(?:st|nd|rd|th) century( BC| BCE)?$/i))) return `في القرن ${CENTS[+d[1]] || d[1]}${d[2] ? ' قبل الميلاد' : ''}`;
    return ERAS[l.toLowerCase()] ? 'في ' + ERAS[l.toLowerCase()] : `في <bdi dir="ltr">${esc(l)}</bdi>`; }
  return m.y == null ? '' : m.y < 0 ? `عام ${-m.y} ق.م` : `عام ${m.y}`; };
const movedNote = (m, bare) => { if (!m) return ''; const t = k => `«<bdi dir="ltr">${esc(titleOfKey(k))}</bdi>»`, r = m.ref || [], y = yearText(m);
  const head = m.w === 'between' && r.length >= 2 ? `بين ${t(r[0])} و${t(r[r.length - 1])}` : m.w === 'year' ? (y ? `أحداثه ${y}` : 'أقدم أحداثاً') : r.length ? `قبل ${t(r[0])}` : 'قبل القصة';
  return head + (m.w !== 'year' && y ? `، ${y}` : '') + (bare ? '' : m.src?.length >= 2 ? ' · مؤكد من مصدرين' : m.src?.length === 1 ? ` · مصدره <bdi>${SRCN[m.src[0]] || esc(m.src[0])}</bdi> فقط` : ''); };
// مصادر التقديم في الدليل: «مؤكد من ثلاثة مصادر: …» أو «مصدر واحد: …»
const srcLine = src => { const n = src?.length || 0, l = (src || []).map(x => `<bdi>${SRCN[x] || esc(x)}</bdi>`).join(' · ');
  return !n ? '' : n === 1 ? `مصدر واحد: ${l}` : `مؤكد من ${n === 2 ? 'مصدرين' : (['', '', '', 'ثلاثة', 'أربعة'][n] || n) + ' مصادر'}: ${l}`; };
const row = (f, s, i, opt, far) => { const l = listedOf(s), o = infoOf(s), w = l && st(l.id) === 'watched', here = isHere(f, s), k0 = kindOf(s), k = k0 && s.note?.includes(k0) ? '' : k0;
  const rec = s.rec || (opt?.auto && (o.date ? o.date > today : !o.year) ? 'soon' : ''), mv = opt?.moved?.[keyOfStep(s)];
  return `<li data-n="${i + 1}" class="${[here ? 'here' : '', w ? 'watched' : '', rec ? 'r-' + rec : '', far ? 'far' : ''].filter(Boolean).join(' ')}"><span class="th"${o.poster ? ` data-zoom-pinch data-zoom-title="${esc(o.title || '')}"` : ''}>${o.poster ? `<img loading="lazy" alt="" src="${IMG}w92${o.poster}">` : esc(k0)}</span>
<span class="t"><b>${esc(o.title || '')}</b><small>${[k, whenOf(o), o.rating ? `<bdi dir="ltr">${o.rating.toFixed(1)}</bdi>` : '', s.note ? ar(s.note) : '', mv ? movedNote(mv) : ''].filter(Boolean).join(' · ')}</small></span>
<span class="st">${rec ? `<i class="rc ${rec}">${REC[rec]}</i>` : ''}<small>${here ? 'هذا العمل' : w ? 'شاهدته' : l ? 'في قائمتك' : 'خارج قائمتك'}</small></span>${here ? '' : s.x && !s.url ? '' : s.x ? `<a class="go" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(o.title || '')}"></a>` : `<button class="go" data-act="${l ? 'open' : 'add-part'}" data-id="${l ? l.id : ''}"${outRef(s)} data-q="${esc(o.title || '')}${o.year ? ' ' + o.year : ''}" aria-label="${l ? 'افتح' : 'اعرض'} ${esc(o.title || '')}"></button>`}</li>`; };
// ترتيب طويل (أكثر من ١٤ عملاً) يُختصر إلى نافذة حول هذا العمل، وزر يعرضه كاملاً
const rowsHTML = (f, order, opt) => { const n = order.length, at = Math.max(0, order.findIndex(s => isHere(f, s))), clip = n > 14, lo = Math.max(0, Math.min(at - 4, n - 9)), hi = lo + 8;
  return `<ol class="order${clip ? ' clip' : ''}">${order.map((s, i) => row(f, s, i, opt, clip && (i < lo || i > hi))).join('')}</ol>${clip ? `<button class="more" data-act="more" aria-expanded="false">اعرض الترتيب كاملاً (${n})</button>` : ''}`; };
// ما وجده محرّك الأحداث: الترتيب حسب الأحداث ودليله مطوي تحته، أو أن المصادر لا تذكر جزءاً يسبق القصة، أو أنه لم يُفحص بعد
const SRCN = { wikipedia: 'Wikipedia', tmdb: 'TMDB', wikidata: 'Wikidata', title: 'العنوان' };
const chronoTail = g => g.chrono ? '، ثم رتّبه حسب أحداث القصة مما تذكره <bdi dir="ltr">Wikipedia</bdi> و<bdi dir="ltr">TMDB</bdi> و<bdi dir="ltr">Wikidata</bdi> عن كل جزء، والمعتاد للمشاهدة الأولى ترتيب الصدور. لم يُراجَع يدوياً بعد، فلا توصيات فيه.'
  : g.chk ? '. لم يُراجَع يدوياً بعد، فلا توصيات فيه. وقد فُحصت مقدمات <bdi dir="ltr">Wikipedia</bdi> وكلمات <bdi dir="ltr">TMDB</bdi> لكل أجزائه، فلم يُذكر فيها جزء تسبق أحداثه ما صدر قبله، فبقي بترتيب الصدور.'
  : '. لم يُراجَع يدوياً بعد، فلا توصيات فيه، وقد يختلف عن ترتيب الأحداث إن كان بينها جزء يسبق القصة.';
const evidenceHTML = c => c ? `<details class="why"><summary>كيف رُتّب حسب الأحداث؟</summary><ul>${Object.entries(c.moved).map(([k, m]) => `<li><b dir="ltr">${esc(titleOfKey(k))}</b> ${movedNote(m, true)}<small>${srcLine(m.src)}</small>${
  (m.q || []).map(q => `<blockquote dir="ltr" lang="en">${esc(q.t)} ${q.u ? `<a href="${esc(q.u)}" target="_blank" rel="noopener">${SRCN[q.s] || q.s}</a>` : `<cite>${SRCN[q.s] || q.s}</cite>`}</blockquote>`).join('')}</li>`).join('')}</ul></details>` : '';
const autoNote = g => `<p class="note">${g.kind === 'chain'
  ? `رتّبه الدليل آلياً حسب تاريخ الصدور، من روابط «يسبقه» و«يليه» بين هذه الأعمال في ${ext('Wikidata', 'https://www.wikidata.org/wiki/' + g.wd)}، ومعلوماتها من <bdi dir="ltr">TMDB</bdi>`
  : `رتّبه الدليل آلياً ${g.by === 'ord' ? 'برقم كل جزء في السلسلة' : 'حسب تاريخ الصدور'}، من بيانات ${ext('Wikidata', 'https://www.wikidata.org/wiki/' + g.wd)} و<bdi dir="ltr">TMDB</bdi>${g.wiki ? `، وتفصيله في ${ext('Wikipedia', g.wiki)}` : ''}`}${chronoTail(g)}</p>${evidenceHTML(g.chrono)}`;
const noteOf = g => g.curated ? `<p class="note">الترتيب والتوصيات من إعداد الدليل، مبنية على ترابط القصة وتقييم <bdi dir="ltr">TMDB</bdi> الظاهر بجانب كل عمل${g.sources?.length ? `. المصادر: ${g.sources.map(x => ext(x.name, x.url)).join('، ')}` : ''}.</p>`
  : g.auto ? autoNote(g) : `<p class="note">الأجزاء من مجموعة <bdi dir="ltr">TMDB</bdi> وتشمل الأفلام فقط${g.wiki ? `، وتفصيل السلسلة في ${ext('Wikipedia', g.wiki)}` : ''}. رتّبها الدليل آلياً حسب تاريخ الصدور${chronoTail(g)}</p>${evidenceHTML(g.chrono)}`;
// عوالم أوسع يقع فيها العمل (لغير الترتيب المراجَع): كل واحد يضيف أعمالاً لم تظهر، مطويّاً، واثنان على الأكثر
function widerHTML(f, g) { if (g.curated) return ''; const have = new Set(g.order.map(keyOfStep)); let out = '', n = 0;
  for (const id of worldIds(keyOf(f))) { const w = D.worlds[id]; if ('w:' + id === g.key || n >= 2 || !w.order.some(x => !have.has(x))) continue; w.order.forEach(x => have.add(x)); n++;
    out += `<details class="wider"><summary><b>${WKIND[w.kind]} أوسع</b><bdi dir="ltr">${esc(w.name)}</bdi><small>${nWorks(w.order.length)}</small></summary>${rowsHTML(f, worldGroup(id).order, { auto: true, moved: w.chrono?.moved })}${autoNote(worldGroup(id))}</details>`; }
  return out; }
// العمل نفسه في دليل DC أو Fate: رابط إلى بطاقته هناك
const DOORS = { dc: 'DC', fate: 'Fate' };
const xdoorHTML = gd => gd && DOORS[gd.door] ? `<a class="xdoor" href="../${gd.door}/#w=${encodeURIComponent(gd.id)}"><span><b>في دليل <bdi dir="ltr">${DOORS[gd.door]}</bdi> أيضاً</b><small>افتح بطاقته هناك، وترتيبه ضمن عالمه في الدليل</small></span></a>` : '';
const aloneText = f => { const k = keyOf(f), live = D.wlive.get(k);
  if (live === 'wait') return '<span class="wait">أبحث عن سلسلته وعالمه في <bdi dir="ltr">Wikidata</bdi>…</span>';
  const both = live === 'done' || (D.wok && D.byId.has(k) && !D.byId.get(k).fresh), src = both ? '<bdi dir="ltr">TMDB</bdi> و<bdi dir="ltr">Wikidata</bdi>' : '<bdi dir="ltr">TMDB</bdi>';
  return f.kind === 'tv' ? `مسلسل لا تجمعه سلسلة ولا عالم مشترك بأعمال أخرى في ${src}.` : `فيلم مستقل: لا أجزاء أخرى له ولا عالم مشترك في ${src}.`; };
// ترتيب الصدور: حسب التاريخ، وما لا موعد له آخراً. السلسلة المراجَعة مرتبة حسب أحداثها، وview يذكر المُوصى به للمشاهدة الأولى
// (release: ترتيب الصدور كما أرادها صنّاعها، either: يصح الترتيبان، chrono: الأحداث). يظهر التبديل حين يختلف الترتيبان
const dateKey = s => { const o = infoOf(s); return o.date || (o.year ? o.year + '-12-31' : '9999'); };
const byRelease = order => order.map((s, i) => [s, i]).sort((a, b) => dateKey(a[0]).localeCompare(dateKey(b[0])) || a[1] - b[1]).map(x => x[0]);
const firstReleased = g => g.order.indexOf(byRelease(g.order)[0]);
function viewsHTML(f, g) { const rel = byRelease(g.order);
  const opt = { auto: g.auto, moved: g.chrono?.moved };
  if (!g.view || rel.every((s, i) => s === g.order[i])) return rowsHTML(f, g.order, opt);
  // ملاحظة السلسلة فوق التبديل تشرح لماذا يختلف الترتيبان وأيهما المُوصى به، فلا يتكرر الشرح هنا
  const tab = (v, t) => `<button data-act="ordv" data-v="${v}" aria-pressed="${ui.ov === v}">${t}${g.view === v ? '<small>المُوصى به</small>' : ''}</button>`;
  return `<div class="ordv" role="group" aria-label="ترتيب العرض">${tab('chrono', 'ترتيب الأحداث')}${tab('release', 'ترتيب الصدور')}</div>
<div data-ov="chrono"${ui.ov === 'chrono' ? '' : ' hidden'}>${rowsHTML(f, g.order, opt)}</div><div data-ov="release"${ui.ov === 'release' ? '' : ' hidden'}>${rowsHTML(f, rel, opt)}</div>`; }
function orderHTML(f) { const g = groupOf(f), door = xdoorHTML(D.wworks[keyOf(f)]?.guide);
  if (!g) return `<section class="sec"><h3>السلسلة وترتيب المشاهدة</h3>${door}<p>${aloneText(f)}</p></section>`;
  return `<section class="sec"><h3>ترتيب المشاهدة: <bdi dir="ltr">${esc(g.name)}</bdi>${g.auto ? ` <span class="wk">${WKIND[g.kind]}</span>` : ''}</h3>${door}${g.note ? `<p>${ar(g.note)}</p>` : ''}${viewsHTML(f, g)}${noteOf(g)}${widerHTML(f, g)}</section>`; }
// أعمال مرتبطة: الأصل وما اقتُبس عنه واقتباسات أخرى للمصدر نفسه، والمصدر نفسه إن كان كتاباً أو لعبة. ما ظهر في الترتيب لا يتكرر هنا
const relCard = r => { const s = stepOf(r.k), l = listedOf(s), o = infoOf(s);
  return `<button class="part${l && st(l.id) === 'watched' ? ' watched' : ''}" data-act="${l ? 'open' : 'add-part'}" data-id="${l ? l.id : ''}"${l ? '' : outRef(s)} data-q="${esc(o.title || '')}${o.year ? ' ' + o.year : ''}">
<span class="p"${o.poster ? ` data-zoom-pinch data-zoom-title="${esc(o.title || '')}"` : ''}>${poster(o.poster, '100px') || slate(o)}<span class="rl ${r.r}">${RELN[r.r]}</span></span><b>${esc(o.title || '')}</b><small>${[kindOf(s), o.year, r.r === 'sibling' && r.via ? `عن <bdi dir="ltr">${esc(r.via)}</bdi>` : '', l ? 'في قائمتك' : ''].filter(Boolean).join(' · ')}</small></button>`; };
function relatedHTML(f) { const w = D.wworks[keyOf(f)]; if (!w) return '';
  const shown = new Set((groupOf(f)?.order || []).map(keyOfStep)), rel = (w.rel || []).filter(r => !shown.has(r.k) && infoOf(stepOf(r.k)).title);
  const src = (w.src || []).map(x => { const t = `مقتبس عن ${SRCK[x.kind] || 'عمل'} «<bdi dir="ltr">${esc(x.label)}</bdi>»${x.year ? ` <bdi>(${x.year})</bdi>` : ''}`;
    return `<li>${x.wiki ? `<a href="${esc(x.wiki)}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`}</li>`; }).join('');
  if (!rel.length && !src) return '';
  return `<section class="sec"><h3>أعمال مرتبطة</h3>${src ? `<ul class="srcs">${src}</ul>` : ''}${rel.length ? `<div class="reel rels">${rel.map(relCard).join('')}</div>` : ''}
<p class="note">العلاقات آلية من ${ext('Wikidata', 'https://www.wikidata.org/wiki/' + (w.q || ''))}: الأصل الذي اقتُبس منه العمل، وما اقتُبس عنه من ريميك أو مسلسل، واقتباسات أخرى للمصدر نفسه.</p></section>`; }
const worldHTML = f => orderHTML(f) + relatedHTML(f);
// يعيد رسم قسم العالم في البطاقة المفتوحة (بعد وصول خريطة العوالم أو نتيجة البحث المباشر)
const slotOf = { k: null, f: null };
const refreshSlot = () => { const el = $('#wslot'); if (el && sheet.open && slotOf.f && el.dataset.k === slotOf.k) el.innerHTML = worldHTML(slotOf.f); };
// عمل جديد أو بطاقة اطلاع: سلسلته وعالمه من Wikidata عبر الخادم، مرة واحدة لكل عمل. الفشل يُبقي ما لدينا (مجموعة TMDB أو «مستقل»)
function liveWorlds(f) { const k = keyOf(f); if (!pass() || D.wlive.has(k)) return;
  D.wlive.set(k, 'wait'); refreshSlot();
  api({ action: 'worlds', tmdb: f.tmdb, kind: f.kind }, pass()).then(r => { mergeWorlds(r); D.wres.set(k, r); D.wlive.set(k, 'done'); keepPending(k); })
    .catch(() => D.wlive.set(k, 'fail')).finally(() => { refreshSlot(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); }); }
// عالم عمل مضاف يُحفظ مع إضافته المعلّقة، فيبقى ظاهراً حتى يصل البناء القادم
function keepPending(k) { const r = D.wres.get(k); if (!r) return; try { const p = JSON.parse(localStorage.getItem(PEND) || '[]'), e = p.find(x => x?.film?.id === k); if (e && !e.worlds) { e.worlds = r; localStorage.setItem(PEND, JSON.stringify(p)); } } catch {} }
function whereSec(f) { const p = f.prov, g = (t, ids) => ids.length ? `<div class="wgroup"><b>${t}</b><div class="wlist">${ids.map(id => `<a href="${esc(p.link || '#')}" target="_blank" rel="noopener">${D.prov[id]?.logo ? `<img alt="" src="${IMG}w92${D.prov[id].logo}">` : ''}${esc(D.prov[id]?.name || id)}</a>`).join('')}</div></div>` : '';
  const body = p ? g('باشتراك', p.stream) + g('مجاناً', p.free) + g('إيجار', p.rent) + g('شراء', p.buy) : '';
  return `<section class="sec"><h3>أين تشاهده في السعودية</h3>${body || `<p>${unreleased(f) ? 'لم يصدر بعد.' : 'غير متاح على منصات السعودية حالياً حسب بيانات <bdi dir="ltr">JustWatch</bdi>.'}</p>`}${body ? '<p class="note">الأزرار تفتح صفحة أماكن العرض على <bdi dir="ltr">TMDB</bdi>، ومنها إلى المنصة. البيانات من <bdi dir="ltr">JustWatch</bdi> وتتحدث يومياً.</p>' : ''}</section>`; }
function linksSec(f) { const ua = navigator.userAgent, ww = /android/i.test(ua) ? 'https://play.google.com/store/apps/details?id=com.whattawatch' : /iphone|ipad|ipod/i.test(ua) ? 'https://apps.apple.com/app/id6444618445' : 'https://whattawatch.com/';
  const a = (href, name, sub) => `<a href="${href}" target="_blank" rel="noopener"><b>${name}</b><small>${sub}</small></a>`;
  return `<section class="sec"><h3>صفحته في المواقع</h3><div class="links">${f.imdb ? a(`https://www.imdb.com/title/${f.imdb}/`, 'IMDb', 'التقييم والطاقم') : ''}${f.kind === 'movie' ? a(`https://letterboxd.com/tmdb/${f.tmdb}`, 'Letterboxd', 'المراجعات والقوائم') : ''}${a(`https://www.themoviedb.org/${f.kind}/${f.tmdb}`, 'TMDB', 'مصدر البيانات')}
<a href="${ww}" target="_blank" rel="noopener" data-act="ww" data-t="${esc(f.title)}"><b>WhattaWatch</b><small>يفتح التطبيق وينسخ اسم الفيلم للبحث</small></a></div></section>`; }
// pv: بطاقة اطلاع لعمل ليس في القائمة (من TMDB مباشرة): معلوماته الكاملة، وبدل أزرار الحالة زر «أضفه إلى قائمتي»
async function sheetHTML(f, pv = null) { await Promise.race([D.worldsReady, new Promise(r => setTimeout(r, 2500))]);
  const m = pv?.more || (await D.moreReady)?.[f.id] || {}, s = st(f.id), un = unreleased(f); slotOf.k = keyOf(f); slotOf.f = f;
  const ov = m.overviewAr ? `<p>${ar(m.overviewAr)}</p>${m.arSource === 'guide' ? '' : '<p class="note">نبذة <bdi dir="ltr">TMDB</bdi> العربية كما هي، لم نراجعها بعد.</p>'}` : m.overviewEn ? `<p dir="ltr" lang="en" style="text-align:left">${esc(m.overviewEn)}</p><p class="note">النبذة بالإنجليزية، والترجمة قيد الإعداد.</p>` : '<p>لا توجد نبذة.</p>';
  return `<div class="sh-hero">${f.backdrop ? `<img alt="" src="${IMG}w780${f.backdrop}" srcset="${IMG}w780${f.backdrop} 780w, ${IMG}w1280${f.backdrop} 1280w" sizes="(max-width:880px) 100vw, 880px">` : ''}</div>
<div class="sh-head">${f.poster ? `<button type="button" class="poster" data-zoom="" data-zoom-title="${esc(f.title)}" aria-label="تكبير بوستر ${esc(f.title)}">${poster(f.poster, '170px')}</button>` : `<div class="poster">${slate(f)}</div>`}<div class="txt"><h2>${esc(f.title)}</h2>${f.orig ? `<p class="orig">${esc(f.orig)}</p>` : ''}
<p class="facts">${[f.kind === 'tv' ? 'مسلسل' : '', f.year ? `<bdi>${f.year}</bdi>` : '', rt(f.runtime), f.seasons ? count(f.seasons, ['موسم واحد', 'موسمان', 'مواسم', 'موسماً', 'موسم']) : '', f.cert ? `<bdi dir="ltr">${esc(f.cert)}</bdi>` : '', LANGS[f.lang] ? 'اللغة ' + LANGS[f.lang] : '', f.rating ? `<span class="rate">تقييم <bdi dir="ltr">TMDB ${f.rating.toFixed(1)}</bdi></span>` : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</p>
<div class="tags">${f.genres.map(g => GENRES[g] ? `<span>${GENRES[g]}</span>` : '').join('')}</div></div></div>
${pv ? `<div class="sh-acts"><button class="btn pri" data-act="preview-add" data-tmdb="${f.tmdb}" data-kind="${f.kind}">${ic('plus')}أضفه إلى قائمتي</button></div>
<section class="sec"><p class="ask">ليس في قائمتك. هذه بطاقة للاطلاع، ومعلوماتها آلية من <bdi dir="ltr">TMDB</bdi>.</p></section>`
  : `<div class="sh-acts"><button class="btn sec" data-act="set" data-v="watched" aria-pressed="${s === 'watched'}">${ic('check')}شاهدته</button><button class="btn sec nx" data-act="set" data-v="next" aria-pressed="${s === 'next'}">${ic('mark')}التالي في المشاهدة</button></div>`}
${f.ask ? `<section class="sec"><p class="ask">${esc(f.ask)}</p></section>` : ''}${f.src === 'added' ? '<section class="sec"><p class="ask">أُضيف بزر «أضف فيلماً»: معلوماته آلية من <bdi dir="ltr">TMDB</bdi> ولم تُراجَع يدوياً.</p></section>' : ''}
<section class="sec"><h3>القصة</h3>${ov}</section>${un ? `<section class="sec"><h3>موعد الصدور</h3>${f.date ? leader(f.date, `يصدر في <bdi>${dateAr(f.date)}</bdi> حسب <bdi dir="ltr">TMDB</bdi>، والموعد قابل للتغيير.`) : leader(null, 'معلن، ولم يُحدَّد موعد صدوره بعد.')}</section>` : ''}${nextEp(f) ? (n => `<section class="sec"><h3>${n.e === 1 ? 'الموسم القادم' : 'الحلقة القادمة'}</h3>${leader(n.date, `${n.e === 1 ? `الموسم ${n.s} يبدأ` : `الموسم ${n.s}، الحلقة ${n.e}: تُعرض`} في <bdi>${dateAr(n.date)}</bdi> حسب <bdi dir="ltr">TMDB</bdi>، والموعد قابل للتغيير.`, n.e === 1 ? 'يبدأ اليوم' : 'تُعرض اليوم')}</section>`)(nextEp(f)) : ''}
${whereSec(f)}<div id="wslot" data-k="${keyOf(f)}">${worldHTML(f)}</div>
${(m.directors?.length || m.cast?.length) ? `<section class="sec"><h3>الطاقم</h3><p class="people">${m.directors?.length ? `<b>${f.kind === 'tv' ? 'صنّاع المسلسل' : 'الإخراج'}:</b> <bdi dir="ltr">${m.directors.map(esc).join(', ')}</bdi><br>` : ''}${m.cast?.length ? `<b>التمثيل:</b> <bdi dir="ltr">${m.cast.map(esc).join(', ')}</bdi>` : ''}</p></section>` : ''}
${linksSec(f)}`; }
async function openFilm(id, push = true) { const f = D.byId.get(id); if (!f) return; openId = id; $('#sheet-body').innerHTML = await sheetHTML(f); $('#sheet-body').scrollTop = 0; if (f.fresh && !D.wworks[id]?.q) liveWorlds(f);
  if (!sheet.open) { sheet.showModal(); if (!calm) sheet.animate(innerWidth <= 640 ? { transform: ['translateY(6%)', 'none'], opacity: [0, 1] } : { transform: ['scale(.97)', 'none'], opacity: [0, 1] }, { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (push) history.pushState({ film: id }, '', '#' + id); } else if (push) history.replaceState({ film: id }, '', '#' + id); }
function closeFilm(fromPop) { if (!sheet.open) return; openId = null; const done = () => sheet.close();
  if (calm) done(); else { const a = sheet.animate({ opacity: [1, 0], transform: ['none', innerWidth <= 640 ? 'translateY(5%)' : 'scale(.98)'] }, { duration: 160, easing: 'ease-in' }); a.onfinish = done; setTimeout(done, 300); }
  if (!fromPop && history.state?.film) history.back(); else if (!fromPop && location.hash) history.replaceState(null, '', location.pathname + location.search); }
addEventListener('popstate', () => { const id = location.hash.slice(1); if (id && D.byId.has(id)) openFilm(id, false); else closeFilm(true); });
sheet.addEventListener('cancel', e => { e.preventDefault(); closeFilm(); });
sheet.addEventListener('click', e => { if (e.target === sheet) closeFilm(); });
addDlg.addEventListener('click', e => { if (e.target === addDlg) addDlg.close(); });

function setStatus(id, v) { const cur = st(id); if (cur === v) delete P.films[id]; else P.films[id] = v; save();
  const el = document.getElementById('f-' + id); if (el) { el.classList.add('stamping'); el.classList.toggle('watched', st(id) === 'watched'); el.classList.toggle('next', st(id) === 'next'); $('.seen', el).setAttribute('aria-pressed', st(id) === 'watched'); setTimeout(() => el.classList.remove('stamping'), 400); }
  if (openId === id) $$('.sh-acts [data-act=set]').forEach(b => b.setAttribute('aria-pressed', st(id) === b.dataset.v));
  if (ui.view === 'series') $('#series').innerHTML = seriesHTML();
  const f = D.byId.get(id); if (el && !el.hidden && f && !match(f) && !calm) { el.classList.add('leaving'); setTimeout(() => { el.classList.remove('leaving'); apply(false); }, 850); } else apply(false); }

// ---------- أضف فيلماً ----------
const pass = () => { try { return localStorage.getItem(PASS) || ''; } catch { return ''; } };
async function api(body, password) { let r; try { r = await fetch('/api/add-film', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, password }) }); } catch { throw new Error('تعذّر الاتصال. تأكد من الإنترنت وحاول ثانية.'); }
  if (r.status === 401) { try { localStorage.removeItem(PASS); } catch {} $('#add-pass-wrap').hidden = false; throw new Error('كلمة السر غير صحيحة.'); }
  if (r.status === 404 || r.status === 405) throw new Error('الإضافة تعمل من نسخة الموقع على Netlify فقط.');
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'حدث خطأ في الخادم. حاول بعد قليل.'); return j; }
function openAdd(q = '') { $('#add-q').value = q; $('#add-msg').textContent = ''; $('#cands').innerHTML = ''; $('#add-pass-wrap').hidden = !!pass(); if (!addDlg.open) addDlg.showModal(); (pass() || !q ? $('#add-q') : $('#add-pass')).focus(); if (q && pass()) $('#add-form').requestSubmit(); }
$('#add-form').addEventListener('submit', async e => { e.preventDefault(); const q = $('#add-q').value.trim(), pw = $('#add-pass').value || pass(), msg = $('#add-msg'); if (!q) return;
  if (!pw) { msg.textContent = 'اكتب كلمة السر أولاً.'; $('#add-pass-wrap').hidden = false; $('#add-pass').focus(); return; }
  msg.textContent = 'أبحث…'; $('#cands').innerHTML = '';
  try { const r = await api({ action: 'search', q }, pw); try { localStorage.setItem(PASS, pw); } catch {} $('#add-pass-wrap').hidden = true; $('#add-pass').value = '';
    if (!r.candidates.length) { msg.textContent = `لم أجد فيلماً باسم «${r.parsed.title}»${r.parsed.year ? ` وسنة ${r.parsed.year}` : ''}. تأكد من الإملاء أو السنة.`; return; }
    msg.textContent = r.parsed.year ? `فهمت: «${r.parsed.title}»، سنة ${r.parsed.year}. اختر المقصود:` : `فهمت: «${r.parsed.title}» بلا سنة. اختر المقصود:`;
    $('#cands').innerHTML = r.candidates.map(c => { const has = D.byId.has((c.kind === 'tv' ? 't' : 'm') + c.tmdb);
      return `<div class="cand"><span class="th"${c.poster ? ` data-zoom-pinch data-zoom-title="${esc(c.title)}"` : ''}>${c.poster ? `<img alt="" src="${IMG}w92${c.poster}">` : ''}</span><span><b>${esc(c.title)}</b><small>${[c.kind === 'tv' ? 'مسلسل' : 'فيلم', c.year, c.collection ? `من سلسلة ${esc(c.collection)}` : ''].filter(Boolean).join(' · ')}</small></span>
<span class="cbtns">${has ? `<small>في قائمتك</small><button class="btn sec" type="button" data-act="cand-open" data-id="${(c.kind === 'tv' ? 't' : 'm') + c.tmdb}">افتح بطاقته</button>`
  : `<button class="btn sec" type="button" data-act="preview" data-tmdb="${c.tmdb}" data-kind="${c.kind}">التفاصيل</button><button class="btn pri" type="button" data-act="add-pick" data-tmdb="${c.tmdb}" data-kind="${c.kind}">أضفه</button>`}</span></div>`; }).join('');
  } catch (err) { msg.textContent = err.message; } });
// يضيف العمل إلى القائمة (في الخادم ثم هنا فوراً) ويفتح بطاقته
async function addFilm(tmdb, kind, btn, label) { const msg = $('#add-msg'); btn.disabled = true; btn.textContent = 'يُضاف…';
  try { const r = await api({ action: 'add', tmdb, kind }, pass()); adopt(r, true);
    try { const p = JSON.parse(localStorage.getItem(PEND) || '[]'); p.push(r); localStorage.setItem(PEND, JSON.stringify(p)); } catch {}
    keepPending(r.film.id); if (addDlg.open) addDlg.close(); toast(`أُضيف «${r.film.title}»`); openFilm(r.film.id, !sheet.open);
  } catch (err) { if (addDlg.open) msg.textContent = err.message; else toast(err.message); btn.disabled = false; btn.innerHTML = label; } }
const addPick = btn => addFilm(+btn.dataset.tmdb, btn.dataset.kind, btn, 'أضفه');
// بطاقة اطلاع: يجلب العمل كاملاً من TMDB عبر الخادم دون إضافته. تُحفظ في الذاكرة فلا يتكرر الطلب.
// تُفتح فوق نافذة البحث (فإغلاقها يعيدك إلى النتائج) أو مكان البطاقة المفتوحة، وزر الرجوع في الجوال يغلقها.
const previews = new Map();
async function openPreview(tmdb, kind, btn) { const id = (kind === 'tv' ? 't' : 'm') + tmdb; if (D.byId.has(id)) { if (addDlg.open) addDlg.close(); return openFilm(id); }
  if (!pass()) return openAdd(btn?.dataset.q || '');
  const label = btn?.innerHTML; if (btn) { btn.disabled = true; btn.textContent = 'يجهّز…'; }
  try { let r = previews.get(id); if (!r) { r = await api({ action: 'preview', tmdb, kind }, pass()); previews.set(id, r); }
    Object.assign(D.prov, r.providers || {}); if (r.collection && !D.cols[r.collection.id]) { D.cols[r.collection.id] = r.collection; for (const p of r.collection.parts) if (!D.part.has(p.tmdb)) D.part.set(p.tmdb, p); }
    const [light, heavy] = split(r.film), k = keyOf(light); openId = null;
    D.winfo[k] ||= { title: light.title, date: light.date, year: light.year, poster: light.poster, rating: light.rating, votes: light.votes, genres: light.genres, lang: light.lang, runtime: light.runtime };
    $('#sheet-body').innerHTML = await sheetHTML(light, { more: heavy }); $('#sheet-body').scrollTop = 0; liveWorlds(light);
    if (!sheet.open) { sheet.showModal(); if (!calm) sheet.animate({ opacity: [0, 1], transform: [innerWidth <= 640 ? 'translateY(6%)' : 'scale(.97)', 'none'] }, { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }); history.pushState({ film: 'preview' }, '', location.pathname + location.search); }
  } catch (err) { if (addDlg.open) $('#add-msg').textContent = err.message; else toast(err.message); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } } }
// يُدخل فيلماً عاد من الخادم (أو محفوظاً بانتظار وصوله في البناء القادم) في القائمة المعروضة
function adopt(r, draw) { if (!r?.film || D.byId.has(r.film.id)) return false; const [light, heavy] = split(r.film); light.fresh = true; light.ord = -Date.now(); stale(); Object.assign(D.prov, r.providers || {}); if (r.worlds) { mergeWorlds(r.worlds); D.wlive.set(light.id, 'done'); }
  if (r.collection && !D.cols[r.collection.id]) { D.cols[r.collection.id] = r.collection; for (const p of r.collection.parts) D.part.set(p.tmdb, p); } register(light, heavy);
  if (draw) { $('#grid').insertAdjacentHTML('afterbegin', card(light)); $('#chips').innerHTML = chipsHTML(); apply(false); } return true; }

// ---------- الأحداث ----------
document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act, id = t.dataset.id || t.closest('[data-id]')?.dataset.id;
  if (act === 'open') openFilm(id);
  else if (act === 'seen') { setStatus(id, 'watched'); if (st(id) === 'watched') toast(ui.status === 'todo' && !ui.q ? 'شوهد، وانتقل إلى «شاهدته»' : 'خُتمت التذكرة: شوهد', () => setStatus(id, 'watched')); }
  else if (act === 'set') setStatus(openId, t.dataset.v);
  else if (act === 'close') closeFilm();
  else if (act === 'close-add') addDlg.close();
  else if (act === 'status') { ui.status = t.dataset.v; $$('[data-act=status]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === ui.status)); apply(false); }
  else if (act === 'only-series') { ui.series = !ui.series; t.setAttribute('aria-pressed', ui.series); apply(false); }
  else if (act === 'show-all') { ui.status = 'all'; $('#chips').innerHTML = chipsHTML(); apply(false); }
  else if (act === 'reset') { Object.assign(ui, { q: '', status: 'todo', genre: '', decade: '', prov: '', series: false }); $('#q').value = ''; $('#chips').innerHTML = chipsHTML(); apply(false); }
  else if (act === 'view') setView(t.dataset.v);
  else if (act === 'reroll') reroll(false);
  else if (act === 'open-tonight') openFilm(tonightId);
  else if (act === 'add') openAdd();
  else if (act === 'add-part') { if (t.dataset.tmdb && pass()) openPreview(+t.dataset.tmdb, t.dataset.kind, t); else { if (sheet.open) closeFilm(); openAdd(t.dataset.q); } }
  else if (act === 'preview') openPreview(+t.dataset.tmdb, t.dataset.kind, t);
  else if (act === 'preview-add') addFilm(+t.dataset.tmdb, t.dataset.kind, t, t.innerHTML);
  else if (act === 'cand-open') { addDlg.close(); openFilm(t.dataset.id); }
  else if (act === 'ordv') { ui.ov = t.dataset.v; const box = t.closest('.sec'); $$('[data-act=ordv]', box).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ui.ov))); $$('[data-ov]', box).forEach(el => { el.hidden = el.dataset.ov !== ui.ov; }); }
  else if (act === 'more') { const ol = t.previousElementSibling, clip = ol.classList.toggle('clip'); t.setAttribute('aria-expanded', String(!clip)); t.textContent = clip ? `اعرض الترتيب كاملاً (${ol.children.length})` : 'اختصر الترتيب'; }
  else if (act === 'add-pick') addPick(t);
  else if (act === 'ww') { try { navigator.clipboard?.writeText(t.dataset.t).then(() => toast('نُسخ اسم الفيلم، الصقه في بحث التطبيق')); } catch {} } });
document.addEventListener('change', e => { const s = e.target.closest('select[data-k]'); if (!s) return; ui[s.dataset.k] = s.value; s.classList.toggle('on', !!s.value || s.dataset.k === 'sort'); apply(s.dataset.k === 'sort'); });
let qt; $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { ui.q = e.target.value.trim().toLowerCase(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); apply(false); }, 140); });

// ---------- الإقلاع ----------
const liftVeil = () => { const v = $('#veil'); if (!v || v.hidden) return; requestAnimationFrame(() => requestAnimationFrame(() => { v.classList.add('lift'); setTimeout(() => v.remove(), calm ? 0 : 900); })); };
try {
  const [films, prov, cols, fr] = await Promise.all([get('films.json'), get('providers.json'), get('collections.json'), get('franchises.json').catch(() => ({}))]);
  D.prov = prov; D.cols = cols; D.fr = fr.items || {}; D.fx = fr.extras || {}; for (const f of films.films) register(f);
  for (const c of Object.values(cols)) for (const p of c.parts) D.part.set(p.tmdb, p);
  for (const [k, g] of Object.entries(D.fr)) for (const st of g.order) { const id = st.m ? 'm' + st.m : st.t ? 't' + st.t : null; if (id) { D.frOf.set(id, k); D.recOf.set(id, st.rec); } }
  D.moreReady = get('more.json').then(m => { D.more = { ...m, ...(D.more || {}) }; for (const f of D.films) delete f._h; return D.more; }).catch(() => (D.more ||= {}));
  // خريطة العوالم بعد القائمة: لا تؤخر الرسم الأول. حين تصل يُعاد رسم ما يعتمد عليها
  D.worldsReady = get('worlds.json').then(w => { mergeWorlds(w); D.wok = true; refreshSlot(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); apply(ui.sort === 'list'); }).catch(() => {});
  // ما أُضيف بالزر ولم يصل البناء بعد يبقى ظاهراً من الحفظ المحلي، ويُحذف منه عند وصوله
  try { const pend = JSON.parse(localStorage.getItem(PEND) || '[]'), keep = pend.filter(r => r?.film && !D.byId.has(r.film.id)); D.more ||= {}; keep.forEach(r => adopt(r, false)); localStorage.setItem(PEND, JSON.stringify(keep)); } catch {}
  renderGrid(); reroll(true); liftVeil();
  // حين تغيب الترويسة ينزل زر البوابات إلى أول الشريط الثابت
  { const bar = $('.bar'), g = bar.querySelector('.gate'); new IntersectionObserver(([e]) => { const on = !e.isIntersecting; bar.classList.toggle('docked', on); g.tabIndex = on ? 0 : -1; g.setAttribute('aria-hidden', String(!on)); }).observe($('.top')); }
  // تغيير وصل من جهاز آخر: نعيد قراءة السجل ونرسم
  initSync(id => { if (id !== 'films') return; try { P = { films: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {} renderGrid(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); });
  const h = location.hash.slice(1); if (h && D.byId.has(h)) openFilm(h, false);
} catch (err) { $('#grid').innerHTML = '<p class="load">تعذّر تحميل القائمة. حدّث الصفحة.</p>'; liftVeil(); console.error(err); }
