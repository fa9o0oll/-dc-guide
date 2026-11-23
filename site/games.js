// «ألعابي»: قائمة ألعابي على كل المنصات، بأربع قوائم كقائمة لعبة رئيسية: «متابعة» (ألعبها الآن)، «لعبة جديدة» (سألعبها لاحقاً)،
// «شارة النهاية» (ختمتها، وعلى أي منصة)، «وضع المتفرج» (شاهدتها عند يوتيوبر أو تختيماً كاملاً ولم ألعبها)، والكل.
// لكل لعبة بطاقة فيها ما يلزم: منصاتها ومواعيدها، كم تأخذ لتختمها، سلسلتها بترتيب الصدور وترتيب القصة الذي يوصي به صنّاعها، عالمها،
// وما اقتُبست منه وما اقتُبس منها (موصولاً ببوابة الأفلام)، وعدّ تنازلي لما أُعلن ولم يصدر. «أضف لعبة» بالبحث المتسامح (site/find.js)،
// و«حساباتي» يسحب ما لعبته من Steam وPlayStation وXbox ويسألك عن كل لعبة. البيانات تُبنى في scripts/build-games.mjs من IGDB وWikidata.
// سجلك في المتصفح بالمفتاح gamesg.progress: { games: { رقم اللعبة: { s: القائمة, on: المنصة, at: التاريخ, h: الساعات } }, dups: { مفتاح مجموعة مكررة أسكتَّ تنبيهها: 1 } }
// ويُزامَن بين أجهزتك.
import { initSync, touch as syncTouch } from './sync.js?v=__BUILD__';
import { clock, spoken } from './count.js?v=__BUILD__';
import { miniDoor, portalBack } from './portal.js?v=__BUILD__';
import { prepare, find, fold } from './find.js?v=__BUILD__';
import { ar } from './bidi.js?v=__BUILD__';
import './zoom.js?v=__BUILD__';
import './rail.js?v=__BUILD__'; // الشرائط الأفقية: السحب بالماوس والسهمان على طرفيها
import { posMap, ord } from './pos.js?v=__BUILD__'; // خريطة «موقعها من سلسلتها» والعدد الترتيبي
import { isOpen, setOpen, hides, covered, uncover, marks, markEl, showing, setShowing, drawEye, eyeBtn, cover } from './adult.js?v=__BUILD__'; // فلتر +18 (E65)
const BUILD = '__BUILD__', KEY = 'gamesg.progress', PEND = 'gamesg.pending', PASS = 'gamesg.pass', IGN = 'gamesg.ignored', STEAM = 'gamesg.steam', REM = 'gamesg.removed', ASK = 'gamesg.asked';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
let IMGB = 'https://images.igdb.com/igdb/image/upload/';
const img = (id, t = 'cover_big') => `${IMGB}t_${t}/${id}.jpg`;
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

// ---------- الكلمات
const count = (n, [one, two, few, many, sing]) => { const m = n % 100; return n === 1 ? one : n === 2 ? two : m >= 3 && m <= 10 ? `${n} ${few}` : m >= 11 ? `${n} ${many}` : `${n} ${sing}`; };
const nGames = n => count(n, ['لعبة واحدة', 'لعبتان', 'ألعاب', 'لعبة', 'لعبة']);
const hrs = h => { if (h == null) return ''; if (h < 1) return 'أقل من ساعة'; const r = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10; return Number.isInteger(r) ? count(r, ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة', 'ساعة']) : `${r} ساعة`; };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const dateAr = d => { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MONTHS[m - 1]} ${y}`; };
const monthAr = d => { const [y, m] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const QUART = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
// موعد ما لم يصدر بدقته: يوم محدد، أو شهر، أو ربع، أو سنة، أو لم يُعلن. لا عدّ تنازلي إلا لليوم المحدد
const exact = o => o.prec === 'd' && !!o.date && o.date > today;
const soon = o => o.status === 'upcoming' || o.status === 'tba';
function whenText(o) { const h = String(o.human || '').trim(); let m;
  if (o.prec === 'q' && (m = h.match(/q([1-4])\s+(\d{4})/i))) return `الربع ${QUART[m[1] - 1]} من ${m[2]}`;
  if (o.prec === 'm' && (m = h.match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})/i)) && EN.includes(m[1].toLowerCase())) return `${MONTHS[EN.indexOf(m[1].toLowerCase())]} ${m[2]}`;
  if (o.prec === 'y' && o.date) return `عام ${o.date.slice(0, 4)}`;
  if (o.date && o.prec === 'd') return dateAr(o.date);
  return 'لم يُعلن موعدها'; }
const yearOrWhen = o => soon(o) ? (exact(o) ? dateAr(o.date) : whenText(o)) : o.year || '';

// ---------- المنصات
const ABBR = { ps5: 'PS5', ps4: 'PS4', ps3: 'PS3', ps2: 'PS2', ps1: 'PS1', psp: 'PSP', vita: 'Vita', psvr: 'PS VR', xsx: 'Xbox Series', xone: 'Xbox One', x360: 'Xbox 360', xbox: 'Xbox', switch2: 'Switch 2', switch: 'Switch',
  wiiu: 'Wii U', wii: 'Wii', '3ds': '3DS', nds: 'DS', gcn: 'GameCube', n64: 'N64', snes: 'SNES', nes: 'NES', gba: 'GBA', gbc: 'GBC', gb: 'Game Boy', pc: 'PC', mac: 'Mac', linux: 'Linux', android: 'Android', ios: 'iOS', yt: 'يوتيوب', twitch: 'تويتش', web: 'الإنترنت' };
const FAMN = { ps: 'بلايستيشن', xbox: 'إكس بوكس', nin: 'نينتندو', pc: 'الكمبيوتر', mobile: 'الجوال', other: 'منصات أخرى' };
const WATCH = ['yt', 'twitch', 'web'];
const abbr = c => D.plats[c]?.abbr || ABBR[c] || String(c).toUpperCase();
// منصات اللعبة: ما في سجلها، وما في سجلات IGDB الشقيقة بالاسم نفسه (نسخة الأركيد سجل، ونسخ الأجهزة المنزلية سجل آخر)
const platsOf = g => [...new Set([...(g.plats || []), ...(g.also || [])])];
const famOf = c => D.plats[c]?.fam || (/^(ps|vita|psp)/.test(c) ? 'ps' : /^x/.test(c) ? 'xbox' : /^(switch|wii|3ds|nds|gcn|n64|snes|nes|gb)/.test(c) ? 'nin' : /^(pc|mac|linux)$/.test(c) ? 'pc' : /^(android|ios)$/.test(c) ? 'mobile' : WATCH.includes(c) ? 'web' : 'other');
const FAMBIT = { 1: 'PS', 2: 'Xbox', 4: 'Nintendo', 8: 'PC', 16: 'جوال' };
const famsText = b => Object.entries(FAMBIT).filter(([k]) => b & +k).map(([, v]) => v).join(' · ');

// ---------- القوائم
// t اسم القائمة في القائمة الرئيسية، وact اسم زرها في بطاقة اللعبة: بوظيفته مباشرة («ألعبها الآن»)، واسم القائمة تحته تلميحاً
const LISTS = {
  play: { t: 'متابعة', s: 'تلعبها الآن', act: 'ألعبها الآن', badge: 'تلعبها', ic: 'play', on: 'ألعبها على' },
  new: { t: 'لعبة جديدة', s: 'تنتظر دورها', act: 'سألعبها لاحقاً', badge: 'جديدة', ic: 'star', on: 'سألعبها على' },
  done: { t: 'شارة النهاية', s: 'ختمتها', act: 'ختمتها', badge: 'ختمتها', ic: 'trophy', on: 'ختمتها على' },
  seen: { t: 'وضع المتفرج', s: 'شاهدتها ولم تلعبها', act: 'شاهدتها فقط', badge: 'شاهدتها', ic: 'eye', on: 'شاهدتها على' },
};
const ORDER = ['play', 'new', 'done', 'seen', 'all'];
const TYPES = { remake: 'ريميك', remaster: 'ريماستر', expanded: 'إصدار موسّع', standalone: 'توسعة مستقلة', port: 'منفذ', dlc: 'محتوى إضافي', expansion: 'توسعة', bundle: 'حزمة', episode: 'حلقة', season: 'موسم', mod: 'تعديل', pack: 'حزمة', update: 'تحديث', fork: 'نسخة' };
const XKIND = { film: 'فيلم', films: 'سلسلة أفلام', tv: 'مسلسل', anime: 'أنمي', novel: 'رواية', novels: 'سلسلة روايات', book: 'كتاب', books: 'سلسلة كتب', comic: 'قصص مصورة', manga: 'مانغا', game: 'لعبة', games: 'سلسلة ألعاب', board: 'لعبة لوحية', tabletop: 'لعبة طاولة' };

const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const listBtn = k => `${ic(LISTS[k].ic)}<span><b>${LISTS[k].act}</b><small>في «${LISTS[k].t}»</small></span>`;
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol><symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol><symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" stroke-width="1.4" d="M8 5.5v13l10.5-6.5z"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/></symbol>
<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M7.5 4h9v5a4.5 4.5 0 01-9 0zM7.5 6H5v1.5a3 3 0 003 3M16.5 6H19v1.5a3 3 0 01-3 3M12 13.5v4M8.5 20h7"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></symbol>
<symbol id="i-dots" viewBox="0 0 24 24"><path stroke-width="3" d="M12 5.5h.01M12 12h.01M12 18.5h.01"/></symbol><symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></symbol>
<symbol id="i-pad" viewBox="0 0 24 24"><path d="M7 8.5h10a4 4 0 013.9 4.9l-.8 3.4a2.4 2.4 0 01-4 1.2L14 16h-4l-2.1 2a2.4 2.4 0 01-4-1.2l-.8-3.4A4 4 0 017 8.5zM8.5 11v3M7 12.5h3"/><path stroke-width="2.6" d="M15.5 12h.01M17.5 13.6h.01"/></symbol>
<symbol id="i-roll" viewBox="0 0 24 24"><path d="M4 7.5h3c2 0 3.2 1.2 4.5 4.5s2.5 4.5 4.5 4.5h4M4 16.5h3c1.1 0 1.9-.4 2.7-1.3M20 7.5h-4c-1.1 0-1.9.4-2.7 1.3M17.5 5L20 7.5 17.5 10M17.5 14l2.5 2.5-2.5 2.5"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3.2 3.4 3.2 12.6 0 16M12 4c-3.2 3.4-3.2 12.6 0 16"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l.9 12.5h8.2L17 7M10 11v5M14 11v5"/></symbol>
<symbol id="i-ext" viewBox="0 0 24 24"><path d="M8 16l8-8M9.5 8H16v6.5"/></symbol><symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14L4.5 9.5 9 5M5 9.5h9a5.5 5.5 0 010 11h-3"/></symbol>
</defs></svg>`;

// ---------- البيانات والسجل
const D = { games: [], pool: new Map(), byId: new Map(), series: {}, plats: {}, fr: {}, films: null, built: null, stores: null, subs: null };
let P = { games: {} };
const load = () => { try { P = { games: {}, ...JSON.parse(store.get(KEY) || '{}') }; P.games ||= {}; if (P.dups && typeof P.dups !== 'object') delete P.dups; } catch { P = { games: {} }; } };
load();
const save = () => { P.at = Date.now(); store.set(KEY, JSON.stringify(P)); syncTouch('games'); };
const rec = id => P.games[id] || {};
const lst = id => rec(id).s || 'new';
function setRec(id, patch) { const cur = { ...rec(id), ...patch }; for (const k of Object.keys(cur)) if (cur[k] === '' || cur[k] == null || Number.isNaN(cur[k])) delete cur[k];
  if (Object.keys(cur).length) P.games[id] = cur; else delete P.games[id]; save(); }
const ui = { list: 'all', q: '', plat: '', genre: '', sort: 'list', view: 'grid', ov: 'release', sub: false };
// pool: كل ما عُرف من الألعاب. games وbyId: ما يظهر منها الآن: ألعاب +18 تدخلهما حين يُرفع الفلتر وحده (hides)، وrelist تعيد بناءهما عند التبديل
const admit = g => { if (hides(g) || D.byId.has(g.id)) return false; D.games.push(g); D.byId.set(g.id, g); return true; };
const register = g => { if (D.pool.has(g.id)) return false; D.pool.set(g.id, g); return admit(g); };
function relist() { D.games = []; D.byId.clear(); for (const g of D.pool.values()) admit(g); stale(); }
// العين (site/adult.js) ترفع الفلتر أو تعيده في مكانها، بلا إعادة تحميل: الشبكة والقائمة الرئيسية والقادم والسلاسل والأعداد تُرسم من جديد
function toggleEye() { setOpen(!isOpen()); relist(); drawEye(); if (sheet.open && openId && !D.byId.has(openId)) closeGame();
  if (slotId && !D.byId.has(slotId)) slotId = null; if (tonightId && !D.byId.has(tonightId)) tonightId = null;
  renderGrid(); renderMenu(false); soonHTML(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML();
  toast(isOpen() ? 'رُفع الفلتر: تظهر الألعاب كلها.' : 'عاد الفلتر.'); }
const merge = r => { Object.assign(D.series, r.series || {}); Object.assign(D.plats, r.plats || {}); Object.assign(D.fr, r.franchises || {}); };

document.body.insertAdjacentHTML('beforeend', `${SPRITE}
<header class="top"><a class="home" href="../" aria-label="العودة إلى البوابات">${miniDoor}<span>البوابات</span></a><h1>ألعابي</h1>
  ${eyeBtn()}<button class="btn sec acc" data-act="accounts">${ic('pad')}<span>حساباتي</span></button><button class="btn pri add" data-act="add">${ic('plus')}<span>أضف لعبة</span></button><p class="tally" id="tally"></p></header>
<div class="dupw" id="dup" hidden></div>
<section class="mm" id="mm" aria-label="القائمة الرئيسية"><div class="mm-art" id="mm-art" aria-hidden="true"></div>
  <nav class="mm-menu" id="mm-menu" aria-label="قوائمي"></nav><div class="mm-slot" id="slot"></div></section>
<section class="soon shut" id="soon" hidden aria-label="قادم في سلاسلك"><h2><button type="button" class="soon-b" id="soon-b" data-act="soon" aria-expanded="false" aria-controls="soon-reel"></button></h2><div class="reel" id="soon-reel" hidden></div></section>
<nav class="bar" aria-label="البحث والتصفية"><div class="row"><a class="gate" href="../" aria-label="العودة إلى البوابات" aria-hidden="true" tabindex="-1"><span class="gate-em">${miniDoor}</span><span class="gate-t">البوابات</span></a>
  <label class="search">${ic('search')}<span class="sr">ابحث في ألعابي</span><input id="q" type="search" placeholder="ابحث: لعبة، مطوّر، سلسلة، سنة" autocomplete="off" enterkeyhint="search"></label>
  <div class="tabs" role="group" aria-label="طريقة العرض"><button data-act="view" data-v="grid" aria-pressed="true">الألعاب</button><button data-act="view" data-v="series" aria-pressed="false">السلاسل</button></div></div>
  <div class="chips" id="chips"></div></nav>
<div class="dupw at-list" id="dupbar" hidden></div>
<p class="count" id="count" aria-live="polite"></p>
<main><div class="grid" id="grid"><p class="load">تُحمَّل القائمة…</p></div><div class="series" id="series" hidden></div></main>
<footer class="foot"><p>معلومات الألعاب وأغلفتها من <a href="https://www.igdb.com/" target="_blank" rel="noopener"><bdi dir="ltr">IGDB.com</bdi></a>، والعوالم والاقتباسات والأسماء العربية من <a href="https://www.wikidata.org/" target="_blank" rel="noopener"><bdi dir="ltr">Wikidata</bdi></a>.</p>
  <p><button class="syncb" data-sync-open><span data-sync-label></span></button></p></footer>
<dialog id="sheet" aria-label="بطاقة اللعبة"><button class="close" data-act="close" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="sheet-body"></div></dialog>
<dialog id="add" aria-labelledby="add-h"><button class="close" data-act="close-add" aria-label="إغلاق">${ic('x')}</button>
  <form id="add-form"><h2 id="add-h">أضف لعبة</h2>
  <label for="add-q">اسم اللعبة، بالعربي أو بالإنجليزي (والسنة إن أردت)</label>
  <div class="sugbox"><input id="add-q" dir="auto" placeholder="قود اوف وور، Elden Ring، GTA V…" autocomplete="off" autocapitalize="off" spellcheck="false" required role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="add-sug">
  <ul class="sug" id="add-sug" role="listbox" aria-label="اقتراحات" hidden></ul></div>
  <label class="pass-wrap" id="add-pass-wrap">كلمة السر (تُطلب مرة واحدة على هذا الجهاز)<input id="add-pass" type="password" autocomplete="current-password"></label>
  <button class="btn pri" type="submit">ابحث عنها</button><p class="msg" id="add-msg" aria-live="polite"></p><div class="cands" id="cands"></div>
  <p class="hint">اللعبة تظهر هنا فوراً، وتصل إلى بقية أجهزتك خلال دقائق. سلسلتها وعالمها وما اقتُبس منها تُجلب آلياً من <bdi dir="ltr">IGDB</bdi> و<bdi dir="ltr">Wikidata</bdi>.</p></form></dialog>
