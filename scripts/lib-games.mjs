// تشكيل بيانات «ألعابي» من IGDB وWikidata، مشترك بين البناء الليلي (build-games.mjs) ودالة «أضف لعبة» (netlify/functions/add-game.mjs):
// معلومات كل لعبة، وغلافها وصورها بأعلى دقة، ومنصاتها، وكم تأخذ لتختمها، وسلسلتها كاملة بترتيب الصدور (ومعها ما أُعلن ولم يصدر،
// بدقة موعده: يوم أو شهر أو ربع أو سنة، فلا يُعدّ تنازلياً إلا لموعد مؤكد باليوم)، وترتيب القصة الموصى به حيث ثبت له مصدر رسمي،
// وعالمها القصصي، وما اقتُبست منه وما اقتُبس منها (بأرقام TMDB للوصل ببوابة الأفلام).
import { igdb, IMG, ymd, year } from './lib-igdb.mjs';
export { IMG };

export const EROTIC = 42;   // سمة المحتوى الإباحي في IGDB: لا يُعرض شيء منها
// ---------- الترجمة إلى العربية: الأنواع والسمات وأنماط اللعب والمنظور
const AR = {
  'point-and-click': 'نقر وإشارة', fighting: 'قتال', shooter: 'تصويب', music: 'موسيقى', platform: 'منصات وقفز', puzzle: 'ألغاز', racing: 'سباق',
  'real time strategy (rts)': 'استراتيجية لحظية', 'role-playing (rpg)': 'تقمّص أدوار', simulator: 'محاكاة', sport: 'رياضة', strategy: 'استراتيجية',
  'turn-based strategy (tbs)': 'استراتيجية بالأدوار', tactical: 'تكتيكية', "hack and slash/beat 'em up": 'قتال وتقطيع', 'quiz/trivia': 'أسئلة', pinball: 'بنبول',
  adventure: 'مغامرة', indie: 'مستقلة', arcade: 'أركيد', 'visual novel': 'رواية مرئية', 'card & board game': 'بطاقات وألواح', moba: 'موبا',
  action: 'أكشن', fantasy: 'فانتازيا', 'science fiction': 'خيال علمي', horror: 'رعب', thriller: 'إثارة', survival: 'نجاة', historical: 'تاريخية', stealth: 'تخفٍّ',
  comedy: 'كوميديا', business: 'أعمال', drama: 'دراما', 'non-fiction': 'واقعية', sandbox: 'ساحة حرة', educational: 'تعليمية', kids: 'للأطفال', 'open world': 'عالم مفتوح',
  warfare: 'حروب', party: 'جماعية', '4x (explore, expand, exploit, and exterminate)': 'استراتيجية 4X', mystery: 'غموض', romance: 'رومانسية',
  'single player': 'لاعب واحد', multiplayer: 'لعب جماعي', 'co-operative': 'تعاوني', 'split screen': 'شاشة مقسومة', 'massively multiplayer online (mmo)': 'جماعي ضخم', 'battle royale': 'باتل رويال',
  'first person': 'منظور الشخص الأول', 'third person': 'منظور الشخص الثالث', 'bird view / isometric': 'منظور علوي', 'side view': 'منظور جانبي', text: 'نصية', auditory: 'صوتية', 'virtual reality': 'واقع افتراضي',
};
const ar = n => AR[String(n || '').toLowerCase()] || n;
// نوع الإصدار وحالته: يُقرآن بأسمائهما من IGDB (أرقامهما مراجع قد تتغير)
const TYPE = { 'main game': 'main', 'dlc': 'dlc', 'dlc/addon': 'dlc', 'dlc addon': 'dlc', expansion: 'expansion', bundle: 'bundle', 'standalone expansion': 'standalone', mod: 'mod', episode: 'episode', season: 'season',
  remake: 'remake', remaster: 'remaster', 'expanded game': 'expanded', port: 'port', fork: 'fork', pack: 'pack', update: 'update' };
