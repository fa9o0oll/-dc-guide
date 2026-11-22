// بناء بيانات «ألعابي» (site/games/data/games.json) من قائمة الألعاب المضافة (data/games/added.json) ومن IGDB وWikidata (scripts/lib-games.mjs):
// معلومات كل لعبة، وغلافها وصورها بأعلى دقة، ومنصاتها، وكم تأخذ لتختمها، وسلسلتها كاملة بترتيب الصدور (ومعها المعلن الذي لم يصدر لعدّه التنازلي)،
// وترتيب القصة الموصى به حيث ثبت له مصدر رسمي (data/games/story-orders.mjs)، وعالمها القصصي، وما اقتُبست منه وما اقتُبس منها.
// النبذة والقصة (بالإنجليزية من IGDB، وبترجمتنا العربية من data/games/translations.json) تُكتب في ملف مستقل تجلبه البطاقة عند فتحها
// (site/games/data/texts.json) فلا يثقل بها ملف القائمة. وموقع كل لعبة من أحداث عالمها (data/games/places.json) يدخل في سجلها (place).
// وما صُحّح رقمه بعد مطابقة خاطئة (data/games/moved.json: القديم ← الصحيح) يُكتب في الملف (moved) لينقل المتصفح سجل اللعبة إلى رقمها الصحيح.
// بلا مفاتيح IGDB يبقى الملف السابق كما هو (أو يُكتب ملف فارغ صالح أول مرة). GAMES_PROBE=1 يطبع عينة من استجابات IGDB للتحقق من الحقول.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { applyCare } from './lib-care.mjs';
import { hasIgdb, igdb } from './lib-igdb.mjs';
import { gamesFor, IMG } from './lib-games.mjs';
import { storesFor } from './lib-stores.mjs';
import { subsFor } from './lib-subs.mjs';

const ADDED = 'data/games/added.json', OUT = 'site/games/data/games.json', TEXTS = 'site/games/data/texts.json', STORES = 'data/generated/games/stores-report.json', SUBS = 'data/generated/games/subs-report.json';
const read = (f, d) => readFile(f, 'utf8').then(JSON.parse).catch(() => d);
const added = (await read(ADDED, { games: [] })).games || [];
await mkdir('site/games/data', { recursive: true });
const empty = { built: new Date().toISOString(), img: IMG, games: [], series: {}, plats: {}, franchises: {} };
if (!hasIgdb()) { const old = await read(OUT, null); if (!old) await writeFile(OUT, JSON.stringify(empty)); console.log(`games: no IGDB keys (IGDB_CLIENT_ID, IGDB_CLIENT_SECRET), ${old ? 'kept the previous file' : 'wrote an empty catalog'}`); process.exit(0); }