<dialog id="acc" aria-labelledby="acc-h"><button class="close" data-act="close-acc" aria-label="إغلاق">${ic('x')}</button><div class="scroll" id="acc-body"></div></dialog>
<dialog id="inbox" aria-labelledby="ib-h"><div class="ib" id="ib"></div></dialog>
<div class="qm" id="qm" role="menu" hidden></div>
<div class="toast" id="toast" role="status"></div>`);
portalBack('games');

// التنبيه العابر يسكن أعلى نافذة مفتوحة: النافذة الحوارية تحجب ما خارجها وتعطّله، فلو بقي في الصفحة لما رُئي ولا لُمس زر «تراجع» فيه والبطاقة مفتوحة
// (أعلاها: آخر ما فُتح منها، فبطاقة الاطلاع تُفتح فوق «أضف لعبة»؛ والتي تُغلق الآن لا تُسكن)
let zN = 0; const showM = d => { d.showModal(); d._z = ++zN; };
const host = () => { const el = $('#toast'), h = $$('#sheet,#add,#acc,#inbox').filter(d => d.open && !d.dataset.out).sort((a, b) => (a._z || 0) - (b._z || 0)).pop() || document.body; if (el.parentNode !== h) h.append(el); };
const toast = (t, undo, ms) => { const el = $('#toast'); host(); el.textContent = t; if (undo) el.append(Object.assign(document.createElement('button'), { textContent: 'تراجع', onclick: () => { el.classList.remove('on', 'act'); el.textContent = ''; undo(); } }));
  el.classList.toggle('act', !!undo); el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => { el.classList.remove('on', 'act'); setTimeout(() => { if (!el.classList.contains('on')) el.textContent = ''; }, 300); }, ms || (undo ? 5000 : 2800)); };
const get = f => fetch(`data/${f}?v=${BUILD}`).then(r => { if (!r.ok) throw new Error(f); return r.json(); });

// ---------- أجزاء البطاقة في الشبكة: غلاف اللعبة كعلبتها، وفوقه شريط المنصة بلونها، وملصق القائمة، ولوحة العدّ لما لم يصدر
// cov: غلاف لعبة +18 لم يُكشف بعد: مصغّرته وحدها مغطاة (cover في adult.js)
const coverImg = (id, sizes, lazy = true, cov = false, hint = '') => !id ? '' : cov ? cover(`<img${lazy ? ' loading="lazy"' : ''} decoding="async" alt="" src="${img(id, 'cover_small')}">`, hint) : `<img${lazy ? ' loading="lazy"' : ''} decoding="async" alt="" src="${img(id)}" srcset="${img(id, 'cover_small')} 90w, ${img(id)} 264w, ${img(id, 'cover_big_2x')} 528w" sizes="${sizes}">`;
const hid = g => !!g.adult && covered(g.id) && !!g.cover;
// بلا غلاف: خرطوشة لعبة عليها اسمها
const cart = o => `<span class="ph" aria-hidden="true"><span class="ph-l"><b dir="ltr">${esc(o.title || '')}</b><small>${esc(soon(o) ? 'قريباً' : o.year || '')}</small></span><i></i></span>`;
function band(g) { const on = rec(g.id).on, p = on && !WATCH.includes(on) ? on : g.plats?.[0]; if (!p) return '';
  const more = on && !WATCH.includes(on) ? 0 : Math.max(0, (g.plats?.length || 0) - 1);
  return `<span class="band f-${famOf(p)}" data-act="open"><b dir="ltr">${esc(abbr(p))}</b>${more ? `<small dir="ltr">+${more}</small>` : ''}</span>`; }
const badge = g => { const s = rec(g.id).s; return s && s !== 'new' ? `<span class="badge b-${s}">${ic(LISTS[s].ic)}<b>${LISTS[s].badge}</b></span>` : ''; };
function chip(o) { if (!soon(o)) return '';
  if (exact(o)) return `<span class="cd" data-until="${o.date}" data-now="تصدر اليوم"><small>تصدر بعد</small><span class="ck" aria-hidden="true">${clock(o.date, 'تصدر اليوم')}</span><span class="sr sr-time">${spoken(o.date)}</span></span>`;
  return `<span class="cd tba"><small>قريباً</small><b>${esc(whenText(o))}</b></span>`; }
const metaLine = g => { const r = rec(g.id), now = Date.now(); return [(g.pc || []).some(x => giftNow(x, now)) ? '<span class="gift">مجانية الآن</span>' : '', soon(g) ? '<span class="up">قادمة</span>' : g.year ? `<span><bdi>${g.year}</bdi></span>` : '', r.h ? `<span>لعبتها ${hrs(r.h)}</span>` : g.ttb?.n && !soon(g) ? `<span>تُختم في ${hrs(g.ttb.n)}</span>` : ''].filter(Boolean).join(''); };
// ختم الاشتراك على الغلاف: مصباح صغير يقول إن اللعبة ضمن Game Pass Ultimate أو PS Plus Deluxe الآن (g.subs من البناء، scripts/lib-subs.mjs)،
// وتمر عليه لمعة كل بضع ثوانٍ، لكل غلاف موعده (--d) فلا تلمع الشبكة كلها معاً. وما يغادر Game Pass قريباً يحيط مصباحه خط متقطع
const SUBN = { gp: 'Game Pass', ps: 'PS Plus' }, subsOf = g => ['gp', 'ps'].filter(k => g.subs?.[k] && !g.subs[k].soon);   // القادمة إلى Game Pass ليست فيه بعد
const lamps = g => subsOf(g).map(k => `<i class="sl-${k}${g.subs[k].out ? ' out' : ''}"><b dir="ltr">${SUBN[k]}</b></i>`).join('');
const subSeal = g => subsOf(g).length ? `<span class="seal" style="--d:${((g.id * 7) % 11) * .55}s" aria-hidden="true">${lamps(g)}</span>` : '';
const subSay = g => { const s = subsOf(g); return s.length ? `، ضمن ${s.map(k => SUBN[k]).join(' و')}${g.subs.gp?.out ? '، وتغادر Game Pass قريباً' : ''}` : ''; };
function card(g) { const s = rec(g.id).s || 'new';
  return `<article class="gc s-${s}${g.fresh ? ' fresh' : ''}" id="g-${g.id}" data-id="${g.id}"${marks(g.id, g.adult)}><div class="case">${band(g)}
<button class="cover${hid(g) ? ' x18' : ''}" data-act="open" ${g.cover && !hid(g) ? `data-zoom-pinch data-zoom-title="${esc(g.title)}" ` : ''}aria-label="افتح بطاقة ${esc(g.title)}${subSay(g)}">${coverImg(g.cover, '(max-width:520px) 45vw, 200px', true, hid(g)) || cart(g)}${badge(g)}${chip(g)}${subSeal(g)}</button></div>
<div class="info"><h3 dir="ltr">${esc(g.title)}</h3><p class="meta">${metaLine(g)}</p><button class="qm-b" data-act="qm" aria-haspopup="menu" aria-label="حالة «${esc(g.title)}» عندي وحذفها">${ic('dots')}</button></div></article>`; }

// ---------- التصفية والترتيب والبحث
const SORTS = { list: ['ترتيب قائمتي', (a, b) => (a.ord ?? -1) - (b.ord ?? -1) || a.title.localeCompare(b.title, 'en')], recent: ['آخر ما حدّثته', (a, b) => (rec(b.id).at || '').localeCompare(rec(a.id).at || '')],
  new: ['الأحدث صدوراً', (a, b) => (b.date || '0').localeCompare(a.date || '0')], old: ['الأقدم صدوراً', (a, b) => (a.date || '9').localeCompare(b.date || '9')],
  rate: ['الأعلى تقييماً', (a, b) => (b.critic || b.users || 0) - (a.critic || a.users || 0)], short: ['الأقصر ختماً', (a, b) => (a.ttb?.n || 9999) - (b.ttb?.n || 9999)], az: ['أبجدياً', (a, b) => a.title.localeCompare(b.title, 'en')] };
const seriesNames = g => (g.series || []).map(id => D.series[id]?.name).filter(Boolean);
const hay = g => g._h ??= ' ' + fold([g.title, g.titleAr, ...(g.alt || []), g.year, ...(g.dev || []), ...(g.pub || []), ...seriesNames(g), g.universe?.en, g.universe?.ar, ...(g.franchises || []).map(id => D.fr[id]?.name)].filter(Boolean).join(' '));
let FP = null, fz = null;
const stale = () => { for (const g of D.games) delete g._h; FP = fz = null; };
const literal = (g, ws) => ws.every(w => hay(g).includes(w));
function fuzzyFor(q) { if (fz?.q === q) return fz; const ws = fold(q).split(' ').filter(Boolean);
  if (!ws.length || D.games.some(g => literal(g, ws))) return fz = { q, ws, ids: null };
  const r = find(FP ??= prepare(D.games, g => [g.title, g.titleAr, ...(g.alt || [])]), q, { limit: 6, min: 55, spread: 8 });
  return fz = { q, ws, ids: new Set(r.hits.map(h => h.id)), meant: r.hits[0] || null }; }
const onPlat = (g, v) => { const [k, x] = v.split(':'), on = rec(g.id).on; return k === 'f' ? [...platsOf(g), on].some(c => c && famOf(c) === x) : platsOf(g).includes(x) || on === x; };
function match(g) { if (ui.dup && DUP) return DUP.has(g.id);   // مراجعة مكرر: مجموعته وحدها، فوق القائمة والتصفية والبحث
  if (ui.list !== 'all' && lst(g.id) !== ui.list) return false;
  if (ui.plat && !onPlat(g, ui.plat)) return false;
  if (ui.genre && !(g.genres || []).includes(ui.genre)) return false;
  if (ui.sub && !subsOf(g).length) return false;
  if (ui.q) { const z = fuzzyFor(ui.q); if (z.ids ? !z.ids.has(g.id) : !literal(g, z.ws)) return false; }
  return true; }
function chipsHTML() { const sel = (k, label, opts) => `<select class="pick${ui[k] ? ' on' : ''}" data-k="${k}" aria-label="${label}"><option value="">${label}</option>${opts}</select>`, op = (v, t) => `<option value="${esc(v)}"${ui.plat === v || ui.genre === v ? ' selected' : ''}>${esc(t)}</option>`;
  const fam = {}, code = {}, genres = {}; for (const g of D.games) { const on = rec(g.id).on, ps = new Set([...platsOf(g), ...(on && !WATCH.includes(on) ? [on] : [])]);
    for (const c of ps) { code[c] = (code[c] || 0) + 1; fam[famOf(c)] = 1; } for (const x of g.genres || []) genres[x] = (genres[x] || 0) + 1; }
  const plats = `<optgroup label="العائلة">${Object.keys(FAMN).filter(f => fam[f]).map(f => op('f:' + f, FAMN[f])).join('')}</optgroup><optgroup label="المنصة">${Object.entries(code).sort((a, b) => b[1] - a[1]).map(([c]) => op('c:' + c, abbr(c))).join('')}</optgroup>`;
  const nSub = D.games.filter(g => subsOf(g).length).length, subf = nSub ? `<button type="button" class="chip subf" data-act="subf" aria-pressed="${ui.sub}"><i aria-hidden="true"></i>في اشتراكاتي<small>${nSub}</small></button>` : '';   // ما تلعبه الليلة بلا ثمن
  return subf + sel('plat', 'المنصة', plats) + sel('genre', 'النوع', Object.entries(genres).sort((a, b) => b[1] - a[1]).map(([x]) => op(x, x)).join(''))
    + `<select class="pick on" data-k="sort" aria-label="الترتيب">${Object.entries(SORTS).map(([k, [t]]) => `<option value="${k}"${ui.sort === k ? ' selected' : ''}>${t}</option>`).join('')}</select>`; }
const filtered = () => ui.plat || ui.genre || ui.q || ui.sub;
function apply(resort) { const grid = $('#grid'); dupTidy();
  if (resort) { const frag = document.createDocumentFragment(); for (const g of [...D.games].sort(SORTS[ui.sort][1])) { const el = document.getElementById('g-' + g.id); if (el) frag.append(el); } grid.append(frag); }
  let shown = 0; for (const g of D.games) { const el = document.getElementById('g-' + g.id); if (!el) continue; const ok = match(g); el.hidden = !ok; if (ok) shown++; }
  let empty = $('.empty', grid); if (!shown && !empty) grid.insertAdjacentHTML('beforeend', `<p class="empty">${emptyText()}</p>`); else if (empty) { if (shown) empty.remove(); else empty.innerHTML = emptyText(); }
  const inList = D.games.filter(g => ui.list === 'all' || lst(g.id) === ui.list).length;
  const z = ui.q && fuzzyFor(ui.q), meant = z?.ids && z.meant ? `هل تقصد <button data-act="meant" data-q="${esc(z.meant.title)}"><bdi>${esc(z.meant.title)}</bdi></button>؟ ` : '';
  $('#count').innerHTML = ui.view === 'series' || ui.dup ? '' : filtered() ? `${meant}يظهر ${shown} من ${inList} <button data-act="reset">أزل التصفية</button>` : '';
  tally(); dupDraw(); }
const emptyText = () => !D.games.length ? 'قائمتك فارغة. أضف أول لعبة، أو اسحب ما لعبته من حساباتك.' : filtered() ? 'لا لعبة تطابق هذه التصفية. جرّب إزالة أحد الشروط.' : ui.list === 'all' ? '' : `لا ألعاب في «${LISTS[ui.list].t}» بعد.`;
function tally() { const n = s => D.games.filter(g => lst(g.id) === s).length, hours = D.games.reduce((a, g) => a + (rec(g.id).h || 0), 0);
  $('#tally').textContent = D.games.length ? [nGames(D.games.length), n('done') && `ختمت ${n('done')}`, n('play') && `تلعب ${n('play')}`, hours && `${hrs(hours)} لعب`].filter(Boolean).join(' · ') : ''; }
function renderGrid() { $('#grid').innerHTML = [...D.games].sort(SORTS[ui.sort][1]).map(card).join(''); $('#chips').innerHTML = chipsHTML(); apply(false); }

// ---------- المكرر: لعبتان في المكتبة بالاسم نفسه (IGDB يفرد لبعض المنصات سجلاً مستقلاً، أو أُضيف بلمسة خاطئة جزء آخر يحمل الاسم نفسه)، أو نسختان من
// لعبة واحدة (منفذ أو ريماستر أو إصدار موسّع ومعه أصله). التنبيه سؤال بجوابين: «نعم» يعرض المجموعة وحدها في الشبكة لتُعدَّل، و«لا» يُسكته عنها نهائياً،
// والإسكات يُزامَن (P.dups، ومفتاح المجموعة أرقام ألعابها مرتبة) فلا يعود على جهاز آخر. ولعبة ثالثة تنضم إلى مجموعة أُسكتت مجموعة جديدة يُنبَّه عنها
const EDN = new Set(['port', 'remaster', 'expanded']);
const ft = g => g._f ??= fold(g.title);
// ما يُعدّ مع اللعبة لعبة واحدة غير الاسم: أصلها إن كانت منفذاً أو ريماستر أو إصداراً موسّعاً منه، والتي هي إصدار منها، ومنافذها وريماستراتها
const kin = g => [g.rel?.version_parent?.id, EDN.has(g.type) && g.rel?.parent_game?.id, ...[].concat(g.rel?.ports || [], g.rel?.remasters || []).map(m => m.id)].filter(Boolean);
const akin = (a, b) => a.id !== b.id && (ft(a) === ft(b) || kin(a).includes(b.id) || kin(b).includes(a.id));
function dupGroups() { const up = new Map(), top = id => { while (up.has(id)) id = up.get(id); return id; }, join = (a, b) => { a = top(a); b = top(b); if (a !== b) up.set(Math.max(a, b), Math.min(a, b)); }, names = new Map();
  for (const g of D.games) { const k = ft(g); if (k) { if (names.has(k)) join(names.get(k), g.id); else names.set(k, g.id); } for (const id of kin(g)) if (D.byId.has(id)) join(g.id, id); }
  const sets = new Map(); for (const g of D.games) { const r = top(g.id); (sets.get(r) || sets.set(r, []).get(r)).push(g); }
  // الأقدم صدوراً أول المجموعة، والمجموعة التي فيها أحدث ما أُضيف أول المجموعات (فالتنبيه عمّا أضفته للتو يسبق غيره)
  return [...sets.values()].filter(l => l.length > 1).map(l => { l.sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || a.id - b.id);
    return { key: l.map(g => g.id).sort((a, b) => a - b).join('-'), games: l, same: new Set(l.map(ft)).size === 1, at: Math.max(...l.map(g => Date.parse(g.at || '') || 0)) }; }).sort((a, b) => b.at - a.at || (a.key < b.key ? -1 : 1)); }
const nVers = n => count(n, ['نسخة واحدة', 'نسختان', 'نسخ', 'نسخة', 'نسخة']), them = d => d.games.length === 2 ? 'هما' : 'ها';
const andAr = l => l.length < 2 ? l.join('') : `${l.slice(0, -1).join('، ')} و${l.at(-1)}`;
const stack = l => `<span class="dup-st" aria-hidden="true">${l.slice(0, 2).map(g => `<i>${g.cover ? `<img alt="" src="${img(g.cover, 'cover_small')}">` : ''}</i>`).join('')}</span>`;
// «لعبتان بالاسم نفسه» وتحتها الاسم في سطره وسنتاهما (2007 و2023: تقولان من أول نظرة إنهما سجلّان لا سجل واحد). وللنسخ: «نسختان من لعبة واحدة» وتحتها كل اسم في سطره بسنته
const dupWhat = d => d.same ? `${nGames(d.games.length)} بالاسم نفسه` : `${nVers(d.games.length)} من لعبة واحدة`;
function dupNames(d) { const ys = [...new Set(d.games.map(g => g.year).filter(Boolean))], nm = g => `<bdi dir="ltr">${esc(g.title)}</bdi>`, yr = l => l.length ? ` <small>(${andAr(l.map(y => `<bdi>${y}</bdi>`))})</small>` : '';
  return `<p class="dup-n">${d.same ? nm(d.games[0]) + (ys.length > 1 ? yr(ys) : '') : d.games.map(g => `<span>${nm(g)}${yr(g.year ? [g.year] : [])}</span>`).join('')}</p>`; }
const dupAsk = (d, more) => `<section class="dup" aria-label="تنبيه: ألعاب تبدو مكررة">${stack(d.games)}<div class="dup-x"><h2>في مكتبتك ${dupWhat(d)}</h2>${dupNames(d)}
<p>هل تريد تعديل${them(d)}؟${more ? ` <small>وبعده ${count(more, ['تنبيه آخر', 'تنبيهان آخران', 'تنبيهات أخرى', 'تنبيهاً آخر', 'تنبيه آخر'])}.</small>` : ''}</p></div>
<div class="dup-a"><button type="button" class="btn pri" data-act="dup-go" data-k="${d.key}">نعم، اعرض${them(d)}</button><button type="button" class="btn sec" data-act="dup-no" data-k="${d.key}">لا، أبقِ${them(d)}</button></div></section>`;
const dupRev = d => `<section class="dup rev" aria-label="مراجعة ألعاب تبدو مكررة">${stack(d.games)}<div class="dup-x"><h2>مراجعة: ${dupWhat(d)}</h2>${dupNames(d)}
<p>احذف ما لا تريده من زر ${ic('dots')} تحت غلافه أو من بطاقته، أو أبقِ${them(d)} معاً.</p></div>
<div class="dup-a"><button type="button" class="btn sec" data-act="dup-no" data-k="${d.key}">أبقِ${them(d)} معاً</button><button type="button" class="btn sec" data-act="dup-back">رجوع إلى قائمتي</button></div></section>`;
// سطر يفرّق بين التوأمين: السنة ونوع السجل والمنصة وحالتها عندك
const dupMeta = g => { const r = rec(g.id), all = platsOf(g), p = r.on ? [r.on] : all.slice(0, 2), more = r.on ? 0 : all.length - p.length;
  return [g.year && `<bdi>${g.year}</bdi>`, TYPES[g.type], p.length && `<bdi>${p.map(c => esc(abbr(c))).join(' · ')}${more > 0 ? ` +${more}` : ''}</bdi>`, `في «${LISTS[lst(g.id)].t}»`, r.h && hrs(r.h)].filter(Boolean).map(x => `<span>${x}</span>`).join(''); };
// في بطاقة اللعبة: توأمها في المكتبة بزر يفتح بطاقته (والبطاقة تُفتح لحظة الإضافة، فيُرى التنبيه فوراً). وفي بطاقة الاطلاع (pv): ما في المكتبة بهذا الاسم، قبل أن تُضاف
function twinHTML(g, pv) { const d = pv ? null : dupGroups().find(x => x.games.includes(g)), o = pv ? D.games.filter(x => akin(g, x)) : d && !P.dups?.[d.key] ? d.games.filter(x => x !== g) : []; if (!o.length) return '';
  const same = o.every(x => ft(x) === ft(g)), n = o.length, noun = same ? count(n, pv ? ['لعبة', 'لعبتان', 'ألعاب', 'لعبة', 'لعبة'] : ['لعبة أخرى', 'لعبتان أخريان', 'ألعاب أخرى', 'لعبة أخرى', 'لعبة أخرى'])
    : count(n, pv ? ['نسخة', 'نسختان', 'نسخ', 'نسخة', 'نسخة'] : ['نسخة أخرى', 'نسختان أخريان', 'نسخ أخرى', 'نسخة أخرى', 'نسخة أخرى']);
  return `<div class="twin" role="note"><p class="twin-t">في مكتبتك ${noun} ${same ? (pv ? 'بهذا الاسم' : 'بالاسم نفسه') : 'من هذه اللعبة'}</p>
