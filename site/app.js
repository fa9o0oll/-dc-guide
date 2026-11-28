// واجهة الأدلة (دي سي، Fate…). الدليل يُحدَّد من data-guide في الصفحة، وبياناته من مجلد data المجاور لها (تُبنى آلياً).
import { GUIDES } from './guides.js?v=__BUILD__';
import { shell } from './shell.js?v=__BUILD__';
import { ar } from './bidi.js?v=__BUILD__';
import { clock, spoken } from './count.js?v=__BUILD__';
import { initSync, touch as syncTouch, syncLabel } from './sync.js?v=__BUILD__';
import { accInit, accMark, accSync, accLink, accUnlink, accLinks, accState, accSetPass, accPass } from './accounts.js?v=__BUILD__'; // Trakt للمسلسلات (E87)
import { cardStack } from './stack.js?v=__BUILD__'; // البطاقة المفتوحة من بطاقة خطوة فوقها، والرجوع إلى التي قبلها (E89)
import { portalBack } from './portal.js?v=__BUILD__';
import { prepare, find, fold } from './find.js?v=__BUILD__';
import './zoom.js?v=__BUILD__'; // البوسترات المشتركة بين البوابات: التكبير والقرص بإصبعين والميلان مع الجوال (data-zoom وdata-zoom-pinch)
import { posMap, ord } from './pos.js?v=__BUILD__'; // خريطة «موقعه من عالمه» والعدد الترتيبي
import './rail.js?v=__BUILD__'; // شريط المزاج في «اقتراح الليلة»: السحب بالماوس والسهمان
const BUILD = '__BUILD__'; // يُستبدل برقم النشر حتى لا يعرض المتصفح نسخة قديمة من الملفات
const G = GUIDES[document.documentElement.dataset.guide] || GUIDES.dc;
const { THEMES, SHOW_COLORS = {} } = await import(`./themes-${G.id}.js?v=${BUILD}`);
const { GENRE = {} } = G.suggest ? await import(`./anime-genres.js?v=${BUILD}`) : {};   // أسماء تصنيفات MyAnimeList بالعربية، للدليل الذي فيه «اقتراح الليلة»
document.body.insertAdjacentHTML('afterbegin', shell(G));
portalBack(document.documentElement.dataset.guide || 'dc');
// حين تغيب الترويسة عن الشاشة ينتقل شعار الدليل إلى أول الشريط الثابت، زرّاً للعودة إلى البوابات، ويعود حين تظهر
{ const st = document.getElementById('stick'), g = st.querySelector('.gate');
  new IntersectionObserver(([e]) => { const on = !e.isIntersecting; st.classList.toggle('docked', on); g.tabIndex = on ? 0 : -1; g.setAttribute('aria-hidden', String(!on)); }).observe(document.getElementById('top')); }
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
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { toast('تعذّر الحفظ في هذا المتصفح'); } syncTouch(G.id); aniDiff(); };

// ---------- البيانات
const D = { universes: [], works: new Map(), placements: [], bridges: [], legacyMap: {}, base: '', arrow: null, order: null, mal: {}, prov: {}, episodes: new Map() };
const ui = { view: 'cards', uni: 'all', sheet: null };
const getJSON = async u => { const r = await fetch(u + '?v=' + BUILD); if (!r.ok) throw new Error(u + ' → ' + r.status); return r.json(); };

