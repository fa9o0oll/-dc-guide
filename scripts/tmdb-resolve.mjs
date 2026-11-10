// المرحلة ١: يطابق كل عمل في الكتالوج مع سجله في TMDB ويكتب تقريراً للمراجعة.
// لا يثبّت أي معرّف تلقائياً: التثبيت يتم في data/works.json بعد مراجعة التقرير.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
const root = new URL('../', import.meta.url);
const works = JSON.parse(fs.readFileSync(new URL('data/works.json', root)));
const outDir = new URL('data/generated/', root); fs.mkdirSync(outDir, { recursive: true });
const write = (f, d) => fs.writeFileSync(new URL(f, outDir), JSON.stringify(d, null, 1) + '\n');

if (!hasKey()) { write('resolve-report.json', { ok: false, error: 'TMDB_API_KEY غير موجود في أسرار المستودع' }); console.error('missing TMDB_API_KEY'); process.exit(1); }
try { await tmdb('/configuration'); }
catch (e) { write('resolve-report.json', { ok: false, error: 'المفتاح مرفوض من TMDB: ' + e.message }); console.error(e.message); process.exit(1); }

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const yearOf = c => +(c.release_date || c.first_air_date || '').slice(0, 4) || null;

async function resolve(w) {
  const tv = w.kind === 'series', kind = tv ? 'tv' : 'movie';
  const q = { query: w.title, include_adult: false };
  let res = (await tmdb('/search/' + kind, { ...q, [tv ? 'first_air_date_year' : 'year']: w.year })).results || [];
  if (!res.length) res = (await tmdb('/search/' + kind, q)).results || [];
  let other = [];
  if (!res.length) other = (await tmdb('/search/' + (tv ? 'movie' : 'tv'), q)).results || [];
  const scored = res.map(c => {
    const exact = [c.title, c.name, c.original_title, c.original_name].some(t => norm(t) === norm(w.title));
    const dy = yearOf(c) == null ? 9 : Math.abs(yearOf(c) - w.year);
    return { c, exact, dy, score: (exact ? 3 : 0) + (dy === 0 ? 2 : dy === 1 ? 1 : 0) + Math.min(c.popularity || 0, 100) / 1000 };
  }).sort((a, b) => b.score - a.score);
  const strong = scored.filter(s => s.exact && s.dy <= 1);
  const brief = s => ({ tmdb: s.c.id, title: s.c.title || s.c.name, date: s.c.release_date || s.c.first_air_date || null, votes: s.c.vote_count, exact: s.exact });
  const row = { id: w.id, title: w.title, year: w.year, kind, status: strong.length === 1 ? 'confident' : scored.length ? 'review' : 'not-found',
    candidates: scored.slice(0, 4).map(brief) };
  if (other.length) row.otherKindCandidates = other.slice(0, 3).map(c => ({ tmdb: c.id, title: c.title || c.name, date: c.release_date || c.first_air_date || null }));
  const pick = strong.length === 1 ? strong[0].c : null;
  if (pick) {
    const d = await tmdb(`/${kind}/${pick.id}`, { append_to_response: 'external_ids,translations' });
    const ar = (d.translations?.translations || []).filter(t => t.iso_639_1 === 'ar');
    row.match = { tmdb: d.id, imdb: d.imdb_id || d.external_ids?.imdb_id || null, tvdb: d.external_ids?.tvdb_id ?? undefined,
      title: d.title || d.name, date: d.release_date || d.first_air_date, status: d.status,
      companies: (d.production_companies || []).map(c => c.name), poster: !!d.poster_path, backdrop: !!d.backdrop_path,
      rating: d.vote_average, votes: d.vote_count, seasons: d.number_of_seasons, episodes: d.number_of_episodes,
      arTitle: ar.map(t => t.data?.title || t.data?.name).find(Boolean) || null,
      arOverview: ar.some(t => (t.data?.overview || '').trim().length > 20) };
    if (!row.match.companies.some(n => /\bDC\b|Warner|Vertigo|Fleischer|Paramount|Columbia|Republic|HBO|Netflix|CW|Filmation|Hanna/i.test(n))) row.flag = 'شركة الإنتاج لا تشير لـDC — تحقق';
  }
  return row;
}

const rows = await Promise.all(works.map(w => resolve(w).catch(e => ({ id: w.id, title: w.title, year: w.year, status: 'error', error: e.message }))));
const count = s => rows.filter(r => r.status === s).length, m = rows.filter(r => r.match);
const summary = { ok: true, generatedAt: new Date().toISOString(), total: rows.length, confident: count('confident'), review: count('review'), notFound: count('not-found'), errors: count('error'),
  ofConfident: { withImdbId: m.filter(r => r.match.imdb).length, withPoster: m.filter(r => r.match.poster).length, withBackdrop: m.filter(r => r.match.backdrop).length,
    withArabicOverview: m.filter(r => r.match.arOverview).length, withArabicTitle: m.filter(r => r.match.arTitle).length, flagged: rows.filter(r => r.flag).length } };
write('resolve-report.json', { ...summary, rows });
console.log(JSON.stringify(summary, null, 1));