${o.map(x => `<button type="button" class="twin-g" data-act="open" data-id="${x.id}"><span class="th">${x.cover ? `<img loading="lazy" alt="" src="${img(x.cover, 'cover_small')}">` : ''}</span><span class="t"><b dir="ltr">${esc(x.title)}</b><small>${dupMeta(x)}</small></span><span class="go">افتح بطاقتها</span></button>`).join('')}
${d ? `<button type="button" class="twin-no" data-act="dup-no" data-k="${d.key}">أبقِ${them(d)} معاً</button>` : ''}</div>`; }
let DUP = null, dupAll = [], dupSpot = 'top';
// قبل كل تصفية: المجموعات كما هي الآن. ومراجعة انحلّت مجموعتها (حُذفت إحدى لعبتيها هنا أو من جهاز آخر) تنتهي وحدها
function dupTidy() { dupAll = dupGroups(); const cur = ui.dup && dupAll.find(d => d.key === ui.dup); if (!cur) ui.dup = null; DUP = cur ? new Set(cur.games.map(g => g.id)) : null; }
// التنبيه فوق القائمة الرئيسية عند فتح الصفحة، وفوق الشبكة منذ أول «نعم» (فما بعده يُسأل عنه حيث ينظر صاحبه). لا يُعاد رسمه إلا إن تغيّر
function dupDraw() { const open = dupAll.filter(d => !P.dups?.[d.key]), cur = ui.dup && dupAll.find(d => d.key === ui.dup), ask = !cur && open.length ? dupAsk(open[0], open.length - 1) : '';
  const put = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; el.hidden = !h; } };
  put($('#dup'), dupSpot === 'top' ? ask : ''); put($('#dupbar'), cur ? dupRev(cur) : dupSpot === 'list' ? ask : ''); }
const redrawSave = () => { const sv = $('#sheet-body .save:not(.pv)'), g = D.byId.get(openId); if (sv && g) sv.outerHTML = saveHTML(g); };
function dupGo(k) { if (!dupGroups().some(d => d.key === k)) return; if (ui.view !== 'grid') setView('grid'); ui.dup = k; dupSpot = 'list'; apply(false);
  $('#dupbar').scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }); $('#grid .gc:not([hidden]) .cover')?.focus({ preventScroll: true }); }
function dupNo(k) { const d = dupGroups().find(x => x.key === k); if (!d) return; (P.dups ||= {})[k] = 1; save(); if (ui.dup === k) ui.dup = null; apply(false); redrawSave();
  toast(`لن يظهر التنبيه عن${them(d)} ثانية`, () => { if (P.dups) delete P.dups[k]; save(); apply(false); redrawSave(); }); }
// لعبة أُضيفت للتو: لا يخفيها بعد التحديث حذف سابق لها من هذا الجهاز، ولا يُسكت عنها إسكات قديم (حُذفت ثم أُعيدت بلمسة خاطئة، فالمكرر جديد)
function renew(id) { const m = removedMap(); if (m[id]) { delete m[id]; store.set(REM, JSON.stringify(m)); } for (const k of Object.keys(P.dups || {})) if (k.split('-').includes(String(id))) delete P.dups[k]; }

// ---------- القائمة الرئيسية: القوائم الأربع كقائمة لعبة، وبجانبها «ملف الحفظ» المختار: آخر ما تلعبه، أو اقتراح الليلة، أو آخر ما ختمته
// «مزاجك الليلة»: نوع أو أكثر، يُقدَّم ما يجمعها كلها ثم ما يجمع أكثرها (كما في الأفلام). لمسة تضيف ولمسة ترفع، و«أي نوع» يرفعها كلها
let tonightId = null, moods = (store.get('games.mood') || '').split('|').filter(Boolean), slotId = null;
const fits = (gs, ms) => ms.filter(m => gs.includes(m)).length;
// أنواع اللعبة في سطر الاقتراح: ما اخترته من المزاج أولاً (فيظهر ما جمعته منه)، ثم غيره حتى نوعين، وثلاثة إن جمعت ثلاثة مما اخترت
const moodFirst = gs => { const hit = gs.filter(x => moods.includes(x)); return [...hit, ...gs.filter(x => !moods.includes(x))].slice(0, Math.min(3, Math.max(2, hit.length))); };
const inL = s => D.games.filter(g => lst(g.id) === s);
const byAt = list => [...list].sort((a, b) => (rec(b.id).at || '').localeCompare(rec(a.id).at || '') || (b.ord ?? 0) - (a.ord ?? 0));
const tonightOk = g => !g.adult && lst(g.id) === 'new' && !soon(g) && g.status !== 'cancelled';   // والاقتراح لا يختار لعبة +18
function menuHTML() { return ORDER.map(k => { const n = k === 'all' ? D.games.length : inL(k).length, L = LISTS[k];
  return `<button type="button" class="mi m-${k}" data-act="list" data-v="${k}" aria-pressed="${ui.list === k}"><span class="cur" aria-hidden="true">${ic('play')}</span><span class="mt"><b>${k === 'all' ? 'كل الألعاب' : L.t}</b><small>${k === 'all' ? 'قائمتك كاملة' : L.s}</small></span><i class="n">${n}</i></button>`; }).join(''); }
function moodHTML() { const n = {}; for (const g of D.games) if (tonightOk(g)) for (const x of g.genres || []) n[x] = (n[x] || 0) + 1; moods = moods.filter(m => n[m]);
  const all = D.games.filter(tonightOk).length, c = (v, t, k) => `<button type="button" class="chip" data-act="mood" data-g="${esc(v)}" aria-pressed="${String(v ? moods.includes(v) : !moods.length)}">${esc(t)}<small>${k}</small></button>`;
  const best = moods.length >= 2 ? fits(D.byId.get(tonightId)?.genres || [], moods) : 0;
  return all < 2 ? '' : `<div class="mood" role="group" aria-label="مزاجك الليلة"><span class="mood-l">مزاجك الليلة</span><div class="mood-c" data-drag>${c('', 'أي نوع', all)}${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([x, k]) => c(x, x, k)).join('')}</div></div>
${moods.length >= 2 ? `<p class="mood-hint">${best === moods.length ? `لعبة تجمع ${moods.map(esc).join(' و')}.` : best ? `لا لعبة في قائمتك تجمعها كلها، فهذه أقربها: تجمع ${best} من ${moods.length}.` : 'لا لعبة في قائمتك من هذه الأنواع.'}</p>` : ''}`; }
function pickTonight(fresh) { const ok = g => tonightOk(g), all = D.games.filter(ok);
  let best = 0; for (const g of all) best = Math.max(best, fits(g.genres || [], moods)); const good = g => ok(g) && (!moods.length || !best || fits(g.genres || [], moods) === best);
  const pool = all.filter(g => good(g) && g.id !== tonightId);
  if (!fresh && tonightId && good(D.byId.get(tonightId) || {})) return D.byId.get(tonightId);
  const from = pool.length ? pool : all.filter(good); if (!from.length) return null;
  const strong = from.filter(g => (g.critic || g.users || 0) >= 80), list = strong.length >= 4 ? strong : from, g = list[Math.floor(Math.random() * list.length)]; tonightId = g.id; return g; }
function featured() { const k = ui.list; if (!D.games.length) return null;
  if (k === 'new') return pickTonight(false); if (k === 'all') return D.byId.get(slotId) || byAt(D.games.filter(g => !g.adult && (g.art || g.cover)))[0] || D.games[0];
  return byAt(inL(k))[0] || null; }
function slotHTML(g) { const k = ui.list, r = g ? rec(g.id) : {};
  if (!D.games.length) return `<p class="lbl">ابدأ من هنا</p><h2>قائمتك فارغة</h2><p class="meta">أضف لعبة بالبحث عنها، أو اسحب ما لعبته من حساباتك في Steam وPlayStation وXbox وأجيبك عن كل لعبة: ختمتها؟ تلعبها؟ أم لاحقاً؟</p>
<div class="acts"><button class="btn pri" data-act="add">${ic('plus')}أضف لعبة</button><button class="btn sec" data-act="accounts">${ic('pad')}اسحب من حساباتي</button></div>`;
  if (!g) return `<p class="lbl">${k === 'new' ? 'ماذا ألعب الليلة؟' : LISTS[k].t}</p><h2>${k === 'play' ? 'لا شيء تلعبه الآن' : k === 'done' ? 'لم تختم لعبة بعد' : k === 'seen' ? 'لم تشاهد لعبة بعد' : 'لا ألعاب تنتظر'}</h2>
