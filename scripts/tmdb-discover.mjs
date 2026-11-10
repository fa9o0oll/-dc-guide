// يبحث في TMDB عن أعمال DC المعلنة أو القادمة غير الموجودة في الكتالوج، ويكتب تقريراً للمراجعة.
// لا يضيف شيئاً تلقائياً: الإضافة للكتالوج تتم يدوياً بعد التحقق من العمل وعالمه.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
const root = new URL('../', import.meta.url);
const works = JSON.parse(fs.readFileSync(new URL('data/works.json', root)));
const have = new Set(works.map(w => (w.ids.tmdbKind || (w.kind === 'series' ? 'tv' : 'movie')) + ':' + w.ids.tmdb));
if (!hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(1); }
const today = new Date().toISOString().slice(0, 10);
const NAMED = ['Man of Tomorrow', 'The Batman Part II', 'The Brave and the Bold', 'Dynamic Duo', 'Swamp Thing', 'Wonder Woman', 'Booster Gold', 'Waller', 'Paradise Lost',
  'The Authority', 'Sgt. Rock', 'Teen Titans', 'Bane and Deathstroke', 'Mister Miracle', 'My Adventures with Green Lantern', 'Starfire', 'Batman: Knightfall', 'Constantine 2',
  'Jimmy Olsen', 'DC Super Powers', 'Blue Beetle', 'Lobo', 'Deathstroke', 'Batgirl', 'Justice League', 'Green Lantern', 'Supergirl', 'Clayface', 'Krypto', 'Harley Quinn', 'Batman Caped Crusader',
  'Creature Commandos', 'Peacemaker', 'Lanterns', 'The Penguin', 'Joker', 'Zatanna', 'Black Canary', 'Nightwing', 'Robin', 'Arkham', 'Superman', 'Batman', 'Aquaman', 'Shazam', 'Flash', 'Titans', 'Watchmen', 'Sandman', 'Static Shock', 'Milestone', 'Scooby-Doo Krypto', 'Bat-Fam', 'Mr. Terrific', 'Metamorpho', 'Hawkgirl', 'Guy Gardner', 'Kingdom Come', 'All-Star Superman'];
const companies = new Map();
for (const q of ['DC Studios', 'DC Entertainment', 'DC Films', 'DC Comics', 'DC Vertigo', 'DC Universe']) for (const c of (await tmdb('/search/company', { query: q })).results || []) if (/^DC\b/i.test(c.name)) companies.set(c.id, c.name);
const ids = [...companies.keys()].join('|');
const cand = new Map();
const add = (kind, r, via) => { const k = kind + ':' + r.id; if (!have.has(k) && !cand.has(k)) cand.set(k, { kind, id: r.id, via }); };
for (const kind of ['movie', 'tv']) for (let page = 1; page <= 4; page++) {
  const d = await tmdb('/discover/' + kind, { with_companies: ids, [kind === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte']: today, sort_by: 'popularity.desc', page });
  (d.results || []).forEach(r => add(kind, r, 'company')); if (page >= d.total_pages) break;
}
await Promise.all(NAMED.flatMap(q => ['movie', 'tv'].map(async kind => { const d = await tmdb('/search/' + kind, { query: q });
  for (const r of (d.results || []).slice(0, 8)) { const date = r.release_date || r.first_air_date || ''; if (!date || date > today) add(kind, r, 'name:' + q); } })));
const rows = (await Promise.all([...cand.values()].map(async c => { try { const d = await tmdb(`/${c.kind}/${c.id}`, { append_to_response: 'external_ids' });
  const cos = (d.production_companies || []).map(x => x.name), dc = (d.production_companies || []).some(x => companies.has(x.id));
  return { kind: c.kind, tmdb: d.id, imdb: d.imdb_id || d.external_ids?.imdb_id || null, title: d.title || d.name, date: d.release_date || d.first_air_date || null, status: d.status, dc, companies: cos, genres: (d.genres || []).map(g => g.name), poster: !!d.poster_path, popularity: Math.round(d.popularity || 0), via: c.via, overview: (d.overview || '').slice(0, 160) }; } catch { return null; } }))).filter(Boolean)
  .filter(r => r.dc).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
// مسلسلات الكتالوج: مواسم معلنة أو حلقات قادمة (للتأكد أن العدّادات لها مصدر)
fs.writeFileSync(new URL('data/generated/upcoming-report.json', root), JSON.stringify({ generatedAt: new Date().toISOString(), companies: [...companies.entries()], count: rows.length, rows }, null, 1) + '\n');
console.log('upcoming DC candidates not in catalog:', rows.length);
