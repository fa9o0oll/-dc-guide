// دليل عوالم DC — الواجهة. البيانات كلها من site/data/ (تُبنى آلياً)، ولا توجد بيانات أعمال مكتوبة هنا.
import { THEMES, SHOW_COLORS } from './themes.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
const TODAY = new Date().toISOString().slice(0, 10);
const TYPE = { 'film|live': 'فيلم واقعي', 'film|animation': 'فيلم أنميشن', 'series|live': 'مسلسل واقعي', 'series|animation': 'مسلسل أنميشن' };
const STATUS = { watched: '✓ شاهدته', watching: '▶ أشاهده', list: '+ قائمتي', skip: '✕ تجاوز' };
const LEGACY_STATUS = { watched: 'watched', watching: 'watching', watchlist: 'list', skipped: 'skip' };
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

// ---------- التخزين (مفتاح واحد ثابت؛ أي تغيير مستقبلي يكون بترقية v داخل البيانات لا بتغيير المفتاح)
const KEY = 'dcg.progress';
const blank = () => ({ v: 1, works: {}, eps: {}, shield: true });
let store = blank();
try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && raw.v === 1) store = { ...blank(), ...raw }; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { toast('تعذّر الحفظ في هذا المتصفح'); } };

// ---------- البيانات
const D = { universes: [], works: new Map(), placements: [], bridges: [], legacyMap: {}, base: '', arrow: null, episodes: new Map() };
const ui = { view: 'cards', uni: 'all', sheet: null };
const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' → ' + r.status); return r.json(); };

async function boot() {
  try {
    const [base, cat, arrow] = await Promise.all([getJSON('data/base.json'), getJSON('data/catalog.json'), getJSON('data/arrowverse.json')]);
    const extra = new Map(cat.works.map(w => [w.id, w]));
    for (const w of base.works) D.works.set(w.id, { ...w, ...(extra.get(w.id) || {}) });
    Object.assign(D, { universes: base.universes, placements: base.placements, bridges: base.bridges, legacyMap: base.legacyMap, base: cat.imageBase, arrow });
    $('#builtAt').textContent = 'آخر تحديث للبيانات: ' + fmtDate(cat.generatedAt.slice(0, 10));
  } catch (e) {
    $('#main').innerHTML = `<p class="empty">تعذّر تحميل البيانات. حدّث الصفحة، وإذا استمر الخطأ فالسبب: ${esc(e.message)}</p>`; return;
  }
  renderUnibar(); syncShield(); render();
}

// ---------- مساعدات
const img = (path, size) => path ? D.base + size + path : '';
const isSoon = w => !w.date || w.date > TODAY;
const daysLeft = w => Math.ceil((new Date(w.date) - new Date(TODAY)) / 864e5);
const sKey = p => p.season ? `${p.work}#${p.season}` : p.work;
const statusOf = p => store.works[sKey(p)] || '';
const domId = (pre, p) => `${pre}-${p.universe}-${p.work}${p.season ? '-s' + p.season : ''}`;
const uniOf = id => D.universes.find(u => u.id === id);
const epDone = (id, s, e) => !!store.eps[id]?.[`${s}-${e}`];
const seasonTotal = (w, s) => (w.seasons || []).filter(x => !s || x.n === s).reduce((a, x) => a + (x.episodes || 0), 0);
const seasonDone = (id, s) => Object.keys(store.eps[id] || {}).filter(k => !s || k.startsWith(s + '-')).length;
const tmdbUrl = w => `https://www.themoviedb.org/${w.seasons ? 'tv' : 'movie'}/${w.tmdb}`;
const themeVars = id => { const t = THEMES[id]; return `--bg:${t.bg};--c1:${t.c1};--c2:${t.c2}`; };
const rateBlock = w => `<div class="rates wide">${w.tmdbRating != null ? `<a class="gauge" style="--v:${Math.round(w.tmdbRating * 10)}" href="${tmdbUrl(w)}" target="_blank" rel="noopener" aria-label="تقييم TMDB ${w.tmdbRating} من 10">${w.tmdbRating}</a><span class="src"><b>تقييم ${ltr('TMDB')}</b>${(w.tmdbVotes || 0).toLocaleString('en')} صوتاً</span>` : ''}<span class="ext">${w.imdb ? `<a href="https://www.imdb.com/title/${w.imdb}/" target="_blank" rel="noopener">${ltr('IMDb')}</a>` : ''}${w.rt ? `<a href="https://www.rottentomatoes.com/${w.rt}" target="_blank" rel="noopener">${ltr('Rotten Tomatoes')}</a>` : ''}</span></div>`;
const verdict = r => r == null ? null : r >= 7.5 ? ['ممتاز', '#35d07f'] : r >= 6.8 ? ['جيد', '#57abff'] : r >= 6 ? ['متوسط', '#f2b84b'] : ['ضعيف', '#ef5d57'];
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
const posterTag = (w, size = 'w342') => w.poster
  ? `<img loading="lazy" decoding="async" src="${img(w.poster, size)}" ${size === 'w342' ? `srcset="${img(w.poster, 'w342')} 1x, ${img(w.poster, 'w500')} 2x"` : ''} alt="بوستر ${esc(w.title)}">`
  : `<span class="ph">${esc(w.title)}</span>`;

