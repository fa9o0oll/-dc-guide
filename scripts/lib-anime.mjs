// منطق «أنمياتي» المشترك بين بناء البيانات (build-anime.mjs) واختباراته: تشكيل سجل MyAnimeList القادم من Jikan،
// قراءة مطابقة TMDB من خريطة Fribb/anime-lists، وجمع الأعمال في سلاسل من علاقات القصة.

// علاقات القصة التي تجعل عملين من سلسلة واحدة. «Character» و«Other» خارجها عمداً: تربطان أعمالاً لا يجمعها غير ظهور شخصية
// أو حلقة مشتركة (حلقة One Piece مع Dragon Ball وToriko مثلاً)، فتدمجان سلاسل لا علاقة بينها
export const LINKS = new Set(['Sequel', 'Prequel', 'Side Story', 'Parent Story', 'Spin-Off', 'Alternative Version', 'Alternative Setting', 'Summary', 'Full Story']);
const STATUS = { 'Finished Airing': 'finished', 'Currently Airing': 'airing', 'Not yet aired': 'soon' };
const day = s => /^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : null;
// «24 min per ep» أو «1 hr 45 min» أو «2 hr» ← دقائق
export const minutes = s => { const h = /(\d+)\s*hr/.exec(s || ''), m = /(\d+)\s*min/.exec(s || ''), sec = /(\d+)\s*sec/.exec(s || ''); const n = (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0); return n || (sec ? 1 : null); };
// مسار الصورة في cdn.myanimelist.net/images/anime/ بلا مقاس ولا امتداد: 1711/142478 (يُركَّب منه l.webp للكبيرة و.webp للمتوسطة)
export const malImage = im => { const u = im?.webp?.large_image_url || im?.jpg?.large_image_url || im?.jpg?.image_url || '', m = /\/images\/anime\/(\d+\/\d+)[a-z]?\.(?:jpe?g|webp)/.exec(u); return m ? m[1] : null; };
const names = l => (l || []).map(x => x?.name).filter(Boolean);

// سجل Jikan (/anime/{id}/full) ← ما نحفظه
export function shapeMal(d) {
  const title = d.title || d.titles?.find(t => t.type === 'Default')?.title || '', en = d.title_english || d.titles?.find(t => t.type === 'English')?.title || null;
  return { title, en: en && en !== title ? en : null, jp: d.title_japanese || null, syn: (d.title_synonyms || []).filter(Boolean).slice(0, 8),
    type: d.type || '', source: d.source && d.source !== 'Unknown' ? d.source : null, eps: d.episodes || 0, status: STATUS[d.status] || 'finished',
    from: day(d.aired?.from), to: day(d.aired?.to), dur: minutes(d.duration), rating: (/^(Rx|R\+|R|PG-13|PG|G)(?=\s|$)/.exec(d.rating || '') || [])[1] || null,
    score: d.score || null, votes: d.scored_by || 0, rank: d.rank || null, season: d.season || null, year: d.year || (day(d.aired?.from) ? +d.aired.from.slice(0, 4) : null),
    day: d.broadcast?.day ? d.broadcast.day.replace(/s$/, '') : null, time: d.broadcast?.time || null,
    studios: names(d.studios), genres: names(d.genres), themes: names(d.themes), demo: names(d.demographics), img: malImage(d.images), trailer: d.trailer?.youtube_id || null,
    synopsis: (d.synopsis || '').replace(/\s*\[Written by MAL Rewrite\]\s*$/, '').replace(/\s*\(Source: [^)]*\)\s*$/, '').trim() || null,
    rel: (d.relations || []).flatMap(r => (r.entry || []).filter(e => e.type === 'anime' && e.mal_id).map(e => ({ r: r.relation, id: e.mal_id, name: e.name || '' }))),
    stream: (d.streaming || []).filter(s => s?.name && /^https:\/\//.test(s.url || '')).map(s => ({ name: s.name, url: s.url })) };
}

// سجل واجهة MyAnimeList الرسمية (/v2/anime/{id}) ← الشكل نفسه. الواجهة تجمع التصنيفات والثيمات والفئة في genres، ولا تعطي المقطع الدعائي ولا روابط البث
const MEDIA = { tv: 'TV', ova: 'OVA', movie: 'Movie', special: 'Special', ona: 'ONA', music: 'Music', tv_special: 'TV Special', pv: 'PV', cm: 'CM' };
const API_STATUS = { finished_airing: 'finished', currently_airing: 'airing', not_yet_aired: 'soon' }, API_RATING = { g: 'G', pg: 'PG', pg_13: 'PG-13', r: 'R', 'r+': 'R+', rx: 'Rx' };
const REL = { sequel: 'Sequel', prequel: 'Prequel', alternative_setting: 'Alternative Setting', alternative_version: 'Alternative Version', side_story: 'Side Story', parent_story: 'Parent Story', summary: 'Summary', full_story: 'Full Story', spin_off: 'Spin-Off', character: 'Character', other: 'Other' };
const words = s => String(s || '').split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
export const MAL_FIELDS = 'id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,num_scoring_users,nsfw,media_type,status,genres,num_episodes,start_season,broadcast,source,average_episode_duration,rating,related_anime,studios';
// تاريخ MyAnimeList قد يكون ناقصاً (سنة، أو سنة وشهر): يُحفظ كما هو
const part = d => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(d || '') ? d : null;
export function shapeMalApi(d) {
  const en = d.alternative_titles?.en || null, from = part(d.start_date);
  return { title: d.title || '', en: en && en !== d.title ? en : null, jp: d.alternative_titles?.ja || null, syn: (d.alternative_titles?.synonyms || []).filter(Boolean).slice(0, 8),
    type: MEDIA[d.media_type] || '', source: d.source && d.source !== 'other' ? words(d.source) : null, eps: d.num_episodes || 0, status: API_STATUS[d.status] || 'finished',
    from, to: part(d.end_date), dur: d.average_episode_duration ? Math.max(1, Math.round(d.average_episode_duration / 60)) : null, rating: API_RATING[d.rating] || null, nsfw: d.nsfw === 'black' ? 1 : 0,
    score: d.mean || null, votes: d.num_scoring_users || 0, rank: d.rank || null, season: d.start_season?.season || null, year: d.start_season?.year || (from ? +from.slice(0, 4) : null),
    day: d.broadcast?.day_of_the_week ? words(d.broadcast.day_of_the_week) : null, time: d.broadcast?.start_time || null,
    studios: names(d.studios), genres: names(d.genres), themes: [], demo: [], img: malImage({ jpg: { large_image_url: d.main_picture?.large, image_url: d.main_picture?.medium } }), trailer: null,
    synopsis: (d.synopsis || '').replace(/\s*\[Written by MAL Rewrite\]\s*$/, '').replace(/\s*\(Source: [^)]*\)\s*$/, '').trim() || null,
    rel: (d.related_anime || []).filter(x => x?.node?.id).map(x => ({ r: REL[x.relation_type] || x.relation_type_formatted || 'Other', id: x.node.id, name: x.node.title || '' })), stream: [] };
}

