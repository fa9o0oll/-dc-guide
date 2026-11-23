// بوابة العالم في «أنمياتي» (E57): كل سلسلة عالمٌ تُفتح بوابته بثيمه (ألوانه ونقش جوّه، site/anime-theme.js) فوق الصفحة كلها:
//   • الواجهة: اسمه وسنواته واستوديوهاته، وأرقامه (أعماله وحلقاته ومدته كلها)، وتقدّمك فيه بحلقة، وزر «كمّل» على ما تشاهده أو أول ما لم تكمله
//   • «عن هذا العالم» و«الحكاية»
//   • الخط الزمني: كل أعماله بترتيب الأحداث (أو الصدور)، الخط الرئيسي على السكة وما سواه فروع منها بألوان أنواعها، وعلى كل محطة شارة موقعها
//     من سلسلتها (site/anime-pos.js) وحالتها في سجلك، و«أنت هنا» على ما تكمله. ودليل الخطوط أعلاه يُظهر خطاً واحداً
//   • العالم بالأرقام: أنواع أعماله، ونهر سنوات صدورها، وأعلاها تقييماً، واستوديوهاته، ومعدل تقييمك له
// تُحمَّل هذه الوحدة وملف تنسيقها حين تُفتح أول بوابة فقط، فلا تثقل «أنمياتي». ونافذتها هي نافذة السلسلة نفسها (#wsheet) بسجلها ورجوعها.
import { themeOf, themeVars } from './anime-theme.js?v=__BUILD__';
let X;   // ما تمرره anime.js: البيانات والسجل وأدوات الكتابة
export const init = ctx => { X = ctx; };
const KIND = { m: 'القصة الرئيسية', s: 'جانبي', f: 'متفرّع', a: 'نسخة أخرى', t: 'عالم بديل', r: 'ملخص', R: 'ملخص' };
const NAME = { 5081: 'Monogatari', 4975: 'Science Adventure' };   // أسماء أعرف من اسم أقدم أعمالها
export const worldName = w => NAME[w.id] || (X.ui.names === 'english' && w.en ? w.en : w.name);
const year = a => a?.y || +String(a?.from || '').slice(0, 4) || 0;
const released = a => a && a.st !== 'soon' && !a.pending;

// ما تكمله في هذا العالم: ما تشاهده الآن، وإلا فأول ما لم تكمله من القصة الرئيسية ثم من غيرها (مما عُرض)، وإلا فبدايته لمن لم يبدأ.
// gap: أول ما لم تكمله من القصة الرئيسية وقد أكملت ما بعده فيها (شاهدت بترتيب الصدور مثلاً، أو تخطيت جزءاً): «فاتك» لا «التالي»
export function nextOf(w) { const { D, me } = X, order = (w.story || w.ids).filter(id => D.by.has(id)), M = X.model(w);
  const watching = order.find(id => me(id)?.s === 'watching'); if (watching) return { id: watching, how: 'watching' };
  const done = id => me(id)?.s === 'completed', started = order.some(done), open = id => !done(id) && me(id)?.s !== 'dropped' && released(D.by.get(id));
  const mainIds = M.lines[0].ids, m1 = mainIds.find(open), pick = m1 || order.find(open); if (!pick) return started ? { id: 0, how: 'done' } : null;
  const gap = !!m1 && mainIds.slice(mainIds.indexOf(m1) + 1).some(done);
  return { id: pick, how: !started ? 'start' : gap ? 'gap' : 'next' }; }
const HOW = { watching: 'كمّل من حيث وقفت', next: 'التالي لك في هذا العالم', gap: 'فاتك من القصة الرئيسية', start: 'ابدأ من هنا' };