async function boot() {
  try {
    const [base, cat, arrow, mal, rate] = await Promise.all([getJSON('data/base.json'), getJSON('data/catalog.json'), G.order?.kind === 'arrow' ? getJSON(G.order.file) : null, G.malScore ? getJSON('data/mal.json').catch(() => ({})) : {}, getJSON('data/ratings.json').catch(() => ({}))]);
    const extra = new Map(cat.works.map(w => [w.id, w]));
    for (const w of base.works) D.works.set(w.id, { ...w, ...(extra.get(w.id) || {}) });
    Object.assign(D, { universes: base.universes, placements: base.placements, bridges: base.bridges || [], legacyMap: base.legacyMap || {}, base: cat.imageBase, arrow, order: base.order, mal: mal.anime || {}, prov: cat.providers || {}, rate: rate.r || {} });
    $('#builtAt').textContent = 'آخر تحديث للبيانات: ' + fmtDate(cat.generatedAt.slice(0, 10));
  } catch (e) {
    $('#veil')?.remove();
    $('#main').innerHTML = `<p class="empty">تعذّر تحميل البيانات. حدّث الصفحة، وإذا استمر الخطأ فالسبب: ${esc(e.message)}</p>`; return;
  }
  renderUnibar(); syncShield(); render(); liftVeil();
  // Trakt (E87): ما وصل منه يُطبَّق على السجل، والصفحة ترسل إليه سجلّها أول مرة وأرقام مسلسلاتها
  // وأفلامه مع قائمة أفلامي وLetterboxd (E90): mرقم الفيلم في TMDB بحاله { s }، والحلقات و«سأشاهده» على المسلسل { on }
  if (TRK) accInit({ guide: G.id, svcs: ['trakt', 'letterboxd'], build: BUILD, emptyOk: true, pack: m => m && 's' in m ? { s: m.s || null } : { on: m?.on ? 1 : 0 }, onState: drawTrk, onLinked: trkBack,
    apply: ch => { const fm = ch.filter(c => /^m\d+$/.test(String(c.id))); traktApply(ch.filter(c => !fm.includes(c))); if (fm.length) filmApply(fm); },
    full: () => { const o = {}; for (const id of D.works.keys()) { const f = fmOf(id), fs = f && fState(store.works[id]); if (fs) o['m' + f] = fs;
      const t = tvOf(id); if (!t) continue; const e = Object.keys(store.eps[id] || {}), l = store.works[id] === 'list' ? 1 : 0; if (e.length || l) o['tv' + t] = { e, l }; } return o; },
    known: () => [...D.works.keys()].map(tvOf).filter(Boolean) });
  // دليل Fate مع MyAnimeList وSIMKL (E92): حال كل موضع وعدد حلقاته برقمه في MyAnimeList، إلى محور الأنمي ومنه
  if (G.id === 'fate') { accInit({ guide: 'fate', svcs: ['mal', 'simkl'], build: BUILD, emptyOk: true, pack: m => ({ s: m.s, p: m.p || 0 }), apply: aniApply, onState: drawTrk,
      full: () => Object.fromEntries(MALP().map(p => [p.mal, aniState(p)]).filter(([, v]) => v)), known: () => [...new Set(MALP().map(p => p.mal))] });
    ANS = Object.fromEntries(MALP().map(p => [p.mal, aniKey(aniState(p))])); }
  // رابط مباشر لعمل (#w=المعرّف)، تستعمله قائمة الأفلام للانتقال إلى بطاقته في هذا الدليل، عند الفتح أو بتغيير العنوان والصفحة مفتوحة
  { const deep = () => { const w = new URLSearchParams(location.hash.slice(1)).get('w'); if (w && D.works.has(w)) { history.replaceState(history.state, '', location.pathname + location.search); openWork(w); } };
    deep(); addEventListener('hashchange', deep); }
  // تغيير وصل من جهاز آخر وكُتب في السجل المحلي: نعيد قراءته ونرسم في المكان نفسه
  initSync(id => { if (id !== G.id) return; try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw?.v === 1) store = { ...blank(), ...raw }; } catch {}
    render(true); stats(); const tab = $('#seasonTabs .on'); if (tab) showSeason(tab.dataset.id, +tab.dataset.season); });
}
// كشف ستار الدخول: دي سي يُسحب جانباً كلوحة قصة مصورة، وFate يتلاشى مع حلقة استدعاء تتسع، ومارفل صفحة تُقلب من حافتها
function liftVeil() {
  const v = $('#veil'); if (!v || v.hidden) return; const done = () => v.remove();
  if (reduce.matches) return done();
  v.classList.add('lift');
  const a = G.id === 'fate' ? v.animate({ opacity: [1, 1, 0] }, { duration: 850, easing: 'ease-in', fill: 'forwards' })
    : G.id === 'marvel' ? v.animate({ transform: ['perspective(1800px) rotateY(0deg)', 'perspective(1800px) rotateY(-108deg)'], opacity: [1, 1, 0] }, { duration: 720, delay: 120, easing: 'cubic-bezier(.62,0,.32,1)', fill: 'forwards' })
    : v.animate({ transform: ['none', 'translateX(-125%)'] }, { duration: 640, delay: 140, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
  a.finished.then(done, done); setTimeout(done, 1500);
}

// ---------- مساعدات
const img = (path, size) => path ? D.base + size + path : '';
const STAGE = { production: 'قيد الإنتاج', development: 'قيد التطوير' };
const isSoon = w => !w.date || w.date > TODAY;
// العدد والمعدود بقواعد العربية: 1 مفرد، 2 مثنى، 3 إلى 10 جمع، 11 إلى 99 مفرد منصوب، والمئات وما بعدها حسب آخر خانتين
// [مفرد، مثنى مرفوع، مثنى منصوب أو مجرور، جمع، مفرد منصوب، واحد/واحدة]
const NOUN = { ep: ['حلقة', 'حلقتان', 'حلقتين', 'حلقات', 'حلقة', 'واحدة'], season: ['موسم', 'موسمان', 'موسمين', 'مواسم', 'موسماً', 'واحد'], day: ['يوم', 'يومان', 'يومين', 'أيام', 'يوماً', 'واحد'],
  min: ['دقيقة', 'دقيقتان', 'دقيقتين', 'دقائق', 'دقيقة', 'واحدة'], vote: ['صوت', 'صوتان', 'صوتين', 'أصوات', 'صوتاً', 'واحد'], work: ['عمل', 'عملان', 'عملين', 'أعمال', 'عملاً', 'واحد'],
  part: ['جزء', 'جزءان', 'جزءين', 'أجزاء', 'جزءاً', 'واحد'], step: ['خطوة', 'خطوتان', 'خطوتين', 'خطوات', 'خطوة', 'واحدة'], film: ['فيلم', 'فيلمان', 'فيلمين', 'أفلام', 'فيلماً', 'واحد'], show: ['مسلسل', 'مسلسلان', 'مسلسلين', 'مسلسلات', 'مسلسلاً', 'واحد'] };
const unit = (n, k) => { const f = NOUN[k], m = n % 100; return n === 0 || (m >= 3 && m <= 10) ? f[3] : m >= 11 ? f[4] : f[0]; };
const cnt = (n, k, obl) => { const f = NOUN[k]; return n === 1 ? `${f[0]} ${f[5]}` : n === 2 ? f[obl ? 2 : 1] : `${n.toLocaleString('en')} ${unit(n, k)}`; };
const bits = a => a.filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
const daysLeft = w => Math.ceil((new Date(w.date) - new Date(TODAY)) / 864e5);
// العدّاد بهوية العالم: لوحة بنقش العالم وألوانه وخطه، وعنوانها كتعليق القصص المصورة. بموعد: عدّ حي بالأيام ثم الساعات
// والدقائق والثواني (يحرّكها count.js). بلا موعد: «قريباً» ومرحلة العمل. حين يحين الموعد يُكتب now
const premiere = ({ date, cap, uni, src = '', tba = '', now = 'يُعرض اليوم', cls = '' }) => {
  const head = `<span class="motif" aria-hidden="true"></span><span class="pm-top"><span class="pm-cap">${cap}</span><span class="pm-meta">${date ? `<small class="pm-date">${fmtDate(date)}</small>` : ''}${src}</span></span>`;
  return date ? `<div class="pm m-${THEMES[uni]?.motif || 'stars'} ${cls}" data-until="${date}" data-now="${now}">${head}<span class="ck" aria-hidden="true">${clock(date, now)}</span><span class="sr sr-time">${spoken(date)}</span></div>`
    : `<div class="pm tba m-${THEMES[uni]?.motif || 'stars'} ${cls}">${head}<span class="pm-tba"><b>قريباً</b><span>${tba}</span></span></div>`; };
// بوستر لم يُعلن بعد: ملصق تشويقي بنقش العالم وألوانه، وأول حرف من اسم العمل شعاراً، و«قريباً»
const initial = t => (t.replace(/^(the|an?)\s+/i, '').match(/[A-Za-z0-9]/)?.[0] || '؟').toUpperCase();
// عمل قادم: عدّ حي إن عُرف موعده، وإلا مرحلته («قيد الإنتاج»…) و«قريباً»، ومعه مصدر الخبر إن وُجد
const soonBlock = (w, uni, up, cls = '') => { const src = up?.source ? `<a class="src" href="${esc(up.source)}" target="_blank" rel="noopener">المصدر</a>` : '';
  return w.date ? premiere({ date: w.date, cap: 'العرض الأول', uni, src, cls }) : premiere({ cap: STAGE[up?.stage] || STAGE.production, uni, src, cls, tba: 'موعده لم يُحدَّد بعد' }); };
const teaser = (w, uni) => `<span class="ph tz m-${THEMES[uni]?.motif || 'stars'}" aria-hidden="true"><span class="motif"></span><span class="tz-s">${isSoon(w) ? 'قريباً' : 'بلا بوستر'}</span><b class="tz-l">${initial(w.title)}</b><bdi class="tz-t" dir="ltr">${esc(w.title)}</bdi></span>`;
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
// وتقييم الجمهور (E93) من IMDb حيّاً (ملفاتها الرسمية اليومية) إن كان له 20 صوتاً فأكثر، وإلا TMDB؛ وفي دليل الأنمي MyAnimeList أولاً.
const imdbOf = w => { const x = w.imdb && D.rate?.[w.imdb]; return x && x[0] != null && x[1] >= 20 ? { v: x[0], votes: x[1], name: 'IMDb', href: `https://www.imdb.com/title/${w.imdb}/` } : null; };
const rating = (w, p) => { const m = G.malScore && p?.mal ? D.mal[p.mal] : null;
  return m?.score != null ? { v: m.score, votes: m.votes, name: 'MAL', href: `https://myanimelist.net/anime/${p.mal}` } : imdbOf(w) || (w.tmdbRating != null ? { v: w.tmdbRating, votes: w.tmdbVotes || 0, name: 'TMDB', href: tmdbUrl(w) } : null); };
// آراء النقاد (E93): Rotten Tomatoes بنسبته وMetacritic من 100 (عبر OMDb)، وما لا رقم له لا يُكتب. mini: سطر صغير في البطاقة
const critics = (w, mini) => { const x = w.imdb && D.rate?.[w.imdb]; if (!x || (x[2] == null && x[3] == null)) return '';
  const one = (v, unit, name, href) => { const t = `<b>${v}${unit}</b><small>نقاد ${ltr(name)}</small>`; return href ? `<a class="crit" href="${href}" target="_blank" rel="noopener" aria-label="${name}: ${v}${unit}">${t}</a>` : `<span class="crit">${t}</span>`; };
  const rt = x[2] != null ? one(x[2], '%', 'Rotten Tomatoes', w.rt && `https://www.rottentomatoes.com/${w.rt}`) : '', mc = x[3] != null ? one(x[3], '', 'Metacritic', w.mc && `https://www.metacritic.com/${w.mc}`) : '';
  return mini ? (rt || mc) : rt + mc; };
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
const rateBlock = (w, p) => { const r = rating(w, p), v = isSoon(w) ? null : verdict(r?.v); return `<div class="rates wide">${gaugeRow(w, p)}${isSoon(w) ? '' : critics(w)}${v && r ? `<span class="tag" style="color:${v[1]}">${v[0]}</span>` : ''}${xlinks(w, p)}</div>`; };
const daysTo = d => Math.ceil((new Date(d) - new Date(TODAY)) / 864e5);
// ---------- أين يُشاهد العمل رسمياً في السعودية: منصات TMDB (بياناتها من JustWatch) كما في بوابة الأفلام، مجموعةً بطريقة الإتاحة.
// كل زر يفتح صفحة أماكن العرض على TMDB ومنها إلى المنصة. prov غير معرَّف: بيانات بُنيت قبل الميزة فلا يُقال شيء؛ null: لا بيانات للسعودية.
// للموسم الصادر منصاته هو إن خالفت منصات المسلسل (منصة عندها مواسم دون أخرى)
const PROV = [['stream', 'باشتراك'], ['free', 'مجاناً'], ['rent', 'إيجار'], ['buy', 'شراء']];
const provOf = (w, season) => { const s = season ? w.seasons?.find(x => x.n === season) : null; return s && s.prov !== undefined && s.date && s.date <= TODAY ? s.prov : w.prov; };
const provOwn = (w, season) => provOf(w, season) !== w.prov;
const provLink = (w, p) => esc(p.link || tmdbUrl(w) + '/watch');
const provLogo = id => `<img loading="lazy" decoding="async" width="32" height="32" alt="${esc(D.prov[id].name)}" title="${esc(D.prov[id].name)}" src="${img(D.prov[id].logo, 'w92')}">`;
function whereBlock(w, season) { if (w.prov === undefined || isSoon(w)) return ''; const p = provOf(w, season);
  const rows = p ? PROV.map(([k, t]) => { const ids = p[k].filter(id => D.prov[id]); return ids.length ? `<div class="wrow"><b>${t}</b><span class="wl">${ids.map(id => `<a href="${provLink(w, p)}" target="_blank" rel="noopener">${D.prov[id].logo ? provLogo(id) : ''}${ltr(D.prov[id].name)}</a>`).join('')}</span></div>` : ''; }).join('') : '';
  return `<section class="where"><h4>${provOwn(w, season) ? `أين تشاهد الموسم ${season} في السعودية` : 'أين تشاهده في السعودية'}</h4>${rows ? rows + `<p class="lbl">الأزرار تفتح صفحة أماكن العرض على ${ltr('TMDB')}، ومنها إلى المنصة. البيانات من ${ltr('JustWatch')} وتتحدث يومياً.</p>`
    : `<p class="lbl">لا تذكر بيانات ${ltr('JustWatch')} منصة تعرضه في السعودية حالياً.</p>`}</section>`; }
// وعلى البطاقة سطر واحد: شعارات ما يُعرض عليه باشتراك أو مجاناً، وإن لم يوجد فما يؤجَّر أو يُشترى منه
function whereLine(w, season) { const p = provOf(w, season); if (!p || isSoon(w)) return '';
  const sub = [...new Set([...p.stream, ...p.free])], ids = (sub.length ? sub : [...new Set([...p.rent, ...p.buy])]).filter(id => D.prov[id]?.logo); if (!ids.length) return '';
  const say = sub.length ? 'يُعرض على' : 'إيجار أو شراء';
  return `<a class="wline" href="${provLink(w, p)}" target="_blank" rel="noopener" title="صفحة أماكن العرض على TMDB" aria-label="${sub.length ? say : 'للإيجار أو الشراء على'} ${esc(ids.map(id => D.prov[id].name).join('، '))}. يفتح صفحة أماكن العرض على TMDB"><small>${say}</small><span>${ids.slice(0, 5).map(provLogo).join('')}${ids.length > 5 ? `<i>+${ids.length - 5}</i>` : ''}</span></a>`; }
// ما القادم لمسلسل صادر: حلقة بموعد، موسم بموعد، موسم معلن بلا موعد، أو مستمر بلا إعلان
function nextInfo(w) {
  if (!w.seasons || isSoon(w)) return null;
  if (w.nextEpisode?.date && w.nextEpisode.date >= TODAY) return { kind: 'episode', ...w.nextEpisode };
  const fut = w.seasons.find(x => x.date && x.date > TODAY); if (fut) return { kind: 'season', season: fut.n, date: fut.date };
  const ann = w.seasons.find(x => !x.date); if (ann) return { kind: 'announced', season: ann.n };
  return w.status === 'Returning Series' ? { kind: 'returning' } : null;
}
function nextBlock(w, cls = '', uni) {
  const n = nextInfo(w); if (!n) return '';
  if (n.kind === 'returning') return `<p class="next-note ${cls}">المسلسل مستمر، ولم يُعلن موعد حلقات جديدة بعد.</p>`;
  if (n.kind === 'announced') return premiere({ cap: `الموسم ${n.season}`, uni, cls, tba: 'معلن، وموعد عرضه لم يُحدَّد بعد' });
  return n.kind === 'episode' ? premiere({ date: n.date, cap: `الحلقة ${n.episode} من الموسم ${n.season}`, uni, cls, now: 'تُعرض اليوم' })
    : premiere({ date: n.date, cap: `بداية الموسم ${n.season}`, uni, cls, now: 'يبدأ اليوم' });
}
const nextTag = w => { const k = nextInfo(w)?.kind; return k === 'episode' ? '<span class="tag soon">يُعرض الآن</span>' : k === 'season' || k === 'announced' ? '<span class="tag soon">موسم قادم</span>' : ''; };
const verdict = r => r == null ? null : r >= 7.5 ? ['ممتاز', '#35d07f'] : r >= 6.8 ? ['جيد', '#57abff'] : r >= 6 ? ['متوسط', '#f2b84b'] : ['ضعيف', '#ef5d57'];
// undo: دالة تُلغي ما أُعلن عنه، فيظهر معه زر «تراجع» ويبقى أطول
function toast(msg, undo) { const t = $('#toast'); clearTimeout(toast.t); ask.fn = undo || null; t.classList.toggle('ask', !!undo);
  if (undo) t.innerHTML = `<span>${msg}</span><span class="ask-btns"><button data-act="askyes">تراجع</button></span>`; else t.textContent = msg;
  t.hidden = false; toast.t = setTimeout(() => { t.hidden = true; if (undo) ask.fn = null; }, undo ? 7000 : 2600); }
const posterTag = (w, uni) => w.poster
  ? `<img loading="lazy" decoding="async" src="${img(w.poster, 'w342')}" srcset="${img(w.poster, 'w185')} 185w, ${img(w.poster, 'w342')} 342w, ${img(w.poster, 'w500')} 500w" sizes="128px" alt="بوستر ${esc(w.title)}">`
  : teaser(w, uni);

// سؤال بزرّين في مكان الإشعار. يبقى حتى يُجاب أو تمضي 20 ثانية، وتجاهله مثل «لا»: لا يتغيّر شيء.
function ask(msg, yes, no, fn) { const t = $('#toast'); clearTimeout(toast.t); ask.fn = fn; t.classList.add('ask');
  t.innerHTML = `<span>${msg}</span><span class="ask-btns"><button data-act="askyes">${yes}</button><button data-act="askno">${no}</button></span>`; t.hidden = false; toast.t = setTimeout(() => { t.hidden = true; ask.fn = null; }, 20000); }
// «شاهدته» على مسلسل أو موسم لا يعلّم حلقاته من نفسه، فقد تكون تُركت حلقات عن قصد: نذكر عدد ما بقي ونسأل.
// الحلقات الخاصة وما لم يُعرض بعد خارج العدّ. الرفض أو التجاهل لا يمسّ سجل الحلقات.
async function offerEps(k) { const [id, sn] = k.split('#'), w = D.works.get(id), season = sn ? +sn : 0; if (!w?.seasons?.length) return;
  try { if (!D.episodes.has(id)) D.episodes.set(id, await getJSON(`data/episodes/${id}.json`)); } catch { return; }
  if (store.works[k] !== 'watched') return;
  const left = D.episodes.get(id).seasons.filter(s => s.n && (!season || s.n === season)).flatMap(s => s.episodes.filter(e => e.date && e.date <= TODAY && !epDone(id, s.n, e.n)).map(e => [s.n, e.n])), n = left.length; if (!n) return;
  const scope = season || w.seasons.length === 1 ? 'هذا الموسم' : 'هذا المسلسل';
  ask(`بقيت ${cnt(n, 'ep')} من ${scope} بلا علامة مشاهدة. ${n === 1 ? 'هل تعلّمها؟' : n === 2 ? 'هل تعلّمهما؟' : 'هل تعلّمها كلها؟'}`, n === 1 ? 'علّمها' : n === 2 ? 'علّمهما' : 'علّمها كلها', n === 2 ? 'اتركهما' : 'اتركها', () => {
    for (const [s, e] of left) setEp(id, s, e, true); save(); stats(); syncEps(id);
    const sa = $('#eps [data-act=seasonall]'); if (sa?.dataset.id === id) showSeason(id, +sa.dataset.season);
    toast(`عُلّمت ${cnt(n, 'ep')}`); }); }
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

// ---------- البحث: حرفياً بعد توحيد الهمزات والتاء المربوطة وعلامات الترقيم، وإن لم يطابق المكتوب أي عمل
// تظهر الأعمال الأقرب إليه بالصوت أو الإملاء (site/find.js) ومعها «هل تقصد…؟»، فيكفي «باتمن» أو «سوبرمان» أو «spidrman»
let WP = null, wz = null;
const lit = (w, f) => (w._f ??= fold(`${w.title} ${w.titleAr || ''}`)).includes(f);
function worksFor(q) { if (wz?.q === q) return wz; const f = fold(q), all = [...D.works.values()];
  if (!f || all.some(w => lit(w, f))) return wz = { q, f, ids: null };
  const r = find(WP ??= prepare(all, w => [w.title, w.titleAr]), q, { limit: 8, min: 55, spread: 8 });
  return wz = { q, f, ids: new Set(r.hits.map(h => h.id)), meant: r.hits[0] || null }; }
const meantBar = () => { const q = $('#q').value.trim(), z = q && worksFor(q);
  return z?.ids && z.meant ? `<p class="meant-bar">لا عمل باسم «${esc(q)}». هل تقصد <button data-act="meant" data-q="${esc(z.meant.title)}"><bdi>${esc(z.meant.title)}</bdi></button>؟ وهذه أقرب الأعمال إليه.</p>` : ''; };

// ---------- التصفية
function visible(p) {
  const w = D.works.get(p.work), q = $('#q').value.trim(), t = $('#fType').value, s = $('#fStatus').value;
  if (ui.uni !== 'all' && p.universe !== ui.uni) return false;
  if (q) { const z = worksFor(q); if (z.ids ? !z.ids.has(w.id) : !lit(w, z.f)) return false; }
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
    <p class="desc">${ar(u.description)}</p>
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
    <div class="chead"><button class="poster" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''}${w.poster ? ` data-zoom-pinch data-zoom-title="${esc(w.title)}"` : ''} aria-label="تفاصيل ${esc(w.title)}">${posterTag(w, p.universe)}</button>
    <div>
      <div class="ord">${uniOf(p.universe).serial && !soon ? 'الترتيب: ' : ''}${esc(p.label)}</div>
      <h3>${ltr(titleOf(p))}</h3>
      ${meta}
      <div class="tags">${soon ? (p.upcoming?.stage === 'development' ? '<span class="tag soon">معلن</span>' : '<span class="tag soon">قادم</span>') : v ? `<span class="tag" style="color:${v[1]}">${v[0]}</span>` : ''}${nextTag(w)}</div>
      ${rating(w, p) ? `<div class="rates">${gaugeRow(w, p)}${soon ? '' : critics(w, true)}</div>` : ''}
    </div></div>
    <div class="cbody"><p class="note">${ar(p.note)}</p>
    ${soon ? soonBlock(w, p.universe, p.upcoming, 'wide') : ''}
    ${nextBlock(w, 'wide', p.universe)}
    ${avLine(p, 'wide')}
    ${p.order ? `<p class="canon wide">${ar(p.order.note)} <a href="${esc(p.order.source)}" target="_blank" rel="noopener">المصدر</a></p>` : ''}${p.news ? `<p class="canon wide"><b>قادم:</b> ${ar(p.news.note)} ${p.news.sources.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">المصدر${p.news.sources.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' ')}</p>` : ''}
    ${p.canon ? `<div class="canon wide">يظهر في عالمين: ${ar(p.canon.note)} <a href="${esc(p.canon.source)}" target="_blank" rel="noopener">المصدر</a></div>` : ''}
    ${p.spoiler ? (store.shield ? `<details class="vault wide"><summary>${ic('lock')}<span>معلومة ارتباط فيها حرق</span><b>اكشفها</b></summary><p>${esc(p.spoiler)}</p></details>` : `<p class="note wide">${esc(p.spoiler)}</p>`) : ''}</div>
    <div class="cfoot">${whereLine(w, p.season)}${xlinks(w, p)}${soon ? '' : `<div class="status wide">${Object.entries(STATUS).map(([k, l]) => `<button data-act="status" data-s="${k}" aria-pressed="${st === k}">${ic(STATUS_IC[k])}<span>${l}</span></button>`).join('')}</div>`}
    <div class="actions wide"><button class="cta" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} ${tot ? `style="--p:${Math.round(dn / tot * 100)}%"` : ''}>${w.seasons?.length ? `${ic('eps')}<span>الحلقات</span>${tot ? `<span class="epprog" title="شاهدت ${dn} من ${tot}"><bdi>${dn}/${tot}</bdi></span>` : ''}` : '<span>التفاصيل</span>'}</button>
      <button class="alt" data-act="goto" data-to="t" data-target="${domId('t', p)}" data-uni="${p.universe}" aria-label="موقعه في الخط الزمني">${ic('line')}<span>الخط الزمني</span></button></div></div>
  </article>`;
}
function renderCards() {
  const secs = sections();
  $('#main').innerHTML = secs.length ? meantBar() + pickHTML(0) + secs.map(({ u, all, list }) => `<section class="uni" id="u-${u.id}" data-uni="${u.id}" style="${themeVars(u.id)}">${uniHead(u, all)}<div class="grid">${list.map(card).join('')}</div></section>`).join('')
    : '<p class="empty">لا توجد أعمال تطابق البحث أو التصفية الحالية.</p>';
}

// ---------- الخط الزمني
function node(p, i, list, step) {
  const w = D.works.get(p.work), soon = isSoon(w), prev = list[i - 1], next = list[i + 1], u = uniOf(p.universe), done = statusOf(p) === 'watched';
  const around = !step && u.serial && u.id !== 'arrow' ? [prev && ['قبله', D.works.get(prev.work).title], next && ['بعده', D.works.get(next.work).title]].filter(Boolean) : [];
  return `<div class="node ${done ? 'done' : ''} ${soon ? 'soon' : ''}" id="${domId('t', p)}" data-k="${esc(sKey(p))}">
    <button class="node-main" data-act="open" data-id="${w.id}" ${p.season ? `data-season="${p.season}"` : ''} aria-label="تفاصيل ${esc(w.title)}">
      <span class="thumb${w.poster ? '' : ` tz m-${THEMES[p.universe]?.motif || 'stars'}`}"${w.poster ? ` data-zoom-pinch data-zoom-title="${esc(w.title)}"` : ''}>${w.poster ? `<img loading="lazy" src="${img(w.poster, 'w154')}" alt="">` : `<span class="motif" aria-hidden="true"></span><b class="tz-l" aria-hidden="true">${initial(w.title)}</b>`}<i class="seen" aria-hidden="true">✓</i></span>
      <span class="node-text"><span class="n">${step ? `الخطوة ${i + 1}${step.optional ? ' (اختيارية)' : ''}` : esc(p.label)}${soon ? (w.date ? ` · قادم بعد ${cnt(daysLeft(w), 'day', true)}` : ' · قادم') : ''}</span>
        <span class="t">${ltr(titleOf(p))}</span>
        <span class="meta">${esc([yearOf(w, p), typeOf(w)].filter(Boolean).join(' · '))}</span>
        ${around.length ? `<span class="meta">${around.map(([k, t]) => `${k}: ${ltr(t)}`).join(' · ')}</span>` : ''}${avStart(p) ? `<span class="meta">يبدأ في الخطوة ${avStart(p).n} من ترتيب المشاهدة</span>` : ''}${step?.note ? `<span class="meta">${ar(step.note)}</span>` : ''}</span></button>
    <div class="go">${soon ? '' : `<button class="tick" data-act="status" data-s="watched" aria-pressed="${done}">${tick(done, 'شاهدته', 'علّمه كمشاهَد')}</button>`}<button data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}">البطاقة</button></div></div>`;
}
const avStart = p => { if (p.universe !== 'arrow' || !D.arrow) return null; return D.arrow.steps.find(s => (s.blocks || []).some(b => b.work === p.work && (!p.season || b.season === p.season)) || (s.parts || []).some(q => q.work === p.work && (!p.season || q.season === p.season))) || null; };
const avLine = (p, cls = '') => { const st = avStart(p); return st ? `<div class="canon ${cls}">في ترتيب المشاهدة: يبدأ في الخطوة ${st.n} (${esc(st.title)}). <button data-act="avgo" data-step="${st.id}">افتح الخطوة</button></div>` : ''; };
const tlNote = u => u.id === 'arrow' ? '<p class="tl-note">المسلسلات هنا مرتبة حسب سنة بدايتها فقط. المشاهدة الفعلية متداخلة بين مواسمها وحلقاتها. <button data-act="view" data-view="arrow">افتح ترتيب المشاهدة بالحلقات</button></p>' : '';
function renderTimeline() {
  const secs = sections();
  $('#main').innerHTML = secs.length ? meantBar() + secs.map(({ u, all, list }) => `<section class="uni" id="u-${u.id}" data-uni="${u.id}" style="${themeVars(u.id)}">${uniHead(u, all)}${tlNote(u)}<div class="tl">${list.map(node).join('')}</div></section>`).join('')
    : '<p class="empty">لا توجد أعمال تطابق البحث أو التصفية الحالية.</p>';
}
// تغيير الحالة أو تعليم حلقة يحدّث العناصر المعنية في مكانها: لا إعادة رسم للصفحة ولا إعادة تحميل للصور
function syncStatus(k) {
  const st = store.works[k] || '';
  for (const el of $$('#main [data-k]')) { if (el.dataset.k !== k) continue;
    if (el.classList.contains('node')) { const on = st === 'watched', sb = $('[data-act=status]', el); el.classList.toggle('done', on); if (sb) { sb.setAttribute('aria-pressed', on); sb.innerHTML = tick(on, 'شاهدته', 'علّمه كمشاهَد'); } }
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
      <p class="why">${ar(cur.why)} <a href="${esc(cur.source)}" target="_blank" rel="noopener">المصدر: ${ltr(cur.sourceName)}</a></p></div>
    <div class="tl">${cur.steps.map((st, i, all) => node(find(st), i, all, st)).join('')}</div>
    ${o.outro ? `<p class="tl-note">${esc(o.outro)}</p>` : ''}
  </section>`;
}
function renderArrow() {
  if (G.order?.kind === 'paths') return renderPaths();
  const a = D.arrow, done = avDone(), t = THEMES.arrow, key = D.works.get(t.key);
  // افتتاحية بصورة العالم نفسها كما في البطاقات، ثم شرح الترتيب تحتها
  $('#main').innerHTML = `<section class="uni" data-uni="arrow" style="${themeVars('arrow')}">
    <header class="opener av-hero m-${t.motif}">${key?.backdrop ? `<img class="opener-img" decoding="async" src="${img(key.backdrop, 'w780')}" srcset="${img(key.backdrop, 'w780')} 780w, ${img(key.backdrop, 'w1280')} 1280w" sizes="(max-width:560px) 60vw, 100vw" alt="">` : ''}<div class="motif"></div>
      <h2>ترتيب مشاهدة ${ltr('Arrowverse')}</h2>
      <p class="desc">${cnt(a.steps.length, 'step')} تغطي ${cnt(a.totalEpisodes, 'ep', true)} من ${cnt(a.showCount, 'show', true)}. كل حلقة موجودة مرة واحدة فقط.</p>
      <span class="lbl" id="avLbl">تقدّمك: ${done} من ${cnt(a.totalEpisodes, 'ep', true)}</span><div class="bar"><i id="avBar" style="width:${Math.round(done / a.totalEpisodes * 100)}%"></i></div></header>
    <div class="av-intro">
      <ul>
      <li>اتبع الخطوات بالترتيب، وداخل كل خطوة اتبع الأسطر من الأعلى إلى الأسفل.</li>
      <li>الخطوات البرتقالية حلقات تقاطع: قصة واحدة موزعة على أكثر من مسلسل، وتُشاهد بترتيب الأجزاء.</li>
      <li>الترتيب مبني على تواريخ العرض الفعلية وعناوين الحلقات الرسمية.</li>
      <li>${a.sideShows.map(x => `${ltr(x.show)} يبدأ في الخطوة ${x.firstStep}`).join('، و')}. يدوران في أرضين مستقلتين عن أرض بقية المسلسلات، ومكانهما في الخطوات حسب تاريخ عرضهما. ${a.sideShows.map(x => `<a href="${esc(x.source)}" target="_blank" rel="noopener">مصدر ${ltr(x.show)}</a>`).join(' · ')}</li></ul>
</div>
    <div class="steps">${a.steps.map(s => stepHTML(s)).join('')}</div>
  </section>`;
}
// صورة الموسم (أو المسلسل إن لم تكن للموسم صورة) في أول كل سطر من ترتيب آروفيرس
const avThumb = (id, season) => { const w = D.works.get(id), p = w?.seasons?.find(x => x.n === season)?.poster || w?.poster;
  return `<span class="thumb av-th"${p ? ` data-zoom-pinch data-zoom-title="${esc(`الموسم ${season} من ${w.title}`)}"` : ''}>${p ? `<img loading="lazy" decoding="async" src="${img(p, 'w154')}" srcset="${img(p, 'w92')} 92w, ${img(p, 'w154')} 154w" sizes="48px" alt="">` : ''}</span>`; };
const stepHTML = (s, shown) => s.kind === 'crossover' ? `<div class="step cross${shown ? ' shown' : ''}" id="${s.id}"><div class="step-head"><span class="num">${s.n}</span><h3>${esc(s.title)} <span class="en">${ltr(s.titleEn)}</span></h3><span class="tag soon">${cnt(s.parts.filter(p => !p.tieIn).length, 'part')} بالترتيب</span><span class="meta">${esc(s.label)}</span></div>
        ${s.parts.map(p => { const d = epDone(p.work, p.season, p.episode); return `<div class="row ${d ? 'done' : ''} ${p.tieIn ? 'tie' : ''}" style="--show:${SHOW_COLORS[p.work]}"><span class="k">${p.tieIn ? '＋' : p.part}</span>${avThumb(p.work, p.season)}
          <span class="show">${ltr(p.show)}<span class="epname">${ltr(p.name || '')}</span></span>
          <span class="what">${p.tieIn ? 'حلقة مرتبطة' : `الجزء ${p.part}`}: الموسم ${p.season}، الحلقة ${p.episode}<small>${fmtDate(p.aired)}</small></span>
          <span class="btns"><button class="tick" aria-pressed="${!!d}" data-act="avpart" data-id="${p.work}" data-season="${p.season}" data-ep="${p.episode}">${tick(d, 'شاهدتها', 'علّمها كمشاهَدة')}</button><button data-act="open" data-id="${p.work}" data-season="${p.season}">افتح الموسم</button></span>
          ${p.note ? `<span class="link">${ar(p.note)}</span>` : ''}</div>`; }).join('')}</div>`
      : `<div class="step${shown ? ' shown' : ''}" id="${s.id}"><div class="step-head"><span class="num">${s.n}</span><h3>${esc(s.title)}</h3>${s.title !== s.label ? `<span class="meta">${esc(s.label)}</span>` : ''}</div>
        ${s.blocks.map((b, i) => { const dn = rangeDone(b), full = dn === b.count; return `<div class="row ${full ? 'done' : ''}" style="--show:${SHOW_COLORS[b.work]}"><span class="k">${i + 1}</span>${avThumb(b.work, b.season)}
          <span class="show">${ltr(b.show)}</span>
          <span class="what">الموسم ${b.season}: ${b.whole ? 'كامل' : `من الحلقة ${b.from} إلى الحلقة ${b.to}`}<small>${cnt(b.count, 'ep')} · شاهدت ${dn}${b.side ? ' · أرض مستقلة: لا يتقاطع مع المسلسلات الأخرى' : ''}</small></span>
          <span class="btns"><button class="tick" aria-pressed="${!!full}" data-act="avblock" data-id="${b.work}" data-season="${b.season}" data-from="${b.from}" data-to="${b.to}">${tick(full, 'مكتملة', 'علّمها كمشاهَدة')}</button><button data-act="open" data-id="${b.work}" data-season="${b.season}">الحلقات</button></span>
          ${b.links.map(l => `<span class="link">الحلقة ${l.episode}${l.toEpisode ? ' إلى ' + l.toEpisode : ''}: ${ar(l.note)}</span>`).join('')}</div>`; }).join('')}</div>`;


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
// o.state: ما تصفه خطوة السجل (بطاقة العمل: w وs وu)، وo.push === false: رسم من السجل نفسه (رجوع أو تقدّم) فلا خطوة جديدة.
// بطاقة عمل تُفتح من بطاقة عمل مفتوحة خطوة فوقها (E89)، وغيرها (الفهرس، سجلّي، الدليل) خطوة واحدة
function openSheet(title, html, tag, o = {}) {
  const sh = $('#sheet'), bd = $('#backdrop'), was = ui.sheet, from = was && o.push !== false && tag === 'work' && was === 'work' ? S.leave() : null;
  if (closing) { closing.forEach(a => a.cancel()); closing = null; }
  $('#sheetTitle').innerHTML = title; $('#sheetBody').innerHTML = html; $('#sheetBody').scrollTop = 0;
  sh.className = 'sheet' + (o.wide ? ' wide' : '') + (o.tall ? ' tall' : ''); sh.style.cssText = o.uni && THEMES[o.uni] ? themeVars(o.uni) : '';
  sh.hidden = false; bd.hidden = false; root.classList.add('sheet-open'); $('#sheetBody').scrollTop = 0;   // بعد العرض: المتصفح يعيد للنافذة موضع تمريرها السابق حين تُعرض، وتصفيره وهي مخفية لا يؤثر
  ui.sheet = tag || 'x';
  if (o.push === false) S.sync(); else if (!was || from) S.open({ sheet: ui.sheet, ...(o.state || {}) }, undefined, from); else S.sync();
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
// × وسحب الرأس والنقر خارجها يغلقها كلها (الستاك كله)، وfromPop: السجل رجع إلى ما قبلها فتُغلق وحدها
function closeSheet(fromPop) {
  if (!ui.sheet) return;
  if (!fromPop) return S.closeAll();
  ui.sheet = null;
  const sh = $('#sheet'), bd = $('#backdrop'), cur = sh.style.transform || 'none';
  const done = () => { sh.hidden = true; bd.hidden = true; sh.style.transform = ''; root.classList.remove('sheet-open'); $$('.ghost').forEach(g => g.remove());
    if (ui.dirty) { ui.dirty = false; if (ui.view === 'arrow') render(true); } };
  if (reduce.matches) done();
  else { const mine = closing = [bd.animate({ opacity: [1, 0] }, { duration: 190, easing: 'ease-in', fill: 'forwards' }),
      sh.animate(phone.matches ? { transform: [cur, 'translateY(100%)'] } : { transform: ['none', 'translateY(14px) scale(.97)'], opacity: [1, 0] }, { duration: 190, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })];
    const fin = () => { if (closing !== mine) return; closing = null; done(); mine.forEach(a => a.cancel()); };
    mine[1].finished.then(fin, () => {}); setTimeout(fin, 400); } // المؤقت يضمن الإغلاق حتى لو توقفت الإطارات
}
const S = cardStack({ key: 'sheet', body: $('#sheetBody'), btn: $('#sheet .sback'), isOpen: () => !!ui.sheet, close: () => closeSheet(true), title: () => $('#sheetTitle').textContent.trim(),
  show: (s, y) => { if (s.w && D.works.has(s.w)) { openWork(s.w, s.s ?? undefined, null, s.u, { push: false }); $('#sheetBody').scrollTop = y; } else closeSheet(true); } });
// الرجوع (زر المتصفح وإيماءة الجوال) يعيد البطاقة التي قبلها، وEsc مثله خطوةً خطوة
addEventListener('popstate', () => S.pop());
// الجوال: سحب رأس النافذة للأسفل يغلقها، والنافذة تتبع الإصبع
{ const sh = $('#sheet'), head = $('.sheet-head'); let drag = null;
  head.addEventListener('pointerdown', e => { if (!phone.matches || e.target.closest('button') || closing) return; drag = { y: e.clientY, t: e.timeStamp, dy: 0 }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => { if (!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); sh.style.transform = `translateY(${drag.dy}px)`; });
  const end = e => { if (!drag) return; const d = drag, v = d.dy / Math.max(1, e.timeStamp - d.t); drag = null;
    if (d.dy > 110 || (d.dy > 28 && v > .55)) return closeSheet();
    sh.style.transform = ''; if (d.dy && !reduce.matches) sh.animate({ transform: [`translateY(${d.dy}px)`, 'none'] }, { duration: 240, easing: EASE }); };
  head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end); }

// ---------- «موقعه من عالمه» تحت العنوان (E53، E58): لافتة تقول ما هذا العمل من عالمه بجملة واضحة (بداية العالم، العمل الثالث يأتي بعد…، الموسم الثاني
// يكمل الأول)، وفوقها خريطة العالم بنقاط (site/pos.js): ما شاهدته ممتلئ وموضع هذا العمل مضيء. وما بين قوسين في ترتيبه المكتوب (ما قبل القصة، الختام…)
// يُذكر بجانب شارته. والعمل في عالم أعماله منفردة لافتته «منفرد». كل اسم فيها يفتح بطاقته في العالم نفسه
const nth = k => k <= 99 ? ord(k) : `رقم ${k}`;
function chainHTML(pl) { const u = uniOf(pl.universe); if (!u) return '';
  const all = D.placements.filter(p => p.universe === pl.universe).sort((a, b) => a.position - b.position), i = all.indexOf(pl), w = D.works.get(pl.work); if (i < 0) return '';
  const L = p => p ? `<button type="button" class="ch-l" data-act="open" data-id="${p.work}"${p.season ? ` data-season="${p.season}"` : ''} data-uni="${p.universe}">${ltr(titleOf(p))}</button>${isSoon(D.works.get(p.work)) ? ' (لم يُعرض بعد)' : ''}` : '';
  const label = pl.label || '', paren = (/\(([^)]+)\)\s*$/.exec(label) || [])[1] || '', where = G.id === 'fate' ? 'الخط' : 'العالم', kind = w.kind === 'series' ? 'مسلسل' : 'فيلم';
  const head = (b, sub, map) => `${map}<p class="ch-m"><b class="ch-k">${b}</b>${sub ? `<span class="ch-s">${esc(sub)}</span>` : ''}</p>`;
  // عالم أعماله منفردة: كل عمل قائم بذاته. وما كُتب في ترتيبه غير «منفرد» و«مستقل» (اختياري، بعد الخط الأساسي…) يُذكر بجانب الشارة
  if (!u.serial) { const tag = /^(منفرد|مستقل)/.test(label) ? '' : label, after = /^بعد /.test(tag), line = G.id === 'fate' ? 'خط متسلسل' : 'عالم متسلسل';
    return `<nav class="chain solo" aria-label="موقعه من عالمه">${head(`${kind} منفرد`, after ? '' : tag, posMap({ solo: true }))}<p class="ch-t">${after ? `قائم بذاته وليس جزءاً من ${line}، ويُشاهد ${esc(tag)}.` : `قائم بذاته: يُشاهد وحده ${G.id === 'fate' ? 'متى شئت' : 'بأي ترتيب'}، وليس جزءاً من ${line}.`}</p><p class="ch-n">من ${esc(u.name)}</p></nav>`; }
  const no = /^\d+/.test(label) ? parseInt(label, 10) : 0, alt = /^\d+-بديل/.test(label), intro = /^مقدمة/.test(label);
  const prev = all[i - 1], next = all[i + 1], a = L(prev), b = L(next), sameShow = pl.season > 1 && prev?.work === pl.work && prev.season === pl.season - 1, soon = isSoon(w);
  const badge = alt ? 'نسخة بديلة' : intro ? esc(label.replace(/\s*\([^)]*\)\s*$/, '')) : pl.season ? `الموسم ${nth(pl.season)}` : i === 0 ? `بداية ${where}` : soon && !no ? 'عمل قادم' : `العمل ${nth(no || i + 1)}`;
  const sub = [alt ? `من العمل ${nth(no)}` : pl.season && i > 0 && !intro ? `${nth(no || i + 1)} في الترتيب` : '', paren, soon ? 'لم يُعرض بعد' : ''].filter(Boolean).join(' · ');
  // آروفيرس: مسلسلاته متداخلة بالحلقات، فترتيبها هنا بسنة البداية فقط والترتيب الفعلي في «ترتيب آروفيرس»
  const st = avStart(pl), say = u.id === 'arrow' ? `مواسمه تتداخل مع بقية مسلسلات هذا العالم حلقةً بحلقة${st ? `، ويبدأ في الخطوة ${st.n} من ترتيب المشاهدة` : ''}.`
    : sameShow ? `يكمل الموسم ${nth(pl.season - 1)}${b ? `، ويليه ${b}` : `، وهو آخر ما في هذا ${where} حتى الآن`}.`
    : i === 0 ? `منه تبدأ مشاهدة هذا ${where}${b ? `، ويليه ${b}` : ''}.` : `يأتي بعد ${a}${b ? ` وقبل ${b}` : `، وهو آخر ما في هذا ${where} حتى الآن`}.`;
  return `<nav class="chain" aria-label="موقعه من عالمه">${head(badge, sub, all.length > 1 ? posMap({ n: all.length, at: i, done: k => statusOf(all[k]) === 'watched' }) : '')}<p class="ch-t">${say}</p><p class="ch-n">${i + 1} من ${all.length} في ${esc(u.name)}، ${u.id === 'arrow' ? 'بترتيب سنة البداية' : 'بترتيب المشاهدة'}</p></nav>`; }
function openWork(id, season, from, uniHint, o = {}) {
  const w = D.works.get(id), soon = isSoon(w);
  const places = D.placements.filter(p => p.work === id);
  const uni = (uniHint && places.some(p => p.universe === uniHint) && uniHint) || from?.closest('section.uni')?.dataset.uni || (places.find(p => p.universe === ui.uni) || places[0]).universe;
  const series = w.kind === 'series' && w.episodeCount, pl = places.find(p => p.universe === uni && (p.season ?? null) === (season ?? null)) || places.find(p => p.season === season) || places.find(p => p.universe === uni) || places[0];
  const tabs = series ? [...w.seasons, ...(w.specials ? [{ n: 0 }] : [])] : [];
  openSheet(ltr(w.title), `<div class="hero">${w.backdrop ? `<img decoding="async" src="${img(w.backdrop, 'w780')}" alt="">` : ''}</div>
    <div class="dw"><div class="dw-top">${w.poster ? `<button class="poster" data-zoom="${img(w.poster, 'w780')}" data-zoom-title="${esc(w.title)}" aria-label="تكبير بوستر ${esc(w.title)}">${posterTag(w, uni)}</button>` : `<div class="poster">${posterTag(w, uni)}</div>`}
      <div><h3>${ltr(w.title)}</h3>
      <div class="meta bits">${bits([typeOf(w), w.date ? fmtDate(w.date) : w.year, w.runtime ? cnt(w.runtime, 'min') : '', ...(w.episodeCount ? [cnt(w.seasons.length, 'season'), cnt(w.episodeCount, 'ep')] : [])])}</div>
      ${soon ? `<div class="tags"><span class="tag soon">${pl.upcoming?.stage === 'development' ? 'معلن' : 'قادم'}</span></div>` : ''}</div></div>
    ${chainHTML(pl)}${w.overviewAr ? `<p class="ov">${ar(w.overviewAr)}</p>` : w.overviewEn ? `<div><span class="lbl">النبذة بالإنجليزية (الترجمة العربية قيد الإعداد)</span><p class="ov en">${esc(w.overviewEn)}</p></div>` : ''}
    <div class="actions">${places.map(p => `<button data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}" data-force="1">البطاقة في ${esc(uniOf(p.universe).name)}${p.season ? `، الموسم ${p.season}` : ''}</button>`).join('')}</div>
    ${soon ? soonBlock(w, uni, pl.upcoming) : ''}
    ${rateBlock(w, pl)}
    ${whereBlock(w, season)}
    ${nextBlock(w, '', uni)}
    ${series ? `<div class="seasons" id="seasonTabs">${tabs.map(s => `<button data-act="season" data-id="${id}" data-season="${s.n}">${s.n ? 'الموسم ' + s.n : 'خاصة'}</button>`).join('')}</div><div id="eps" class="dw" style="padding:0" aria-busy="true">${'<div class="ep skel"><span class="epthumb"><span class="ph"></span></span><div><i></i><i></i></div></div>'.repeat(4)}</div>` : ''}</div>`, 'work', { uni, tall: series, from: from?.querySelector('img'), push: o.push, state: { w: id, s: season ?? null, u: uni } });
  if (series) showSeason(id, tabs.some(s => s.n === season) ? season : w.seasons[0].n);
}
async function showSeason(id, n) { prevClose();
  $$('#seasonTabs button').forEach(b => b.classList.toggle('on', +b.dataset.season === n));
  // تبويب الموسم المختار إلى وسط شريط التبويبات، بتمرير الشريط وحده: scrollIntoView كان ينزل بالنافذة كلها إلى التبويبات حين تُفتح البطاقة
  { const box = $('#seasonTabs'), t = box && $('.on', box); if (t) { const r = t.getBoundingClientRect(), b = box.getBoundingClientRect(); box.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2); } }
  const box = $('#eps');
  try { if (!D.episodes.has(id)) D.episodes.set(id, await getJSON(`data/episodes/${id}.json`)); }
  catch { box.innerHTML = '<p class="empty">تعذّر تحميل الحلقات. تحقق من الاتصال وحاول مرة أخرى.</p>'; return; }
  const s = D.episodes.get(id).seasons.find(x => x.n === n); if (!s || !box.isConnected) return;
  box.removeAttribute('aria-busy');
  if (G.malScore && n) { const pl = D.placements.find(p => p.work === id && p.season === n), r = $('#sheet .rates'); if (pl && r) r.outerHTML = rateBlock(D.works.get(id), pl); } // لكل موسم صفحته وتقييمه
  { const w = D.works.get(id), wb = $('#sheet .where'); if (wb && (w.seasons || []).some(x => x.prov !== undefined)) wb.outerHTML = whereBlock(w, n); } // ولكل موسم منصاته إن خالفت منصات المسلسل
  const all = s.episodes.every(e => epDone(id, n, e.n));
  const rated = s.episodes.filter(e => e.rating != null && (e.votes ?? 5) >= 5), avg = rated.length ? Math.round(rated.reduce((x, e) => x + e.rating, 0) / rated.length * 10) / 10 : null;
  box.innerHTML = `<div class="season-bar"><span class="lbl">${!n ? 'حلقات خاصة خارج ترقيم المواسم. ملاحظة كل بطاقة تذكر متى تُشاهد المهم منها.' : avg != null ? `متوسط تقييم الموسم ${avg} من 10 على ${ltr('TMDB')}، محسوب من ${cnt(rated.length, 'ep', true)}` : 'لا يوجد تقييم كافٍ لحلقات هذا الموسم بعد'}</span>
      ${n ? `<button data-act="seasonall" data-id="${id}" data-season="${n}">${all ? 'ألغِ تعليم حلقات الموسم' : 'علّم حلقات الموسم كلها'}</button>` : ''}</div>` +
    s.episodes.map(e => { const d = epDone(id, n, e.n), fut = !e.date || e.date > TODAY, ov = e.overviewAr || e.overviewEn, few = (e.votes ?? 5) < 5;
      const when = fut ? (e.date ? `تُعرض بعد ${cnt(daysTo(e.date), 'day', true)}، ${fmtDate(e.date)}` : 'لم يُحدَّد موعد عرضها') : fmtDate(e.date);
      return `<div class="ep ${d ? 'done' : ''} ${fut ? 'future' : ''}"><span class="epthumb">${e.still ? `<img loading="lazy" decoding="async" src="${img(e.still, 'w300')}" alt="">` : '<span class="ph"></span>'}
          ${e.rating != null && !fut ? `<span class="eprate ${few ? 'low' : ''}" title="${few ? 'عدد الأصوات قليل' : 'تقييم TMDB'}">${e.rating.toFixed(1)}</span>` : ''}</span>
        <div><h4>${n ? 'الحلقة' : 'خاصة'} ${e.n}${e.name ? ltr(e.name) : ''}</h4>${e.nameAr ? `<div class="ar-title">${esc(e.nameAr)}</div>` : ''}
          <div class="meta">${esc([when, e.runtime ? e.runtime + ' د' : '', fut ? '' : e.rating == null ? 'بلا تقييم بعد' : few ? 'تقييم بأصوات قليلة' : ''].filter(Boolean).join(' · '))}</div></div>
        ${ov ? `<div style="grid-column:1/-1">${e.overviewAr ? '' : '<span class="lbl">الملخص بالإنجليزية (الترجمة العربية قيد الإعداد)</span>'}
          <p class="ov ${e.overviewAr ? '' : 'en'} ${store.shield && !d ? 'blur' : ''}" ${store.shield && !d ? 'data-act="reveal" title="اضغط للكشف"' : ''}>${ar(ov)}</p>
          ${store.shield && !d ? '<span class="lbl">الملخص مخفي لتفادي الحرق. اضغط عليه للكشف</span>' : ''}</div>` : ''}
        <div class="foot2"><span></span>${fut ? '' : `<button class="tick" aria-pressed="${!!d}" data-act="ep" data-id="${id}" data-season="${n}" data-ep="${e.n}">${tick(d, 'شاهدتها', 'علّمها كمشاهَدة')}</button>`}</div></div>`; }).join('');
}
const unblur = ov => { ov.classList.remove('blur'); ov.removeAttribute('data-act'); ov.removeAttribute('title'); ov.nextElementSibling?.remove(); };
const seasonBtn = (id, n) => { const sa = $('#eps [data-act=seasonall]'), s = D.episodes.get(id)?.seasons.find(x => x.n === n); if (sa && s) sa.textContent = s.episodes.every(e => epDone(id, n, e.n)) ? 'ألغِ تعليم حلقات الموسم' : 'علّم حلقات الموسم كلها'; };

// ---------- «وما قبلها؟»: تعليم حلقة وقبلها حلقات بلا علامة يسأل عنها داخل بطاقة الحلقة نفسها، تحت الإصبع، لا في إشعار بعيد.
// شريط النقاط يرسم حلقات الموسم حتى هذه الحلقة (الممتلئة مشاهَدة والفارغة لا)، و«نعم» يعلّمها موجةً تسري من هذه الحلقة رجوعاً إلى الأولى.
// السجل يُحفظ كله قبل أن تبدأ الموجة، فهي عرض لما تم لا شرط له. «لا» يُحفظ على الجهاز (KEY.pvno) لكل موسم سُئل فيه: ما رُفض لا يُعرض ثانية،
// ويُسأل عن فجوة جديدة وحدها إن ظهرت. والتجاهل لا يغيّر شيئاً. الحلقات الخاصة وما لم يُعرض بعد خارج السؤال.
const pv = { cur: null, no: new Map(), t: 0 };
try { for (const [k, l] of Object.entries(JSON.parse(localStorage.getItem(KEY + '.pvno') || '{}'))) pv.no.set(k, new Set(l)); } catch {}
const aired = e => e.date && e.date <= TODAY;
function prevLeft(id, season, ep) { const ss = D.episodes.get(id)?.seasons || [];
  return { same: (ss.find(s => s.n === season)?.episodes || []).filter(e => e.n < ep && aired(e) && !epDone(id, season, e.n)).map(e => [season, e.n]),
    before: ss.filter(s => s.n > 0 && s.n < season).flatMap(s => s.episodes.filter(e => aired(e) && !epDone(id, s.n, e.n)).map(e => [s.n, e.n])) }; }
const pvFold = el => { el.classList.remove('on'); el.inert = true; reduce.matches ? el.remove() : setTimeout(() => el.remove(), 360); };
function prevClose() { clearTimeout(pv.t); pv.cur = null; $$('.pv').forEach(pvFold); }
function prevAsk(id, season, ep, row) { prevClose(); if (!season) return;
  const no = pv.no.get(`${id}#${season}`), open = l => no ? l.filter(([s, e]) => !no.has(`${s}-${e}`)) : l, left = prevLeft(id, season, ep), same = open(left.same), before = open(left.before), n = same.length, m = before.length; if (!n && !m) return;
  const eps = D.episodes.get(id).seasons.find(s => s.n === season).episodes.filter(e => e.n <= ep && aired(e)), cut = eps.slice(-28);   // موسم طويل: آخر ما قبلها يكفي الشريط
  const q = k => k === 1 ? 'هل شاهدتها أيضاً؟' : k === 2 ? 'هل شاهدتهما أيضاً؟' : 'هل شاهدتها كلها؟', mark = k => k === 2 ? 'نعم، علّمهما' : 'نعم، علّمها';
  const text = n && m ? `قبلها <b>${cnt(n, 'ep')}</b> بلا علامة في هذا الموسم، و<b>${cnt(m, 'ep')}</b> في المواسم السابقة.` : n ? `قبلها <b>${cnt(n, 'ep')}</b> بلا علامة مشاهدة. ${q(n)}` : `في المواسم السابقة <b>${cnt(m, 'ep')}</b> بلا علامة مشاهدة. ${q(m)}`;
  const btns = n && m ? `<button data-act="pvyes" data-scope="season">علّم حلقات الموسم</button><button data-act="pvyes" data-scope="all">علّم كل ما قبلها</button>` : `<button data-act="pvyes" data-scope="${n ? 'season' : 'all'}">${mark(n || m)}</button>`;
  row.insertAdjacentHTML('beforeend', `<div class="pv" role="group" aria-label="الحلقات التي قبلها"><div class="pv-in"><div class="pv-box">
    <span class="pv-dots" aria-hidden="true">${cut.length < eps.length ? '<u>…</u>' : ''}${cut.map(e => `<i class="${e.n === ep ? 'now' : epDone(id, season, e.n) ? 'on' : ''}" data-e="${e.n}"></i>`).join('')}</span>
    <p role="status">${text}</p><span class="pv-btns">${btns}<button data-act="pvno">لا، هذه فقط</button></span></div></div></div>`);
  const el = row.lastElementChild; pv.cur = { id, season, ep, same, before }; void el.offsetHeight; el.classList.add('on');
  // السؤال قد ينفتح تحت حافة النافذة (الحلقة الأخيرة في آخرها): يُنزَّل إليه بعد أن يكتمل انفتاحه
  setTimeout(() => { if (el.isConnected && pv.cur) row.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }); }, reduce.matches ? 0 : 380);
  pv.t = setTimeout(prevClose, 16000); }
