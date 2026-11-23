// فهرس العناوين لاقتراحات «أضف فيلماً» أثناء الكتابة: أشهر أفلام TMDB ومسلسلاته (والجديد والقادم منها) بأسمائها
// الإنجليزية والعربية، فيقترح الموقع العمل وإن كُتب اسمه ناقصاً أو بإملاء خاطئ أو بالحروف العربية (site/find.js).
// يُبنى أسبوعياً (أو إن غاب الملف)، ويبقى السابق كما هو إن تعذّر TMDB أو جاء الفهرس ناقصاً.
// الصيغة: { built, items: [[معرّف TMDB, النوع (0 فيلم، 1 مسلسل), السنة, الشهرة 0–100, الاسم الإنجليزي, الاسم العربي?, الاسم الأصلي اللاتيني?]] }
// TITLES_FORCE=1 يبنيه مهما كان عمره، وTITLES_PROBE=1 يطبع كيف يجيب بحث TMDB نفسه عن كتابة عربية أو خاطئة (للمقارنة).
import { readFile, writeFile } from 'node:fs/promises';
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { prepare, find } from '../site/find.js';

const OUT = 'site/films/data/titles.json', WEEK = 7 * 864e5, today = new Date().toISOString().slice(0, 10);
const NOISE = '10763,10764,10767';   // الأخبار وتلفزيون الواقع والحوارات: ليست أعمالاً تُتابع في القائمة
const PLAN = [
  ['movie', { sort_by: 'vote_count.desc' }, 400],
  ['movie', { sort_by: 'popularity.desc', 'vote_count.gte': 15 }, 60],
  ['movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': today }, 10],
  ['tv', { sort_by: 'vote_count.desc', without_genres: NOISE }, 100],
  ['tv', { sort_by: 'popularity.desc', 'vote_count.gte': 15, without_genres: NOISE }, 25],
];
const old = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
if (old && Date.now() - Date.parse(old.built) < WEEK && !process.env.TITLES_FORCE) { console.log(`titles: current (${old.items.length}, built ${old.built})`); process.exit(0); }
if (!hasKey()) { console.log('titles: no TMDB key, keeping the previous index'); process.exit(0); }

const yearOf = r => +(r.release_date || r.first_air_date || '').slice(0, 4) || 0;
const fame = n => Math.round(Math.min(100, Math.log10((n || 0) + 1) * 25));
const latin = s => s && /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u.test(s), arabic = s => s && /[ء-ي]/.test(s);
const rows = new Map();
for (const [kind, params, pages] of PLAN) {
  const k = kind === 'tv' ? 1 : 0;
  await Promise.all(Array.from({ length: pages }, async (_, i) => {
    const q = { ...params, include_adult: false, page: i + 1 };
    const [en, ar] = await Promise.all([tmdb('/discover/' + kind, { ...q, language: 'en-US' }), tmdb('/discover/' + kind, { ...q, language: 'ar' })].map(p => p.catch(() => null)));
    const arOf = new Map((ar?.results || []).map(r => [r.id, r.title || r.name]));
    for (const r of en?.results || []) {
      const key = k + ':' + r.id; if (rows.has(key) || r.adult) continue;
      const title = (r.title || r.name || '').trim(), orig = (r.original_title || r.original_name || '').trim(), tAr = (arOf.get(r.id) || '').trim();
      if (!title) continue;
      const row = [r.id, k, yearOf(r), fame(r.vote_count), title];
      if (arabic(tAr) && tAr !== title) row[5] = tAr;
      if (latin(orig) && orig.toLowerCase() !== title.toLowerCase()) { row[5] ??= 0; row[6] = orig; }
      rows.set(key, row);
    }
  }));
}
const items = [...rows.values()].sort((a, b) => b[3] - a[3] || b[2] - a[2]);
console.log(`titles: ${items.length} (${items.filter(r => r[1] === 0).length} films, ${items.filter(r => r[1] === 1).length} series), ${items.filter(r => r[5]).length} with an Arabic title`);

// فحص ذاتي على الفهرس الحقيقي: كتابة عربية وخاطئة وناقصة يجب أن تصل إلى العمل المقصود أولاً
const P = prepare(items.map(r => ({ id: r[0], k: r[1], y: r[2], v: r[3], names: [r[4], r[5], r[6]] })));
const want = [['جون ويك', 245891], ['jon wik', 245891], ['intersteller', 157336], ['انترستلر', 157336], ['ذا دارك نايت', 155], ['shawshenk', 278], ['اوبنهايمر', 872585], ['breaking bad', 1396]];
let ok = 0; for (const [q, id] of want) { const r = find(P, q, { limit: 3 }), hit = r.hits[0]?.id === id; ok += hit;
  console.log(`  ${hit ? '✓' : '✗'} «${q}» → ${r.hits.map(h => `${h.names[0]} (${h.y}) [${h.how}]`).join(' | ') || '—'}`); }
if (items.length < 3000 || ok < want.length - 1) { console.log(`titles: index looks wrong (${items.length} items, ${ok}/${want.length} checks), keeping the previous one`); process.exit(0); }

await writeFile(OUT, JSON.stringify({ built: new Date().toISOString(), items }));
console.log(`titles: wrote ${OUT}`);

// للمقارنة على فروع العمل: كيف يجيب بحث TMDB نفسه (لا يُكتب شيء)
if (process.env.TITLES_PROBE) for (const q of ['جون ويك', 'jon wik', 'john wi', 'intersteller', 'انترستلر', 'باتمان', 'سبايدر مان', 'the dark kn', 'اوبنهايمر']) {
  const r = await tmdb('/search/multi', { query: q, include_adult: false, language: 'en-US' }).catch(e => ({ results: [], e: e.message }));
  console.log(`  TMDB «${q}» → ${(r.results || []).filter(x => x.media_type !== 'person').slice(0, 3).map(x => `${x.title || x.name} (${yearOf(x)})`).join(' | ') || '—'}`);
}
// وبحث أعمال +18 (والفلتر مرفوع، E65) كما تسأله دالة «أضف فيلماً»: هل يعيد include_adult ما وُسم للبالغين، وفي أي صفحة؟ أعداد فقط، بلا أسماء في السجل
if (process.env.TITLES_PROBE) for (const q of ['love', 'hentai']) for (const ep of ['/search/movie', '/search/tv', '/search/multi']) { const tot = {}, flagged = {};
  for (const adult of [false, true]) { const rs = await Promise.all([1, 2, 3, 4, 5].map(page => tmdb(ep, { query: q, include_adult: adult, page }).catch(e => ({ results: [], e: e.message }))));
    tot[adult] = rs[0].total_results ?? rs[0].e; flagged[adult] = rs.map(r => (r.results || []).filter(x => x.adult).length).join('+'); }
  console.log(`  TMDB adult probe «${q}» ${ep} total_results: without ${tot.false}, with ${tot.true}; flagged adult in pages 1-5: without ${flagged.false}, with ${flagged.true}`); }