// ---------- الواجهة
export function heroHTML(w) { const { D, me, esc, ltr, num, nEps, nWorks, ic } = X, all = w.ids.map(id => D.by.get(id)).filter(Boolean);
  const eps = all.reduce((s, a) => s + (a.eps || 0), 0), min = all.reduce((s, a) => s + (a.dur || 0) * (a.eps || 1), 0), ys = all.map(year).filter(Boolean), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const studios = [...all.reduce((m, a) => a.studio ? m.set(a.studio, (m.get(a.studio) || 0) + 1) : m, new Map())].sort((a, b) => b[1] - a[1]).slice(0, 2).map(s => s[0]);
  const done = all.filter(a => me(a.id)?.s === 'completed').length, seen = all.reduce((s, a) => s + (me(a.id)?.p || 0), 0), mine = all.filter(a => me(a.id)).length, p = all.length ? done / all.length : 0;
  const nx = nextOf(w), na = nx?.id ? D.by.get(nx.id) : null, d = na ? X.pos(w, na.id) : null;
  const cta = !nx ? '' : nx.how === 'done' ? `<p class="gw-done">${ic('check')}<span>أكملت كل ما عُرض من هذا العالم.</span></p>`
    : `<button class="gw-go" data-act="open" data-id="${na.id}"><small>${HOW[nx.how]}</small><b>${d ? d.badge : ''}</b><span dir="ltr">${esc(X.title(na))}</span>${ic('play')}</button>`;
  const R = 34, C = 2 * Math.PI * R, M = X.model(w), stack = M.lines[0].ids.map(id => D.by.get(id)).filter(a => X.poster(a)).slice(0, 3);
  return `<header class="gw-hero">${stack.length ? `<div class="gw-stack" aria-hidden="true">${stack.map((a, i) => `<img alt="" decoding="async" src="${esc(X.poster(a, true))}" style="--i:${i - (stack.length - 1) / 2}">`).join('')}</div>` : ''}
    <h1 class="gw-name" dir="auto">${esc(worldName(w))}</h1>${w.en && worldName(w) !== w.en ? `<p class="gw-en" dir="ltr">${esc(w.en)}</p>` : ''}
    <p class="gw-span">${ys.length ? (y0 === y1 ? y0 : `${y0} إلى ${y1}`) : ''}${studios.length ? ` · ${studios.map(ltr).join('، ')}` : ''}</p>
    <dl class="gw-stats"><div><dt>الأعمال</dt><dd>${num(all.length)}</dd></div>${eps ? `<div><dt>الحلقات</dt><dd>${num(eps)}</dd></div>` : ''}${min ? `<div><dt>مدته كلها</dt><dd>${X.span(min)}</dd></div>` : ''}</dl>
    <div class="gw-me"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${R}" class="trk"/><circle cx="40" cy="40" r="${R}" class="val" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}"/></svg>
      <p>${mine ? `<b>أكملت ${num(done)} من ${nWorks(all.length)}</b><span>${seen ? `شاهدت منه ${nEps(seen)}` : 'لم تبدأ حلقاته بعد'}</span>` : `<b>ليس في قائمتك منه شيء</b><span>ما تضيفه منه يظهر هنا</span>`}</p></div>
    ${cta}</header>`; }

// ---------- الخط الزمني
let view = { order: 'story', line: -1 };
function nodeHTML(w, id, here, rel) { const { D, me, esc, ic, LNAME, poster } = X, a = D.by.get(id), M = X.model(w), L = M.lines[M.lineOf.get(id)], m = me(id), d = X.pos(w, id);
  const meta = [X.typeOf(a), year(a) || '', a.type !== 'Movie' && a.eps ? X.nEps(a.eps) : '', released(a) ? '' : 'لم يُعرض بعد'].filter(Boolean).join(' · ');
  return `<li class="gn${L.i ? ' side' : ''}${m?.s === 'completed' ? ' done' : ''}${here ? ' here' : ''}" data-k="${L.k}" data-l="${L.i}"${a.ac ? ` style="--ac:#${a.ac}"` : ''}>
    <button class="gn-b" data-act="open" data-id="${id}">${poster(a) ? `<img loading="lazy" decoding="async" alt="" src="${esc(poster(a))}">` : `<span class="ph">${esc((a.t.match(/[A-Za-z0-9]/) || ['؟'])[0].toUpperCase())}</span>`}
      <span class="gn-t">${d ? `<b class="gn-k">${d.badge}${d.hint ? `<span> · ${d.hint}</span>` : ''}</b>` : ''}<span class="gn-n" dir="ltr">${esc(X.title(a))}</span><small>${meta}</small>
        ${rel ? `<small class="gn-w">${ic('warp')}${rel}</small>` : ''}</span>
      ${m ? `<span class="chip" data-l="${m.s}">${LNAME[m.s]}${m.r ? ` · ${m.r}` : ''}</span>` : ''}${here ? `<em class="gn-here">${here === 'gap' ? 'فاتك' : here === 'start' ? 'ابدأ هنا' : 'أنت هنا'}</em>` : ''}</button></li>`; }