function prevYes(scope) { const a = pv.cur, box = $('.pv.on'); if (!a) return; clearTimeout(pv.t); pv.cur = null;
  const { id, season } = a, list = scope === 'all' ? [...a.same, ...a.before] : a.same.length ? a.same : a.before;
  for (const [s, e] of list) setEp(id, s, e, true); save(); stats(); syncEps(id); ui.dirty = true;
  // الموجة: من أقرب حلقة إلى هذه رجوعاً إلى الأولى، وتُضغط خطوتها إن كثرت الحلقات حتى لا تطول
  const btn = new Map($$('#eps [data-act=ep]').map(b => [+b.dataset.ep, b])), here = list.filter(([s]) => s === season).map(([, e]) => e).sort((x, y) => y - x), step = reduce.matches ? 0 : Math.min(70, 900 / Math.max(here.length, 1));
  for (const b of box ? $$('button', box) : []) b.disabled = true;
  here.forEach((e, i) => setTimeout(() => { const b = btn.get(e); if (!b?.isConnected) return; const r = b.closest('.ep'), ov = $('.ov.blur', r);
    r.classList.add('done', 'swept'); b.innerHTML = tick(true, 'شاهدتها', 'علّمها كمشاهَدة'); b.setAttribute('aria-pressed', 'true'); if (ov) unblur(ov); $(`.pv-dots [data-e="${e}"]`)?.classList.add('on', 'pop'); }, i * step));
  setTimeout(() => { if (box?.isConnected) pvFold(box); seasonBtn(id, season);   // سؤالٌ جديد فُتح أثناء الموجة يبقى
    toast(`عُلّمت ${cnt(list.length, 'ep')} قبلها`, () => { for (const [s, e] of list) setEp(id, s, e, false); save(); stats(); syncEps(id); ui.dirty = true; const sa = $('#eps [data-act=seasonall]'); if (sa?.dataset.id === id) showSeason(id, +sa.dataset.season); }); }, here.length * step + (reduce.matches ? 0 : 520)); }
