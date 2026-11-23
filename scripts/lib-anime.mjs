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
// ترتيب قصة مُراجَع لسلسلة (data/anime/orders.json): ما ذكره الملف بترتيبه، وما لم يذكره من أعمالها (دخل السلسلة بعد كتابته) يوضع بعد الذي
// يسبقه في الترتيب المحسوب. يعيد الترتيب، وما لم يُذكر (يُكتب في التقرير ليُضاف إلى الملف)
export function curatedOrder(computed, listed) { const have = new Set(computed), out = listed.filter((id, i) => have.has(id) && listed.indexOf(id) === i), seen = new Set(out), loose = [];
  for (let i = 0; i < computed.length; i++) { const id = computed[i]; if (seen.has(id)) continue; loose.push(id);
    let j = i - 1; while (j >= 0 && !seen.has(computed[j])) j--;
    out.splice(j < 0 ? 0 : out.indexOf(computed[j]) + 1, 0, id); seen.add(id); }
  return { order: out, loose }; }
function storyOrder(g) { const ids = new Set(g.map(x => x.id)), at = new Map(g.map((x, i) => [x.id, i])), edge = new Map(), pre = new Map(g.map(x => [x.id, new Set()]));
  const say = (a, b, w) => { const k = a + '>' + b; if ((edge.get(k) || 0) < w) edge.set(k, w); };
  for (const x of g) for (const r of x.rel || []) { if (!ids.has(r.id) || r.id === x.id) continue; const w = HARD.has(r.r) ? 2 : 1; if (BEFORE[r.r]) say(x.id, r.id, w); else if (AFTER[r.r]) say(r.id, x.id, w); }
  for (const [k, w] of edge) { const [a, b] = k.split('>').map(Number), back = edge.get(b + '>' + a) || 0; if (back > w || (back === w && at.get(b) < at.get(a))) continue; pre.get(b).add(a); }
  const left = g.slice(), done = new Set(), out = [];
  while (left.length) { let i = left.findIndex(x => [...pre.get(x.id)].every(p => done.has(p))); if (i < 0) i = 0; const [x] = left.splice(i, 1); done.add(x.id); out.push(x.id); }
  return out; }