export function lineHTML(w) { const { D } = X, M = X.model(w), nx = nextOf(w), story = view.order === 'story' && !!w.story;
  const ids = (story ? w.story : w.ids).filter(id => D.by.has(id) && (view.line < 0 || M.lineOf.get(id) === view.line));
  // في ترتيب الأحداث: سنة صدوره بجانب ما صدر بعد ما يليه. وفي ترتيب الصدور: «أحداثه قبل…» على ما صدر بعد عملٍ تسبق أحداثُه أحداثَه
  // (أقرب ما يليه في القصة مما صدر قبله). وما لم يُعرض بعد لا يُقال فيه «صدر»
  const at = new Map((w.story || w.ids).map((id, i) => [id, i]));
  const rel = id => { if (!w.story) return ''; const i = ids.indexOf(id), a = D.by.get(id); if (!released(a)) return '';
    if (story) { const nx2 = D.by.get(ids[i + 1]); return nx2 && year(nx2) && year(a) > year(nx2) ? `صدر بعد ما يليه، عام ${year(a)}` : ''; }
    const after = ids.slice(0, i).filter(x => at.get(x) > at.get(id)).sort((x, y) => at.get(x) - at.get(y))[0]; return after ? `أحداثه قبل ${X.esc(X.title(D.by.get(after)))}` : ''; };
  let lastY = 0;
  return ids.map(id => { const y = year(D.by.get(id)), mark = !story && y && y !== lastY ? `<li class="gy" aria-hidden="true"><span>${y}</span></li>` : ''; if (!story) lastY = y || lastY;
    return mark + nodeHTML(w, id, nx?.id === id && nx.how, rel(id)); }).join(''); }
function legendHTML(w) { const M = X.model(w); if (M.lines.length < 2) return '';
  const chip = (i, name, n, k) => `<button type="button" data-act="gw-line" data-l="${i}" data-k="${k}" aria-pressed="${view.line === i}">${name}<b>${X.num(n)}</b></button>`;
  return `<div class="gw-legend" role="group" aria-label="خطوط العالم" data-drag>${chip(-1, 'كل الخطوط', M.order.filter(id => X.D.by.has(id)).length, 'all')}${M.lines.map(L =>
    chip(L.i, L.i === 0 ? KIND.m : L.ids.length > 1 ? `<bdi dir="ltr">${X.esc(L.name)}</bdi>` : `${KIND[L.k] || 'جانبي'}: <bdi dir="ltr">${X.esc(X.title(X.D.by.get(L.ids[0])))}</bdi>`, L.ids.length, L.k)).join('')}</div>`; }
