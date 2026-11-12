// واجهة الأدلة (دي سي، Fate…). الدليل يُحدَّد من data-guide في الصفحة، وبياناته من مجلد data المجاور لها (تُبنى آلياً).
import { GUIDES } from './guides.js?v=__BUILD__';
import { shell } from './shell.js?v=__BUILD__';
const BUILD = '__BUILD__'; // يُستبدل برقم النشر حتى لا يعرض المتصفح نسخة قديمة من الملفات
const G = GUIDES[document.documentElement.dataset.guide] || GUIDES.dc;
const { THEMES, SHOW_COLORS = {} } = await import(`./themes-${G.id}.js?v=${BUILD}`);
document.body.insertAdjacentHTML('afterbegin', shell(G));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
const TODAY = new Date().toISOString().slice(0, 10);
const typeOf = w => w.format || G.types[w.kind + '|' + w.medium] || '';
const yearOf = (w, p) => ((p?.season && w.seasons?.find(x => x.n === p.season)?.date) || w.date || '').slice(0, 4) || w.year; // للموسم سنة عرضه هو
const titleOf = p => p.title || D.works.get(p.work).title + (p.season ? `: Season ${p.season}` : '');
const STATUS = { watched: 'شاهدته', watching: 'أشاهده', list: 'قائمتي', skip: 'تجاوز' };
const STATUS_IC = { watched: 'check', watching: 'play', list: 'mark', skip: 'skip' };
// الأيقونات مرسومة في index.html (رموز SVG) لا حروفاً نصية
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const tick = (on, yes, no) => ic(on ? 'check' : 'ring') + `<span>${on ? yes : no}</span>`;
const LEGACY_STATUS = { watched: 'watched', watching: 'watching', watchlist: 'list', skipped: 'skip' };
const reduce = matchMedia('(prefers-reduced-motion: reduce)'), phone = matchMedia('(max-width:560px)');
const root = document.documentElement;
root.classList.toggle('anim', !reduce.matches);
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

// ---------- التخزين (مفتاح واحد ثابت؛ أي تغيير مستقبلي يكون بترقية v داخل البيانات لا بتغيير المفتاح)
const KEY = G.key;
const blank = () => ({ v: 1, works: {}, eps: {}, shield: true });
let store = blank();
try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && raw.v === 1) store = { ...blank(), ...raw }; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { toast('تعذّر الحفظ في هذا المتصفح'); } };

// ---------- البيانات
const D = { universes: [], works: new Map(), placements: [], bridges: [], legacyMap: {}, base: '', arrow: null, order: null, mal: {}, episodes: new Map() };
const ui = { view: 'cards', uni: 'all', sheet: null };
const getJSON = async u => { const r = await fetch(u + '?v=' + BUILD); if (!r.ok) throw new Error(u + ' → ' + r.status); return r.json(); };