<p class="meta">${k === 'new' ? 'ما في «لعبة جديدة» صدر كله وختمته، أو لا شيء فيه بهذا المزاج.' : 'انقل إليها لعبة من بطاقتها، أو من زر ⋮ تحت غلافها.'}</p>${k === 'new' ? moodHTML() : ''}`;
  const plat = r.on ? abbr(r.on) : '', lbl = { play: 'تابع من حيث توقفت', new: 'ماذا ألعب الليلة؟', done: 'آخر شارة نهاية', seen: 'آخر ما شاهدته', all: 'من قائمتك' }[k];
  const line = k === 'play' ? [plat && `على ${plat}`, r.h && `لعبتها ${hrs(r.h)}`, g.ttb?.n && `تُختم في ${hrs(g.ttb.n)}`] : k === 'done' ? [plat && `على ${plat}`, r.at && monthAr(r.at), r.h && hrs(r.h)]
    : k === 'seen' ? [plat && `عند ${plat}`, r.at && monthAr(r.at)] : [g.year, moodFirst(g.genres || []).join('، '), g.ttb?.n && `تُختم في ${hrs(g.ttb.n)}`, (g.critic || g.users) && `التقييم ${g.critic || g.users}`];
  const stats = k === 'done' ? (() => { const d = inL('done'), h = d.reduce((a, x) => a + (rec(x.id).h || 0), 0); return `<p class="stat">ختمت ${nGames(d.length)}${h ? ` في ${hrs(h)}` : ''}</p>`; })() : '';
  const acts = { play: `<button class="btn sec" data-act="quick" data-id="${g.id}" data-v="done">${ic('trophy')}ختمتها!</button>`, new: `<button class="btn sec" data-act="reroll">${ic('roll')}اقتراح آخر</button><button class="btn sec" data-act="quick" data-id="${g.id}" data-v="play">${ic('play')}سألعبها الآن</button>`,
    seen: `<button class="btn sec" data-act="quick" data-id="${g.id}" data-v="new">${ic('star')}سألعبها بنفسي</button>`, done: '', all: `<button class="btn sec" data-act="shuffle">${ic('roll')}لعبة أخرى</button>` }[k];
  return `<p class="lbl">${lbl}</p><h2 dir="ltr">${esc(g.title)}</h2>${g.titleAr ? `<p class="ar">${esc(g.titleAr)}</p>` : ''}<p class="meta">${line.filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</p>${stats}
<div class="acts"><button class="btn pri" data-act="open" data-id="${g.id}">افتح بطاقتها</button>${acts}</div>${k === 'new' ? moodHTML() : ''}`; }
let artFor = null;
function renderMenu(swap) { $('#mm-menu').innerHTML = menuHTML(); const g = featured(); slotId = g?.id ?? null; const slot = $('#slot'); slot.innerHTML = slotHTML(g);
  $('#mm').dataset.list = ui.list;
  if (swap && !calm) { slot.classList.remove('swap'); void slot.offsetWidth; slot.classList.add('swap'); }
  const src = g && !g.adult ? (g.art ? img(g.art, innerWidth * devicePixelRatio > 1400 ? '1080p' : '720p') : g.shots?.[0] ? img(g.shots[0], '720p') : g.cover ? img(g.cover, 'cover_big_2x') : null) : null;
  if (src === artFor) return; artFor = src; const box = $('#mm-art'), old = box.querySelector('img:not(.out)');
  if (!src) { old?.classList.add('out'); setTimeout(() => old?.remove(), 600); return; }
  const im = new Image(); im.alt = ''; im.decoding = 'async'; im.className = g.art || g.shots?.[0] ? '' : 'soft'; im.src = src;
  im.onload = () => { if (artFor !== src) return; box.append(im); requestAnimationFrame(() => { im.classList.add('in'); if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 700); } }); }; }
function setList(k, focus) { ui.list = k; store.set('games.list', k); $$('#mm-menu .mi').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === k))); renderMenu(true); apply(false);
  if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); if (focus) $(`#mm-menu .mi[data-v="${k}"]`)?.focus(); }

// ---------- قادم في سلاسلك: الأجزاء المعلنة التي لم تصدر من سلاسل ألعابك، وألعابك القادمة، بعدّها التنازلي.
// القسم مصغَّر إلى سطر واحد (عددها، وأقربها بعدّه) ما لم يفتحه صاحبه بزرّه («افتحها» ثم «صغّرها»)، واختياره يُحفظ على الجهاز. وشريطه لا يُرسم ولا تُحمَّل أغلفته وهو مصغَّر
let soonOpen = store.get('games.soon') === 'open';
function upcoming() { const out = new Map();
  for (const g of D.games) { if (soon(g)) out.set(g.id, g); for (const sid of g.series || []) for (const m of D.series[sid]?.members || []) if (soon(m) && m.status !== 'cancelled' && !out.has(m.id)) out.set(m.id, D.byId.get(m.id) || m); }
  return [...out.values()].sort((a, b) => (exact(b) - exact(a)) || (a.date || '9999').localeCompare(b.date || '9999')); }
function soonHTML() { const list = upcoming(), box = $('#soon'), btn = $('#soon-b'), reel = $('#soon-reel'), o = list[0]; box.hidden = !list.length; if (!o) return;
  // أقربها: المؤرَّخة بعدّها الحي (أيامه، ثم ساعاته في يومها الأخير)، وغير المؤرَّخة بموعدها التقريبي
  const near = exact(o) ? `<span class="sb-cd" data-until="${o.date}" data-now="تصدر اليوم"><small>تصدر بعد</small><span class="ck" aria-hidden="true">${clock(o.date, 'تصدر اليوم')}</span><span class="sr sr-time">${spoken(o.date)}</span></span>` : `<span class="sb-cd tba">${esc(whenText(o))}</span>`;
  btn.innerHTML = `<span class="sb-t">قادم في سلاسلك</span><span class="sb-n">${list.length}</span><span class="sb-near"><small>أقربها</small><b dir="ltr">${esc(o.title)}</b>${near}</span><span class="sb-go"><span>${soonOpen ? 'صغّرها' : 'افتحها'}</span>${ic('chev')}</span>`;
  btn.setAttribute('aria-expanded', String(soonOpen)); box.classList.toggle('shut', !soonOpen); reel.hidden = !soonOpen;
  reel.innerHTML = !soonOpen ? '' : list.map(o => { const mine = D.byId.has(o.id);
    return `<button class="part${mine ? '' : ' out'}" data-act="${mine ? 'open' : 'peek'}" data-id="${o.id}" data-q="${esc(o.title)}"${marks(o.id, o.adult)}><span class="p">${coverImg(o.cover, '150px') || cart(o)}${chip(o)}</span><b dir="ltr">${esc(o.title)}</b><small>${mine ? 'في قائمتك' : 'من سلسلة ' + esc(seriesOfMember(o.id)?.name || '')}</small></button>`; }).join(''); }
function soonFlip() { soonOpen = !soonOpen; store.set('games.soon', soonOpen ? 'open' : 'shut'); soonHTML();
  if (soonOpen && !calm) $('#soon-reel').animate?.([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
const seriesOfMember = id => Object.values(D.series).find(s => s.members.some(m => m.id === id) && s.members.some(m => D.byId.has(m.id)));

// ---------- السلاسل
function groups() { const ids = new Set(); for (const g of D.games) for (const s of g.series || []) if (D.series[s]) ids.add(s);
  return [...ids].map(id => ({ id, ...D.series[id] })).sort((a, b) => a.name.localeCompare(b.name, 'en')); }
function seriesHTML() { const q = ui.q && fold(ui.q), gs = groups().filter(s => !q || fold(s.name).includes(q) || s.members.some(m => fold(m.title).includes(q)));
  if (!gs.length) return `<p class="empty">${D.games.length ? 'لا سلسلة تطابق البحث، أو لا سلاسل لألعابك بعد.' : 'أضف ألعاباً لترى سلاسلها هنا.'}</p>`;
  return gs.map(s => { const mine = s.members.filter(m => D.byId.has(m.id)), done = mine.filter(m => lst(m.id) === 'done').length;
    return `<section class="fr"><header><h3 dir="ltr">${esc(s.name)}</h3><span>${nGames(s.members.length)}${s.size > s.members.length ? ' رئيسية' : ''} · ${mine.length} في قائمتك${done ? ` · ختمت ${done}` : ''}${s.story ? ' · لها ترتيب قصة رسمي' : ''}</span></header>
<div class="reel">${s.members.map((m, i) => { const g = D.byId.get(m.id); return `<button class="part${g ? ' s-' + lst(m.id) : ' out'}" data-act="${g ? 'open' : 'peek'}" data-id="${m.id}" data-q="${esc(m.title)}${m.year ? ' ' + m.year : ''}">
<span class="p">${coverImg(m.cover, '118px') || cart(m)}<span class="n">${i + 1}</span>${g ? badge(g) : ''}${chip(m)}</span><b dir="ltr">${esc(m.title)}</b><small>${[TYPES[m.type], yearOrWhen(m), g ? '' : 'خارج قائمتك'].filter(Boolean).map(esc).join(' · ')}</small></button>`; }).join('')}</div></section>`; }).join(''); }
function setView(v) { ui.view = v; $$('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('#grid').hidden = v !== 'grid'; $('#series').hidden = v !== 'series'; $('#chips').hidden = v !== 'grid';
  if (v === 'series') $('#series').innerHTML = seriesHTML(); apply(false); }

// ---------- بطاقة اللعبة
const sheet = $('#sheet'), addDlg = $('#add'), accDlg = $('#acc'), ibDlg = $('#inbox');
let openId = null;
const ext = (name, url, sub = '') => `<a href="${esc(url)}" target="_blank" rel="noopener"><b dir="ltr">${esc(name)}</b>${sub ? `<small>${sub}</small>` : ''}</a>`;
function saveHTML(g) { const r = rec(g.id), s = r.s || 'new', opts = s === 'seen' ? WATCH : [...new Set([...platsOf(g), ...(r.on && !WATCH.includes(r.on) ? [r.on] : [])])];
  return `<section class="save" aria-labelledby="save-h">${twinHTML(g)}<h3 id="save-h">حالتها عندي</h3><div class="lists" role="radiogroup" aria-label="حالتها عندي">${['play', 'new', 'done', 'seen'].map(k => `<button type="button" role="radio" class="li m-${k}" data-act="set" data-v="${k}" aria-checked="${s === k}">${listBtn(k)}</button>`).join('')}</div>
${opts.length ? `<div class="q"><b>${LISTS[s].on}</b><div class="pl" role="radiogroup" aria-label="${LISTS[s].on}">${opts.map(c => `<button type="button" role="radio" class="pc f-${famOf(c)}" data-act="on" data-v="${c}" aria-checked="${r.on === c}"><bdi dir="${WATCH.includes(c) ? 'rtl' : 'ltr'}">${esc(abbr(c))}</bdi></button>`).join('')}</div></div>` : ''}
${s === 'done' || s === 'play' ? `<div class="q more"><label>${s === 'done' ? 'متى ختمتها؟' : 'بدأتها في'}<input type="month" data-k="at" value="${r.at ? r.at.slice(0, 7) : ''}" max="${today.slice(0, 7)}"></label><label>كم ساعة لعبتها؟<input type="number" data-k="h" min="0" max="99999" step="1" inputmode="numeric" value="${r.h ?? ''}" placeholder="${g.ttb?.n ? Math.round(g.ttb.n) : ''}"></label></div>` : ''}
<div class="rm"><button type="button" class="rm-b" data-act="rm-ask">${ic('trash')}احذفها من مكتبتي</button></div></section>`; }
// الحذف بتأكيد في مكانه (بلا نوافذ المتصفح): يقول ما سيحدث، ويطلب كلمة السر إن لم تُحفظ على هذا الجهاز
const rmAsk = g => `<p>تُحذف <bdi dir="ltr">«${esc(g.title)}»</bdi> من قوائمك كلها وعلى كل أجهزتك. ويمكنك إضافتها من جديد متى شئت.</p>${pass() ? '' : '<label class="pass-wrap">كلمة السر<input class="rm-pass" type="password" autocomplete="current-password"></label>'}
<div class="acts"><button type="button" class="btn danger" data-act="rm-go" data-id="${g.id}">${ic('trash')}احذفها</button><button type="button" class="btn sec" data-act="rm-no">تراجع</button></div><p class="msg" aria-live="polite"></p>`;
function board(o) { if (!soon(o)) return '';
  if (exact(o)) return `<section class="sec"><h3>موعد الصدور</h3><div class="board" data-until="${o.date}" data-now="تصدر اليوم"><p class="b-k">تصدر بعد</p><span class="ck" aria-hidden="true">${clock(o.date, 'تصدر اليوم')}</span><span class="sr sr-time">${spoken(o.date)}</span>
<p class="note">تصدر في <bdi>${dateAr(o.date)}</bdi> حسب <bdi dir="ltr">IGDB</bdi>، والموعد قابل للتغيير.</p></div></section>`;
  return `<section class="sec"><h3>موعد الصدور</h3><div class="board tba"><p class="b-k">قريباً</p><b class="b-w">${esc(whenText(o))}</b><p class="note">${o.prec && o.prec !== 'tbd' ? 'أُعلن موعدها تقريبياً، فلا عدّ تنازلي حتى يُحدَّد يومها.' : 'معلنة، ولم يُحدَّد موعد صدورها بعد.'} المصدر <bdi dir="ltr">IGDB</bdi>.</p></div></section>`; }
function ttbHTML(g) { const t = g.ttb, mine = rec(g.id).h; if (!t || !(t.h || t.n || t.c)) return '';
  const max = Math.max(t.h || 0, t.n || 0, t.c || 0, mine || 0), bar = (k, label, v) => v ? `<li class="t-${k}"><span>${label}</span><i style="--w:${(v / max * 100).toFixed(1)}%"></i><b>${hrs(v)}</b></li>` : '';
  return `<section class="sec"><h3>كم تأخذ لتختمها</h3><ul class="ttb">${bar('h', 'القصة بسرعة', t.h)}${bar('n', 'القصة بتأنٍّ', t.n)}${bar('c', 'كل شيء فيها', t.c)}${mine ? bar('m', 'لعبتها أنت', mine) : ''}</ul>
<p class="note">متوسطات لاعبي <bdi dir="ltr">IGDB</bdi>${t.count ? ` من ${t.count} إجابة` : ''}. وللتفصيل: ${ext('HowLongToBeat', 'https://howlongtobeat.com/?q=' + encodeURIComponent(g.title))}</p></section>`; }
function orderRow(m, i, here) { const g = D.byId.get(m.id), s = g ? lst(m.id) : '';
  return `<li data-n="${i + 1}" class="${[m.id === here ? 'here' : '', g ? 's-' + s : 'out'].join(' ')}"><span class="th">${m.cover ? `<img loading="lazy" alt="" src="${img(m.cover, 'cover_small')}">` : ''}</span>
<span class="t"><b dir="ltr">${esc(m.title)}</b><small>${[TYPES[m.type], yearOrWhen(m), PK[g?.place?.k]].filter(Boolean).map(esc).join(' · ')}</small></span><span class="st">${g ? (s === 'new' ? 'في قائمتك' : esc(LISTS[s].badge)) : 'خارج قائمتك'}${exact(m) ? `<i class="cd-mini" data-until="${m.date}" data-now="اليوم"><span class="ck" aria-hidden="true">${clock(m.date, 'اليوم')}</span></i>` : ''}</span>
${m.id === here ? '' : `<button class="go" data-act="${g ? 'open' : 'peek'}" data-id="${m.id}" data-q="${esc(m.title)}${m.year ? ' ' + m.year : ''}" aria-label="${g ? 'افتح' : 'اعرض'} ${esc(m.title)}"></button>`}</li>`; }
function seriesSec(g) { const list = (g.series || []).map(id => ({ id, ...D.series[id] })).filter(s => s.members?.length);
  const uni = g.universe ? `<p class="uni">تجري أحداثها في عالم <b>${g.universe.ar ? esc(g.universe.ar) : `<bdi dir="ltr">${esc(g.universe.en)}</bdi>`}</b>${g.universe.ar && g.universe.en ? ` <bdi dir="ltr">(${esc(g.universe.en)})</bdi>` : ''}، حسب ${ext('Wikidata', 'https://www.wikidata.org/wiki/' + g.universe.q)}.</p>` : '';
  const fr = (g.franchises || []).map(id => D.fr[id]).filter(f => f && !list.some(s => s.name === f.name)).map(f => `<bdi dir="ltr">${esc(f.name)}</bdi>${f.size > 1 ? ` (${nGames(f.size)})` : ''}`);
  if (!list.length) return uni || fr.length ? `<section class="sec"><h3>السلسلة والعالم</h3>${uni}${fr.length ? `<p class="uni">من امتياز ${fr.join('، ')}.</p>` : ''}<p>لعبة مستقلة: لا سلسلة لها في <bdi dir="ltr">IGDB</bdi>.</p></section>` : `<section class="sec"><h3>السلسلة</h3><p>لعبة مستقلة: لا سلسلة لها في <bdi dir="ltr">IGDB</bdi>.</p></section>`;
  return list.map(s => { const story = s.story?.order.map(id => s.members.find(m => m.id === id)).filter(Boolean), diff = story && story.some((m, i) => m.id !== s.members.filter(x => story.includes(x))[i]?.id);
    const tab = (v, t, rec) => `<button data-act="ordv" data-v="${v}" aria-pressed="${ui.ov === v}">${t}${rec ? '<small>يوصي به صنّاعها</small>' : ''}</button>`;
    const body = story ? `<div class="ordv" role="group" aria-label="ترتيب العرض">${tab('release', 'ترتيب الصدور')}${tab('story', 'ترتيب القصة', true)}</div>
<ol class="order" data-ov="release"${ui.ov === 'release' ? '' : ' hidden'}>${s.members.map((m, i) => orderRow(m, i, g.id)).join('')}</ol><ol class="order" data-ov="story"${ui.ov === 'story' ? '' : ' hidden'}>${story.map((m, i) => orderRow(m, i, g.id)).join('')}</ol>
<p class="note">${esc(s.story.note || (diff ? 'ترتيب أحداث القصة كما يوصي به صنّاع السلسلة.' : ''))}${s.story.src?.length ? ` المصدر: ${s.story.src.map(x => ext(x.name, x.url)).join('، ')}.` : ''}</p>`
      : `<ol class="order">${s.members.map((m, i) => orderRow(m, i, g.id)).join('')}</ol><p class="note">الأجزاء الرئيسية بترتيب صدورها من <bdi dir="ltr">IGDB</bdi>${s.size > s.members.length ? '، بلا الإضافات والحزم والمنافذ' : ''}، والمعلن الذي لم يصدر في آخرها. لا نعرف ترتيب قصة يوصي به صنّاعها لهذه السلسلة؛ إن وُجد بمصدر رسمي أُضيف هنا.</p>`;
    return `<section class="sec"><h3>السلسلة: <bdi dir="ltr">${esc(s.name)}</bdi></h3>${uni}${fr.length ? `<p class="uni">من امتياز ${fr.join('، ')}.</p>` : ''}${body}</section>`; }).join(''); }
const REL = [['parent_game', 'اللعبة الأصل'], ['version_parent', 'اللعبة الأصل'], ['remakes', 'إعادة صنعها'], ['remasters', 'إعادة إصدارها'], ['expansions', 'توسعات'], ['standalone_expansions', 'توسعات مستقلة'], ['dlcs', 'محتوى إضافي'], ['ports', 'منافذ لمنصات أخرى']];
function relSec(g) { const r = g.rel || {}, rows = REL.filter(([k]) => r[k]).map(([k, t]) => { const list = Array.isArray(r[k]) ? r[k] : [r[k]];
  return `<div class="relg"><b>${t}</b><div class="reel">${list.map(m => { const own = D.byId.get(m.id); return `<button class="part${own ? '' : ' out'}" data-act="${own ? 'open' : 'peek'}" data-id="${m.id}" data-q="${esc(m.title)}"><span class="p">${coverImg(m.cover, '100px') || cart(m)}${chip(m)}</span><b dir="ltr">${esc(m.title)}</b><small>${esc(yearOrWhen(m))}</small></button>`; }).join('')}</div></div>`; }).join('');
  return rows ? `<section class="sec"><h3>إضافاتها وإصداراتها الأخرى</h3>${rows}</section>` : ''; }
function adaptSec(g) { if (!g.from?.length && !g.into?.length) return '';
  const item = (w, dir) => { const name = w.ar || w.en, film = w.tmdb && D.films?.has(w.tmdb), sub = [XKIND[w.kind], w.year].filter(Boolean).join(' · ');
    const link = film ? `<a class="xl in" href="../films/#${w.tmdb}">في قائمة أفلامي</a>` : w.tmdb ? `<a class="xl" href="https://www.themoviedb.org/${w.tmdb[0] === 't' ? 'tv' : 'movie'}/${w.tmdb.slice(1)}" target="_blank" rel="noopener">TMDB</a><a class="xl" href="../films/#add=${encodeURIComponent((w.en || w.ar) + (w.year ? ' ' + w.year : ''))}">أضفه إلى أفلامي</a>`
      : `<a class="xl" href="https://www.wikidata.org/wiki/${w.q}" target="_blank" rel="noopener">Wikidata</a>`;
    return `<li class="${dir}"><span><b${w.ar ? '' : ' dir="ltr"'}>${esc(name)}</b>${w.ar && w.en ? `<bdi dir="ltr">${esc(w.en)}</bdi>` : ''}<small>${esc(sub)}</small></span><span class="xls">${link}</span></li>`; };
  return `<section class="sec"><h3>اقتباسات</h3>${g.from?.length ? `<p class="kh">اقتُبست اللعبة من</p><ul class="adapt">${g.from.map(w => item(w, 'from')).join('')}</ul>` : ''}${g.into?.length ? `<p class="kh">اقتُبس منها</p><ul class="adapt">${g.into.map(w => item(w, 'into')).join('')}</ul>` : ''}
<p class="note">العلاقات من ${ext('Wikidata', 'https://www.wikidata.org/wiki/' + g.wd)}، وما فيها من أفلام ومسلسلات موصول ببوابة أفلامي.</p></section>`; }
function platsSec(g) { if (!g.plats?.length) return ''; const at = new Map((g.dates || []).map(d => [d.p, d]));
  return `<section class="sec"><h3>المنصات</h3><ul class="pls">${g.plats.map(c => { const d = at.get(c), when = d ? (precOfHuman(d.human) === 'd' && d.date ? dateAr(d.date) : d.human ? esc(d.human) : '') : '';
    return `<li class="f-${famOf(c)}"><b dir="ltr">${esc(abbr(c))}</b>${when ? `<small>${when}</small>` : ''}</li>`; }).join('')}</ul>${g.also?.length ? `<p class="note">ولها نسخ بالاسم نفسه على <bdi dir="ltr">${g.also.map(c => esc(abbr(c))).join(' · ')}</bdi>، في سجلات أخرى من <bdi dir="ltr">IGDB</bdi>.</p>` : ''}</section>`; }
// ---------- أين تُلعب على الكمبيوتر، وهل هي مجانية الآن. الصفوف من البناء (g.pc، scripts/lib-stores.mjs): متاجرها ومشغّلاتها، وكل صف يحمل حاله
// (free: مجانية اللعب أو هدية لمدة، pass: ضمن PC Game Pass، off: ليست في متجر السعودية، gone: لا تُباع فيه الآن). ما أُضيف للتو وبطاقة الاطلاع بلا g.pc: متاجرها من روابط IGDB وحدها
const STN = { steam: 'Steam', epic: 'Epic Games Store', gog: 'GOG', xbox: 'Xbox', battlenet: 'Battle.net', ea: 'EA app', ubi: 'Ubisoft Connect', rockstar: 'Rockstar Games Launcher', itch: 'itch.io' }, PCS = ['steam', 'epic', 'gog'], LAUNCH = ['battlenet', 'ea', 'ubi', 'rockstar'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const dayAr = iso => { const d = new Date(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const clockAr = iso => { const d = new Date(iso), h = d.getHours(), m = d.getMinutes(); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'ص' : 'م'}`; };
const onPc = g => !!(g.plats?.includes('pc') || g.also?.includes('pc'));
const giftNow = (r, now) => r.free === 'gift' && (!r.from || Date.parse(r.from) <= now) && (!r.until || now < Date.parse(r.until));
const giftSoon = (r, now) => r.free === 'gift' && !!r.from && Date.parse(r.from) > now;
const pcRows = g => { if (g.pc) return g.pc; const site = t => g.sites?.find(x => x.t === t)?.url, a = [];
  if (g.ext?.steam) a.push({ s: 'steam', u: 'https://store.steampowered.com/app/' + g.ext.steam }); for (const t of ['epic', 'gog']) if (site(t)) a.push({ s: t, u: site(t) }); return a; };
const stName = r => r.n || STN[r.s] || r.s;
function pcSec(g) { if (!g.plats?.length) return '';
  if (!onPc(g)) return '<section class="sec pcsec"><h3>أين تلعبها على الكمبيوتر</h3><p class="note">لم تصدر على الكمبيوتر. منصاتها أعلاه.</p></section>';
  const rows = pcRows(g), built = !!g.pc, now = Date.now(), free = rows.filter(r => giftNow(r, now)), soon = rows.filter(r => !giftNow(r, now) && giftSoon(r, now)), names = l => l.map(r => `<bdi dir="ltr">${esc(stName(r))}</bdi>`).join(' و');
  if (!rows.length) return `<section class="sec pcsec"><h3>أين تلعبها على الكمبيوتر</h3><p class="note">${built ? 'لم نجد لها صفحة في متاجر الكمبيوتر الآن. قد تكون أُزيلت من البيع.' : 'متاجرها على الكمبيوتر تُفحص في البناء القادم.'}</p></section>`;
  const head = !built ? '' : free.length ? `<p class="pcf on">مجانية الآن على ${names(free)}${free[0].until ? `، حتى ${dayAr(free[0].until)} الساعة ${clockAr(free[0].until)}` : ''}.</p>`
    : g.f2p ? '<p class="pcf on">مجانية اللعب: تُحمَّل وتُلعب بلا ثمن.</p>'
    : soon.length ? `<p class="pcf soon">ليست مجانية الآن، وتصير مجانية على ${names(soon)} من ${dayAr(soon[0].from)}${soon[0].until ? ` إلى ${dayAr(soon[0].until)}` : ''}.</p>`
    : rows.some(r => ['steam', 'epic', 'gog', 'xbox'].includes(r.s)) ? '<p class="pcf">ليست مجانية الآن.</p>' : '';
  const tile = r => { const [k, t] = giftNow(r, now) ? ['free', r.until ? `مجانية الآن حتى ${dayAr(r.until)}` : 'مجانية الآن'] : giftSoon(r, now) ? ['soon', `مجانية من ${dayAr(r.from)}`] : r.off ? ['off', 'ليست في متجر السعودية'] : r.gone ? ['off', 'لا تُباع فيه الآن']
      : r.free === 'f2p' || (g.f2p && !r.pass) ? ['free', 'مجانية اللعب'] : r.pass ? ['pass', `ضمن <bdi dir="ltr">PC Game Pass</bdi>`] : ['', r.s === 'xbox' ? '<bdi dir="ltr">Microsoft Store</bdi>' : LAUNCH.includes(r.s) || r.s === 'other' ? 'مشغّل الناشر' : 'المتجر'];
    return `<a class="st${k ? ' ' + k : ''}" data-s="${esc(r.s)}" href="${esc(r.u)}" target="_blank" rel="noopener"><b dir="ltr">${esc(stName(r))}</b><small>${t}</small></a>`; };
  const at = D.stores?.at ? new Date(D.stores.at) : null, fresh = at ? ` آخر فحص: ${dayAr(at)} الساعة ${clockAr(at)}.` : '';
  // مصدر لم يُجب في آخر فحص: حاله في البطاقة من الفحص الذي قبله، ويقال ذلك
  const FAIL = { steam: 'Steam', epic: 'Epic Games Store', gog: 'GOG', 'gog-search': 'GOG', microsoft: 'Xbox', gamepass: 'Xbox', 'gamepass-titles': 'Xbox' }, down = [...new Set((D.stores?.failed || []).map(k => FAIL[k]).filter(Boolean))];
  const stale = down.length ? ` تعذّر فيه الوصول إلى ${down.map(n => `<bdi dir="ltr">${n}</bdi>`).join(' و')}، فحاله هنا من الفحص الذي قبله.` : '';
  return `<section class="sec pcsec"><h3>أين تلعبها على الكمبيوتر</h3>${head}<div class="links pcs">${rows.map(tile).join('')}</div>
<p class="note">${built ? `المجانية تُفحص كل يوم في <bdi dir="ltr">Steam</bdi> و<bdi dir="ltr">Epic Games Store</bdi> و<bdi dir="ltr">GOG</bdi> و<bdi dir="ltr">Xbox</bdi> بأسعار متجر السعودية.${fresh}${stale}` : 'المتاجر من روابط <bdi dir="ltr">IGDB</bdi>. المجانية وبقية المشغّلات تُفحص في البناء القادم.'}</p></section>`; }
// ---------- في اشتراكاتك: Game Pass Ultimate وPS Plus Deluxe، وهما اشتراكا صاحب الموقع وأعلى فئتين في السعودية. g.subs من البناء (scripts/lib-subs.mjs):
// gp: { on: ['xbox', 'pc'], u, ea?: عبر EA Play, out?: تغادره قريباً, soon?: قادمة إليه, n?: اسمها فيه } وps: { k: 'extra' | 'ubi' | 'deluxe' | 'month', on: […], u, n? }.
// بطاقتان مضيئتان لما هي ضمنه، وخافتتان لما ليست فيه، مع السبب (ليست ضمنه الآن، أو لم تصدر على منصاته). ما أُضيف للتو يُفحص في البناء القادم
const PSK = { extra: 'في كتالوج الألعاب', ubi: 'في كلاسيكيات <bdi dir="ltr">Ubisoft+</bdi>', deluxe: 'في الكلاسيكيات', month: 'من ألعاب الشهر: أضفها إلى مكتبتك قبل أن ينتهي شهرها' };
const ONN = { xbox: 'Xbox', pc: 'الكمبيوتر', ps5: 'PS5', ps4: 'PS4', ps3: 'PS3', ps2: 'PS2', ps1: 'PS1', psp: 'PSP', vita: 'PS Vita', psvr: 'PS VR', psvr2: 'PS VR2' };
function subsSec(g, pv) { if (pv || !g.plats?.length) return '';
  const fams = new Set([...g.plats, ...(g.also || [])].map(famOf)), checked = !!D.subs && g.src !== 'added', s = g.subs || {};
  const on = l => andAr(l.map(c => c === 'pc' ? ONN.pc : `<bdi dir="ltr">${esc(ONN[c] || c)}</bdi>`));
  const how = (k, r) => [k === 'gp' ? [r.on.length ? `تلعبها على ${on(r.on)}` : '', r.ea ? 'عبر <bdi dir="ltr">EA Play</bdi> المضمّن فيه' : ''].filter(Boolean).join(' ') : [PSK[r.k] || '', r.on.length ? `على ${on(r.on)}` : ''].filter(Boolean).join('، '),
    r.n ? `واسمها فيه <bdi dir="ltr">${esc(r.n)}</bdi>` : ''].filter(Boolean).join('. ');
  const mem = (k, title, r, off) => r ? `<a class="mem mem-${k} ${r.soon ? 'soon' : 'on'}" href="${esc(r.u)}" target="_blank" rel="noopener"><span class="mn"><i aria-hidden="true"></i><bdi dir="ltr">${title}</bdi></span><strong>${r.soon ? 'تصل إليه قريباً' : r.out ? 'ضمن اشتراكك، وتغادره قريباً' : 'ضمن اشتراكك الآن'}</strong>${how(k, r) ? `<small>${how(k, r)}.</small>` : ''}</a>`
    : `<div class="mem mem-${k}"><span class="mn"><i aria-hidden="true"></i><bdi dir="ltr">${title}</bdi></span><strong>${off}</strong></div>`;
  const gpOff = !checked ? 'يُفحص في البناء القادم' : fams.has('xbox') || fams.has('pc') ? 'ليست ضمنه الآن' : 'لم تصدر على Xbox ولا الكمبيوتر';
  const psOff = !checked ? 'يُفحص في البناء القادم' : fams.has('ps') ? 'ليست ضمنه الآن' : 'لم تصدر على PlayStation';
  const at = D.subs?.at ? new Date(D.subs.at) : null, FAIL = { gamepass: 'Game Pass', 'gamepass-titles': 'Game Pass', psplus: 'PS Plus' }, down = [...new Set((D.subs?.failed || []).map(k => FAIL[k]).filter(Boolean))];
  const note = checked ? `يُفحص كل يوم في كتالوجَي <bdi dir="ltr">Game Pass</bdi> و<bdi dir="ltr">PS Plus</bdi> لمتجر السعودية.${at ? ` آخر فحص: ${dayAr(at)} الساعة ${clockAr(at)}.` : ''}${down.length ? ` تعذّر فيه الوصول إلى ${down.map(n => `<bdi dir="ltr">${n}</bdi>`).join(' و')}، فحاله هنا من الفحص الذي قبله.` : ''}`
    : 'أُضيفت للتو، فاشتراكاتها تُفحص في البناء القادم.';
  return `<section class="sec subsec"><h3>في اشتراكاتك</h3><div class="mems">${mem('gp', 'Game Pass Ultimate', s.gp, gpOff)}${mem('ps', 'PS Plus Deluxe', s.ps, psOff)}</div><p class="note">${note}</p></section>`; }
const precOfHuman = h => { h = String(h || '').trim(); return !h ? null : /^tb[ad]$/i.test(h) ? 'tbd' : /^q[1-4]\s+\d{4}$/i.test(h) ? 'q' : /^\d{4}$/.test(h) ? 'y' : /^[a-z]{3,}\.?\s+\d{4}$/i.test(h) ? 'm' : 'd'; };
function mediaSec(g) { const shots = (g.shots || []).slice(0, 8), vids = g.videos || []; if (!shots.length && !vids.length) return '';
  return `<section class="sec"><h3>من داخل اللعبة</h3>${shots.length ? `<div class="reel shots" data-zoom-set>${shots.map((s, i) => `<button type="button" class="shot" data-zoom="${img(s, '1080p')}" data-zoom-title="${esc(g.title)}" aria-label="كبّر اللقطة ${i + 1}"><img loading="lazy" decoding="async" alt="" src="${img(s, 'screenshot_med')}" srcset="${img(s, 'screenshot_med')} 569w, ${img(s, 'screenshot_big')} 889w" sizes="260px"></button>`).join('')}</div>` : ''}
${vids.length ? `<div class="links vids">${vids.map(v => ext(v.name || 'Trailer', 'https://www.youtube.com/watch?v=' + v.id, 'عرض على يوتيوب')).join('')}</div>` : ''}</section>`; }
const SITEN = { steam: ['Steam', 'المتجر'], psstore: ['PlayStation Store', 'المتجر'], xstore: ['Microsoft Store', 'المتجر'], eshop: ['Nintendo eShop', 'المتجر'], epic: ['Epic Games', 'المتجر'], gog: ['GOG', 'المتجر'], appstore: ['App Store', 'المتجر'], gplay: ['Google Play', 'المتجر'], wiki: ['Wikipedia', 'الموسوعة'], official: ['الموقع الرسمي', ''] };
function linksSec(g) { const a = [], q = encodeURIComponent(g.title);
  if (g.igdb) a.push(ext('IGDB', g.igdb, 'مصدر البيانات'));
  const pc = onPc(g);   // متاجر الكمبيوتر (Steam وEpic وGOG) في قسم «أين تلعبها على الكمبيوتر» فوق، فلا تتكرر هنا
  if (!pc && g.ext?.steam && !g.sites?.some(s => s.t === 'steam')) a.push(ext('Steam', 'https://store.steampowered.com/app/' + g.ext.steam, 'المتجر'));
  for (const s of g.sites || []) { const n = SITEN[s.t]; if (n && !(pc && PCS.includes(s.t))) a.push(`<a href="${esc(s.url)}" target="_blank" rel="noopener"><b${s.t === 'official' ? '' : ' dir="ltr"'}>${n[0]}</b>${n[1] ? `<small>${n[1]}</small>` : ''}</a>`); }
  a.push(ext('YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + ' full game walkthrough no commentary')}`, 'تختيم كامل بلا تعليق'));
  a.push(ext('HowLongToBeat', 'https://howlongtobeat.com/?q=' + q, 'مدة الختم بالتفصيل'));
  return `<section class="sec"><h3>صفحتها في المواقع</h3><div class="links">${a.join('')}</div></section>`; }
// pv: بطاقة اطلاع للعبة ليست في القائمة (من IGDB مباشرة): معلوماتها كاملة، وبدل ملف الحفظ «أضفها إلى…»
async function sheetHTML(g, pv) { if (g.from?.some(w => w.tmdb) || g.into?.some(w => w.tmdb)) await filmsReady();
  const art = g.art || g.shots?.[0], facts = [TYPES[g.type], soon(g) ? (exact(g) ? 'قادمة' : whenText(g)) : g.year && `<bdi>${g.year}</bdi>`, g.early && 'وصول مبكر', g.dev?.length && `<bdi dir="ltr">${esc(g.dev.slice(0, 2).join(', '))}</bdi>`,
    g.critic && `<span class="rate">النقاد <bdi>${g.critic}</bdi></span>`, g.users && `<span class="rate">اللاعبون <bdi>${g.users}</bdi></span>`, g.status === 'cancelled' && 'أُلغيت'].filter(Boolean);
  const story = aboutSec(g, pv ? {} : (await texts())[g.id] || {}, pv);
  return `<div class="sh-hero">${art ? `<img alt="" src="${img(art, '720p')}" srcset="${img(art, '720p')} 1280w, ${img(art, '1080p')} 1920w" sizes="(max-width:900px) 100vw, 900px">` : ''}</div>
<div class="sh-head">${hid(g) ? `<button type="button" class="cover x18" data-act="bare" data-id="${g.id}" aria-label="أظهر غلاف ${esc(g.title)}">${coverImg(g.cover, '180px', false, true, 'اضغط لإظهاره')}</button>`
  : g.cover ? `<button type="button" class="cover" data-zoom="${img(g.cover, '1080p')}" data-zoom-title="${esc(g.title)}" aria-label="كبّر غلاف ${esc(g.title)}">${coverImg(g.cover, '180px', false)}</button>` : `<div class="cover">${cart(g)}</div>`}
<div class="txt"><h2 dir="ltr">${esc(g.title)}</h2>${g.titleAr ? `<p class="ar">${esc(g.titleAr)}</p>` : ''}<p class="facts">${facts.map(x => `<span>${x}</span>`).join('')}</p><div class="tags">${(g.genres || []).map(x => `<span>${esc(x)}</span>`).join('')}${(g.modes || []).slice(0, 2).map(x => `<span class="m">${esc(x)}</span>`).join('')}</div>${!pv && subsOf(g).length ? `<p class="seal inl">${lamps(g)}<span>ضمن اشتراكك: تلعبها بلا ثمن${g.subs.gp?.out ? '، وتغادر <bdi dir="ltr">Game Pass</bdi> قريباً' : ''}</span></p>` : ''}</div></div>
${g.adult ? '' : chainHTML(g)}${pv ? `<section class="save pv">${twinHTML(g, true)}<h3>أضفها إلى مكتبتي</h3><div class="lists">${['play', 'new', 'done', 'seen'].map(k => `<button type="button" class="li m-${k}" data-act="pv-add" data-v="${k}" data-igdb="${g.id}">${listBtn(k)}</button>`).join('')}</div><p class="note">ليست في قائمتك. هذه بطاقة للاطلاع، ومعلوماتها آلية من <bdi dir="ltr">IGDB</bdi>.</p></section>` : saveHTML(g)}
${g.adult ? '<section class="sec about"><h3>عن اللعبة</h3><p class="note">نبذة هذه اللعبة ولقطاتها لا تُعرض هنا ولا تُترجم. تجدها في صفحتها على <bdi dir="ltr">IGDB</bdi> أدناه.</p></section>' : g.src === 'added' ? '<section class="sec"><p class="ask">أُضيفت بزر «أضف لعبة»: معلوماتها آلية من <bdi dir="ltr">IGDB</bdi>، وعالمها واقتباساتها تكتمل في البناء القادم.</p></section>' : ''}
${board(g)}${placeSec(g)}${story}${ttbHTML(g)}${seriesSec(g)}${relSec(g)}${adaptSec(g)}${platsSec(g)}${subsSec(g, pv)}${pcSec(g)}${mediaSec(g)}${linksSec(g)}`; }
// ---------- عن اللعبة. النصوص الطويلة (النبذة والقصة بلغتيهما) في ملف مستقل يُجلب مرة واحدة (ويُسبق جلبه بعد الإقلاع)، وما أُضيف للتو نصه في سجله.
// المترجَم يُعرض بالعربية وتحته الأصل الإنجليزي لمن أراده؛ وغير المترجَم بالإنجليزية مع زر «ترجمها لي» يوصل الطلب إلى المترجم (فرع requests في المستودع).
// لا مرور آلي للمترجم (قرار صاحب الموقع): الطلبات تنتظر حتى يقول «ترجم الجديد»، فتُترجم بدورة docs/GAMES-CARE.md
let TXP = null; const texts = () => TXP ??= get('texts.json').then(j => j.texts || {}).catch(() => ({}));
const askedMap = () => { try { const m = JSON.parse(store.get(ASK) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
const paras = (s, f) => String(s || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(f).join('');
const enP = x => paras(x, p => `<p dir="ltr" lang="en" class="en">${esc(p)}</p>`), arP = x => paras(x, p => `<p class="ar-t">${ar(p)}</p>`);
// part: نبذتها مترجمة وبقيت قصتها (IGDB أضاف القصة بعد ترجمة النبذة مثلاً)، فالزر والملاحظة يقولان ما بقي بعينه
const trBox = (id, part) => askedMap()[id] ? `<p class="tr-ok">${ic('check')}<span>وصل طلب ترجمتها وهو ينتظر. قل لـ<bdi dir="ltr">Claude</bdi> «ترجم الجديد» فتُترجم، وتظهر هنا بالعربية.</span></p>`
  : `<button type="button" class="btn sec" data-act="tr-ask">${ic('globe')}${part ? 'ترجم لي قصتها' : 'ترجمها لي'}</button><p class="note">${part ? 'نبذتها مترجمة، وقصتها ما زالت بالإنجليزية كما في <bdi dir="ltr">IGDB</bdi>.' : 'نبذتها بالإنجليزية كما في <bdi dir="ltr">IGDB</bdi>، ولم تُترجم بعد.'}</p>`;
function aboutSec(g, T, pv) { const s = T.s || g.summary || '', t = T.t || g.story || '', sa = T.sa || '', ta = T.ta || ''; if (!s && !t) return '';
  const full = (sa || !s) && (ta || !t); if (full && askedMap()[g.id]) { const m = askedMap(); delete m[g.id]; store.set(ASK, JSON.stringify(m)); }
  const body = `${sa ? arP(sa) : enP(s)}${t ? `<details class="more-t"><summary>القصة</summary>${ta ? arP(ta) : enP(t)}</details>` : ''}`;
  const foot = pv ? `<p class="note">النبذة من <bdi dir="ltr">IGDB</bdi> بالإنجليزية كما هي.</p>`
    : full ? `<details class="orig"><summary>النص الأصلي بالإنجليزية</summary>${enP(s)}${t ? `<p class="kh">القصة</p>${enP(t)}` : ''}</details><p class="note">ترجمتنا عن نبذتها في <bdi dir="ltr">IGDB</bdi>.</p>`
    : `<div class="tr" data-id="${g.id}" data-t="${esc(g.title)}">${trBox(g.id, !!(sa || ta))}</div>`;
  return `<section class="sec about"><h3>عن اللعبة</h3>${body}${foot}</section>`; }
async function askTr(btn) { const box = btn.closest('.tr'), id = +box.dataset.id, pw = box.querySelector('.tr-pass')?.value || pass(), label = btn.innerHTML;
  if (!pw) { if (!box.querySelector('.tr-pass')) { box.innerHTML = `<label class="pass-wrap">كلمة السر (كلمة سر «أضف لعبة»)<input class="tr-pass" type="password" autocomplete="current-password"></label><button type="button" class="btn sec" data-act="tr-ask">${ic('globe')}ترجمها لي</button><p class="msg" aria-live="polite"></p>`; }
    else box.querySelector('.msg').textContent = 'اكتب كلمة السر أولاً.'; box.querySelector('.tr-pass').focus(); return; }
  btn.disabled = true; btn.textContent = 'يُرسل الطلب…';
  try { await api('/api/add-game', { action: 'ask', igdb: id, title: box.dataset.t || '' }, pw); if (!pass()) remember(pw);
    const m = askedMap(); m[id] = Date.now(); store.set(ASK, JSON.stringify(m)); box.innerHTML = trBox(id);
  } catch (e) { btn.disabled = false; btn.innerHTML = label; const msg = box.querySelector('.msg'); if (msg) msg.textContent = e.message; else toast(e.message); } }

// ---------- موقع اللعبة من أحداث عالمها (data/games/places.json، مكتوب لكل لعبة): نوعه بلونه، وجملته، ومسار «قبلها ← هذه اللعبة ← بعدها» كمسار
// مراحل (ما كان منها في سلسلتها يُفتح بلمسة)، وزمن الأحداث ومكانها
const PK = { first: 'بداية الحكاية', sequel: 'تكملة', prequel: 'قبل الأحداث', between: 'بين جزأين', parallel: 'أحداث متزامنة', side: 'قصة جانبية', alone: 'قصة مستقلة', reboot: 'بداية جديدة', remake: 'إعادة صنع',
  same: 'الأحداث نفسها', alt: 'عالم بديل', retell: 'تروي الأصل', nostory: 'بلا حكاية متصلة', bundle: 'مجموعة أجزاء' };
const sameTitle = (a, b) => fold(a) === fold(b);
// لعبة باسمها من سلسلة اللعبة أو من القائمة. «God of War (2018)»: السنة بين قوسين تميّز بين جزأين بالاسم نفسه.
// IGDB يفرد لنسخة الأركيد ونسخة المنزل سجلّين بالاسم نفسه أحياناً: المملوكة أولى
const byTitle = (g, t) => { const members = (g.series || []).flatMap(id => D.series[id]?.members || []), m = String(t || '').match(/^(.*?)\s*\((\d{4})\)$/), name = m ? m[1] : t,
  ok = x => sameTitle(x.title, name) && (!m || x.year === +m[2]), hits = t ? [...members, ...D.games].filter(ok) : [];
  return hits.find(x => D.byId.has(x.id)) || hits[0]; };
// ---------- سطر موقعها تحت العنوان، لتعرف وأنت في البطاقة أين تقع: نوع موقعها من الأحداث وما قبلها وما بعدها (places.json)، أو أصلها إن كانت
// ريميك أو ريماستر أو توسعة، ثم رقمها في سلسلتها بترتيب الصدور وبترتيب القصة إن اختلف. كل اسم فيه يفتح بطاقته، والتفصيل في «موقعها من أحداث عالمها» أسفل
const CHAIN = { sequel: (a, b) => [a && `لأحداث ${a}`, b && `وتليها ${b}`], first: (a, b) => [b && `تليها ${b}`], prequel: (a, b) => [b && `أحداثها تسبق ${b}`],
  between: (a, b) => [a && b ? `${a} و${b}` : a ? `بعد ${a}` : b && `قبل ${b}`], side: (a, b) => [a && `بعد ${a}`, b && `وتليها ${b}`], parallel: a => [a && `مع ${a}`],
  alt: (a, b) => [b && `تليها ${b}`], reboot: () => ['لا تحتاج ما قبلها'], alone: () => ['لا تحتاج ما قبلها'], remake: (a, b, p) => [p && `للعبة ${p}`], same: (a, b, p) => [p && `التي في ${p}`] };
const OFTYPE = { remake: 'للعبة', remaster: 'للعبة', standalone: 'للعبة', dlc: 'للعبة', expansion: 'للعبة', expanded: 'من', port: 'من' };
const chainLink = (m, t) => m ? `<button type="button" class="ch-l" data-act="${D.byId.has(m.id) ? 'open' : 'peek'}" data-id="${m.id}" data-q="${esc(m.title)}${m.year ? ' ' + m.year : ''}" dir="ltr">${esc(t || m.title)}</button>` : `<bdi dir="ltr">${esc(t)}</bdi>`;
// الخريطة فوقها (site/pos.js): أجزاء سلسلتها بترتيب الصدور، وما ختمته أو شاهدته ممتلئ، وموضعها نقطة مضيئة. واللعبة التي لا موقع مكتوب لها تُعرَّف
// برقمها بين أجزاء سلسلتها وما صدر قبلها وبعدها، والتي لا سلسلة لها ولا أصل لافتتها «لعبة منفردة» (E58)
function chainHTML(g) { const p = g.place, k = p && PK[p.k] ? p.k : null, par = g.rel?.parent_game || g.rel?.version_parent;
  const P = par && chainLink(par, par.title + (par.year && par.year !== g.year ? ` (${par.year})` : '')), A = p?.after && chainLink(byTitle(g, p.after), p.after), B = p?.before && chainLink(byTitle(g, p.before), p.before);
  const s = (g.series || []).map(id => D.series[id]).find(x => x?.members?.some(m => m.id === g.id)), i = s ? s.members.findIndex(m => m.id === g.id) : -1, j = s?.story?.order?.indexOf(g.id) ?? -1, M = s?.members || [];
  const solo = i < 0 && !par && (!k || k === 'alone' || k === 'nostory'), out = m => m.status && m.status !== 'released' ? ' (لم تصدر بعد)' : '';
  const [label, bits] = solo ? ['لعبة منفردة', ['قائمة بذاتها: لا سلسلة لها ولا أجزاء أخرى']] : k ? [PK[k], (CHAIN[k] || (() => []))(A, B, P)] : OFTYPE[g.type] && par ? [TYPES[g.type], [`${OFTYPE[g.type]} ${P}`]]
    : i >= 0 && M.length > 1 ? [`الجزء ${i < 99 ? ord(i + 1) : i + 1}`, i === 0 ? ['أول أجزاء السلسلة صدوراً', M[1] && `وتليها ${chainLink(M[1])}${out(M[1])}`] : [`صدرت بعد ${chainLink(M[i - 1])}`, M[i + 1] ? `وقبل ${chainLink(M[i + 1])}${out(M[i + 1])}` : 'وهي آخر أجزائها حتى الآن']] : [null, []];
  const pos = i < 0 ? '' : `رقمها في سلسلة <bdi dir="ltr">${esc(s.name)}</bdi>: ${i + 1} من ${M.length} بترتيب الصدور${j >= 0 && j !== i ? `، و${j + 1} بترتيب القصة` : ''}`;
  const text = bits.filter(Boolean).map((t, n) => n ? t : t.replace(/^و/, '')); if (!label && !pos) return '';
  const map = solo ? posMap({ solo: true }) : i >= 0 && M.length > 1 ? posMap({ n: M.length, at: i, done: x => ['done', 'seen'].includes(lst(M[x].id)) }) : '';
  return `<nav class="chain${solo ? ' k-alone solo' : k ? ' k-' + k : ''}" aria-label="موقعها من سلسلتها">${map}${label ? `<p class="ch-m"><b class="ch-k">${label}</b>${text.length ? `<span>${text.join(' · ')}</span>` : ''}</p>` : ''}${pos ? `<p class="ch-n">${pos}</p>` : ''}</nav>`; }
function placeSec(g) { const p = g.place; if (!p || !PK[p.k]) return '';
  const find1 = t => byTitle(g, t);
  const stop = (cls, label, title) => { const m = cls === 'here' ? null : find1(title), own = m && D.byId.has(m.id), inner = `<small>${label}</small><b dir="ltr">${esc(title)}</b>`;
    return `<li class="${cls}">${cls === 'here' ? '<i aria-hidden="true"></i>' : ''}${m ? `<button type="button" data-act="${own ? 'open' : 'peek'}" data-id="${m.id}" data-q="${esc(m.title)}${m.year ? ' ' + m.year : ''}">${inner}</button>` : `<span>${inner}</span>`}</li>`; };
  const track = p.after || p.before ? `<ol class="pl-track" aria-label="موضعها بين ما قبلها وما بعدها في الأحداث">${p.after ? stop('was', 'قبلها في الأحداث', p.after) : ''}${stop('here', 'هذه اللعبة', g.title)}${p.before ? stop('next', 'بعدها في الأحداث', p.before) : ''}</ol>` : '';
  const facts = [p.when && `<span><small>زمن الأحداث</small><b>${ar(p.when)}</b></span>`, p.where && `<span><small>مكانها</small><b>${ar(p.where)}</b></span>`].filter(Boolean).join('');
  const src = p.src === 'igdb' ? `<p class="note">عن وصفها الرسمي في <bdi dir="ltr">IGDB</bdi>.</p>` : Array.isArray(p.src) ? `<p class="note">المصدر: ${p.src.map(x => ext(x.name, x.url)).join('، ')}.</p>` : '';
  return `<section class="sec place k-${p.k}"><h3>موقعها من أحداث عالمها</h3><div class="pl-card"><p class="pl-k"><i aria-hidden="true"></i>${PK[p.k]}</p><p class="pl-line">${ar(p.line)}</p>${track}${facts ? `<p class="pl-facts">${facts}</p>` : ''}${src}</div></section>`; }
const filmsReady = () => D.filmsReady ??= fetch(`../films/data/films.json?v=${BUILD}`).then(r => r.ok ? r.json() : { films: [] }).then(j => { D.films = new Set((j.films || []).map(f => f.id)); }).catch(() => { D.films = new Set(); });
async function openGame(id, push = true) { const g = D.byId.get(+id); if (!g) return; openId = g.id; pvOpen = 0; markEl($('#sheet-body'), g.id, g.adult); $('#sheet-body').innerHTML = await sheetHTML(g); $('#sheet-body').scrollTop = 0; showSheet(push ? { game: g.id } : null, '#g' + g.id); }
function showSheet(state, hash) { if (!sheet.open) { showM(sheet); $('#sheet-body').scrollTop = 0;   // بعد العرض: المتصفح يعيد للنافذة موضع تمرير البطاقة السابقة حين تُعرض، وتصفيره وهي مخفية لا يؤثر
    if (!calm) sheet.animate(innerWidth <= 640 ? { transform: ['translateY(6%)', 'none'], opacity: [0, 1] } : { transform: ['scale(.97)', 'none'], opacity: [0, 1] }, { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    setTimeout(host, calm ? 0 : 260);   // تنبيه عابر سبق فتح البطاقة (كـ«أُضيفت…») يصعد إليها بعد أن تستقر حركتها
    if (state) history.pushState(state, '', hash || location.pathname + location.search); } else if (state) history.replaceState(state, '', hash || location.pathname + location.search); }
const redrawSheet = () => { if (!sheet.open) return; if (openId) openGame(openId, false); else if (pvOpen) peek(pvOpen); };
function closeGame(fromPop) { if (!sheet.open) return; openId = null; pvOpen = 0; sheet.dataset.out = '1'; const done = () => sheet.close();   // out: تُغلق الآن، فلا يسكنها تنبيه عابر
  if (calm) done(); else { const a = sheet.animate({ opacity: [1, 0], transform: ['none', innerWidth <= 640 ? 'translateY(5%)' : 'scale(.98)'] }, { duration: 160, easing: 'ease-in' }); a.onfinish = done; setTimeout(done, 300); }
  if (!fromPop && history.state?.game) history.back(); else if (!fromPop && location.hash) history.replaceState(null, '', location.pathname + location.search); }
addEventListener('popstate', () => { if (/^#steam/.test(location.hash)) return route(); const m = location.hash.match(/^#g(\d+)$/); if (m && D.byId.has(+m[1])) openGame(+m[1], false); else closeGame(true); });
sheet.addEventListener('cancel', e => { e.preventDefault(); closeGame(); });
sheet.addEventListener('click', e => { if (e.target === sheet) closeGame(); });
for (const d of [addDlg, accDlg]) d.addEventListener('click', e => { if (e.target === d) d.close(); });
for (const d of [sheet, addDlg, accDlg, ibDlg]) d.addEventListener('close', () => { delete d.dataset.out; host(); });

// ---------- تغيير القائمة والمنصة والتاريخ والساعات
function refresh(id) { const g = D.byId.get(id), el = document.getElementById('g-' + id);
  if (el && g) { const s = lst(id); el.className = el.className.replace(/\bs-\w+/, 's-' + s); el.querySelector('.badge')?.remove(); el.querySelector('.cover').insertAdjacentHTML('beforeend', badge(g));
    const b = el.querySelector('.band'); if (b) b.outerHTML = band(g); el.querySelector('.meta').innerHTML = metaLine(g); }
  if (openId === id && g) { const sv = $('#sheet-body .save'); if (sv) sv.outerHTML = saveHTML(g); const t = $('#sheet-body .ttb'); if (t) t.closest('.sec').outerHTML = ttbHTML(g); }
  renderMenu(false); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); soonHTML(); dupTidy(); dupDraw();   // تنبيه المكرر لا ينتظر حركة خروج العلبة
  if (el && g && !el.hidden && !match(g) && !calm) { el.classList.add('leaving'); setTimeout(() => { el.classList.remove('leaving'); apply(false); }, 700); } else apply(false); }
function setList1(id, v, quiet) { const r = rec(id), was = r.s || 'new'; if (was === v && r.s) return;
  const on = v === 'seen' ? (WATCH.includes(r.on) ? r.on : undefined) : (WATCH.includes(r.on) ? undefined : r.on), prev = { ...r };
  setRec(id, { s: v, on, at: today }); refresh(id);
  if (!quiet) toast(v === 'done' ? `شارة النهاية: «${D.byId.get(id)?.title}»` : `انتقلت إلى «${LISTS[v].t}»`, () => { P.games[id] = prev; if (!Object.keys(prev).length) delete P.games[id]; save(); refresh(id); }); }

// ---------- القائمة السريعة تحت الغلاف (⋮): نقل اللعبة بين القوائم دون فتح بطاقتها
const qm = $('#qm'); let qmFor = null, qmY = 0;
function openQm(btn) { const id = +btn.closest('[data-id]').dataset.id, s = lst(id); qmFor = { id, btn };
  qm.classList.remove('ask'); qm.innerHTML = `<p>حالتها عندي</p>${['play', 'new', 'done', 'seen'].map(k => `<button type="button" role="menuitemradio" class="m-${k}" data-act="qm-set" data-v="${k}" aria-checked="${s === k}">${ic(LISTS[k].ic)}${LISTS[k].act}</button>`).join('')}<hr><button type="button" role="menuitem" class="m-rm" data-act="qm-rm">${ic('trash')}احذفها من مكتبتي</button>`;
  qm.hidden = false; placeQm();
  btn.setAttribute('aria-expanded', 'true'); qmY = scrollY; (qm.querySelector('[aria-checked=true]') || qm.querySelector('button')).focus({ preventScroll: true }); }
function placeQm() { const r = qmFor.btn.getBoundingClientRect(), w = qm.offsetWidth, h = qm.offsetHeight;
  qm.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px'; qm.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px'; }
function closeQm(back) { if (qm.hidden) return; qm.hidden = true; qmFor?.btn.setAttribute('aria-expanded', 'false'); if (back) qmFor?.btn.focus(); qmFor = null; }
// تُغلق إن مُرّرت الصفحة فعلاً (لا لتمرير صغير يسبق اللمسة نفسها)، أو تغيّر حجم النافذة
addEventListener('scroll', () => { if (!qm.hidden && Math.abs(scrollY - qmY) > 30) closeQm(); }, { passive: true }); addEventListener('resize', () => closeQm());
qm.addEventListener('keydown', e => { const b = $$('button', qm), i = b.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); closeQm(true); } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length].focus(); } });

// ---------- أضف لعبة
const pass = () => store.get(PASS) || (store.get('gamesg.nofilm') ? '' : store.get('filmsg.pass')) || '';
async function api(path, body, password = pass()) { let r; try { r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(isOpen() && path === '/api/add-game' ? { adult: true } : {}), ...body, password }) }); } catch { throw new Error('تعذّر الاتصال. تأكد من الإنترنت وحاول ثانية.'); }   // adult: الفلتر مرفوع، فيعود البحث بألعاب +18 أيضاً
  if (r.status === 401) { const j = await r.clone().json().catch(() => ({})); if (j.error === 'password') { store.del(PASS); store.set('gamesg.nofilm', '1'); $$('.pass-wrap').forEach(w => { w.hidden = false; }); throw Object.assign(new Error('كلمة السر غير صحيحة.'), { pw: true }); } }
  if (r.status === 404 || r.status === 405) throw new Error('هذه الخدمة تعمل من نسخة الموقع على Netlify فقط.');
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || 'حدث خطأ في الخادم. حاول بعد قليل.'), { need: j.need }); return j; }
const remember = pw => { store.set(PASS, pw); store.del('gamesg.nofilm'); };
function openAdd(q = '') { titles(); drawSug([]); $('#add-q').value = q; $('#add-msg').textContent = ''; $('#cands').innerHTML = ''; $('#add-pass-wrap').hidden = !!pass(); if (!addDlg.open) showM(addDlg); (pass() || !q ? $('#add-q') : $('#add-pass')).focus(); if (q && pass()) $('#add-form').requestSubmit(); }
$('#add-form').addEventListener('submit', async e => { e.preventDefault(); const q = $('#add-q').value.trim(), pw = $('#add-pass').value || pass(), msg = $('#add-msg'); if (!q) return; clearTimeout(sugT); sugN++; drawSug([]);   // واقتراح مؤجَّل لم يُرسم بعد لا يُرسم فوق المرشحات
  if (!pw) { msg.textContent = 'اكتب كلمة السر أولاً.'; $('#add-pass-wrap').hidden = false; $('#add-pass').focus(); return; }
  msg.textContent = 'أبحث…'; $('#cands').innerHTML = '';
  try { const r = await api('/api/add-game', { action: 'search', q }, pw); remember(pw); $('#add-pass-wrap').hidden = true; $('#add-pass').value = '';
    if (!r.candidates.length) { const m = find(await titles(), q, { limit: 1, min: 52 }).hits[0];
      msg.innerHTML = `لم أجد لعبة باسم «${esc(r.parsed.title)}»${r.parsed.year ? ` وسنة ${r.parsed.year}` : ''}.` + (m ? ` هل تقصد <button type="button" class="meant-btn" data-act="meant-add" data-q="${esc(m.title + (m.y ? ' ' + m.y : ''))}"><bdi>${esc(m.title)}</bdi>${m.y ? ` (${m.y})` : ''}</button>؟` : ' تأكد من الإملاء أو السنة.'); return; }
    msg.textContent = r.parsed.year ? `فهمت: «${r.parsed.title}»، سنة ${r.parsed.year}. اختر المقصودة:` : `فهمت: «${r.parsed.title}». اختر المقصودة:`;
    $('#cands').innerHTML = r.candidates.map(c => { const has = D.byId.has(c.igdb), tw = !has && twinOf(c.title);   // لعبة أخرى في القائمة بالاسم نفسه: يُقال قبل الإضافة، فلا تتكرر بلمسة خاطئة
      return `<div class="cand" data-igdb="${c.igdb}"${marks(c.igdb, c.adult)}><span class="th">${c.cover ? `<img alt="" src="${img(c.cover, 'cover_small')}">` : ''}</span><span><b dir="ltr">${esc(c.title)}</b><small>${[TYPES[c.type], c.year, c.plats?.length ? `<bdi dir="ltr">${esc(c.plats.join(' · '))}</bdi>` : '', c.series ? `من سلسلة <bdi dir="ltr">${esc(c.series)}</bdi>` : ''].filter(Boolean).join(' · ')}</small>${tw ? `<small class="tw">${twinNote(tw)}</small>` : ''}</span>
<span class="cbtns">${has ? `<small>في قائمتك</small><button class="btn sec" type="button" data-act="cand-open" data-id="${c.igdb}">افتح بطاقتها</button>` : `<button class="btn sec" type="button" data-act="preview" data-igdb="${c.igdb}">التفاصيل</button><button class="btn pri" type="button" data-act="add-pick" data-igdb="${c.igdb}">أضفها</button>`}</span></div>`; }).join('');
  } catch (err) { msg.textContent = err.message; } });
// اختيار القائمة قبل الإضافة: تحت المرشحة نفسها
function askList(btn) { const row = btn.closest('.cand'); $$('.cand .pickl').forEach(x => x.remove());
  row.insertAdjacentHTML('beforeend', `<div class="pickl" role="group" aria-label="ما وضعها عندك؟"><b>ما وضعها عندك؟</b>${['play', 'new', 'done', 'seen'].map(k => `<button type="button" class="chip m-${k}" data-act="add-to" data-v="${k}" data-igdb="${row.dataset.igdb}">${ic(LISTS[k].ic)}${LISTS[k].act}</button>`).join('')}</div>`);
  row.querySelector('.pickl [data-v=new]').focus(); }
async function addGame(igdb, list, btn) { const msg = $('#add-msg'), label = btn?.innerHTML; if (btn) { btn.disabled = true; btn.textContent = 'تُضاف…'; }
  try { const r = await api('/api/add-game', { action: 'add', igdb }); adopt(r.game, r, true); renew(r.game.id); setRec(r.game.id, { s: list, at: today }); keep(r);
    if (addDlg.open) addDlg.close(); toast(`أُضيفت «${r.game.title}» إلى «${LISTS[list].t}»`); refresh(r.game.id); openGame(r.game.id, !sheet.open);
  } catch (err) { if (addDlg.open) msg.textContent = err.message; else toast(err.message); if (btn) { btn.disabled = false; btn.innerHTML = label; } } }
const twinOf = t => { const k = fold(t); return k ? D.games.find(g => ft(g) === k) : null; };
const twinNote = g => `في مكتبتك لعبة بهذا الاسم${g.year ? ` (<bdi>${g.year}</bdi>)` : ''}`;
const keep = r => { try { const p = JSON.parse(store.get(PEND) || '[]'); p.push(r); store.set(PEND, JSON.stringify(p.slice(-400))); } catch {} };
// ---------- احذف لعبة: تُحذف من ملف المضافات في المستودع (فتختفي من كل الأجهزة مع البناء القادم)، ومن هذا الجهاز فوراً، وسجلها يُلغى ويُزامَن.
// ما حُذف هنا يُحفظ في gamesg.removed حتى يلحق البناء، فلا يعود للظهور من ملف القائمة القديم. والتراجع يعيدها بسجلها كما كان
const removedMap = () => { try { const m = JSON.parse(store.get(REM) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
function drop(id) { const g = D.byId.get(id); if (!g) return; D.byId.delete(id); D.pool.delete(id); D.games = D.games.filter(x => x.id !== id); stale(); document.getElementById('g-' + id)?.remove();
  const m = removedMap(); m[id] = Date.now(); store.set(REM, JSON.stringify(m));
  try { store.set(PEND, JSON.stringify(JSON.parse(store.get(PEND) || '[]').map(r => r?.game ? (r.game.id === id ? null : r) : { ...r, games: (r?.games || []).filter(x => x.id !== id) }).filter(r => r && (r.game || r.games?.length)))); } catch {}
  if (P.games[id]) { delete P.games[id]; save(); }
  if (slotId === id) slotId = null; if (tonightId === id) tonightId = null;
  $('#chips').innerHTML = chipsHTML(); renderMenu(false); soonHTML(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); apply(false); }
async function removeGame(id, pw, box, btn) { const g = D.byId.get(id), msg = box?.querySelector('.msg'), label = btn?.innerHTML; if (!g) return;
  if (!pw) { if (msg) msg.textContent = 'اكتب كلمة السر أولاً.'; box?.querySelector('.rm-pass')?.focus(); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'تُحذف…'; }
  try { await api('/api/add-game', { action: 'remove', igdb: id }, pw); if (!pass()) remember(pw);
    const prev = P.games[id] ? { ...P.games[id] } : null; closeQm(); if (sheet.open && openId === id) closeGame(); drop(id);
    toast(`حُذفت «${g.title}» من مكتبتك`, () => restore(g, prev), 8000);
  } catch (e) { if (btn) { btn.disabled = false; btn.innerHTML = label; } if (msg) msg.textContent = e.message; else toast(e.message); } }
async function restore(g, prev) { try { const r = await api('/api/add-game', { action: 'add', igdb: g.id, ...(g.adult ? { adult: true } : {}) });   // لعبة +18 تعود ولو أُعيد الفلتر قبل التراجع
    const m = removedMap(); delete m[g.id]; store.set(REM, JSON.stringify(m)); adopt(r.game, r, true); keep(r); if (prev) { P.games[g.id] = prev; save(); }
    refresh(g.id); toast(`عادت «${g.title}» إلى مكتبتك`);
  } catch (e) { toast('تعذّرت إعادتها: ' + e.message); } }
// لعبة عادت من الخادم (أو محفوظة بانتظار البناء القادم) تدخل القائمة المعروضة
function adopt(g, r, draw) { if (!g || D.pool.has(g.id)) return false; merge(r || {}); g.fresh = true; g.ord = -Date.now(); register(g); stale();
  if (draw && D.byId.has(g.id)) { $('#grid').insertAdjacentHTML('afterbegin', card(g)); $('#chips').innerHTML = chipsHTML(); } return true; }
// بطاقة اطلاع: اللعبة كاملة من IGDB عبر الخادم دون إضافتها، مرة واحدة لكل لعبة
const previews = new Map(); let pvOpen = 0;   // بطاقة الاطلاع المفتوحة، ليُعاد رسمها حين يُكشف غلافها
async function peek(id, btn) { if (D.byId.has(id)) { if (addDlg.open) addDlg.close(); return openGame(id); }
  if (!pass()) return openAdd(btn?.dataset.q || '');
  const label = btn?.innerHTML, busy = btn && btn.matches('.btn'); if (busy) { btn.disabled = true; btn.textContent = 'يجهّز…'; }
  try { let r = previews.get(id); if (!r) { r = await api('/api/add-game', { action: 'preview', igdb: id }); previews.set(id, r); } merge(r); openId = null;
    markEl($('#sheet-body'), id, r.game.adult); $('#sheet-body').innerHTML = await sheetHTML(r.game, true); $('#sheet-body').scrollTop = 0; pvOpen = id; showSheet({ game: 'preview' });
  } catch (err) { if (addDlg.open) $('#add-msg').textContent = err.message; else if (err.pw) openAdd(btn?.dataset.q || ''); else toast(err.message); }
  finally { if (busy) { btn.disabled = false; btn.innerHTML = label; } } }

// ---------- اقتراحات أثناء الكتابة، قبل Enter: من فهرس أشهر الألعاب (data/titles.json) بالبحث المتسامح، ثم من بحث IGDB نفسه
let TI = null; const titles = () => TI ??= get('titles.json').then(j => prepare(j.items.map(r => ({ id: r[0], y: r[1], v: r[2], f: r[3], title: r[4], ar: r[5] || '', names: [r[4], r[5] || '', ...(r[6] ? String(r[6]).split('|') : [])] }))))
  .catch(() => { TI = null; return []; });
const addQ = $('#add-q'), sugEl = $('#add-sug'); let sug = [], sugAt = -1, sugT = 0, sugN = 0;
function drawSug(list = [], meant = null) { sug = list; sugAt = -1; addQ.removeAttribute('aria-activedescendant');
  sugEl.innerHTML = list.map((x, i) => `<li role="option" id="sg-${i}" data-i="${i}" aria-selected="false" class="${x === meant ? 'meant' : ''}${x.srv && !list[i - 1]?.srv && i ? ' srv' : ''}">${x === meant ? '<span class="sg-k">هل تقصد</span>' : ''}<b>${esc(x.title)}</b><small>${[x.ar && `<bdi>${esc(x.ar)}</bdi>`, x.y || '', x.f ? `<bdi dir="ltr">${famsText(x.f)}</bdi>` : '', D.byId.has(x.id) ? 'في قائمتك' : ''].filter(Boolean).join(' · ')}</small></li>`).join('');
  sugEl.hidden = !list.length; addQ.setAttribute('aria-expanded', String(!!list.length)); }
function moveSug(d) { sugAt = sugAt + d > sug.length - 1 ? -1 : sugAt + d < -1 ? sug.length - 1 : sugAt + d;
  $$('li', sugEl).forEach((li, i) => li.setAttribute('aria-selected', String(i === sugAt)));
  if (sugAt < 0) addQ.removeAttribute('aria-activedescendant'); else { addQ.setAttribute('aria-activedescendant', 'sg-' + sugAt); $('#sg-' + sugAt).scrollIntoView({ block: 'nearest' }); } }
function pickSug(i) { const x = sug[i]; if (!x) return; addQ.value = `${x.title}${x.y ? ' ' + x.y : ''}`; drawSug([]); $('#add-form').requestSubmit(); }
async function suggest() { const q = addQ.value.trim(), n = ++sugN; if (fold(q).length < 2) return drawSug([]);
  const T = await titles(); if (n !== sugN) return;
  const r = find(T, q, { limit: 6, min: 52 }); drawSug(r.hits, r.meant);
  // والفلتر مرفوع يُسأل الخادم دائماً: ألعاب +18 ليست في فهرس الصفحة، وما عاد منها يتقدم ما سواه من نتائج الخادم
  if ((r.hits.length >= 4 && !isOpen()) || !pass() || fold(q).length < 3) return;
  await new Promise(ok => setTimeout(ok, 280)); if (n !== sugN) return;
  const s = await api('/api/add-game', { action: 'suggest', q }).catch(() => null); if (n !== sugN || !s?.items?.length) return;
  const have = new Set(r.hits.map(h => h.id)), more = s.items.map(x => ({ id: x.igdb, title: x.title, y: x.year, f: x.fams, srv: 1, ad: x.adult ? 1 : 0 })).filter(x => !have.has(x.id)).sort((a, b) => b.ad - a.ad);
  drawSug([...r.hits.slice(0, more.some(x => x.ad) ? 5 : 6), ...more].slice(0, 8), r.meant); }
addQ.addEventListener('input', () => { clearTimeout(sugT); sugT = setTimeout(suggest, 110); });
addQ.addEventListener('keydown', e => {
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sug.length) { e.preventDefault(); moveSug(e.key === 'ArrowDown' ? 1 : -1); }
  else if (e.key === 'Enter' && sugAt >= 0) { e.preventDefault(); pickSug(sugAt); }
  else if (e.key === 'Escape' && !sugEl.hidden) { e.preventDefault(); e.stopPropagation(); drawSug([]); } });
sugEl.addEventListener('pointerdown', e => e.preventDefault());
sugEl.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) pickSug(+li.dataset.i); });
addQ.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== addQ) drawSug([]); }, 160));
addDlg.addEventListener('cancel', e => { if (!sugEl.hidden) { e.preventDefault(); drawSug([]); } });

