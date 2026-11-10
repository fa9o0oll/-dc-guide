// يولّد ترتيب مشاهدة آروفيرس من تواريخ العرض الفعلية للحلقات + قائمة التقاطعات في data/arrowverse-config.json.
// يفشل إذا: حلقة تقاطع غير موجودة، عنوانها لا يطابق، أو أي حلقة من المسلسلات الرئيسية لم تُدرج مرة واحدة بالضبط.
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const rd = p => JSON.parse(fs.readFileSync(new URL(p, root)));
const cfg = rd('data/arrowverse-config.json');
const eps = {}; // work -> [{s,e,date,name}]
for (const id of Object.keys(cfg.shows)) eps[id] = rd(`site/data/episodes/${id}.json`).seasons.flatMap(s => s.episodes.map(e => ({ s: s.n, e: e.n, date: e.date, name: e.name })));
const errs = [];
const find = (w, s, e) => eps[w]?.find(x => x.s === s && x.e === e);
const key = (w, s, e) => `${w}|${s}|${e}`;
const bYear = d => { const [y, m] = d.split('-').map(Number); return m >= 9 ? y : y - 1; };

// تحقق من التقاطعات مقابل عناوين الحلقات الرسمية
const special = new Map(); // key -> {crossover, kind}
for (const x of cfg.crossovers) {
  const re = new RegExp(x.titleMatch, 'i');
  x.parts.forEach(([w, s, e], i) => { const ep = find(w, s, e);
    if (!ep) return errs.push(`${x.id}: الجزء ${i + 1} غير موجود ${key(w, s, e)}`);
    if (!re.test(ep.name)) errs.push(`${x.id}: عنوان الجزء ${i + 1} «${ep.name}» لا يطابق`);
    special.set(key(w, s, e), { x: x.id, kind: 'part' }); });
  (x.tieIns || []).forEach(([w, s, e, , m]) => { const ep = find(w, s, e);
    if (!ep || !new RegExp(m, 'i').test(ep.name)) errs.push(`${x.id}: حلقة مرتبطة غير مطابقة ${key(w, s, e)}`);
    special.set(key(w, s, e), { x: x.id, kind: 'tie' }); });
  const dates = x.parts.map(([w, s, e]) => find(w, s, e)?.date);
  if (dates.some((d, i) => i && d < dates[i - 1])) errs.push(`${x.id}: ترتيب الأجزاء يخالف تواريخ العرض`);
  x.year = bYear(dates[0]); x.first = dates[0]; x.last = dates.at(-1);
}
for (const l of cfg.links) { const ep = find(...l.at); if (!ep) errs.push('رابط لحلقة غير موجودة: ' + l.at.join(' '));
  else if (l.titleMatch && !new RegExp(l.titleMatch, 'i').test(ep.name)) errs.push(`رابط: عنوان «${ep.name}» لا يطابق ${l.titleMatch}`); }

// مواسم كل مسلسل
const seasons = [];
for (const [w, list] of Object.entries(eps)) for (const s of [...new Set(list.map(x => x.s))]) {
  const l = list.filter(x => x.s === s && x.date); if (!l.length) continue;
  seasons.push({ w, s, list: l, start: l[0].date, end: l.at(-1).date, year: bYear(l[0].date) });
}
const range = (w, s, l) => ({ work: w, show: cfg.shows[w], season: s, from: l[0].e, to: l.at(-1).e, count: l.length, firstAired: l[0].date, lastAired: l.at(-1).date,
  whole: l.length === eps[w].filter(x => x.s === s).length,
  links: cfg.links.filter(k => k.at[0] === w && k.at[1] === s && l.some(x => x.e === k.at[2])).map(k => ({ episode: k.at[2], ...(k.to ? { toEpisode: k.to } : {}), note: k.note })) });
const byStart = (a, b) => a.firstAired.localeCompare(b.firstAired);

