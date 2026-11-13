// «خريطة العوالم»: يربط كل عمل بعالمه من Wikidata (القاعدة المفتوحة المرتبطة بويكيبيديا) مع TMDB.
// مشترك بين البناء اليومي (scripts/build-worlds.mjs) ودالة «أضف فيلماً» (netlify/functions/add-film.mjs).
//
// الخصائص المستعملة من Wikidata (كل عمل مربوط برقمه في TMDB: P4947 للأفلام و P4983 للمسلسلات):
//   P179  جزء من سلسلة (ومعه P1545 رقمه فيها)    P155 / P156  يسبقه / يليه    P57 المخرج
//   P1434 يقع في عالم قصصي مشترك                P8345 ينتمي إلى امتياز إعلامي
//   P144  مقتبس من (رواية، مانغا، لعبة، مسلسل، فيلم أصلي)    P4969 عمل مشتق منه (عكس P144)
//
// قسمان منفصلان في البطاقة:
//   العالم وترتيب المشاهدة: سلسلة أو عالم أو امتياز يجمع العمل بغيره، أو أعمال يلي بعضها بعضاً.
//   أعمال مرتبطة: الأصل والريميكات، والمسلسل المقتبس عنه أو منه، واقتباسات أخرى للمصدر نفسه، والمصدر نفسه إن كان كتاباً أو لعبة.
// سياسة الاستعلام في Wikidata: User-Agent يعرّف بالمشروع، واستعلام واحد في كل مرة، وإعادة المحاولة بعد مهلة عند 429.
export const WD_ENDPOINT = 'https://query.wikidata.org/sparql';
export const WD_UA = 'dc-guide-films/1.0 (https://github.com/fa9o0oll/-dc-guide; personal watch guide)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- الجلب ----------
// استعلام SPARQL واحد. يعيد صفوفاً مسطّحة { اسم: قيمة نصية }، ومعرّفات العناصر تُختصر إلى Q123.
export async function sparql(query, { timeout = 55000, tries = 4, fetchImpl = fetch } = {}) {
  for (let i = 0; ; i++) {
    let res;
    try {
      res = await fetchImpl(WD_ENDPOINT, { method: 'POST', signal: AbortSignal.timeout(timeout),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json', 'User-Agent': WD_UA },
        body: 'query=' + encodeURIComponent(query) });
    } catch (e) { if (i + 1 >= tries) throw e; await sleep(2000 * (i + 1)); continue; }
    if (res.ok) { const j = await res.json(); return j.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.type === 'uri' ? v.value.replace(/^http:\/\/www\.wikidata\.org\/entity\//, '') : v.value]))); }
    if (i + 1 >= tries || ![429, 500, 502, 503, 504].includes(res.status)) throw new Error(`Wikidata ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    await sleep((+res.headers.get('retry-after') || 0) * 1000 || 3000 * (i + 1));
  }
}
const lit = s => '"' + String(s).replace(/["\\]/g, '') + '"';
const qv = list => list.filter(q => /^Q\d+$/.test(q)).map(q => 'wd:' + q).join(' ');
const chunks = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
const uniq = a => [...new Set(a)];
const csv = s => s ? s.split(',').filter(Boolean) : [];

// ١) علاقات الأعمال: لكل رقم TMDB عنصره في Wikidata، وكل علاقة له في صف { tk, item, prop, o, ord }.
// tk = m123 (فيلم) أو t123 (مسلسل). prop: ITEM P179 P155 P156 P1434 P8345 P144 (مقتبس منه) P144i (مقتبس عنه) P4969 P4969i DIR
export async function relations(keys, opt) {
  const rows = [];
  for (const kind of ['m', 't']) {
    const ids = keys.filter(k => k[0] === kind).map(k => k.slice(1));
    for (const part of chunks(ids, 120)) {
      const q = `SELECT ?tid ?item ?prop ?o ?ord WHERE {
  VALUES ?tid { ${part.map(lit).join(' ')} }
  ?item wdt:${kind === 'm' ? 'P4947' : 'P4983'} ?tid .
  { ?item p:P179 ?st . ?st ps:P179 ?o . OPTIONAL { ?st pq:P1545 ?ord } BIND("P179" AS ?prop) }
  UNION { ?item wdt:P155 ?o . BIND("P155" AS ?prop) } UNION { ?item wdt:P156 ?o . BIND("P156" AS ?prop) }
  UNION { ?item wdt:P1434 ?o . BIND("P1434" AS ?prop) } UNION { ?item wdt:P8345 ?o . BIND("P8345" AS ?prop) }
  UNION { ?item wdt:P144 ?o . BIND("P144" AS ?prop) } UNION { ?o wdt:P144 ?item . BIND("P144i" AS ?prop) }
  UNION { ?item wdt:P4969 ?o . BIND("P4969" AS ?prop) } UNION { ?o wdt:P4969 ?item . BIND("P4969i" AS ?prop) }
  UNION { ?item wdt:P57 ?o . BIND("DIR" AS ?prop) }
  UNION { BIND("ITEM" AS ?prop) }
}`;
      for (const r of await sparql(q, opt)) rows.push({ tk: kind + r.tid, item: r.item, prop: r.prop, o: r.o, ord: r.ord });
    }
  }
  return rows;
}

// ٢) معلومات عناصر: الاسم، رقمه في TMDB، أنواعه (P31، ومعها شكل العمل P7937: رواية، قصة قصيرة، ملحمة…)، أقدم تاريخ صدور، مقالته في ويكيبيديا، ما قبله وما بعده، ومخرجوه.
export async function nodes(list, opt) {
  const out = {};
  for (const part of chunks(uniq(list).filter(q => /^Q\d+$/.test(q)), 120)) {
    const q = `SELECT ?o (SAMPLE(?en) AS ?label) (SAMPLE(?tm) AS ?tm) (SAMPLE(?tt) AS ?tt) (MIN(?d) AS ?date) (SAMPLE(?w) AS ?wiki)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?ty), "entity/"); separator=",") AS ?types)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?pv), "entity/"); separator=",") AS ?prev) (GROUP_CONCAT(DISTINCT STRAFTER(STR(?nx), "entity/"); separator=",") AS ?next)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?dr), "entity/"); separator=",") AS ?dir) WHERE {
  VALUES ?o { ${qv(part)} }
  OPTIONAL { ?o rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?o wdt:P4947 ?tm } OPTIONAL { ?o wdt:P4983 ?tt } OPTIONAL { ?o wdt:P31|wdt:P7937 ?ty } OPTIONAL { ?o wdt:P577 ?d }
  OPTIONAL { ?w schema:about ?o ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?o wdt:P155 ?pv } OPTIONAL { ?o wdt:P156 ?nx } OPTIONAL { ?o wdt:P57 ?dr }
} GROUP BY ?o`;
    for (const r of await sparql(q, opt)) out[r.o] = { label: r.label || null, tm: r.tm ? +r.tm : null, tt: r.tt ? +r.tt : null, date: r.date ? r.date.slice(0, 10) : null,
      wiki: r.wiki || null, types: csv(r.types), prev: csv(r.prev), next: csv(r.next), dir: csv(r.dir) };
  }
  return out;
}

// ٣) أسماء الأنواع (P31) بالإنجليزية، لتصنيف المجموعات والمصادر.
export async function labels(list, opt) {
  const out = {};
  for (const part of chunks(uniq(list).filter(q => /^Q\d+$/.test(q)), 200)) {
    for (const r of await sparql(`SELECT ?t ?l WHERE { VALUES ?t { ${qv(part)} } ?t rdfs:label ?l FILTER(LANG(?l) = "en") }`, opt)) out[r.t] = r.l;
  }
  return out;
}

// ٤) أعضاء مجموعات (سلسلة أو عالم أو امتياز) ممن لهم رقم في TMDB فقط، أي أعمال تُشاهد. الصف: { g, prop, m, tm, tt, ord, date }
export async function members(groups, opt) {
  const rows = [];
  for (const part of chunks(uniq(groups).filter(q => /^Q\d+$/.test(q)), 30)) {
    const q = `SELECT ?g ?prop ?m (SAMPLE(?tm) AS ?tm) (SAMPLE(?tt) AS ?tt) (SAMPLE(?ord) AS ?ord) (MIN(?d) AS ?date) WHERE {
  VALUES ?g { ${qv(part)} }
  { ?m p:P179 ?st . ?st ps:P179 ?g . OPTIONAL { ?st pq:P1545 ?ord } BIND("P179" AS ?prop) }
  UNION { ?m wdt:P1434 ?g . BIND("P1434" AS ?prop) } UNION { ?m wdt:P8345 ?g . BIND("P8345" AS ?prop) }
  OPTIONAL { ?m wdt:P4947 ?tm } OPTIONAL { ?m wdt:P4983 ?tt } OPTIONAL { ?m wdt:P577 ?d }
  FILTER(BOUND(?tm) || BOUND(?tt))
} GROUP BY ?g ?prop ?m`;
    for (const r of await sparql(q, opt)) rows.push({ g: r.g, prop: r.prop, m: r.m, tm: r.tm ? +r.tm : null, tt: r.tt ? +r.tt : null, ord: r.ord || null, date: r.date ? r.date.slice(0, 10) : null });
  }
  return rows;
}

// ٥) اقتباسات مصدر واحد (رواية، مانغا…) ممن لها رقم في TMDB. الصف: { s, x, tm, tt, date }
export async function adaptations(sources, opt) {
  const rows = [];
  for (const part of chunks(uniq(sources).filter(q => /^Q\d+$/.test(q)), 40)) {
    const q = `SELECT ?s ?x (SAMPLE(?tm) AS ?tm) (SAMPLE(?tt) AS ?tt) (MIN(?d) AS ?date) WHERE {
  VALUES ?s { ${qv(part)} }
  ?x wdt:P144 ?s . OPTIONAL { ?x wdt:P4947 ?tm } OPTIONAL { ?x wdt:P4983 ?tt } OPTIONAL { ?x wdt:P577 ?d }
  FILTER(BOUND(?tm) || BOUND(?tt))
} GROUP BY ?s ?x`;
    for (const r of await sparql(q, opt)) rows.push({ s: r.s, x: r.x, tm: r.tm ? +r.tm : null, tt: r.tt ? +r.tt : null, date: r.date ? r.date.slice(0, 10) : null });
  }
  return rows;
}

// معلومات TMDB المختصرة لعمل خارج القائمة (للصورة والتاريخ والتقييم في الترتيب)، مع ما يلزم للتصفية والتصنيف
export const tmdbBasic = async (tmdb, key) => {
  const tv = key[0] === 't', d = await tmdb(`/${tv ? 'tv' : 'movie'}/${key.slice(1)}`, { language: 'en-US' });
  const date = (tv ? d.first_air_date : d.release_date) || null;
  return JSON.parse(JSON.stringify({ title: tv ? d.name : d.title, date, year: date ? +date.slice(0, 4) : null, poster: d.poster_path || null,
    rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null, votes: d.vote_count || 0, adult: d.adult || undefined, lang: d.original_language || null,
    genres: (d.genres || []).map(g => g.id), runtime: tv ? undefined : d.runtime || null, seasons: tv ? d.number_of_seasons || null : undefined, tv: tv || undefined }));
};

// ---------- التصنيف ----------
// أنواع المجموعات: القوائم والتصنيفات وقوائم الجوائز ليست عوالم. فهرس أفلام استوديو (مثل «أفلام والت ديزني») ليس عالماً كذلك.
const NOT_GROUP = /\b(list|category|ranking|award|catalog|filmography|disambiguation|wikimedia)\b/i;
const groupKind = names => { const s = names.join(' ').toLowerCase();
  if (/universe|setting|multiverse|continuity/.test(s)) return 'universe'; if (/franchise|brand|intellectual property/.test(s)) return 'franchise'; return 'series'; };
// نوع المصدر غير المرئي (كتاب، مانغا، لعبة…) من أسماء أنواعه بالإنجليزية. ما لا يُعرف يُهمَل (حدث، شخص، ظاهرة).
// شخصية أو إنسان أو جهة ليست مصدراً يُقتبس منه بهذا المعنى (Jason Bourne «شخصية» لا «فيلم»)
const NOT_SOURCE = /\b(character|human|person|deity|organization|company|band|family|ethnic group)\b/;
export const SOURCE_KIND = [[/manga|manhwa|light novel|webtoon/, 'manga'], [/comic|graphic novel|comics/, 'comic'], [/video game series|game series|video game franchise/, 'games'], [/video game|videogame/, 'game'],
  [/tabletop|role-playing game|board game|card game|toy line|toy/, 'toy'], [/musical/, 'musical'], [/teleplay|television play/, 'teleplay'], [/\bplay\b|stage play|(?<!soap )opera\b|drama work/, 'play'],
  [/epic poem|epic poetry|oral poetry|\bepic\b/, 'epic'], [/fairy tale|folk tale|folktale|legend|myth|poem/, 'tale'], [/short story|novella/, 'story'],
  [/novel sequence|novel series|book series/, 'novels'], [/\bnovel\b/, 'novel'], [/book|literary work|written work|memoir|biography/, 'book'],
  [/article|essay|newspaper|magazine/, 'article'], [/song|album|single/, 'song'], [/television series|tv series|miniseries|television program/, 'tvshow'], [/film series|series of films|short film series/, 'films'], [/film/, 'film']];
const sourceKind = names => { const s = names.join(' ').toLowerCase(); if (NOT_SOURCE.test(s)) return null; for (const [re, k] of SOURCE_KIND) if (re.test(s)) return k; return null; };
const ADULT = /\bxxx\b|porn|parody/i;
// فهارس استوديو أو قوائم «أفضل الأفلام» تُكتب أحياناً كسلسلة في Wikidata
const CATALOG = /feature films?\b|\bfilms$|\bstudios?\b|greatest|best films|top \d+/i;
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').trim();
const firstWord = s => norm(s).split(' ').find(w => w.length > 2 && !/^\d+$/.test(w)) || '';
// تشابه العنوانين: كلمة مميزة مشتركة (Boyka: Undisputed IV ← Undisputed III) أو جذر مشترك (Twister ← Twisters، Freaky ← Freakier)
const STOP = new Set(['part', 'chapter', 'movie', 'film', 'volume', 'story', 'saga', 'with', 'from', 'into', 'this', 'that', 'return', 'returns', 'rise']);
const words = s => norm(s).split(' ').filter(w => w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w) && !/^[ivx]+$/.test(w));
const kin = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a === b || (i >= 5 && i >= Math.min(a.length, b.length) * 0.75); };
const similar = (a, b) => { const fa = firstWord(a); if (fa && fa === firstWord(b)) return true; const B = words(b); return words(a).some(x => B.some(y => kin(x, y))); };

// ---------- التجميع ----------
// يبني الخريطة من نتائج الجلب. نقي بلا شبكة، فيُختبر بمدخلات ثابتة.
// in: { focus: مفاتيح الأعمال المطلوب ربطها (القائمة، أو عمل واحد في الدالة), rel, info, mem, adapt, typeNames: {Q: اسم}, basic: {مفتاح: tmdbBasic} }
// out: { worlds: {id: {name, kind, wd, wiki, order:[مفاتيح], size}}, works: {مفتاح: {q, worlds:[id…], rel:[…], src:[…]}}, info: {مفتاح: basic} , report }
export function assemble({ focus, rel, info, mem, adapt = [], typeNames = {}, basic = {}, maxGroup = 150, maxSiblings = 25, minVotes = 10, relVotes = 20 }) {
  const keyOfQ = new Map(), qOfKey = new Map();
  const bind = (q, k) => { if (!q || !k) return; if (!keyOfQ.has(q) || k[0] === 'm') keyOfQ.set(q, k); if (!qOfKey.has(k)) qOfKey.set(k, q); };
  for (const r of rel) if (r.prop === 'ITEM') bind(r.item, r.tk);
  for (const [q, n] of Object.entries(info)) bind(q, n.tm ? 'm' + n.tm : n.tt ? 't' + n.tt : null);
  for (const r of mem) bind(r.m, r.tm ? 'm' + r.tm : r.tt ? 't' + r.tt : null);
  for (const r of adapt) bind(r.x, r.tm ? 'm' + r.tm : r.tt ? 't' + r.tt : null);
  const bad = k => { const b = basic[k]; return !!(b && (b.adult || ADULT.test(b.title || ''))); };
  // يُعرض ما نعرف اسمه من TMDB، والأعمال المطلوبة نفسها. رقم محذوف أو خاطئ في Wikidata لا يظهر عملاً بلا اسم.
  // وعمل صدر وله أقل من عشرة أصوات في TMDB (فيلم معجبين، أو ربط خاطئ في Wikidata) لا يظهر. ما لم يصدر بعد يظهر.
  const fs = new Set(focus), today = new Date().toISOString().slice(0, 10), shown = k => fs.has(k) || !!basic[k]?.title;
  const heard = (k, n = minVotes) => fs.has(k) || !basic[k]?.date || basic[k].date > today || (basic[k].votes || 0) >= n, fine = k => shown(k) && !bad(k) && heard(k);
  const dateOf = (k, wd) => basic[k]?.date || wd || null;
  const typeList = q => (info[q]?.types || []).map(t => typeNames[t] || t);

  // الأعمال المطلوبة وعلاقاتها المباشرة
  const W = new Map();
  for (const r of rel) { const w = W.get(r.tk) || W.set(r.tk, { q: r.item, groups: [], prev: [], next: [], based: [], derived: [], dir: [] }).get(r.tk);
    if (r.prop === 'P179' || r.prop === 'P1434' || r.prop === 'P8345') w.groups.push({ g: r.o, prop: r.prop, ord: r.ord || null });
    else if (r.prop === 'P155') w.prev.push(r.o); else if (r.prop === 'P156') w.next.push(r.o);
    else if (r.prop === 'P144' || r.prop === 'P4969i') w.based.push(r.o); else if (r.prop === 'P144i' || r.prop === 'P4969') w.derived.push(r.o);
    else if (r.prop === 'DIR') w.dir.push(r.o); }

  // المجموعات: أعضاؤها، نوعها، واستبعاد ما ليس عالماً
  const G = new Map(), report = { excludedGroups: [], chains: 0, rejectedFollows: [] };
  for (const r of mem) { const k = keyOfQ.get(r.m); if (!k) continue; const g = G.get(r.g) || G.set(r.g, new Map()).get(r.g), prev = g.get(k);
    const ord = r.prop === 'P179' && r.ord && /^\d+(\.\d+)?$/.test(r.ord) ? +r.ord : null;
    if (!prev) g.set(k, { k, ord, date: r.date }); else { if (ord != null && (prev.ord == null || ord < prev.ord)) prev.ord = ord; if (r.date && (!prev.date || r.date < prev.date)) prev.date = r.date; } }
  const groupOk = new Map();
  for (const [g, ms] of G) { const names = typeList(g), size = [...ms.keys()].filter(k => !bad(k)).length;
    let why = null;
    if (names.some(n => NOT_GROUP.test(n)) || NOT_GROUP.test(info[g]?.label || '')) why = 'list';
    else if (size > maxGroup) why = 'too-big';
    else if (size > 12 && (CATALOG.test(info[g]?.label || '') || !names.some(n => /film series|series of films|trilogy|franchise|universe|saga/i.test(n)))) why = 'catalog';
    else if (size < 2) why = 'single';
    if (why) { if (why !== 'single') report.excludedGroups.push({ g, name: info[g]?.label, why, size, types: names }); continue; }
    groupOk.set(g, { kind: groupKind(names), size }); }

  // ترتيب أعضاء مجموعة: برقمها في السلسلة إن غطّى معظمها، وإلا بتاريخ الصدور. ما لا تاريخ له آخراً.
  const byOrd = g => { const ms = [...G.get(g).values()].filter(m => fine(m.k)); return ms.filter(m => m.ord != null).length >= ms.length * 0.7; };
  const orderOf = g => { const ms = [...G.get(g).values()].filter(m => fine(m.k)), d = m => dateOf(m.k, m.date) || '9999';
    return ms.sort(byOrd(g) ? (a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || d(a).localeCompare(d(b)) : (a, b) => d(a).localeCompare(d(b)) || (a.k > b.k ? 1 : -1)).map(m => m.k); };
  const worlds = {}, works = {};
  const addWorld = (id, w) => (worlds[id] ||= w);

  // أعمال يلي بعضها بعضاً دون مجموعة: نقبل الرابط إن كان متبادلاً، أو تشابه العنوانان، أو اختلف المخرجان.
  // (بعض صفحات Wikidata تستعمل «يليه» لفيلم المخرج التالي، وهذا ليس تكملة.)
  const followOk = (aK, aQ, bQ) => { const bK = keyOfQ.get(bQ); if (!bK || !fine(bK)) return false;
    const a = info[aQ] || { prev: W.get(aK)?.prev || [], next: W.get(aK)?.next || [], dir: W.get(aK)?.dir || [] }, b = info[bQ] || {};
    const back = (b.prev || []).includes(aQ) || (b.next || []).includes(aQ);
    const ta = basic[aK]?.title || info[aQ]?.label, tb = basic[bK]?.title || info[bQ]?.label, same = similar(ta, tb);
    const da = uniq([...(W.get(aK)?.dir || []), ...(a.dir || [])]), db = b.dir || [], diffDir = da.length && db.length && !da.some(x => db.includes(x));
    const ok = same || diffDir || (back && !(da.length && db.length && da.some(x => db.includes(x))));
    if (!ok) report.rejectedFollows.push({ from: aK, to: bK, a: ta, b: tb }); return ok; };

  for (const k of focus) { const w = W.get(k); if (!w) continue;
    const mine = uniq([...w.groups.map(x => x.g), ...[...G.keys()].filter(g => G.get(g).has(k))]).filter(g => groupOk.has(g) && G.get(g).has(k));
    // الأخصّ أولاً: سلسلة قبل عالم قبل امتياز، والأصغر قبل الأكبر. مجموعة تطابق أعضاؤها أخرى أصغر منها تُحذف.
    // وعالم أو امتياز أصغر من مجموعة أخرى تضمه وسمٌ ناقص في Wikidata (مثل «امتياز جيمس بوند» بأربعة أفلام فقط من خمسة وعشرين)، فلا يُعرض.
    const rank = { series: 0, universe: 1, franchise: 2 }, ord = new Map(mine.map(g => [g, orderOf(g)])), sets = new Map(mine.map(g => [g, new Set(ord.get(g))]));
    const inside = (a, b) => a.size < b.size && [...a].every(x => b.has(x));
    mine.sort((a, b) => sets.get(a).size - sets.get(b).size || rank[groupOk.get(a).kind] - rank[groupOk.get(b).kind]);
    const chosen = [];
    for (const g of mine) { const o = ord.get(g), set = sets.get(g);
      if (o.length < 2 || chosen.some(c => sets.get(c).size === set.size && [...set].every(x => sets.get(c).has(x)))) continue;
      if (groupOk.get(g).kind !== 'series' && mine.some(h => h !== g && inside(set, sets.get(h)))) continue;
      chosen.push(g);
      addWorld(g, { name: info[g]?.label || g, kind: groupOk.get(g).kind, by: byOrd(g) ? 'ord' : 'date', wd: g, wiki: info[g]?.wiki || null, order: o, size: o.length });
      if (chosen.length >= 3) break; }
    const entry = { q: w.q, worlds: chosen };
    // سلسلة متتالية بلا مجموعة
    if (!chosen.length) { const chain = new Set([k]), todo = [[k, w.q]];
      while (todo.length) { const [ck, cq] = todo.pop(); const n = info[cq] || {}, wn = W.get(ck) || {};
        for (const nq of uniq([...(wn.prev || []), ...(wn.next || []), ...(n.prev || []), ...(n.next || [])])) { const nk = keyOfQ.get(nq);
          if (nk && !chain.has(nk) && chain.size < 30 && followOk(ck, cq, nq)) { chain.add(nk); todo.push([nk, nq]); } } }
      if (chain.size > 1) { const o = [...chain].sort((a, b) => (dateOf(a, info[qOfKey.get(a)]?.date) || '9999').localeCompare(dateOf(b, info[qOfKey.get(b)]?.date) || '9999'));
        const id = 'c:' + o[0]; report.chains++;
        addWorld(id, { name: basic[o[0]]?.title || info[qOfKey.get(o[0])]?.label || o[0], kind: 'chain', by: 'date', wd: qOfKey.get(o[0]) || null, wiki: info[qOfKey.get(o[0])]?.wiki || null, order: o, size: o.length });
        entry.worlds = [id]; } }
    // أعمال مرتبطة: الأصل، وما اقتُبس عنه، واقتباسات أخرى للمصدر نفسه، والمصدر نفسه إن لم يكن له رقم في TMDB
    // الأقوى أولاً: ما اقتُبس منه العمل مباشرة، ثم ما اقتُبس عنه (ريميك فيلم 1998 لـ Psycho مقتبس عنه، وليس مجرد اقتباس آخر للرواية)، ثم اقتباسات المصدر الأخرى.
    // وهنا عتبة أعلى للجمهور (٢٠ صوتاً) لأن «مقتبس عن» في Wikidata يشمل أعمالاً مغمورة أو متأثرة فقط
    const relx = [], src = [], seen = new Set([k]), add = (t, r, via) => { if (t && !seen.has(t) && fine(t) && heard(t, relVotes)) { seen.add(t); relx.push(via ? { k: t, r, via } : { k: t, r }); } };
    for (const q of uniq(w.based)) add(keyOfQ.get(q), 'original');
    for (const q of uniq(w.derived)) add(keyOfQ.get(q), 'derived');
    for (const q of uniq(w.based)) { if (keyOfQ.get(q)) continue;
      const kind = sourceKind(typeList(q)); if (!kind || !info[q]?.label) continue;
      src.push(JSON.parse(JSON.stringify({ q, label: info[q].label, kind, year: info[q].date ? +info[q].date.slice(0, 4) : undefined, wiki: info[q].wiki || undefined })));
      // اقتباس آخر من عالم العمل نفسه (أفلام بوند الأخرى عن روايات فليمنغ) مكانه الترتيب لا هنا
      const sibs = adapt.filter(a => a.s === q), same = new Set(entry.worlds.flatMap(id => worlds[id]?.order || []));
      if (sibs.length <= maxSiblings) for (const a of sibs) { const t = keyOfQ.get(a.x); if (!same.has(t)) add(t, 'sibling', info[q].label); } }
    const order = { original: 0, derived: 1, sibling: 2 }, votes = x => basic[x.k]?.votes || 0;
    relx.sort((a, b) => order[a.r] - order[b.r] || votes(b) - votes(a));
    if (relx.length) entry.rel = relx.slice(0, 12); if (src.length) entry.src = src.slice(0, 3);
    if (entry.worlds.length || entry.rel || entry.src) works[k] = entry; }

  // معلومات الأعمال المذكورة (للصورة والتاريخ)، من TMDB
  const used = new Set(); for (const w of Object.values(worlds)) w.order.forEach(k => used.add(k)); for (const w of Object.values(works)) (w.rel || []).forEach(r => used.add(r.k));
  const outInfo = {}; for (const k of used) if (basic[k] && !fs.has(k)) { const { adult, ...b } = basic[k]; outInfo[k] = b; }
  return { worlds, works, info: outInfo, report };
}

// المفاتيح التي يحتاج التجميع معلوماتها من TMDB (أعضاء المجموعات المقبولة مبدئياً والأعمال المرتبطة)
export function neededKeys({ focus, rel, info, mem, adapt = [], typeNames = {}, maxGroup = 150, maxSiblings = 25 }) {
  const out = new Set(), size = {}, per = {};
  for (const r of mem) (size[r.g] ||= new Set()).add(r.m);
  const skip = g => { const names = (info[g]?.types || []).map(t => typeNames[t] || t), n = size[g].size;
    return n > maxGroup || names.some(x => NOT_GROUP.test(x)) || NOT_GROUP.test(info[g]?.label || '') || (n > 12 && (CATALOG.test(info[g]?.label || '') || !names.some(x => /film series|series of films|trilogy|franchise|universe|saga/i.test(x)))); };
  for (const r of mem) if (!skip(r.g)) { const k = r.tm ? 'm' + r.tm : r.tt ? 't' + r.tt : null; if (k) out.add(k); }
  for (const r of adapt) (per[r.s] ||= []).push(r);
  for (const rows of Object.values(per)) if (rows.length <= maxSiblings) for (const r of rows) { const k = r.tm ? 'm' + r.tm : r.tt ? 't' + r.tt : null; if (k) out.add(k); }
  for (const r of rel) if (['P144', 'P144i', 'P4969', 'P4969i', 'P155', 'P156'].includes(r.prop)) { const n = info[r.o]; if (n?.tm) out.add('m' + n.tm); else if (n?.tt) out.add('t' + n.tt); }
  for (const n of Object.values(info)) for (const q of [...(n.prev || []), ...(n.next || [])]) { const m = info[q]; if (m?.tm) out.add('m' + m.tm); else if (m?.tt) out.add('t' + m.tt); }
  for (const k of focus) out.delete(k);
  return [...out];
}

// يجلب كل ما يلزم لمجموعة أعمال ويجمّعه. tmdb = دالة طلب TMDB، وbasicCache قاموس اختياري للأعمال المجلوبة سابقاً.
// keepRaw: يعيد مدخلات التجميع الخام أيضاً (للتدقيق وإعادة التجميع بلا شبكة)
export async function worldsFor(focus, { tmdb, basicCache = {}, known = {}, opt, concurrency = 8, keepRaw = false, onStage = () => {} } = {}) {
  const rel = await relations(focus, opt); onStage('relations', rel.length);
  const groupIds = new Set(), others = new Set();
  for (const r of rel) { if (['P179', 'P1434', 'P8345'].includes(r.prop)) groupIds.add(r.o); else if (r.prop !== 'ITEM' && r.prop !== 'DIR') others.add(r.o); }
  // والأعمال المطلوبة نفسها: اسمها ومخرجوها وما قبلها وما بعدها (تحتاجها السلاسل المتتالية حين لا يُعرف العمل من القائمة، كما في الدالة)
  const own = uniq(rel.filter(r => r.prop === 'ITEM').map(r => r.item));
  const info = await nodes([...groupIds, ...others, ...own], opt); onStage('nodes', Object.keys(info).length);
  // جيران الجيران (ما قبل وما بعد) لمعرفة السلاسل المتتالية خارج القائمة
  const second = uniq(Object.values(info).flatMap(n => [...n.prev, ...n.next])).filter(q => !info[q]);
  if (second.length) Object.assign(info, await nodes(second, opt));
  const mem = await members([...groupIds], opt); onStage('members', mem.length);
  const typeIds = uniq(Object.values(info).flatMap(n => n.types)), typeNames = await labels(typeIds, opt); onStage('types', typeIds.length);
  const srcQ = uniq(rel.filter(r => r.prop === 'P144' || r.prop === 'P4969i').map(r => r.o)).filter(q => info[q] && !info[q].tm && !info[q].tt && sourceKind((info[q].types || []).map(t => typeNames[t] || t)));
  const adapt = srcQ.length ? await adaptations(srcQ, opt) : []; onStage('adaptations', adapt.length);
  // known: معلومات أعمال القائمة نفسها (لا تُجلب ولا تُكتب في الناتج، لكنها تحدد الترتيب والتصفية)
  const need = neededKeys({ focus, rel, info, mem, adapt, typeNames }).filter(k => !known[k]), basic = { ...known };
  let fetched = 0;
  for (const part of chunks(need, concurrency)) await Promise.all(part.map(async k => {
    if (basicCache[k]) return void (basic[k] = basicCache[k]);
    try { basic[k] = await tmdbBasic(tmdb, k); fetched++; } catch {} }));
  onStage('tmdb', fetched);
  return { ...assemble({ focus, rel, info, mem, adapt, typeNames, basic }), basic, ...(keepRaw ? { raw: { rel, info, mem, adapt, typeNames } } : {}) };
}
