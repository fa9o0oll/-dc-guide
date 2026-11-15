// فهرس العناوين لاقتراحات «أضف لعبة» أثناء الكتابة: أشهر ألعاب IGDB (والقادم المنتظر منها) بأسمائها الإنجليزية واختصاراتها (GTA V، TLOU)
// والعربية من Wikidata، فيقترح الموقع اللعبة وإن كُتب اسمها ناقصاً أو بإملاء خاطئ أو بالحروف العربية (site/find.js): «قود اوف وور»، «eldin ring».
// يُبنى أسبوعياً (أو إن غاب الملف)، ويبقى السابق كما هو إن تعذّر IGDB أو جاء الفهرس ناقصاً.
// الصيغة: { built, items: [[معرّف IGDB, السنة, الشهرة 0–100, عائلات المنصات (بتات), الاسم, الاسم العربي?, أسماء أخرى مفصولة بـ | ?]] }
// بتات العائلات: 1 بلايستيشن، 2 إكس بوكس، 4 نينتندو، 8 كمبيوتر، 16 جوال. GAME_TITLES_FORCE=1 يبنيه مهما كان عمره.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hasIgdb, igdb } from './lib-igdb.mjs';
import { meta, gameyIds, famOf, EROTIC } from './lib-games.mjs';
import { prepare, find } from '../site/find.js';

const OUT = 'site/games/data/titles.json', WEEK = 7 * 864e5, now = Math.floor(Date.now() / 1000);
const old = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
if (old && Date.now() - Date.parse(old.built) < WEEK && !process.env.GAME_TITLES_FORCE) { console.log(`game titles: current (${old.items.length}, built ${old.built})`); process.exit(0); }
if (!hasIgdb()) { console.log('game titles: no IGDB keys, keeping the previous index'); process.exit(0); }
await mkdir('site/games/data', { recursive: true });

let types; try { types = gameyIds(await meta()).filter(id => id != null);   // ‏0 هو «اللعبة الأساسية»: لا يُسقط await igdb('games', 'fields id; limit 1;'); } catch (e) { console.log('game titles: IGDB unreachable (' + e.message + '), keeping the previous index'); process.exit(0); }
const BIT = { ps: 1, xbox: 2, nin: 4, pc: 8, mobile: 16 }, fam = new Map();
for (let off = 0; off < 1500; off += 500) for (const p of await igdb('platforms', `fields name; limit 500; offset ${off};`)) fam.set(p.id, BIT[famOf(p.name)] || 0);
const F = 'fields name,slug,first_release_date,total_rating_count,hypes,platforms,alternative_names.name,themes;', T = types.length ? ` & game_type = (${types.join(',')})` : '';
const PLAN = [
  ...Array.from({ length: 22 }, (_, i) => `${F} where total_rating_count >= 4${T}; sort total_rating_count desc; limit 500; offset ${i * 500};`),
  `${F} where first_release_date > ${now} & hypes > 1${T}; sort hypes desc; limit 500;`,
  `${F} where first_release_date = null & hypes > 3${T}; sort hypes desc; limit 500;`,
  `${F} where first_release_date > ${now - 400 * 86400} & first_release_date <= ${now}${T}; sort hypes desc; limit 500;`,
];
const rows = new Map(), latin = s => /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u.test(s);
const fame = g => Math.round(Math.min(100, Math.log10((g.total_rating_count || 0) + (g.hypes || 0) / 2 + 1) * 30));
const pages = await Promise.all(PLAN.map(q => igdb('games', q).catch(e => { console.log('game titles: page failed,', e.message); return []; })));
if (process.env.GAMES_PROBE) pages.forEach((p, i) => console.log(`  page ${i}: ${p.length} ${p.slice(0, 3).map(g => `${g.name} [${g.total_rating_count ?? '-'}]`).join(' | ')}`));
for (const page of pages)
  for (const g of page) {
    if (rows.has(g.id) || !g.name || (g.themes || []).includes(EROTIC)) continue;
    const y = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : 0, f = [...new Set((g.platforms || []).map(p => fam.get(p) || 0))].reduce((a, b) => a | b, 0);
    const alt = [...new Set((g.alternative_names || []).map(a => String(a.name || '').trim()).filter(n => n && n.length <= 40 && latin(n) && n.toLowerCase() !== g.name.toLowerCase()))].slice(0, 3);
    rows.set(g.id, { row: [g.id, y, fame(g), f, g.name, 0, alt.join('|')], slug: g.slug });
  }
// الأسماء العربية من Wikidata (رقم IGDB فيها هو الاسم المختصر للعبة)
try {
  const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'User-Agent': 'dc-guide games (github.com/fa9o0oll/-dc-guide)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'query=' + encodeURIComponent('SELECT ?slug ?ar WHERE { ?g wdt:P5794 ?slug ; rdfs:label ?ar . FILTER(lang(?ar) = "ar") }') });
  const bySlug = new Map([...rows.values()].map(x => [x.slug, x.row])); let n = 0;
  for (const b of (await r.json()).results.bindings) { const row = bySlug.get(b.slug.value), a = b.ar.value.trim(); if (row && /[ء-ي]/.test(a) && !row[5]) { row[5] = a; n++; } }
  console.log(`game titles: ${n} Arabic names from Wikidata`);
} catch (e) { console.log('game titles: Wikidata skipped,', e.message); }
const items = [...rows.values()].map(x => { const r = x.row; if (!r[6]) { r.length = 6; if (!r[5]) r.length = 5; } return r; }).sort((a, b) => b[2] - a[2] || b[1] - a[1]);
console.log(`game titles: ${items.length} games, ${items.filter(r => r[5]).length} with an Arabic name, ${items.filter(r => r[6]).length} with other names`);

// فحص ذاتي على الفهرس الحقيقي: كتابة عربية وخاطئة وناقصة ومختصرة يجب أن تصل إلى اللعبة المقصودة أولاً
const P = prepare(items.map(r => ({ id: r[0], y: r[1], v: r[2], names: [r[4], r[5] || '', ...(r[6] ? r[6].split('|') : [])] })));
const want = [['ذا ويتشر 3', /^The Witcher 3/], ['قود اوف وور', /^God of War/], ['eldin ring', /^Elden Ring$/], ['gta v', /^Grand Theft Auto V$/], ['red dead 2', /^Red Dead Redemption 2$/],
  ['zelda breath', /Breath of the Wild/], ['the last of us', /^The Last of Us/], ['ماينكرافت', /^Minecraft/]];
let ok = 0; for (const [q, re] of want) { const r = find(P, q, { limit: 3 }), hit = re.test(r.hits[0]?.names[0] || ''); ok += hit;
  console.log(`  ${hit ? '✓' : '✗'} «${q}» → ${r.hits.map(h => `${h.names[0]} (${h.y}) [${h.how}]`).join(' | ') || '—'}`); }
if (items.length < 3000 || ok < want.length - 2) { console.log(`game titles: index looks wrong (${items.length} items, ${ok}/${want.length} checks), keeping the previous one`); process.exit(0); }
await writeFile(OUT, JSON.stringify({ built: new Date().toISOString(), items }));
console.log(`game titles: wrote ${OUT}`);