// ---------- حساباتي: Steam وPlayStation وXbox، ثم صندوق الأسئلة
let ACC = null;
const steamId = () => store.get(STEAM) || ACC?.steamId || '';
async function openAccounts() { if (!accDlg.open) showM(accDlg); drawAcc(); if (pass() && !ACC) { try { ACC = await api('/api/game-accounts', { action: 'status' }); } catch (e) { ACC = { err: e.message }; } drawAcc(); } }
function drawAcc(busy = '', err = {}, note = '') { const id = steamId(), s = ACC || {};
  const box = (k, name, body) => `<section class="src s-${k}"><header><h3 dir="ltr">${name}</h3></header>${body}${err[k] ? `<p class="msg" role="alert">${esc(err[k])}</p>` : ''}</section>`;
  const pull = (k, t = 'اسحب ألعابي') => `<button class="btn pri" type="button" data-act="pull" data-src="${k}"${busy ? ' disabled' : ''}>${busy === k ? esc(note || 'أسحب ألعابك…') : t}</button>`;
  $('#acc-body').innerHTML = `<h2 id="acc-h">حساباتي في المنصات</h2><p class="lead">اسحب ما لعبته، وأسألك عن كل لعبة: ختمتها؟ ما زلت تلعبها؟ أم لاحقاً؟ ثم تُضاف إلى قوائمك بمنصتها.</p>
${pass() ? '' : `<label class="pass-wrap">كلمة السر (كلمة سر «أضف لعبة»)<input id="acc-pass" type="password" autocomplete="current-password"></label>`}${s.err ? `<p class="msg">${esc(s.err)}</p>` : ''}${s.igdb === false ? '<p class="msg">مفاتيح <bdi dir="ltr">IGDB</bdi> غير موجودة في Netlify بعد، فلا يمكن مطابقة الألعاب.</p>' : ''}
${box('steam', 'Steam', id ? `<p>مرتبط بحسابك (<bdi dir="ltr">…${esc(id.slice(-5))}</bdi>). يسحب ما لعبته وساعاته.</p><label class="tick"><input type="checkbox" id="steam-all"> ومعها ما في مكتبتي ولم ألعبه</label><div class="acts">${pull('steam')}<button class="btn sec" type="button" data-act="steam-off">افصل</button></div>${s.steam === false ? '<p class="note">يلزم مفتاح Steam في Netlify باسم <code>STEAM_API_KEY</code> (من steamcommunity.com/dev/apikey).</p>' : ''}`
  : `<p>ادخل بحسابك في Steam نفسه (بلا كلمة سر هنا)، فيُعرف حسابك ويُسحب ما لعبته.</p><div class="acts"><a class="btn pri" href="/api/game-accounts?steam=login">ادخل عبر Steam</a></div><p class="note">يلزم أن تكون «تفاصيل الألعاب» عامة في خصوصية ملفك على Steam${s.steam === false ? '، ومفتاح Steam في Netlify باسم <code>STEAM_API_KEY</code>' : ''}.</p>`)}
${box('psn', 'PlayStation', s.psn ? `<p>رمزك محفوظ في Netlify. يسحب ما لعبته على PS4 وPS5 وساعاته، ونسبة كؤوسك والبلاتينيوم.</p><div class="acts">${pull('psn')}</div>`
  : `<p>يسحب ما لعبته على PS4 وPS5 وساعاته وكؤوسك. يحتاج رمز <bdi dir="ltr">NPSSO</bdi> من حسابك لمرة واحدة:</p><ol class="steps"><li>سجّل دخولك في <a href="https://www.playstation.com/" target="_blank" rel="noopener">playstation.com</a>.</li><li>افتح <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener">هذا الرابط</a> في المتصفح نفسه، وانسخ قيمة <bdi dir="ltr">npsso</bdi>.</li><li>الصقها هنا واسحب.</li></ol>
<label class="key">رمز NPSSO<input id="psn-key" type="password" autocomplete="off" spellcheck="false" dir="ltr"></label><div class="acts">${pull('psn')}</div><p class="note">الرمز يفتح حسابك كما تفتحه كلمة السر، فلا تشاركه. يُستخدم لهذا السحب ولا يُحفظ في أي مكان. وهي طريقة غير رسمية من Sony، قد تتوقف إن غيّرت Sony نظامها.</p>`)}
${box('xbox', 'Xbox', s.xbox ? `<p>مفتاح OpenXBL محفوظ في Netlify. يسحب ما لعبته ونسبة إنجازاتك.</p><div class="acts">${pull('xbox')}</div>`
  : `<p>يسحب ما لعبته على Xbox والكمبيوتر ونسبة إنجازاتك، عبر خدمة <a href="https://xbl.io/" target="_blank" rel="noopener"><bdi dir="ltr">OpenXBL</bdi></a> الوسيطة (غير تابعة لمايكروسوفت): ادخلها بحسابك، وانسخ مفتاح الـ<bdi dir="ltr">API</bdi> من صفحة حسابك فيها.</p>
<label class="key">مفتاح OpenXBL<input id="xbox-key" type="password" autocomplete="off" spellcheck="false" dir="ltr"></label><div class="acts">${pull('xbox')}</div><p class="note">يُستخدم لهذا السحب ولا يُحفظ.</p>`)}
${box('nin', 'Nintendo · الجوال', `<p>لا تتيح Nintendo ولا متاجر الجوال سجل اللعب لأي تطبيق، فأضفها يدوياً واختر منصتها من بطاقتها.</p><div class="acts"><button class="btn sec" type="button" data-act="add">${ic('plus')}أضف لعبة</button></div>`)}`; }
async function pull(src, btn) { const pw = $('#acc-pass')?.value || pass(), err = {}; if (!pw) { drawAcc('', { [src]: 'اكتب كلمة السر أولاً.' }); $('#acc-pass')?.focus(); return; }
  const body = { action: src }; if (src === 'steam') { body.steamid = steamId(); body.all = !!$('#steam-all')?.checked; } if (src === 'psn' && !ACC?.psn) body.npsso = $('#psn-key')?.value.trim(); if (src === 'xbox' && !ACC?.xbox) body.key = $('#xbox-key')?.value.trim();
  if (src === 'psn' && !ACC?.psn && !body.npsso) return drawAcc('', { psn: 'الصق رمز NPSSO أولاً.' }); if (src === 'xbox' && !ACC?.xbox && !body.key) return drawAcc('', { xbox: 'الصق مفتاح OpenXBL أولاً.' });
  drawAcc(src);
  try { const r = await api('/api/game-accounts', body, pw); if (!pass()) remember(pw);
    const all = await matchAll(r, pw, (n, t) => drawAcc(src, {}, `أطابقها مع IGDB… ${n} من ${t}`)); accDlg.close(); openInbox(all); }
  catch (e) { err[src] = e.message; drawAcc('', err); } }
