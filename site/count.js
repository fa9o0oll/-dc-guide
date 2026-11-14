// العدّاد التنازلي المشترك بين البوابات. الحساب حتى منتصف ليل يوم الصدور بتوقيت الجهاز.
// كل بوابة ترسم إطاره بهويتها (دي سي وFate: لوحة بنقش العالم وألوانه، الأفلام: لافتة سينما وشريط العدّ القديم)،
// وهذا الملف يكتب الأرقام ويحرّكها: عنصر فيه data-until وبداخله .ck يتحدث كل ثانية، والرقم الذي يتغير وحده يصعد
// مكان القديم كعدّاد المسافات. حين يحين الموعد يُكتب نص data-now («يُعرض اليوم»…).
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
export function left(date) {
  const ms = new Date(date + 'T00:00:00') - Date.now(); if (ms <= 0) return null;
  const s = Math.floor(ms / 1e3); return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}
// تمييز العدد مع الرقم: 1 يوم، 2 يومان، 3–10 أيام، 11–99 يوماً، 100 يوم…
export const dayWord = n => { const m = n % 100; return n === 2 ? 'يومان' : m >= 3 && m <= 10 ? 'أيام' : m >= 11 ? 'يوماً' : 'يوم'; };
const p2 = n => String(n).padStart(2, '0'), chars = s => [...String(s)].map(c => `<span>${c}</span>`).join('');
// صف العدّ: الأيام كبيرة باسمها، ثم ساعات:دقائق:ثوانٍ. بلا أيام حين يبقى أقل من يوم
export function clock(date, now = 'اليوم') {
  const t = left(date); if (!t) return `<b class="ck-now">${now}</b>`;
  return `<span class="ck-d"${t.d ? '' : ' hidden'}><b class="dg">${chars(t.d)}</b><i>${dayWord(t.d)}</i></span>`
    + `<span class="ck-t" dir="ltr"><b class="dg">${chars(p2(t.h))}</b><u>:</u><b class="dg">${chars(p2(t.m))}</b><u>:</u><b class="dg">${chars(p2(t.s))}</b></span>`;
}
// نص يُقرأ لقارئ الشاشة بدل الخانات المتحركة، بتمييز العدد: «باقٍ 65 يوماً و5 ساعات و35 دقيقة»
const say = (n, [one, two, few, many, hundred]) => { const m = n % 100; return n === 1 ? one : n === 2 ? two : m >= 3 && m <= 10 ? `${n} ${few}` : m >= 11 ? `${n} ${many}` : `${n} ${hundred}`; };
export const spoken = date => { const t = left(date); if (!t) return '';
  const p = [t.d && say(t.d, ['يوم واحد', 'يومان', 'أيام', 'يوماً', 'يوم']), t.h && say(t.h, ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة', 'ساعة']), t.m && say(t.m, ['دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة', 'دقيقة'])].filter(Boolean);
  return p.length ? `باقٍ ${p.join(' و')}` : 'باقٍ أقل من دقيقة'; };
const roll = el => { if (!reduce.matches) el.animate?.([{ transform: 'translateY(.32em)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }); };
function put(el, v) { v = String(v); const cs = el.children;
  if (cs.length !== v.length) { el.innerHTML = chars(v); return [...el.children].forEach(roll); }
  [...v].forEach((c, i) => { if (cs[i].textContent !== c) { cs[i].textContent = c; roll(cs[i]); } }); }
export function tick(root = document) {
  for (const ck of root.querySelectorAll('[data-until] .ck')) {
    const host = ck.closest('[data-until]'), t = left(host.dataset.until), dg = ck.querySelectorAll('.dg');
    if (!t) { if (!ck.querySelector('.ck-now')) ck.innerHTML = clock(host.dataset.until, host.dataset.now); continue; }
    if (dg.length !== 4) { ck.innerHTML = clock(host.dataset.until, host.dataset.now); continue; }
    const d = ck.querySelector('.ck-d'); d.hidden = !t.d; if (t.d) { put(dg[0], t.d); d.querySelector('i').textContent = dayWord(t.d); }
    put(dg[1], p2(t.h)); put(dg[2], p2(t.m)); put(dg[3], p2(t.s));
    if (!t.s) host.querySelector('.sr-time')?.replaceChildren(spoken(host.dataset.until));
  }
}
setInterval(() => { if (!document.hidden) tick(); }, 1000);
