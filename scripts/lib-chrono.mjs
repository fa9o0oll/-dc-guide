// «محرّك ترتيب الأحداث»: يستنتج ترتيب أحداث سلسلة من أدلة مكتوبة، لا من التخمين.
// مشترك بين البناء اليومي (scripts/build-worlds.mjs) ودالة «أضف فيلماً» (netlify/functions/add-film.mjs).
//
// مصادر الأدلة، كل منها مستقل عن الآخر:
//   مقدمة Wikipedia لكل جزء: «a prequel to Predator (1987)»، «Set between the events of Saw (2004) and Saw II (2005)»،
//                           «set in the Northern Great Plains in 1719»، «ten years prior to the events of the first Star Wars film (1977)»
//   كلمات TMDB المفتاحية:  prequel وinterquel، وحقبة الأحداث (1980s، 18th century، world war ii…)
//   Wikidata:               زمن القصة (P2408 set in period)
//
// كل دليل يصير قيداً «هذا قبل ذاك». الأجزاء التي لا دليل عليها تبقى بترتيب صدورها، والترتيب النهائي ترتيب طوبولوجي
// يقدّم الأقدم صدوراً عند التساوي. الجزء الذي يتقدم على جزء صدر قبله «متحرك»، ويُحفظ معه دليله (الجملة ومصدرها)،
// وهو «مؤكد» إن اتفق عليه مصدران. دليل متناقض لا يُطبَّق: يعود الترتيب إلى الصدور.
import { WD_UA, sparql } from './lib-worlds.mjs';

export const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const chunks = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
const uniq = a => [...new Set(a)];
export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const COUNT = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// حقب معروفة تُذكر بالاسم بدل السنة
const ERAS = [[/\bworld war i\b|\bfirst world war\b|\bthe great war\b/i, 1914], [/\bworld war ii\b|\bsecond world war\b/i, 1939], [/\bamerican civil war\b|\bthe civil war\b/i, 1861],
  [/\bvietnam war\b/i, 1965], [/\bcuban missile crisis\b/i, 1962], [/\bkorean war\b/i, 1950], [/\bgreat depression\b/i, 1930], [/\bnapoleonic wars?\b/i, 1805], [/\bancient egypt\b/i, -2000]];

// ---------- قراءة الجمل ----------
// الجمل التي قد تحمل دليلاً من مقدمة Wikipedia (تُحفظ وحدها في الذاكرة، لا المقدمة كلها)
const CUE = /prequel|sequel|interquel|spin-?off|\bset\b|takes? place|years? (?:before|after|prior)|(?:before|after|prior to) the events|origin story|\bduring\b/i;
// فاصل الجمل: نقطة ثم مسافة ثم حرف كبير، إلا بعد اختصار (Vol. 2، Mr. Smith، U.S.)
const SPLIT = /(?<!\b(?:Vol|Mr|Mrs|Ms|Dr|Jr|Sr|St|No|Pt|vs|Inc|Ltd|U\.S)\.)(?<=[.!?])\s+(?=[A-Z"“(])/;
export const sentences = text => String(text || '').replace(/\s+/g, ' ').split(SPLIT).filter(s => CUE.test(s) && s.length < 700).slice(0, 12);

// حدود العبارة الهدف: تنتهي عند فاصل جملة أو بداية جملة فرعية
const CUT = /;|(?<!\b(?:Vol|Mr|Mrs|Ms|Dr|Jr|Sr|St|No|Pt|vs))\.\s|\.$|,\s+(?:and\s+)?(?:the\s+(?:film|story|series)|it|its|which|who|where|while|starring|directed|written|produced|following|follows|set|serving|making|marking|with|as|in|after|before|was|is)\b|\s+(?:and|but)\s+(?:the|a|an)\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)|final|last)\s+(?:installment|instalment|film|entry|chapter)|\s+(?:and|but)\s+(?:also\s+)?(?:serves|serving|is|was)\b/i;
const clip = s => { const m = s.match(CUT); return (m ? s.slice(0, m.index) : s).trim(); };
const yearsOf = s => [...s.matchAll(/(?<![\d-])(\d{3,4})(?:\s*(BC|BCE|AD|CE))?(?![\ds])/g)].map(m => (m[2] && /BC/.test(m[2]) ? -1 : 1) * +m[1]);
const NOISE = /release|premiere|filmed|filming|scheduled|announced|production|shot|opened|debut|grossed|award/i;

