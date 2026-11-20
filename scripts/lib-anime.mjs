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

// السلاسل: مكوّنات مترابطة بعلاقات القصة بين أعمال الكتالوج. للسلسلة اسم أقدم مسلسلاتها (أو أقدم أعمالها)، ورقمها أصغر أرقام أعمالها.
// items: [{ id, rel: [{r, id}], from, type, title, en, mine }]. تُعاد السلاسل التي فيها عملان فأكثر وفيها عمل من القائمة، وأعمالها بترتيب الصدور
export function worldsOf(items) {
  const by = new Map(items.map(x => [x.id, x])), parent = new Map(items.map(x => [x.id, x.id]));
  const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  for (const x of items) for (const r of x.rel || []) if (LINKS.has(r.r) && by.has(r.id)) { const a = find(x.id), b = find(r.id); if (a !== b) parent.set(Math.max(a, b), Math.min(a, b)); }
  const groups = new Map(); for (const x of items) { const k = find(x.id); (groups.get(k) || groups.set(k, []).get(k)).push(x); }
  const when = x => x.from || '9999', out = [];
  for (const g of groups.values()) { if (g.length < 2 || !g.some(x => x.mine)) continue;
    g.sort((a, b) => when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : a.id - b.id);
    const head = g.find(x => x.type === 'TV') || g[0];
    out.push({ id: Math.min(...g.map(x => x.id)), name: worldName(head.title), en: head.en ? worldName(head.en) : null, ids: g.map(x => x.id) }); }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })); }
// اسم السلسلة من اسم أقدم أعمالها بلا لاحقة الموسم أو النوع: «Gintama (TV)» ← Gintama، «Kingdom Season 1» ← Kingdom
export const worldName = t => String(t || '').replace(/\s*\((?:TV|\d{4})\)\s*$/i, '').replace(/\s*(?::|-)?\s*(?:Season\s*\d+|\d+(?:st|nd|rd|th)\s+Season|Part\s*\d+|First Season)\s*$/i, '').trim() || String(t || '');
