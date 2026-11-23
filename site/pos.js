// «موقعه من سلسلته» في البوابات (E58): الخريطة الصغيرة المشتركة فوق سطر الموقع في بطاقة الفيلم واللعبة وعمل الدليل، والعدد الترتيبي بالعربية.
// الخريطة نقاط على خط من اليمين: نقطة لكل جزء بترتيب السلسلة، وما أكملته ممتلئ، وموضع هذا العمل نقطة مضيئة تنبض مرتين حين تُفتح البطاقة.
// السلسلة الطويلة تُختصر حول الموضع، والفرع (جزء جانبي أو نسخة أخرى) معلّق تحت أصله، والعمل المنفرد نقطة وحدها على خط متقطع.
// ألوانها من متغيرات البوابة: ‎--lc لون الخط، و‎--pos-bg أرضية النقطة الفارغة، و‎--pos-ink حافة النقطة المضيئة. («أنمياتي» لها نسختها في anime.js وanime.css)
const CSS = `.pos-map{display:block;width:100%;overflow:visible}
.pos-map .trk{stroke:color-mix(in srgb,var(--lc) 38%,transparent);stroke-width:2;stroke-linecap:round}
.pos-map .trk.br,.pos-map.solo .trk{stroke-dasharray:3 5}
.pos-map .d{fill:var(--pos-bg,#14141c);stroke:color-mix(in srgb,var(--lc) 75%,transparent);stroke-width:1.6}
.pos-map .d.done{fill:color-mix(in srgb,var(--lc) 70%,var(--pos-bg,#14141c))}
.pos-map .gap{fill:color-mix(in srgb,var(--lc) 60%,transparent)}
.pos-map .here{fill:var(--lc);stroke:var(--pos-ink,#fff);stroke-width:2}
.pos-map .ring{fill:none;stroke:var(--lc);stroke-width:1.5;opacity:0;transform-box:fill-box;transform-origin:center;animation:pos-ping 1.8s cubic-bezier(.2,.7,.3,1) .25s 2}
@keyframes pos-ping{0%{opacity:.9;transform:scale(.6)}100%{opacity:0;transform:scale(2.2)}}
@media (prefers-reduced-motion:reduce){.pos-map .ring{animation:none}}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

const UNITS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ONES = ['', 'الحادي', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
const TENS = ['', '', 'العشرون', 'الثلاثون', 'الأربعون', 'الخمسون', 'الستون', 'السبعون', 'الثمانون', 'التسعون'];
// العدد الترتيبي المذكر: الأول، الحادي عشر، الحادي والعشرون. وما فوق 99 برقمه
export const ord = n => n <= 10 ? UNITS[n] : n < 20 ? `${ONES[n - 10]} عشر` : n < 100 ? (n % 10 ? `${ONES[n % 10]} و${TENS[n / 10 | 0]}` : TENS[n / 10]) : `رقم ${n}`;

const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
// n: عدد أجزاء الخط، at: موضع هذا العمل فيه (-1 إن كان على فرع)، done(i): هل أكملت الجزء i.
// branch: فرع معلّق تحت الجزء from من الخط: { from, n, at, done(j) }. solo: عمل منفرد لا خط له
export function posMap({ n = 0, at = -1, done = () => false, branch = null, solo = false, max = 13 } = {}) {
  if (solo) return `<svg class="pos-map solo" height="24" aria-hidden="true"><line class="trk" x1="34%" x2="66%" y1="12" y2="12"/><circle class="ring" cx="50%" cy="12" r="9"/><circle class="here" cx="50%" cy="12" r="5.5"/></svg>`;
  if (!n && !branch) return '';
  const f = branch ? Math.max(0, branch.from) : Math.max(0, at);
  const slots = n <= max ? range(0, n - 1) : (() => { const lo = Math.max(1, Math.min(f - 4, n - max + 3)), hi = Math.min(n - 2, lo + max - 5); return [0, ...(lo > 1 ? [-1] : []), ...range(lo, hi), ...(hi < n - 2 ? [-1] : []), n - 1]; })();
  const S = Math.max(1, slots.length), X = k => S === 1 ? 50 : 94 - k * 88 / (S - 1);
  const dot = (x, y, on, here) => here ? `<circle class="ring" cx="${x}%" cy="${y}" r="9"/><circle class="here" cx="${x}%" cy="${y}" r="5.5"/>` : `<circle class="d${on ? ' done' : ''}" cx="${x}%" cy="${y}" r="3.6"/>`;
  let out = n > 1 ? `<line class="trk" x1="${X(0)}%" x2="${X(S - 1)}%" y1="12" y2="12"/>` : '';
  slots.forEach((i, k) => { out += i < 0 ? [-1.6, 0, 1.6].map(o => `<circle class="gap" cx="${X(k) + o}%" cy="12" r="1.1"/>`).join('') : dot(X(k), 12, done(i), i === at && !branch); });
  if (branch) { const m = branch.n, k0 = slots.indexOf(branch.from), px = k0 >= 0 ? X(k0) : n ? null : 94, step = Math.min(S > 1 ? 88 / (S - 1) : 9, 9), show = Math.min(m, 9);
    const first = Math.max(0, Math.min(branch.at - 4, m - show)), dir = px != null && px - step * show >= 4 ? -1 : 1, bx = j => (px ?? 94) + dir * step * (j + 1);
    if (px != null && n) out += `<line class="trk br" x1="${px}%" x2="${px}%" y1="12" y2="34"/><line class="trk br" x1="${px}%" x2="${bx(show - 1)}%" y1="34" y2="34"/>`;
    for (let j = 0; j < show; j++) out += dot(bx(j), 34, branch.done?.(first + j), first + j === branch.at); }
  return `<svg class="pos-map" height="${branch ? 46 : 24}" aria-hidden="true">${out}</svg>`; }
