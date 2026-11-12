// نص عربي فيه أسماء إنجليزية: نعزل كل مقطع لاتيني في <bdi dir="ltr"> حتى لا يتبعثر السطر.
// بدونه تختلط الكلمات والأرقام في العرض من اليمين، مثل «وSunrise on the Reaping قبله بـ24 سنة» التي تظهر «Sunrise ong».
// المقطع: كلمات لاتينية وما بينها من أرقام ورموز (& - : ' .) على السطر نفسه، ويجوز أن يبدأ برقم يليه كلمة لاتينية («28 Days Later»).
// علامات الترقيم في آخره تبقى خارجه لأنها من الجملة العربية. النص الخالي من العربية يُعاد كما هو بعد التهريب.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TOK = "[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ'’&.,:!?/+\\-–]*";
const RUN = new RegExp(`(?:\\d+[\\d.,:]*\\s+)*[A-Za-zÀ-ɏ][A-Za-z0-9À-ɏ'’&.,:!?/+\\-–]*(?:[ \\t]+(?:${TOK}|[&\\-–:]))*`, 'g');
const AR = /[؀-ۿ]/;
export function ar(s) {
  s = String(s ?? ''); if (!AR.test(s)) return esc(s);
  let out = '', i = 0;
  for (const m of s.matchAll(RUN)) {
    let run = m[0], end = m.index + run.length;
    const tail = run.match(/[\s.,:;!?\-–]+$/); if (tail) { run = run.slice(0, -tail[0].length); end -= tail[0].length; }
    if (!run) continue;
    out += esc(s.slice(i, m.index)) + `<bdi dir="ltr">${esc(run)}</bdi>`; i = end;
  }
  return out + esc(s.slice(i));
}