function stats() {
  const released = [...D.works.values()].filter(w => !isSoon(w)).length;
  const watched = new Set(Object.entries(store.works).filter(([, s]) => s === 'watched').map(([k]) => k.split('#')[0])).size;
  const eps = Object.values(store.eps).reduce((a, o) => a + Object.keys(o).length, 0);
  $('#statsLine').textContent = `شاهدت ${watched} من ${released} عملاً · ${eps} حلقة مسجّلة`;
}
function syncShield() { const b = $('#shieldBtn'); b.textContent = store.shield ? 'درع الحرق: مفعّل' : 'درع الحرق: متوقف'; b.classList.toggle('off', !store.shield); b.setAttribute('aria-pressed', store.shield); }

// ---------- شريط العوالم
function renderUnibar() {
  $('#unibar').innerHTML = `<button data-act="uni" data-uni="all">كل العوالم</button>` +
    D.universes.map(u => `<button data-act="uni" data-uni="${u.id}">${esc(u.name)}</button>`).join('');
}
function syncNav() {
  $$('#unibar button').forEach(b => b.classList.toggle('on', b.dataset.uni === ui.uni));
  $$('.views button').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
  const arrow = ui.view === 'arrow';
  $('#unibar').hidden = arrow; $('#dockHere').hidden = !arrow; $('#filters').hidden = arrow;
  $('#unibar .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ---------- التصفية
function visible(p) {
  const w = D.works.get(p.work), q = $('#q').value.trim().toLowerCase(), t = $('#fType').value, s = $('#fStatus').value;
  if (ui.uni !== 'all' && p.universe !== ui.uni) return false;
  if (q && !(w.title.toLowerCase().includes(q) || (w.titleAr || '').includes(q))) return false;
  if (t && w.kind !== t && w.medium !== t) return false;
  if (s === 'upcoming') return isSoon(w);
  if (s === 'none') return !statusOf(p) && !isSoon(w);
  if (s) return statusOf(p) === s;
  return true;
}
function sections() {
  return D.universes.map(u => {
    const all = D.placements.filter(p => p.universe === u.id).sort((a, b) => a.position - b.position);
    const list = all.filter(visible);
    // القادم يُعرض آخر العالم وينتقل لمكانه تلقائياً يوم صدوره
    list.sort((a, b) => isSoon(D.works.get(a.work)) - isSoon(D.works.get(b.work)) || a.position - b.position);
    return { u, all, list };
  }).filter(s => s.list.length);
}
function uniHead(u, all) {
  const rel = all.filter(p => !isSoon(D.works.get(p.work))), done = rel.filter(p => statusOf(p) === 'watched').length;
  const t = THEMES[u.id], key = D.works.get(t.key);
  return `<header class="opener m-${t.motif}">${key?.backdrop ? `<div class="opener-img" style="background-image:url('${img(key.backdrop, 'w1280')}')"></div>` : ''}<div class="motif"></div>
    <h2>${esc(u.name)}</h2>
    <p class="en">${ltr(u.nameEn)}</p>
    <p class="desc">${esc(u.description)}</p>
    <ul class="facts"><li>${esc(u.status)}</li><li>${u.serial ? 'يُشاهد بالترتيب' : 'أعمال منفردة، بأي ترتيب'}</li><li class="prog">شاهدت ${done} من ${rel.length}</li>${u.id === 'arrow' ? '<li class="act"><button data-act="view" data-view="arrow">ترتيب المشاهدة بالمواسم والحلقات</button></li>' : ''}</ul>
    <div class="bar"><i style="width:${rel.length ? Math.round(done / rel.length * 100) : 0}%"></i></div></header>`;
}

// ---------- البطاقات
function card(p) {
  const w = D.works.get(p.work), st = statusOf(p), soon = isSoon(w), v = verdict(w.tmdbRating);
  const meta = [w.date ? w.date.slice(0, 4) : w.year, TYPE[w.kind + '|' + w.medium],
    !w.seasons ? (w.runtime ? w.runtime + ' دقيقة' : '') : p.season ? `الموسم ${p.season} · ${seasonTotal(w, p.season)} حلقة` : `${(w.seasons || []).length} مواسم · ${w.episodeCount || 0} حلقة`].filter(Boolean).join(' · ');
  const tot = w.seasons ? seasonTotal(w, p.season) : 0, dn = tot ? seasonDone(w.id, p.season) : 0;
  return `<article class="card" id="${domId('c', p)}" data-k="${esc(sKey(p))}">
    <button class="poster" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} aria-label="تفاصيل ${esc(w.title)}">${posterTag(w)}</button>
    <div>
      <div class="ord">${uniOf(p.universe).serial ? 'الترتيب: ' : ''}${esc(p.label)}</div>
      <h3>${ltr(w.title + (p.season ? `: Season ${p.season}` : ''))}</h3>
      <div class="meta">${esc(meta)}</div>
      <div class="tags">${soon ? '<span class="tag soon">قادم</span>' : v ? `<span class="tag" style="color:${v[1]}">${v[0]}</span>` : ''}</div>
      <p class="note">${esc(p.note)}</p>
    </div>
    ${soon ? `<div class="count wide">${w.date ? `<b>${daysLeft(w)}</b><span>يوماً على الصدور<br><small>${fmtDate(w.date)}</small></span>` : '<span>معلن، وتاريخ الصدور لم يُحدَّد بعد</span>'}</div>` : ''}
    ${p.canon ? `<div class="canon wide">يظهر في عالمين: ${esc(p.canon.note)} <a href="${esc(p.canon.source)}" target="_blank" rel="noopener">المصدر</a></div>` : ''}
    ${p.spoiler ? (store.shield ? `<details class="vault wide"><summary>معلومة ارتباط فيها حرق. اضغط للكشف</summary><p>${esc(p.spoiler)}</p></details>` : `<p class="note wide">${esc(p.spoiler)}</p>`) : ''}
    ${rateBlock(w)}
    ${tot ? `<div class="wide"><span class="lbl">الحلقات: ${dn} من ${tot}</span><div class="bar"><i style="width:${Math.round(dn / tot * 100)}%"></i></div></div>` : ''}
    ${soon ? '' : `<div class="status wide">${Object.entries(STATUS).map(([k, l]) => `<button data-act="status" data-s="${k}" aria-pressed="${st === k}">${l}</button>`).join('')}</div>`}
    <div class="actions wide"><button data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''}>${w.seasons?.length ? 'المواسم والحلقات' : 'التفاصيل'}</button>
      <button data-act="goto" data-to="t" data-target="${domId('t', p)}" data-uni="${p.universe}">موقعه في الخط الزمني</button></div>
  </article>`;
}
function renderCards() {
  const secs = sections();
  $('#main').innerHTML = secs.length ? secs.map(({ u, all, list }) => `<section class="uni" id="u-${u.id}" data-uni="${u.id}" style="${themeVars(u.id)}">${uniHead(u, all)}<div class="grid">${list.map(card).join('')}</div></section>`).join('')
    : '<p class="empty">لا توجد أعمال تطابق البحث أو التصفية الحالية.</p>';
}

// ---------- الخط الزمني
function node(p, i, list) {
  const w = D.works.get(p.work), soon = isSoon(w), prev = list[i - 1], next = list[i + 1], u = uniOf(p.universe), done = statusOf(p) === 'watched';
  const around = u.serial && u.id !== 'arrow' ? [prev && ['قبله', D.works.get(prev.work).title], next && ['بعده', D.works.get(next.work).title]].filter(Boolean) : [];
  return `<div class="node ${done ? 'done' : ''} ${soon ? 'soon' : ''}" id="${domId('t', p)}" data-k="${esc(sKey(p))}">
    <button class="node-main" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} aria-label="تفاصيل ${esc(w.title)}">
      <span class="thumb">${w.poster ? `<img loading="lazy" src="${img(w.poster, 'w154')}" alt="">` : ''}<i class="seen" aria-hidden="true">✓</i></span>
      <span class="node-text"><span class="n">${esc(p.label)}${soon ? (w.date ? ` · قادم بعد ${daysLeft(w)} يوماً` : ' · قادم') : ''}</span>
        <span class="t">${ltr(w.title + (p.season ? `: Season ${p.season}` : ''))}</span>
        <span class="meta">${esc([w.date ? w.date.slice(0, 4) : w.year, TYPE[w.kind + '|' + w.medium]].join(' · '))}</span>
        ${around.length ? `<span class="meta">${around.map(([k, t]) => `${k}: ${ltr(t)}`).join(' · ')}</span>` : ''}</span></button>
    <div class="go">${soon ? '' : `<button data-act="status" data-s="watched" aria-pressed="${done}">${done ? '✓ شاهدته' : 'علّمه مشاهَد'}</button>`}<button data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}">البطاقة</button></div></div>`;
}
const tlNote = u => u.id === 'arrow' ? '<p class="tl-note">المسلسلات هنا مرتبة حسب سنة بدايتها فقط. المشاهدة الفعلية متداخلة بين مواسمها وحلقاتها. <button data-act="view" data-view="arrow">افتح ترتيب المشاهدة بالحلقات</button></p>' : '';
function renderTimeline() {
  const secs = sections();
  $('#main').innerHTML = secs.length ? secs.map(({ u, all, list }) => `<section class="uni" id="u-${u.id}" data-uni="${u.id}" style="${themeVars(u.id)}">${uniHead(u, all)}${tlNote(u)}<div class="tl">${list.map(node).join('')}</div></section>`).join('')
    : '<p class="empty">لا توجد أعمال تطابق البحث أو التصفية الحالية.</p>';
}
function refreshProgress() {
  for (const sec of $$('section.uni[id]')) { const rel = D.placements.filter(p => p.universe === sec.dataset.uni && !isSoon(D.works.get(p.work))), done = rel.filter(p => statusOf(p) === 'watched').length;
    const li = $('.prog', sec), bar = $('.opener .bar i', sec); if (li) li.textContent = `شاهدت ${done} من ${rel.length}`; if (bar) bar.style.width = (rel.length ? Math.round(done / rel.length * 100) : 0) + '%'; }
}

// ---------- ترتيب آروفيرس
const rangeDone = b => { let n = 0; for (let e = b.from; e <= b.to; e++) n += epDone(b.work, b.season, e); return n; };
function renderArrow() {
  const a = D.arrow;
  const done = a.steps.reduce((n, s) => n + (s.blocks || []).reduce((m, b) => m + rangeDone(b), 0) + (s.parts || []).filter(p => epDone(p.work, p.season, p.episode)).length, 0);
  $('#main').innerHTML = `<section class="uni" data-uni="arrow" style="${themeVars('arrow')}">
    <div class="av-intro"><h2>ترتيب مشاهدة ${ltr('Arrowverse')}</h2>
      <ul><li>${a.steps.length} خطوة تغطي ${a.totalEpisodes} حلقة من 7 مسلسلات. كل حلقة موجودة مرة واحدة فقط.</li>
      <li>اتبع الخطوات بالترتيب، وداخل كل خطوة اتبع الأسطر من الأعلى للأسفل.</li>
      <li>الخطوات البرتقالية حلقات تقاطع: قصة واحدة موزعة على أكثر من مسلسل، وتُشاهد بترتيب الأجزاء.</li>
      <li>الترتيب مبني على تواريخ العرض الفعلية وعناوين الحلقات الرسمية.</li></ul>
      <span class="lbl">تقدّمك: ${done} من ${a.totalEpisodes} حلقة</span><div class="bar"><i style="width:${Math.round(done / a.totalEpisodes * 100)}%"></i></div></div>
    <div class="steps">${a.steps.map(s => s.kind === 'crossover' ? `<div class="step cross" id="${s.id}"><div class="step-head"><span class="num">${s.n}</span><h3>${esc(s.title)} <span class="en">${ltr(s.titleEn)}</span></h3><span class="tag soon">${s.parts.filter(p => !p.tieIn).length} أجزاء بالترتيب</span><span class="meta">${esc(s.label)}</span></div>
        ${s.parts.map(p => { const d = epDone(p.work, p.season, p.episode); return `<div class="row ${d ? 'done' : ''} ${p.tieIn ? 'tie' : ''}" style="--show:${SHOW_COLORS[p.work]}"><span class="k">${p.tieIn ? '＋' : p.part}</span>
          <span class="show">${ltr(p.show)}<span class="epname">${ltr(p.name || '')}</span></span>
          <span class="what">${p.tieIn ? 'حلقة مرتبطة' : `الجزء ${p.part}`}: الموسم ${p.season}، الحلقة ${p.episode}<small>${fmtDate(p.aired)}</small></span>
          <span class="btns"><button data-act="avpart" data-id="${p.work}" data-season="${p.season}" data-ep="${p.episode}">${d ? '✓ شاهدتها' : 'علّمها مشاهدة'}</button><button data-act="open" data-id="${p.work}" data-season="${p.season}">افتح الموسم</button></span>
          ${p.note ? `<span class="link">${esc(p.note)}</span>` : ''}</div>`; }).join('')}</div>`
      : `<div class="step" id="${s.id}"><div class="step-head"><span class="num">${s.n}</span><h3>${esc(s.title)}</h3>${s.title !== s.label ? `<span class="meta">${esc(s.label)}</span>` : ''}</div>
        ${s.blocks.map((b, i) => { const dn = rangeDone(b), full = dn === b.count; return `<div class="row ${full ? 'done' : ''}" style="--show:${SHOW_COLORS[b.work]}"><span class="k">${i + 1}</span>
          <span class="show">${ltr(b.show)}</span>
          <span class="what">الموسم ${b.season}: ${b.whole ? 'كامل' : `من الحلقة ${b.from} إلى الحلقة ${b.to}`}<small>${b.count} حلقة · شاهدت ${dn}</small></span>
          <span class="btns"><button data-act="avblock" data-id="${b.work}" data-season="${b.season}" data-from="${b.from}" data-to="${b.to}">${full ? '✓ مكتملة' : 'علّمها مشاهدة'}</button><button data-act="open" data-id="${b.work}" data-season="${b.season}">الحلقات</button></span>
          ${b.links.map(l => `<span class="link">الحلقة ${l.episode}${l.toEpisode ? ' إلى ' + l.toEpisode : ''}: ${esc(l.note)}</span>`).join('')}</div>`; }).join('')}</div>`).join('')}</div>
    <div class="av-intro steps"><h2>عوالم جانبية</h2>${a.sideWorlds.map(x => { const w = D.works.get(x.work); return `<div class="row"><span class="k">◆</span><span class="show">${ltr(w.title)}</span><span class="what">${esc(x.note)}${x.source ? ` <a href="${esc(x.source)}" target="_blank" rel="noopener">المصدر</a>` : ''}</span><span class="btns"><button data-act="open" data-id="${w.id}">الحلقات</button></span></div>`; }).join('')}</div>
  </section>`;
}

function render(keepScroll) {
  const y = scrollY;
  ({ cards: renderCards, timeline: renderTimeline, arrow: renderArrow })[ui.view]();
  syncNav(); stats(); watchTheme();
  if (keepScroll) scrollTo(0, y);
}
// طبقة الجو: مشهدان يتبادلان التلاشي؛ العالم الظاهر وسط الشاشة هو الذي يحدد المشهد والألوان
let io, sceneI = 0, sceneUni = '';
function setScene(id) {
  if (!id || id === sceneUni || !THEMES[id]) return; sceneUni = id;
  const t = THEMES[id], key = D.works.get(t.key), scenes = $$('.scene'), next = scenes[sceneI ^= 1], prev = scenes[sceneI ^ 1];
  next.className = `scene m-${t.motif} on`; next.style.cssText = themeVars(id);
  $('.scene-img', next).style.backgroundImage = key?.backdrop ? `url('${img(key.backdrop, 'w300')}')` : 'none';
  prev.classList.remove('on');
  for (const k of ['bg', 'c1', 'c2']) document.body.style.setProperty('--' + k, t[k]);
  $('meta[name=theme-color]').content = t.bg;
  if (ui.uni === 'all' && ui.view !== 'arrow') { const bar = $('#unibar'); $$('button', bar).forEach(b => b.classList.toggle('near', b.dataset.uni === id));
    const b = $('.near', bar); if (b) bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' }); }
}
function watchTheme() {
  io?.disconnect(); $$('#unibar .near').forEach(b => b.classList.remove('near'));
  io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) setScene(e.target.dataset.uni); }, { rootMargin: '-35% 0px -55% 0px' });
  $$('.uni').forEach(s => io.observe(s));
  sceneUni = ''; setScene($('.uni')?.dataset.uni || 'dcu');
}
function goTo(view, uni, targetId) {
  ui.view = view; if (ui.uni !== 'all' && uni) ui.uni = uni;
  $('#q').value = ''; $('#fType').value = ''; $('#fStatus').value = '';
  render();
  const t = targetId && document.getElementById(targetId);
  if (t) { t.scrollIntoView({ block: 'center', behavior: 'instant' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1700); }
  else scrollTo(0, 0);
}

// ---------- البطاقة المنبثقة. مع متصفح يدعم View Transitions ينتقل البوستر المضغوط من مكانه إلى داخل البطاقة.
function openSheet(title, html, tag, o = {}) {
  const sh = $('#sheet'), was = ui.sheet, src = o.from;
  const paint = vt => { $('#sheetTitle').innerHTML = title; $('#sheetBody').innerHTML = html; $('#sheetBody').scrollTop = 0;
    sh.className = 'sheet' + (o.wide ? ' wide' : '') + (vt ? '' : ' no-vt'); sh.style.cssText = o.uni && THEMES[o.uni] ? themeVars(o.uni) : '';
    sh.hidden = false; $('#backdrop').hidden = false; document.body.style.overflow = 'hidden'; };
  if (!was) history.pushState({ sheet: 1 }, '');
  ui.sheet = tag || 'x';
  if (was || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(false); $('#sheet .close').focus(); return Promise.resolve(); }
  if (src) src.style.viewTransitionName = 'poster';
  const vt = document.startViewTransition(() => { if (src) src.style.viewTransitionName = ''; paint(true); const dst = src && $('#sheet .dw-top .poster'); if (dst) dst.style.viewTransitionName = 'poster'; });
  vt.finished.finally(() => { const dst = $('#sheet .dw-top .poster'); if (dst) dst.style.viewTransitionName = ''; });
  return vt.updateCallbackDone.then(() => $('#sheet .close').focus(), () => {});
}
function closeSheet(fromPop) {
  if (!ui.sheet) return;
  ui.sheet = null; $('#sheet').hidden = true; $('#backdrop').hidden = true; document.body.style.overflow = '';
  if (!fromPop && history.state?.sheet) history.back();
}
addEventListener('popstate', () => { if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; return; } closeSheet(true); });

