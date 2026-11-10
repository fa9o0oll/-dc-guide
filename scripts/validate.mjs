// فحص سلامة البيانات — يفشل (exit 1) عند أي خلل. يُشغَّل قبل كل نشر.
import fs from 'node:fs';
const rd = f => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));
const [U, W, P, B, M] = ['universes', 'works', 'placements', 'bridges', 'legacy-id-map'].map(f => rd(f + '.json'));
const errs = [], warn = [];
const uIds = new Set(U.map(u => u.id)), wById = new Map(W.map(w => [w.id, w]));
if (uIds.size !== U.length) errs.push('معرّف عالم مكرر');
if (wById.size !== W.length) errs.push('معرّف عمل مكرر');
const seenTY = new Map();
for (const w of W) {
  if (!/^[a-z0-9-]+-(\d{4}|tba)$/.test(w.id)) errs.push('معرّف غير صالح: ' + w.id);
  if (!w.title || /\((film|TV series|serial|\d{4} film)\)$/.test(w.title)) errs.push('عنوان فيه لاحقة ويكيبيديا: ' + w.title);
  if (!['film', 'series'].includes(w.kind) || !['live', 'animation'].includes(w.medium)) errs.push('نوع غير صالح: ' + w.id);
  const k = w.title + '|' + w.year + '|' + w.kind; if (seenTY.has(k)) errs.push('عمل مكرر: ' + k); seenTY.set(k, 1);
  if (!w.idsVerified) warn.push('ids:' + w.id);
  else if (!Number.isInteger(w.ids?.tmdb)) errs.push('معرّف موثّق بلا رقم TMDB: ' + w.id);
}
const posSeen = new Set(), placed = new Set();
for (const p of P) {
  if (!uIds.has(p.universe)) errs.push('عالم غير معروف: ' + p.universe);
  if (!wById.has(p.work)) errs.push('عمل غير معروف: ' + p.work);
  const k = p.universe + '#' + p.position; if (posSeen.has(k)) errs.push('ترتيب مكرر: ' + k); posSeen.add(k);
  const pk = p.universe + '|' + p.work + '|' + (p.season ?? ''); if (placed.has(pk)) errs.push('إدراج مكرر في نفس العالم: ' + pk); placed.add(pk);
  if (p.season && wById.get(p.work)?.kind !== 'series') errs.push('موسم لعمل ليس مسلسلاً: ' + p.work);
  if (p.upcoming && (!['production', 'development'].includes(p.upcoming.stage) || !/^https:\/\//.test(p.upcoming.source))) errs.push('عمل قادم بلا مرحلة أو مصدر: ' + p.work);
  if (p.canon && !/^https:\/\//.test(p.canon.source)) errs.push('حالة اعتماد بلا مصدر: ' + p.work);
}
for (const u of U) { const n = P.filter(p => p.universe === u.id).map(p => p.position).sort((a, b) => a - b);
  if (!n.length) errs.push('عالم بلا أعمال: ' + u.id); n.forEach((v, i) => { if (v !== i + 1) errs.push('فجوة في ترتيب: ' + u.id); }); }
for (const w of W) if (![...placed].some(k => k.split('|')[1] === w.id)) errs.push('عمل غير مُدرج في أي عالم: ' + w.id);
const multi = W.filter(w => new Set(P.filter(p => p.work === w.id).map(p => p.universe)).size > 1);
for (const w of multi) if (!P.some(p => p.work === w.id && p.canon)) errs.push('عمل في عالمين بلا توثيق: ' + w.id);
for (const b of B) { if (!wById.has(b.from) || !wById.has(b.to)) errs.push('جسر يشير لعمل غير موجود: ' + b.label); if (!uIds.has(b.toUniverse)) errs.push('جسر لعالم غير معروف'); }
for (const [k, v] of Object.entries(M)) if (!wById.has(v.work)) errs.push('خريطة قديمة تشير لعمل مفقود: ' + k);
if (Object.keys(M).length !== 185) errs.push('خريطة المعرّفات القديمة ناقصة');
console.log(`أعمال ${W.length} | إدراجات ${P.length} | عوالم ${U.length} | أعمال في أكثر من عالم: ${multi.map(w => w.id).join(', ')}`);
console.log(`بانتظار التوثيق: معرّفات ${warn.length}/${W.length}`);
if (errs.length) { console.error('❌ أخطاء:\n- ' + [...new Set(errs)].join('\n- ')); process.exit(1); }
console.log('✅ البيانات سليمة بنيوياً');
