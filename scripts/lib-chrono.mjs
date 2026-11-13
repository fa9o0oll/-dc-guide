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
// لا يقدّم جزءاً إلا بقدر ما يلزمه قيد. الجزء الذي يتقدم على جزء صدر قبله «متحرك»، ويُحفظ معه دليله (الجملة ومصدرها)،
// وهو «مؤكد» إن اتفق عليه مصدران. دليل متناقض لا يُطبَّق: يعود الترتيب إلى الصدور.
// زمن القصة وحده لا يرتّب إلا سلسلة كل أجزائها مؤرخة بلا سفر عبر الزمن ولا إعادة إنتاج (Fear Street، Blade Runner)،
// أو جزءاً موصوفاً بأنه سابق للقصة. كلمات TMDB الزمنية تؤكد زمناً ذكرته Wikipedia أو Wikidata ولا تُنشئه.
import { WD_UA, sparql } from './lib-worlds.mjs';

export const WIKI_API = 'https://en.wikipedia.org/w/api.php', WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const chunks = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
const uniq = a => [...new Set(a)];
export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const COUNT = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// حقب معروفة تُذكر بالاسم بدل السنة
const ERAS = [[/\bworld war i\b|\bfirst world war\b|\bthe great war\b/i, 1914, 1918], [/\bworld war ii\b|\bsecond world war\b/i, 1939, 1945], [/\bamerican civil war\b|\bthe civil war\b/i, 1861, 1865],
  [/\bvietnam war\b/i, 1965, 1975], [/\bcuban missile crisis\b/i, 1962, 1962], [/\bkorean war\b/i, 1950, 1953], [/\bgreat depression\b/i, 1930, 1939], [/\bnapoleonic wars?\b/i, 1805, 1815],
  [/\bcold war\b/i, 1947, 1991], [/\bancient egypt\b/i, -3100, -30]];
// ما يجعل زمن القصة غير صالح لترتيب السلسلة كلها: سفر عبر الزمن، خط زمني بديل، إعادة إنتاج أو إطلاق جديد، تجاهل أجزاء سابقة
const BREAK = /\b(?:reboots?|rebooted|remakes?|re-?imagin\w*|time[- ]travel\w*|travels? back in time|(?:sent|goes|go|went|transported) back in time|alternate (?:timeline|reality|universe|history|future)|alternative (?:timeline|reality|history)|parallel universe|multiverse|retcon\w*|ignor\w+ the events)\b/i;

