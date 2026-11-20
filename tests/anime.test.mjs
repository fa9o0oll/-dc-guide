// فحوص «أنمياتي»: قراءة ملف تصدير MyAnimeList بلا فقد (site/anime-mal.js)، وتشكيل سجل MyAnimeList ومطابقة TMDB وجمع السلاسل (scripts/lib-anime.mjs).
// الملف هنا مصنوع للاختبار (ليس قائمة أحد). تشغيل: node tests/anime.test.mjs
import zlib from 'node:zlib';
import { parseMal, readMalFile, malDate, STATUSES } from '../site/anime-mal.js';
import { shapeMal, pickTmdb, worldsOf, worldName, minutes, malImage, LINKS } from '../scripts/lib-anime.mjs';
let fail = 0; const check = (name, ok, info) => { console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ' — ' + JSON.stringify(info)}`); if (!ok) fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- ملف التصدير
const row = (o) => `<anime>
  <series_animedb_id>${o.id}</series_animedb_id><series_title><![CDATA[${o.title}]]></series_title><series_type>${o.type || 'TV'}</series_type><series_episodes>${o.eps ?? 12}</series_episodes>
  <my_id>0</my_id><my_watched_episodes>${o.w ?? 0}</my_watched_episodes><my_start_date>${o.start || '0000-00-00'}</my_start_date><my_finish_date>${o.finish || '0000-00-00'}</my_finish_date>
  <my_rated></my_rated><my_score>${o.score ?? 0}</my_score><my_storage>${o.storage || ''}</my_storage><my_storage_value>${o.storageValue || '0.00'}</my_storage_value><my_status>${o.status}</my_status>
  <my_comments><![CDATA[${o.comments || ''}]]></my_comments><my_times_watched>${o.times ?? 0}</my_times_watched><my_rewatch_value>${o.rv || ''}</my_rewatch_value><my_priority>${o.pri || 'LOW'}</my_priority>
  <my_tags><![CDATA[${o.tags || ''}]]></my_tags><my_rewatching>${o.rw ?? 0}</my_rewatching><my_rewatching_ep>${o.rwe ?? 0}</my_rewatching_ep><my_discuss>1</my_discuss><my_sns>default</my_sns><update_on_import>0</update_on_import>
</anime>`;
const rows = [
  { id: 5525, title: '07-Ghost', eps: 25, status: 'Plan to Watch' },
  { id: 21, title: 'One Piece', eps: 0, w: 1155, status: 'On-Hold', score: 10, start: '2004-02-28' },
  { id: 1735, title: 'Naruto: Shippuuden', eps: 500, w: 393, status: 'Watching', score: 8 },
  { id: 11061, title: 'Hunter x Hunter (2011)', eps: 148, w: 148, status: 'Completed', score: 10, start: '2016-02-00', finish: '2016-00-00', times: 2, tags: 'مفضل, shounen', comments: 'أفضل <أنمي> & أكثر', pri: 'HIGH', rw: 1, rwe: 30, rv: '5', storage: 'External HD', storageValue: '3.50' },
  { id: 28977, title: 'Gintama°', eps: 51, w: 51, status: 'Completed', score: 10, finish: '2017-03-05' },
  { id: 40750, title: 'Dropped One', eps: 12, w: 3, status: 'Dropped', score: 1 },
  { id: 0, title: 'Broken', status: 'Completed' }, { id: 77, title: 'No Status', status: 'Unknown' },
];
const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<!-- Created by XML Export feature at MyAnimeList.net Version 1.1.0 -->\n<myanimelist>\n<myinfo><user_id>42</user_id><user_name>tester</user_name><user_export_type>1</user_export_type>
<user_total_anime>6</user_total_anime><user_total_watching>1</user_total_watching><user_total_completed>2</user_total_completed><user_total_onhold>1</user_total_onhold><user_total_dropped>1</user_total_dropped><user_total_plantowatch>1</user_total_plantowatch></myinfo>
${rows.map(row).join('\n')}\n</myanimelist>`;
const mal = parseMal(xml), by = id => mal.entries.find(e => e.id === id);
check('الحساب والعدّ يطابقان ما يعلنه الملف', mal.user.name === 'tester' && mal.user.id === 42 && same(mal.totals, { all: 6, watching: 1, completed: 2, hold: 1, dropped: 1, plan: 1, episodes: 1155 + 393 + 148 + 51 + 3, scored: 5 }) && ['all', ...STATUSES].every(k => mal.declared[k] === mal.totals[k]), mal.totals);
check('الترتيب ترتيب الملف، والحالات الخمس بأسمائها', same(mal.entries.map(e => [e.id, e.ord, e.status]), [[5525, 0, 'plan'], [21, 1, 'hold'], [1735, 2, 'watching'], [11061, 3, 'completed'], [28977, 4, 'completed'], [40750, 5, 'dropped']]), mal.entries.map(e => [e.id, e.ord, e.status]));
check('عمل بلا عدد حلقات معروف (مستمر) وتقدمه أكبر من الصفر', same(by(21), { id: 21, ord: 1, title: 'One Piece', type: 'TV', eps: 0, status: 'hold', watched: 1155, score: 10, start: '2004-02-28', finish: null }), by(21));
check('الاسم بحروفه الخاصة كما هو', by(28977).title === 'Gintama°' && by(28977).finish === '2017-03-05');
check('التاريخ الناقص يُحفظ بقدر ما فيه: سنة وشهر، أو سنة فقط', by(11061).start === '2016-02' && by(11061).finish === '2016' && malDate('0000-00-00') === null && malDate('2021-12-31') === '2021-12-31' && malDate('') === null);
check('الحقول النادرة لا تضيع: الإعادة والأولوية والوسوم والملاحظات والتخزين', same((({ times, rewatching, rewatchEp, priority, tags, comments, rewatchValue, storage, storageValue }) => ({ times, rewatching, rewatchEp, priority, tags, comments, rewatchValue, storage, storageValue }))(by(11061)),
  { times: 2, rewatching: true, rewatchEp: 30, priority: 2, tags: 'مفضل, shounen', comments: 'أفضل <أنمي> & أكثر', rewatchValue: 5, storage: 'External HD', storageValue: 3.5 }), by(11061));