// المطابقة بالاسم في دفعات (حتى أربعين لعبة في كل طلب، فلا تتجاوز دالة مهلتها مهما طالت قائمتك)، والتقدّم ظاهر على الزر.
// ما لم يُطابق بعد دفعتين بلا تقدّم يُعرض «لم أجدها» مع زر البحث عنه بالاسم
async function matchAll(r, pw, tick) { const items = r.items.map(x => ({ ...x })), at = new Map(items.map((x, i) => [x.key, i]));
  for (let round = 0, stall = 0; round < 40; round++) { const todo = items.filter(x => x.todo); if (!todo.length) break;
    tick(items.length - todo.length, items.length);
    const m = await api('/api/game-accounts', { action: 'match', source: r.source, items: todo.slice(0, 40).map(({ key, name, plat, last }) => ({ key, name, plat, last })) }, pw); let moved = 0;
    for (const u of m.items) { const x = items[at.get(u.key)]; if (!x) continue; if (!u.todo) moved++; Object.assign(x, { igdb: u.igdb, sure: u.sure, title: u.title, year: u.year, cover: u.cover, ttb: u.ttb, todo: !!u.todo }); }
    stall = moved ? 0 : stall + 1; if (stall >= 2) break; }
  for (const x of items) if (x.todo) { x.todo = false; x.igdb = null; }
  return { ...r, items, matched: items.filter(x => x.igdb).length }; }

