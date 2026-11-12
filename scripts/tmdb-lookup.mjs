// أداة بحث: تقرأ استعلامات من data/lookup/*.json وتطبع مرشحي TMDB لكل استعلام (مع مواسم المسلسلات) في سجل البناء.
// لا تثبّت أي معرّف: التثبيت يدوي بعد مراجعة النتائج. تُستخدم عند إضافة دليل جديد أو قائمة أفلام.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
if (!hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(0); }
const dir = new URL('../data/lookup/', import.meta.url);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];
const brief = c => ({ id: c.id, name: c.title || c.name, orig: c.original_title || c.original_name, date: c.release_date || c.first_air_date || null, rating: c.vote_average, votes: c.vote_count, lang: c.original_language });
for (const f of files) {
  const { queries = [], top = 6 } = JSON.parse(fs.readFileSync(new URL(f, dir)));
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