const STATUS = { released: 'released', alpha: 'early', beta: 'early', 'early access': 'early', offline: 'offline', cancelled: 'cancelled', rumored: 'rumored', delisted: 'delisted' };
let META = null;
// تُحفظ في الذاكرة مرة، إلا إن فشل جلبها (مفاتيح خاطئة أو انقطاع) فتُطلب ثانية في المرة القادمة، فلا يعلق فشل عابر في دالة دافئة
export const meta = () => META ??= Promise.all([igdb('game_types', 'fields type; limit 50;'), igdb('game_statuses', 'fields status; limit 50;').catch(() => [])])
  .then(([t, s]) => { if (!s.length) META = null; return { type: new Map(t.map(x => [x.id, TYPE[String(x.type).toLowerCase()] || 'main'])), status: new Map(s.map(x => [x.id, STATUS[String(x.status).toLowerCase()] || 'released'])) }; })
  .catch(e => { META = null; throw e; });
// الأنواع التي تُعد «لعبة» في القوائم والاقتراحات (لا الإضافات والحزم والتعديلات)
export const GAMEY = new Set(['main', 'remake', 'remaster', 'expanded', 'standalone', 'port']);
export const gameyIds = m => [...m.type].filter(([, v]) => GAMEY.has(v)).map(([k]) => k);

// ---------- المنصات: رمز ثابت لكل منصة (ما يُحفظ في سجلك: ختمتها على ps5) وعائلتها (للتصفية والألوان)
export const famOf = n => /playstation|psp|vita/i.test(n) ? 'ps' : /xbox/i.test(n) ? 'xbox' : /nintendo|wii|game ?boy|switch|famicom|gamecube|super nes|\bnes\b|virtual boy/i.test(n) ? 'nin'
  : /android|\bios\b|iphone|ipad/i.test(n) ? 'mobile' : /windows|^pc\b|linux|\bmac|dos\b|steam/i.test(n) ? 'pc' : 'other';
const CODES = [[/playstation vr/i, 'psvr'], [/playstation 5|\bps5\b/i, 'ps5'], [/playstation 4|\bps4\b/i, 'ps4'], [/playstation 3|\bps3\b/i, 'ps3'], [/playstation 2|\bps2\b/i, 'ps2'], [/playstation vita/i, 'vita'],
  [/playstation portable|\bpsp\b/i, 'psp'], [/^playstation\b/i, 'ps1'], [/series x/i, 'xsx'], [/xbox one/i, 'xone'], [/xbox 360/i, 'x360'], [/^xbox\b/i, 'xbox'], [/switch 2/i, 'switch2'], [/switch/i, 'switch'],
  [/wii u/i, 'wiiu'], [/\bwii\b/i, 'wii'], [/3ds/i, '3ds'], [/nintendo ds\b/i, 'nds'], [/gamecube/i, 'gcn'], [/nintendo 64/i, 'n64'], [/super nintendo/i, 'snes'], [/^nintendo entertainment/i, 'nes'],
  [/game boy advance/i, 'gba'], [/game boy color/i, 'gbc'], [/game boy/i, 'gb'], [/windows|^pc\b/i, 'pc'], [/^mac/i, 'mac'], [/linux/i, 'linux'], [/android/i, 'android'], [/\bios\b/i, 'ios']];