const steps = [];
for (const year of [...new Set(seasons.map(s => s.year))].sort()) {
  const ys = seasons.filter(s => s.year === year), x = cfg.crossovers.find(c => c.year === year);
  const label = `موسم ${year}–${year + 1}`;
  if (!x) { steps.push({ id: `av-${year}`, kind: 'phase', label, title: label, blocks: ys.map(s => range(s.w, s.s, s.list)).sort(byStart) }); continue; }
  const pre = [], post = [];
  for (const s of ys) {
    const mine = s.list.filter(ep => special.get(key(s.w, s.s, ep.e))?.x === x.id);
    if (!mine.length) { (s.end < x.first ? pre : post).push(range(s.w, s.s, s.list)); continue; } // موسم لا يشارك في التقاطع يبقى كاملاً
    const firstE = Math.min(...mine.map(m => m.e)), lastE = Math.max(...mine.map(m => m.e));
    const a = s.list.filter(ep => ep.e < firstE), b = s.list.filter(ep => ep.e > lastE);
    if (s.list.some(ep => ep.e > firstE && ep.e < lastE && !special.has(key(s.w, s.s, ep.e)))) errs.push(`${x.id}: حلقات بين أجزاء التقاطع في ${s.w} S${s.s}`);
    if (a.length) pre.push(range(s.w, s.s, a)); if (b.length) post.push(range(s.w, s.s, b));
  }
  if (pre.length) steps.push({ id: `av-${year}-a`, kind: 'phase', label, title: `قبل تقاطع ${x.nameAr}`, blocks: pre.sort(byStart) });
  const tie = (x.tieIns || []).map(([w, s, e, note]) => ({ work: w, show: cfg.shows[w], season: s, episode: e, name: find(w, s, e)?.name, aired: find(w, s, e)?.date, tieIn: true, note }));
  const parts = x.parts.map(([w, s, e, note], i) => ({ part: i + 1, work: w, show: cfg.shows[w], season: s, episode: e, name: find(w, s, e)?.name, aired: find(w, s, e)?.date, ...(note ? { note } : {}) }));
  steps.push({ id: `av-${year}-x`, kind: 'crossover', label, title: `تقاطع: ${x.nameAr}`, titleEn: x.name, crossover: x.id,
    parts: [...parts, ...tie].sort((p, q) => (p.aired || '').localeCompare(q.aired || '') || (p.tieIn ? -1 : 0) - (q.tieIn ? -1 : 0) || (p.part || 0) - (q.part || 0)) });
  if (post.length) steps.push({ id: `av-${year}-b`, kind: 'phase', label, title: `بعد تقاطع ${x.nameAr}`, blocks: post.sort(byStart) });
}

// ترتيب الارتباطات: الحلقة السابقة يجب أن تأتي قبل اللاحقة
const locate = ([w, s, e]) => { for (let i = 0; i < steps.length; i++) { const st = steps[i];
  const b = (st.blocks || []).findIndex(b => b.work === w && b.season === s && e >= b.from && e <= b.to); if (b >= 0) return { i, b };
  const q = (st.parts || []).findIndex(q => q.work === w && q.season === s && q.episode === e); if (q >= 0) return { i, b: -1 }; } return null; };
for (const o of cfg.order || []) { const A = locate(o.before), B = locate(o.after);
  if (!A || !B) { errs.push('ارتباط لحلقة غير مدرجة: ' + o.why); continue; }
  if (A.i > B.i) errs.push('ارتباط معكوس بين الخطوات: ' + o.why);
  else if (A.i === B.i && A.b > B.b && B.b >= 0) { const bl = steps[A.i].blocks; bl.splice(B.b, 0, bl.splice(A.b, 1)[0]); } }
for (const o of cfg.order || []) { const A = locate(o.before), B = locate(o.after); if (A && B && (A.i > B.i || (A.i === B.i && B.b >= 0 && A.b > B.b))) errs.push('تعذّر تحقيق الارتباط: ' + o.why); }

// فحص التغطية: كل حلقة مرة واحدة بالضبط
const seen = new Map();
const mark = (w, s, e) => seen.set(key(w, s, e), (seen.get(key(w, s, e)) || 0) + 1);
for (const st of steps) { (st.blocks || []).forEach(b => { for (let e = b.from; e <= b.to; e++) mark(b.work, b.season, e); }); (st.parts || []).forEach(p => mark(p.work, p.season, p.episode)); }
let total = 0;
for (const [w, list] of Object.entries(eps)) for (const ep of list) { total++; const n = seen.get(key(w, ep.s, ep.e)) || 0; if (n !== 1) errs.push(`تغطية: ${key(w, ep.s, ep.e)} وردت ${n} مرة`); }
if (seen.size !== total) errs.push(`تغطية: ${seen.size} مدرجة مقابل ${total} حلقة فعلية`);

if (errs.length) { console.error('❌ ترتيب آروفيرس:\n- ' + errs.slice(0, 30).join('\n- ')); process.exit(1); }
steps.forEach((s, i) => s.n = i + 1);
fs.writeFileSync(new URL('site/data/arrowverse.json', root), JSON.stringify({ generatedAt: new Date().toISOString(), totalEpisodes: total, steps, sideWorlds: cfg.sideWorlds }) + '\n');
console.log(`✅ آروفيرس: ${steps.length} خطوة تغطي ${total} حلقة من ${Object.keys(eps).length} مسلسلات، بلا نقص ولا تكرار`);