if (process.env.GAMES_PROBE) {
  await (await import('./probe-subs.mjs')).probeSubs().catch(e => console.log('subs-probe failed: ' + e.message));   // مصادر الاشتراكات (Game Pass وPS Plus)
  // عينة للتحقق من أسماء الحقول ومصادر المعرّفات الخارجية في IGDB الحية (فروع العمل فقط)
  const show = (t, x) => console.log(`probe ${t}: ${JSON.stringify(x).slice(0, 900)}`);
  show('game_types', await igdb('game_types', 'fields type; limit 50;').catch(e => e.message));
  show('game_statuses', await igdb('game_statuses', 'fields status; limit 50;').catch(e => e.message));
  show('external_game_sources', await igdb('external_game_sources', 'fields name; limit 60;').catch(e => e.message));
  show('website_types', await igdb('website_types', 'fields type; limit 80;').catch(e => e.message));
  show('steam 292030 (Witcher 3)', await igdb('external_games', 'fields game,uid,external_game_source; where uid = "292030" & external_game_source = 1; limit 5;').catch(e => e.message));
  show('search', await igdb('games', 'search "god of war"; fields name,slug,first_release_date,game_type,collections,release_dates.human; limit 5;').catch(e => e.message));
  show('upcoming', await igdb('games', `fields name,first_release_date,release_dates.human,game_status,hypes; where first_release_date > ${Math.floor(Date.now() / 1000)} & hypes > 50; sort hypes desc; limit 5;`).catch(e => e.message));
  show('famous (GTA V, Witcher 3, Elden Ring, RDR2, GoW 2018)', await igdb('games', 'fields name,game_type,total_rating_count,rating_count,aggregated_rating_count,hypes,themes,version_parent; where id = (1020,1942,119133,25076,19560);').catch(e => e.message));
  show('top by total_rating_count, no type filter', await igdb('games', 'fields name,game_type,total_rating_count; where total_rating_count != null; sort total_rating_count desc; limit 12;').catch(e => e.message));
  show('top by rating_count', await igdb('games', 'fields name,game_type,rating_count; where rating_count != null; sort rating_count desc; limit 12;').catch(e => e.message));
  show('popularity types', await igdb('popularity_types', 'fields name,external_popularity_source; limit 50;').catch(e => e.message));
  show('popularity top (type 1)', await igdb('popularity_primitives', 'fields game_id,value,popularity_type; where popularity_type = 1; sort value desc; limit 10;').catch(e => e.message));
  // مطابقة أسماء PlayStation وXbox بـ IGDB كما تفعلها دالة «حساباتي»: الطلب الخام أولاً (ليظهر الخطأ إن وُجد)، ثم المطابقة نفسها
  const { meta, gameyIds } = await import('./lib-games.mjs'), { byName, clean } = await import('../netlify/functions/game-accounts.mjs');
  const m = await meta(), B = [...m.type].find(([, v]) => v === 'bundle')?.[0], T = (t => t.length ? ` & game_type = (${[...t, ...(B != null ? [B] : [])].join(',')})` : '')(gameyIds(m));
  // مطابقات خاطئة ظهرت في سحب PlayStation: ما المداخل التي في IGDB بهذه الأسماء؟ (بلا أي تصفية)
  for (const n of ['Hitman', 'Never Alone', 'Batman', 'Tekken 6']) {
    const rows = await igdb('games', `fields name,game_type,version_parent,parent_game,platforms,first_release_date,total_rating_count; where name ~ ${JSON.stringify(n)}; limit 30;`).catch(e => [{ name: e.message }]);
    for (const g of rows) console.log(`probe exact "${n}": #${g.id} ${g.name} type=${m.type.get(g.game_type) ?? g.game_type} vp=${g.version_parent ?? '-'} parent=${g.parent_game ?? '-'} y=${g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : '-'} plats=${(g.platforms || []).join('.')} rc=${g.total_rating_count ?? 0}`);
    const sr = await igdb('games', `search ${JSON.stringify(n)}; fields name,game_type,version_parent,platforms,first_release_date,total_rating_count; limit 12;`).catch(e => [{ name: e.message }]);
    for (const g of sr) console.log(`probe search "${n}": #${g.id} ${g.name} type=${m.type.get(g.game_type) ?? g.game_type} vp=${g.version_parent ?? '-'} y=${g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : '-'} plats=${(g.platforms || []).join('.')} rc=${g.total_rating_count ?? 0}`);
  }
  const sample = [['HITMAN', 'ps4', '2019-01-01'], ['Never Alone', 'ps4', '2017-01-01'], ['Batman', 'ps4', '2018-01-01'], ['Tekken 6', 'x360', '2012-01-01'], ['Tekken 6', 'ps5', '2024-01-01'], ['Far Cry', 'x360', '2015-01-01'], ['Hades', 'pc', '2022-01-01'], ['ELDEN RING', 'ps5', '2024-07-01'], ['Resident Evil 4', 'ps4', '2018-01-01']]
    .map(([name, plat, last], i) => ({ key: 'p' + i, name: clean(name), plat, last }));
  const t0 = Date.now(), { how, todo } = await byName(sample, T, Date.now() + 7000), ids = [...new Set([...how.values()].map(x => x.id))];
  const names = new Map((ids.length ? await igdb('games', `fields name,first_release_date; where id = (${ids.join(',')}); limit 100;`) : []).map(g => [g.id, g.name + ' (' + (g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : '?') + ')']));
  console.log(`probe byName ${how.size}/${sample.length} in ${Date.now() - t0}ms, todo ${todo.size}`); for (const x of sample) console.log(`probe   ${x.name} [${x.plat}] => ${how.has(x.key) ? '#' + how.get(x.key).id + ' ' + names.get(how.get(x.key).id) + (how.get(x.key).sure ? '' : ' ~') : '—'}`);
}