async function boot() {
  try {
    const [base, cat, arrow, mal] = await Promise.all([getJSON('data/base.json'), getJSON('data/catalog.json'), G.order?.kind === 'arrow' ? getJSON(G.order.file) : null, G.malScore ? getJSON('data/mal.json').catch(() => ({})) : {}]);
    const extra = new Map(cat.works.map(w => [w.id, w]));
    for (const w of base.works) D.works.set(w.id, { ...w, ...(extra.get(w.id) || {}) });
    Object.assign(D, { universes: base.universes, placements: base.placements, bridges: base.bridges || [], legacyMap: base.legacyMap || {}, base: cat.imageBase, arrow, order: base.order, mal: mal.anime || {} });
    $('#builtAt').textContent = 'آخر تحديث للبيانات: ' + fmtDate(cat.generatedAt.slice(0, 10));
  } catch (e) {
    $('#veil')?.remove();
    $('#main').innerHTML = `<p class="empty">تعذّر تحميل البيانات. حدّث الصفحة، وإذا استمر الخطأ فالسبب: ${esc(e.message)}</p>`; return;
  }
  renderUnibar(); syncShield(); render(); liftVeil();
}
// كشف ستار الدخول: دي سي يُسحب جانباً كلوحة قصة مصورة، وFate يتلاشى مع حلقة استدعاء تتسع
function liftVeil() {
  const v = $('#veil'); if (!v || v.hidden) return; const done = () => v.remove();
  if (reduce.matches) return done();
  v.classList.add('lift');
  const a = G.id === 'fate' ? v.animate({ opacity: [1, 1, 0] }, { duration: 850, easing: 'ease-in', fill: 'forwards' })
    : v.animate({ transform: ['none', 'translateX(-125%)'] }, { duration: 640, delay: 140, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
  a.finished.then(done, done); setTimeout(done, 1500);
}

// ---------- مساعدات
const img = (path, size) => path ? D.base + size + path : '';
const STAGE = { production: 'قيد الإنتاج، وتاريخ الصدور لم يُحدَّد بعد', development: 'قيد التطوير، وموعده لم يُحدَّد بعد' };
const isSoon = w => !w.date || w.date > TODAY;
// العدد والمعدود بقواعد العربية: 1 مفرد، 2 مثنى، 3 إلى 10 جمع، 11 إلى 99 مفرد منصوب، والمئات وما بعدها حسب آخر خانتين
// [مفرد، مثنى مرفوع، مثنى منصوب أو مجرور، جمع، مفرد منصوب، واحد/واحدة]
const NOUN = { ep: ['حلقة', 'حلقتان', 'حلقتين', 'حلقات', 'حلقة', 'واحدة'], season: ['موسم', 'موسمان', 'موسمين', 'مواسم', 'موسماً', 'واحد'], day: ['يوم', 'يومان', 'يومين', 'أيام', 'يوماً', 'واحد'],
  min: ['دقيقة', 'دقيقتان', 'دقيقتين', 'دقائق', 'دقيقة', 'واحدة'], vote: ['صوت', 'صوتان', 'صوتين', 'أصوات', 'صوتاً', 'واحد'], work: ['عمل', 'عملان', 'عملين', 'أعمال', 'عملاً', 'واحد'],
  part: ['جزء', 'جزءان', 'جزأين', 'أجزاء', 'جزءاً', 'واحد'], step: ['خطوة', 'خطوتان', 'خطوتين', 'خطوات', 'خطوة', 'واحدة'], show: ['مسلسل', 'مسلسلان', 'مسلسلين', 'مسلسلات', 'مسلسلاً', 'واحد'] };
const unit = (n, k) => { const f = NOUN[k], m = n % 100; return n === 0 || (m >= 3 && m <= 10) ? f[3] : m >= 11 ? f[4] : f[0]; };
const cnt = (n, k, obl) => { const f = NOUN[k]; return n === 1 ? `${f[0]} ${f[5]}` : n === 2 ? f[obl ? 2 : 1] : `${n.toLocaleString('en')} ${unit(n, k)}`; };
// العدّاد: رقم كبير ثم المعدود، و«يوم واحد» و«يومان» بلا رقم
const countdown = (d, what) => d <= 0 ? `<b>اليوم</b><span>${what}` : d === 1 ? `<b>يوم</b><span>واحد على ${what}` : d === 2 ? `<b>يومان</b><span>على ${what}` : `<b>${d}</b><span>${unit(d, 'day')} على ${what}`;
const bits = a => a.filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
const daysLeft = w => Math.ceil((new Date(w.date) - new Date(TODAY)) / 864e5);
// العدّاد الحي: أيام كاملة ثم ساعة:دقيقة:ثانية حتى منتصف ليل يوم الصدور بتوقيت الجهاز. يتحدث كل ثانية (انظر المؤقت في آخر الملف).
const liveCount = (date, what) => { const ms = new Date(date + 'T00:00:00') - Date.now(), d = Math.floor(ms / 864e5), p = n => String(n).padStart(2, '0');
  const clk = ms > 0 ? `${p(Math.floor(ms / 36e5) % 24)}:${p(Math.floor(ms / 6e4) % 60)}:${p(Math.floor(ms / 1e3) % 60)}` : '';
  return (ms <= 0 ? `<b>اليوم</b><span>${what}` : d < 1 ? `<b dir="ltr">${clk}</b><span>على ${what}` : `${countdown(d, what)} <bdi dir="ltr" class="clk">${clk}</bdi>`) + `<br><small>${fmtDate(date)}</small></span>`; };
const liveBox = (date, what, cls, extra = '') => `<div class="count ${cls}" data-until="${date}" data-what="${esc(what)}"><span class="cd">${liveCount(date, what)}</span>${extra}</div>`;
setInterval(() => { if (document.hidden) return; for (const el of document.querySelectorAll('.count[data-until] > .cd')) el.innerHTML = liveCount(el.parentNode.dataset.until, el.parentNode.dataset.what); }, 1000);
const sKey = p => p.season ? `${p.work}#${p.season}` : p.work;
const statusOf = p => store.works[sKey(p)] || '';
const domId = (pre, p) => `${pre}-${p.universe}-${p.work}${p.season ? '-s' + p.season : ''}`;
const uniOf = id => D.universes.find(u => u.id === id);
const epDone = (id, s, e) => !!store.eps[id]?.[`${s}-${e}`];
const seasonTotal = (w, s) => (w.seasons || []).filter(x => !s || x.n === s).reduce((a, x) => a + (x.episodes || 0), 0);
const seasonDone = (id, s) => Object.keys(store.eps[id] || {}).filter(k => s ? k.startsWith(s + '-') : !k.startsWith('0-')).length; // الحلقات الخاصة (الموسم 0) لا تدخل في عدّ العمل كاملاً
const tmdbUrl = w => `https://www.themoviedb.org/${w.seasons || w.kind === 'series' ? 'tv' : 'movie'}/${w.tmdb}`;
const themeVars = id => { const t = THEMES[id]; return `--bg:${t.bg};--c1:${t.c1};--c2:${t.c2}`; };
// التقييم معلومة فمكانه مع العنوان؛ والروابط الخارجية أفعال فمكانها مع الأزرار، وكلٌّ منها يقول ما ستجده هناك.
// في دليل الأنمي التقييم من MyAnimeList للإدراج نفسه (العمل أو الموسم)، وإن غاب فمن TMDB.
const rating = (w, p) => { const m = G.malScore && p?.mal ? D.mal[p.mal] : null;
  return m?.score != null ? { v: m.score, votes: m.votes, name: 'MAL', href: `https://myanimelist.net/anime/${p.mal}` } : w.tmdbRating != null ? { v: w.tmdbRating, votes: w.tmdbVotes || 0, name: 'TMDB', href: tmdbUrl(w) } : null; };
const gaugeRow = (w, p) => { const r = rating(w, p); return r ? `<a class="gauge ${String(r.v).length > 3 ? 'fine' : ''}" style="--v:${Math.round(r.v * 10)}" href="${r.href}" target="_blank" rel="noopener" aria-label="تقييم ${r.name} ${r.v} من 10">${r.v}</a><span class="src"><b>تقييم ${ltr(r.name)}</b>${cnt(r.votes, 'vote')}</span>` : ''; };
// Letterboxd للأفلام فقط (لا يستورد المسلسلات) ويُفتح برقم TMDB. Trakt يُفتح برقم IMDb لأن رابط البحث برقم TMDB يعطي 404 في تطبيقه الجديد.
// MyAnimeList وSimkl يُفتحان برقم الإدراج نفسه (لكل موسم صفحته هناك).
const isTv = w => !!w.seasons || w.kind === 'series';
const LINKS = {
  imdb: w => w.imdb && [`https://www.imdb.com/title/${w.imdb}/`, 'تقييم الجمهور', 'IMDb'],
  rt: w => w.rt && [`https://www.rottentomatoes.com/${w.rt}`, 'آراء النقاد', 'Rotten Tomatoes'],
  letterboxd: w => w.tmdb && !isTv(w) && [`https://letterboxd.com/tmdb/${w.tmdb}`, 'مراجعات وقوائم', 'Letterboxd'],
  trakt: w => w.imdb && [`https://trakt.tv/${isTv(w) ? 'shows' : 'movies'}/${w.imdb}`, 'تتبّع المشاهدة', 'Trakt'],
  mal: (w, p) => p?.mal && [`https://myanimelist.net/anime/${p.mal}`, 'التقييم والمراجعات', 'MyAnimeList'],
  simkl: (w, p) => p?.simkl && [`https://simkl.com/anime/${p.simkl}`, 'تتبّع المشاهدة', 'Simkl'],
};
const xlinks = (w, p) => { const list = G.links.map(k => LINKS[k](w, p)).filter(Boolean).map(([href, what, name]) => `<a href="${href}" target="_blank" rel="noopener"><small>${what}</small>${ic('ext')}<b>${ltr(name)}</b></a>`);
  return list.length ? `<div class="xlinks">${list.join('')}</div>` : ''; };
const rateBlock = (w, p) => { const r = rating(w, p), v = isSoon(w) ? null : verdict(r?.v); return `<div class="rates wide">${gaugeRow(w, p)}${v && r ? `<span class="tag" style="color:${v[1]}">${v[0]}</span>` : ''}${xlinks(w, p)}</div>`; };
const daysTo = d => Math.ceil((new Date(d) - new Date(TODAY)) / 864e5);
// ما القادم لمسلسل صادر: حلقة بموعد، موسم بموعد، موسم معلن بلا موعد، أو مستمر بلا إعلان
function nextInfo(w) {
  if (!w.seasons || isSoon(w)) return null;
  if (w.nextEpisode?.date && w.nextEpisode.date >= TODAY) return { kind: 'episode', ...w.nextEpisode };
  const fut = w.seasons.find(x => x.date && x.date > TODAY); if (fut) return { kind: 'season', season: fut.n, date: fut.date };
  const ann = w.seasons.find(x => !x.date); if (ann) return { kind: 'announced', season: ann.n };
  return w.status === 'Returning Series' ? { kind: 'returning' } : null;
}
function nextBlock(w, cls = '') {
  const n = nextInfo(w); if (!n) return '';
  if (n.kind === 'returning') return `<p class="next-note ${cls}">المسلسل مستمر، ولم يُعلن موعد حلقات جديدة بعد.</p>`;
  if (n.kind === 'announced') return `<div class="count ${cls}"><span>الموسم ${n.season} معلن، وموعد عرضه لم يُحدَّد بعد</span></div>`;
  const d = daysTo(n.date), what = n.kind === 'episode' ? `الحلقة القادمة: الموسم ${n.season}، الحلقة ${n.episode}` : `بداية الموسم ${n.season}`;
  return liveBox(n.date, what, cls);
}
const nextTag = w => { const k = nextInfo(w)?.kind; return k === 'episode' ? '<span class="tag soon">يُعرض الآن</span>' : k === 'season' || k === 'announced' ? '<span class="tag soon">موسم قادم</span>' : ''; };
const verdict = r => r == null ? null : r >= 7.5 ? ['ممتاز', '#35d07f'] : r >= 6.8 ? ['جيد', '#57abff'] : r >= 6 ? ['متوسط', '#f2b84b'] : ['ضعيف', '#ef5d57'];
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
const posterTag = w => w.poster
  ? `<img loading="lazy" decoding="async" src="${img(w.poster, 'w342')}" srcset="${img(w.poster, 'w185')} 185w, ${img(w.poster, 'w342')} 342w, ${img(w.poster, 'w500')} 500w" sizes="128px" alt="بوستر ${esc(w.title)}">`
  : `<span class="ph">${esc(w.title)}</span>`;

function stats() {
  const released = [...D.works.values()].filter(w => !isSoon(w)).length;
  const watched = new Set(Object.entries(store.works).filter(([, s]) => s === 'watched').map(([k]) => k.split('#')[0])).size;
  const eps = Object.values(store.eps).reduce((a, o) => a + Object.keys(o).length, 0);
  $('#statsLine').textContent = `شاهدت ${watched} من ${cnt(released, 'work', true)}، وسجّلت ${cnt(eps, 'ep', true)}`;
}
function syncShield() { const b = $('#shieldBtn'); b.innerHTML = ic('shield') + `<span>${store.shield ? 'درع الحرق: مفعّل' : 'درع الحرق: متوقف'}</span>`; b.classList.toggle('off', !store.shield); b.setAttribute('aria-pressed', store.shield); }

// ---------- شريط العوالم
function renderUnibar() {
  $('#unibar').innerHTML = `<button data-act="uni" data-uni="all">${G.allLabel}</button>` +
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
  if (s === 'upcoming') return isSoon(w) || ['episode', 'season', 'announced'].includes(nextInfo(w)?.kind);
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
  return `<header class="opener m-${t.motif}">${key?.backdrop ? `<img class="opener-img" loading="lazy" decoding="async" src="${img(key.backdrop, 'w780')}" srcset="${img(key.backdrop, 'w780')} 780w, ${img(key.backdrop, 'w1280')} 1280w" sizes="(max-width:560px) 60vw, 100vw" alt="">` : ''}<div class="motif"></div>
    <h2>${esc(u.name)}</h2>
    <p class="en">${ltr(u.nameEn)}</p>
    <p class="desc">${esc(u.description)}</p>
    <ul class="facts"><li>${esc(u.status)}</li><li>${u.serial ? 'يُشاهد بالترتيب' : 'أعمال منفردة، بأي ترتيب'}</li><li class="prog">شاهدت ${done} من ${rel.length}</li>${u.id === 'arrow' ? '<li class="act"><button data-act="view" data-view="arrow">ترتيب المشاهدة بالمواسم والحلقات</button></li>' : ''}</ul>
    <div class="bar"><i style="width:${rel.length ? Math.round(done / rel.length * 100) : 0}%"></i></div></header>`;
}

// ---------- البطاقات
function card(p) {
  const w = D.works.get(p.work), st = statusOf(p), soon = isSoon(w), v = verdict(rating(w, p)?.v);
  // سطران مقصودان: السنة والنوع، ثم المدة أو المواسم والحلقات
  const meta = [bits([yearOf(w, p), typeOf(w)]),
    bits(!w.seasons ? [w.runtime ? cnt(w.runtime, 'min') : ''] : p.season ? [`الموسم ${p.season}`, cnt(seasonTotal(w, p.season), 'ep')] : w.episodeCount ? [cnt((w.seasons || []).length, 'season'), cnt(w.episodeCount, 'ep')] : [])]
    .filter(Boolean).map(x => `<div class="meta bits">${x}</div>`).join('');
  const tot = w.seasons ? seasonTotal(w, p.season) : 0, dn = tot ? seasonDone(w.id, p.season) : 0;
  return `<article class="card" id="${domId('c', p)}" data-k="${esc(sKey(p))}">
    <div class="chead"><button class="poster" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} aria-label="تفاصيل ${esc(w.title)}">${posterTag(w)}</button>
    <div>
      <div class="ord">${uniOf(p.universe).serial && !soon ? 'الترتيب: ' : ''}${esc(p.label)}</div>
      <h3>${ltr(titleOf(p))}</h3>
      ${meta}
      <div class="tags">${soon ? (p.upcoming?.stage === 'development' ? '<span class="tag soon">معلن</span>' : '<span class="tag soon">قادم</span>') : v ? `<span class="tag" style="color:${v[1]}">${v[0]}</span>` : ''}${nextTag(w)}</div>
      ${rating(w, p) ? `<div class="rates">${gaugeRow(w, p)}</div>` : ''}
    </div></div>
    <div class="cbody"><p class="note">${esc(p.note)}</p>
    ${soon ? (src => w.date ? liveBox(w.date, 'الصدور', 'wide', src) : `<div class="count wide"><span>${STAGE[p.upcoming?.stage] || STAGE.production}</span>${src}</div>`)(p.upcoming?.source ? `<a class="src" href="${esc(p.upcoming.source)}" target="_blank" rel="noopener">المصدر</a>` : '') : ''}
    ${nextBlock(w, 'wide')}
    ${avLine(p, 'wide')}
    ${p.order ? `<p class="canon wide">${esc(p.order.note)} <a href="${esc(p.order.source)}" target="_blank" rel="noopener">المصدر</a></p>` : ''}${p.news ? `<p class="canon wide"><b>قادم:</b> ${esc(p.news.note)} ${p.news.sources.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">المصدر${p.news.sources.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' ')}</p>` : ''}
    ${p.canon ? `<div class="canon wide">يظهر في عالمين: ${esc(p.canon.note)} <a href="${esc(p.canon.source)}" target="_blank" rel="noopener">المصدر</a></div>` : ''}
    ${p.spoiler ? (store.shield ? `<details class="vault wide"><summary>${ic('lock')}<span>معلومة ارتباط فيها حرق</span><b>اكشفها</b></summary><p>${esc(p.spoiler)}</p></details>` : `<p class="note wide">${esc(p.spoiler)}</p>`) : ''}</div>
    <div class="cfoot">${xlinks(w, p)}${soon ? '' : `<div class="status wide">${Object.entries(STATUS).map(([k, l]) => `<button data-act="status" data-s="${k}" aria-pressed="${st === k}">${ic(STATUS_IC[k])}<span>${l}</span></button>`).join('')}</div>`}
    <div class="actions wide"><button class="cta" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} ${tot ? `style="--p:${Math.round(dn / tot * 100)}%"` : ''}>${w.seasons?.length ? `${ic('eps')}<span>الحلقات</span>${tot ? `<span class="epprog" title="شاهدت ${dn} من ${tot}"><bdi>${dn}/${tot}</bdi></span>` : ''}` : '<span>التفاصيل</span>'}</button>
      <button class="alt" data-act="goto" data-to="t" data-target="${domId('t', p)}" data-uni="${p.universe}" aria-label="موقعه في الخط الزمني">${ic('line')}<span>الخط الزمني</span></button></div></div>
  </article>`;
}
function renderCards() {
  const secs = sections();
  $('#main').innerHTML = secs.length ? secs.map(({ u, all, list }) => `<section class="uni" id="u-${u.id}" data-uni="${u.id}" style="${themeVars(u.id)}">${uniHead(u, all)}<div class="grid">${list.map(card).join('')}</div></section>`).join('')
    : '<p class="empty">لا توجد أعمال تطابق البحث أو التصفية الحالية.</p>';
}

// ---------- الخط الزمني
function node(p, i, list, step) {
  const w = D.works.get(p.work), soon = isSoon(w), prev = list[i - 1], next = list[i + 1], u = uniOf(p.universe), done = statusOf(p) === 'watched';
  const around = !step && u.serial && u.id !== 'arrow' ? [prev && ['قبله', D.works.get(prev.work).title], next && ['بعده', D.works.get(next.work).title]].filter(Boolean) : [];
  return `<div class="node ${done ? 'done' : ''} ${soon ? 'soon' : ''}" id="${domId('t', p)}" data-k="${esc(sKey(p))}">
    <button class="node-main" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} aria-label="تفاصيل ${esc(w.title)}">
      <span class="thumb">${w.poster ? `<img loading="lazy" src="${img(w.poster, 'w154')}" alt="">` : ''}<i class="seen" aria-hidden="true">✓</i></span>
      <span class="node-text"><span class="n">${step ? `الخطوة ${i + 1}${step.optional ? ' (اختيارية)' : ''}` : esc(p.label)}${soon ? (w.date ? ` · قادم بعد ${cnt(daysLeft(w), 'day', true)}` : ' · قادم') : ''}</span>
        <span class="t">${ltr(titleOf(p))}</span>
        <span class="meta">${esc([yearOf(w, p), typeOf(w)].filter(Boolean).join(' · '))}</span>
        ${around.length ? `<span class="meta">${around.map(([k, t]) => `${k}: ${ltr(t)}`).join(' · ')}</span>` : ''}${avStart(p) ? `<span class="meta">يبدأ في الخطوة ${avStart(p).n} من ترتيب المشاهدة</span>` : ''}${step?.note ? `<span class="meta">${esc(step.note)}</span>` : ''}</span></button>
    <div class="go">${soon ? '' : `<button class="tick" data-act="status" data-s="watched" aria-pressed="${done}">${tick(done, 'شاهدته', 'علّمه مشاهَد')}</button>`}<button data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}">البطاقة</button></div></div>`;
}
const avStart = p => { if (p.universe !== 'arrow' || !D.arrow) return null; return D.arrow.steps.find(s => (s.blocks || []).some(b => b.work === p.work && (!p.season || b.season === p.season)) || (s.parts || []).some(q => q.work === p.work && (!p.season || q.season === p.season))) || null; };
const avLine = (p, cls = '') => { const st = avStart(p); return st ? `<div class="canon ${cls}">في ترتيب المشاهدة: يبدأ في الخطوة ${st.n} (${esc(st.title)}). <button data-act="avgo" data-step="${st.id}">افتح الخطوة</button></div>` : ''; };
const tlNote = u => u.id === 'arrow' ? '<p class="tl-note">المسلسلات هنا مرتبة حسب سنة بدايتها فقط. المشاهدة الفعلية متداخلة بين مواسمها وحلقاتها. <button data-act="view" data-view="arrow">افتح ترتيب المشاهدة بالحلقات</button></p>' : '';
function renderTimeline() {
  const secs = sections();
  $('#main').innerHTML = secs.length ? secs.map(({ u, all, list }) => `<section class="uni" id="u-${u.id}" data-uni="${u.id}" style="${themeVars(u.id)}">${uniHead(u, all)}${tlNote(u)}<div class="tl">${list.map(node).join('')}</div></section>`).join('')
    : '<p class="empty">لا توجد أعمال تطابق البحث أو التصفية الحالية.</p>';
}
// تغيير الحالة أو تعليم حلقة يحدّث العناصر المعنية في مكانها: لا إعادة رسم للصفحة ولا إعادة تحميل للصور
function syncStatus(k) {
  const st = store.works[k] || '';
  for (const el of $$('#main [data-k]')) { if (el.dataset.k !== k) continue;
    if (el.classList.contains('node')) { const on = st === 'watched', sb = $('[data-act=status]', el); el.classList.toggle('done', on); if (sb) { sb.setAttribute('aria-pressed', on); sb.innerHTML = tick(on, 'شاهدته', 'علّمه مشاهَد'); } }
    else $$('.status button', el).forEach(x => x.setAttribute('aria-pressed', x.dataset.s === st)); }
}
function syncEps(id) {
  const w = D.works.get(id);
  for (const el of $$('#main .card')) { const [wid, sn] = el.dataset.k.split('#'); if (wid !== id) continue;
    const s = sn ? +sn : undefined, tot = seasonTotal(w, s), dn = seasonDone(id, s), box = $('.epprog', el); if (!box || !tot) continue;
    box.title = `شاهدت ${dn} من ${tot}`; $('bdi', box).textContent = `${dn}/${tot}`; box.parentElement.style.setProperty('--p', Math.round(dn / tot * 100) + '%'); }
}
function refreshProgress() {
  for (const sec of $$('section.uni[id]')) { const rel = D.placements.filter(p => p.universe === sec.dataset.uni && !isSoon(D.works.get(p.work))), done = rel.filter(p => statusOf(p) === 'watched').length;
    const li = $('.prog', sec), bar = $('.opener .bar i', sec); if (li) li.textContent = `شاهدت ${done} من ${rel.length}`; if (bar) bar.style.width = (rel.length ? Math.round(done / rel.length * 100) : 0) + '%'; }
}

