// البوابة الصغيرة: زر الرجوع إلى القاعة في كل عالم. نسخة مصغّرة من بوابة هذا العالم في القاعة يتحرك فيها ضوؤه بهدوء
// (رسمها في styles.css لدي سي وFate، وفي films.css للأفلام).
// وحين تُضغط تتسع حتى تملأ الشاشة ويتحول لونها إلى لون القاعة ثم ننتقل، والقاعة تفتح على بوابة هذا العالم.
export const miniDoor = '<span class="pdoor" aria-hidden="true"><i></i><i></i><i></i></span>';

export function portalBack(guide) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="../"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    try { localStorage.setItem('hub.last', guide); } catch {}
    if (calm.matches) return;
    e.preventDefault();
    const d = a.querySelector('.pdoor') || a, r = d.getBoundingClientRect(), bg = getComputedStyle(d).backgroundColor;
    const c = Object.assign(document.createElement('div'), { className: 'pexit' });
    document.body.append(c);
    c.animate({ transform: [`translate(${r.left}px,${r.top}px) scale(${r.width / innerWidth},${r.height / innerHeight})`, 'none'], backgroundColor: [bg, '#06070a'] },
      { duration: 460, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both' });
    setTimeout(() => { location.href = a.href; }, 500);
  });
  // الرجوع بزر المتصفح بعد الانتقال يعيد الصفحة من الذاكرة كما تُركت، فنزيل الغطاء
  addEventListener('pageshow', () => document.querySelectorAll('.pexit').forEach(x => x.remove()));
}