// ---------- قراءة الجمل ----------
// الجمل التي قد تحمل دليلاً من مقدمة Wikipedia (تُحفظ وحدها في الذاكرة، لا المقدمة كلها)
const CUE = new RegExp(/prequel|sequel|interquel|spin-?off|\bset\b|takes? place|years? (?:before|after|prior)|(?:before|after|prior to) the events|origin story|\bduring\b|/.source + BREAK.source, 'i');
// فاصل الجمل: نقطة ثم مسافة ثم حرف كبير، إلا بعد اختصار (Vol. 2، Mr. Smith، U.S.)
const SPLIT = /(?<!\b(?:Vol|Mr|Mrs|Ms|Dr|Jr|Sr|St|No|Pt|vs|Inc|Ltd|U\.S)\.)(?<=[.!?])\s+(?=[A-Z"“(])/;
export const sentences = text => String(text || '').replace(/\s+/g, ' ').split(SPLIT).filter(s => CUE.test(s) && s.length < 700).slice(0, 12);

// حدود العبارة الهدف: تنتهي عند فاصل جملة أو بداية جملة فرعية
const CUT = /;|(?<!\b(?:Vol|Mr|Mrs|Ms|Dr|Jr|Sr|St|No|Pt|vs))\.\s|\.$|,\s+(?:and\s+)?(?:the\s+(?:film|story|series)|it|its|which|who|where|while|starring|directed|written|produced|following|follows|set|serving|making|marking|with|as|in|after|before|was|is)\b|\s+(?:and|but)\s+(?:the|a|an)\s+(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)|final|last)\s+(?:installment|instalment|film|entry|chapter)|\s+(?:and|but)\s+(?:also\s+)?(?:serves|serving|is|was)\b|\s+and\s+(?:also\s+)?(?:a\s+|the\s+)?(?:prequel|sequel|spin-?off|interquel)\b/i;
const clip = s => { const m = s.match(CUT); return (m ? s.slice(0, m.index) : s).trim(); };
const yearsOf = s => [...s.matchAll(/(?<![\d-])(\d{3,4})(?:\s*(BC|BCE|AD|CE))?(?![\ds])/g)].map(m => (m[2] && /BC/.test(m[2]) ? -1 : 1) * +m[1]);
const NOISE = /release|premiere|filmed|filming|scheduled|announced|production|shot|opened|debut|grossed|award/i;

// جملة واحدة ← أدلة: { t: prequel|sequel|between|before|after|year|has-prequel|break, p: العبارة الهدف, y: سنة, framed, subj }
// subj: الجملة تصف عملاً آخر بجملة وصلية («…, X, which is a prequel to Y»)، فالدليل لـX لا لصاحب المقالة
// has-prequel: مقالة العمل تسمّي جزءاً سابقاً له («A prequel, John Rambo, …»، «two prequels: A (2023) and B (2026)»)
export function parseSentence(s) {
  const out = [], t = s.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  let m;
  const subjOf = i => { const r = t.slice(0, i).match(/(?:^|,)\s*([^,]+?),\s+which\s+(?:is|was|serves\s+as|acts\s+as)\s+(?:also\s+)?(?:both\s+)?(?:a|the|an)\s+(?:(?:direct|standalone|spin-?off|legacy)\s+(?:and\s+)?)?$/i); return r ? r[1] : undefined; };
  // خطط ومقترحات لا تصف العمل نفسه: «Plans for a direct sequel to X were put on hold»
  const hedged = i => /\b(?:plans?|planned|proposed|potential|possible|announc\w*|develop\w*|ideas?|pitch\w*|wanting to make|hoped|rumou?red|in favor of)\b[^,.;]{0,40}$/i.test(t.slice(0, i));
  // «both the third sequel and a prequel to X» و«a prequel and sequel to X»: إطار يُروى بعد X وقصته قبله
  if ((m = t.match(/\b(?:both\s+)?(?:(?:the|a)\s+(?:\w+\s+)?)?sequel\s+and\s+(?:also\s+)?(?:a\s+|the\s+)?prequel\s+(?:film\s+)?(?:to|of)\s+(.+)/i))) { if (!hedged(m.index)) out.push({ t: 'prequel', p: m[1], framed: true, subj: subjOf(m.index) }); }
  // prequel(s) to X — ومعها «prequel and spin-off of X»
  else if ((m = t.match(/\bprequels?(\s+and\s+(?:a\s+)?sequel)?(?:\s+and\s+(?:a\s+)?spin-?off)?\s+(?:film\s+|series\s+|story\s+)?(?:to|of)\s+(.+)/i))) { if (!hedged(m.index)) out.push({ t: 'prequel', p: m[2], framed: !!m[1], subj: subjOf(m.index) }); }
  else if (/\b(?:is|was|be|as|serves as)\s+(?:both\s+)?(?:a|the)\s+(?:spin-?off\s+)?prequel\b/i.test(t)) out.push({ t: 'prequel', p: null });
  if ((m = t.match(/\b(?:a|an|one)\s+(?:spin-?off\s+)?prequel(?:\s+film)?(?:,\s+|\s+titled\s+|\s+called\s+)(.+?),?\s+(?:is|was|will\s+be|has\s+been|released|scheduled|set|premiered|followed)\b/i))
    || (m = t.match(/\bprequels?(?:\s+films?)?:\s+(.+)/i))) out.push({ t: 'has-prequel', p: m[1] });
  if ((m = t.match(/\binterquel\b(?:\s+(?:to|between)\s+(.+))?/i))) out.push({ t: 'interquel', p: m[1] || null });
  if (!out.some(x => x.framed) && (m = t.match(/\b(?:standalone\s+|direct\s+|legacy\s+)?(?<!spiritual\s)sequel\s+(?:film\s+|series\s+)?to\s+(.+)/i)) && !hedged(m.index)) out.push({ t: 'sequel', p: m[1], subj: subjOf(m.index) });
  // set between (the events of) A and B
  if ((m = t.match(/\b(?:set|takes?\s+place|occurs?)\s+(?:[a-z]+\s+){0,3}?between\s+(?:the\s+events\s+of\s+)?(.+)/i))) out.push({ t: 'between', p: m[1] });
  // set (a week | ten years | years) before/after (the events of) X — و«ten years prior to the events of X»
  // ومعها المسافة الزمنية إن ذُكرت، لترتيب جزأين يقيسان على العمل نفسه (Solo قبل Star Wars بعشر سنوات، وRogue One قبله بأسبوع)
  if ((m = t.match(/\b(?:set|takes?\s+place|occurs?)\s+(?:(?:about|around|roughly|some|nearly|over|just|shortly|immediately)\s+)?(?:(\d{1,3}(?:,\d{3})+|(?!both\b)\w+)\s+)?(?:(years?|decades?|centuries|century|months?|weeks?|days?|generations?)\s+)?(?:both\s+)?(?:during\s+and\s+)?(before|prior\s+to|after|following)\s+(?:the\s+(?:events|end)\s+of\s+)?(.+)/i))
    || (m = t.match(/(?<![\d,])\b(\d{1,3}(?:,\d{3})+|\w+)\s+(years?|decades?|centuries)\s+(before|prior\s+to|after)\s+the\s+events\s+of\s+(.+)/i))) {
    const before = /before|prior/i.test(m[3]), n = m[2] ? (WORDNUM[String(m[1]).toLowerCase()] ?? (+String(m[1]).replace(/,/g, '') || (/several|few/i.test(m[1]) ? 3 : null))) : null;
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
  // «set seven years before the original film, in 1972»: السنة في آخر جملة الزمن النسبي
  } else if ((m = t.match(/\b(?:set|takes?\s+place)\b[^.;]{0,90}?,\s+in\s+(\d{4})\b(?!\s*[-–]\d)/i)) && !NOISE.test(m[0])) out.push({ t: 'year', y: +m[1] });
  else for (const [re, yr] of ERAS) if (new RegExp('\\b(?:during|amid|in)\\s+(?:the\\s+)?' + re.source.replace(/^\\b/, ''), 'i').test(t)) { out.push({ t: 'year', y: yr }); break; }
  if (BREAK.test(t)) out.push({ t: 'break' });
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
// وصف قبل العنوان يُنزع إن لم يُربط النص كما هو: صاحب بالملكية، وسنة، وصفات، ثم film/movie/series/short
const DESC = /^(?:(?:[A-Z][\w.-]*\s+){0,3}[A-Z][\w.-]*'s\s+)?(?:the\s+)?(?:(\d{4})\s+)?(?:[a-z][a-z-]*\s+){0,3}?(?:film|movie|picture|series|short)\s+(?=[A-Z0-9"'])(.+)$/, OWNER = /^(?:[A-Z][\w.-]*\s+){0,3}[A-Z][\w.-]*'s\s+(?=[A-Z0-9"'])(.+)$/;
export function resolveOne(seg, all, self) {
  const r0 = resolveBare(seg, all, self); if (r0) return r0;
  const s = seg.trim().replace(/[‘’]/g, "'"), d = s.match(DESC) || s.match(OWNER); if (!d) return null;
  const rest = d.length > 2 ? d[2] : d[1], y = d.length > 2 ? d[1] : null;
  return resolveBare(y && !/\(\d{4}/.test(rest) ? `${rest} (${y})` : rest, all, self);
}
function resolveBare(seg, all, self) {
  // مدى سنوات «The Lord of the Rings (2001–2003)» يعني أعمالاً بالاسم صدرت فيه
  let range = null;
  let s = seg.trim().replace(/\s*\((\d{4})\s*[–-]\s*(\d{2,4})\)/g, (_, a, b) => { range = [+a, +(b.length === 2 ? a.slice(0, 2) + b : b)]; return ''; }).replace(/^["']|["']$/g, '').replace(/^(?:the\s+)?events\s+of\s+/i, '').trim(), year = null, m;
  const others = all.filter(x => x.k !== self);
  if ((s.match(/\(\d{4}/g) || []).length > 1) return null; // أكثر من عمل في القطعة، تُربط أجزاؤها كلٌّ وحده
  if ((m = s.match(/\s*\((\d{4})(?:\s+(?:film|movie|series))?\)/))) { year = +m[1]; s = s.replace(m[0], '').trim(); }
  if ((m = s.match(/^(\d{4})['’]s\s+/))) { year = +m[1]; s = s.slice(m[0].length); }
  if ((m = s.match(/^(?:the\s+)?(\d{4})\s+(film|movie|series)\s+/i))) { year = +m[1]; s = s.slice(m[0].length); }
  if ((m = s.match(/\s+(?:film|movie)$/i)) && year) s = s.slice(0, m.index);
  s = s.replace(/^(?:the\s+)?(?:film|movie|novel)\s+/i, '').trim();
  const r = relRef(s, others, self, all); if (r) return r.length ? r : null;
  // السلسلة كلها: «the Harry Potter film series»، «The Purge film series»، «the Predator franchise»
  // ثلاثية/رباعية: أول ثلاثة/أربعة أفلام بالاسم، و«film series» أفلامها فقط (لا المسلسلات التي تحمل الاسم)
  if ((m = s.match(/^(.*?)\s*(film\s+series|film\s+franchise|media\s+franchise|franchise|film\s+saga|series\s+of\s+films|saga|series|(?:film\s+)?trilog(?:y|ies)|(?:film\s+)?quadrilogy)$/i))) {
    const n = norm(m[1]), kind = m[2].toLowerCase(), films = /film|trilog|quadrilogy/.test(kind), cap = /trilog/.test(kind) ? 3 : /quadrilogy/.test(kind) ? 4 : Infinity;
    if (!n) return others.map(x => x.k);
    if (/\b(installment|instalment|entry|film|part|chapter|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(st|nd|rd|th))\b/.test(n)) return null;
    const hit = others.filter(x => norm(x.title).includes(n) && (!films || x.k[0] === 'm') && (!range || (x.year >= range[0] && x.year <= range[1]))).slice(0, cap); return hit.length ? hit.map(x => x.k) : null; }
  const n = norm(s);
  if (range) { const h = n ? others.filter(x => norm(x.title).includes(n) && x.year >= range[0] && x.year <= range[1]) : []; return h.length ? h.map(x => x.k) : null; }
  if (!n) { const y = year ? others.filter(x => x.year === year) : []; return y.length === 1 ? [y[0].k] : null; }
  let hit = others.filter(x => norm(x.title) === n);
  if (!hit.length && (n.includes(' ') || n.length >= 6)) hit = others.filter(x => { const t = norm(x.title); return t.includes(n) || (t.length >= 5 && n.includes(t) && n.split(' ').length - t.split(' ').length <= 2); });
  // السنة المذكورة تحسم العنوان المكرر. تاريخ TMDB قد يتأخر عن عرض المهرجان أو البلد الأول (The Evil Dead: ‏1981 في Wikipedia و1983 في TMDB)،
  // فيُقبل فرق سنتين، وإن لم يقرب أي عمل بالاسم من السنة فلا ربط
  if (year) { if (hit.length) { const d = x => Math.abs((x.year || -9999) - year), ok = hit.filter(x => d(x) <= 2).sort((a, b) => d(a) - d(b)); hit = ok.length ? ok.filter(x => d(x) === d(ok[0])) : []; }
    else hit = others.filter(x => x.year === year && n.split(' ').some(w => w.length > 3 && norm(x.title).includes(w))); }
  // عنوان يتكرر (The Mummy 1932 و1999 و2017) بلا سنة: الأحدث صدوراً قبل صاحب الجملة، فالإشارة عادة إلى ما سبقه مباشرة
  if (hit.length > 1) { const exact = hit.filter(x => norm(x.title) === n), pool = exact.length ? exact : hit, me = all.find(x => x.k === self);
    const before = me?.date ? pool.filter(x => x.date && x.date < me.date) : []; hit = pool.length === 1 ? pool : [before.length ? before[before.length - 1] : pool[0]]; }
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
// spans: مدد زمنية تؤكد زمناً من مصدر آخر ([1980، 1989] لـ1980s)، وyear أقدمها
export const kwSignals = kws => { const k = (kws || []).map(x => String(x).toLowerCase()), spans = [];
  for (const w of k) { let m; if ((m = w.match(/^(\d{3})0s$/))) spans.push([+m[1] * 10, +m[1] * 10 + 9]); else if ((m = w.match(/^(\d{4})$/))) spans.push([+m[1], +m[1]]);
    else if ((m = w.match(/^(\d{1,2})(?:st|nd|rd|th) century$/))) spans.push([(+m[1] - 1) * 100 + 1, +m[1] * 100]);
    else for (const [re, y, z] of ERAS) if (re.test(w)) spans.push([y, z]); }
  return { prequel: k.includes('prequel'), interquel: k.includes('interquel'), spans, year: spans.length ? Math.min(...spans.map(x => x[0])) : null }; };

// ---------- الترتيب ----------
// سنة في العنوان (Fear Street: 1666، Blade Runner 2049، Wonder Woman 1984): أضعف مصادر الزمن، تُستعمل بعد Wikipedia وWikidata
export const titleYear = t => { const m = String(t || '').match(/(?<![\d,.])([12]\d{3})(?![\d,])/); return m ? +m[1] : null; };
// ev[k] = { wiki: رابط المقالة, sents: [جمل], kw: [كلمات], period, periodEnd: مدة زمن القصة من Wikidata, periodLabel }
// opt.wide: عالم واسع (امتياز أو عالم مشترك) قد يجمع استمراريات منفصلة، فالجزء السابق للقصة لا يتقدم إلا على ما يتصل به بجمل صريحة
// يعيد { order: [مفاتيح بترتيب الأحداث], moved: { k: { w: prequel|between|before|sequel|year, ref: [مفاتيح], y, yl, src: [wikipedia|tmdb|wikidata|title], q: [{ s, t, u }] } } }
export function chronoOrder(members, ev = {}, opt = {}) {
  const all = members.map(m => ({ ...m, year: m.year ?? (m.date ? +m.date.slice(0, 4) : null) })).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.k > b.k ? 1 : -1));
  const idx = new Map(all.map((x, i) => [x.k, i])), keys = all.map(x => x.k), ryear = k => +((all[idx.get(k)].date || '').slice(0, 4)) || null;
  const facts = {}, year = {}, ysrc = {}, ylab = {}, flag = {}, kwq = {}; let brk = false;
  const within = (y, lo, hi) => y >= lo - 1 && y <= hi + 1;
  for (const x of all) { const e = ev[x.k] || {}, f = facts[x.k] = [], kw = kwSignals(e.kw);
    for (const s of e.sents || []) for (const st of parseSentence(s)) f.push({ ...st, quote: s, url: e.wiki, own: x.k });
    if (f.some(st => st.t === 'break')) brk = true;
    // زمن القصة: Wikipedia ثم Wikidata ثم العنوان، ويؤكده كل مصدر آخر يقع الزمن في مدته (ومنها كلمات TMDB، التي لا تُنشئ زمناً وحدها)
    const wy = f.find(st => st.t === 'year' && !st.subj)?.y, pend = e.periodEnd ?? e.period, ty = titleYear(x.title);
    if (wy != null) { year[x.k] = wy; ysrc[x.k] = new Set(['wikipedia']); if (e.period != null && within(wy, e.period, pend)) ysrc[x.k].add('wikidata'); }
    else if (e.period != null) { year[x.k] = e.period; ysrc[x.k] = new Set(['wikidata']); if (pend - e.period > 1 && e.periodLabel) ylab[x.k] = e.periodLabel; }
    else if (ty != null) { year[x.k] = ty; ysrc[x.k] = new Set(['title']); }
    if (year[x.k] != null && ty != null && Math.abs(ty - year[x.k]) <= 1) ysrc[x.k].add('title');
    const tk = year[x.k] != null ? (e.kw || []).filter(w => kwSignals([w]).spans.some(([lo, hi]) => within(year[x.k], lo, hi))) : [];
    if (tk.length) { ysrc[x.k].add('tmdb'); kwq[x.k] = tk; }
    flag[x.k] = new Set(kw.prequel || kw.interquel ? ['tmdb'] : []); }
  // القيود: a قبل b. why يربط القيد بدليله. ex: روابط الجمل الصريحة، لمعرفة ما يتصل بكل جزء
  const edges = [], placed = new Map(), seqOf = new Map(), rel = {}, ex = new Map(keys.map(k => [k, new Set([k])]));
  const add = (a, b, why) => { if (a === b || !idx.has(a) || !idx.has(b)) return; edges.push({ a, b, why }); if (why.st) { const A = ex.get(a), B = ex.get(b); if (A !== B) for (const k of B) { A.add(k); ex.set(k, A); } } };
  // جزء يصف نفسه بأنه سابق لعمل ولاحق لآخر (Treadstone: «both a prequel to The Bourne Identity and a sequel to Jason Bourne») قد يكون بخطين زمنيين
  const sides = new Map(), side = (k, v) => sides.set(k, new Set([...(sides.get(k) || []), v]));
  for (const x of all) for (const st of facts[x.k]) {
    // جملة وصلية عن عمل آخر في السلسلة تُنسب إليه («…, Ariel's Beginning, which is a prequel to the first film»)
    let o = x.k; if (st.subj) { const r = resolvePhrase(st.subj, all, x.k); if (r.length === 1) { o = r[0]; st.own = o; } }
    if (st.t === 'has-prequel') { for (const t of resolvePhrase(st.p, all, o)) { add(t, o, { st, ref: [o] }); flag[t].add('wikipedia'); if (!placed.has(t)) placed.set(t, [o]); } continue; }
    const T = st.t === 'between' || st.t === 'interquel' ? null : st.p ? resolvePhrase(st.p, all, o) : [];
    if (st.t === 'prequel' || st.t === 'interquel') flag[o].add('wikipedia');
    if (st.t === 'prequel' || st.t === 'before') {
      // جزء «سابق ولاحق» (إطار يُروى بعد ما قبله) زمنه بعد الأصل: إطاره هو الغالب، فلا يتقدم (Psycho IV في 1990)
      if (st.framed && year[o] != null && T.some(t => year[o] >= (year[t] ?? ryear(t) ?? Infinity))) continue;
      for (const t of T) add(o, t, { st, ref: T }); if (T.length) { placed.set(o, T); side(o, 'pre'); } if (st.off != null && T.length === 1) rel[o] = { t: T[0], off: st.off }; }
    else if (st.t === 'between' || (st.t === 'interquel' && st.p)) { const r = resolveBetween(st.p, all, o); if (r) { const ref = [...r[0], ...r[1]], why = { st, ref, lo: r[0], hi: r[1] }; r[0].forEach(a => add(a, o, why)); r[1].forEach(b => add(o, b, why)); placed.set(o, r[1]); } }
    else if (st.t === 'after' || st.t === 'sequel') { for (const t of T) add(t, o, { st, ref: [o] }); if (T.length) { seqOf.set(o, { T, st }); side(o, 'post'); } if (st.off != null && T.length === 1) rel[o] = { t: T[0], off: st.off }; } }
  // مسافة زمنية عن العمل نفسه: الأبعد قبل الأقرب، وإن عُرف زمن ذلك العمل عُرف زمن هذا
  for (const [a, ra] of Object.entries(rel)) for (const [b, rb] of Object.entries(rel)) if (a !== b && ra.t === rb.t && ra.off < rb.off) add(a, b, { rel: true });
  for (const [k, r] of Object.entries(rel)) if ((year[k] == null || ysrc[k].has('title') && ysrc[k].size === 1) && year[r.t] != null && !ysrc[r.t].has('title')) { year[k] = Math.round(year[r.t] + r.off); ysrc[k] = new Set(ysrc[r.t]); delete ylab[k]; }
  const strong = k => flag[k].size > 0 || placed.has(k), dated = () => all.filter(x => year[x.k] != null);
  // جزء موصوف بأنه سابق للقصة بلا هدف مسمّى، وزمنه معروف، يسبق ما صدر قبله بعد زمنه ولا يُعرف زمنه (يُفترض معاصراً لصدوره):
  // Bumblebee (1987) قبل Transformers (2007). ما رُبط بجملة صريحة («قبل X»، «بين A وB») تكفيه جملته. في العالم الواسع: مما يتصل به بجمل صريحة فقط
  for (const x of dated()) if (flag[x.k].size && !placed.has(x.k)) { const S = all.filter(z => year[z.k] == null && idx.get(z.k) < idx.get(x.k) && (ryear(z.k) || 0) > year[x.k] && (!opt.wide || ex.get(x.k).has(z.k))).map(z => z.k);
    for (const z of S) add(x.k, z, { yr: true, assumed: true }); if (S.length && !placed.has(x.k)) placed.set(x.k, S); }
  // تكملة جزء سابق للقصة تبقى قبل القصة مثله (Fantastic Beasts 2 و3 بعد الأول وقبل Harry Potter، وRise of the Beasts بعد Bumblebee)،
  // إلا ما يُعرف زمنه وهو بعد زمن تلك الأجزاء
  for (let changed = true; changed;) { changed = false;
    for (const [k, { T, st }] of seqOf) { if (placed.has(k)) continue; const p = T.find(t => placed.has(t)); if (!p) continue;
      const S = placed.get(p).filter(s => s !== k && !T.includes(s) && (year[k] == null || (year[s] ?? ryear(s) ?? 0) > year[k])); if (!S.length) continue;
      for (const s of S) add(k, s, { st, ref: S, via: p, inherited: true }); placed.set(k, S); changed = true; } }
  // زمن القصة بين جزأين: في سلسلة كل أجزائها مؤرخة ولا سفر فيها عبر الزمن ولا إعادة إنتاج، أو بين جزأين موصوفين بأنهما سابقان للقصة.
  // غير ذلك لا يرتّب الزمن وحده (أزمنة سلاسل متعددة الاستمرارية، أو مشهد في حقبة أخرى)
  const D = dated(), full = !brk && D.length === all.length;
  for (const a of D) for (const b of D) if (year[a.k] < year[b.k] && (full || (strong(a.k) && strong(b.k)))) add(a.k, b.k, { yr: true });
  // ترتيب طوبولوجي أقرب ما يكون إلى الصدور: يُقدَّم من الجاهز ما يفتح أقدم جزء صدوراً، فلا يتقدم جزء إلا بقدر ما يلزمه قيد
  const topo = list => { const outs = new Map(keys.map(k => [k, []])), into = new Map(keys.map(k => [k, 0]));
    for (const e of list) { outs.get(e.a).push(e.b); into.set(e.b, into.get(e.b) + 1); }
    const deg = new Map(into), stack = keys.filter(k => !deg.get(k)), seen = [];
    while (stack.length) { const k = stack.pop(); seen.push(k); for (const b of outs.get(k)) { deg.set(b, deg.get(b) - 1); if (!deg.get(b)) stack.push(b); } }
    if (seen.length !== keys.length) return null;
    const prio = new Map(); for (const k of seen.reverse()) prio.set(k, Math.min(idx.get(k), ...outs.get(k).map(b => prio.get(b))));
    const ready = keys.filter(k => !into.get(k)), order = [];
    while (ready.length) { ready.sort((a, b) => prio.get(a) - prio.get(b) || idx.get(a) - idx.get(b)); const k = ready.shift(); order.push(k);
      for (const b of outs.get(k)) { into.set(b, into.get(b) - 1); if (!into.get(b)) ready.push(b); } }
    return order; };
  // تناقض: داخل كل حلقة فقط تُترك الأزمنة المفترضة، ثم الأزمنة، ثم جمل الجزء ذي الخطين الزمنيين، ثم كل قيودها، ويبقى ما سواها من الأدلة
  const cyclic = list => { const outs = new Map(keys.map(k => [k, []])); for (const e of list) outs.get(e.a).push(e.b);
    let n = 0; const num = new Map(), low = new Map(), on = new Set(), st = [], comp = new Map();
    const dfs = v => { num.set(v, n); low.set(v, n++); st.push(v); on.add(v);
      for (const w of outs.get(v)) { if (!num.has(w)) { dfs(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), num.get(w))); }
      if (low.get(v) === num.get(v)) { let w; do { w = st.pop(); on.delete(w); comp.set(w, v); } while (w !== v); } };
    for (const k of keys) if (!num.has(k)) dfs(k);
    return e => comp.get(e.a) === comp.get(e.b); };
  let list = edges, order = topo(list);
  const dual = e => e.why.st && sides.get(e.why.st.own)?.size === 2;
  for (const weak of [e => e.why.assumed, e => e.why.yr, dual, () => true]) { if (order) break; const inCycle = cyclic(list); list = list.filter(e => !(inCycle(e) && weak(e))); order = topo(list); }
  order ||= keys;
  // المتحرك: جزء يسبق في الأحداث جزءاً صدر قبله، ومعه دليله ومصادره (المصدر يُحسب إن كان يدل على هذا التقديم نفسه)
  const pos = new Map(order.map((k, i) => [k, i])), moved = {}, kept = new Set(list);
  for (const x of all) { const earlier = all.filter(y => idx.get(y.k) < idx.get(x.k) && pos.get(y.k) > pos.get(x.k)); if (!earlier.length) continue;
    // الدليل: القيود التي تضعه قبل ما تجاوزه مباشرة، وإلا كل قيوده التي تسبق
    const E = edges.filter(e => kept.has(e) && e.a === x.k && e.why.st && pos.get(e.b) > pos.get(x.k)), over = new Set(earlier.map(y => y.k)), Ed = E.filter(e => over.has(e.b));
    const used = uniq((Ed.length ? Ed : E).map(e => e.why)), inh = used.find(u => u.inherited);
    const own = used.find(u => !u.inherited && u.st.own === x.k && u.st.t !== 'has-prequel'), hp = used.find(u => u.st.t === 'has-prequel'), main = own || hp || used.find(u => !u.inherited);
    const w = main ? (main === hp ? 'prequel' : main.st.own === x.k ? (main.st.t === 'interquel' ? 'between' : main.st.t) : 'before') : inh ? 'prequel' : 'year';
    // ما يسبقه بهذا الدليل: أهداف جملته، أو صاحب الجملة إن كانت جملة عمل آخر (تكملة له، أو جزء سابق ذكره، أو «بين» هو طرفها الأول)
    const mine = main && main.st.own === x.k && main.st.t !== 'has-prequel';
    const ref = (mine || (!main && inh) ? (main || inh).ref : main ? uniq((Ed.length ? Ed : E).filter(e => e.why === main).map(e => e.b)) : earlier.map(y => y.k)).slice(0, 4);
    // الزمن دليل على هذا التقديم إن وضعه قبل ما تقدّم عليه (وبين طرفي «بين» إن عُرف زمناهما)
    const Y = year[x.k], btw = mine && main.lo ? main : null;
    const ytrue = Y != null && (w === 'year' || (btw ? btw.lo.every(r => year[r] != null && year[r] < Y) && btw.hi.every(r => year[r] != null && Y < year[r]) : ref.every(r => Y < (year[r] ?? ryear(r) ?? Infinity))));
    const src = new Set([...(main || inh ? ['wikipedia'] : []), ...(['prequel', 'between', 'before'].includes(w) ? flag[x.k] : []), ...(ytrue ? ysrc[x.k] : [])]);
    const q = []; const quote = (t, u) => { if (t && !q.some(z => z.t === t.slice(0, 300))) q.push({ s: 'wikipedia', t: t.slice(0, 300), u }); };
    for (const u of [main, ...used.filter(u => u !== main && !u.inherited)].filter(Boolean)) quote(u.st.quote, u.st.url);
    if (!main && inh) for (const f of facts[inh.via].filter(f => f.t === 'prequel')) quote(f.quote, f.url);
    if (ytrue && ysrc[x.k].has('wikipedia')) { const ys = facts[x.k].find(f => f.t === 'year'); if (ys) quote(ys.quote, ys.url); }
    if (ytrue && ysrc[x.k].has('wikidata')) q.push({ s: 'wikidata', t: `set in period: ${ev[x.k]?.periodLabel || year[x.k]}` });
    const tk = [...(src.has('tmdb') && flag[x.k].has('tmdb') ? (ev[x.k]?.kw || []).filter(k => /^(prequel|interquel)$/i.test(k)) : []), ...(ytrue ? kwq[x.k] || [] : [])];
    if (tk.length) q.push({ s: 'tmdb', t: 'keywords: ' + uniq(tk).join(', ') });
    if (ytrue && ysrc[x.k].has('title')) q.push({ s: 'title', t: all[idx.get(x.k)].title });
    moved[x.k] = JSON.parse(JSON.stringify({ w, ref, via: !main && inh ? inh.via : undefined, y: ytrue ? Y : undefined, yl: ytrue ? ylab[x.k] : undefined, src: [...src], q: q.length ? q.slice(0, 4) : undefined })); }
  return { order, moved };
}

// ---------- جلب الأدلة ----------
// Wikidata: عنصر كل عمل برقمه في TMDB، ومقالته في Wikipedia الإنجليزية، وزمن قصته (P2408) سنةً
export async function wdItems(keys, opt) {
  const out = {};
  for (const kind of ['m', 't']) for (const part of chunks(keys.filter(k => k[0] === kind).map(k => k.slice(1)), 150)) {
    // صف لكل زمن قصة (P2408) بمدته، ويُختار أضيقها: «World War I» لا «20th century»
    const q = `SELECT ?tid ?item ?wiki ?y0 ?y1 ?l0 WHERE {
  VALUES ?tid { ${part.map(x => '"' + x.replace(/\D/g, '') + '"').join(' ')} }
  ?item wdt:${kind === 'm' ? 'P4947' : 'P4983'} ?tid .
  OPTIONAL { ?wiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item wdt:P2408 ?per . OPTIONAL { ?per rdfs:label ?l0 FILTER(LANG(?l0) = "en") }
    OPTIONAL { ?per wdt:P580|wdt:P585|wdt:P571 ?t0 } BIND(YEAR(?t0) AS ?y0) OPTIONAL { ?per wdt:P582 ?t1 } BIND(YEAR(?t1) AS ?y1) }
}`;
    const num = v => v != null && v !== '' && !isNaN(+v) ? +v : undefined, per = {};
    for (const r of await sparql(q, opt)) { const k = kind + r.tid; if (out[k] && out[k].q !== r.item) continue; out[k] ||= { q: r.item, wiki: r.wiki || undefined };
      const y0 = num(r.y0); if (y0 != null) (per[k] ||= []).push({ y0, y1: Math.max(y0, num(r.y1) ?? y0), l: r.l0 }); }
    for (const [k, ps] of Object.entries(per)) { const b = ps.sort((a, c) => (a.y1 - a.y0) - (c.y1 - c.y0) || a.y0 - c.y0)[0]; Object.assign(out[k], JSON.parse(JSON.stringify({ period: b.y0, periodEnd: b.y1, periodLabel: b.l }))); }
  }
  return out;
}
export const wikiTitle = url => { try { return decodeURIComponent(String(url).split('/wiki/')[1] || '').replace(/_/g, ' '); } catch { return ''; } };
// مقدمات مقالات Wikipedia، عشرون في كل طلب. يعيد { عنوان: نص } بالعنوان الذي طُلب (مع التحويلات).
// إن تعذّر طلب المجموعة تُجرَّب واجهة REST لكل عنوان (ملخص المقالة: فقرتها الأولى). failed: عناوين تعذّرت بالطريقتين. onErr: سبب أول تعذّر
export async function wikiIntros(titles, { fetchImpl = fetch, timeout = 20000, failed, onErr = () => {} } = {}) {
  const out = {}, get = async url => { for (let i = 0; i < 3; i++) { try { const r = await fetchImpl(url, { headers: { 'User-Agent': WD_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
      if (r.ok) return await r.json(); onErr(`HTTP ${r.status} ${url.slice(0, 90)}`); if (r.status !== 429 && r.status < 500) return null; } catch (e) { onErr(`${e.name}: ${e.message} ${url.slice(0, 90)}`); }
    await new Promise(r => setTimeout(r, 1500 * (i + 1))); } return null; };
  // قاطع: ثلاثة إخفاقات متتالية تعني أن الخدمة متعذرة الآن، فيُعلَّم الباقي متعذراً بلا طلبات (ويُجلب في البناء التالي)
  let down = 0; const tick = ok => { down = ok ? 0 : down + 1; return ok; };
  for (const part of chunks(uniq(titles.filter(Boolean)), 20)) {
    if (down >= 3) { part.forEach(t => failed?.add(t)); continue; }
    const j = await get(`${WIKI_API}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(part.join('|'))}`);
    if (!tick(!!j?.query)) { if (j?.error) onErr(`API ${j.error.code}: ${j.error.info}`);
      for (const t of part) { if (down >= 3) { failed?.add(t); continue; }
        const r = await get(`${WIKI_REST}${encodeURIComponent(t.replace(/ /g, '_'))}?redirect=true`); if (tick(!!r) && r.extract) out[t] = r.extract; else if (!r) failed?.add(t); }
      continue; }
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
// log: يُبلَّغ بأول خطأ من كل مصدر (يظهر في سجل البناء)
export async function gatherEvidence(keys, { tmdb, cache = {}, opt, concurrency = 8, fetchImpl, log = () => {} } = {}) {
  const need = uniq(keys).filter(k => !cache[k]), ev = {};
  for (const k of keys) if (cache[k]) ev[k] = cache[k];
  if (!need.length) return ev;
  let wdFail = false; const items = await wdItems(need, opt).catch(e => { wdFail = true; log('wikidata failed: ' + String(e.message).slice(0, 300)); return {}; });
  const titles = Object.fromEntries(need.map(k => [k, items[k]?.wiki ? wikiTitle(items[k].wiki) : null])), failed = new Set();
  let wErr = null; const intros = await wikiIntros(Object.values(titles).filter(Boolean), { fetchImpl: fetchImpl || opt?.fetchImpl || fetch, failed, onErr: m => { wErr ||= m; } })
    .catch(e => { Object.values(titles).forEach(t => t && failed.add(t)); log('wikipedia failed: ' + e.message); return {}; });
  if (wErr) log('wikipedia: ' + wErr);
  log(`evidence: wikidata ${Object.keys(items).length}/${need.length}, wikipedia titles ${Object.values(titles).filter(Boolean).length}, intros ${Object.keys(intros).length}`);
  if (failed.size) log(`wikipedia failed for ${failed.size} titles`);

  const kws = {}, kwFail = new Set(); let kwErr = null;
  for (const part of chunks(need, concurrency)) await Promise.all(part.map(async k => { try { kws[k] = await tmdbKeywords(tmdb, k); } catch (e) { kws[k] = []; kwFail.add(k); kwErr ||= e.message; } }));
  if (kwFail.size) log(`tmdb keywords failed for ${kwFail.size} works: ${kwErr}`);
  for (const k of need) { const it = items[k] || {}, t = titles[k], miss = [wdFail && 'wikidata', (wdFail || failed.has(t)) && 'wikipedia', kwFail.has(k) && 'tmdb'].filter(Boolean);
    ev[k] = JSON.parse(JSON.stringify({ wiki: it.wiki, sents: t && intros[t] ? sentences(intros[t]) : [], kw: kws[k]?.length ? kws[k] : undefined, period: it.period, periodEnd: it.periodEnd, periodLabel: it.periodLabel, miss: miss.length ? miss : undefined })); }
  return ev;
}