export function timelineHTML(w) {
  return `<section class="gw-sec gw-line" id="gw-line"><h2>الخط الزمني</h2>
    <div class="gw-tools">${w.story ? `<div class="views" role="group" aria-label="الترتيب"><button data-act="gw-order" data-o="story" aria-pressed="${view.order === 'story'}">ترتيب الأحداث</button><button data-act="gw-order" data-o="release" aria-pressed="${view.order !== 'story'}">ترتيب الصدور</button></div>` : ''}${legendHTML(w)}</div>
    <p class="gw-hint">${w.story ? (view.order === 'story' ? (w.sv ? 'أحداث العالم بتسلسلها الزمني، وراجعناه عملاً عملاً. ' : 'أحداث العالم بتسلسلها من علاقات MyAnimeList: الجزء السابق قبل اللاحق ولو صدر بعده. ') + 'والمعتاد للمشاهدة الأولى ترتيب الصدور.' : 'كما صدرت الأعمال، وهو الترتيب الآمن للمشاهدة الأولى.') : 'ترتيب الأحداث في هذا العالم هو ترتيب صدوره نفسه.'}</p>
    ${w.sn ? `<p class="gw-note">${X.esc(w.sn)}</p>` : ''}<ol class="gw-tl">${lineHTML(w)}</ol></section>`; }

// ---------- العالم بالأرقام
function numbersHTML(w) { const { D, me, num, esc, ltr, typeOf } = X, all = w.ids.map(id => D.by.get(id)).filter(Boolean); if (all.length < 3) return '';
  const types = [...all.reduce((m, a) => m.set(a.type || '', (m.get(a.type || '') || 0) + 1), new Map())].filter(t => t[0]).sort((a, b) => b[1] - a[1]);
  const ys = all.map(year).filter(Boolean), y0 = Math.min(...ys), y1 = Math.max(...ys), per = new Map(); for (const y of ys) per.set(y, (per.get(y) || 0) + 1); const top = Math.max(...per.values());
  const span = y1 - y0 + 1, river = span > 1 && span <= 70 ? `<div class="gw-river" role="img" aria-label="أعماله في كل سنة من ${y0} إلى ${y1}">${Array.from({ length: span }, (_, i) => { const y = y0 + i, n = per.get(y) || 0;
    return `<i style="--h:${n / top}"${n ? ` title="${y}: ${n}"` : ''}></i>`; }).join('')}</div><p class="gw-axis"><span>${y0}</span><span>${y1}</span></p>` : '';
  const best = all.filter(a => a.sc).sort((a, b) => b.sc - a.sc)[0], mineR = all.map(a => me(a.id)?.r).filter(Boolean), avg = mineR.length ? (mineR.reduce((s, r) => s + r, 0) / mineR.length).toFixed(1) : '';
  return `<section class="gw-sec gw-num"><h2>العالم بالأرقام</h2>
    <div class="gw-types">${types.map(([t, n]) => `<span><b>${num(n)}</b>${typeOf({ type: t })}</span>`).join('')}</div>${river}
    <dl class="gw-facts">${best ? `<div><dt>أعلى أعماله تقييماً في ${ltr('MyAnimeList')}</dt><dd><button class="ch-l" data-act="open" data-id="${best.id}" dir="ltr">${esc(X.title(best))}</button> <bdi dir="ltr">${best.sc.toFixed(2)}</bdi></dd></div>` : ''}
      ${avg ? `<div><dt>معدل تقييمك لأعماله</dt><dd><bdi dir="ltr">${avg}</bdi> من 10، في ${X.nWorks(mineR.length)}</dd></div>` : ''}</dl></section>`; }

// ---------- البوابة كلها
export function gateHTML(w) { const t = themeOf(w, X.D.by, X.D.genres);
  return `${X.isFate(w) ? `<a class="wc fate in gw-fate" href="../fate/"><h3>${X.ltr('Fate')}</h3><p>لهذا العالم دليل كامل بخطوط قصته وترتيب مشاهدته. افتحه.</p></a>` : ''}
    ${heroHTML(w)}<div id="gw-about"></div>${timelineHTML(w)}${numbersHTML(w)}`; }