function prevNo() { const a = pv.cur; if (a) { const k = `${a.id}#${a.season}`, set = pv.no.get(k) || pv.no.set(k, new Set()).get(k); for (const [s, e] of [...a.same, ...a.before]) set.add(`${s}-${e}`);
    try { localStorage.setItem(KEY + '.pvno', JSON.stringify(Object.fromEntries([...pv.no].map(([k, v]) => [k, [...v]])))); } catch {} } prevClose(); }
// quiet: ما وصل من Trakt يُكتب في السجل ولا يُعاد إرساله إليه
function setEp(id, s, e, on, quiet) { const o = store.eps[id] ||= {}; if (on) o[`${s}-${e}`] = 1; else delete o[`${s}-${e}`]; if (!Object.keys(o).length) delete store.eps[id];
  const t = !quiet && tvOf(id); if (t) accMark(`tv${t}|${s}-${e}`, { on }); }
// ---------- المسلسلات ↔ Trakt (E87): في دليلَي DC ومارفل وحدهما (Fate أنمي: مكانه MyAnimeList وSIMKL في «أنمياتي»). المنطق على الخادم (scripts/lib-trakt.mjs):
// تُرسل إليه كل حلقة تعلّمها أو تزيل علامتها، و«سأشاهده» على المسلسل كله (قائمة المشاهدة هناك)، ويصل منه ما تغيّر في Trakt
const TRK = G.id === 'dc' || G.id === 'marvel';
const tvOf = id => { const w = TRK && D.works.get(id); return w?.seasons?.length && w.tmdb ? w.tmdb : 0; };
const listMark = (k, was) => { const t = !k.includes('#') && tvOf(k), on = store.works[k] === 'list'; if (t && (was === 'list') !== on) accMark(`tv${t}|l`, { on }); };
// ---------- أفلام الدليلين ↔ قائمة أفلامي وLetterboxd (E90): محور الأفلام على الخادم (syncFilms) يجمع أفلام البوابات الثلاث برقمها في TMDB.
// «شاهدته» على فيلم هنا يصير «شاهدته» في قائمة أفلامي (ومنها ملف الاستيراد إلى Letterboxd)، و«قائمتي» و«أشاهده» «سأشاهده» هناك. وما تسجّله في
// يومياتك في Letterboxd أو تعلّمه في قائمة أفلامي يصل هنا: لا ينزل «شاهدته» بما يصل، ولا يُغيَّر «أشاهده» و«تجاوز»، ولا تنتقل إزالة أكثر من ثلاثة أفلام دفعة واحدة
const fmOf = id => { const w = TRK && D.works.get(id); return w?.kind === 'film' && w.tmdb ? w.tmdb : 0; };
const fState = s => s === 'watched' ? 'watched' : s === 'list' || s === 'watching' ? 'next' : null;
const filmMark = (k, was) => { const f = !k.includes('#') && fmOf(k), to = fState(store.works[k]); if (f && to !== fState(was)) accMark('m' + f, { s: to }); };
const FSRC = { letterboxd: 'يومياتك في Letterboxd', site: 'قائمة أفلامي', dc: 'دليل DC', marvel: 'دليل مارفل' };
function filmApply(changes) { const by = new Map([...D.works.keys()].map(id => [fmOf(id), id]).filter(([f]) => f)), set = [], gone = [];
  for (const c of changes) { const id = by.get(+String(c.id).slice(1)), cur = id && (store.works[id] || ''); if (!id) continue;
    if (c.s === 'watched' && cur !== 'watched') set.push([id, 'watched', c.src]); else if (c.s === 'next' && !cur) set.push([id, 'list', c.src]);
    else if (!c.s && (cur === 'watched' || cur === 'list')) gone.push([id, null, c.src]); }
  const all = [...set, ...(gone.length <= 3 ? gone : [])]; if (!all.length) return;
  for (const [id, v] of all) if (v) store.works[id] = v; else delete store.works[id];
  save(); render(true); stats(); const from = [...new Set(all.map(x => FSRC[x[2]]).filter(Boolean))];
  toast(`وصل من ${from.length ? from.join(' و') : 'قائمة أفلامي'} تحديث ${cnt(all.length, 'film')}`); }