check('ولا تُضاف حين تكون فارغة', !('times' in by(5525)) && !('tags' in by(5525)) && !('priority' in by(5525)) && Object.keys(by(5525)).length === 10, Object.keys(by(5525)));
check('سطر بلا رقم أو بحالة مجهولة يُذكر ولا يُخمَّن', same(mal.skipped, ['Broken', 'No Status']), mal.skipped);
check('ملف ليس تصدير MyAnimeList يُرفض بسبب واضح', (() => { try { parseMal('<html></html>'); return false; } catch (e) { return /MyAnimeList/.test(e.message); } })());
check('ملف المانغا يُرفض باسمه', (() => { try { parseMal('<myanimelist><myinfo></myinfo><manga><manga_mangadb_id>1</manga_mangadb_id></manga></myanimelist>'); return false; } catch (e) { return /المانغا/.test(e.message); } })());
{ const gz = zlib.gzipSync(Buffer.from(xml)), file = b => ({ arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) });
  const a = await readMalFile(file(gz)), b = await readMalFile(file(Buffer.from(xml)));
  check('الملف يُقرأ مضغوطاً (.gz) ومفكوكاً بالنتيجة نفسها', same(a, mal) && same(b, mal)); }
check('حالات بصيغ أخرى (أرقام واجهة MAL) تُقرأ', parseMal(xml.replace('<my_status>Watching</my_status>', '<my_status>1</my_status>').replace('<my_status>On-Hold</my_status>', '<my_status>3</my_status>')).totals.watching === 1);

