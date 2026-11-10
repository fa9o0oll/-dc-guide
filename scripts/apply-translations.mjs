// يطبّق ترجماتنا العربية (data/translations/) على ملفات الموقع بعد سحب البيانات. بلا شبكة، ويمكن تكراره بأمان.
// ترجمتنا تتقدم على الترجمة العربية القادمة من TMDB. الأسماء والألقاب تبقى بلفظها مع شرح بين قوسين عند الحاجة.
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const rd = p => JSON.parse(fs.readFileSync(new URL(p, root)));
const wr = (p, d) => fs.writeFileSync(new URL(p, root), JSON.stringify(d) + '\n');
const cat = rd('site/data/catalog.json'), works = rd('data/translations/works.json');
const ids = new Set(cat.works.map(w => w.id)), known = new Set(rd('data/works.json').map(w => w.id)), problems = [], waiting = [];
let nw = 0, ne = 0;
for (const [id, ar] of Object.entries(works)) { const w = cat.works.find(x => x.id === id); if (!w) { (known.has(id) ? waiting : problems).push('ترجمة لعمل غير موجود: ' + id); continue; } w.overviewAr = ar; w.arSource = 'guide'; nw++; }
const dir = new URL('data/translations/episodes/', root);
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : []) {
  const id = f.replace(/\.json$/, ''); if (!ids.has(id)) { problems.push('ترجمة حلقات لعمل غير موجود: ' + id); continue; }
  const tr = rd('data/translations/episodes/' + f), p = `site/data/episodes/${id}.json`, ep = rd(p), seen = new Set();
  for (const s of ep.seasons) for (const e of s.episodes) { const k = `${s.n}-${e.n}`; if (tr[k]) { e.overviewAr = tr[k]; e.arSource = 'guide'; seen.add(k); ne++; } }
  for (const k of Object.keys(tr)) if (!seen.has(k)) problems.push(`ترجمة لحلقة غير موجودة: ${id} ${k}`);
  wr(p, ep);
  const w = cat.works.find(x => x.id === id); w.arabicEpisodeOverviews = ep.seasons.flatMap(s => s.episodes).filter(e => e.overviewAr).length;
}
wr('site/data/catalog.json', cat);
const series = cat.works.filter(w => w.seasons);
console.log(`ترجماتنا: ${nw} نبذة عمل، ${ne} ملخص حلقة | نبذات الأعمال بالعربية ${cat.works.filter(w => w.overviewAr).length}/${cat.works.length} | ملخصات الحلقات بالعربية ${series.reduce((a, w) => a + (w.arabicEpisodeOverviews || 0), 0)}/${series.reduce((a, w) => a + (w.episodeCount || 0), 0)}`);
if (waiting.length) console.log(`بانتظار سحب بياناتها من TMDB: ${waiting.length} عملاً جديداً`);
if (problems.length) { console.error('❌ ' + problems.join('\n❌ ')); process.exit(1); }