// ---------- ترتيب آروفيرس
const rangeDone = b => { let n = 0; for (let e = b.from; e <= b.to; e++) n += epDone(b.work, b.season, e); return n; };
const avDone = () => D.arrow.steps.reduce((n, s) => n + (s.blocks || []).reduce((m, b) => m + rangeDone(b), 0) + (s.parts || []).filter(p => epDone(p.work, p.season, p.episode)).length, 0);
function avRefresh(stepEl) { // يعيد رسم خطوة واحدة ويحدّث عدّاد التقدم
  const a = D.arrow, st = a.steps.find(x => x.id === stepEl.id); if (st) stepEl.outerHTML = stepHTML(st, true);
  const done = avDone(), lbl = $('#avLbl'), bar = $('#avBar'); if (lbl) lbl.textContent = `تقدّمك: ${done} من ${cnt(a.totalEpisodes, 'ep', true)}`; if (bar) bar.style.width = Math.round(done / a.totalEpisodes * 100) + '%';
}
// ---------- ترتيب المشاهدة كمسارات جاهزة (دليل Fate): لكل مسار سببه ومصدره، والخطوات هي نفس عناصر الخط الزمني
function renderPaths() {
  const o = D.order, cur = o.paths.find(x => x.id === ui.path) || o.paths[0], u0 = D.placements.find(p => p.work === cur.steps[0].work).universe;
  const find = st => D.placements.find(p => p.work === st.work && (p.season ?? null) === (st.season ?? null));
  $('#main').innerHTML = `<section class="uni" data-uni="${u0}" style="${themeVars(u0)}">
    <div class="av-intro"><h2>${esc(G.order.here)}</h2>
      <p>${esc(o.intro || '')}</p>
      <div class="seasons paths" role="tablist">${o.paths.map(x => `<button data-act="path" data-path="${x.id}" class="${x === cur ? 'on' : ''}" role="tab" aria-selected="${x === cur}">${esc(x.name)}</button>`).join('')}</div>
      <p class="why">${esc(cur.why)} <a href="${esc(cur.source)}" target="_blank" rel="noopener">المصدر: ${ltr(cur.sourceName)}</a></p></div>
    <div class="tl">${cur.steps.map((st, i, all) => node(find(st), i, all, st)).join('')}</div>
    ${o.outro ? `<p class="tl-note">${esc(o.outro)}</p>` : ''}
  </section>`;
}
function renderArrow() {
  if (G.order?.kind === 'paths') return renderPaths();
  const a = D.arrow, done = avDone();
  $('#main').innerHTML = `<section class="uni" data-uni="arrow" style="${themeVars('arrow')}">
    <div class="av-intro"><h2>ترتيب مشاهدة ${ltr('Arrowverse')}</h2>
      <ul><li>${cnt(a.steps.length, 'step')} تغطي ${cnt(a.totalEpisodes, 'ep', true)} من ${cnt(a.showCount, 'show', true)}. كل حلقة موجودة مرة واحدة فقط.</li>
      <li>اتبع الخطوات بالترتيب، وداخل كل خطوة اتبع الأسطر من الأعلى للأسفل.</li>
      <li>الخطوات البرتقالية حلقات تقاطع: قصة واحدة موزعة على أكثر من مسلسل، وتُشاهد بترتيب الأجزاء.</li>
      <li>الترتيب مبني على تواريخ العرض الفعلية وعناوين الحلقات الرسمية.</li>
      <li>${a.sideShows.map(x => `${ltr(x.show)} يبدأ في الخطوة ${x.firstStep}`).join('، و')}. يدوران في أرضين مستقلتين عن أرض بقية المسلسلات، ومكانهما في الخطوات حسب تاريخ عرضهما. ${a.sideShows.map(x => `<a href="${esc(x.source)}" target="_blank" rel="noopener">مصدر ${ltr(x.show)}</a>`).join(' · ')}</li></ul>
      <span class="lbl" id="avLbl">تقدّمك: ${done} من ${cnt(a.totalEpisodes, 'ep', true)}</span><div class="bar"><i id="avBar" style="width:${Math.round(done / a.totalEpisodes * 100)}%"></i></div></div>
    <div class="steps">${a.steps.map(s => stepHTML(s)).join('')}</div>
  </section>`;
}
const stepHTML = (s, shown) => s.kind === 'crossover' ? `<div class="step cross${shown ? ' shown' : ''}" id="${s.id}"><div class="step-head"><span class="num">${s.n}</span><h3>${esc(s.title)} <span class="en">${ltr(s.titleEn)}</span></h3><span class="tag soon">${cnt(s.parts.filter(p => !p.tieIn).length, 'part')} بالترتيب</span><span class="meta">${esc(s.label)}</span></div>
        ${s.parts.map(p => { const d = epDone(p.work, p.season, p.episode); return `<div class="row ${d ? 'done' : ''} ${p.tieIn ? 'tie' : ''}" style="--show:${SHOW_COLORS[p.work]}"><span class="k">${p.tieIn ? '＋' : p.part}</span>
          <span class="show">${ltr(p.show)}<span class="epname">${ltr(p.name || '')}</span></span>
          <span class="what">${p.tieIn ? 'حلقة مرتبطة' : `الجزء ${p.part}`}: الموسم ${p.season}، الحلقة ${p.episode}<small>${fmtDate(p.aired)}</small></span>
          <span class="btns"><button class="tick" aria-pressed="${!!d}" data-act="avpart" data-id="${p.work}" data-season="${p.season}" data-ep="${p.episode}">${tick(d, 'شاهدتها', 'علّمها مشاهدة')}</button><button data-act="open" data-id="${p.work}" data-season="${p.season}">افتح الموسم</button></span>
          ${p.note ? `<span class="link">${esc(p.note)}</span>` : ''}</div>`; }).join('')}</div>`
      : `<div class="step${shown ? ' shown' : ''}" id="${s.id}"><div class="step-head"><span class="num">${s.n}</span><h3>${esc(s.title)}</h3>${s.title !== s.label ? `<span class="meta">${esc(s.label)}</span>` : ''}</div>
        ${s.blocks.map((b, i) => { const dn = rangeDone(b), full = dn === b.count; return `<div class="row ${full ? 'done' : ''}" style="--show:${SHOW_COLORS[b.work]}"><span class="k">${i + 1}</span>
          <span class="show">${ltr(b.show)}</span>
          <span class="what">الموسم ${b.season}: ${b.whole ? 'كامل' : `من الحلقة ${b.from} إلى الحلقة ${b.to}`}<small>${cnt(b.count, 'ep')} · شاهدت ${dn}${b.side ? ' · أرض مستقلة: لا يتقاطع مع المسلسلات الأخرى' : ''}</small></span>
          <span class="btns"><button class="tick" aria-pressed="${!!full}" data-act="avblock" data-id="${b.work}" data-season="${b.season}" data-from="${b.from}" data-to="${b.to}">${tick(full, 'مكتملة', 'علّمها مشاهدة')}</button><button data-act="open" data-id="${b.work}" data-season="${b.season}">الحلقات</button></span>
          ${b.links.map(l => `<span class="link">الحلقة ${l.episode}${l.toEpisode ? ' إلى ' + l.toEpisode : ''}: ${esc(l.note)}</span>`).join('')}</div>`; }).join('')}</div>`;


