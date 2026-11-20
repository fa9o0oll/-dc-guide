// قراءة ملف تصدير MyAnimeList (animelist_….xml أو .xml.gz) بلا فقد. يعمل في المتصفح وفي Node (لا DOMParser).
// صيغة الملف (XML Export 1.1.0): <myinfo> بأرقام الحساب، ثم <anime> لكل عمل بحقول series_* (العمل) وmy_* (سجلك).
// كل حقل my_* يُقرأ: الحالة والحلقات والتقييم وتاريخا البداية والنهاية، ومعها مرات الإعادة والأولوية والوسوم والملاحظات إن وُجدت.
// ترتيب الأعمال في الملف هو ترتيب قائمتك هناك، ويُحفظ في ord.
export const STATUSES = ['watching', 'completed', 'hold', 'dropped', 'plan'];
const STATUS = { 'watching': 'watching', 'completed': 'completed', 'on-hold': 'hold', 'onhold': 'hold', 'on hold': 'hold', 'dropped': 'dropped', 'plan to watch': 'plan', 'plantowatch': 'plan',
  1: 'watching', 2: 'completed', 3: 'hold', 4: 'dropped', 6: 'plan' };
const ENT = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
const text = s => { s = s.trim(); const m = s.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/); return m ? m[1] : s.replace(/&(lt|gt|quot|apos|amp);/g, (_, k) => ENT[k]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)); };
const fields = block => { const o = {}; for (const m of block.matchAll(/<([a-z_]+)>([\s\S]*?)<\/\1>/g)) o[m[1]] = text(m[2]); return o; };
const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
// MAL يقبل تاريخاً ناقصاً (سنة فقط، أو سنة وشهر) ويصدّره بأصفار: 2016-00-00 و2016-02-00. يُحفظ بقدر ما فيه
export const malDate = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m || m[1] === '0000') return null; return m[2] === '00' ? m[1] : m[3] === '00' ? `${m[1]}-${m[2]}` : m[0]; };
const PRI = { low: 0, medium: 1, high: 2 };

export function parseMal(xml) {
  xml = String(xml || ''); if (!/<myanimelist>/.test(xml)) throw new Error('ليس ملف تصدير MyAnimeList: لا يبدأ بـ<myanimelist>.');
  if (/<manga>/.test(xml) && !/<anime>/.test(xml)) throw new Error('هذا ملف قائمة المانغا. المطلوب ملف قائمة الأنمي (animelist).');
  const info = fields((xml.match(/<myinfo>([\s\S]*?)<\/myinfo>/) || [, ''])[1]), entries = [], skipped = [];
  let ord = 0;
  for (const m of xml.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) { const f = fields(m[1]), id = int(f.series_animedb_id), status = STATUS[String(f.my_status || '').trim().toLowerCase()];
    if (!id || !status) { skipped.push(f.series_title || f.series_animedb_id || '؟'); continue; }
    const e = { id, ord: ord++, title: f.series_title || '', type: f.series_type || '', eps: int(f.series_episodes), status, watched: int(f.my_watched_episodes), score: Math.min(10, int(f.my_score)),
      start: malDate(f.my_start_date), finish: malDate(f.my_finish_date) };
    // ما لا يملؤه أغلب الناس يُضاف فقط حين يحمل قيمة، حتى يبقى السجل خفيفاً ولا يضيع شيء
    const times = int(f.my_times_watched), pri = PRI[String(f.my_priority || '').toLowerCase()] || 0;
    if (times) e.times = times; if (int(f.my_rewatching)) { e.rewatching = true; if (int(f.my_rewatching_ep)) e.rewatchEp = int(f.my_rewatching_ep); }
    if (pri) e.priority = pri; if (f.my_tags) e.tags = f.my_tags; if (f.my_comments) e.comments = f.my_comments;
    if (int(f.my_rewatch_value)) e.rewatchValue = int(f.my_rewatch_value); if (f.my_storage) e.storage = f.my_storage; if (+f.my_storage_value) e.storageValue = +f.my_storage_value;
    entries.push(e); }
  const count = s => entries.filter(e => e.status === s).length;
  return { user: { id: int(info.user_id), name: info.user_name || '' }, entries, skipped,
    totals: { all: entries.length, ...Object.fromEntries(STATUSES.map(s => [s, count(s)])), episodes: entries.reduce((n, e) => n + e.watched, 0), scored: entries.filter(e => e.score).length },
    // ما يقوله الملف عن نفسه، للمطابقة: إن خالف العدّ فالملف ناقص أو معدَّل
    declared: { all: int(info.user_total_anime), watching: int(info.user_total_watching), completed: int(info.user_total_completed), hold: int(info.user_total_onhold), dropped: int(info.user_total_dropped), plan: int(info.user_total_plantowatch) } };
}
// الملف يصل مضغوطاً (.gz) كما يصدّره MyAnimeList، أو مفكوكاً. يُعرف من أول بايتين لا من الاسم
export async function readMalFile(file) { const buf = new Uint8Array(await file.arrayBuffer()), gz = buf[0] === 0x1f && buf[1] === 0x8b;
  if (!gz) return parseMal(new TextDecoder().decode(buf));
  if (typeof DecompressionStream !== 'function') throw new Error('متصفحك لا يفك ضغط الملف. فكّه أولاً ثم اختر ملف .xml.');
  return parseMal(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()); }