// جملة واحدة ← أدلة: { t: prequel|sequel|between|before|after|year, p: العبارة الهدف, a, b: طرفا «بين», y: سنة }
export function parseSentence(s) {
  const out = [], t = s.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  let m;
  // prequel to X — ومعها «spin-off of and prequel to» و«prequel and sequel to» (إطار يُروى بعد X وقصته قبله)
  if ((m = t.match(/\bprequel(\s+and\s+(?:a\s+)?sequel)?\s+(?:film\s+|series\s+|story\s+)?(?:to|of)\s+(.+)/i))) out.push({ t: 'prequel', p: m[2], framed: !!m[1] });
  else if (/\b(?:is|was|be|as|serves as)\s+(?:a|the)\s+(?:spin-?off\s+)?prequel\b/i.test(t)) out.push({ t: 'prequel', p: null });
  if ((m = t.match(/\binterquel\b(?:\s+(?:to|between)\s+(.+))?/i))) out.push({ t: 'interquel', p: m[1] || null });
  if (!out.some(x => x.framed) && (m = t.match(/\b(?:standalone\s+|direct\s+|legacy\s+)?(?<!spiritual\s)sequel\s+(?:film\s+|series\s+)?to\s+(.+)/i))) out.push({ t: 'sequel', p: m[1] });
  // set between (the events of) A and B
  if ((m = t.match(/\b(?:set|takes?\s+place|occurs?)\s+(?:[a-z]+\s+){0,3}?between\s+(?:the\s+events\s+of\s+)?(.+)/i))) out.push({ t: 'between', p: m[1] });
  // set (a week | ten years | years) before/after (the events of) X — و«ten years prior to the events of X»
  // ومعها المسافة الزمنية إن ذُكرت، لترتيب جزأين يقيسان على العمل نفسه (Solo قبل Star Wars بعشر سنوات، وRogue One قبله بأسبوع)
  if ((m = t.match(/\b(?:set|takes?\s+place|occurs?)\s+(?:(?:about|around|roughly|some|nearly|over|just|shortly|immediately)\s+)?(?:(\w+)\s+)?(?:(years?|decades?|centuries|century|months?|weeks?|days?|generations?)\s+)?(before|prior\s+to|after|following)\s+(?:the\s+(?:events|end)\s+of\s+)?(.+)/i))
    || (m = t.match(/\b(\w+)\s+(years?|decades?|centuries)\s+(before|prior\s+to|after)\s+the\s+events\s+of\s+(.+)/i))) {
    const before = /before|prior/i.test(m[3]), n = m[2] ? (WORDNUM[String(m[1]).toLowerCase()] ?? (+m[1] || (/several|few/i.test(m[1]) ? 3 : null))) : null;
    const unit = m[2] ? ({ y: 1, d: 10, c: 100, m: 1 / 12, w: 1 / 52, g: 25 }[m[2][0].toLowerCase()] ?? (/^day/i.test(m[2]) ? 1 / 365 : 1)) : null;
    out.push({ t: before ? 'before' : 'after', p: m[4], off: n != null && unit ? (before ? -1 : 1) * n * (/^day/i.test(m[2]) ? 1 / 365 : unit) : undefined }); }
  // زمن القصة: «Set in 1987»، «set primarily in 1962»، «set in the Northern Great Plains in 1719»، «set in the 1920s»، «during World War I»
  if ((m = t.match(/\b(?:is\s+|are\s+)?(?:set|takes?\s+place)\s+(?:primarily\s+|mainly\s+|largely\s+|mostly\s+)?(?:in|during)\s+((?:(?!\b(?:and|but)\s+(?:was|is|were)\b)[^.;])*)/i))) {
    const span = m[1]; let y = null, d;
    const cut = span.search(NOISE), seg = cut < 0 ? span : span.slice(0, cut);
    if ((d = seg.match(/\b(\d{3})0s\b/))) y = +d[1] * 10;
    else if ((d = seg.match(/\b(\d{1,2})(?:st|nd|rd|th)[-\s]century\b/i))) y = (+d[1] - 1) * 100 + 50;
    else { const ys = yearsOf(seg); if (ys.length) y = Math.min(...ys); }
    if (y == null) for (const [re, yr] of ERAS) if (re.test(seg)) { y = yr; break; }
    if (y != null) out.push({ t: 'year', y });
  } else for (const [re, yr] of ERAS) if (new RegExp('\\b(?:during|amid|in)\\s+(?:the\\s+)?' + re.source.replace(/^\\b/, ''), 'i').test(t)) { out.push({ t: 'year', y: yr }); break; }
  return out;
}