function traktApply(changes) { const by = new Map([...D.works.keys()].map(id => [tvOf(id), id]).filter(([t]) => t)), got = new Set();
  for (const c of changes) { const id = by.get(+c.id); if (!id) continue; let n = 0;
    for (const k of c.e || []) { const [s, e] = k.split('-').map(Number); if (!epDone(id, s, e)) { setEp(id, s, e, true, true); n++; } }
    for (const k of c.x || []) { const [s, e] = k.split('-').map(Number); if (epDone(id, s, e)) { setEp(id, s, e, false, true); n++; } }
    if (c.l === 1 && !store.works[id]) { store.works[id] = 'list'; n++; } else if (c.l === 0 && store.works[id] === 'list') { delete store.works[id]; n++; }
    if (n) got.add(id); }
  if (!got.size) return; save(); render(true); stats(); const tab = $('#seasonTabs .on'); if (tab) showSeason(tab.dataset.id, +tab.dataset.season);
  toast(`وصل من Trakt تحديث ${cnt(got.size, 'show')}`); }
// قسم Trakt في «سجلّي»: كلمة سر الموقع مرة في المتصفح، ثم «اربط» (صفحة موافقة Trakt ثم الرجوع إلى هنا)، ثم «مربوط ✓» و«زامن الآن» و«افصل»
const TK = { msg: '' };
const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'الآن' : m < 60 ? `قبل ${m} دقيقة` : m < 1440 ? `قبل ${Math.round(m / 60)} ساعة` : `قبل ${Math.round(m / 1440)} يوم`; };
function trkHTML() { const st = accState(), l = st.links?.trakt || {}, msg = TK.msg ? `<p class="trk-msg" role="status">${TK.msg}</p>` : '';
  if (st.pass || !accPass()) return `<form class="trk-pass"><label>كلمة سر الموقع مرة واحدة في هذا المتصفح (نفسها في «أضف فيلماً»)<input type="password" autocomplete="current-password" required></label><div class="actions"><button type="submit">تم</button></div></form>${msg}`;
  const err = l.on && l.err ? `<p class="trk-msg">${l.err === 'net' ? 'تعذّر الاتصال به في آخر مزامنة، ويُعاد وحده.' : l.err === 'auth' ? 'انتهى الربط: افصله واربطه من جديد.' : 'لم يقبل آخر تحديث، ويُعاد وحده.'}</p>` : '';
  if (l.dead) return `<p class="trk-msg">انتهى الربط: افصله واربطه من جديد.</p><div class="actions"><button data-act="trk-unlink">افصل</button></div>${msg}`;
  return (l.on ? `<p class="trk-on">مربوط ✓${l.at ? ` · آخر مزامنة ${ago(l.at)}` : ''}</p>${err}<div class="actions"><button data-act="trk-sync"${st.busy ? ' disabled' : ''}>${st.busy ? 'يزامن…' : 'زامن الآن'}</button><button data-act="trk-unlink">افصل</button></div>`
    : l.ready === false ? '<p>يُجهَّز قريباً.</p>' : '<div class="actions"><button class="cta" data-act="trk-link">اربط حسابك في Trakt</button></div>') + msg + (st.err ? `<p class="trk-msg">${esc(st.err)}</p>` : ''); }
