// البحث المتسامح المشترك بين البوابات: يجد العمل وإن كُتب اسمه ناقصاً أو بإملاء خاطئ أو بالحروف العربية،
// ويقول «هل تقصد…؟» حين لا يطابق المكتوب حرفياً. يعمل في المتصفح وفي Node (فحوص tests/find.test.mjs وبناء الفهرس).
//
// الفكرة: كل اسم يُختصر إلى «هيكله الصوتي»، أي حروفه الساكنة بأصواتها لا بكتابتها، بالإنجليزية والعربية معاً:
//   John Wick → ج ن ك      جون ويك → ج ن ك      Interstellar → ن ت ر س ت ل ر      انترستلر → ن ت ر س ت ل ر
// الحركات وحروف المد تسقط (العربية لا تكتبها غالباً، والأخطاء الإملائية أكثرها فيها)، والحرف العربي الذي يحتمل
// صوتين يحملهما معاً (ج = j أو g، ق = k أو g، ث = th أو t…). ثم يُقارن هيكل المكتوب ببداية هيكل كل اسم
// (فيكفي أول الاسم) بمسافة تحرير تتسامح مع حرف ناقص أو زائد أو مبدل بقدر طول المكتوب.

// ---------- التطبيع: أشكال الهمزة والتاء المربوطة والألف المقصورة، والتشكيل، والأرقام العربية، وعلامات الترقيم
const DIAC = /[ؐ-ًؚ-ٰٟۖ-ۭـ̀-ͯ]/g;
const ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9' };
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'ذا', 'ذي']);
export function fold(s) {
  return String(s || '').normalize('NFKD').replace(DIAC, '')
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0)
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ٱ]/g, 'ا').replace(/[گک]/g, 'ك').replace(/ی/g, 'ي').replace(/ڤ/g, 'ف').replace(/پ/g, 'ب').replace(/چ/g, 'ج')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’`ʼ]/g, '').replace(/[^a-z0-9ء-ي]+/g, ' ').trim()
    .split(' ').map(w => ROMAN[w] || w).join(' ');
}
const words = f => f ? f.split(' ').filter(w => !STOP.has(w)) : [];
const isAr = s => /[ء-ي]/.test(s);

// ---------- الهيكل الصوتي: كل صوت بِتّ، والحرف المحتمل لصوتين يحمل البِتّين. h اختيارية (تسقط في John وتبقى في Hulk)
const B = 1, F = 2, T = 4, D = 8, TH = 16, S = 32, SH = 64, K = 128, G = 256, J = 512, L = 1024, M = 2048, N = 4096, R = 8192, H = 16384;
const AR = { 'ب': B, 'ف': F, 'ت': T, 'ط': T, 'د': D, 'ض': D, 'ث': TH | T, 'ذ': TH | D, 'ظ': TH | S, 'س': S, 'ص': S, 'ز': S, 'ش': SH, 'ك': K, 'ق': K | G,
  'خ': K | H, 'غ': G, 'ج': J | G, 'ل': L, 'م': M, 'ن': N, 'ر': R, 'ه': H, 'ح': H };
function arSyms(w, out) {
  for (let i = 0; i < w.length; i++) { const c = w[i];
    if (c === 'ت' && w[i + 1] === 'ش') { out.push(SH); i++; continue; }   // تش = ch
    const m = AR[c]; out.push(m || 0); }
}
function enSyms(w, out) {
  w = w.replace(/^kn/, 'n').replace(/^ps/, 's').replace(/^wr/, 'r').replace(/([aeiouy])gh/g, '$1').replace(/tion/g, 'Xn').replace(/sion/g, 'Xn')
    .replace(/ph/g, 'f').replace(/sh/g, 'X').replace(/ch/g, 'C').replace(/th/g, 'Q').replace(/ck/g, 'k').replace(/qu/g, 'k').replace(/x/g, 'ks');
  for (let i = 0; i < w.length; i++) { const c = w[i], nx = w[i + 1] || '';
    switch (c) {
      case 'b': case 'p': out.push(B); break;
      case 'f': case 'v': out.push(F); break;
      case 't': out.push(T); break;
      case 'd': out.push(D); break;
      case 'Q': out.push(TH | T); break;
      case 's': case 'z': out.push(S); break;
      case 'X': out.push(SH); break;
      case 'C': out.push(SH | K); break;
      case 'c': out.push('eiy'.includes(nx) ? S : K); break;
      case 'k': case 'q': out.push(K); break;
      case 'g': out.push('eiy'.includes(nx) ? G | J : G); break;
      case 'j': out.push(J); break;
      case 'l': out.push(L); break;
      case 'm': out.push(M); break;
      case 'n': out.push(N); break;
      case 'r': out.push(R); break;
      case 'h': out.push(H); break;
      default: out.push(0);   // صوت لين يفصل بين الحروف (لا يُعدّ في الهيكل)
    } }
}
// هيكل الكلمات متصلاً (المسافات لا تهم: spiderman = spider man)، مع موضع بداية كل كلمة فيه. الحرف المكرر المتجاور يُدمج
// (ll في Interstellar)، أما ما يفصله صوت لين فيبقى صوتين (sh-a-w-sh في Shawshank = ش-ا-و-ش)
function sound(ws) {
  const sym = [], starts = [];
  for (const w of ws) { if (/^\d+$/.test(w)) continue; const before = sym.length, tmp = [];
    (isAr(w) ? arSyms : enSyms)(w, tmp);
    let gap = true; for (const m of tmp) { if (!m) { gap = true; continue; } if (gap || sym.length === before || sym[sym.length - 1] !== m) sym.push(m); gap = false; }
    if (sym.length > before) starts.push(before); }
  return { sym: Int32Array.from(sym), starts };
}

// ---------- مسافة التحرير بين هيكل المكتوب وبداية هيكل الاسم (أقل قيمة على كل نهاية ممكنة للاسم)
// التطابق: أي صوت مشترك. حذف h أو زيادتها شبه مجاني، والتبديل بين حرفين متجاورين أرخص من خطأين.
let rowA = new Float32Array(64), rowB = new Float32Array(64), rowC = new Float32Array(64);
function prefixDistance(q, t, from) {
  const n = t.length - from; if (n <= 0) return Infinity;
  if (rowA.length < n + 1) { rowA = new Float32Array(n + 1); rowB = new Float32Array(n + 1); rowC = new Float32Array(n + 1); }
  let pp = rowC, prev = rowA, cur = rowB; const cost = m => (m === H ? .25 : 1);
  prev[0] = 0; for (let j = 1; j <= n; j++) prev[j] = prev[j - 1] + cost(t[from + j - 1]);
  for (let i = 1; i <= q.length; i++) { const qi = q[i - 1];
    cur[0] = prev[0] + cost(qi); let best = cur[0];
    for (let j = 1; j <= n; j++) { const tj = t[from + j - 1];
      let v = prev[j - 1] + ((qi & tj) ? 0 : 1);
      const del = prev[j] + cost(qi); if (del < v) v = del;
      const ins = cur[j - 1] + cost(tj); if (ins < v) v = ins;
      if (i > 1 && j > 1 && (qi & t[from + j - 2]) && (q[i - 2] & tj)) { const tr = pp[j - 2] + .8; if (tr < v) v = tr; }
      cur[j] = v; if (v < best) best = v; }
    if (best > 4) return Infinity;   // لا أمل بعد هذا الحد
    const x = pp; pp = prev; prev = cur; cur = x; }
  let m = Infinity; for (let j = 0; j <= n; j++) if (prev[j] < m) m = prev[j];
  return m;
}

// ---------- تجهيز الأسماء مرة واحدة: كل عنصر { id, names: [...], v: شهرته 0–100 (اختياري), y: سنته, ... }
export function prepare(items, namesOf = x => x.names) {
  return items.map(it => ({ it, names: [...new Set(namesOf(it).filter(Boolean))].map(s => { const f = fold(s), ws = words(f); return { s, f, ws, j: ws.join(' '), nums: ws.filter(w => /^\d+$/.test(w)), ...sound(ws) }; }) }));
}
// تجهيز المكتوب: السنة (إن كتبها) تُفصل وتُستخدم للترجيح، والأرقام الأخرى (2، III) تُطابق حرفياً
function query(raw) {
  const f = fold(raw), all = words(f), now = new Date().getFullYear();
  const yi = all.length > 1 ? all.findIndex(w => /^\d{4}$/.test(w) && +w >= 1900 && +w <= now + 3) : -1;
  const year = yi >= 0 ? +all[yi] : null, ws = all.filter((_, i) => i !== yi);
  return { raw, f: ws.join(' '), ws, year, nums: ws.filter(w => /^\d+$/.test(w)), ar: isAr(f), ...sound(ws) };
}
// مدى التسامح بحسب طول المكتوب: ثلاثة أصوات فأقل بلا خطأ، ثم خطأ لكل ثلاثة أصوات تقريباً (و0.3 لـh الساقطة كما في John)
const allowed = n => (n <= 3 ? 0 : n <= 5 ? 1 : n <= 8 ? 2 : 3) + .3;

function scoreName(q, nm, hear) {
  // حرفياً أولاً: مطابق، أو يبدأ به، أو كل كلماته بدايات كلمات الاسم بالترتيب، أو جزء منه
  if (nm.j === q.f) return { s: 100, how: 'exact' };
  if (nm.j.startsWith(q.f) || nm.f.startsWith(q.f)) return { s: 92 - Math.min(8, (nm.j.length - q.f.length) / 6), how: 'prefix' };
  let k = 0; for (const w of nm.ws) if (k < q.ws.length && w.startsWith(q.ws[k])) k++;
  if (k === q.ws.length) return { s: 86, how: 'words' };
  if (q.f.length >= 3 && nm.f.includes(q.f)) return { s: 74, how: 'part' };
  // بالصوت: من بداية الاسم، أو من بداية إحدى كلماته (بخصم صغير)
  const n = q.sym.length; if (!hear || n < 2) return null;
  // صوتان فقط (ديون = Dune) لا يكفيان إلا لاسم قصير مثلهما، وإلا طابقا مئات الأسماء
  if (n === 2 && (nm.sym.length > 3 || prefixDistance(q.sym, nm.sym, 0) > .3)) return null;
  const cap = allowed(n); let best = Infinity, at = 0;
  for (const st of nm.starts) { const d = prefixDistance(q.sym, nm.sym, st) + (st ? .5 : 0); if (d < best) { best = d; at = st; } if (!best) break; }
  if (best > cap) return null;
  // ما زاد من الاسم بعد ما كُتب لا يُحسب خطأً (فالكتابة ناقصة غالباً)، لكن المطابقة الكاملة أرجح قليلاً
  return { s: 70 - best * 14 - (at ? 4 : 0) + (n >= nm.sym.length - 1 ? 3 : 0), how: 'sound', d: best };
}

// يعيد أفضل النتائج مرتبة. meant: أول نتيجة إن جاءت بالصوت لا بالحرف (فنقول «هل تقصد…؟»)
export function find(prepared, raw, { limit = 8, min = 40, spread = 12 } = {}) {
  const q = query(raw); if (!q.ws.length || (q.f.length < 2 && !q.nums.length)) return { q, hits: [], meant: null };
  const first = q.sym[0], hits = [];
  for (const e of prepared) {
    let top = null, name = null;
    for (const nm of e.names) {
      // تصفية سريعة للمقارنة بالصوت: أول صوت مكتوب يوافق أول صوتين من الاسم أو من إحدى كلماته
      const hear = !!first && nm.starts.some(st => (nm.sym[st] & first) || (nm.sym[st + 1] & first));
      const r = scoreName(q, nm, hear);
      if (r && (!top || r.s > top.s)) { top = r; name = nm; }
    }
    if (!top) continue;
    let s = top.s + (e.it.v || 0) / 9;
    if (q.year && e.it.y) s += e.it.y === q.year ? 9 : Math.abs(e.it.y - q.year) === 1 ? 3 : -12;
    if (q.nums.length) s += q.nums.every(d => name.nums.includes(d)) ? 7 : -8;
    if (s >= min) hits.push({ ...e.it, score: Math.round(s * 10) / 10, how: top.how, d: top.d ?? 0, name: name.s });
  }
  hits.sort((a, b) => b.score - a.score);
  // ما طابق حرفياً، أو طابق بالصوت بلا خطأ (John Wick: Chapter 2 لـ«جون ويك»)، يبقى؛ أما ما احتاج تصحيحاً ويبعد عن
  // أفضل نتيجة فتشويش (Winter's Tale لـintersteller، وBen-Hur لـ«اوبنهايمر»)
  const best = hits[0]?.score ?? 0, top = hits.filter(h => h.how !== 'sound' || h.d <= .3 || h.score >= best - spread).slice(0, limit), m = top[0];
  return { q, hits: top, meant: m && m.how === 'sound' ? m : null };
}
