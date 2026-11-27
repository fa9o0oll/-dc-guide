// أداة بحث: تقرأ استعلامات من data/lookup/*.json وتطبع مرشحي TMDB لكل استعلام (مع مواسم المسلسلات) في سجل البناء.
// لا تثبّت أي معرّف: التثبيت يدوي بعد مراجعة النتائج. تُستخدم عند إضافة دليل جديد أو قائمة أفلام.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
if (!hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(0); }
const dir = new URL('../data/lookup/', import.meta.url);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];
const brief = c => ({ id: c.id, name: c.title || c.name, orig: c.original_title || c.original_name, date: c.release_date || c.first_air_date || null, rating: c.vote_average, votes: c.vote_count, lang: c.original_language });
// جرد (inventory): كل ما في TMDB من أفلام ومسلسلات لشركات يطابق اسمها نمطاً (مثل ^Marvel) أو بكلمات مفتاحية، بتفاصيل تكفي للفرز
// (النوع والتاريخ والمدة والحلقات والشركات وIMDb). يُطبع سطر INV لكل عمل، فيُقرأ من سجل البناء. يُستخدم عند بناء دليل جديد كاملاً
async function inventory({ companies: pat, search = [], keywords = [], kwPattern }) {
  const re = new RegExp(pat, 'i'), cos = new Map(), kws = new Map(), seen = new Map();
  for (const q of search) for (let page = 1; page <= 5; page++) { const d = await tmdb('/search/company', { query: q, page }).catch(() => ({}));
    for (const c of d.results || []) if (re.test(c.name)) cos.set(c.id, c.name); if (page >= (d.total_pages || 1)) break; }
  for (const q of keywords) { const d = await tmdb('/search/keyword', { query: q }).catch(() => ({})); for (const k of d.results || []) if (new RegExp(kwPattern || q, 'i').test(k.name)) kws.set(k.id, k.name); }
  console.log('INVCO ' + JSON.stringify([...cos])); console.log('INVKW ' + JSON.stringify([...kws]));
  const sweep = async (kind, params, via) => { for (let page = 1; page <= 60; page++) { const d = await tmdb('/discover/' + kind, { ...params, include_adult: false, sort_by: 'popularity.desc', page }).catch(() => null); if (!d) break;
    for (const r of d.results || []) { const k = kind + ':' + r.id; if (!seen.has(k)) seen.set(k, { kind, id: r.id, via: new Set() }); seen.get(k).via.add(via); } if (page >= (d.total_pages || 1)) break; } };
  const coIds = [...cos.keys()]; for (let i = 0; i < coIds.length; i += 8) for (const kind of ['movie', 'tv']) await sweep(kind, { with_companies: coIds.slice(i, i + 8).join('|') }, 'co');
  for (const kind of ['movie', 'tv']) for (const id of kws.keys()) await sweep(kind, { with_keywords: id }, 'kw:' + id);
  const rows = await Promise.all([...seen.values()].map(async c => { const d = await tmdb(`/${c.kind}/${c.id}`, { language: 'en-US', append_to_response: 'external_ids' }).catch(() => null); if (!d) return null;
    const tv = c.kind === 'tv', g = (d.genres || []).map(x => x.name);
    return { k: tv ? 'tv' : 'mv', id: d.id, t: d.title || d.name, o: (d.original_title || d.original_name) !== (d.title || d.name) ? d.original_title || d.original_name : undefined, d: (tv ? d.first_air_date : d.release_date) || null,
      end: tv ? d.last_air_date || null : undefined, st: d.status, rt: tv ? undefined : d.runtime, s: tv ? d.number_of_seasons : undefined, e: tv ? d.number_of_episodes : undefined, ty: tv ? d.type : undefined,
      g: g.join('/'), l: d.original_language, imdb: d.imdb_id || d.external_ids?.imdb_id || null, v: d.vote_count, pop: Math.round(d.popularity || 0),
      co: (d.production_companies || []).map(x => x.name).join('|'), net: tv ? (d.networks || []).map(x => x.name).join('|') : undefined, via: [...c.via].join(',') }; }));
  for (const r of rows.filter(Boolean).sort((a, b) => (a.d || '9999').localeCompare(b.d || '9999'))) console.log('INV ' + JSON.stringify(r));
  console.log(`INVSUM ${seen.size} titles from ${cos.size} companies and ${kws.size} keywords`);
}
for (const f of files) {
  const { queries = [], top = 6, inventory: inv } = JSON.parse(fs.readFileSync(new URL(f, dir)));
  if (inv) await inventory(inv);
  for (const q of queries) {
    const out = { file: f, q: q.q, year: q.year, tv: [], movie: [] };
    for (const kind of q.kind ? [q.kind] : ['tv', 'movie']) {
      const res = (await tmdb('/search/' + kind, { query: q.q, include_adult: false, ...(q.year ? { [kind === 'tv' ? 'first_air_date_year' : 'year']: q.year } : {}) }).catch(() => ({}))).results || [];
      for (const c of res.slice(0, q.top || top)) {
        const row = brief(c);
        if (kind === 'tv') { const d = await tmdb('/tv/' + c.id, { append_to_response: 'external_ids' }).catch(() => null);
          if (d) { row.seasons = d.seasons.map(s => `S${s.season_number}:${s.episode_count}ep ${s.air_date || '-'} ${s.name}`); row.imdb = d.external_ids?.imdb_id || null; row.tvdb = d.external_ids?.tvdb_id || null; } }
        else { const d = await tmdb('/movie/' + c.id).catch(() => null); if (d) { row.imdb = d.imdb_id || null; row.runtime = d.runtime; row.collection = d.belongs_to_collection ? `${d.belongs_to_collection.id}:${d.belongs_to_collection.name}` : null; } }
        out[kind].push(row);
      }
    }
    console.log('LOOKUP ' + JSON.stringify(out));
  }
}