// وأفلامه مع Letterboxd (E90): الربط وملف الاستيراد في نافذة Letterboxd في قائمة أفلامي، وهنا حاله ورابط إليها
function lbnHTML() { const l = accState().links?.letterboxd;
  return `${l?.on ? `<p class="trk-on">مربوط بصفحتك <bdi dir="ltr">letterboxd.com/${esc(l.user || '')}</bdi> ✓</p>` : ''}<div class="actions"><button data-act="lbn-go">${l?.on ? 'افتح نافذته في قائمة أفلامي' : 'اربطه من قائمة أفلامي'}</button></div>`; }
const drawTrk = () => { const el = $('#trk'); if (el) el.innerHTML = trkHTML(); const ln = $('#lbn'); if (ln) ln.innerHTML = lbnHTML(); const an = $('#anis'); if (an) an.innerHTML = aniHTML(); };
// ---------- دليل Fate ↔ MyAnimeList وSIMKL (E92): لكل موضع في الدليل (عمل أو موسم) رقمه في MyAnimeList. حاله وعدد حلقاته يصلان محور الأنمي على الخادم
// (مصدرها fate) فيصلان الحسابين و«أنمياتي»، ويصل منه ما تغيّر هناك. إلى الأمام وحده: الدليل لا يرسل إزالة ولا نزولاً، ولا ينزل بما يصله، ولا تنتقل إليه
// إزالة أكثر من ثلاثة أعمال دفعة واحدة؛ والتقييم لا يمسّه (يبقى ما في حسابك). و«تجاوز» لا يُرسل
var ANS = null;   // آخر ما عرفه المحور من الدليل لكل رقم: ما تغيّر عنه وحده يُرسل
const MALP = () => G.id === 'fate' ? D.placements.filter(p => p.mal) : [];
const plEps = p => D.works.get(p.work)?.kind === 'series' ? (p.season ? seasonDone(p.work, p.season) : seasonDone(p.work)) : 0;
const plTot = p => (D.works.get(p.work)?.seasons || []).filter(x => x.n && (!p.season || x.n === p.season)).reduce((a, x) => a + (x.episodes || 0), 0);   // بلا الخاصة
const aniState = p => { const w = D.works.get(p.work), st = statusOf(p), film = w?.kind !== 'series', n = film ? (st === 'watched' ? 1 : 0) : plEps(p);
  const s = st === 'watched' ? 'completed' : st === 'watching' || (n && st !== 'skip') ? 'watching' : st === 'list' ? 'plan' : null;
  return s ? { s, p: s === 'completed' && !film ? Math.max(n, plTot(p)) : n } : null; };
