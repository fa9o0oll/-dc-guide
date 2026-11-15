// بناء بيانات «ألعابي» (site/games/data/games.json) من قائمة الألعاب المضافة (data/games/added.json) ومن IGDB وWikidata (scripts/lib-games.mjs):
// معلومات كل لعبة، وغلافها وصورها بأعلى دقة، ومنصاتها، وكم تأخذ لتختمها، وسلسلتها كاملة بترتيب الصدور (ومعها المعلن الذي لم يصدر لعدّه التنازلي)،
// وترتيب القصة الموصى به حيث ثبت له مصدر رسمي (data/games/story-orders.mjs)، وعالمها القصصي، وما اقتُبست منه وما اقتُبس منها.
// بلا مفاتيح IGDB يبقى الملف السابق كما هو (أو يُكتب ملف فارغ صالح أول مرة). GAMES_PROBE=1 يطبع عينة من استجابات IGDB للتحقق من الحقول.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hasIgdb, igdb } from './lib-igdb.mjs';
import { gamesFor, IMG } from './lib-games.mjs';

const ADDED = 'data/games/added.json', OUT = 'site/games/data/games.json';
const read = (f, d) => readFile(f, 'utf8').then(JSON.parse).catch(() => d);
const added = (await read(ADDED, { games: [] })).games || [];
await mkdir('site/games/data', { recursive: true });
const empty = { built: new Date().toISOString(), img: IMG, games: [], series: {}, plats: {}, franchises: {} };
if (!hasIgdb()) { const old = await read(OUT, null); if (!old) await writeFile(OUT, JSON.stringify(empty)); console.log(`games: no IGDB keys (IGDB_CLIENT_ID, IGDB_CLIENT_SECRET), ${old ? 'kept the previous file' : 'wrote an empty catalog'}`); process.exit(0); }

if (process.env.GAMES_PROBE) {
  // عينة للتحقق من أسماء الحقول ومصادر المعرّفات الخارجية في IGDB الحية (فروع العمل فقط)
  const show = (t, x) => console.log(`probe ${t}: ${JSON.stringify(x).slice(0, 900)}`);
  show('game_types', await igdb('game_types', 'fields type; limit 50;').catch(e => e.message));
  show('game_statuses', await igdb('game_statuses', 'fields status; limit 50;').catch(e => e.message));
  show('external_game_sources', await igdb('external_game_sources', 'fields name; limit 60;').catch(e => e.message));
  show('steam 292030 (Witcher 3)', await igdb('external_games', 'fields game,uid,external_game_source; where uid = "292030" & external_game_source = 1; limit 5;').catch(e => e.message));
  show('search', await igdb('games', 'search "god of war"; fields name,slug,first_release_date,game_type,collections,release_dates.human; limit 5;').catch(e => e.message));
  show('upcoming', await igdb('games', `fields name,first_release_date,release_dates.human,game_status,hypes; where first_release_date > ${Math.floor(Date.now() / 1000)} & hypes > 50; sort hypes desc; limit 5;`).catch(e => e.message));
}

if (!added.length) { await writeFile(OUT, JSON.stringify(empty)); console.log('games: the list is empty'); process.exit(0); }
const story = (await import('../data/games/story-orders.mjs')).default.series || [];
const ids = added.map(g => +g.igdb).filter(Boolean);
const r = await gamesFor(ids, { wikidata: true, story, log: m => console.log('games: ' + m) });
if (!r.games.length) { console.log('games: IGDB returned nothing, keeping the previous file'); process.exit(0); }
// ترتيب القائمة وتاريخ الإضافة من ملف المضافات
const at = new Map(added.map((g, i) => [+g.igdb, { ord: i, at: g.at || null }]));
for (const g of r.games) Object.assign(g, at.get(g.id) || {});
r.games.sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9));
await writeFile(OUT, JSON.stringify({ built: new Date().toISOString(), img: IMG, ...r }));
console.log(`games: wrote ${OUT}: ${r.games.length} games, ${Object.keys(r.series).length} series, ${Object.values(r.series).filter(s => s.story).length} with a story order`);