// صندوق الأسئلة: لعبة لعبة، بغلافها وما يرجّح جوابها (ساعاتك ومتوسط ختمها، كؤوسك، آخر لعب)، والجواب يضعها في قائمتها بمنصتها
let IB = null;
const ignored = () => { try { return new Set(JSON.parse(store.get(IGN) || '[]')); } catch { return new Set(); } };
const SRCN = { steam: 'Steam', psn: 'PlayStation', xbox: 'Xbox' }, clean = s => fold(s);
function guess(x) { const n = x.ttb?.n, days = x.last ? (Date.now() - Date.parse(x.last)) / 864e5 : 1e9;
  if (x.platinum) return ['done', 'حصلت على كأسها البلاتينية'];
  if (n && x.hours >= n * .85) return ['done', `لعبتها ${hrs(x.hours)}، ومتوسط ختمها ${hrs(n)}`];
  if (x.progress >= 85) return ['done', `أنجزت ${x.progress}% من إنجازاتها`];
  if (days <= 45 && (x.hours == null || x.hours >= .5)) return ['play', 'لعبتها في الأسابيع الأخيرة'];
  if (x.hours != null && x.hours < .5) return ['new', x.hours ? 'لعبتها دقائق فقط' : 'لم تلعبها بعد'];
  return ['new', x.hours ? `لعبتها ${hrs(x.hours)} وتوقفت` : 'لعبتها من مدة']; }
function openInbox(r) { const have = new Set(D.games.map(g => g.id)), ign = ignored(), best = new Map();
  for (const x of r.items.filter(x => x.igdb && !have.has(x.igdb) && !ign.has(x.key) && !ign.has('g' + x.igdb))) { const o = best.get(x.igdb); if (!o || (x.hours || 0) > (o.hours || 0)) best.set(x.igdb, x); }
  IB = { src: r.source, items: [...best.values()], miss: r.items.filter(x => !x.igdb), have: r.items.filter(x => x.igdb && have.has(x.igdb)).length, at: 0, picks: [] };
  if (!ibDlg.open) showM(ibDlg); drawIb(); }