// مطابقة TMDB من سطر في خريطة Fribb: { k: 'tv'|'movie', id, s: الموسم, o: إزاحة الحلقات }. s غائب: العمل يمتد على مواسم المسلسل كلها
export function pickTmdb(e) { const t = e?.themoviedb_id; if (!t) return null;
  if (typeof t === 'number') return { k: e.type === 'MOVIE' ? 'movie' : 'tv', id: t };
  if (t.tv) { const s = e.season?.tmdb, o = e.episode_offset?.tmdb; return { k: 'tv', id: t.tv, ...(Number.isInteger(s) ? { s } : {}), ...(o > 0 ? { o } : {}) }; }
  const m = [].concat(t.movie || [])[0]; return m ? { k: 'movie', id: m } : null; }

// السلاسل. items: [{ id, rel: [{r, id}], from, type, eps, title, en, mine }]. تُعاد السلاسل التي فيها عملان فأكثر وفيها عمل من القائمة.
// الجمع على ثلاث مراحل حتى لا يدمج عملٌ مشترك بين سلسلتين (Fairy Tail x Rave) السلسلتين معاً:
//   1) «الجزء السابق» و«اللاحق» يجمعان بلا شرط.  2) بقية علاقات القصة تجمع حين لا يكون أحد الطرفين عملاً صغيراً (غير مسلسل، بثلاث حلقات فأقل).
//   3) العمل الصغير ينضم إلى السلسلة التي تربطه علاقاته بها؛ فإن ربطته بسلسلتين لا يجمعهما اسم مشترك فهو عمل مشترك بينهما: ينضم إلى التي يبدأ اسمه باسمها ولا يدمجهما.
// لكل سلسلة ترتيبان: ids بترتيب الصدور، وstory بترتيب القصة (يُعاد فقط إن خالف ترتيب الصدور)، وهو ترتيب يحترم كل علاقة:
// السابق قبل اللاحق، والقصة الأم قبل الجانبية والمتفرعة والملخص، وبين ما لا علاقة تقدّمه الأقدم صدوراً.
const HARD = new Set(['Sequel', 'Prequel']), BEFORE = { Sequel: 1, 'Side Story': 1, 'Spin-Off': 1, Summary: 1 }, AFTER = { Prequel: 1, 'Parent Story': 1, 'Full Story': 1 };
const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const lcp = (a, b) => { a = norm(a); b = norm(b); let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
export function worldsOf(items) {
  const by = new Map(items.map(x => [x.id, x])), parent = new Map(items.map(x => [x.id, x.id])), when = x => x.from || '9999';
  const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(Math.max(a, b), Math.min(a, b)); };
  const small = x => x.type !== 'TV' && (x.eps || 1) <= 3, soft = new Map(items.map(x => [x.id, new Set()]));
  for (const x of items) for (const r of x.rel || []) { if (!LINKS.has(r.r) || !by.has(r.id) || r.id === x.id) continue; if (HARD.has(r.r)) union(x.id, r.id); else { soft.get(x.id).add(r.id); soft.get(r.id).add(x.id); } }
  for (const x of items) if (!small(x)) for (const y of soft.get(x.id)) if (!small(by.get(y))) union(x.id, y);
  const members = root => items.filter(x => find(x.id) === root), headOf = g => g.slice().sort((a, b) => when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : a.id - b.id).find(x => x.type === 'TV') || g[0];
  for (const x of items.filter(small).sort((a, b) => a.id - b.id)) { const roots = [...new Set([...soft.get(x.id)].map(find))].filter(r => r !== find(x.id)); if (!roots.length) continue;
    const heads = roots.map(r => headOf(members(r)).title), kin = heads.every(h => lcp(h, heads[0]) >= 6);
    if (roots.length === 1 || kin) { for (const r of roots) union(x.id, r); continue; }
    const best = roots.map((r, i) => [lcp(x.title, heads[i]), -i, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1])[0]; union(x.id, best[2]); }
  const groups = new Map(); for (const x of items) { const k = find(x.id); (groups.get(k) || groups.set(k, []).get(k)).push(x); }
  const byDate = (a, b) => when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : a.id - b.id, out = [];
  for (const g of groups.values()) { if (g.length < 2 || !g.some(x => x.mine)) continue; g.sort(byDate);
    const head = g.find(x => x.type === 'TV') || g[0], ids = g.map(x => x.id), story = storyOrder(g), stem = stemOf(g, head);
    const named = stem || head;   // العمل الذي تحمل السلسلة اسمه: منه نبذتها في نافذتها
    out.push({ id: Math.min(...ids), name: worldName(named.title), en: named.en ? worldName(named.en) : null, head: named.id, ids, ...(story.join() !== ids.join() ? { story } : {}) }); }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })); }
