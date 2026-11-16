// عناية الألعاب: ما نكتبه نحن لكل لعبة فوق بيانات IGDB الآلية، ويُحفظ في المستودع:
//   data/games/translations.json   ترجمتنا العربية لنبذتها (s) وقصتها (t)، ومعها بصمة النص الإنجليزي الذي تُرجم (h)
//   data/games/places.json         موقعها من أحداث عالمها: نوعه (k) وجملته (line) وما قبلها وما بعدها في الأحداث وزمانها ومكانها
// طريقة الكتابة وقواعدها في docs/GAMES-CARE.md، والأداة scripts/games-care.mjs. هذا الملف يدمجها في ملفات الموقع ويتحقق منها، بلا شبكة.
import { createHash } from 'node:crypto';

// بصمة النص الإنجليزي: إن تغيّرت النبذة في IGDB بعد ترجمتها عُرف ذلك وأُعيدت مراجعتها
export const textKey = (s, t) => createHash('sha1').update(String(s || '').trim() + '\n' + String(t || '').trim()).digest('hex').slice(0, 8);

// أنواع الموقع من الأحداث. none: لا موقع يُذكر (لعبة بلا حكاية ولا عالم متصل)، فلا يظهر القسم في بطاقتها
export const KINDS = ['first', 'sequel', 'prequel', 'between', 'side', 'alone', 'reboot', 'remake', 'same', 'alt', 'retell', 'nostory', 'bundle', 'none'];

const AR = /[؀-ۿ]/, arShare = s => { const letters = s.replace(/[^A-Za-z؀-ۿ]/g, ''); return letters ? letters.replace(/[^؀-ۿ]/g, '').length / letters.length : 0; };

// يدمج العناية في الألعاب: يفصل النصوص الطويلة في خريطة مستقلة (للملف texts.json)، ويضع الموقع من الأحداث في سجل اللعبة.
// النص الإنجليزي من اللعبة نفسها إن كانت قادمة للتو من IGDB، وإلا من الخريطة السابقة (إعادة التطبيق بلا شبكة).
export function applyCare(games, prev = {}, TR = {}, PLACES = {}) {
  const texts = {}, n = { text: 0, ar: 0, old: 0, place: 0 };
  for (const g of games) {
    const p = prev[g.id] || {}, s = String(g.summary ?? p.s ?? '').trim(), t = String(g.story ?? p.t ?? '').trim(), tr = TR[g.id], o = {};
    if (s) o.s = s; if (t) o.t = t;
    if (tr) { if (tr.s && s) o.sa = tr.s; if (tr.t && t) o.ta = tr.t; if (o.sa || o.ta) n.ar++; if (tr.h && tr.h !== textKey(s, t)) { o.old = 1; n.old++; } }
    if (Object.keys(o).length) { texts[g.id] = o; n.text++; }
    delete g.summary; delete g.story; delete g.place;
    const pl = PLACES[g.id]; if (pl && pl.k !== 'none') { g.place = pl; n.place++; }
  }
  return { texts, n };
}

// ما ينقص كل لعبة: ترجمة النبذة، ترجمة القصة، مراجعة نص تغيّر، الموقع من الأحداث
export function pendingCare(games, texts = {}, TR = {}, PLACES = {}) {
  const out = [];
  for (const g of games) { const x = texts[g.id] || {}, tr = TR[g.id] || {}, need = [];
    if (x.s && !tr.s) need.push('summary'); if (x.t && !tr.t) need.push('story');
    if (!need.length && tr.h && (x.s || x.t) && tr.h !== textKey(x.s, x.t)) need.push('changed');
    if (!PLACES[g.id]) need.push('place');
    if (need.length) out.push({ id: g.id, need }); }
  return out;
}

// فحص صحة ملفي العناية. يعيد قائمة بالمشكلات (فارغة إن صحّا)
export function checkCare(TR = {}, PLACES = {}, texts = null) {
  const bad = [], str = v => typeof v === 'string' && v.trim() === v && v.length > 0;
  for (const [id, t] of Object.entries(TR)) { const at = `translations ${id}`, en = texts?.[id];
    if (!/^\d+$/.test(id)) bad.push(`${at}: المفتاح ليس رقم لعبة`);
    if (!t || typeof t !== 'object') { bad.push(`${at}: ليست كائناً`); continue; }
    for (const k of Object.keys(t)) if (!['s', 't', 'h'].includes(k)) bad.push(`${at}: حقل غير معروف «${k}»`);
    if (!str(t.s) && !str(t.t)) bad.push(`${at}: بلا نبذة ولا قصة`);
    for (const [k, e] of [['s', en?.s], ['t', en?.t]]) { const v = t[k]; if (v == null) continue;
      if (!str(v)) { bad.push(`${at}.${k}: نص فارغ أو حوله فراغ`); continue; }
      if (!AR.test(v) || arShare(v) < .6) bad.push(`${at}.${k}: ليس نصاً عربياً (حصة الحروف العربية ${Math.round(arShare(v) * 100)}%)`);
      if (/[‎‏‪-‮⁦-⁩]/.test(v)) bad.push(`${at}.${k}: فيه علامات اتجاه خفية`);
      if (/ {2,}|\t| \n|\n{3,}/.test(v)) bad.push(`${at}.${k}: فراغات زائدة`);
      if (e && (v.length < e.length * .35 || v.length > e.length * 1.9)) bad.push(`${at}.${k}: طولها ${v.length} حرفاً والأصل ${e.length} (ناقصة أو زائدة؟)`); }
    if (t.h != null && !/^[0-9a-f]{8}$/.test(t.h)) bad.push(`${at}.h: بصمة غير صالحة`);
  }
  for (const [id, p] of Object.entries(PLACES)) { const at = `places ${id}`;
    if (!/^\d+$/.test(id)) bad.push(`${at}: المفتاح ليس رقم لعبة`);
    if (!p || typeof p !== 'object') { bad.push(`${at}: ليس كائناً`); continue; }
    for (const k of Object.keys(p)) if (!['k', 'line', 'after', 'before', 'when', 'where', 'src'].includes(k)) bad.push(`${at}: حقل غير معروف «${k}»`);
    if (!KINDS.includes(p.k)) bad.push(`${at}.k: نوع غير معروف «${p.k}»`);
    if (p.k === 'none') { if (Object.keys(p).length > 1) bad.push(`${at}: none لا يحمل حقولاً أخرى`); continue; }
    if (!str(p.line) || !AR.test(p.line)) bad.push(`${at}.line: جملة عربية مطلوبة`); else if (p.line.length > 260) bad.push(`${at}.line: أطول من 260 حرفاً (${p.line.length})`);
    for (const k of ['after', 'before']) if (p[k] != null && (!str(p[k]) || p[k].length > 90)) bad.push(`${at}.${k}: اسم عمل قصير مطلوب`);
    for (const k of ['when', 'where']) if (p[k] != null && (!str(p[k]) || p[k].length > 70)) bad.push(`${at}.${k}: نص قصير مطلوب`);
    if (p.k === 'between' && !(p.after && p.before)) bad.push(`${at}: between يلزمه after وbefore`);
    if (p.src != null && p.src !== 'igdb' && !(Array.isArray(p.src) && p.src.length && p.src.every(x => str(x?.name) && /^https:\/\/[^\s]+$/.test(x?.url || '')))) bad.push(`${at}.src: «igdb» أو قائمة مصادر بروابط https`);
  }
  return bad;
}