function render(keepScroll) {
  const y = scrollY;
  ({ cards: renderCards, timeline: renderTimeline, arrow: renderArrow })[ui.view]();
  syncNav(); stats(); watchTheme(); reveal(keepScroll);
  if (keepScroll) scrollTo(0, y);
}
// دخول العناصر: كل عنصر يظهر مرة واحدة حين يصل الشاشة (حركة transform/opacity فقط، ثم تُرفع عنه)
let rio;
function reveal(still) {
  rio?.disconnect();
  const els = $$('#main :is(.card,.node,.step,.opener)');
  if (still || reduce.matches) { els.forEach(e => e.classList.add('shown')); return; }
  rio = new IntersectionObserver(es => { let i = 0; for (const e of es) if (e.isIntersecting) { const t = e.target;
    t.style.setProperty('--d', Math.min(i++, 5) * 45 + 'ms'); t.classList.add('shown', 'enter'); rio.unobserve(t); } }, { rootMargin: '0px 0px -4% 0px' });
  els.forEach(e => rio.observe(e));
  // شبكة أمان: لو تأخر المراقب لأي سبب، لا يبقى عنصر ظاهر على الشاشة مخفياً
  clearTimeout(reveal.t); reveal.t = setTimeout(() => { for (const e of els) { if (e.classList.contains('shown') || !e.isConnected) continue; const r = e.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) e.classList.add('shown'); } }, 1500);
}
const flash = el => { el.classList.add('shown', 'flash'); setTimeout(() => el.classList.remove('flash'), 1700);
  if (!reduce.matches) { const c = getComputedStyle(el).getPropertyValue('--c1'); el.animate([{ boxShadow: `0 0 0 3px ${c}` }, { boxShadow: `0 0 0 3px ${c}`, offset: .55 }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1700, easing: 'ease-out' }); } };
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
  sceneUni = ''; setScene($('.uni')?.dataset.uni || G.first);
}
function goTo(view, uni, targetId) {
  ui.view = view; if (ui.uni !== 'all' && uni) ui.uni = uni;
  $('#q').value = ''; $('#fType').value = ''; $('#fStatus').value = '';
  render();
  const t = targetId && document.getElementById(targetId);
  if (t) { t.scrollIntoView({ block: 'center', behavior: 'instant' }); flash(t); }
  else scrollTo(0, 0);
}