// ---------- سجل MyAnimeList القادم من Jikan
const jikan = { mal_id: 38524, images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/1517/100633.jpg', large_image_url: 'https://cdn.myanimelist.net/images/anime/1517/100633l.jpg' }, webp: { image_url: 'https://cdn.myanimelist.net/images/anime/1517/100633.webp', large_image_url: 'https://cdn.myanimelist.net/images/anime/1517/100633l.webp' } },
  trailer: { youtube_id: 'hKHepjfj5Tw' }, titles: [{ type: 'Default', title: 'Shingeki no Kyojin Season 3 Part 2' }, { type: 'English', title: 'Attack on Titan Season 3 Part 2' }], title: 'Shingeki no Kyojin Season 3 Part 2', title_english: 'Attack on Titan Season 3 Part 2', title_japanese: '進撃の巨人 Season3 Part.2', title_synonyms: [],
  type: 'TV', source: 'Manga', episodes: 10, status: 'Finished Airing', airing: false, aired: { from: '2019-04-29T00:00:00+00:00', to: '2019-07-01T00:00:00+00:00' }, duration: '23 min per ep', rating: 'R - 17+ (violence & profanity)', score: 9.05, scored_by: 1700000, rank: 3,
  season: 'spring', year: 2019, broadcast: { day: 'Mondays', time: '00:10', timezone: 'Asia/Tokyo' }, studios: [{ mal_id: 858, name: 'Wit Studio' }], genres: [{ name: 'Action' }, { name: 'Drama' }], themes: [{ name: 'Gore' }, { name: 'Military' }], demographics: [{ name: 'Shounen' }],
  synopsis: 'Seeking to restore humanity\'s diminishing hope, the Survey Corps embark on a mission.\n\n[Written by MAL Rewrite]',
  relations: [{ relation: 'Adaptation', entry: [{ mal_id: 23390, type: 'manga', name: 'Shingeki no Kyojin' }] }, { relation: 'Prequel', entry: [{ mal_id: 35760, type: 'anime', name: 'Shingeki no Kyojin Season 3' }] }, { relation: 'Sequel', entry: [{ mal_id: 40028, type: 'anime', name: 'Shingeki no Kyojin: The Final Season' }] }],
  streaming: [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GR751KNZY' }, { name: 'Bad', url: 'javascript:alert(1)' }] };
const s = shapeMal(jikan);
check('السجل يُشكَّل: الأسماء والنوع والحلقات والحالة والتواريخ والمدة والتصنيف والتقييم', s.title === 'Shingeki no Kyojin Season 3 Part 2' && s.en === 'Attack on Titan Season 3 Part 2' && s.jp === '進撃の巨人 Season3 Part.2' && s.type === 'TV' && s.eps === 10 && s.status === 'finished'
  && s.from === '2019-04-29' && s.to === '2019-07-01' && s.dur === 23 && s.rating === 'R' && s.score === 9.05 && s.votes === 1700000 && s.season === 'spring' && s.year === 2019 && s.day === 'Monday' && s.source === 'Manga', s);
check('الصورة مسار بلا مقاس، والاستوديو والتصنيفات بأسمائها', s.img === '1517/100633' && same(s.studios, ['Wit Studio']) && same(s.genres, ['Action', 'Drama']) && same(s.themes, ['Gore', 'Military']) && same(s.demo, ['Shounen']) && s.trailer === 'hKHepjfj5Tw', s);
check('علاقات الأنمي فقط (لا المانغا)، والنبذة بلا توقيع المصدر، وروابط البث السليمة فقط', same(s.rel, [{ r: 'Prequel', id: 35760, name: 'Shingeki no Kyojin Season 3' }, { r: 'Sequel', id: 40028, name: 'Shingeki no Kyojin: The Final Season' }]) && s.synopsis === 'Seeking to restore humanity\'s diminishing hope, the Survey Corps embark on a mission.' && same(s.stream, [{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GR751KNZY' }]), s);
check('سجل ناقص الحقول لا يكسر شيئاً', (() => { const x = shapeMal({ mal_id: 1, title: 'X', status: 'Not yet aired', aired: {}, duration: 'Unknown', rating: null }); return x.status === 'soon' && x.eps === 0 && x.dur === null && x.rating === null && x.img === null && same(x.rel, []) && x.year === null && x.synopsis === null; })());
check('المدة بالدقائق، والتصنيف الإباحي يُعرف', minutes('1 hr 45 min') === 105 && minutes('24 min per ep') === 24 && minutes('2 hr') === 120 && minutes('30 sec per ep') === 1 && minutes('Unknown') === null && shapeMal({ ...jikan, rating: 'Rx - Hentai' }).rating === 'Rx' && shapeMal({ ...jikan, rating: 'R+ - Mild Nudity' }).rating === 'R+' && shapeMal({ ...jikan, rating: 'PG-13 - Teens 13 or older' }).rating === 'PG-13');
check('صورة MAL من أي مقاس أو امتداد', malImage({ jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg' } }) === '4/19644' && malImage({ jpg: { image_url: 'https://cdn.myanimelist.net/img/sp/icon/apple-touch-icon-256.png' } }) === null && malImage(undefined) === null);

// ---------- مطابقة TMDB من خريطة Fribb
check('موسم وإزاحة حلقات (الجزء الثاني من موسم)', same(pickTmdb({ type: 'TV', themoviedb_id: { tv: 1429 }, season: { tvdb: 3, tmdb: 3 }, episode_offset: { tvdb: 12, tmdb: 12 } }), { k: 'tv', id: 1429, s: 3, o: 12 }));
check('مسلسل بلا موسم (يمتد على المواسم كلها)، وحلقة خاصة في الموسم 0، وفيلم، وبلا مطابقة', same(pickTmdb({ type: 'TV', themoviedb_id: { tv: 37854 } }), { k: 'tv', id: 37854 }) && same(pickTmdb({ type: 'SPECIAL', themoviedb_id: { tv: 86031 }, season: { tvdb: 0, tmdb: 0 }, episode_offset: { tvdb: 1, tmdb: 1 } }), { k: 'tv', id: 86031, s: 0, o: 1 })
  && same(pickTmdb({ type: 'MOVIE', themoviedb_id: { movie: [72015, 5] } }), { k: 'movie', id: 72015 }) && pickTmdb({ type: 'MOVIE', mal_id: 8888 }) === null && same(pickTmdb({ type: 'TV', themoviedb_id: { tv: 30984 }, season: { tvdb: 17, tmdb: 2 }, episode_offset: { tvdb: 13 } }), { k: 'tv', id: 30984, s: 2 }));

// ---------- السلاسل
const W = (id, title, from, rel = [], more = {}) => ({ id, title, from, type: 'TV', en: null, mine: true, rel: rel.map(([r, i]) => ({ r, id: i })), ...more });
const worlds = worldsOf([
  W(16498, 'Shingeki no Kyojin', '2013-04-07', [['Sequel', 25777], ['Side Story', 18397]], { en: 'Attack on Titan' }), W(25777, 'Shingeki no Kyojin Season 2', '2017-04-01', [['Prequel', 16498]]), W(18397, 'Shingeki no Kyojin OVA', '2013-12-09', [['Parent Story', 16498]], { type: 'OVA', mine: false }),
  W(11741, 'Fate/Zero 2nd Season', '2012-04-08', [['Prequel', 10087]]), W(10087, 'Fate/Zero', '2011-10-02', [['Sequel', 11741], ['Character', 21]]),
  W(21, 'One Piece', '1999-10-20', [['Other', 813]]), W(813, 'Dragon Ball Z', '1989-04-26', []),
  W(900, 'Lonely Relative A', '2001-01-01', [['Sequel', 901]], { mine: false }), W(901, 'Lonely Relative B', '2002-01-01', [], { mine: false }),
  W(918, 'Gintama', '2006-04-04', [['Sequel', 9969]]), W(9969, "Gintama'", '2011-04-04', []), W(7472, 'Gintama Movie 1', '2010-04-24', [['Alternative Version', 918]], { type: 'Movie' }),
]);
check('عملان فأكثر بعلاقات القصة يصيران سلسلة بترتيب الصدور، واسمها اسم أقدم مسلسلاتها', same(worlds.map(w => [w.id, w.name, w.ids]), [[10087, 'Fate/Zero', [10087, 11741]], [918, 'Gintama', [918, 7472, 9969]], [16498, 'Shingeki no Kyojin', [16498, 18397, 25777]]]) && worlds[2].en === 'Attack on Titan', worlds);
check('«Character» و«Other» لا تدمجان سلسلتين، وسلسلة ليس فيها عمل من القائمة لا تُعرض', !worlds.some(w => w.ids.includes(21) || w.ids.includes(813) || w.ids.includes(900)) && !LINKS.has('Other') && !LINKS.has('Character') && LINKS.has('Side Story'));
check('اسم السلسلة بلا لاحقة الموسم', worldName('Kingdom 2nd Season') === 'Kingdom' && worldName('Gintama (TV)') === 'Gintama' && worldName('Mob Psycho 100') === 'Mob Psycho 100' && worldName('Spy x Family Part 2') === 'Spy x Family' && worldName('Hunter x Hunter (2011)') === 'Hunter x Hunter' && worldName('86') === '86');

console.log(fail ? `\n❌ فشل ${fail}` : '\n✅ كل فحوص أنمياتي نجحت');
process.exit(fail ? 1 : 0);