// السماء خلف المحتوى: صورة العالم مموهة ونقشه ووهج لونيه. ثابتة لا تتحرك مع التمرير
export function skyHTML(w) { const t = themeOf(w, X.D.by, X.D.genres), art = X.art(w);
  return `<div class="gw-sky m-${t.motif}${t.sig ? ` sig-${t.sig}` : ''}" aria-hidden="true">${art ? `<div class="gw-art" style="background-image:url('${art}')"></div>` : ''}<div class="motif"></div><div class="gw-glow"></div>${t.sig === 'sea' ? '<svg class="gw-sea" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60q75-30 150 0t150 0 150 0 150 0 150 0 150 0 150 0 150 0V120H0z"/><path d="M0 76q75-26 150 0t150 0 150 0 150 0 150 0 150 0 150 0 150 0V120H0z"/></svg>' : ''}</div>`; }
export const themeStyle = w => themeVars(themeOf(w, X.D.by, X.D.genres));
export const sigOf = w => themeOf(w, X.D.by, X.D.genres).sig || '';
export function aboutHTML(w, x, head) { if (!x?.wa && !x?.ar && !x?.en) return '';
  return `${x.wa ? `<section class="gw-sec gw-about"><h2>عن هذا العالم</h2><p class="ov">${X.esc(x.wa)}</p></section>` : ''}${x.ar || x.en ? `<section class="gw-sec gw-about"><h2>الحكاية</h2><p class="lbl">نبذة ${X.ltr(X.title(head))}، العمل الذي يحمل العالم اسمه.</p>${x.ar ? `<p class="ov">${X.esc(x.ar)}</p>` : `<span class="lbl">النبذة بالإنجليزية من ${X.ltr('MyAnimeList')} (الترجمة العربية قيد الإعداد)</span><p class="ov en">${X.esc(x.en)}</p>`}</section>` : ''}`; }
export const setView = (k, v) => { view[k] = v; };
export const resetView = () => { view = { order: 'story', line: -1 }; };

// ---------- الدخول: البطاقة التي ضُغطت تتسع حتى تملأ الشاشة بلون العالم، ثم تظهر البوابة. ولعالم Monogatari بطاقات نصية سريعة على طريقة Shaft
export function portal(from, w, show) { const t = themeOf(w, X.D.by, X.D.genres), r = from?.getBoundingClientRect?.();
  if (X.calm || !r || !r.width) return show();
  const c = Object.assign(document.createElement('div'), { className: 'gw-portal' }); c.style.cssText = `${themeVars(t)};left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:14px`;
  document.body.append(c); const sx = innerWidth / r.width, sy = innerHeight / r.height;
  const anim = c.animate([{ transform: 'none', borderRadius: '14px' }, { transform: `translate(${-r.left}px,${-r.top}px) scale(${sx},${sy})`, borderRadius: '0' }], { duration: 460, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both', composite: 'replace' });
  c.style.transformOrigin = '0 0';
  anim.finished.then(async () => { if (t.sig === 'cards' && !sessionStorage.getItem('gw.cards.' + w.id)) { try { sessionStorage.setItem('gw.cards.' + w.id, 1); } catch {} await cards(w); }
    show(); c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'both' }).finished.then(() => c.remove()); }); }
// بطاقات Shaft: ثلاث بطاقات ملء الشاشة بالتناوب أسود وأحمر وأبيض، كل واحدة ثلث ثانية تقريباً، بتلاشٍ لا وميض. لمسة تتخطاها
function cards(w) { const words = ['عالم', worldName(w), 'البوابة'], cls = ['k1', 'k2', 'k3'];
  return new Promise(done => { const box = Object.assign(document.createElement('div'), { className: 'gw-cards' }); document.body.append(box); let i = 0, tm;
    const end = () => { clearTimeout(tm); box.remove(); done(); }; box.addEventListener('click', end);
    const step = () => { if (i >= words.length) return end(); box.className = `gw-cards ${cls[i]}`; box.innerHTML = `<b dir="auto">${X.esc(words[i])}</b>`; i++; tm = setTimeout(step, 420); }; step(); }); }