// خطوط القصة في السلسلة، ومنها «موقعه من سلسلته» في كل بطاقة وخطوط البوابة الزمنية. g: أعمال السلسلة بعلاقاتها، order: ترتيب القصة النهائي.
// الخط أعمالٌ تصلها «السابق/اللاحق» ببعضها (قصة متصلة). الخط الرئيسي (m) هو الذي فيه أقدم مسلسلاتها، وكل خط غيره نوعه من صلته بما خارجه:
//   a نسخة أخرى من القصة، t عالم بديل، f عمل متفرع، s قصة جانبية، r ملخص. الأولوية بهذا الترتيب، والصلة بالخط الرئيسي تُقدَّم على غيرها.
// وصلات MyAnimeList متقابلة (صفحة الجانبية تقول «القصة الأم» وصفحة الأم تقول «قصة جانبية»)، فتُقرأ من الطرفين: يكفي أن يذكرها أحدهما.
// ln: الخطوط، كلٌّ [النوع، ...الأعمال بترتيب القصة]، الرئيسي أولاً ثم الخطوط بترتيب أول أعمالها.
// rf: لكل عمل ما يُعرَّف به: [p، الجزء الذي يكمله] لما له سابق في خطه، و[نوع خطه، العمل الذي تفرّع منه] لأول عمل في خط غير رئيسي. وأول الخط الرئيسي بلا مرجع
const KIND_OF = { 'Alternative Version': 'a', 'Alternative Setting': 't', 'Spin-Off': 'f', 'Side Story': 's', Summary: 'r' }, MINE_OF = { 'Parent Story': 's', 'Full Story': 'r' }, KINDS = 'atfsr';
export function linesOf(g, order, { main = [], as = {} } = {}) { const ids = new Set(g.map(x => x.id)), by = new Map(g.map(x => [x.id, x])), at = new Map(order.map((id, i) => [id, i]));
  const root = new Map(g.map(x => [x.id, x.id])), find = a => { while (root.get(a) !== a) { root.set(a, root.get(root.get(a))); a = root.get(a); } return a; }, join = (a, b) => { a = find(a); b = find(b); if (a !== b) root.set(a, b); };
  const says = (x, r, y) => (by.get(x)?.rel || []).some(e => e.r === r && e.id === y);
  // «as» في orders.json: أعمال تُفصل عن خطها إلى خط بنوع ومرجع مُراجَعين (Dragon Ball Kai نسخة أخرى من Dragon Ball Z وإن قالت علاقاته إنه تكملة لـDragon Ball).
  // تبقى صلات «السابق/اللاحق» بينها هي، وتُقطع صلاتها بما سواها
  const cut = new Set(Object.keys(as).map(Number).filter(id => ids.has(id)));
  for (const x of g) for (const e of x.rel || []) if (HARD.has(e.r) && ids.has(e.id) && e.id !== x.id && cut.has(x.id) === cut.has(e.id)) join(x.id, e.id);
  const when = x => x.from || '9999', tv = g.filter(x => x.type === 'TV').sort((a, b) => when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : a.id - b.id)[0] || g.slice().sort((a, b) => (at.get(a.id) ?? 1e9) - (at.get(b.id) ?? 1e9))[0];
  for (const id of main) if (ids.has(id)) join(id, tv.id);   // ما يقول ترتيب مُراجَع إنه من القصة الرئيسية وإن لم تصله «السابق/اللاحق» بها (Dragon Ball Super)
  const mainKey = find(tv.id), groups = new Map(); for (const id of order) if (ids.has(id)) { const k = find(id); (groups.get(k) || groups.set(k, []).get(k)).push(id); }
  // ما يكمله العمل في خطه: أقرب سابق له بترتيب القصة مما يقول أحد الطرفين إنه سابقه. وما لا سابق له هكذا يُعرف موضعه من ترتيب القصة وحده
  const rf = {}; for (const ln of groups.values()) for (const id of ln) { const pre = ln.filter(y => y !== id && (says(id, 'Prequel', y) || says(y, 'Sequel', id)) && at.get(y) < at.get(id)).sort((a, b) => at.get(b) - at.get(a))[0]; if (pre) rf[id] = ['p', pre]; }
  const lex = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  // نوع الخط من أقوى صلة بين أحد أعماله (x) وعمل خارجه (y): صفحة y تقول إن x متفرع منه أو جانبي أو ملخص له، أو صفحة x تقول إن y قصته الأم
  // أو قصته الكاملة، و«النسخة الأخرى» و«العالم البديل» من أي الطرفين
  const kindOf = ln => { const inLn = new Set(ln); let best = null;
    for (const x of ln) for (const y of ids) { if (inLn.has(y)) continue; let k = null; const take = c => { if (!k || KINDS.indexOf(c) < KINDS.indexOf(k)) k = c; };
      for (const [r, c] of Object.entries(KIND_OF)) if (says(y, r, x) || ((c === 'a' || c === 't') && says(x, r, y))) take(c);
      for (const [r, c] of Object.entries(MINE_OF)) if (says(x, r, y)) take(c);
      if (!k) continue; const score = [find(y) === mainKey ? 0 : 1, KINDS.indexOf(k), at.get(y) ?? 1e9, at.get(x) ?? 1e9];
      if (!best || lex(score, best.score) < 0) best = { k, y, score }; }
    return best; };
  // ملخص لأكثر من عمل (ملخص القصة حتى موضع ما): نوعه R، ومرجعه آخر ما يلخّصه بترتيب القصة
  const sums = ln => { const t = new Set(); for (const x of ln) for (const y of ids) if (find(y) !== find(x) && (says(x, 'Full Story', y) || says(y, 'Summary', x))) t.add(y); return [...t].sort((a, b) => at.get(a) - at.get(b)); };
  const out = [['m', ...(groups.get(mainKey) || [])]];
  for (const [key, ln] of groups) { if (key === mainKey) continue; if (cut.has(ln[0])) { const [k, y] = as[ln[0]]; out.push([k, ...ln]); if (ids.has(y)) rf[ln[0]] = [k, y]; continue; }
    let b = kindOf(ln); if (b?.k === 'r') { const t = sums(ln); if (t.length > 1) b = { k: 'R', y: t[t.length - 1] }; }
    out.push([b?.k || 's', ...ln]); if (b && !rf[ln[0]]) rf[ln[0]] = [b.k, b.y]; }
  out.sort((a, b) => a[0] === 'm' ? -1 : b[0] === 'm' ? 1 : at.get(a[1]) - at.get(b[1]));
  return { ln: out, rf }; }