async function openWork(id, season, from) {
  const w = D.works.get(id), soon = isSoon(w);
  const places = D.placements.filter(p => p.work === id);
  const uni = from?.closest('section.uni')?.dataset.uni || (places.find(p => p.universe === ui.uni) || places[0]).universe;
  await openSheet(ltr(w.title), `<div class="hero" ${w.backdrop ? `style="background-image:url('${img(w.backdrop, 'w780')}')"` : ''}></div>
    <div class="dw"><div class="dw-top"><button class="poster" data-act="light" data-src="${img(w.poster, 'w780')}" aria-label="تكبير البوستر">${posterTag(w)}</button>
      <div><h3>${ltr(w.title)}</h3>
      <div class="meta">${esc([TYPE[w.kind + '|' + w.medium], w.date ? fmtDate(w.date) : w.year, w.runtime ? w.runtime + ' دقيقة' : '', w.seasons ? `${w.seasons.length} مواسم · ${w.episodeCount} حلقة` : ''].filter(Boolean).join(' · '))}</div>
      ${soon && w.date ? `<div class="tags"><span class="tag soon">قادم بعد ${daysLeft(w)} يوماً</span></div>` : ''}</div></div>
    ${w.overviewAr ? `<p class="ov">${esc(w.overviewAr)}</p>` : w.overviewEn ? `<div><span class="lbl">النبذة بالإنجليزية (الترجمة العربية قيد الإعداد)</span><p class="ov en">${esc(w.overviewEn)}</p></div>` : ''}
    <div class="actions">${places.map(p => `<button data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}" data-force="1">البطاقة في ${esc(uniOf(p.universe).name)}</button>`).join('')}</div>
    ${rateBlock(w)}
    ${w.kind === 'series' && w.seasons?.length ? `<div class="seasons" id="seasonTabs">${w.seasons.map(s => `<button data-act="season" data-id="${id}" data-season="${s.n}">الموسم ${s.n}</button>`).join('')}</div><div id="eps" class="dw" style="padding:0"><p class="empty">جارٍ تحميل الحلقات…</p></div>` : ''}</div>`, 'work', { uni, from: from?.querySelector('img') });
  if (w.kind === 'series' && w.seasons?.length) showSeason(id, w.seasons.some(s => s.n === season) ? season : w.seasons[0].n);
}
async function showSeason(id, n) {
  $$('#seasonTabs button').forEach(b => b.classList.toggle('on', +b.dataset.season === n));
  $('#seasonTabs .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const box = $('#eps');
  try { if (!D.episodes.has(id)) D.episodes.set(id, await getJSON(`data/episodes/${id}.json`)); }
  catch { box.innerHTML = '<p class="empty">تعذّر تحميل الحلقات. تحقق من الاتصال وحاول مرة ثانية.</p>'; return; }
  const s = D.episodes.get(id).seasons.find(x => x.n === n); if (!s || !box.isConnected) return;
  const all = s.episodes.every(e => epDone(id, n, e.n));
  box.innerHTML = `<div class="actions"><button data-act="seasonall" data-id="${id}" data-season="${n}">${all ? 'إلغاء تعليم الموسم' : 'علّم الموسم كاملاً كمشاهد'}</button></div>` +
    s.episodes.map(e => { const d = epDone(id, n, e.n), fut = !e.date || e.date > TODAY, ov = e.overviewAr || e.overviewEn;
      return `<div class="ep ${d ? 'done' : ''}">${e.still ? `<img loading="lazy" src="${img(e.still, 'w300')}" alt="">` : '<span class="ph"></span>'}
        <div><h4>الحلقة ${e.n}${e.name ? ltr(e.name) : ''}</h4>${e.nameAr ? `<div class="ar-title">${esc(e.nameAr)}</div>` : ''}
          <div class="meta">${esc([fut ? (e.date ? 'تُعرض ' + fmtDate(e.date) : 'لم تُعرض') : fmtDate(e.date), e.runtime ? e.runtime + ' د' : '', e.rating != null ? `التقييم ${e.rating} من 10` : ''].filter(Boolean).join(' · '))}</div></div>
        ${ov ? `<div style="grid-column:1/-1">${e.overviewAr ? '' : '<span class="lbl">الملخص بالإنجليزية (الترجمة العربية قيد الإعداد)</span>'}
          <p class="ov ${e.overviewAr ? '' : 'en'} ${store.shield && !d ? 'blur' : ''}" ${store.shield && !d ? 'data-act="reveal" title="اضغط للكشف"' : ''}>${esc(ov)}</p>
          ${store.shield && !d ? '<span class="lbl">الملخص مخفي لتفادي الحرق. اضغط عليه للكشف</span>' : ''}</div>` : ''}
        <div class="foot2"><span></span>${fut ? '' : `<button data-act="ep" data-id="${id}" data-season="${n}" data-ep="${e.n}">${d ? '✓ شاهدتها' : 'علّمها مشاهدة'}</button>`}</div></div>`; }).join('');
}
function setEp(id, s, e, on) { const o = store.eps[id] ||= {}; if (on) o[`${s}-${e}`] = 1; else delete o[`${s}-${e}`]; if (!Object.keys(o).length) delete store.eps[id]; }

// ---------- الفهرس، السجل، الدليل
async function openJump() {
  const tile = u => { const t = THEMES[u.id], key = D.works.get(t.key), all = D.placements.filter(p => p.universe === u.id), rel = all.filter(p => !isSoon(D.works.get(p.work))), done = rel.filter(p => statusOf(p) === 'watched').length;
    return `<button class="tile m-${t.motif} ${ui.uni === u.id ? 'on' : ''}" data-act="uni" data-uni="${u.id}" style="${themeVars(u.id)}">${key?.backdrop ? `<img loading="lazy" src="${img(key.backdrop, 'w780')}" alt="">` : ''}<span class="motif"></span>
      <span class="tile-text"><span class="tile-name">${esc(u.name)}</span><span class="tile-en">${ltr(u.nameEn)}</span><span class="tile-meta">عدد الأعمال ${all.length} · شاهدت ${done}</span><span class="bar"><i style="width:${rel.length ? Math.round(done / rel.length * 100) : 0}%"></i></span></span></button>`; };
  const group = (title, list) => list.length ? `<h3>${title}</h3><div class="tiles">${list.map(tile).join('')}</div>` : '';
  await openSheet('الفهرس', `<div class="idx"><input id="jq" type="search" placeholder="ابحث عن عمل أو عالم…" aria-label="بحث في الفهرس">
    <div class="idx-row">${[['cards', 'البطاقات'], ['timeline', 'الخط الزمني'], ['arrow', 'ترتيب آروفيرس']].map(([v, l]) => `<button data-act="view" data-view="${v}" class="${ui.view === v ? 'on' : ''}">${l}</button>`).join('')}
      <button data-act="uni" data-uni="all" class="${ui.uni === 'all' && ui.view !== 'arrow' ? 'on' : ''}">كل العوالم</button></div>
    <div id="jres"></div><div id="jhome"></div>
    <div class="idx-row tools2"><button data-act="shield">${store.shield ? 'درع الحرق: مفعّل' : 'درع الحرق: متوقف'}</button><button data-act="tonight">ماذا أشاهد؟</button><button data-act="backup">سجلّي</button><button data-act="guide">الدليل</button></div></div>`, 'jump', { wide: true, uni: sceneUni });
  const mark = { watched: '✓', watching: '▶', list: '+', skip: '✕' };
  const draw = () => { const q = $('#jq').value.trim().toLowerCase();
    const us = D.universes.filter(u => !q || u.name.includes(q) || u.nameEn.toLowerCase().includes(q));
    const ws = q ? D.placements.filter(p => { const w = D.works.get(p.work); return w.title.toLowerCase().includes(q) || (w.titleAr || '').includes(q); }).slice(0, 40) : [];
    $('#jres').innerHTML = ws.length ? `<h3>أعمال</h3><div class="hits">${ws.map(p => { const w = D.works.get(p.work), t = THEMES[p.universe]; return `<button class="hit" style="--c1:${t.c1}" data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}" data-force="1">${w.poster ? `<img loading="lazy" src="${img(w.poster, 'w92')}" alt="">` : '<span class="ph"></span>'}<span class="hit-text"><span class="t">${ltr(w.title + (p.season ? `: Season ${p.season}` : ''))}</span><small>${esc(uniOf(p.universe).name)}</small></span><span class="hit-mark">${mark[statusOf(p)] || ''}</span></button>`; }).join('')}</div>` : q && !us.length ? '<p class="empty">لا يوجد عمل أو عالم بهذا الاسم.</p>' : '';
    $('#jhome').innerHTML = group('عوالم متسلسلة', us.filter(u => u.serial)) + group('أعمال منفردة', us.filter(u => !u.serial)); };
  $('#jq').addEventListener('input', draw); draw();
  if (matchMedia('(hover:hover)').matches) $('#jq').focus();
}
const encode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
function openBackup() {
  openSheet('سجل المشاهدة', `<div class="dw guide" style="padding-top:14px"><p>سجلك محفوظ في هذا المتصفح فقط. انسخ الكود واحتفظ به، والصقه في أي جهاز أو متصفح ثاني لاسترجاع السجل.</p>
    <textarea id="bk" aria-label="كود السجل">${encode(store)}</textarea>
    <div class="actions"><button data-act="bkcopy">نسخ الكود</button><button data-act="bkimport">استيراد الكود الملصوق</button></div>
    <h4>النقل من النسخة القديمة</h4><p>افتح موقعك القديم، اضغط «نسخ احتياطي» وانسخ الكود، ثم الصقه هنا واضغط استيراد. يتحول تلقائياً للنظام الجديد.</p></div>`, 'backup');
}
function importCode() {
  let raw; try { raw = JSON.parse(decodeURIComponent(escape(atob($('#bk').value.trim())))); } catch { return toast('الكود غير صالح'); }
  let works = 0, eps = 0;
  if (raw.trackerState || raw.epState) { // كود النسخة القديمة
    for (const [k, v] of Object.entries(raw.trackerState || {})) { const m = D.legacyMap[k], s = LEGACY_STATUS[v]; if (m && s) { store.works[m.season ? `${m.work}#${m.season}` : m.work] = s; works++; } }
    const byMaze = new Map([...D.works.values()].filter(w => w.tvmaze).map(w => [String(w.tvmaze), w.id]));
    for (const [k, v] of Object.entries(raw.epState || {})) { const m = /^sh_(\d+)_S(\d+)E(\d+)$/.exec(k), id = m && byMaze.get(m[1]); if (v && id) { setEp(id, +m[2], +m[3], true); eps++; } }
  } else if (raw.v === 1) { store = { ...blank(), ...raw }; works = Object.keys(store.works).length; eps = Object.values(store.eps).reduce((a, o) => a + Object.keys(o).length, 0); }
  else return toast('الكود غير معروف');
  save(); closeSheet(); syncShield(); render(); toast(`تم الاستيراد: ${works} عملاً و${eps} حلقة`);
}
function openGuide() {
  openSheet('دليل الاستخدام', `<div class="dw guide" style="padding-top:14px">
    <h4>العوالم</h4><p>كل عالم قصة مستقلة. العالم «المتسلسل» يُشاهد بالترتيب المكتوب على كل بطاقة (ترتيب أحداث القصة لا تاريخ الصدور). الأعمال «المنفردة» تُشاهد بأي ترتيب.</p>
    <h4>طرق العرض</h4><ul><li><b>البطاقات:</b> كل التفاصيل والتقييم وحالة المشاهدة.</li><li><b>الخط الزمني:</b> نظرة سريعة على التسلسل، مع ما قبل كل عمل وما بعده.</li><li><b>ترتيب آروفيرس:</b> أي موسم وأي حلقة تشاهد أولاً بين المسلسلات المتداخلة.</li></ul>
    <h4>درع الحرق</h4><p>وهو مفعّل، تبقى معلومات الارتباط الحساسة مقفولة، وملخصات الحلقات التي لم تشاهدها مموّهة حتى تضغط عليها.</p>
    <h4>التقييمات</h4><p>الرقم الظاهر هو تقييم ${ltr('TMDB')} ويتحدث يومياً. أزرار ${ltr('IMDb')} و${ltr('Rotten Tomatoes')} تفتح صفحة العمل نفسها هناك.</p>
    <h4>الأعمال القادمة</h4><p>تظهر آخر عالمها مع عدّاد الأيام، وتنتقل لمكانها تلقائياً يوم صدورها.</p>
    <h4>عمل في عالمين</h4><p>بعض الأعمال أُنتجت في عالم ثم اعتُمدت رسمياً في عالم آخر. تظهر في العالمين بسجل مشاهدة واحد، ومعها مصدر الاعتماد.</p></div>`, 'guide');
}
function tonight() {
  const seen = new Set();
  const pick = D.placements.map(p => ({ p, w: D.works.get(p.work) })).filter(({ p, w }) => !isSoon(w) && !statusOf(p) && w.tmdbRating != null && !seen.has(w.id) && seen.add(w.id))
    .sort((a, b) => b.w.tmdbRating - a.w.tmdbRating || b.w.tmdbVotes - a.w.tmdbVotes)[0];
  if (!pick) return toast('شاهدت كل الأعمال الصادرة');
  openWork(pick.w.id, pick.p.season); toast('اقتراح: الأعلى تقييماً مما لم تشاهده');
}

