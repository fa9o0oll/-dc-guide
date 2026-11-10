// المرحلة ٢: يسحب بيانات كل عمل مثبَّت المعرّف من TMDB ويكتب ملفات الموقع في site/data/.
// المصدر الوحيد للحقائق المتغيرة (بوستر، تواريخ، مواسم، حلقات، تقييم TMDB). ما لا يتوفر يُترك فارغاً ولا يُخمَّن.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
const root = new URL('../', import.meta.url);
const rd = f => JSON.parse(fs.readFileSync(new URL('data/' + f, root)));
const works = rd('works.json');
const outDir = new URL('site/data/', root), epDir = new URL('site/data/episodes/', root);
fs.mkdirSync(epDir, { recursive: true });
const write = (u, d) => fs.writeFileSync(u, JSON.stringify(d) + '\n');
if (!hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(1); }

const tr = (d, lang) => (d.translations?.translations || []).filter(t => t.iso_639_1 === lang).map(t => t.data || {});
const pickTr = (d, lang, field) => tr(d, lang).map(x => (x[field] || '').trim()).find(Boolean) || null;
const problems = [];

async function buildWork(w) {
  if (!w.ids?.tmdb) return { id: w.id, pending: true };
  const kind = w.ids.tmdbKind || (w.kind === 'series' ? 'tv' : 'movie'), tv = kind === 'tv';
  const d = await tmdb(`/${kind}/${w.ids.tmdb}`, { language: 'en-US', append_to_response: 'external_ids,translations' });
  const o = { id: w.id, tmdb: d.id, imdb: d.imdb_id || d.external_ids?.imdb_id || w.ids.imdb || null,
    date: d.release_date || d.first_air_date || null, status: d.status || null,
    poster: d.poster_path || null, backdrop: d.backdrop_path || null,
    titleAr: pickTr(d, 'ar', tv ? 'name' : 'title'), overviewAr: pickTr(d, 'ar', 'overview'), overviewEn: (d.overview || '').trim() || null,
    tmdbRating: d.vote_count >= 10 ? Math.round(d.vote_average * 10) / 10 : null, tmdbVotes: d.vote_count || 0 };
  if (!tv) o.runtime = d.runtime || null;
  if (w.ids.imdb && o.imdb && w.ids.imdb !== o.imdb) problems.push(`${w.id}: معرّف IMDb المثبّت ${w.ids.imdb} يخالف TMDB ${o.imdb}`);
  if (tv) {
    o.lastAir = d.last_air_date || null; o.inProduction = !!d.in_production;
    o.nextEpisode = d.next_episode_to_air ? { season: d.next_episode_to_air.season_number, episode: d.next_episode_to_air.episode_number, date: d.next_episode_to_air.air_date } : null;
    const seasons = (d.seasons || []).filter(s => s.season_number > 0);
    o.seasons = seasons.map(s => ({ n: s.season_number, episodes: s.episode_count, date: s.air_date || null, poster: s.poster_path || null }));
    o.episodeCount = seasons.reduce((a, s) => a + (s.episode_count || 0), 0);
    const full = await Promise.all(seasons.map(async s => {
      const [en, ar] = await Promise.all(['en-US', 'ar'].map(language => tmdb(`/tv/${d.id}/season/${s.season_number}`, { language }).catch(() => null)));
      const arBy = new Map((ar?.episodes || []).map(e => [e.episode_number, e]));
      return { n: s.season_number, episodes: (en?.episodes || []).map(e => { const a = arBy.get(e.episode_number) || {};
        const arName = (a.name || '').trim(), arOv = (a.overview || '').trim();
        return { n: e.episode_number, name: e.name || null, nameAr: arName && arName !== e.name && /[؀-ۿ]/.test(arName) && !/^الحلقة\s*\d+$/.test(arName) ? arName : null,
          date: e.air_date || null, runtime: e.runtime || null, still: e.still_path || null,
          rating: e.vote_count >= 1 ? Math.round(e.vote_average * 10) / 10 : null, votes: e.vote_count || 0,
          overviewEn: (e.overview || '').trim() || null, overviewAr: /[؀-ۿ]/.test(arOv) ? arOv : null }; }) };
    }));
    write(new URL(w.id + '.json', epDir), { id: w.id, tmdb: d.id, seasons: full });
    o.arabicEpisodeOverviews = full.flatMap(s => s.episodes).filter(e => e.overviewAr).length;
  }
  return o;
}

const rows = await Promise.all(works.map(w => buildWork(w).catch(e => { problems.push(`${w.id}: ${e.message}`); return { id: w.id, error: true }; })));
// روابط صفحات التقييم الدقيقة (روتن توميتوز/ميتاكريتيك) من ويكي‌داتا عبر معرّف IMDb
try {
  const ids = rows.map(r => r.imdb).filter(Boolean);
  const q = `SELECT ?imdb ?rt ?mc WHERE { VALUES ?imdb { ${ids.map(i => `"${i}"`).join(' ')} } ?item wdt:P345 ?imdb. OPTIONAL { ?item wdt:P1258 ?rt } OPTIONAL { ?item wdt:P1712 ?mc } }`;
  const res = await fetch('https://query.wikidata.org/sparql', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json', 'User-Agent': 'dc-guide-build/1.0 (https://github.com/fa9o0oll/-dc-guide)' },
    body: 'query=' + encodeURIComponent(q) });
  if (!res.ok) throw new Error('Wikidata ' + res.status);
  const by = new Map();
  for (const b of (await res.json()).results.bindings) { const e = by.get(b.imdb.value) || {}; if (b.rt && !e.rt) e.rt = b.rt.value; if (b.mc && !e.mc) e.mc = b.mc.value; by.set(b.imdb.value, e); }
  for (const r of rows) { const e = by.get(r.imdb); if (e?.rt && /^(m|tv)\//.test(e.rt)) r.rt = e.rt; if (e?.mc) r.mc = e.mc; }
} catch (e) { problems.push('روابط التقييم من ويكي‌داتا: ' + e.message); }
// معرّف TVMaze لكل مسلسل (لنقل سجل الحلقات من النسخة القديمة)
for (const r of rows.filter(r => r.seasons && r.imdb)) {
  try { const res = await fetch('https://api.tvmaze.com/lookup/shows?imdb=' + r.imdb); if (res.ok) r.tvmaze = (await res.json()).id; } catch {}
  await new Promise(z => setTimeout(z, 600));
}
const cfg = await tmdb('/configuration');
write(new URL('catalog.json', outDir), { generatedAt: new Date().toISOString(), imageBase: cfg.images.secure_base_url, works: rows });
const ok = rows.filter(r => r.tmdb), series = ok.filter(r => r.seasons);
const summary = { generatedAt: new Date().toISOString(), total: rows.length, enriched: ok.length, pending: rows.filter(r => r.pending).length, errors: rows.filter(r => r.error).length,
  withPoster: ok.filter(r => r.poster).length, withBackdrop: ok.filter(r => r.backdrop).length, withImdbId: ok.filter(r => r.imdb).length, withRtLink: ok.filter(r => r.rt).length,
  withArabicOverview: ok.filter(r => r.overviewAr).length, withArabicTitle: ok.filter(r => r.titleAr).length,
  series: series.length, episodes: series.reduce((a, r) => a + r.episodeCount, 0), arabicEpisodeOverviews: series.reduce((a, r) => a + (r.arabicEpisodeOverviews || 0), 0), problems };
fs.mkdirSync(new URL('data/generated/', root), { recursive: true });
fs.writeFileSync(new URL('data/generated/build-report.json', root), JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify(summary, null, 1));
if (summary.errors) process.exit(1);