// ترتيب القصة داخل سلسلة (g مرتبة بالصدور): كل عمل يأتي بعد كل ما تقول العلاقات إنه قبله، ومن بين المتاح يُقدَّم الأقدم صدوراً.
// صفحات MyAnimeList تتناقض أحياناً (العمل «متفرع» من الثاني والثاني «متفرع» منه): بين عملين يغلب «السابق/اللاحق» على غيره، وعند التساوي يغلب ترتيب الصدور.
// وما بقي من دوران أطول يُكسر عند أقدم أعماله صدوراً.
function storyOrder(g) { const ids = new Set(g.map(x => x.id)), at = new Map(g.map((x, i) => [x.id, i])), edge = new Map(), pre = new Map(g.map(x => [x.id, new Set()]));
  const say = (a, b, w) => { const k = a + '>' + b; if ((edge.get(k) || 0) < w) edge.set(k, w); };
  for (const x of g) for (const r of x.rel || []) { if (!ids.has(r.id) || r.id === x.id) continue; const w = HARD.has(r.r) ? 2 : 1; if (BEFORE[r.r]) say(x.id, r.id, w); else if (AFTER[r.r]) say(r.id, x.id, w); }
  for (const [k, w] of edge) { const [a, b] = k.split('>').map(Number), back = edge.get(b + '>' + a) || 0; if (back > w || (back === w && at.get(b) < at.get(a))) continue; pre.get(b).add(a); }
  const left = g.slice(), done = new Set(), out = [];
  while (left.length) { let i = left.findIndex(x => [...pre.get(x.id)].every(p => done.has(p))); if (i < 0) i = 0; const [x] = left.splice(i, 1); done.add(x.id); out.push(x.id); }
  return out; }
