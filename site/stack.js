// ستاك البطاقات (E89، كما في «أنمياتي» E77) لقائمة أفلامي وألعابي ودليلَي DC ومارفل ودليل Fate: البطاقة التي تُفتح من بطاقة خطوة في سجل المتصفح
// فوقها (كانت تحل محلها فيضيع ما قبلها)، فالرجوع (زر المتصفح وإيماءة الجوال وEsc وزر «رجوع» بجانب ×) يعيد التي قبلها إلى موضع القراءة فيها،
// و× يغلقها كلها مرة واحدة إلى حيث كنت، ولا يبقى في السجل ما يعيد فتح شيء منها.
// تعطيه كل بوابة: key اسم حقلها في حال السجل، وbody ما يُمرَّر في البطاقة، وbtn زر الرجوع، وtitle() اسم البطاقة المفتوحة كما يُعرض،
// وshow(state, y) يرسم البطاقة التي تصفها خطوة السجل ثم يعيد موضع القراءة y، وclose() يغلق النافذة ولا يمسّ السجل، وisOpen().
export function cardStack({ key, body, btn, title, show, close, isOpen }) {
  const Y = new Map();   // موضع القراءة لكل عمق في الستاك
  let quiet = null;      // × أغلقها كلها في الحال، والسجل يرجع وراءها إلى ما قبل أولها بلا أثر
  // z: أول بطاقة فُتحت من رابط مباشر (#g… أو #m…) تشغل خطوة تحميل الصفحة نفسها، فالرجوع لا يتجاوزها (يخرج من الموقع) بل يُنظّفها
  const plain = () => location.pathname + location.search;
  const st = () => history.state && history.state[key] !== undefined && history.state.k ? history.state : null, depth = () => st()?.k || 0;
  function sync() { if (!btn) return; const s = st(), on = !!(isOpen() && s && s.k > 1), say = on && s.b ? `رجوع إلى «${s.b}»` : 'رجوع إلى البطاقة السابقة';
    btn.hidden = !on; btn.setAttribute('aria-label', say); btn.title = say; }
  function closeAll() { const s = st(), d = depth(), n = d - (s?.z ? 1 : 0); close(); sync(); if (!d) return;
    if (n > 0) { quiet = { strip: !!s?.z }; history.go(-n); } else history.replaceState(null, '', plain()); }
  return { depth, sync,
    // قبل أن تُرسم بطاقة فوق المفتوحة: موضع القراءة فيها واسمها (لزر الرجوع). يعيد null إن لم تكن بطاقة مفتوحة في الستاك
    leave() { const d = isOpen() ? depth() : 0; if (!d) return null; Y.set(d, body.scrollTop); return { d, t: title() }; },
    // البطاقة تُفتح: أول بطاقة خطوة، وما فُتح من بطاقة (from من leave) خطوة فوقها
    open(state, url, from) { history.pushState(from ? { ...state, k: from.d + 1, b: from.t, ...(st()?.z ? { z: 1 } : {}) } : { ...state, k: 1 }, '', url ?? location.href); sync(); },
    // البطاقة المفتوحة صارت غيرها في مكانها (أُضيفت إلى القائمة من بطاقة اطلاع، أو فُتحت من رابط مباشر): خطوتها كما هي بحالها الجديد
    swap(state, url) { history.replaceState({ ...(st() || { k: 1, z: 1 }), ...state }, '', url ?? location.href); sync(); },
    back() { const s = st(); if (s?.k === 1 && s.z) return closeAll(); if (s) history.back(); else { close(); sync(); } },
    closeAll,
    // بعد كل رجوع أو تقدّم في السجل: البطاقة التي تصفها الخطوة الحالية، أو الإغلاق
    async pop() { if (quiet) { if (quiet.strip) history.replaceState(null, '', plain()); quiet = null; sync(); return; } const s = st();
      if (s) await show(s, Y.get(s.k) ?? 0); else close(); sync(); } };
}