// ---------- الأحداث
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) { if (ev.target.id === 'backdrop') closeSheet(); if (ev.target.id === 'lightbox') history.back(); return; }
  const d = b.dataset, id = d.id, season = d.season ? +d.season : undefined;
  switch (d.act) {
    case 'view': if (ui.sheet) closeSheet(); ui.view = d.view; render(); scrollTo(0, 0); break;
    case 'uni': if (ui.sheet) closeSheet(); if (ui.view === 'arrow') ui.view = 'cards'; ui.uni = d.uni; render(); scrollTo(0, 0); break;
    case 'open': openWork(id, season, b.closest('.card,.node')); break;
    case 'season': showSeason(id, season); break;
    case 'close': closeSheet(); break;
    case 'shield': if (ui.sheet) closeSheet(); store.shield = !store.shield; save(); syncShield(); render(true); toast(store.shield ? 'درع الحرق مفعّل' : 'درع الحرق متوقف'); break;
    case 'status': { const host = b.closest('[data-k]'), k = host.dataset.k; if (store.works[k] === d.s) delete store.works[k]; else store.works[k] = d.s; save();
      if (!host.classList.contains('node')) { render(true); break; }
      const on = store.works[k] === 'watched'; // في الخط الزمني يتغيّر العنصر في مكانه حتى يظهر الانتقال
      for (const n of $$('.node')) if (n.dataset.k === k) { n.classList.toggle('done', on); const sb = $('[data-act=status]', n); sb.setAttribute('aria-pressed', on); sb.textContent = on ? '✓ شاهدته' : 'علّمه مشاهَد'; }
      stats(); refreshProgress(); break; }
    case 'goto': { const force = d.force; if (ui.sheet) closeSheet(); if (force) ui.uni = d.uni; setTimeout(() => goTo(d.to === 't' ? 'timeline' : 'cards', d.uni, d.target), force ? 60 : 0); break; }
    case 'ep': setEp(id, season, +d.ep, !epDone(id, season, +d.ep)); save(); showSeason(id, season); stats(); ui.dirty = true; break;
    case 'seasonall': { const s = D.episodes.get(id).seasons.find(x => x.n === season), on = !s.episodes.every(e => epDone(id, season, e.n)); s.episodes.filter(e => e.date && e.date <= TODAY).forEach(e => setEp(id, season, e.n, on)); save(); showSeason(id, season); stats(); ui.dirty = true; break; }
    case 'reveal': b.classList.remove('blur'); b.removeAttribute('data-act'); b.nextElementSibling?.remove(); break;
    case 'avpart': setEp(id, season, +d.ep, !epDone(id, season, +d.ep)); save(); render(true); break;
    case 'avblock': { let all = true; for (let e = +d.from; e <= +d.to; e++) all &&= epDone(id, season, e); for (let e = +d.from; e <= +d.to; e++) setEp(id, season, e, !all); save(); render(true); break; }
    case 'jump': openJump(); break;
    case 'backup': openBackup(); break;
    case 'bkcopy': navigator.clipboard?.writeText($('#bk').value).then(() => toast('تم النسخ'), () => { $('#bk').select(); toast('حدّد النص وانسخه يدوياً'); }); break;
    case 'bkimport': importCode(); break;
    case 'guide': openGuide(); break;
    case 'tonight': if (ui.sheet) closeSheet(); setTimeout(tonight, 60); break;
    case 'light': if (d.src) { $('#lightImg').src = d.src; $('#lightbox').hidden = false; history.pushState({ sheet: 1, light: 1 }, ''); } break;
    case 'lightclose': history.back(); break;
  }
});
// إغلاق النافذة يعيد رسم الصفحة إذا تغيّر سجل الحلقات
new MutationObserver(() => { if ($('#sheet').hidden && ui.dirty) { ui.dirty = false; render(true); } }).observe($('#sheet'), { attributes: true, attributeFilter: ['hidden'] });
addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#lightbox').hidden) history.back(); else closeSheet(); } });
let qt; ['input', 'change'].forEach(t => $('#filters').addEventListener(t, () => { clearTimeout(qt); qt = setTimeout(() => render(), 150); }));
// ميلان البوستر المكبَّر مع حركة المؤشر أو الإصبع
$('#lightbox').addEventListener('pointermove', e => { const r = $('#lightImg').getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  $('#lightImg').style.transform = `rotateY(${(x * 22).toFixed(1)}deg) rotateX(${(-y * 22).toFixed(1)}deg) scale(1.02)`; });
$('#lightbox').addEventListener('pointerleave', () => $('#lightImg').style.transform = '');
document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG' && !t.dataset.failed) { t.dataset.failed = 1; t.style.visibility = 'hidden'; } }, true);

boot();