if (!added.length) { await writeFile(OUT, JSON.stringify(empty)); await writeFile(TEXTS, JSON.stringify({ built: empty.built, texts: {} })); console.log('games: the list is empty'); process.exit(0); }
const story = (await import('../data/games/story-orders.mjs')).default.series || [];
const ids = added.map(g => +g.igdb).filter(Boolean);
let r; try { r = await gamesFor(ids, { wikidata: true, story, log: m => console.log('games: ' + m) }); } catch (e) { console.log(`games: IGDB failed (${e.message}), keeping the previous file`); process.exit(0); }
if (!r.games.length) { console.log('games: IGDB returned nothing, keeping the previous file'); process.exit(0); }
// ترتيب القائمة وتاريخ الإضافة من ملف المضافات
const at = new Map(added.map((g, i) => [+g.igdb, { ord: i, at: g.at || null }]));
for (const g of r.games) Object.assign(g, at.get(g.id) || {});
r.games.sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9));
// أين تُلعب على الكمبيوتر وهل هي مجانية الآن (scripts/lib-stores.mjs). ما تعذّر من مصادره يبقى له ما كان في الملف السابق، وإن تعذّر كله بقيت متاجر الملف السابق كما هي
{ const prev = new Map(((await read(OUT, null))?.games || []).map(g => [g.id, { pc: g.pc, f2p: g.f2p }]));
  try { const st = await storesFor(r.games, { prev, fix: await read('data/games/pc.json', {}), log: m => console.log('games: ' + m) });
    for (const g of r.games) { if (st.rows.has(g.id)) g.pc = st.rows.get(g.id); if (st.f2p.has(g.id)) g.f2p = 1; }
    r.stores = st.meta; await mkdir('data/generated/games', { recursive: true }); await writeFile(STORES, JSON.stringify(st.report, null, 1) + '\n');
    if (process.env.GAMES_PROBE) {   // فروع العمل: الجدول كله في سجل البناء للمراجعة
      for (const [id, f] of Object.entries(await read('data/games/pc.json', {}))) if (f.ids?.steam) { const j = await fetch(`https://store.steampowered.com/api/appdetails?appids=${f.ids.steam}&cc=us&l=en`).then(x => x.json()).catch(() => null), d = j?.[f.ids.steam]?.data;
        console.log(`stores: fix ${id} (${r.games.find(g => String(g.id) === id)?.title}) steam ${f.ids.steam} = ${d?.name ?? '?'} [${d?.type ?? '?'}]`); }   // ما صُحّح باليد يُرى اسمه في المتجر
      for (const [n, v] of Object.entries(st.report.games)) console.log(`stores: ${n} => ${v}`); console.log('stores: pass by title: ' + st.report.passByTitle.join(' | ')); console.log('stores: epic free: ' + st.report.epicFree.join(' | ')); console.log('stores: none: ' + st.report.none.join(' | ')); console.log('stores: gog search: ' + st.report.gogSearch.join(' | ')); console.log('stores: epic guess: ' + st.report.epicGuess.join(' | ')); }
  } catch (e) { console.log(`games: stores failed (${e.message}), keeping the previous stores`); for (const g of r.games) { const o = prev.get(g.id); if (o?.pc) g.pc = o.pc; if (o?.f2p) g.f2p = 1; } } }
// ضمن Game Pass Ultimate أو PS Plus Deluxe الآن (scripts/lib-subs.mjs). ما تعذّر من مصدريه يبقى له ما كان في الملف السابق، وإن تعذّر كله بقي ما كان كما هو
{ const prev = new Map(((await read(OUT, null))?.games || []).map(g => [g.id, g.subs || {}]));
  try { const sb = await subsFor(r.games, { prev, log: m => console.log('games: ' + m) });
    for (const g of r.games) { const row = sb.rows.get(g.id); if (row) g.subs = row; }
    r.subs = sb.meta; await mkdir('data/generated/games', { recursive: true }); await writeFile(SUBS, JSON.stringify(sb.report, null, 1) + '\n');
    if (process.env.GAMES_PROBE) {   // فروع العمل: الجدول كله في سجل البناء للمراجعة
      for (const [n, v] of Object.entries(sb.report.games)) console.log(`subs: ${n} => ${v}`); console.log('subs: by title: ' + sb.report.byTitle.join(' | '));
      for (const [k, x] of Object.entries(sb.report.sample)) console.log(`subs: sample ${k}: ${JSON.stringify(x).slice(0, 1200)}`); }
  } catch (e) { console.log(`games: subscriptions failed (${e.message}), keeping the previous ones`); for (const g of r.games) { const o = prev.get(g.id); if (o?.gp || o?.ps) g.subs = o; } } }
const TR = await read('data/games/translations.json', {}), PLACES = await read('data/games/places.json', {}), moved = await read('data/games/moved.json', {});
const built = new Date().toISOString(), { texts, n } = applyCare(r.games, {}, TR, PLACES);
await writeFile(TEXTS, JSON.stringify({ built, texts }));
await writeFile(OUT, JSON.stringify({ built, img: IMG, ...r, ...(Object.keys(moved).length ? { moved } : {}) }));
{ const sib = r.games.filter(g => g.also?.length); if (sib.length) console.log(`games: ${sib.length} with platforms from same-named sibling records: ` + sib.slice(0, 12).map(g => `${g.title} (${g.plats.join('.')} + ${g.also.join('.')})`).join(' | ')); }
console.log(`games: wrote ${OUT}: ${r.games.length} games, ${Object.keys(r.series).length} series, ${Object.values(r.series).filter(s => s.story).length} with a story order`);
console.log(`games: wrote ${TEXTS}: ${n.text} with text, ${n.ar} in Arabic${n.old ? ` (${n.old} whose English changed since)` : ''}, ${n.place} with a place in their world`);