// ---------- ربط العبارة بأجزاء السلسلة ----------
// members: [{ k, title, year, date }] مرتبة بالصدور. self: مفتاح العمل صاحب الجملة.
const COUNTWORD = new RegExp(`^(${Object.keys(COUNT).join('|')}|\\d+)$`, 'i');
function relRef(s, others, self, all) {
  let m;
  const named = name => { const n = norm(name); const h = n ? others.filter(x => norm(x.title).includes(n)) : []; return h.length ? h : others; };
  if ((m = s.match(/^(?:its\s+|the\s+)?(?:previous|prior|preceding|earlier|former)\s+(?:(.+?)\s+)?(?:films|movies|installments|instalments|entries|parts)$/i)) || /^its\s+predecessors?$/i.test(s)) {
    const me = all.find(x => x.k === self), pool = named(m?.[1] || ''); return pool.filter(x => me && x.date && me.date && x.date < me.date).map(x => x.k); }
  if ((m = s.match(/^(?:the\s+)?(?:first|original)\s+(\w+)\s+(?:(.+?)\s+)?(?:films|movies|installments|instalments|entries)$/i)) && COUNTWORD.test(m[1])) {
    const n = COUNT[m[1].toLowerCase()] || +m[1]; return named(m[2] || '').slice(0, n).map(x => x.k); }
  if ((m = s.match(/^(?:the\s+)?original\s+(trilogy|series|films|movies)$/i))) return others.slice(0, m[1] === 'trilogy' ? 3 : others.length).map(x => x.k);
  if ((m = s.match(/^(?:the\s+)?(?:first|original)(?:\s+(.+?))?\s+(?:film|movie|installment|instalment|entry|one)$/i)) || /^(?:the\s+)?original$/i.test(s)) { const p = named(m?.[1] || ''); return p.length ? [p[0].k] : null; }
  return null;
}
export function resolveOne(seg, all, self) {
  let s = seg.trim().replace(/^["']|["']$/g, '').replace(/^(?:the\s+)?events\s+of\s+/i, '').trim(), year = null, m;
  const others = all.filter(x => x.k !== self);
  if ((s.match(/\(\d{4}/g) || []).length > 1) return null; // أكثر من عمل في القطعة، تُربط أجزاؤها كلٌّ وحده
  if ((m = s.match(/\s*\((\d{4})(?:\s+(?:film|movie|series))?\)/))) { year = +m[1]; s = s.replace(m[0], '').trim(); }
  if ((m = s.match(/^(\d{4})['’]s\s+/))) { year = +m[1]; s = s.slice(m[0].length); }
  if ((m = s.match(/^(?:the\s+)?(\d{4})\s+(film|movie|series)\s+/i))) { year = +m[1]; s = s.slice(m[0].length); }
  if ((m = s.match(/\s+(?:film|movie)$/i)) && year) s = s.slice(0, m.index);
  s = s.replace(/^(?:the\s+)?(?:film|movie|novel)\s+/i, '').trim();
  const r = relRef(s, others, self, all); if (r) return r.length ? r : null;
  // السلسلة كلها: «the Harry Potter film series»، «The Purge film series»، «the Predator franchise»
  if ((m = s.match(/^(.*?)\s*(?:film\s+series|film\s+franchise|media\s+franchise|franchise|film\s+saga|series\s+of\s+films|saga|series|trilogy|quadrilogy)$/i))) {
    const n = norm(m[1]); if (!n) return others.map(x => x.k);
    if (/\b(installment|instalment|entry|film|part|chapter|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(st|nd|rd|th))\b/.test(n)) return null;
    const hit = others.filter(x => norm(x.title).includes(n)); return hit.length ? hit.map(x => x.k) : null; }
  const n = norm(s);
  if (!n) { const y = year ? others.filter(x => x.year === year) : []; return y.length === 1 ? [y[0].k] : null; }
  let hit = others.filter(x => norm(x.title) === n);
  if (!hit.length && (n.includes(' ') || n.length >= 6)) hit = others.filter(x => { const t = norm(x.title); return t.includes(n) || (t.length >= 5 && n.includes(t) && n.split(' ').length - t.split(' ').length <= 2); });
  if (year) { const y = hit.filter(x => x.year === year); if (y.length) hit = y; else if (!hit.length) hit = others.filter(x => x.year === year && n.split(' ').some(w => w.length > 3 && norm(x.title).includes(w))); }
  if (hit.length > 1) { const exact = hit.filter(x => norm(x.title) === n); hit = exact.length === 1 ? exact : [hit[0]]; }
  return hit.length ? hit.map(x => x.k) : null;
}
// عبارة قد تجمع أكثر من عمل: «Kingsman: The Secret Service (2014) and Kingsman: The Golden Circle (2017)».
// العناوين قد تحوي فواصل و«and» (The Good, the Bad and the Ugly)، فتُجرَّب أطول قطعة يمكن ربطها أولاً.
export function resolvePhrase(phrase, all, self) {
  const p = clip(String(phrase || '')); if (!p) return [];
  const parts = p.split(/(,\s+(?:and\s+)?|\s+and\s+|\s+&\s+)/), segs = [], seps = [];
  parts.forEach((x, i) => (i % 2 ? seps : segs).push(x));
  const out = []; let i = 0;
  while (i < segs.length) { let got = null, j = segs.length;
    for (; j > i; j--) { let s = segs[i]; for (let q = i + 1; q < j; q++) s += seps[q - 1] + segs[q]; const r = resolveOne(s, all, self); if (r) { got = r; break; } }
    if (!got) break; out.push(...got); i = j; }
  return uniq(out);
}
// «between A and B»: كل موضع لـ«and» يُجرَّب حتى يُربط الطرفان
export function resolveBetween(phrase, all, self) {
  const p = clip(String(phrase || '')), at = [...p.matchAll(/\s+and\s+(?:the\s+events\s+of\s+)?/gi)];
  for (const m of at) { const a = resolvePhrase(p.slice(0, m.index), all, self), b = resolvePhrase(p.slice(m.index + m[0].length), all, self); if (a.length && b.length) return [a, b]; }
  return null;
}

// ---------- كلمات TMDB المفتاحية ----------
export const CHRONO_KW = /^(prequel|interquel|sequel|origin story|\d{3}0s|\d{4}|\d{1,2}(st|nd|rd|th) century|world war (i|ii)|american civil war|vietnam war|cold war|cuban missile crisis|korean war|great depression|ancient egypt)$/i;
export const kwSignals = kws => { const k = (kws || []).map(x => String(x).toLowerCase()), years = [];
  for (const w of k) { let m; if ((m = w.match(/^(\d{3})0s$/))) years.push(+m[1] * 10); else if ((m = w.match(/^(\d{4})$/))) years.push(+m[1]); else if ((m = w.match(/^(\d{1,2})(?:st|nd|rd|th) century$/))) years.push((+m[1] - 1) * 100 + 50);
    else for (const [re, y] of ERAS) if (re.test(w)) years.push(y); }
  return { prequel: k.includes('prequel'), interquel: k.includes('interquel'), year: years.length ? Math.min(...years) : null }; };

// ---------- الترتيب ----------
// ev[k] = { wiki: رابط المقالة, sents: [جمل], kw: [كلمات], period: سنة من Wikidata, periodLabel }
// يعيد { order: [مفاتيح بترتيب الأحداث], moved: { k: { w: prequel|between|before|year, ref: [مفاتيح], y, src: [wikipedia|tmdb|wikidata], q: [{ s, t, u }] } } }
export function chronoOrder(members, ev = {}) {
  const all = [...members].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.k > b.k ? 1 : -1));
  const idx = new Map(all.map((x, i) => [x.k, i])), keys = all.map(x => x.k), ryear = k => +((all[idx.get(k)].date || '').slice(0, 4)) || null;
  const facts = {}, year = {}, ysrc = {}, flag = {};
  for (const x of all) { const e = ev[x.k] || {}, f = facts[x.k] = [], kw = kwSignals(e.kw);
    for (const s of e.sents || []) for (const st of parseSentence(s)) f.push({ ...st, quote: s, url: e.wiki });
    const wy = f.find(st => st.t === 'year')?.y;
    if (wy != null) { year[x.k] = wy; ysrc[x.k] = 'wikipedia'; } else if (e.period != null) { year[x.k] = e.period; ysrc[x.k] = 'wikidata'; } else if (kw.year != null) { year[x.k] = kw.year; ysrc[x.k] = 'tmdb'; }
    flag[x.k] = new Set([...(kw.prequel || kw.interquel ? ['tmdb'] : []), ...(f.some(st => st.t === 'prequel') ? ['wikipedia'] : [])]); }
  // القيود: a قبل b. why يربط القيد بدليله
  const edges = [], placed = new Map(), seqOf = new Map(), rel = {}, add = (a, b, why) => { if (a !== b && idx.has(a) && idx.has(b)) edges.push({ a, b, why }); };
  for (const x of all) for (const st of facts[x.k]) {
    const T = st.t === 'between' || st.t === 'interquel' ? null : st.p ? resolvePhrase(st.p, all, x.k) : [];
    if (st.t === 'prequel' || st.t === 'before') { for (const t of T) add(x.k, t, { st, ref: T }); if (T.length) placed.set(x.k, T); if (st.off != null && T.length === 1) rel[x.k] = { t: T[0], off: st.off }; }
    else if (st.t === 'between' || (st.t === 'interquel' && st.p)) { const r = resolveBetween(st.p, all, x.k); if (r) { const ref = [...r[0], ...r[1]]; r[0].forEach(a => add(a, x.k, { st, ref })); r[1].forEach(b => add(x.k, b, { st, ref })); placed.set(x.k, r[1]); } }
    else if (st.t === 'after' || st.t === 'sequel') { for (const t of T) add(t, x.k, { st, ref: T }); if (T.length) seqOf.set(x.k, { T, st }); if (st.off != null && T.length === 1) rel[x.k] = { t: T[0], off: st.off }; } }
  // مسافة زمنية عن العمل نفسه: الأبعد قبل الأقرب، وإن عُرف زمن ذلك العمل عُرف زمن هذا
  for (const [a, ra] of Object.entries(rel)) for (const [b, rb] of Object.entries(rel)) if (a !== b && ra.t === rb.t && ra.off < rb.off) add(a, b, { rel: true });
  for (const [k, r] of Object.entries(rel)) if (year[k] == null && year[r.t] != null) { year[k] = Math.round(year[r.t] + r.off); ysrc[k] = ysrc[r.t]; }
  // جزء موصوف بأنه «prequel» وزمنه معروف يسبق ما صدر قبله بعد زمنه ولا يُعرف زمنه (يُفترض معاصراً لصدوره): Bumblebee (1987) قبل Transformers (2007)
  const dated = () => all.filter(x => year[x.k] != null);
  for (const x of dated()) if (flag[x.k].size || placed.has(x.k)) { const S = all.filter(z => year[z.k] == null && idx.get(z.k) < idx.get(x.k) && (ryear(z.k) || 0) > year[x.k]).map(z => z.k);
    for (const z of S) add(x.k, z, { yr: true, assumed: true }); if (S.length && !placed.has(x.k)) placed.set(x.k, S); }
  // تكملة جزء سابق للقصة تبقى قبل القصة مثله (Fantastic Beasts 2 و3 بعد الأول وقبل Harry Potter، وRise of the Beasts بعد Bumblebee)،
  // إلا ما يُعرف زمنه وهو بعد زمن تلك الأجزاء
  for (let changed = true; changed;) { changed = false;
    for (const [k, { T, st }] of seqOf) { if (placed.has(k)) continue; const p = T.find(t => placed.has(t)); if (!p) continue;
      const S = placed.get(p).filter(s => s !== k && !T.includes(s) && (year[k] == null || (year[s] ?? ryear(s) ?? 0) > year[k])); if (!S.length) continue;
      for (const s of S) add(k, s, { st, ref: S, via: p, inherited: true }); placed.set(k, S); changed = true; } }
  // زمن القصة بين جزأين يُعرف زمناهما
  for (const a of dated()) for (const b of dated()) if (year[a.k] < year[b.k]) add(a.k, b.k, { yr: true });
  // ما لا دليل عليه يبقى بترتيب صدوره فيما بينه: التكملة بعد الأصل
  const free = all.filter(x => !placed.has(x.k) && year[x.k] == null);
  for (let i = 1; i < free.length; i++) add(free[i - 1].k, free[i].k, { chain: true });
  const topo = list => { const into = new Map(keys.map(k => [k, 0])), outs = new Map(keys.map(k => [k, []]));
    for (const e of list) { outs.get(e.a).push(e.b); into.set(e.b, into.get(e.b) + 1); }
    const ready = keys.filter(k => !into.get(k)), order = [];
    while (ready.length) { ready.sort((a, b) => idx.get(a) - idx.get(b)); const k = ready.shift(); order.push(k);
      for (const b of outs.get(k)) { into.set(b, into.get(b) - 1); if (!into.get(b)) ready.push(b); } }
    return order.length === keys.length ? order : null; };
  // تناقض: تُترك الأزمنة المفترضة، ثم كل الأزمنة، ثم يعود كل شيء إلى الصدور
  const order = topo(edges) || topo(edges.filter(e => !e.why.assumed)) || topo(edges.filter(e => !e.why.yr)) || keys;
  // المتحرك: جزء يسبق في الأحداث جزءاً صدر قبله، ومعه دليله
  const pos = new Map(order.map((k, i) => [k, i])), moved = {};
  for (const x of all) { const earlier = all.filter(y => idx.get(y.k) < idx.get(x.k) && pos.get(y.k) > pos.get(x.k)); if (!earlier.length) continue;
    // الأدلة التي قدّمته: قيود يكون فيها هو الأسبق، من جمله هو (أو من سبقه إن كان تكملة لجزء سابق للقصة)
    const used = edges.filter(e => e.a === x.k && e.why.st && facts[x.k].includes(e.why.st)).map(e => e.why), inh = used.find(u => u.inherited), st = used[0]?.st;
    const w = inh ? 'prequel' : st ? (st.t === 'interquel' ? 'between' : st.t) : 'year', ref = (inh?.ref || used[0]?.ref || earlier.map(y => y.k)).slice(0, 4);
    const src = new Set([...(st ? ['wikipedia'] : []), ...(year[x.k] != null ? [ysrc[x.k]] : []), ...flag[x.k]]);
    const q = uniq([...used.map(u => u.st.quote), ...(inh ? facts[inh.via].filter(f => f.t === 'prequel').map(f => f.quote) : [])]).slice(0, 2).map(t => ({ s: 'wikipedia', t: t.slice(0, 300), u: facts[x.k][0]?.url }));
    if (!st && ysrc[x.k] === 'wikipedia') { const ys = facts[x.k].find(f => f.t === 'year'); if (ys) q.push({ s: 'wikipedia', t: ys.quote.slice(0, 300), u: ys.url }); }
    if (ysrc[x.k] === 'wikidata') q.push({ s: 'wikidata', t: `set in period: ${ev[x.k]?.periodLabel || year[x.k]}` });
    if (flag[x.k].has('tmdb')) q.push({ s: 'tmdb', t: 'keyword: prequel' });
    moved[x.k] = JSON.parse(JSON.stringify({ w, ref, via: inh?.via, y: year[x.k] ?? undefined, src: [...src], q: q.length ? q : undefined })); }
  return { order, moved };
}

// ---------- جلب الأدلة ----------
// Wikidata: عنصر كل عمل برقمه في TMDB، ومقالته في Wikipedia الإنجليزية، وزمن قصته (P2408) سنةً
export async function wdItems(keys, opt) {
  const out = {};
  for (const kind of ['m', 't']) for (const part of chunks(keys.filter(k => k[0] === kind).map(k => k.slice(1)), 150)) {
    const q = `SELECT ?tid ?item (SAMPLE(?w) AS ?wiki) (MIN(?py) AS ?py) (SAMPLE(?pl) AS ?pl) WHERE {
  VALUES ?tid { ${part.map(x => '"' + x.replace(/\D/g, '') + '"').join(' ')} }
  ?item wdt:${kind === 'm' ? 'P4947' : 'P4983'} ?tid .
  OPTIONAL { ?w schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item wdt:P2408 ?per . OPTIONAL { ?per rdfs:label ?pl FILTER(LANG(?pl) = "en") } OPTIONAL { ?per wdt:P580|wdt:P585|wdt:P571 ?pt } BIND(YEAR(?pt) AS ?py) }
} GROUP BY ?tid ?item`;
    for (const r of await sparql(q, opt)) { const k = kind + r.tid; if (out[k]) continue; out[k] = JSON.parse(JSON.stringify({ q: r.item, wiki: r.wiki || undefined, period: r.py != null && r.py !== '' ? +r.py : undefined, periodLabel: r.pl || undefined })); }
  }
  return out;
}
export const wikiTitle = url => { try { return decodeURIComponent(String(url).split('/wiki/')[1] || '').replace(/_/g, ' '); } catch { return ''; } };
// مقدمات مقالات Wikipedia، عشرون في كل طلب. يعيد { عنوان: نص } بالعنوان الذي طُلب (مع التحويلات). failed: تُضاف إليها عناوين الطلبات التي تعذّرت
export async function wikiIntros(titles, { fetchImpl = fetch, timeout = 20000, failed } = {}) {
  const out = {};
  for (const part of chunks(uniq(titles.filter(Boolean)), 20)) {
    const url = `${WIKI_API}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(part.join('|'))}`;
    let j = null;
    for (let i = 0; i < 3 && !j; i++) { try { const r = await fetchImpl(url, { headers: { 'User-Agent': WD_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeout) }); if (r.ok) j = await r.json(); else if (r.status !== 429 && r.status < 500) break; } catch {} if (!j) await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    if (!j?.query) { part.forEach(t => failed?.add(t)); continue; }
    const map = new Map(part.map(t => [t, t])); for (const n of [...(j.query.normalized || []), ...(j.query.redirects || [])]) for (const [from, to] of map) if (to === n.from) map.set(from, n.to);
    const byTitle = new Map((j.query.pages || []).map(p => [p.title, p.extract || '']));
    for (const [asked, final] of map) if (byTitle.get(final)) out[asked] = byTitle.get(final);
  }
  return out;
}
// كلمات TMDB المفتاحية التي تخص الزمن فقط (prequel، 1980s…)
export const tmdbKeywords = async (tmdb, key) => { const tv = key[0] === 't', d = await tmdb(`/${tv ? 'tv' : 'movie'}/${key.slice(1)}/keywords`);
  return uniq((tv ? d.results : d.keywords || []).map(x => String(x.name).toLowerCase()).filter(n => CHRONO_KW.test(n))); };

// يجمع الأدلة لمجموعة مفاتيح. cache = { مفتاح: دليل سابق }، يُعاد استعمال ما فيه ويُجلب الباقي فقط.
// miss: المصادر التي تعذّر جلبها لهذا العمل، فلا يُحفظ دليله ولا يُدّعى أنه فُحص (يُعاد جلبه في البناء التالي)
export async function gatherEvidence(keys, { tmdb, cache = {}, opt, concurrency = 8, fetchImpl } = {}) {
  const need = uniq(keys).filter(k => !cache[k]), ev = {};
  for (const k of keys) if (cache[k]) ev[k] = cache[k];
  if (!need.length) return ev;
  let wdFail = false; const items = await wdItems(need, opt).catch(() => { wdFail = true; return {}; });
  const titles = Object.fromEntries(need.map(k => [k, items[k]?.wiki ? wikiTitle(items[k].wiki) : null])), failed = new Set();
  const intros = await wikiIntros(Object.values(titles).filter(Boolean), { fetchImpl: fetchImpl || opt?.fetchImpl || fetch, failed }).catch(() => { Object.values(titles).forEach(t => t && failed.add(t)); return {}; });
  const kws = {}, kwFail = new Set();
  for (const part of chunks(need, concurrency)) await Promise.all(part.map(async k => { try { kws[k] = await tmdbKeywords(tmdb, k); } catch { kws[k] = []; kwFail.add(k); } }));
  for (const k of need) { const it = items[k] || {}, t = titles[k], miss = [wdFail && 'wikidata', (wdFail || failed.has(t)) && 'wikipedia', kwFail.has(k) && 'tmdb'].filter(Boolean);
    ev[k] = JSON.parse(JSON.stringify({ wiki: it.wiki, sents: t && intros[t] ? sentences(intros[t]) : [], kw: kws[k]?.length ? kws[k] : undefined, period: it.period, periodLabel: it.periodLabel, miss: miss.length ? miss : undefined })); }
  return ev;
}