const aniKey = v => v ? v.s + ':' + v.p : '';
function aniDiff() { if (G.id !== 'fate' || !ANS) return; for (const p of MALP()) { const v = aniState(p), k = aniKey(v); if (k === ANS[p.mal]) continue; ANS[p.mal] = k; if (v) accMark(String(p.mal), v); } }
// يعلّم الحلقات من أول الموضع حتى العدد المطلوب (مواسمه بترتيبها، بلا الخاصة)
function tickTo(p, want) { const w = D.works.get(p.work), ss = (w.seasons || []).filter(x => x.n && (!p.season || x.n === p.season)).sort((a, b) => a.n - b.n); let n = 0, ch = 0;
  for (const x of ss) for (let e = 1; e <= (x.episodes || 0) && n < want; e++, n++) if (!epDone(p.work, x.n, e)) { setEp(p.work, x.n, e, true, true); ch = 1; }
  return ch; }
const ASRC = { mal: 'MyAnimeList', simkl: 'SIMKL', site: 'أنمياتي' };
function aniApply(changes) { if (!ANS) return; const by = new Map(), gone = [], from = new Set(); let n = 0;
  for (const p of MALP()) { if (!by.has(p.mal)) by.set(p.mal, []); by.get(p.mal).push(p); }
  for (const c of changes) for (const p of by.get(+c.id) || []) { const k = sKey(p), w = D.works.get(p.work), cur = store.works[k] || ''; let ch = 0;
    if (!c.s) { if (cur === 'list' || cur === 'watching' || cur === 'watched') gone.push([k, c.src]); continue; }
    if (c.s === 'completed' && cur !== 'watched') { store.works[k] = 'watched'; ch = 1; }
    else if ((c.s === 'watching' || c.s === 'hold') && (!cur || cur === 'list')) { store.works[k] = 'watching'; ch = 1; }
    else if (c.s === 'plan' && !cur) { store.works[k] = 'list'; ch = 1; }
    if (w?.kind === 'series') { const tot = plTot(p), want = c.s === 'completed' ? tot : Math.min(c.p || 0, tot); if (want > plEps(p)) ch |= tickTo(p, want); }
    if (ch) { n++; from.add(ASRC[c.src] || 'حساباتك'); } }
  if (gone.length <= 3) for (const [k, src] of gone) { delete store.works[k]; n++; from.add(ASRC[src] || 'حساباتك'); }
  for (const p of MALP()) ANS[p.mal] = aniKey(aniState(p));   // ما وصل لا يعود إلى المحور
  if (!n) return; save(); render(true); stats(); toast(`وصل من ${[...from].join(' و')} تحديث ${cnt(n, 'work')}`); }
function aniHTML() { const st = accState(), L = st.links || {}, on = ['mal', 'simkl'].some(k => L[k]?.on);
  if (st.pass || !accPass()) return `<form class="trk-pass"><label>كلمة سر الموقع مرة واحدة في هذا المتصفح (نفسها في «أضف فيلماً»)<input type="password" autocomplete="current-password" required></label><div class="actions"><button type="submit">تم</button></div></form>`;
  const row = (k, name) => { const l = L[k]; return `<li><bdi dir="ltr">${name}</bdi>: ${!l?.on ? 'غير مربوط' : l.err === 'auth' || l.dead ? 'انتهى الربط، أعد ربطه من «أنمياتي»' : `مربوط ✓${l.at ? ` · آخر مزامنة ${ago(l.at)}` : ''}`}</li>`; };
  return `<ul class="trk-list">${row('mal', 'MyAnimeList')}${row('simkl', 'SIMKL')}</ul><div class="actions">${on ? `<button data-act="trk-sync"${st.busy ? ' disabled' : ''}>${st.busy ? 'يزامن…' : 'زامن الآن'}</button>` : ''}<button data-act="ani-go">${on ? 'حساباتك في «أنمياتي»' : 'اربطها من «أنمياتي»'}</button></div>${st.err ? `<p class="trk-msg">${esc(st.err)}</p>` : ''}`; }