// اسم السلسلة من اسم أقدم أعمالها بلا لاحقة الموسم أو النوع: «Gintama (TV)» ← Gintama، «Kingdom Season 1» ← Kingdom، «Major S1» ← Major
export const worldName = t => String(t || '').replace(/\s*\((?:TV|\d{4})\)\s*$/i, '').replace(/\s*(?::|-)?\s*(?:Season\s*\d+|\d+(?:st|nd|rd|th)\s+Season|Part\s*\d+|First Season|S\d+)\s*$/i, '').trim() || String(t || '');
// اسم رأس السلسلة (أقدم مسلسلاتها) لا يصلح دائماً اسماً لها. يُؤخذ بدله أقصر اسم من أسماء أعمالها يبدأ به نصفها على الأقل (عند حد كلمة) في حالتين:
//   • الرأس نفسه يبدأ به: سلسلة بدأت بـOVA أو فيلم («Ginga Eiyuu Densetsu: Die Neue These - Kaikou» ← Ginga Eiyuu Densetsu).
//   • أو قلّ ما يبدأ باسم الرأس عن ثلث السلسلة: عالم غلب عليه اسم آخر (ChäoS;HEAd ← Steins;Gate). وإلا يبقى الرأس (Toaru Majutsu no Index لا Railgun).
function stemOf(g, head) { const names = g.map(x => [x, norm(worldName(x.title))]).filter(n => n[1].length >= 3), need = Math.max(2, Math.ceil(g.length / 2));
  const starts = (long, short) => long === short || long.startsWith(short + ' '), share = n => names.filter(([, m]) => starts(m, n)).length, h = norm(worldName(head.title));
  const stem = names.filter(([, n]) => share(n) >= need).sort((a, b) => a[1].length - b[1].length)[0]; if (!stem) return null;
  return starts(h, stem[1]) || share(h) < g.length / 3 ? stem[0] : null; }

// ---------- الحلقات: من مواسم المسلسل في TMDB إلى حلقات كل عمل
// حلقة TMDB ← ما نحفظه. الاسم الآلي («Episode 5»، «第5話») ليس عنواناً، والتقييم يُحفظ حين يكفي عدد أصواته
const autoName = n => /^(?:episode|episodio|épisode|folge|capítulo)\s*#?\d+$/i.test(n) || /^第?\s*\d+\s*話$/.test(n) || /^\d+$/.test(n);
export const shapeEpisode = e => { const name = (e.name || '').trim();
  return { se: e.season_number, ep: e.episode_number, t: name && !autoName(name) ? name : null, d: day(e.air_date), r: e.runtime || null, ov: (e.overview || '').replace(/\s+/g, ' ').trim() || null,
    st: e.still_path || null, ra: e.vote_count >= 5 && e.vote_average ? Math.round(e.vote_average * 10) / 10 : null }; };
const gap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5), exact = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null;
// أين تقع حلقات العمل في حلقات المسلسل على TMDB. flat: حلقات الموسم (أو المواسم العادية كلها) بترتيبها، start: الموضع الذي تقوله الخريطة
// (بداية الموسم + الإزاحة)، eps: عدد حلقات العمل في MyAnimeList (0: لم يُعلن)، from وto: تاريخا بدايته ونهايته هناك. التاريخ هو الحكم:
//   'map'  موضع الخريطة وافقه تاريخ البداية أو تاريخ النهاية (±3 أيام)
//   'date' الخريطة خالفها التاريخ (أو لا موضع لها)، ووُجدت حلقة عُرضت يوم بدأ العمل
//   'map?' لا تاريخ يُحتكم إليه، أو الفرق أيام قليلة (عرض مسبق أو تأجيل): يبقى موضع الخريطة بعلامته
//   null   الخريطة خارج الحلقات، أو بعيدة عن تاريخ العمل أكثر من 45 يوماً ولا بديل: لا حلقات خير من حلقات عمل آخر
export function placeEpisodes(flat, { start = 0, eps = 0, from, to }) { const N = flat.length; if (!N) return null;
  const f = exact(from), t = exact(to), near = (i, d) => i >= 0 && i < N && !!flat[i].d && !!d && Math.abs(gap(flat[i].d, d)) <= 3, inside = start >= 0 && start < N;
  if (inside && (near(start, f) || (eps > 1 && near(start + eps - 1, t)))) return { at: start, how: 'map' };
  if (f) { const c = []; for (let i = 0; i < N; i++) if (near(i, f)) c.push(i);
    if (c.length) return { at: c.sort((a, b) => Math.abs(gap(flat[a].d, f)) - Math.abs(gap(flat[b].d, f)) || a - b)[0], how: 'date' }; }
  if (!inside || (f && flat[start].d && Math.abs(gap(flat[start].d, f)) > 45)) return null;
  return { at: start, how: 'map?' }; }
// بصمة النص الإنجليزي للحلقة (عنوانها وملخصها): تُحفظ مع ترجمتها، فإن تغيّر النص أو تبدّل موضع الحلقة عُرف ولم تُلصق ترجمة بغير حلقتها
export const epPrint = (hash, e) => hash(`${e.t || ''}\n${e.ov || ''}`).slice(0, 10);
export const epKey = e => `${e.se}x${e.ep}`;
