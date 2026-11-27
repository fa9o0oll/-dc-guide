// صندوق الصادر لـ«أنمياتي» (E84): ما تعدّله هنا يصل حساباتك المربوطة التي سمحت بالكتابة، الآن SIMKL، وMyAnimeList حين يُربط.
// - يُرسل تعديلك نفسه لا السجل كله: لكل عمل في الصندوق حاله قبل أول تعديل لم يُرسل، ويُرسل الفرق بينها وبين حاله الآن.
//   فـ«+» على عمل يعلّم الحلقة التي أضفتها وحدها، ولا يمحو هناك حلقات شاهدتها في تطبيق آخر ولم تصل هنا،
//   ولا تُزال حلقة هناك إلا إن أنقصتها أنت هنا. وتعديل ثم تراجع عنه قبل الإرسال لا يُرسل شيئاً.
// - الإرسال بعد ثوانٍ من آخر تعديل، فلمسات «+» المتتابعة طلب واحد. وما يصل من جهاز آخر لا يُرسل من هنا (أرسله جهازه)،
//   ولا ما دخل باستيراد ملف أو سحب.
// - ما تعذّر لانقطاع الاتصال يبقى ويُعاد حين يعود الاتصال أو تُفتح الصفحة، وما رُفض لانتهاء الربط ينتظر إعادة الربط.
// - الصندوق في هذا المتصفح وحده (animeg.out) كرمز الربط، ولا يُزامَن.
import { simklCanWrite, simklSend } from './anime-simkl.js?v=__BUILD__';

// إزالة عمل من قائمتك تُرسل بعد انقضاء مهلة «تراجع» (7 ثوانٍ)، لأنها تمحو هناك سجل مشاهدته بتواريخه ولا يعيدها التراجع
const KEY = 'animeg.out', WAIT = 2500, WAIT_GONE = 8000;
const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
let S = ls.get(KEY) || {}, cx = null, timer = 0, busy = false, again = false;
const box = k => { const b = S[k] ||= {}; b.q ||= {}; return b; };
const keep = () => ls.set(KEY, S);
const pick = m => m?.s ? { s: m.s, p: +m.p || 0, r: +m.r || 0 } : null;
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => ({ number: a + i }));

// SIMKL: الأنمي بصيغة المسلسلات (shows)، والحلقات في الموسم 1 بترقيم AniDB الافتراضي (api.simkl.org/api-reference/simkl/add-to-history).
// الترتيب: إزالة ما أُزيل، ثم الحلقات، ثم الحالة (فتعليم الحلقات قد ينقل العمل إلى «أشاهده»)، ثم التقييم
const TO = { plan: 'plantowatch', watching: 'watching', completed: 'completed', hold: 'hold', dropped: 'dropped' };
// [{ id, was, now, a }] ← طلبات SIMKL بترتيبها: [[المسار، الجسم]…]. was/now: { s, p, r } أو لا شيء، وa: العمل في الكتالوج (رقمه في SIMKL ونوعه)
export function simklOps(list) { const gone = [], add = [], unmark = [], to = {}, rate = [], unrate = [];
  for (const { id, was, now, a } of list) { const ids = { mal: id, ...(a?.sk ? { simkl: a.sk } : {}) };
    if (!now) { if (was) gone.push({ ids }); continue; }
    const movie = a?.type === 'Movie', p0 = was?.p || 0, p1 = now.p || 0;
    if (!movie && p1 > p0) add.push({ ids, seasons: [{ number: 1, episodes: range(p0 + 1, p1) }] });
    if (!movie && p1 < p0) unmark.push({ ids, seasons: [{ number: 1, episodes: range(p1 + 1, p0) }] });
    if (now.s !== was?.s && TO[now.s]) (to[TO[now.s]] ||= []).push({ ids });
    if ((now.r || 0) !== (was?.r || 0)) (now.r ? rate : unrate).push(now.r ? { ids, rating: now.r } : { ids }); }
  return [gone.length && ['/sync/history/remove', { shows: gone }], unmark.length && ['/sync/history/remove', { shows: unmark }], add.length && ['/sync/history', { shows: add }],
    ...Object.entries(to).map(([t, shows]) => ['/sync/add-to-list', { to: t, shows }]), rate.length && ['/sync/ratings', { shows: rate }], unrate.length && ['/sync/ratings/remove', { shows: unrate }]].filter(Boolean); }
const SVC = { simkl: { ready: simklCanWrite, async send(list) { for (const [path, body] of simklOps(list)) await simklSend(path, body); } } };

// get(id): سجل العمل الآن أو لا شيء. info(id): العمل في الكتالوج. onChange(): لتحديث ما يعرض الحال
export function outInit(o) { cx = o; addEventListener('online', () => outFlush());
  if (Object.keys(SVC).some(k => Object.keys(S[k]?.q || {}).length)) setTimeout(outFlush, 1500); }
// تعديل منك على عمل، وبيده حاله قبل التعديل: يدخل صندوق كل خدمة تسمح بالكتابة، أو سمحت بها وانتهى ربطها (فيُرسل حين يُعاد الربط).
// وما عُدّل قبل أول ربط بالكتابة لا يدخل: الربط نفسه يبدأ بسحب سجلّك من هناك ومقارنته
// وما كان في الصندوق ولم يُرسل يبقى على حاله الأولى
export function outMark(id, before) { let any = false;
  for (const [k, s] of Object.entries(SVC)) if (s.ready() || S[k]) { const q = box(k).q; if (!q[id]) q[id] = { from: pick(before) }; q[id].t = Date.now(); any = true; }
  if (!any) return; keep(); clearTimeout(timer); timer = setTimeout(outFlush, Object.values(S).some(b => Object.keys(b.q || {}).some(i => !cx?.get(+i)?.s)) ? WAIT_GONE : WAIT); cx?.onChange?.(); }
export async function outFlush() { if (!cx) return; if (busy) { again = true; return; } busy = true; clearTimeout(timer);
  try { for (const [k, s] of Object.entries(SVC)) { const b = box(k), ids = Object.keys(b.q); if (!ids.length || !s.ready()) continue; const t0 = Date.now();
      const all = ids.map(id => ({ id: +id, was: b.q[id].from, now: pick(cx.get(+id)), a: cx.info(+id) })), list = all.filter(x => !same(x.was, x.now));
      try { if (list.length) await s.send(list);
        for (const { id, now } of all) if (b.q[id].t <= t0) delete b.q[id]; else b.q[id].from = now;
        b.err = ''; b.at = Date.now(); }
      catch (e) { b.err = e.code === 'unauthorized' ? 'auth' : e.code === 'network' ? 'net' : String(e.message || 'خطأ'); }
      keep(); } }
  finally { busy = false; cx?.onChange?.(); if (again) { again = false; outFlush(); } } }
// حال خدمة للعرض: كم ينتظر، وآخر خطأ (net: انقطاع، auth: انتهى الربط أو لم يسمح بالكتابة، أو نص الخطأ)، ومتى نجح آخر إرسال
export const outState = k => { const b = S[k] || {}; return { pending: Object.keys(b.q || {}).length, err: b.err || '', at: b.at || 0 }; };
// ربط جديد يمسح الخطأ ويرسل ما ينتظر. وفصل الحساب يمحو صندوقه
export function outRelink(k) { const b = box(k); b.err = ''; keep(); if (Object.keys(b.q).length) outFlush(); }
export function outForget(k) { delete S[k]; keep(); }