function drawIb(dir) { const ib = $('#ib'), n = IB.items.length, x = IB.items[IB.at], kept = IB.picks.filter(p => p.s !== 'skip').length;
  const head = `<header class="ib-h"><h2 id="ib-h">من ${SRCN[IB.src] || IB.src}</h2><p>${n ? `${Math.min(IB.at + 1, n)} من ${n}` : ''}${IB.have ? ` · ${nGames(IB.have)} في قائمتك من قبل` : ''}</p><i class="ib-bar" style="--p:${n ? IB.at / n : 1}"></i><button class="close" type="button" data-act="ib-close" aria-label="إغلاق">${ic('x')}</button></header>`;
  if (!x) { ib.innerHTML = `${head}<div class="ib-end"><h3>${n ? 'انتهت الأسئلة' : IB.have || !IB.miss.length ? 'لا جديد هنا' : 'لم أطابق شيئاً'}</h3><p>${n ? (kept ? `اخترت قوائم ${nGames(kept)}. احفظها لتُضاف إلى قوائمك.` : 'لم تختر إضافة شيء.') : IB.have || !IB.miss.length ? `كل ما لعبته في ${SRCN[IB.src] || ''} في قائمتك من قبل، أو تجاهلته.` : `لم أجد ما لعبته في ${SRCN[IB.src] || ''} بأسمائه في <bdi dir="ltr">IGDB</bdi>. ابحث عن أي لعبة منها بالاسم:`}</p>
${IB.miss.length ? `<details class="miss"${!n && !IB.have ? ' open' : ''}><summary>${nGames(IB.miss.length)} لم أجدها في <bdi dir="ltr">IGDB</bdi></summary><ul>${IB.miss.slice(0, 60).map(m => `<li><bdi dir="ltr">${esc(m.name)}</bdi><button type="button" data-act="ib-find" data-q="${esc(m.name)}">ابحث عنها</button></li>`).join('')}</ul></details>` : ''}
<div class="acts">${kept ? `<button class="btn pri" type="button" data-act="ib-save">احفظ ${nGames(kept)}</button>` : ''}${IB.at ? `<button class="btn sec" type="button" data-act="ib-back">${ic('undo')}رجوع</button>` : ''}<button class="btn sec" type="button" data-act="ib-close">${kept ? 'لاحقاً' : 'إغلاق'}</button></div></div>`; return; }
  const [g, why] = guess(x), next = IB.items.slice(IB.at + 1, IB.at + 3);
  const hints = [x.hours != null && `<span>${x.hours ? `لعبتها ${hrs(x.hours)}` : 'لم تلعبها'}</span>`, x.ttb?.n && `<span>متوسط ختمها ${hrs(x.ttb.n)}</span>`, x.platinum && '<span class="plat">بلاتينيوم</span>', x.progress != null && `<span>إنجازاتك ${x.progress}%</span>`, x.last && `<span>آخر لعب ${monthAr(x.last)}</span>`, twinOf(x.title || x.name) && `<span class="tw">${twinNote(twinOf(x.title || x.name))}</span>`].filter(Boolean).join('');
  const A = [['done', 'ختمتها', 'trophy'], ['play', 'ما زلت ألعبها', 'play'], ['new', 'لاحقاً', 'star'], ['seen', 'شاهدتها فقط', 'eye'], ['skip', 'تجاهلها', 'x']];
  ib.innerHTML = `${head}<div class="ib-stack">${next.map((y, i) => `<div class="ib-card ghost g${i + 1}" aria-hidden="true">${y.cover ? `<img alt="" src="${img(y.cover)}">` : ''}</div>`).reverse().join('')}
<div class="ib-card top${dir ? ' in-' + dir : ''}"><div class="ib-cv">${x.cover ? `<img alt="" src="${img(x.cover, 'cover_big_2x')}">` : cart(x)}<span class="band f-${famOf(x.plat)}"><b dir="ltr">${esc(abbr(x.plat))}</b></span></div>
<div class="ib-t"><h3 dir="ltr">${esc(x.title || x.name)}</h3>${x.title && clean(x.name) !== clean(x.title) ? `<p class="as">في ${SRCN[IB.src]}: <bdi dir="ltr">${esc(x.name)}</bdi></p>` : ''}<p class="hints">${hints}</p></div></div></div>
<p class="ib-q">هل ختمتها؟ <small>الأرجح «${A.find(a => a[0] === g)[1]}»: ${esc(why)}</small></p>
<div class="ib-a">${A.map(([k, t, i], n) => `<button type="button" class="m-${k}${k === g ? ' rec' : ''}" data-act="ib-pick" data-v="${k}"><kbd>${n + 1}</kbd>${ic(i)}${t}</button>`).join('')}</div>
<div class="acts ib-f">${IB.at ? `<button class="btn sec" type="button" data-act="ib-back">${ic('undo')}رجوع</button>` : ''}${kept ? `<button class="btn sec" type="button" data-act="ib-save">احفظ ما اخترته (${kept})</button>` : ''}<button class="btn sec" type="button" data-act="ib-end">تخطَّ البقية</button></div>`;
  ib.querySelector(`.ib-a .rec`)?.focus({ preventScroll: true }); }
function ibPick(v) { const x = IB.items[IB.at]; if (!x) return; IB.picks = IB.picks.filter(p => p.key !== x.key);
  IB.picks.push({ key: x.key, igdb: x.igdb, s: v, on: v === 'seen' ? 'yt' : x.plat, at: v === 'done' || v === 'play' ? (x.last || today) : today, h: x.hours ? Math.round(x.hours) : undefined });
  const top = $('#ib .ib-card.top'); IB.at++;
  if (top && !calm) { top.classList.add('out-' + (v === 'skip' ? 'skip' : v === 'done' ? 'up' : 'side')); setTimeout(() => drawIb('next'), 230); } else drawIb('next'); }
function ibBack() { if (!IB.at) return; IB.at--; const x = IB.items[IB.at]; IB.picks = IB.picks.filter(p => p.key !== x.key); drawIb('back'); }
async function ibSave(btn) { const keepers = IB.picks.filter(p => p.s !== 'skip'), skips = IB.picks.filter(p => p.s === 'skip');
  const ign = ignored(); for (const p of skips) ign.add(p.key); store.set(IGN, JSON.stringify([...ign].slice(-3000)));
  if (!keepers.length) { ibDlg.close(); return; }
  btn.disabled = true; btn.textContent = 'تُحفظ…';
  try { const r = await api('/api/add-game', { action: 'import', items: keepers.map(p => ({ igdb: p.igdb })), source: IB.src }); let n = 0;
    for (const g of r.games) { adopt(g, r, false); renew(g.id); n++; } keep({ games: r.games, series: r.series, plats: r.plats, franchises: r.franchises });
    for (const p of keepers) if (D.byId.has(p.igdb)) P.games[p.igdb] = Object.fromEntries(Object.entries({ s: p.s, on: p.on, at: p.at, h: p.h }).filter(([, v]) => v != null && v !== ''));
    save(); ibDlg.close(); renderGrid(); renderMenu(true); soonHTML(); toast(`أُضيفت ${nGames(n)} إلى قوائمك`);
  } catch (e) { btn.disabled = false; btn.textContent = 'أعد المحاولة'; toast(e.message); } }
ibDlg.addEventListener('keydown', e => { if (!IB || e.target.matches('input, textarea') || e.altKey || e.ctrlKey || e.metaKey) return; const k = { 1: 'done', 2: 'play', 3: 'new', 4: 'seen', 5: 'skip' }[e.key];
  if (k && IB.items[IB.at]) { e.preventDefault(); ibPick(k); } else if (e.key === 'Backspace' && IB.at) { e.preventDefault(); ibBack(); } });
ibDlg.addEventListener('cancel', e => { if (IB?.picks.some(p => p.s !== 'skip') && IB.at < IB.items.length) { e.preventDefault(); IB.at = IB.items.length; drawIb(); } });

// ---------- الأحداث
document.addEventListener('click', e => { if (!qm.hidden && !e.target.closest('#qm') && !e.target.closest('[data-act=qm]')) closeQm();
  const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act, id = +(t.dataset.id || t.closest('[data-id]')?.dataset.id || 0);
  if (act === 'open') openGame(id);
  else if (act === 'list') { ui.dup = null; setList(t.dataset.v); }
  else if (act === 'dup-go') dupGo(t.dataset.k);
  else if (act === 'dup-no') dupNo(t.dataset.k);
  else if (act === 'dup-back') { ui.dup = null; apply(false); }
  else if (act === 'set') { if (openId) setList1(openId, t.dataset.v); }
  else if (act === 'on') { if (!openId) return; const v = rec(openId).on === t.dataset.v ? '' : t.dataset.v; setRec(openId, { on: v }); refresh(openId); }
  else if (act === 'qm') { if (qmFor?.btn === t) closeQm(); else openQm(t); }
  else if (act === 'qm-set') { const f = qmFor; closeQm(true); if (f) setList1(f.id, t.dataset.v); }
  else if (act === 'qm-rm') { const g = qmFor && D.byId.get(qmFor.id); if (!g) return; qm.classList.add('ask'); qm.innerHTML = rmAsk(g); placeQm(); (qm.querySelector('.rm-pass') || qm.querySelector('[data-act=rm-no]')).focus({ preventScroll: true }); }
  else if (act === 'tr-ask') askTr(t);
  else if (act === 'rm-ask') { const g = D.byId.get(openId), box = t.closest('.rm'); if (!g || !box) return; box.classList.add('ask'); box.innerHTML = rmAsk(g); (box.querySelector('.rm-pass') || box.querySelector('[data-act=rm-no]')).focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); }
  else if (act === 'rm-no') { if (t.closest('#qm')) closeQm(true); else { const g = D.byId.get(openId), sv = $('#sheet-body .save'); if (g && sv) { sv.outerHTML = saveHTML(g); $('#sheet-body .rm-b')?.focus({ preventScroll: true }); } } }
  else if (act === 'rm-go') { const box = t.closest('.rm, #qm'); removeGame(+t.dataset.id, box?.querySelector('.rm-pass')?.value || pass(), box, t); }
  else if (act === 'quick') setList1(+t.dataset.id, t.dataset.v);
  else if (act === 'reroll') { pickTonight(true); renderMenu(true); }
  else if (act === 'shuffle') { const pool = D.games.filter(g => g.id !== slotId && !g.adult && (g.art || g.cover)); slotId = pool[Math.floor(Math.random() * pool.length)]?.id ?? slotId; renderMenu(true); }
  else if (act === 'mood') { const g = t.dataset.g; moods = !g ? [] : moods.includes(g) ? moods.filter(x => x !== g) : [...moods, g]; store.set('games.mood', moods.join('|')); tonightId = null; pickTonight(true); renderMenu(true); }
  else if (act === 'close') closeGame();
  else if (act === 'close-add') addDlg.close();
  else if (act === 'close-acc') accDlg.close();
  else if (act === 'view') { ui.dup = null; setView(t.dataset.v); }
  else if (act === 'meant') { $('#q').value = t.dataset.q; ui.q = t.dataset.q; apply(false); $('#q').focus(); }
  else if (act === 'meant-add') { $('#add-q').value = t.dataset.q; $('#add-form').requestSubmit(); }
  else if (act === 'soon') soonFlip();
  else if (act === 'subf') { ui.dup = null; ui.sub = !ui.sub; t.setAttribute('aria-pressed', String(ui.sub)); apply(false); }
  else if (act === 'reset') { Object.assign(ui, { q: '', plat: '', genre: '', sub: false }); $('#q').value = ''; $('#chips').innerHTML = chipsHTML(); apply(false); }
  else if (act === 'add') { if (accDlg.open) accDlg.close(); openAdd(); }
  else if (act === 'room') toggleEye();                                                                             // العين: ترفع الفلتر أو تعيده (site/adult.js)
  else if (act === 'room-show') { setShowing(!showing()); drawEye(); renderGrid(); soonHTML(); redrawSheet(); }   // أغلفة ألعاب +18 كلها: تُكشف أو تُغطى
  else if (act === 'bare') { uncover(+t.dataset.id); const el = document.getElementById('g-' + t.dataset.id), g = D.byId.get(+t.dataset.id); if (el && g) { el.outerHTML = card(g); apply(false); } redrawSheet(); }   // غلاف هذه اللعبة وحدها (والعلبة الجديدة تأخذ ظهورها من التصفية)
  else if (act === 'accounts') openAccounts();
  else if (act === 'add-pick') askList(t);
  else if (act === 'add-to') addGame(+t.dataset.igdb, t.dataset.v, t);
  else if (act === 'preview') peek(+t.dataset.igdb, t);
  else if (act === 'peek') { if (D.byId.has(id)) openGame(id); else if (pass()) peek(id, t); else { if (sheet.open) closeGame(); openAdd(t.dataset.q || ''); } }
  else if (act === 'pv-add') addGame(+t.dataset.igdb, t.dataset.v, t);
  else if (act === 'cand-open') { addDlg.close(); openGame(+t.dataset.id); }
  else if (act === 'ordv') { ui.ov = t.dataset.v; const box = t.closest('.sec'); $$('[data-act=ordv]', box).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ui.ov))); $$('[data-ov]', box).forEach(el => { el.hidden = el.dataset.ov !== ui.ov; }); }
  else if (act === 'pull') pull(t.dataset.src, t);
  else if (act === 'steam-off') { store.del(STEAM); if (ACC) ACC.steamId = null; drawAcc(); }
  else if (act === 'ib-pick') ibPick(t.dataset.v);
  else if (act === 'ib-back') ibBack();
  else if (act === 'ib-end') { IB.at = IB.items.length; drawIb(); }
  else if (act === 'ib-save') ibSave(t);
  else if (act === 'ib-close') ibDlg.close();
  else if (act === 'ib-find') { ibDlg.close(); openAdd(t.dataset.q); } });
document.addEventListener('change', e => { const s = e.target.closest('select[data-k]'); if (s) { if (s.dataset.k !== 'sort') ui.dup = null; ui[s.dataset.k] = s.value; s.classList.toggle('on', !!s.value || s.dataset.k === 'sort'); apply(s.dataset.k === 'sort'); return; }
  const f = e.target.closest('.save [data-k]'); if (!f || !openId) return; const k = f.dataset.k;
  if (k === 'at') setRec(openId, { at: f.value ? f.value + '-01' : today });
  else if (k === 'h') { const v = Math.max(0, Math.min(99999, Math.round(+f.value))); setRec(openId, { h: f.value === '' ? undefined : v }); }
  refresh(openId); });
let qt; $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { ui.dup = null; ui.q = e.target.value.trim(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); apply(false); }, 140); });
$('#mm-menu').addEventListener('keydown', e => { const b = $$('#mm-menu .mi'), i = b.indexOf(document.activeElement); if (i < 0) return;
  const d = { ArrowDown: 1, ArrowUp: -1, ArrowLeft: 1, ArrowRight: -1 }[e.key]; if (d) { e.preventDefault(); b[(i + d + b.length) % b.length].focus(); } });

// ---------- الإقلاع
const liftVeil = () => { const v = $('#veil'); if (!v || v.hidden) return; requestAnimationFrame(() => requestAnimationFrame(() => { v.classList.add('lift'); setTimeout(() => v.remove(), calm ? 0 : 1000); })); };
function route() { const h = location.hash.slice(1); let m;
  if ((m = h.match(/^g(\d+)$/)) && D.byId.has(+m[1])) openGame(+m[1], false);
  else if ((m = h.match(/^steam=(\d{17})$/))) { store.set(STEAM, m[1]); history.replaceState(null, '', location.pathname); toast('رُبط حسابك في Steam'); openAccounts(); }
  else if (h === 'steam-fail') { history.replaceState(null, '', location.pathname); toast('لم يكتمل الدخول عبر Steam. حاول ثانية.'); openAccounts(); } }
try {
  const cat = await get('games.json'); IMGB = cat.img || IMGB; D.built = cat.built; D.stores = cat.stores || null; D.subs = cat.subs || null; merge(cat);
  // لعبة صُحّح رقمها (مطابقة خاطئة من سحب قديم): سجلها ينتقل إلى رقمها الصحيح مرة واحدة ويُزامَن
  { let mv = false; for (const [o, n] of Object.entries(cat.moved || {})) if (P.games[o]) { P.games[n] ||= P.games[o]; delete P.games[o]; mv = true; } if (mv) save(); }
  // ما حذفته من هذا الجهاز يبقى مخفياً حتى يصل بناء أحدث من حذفه بعشرين دقيقة (فإن بقي فيه فقد أُعيدت إضافته من جهاز آخر)
  const builtAt = Date.parse(cat.built || '') || 0, rm = removedMap(), LAG = 20 * 6e4; let rmN = Object.keys(rm).length;
  for (const id of Object.keys(rm)) if (!(+rm[id] > 0) || builtAt >= +rm[id] + LAG) delete rm[id];
  if (rmN !== Object.keys(rm).length) store.set(REM, JSON.stringify(rm));
  for (const g of cat.games || []) if (!rm[g.id]) register(g);
  // ما أُضيف بالزر أو سُحب من الحسابات ولم يصل البناء بعد يبقى ظاهراً من الحفظ المحلي، ويُحذف منه عند وصوله
  try { const pend = JSON.parse(store.get(PEND) || '[]'), left = [];
    // لعبة في الحفظ المحلي ليست في بناء أحدث من إضافتها بعشرين دقيقة: حُذفت من جهاز آخر، فلا تعود
    const gone = g => rm[g.id] || (g.at && builtAt - Date.parse(g.at) > LAG);
    for (const r of pend) { const list = r?.games || (r?.game ? [r.game] : []), rest = list.filter(g => g && !D.pool.has(g.id) && !gone(g)); if (!rest.length) continue; for (const g of rest) adopt(g, r, false); left.push(r.game ? r : { ...r, games: rest }); }
    store.set(PEND, JSON.stringify(left)); } catch {}
  const last = store.get('games.list'); ui.list = ORDER.includes(last) ? last : inL('play').length ? 'play' : inL('new').length ? 'new' : 'all';
  renderGrid(); renderMenu(false); soonHTML(); liftVeil();
  { const bar = $('.bar'), g = bar.querySelector('.gate'); new IntersectionObserver(([e]) => { const on = !e.isIntersecting; bar.classList.toggle('docked', on); g.tabIndex = on ? 0 : -1; g.setAttribute('aria-hidden', String(!on)); }).observe($('.top')); }
  initSync(id => { if (id !== 'games') return; load(); renderGrid(); renderMenu(false); soonHTML(); if (ui.view === 'series') $('#series').innerHTML = seriesHTML(); if (openId) { const sv = $('#sheet-body .save'), g = D.byId.get(openId); if (sv && g) sv.outerHTML = saveHTML(g); } });
  route(); setTimeout(texts, 1200);
} catch (err) { $('#grid').innerHTML = '<p class="load">تعذّر تحميل القائمة. حدّث الصفحة.</p>'; liftVeil(); console.error(err); }