// الخطوط بصيغة الكتالوج المختصرة، بمحاذاة ترتيب القصة: lk أنواع الخطوط (أولها الرئيسي)، li رقم خط كل عمل، ri موضع ما يُعرَّف به في الترتيب نفسه (-1: لا شيء).
// والمرجع في خط العمل نفسه «يكمل أحداثه»، وفي خط آخر صلةٌ من نوع خطه (جانبية منه، متفرع منه، نسخة أخرى منه، ملخص له)
export function packLines(order, { ln, rf }) { const pos = new Map(order.map((id, i) => [id, i])), li = order.map(() => 0);
  ln.forEach((l, k) => l.slice(1).forEach(id => { if (pos.has(id)) li[pos.get(id)] = k; }));
  return { lk: ln.map(l => l[0]).join(''), li, ri: order.map(id => rf[id] ? pos.get(rf[id][1]) ?? -1 : -1) }; }
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
// وكذلك الملخص الآلي: عبارة موقع تقول إن لا ملخص («Be the first one to add a plot»، «No description yet») ليست ملخصاً، فلا تُعرض ولا تُترجم
const noPlot = s => /be the first (?:one )?to add a plot|^no (?:description|overview|plot|summary|synopsis)(?: (?:yet|available))?\.?$|^(?:tba|tbd|n\/a)\.?$|we don't have an overview/i.test(s);
export const shapeEpisode = e => { const name = (e.name || '').trim(), ov = (e.overview || '').replace(/\s+/g, ' ').trim();
  return { se: e.season_number, ep: e.episode_number, t: name && !autoName(name) ? name : null, d: day(e.air_date), r: e.runtime || null, ov: ov && !noPlot(ov) ? ov : null,
    st: e.still_path || null, ra: e.vote_count >= 5 && e.vote_average ? Math.round(e.vote_average * 10) / 10 : null }; };
const gap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5), exact = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null;
// أين تقع حلقات العمل في حلقات المسلسل على TMDB. flat: المواسم العادية كلها بترتيبها قائمةً واحدة، start: الموضع الذي تقوله الخريطة
// (بداية الموسم + الإزاحة؛ -1 حين لا وجود لموسمها)، eps: عدد حلقات العمل في MyAnimeList (0: لم يُعلن)، from وto: تاريخا بدايته ونهايته هناك.
// القواعد بترتيبها، وكل واحدة وُضعت لحالة ظهرت في أول بناء حقيقي:
//   'map'  موضع الخريطة، حين يوافق تاريخُ أوله بدايةَ العمل أو تاريخُ آخره نهايتَه (±3 أيام)؛ أو هو موسم كامل بعدد حلقات العمل تماماً ولا يبعد
//          أوله عن بداية العمل أكثر من 75 يوماً (منصة تسبق التلفزيون: العدد شاهد كافٍ، وأقرب موسمين متتاليين بينهما 12 أسبوعاً)؛ أو المسلسل كله
//          بعدد حلقات العمل ولا يبعد أكثر من 400 يوم (تأريخ عرض أجنبي؛ وما زاد فمسلسل آخر بالاسم نفسه)، ومسلسل طويل (30 حلقة فأكثر) كله
//          بعدد حلقات العمل يُقبل مهما بعد تاريخه: لا يتفق عددٌ كهذا مصادفةً (Bobobo-bo Bo-bobo: 76 حلقة مؤرَّخة بعرضها الأمريكي بعد سنتين)
//   'date' حلقة عُرضت يوم بدأ العمل وتنتهي حلقاته بعدها يوم انتهى: مواسم MyAnimeList التي يدمجها TMDB في موسم واحد، وخريطة تشير إلى غير موسمها
//   'date' ثم موسم يبدأ يوم بدأ العمل وينتهي يوم انتهى وإن خالفه العدد (Full Metal Panic? Fumoffu: 12 حلقة في MyAnimeList و11 في موسمه، والخريطة
//          تبدأ من حلقته الثانية)
//   'map'  ثم موضع الخريطة إن أزيح طرفاه إزاحة واحدة لا تزيد على أسبوعين (تسبق المنصةُ التلفزيونَ بأسبوع في موسم مدموج). وهذه بعد التي قبلها:
//          إزاحة أسبوع هي نفسها خطأ حلقة واحدة في الخريطة، والحلقة التي توافق الطرفين معاً أولى
//   'date' ثم أي حلقة عُرضت يوم بدأ العمل، ويُقدَّم ما تسع حلقاتُ العمل بعده وما قارب آخرُه نهايتَه؛ وما خالف آخرُه النهايةَ يُترك حين تكون الخريطة معقولة
//   'map?' لا تاريخ يُحتكم إليه، أو الفرق أيام: يبقى موضع الخريطة بعلامته
//   null   الخريطة خارج الحلقات، أو بعيدة عن تاريخ العمل أكثر من 45 يوماً ولا بديل: لا حلقات خير من حلقات عمل آخر
export function placeEpisodes(flat, { start = 0, eps = 0, from, to }) { const N = flat.length; if (!N) return null;
  const f = exact(from), t = exact(to), inside = start >= 0 && start < N, dif = (i, d) => i >= 0 && i < N && flat[i].d && d ? gap(flat[i].d, d) : null;
  const A = i => dif(i, f), B = i => eps > 1 ? dif(i + eps - 1, t) : null, within = (x, n) => x != null && Math.abs(x) <= n, a = inside ? A(start) : null, b = inside ? B(start) : null;
  if (inside) { const se = flat[start].se, head = start === 0 || flat[start - 1].se !== se;
    if (within(a, 3) || within(b, 3)) return { at: start, how: 'map' };
    if (eps > 0 && head && !(a != null && Math.abs(a) > 75) && flat.filter(e => e.se === se).length === eps) return { at: start, how: 'map' };
    if (start === 0 && N === eps && (eps >= 30 || !(a != null && Math.abs(a) > 400))) return { at: start, how: 'map' }; }
  const c = []; if (f) for (let i = 0; i < N; i++) if (within(A(i), 3)) c.push(i);
  const near = (x, y) => Math.abs(A(x)) - Math.abs(A(y)) || x - y, both = c.filter(i => within(B(i), 3)).sort(near);
  if (both.length) return { at: both[0], how: 'date' };
  const last = i => { let j = i; while (j + 1 < N && flat[j + 1].se === flat[i].se) j++; return j; }, whole = c.filter(i => (i === 0 || flat[i - 1].se !== flat[i].se) && within(dif(last(i), t), 3)).sort(near);
  if (whole.length) return { at: whole[0], how: 'date' };
  if (a != null && b != null && Math.abs(a - b) <= 3 && Math.abs(a) <= 14) return { at: start, how: 'map' };
  // وحلقة وافقت البداية وخالف آخرُها نهايةَ العمل لا تغلب خريطة معقولة (في حدود 45 يوماً): منصة تنزّل الجزء كله في يوم يوافق مصادفةً عرض حلقة
  // من الجزء الذي قبله في التلفزيون (JoJo no Kimyou na Bouken Part 6: Stone Ocean Part 3 على Netflix)
  const sane = inside && !(a != null && Math.abs(a) > 45), fair = c.filter(i => { const e = B(i); return !sane || e == null || Math.abs(e) <= 7; });
  if (fair.length) { const rank = i => { const e = B(i); return (eps && i + eps > N ? 4 : 0) + (e == null ? 1 : Math.abs(e) <= 7 ? 0 : 2); };
    return { at: fair.sort((x, y) => rank(x) - rank(y) || near(x, y))[0], how: 'date' }; }
  if (!sane) return null;
  return { at: start, how: 'map?' }; }
