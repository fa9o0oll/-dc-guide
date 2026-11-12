// قائمة أفلامي: شبكة تذاكر، بحث وتصفية، نافذة لكل فيلم (معلوماته، أين يُعرض في السعودية، ترتيب سلسلته)، وزر «أضف فيلماً».
// البيانات تُبنى في scripts/build-films.mjs. سجل المشاهدة يُحفظ في المتصفح بالمفتاح filmsg.progress.
import { initSync, touch as syncTouch } from './sync.js?v=__BUILD__';
import { ar } from './bidi.js?v=__BUILD__';
import { segs } from './count.js?v=__BUILD__';
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
// عدّاد حي حتى منتصف ليل يوم الصدور بتوقيت الجهاز
const cdHTML = date => segs(date) || '<b class="now">صدر اليوم</b>';
setInterval(() => { if (!document.hidden) for (const el of document.querySelectorAll('.cd[data-until]')) el.innerHTML = cdHTML(el.dataset.until); }, 1000);
const poster = (p, sizes) => p ? `<img loading="lazy" decoding="async" alt="" src="${IMG}w342${p}" srcset="${IMG}w185${p} 185w, ${IMG}w342${p} 342w, ${IMG}w500${p} 500w" sizes="${sizes}">` : '';

const D = { films: [], byId: new Map(), byTmdb: new Map(), more: null, cols: {}, prov: {}, fr: {}, fx: {}, frOf: new Map(), recOf: new Map(), part: new Map() };
let P = { films: {} };
try { P = { films: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const save = () => { try { P.at = Date.now(); localStorage.setItem(KEY, JSON.stringify(P)); } catch {} syncTouch('films'); };
const st = id => P.films[id] || '';
const ui = { q: '', status: 'todo', genre: '', decade: '', prov: '', sort: 'list', view: 'grid', series: false };

document.body.insertAdjacentHTML('beforeend', `${SPRITE}
<header class="top"><a class="home" href="../" aria-label="العودة إلى البوابات">${ic('home')}<span>البوابات</span></a><h1>قائمة أفلامي</h1>
  <button class="btn pri add" data-act="add">${ic('plus')}<span>أضف فيلماً</span><span class="sr">أضف فيلماً</span></button><p class="tally" id="tally"></p></header>
<section class="tonight" id="tonight" hidden><div class="bd"></div><p class="lbl">اقتراح الليلة</p><h2 dir="ltr"></h2><p class="meta"></p>
  <div class="acts"><button class="btn pri" data-act="open-tonight">افتح بطاقته</button><button class="btn sec" data-act="reroll">${ic('roll')}اقتراح آخر</button></div></section>
<nav class="bar" aria-label="البحث والتصفية"><div class="row"><label class="search">${ic('search')}<span class="sr">ابحث في القائمة</span><input id="q" type="search" placeholder="ابحث: فيلم، مخرج، سنة" autocomplete="off" enterkeyhint="search"></label>
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
  <p class="hint">الفيلم يظهر هنا فوراً، ويصل إلى بقية أجهزتك خلال دقائق. معلومات سلسلته تُجلب آلياً من <bdi dir="ltr">TMDB</bdi>.</p></form></dialog>
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
function partTag(f) { const r = D.recOf.get(f.id); if (r === 'skip' || r === 'optional') return `<span class="tag">${r === 'skip' ? 'تجاوزه' : 'اختياري'}</span>`; const c = f.col && D.cols[f.col]; if (!c || c.parts.length < 2) return ''; const i = c.parts.findIndex(p => p.tmdb === f.tmdb); return i < 0 ? '' : `<span class="tag"><bdi dir="ltr">${i + 1}/${c.parts.length}</bdi></span>`; }
function card(f) { const s = st(f.id), un = unreleased(f);
  return `<article class="tk${s ? ' ' + s : ''}" id="f-${f.id}" data-id="${f.id}">
<button class="poster" data-act="open" aria-label="افتح بطاقة ${esc(f.title)}">${poster(f.poster, '(max-width:520px) 45vw, 180px') || `<span class="ph" dir="ltr">${esc(f.title)}</span>`}${f.fresh ? '<span class="tag new">جديد</span>' : f.kind === 'tv' ? '<span class="tag">مسلسل</span>' : un ? `<span class="tag">${f.date ? 'بعد ' + nDays(daysTo(f.date)) : 'لم يُعلن موعده'}</span>` : partTag(f)}<span class="stamp" aria-hidden="true">شوهد</span></button>
<div class="stub"><h3>${esc(f.title)}</h3><p class="meta">${f.year ? `<bdi>${f.year}</bdi>` : '<span>بلا موعد</span>'}${f.rating ? `<span class="rate"><bdi dir="ltr">${f.rating.toFixed(1)}</bdi></span>` : ''}${f.runtime ? `<span>${rt(f.runtime)}</span>` : f.seasons ? `<span>${count(f.seasons, ['موسم واحد', 'موسمان', 'مواسم', 'موسماً', 'موسم'])}</span>` : ''}</p>
<button class="seen" data-act="seen" aria-pressed="${s === 'watched'}" aria-label="شاهدته: ${esc(f.title)}">${ic('check')}</button><div class="where">${whereHTML(f)}</div></div></article>`; }

// ---------- التصفية والترتيب ----------
const SORTS = { list: ['ترتيب قائمتي', (a, b) => a.ord - b.ord], new: ['الأحدث صدوراً', (a, b) => (b.date || '0').localeCompare(a.date || '0')], old: ['الأقدم صدوراً', (a, b) => (a.date || '9').localeCompare(b.date || '9')],
  rate: ['الأعلى تقييماً', (a, b) => (b.votes >= 50 ? b.rating || 0 : 0) - (a.votes >= 50 ? a.rating || 0 : 0)], short: ['الأقصر مدة', (a, b) => (a.runtime || 9999) - (b.runtime || 9999)], az: ['أبجدياً', (a, b) => a.title.localeCompare(b.title, 'en')] };
const hay = f => f._h ??= [f.title, f.orig, f.year, ...(D.more?.[f.id]?.directors || []), D.more?.[f.id]?.titleAr, f.col && D.cols[f.col]?.name, D.fr[D.frOf.get(f.id)]?.name].filter(Boolean).join(' ').toLowerCase();
function match(f) { const s = st(f.id);
  if (ui.status === 'soon' ? !unreleased(f) : ui.status === 'todo' ? s === 'watched' && !ui.q : ui.status !== 'all' && s !== ui.status) return false;
  if (ui.genre && !f.genres.includes(+ui.genre)) return false;
  if (ui.decade && Math.floor((f.year || 0) / 10) * 10 !== +ui.decade) return false;
  if (ui.prov && !(ui.prov === 'any' ? f.prov && (f.prov.stream.length || f.prov.free.length) : f.prov && [...f.prov.stream, ...f.prov.free].includes(+ui.prov))) return false;
  if (ui.series && !(D.frOf.has(f.id) || f.col && D.cols[f.col]?.parts.length > 1)) return false;
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

// ---------- السلاسل ----------
// مجموعة العرض: سلسلة مراجَعة يدوياً (ترتيب وتوصيات ومسلسلات مرتبطة) أو مجموعة TMDB كما هي (أفلام فقط بترتيب الصدور)
const REC = { watch: 'شاهده', optional: 'اختياري', skip: 'تجاوزه', soon: 'قادم' };
const whenOf = o => o.date && o.date > today ? 'بعد ' + nDays(daysTo(o.date)) : o.year || 'لم يُعلن موعده';
const groupOf = f => { const k = D.frOf.get(f.id); if (k) return { key: k, curated: true, ...D.fr[k] }; const c = f.col && D.cols[f.col]; return c && c.parts.length > 1 ? { key: 'c' + c.id, name: c.name, order: c.parts.map(p => ({ m: p.tmdb })) } : null; };
const listedOf = s => s.m ? D.byTmdb.get(s.m) : s.t ? D.byId.get('t' + s.t) : null;
const infoOf = s => listedOf(s) || (s.m ? D.fx['m' + s.m] || D.part.get(s.m) : s.t ? D.fx['t' + s.t] : s) || {};
const kindOf = s => s.t ? 'مسلسل' : s.x ? XKIND[s.x] || '' : '';
function groups() { const out = Object.entries(D.fr).map(([key, fr]) => ({ key, curated: true, ...fr }));
  for (const c of Object.values(D.cols)) if (c.parts.length > 1 && c.parts.some(p => D.byTmdb.has(p.tmdb)) && !c.parts.some(p => D.frOf.has('m' + p.tmdb))) out.push({ key: 'c' + c.id, name: c.name, order: c.parts.map(p => ({ m: p.tmdb })) });
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en')); }
function seriesHTML() { const gs = groups().filter(g => !ui.q || g.name.toLowerCase().includes(ui.q) || g.order.some(s => (infoOf(s).title || '').toLowerCase().includes(ui.q)));
  if (!gs.length) return '<p class="empty">لا سلسلة تطابق البحث.</p>';
  return gs.map(g => { const mine = g.order.map(listedOf).filter(Boolean), seen = mine.filter(f => st(f.id) === 'watched').length;
    return `<section class="fr"><header><h3 dir="ltr">${esc(g.name)}</h3><span>${count(g.order.length, ['عمل واحد', 'عملان', 'أعمال', 'عملاً', 'عمل'])}${seen ? ` · شاهدت ${seen}` : ''}${mine.length < g.order.length ? ` · ${mine.length} في قائمتك` : ''}${g.curated ? ' · بتوصيات الدليل' : ''}</span></header>${g.note ? `<p class="fr-note">${ar(g.note)}</p>` : ''}<div class="reel">${
      g.order.map((s, i) => { const f = listedOf(s), o = infoOf(s), k = kindOf(s); return `<button class="part${f ? '' : ' out'}${f && st(f.id) === 'watched' ? ' watched' : ''}${s.rec ? ' r-' + s.rec : ''}" data-act="${f ? 'open' : 'add-part'}" data-id="${f ? f.id : ''}" data-q="${esc(o.title || '')}${o.year ? ' ' + o.year : ''}">
<span class="p">${poster(o.poster, '118px')}<span class="n">${i + 1}</span>${s.rec && s.rec !== 'watch' ? `<span class="rc ${s.rec}">${REC[s.rec]}</span>` : ''}</span><b>${esc(o.title || '')}</b><small>${[k, whenOf(o), f ? '' : 'خارج قائمتك'].filter(Boolean).join(' · ')}</small></button>`; }).join('')}</div></section>`; }).join(''); }
function setView(v) { ui.view = v; $$('.tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); $('#grid').hidden = v !== 'grid'; $('#series').hidden = v !== 'series'; $('#chips').hidden = v !== 'grid';
  if (v === 'series') $('#series').innerHTML = seriesHTML(); apply(false); }

// ---------- نافذة الفيلم ----------
const sheet = $('#sheet'), addDlg = $('#add');
let openId = null;
function orderHTML(f) { const g = groupOf(f);
  if (!g) return `<section class="sec"><h3>السلسلة وترتيب المشاهدة</h3><p>${f.kind === 'tv' ? 'مسلسل، لا سلسلة أفلام مسجّلة له.' : 'فيلم مستقل: لا أجزاء أخرى مسجّلة له في <bdi dir="ltr">TMDB</bdi>.'}</p></section>`;
  const row = s => { const l = listedOf(s), o = infoOf(s), w = l && st(l.id) === 'watched', here = l?.id === f.id, k = kindOf(s);
    return `<li class="${[here ? 'here' : '', w ? 'watched' : '', s.rec ? 'r-' + s.rec : ''].join(' ')}"><span class="th">${o.poster ? `<img loading="lazy" alt="" src="${IMG}w92${o.poster}">` : esc(k)}</span>
<span class="t"><b>${esc(o.title || '')}</b><small>${[k, whenOf(o), o.rating ? `<bdi dir="ltr">${o.rating.toFixed(1)}</bdi>` : '', s.note ? ar(s.note) : ''].filter(Boolean).join(' · ')}</small></span>
<span class="st">${s.rec ? `<i class="rc ${s.rec}">${REC[s.rec]}</i>` : ''}<small>${here ? 'هذا العمل' : w ? 'شاهدته' : l ? 'في قائمتك' : 'خارج قائمتك'}</small></span>${here ? '' : s.x && !s.url ? '' : s.x ? `<a class="go" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(o.title || '')}"></a>` : `<button class="go" data-act="${l ? 'open' : 'add-part'}" data-id="${l ? l.id : ''}" data-q="${esc(o.title || '')}${o.year ? ' ' + o.year : ''}" aria-label="${l ? 'افتح' : 'أضف'} ${esc(o.title || '')}"></button>`}</li>`; };
  return `<section class="sec"><h3>ترتيب المشاهدة: <bdi dir="ltr">${esc(g.name)}</bdi></h3>${g.note ? `<p>${ar(g.note)}</p>` : ''}<ol class="order">${g.order.map(row).join('')}</ol>
<p class="note">${g.curated ? `الترتيب والتوصيات من إعداد الدليل، مبنية على ترابط القصة وتقييم <bdi dir="ltr">TMDB</bdi> الظاهر بجانب كل عمل${g.sources?.length ? `. المصادر: ${g.sources.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><bdi dir="ltr">${esc(x.name)}</bdi></a>`).join('، ')}` : ''}.` : 'الترتيب حسب تاريخ الصدور، مجلوب آلياً من <bdi dir="ltr">TMDB</bdi> ويشمل الأفلام فقط. لم يُراجَع يدوياً بعد.'}</p></section>`; }
function whereSec(f) { const p = f.prov, g = (t, ids) => ids.length ? `<div class="wgroup"><b>${t}</b><div class="wlist">${ids.map(id => `<a href="${esc(p.link || '#')}" target="_blank" rel="noopener">${D.prov[id]?.logo ? `<img alt="" src="${IMG}w92${D.prov[id].logo}">` : ''}${esc(D.prov[id]?.name || id)}</a>`).join('')}</div></div>` : '';
  const body = p ? g('باشتراك', p.stream) + g('مجاناً', p.free) + g('إيجار', p.rent) + g('شراء', p.buy) : '';
  return `<section class="sec"><h3>أين تشاهده في السعودية</h3>${body || `<p>${unreleased(f) ? 'لم يصدر بعد.' : 'غير متاح على منصات السعودية حالياً حسب بيانات <bdi dir="ltr">JustWatch</bdi>.'}</p>`}${body ? '<p class="note">الأزرار تفتح صفحة أماكن العرض على <bdi dir="ltr">TMDB</bdi>، ومنها إلى المنصة. البيانات من <bdi dir="ltr">JustWatch</bdi> وتتحدث يومياً.</p>' : ''}</section>`; }
function linksSec(f) { const ua = navigator.userAgent, ww = /android/i.test(ua) ? 'https://play.google.com/store/apps/details?id=com.whattawatch' : /iphone|ipad|ipod/i.test(ua) ? 'https://apps.apple.com/app/id6444618445' : 'https://whattawatch.com/';
  const a = (href, name, sub) => `<a href="${href}" target="_blank" rel="noopener"><b>${name}</b><small>${sub}</small></a>`;
  return `<section class="sec"><h3>صفحته في المواقع</h3><div class="links">${f.imdb ? a(`https://www.imdb.com/title/${f.imdb}/`, 'IMDb', 'التقييم والطاقم') : ''}${f.kind === 'movie' ? a(`https://letterboxd.com/tmdb/${f.tmdb}`, 'Letterboxd', 'المراجعات والقوائم') : ''}${a(`https://www.themoviedb.org/${f.kind}/${f.tmdb}`, 'TMDB', 'مصدر البيانات')}
<a href="${ww}" target="_blank" rel="noopener" data-act="ww" data-t="${esc(f.title)}"><b>WhattaWatch</b><small>يفتح التطبيق وينسخ اسم الفيلم للبحث</small></a></div></section>`; }
async function sheetHTML(f) { const m = (await D.moreReady)?.[f.id] || {}, s = st(f.id), un = unreleased(f);
  const ov = m.overviewAr ? `<p>${ar(m.overviewAr)}</p>${m.arSource === 'guide' ? '' : '<p class="note">نبذة <bdi dir="ltr">TMDB</bdi> العربية كما هي، لم نراجعها بعد.</p>'}` : m.overviewEn ? `<p dir="ltr" lang="en" style="text-align:left">${esc(m.overviewEn)}</p><p class="note">النبذة بالإنجليزية، والترجمة قيد الإعداد.</p>` : '<p>لا توجد نبذة.</p>';
  return `<div class="sh-hero">${f.backdrop ? `<img alt="" src="${IMG}w780${f.backdrop}" srcset="${IMG}w780${f.backdrop} 780w, ${IMG}w1280${f.backdrop} 1280w" sizes="(max-width:880px) 100vw, 880px">` : ''}</div>
<div class="sh-head"><div class="poster">${poster(f.poster, '170px')}</div><div class="txt"><h2>${esc(f.title)}</h2>${f.orig ? `<p class="orig">${esc(f.orig)}</p>` : ''}
<p class="facts">${[f.kind === 'tv' ? 'مسلسل' : '', f.year ? `<bdi>${f.year}</bdi>` : '', rt(f.runtime), f.seasons ? count(f.seasons, ['موسم واحد', 'موسمان', 'مواسم', 'موسماً', 'موسم']) : '', f.cert ? `<bdi dir="ltr">${esc(f.cert)}</bdi>` : '', LANGS[f.lang] ? 'اللغة ' + LANGS[f.lang] : '', f.rating ? `<span class="rate">تقييم <bdi dir="ltr">TMDB ${f.rating.toFixed(1)}</bdi></span>` : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</p>
<div class="tags">${f.genres.map(g => GENRES[g] ? `<span>${GENRES[g]}</span>` : '').join('')}</div></div></div>
<div class="sh-acts"><button class="btn sec" data-act="set" data-v="watched" aria-pressed="${s === 'watched'}">${ic('check')}شاهدته</button><button class="btn sec nx" data-act="set" data-v="next" aria-pressed="${s === 'next'}">${ic('mark')}التالي في المشاهدة</button></div>
${f.ask ? `<section class="sec"><p class="ask">${esc(f.ask)}</p></section>` : ''}${f.src === 'added' ? '<section class="sec"><p class="ask">أُضيف بزر «أضف فيلماً»: معلوماته آلية من <bdi dir="ltr">TMDB</bdi> ولم تُراجَع يدوياً.</p></section>' : ''}
<section class="sec"><h3>القصة</h3>${ov}</section>${un ? `<section class="sec"><h3>موعد الصدور</h3>${f.date ? `<div class="cd" data-until="${f.date}" aria-label="الوقت الباقي على الصدور">${cdHTML(f.date)}</div><p class="note">يصدر في <bdi>${new Date(f.date + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' })}</bdi> حسب <bdi dir="ltr">TMDB</bdi>، والموعد قابل للتغيير.</p>` : '<p>معلن، ولم يُحدَّد موعد صدوره بعد.</p>'}</section>` : ''}
${whereSec(f)}${orderHTML(f)}
${(m.directors?.length || m.cast?.length) ? `<section class="sec"><h3>الطاقم</h3><p class="people">${m.directors?.length ? `<b>${f.kind === 'tv' ? 'صنّاع المسلسل' : 'الإخراج'}:</b> <bdi dir="ltr">${m.directors.map(esc).join(', ')}</bdi><br>` : ''}${m.cast?.length ? `<b>التمثيل:</b> <bdi dir="ltr">${m.cast.map(esc).join(', ')}</bdi>` : ''}</p></section>` : ''}
${linksSec(f)}`; }
async function openFilm(id, push = true) { const f = D.byId.get(id); if (!f) return; openId = id; $('#sheet-body').innerHTML = await sheetHTML(f); $('#sheet-body').scrollTop = 0;
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
      return `<div class="cand"><span class="th">${c.poster ? `<img alt="" src="${IMG}w92${c.poster}">` : ''}</span><span><b>${esc(c.title)}</b><small>${[c.kind === 'tv' ? 'مسلسل' : 'فيلم', c.year, c.collection ? `من سلسلة ${esc(c.collection)}` : ''].filter(Boolean).join(' · ')}</small></span>
${has ? '<small>في قائمتك</small>' : `<button class="btn pri" type="button" data-act="add-pick" data-tmdb="${c.tmdb}" data-kind="${c.kind}">أضفه</button>`}</div>`; }).join('');
  } catch (err) { msg.textContent = err.message; } });
async function addPick(btn) { const msg = $('#add-msg'); btn.disabled = true; btn.textContent = 'يُضاف…';
  try { const r = await api({ action: 'add', tmdb: +btn.dataset.tmdb, kind: btn.dataset.kind }, pass()); adopt(r, true);
    try { const p = JSON.parse(localStorage.getItem(PEND) || '[]'); p.push(r); localStorage.setItem(PEND, JSON.stringify(p)); } catch {}
    addDlg.close(); toast(`أُضيف «${r.film.title}»`); document.getElementById('f-' + r.film.id)?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  } catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = 'أضفه'; } }
// يُدخل فيلماً عاد من الخادم (أو محفوظاً بانتظار وصوله في البناء القادم) في القائمة المعروضة
function adopt(r, draw) { if (!r?.film || D.byId.has(r.film.id)) return false; const [light, heavy] = split(r.film); light.fresh = true; light.ord = -Date.now(); Object.assign(D.prov, r.providers || {});
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
  else if (act === 'add-part') { if (sheet.open) closeFilm(); openAdd(t.dataset.q); }
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
  // ما أُضيف بالزر ولم يصل البناء بعد يبقى ظاهراً من الحفظ المحلي، ويُحذف منه عند وصوله
  try { const pend = JSON.parse(localStorage.getItem(PEND) || '[]'), keep = pend.filter(r => r?.film && !D.byId.has(r.film.id)); D.more ||= {}; keep.forEach(r => adopt(r, false)); localStorage.setItem(PEND, JSON.stringify(keep)); } catch {}
  renderGrid(); reroll(true); liftVeil();
  // تغيير وصل من جهاز آخر: نعيد قراءة السجل ونرسم
  initSync(id => { if (id !== 'films') return; try { P = { films: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {} renderGrid(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); });
  const h = location.hash.slice(1); if (h && D.byId.has(h)) openFilm(h, false);
} catch (err) { $('#grid').innerHTML = '<p class="load">تعذّر تحميل القائمة. حدّث الصفحة.</p>'; liftVeil(); console.error(err); }