export function codeOf(p) { const n = `${p.name || ''}`, hit = CODES.find(([re]) => re.test(n));
  return hit ? hit[1] : (String(p.abbreviation || p.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'p' + p.id).padEnd(2, '0'); }
export const ABBR = { ps5: 'PS5', ps4: 'PS4', ps3: 'PS3', ps2: 'PS2', ps1: 'PS1', psp: 'PSP', vita: 'Vita', psvr: 'PS VR', xsx: 'Xbox Series', xone: 'Xbox One', x360: 'Xbox 360', xbox: 'Xbox',
  switch2: 'Switch 2', switch: 'Switch', wiiu: 'Wii U', wii: 'Wii', '3ds': '3DS', nds: 'DS', gcn: 'GameCube', n64: 'N64', snes: 'SNES', nes: 'NES', gba: 'GBA', gbc: 'GBC', gb: 'Game Boy',
  pc: 'PC', mac: 'Mac', linux: 'Linux', android: 'Android', ios: 'iOS' };
// أهم المنصات أولاً في العرض: الأحدث من كل عائلة
const RANK = ['ps5', 'xsx', 'switch2', 'pc', 'switch', 'ps4', 'xone', 'ios', 'android', 'mac', 'linux', 'ps3', 'x360', 'wiiu', '3ds', 'vita', 'ps2', 'xbox', 'wii', 'nds', 'gcn', 'psp', 'ps1', 'n64', 'snes', 'nes', 'gba', 'gbc', 'gb'];
const byRank = (a, b) => (RANK.indexOf(a) + 1 || 99) - (RANK.indexOf(b) + 1 || 99);

// ---------- المواعيد: دقة الموعد من نصه في IGDB («Feb 25, 2022» يوم، «Feb 2022» شهر، «Q3 2026» ربع، «2026» سنة، «TBD» لم يُحدد)
export const precOf = h => { h = String(h || '').trim(); return !h ? null : /^tb[ad]$/i.test(h) ? 'tbd' : /^q[1-4]\s+\d{4}$/i.test(h) ? 'q' : /^\d{4}$/.test(h) ? 'y' : /^[a-z]{3,}\.?\s+\d{4}$/i.test(h) ? 'm' : 'd'; };
function when(g) { const rd = g.release_dates || [], fr = g.first_release_date;
  const own = fr ? rd.find(d => d.date === fr) : null, tbd = rd.find(d => precOf(d.human) === 'tbd');
  if (fr) { const prec = own ? precOf(own.human) || 'd' : 'd'; return { date: ymd(fr), prec, human: prec === 'd' ? null : own.human }; }
  return { date: null, prec: tbd || rd.length ? 'tbd' : null, human: tbd ? tbd.human : null }; }
// المرحلة: صدرت، قادمة (بموعد)، معلنة بلا موعد، ملغاة، إشاعة، أو مجهولة (لعبة قديمة بلا تاريخ في IGDB)
function stage(g, m, w) { const st = m.status.get(g.game_status);
  if (st === 'cancelled' || st === 'rumored') return st;
  if (w.date && Date.parse(w.date) > Date.now()) return 'upcoming';
  if (!w.date) return w.prec === 'tbd' || g.hypes ? 'tba' : st === 'released' ? 'released' : 'unknown';
  return 'released'; }

// ---------- الحقول
export const FULL = ['name', 'slug', 'summary', 'storyline', 'first_release_date', 'game_type', 'game_status', 'cover.image_id', 'artworks.image_id', 'artworks.width', 'screenshots.image_id',
  'platforms', 'genres.name', 'themes.name', 'game_modes.name', 'player_perspectives.name', 'involved_companies.company.name', 'involved_companies.developer', 'involved_companies.publisher',
  'collections', 'franchises', 'franchise', 'parent_game', 'version_parent', 'dlcs', 'expansions', 'standalone_expansions', 'remakes', 'remasters', 'ports',
  'aggregated_rating', 'aggregated_rating_count', 'rating', 'rating_count', 'hypes', 'release_dates.date', 'release_dates.platform', 'release_dates.human',
  'external_games.uid', 'external_games.external_game_source', 'alternative_names.name', 'videos.video_id', 'videos.name', 'websites.url', 'url'].join(',');
export const LIGHT = 'name,slug,first_release_date,game_type,game_status,cover.image_id,platforms,hypes,themes,parent_game,release_dates.date,release_dates.human';
const erotic = g => (g.themes || []).some(t => (t?.id ?? t) === EROTIC);
// كل نتائج استعلام طويل القائمة على حقل (id أو game_id) بأجزاء، بالتوازي في حدود الطابور
export async function igdbIn(endpoint, fields, ids, field = 'id', extra = '') {
  const list = [...new Set(ids)].filter(Boolean), parts = []; for (let i = 0; i < list.length; i += 400) parts.push(list.slice(i, i + 400));
  return (await Promise.all(parts.map(p => igdb(endpoint, `fields ${fields}; where ${field} = (${p.join(',')})${extra}; limit 500;`)))).flat(); }

// ---------- Wikidata: الاسم العربي، والعالم القصصي، والمقتبَس منه والمقتبَس عنه (بأرقام TMDB للأفلام والمسلسلات)
const KIND = { Q11424: 'film', Q202866: 'film', Q29168811: 'film', Q24856: 'films', Q5398426: 'tv', Q581714: 'tv', Q15416: 'tv', Q1259759: 'tv', Q63952888: 'anime', Q1107: 'anime', Q20650540: 'anime',
  Q8261: 'novel', Q7725634: 'book', Q47461344: 'book', Q571: 'book', Q277759: 'books', Q1667921: 'novels', Q14406742: 'comic', Q1004: 'comic', Q1760610: 'comic', Q8274: 'manga', Q21198342: 'manga',
  Q7889: 'game', Q7058673: 'games', Q131436: 'board', Q1643932: 'tabletop' };
async function sparql(q, timeout) {
  const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', signal: AbortSignal.timeout(timeout),
    headers: { 'User-Agent': 'dc-guide games (github.com/fa9o0oll/-dc-guide)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('wikidata ' + r.status); return (await r.json()).results.bindings; }
const qid = u => String(u || '').split('/').pop();
export async function wikidataFor(slugs, { timeout = 60000 } = {}) {
  const out = new Map(), list = [...new Set(slugs)].filter(Boolean);
  for (let i = 0; i < list.length; i += 150) {
    const vals = list.slice(i, i + 150).map(s => JSON.stringify(s)).join(' ');
    for (const b of await sparql(`SELECT ?g ?slug ?ar ?u ?uEn ?uAr WHERE { VALUES ?slug { ${vals} } ?g wdt:P5794 ?slug .
      OPTIONAL { ?g rdfs:label ?ar FILTER(lang(?ar)="ar") } OPTIONAL { ?g wdt:P1434 ?u . OPTIONAL { ?u rdfs:label ?uEn FILTER(lang(?uEn)="en") } OPTIONAL { ?u rdfs:label ?uAr FILTER(lang(?uAr)="ar") } } }`, timeout)) {
      const o = out.get(b.slug.value) || { q: qid(b.g.value), from: [], into: [] }; out.set(b.slug.value, o);
      if (b.ar) o.ar = b.ar.value; if (b.u) o.universe = { q: qid(b.u.value), en: b.uEn?.value || '', ar: b.uAr?.value || '' };
    }
  }
  const byQ = new Map([...out.values()].map(o => [o.q, o])), qs = [...byQ.keys()].map(q => 'wd:' + q);
  for (let i = 0; i < qs.length; i += 120) {
    for (const b of await sparql(`SELECT ?g ?rel ?w ?en ?arl ?type ?tm ?tt ?y WHERE { VALUES ?g { ${qs.slice(i, i + 120).join(' ')} }
      { ?g wdt:P144 ?w . BIND("from" AS ?rel) } UNION { ?w wdt:P144 ?g . BIND("into" AS ?rel) } UNION { ?g wdt:P4969 ?w . BIND("into" AS ?rel) }
      OPTIONAL { ?w rdfs:label ?en FILTER(lang(?en)="en") } OPTIONAL { ?w rdfs:label ?arl FILTER(lang(?arl)="ar") } OPTIONAL { ?w wdt:P31 ?type }
      OPTIONAL { ?w wdt:P4947 ?tm } OPTIONAL { ?w wdt:P4983 ?tt } OPTIONAL { ?w wdt:P577 ?d } BIND(YEAR(?d) AS ?y) }`, timeout)) {
      const g = byQ.get(qid(b.g.value)); if (!g) continue;
      const q = qid(b.w.value), list = g[b.rel.value]; let w = list.find(x => x.q === q);
      if (!w) list.push(w = { q, en: b.en?.value || '', ar: b.arl?.value || '', kind: '', year: null });
      const k = b.type && KIND[qid(b.type.value)]; if (k && !w.kind) w.kind = k;
      if (b.tm) w.tmdb = 'm' + b.tm.value; else if (b.tt && !w.tmdb) w.tmdb = 't' + b.tt.value;
      if (b.y && (!w.year || +b.y.value < w.year)) w.year = +b.y.value;
    }
  }
  // عمل بلا اسم إنجليزي ولا عربي لا يُعرض (رقم Wikidata وحده لا يفيد)
  for (const o of out.values()) for (const k of ['from', 'into']) o[k] = o[k].filter(w => w.en || w.ar).sort((a, b) => (a.year || 9999) - (b.year || 9999));
  return out;
}

// ---------- ترتيب القصة الموصى به (data/games/story-orders.json): يُطابق بأسماء الأجزاء بعد توحيدها، وما لا يطابق جزءاً من السلسلة يُذكر في السجل
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[™®©:'’.,!?\-–—()]/g, ' ').replace(/\s+/g, ' ').trim();
export function storyFor(members, orders, log = () => {}) {
  for (const so of orders) {
    const ids = so.order.map(t => members.find(m => [m.title, m.slug].some(x => norm(x) === norm(t)))?.id);
    if (ids.filter(Boolean).length < 2) continue;
    const miss = so.order.filter((t, i) => !ids[i]); if (miss.length) log(`story order «${so.name}»: not in series: ${miss.join(' | ')}`);
    return { order: ids.filter(Boolean), note: so.note || '', src: so.src || [] };
  }
  return null;
}

// ---------- الشكل النهائي
const hours = s => s ? Math.round(s / 360) / 10 : null;
const STEAM = 1, GOG = 5, MS = 11, EPIC = 26, XBOX = 31, PSN = 36;
const SITE = [[/store\.steampowered\.com/, 'steam'], [/store\.playstation\.com|playstation\.com\/.*games/, 'psstore'], [/xbox\.com|microsoft\.com\/.*store/, 'xstore'], [/nintendo\.(com|co\.\w+)|nintendo\.\w+\/.*(store|games)/, 'eshop'],
  [/epicgames\.com/, 'epic'], [/gog\.com/, 'gog'], [/apps\.apple\.com/, 'appstore'], [/play\.google\.com/, 'gplay'], [/wikipedia\.org/, 'wiki'], [/twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|twitch\.tv|discord\.(gg|com)|reddit\.com|tiktok\.com|fandom\.com/, '']];
const siteOf = u => { const hit = SITE.find(([re]) => re.test(u)); return hit ? hit[1] : 'official'; };

// يجلب الألعاب المطلوبة ويشكّلها. opt.wikidata: يُثرى من Wikidata (البناء الليلي، وبمهلة قصيرة في الدالة)، opt.story: ترتيبات القصة، opt.log: سجل
export async function gamesFor(ids, opt = {}) {
  const log = opt.log || (() => {}), m = await meta(), now = Date.now();
  const raw = (await igdbIn('games', FULL, ids)).filter(g => !erotic(g));
  // الألعاب المرتبطة وأجزاء السلاسل (بمعلومات خفيفة)، والمنصات، وأوقات الختم
  const rel = new Set(); for (const g of raw) { for (const k of ['parent_game', 'version_parent']) if (g[k]) rel.add(g[k]); for (const k of ['dlcs', 'expansions', 'standalone_expansions', 'remakes', 'remasters', 'ports']) for (const x of g[k] || []) rel.add(x); }
  const [cols, frs, ttbs] = await Promise.all([igdbIn('collections', 'name,slug,games', raw.flatMap(g => g.collections || [])),
    igdbIn('franchises', 'name,slug,games', raw.flatMap(g => [...(g.franchises || []), g.franchise].filter(Boolean))), igdbIn('game_time_to_beats', 'game_id,hastily,normally,completely,count', raw.map(g => g.id), 'game_id').catch(() => [])]);
  // السلاسل الضخمة (مئات الألعاب، كماريو) تُختصر إلى ما يناسب ترتيباً يُقرأ: أقرب ٦٠ جزءاً من الألعاب نفسها
  const light = new Map((await igdbIn('games', LIGHT, [...cols.flatMap(c => (c.games || []).slice(0, 400)), ...rel])).filter(g => !erotic(g)).map(g => [g.id, g]));
  const plats = {}, code = new Map();
  for (const p of await igdbIn('platforms', 'name,abbreviation,slug', [...raw, ...light.values()].flatMap(g => g.platforms || []))) { const c = codeOf(p); code.set(p.id, c); plats[c] ||= { name: p.name, abbr: ABBR[c] || p.abbreviation || p.name, fam: famOf(p.name) }; }
  const codes = list => [...new Set((list || []).map(id => code.get(id)).filter(Boolean))].sort(byRank);
  const lightOf = g => { const w = when(g); return { id: g.id, slug: g.slug, title: g.name, ...w, year: year(g.first_release_date), cover: g.cover?.image_id || null, type: m.type.get(g.game_type) || 'main', status: stage(g, m, w), plats: codes(g.platforms), hype: g.hypes || 0 }; };
  // السلسلة: كل أجزائها الرئيسية (لا الإضافات) بترتيب الصدور، وما لا موعد له آخراً، وترتيب القصة إن وُجد له مصدر
  const series = {};
  for (const c of cols) {
    const members = (c.games || []).map(id => light.get(id)).filter(g => g && GAMEY.has(m.type.get(g.game_type) || 'main') && m.type.get(g.game_type) !== 'port').map(lightOf)
      .filter(x => x.status !== 'rumored').sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : a.title.localeCompare(b.title));
    if (members.length < 2) continue;
    series[c.id] = { name: c.name, slug: c.slug, members, size: (c.games || []).length };
    const st = storyFor(members, opt.story || [], log); if (st) series[c.id].story = st;
  }
  let wd = new Map(); if (opt.wikidata) { try { wd = await wikidataFor(raw.map(g => g.slug), { timeout: opt.wdTimeout || 60000 }); log(`wikidata matched ${wd.size} of ${raw.length}`); } catch (e) { log('wikidata skipped: ' + e.message); } }
  const ttbOf = new Map(ttbs.map(t => [t.game_id, { h: hours(t.hastily), n: hours(t.normally), c: hours(t.completely), count: t.count || 0 }]));
  const games = raw.map(g => {
    const w = when(g), x = wd.get(g.slug) || {}, art = (g.artworks || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.image_id || g.screenshots?.[0]?.image_id || null;
    const ext = {}; for (const e of g.external_games || []) { const s = e.external_game_source; if (!e.uid) continue; if (s === STEAM) ext.steam ||= e.uid; else if (s === GOG) ext.gog ||= e.uid; else if (s === PSN) ext.psn ||= e.uid; else if (s === MS || s === XBOX) ext.xbox ||= e.uid; else if (s === EPIC) ext.epic ||= e.uid; }
    const r = {}; for (const k of ['dlcs', 'expansions', 'standalone_expansions', 'remakes', 'remasters', 'ports']) { const list = (g[k] || []).map(id => light.get(id)).filter(Boolean).map(lightOf); if (list.length) r[k] = list.sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : 1); }
    for (const k of ['parent_game', 'version_parent']) if (g[k] && light.get(g[k])) r[k] = lightOf(light.get(g[k]));
    const sites = []; for (const s of g.websites || []) { const t = siteOf(s.url || ''); if (t && !sites.some(o => o.t === t)) sites.push({ t, url: s.url }); }
    return {
      id: g.id, slug: g.slug, title: g.name, titleAr: x.ar && x.ar !== g.name ? x.ar : '', alt: [...new Set((g.alternative_names || []).map(a => a.name))].filter(n => n && n !== g.name).slice(0, 6),
      type: m.type.get(g.game_type) || 'main', status: stage(g, m, w), early: m.status.get(g.game_status) === 'early' || undefined, ...w, year: year(g.first_release_date),
      cover: g.cover?.image_id || null, art, shots: (g.screenshots || []).slice(0, 8).map(s => s.image_id),
      plats: codes(g.platforms), dates: (g.release_dates || []).filter(d => d.platform && code.get(d.platform)).map(d => ({ p: code.get(d.platform), date: ymd(d.date), human: d.human || '' }))
        .sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : 1).filter((d, i, all) => all.findIndex(o => o.p === d.p) === i),
      genres: (g.genres || []).map(x => ar(x.name)), themes: (g.themes || []).map(x => ar(x.name)).filter(Boolean), modes: (g.game_modes || []).map(x => ar(x.name)), persp: (g.player_perspectives || []).map(x => ar(x.name)),
      dev: [...new Set((g.involved_companies || []).filter(c => c.developer).map(c => c.company?.name).filter(Boolean))], pub: [...new Set((g.involved_companies || []).filter(c => c.publisher).map(c => c.company?.name).filter(Boolean))],
      summary: g.summary || '', story: g.storyline || '',
      critic: g.aggregated_rating ? Math.round(g.aggregated_rating) : null, criticN: g.aggregated_rating_count || 0, users: g.rating ? Math.round(g.rating) : null, usersN: g.rating_count || 0, hype: g.hypes || 0,
      ttb: ttbOf.get(g.id) || null, series: (g.collections || []).filter(c => series[c]), franchises: [...new Set([...(g.franchises || []), g.franchise].filter(Boolean))],
      rel: r, ext, sites, igdb: g.url || '', wd: x.q || '', universe: x.universe || null, from: x.from || [], into: x.into || [],
      videos: (g.videos || []).slice(0, 3).map(v => ({ id: v.video_id, name: v.name || '' })),
    };
  });
  const franchises = Object.fromEntries(frs.map(f => [f.id, { name: f.name, size: (f.games || []).length }]));
  log(`igdb ${raw.length}/${[...new Set(ids)].length} games, ${Object.keys(series).length} series, ${light.size} related, ${Date.now() - now}ms`);
  return { games, series, plats, franchises };
}
