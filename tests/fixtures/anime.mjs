// بيانات أنمي للفحص بشكل ما يبنيه scripts/build-anime.mjs (كتالوج خفيف + نصوص)، وملف تصدير MyAnimeList مصنوع، ورد SIMKL مصنوع.
// الأسماء أسماء أعمال حقيقية لتبدو الصفحة كما هي، والسجل الشخصي فيها مختلَق للفحص (ليس سجل أحد).
import zlib from 'node:zlib';
const day = n => new Date(Date.now() + n * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const P = (stream = [], rent = []) => ({ link: 'https://www.themoviedb.org/tv/1/watch?locale=SA', stream, free: [], rent, buy: [] });
export const catalog = () => ({ generatedAt: new Date().toISOString(), imageBase: 'https://image.tmdb.org/t/p/', malImages: 'https://cdn.myanimelist.net/images/anime/', country: 'SA',
  providers: { 8: { name: 'Netflix', logo: '/n.jpg' }, 283: { name: 'Crunchyroll', logo: '/c.jpg' } }, genres: ['Action', 'Adventure', 'Comedy', 'Shounen'],
  anime: [
    { id: 11061, t: 'Hunter x Hunter (2011)', en: 'Hunter x Hunter', type: 'TV', eps: 148, ord: 0, y: 2011, se: 'fall', st: 'finished', from: '2011-10-02', img: '1337/99013', sc: 9.03, sv: 1900000, dur: 23, g: [0, 1, 3], studio: 'Madhouse', rating: 'PG-13', w: 136, tm: { k: 'tv', id: 46298 }, tp: '/hxh.jpg', bd: '/hxhb.jpg', pv: P([8, 283]), sk: 39507 },
    { id: 136, t: 'Hunter x Hunter', type: 'TV', eps: 62, ord: 1, y: 1999, se: 'fall', st: 'finished', from: '1999-10-16', img: '1305/132237', sc: 8.41, sv: 120000, dur: 23, studio: 'Nippon Animation', w: 136, tm: { k: 'tv', id: 45952, s: 1 }, pv: null },
    { id: 13271, t: 'Hunter x Hunter Movie 1: Phantom Rouge', type: 'Movie', eps: 1, ord: 2, y: 2013, st: 'finished', from: '2013-01-12', img: '6/43531', sc: 7.3, sv: 90000, dur: 97, g: [0, 1], studio: 'Madhouse', w: 136, tm: { k: 'movie', id: 171274 }, pv: null },
    { id: 137, t: 'Hunter x Hunter: Original Video Animation', type: 'OVA', eps: 8, x: 1, y: 2002, st: 'finished', from: '2002-01-17', img: '10/9279', sc: 8.3, dur: 24, w: 136 },
    { id: 1735, t: 'Naruto: Shippuuden', en: 'Naruto Shippuden', type: 'TV', eps: 500, ord: 3, y: 2007, se: 'winter', st: 'finished', from: '2007-02-15', img: '1565/111305', sc: 8.28, sv: 1700000, dur: 23, g: [0, 3], studio: 'Pierrot', tm: { k: 'tv', id: 31910 }, bd: '/nsb.jpg', pv: P([], [8]) },
    { id: 37989, t: 'Golden Kamuy 2nd Season', type: 'TV', eps: 12, ord: 4, y: 2018, se: 'fall', st: 'finished', from: '2018-10-08', img: '1180/95018', sc: 8.26, sv: 200000, dur: 23, studio: 'Geno Studio', tm: { k: 'tv', id: 76757, s: 2 }, pv: { stream: [], free: [], rent: [], buy: [] }, pvs: 1, pvo: P([8]) },   // لا منصة لهذا الموسم هنا، ومواسم أخرى على Netflix
    { id: 21, t: 'One Piece', type: 'TV', eps: 0, ord: 5, y: 1999, se: 'fall', st: 'airing', from: '1999-10-20', img: '1244/138851', sc: 8.73, sv: 1500000, dur: 24, g: [0, 1], studio: 'Toei Animation', tm: { k: 'tv', id: 37854 }, pv: P([283]), nx: { ep: 1156, date: day(3) } },
    { id: 52701, t: 'Dungeon Meshi', en: 'Delicious in Dungeon', type: 'TV', eps: 24, ord: 6, y: 2024, se: 'winter', st: 'finished', from: '2024-01-04', img: '1711/142478', sc: 8.6, sv: 600000, dur: 25, g: [1, 2], studio: 'Trigger', tm: { k: 'tv', id: 207784, s: 1 }, bd: '/dmb.jpg', pv: P([8]), sk: 1970434 },
    { id: 5114, t: 'Fullmetal Alchemist: Brotherhood', type: 'TV', eps: 64, ord: 7, y: 2009, se: 'spring', st: 'finished', from: '2009-04-05', img: '1208/94745', sc: 9.1, sv: 2200000, dur: 24, studio: 'Bones', tm: { k: 'tv', id: 31911, s: 1 }, pv: P([283]), pvs: 1 },   // منصات الموسم نفسه
    { id: 22297, t: 'Fate/stay night: Unlimited Blade Works', type: 'TV', eps: 12, ord: 8, y: 2014, se: 'fall', st: 'finished', from: '2014-10-12', img: '12/67333', sc: 8.18, sv: 740000, dur: 28, g: [0, 2], studio: 'ufotable', w: 356, tm: { k: 'tv', id: 61415, s: 1 }, bd: '/ubw.jpg', pv: null },
    { id: 356, t: 'Fate/stay night', type: 'TV', eps: 24, ord: 9, y: 2006, se: 'winter', st: 'finished', from: '2006-01-07', img: '8/82299', sc: 7.27, sv: 550000, dur: 24, studio: 'Studio Deen', w: 356, tm: { k: 'tv', id: 45845, s: 1 }, pv: null },
    { id: 199, t: 'Sen to Chihiro no Kamikakushi', en: 'Spirited Away', type: 'Movie', eps: 1, ord: 10, y: 2001, st: 'finished', from: '2001-07-20', img: '6/79597', sc: 8.77, sv: 1300000, dur: 124, studio: 'Studio Ghibli', tm: { k: 'movie', id: 129 }, bd: '/sab.jpg', pv: P([8]) },
    { id: 60000, t: 'Brand New Show', type: 'TV', eps: 12, ord: 11, pending: 1 },
    { id: 61000, t: 'Upcoming Thing', type: 'TV', eps: 0, ord: 12, y: 2027, st: 'soon', from: '2027-04', img: '1/1', tm: { k: 'tv', id: 999 }, pv: null },
  ],
  // خطوط السلسلة كما يكتبها البناء (lib-anime: linesOf): الرئيسي مسلسل 1999 وحلقاته OVA، ومسلسل 2011 وفيلمه خط «نسخة أخرى» من مسلسل 1999
  worlds: [{ id: 136, name: 'Hunter x Hunter', head: 11061, ids: [136, 137, 11061, 13271], lk: 'ma', li: [0, 0, 1, 1], ri: [-1, 0, 0, 2] }, { id: 356, name: 'Fate/stay night', ids: [356, 22297], story: [22297, 356], sv: 1, sn: 'ترتيب القصة هنا يبدأ بالمسار الأحدث. من يشاهد أول مرة يبدأ بترتيب الصدور.' }] });
export const texts = { 11061: { en: 'Hunters devote themselves to accomplishing hazardous tasks.', ar: 'الصيادون يكرّسون أنفسهم لمهام خطرة، وGon Freecss يخرج ليصير صياداً ويجد أباه.', jp: 'HUNTER×HUNTER', source: 'Manga', anilist: 11061,
    wa: 'مانغا يوشيهيرو توغاشي في عالم الصيادين.\n\nحُوّلت إلى الأنمي مرتين: نسخة 1999 وأوفاتها، ثم نسخة 2011 التي تعيد الحكاية من أولها.',
    rel: [{ r: 'Alternative Version', id: 136, name: 'Hunter x Hunter' }, { r: 'Sequel', id: 13271, name: 'Hunter x Hunter Movie 1: Phantom Rouge' }, { r: 'Other', id: 999999, name: 'Not here' }] },
  52701: { en: 'After the Golden Kingdom is sunk underground by an insane magician, its king emerges.', jp: 'ダンジョン飯', source: 'Manga' } };
// ملف التصدير: 13 عملاً. يشاهد 3، أكمل 4، مؤجَّل 1، ترك 1، سيشاهد 4
const R = (id, title, type, eps, status, w = 0, score = 0, start = '0000-00-00', finish = '0000-00-00') => `<anime><series_animedb_id>${id}</series_animedb_id><series_title><![CDATA[${title}]]></series_title><series_type>${type}</series_type><series_episodes>${eps}</series_episodes><my_id>0</my_id>
<my_watched_episodes>${w}</my_watched_episodes><my_start_date>${start}</my_start_date><my_finish_date>${finish}</my_finish_date><my_rated></my_rated><my_score>${score}</my_score><my_storage></my_storage><my_storage_value>0.00</my_storage_value><my_status>${status}</my_status>
<my_comments><![CDATA[]]></my_comments><my_times_watched>0</my_times_watched><my_rewatch_value></my_rewatch_value><my_priority>LOW</my_priority><my_tags><![CDATA[]]></my_tags><my_rewatching>0</my_rewatching><my_rewatching_ep>0</my_rewatching_ep><my_discuss>1</my_discuss><my_sns>default</my_sns><update_on_import>0</update_on_import></anime>`;
export const malXml = () => `<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist><myinfo><user_id>7</user_id><user_name>tester</user_name><user_export_type>1</user_export_type><user_total_anime>13</user_total_anime><user_total_watching>3</user_total_watching><user_total_completed>4</user_total_completed><user_total_onhold>1</user_total_onhold><user_total_dropped>1</user_total_dropped><user_total_plantowatch>4</user_total_plantowatch></myinfo>
${[R(11061, 'Hunter x Hunter (2011)', 'TV', 148, 'Completed', 148, 10, '2016-02-03', '2016-02-21'), R(136, 'Hunter x Hunter', 'TV', 62, 'Completed', 62, 10), R(13271, 'Hunter x Hunter Movie 1: Phantom Rouge', 'Movie', 1, 'Plan to Watch'),
    R(1735, 'Naruto: Shippuuden', 'TV', 500, 'Watching', 393, 8), R(37989, 'Golden Kamuy 2nd Season', 'TV', 12, 'Watching', 7, 8, '2025-06-10'), R(21, 'One Piece', 'TV', 0, 'On-Hold', 1155, 10, '2004-02-28'),
    R(52701, 'Dungeon Meshi', 'TV', 24, 'Watching'), R(5114, 'Fullmetal Alchemist: Brotherhood', 'TV', 64, 'Completed', 64, 10, '0000-00-00', '2016-02-05'), R(22297, 'Fate/stay night: Unlimited Blade Works', 'TV', 12, 'Plan to Watch'),
    R(356, 'Fate/stay night', 'TV', 24, 'Dropped', 3, 4), R(199, 'Sen to Chihiro no Kamikakushi', 'Movie', 1, 'Completed', 1, 9, '0000-00-00', '2017-01-10'), R(60000, 'Brand New Show', 'TV', 12, 'Plan to Watch'), R(61000, 'Upcoming Thing', 'TV', 0, 'Plan to Watch')].join('\n')}\n</myanimelist>`;
export const malGz = () => zlib.gzipSync(Buffer.from(malXml()));
// رد SIMKL على /sync/all-items/anime: عمل تقدّم فيه أبعد من الملف (Dungeon Meshi 5 حلقات بتواريخها)، وعمل أكمله هناك (Golden Kamuy)، وعمل مطابق،
// وعمل ليس في السجل (Fate/stay night UBW يشاهده)، وعمل بلا رقم MyAnimeList يُطابَق برقم SIMKL، وعمل لا يُعرف.
// وكما في الحسابات الحقيقية: يوم نقل جماعي (2026-07-10) عُلّمت فيه حلقات Hunter x Hunter كلها وحلقات UBW، ومدخل يجمع ثلاثة أجزاء في فيلم واحد (Spirited Away بثلاث «حلقات»)
const MOVED = '2026-07-10T15:17:21Z', eps = (n, at) => [{ number: 1, episodes: Array.from({ length: n }, (_, i) => ({ number: i + 1, watched_at: at })) }];
export const simklItems = () => ({ anime: [
  { status: 'watching', watched_episodes_count: 5, total_episodes_count: 24, user_rating: 9, last_watched_at: '2026-11-18T19:00:00Z', show: { title: 'Delicious in Dungeon', ids: { simkl: 1970434 } },
    seasons: [{ number: 1, episodes: [1, 2, 3, 4, 5].map(n => ({ number: n, watched_at: `2026-11-1${n}T18:00:00Z` })) }] },
  { status: 'completed', watched_episodes_count: 12, total_episodes_count: 12, user_rating: null, last_watched_at: '2026-10-02T20:00:00Z', show: { title: 'Golden Kamuy 2', ids: { simkl: 849475, mal: '37989' } } },
  { status: 'completed', watched_episodes_count: 148, total_episodes_count: 148, user_rating: 10, last_watched_at: MOVED, show: { title: 'Hunter x Hunter', ids: { simkl: 39507, mal: 11061 } }, seasons: eps(148, MOVED) },
  { status: 'watching', watched_episodes_count: 4, total_episodes_count: 12, last_watched_at: MOVED, show: { title: 'Fate/stay night UBW', ids: { simkl: 5, mal: 22297 } }, seasons: eps(4, MOVED) },
  { status: 'completed', watched_episodes_count: 3, total_episodes_count: 3, last_watched_at: MOVED, show: { title: 'Spirited Away', ids: { simkl: 55, mal: 199 } }, seasons: eps(3, MOVED) },
  { status: 'plantowatch', watched_episodes_count: 0, show: { title: 'Unknown Thing', ids: { simkl: 424242 } } },
] });
// حلقات الأعمال كما يبنيها scripts/build-anime-episodes.mjs: ملف لكل عمل وفهرس. في Naruto: Shippuuden حلقة مترجمة (394)، وحلقة ملخصها بالإنجليزية (395)،
// وحلقة بلا ملخص ولا صورة (396). وفي One Piece (عدد لم يُعلن) ثلاث حلقات لم تُعرض بعد، آخرها بلا موعد. وعملان لا يوافق عددُ حلقاتهما في المصدر
// عددَ MyAnimeList: Fullmetal Alchemist: Brotherhood بفرق حلقتين (fit: odd)، وFate/stay night بعدّ آخر (fit: loose، للقراءة بلا تعليم)
const wk = (from, i) => new Date(Date.parse(from) + i * 7 * 864e5).toISOString().slice(0, 10);
export const epIndex = () => ({ 21: 1160, 356: 30, 1735: 500, 5114: 62, 37989: 12, 52701: 24 });
export function episodes(id) { const mk = (n, from, tv, over = {}) => ({ id, tv, how: 'map', eps: Array.from({ length: n }, (_, i) => ({ n: i + 1, se: Math.floor(i / 25) + 1, ep: i % 25 + 1, t: `Chapter ${i + 1}`, d: wk(from, i), r: 23, ov: `What happens in chapter ${i + 1}.`, st: `/still${i + 1}.jpg`, ...(over[i + 1] || {}) })) });
  if (id === 1735) { const j = mk(500, '2007-02-15', 31910, { 394: { t: 'The New Chunin Exams', ta: 'اختبارات التشونين الجديدة', ov: 'Naruto remembers the exams held while he was away.', oa: 'يتذكر ناروتو الاختبارات التي أقيمت وهو غائب عن القرية.', ra: 8.1 }, 395: { t: 'The Chunin Exams Begin!' } }); j.eps[395] = { n: 396, se: 16, ep: 21, d: wk('2007-02-15', 395) }; return j; }
  if (id === 21) { const j = mk(1160, '1999-10-20', 37854); j.eps[1157].d = day(3); j.eps[1158].d = day(10); delete j.eps[1159].d; for (const e of j.eps.slice(0, 1157)) if (e.d > day(0)) e.d = day(-1); return j; }
  if (id === 37989) return mk(12, '2018-10-08', 76757);
  if (id === 52701) return mk(24, '2024-01-04', 207784);
  if (id === 5114) return { ...mk(62, '2009-04-05', 31911), fit: 'odd' };
  if (id === 356) return { ...mk(30, '2006-01-07', 45845), fit: 'loose' };
  return null; }