// ---------- البطاقة المنبثقة. الحركة كلها transform/opacity على طبقتها الخاصة: لا لقطة للصفحة ولا إعادة رسم لما خلفها.
let closing = null;
const EASE = 'cubic-bezier(.2,.85,.25,1)';
function openSheet(title, html, tag, o = {}) {
  const sh = $('#sheet'), bd = $('#backdrop'), was = ui.sheet;
  if (closing) { closing.forEach(a => a.cancel()); closing = null; }
  $('#sheetTitle').innerHTML = title; $('#sheetBody').innerHTML = html; $('#sheetBody').scrollTop = 0;
  sh.className = 'sheet' + (o.wide ? ' wide' : '') + (o.tall ? ' tall' : ''); sh.style.cssText = o.uni && THEMES[o.uni] ? themeVars(o.uni) : '';
  sh.hidden = false; bd.hidden = false; root.classList.add('sheet-open');
  if (!was) history.pushState({ sheet: 1 }, '');
  ui.sheet = tag || 'x';
  if (!was && !reduce.matches) {
    // موضعا البوستر يُقاسان قبل بدء الحركة، ثم يطير البوستر من البطاقة إلى مكانه في النافذة
    const src = o.from, dst = src && $('.dw-top .poster', sh), a = src?.getBoundingClientRect(), b = dst?.getBoundingClientRect();
    bd.animate({ opacity: [0, 1] }, { duration: 220, easing: 'ease-out' });
    sh.animate(phone.matches ? { transform: ['translateY(100%)', 'none'] } : { transform: ['translateY(20px) scale(.96)', 'none'], opacity: [0, 1] }, { duration: phone.matches ? 360 : 280, easing: EASE });
    if (dst && a.width && a.bottom > 0 && a.top < innerHeight) {
      const g = Object.assign(document.createElement('img'), { src: src.currentSrc || src.src, className: 'ghost', alt: '' });
      g.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;--c1:${getComputedStyle(sh).getPropertyValue('--c1')}`;
      document.body.append(g); dst.style.visibility = 'hidden';
      const land = () => { dst.style.visibility = ''; g.remove(); };
      g.animate({ transform: [`translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width},${a.height / b.height})`, 'none'] }, { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.then(land, land);
      setTimeout(land, 700); // لا يتعلق البوستر لو توقفت الإطارات
    }
  }
  $('#sheet .close').focus({ preventScroll: true });
}
function closeSheet(fromPop) {
  if (!ui.sheet) return;
  ui.sheet = null;
  const sh = $('#sheet'), bd = $('#backdrop'), cur = sh.style.transform || 'none';
  const done = () => { sh.hidden = true; bd.hidden = true; sh.style.transform = ''; root.classList.remove('sheet-open'); $$('.ghost').forEach(g => g.remove());
    if (ui.dirty) { ui.dirty = false; if (ui.view === 'arrow') render(true); } };
  if (reduce.matches) done();
  else { const mine = closing = [bd.animate({ opacity: [1, 0] }, { duration: 190, easing: 'ease-in', fill: 'forwards' }),
      sh.animate(phone.matches ? { transform: [cur, 'translateY(100%)'] } : { transform: ['none', 'translateY(14px) scale(.97)'], opacity: [1, 0] }, { duration: 190, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })];
    const fin = () => { if (closing !== mine) return; closing = null; done(); mine.forEach(a => a.cancel()); };
    mine[1].finished.then(fin, () => {}); setTimeout(fin, 400); } // المؤقت يضمن الإغلاق حتى لو توقفت الإطارات
  if (!fromPop && history.state?.sheet) { ui.skipPop = true; history.back(); }
}
addEventListener('popstate', () => { if (ui.skipPop) { ui.skipPop = false; return; } if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; return; } closeSheet(true); });
// الجوال: سحب رأس النافذة للأسفل يغلقها، والنافذة تتبع الإصبع
{ const sh = $('#sheet'), head = $('.sheet-head'); let drag = null;
  head.addEventListener('pointerdown', e => { if (!phone.matches || e.target.closest('button') || closing) return; drag = { y: e.clientY, t: e.timeStamp, dy: 0 }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => { if (!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); sh.style.transform = `translateY(${drag.dy}px)`; });
  const end = e => { if (!drag) return; const d = drag, v = d.dy / Math.max(1, e.timeStamp - d.t); drag = null;
    if (d.dy > 110 || (d.dy > 28 && v > .55)) return closeSheet();
    sh.style.transform = ''; if (d.dy && !reduce.matches) sh.animate({ transform: [`translateY(${d.dy}px)`, 'none'] }, { duration: 240, easing: EASE }); };
  head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end); }

function openWork(id, season, from) {
  const w = D.works.get(id), soon = isSoon(w);
  const places = D.placements.filter(p => p.work === id);
  const uni = from?.closest('section.uni')?.dataset.uni || (places.find(p => p.universe === ui.uni) || places[0]).universe;
  const series = w.kind === 'series' && w.episodeCount, pl = places.find(p => p.universe === uni && (p.season ?? null) === (season ?? null)) || places.find(p => p.season === season) || places.find(p => p.universe === uni) || places[0];
  const tabs = series ? [...w.seasons, ...(w.specials ? [{ n: 0 }] : [])] : [];
  openSheet(ltr(w.title), `<div class="hero">${w.backdrop ? `<img decoding="async" src="${img(w.backdrop, 'w780')}" alt="">` : ''}</div>
    <div class="dw"><div class="dw-top"><button class="poster" data-act="light" data-src="${img(w.poster, 'w780')}" aria-label="تكبير البوستر">${posterTag(w)}</button>
      <div><h3>${ltr(w.title)}</h3>
      <div class="meta bits">${bits([typeOf(w), w.date ? fmtDate(w.date) : w.year, w.runtime ? cnt(w.runtime, 'min') : '', ...(w.episodeCount ? [cnt(w.seasons.length, 'season'), cnt(w.episodeCount, 'ep')] : [])])}</div>
      ${soon && w.date ? `<div class="tags"><span class="tag soon">قادم بعد ${cnt(daysLeft(w), 'day', true)}</span></div>` : ''}</div></div>
    ${w.overviewAr ? `<p class="ov">${esc(w.overviewAr)}</p>` : w.overviewEn ? `<div><span class="lbl">النبذة بالإنجليزية (الترجمة العربية قيد الإعداد)</span><p class="ov en">${esc(w.overviewEn)}</p></div>` : ''}
    <div class="actions">${places.map(p => `<button data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}" data-force="1">البطاقة في ${esc(uniOf(p.universe).name)}${p.season ? `، الموسم ${p.season}` : ''}</button>`).join('')}</div>
    ${rateBlock(w, pl)}
    ${nextBlock(w)}
    ${series ? `<div class="seasons" id="seasonTabs">${tabs.map(s => `<button data-act="season" data-id="${id}" data-season="${s.n}">${s.n ? 'الموسم ' + s.n : 'خاصة'}</button>`).join('')}</div><div id="eps" class="dw" style="padding:0" aria-busy="true">${'<div class="ep skel"><span class="epthumb"><span class="ph"></span></span><div><i></i><i></i></div></div>'.repeat(4)}</div>` : ''}</div>`, 'work', { uni, tall: series, from: from?.querySelector('img') });
  if (series) showSeason(id, tabs.some(s => s.n === season) ? season : w.seasons[0].n);
}
async function showSeason(id, n) {
  $$('#seasonTabs button').forEach(b => b.classList.toggle('on', +b.dataset.season === n));
  $('#seasonTabs .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const box = $('#eps');
  try { if (!D.episodes.has(id)) D.episodes.set(id, await getJSON(`data/episodes/${id}.json`)); }
  catch { box.innerHTML = '<p class="empty">تعذّر تحميل الحلقات. تحقق من الاتصال وحاول مرة ثانية.</p>'; return; }
  const s = D.episodes.get(id).seasons.find(x => x.n === n); if (!s || !box.isConnected) return;
  box.removeAttribute('aria-busy');
  if (G.malScore && n) { const pl = D.placements.find(p => p.work === id && p.season === n), r = $('#sheet .rates'); if (pl && r) r.outerHTML = rateBlock(D.works.get(id), pl); } // لكل موسم صفحته وتقييمه
  const all = s.episodes.every(e => epDone(id, n, e.n));
  const rated = s.episodes.filter(e => e.rating != null && (e.votes ?? 5) >= 5), avg = rated.length ? Math.round(rated.reduce((x, e) => x + e.rating, 0) / rated.length * 10) / 10 : null;
  box.innerHTML = `<div class="season-bar"><span class="lbl">${!n ? 'حلقات خاصة خارج ترقيم المواسم. ملاحظة كل بطاقة تذكر متى تُشاهد المهم منها.' : avg != null ? `متوسط تقييم الموسم ${avg} من 10 على ${ltr('TMDB')}، محسوب من ${cnt(rated.length, 'ep', true)}` : 'لا يوجد تقييم كافٍ لحلقات هذا الموسم بعد'}</span>
      ${n ? `<button data-act="seasonall" data-id="${id}" data-season="${n}">${all ? 'إلغاء تعليم الموسم' : 'علّم الموسم كاملاً كمشاهد'}</button>` : ''}</div>` +
    s.episodes.map(e => { const d = epDone(id, n, e.n), fut = !e.date || e.date > TODAY, ov = e.overviewAr || e.overviewEn, few = (e.votes ?? 5) < 5;
      const when = fut ? (e.date ? `تُعرض بعد ${cnt(daysTo(e.date), 'day', true)}، ${fmtDate(e.date)}` : 'لم يُحدَّد موعد عرضها') : fmtDate(e.date);
      return `<div class="ep ${d ? 'done' : ''} ${fut ? 'future' : ''}"><span class="epthumb">${e.still ? `<img loading="lazy" decoding="async" src="${img(e.still, 'w300')}" alt="">` : '<span class="ph"></span>'}
          ${e.rating != null && !fut ? `<span class="eprate ${few ? 'low' : ''}" title="${few ? 'عدد الأصوات قليل' : 'تقييم TMDB'}">${e.rating.toFixed(1)}</span>` : ''}</span>
        <div><h4>${n ? 'الحلقة' : 'خاصة'} ${e.n}${e.name ? ltr(e.name) : ''}</h4>${e.nameAr ? `<div class="ar-title">${esc(e.nameAr)}</div>` : ''}
          <div class="meta">${esc([when, e.runtime ? e.runtime + ' د' : '', fut ? '' : e.rating == null ? 'بلا تقييم بعد' : few ? 'تقييم بأصوات قليلة' : ''].filter(Boolean).join(' · '))}</div></div>
        ${ov ? `<div style="grid-column:1/-1">${e.overviewAr ? '' : '<span class="lbl">الملخص بالإنجليزية (الترجمة العربية قيد الإعداد)</span>'}
          <p class="ov ${e.overviewAr ? '' : 'en'} ${store.shield && !d ? 'blur' : ''}" ${store.shield && !d ? 'data-act="reveal" title="اضغط للكشف"' : ''}>${esc(ov)}</p>
          ${store.shield && !d ? '<span class="lbl">الملخص مخفي لتفادي الحرق. اضغط عليه للكشف</span>' : ''}</div>` : ''}
        <div class="foot2"><span></span>${fut ? '' : `<button class="tick" aria-pressed="${!!d}" data-act="ep" data-id="${id}" data-season="${n}" data-ep="${e.n}">${tick(d, 'شاهدتها', 'علّمها مشاهدة')}</button>`}</div></div>`; }).join('');
}
const unblur = ov => { ov.classList.remove('blur'); ov.removeAttribute('data-act'); ov.removeAttribute('title'); ov.nextElementSibling?.remove(); };
function setEp(id, s, e, on) { const o = store.eps[id] ||= {}; if (on) o[`${s}-${e}`] = 1; else delete o[`${s}-${e}`]; if (!Object.keys(o).length) delete store.eps[id]; }

// ---------- الفهرس، السجل، الدليل
function openJump() {
  const tile = u => { const t = THEMES[u.id], key = D.works.get(t.key), all = D.placements.filter(p => p.universe === u.id), rel = all.filter(p => !isSoon(D.works.get(p.work))), done = rel.filter(p => statusOf(p) === 'watched').length;
    return `<button class="tile m-${t.motif} ${ui.uni === u.id ? 'on' : ''}" data-act="uni" data-uni="${u.id}" style="${themeVars(u.id)}">${key?.backdrop ? `<img loading="lazy" src="${img(key.backdrop, 'w780')}" alt="">` : ''}<span class="motif"></span>
      <span class="tile-text"><span class="tile-name">${esc(u.name)}</span><span class="tile-en">${ltr(u.nameEn)}</span><span class="tile-meta">عدد الأعمال ${all.length} · شاهدت ${done}</span><span class="bar"><i style="width:${rel.length ? Math.round(done / rel.length * 100) : 0}%"></i></span></span></button>`; };
  const group = (title, list) => list.length ? `<h3>${title}</h3><div class="tiles">${list.map(tile).join('')}</div>` : '';
  openSheet('الفهرس', `<div class="idx"><input id="jq" type="search" placeholder="ابحث عن عمل أو عالم…" aria-label="بحث في الفهرس">
    <div class="idx-row">${[['cards', 'البطاقات'], ['timeline', 'الخط الزمني'], ...(G.order ? [['arrow', G.order.label]] : [])].map(([v, l]) => `<button data-act="view" data-view="${v}" class="${ui.view === v ? 'on' : ''}">${l}</button>`).join('')}
      <button data-act="uni" data-uni="all" class="${ui.uni === 'all' && ui.view !== 'arrow' ? 'on' : ''}">${G.allLabel}</button></div>
    <div id="jres"></div><div id="jhome"></div>
    <div class="idx-row tools2"><button data-act="shield">${store.shield ? 'درع الحرق: مفعّل' : 'درع الحرق: متوقف'}</button><button data-act="tonight">ماذا أشاهد؟</button><button data-act="backup">سجلّي</button><button data-act="guide">الدليل</button></div></div>`, 'jump', { wide: true, uni: sceneUni });
  const mark = { watched: '✓', watching: '▶', list: '+', skip: '✕' };
  const draw = () => { const q = $('#jq').value.trim().toLowerCase();
    const us = D.universes.filter(u => !q || u.name.includes(q) || u.nameEn.toLowerCase().includes(q));
    const ws = q ? D.placements.filter(p => { const w = D.works.get(p.work); return w.title.toLowerCase().includes(q) || (w.titleAr || '').includes(q); }).slice(0, 40) : [];
    $('#jres').innerHTML = ws.length ? `<h3>أعمال</h3><div class="hits">${ws.map(p => { const w = D.works.get(p.work), t = THEMES[p.universe]; return `<button class="hit" style="--c1:${t.c1}" data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}" data-force="1">${w.poster ? `<img loading="lazy" src="${img(w.poster, 'w92')}" alt="">` : '<span class="ph"></span>'}<span class="hit-text"><span class="t">${ltr(titleOf(p))}</span><small>${esc(uniOf(p.universe).name)}</small></span><span class="hit-mark">${mark[statusOf(p)] || ''}</span></button>`; }).join('')}</div>` : q && !us.length ? '<p class="empty">لا يوجد عمل أو عالم بهذا الاسم.</p>' : '';
    $('#jhome').innerHTML = group(G.groups[0], us.filter(u => u.serial)) + group(G.groups[1], us.filter(u => !u.serial)); };
  $('#jq').addEventListener('input', draw); draw();
  if (matchMedia('(hover:hover)').matches) $('#jq').focus();
}
const encode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
function openBackup() {
  openSheet('سجل المشاهدة', `<div class="dw guide" style="padding-top:14px"><p>سجلك محفوظ في هذا المتصفح فقط. انسخ الكود واحتفظ به، والصقه في أي جهاز أو متصفح ثاني لاسترجاع السجل.</p>
    <textarea id="bk" aria-label="كود السجل">${encode(store)}</textarea>
    <div class="actions"><button data-act="bkcopy">نسخ الكود</button><button data-act="bkimport">استيراد الكود الملصوق</button></div>
    ${G.legacyImport ? '<h4>النقل من النسخة القديمة</h4><p>افتح موقعك القديم، اضغط «نسخ احتياطي» وانسخ الكود، ثم الصقه هنا واضغط استيراد. يتحول تلقائياً للنظام الجديد.</p>' : ''}</div>`, 'backup');
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
  save(); closeSheet(); syncShield(); render(); toast(`تم الاستيراد: ${cnt(works, 'work')} و${cnt(eps, 'ep')}`);
}
function openGuide() { openSheet('دليل الاستخدام', `<div class="dw guide" style="padding-top:14px">${G.help}</div>`, 'guide'); }
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
    case 'path': ui.path = d.path; render(true); break;
    case 'close': closeSheet(); break;
    case 'shield': if (ui.sheet) closeSheet(); store.shield = !store.shield; save(); syncShield(); render(true); toast(store.shield ? 'درع الحرق مفعّل' : 'درع الحرق متوقف'); break;
    case 'status': { const k = b.closest('[data-k]').dataset.k; if (store.works[k] === d.s) delete store.works[k]; else store.works[k] = d.s; save();
      if ($('#fStatus').value) { render(true); break; } // مع تصفية الحالة قد يخرج العمل من القائمة نفسها
      syncStatus(k); stats(); refreshProgress(); break; }
    case 'goto': { const force = d.force; if (ui.sheet) closeSheet(); if (force) ui.uni = d.uni; setTimeout(() => goTo(d.to === 't' ? 'timeline' : 'cards', d.uni, d.target), force ? 60 : 0); break; }
    case 'ep': { const on = !epDone(id, season, +d.ep), row = b.closest('.ep'), ov = $('.ov.blur', row); setEp(id, season, +d.ep, on); save();
      row.classList.toggle('done', on); b.innerHTML = tick(on, 'شاهدتها', 'علّمها مشاهدة'); b.setAttribute('aria-pressed', on); if (on && ov) unblur(ov);
      const sa = $('#eps [data-act=seasonall]'), s = D.episodes.get(id).seasons.find(x => x.n === season); if (sa) sa.textContent = s.episodes.every(e => epDone(id, season, e.n)) ? 'إلغاء تعليم الموسم' : 'علّم الموسم كاملاً كمشاهد';
      stats(); syncEps(id); ui.dirty = true; break; }
    case 'seasonall': { const s = D.episodes.get(id).seasons.find(x => x.n === season), on = !s.episodes.every(e => epDone(id, season, e.n)); s.episodes.filter(e => e.date && e.date <= TODAY).forEach(e => setEp(id, season, e.n, on)); save(); showSeason(id, season); stats(); syncEps(id); ui.dirty = true; break; }
    case 'reveal': unblur(b); break;
    case 'avpart': setEp(id, season, +d.ep, !epDone(id, season, +d.ep)); save(); avRefresh(b.closest('.step')); stats(); break;
    case 'avblock': { let all = true; for (let e = +d.from; e <= +d.to; e++) all &&= epDone(id, season, e); for (let e = +d.from; e <= +d.to; e++) setEp(id, season, e, !all); save(); avRefresh(b.closest('.step')); stats(); break; }
    case 'avgo': { if (ui.sheet) closeSheet(); ui.view = 'arrow'; render(); const t = document.getElementById(d.step); if (t) { t.scrollIntoView({ block: 'start', behavior: 'instant' }); flash(t); } break; }
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
addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#lightbox').hidden) history.back(); else closeSheet(); } });
let qt; ['input', 'change'].forEach(t => $('#filters').addEventListener(t, () => { clearTimeout(qt); qt = setTimeout(() => render(), 150); }));
// ميلان البوستر المكبَّر مع حركة المؤشر أو الإصبع
$('#lightbox').addEventListener('pointermove', e => { const r = $('#lightImg').getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  $('#lightImg').style.transform = `rotateY(${(x * 22).toFixed(1)}deg) rotateX(${(-y * 22).toFixed(1)}deg) scale(1.02)`; });
$('#lightbox').addEventListener('pointerleave', () => $('#lightImg').style.transform = '');
document.addEventListener('load', e => { if (e.target.tagName === 'IMG') e.target.classList.add('in'); }, true);
document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG' && !t.dataset.failed) { t.dataset.failed = 1; t.style.visibility = 'hidden'; } }, true);

boot();
