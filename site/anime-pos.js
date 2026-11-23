// «موقعه من سلسلته» في «أنمياتي»: ما هذا الجزء من سلسلته بجملة واضحة (بداية العالم، الموسم الثاني يكمل أحداث الأول، حلقة خاصة بين موسمين،
// فيلم جانبي، ملخص، نسخة أخرى…)، وما يكمله وما بعده، وخريطة صغيرة لخطه فيها موضعه.
// المصدر خطوط السلسلة في الكتالوج (lk وli وri، يبنيها scripts/lib-anime.mjs: linesOf من علاقات MyAnimeList) ومواسم TMDB لكل عمل (tm.s وإزاحته tm.o).
// تستعمله بطاقة العمل (الجملة كاملة) وصفوف ترتيب السلسلة وخط البوابة الزمني (الشارة وتلميحها).
const UNITS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ONES = ['', 'الحادي', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
const TENS = ['', '', 'العشرون', 'الثلاثون', 'الأربعون', 'الخمسون', 'الستون', 'السبعون', 'الثمانون', 'التسعون'];
// العدد الترتيبي المذكر: الأول، الحادي عشر، الحادي والعشرون
export const ord = n => n <= 10 ? UNITS[n] : n < 20 ? `${ONES[n - 10]} عشر` : n < 100 ? (n % 10 ? `${ONES[n % 10]} و${TENS[n / 10 | 0]}` : TENS[n / 10]) : `رقم ${n}`;
const yrs = n => n === 1 ? 'بسنة' : n === 2 ? 'بسنتين' : n <= 10 ? `بـ${n} سنوات` : `بـ${n} سنة`;
const year = a => a?.y || +String(a?.from || '').slice(0, 4) || 0;
const OVA = '<bdi dir="ltr">OVA</bdi>';
// اسم نوع العمل وجنسه النحوي (لتوافق الفعل: يكمل/تكمل، وهو/وهي)
export const noun = a => { const many = (a?.eps || 0) > 1;
  switch (a?.type) {
    case 'TV': return ['مسلسل', 'm']; case 'Movie': return ['فيلم', 'm'];
    case 'ONA': return many ? ['مسلسل ويب', 'm'] : ['حلقة ويب', 'f'];
    case 'OVA': return [many ? `حلقات ${OVA}` : `حلقة ${OVA}`, 'f'];
    case 'Special': return [many ? 'حلقات خاصة' : 'حلقة خاصة', 'f'];
    case 'TV Special': return [many ? 'حلقات تلفزيونية خاصة' : 'حلقة تلفزيونية خاصة', 'f'];
    case 'Music': return ['فيديو موسيقي', 'm']; case 'PV': return ['عرض ترويجي', 'm']; case 'CM': return ['إعلان', 'm'];
    default: return a?.st === 'soon' || !a?.y ? ['جزء قادم', 'm'] : ['عمل', 'm']; } };
// رقم الموسم إن قاله الاسم: «2nd Season» و«Season 2» و«Second Season» و«S2»
const WORD = { second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
export const titleSeason = t => { if (!t) return null; let m;
  if ((m = t.match(/\b(\d+)(?:st|nd|rd|th)\s+Season\b/i)) || (m = t.match(/\bSeason\s*(\d+)\b/i)) || (m = t.match(/\bS(\d+)\b/))) return +m[1];
  if ((m = t.match(/\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b/i))) return WORD[m[1].toLowerCase()];
  return null; };
// اسم خط فيه أكثر من عمل: ما تشترك فيه أسماء أعماله من أولها (Toaru Kagaku no Railgun، وDragon Ball Z لأفلامه). وإن قلّ المشترك عن كلمتين،
// أو كان اسم السلسلة نفسه في خط ليس كله أفلاماً، فاسم أول أعماله
const bare = w => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export const lineName = (ids, by, world = '') => { const xs = ids.map(id => by.get(id)).filter(Boolean); if (!xs.length) return { name: '', films: false };
  const words = xs.map(a => a.t.split(/\s+/)); let k = 0; while (words.every(w => w[k] && bare(w[k]) === bare(words[0][k]))) k++;
  const films = xs.every(a => a.type === 'Movie');
  let name = words[0].slice(0, k).join(' ').replace(/[\s:–—-]+$/, '').replace(/\s+(?:Movie|Gekijouban|Season|Part)$/i, '').replace(/[\s:–—-]+$/, '');
  if (name.split(/\s+/).length < 2 || (!films && bare(name) === bare(world))) name = xs[0].t;
  return { name, films }; };

// ---------- نموذج السلسلة: ترتيبها وخطوطها وما يُعرَّف به كل عمل ومواسمه. يُحسب مرة لكل سلسلة
const cache = new WeakMap();
export function model(w, by) { let M = cache.get(w); if (M) return M;
  const order = w.story || w.ids, lk = w.lk || 'm', li = w.li || order.map(() => 0), ri = w.ri || order.map(() => -1);
  const lines = [...lk].map((k, i) => ({ k, i, ids: [] })); order.forEach((id, j) => { if (by.has(id)) (lines[li[j]] || lines[0]).ids.push(id); });
  const lineOf = new Map(), refOf = new Map(); for (const L of lines) for (const id of L.ids) lineOf.set(id, L.i);
  order.forEach((id, j) => { if (ri[j] >= 0 && by.has(order[ri[j]])) refOf.set(id, order[ri[j]]); });
  for (const L of lines) if (L.ids.length > 1) Object.assign(L, lineName(L.ids, by, w.name));
  // المواسم: أعمال مسلسل واحد في TMDB بمواسمه العادية، والجزء حين يتقاسم عملان موسماً (بإزاحتهما فيه). ويُترك ترقيم مسلسلٍ يخالف فيه اسمٌ رقمَ موسمه
  // هناك (Monogatari Series: Second Season هو الموسم الثالث في TMDB): ترقيم لا يعرفه المشاهد أضرّ من لا ترقيم
  const shows = new Map(); for (const id of order) { const a = by.get(id), t = a?.tm; if (t?.k === 'tv' && t.s >= 1) (shows.get(t.id) || shows.set(t.id, []).get(t.id)).push(a); }
  const season = new Map(), seasonal = new Set(), at = new Map(order.map((id, i) => [id, i]));
  for (const [show, g] of shows) { if (g.length < 2 && g[0].tm.s < 2) continue; if (g.some(a => { const n = titleSeason(a.t) ?? titleSeason(a.en); return n != null && n !== a.tm.s; })) continue;
    seasonal.add(show); const per = new Map(); for (const a of g) (per.get(a.tm.s) || per.set(a.tm.s, []).get(a.tm.s)).push(a);
    for (const [s, list] of per) { list.sort((x, y) => (x.tm.o || 0) - (y.tm.o || 0) || at.get(x.id) - at.get(y.id)); list.forEach((a, i) => season.set(a.id, { s, part: list.length > 1 ? i + 1 : 0, show })); } }
  // المسلسل الغالب على الخط الرئيسي: نصف أعماله فأكثر مواسمُه. فيه يُسمّى ما ليس له مسلسل في TMDB بنوعه وموضعه بين المواسم
  const counts = new Map(); for (const id of lines[0].ids) { const s = season.get(id); if (s) counts.set(s.show, (counts.get(s.show) || 0) + 1); }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0], spine = top && top[1] * 2 >= lines[0].ids.length ? top[0] : null;
  M = { order, lines, lineOf, refOf, season, seasonal, spine }; cache.set(w, M); return M; }

const label = (M, a) => { const s = M.season.get(a.id); if (s) return { t: s.part ? `الجزء ${ord(s.part)} من الموسم ${ord(s.s)}` : `الموسم ${ord(s.s)}`, g: 'm', season: s };
  const [t, g] = noun(a); return { t, g, season: null }; };
// موضع ما ليس موسماً بين مواسم مسلسله في خطه: «بين الموسمين الثاني والثالث»، «بعد الموسم الأول». يُقاس على مواسم مسلسله في TMDB إن كان منه،
// وعلى المسلسل الغالب على الخط إن لم يكن له مسلسل هناك، وإلا فلا موضع (Dragon Ball Z ليس «قبل الموسم الأول» من Dragon Ball Kai)
export const between = (M, L, id, by) => { const a = by.get(id), show = a?.tm?.k === 'tv' && M.seasonal.has(a.tm.id) ? a.tm.id : !a?.tm ? M.spine : null; if (!show) return '';
  const i = L.ids.indexOf(id), of = x => { const s = M.season.get(x); return s && s.show === show ? s : null; }; let p = null, n = null;
  for (let j = i - 1; j >= 0 && !p; j--) p = of(L.ids[j]);
  for (let j = i + 1; j < L.ids.length && !n; j++) n = of(L.ids[j]);
  if (p && n) return p.s === n.s ? `في منتصف الموسم ${ord(p.s)}` : n.s === p.s + 1 ? `بين الموسمين ${ord(p.s)} و${ord(n.s)}` : `بين الموسم ${ord(p.s)} والموسم ${ord(n.s)}`;
  return p ? `بعد الموسم ${ord(p.s)}` : n ? `قبل الموسم ${ord(n.s)}` : ''; };

// ---------- الجملة. ctx = { by، link(id) زر يفتح العمل، name(w) اسم السلسلة، title(a)، esc، long(a) عمل طويل أو مستمر لا يُقال «يُشاهد بعده» }
// تعيد { badge الشارة، sub ما يجاورها، says الجمل، warp «صدر بعد… لكن أحداثه قبل»، next التالي في خطه، hint تلميح قصير للصفوف، map الخريطة }
export function describe(w, id, ctx) { const { by, link } = ctx, a = by.get(id), M = model(w, by), L = M.lines[M.lineOf.get(id)]; if (!a || !L) return null;
  const i = L.ids.indexOf(id), main = L.i === 0, lb = label(M, a), V = (m, f) => lb.g === 'f' ? f : m, W = ctx.name(w);
  const prev = i > 0 ? L.ids[i - 1] : 0, next = L.ids[i + 1] || 0, ref = M.refOf.get(id) || 0, refIn = !!ref && M.lineOf.get(ref) === L.i;
  // وصف عمل يُذكر: الموسم بلقبه («الموسم الأول ‹Dr. Stone›»)، وغيره باسمه ثم نوعه وموضعه («‹Ryuusui›، وهي حلقة خاصة بين الموسمين الثاني والثالث»).
  // والعمل من خط آخر يُذكر باسمه وحده
  const desc = rid => { const r = by.get(rid), RL = M.lines[M.lineOf.get(rid)]; if (RL !== L) return link(rid); const rl = label(M, r); if (rl.season) return `${rl.t} ${link(rid)}`;
    const pl = between(M, RL, rid, by); return rl.t === 'مسلسل' && !pl ? link(rid) : `${link(rid)}، ${rl.g === 'f' ? 'وهي' : 'وهو'} ${rl.t}${pl ? ` ${pl}` : ''}`; };
  const short = rid => { const r = by.get(rid), s = M.lineOf.get(rid) === L.i && M.season.get(rid); return s ? label(M, r).t : `<bdi dir="ltr">${ctx.esc(ctx.title(r))}</bdi>`; };
  const nth = j => L.films ? `الفيلم ${ord(j + 1)}` : `الجزء ${ord(j + 1)}`;
  let badge = '', sub = '', warp = '', hint = ''; const says = [];
  const continues = () => { if (refIn && ref === prev) { says.push(`${V('يكمل', 'تكمل')} أحداث ${desc(ref)}.`); hint = `${V('يكمل', 'تكمل')} ${short(ref)}`; }
    else if (refIn) { says.push(`${V('يكمل', 'تكمل')} أحداث ${desc(ref)}، ${V('ويأتي', 'وتأتي')} في ترتيب الأحداث بعد ${desc(prev)}.`); hint = `بعد ${short(prev)}`; }
    else { says.push(`${V('يأتي', 'تأتي')} في ترتيب الأحداث بعد ${desc(prev)}.`); hint = `بعد ${short(prev)}`; }
    const p = by.get(prev); if (year(a) && year(p) > year(a)) warp = `${V('صدر', 'صدرت')} قبل ${link(prev)} ${yrs(year(p) - year(a))}، لكن ${V('أحداثه', 'أحداثها')} تأتي بعده.`; };
  if (main && i === 0) {
    badge = M.order.find(x => by.has(x)) === id ? 'بداية العالم' : 'بداية القصة الرئيسية'; sub = lb.season || lb.t === 'مسلسل' ? '' : lb.t;
    says.push(lb.season ? `${lb.t} من ${W}، ومنه تبدأ القصة.` : `${V('أول', 'أولى')} أجزاء ${W}${w.story ? ' بترتيب الأحداث' : ''}، ${V('ومنه', 'ومنها')} تبدأ القصة.`);
    const first = L.ids.map(x => by.get(x)).filter(x => year(x)).sort((x, y) => year(x) - year(y))[0];
    if (first && first.id !== id && year(a) > year(first)) warp = `${V('صدر', 'صدرت')} بعد ${link(first.id)} ${yrs(year(a) - year(first))}، لكن ${V('أحداثه تسبقه', 'أحداثها تسبقه')}.`;
  } else if (main) {
    const pl = lb.season ? '' : between(M, L, id, by);
    if (lb.season) badge = lb.t; else if (pl || (M.spine && !a.tm)) { badge = lb.t; sub = pl; } else { badge = `الجزء ${ord(i + 1)} من القصة`; sub = lb.t === 'مسلسل' ? '' : lb.t; }
    continues(); if (pl) hint = pl;
  } else {
    const parent = M.refOf.get(L.ids[0]) || 0, many = L.ids.length > 1, K = L.k, P = parent ? link(parent) : W, LN = many ? `<bdi dir="ltr">${ctx.esc(L.name)}</bdi>` : '';
    const G = many ? 'f' : lb.g, F = (m, f) => G === 'f' ? f : m, inMain = !!parent && M.lineOf.get(parent) === 0, from = parent ? `من ${short(parent)}` : '';
    const KIND = { s: many ? (L.films ? 'أفلام جانبية' : 'سلسلة جانبية') : a.type === 'Movie' ? 'فيلم جانبي' : a.type === 'TV' ? 'مسلسل جانبي' : 'قصة جانبية',
      f: many ? 'سلسلة متفرّعة' : 'عمل متفرّع', a: 'نسخة أخرى من القصة', t: 'عالم بديل', r: 'ملخص', R: 'ملخص' }, kind = KIND[K] || KIND.s;
    if (i === 0) { const after = K === 's' && parent && !ctx.long(by.get(parent)) ? `، ${F('ويُشاهد', 'وتُشاهد')} بعده` : '';
      badge = many && L.films ? nth(0) : kind; sub = many ? (L.films ? `${kind}: ${LN}` : LN) : /^(?:فيلم|مسلسل) جانبي$/.test(badge) ? '' : lb.t;
      if (K === 'r') { says.push(`${F('يلخّص', 'تلخّص')} أحداث ${P}، ويمكن ${F('تخطيه', 'تخطيها')} إن شاهدته.`); hint = parent ? `يلخّص ${short(parent)}` : ''; }
      else if (K === 'R') { says.push(`${F('يلخّص', 'تلخّص')} أحداث القصة من أولها حتى ${P}، ويمكن ${F('تخطيه', 'تخطيها')} إن شاهدتها.`); hint = parent ? `يلخّص حتى ${short(parent)}` : ''; }
      else if (K === 'a') { says.push(`${F('يعيد', 'تعيد')} حكاية ${P} بمعالجة أخرى، ${F('فليس تكملة له', 'فليست تكملة له')}.`); hint = from; }
      else if (K === 't') { says.push(`شخصيات ${P} في عالم آخر أو ظروف أخرى، بقصة مستقلة عنه.`); hint = from; }
      else if (K === 'f') { says.push(`${F('متفرّع', 'متفرّعة')} من ${P}، ${F('بقصة خاصة به', 'بقصتها الخاصة')}.`); hint = from; }
      else if (!inMain && parent) { says.push(`${F('مرتبط', 'مرتبطة')} بـ${P}${after}.`); hint = from; }
      else { says.push(many ? `من عالم ${P}، بقصتها الخاصة، ولا تلزم لفهم قصته الرئيسية${after}.` : `من ${P}، ${F('وأحداثه', 'وأحداثها')} خارج تسلسل قصته الرئيسية، فلا ${F('يلزم', 'تلزم')} لفهمها${after}.`); hint = from; }
    } else {
      const pl = lb.season ? '' : between(M, L, id, by); badge = lb.season ? lb.t : pl ? lb.t : nth(i); sub = pl || (L.films ? `${kind}: ${LN}` : LN); continues(); if (pl) hint = pl;
      const whose = K === 'a' ? `تعيد حكاية ${P}` : K === 'f' ? `متفرّعة من ${P}` : K === 's' && !inMain ? `مرتبطة بـ${P}` : `في عالم ${P}`;
      if (parent) says.push(`${L.films && K === 's' ? 'من الأفلام الجانبية' : `من ${pl && LN ? `${kind} ${LN}` : kind}`} ${whose}.`);
    }
  }
  // الخريطة: الخط الرئيسي ونقطة العمل فيه، أو فرعه معلّقاً تحت أصله
  const mainIds = M.lines[0].ids, branch = main ? null : { from: mainIds.indexOf(M.refOf.get(L.ids[0]) || 0), ids: L.ids, at: i };
  // التالي في الخط: نوعه أو لقب موسمه وموضعه، ثم اسمه (بلا فاصلة تتيه حين يطول الاسم)
  const nx = next ? (() => { const r = by.get(next), rl = label(M, r), pl = rl.season ? '' : between(M, L, next, by); return { id: next, kind: `${rl.t}${pl ? ` ${pl}` : ''}` }; })() : null;
  return { badge, sub, says, warp, hint, next: nx, map: { ids: mainIds, at: main ? i : -1, branch }, kind: L.k, main, line: L };
}