// عمل لا مكان له في المواسم العادية (OVA من حلقات، أو حلقات ختامية طويلة): حلقاته في «الحلقات الخاصة» (الموسم 0) هي ما عُرض بين بدايته ونهايته
// (±3 أيام)، وتُقبل فقط حين يساوي عددُها عددَ حلقاته تماماً. الموسم 0 يجمع كل شيء بلا ترتيب يُعتمد، فلا شاهد فيه إلا التاريخ والعدد معاً
export function pickSpecials(s0, { eps = 0, from, to }) { const f = exact(from), t = exact(to); if (!f || !t || eps < 2) return null;
  const l = s0.filter(e => e.d && gap(e.d, f) >= -3 && gap(e.d, t) <= 3).sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.ep - y.ep);
  return l.length === eps ? l : null; }
// هل رقم الحلقة في ما بُني هو رقمها في MyAnimeList؟ built: ما أُخذ بعدد حلقات العمل، over: ما بقي بعده في موسمه وعُرض قبل نهاية العمل ولم يأخذه عمل آخر.
//   'loose' المصدر يعدّ الحلقات عدّاً آخر: يزيد في المدة نفسها (أنصاف حلقات فُصلت، ملخص في وسط الموسم، حلقة ساعة عُدّت اثنتين)، أو ينقص كثيراً
//           (حلقات قصيرة جُمعت). تُعرض الحلقات كلها للقراءة بلا تعليم: رقم الخانة لا يقابل رقم الحلقة في سجله
//   'odd'   ينقص بحلقة أو بضع حلقات (حلقة خاصة أو ملخص يعدّه MyAnimeList وليس في مواسم المصدر): تنبيه، والتعليم باقٍ
export const epFit = (eps, built, over = 0) => { if (!eps) return null; const short = Math.max(0, eps - built); return over > 0 || short > Math.max(4, eps * .3) ? 'loose' : short ? 'odd' : null; };
// بصمة النص الإنجليزي للحلقة (عنوانها وملخصها): تُحفظ مع ترجمتها، فإن تغيّر النص أو تبدّل موضع الحلقة عُرف ولم تُلصق ترجمة بغير حلقتها
export const epPrint = (hash, e) => hash(`${e.t || ''}\n${e.ov || ''}`).slice(0, 10);
export const epKey = e => `${e.se}x${e.ep}`;