// «اربط»: إلى صفحة موافقة Trakt، ثم يعود إلى هذا الدليل (?linked=trakt) وتُفتح «سجلّي» برسالة
async function trkGo() { TK.msg = ''; try { await accLink('trakt', { from: G.id }); } catch (e) { TK.msg = e.pass ? '' : esc(e.message || 'تعذّر الربط.'); drawTrk(); } }
const trkBack = (svc, fail) => { if (svc !== 'trakt') return; TK.msg = !fail ? 'رُبط Trakt، والمزامنة تبدأ الآن.' : fail === 'denied' ? 'لم تكتمل الموافقة في Trakt، فلم يُربط.' : 'تعذّر الربط. اضغط «اربط» من جديد.'; openBackup(); };

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
  const draw = () => { const raw = $('#jq').value.trim(), q = fold(raw);
    const us = D.universes.filter(u => !q || fold(`${u.name} ${u.nameEn}`).includes(q));
    let ws = q ? D.placements.filter(p => lit(D.works.get(p.work), q)).slice(0, 40) : [], meant = null;
    // لا شيء حرفياً: الأقرب بالصوت أو الإملاء، مرتبة بقربها
    if (q && !ws.length && !us.length) { const z = worksFor(raw); if (z.ids) { const at = [...z.ids]; ws = D.placements.filter(p => z.ids.has(p.work)).sort((a, b) => at.indexOf(a.work) - at.indexOf(b.work)).slice(0, 40); meant = z.meant; } }
    $('#jres').innerHTML = ws.length ? `${meant ? `<p class="meant-bar">هل تقصد <b><bdi>${esc(meant.title)}</bdi></b>؟</p>` : ''}<h3>أعمال</h3><div class="hits">${ws.map(p => { const w = D.works.get(p.work), t = THEMES[p.universe]; return `<button class="hit" style="--c1:${t.c1}" data-act="goto" data-to="c" data-target="${domId('c', p)}" data-uni="${p.universe}" data-force="1">${w.poster ? `<img loading="lazy" src="${img(w.poster, 'w92')}" alt="">` : '<span class="ph"></span>'}<span class="hit-text"><span class="t">${ltr(titleOf(p))}</span><small>${esc(uniOf(p.universe).name)}</small></span><span class="hit-mark">${mark[statusOf(p)] || ''}</span></button>`; }).join('')}</div>` : q && !us.length ? '<p class="empty">لا يوجد عمل أو عالم بهذا الاسم.</p>' : '';
    $('#jhome').innerHTML = group(G.groups[0], us.filter(u => u.serial)) + group(G.groups[1], us.filter(u => !u.serial)); };
  $('#jq').addEventListener('input', draw); draw();
  if (matchMedia('(hover:hover)').matches) $('#jq').focus();
}
const encode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
function openBackup() {
  openSheet('سجل المشاهدة', `<div class="dw guide" style="padding-top:14px">${TRK ? `<section class="trk"><h4><bdi dir="ltr">Trakt</bdi></h4><p>حلقات المسلسلات و«سأشاهده» تتزامن بالاتجاهين مع حسابك في Trakt، ولو كانت الصفحة مغلقة.</p><div id="trk">${trkHTML()}</div></section><section class="trk"><h4><bdi dir="ltr">Letterboxd</bdi></h4><p>أفلام هذا الدليل مع قائمة أفلامي و<bdi dir="ltr">Letterboxd</bdi>: ما تسجّله في يومياتك هناك أو تعلّمه في قائمة أفلامي يصل هنا، وما تعلّمه هنا يصل قائمة أفلامي ويدخل ملف الاستيراد إلى <bdi dir="ltr">Letterboxd</bdi>.</p><div id="lbn">${lbnHTML()}</div></section><h4>أجهزتك</h4>` : ''}${G.id === 'fate' ? `<section class="trk"><h4>حساباتك في الأنمي</h4><p>حال أعمال هذا الدليل وحلقاتها مع <bdi dir="ltr">MyAnimeList</bdi> و<bdi dir="ltr">SIMKL</bdi> و«أنمياتي»: ما تعلّمه هنا يصلها، وما يتغيّر هناك يصل هنا. والدليل يتقدّم ولا يرجع: لا يزيل عملاً من حسابك ولا يمسّ تقييمك.</p><div id="anis">${aniHTML()}</div></section><h4>أجهزتك</h4>` : ''}<p>فعّل المزامنة ليصل سجلك إلى كل أجهزتك تلقائياً، في لحظته.</p>
    <div class="actions"><button data-sync-open><span data-sync-label>${syncLabel()}</span></button></div>
    <h4>نسخة يدوية</h4><p>الكود التالي هو سجلك كاملاً. احتفظ به نسخةً احتياطية، أو الصقه في جهاز آخر لاسترجاع السجل.</p>
    <textarea id="bk" aria-label="كود السجل">${encode(store)}</textarea>
    <div class="actions"><button data-act="bkcopy">نسخ الكود</button><button data-act="bkimport">استيراد الكود الملصوق</button></div>
    ${G.legacyImport ? '<h4>النقل من النسخة القديمة</h4><p>افتح موقعك القديم واضغط «نسخ احتياطي» وانسخ الكود، ثم الصقه هنا واضغط «استيراد الكود الملصوق». يتحوّل تلقائياً إلى النظام الجديد.</p>' : ''}</div>`, 'backup');
  if (TRK && accPass()) accLinks().then(() => { drawTrk(); accSync(); });   // رُبط من جهاز آخر؟ تبدأ المزامنة الآن
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
// ---------- «اقتراح الليلة» (E62) في الدليل الذي يطلبه (G.suggest: دليل Fate. دليل DC يُشاهد بترتيب أحداثه فلا اقتراح فيه): بطاقة أعلى البطاقات
// تقترح ما يصلح أن تبدأه الآن بترتيب الدليل نفسه: أول ما لم تشاهده في كل خط متسلسل (لا جزء قبل ما قبله)، والأعمال المنفردة ما دام شرطها تحقق
// (after في placements.json: عمل جانبي لا يُقترح قبل إكمال خطه). الأولوية: ما تشاهده الآن، ثم التالي في ترتيب المشاهدة الموصى به (أول مسارات الدليل)،
// ثم التالي في كل خط، ثم بدايات الخطوط المستقلة، ثم الأعمال المنفردة، والأعلى تقييماً أولاً. «اقتراح آخر» يأتي بالتالي في هذا الترتيب.
// ومزاجها نوع العمل وتصنيفاته في MyAnimeList (g في mal.json)، بأي عدد: لمسة تضيف ولمسة ترفع، ويُقدَّم ما يجمعها كلها ثم ما يجمع أكثرها.
// وإن اخترت خطاً من شريط الخطوط فالاقتراح منه
const SG = G.suggest ? { id: '', moods: [] } : null;
if (SG) try { SG.moods = (localStorage.getItem(KEY + '.mood') || '').split('|').filter(Boolean); } catch {}
const sgDone = p => ['watched', 'skip'].includes(statusOf(p));
const sgLineDone = uid => D.placements.filter(p => p.universe === uid && !isSoon(D.works.get(p.work))).every(sgDone);
const sgKey = c => `${c.p.universe}|${sKey(c.p)}`;
const sgTags = c => ['t:' + typeOf(c.w), ...(D.mal[c.p.mal]?.g || [])];   // نوعه كما يُكتب على بطاقته (مسلسل أنمي، فيلم أنمي، حلقة خاصة…) ثم تصنيفاته
const sgName = t => t.startsWith('t:') ? esc(t.slice(2)) : GENRE[t] || ltr(t);
const SGW = { watching: 0, begin: 1, path: 1, next: 2, start: 3, free: 4 };
const SGWHY = { watching: 'تشاهده الآن: كمّل من حيث وقفت', begin: 'بداية ترتيب المشاهدة الموصى به', path: 'التالي في ترتيب المشاهدة الموصى به', next: 'التالي في هذا الخط', start: 'بداية خط قصته مستقلة', free: 'عمل منفرد يُشاهد متى شئت' };
function sgPool() { const out = [], used = new Set(), steps = D.order?.paths?.[0]?.steps || [];
  const add = (p, why) => { const k = sKey(p), w = D.works.get(p.work); if (used.has(k) || isSoon(w)) return; used.add(k); out.push({ p, w, u: uniOf(p.universe), why: statusOf(p) === 'watching' ? 'watching' : why }); };
  for (const u of D.universes) { if (ui.uni !== 'all' && u.id !== ui.uni) continue;
    const all = D.placements.filter(p => p.universe === u.id).sort((a, b) => a.position - b.position);
    if (u.serial) { const p = all.find(p => !sgDone(p)); if (p) add(p, all.indexOf(p) === 0 ? 'start' : 'next'); }
    else for (const p of all) if (!sgDone(p) && (!p.after || sgLineDone(p.after))) add(p, 'free'); }
  const place = st => D.placements.find(p => p.work === st.work && (p.season ?? null) === (st.season ?? null)), nx = steps.map(place).find(p => p && !sgDone(p) && !isSoon(D.works.get(p.work)));
  const c = nx && out.find(c => sKey(c.p) === sKey(nx)); if (c && c.why !== 'watching') c.why = nx === place(steps[0]) ? 'begin' : 'path';
  return out.sort((a, b) => SGW[a.why] - SGW[b.why] || (rating(b.w, b.p)?.v || 0) - (rating(a.w, a.p)?.v || 0)); }
function pickHTML(step) { if (!SG || ui.view !== 'cards' || $('#q').value.trim() || $('#fType').value || $('#fStatus').value) return '';
  const pool = sgPool(); if (!pool.length) return '';
  const n = new Map(); for (const c of pool) for (const t of sgTags(c)) n.set(t, (n.get(t) || 0) + 1); SG.moods = SG.moods.filter(m => n.has(m));
  const fit = c => SG.moods.filter(m => sgTags(c).includes(m)).length, best = Math.max(0, ...pool.map(fit)), good = pool.filter(c => !SG.moods.length || !best || fit(c) === best);
  let i = good.findIndex(c => sgKey(c) === SG.id); i = i < 0 ? 0 : (i + step + good.length) % good.length; const c = good[i], { p, w, u, why } = c; SG.id = sgKey(c);
  const chip = (t, name, k) => `<button type="button" class="chip" data-act="pick-mood" data-g="${esc(t)}" aria-pressed="${t ? SG.moods.includes(t) : !SG.moods.length}">${name}<small>${k}</small></button>`;
  // المختار أولاً بترتيب اختياره، فلا يبقى منه شيء خارج الشريط لا يُرى (E76)، ثم النوع (فيلم، مسلسل)، ثم التصنيفات بعددها
  const chips = [...SG.moods.map(m => [m, n.get(m)]), ...[...n].filter(([t]) => !SG.moods.includes(t)).sort((a, b) => b[0].startsWith('t:') - a[0].startsWith('t:') || b[1] - a[1])].map(([t, k]) => chip(t, sgName(t), k)).join('');
  // وأقرب ما وُجد حين لا عمل يجمعها كلها: يقال ما فيه منها وما ليس فيه بأسمائها
  const has = SG.moods.filter(m => sgTags(c).includes(m)), miss = SG.moods.filter(m => !has.includes(m));
  const hint = SG.moods.length >= 2 ? `<p class="pick-h">${best === SG.moods.length ? `عمل يجمع ${SG.moods.map(sgName).join(' و')}.` : best ? `لا عمل مما ينتظرك يجمعها كلها، فهذا أقربها: يجمع ${best} من ${SG.moods.length}، فيه ${has.map(sgName).join(' و')} وليس فيه ${miss.map(sgName).join(' ولا ')}.` : 'لا عمل مما ينتظرك بهذا المزاج.'}</p>` : '';
  const r = rating(w, p), gs = sgTags(c).filter(t => !t.startsWith('t:')), mine = [...gs.filter(t => SG.moods.includes(t)), ...gs.filter(t => !SG.moods.includes(t))].slice(0, 3).map(sgName).join('، ');
  const meta = [esc(typeOf(w)), esc(yearOf(w, p)), w.seasons ? cnt(seasonTotal(w, p.season), 'ep') : w.runtime ? cnt(w.runtime, 'min') : '', r ? `${ltr(r.name)} ${r.v}` : '', mine].filter(Boolean).join(' · ');
  return `<section class="pick m-${THEMES[u.id]?.motif || 'stars'}" id="pick" style="${themeVars(u.id)}" aria-label="اقتراح الليلة">${w.backdrop ? `<img class="pick-img" decoding="async" src="${img(w.backdrop, 'w780')}" srcset="${img(w.backdrop, 'w780')} 780w, ${img(w.backdrop, 'w1280')} 1280w" sizes="(max-width:640px) 100vw, 60vw" alt="">` : ''}<div class="motif" aria-hidden="true"></div>
    <div class="pick-in"><p class="pick-l">اقتراح الليلة${good.length > 1 ? `<small>${i + 1} من ${good.length}</small>` : ''}</p><h2>${ltr(titleOf(p))}</h2>
      <p class="pick-w"><b>${SGWHY[why]}</b><span>${esc(u.name)}</span></p><p class="pick-m">${meta}</p>
      <div class="actions"><button class="cta" data-act="open" data-id="${w.id}"${p.season ? ` data-season="${p.season}"` : ''} data-uni="${u.id}"><span>افتح بطاقته</span></button>${good.length > 1 ? `<button data-act="pick-next">${ic('pick')}<span>اقتراح آخر</span></button>` : ''}${why === 'watching' ? '' : `<button data-act="pick-start" data-k="${esc(sKey(p))}">${ic('play')}<span>سأبدأه الآن</span></button>`}</div>
      <div class="pick-mood" role="group" aria-label="مزاجك الليلة"><span>مزاجك الليلة</span><div class="mood-c pick-c" data-drag>${chip('', 'أي شيء', pool.length)}${chips}</div></div>${hint}</div></section>`; }
// يعيد رسم الاقتراح في مكانه (بعد تغيير حالة عمل، أو مزاج، أو «اقتراح آخر») بلا إعادة رسم الصفحة
function refreshPick(step = 0) { if (!SG) return; const el = $('#pick'), html = pickHTML(step); if (el) { if (html) el.outerHTML = html; else el.remove(); } else if (html && $('#main .uni')) $('#main .uni').insertAdjacentHTML('beforebegin', html); }
// زر «ماذا أشاهد؟»: يأخذك إلى الاقتراح في صفحة البطاقات بلا تصفية
function pickGo() { $('#q').value = ''; $('#fType').value = ''; $('#fStatus').value = ''; ui.view = 'cards'; render(); const el = $('#pick'); if (!el) return toast('شاهدت كل ما صدر');
  scrollTo(0, 0); el.scrollIntoView({ block: 'center', behavior: 'instant' }); flash(el); }

// ---------- الأحداث
document.addEventListener('submit', ev => { const f = ev.target; if (!f.matches?.('.trk-pass')) return; ev.preventDefault(); accSetPass(f.querySelector('input').value); TK.msg = ''; accLinks().then(drawTrk); });
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) { if (ev.target.id === 'backdrop') closeSheet(); return; }
  const d = b.dataset, id = d.id, season = d.season ? +d.season : undefined;
  switch (d.act) {
    case 'view': if (ui.sheet) closeSheet(); ui.view = d.view; render(); scrollTo(0, 0); break;
    case 'meant': $('#q').value = d.q; render(); break;
    case 'uni': if (ui.sheet) closeSheet(); if (ui.view === 'arrow') ui.view = 'cards'; ui.uni = d.uni; render(); scrollTo(0, 0); break;
    case 'open': openWork(id, season, b.closest('.card,.node'), d.uni); break;
    case 'season': showSeason(id, season); break;
    case 'path': ui.path = d.path; render(true); break;
    case 'close': closeSheet(); break;
    case 'sback': S.back(); break;   // البطاقة السابقة (E89)
    case 'shield': if (ui.sheet) closeSheet(); store.shield = !store.shield; save(); syncShield(); render(true); toast(store.shield ? 'درع الحرق مفعّل' : 'درع الحرق متوقف'); break;
    case 'status': { const k = b.closest('[data-k]').dataset.k, was = store.works[k]; if (store.works[k] === d.s) delete store.works[k]; else store.works[k] = d.s; save(); listMark(k, was); filmMark(k, was);
      if (store.works[k] === 'watched') offerEps(k); else if (ask.fn) { ask.fn = null; $('#toast').hidden = true; }
      if ($('#fStatus').value) { render(true); break; } // مع تصفية الحالة قد يخرج العمل من القائمة نفسها
      syncStatus(k); stats(); refreshProgress(); refreshPick(); break; }
    case 'goto': { const force = d.force; if (ui.sheet) closeSheet(); if (force) ui.uni = d.uni; setTimeout(() => goTo(d.to === 't' ? 'timeline' : 'cards', d.uni, d.target), force ? 60 : 0); break; }
    case 'ep': { const on = !epDone(id, season, +d.ep), row = b.closest('.ep'), ov = $('.ov.blur', row); setEp(id, season, +d.ep, on); save();
      row.classList.remove('swept'); row.classList.toggle('done', on); b.innerHTML = tick(on, 'شاهدتها', 'علّمها كمشاهَدة'); b.setAttribute('aria-pressed', on); if (on && ov) unblur(ov);
      seasonBtn(id, season); stats(); syncEps(id); ui.dirty = true;
      if (on) prevAsk(id, season, +d.ep, row); else prevClose(); break; }
    case 'pvyes': prevYes(d.scope); break;
    case 'pvno': prevNo(); break;
    case 'seasonall': { const s = D.episodes.get(id).seasons.find(x => x.n === season), on = !s.episodes.every(e => epDone(id, season, e.n)); s.episodes.filter(e => e.date && e.date <= TODAY).forEach(e => setEp(id, season, e.n, on)); save(); showSeason(id, season); stats(); syncEps(id); ui.dirty = true; break; }
    case 'askyes': { const fn = ask.fn; ask.fn = null; $('#toast').hidden = true; fn?.(); break; }
    case 'askno': ask.fn = null; $('#toast').hidden = true; break;
    case 'reveal': unblur(b); break;
    case 'avpart': setEp(id, season, +d.ep, !epDone(id, season, +d.ep)); save(); avRefresh(b.closest('.step')); stats(); break;
    case 'avblock': { let all = true; for (let e = +d.from; e <= +d.to; e++) all &&= epDone(id, season, e); for (let e = +d.from; e <= +d.to; e++) setEp(id, season, e, !all); save(); avRefresh(b.closest('.step')); stats(); break; }
    case 'avgo': { if (ui.sheet) closeSheet(); ui.view = 'arrow'; render(); const t = document.getElementById(d.step); if (t) { t.scrollIntoView({ block: 'start', behavior: 'instant' }); flash(t); } break; }
    case 'jump': openJump(); break;
    case 'backup': openBackup(); break;
    case 'bkcopy': navigator.clipboard?.writeText($('#bk').value).then(() => toast('تم النسخ'), () => { $('#bk').select(); toast('حدّد النص وانسخه يدوياً'); }); break;
    case 'bkimport': importCode(); break;
    case 'trk-link': trkGo(); break;
    case 'trk-sync': accSync({ force: true }); break;
    case 'lbn-go': location.href = '../films/#letterboxd'; break;
    case 'ani-go': location.href = '../anime/#import'; break;
    case 'trk-unlink': accUnlink('trakt').then(() => { TK.msg = 'فُصل Trakt: لا تتزامن المسلسلات معه بعد الآن.'; drawTrk(); }, e => { TK.msg = esc(e.message); drawTrk(); }); break;
    case 'guide': openGuide(); break;
    case 'tonight': if (ui.sheet) closeSheet(); setTimeout(SG ? pickGo : tonight, 60); break;
    case 'pick-next': refreshPick(1); break;
    case 'pick-mood': { const g = d.g; SG.moods = !g ? [] : SG.moods.includes(g) ? SG.moods.filter(x => x !== g) : [...SG.moods, g]; try { localStorage.setItem(KEY + '.mood', SG.moods.join('|')); } catch {} SG.id = ''; refreshPick(); break; }
    case 'pick-start': { const k = d.k, was = store.works[k]; store.works[k] = 'watching'; save(); listMark(k, was); filmMark(k, was); syncStatus(k); stats(); refreshProgress(); refreshPick(); toast('بدأته: صار في «أشاهده»'); break; }
  }
});
addEventListener('keydown', e => { if (e.key === 'Escape' && ui.sheet) S.back(); });
let qt; ['input', 'change'].forEach(t => $('#filters').addEventListener(t, () => { clearTimeout(qt); qt = setTimeout(() => render(), 150); }));
document.addEventListener('load', e => { if (e.target.tagName === 'IMG') e.target.classList.add('in'); }, true);
document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG' && !t.dataset.failed) { t.dataset.failed = 1; t.style.visibility = 'hidden'; } }, true);

boot();
