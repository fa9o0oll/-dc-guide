// «خريطة العوالم»: يربط كل عمل بعالمه من Wikidata (القاعدة المفتوحة المرتبطة بويكيبيديا) مع TMDB.
// مشترك بين البناء اليومي (scripts/build-worlds.mjs) ودالة «أضف فيلماً» (netlify/functions/add-film.mjs).
//
// الخصائص المستعملة من Wikidata (كل عمل مربوط برقمه في TMDB: P4947 للأفلام و P4983 للمسلسلات):
//   P179  جزء من سلسلة (ومعه P1545 رقمه في السلسلة)     P155 / P156  يسبقه / يليه
//   P1434 يقع في عالم قصصي مشترك                        P8345 ينتمي إلى امتياز إعلامي
//   P144  مقتبس من (رواية، مانغا، لعبة، مسلسل، فيلم أصلي)  P4969 عمل مشتق منه (عكس P144)
//   P4086 رقمه في MyAnimeList
// سياسة الاستعلام في Wikidata: User-Agent يعرّف بالمشروع، واستعلام واحد في كل مرة، وإعادة المحاولة بعد مهلة عند 429.
export const WD_ENDPOINT = 'https://query.wikidata.org/sparql';
export const WD_UA = 'dc-guide-films/1.0 (https://github.com/fa9o0oll/-dc-guide; personal watch guide)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
const qids = list => list.filter(q => /^Q\d+$/.test(q)).map(q => 'wd:' + q).join(' ');
const chunks = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

// ١) علاقات الأعمال: لكل رقم TMDB عنصره في Wikidata، وكل علاقة له في صف { tk, item, prop, o, ord }.
// tk = m123 (فيلم) أو t123 (مسلسل). prop: P179 P155 P156 P1434 P8345 P144 (مقتبس منه) P144i (مقتبس منه غيره) P4969 P4969i MAL
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
  UNION { ?item wdt:P4086 ?o . BIND("MAL" AS ?prop) }
  UNION { BIND("ITEM" AS ?prop) }
}`;
      for (const r of await sparql(q, opt)) rows.push({ tk: kind + r.tid, item: r.item, prop: r.prop, o: r.o, ord: r.ord });
    }
  }
  return rows;
}

// ٢) معلومات عناصر: اسمها بالإنجليزية والعربية، أرقامها في TMDB، أنواعها (P31)، أقدم تاريخ صدور، مقالتها في ويكيبيديا،
// وما فوقها مباشرة (سلسلة أكبر أو امتياز) لمعرفة العالم الأوسع.
export async function nodes(list, opt) {
  const out = {};
  for (const part of chunks([...new Set(list)].filter(q => /^Q\d+$/.test(q)), 150)) {
    const q = `SELECT ?o (SAMPLE(?en) AS ?label) (SAMPLE(?ar) AS ?labelAr) (SAMPLE(?tm) AS ?tm) (SAMPLE(?tt) AS ?tt)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?ty), "entity/"); separator=",") AS ?types) (MIN(?d) AS ?date) (SAMPLE(?w) AS ?wiki)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?up), "entity/"); separator=",") AS ?up) WHERE {
  VALUES ?o { ${qids(part)} }
  OPTIONAL { ?o rdfs:label ?en FILTER(LANG(?en) = "en") } OPTIONAL { ?o rdfs:label ?ar FILTER(LANG(?ar) = "ar") }
  OPTIONAL { ?o wdt:P4947 ?tm } OPTIONAL { ?o wdt:P4983 ?tt } OPTIONAL { ?o wdt:P31 ?ty } OPTIONAL { ?o wdt:P577 ?d }
  OPTIONAL { ?w schema:about ?o ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { { ?o wdt:P179 ?up } UNION { ?o wdt:P8345 ?up } }
} GROUP BY ?o`;
    for (const r of await sparql(q, opt)) out[r.o] = { label: r.label || null, labelAr: r.labelAr || null, tm: r.tm ? +r.tm : null, tt: r.tt ? +r.tt : null,
      types: r.types ? r.types.split(',').filter(Boolean) : [], date: r.date ? r.date.slice(0, 10) : null, wiki: r.wiki || null, up: r.up ? r.up.split(',').filter(Boolean) : [] };
  }
  return out;
}

// ٣) أعضاء مجموعات (سلسلة أو عالم أو امتياز) ممن لهم رقم في TMDB فقط، أي أعمال تُشاهد. الصف: { g, prop, m, tm, tt, ord, date }
export async function members(groups, opt) {
  const rows = [];
  for (const part of chunks([...new Set(groups)], 40)) {
    const q = `SELECT ?g ?prop ?m ?tm ?tt ?ord (MIN(?d) AS ?date) WHERE {
  VALUES ?g { ${qids(part)} }
  { ?m p:P179 ?st . ?st ps:P179 ?g . OPTIONAL { ?st pq:P1545 ?ord } BIND("P179" AS ?prop) }
  UNION { ?m wdt:P1434 ?g . BIND("P1434" AS ?prop) } UNION { ?m wdt:P8345 ?g . BIND("P8345" AS ?prop) }
  OPTIONAL { ?m wdt:P4947 ?tm } OPTIONAL { ?m wdt:P4983 ?tt } OPTIONAL { ?m wdt:P577 ?d }
  FILTER(BOUND(?tm) || BOUND(?tt))
} GROUP BY ?g ?prop ?m ?tm ?tt ?ord`;
    for (const r of await sparql(q, opt)) rows.push({ g: r.g, prop: r.prop, m: r.m, tm: r.tm ? +r.tm : null, tt: r.tt ? +r.tt : null, ord: r.ord || null, date: r.date ? r.date.slice(0, 10) : null });
  }
  return rows;
}
