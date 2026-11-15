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
  show('famous (GTA V, Witcher 3, Elden Ring, RDR2, GoW 2018)', await igdb('games', 'fields name,game_type,total_rating_count,rating_count,aggregated_rating_count,hypes,themes,version_parent; where id = (1020,1942,119133,25076,19560);').catch(e => e.message));
  show('top by total_rating_count, no type filter', await igdb('games', 'fields name,game_type,total_rating_count; where total_rating_count != null; sort total_rating_count desc; limit 12;').catch(e => e.message));
  show('top by rating_count', await igdb('games', 'fields name,game_type,rating_count; where rating_count != null; sort rating_count desc; limit 12;').catch(e => e.message));
  show('popularity types', await igdb('popularity_types', 'fields name,external_popularity_source; limit 50;').catch(e => e.message));
  show('popularity top (type 1)', await igdb('popularity_primitives', 'fields game_id,value,popularity_type; where popularity_type = 1; sort value desc; limit 10;').catch(e => e.message));
  // مطابقة أسماء PlayStation وXbox بـ IGDB كما تفعلها دالة «حساباتي»: الطلب الخام أولاً (ليظهر الخطأ إن وُجد)، ثم المطابقة نفسها
  const { meta, gameyIds } = await import('./lib-games.mjs'), { byName } = await import('../netlify/functions/game-accounts.mjs');
  const m = await meta(), T = (t => t.length ? ` & game_type = (${t.join(',')})` : '')(gameyIds(m));
  show('multiquery raw (search)', await igdb('multiquery', `query games "0" { search "ELDEN RING"; fields name; limit 3; };\nquery games "1" { search "Halo Infinite"; fields name; limit 3; };`).catch(e => e.message));
  show('multiquery raw (search + where)', await igdb('multiquery', `query games "0" { search "ELDEN RING"; fields name,first_release_date,platforms,total_rating_count; where version_parent = null${T}; limit 6; };`).catch(e => e.message));
  show('single search + where', await igdb('games', `search "ELDEN RING"; fields name; where version_parent = null${T}; limit 3;`).catch(e => e.message));
  const sample = ["Marvel's Spider-Man 2", 'God of War Ragnarök', 'ELDEN RING', "Ghost of Tsushima DIRECTOR'S CUT", 'Grand Theft Auto V', 'The Last of Us Part I', 'Call of Duty: Modern Warfare III', 'EA SPORTS FC 24', 'TEKKEN 8', 'FINAL FANTASY VII REBIRTH', 'Forza Horizon 5', 'Halo Infinite', 'Hogwarts Legacy', 'Resident Evil 4', 'Cyberpunk 2077'].map((name, i) => ({ key: 'p' + i, name }));
  const t0 = Date.now(), hits = await byName(sample, T);
  show(`byName ${hits.size}/${sample.length} in ${Date.now() - t0}ms`, sample.map(x => x.name + ' => ' + JSON.stringify(hits.get(x.key) || null)));
}

if (!added.length) { await writeFile(OUT, JSON.stringify(empty)); console.log('games: the list is empty'); process.exit(0); }
const story = (await import('../data/games/story-orders.mjs')).default.series || [];
const ids = added.map(g => +g.igdb).filter(Boolean);
let r; try { r = await gamesFor(ids, { wikidata: true, story, log: m => console.log('games: ' + m) }); } catch (e) { console.log(`games: IGDB failed (${e.message}), keeping the previous file`); process.exit(0); }
if (!r.games.length) { console.log('games: IGDB returned nothing, keeping the previous file'); process.exit(0); }
// ترتيب القائمة وتاريخ الإضافة من ملف المضافات
const at = new Map(added.map((g, i) => [+g.igdb, { ord: i, at: g.at || null }]));
for (const g of r.games) Object.assign(g, at.get(g.id) || {});
r.games.sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9));
await writeFile(OUT, JSON.stringify({ built: new Date().toISOString(), img: IMG, ...r }));
console.log(`games: wrote ${OUT}: ${r.games.length} games, ${Object.keys(r.series).length} series, ${Object.values(r.series).filter(s => s.story).length} with a story order`);
