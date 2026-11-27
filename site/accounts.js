// ربط الحسابات من الصفحة (E84): الخادم (/api/accounts) يحمل رموز MyAnimeList وSIMKL ويزامن بالاتجاهين، والصفحة ترسل إليه
// تعديلاتك وتطبّق ما يصلها منه. تُربط الحسابات مرة واحدة من أي جهاز، وتعمل في كل الأجهزة، ولا رمز في المتصفح.
// - تعديلاتك تنتظر في هذا المتصفح (accounts.q) حتى تصل الخادم، فلا يضيع تعديل بلا اتصال. وما يصل من الخادم يُطبَّق ولا يُعاد إرساله.
// - المزامنة: حين تُفتح الصفحة، وبعد ثوانٍ من آخر تعديل، وكل عشر دقائق والصفحة ظاهرة، وحين يعود الاتصال أو تعود إلى الصفحة.
//   ولا شيء من هذا قبل أن يُربط حساب: الصفحة لا تطلب الخادم وأنت لم تربط شيئاً.
// - كلمة السر نفسها التي تحفظها «أضف أنمي» أو «أضف فيلماً» أو «أضف لعبة» في هذا المتصفح، فلا تُطلب إلا إن لم تُحفظ.
const API = '/api/accounts', Q = 'accounts.q', REV = 'accounts.rev', ON = 'accounts.on', PASSES = ['animeg.pass', 'filmsg.pass', 'gamesg.pass'];
const WAIT = 2500, WAIT_GONE = 8000, EVERY = 10 * 60e3;
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const jget = (k, d) => { try { return JSON.parse(ls.get(k)) ?? d; } catch { return d; } };
let cx = null, timer = 0, busy = false, again = false, last = 0;
const saved = jget(ON, null), state = { links: saved?.links || null, err: '', pass: false, busy: false };
export const accPass = () => { for (const k of PASSES) { const v = ls.get(k); if (v) return v; } return ''; };
export const accSetPass = pw => { ls.set('animeg.pass', pw); state.pass = false; };
export const accState = () => ({ ...state, pending: Object.keys(jget(Q, {})[cx?.guide] || {}).length });
const anyOn = () => !!state.links && Object.values(state.links).some(l => l.on || l.dead);
const tell = () => cx?.onState?.(accState());
async function call(path, body) { const pass = accPass(); if (!pass) { state.pass = true; tell(); throw Object.assign(new Error('اكتب كلمة سر الموقع أولاً.'), { pass: true }); }
  let r; try { r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { 'x-pass': pass, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error('تعذّر الاتصال بالخادم.'), { net: true }); }
  let j = {}; try { j = await r.json(); } catch {}
  if (r.status === 401 && j.pass) { state.pass = true; tell(); throw Object.assign(new Error(j.error || 'كلمة السر غير صحيحة.'), { pass: true }); }
  if (!r.ok && r.status !== 202) throw new Error(j.error || 'تعذّر الطلب.'); return { status: r.status, j }; }
const keepLinks = links => { if (!links) return; state.links = links; ls.set(ON, JSON.stringify({ links, at: Date.now() })); };

// guide: اسم البوابة. full(): سجلها كله { رقم: { s, p, r } }. eps(): عدد حلقات كل عمل (والفيلم -1). apply(changes): تطبيق ما وصل. onState(st)
export function accInit(o) { cx = o;
  addEventListener('online', () => accSync()); document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 2 * 60e3) accSync(); });
  setInterval(() => { if (!document.hidden) accSync(); }, EVERY);
  // العودة من صفحة موافقة MyAnimeList (?linked=mal): يُنظَّف الرابط، وتُخبَر الصفحة بعد أن تُتم فتح نفسها
  const q = new URLSearchParams(location.search); if (q.get('linked')) { history.replaceState(history.state, '', location.pathname + location.hash); setTimeout(() => cx.onLinked?.(q.get('linked'), q.get('fail') || ''), 0); }
  // جهاز لم يعرف بعد هل رُبط حساب (أو مضى على ما يعرفه نصف يوم) يسأل الخادم مرة، إن كانت كلمة السر محفوظة فيه
  setTimeout(async () => { if (accPass() && (!saved || Date.now() - (saved.at || 0) > 12 * 3600e3 || q.get('linked'))) await accLinks(); accSync(); }, q.get('linked') ? 300 : 1500); }
// تعديل منك على عمل: حاله بعد التعديل (أو لا شيء إن أزلته)
export function accMark(id, m) { if (!cx || !anyOn()) return; const all = jget(Q, {}), q = all[cx.guide] ||= {};
  q[id] = { s: m?.s || null, p: +m?.p || 0, r: +m?.r || 0, t: Date.now() }; ls.set(Q, JSON.stringify(all));
  clearTimeout(timer); timer = setTimeout(() => accSync(), Object.values(q).some(e => !e.s) ? WAIT_GONE : WAIT); tell(); }
export async function accSync({ force = false } = {}) { if (!cx || (!anyOn() && !force)) return; if (busy) { again = true; return; } busy = state.busy = true; clearTimeout(timer);
  try { for (let i = 0; i < 4; i++) { const all = jget(Q, {}), q = all[cx.guide] || {}, edits = Object.entries(q).map(([id, e]) => ({ id: +id, ...e })), t0 = Date.now();
      const rev = jget(REV, {})[cx.guide] || 0, body = { edits, since: rev, build: cx.build };
      let { status, j } = await call('/sync', body);
      if (status === 202) { await new Promise(r => setTimeout(r, 4000)); continue; }
      // أول مزامنة تبدأ من سجلّك كله، فلا تبدأ إلا من جهاز فيه سجلّ: جهاز فارغ لا يجعل الخادم يظن سجلّك فارغاً
      if (j.needFull && !Object.keys(cx.full()).length) { state.err = 'سجلّك فارغ في هذا المتصفح: تبدأ المزامنة حين تفتح الموقع من جهاز فيه سجلّك.'; break; }
      if (j.needFull || j.needEps) { ({ status, j } = await call('/sync', { ...body, full: j.needFull ? cx.full() : null, eps: cx.eps() })); if (status === 202) { await new Promise(r => setTimeout(r, 4000)); continue; } }
      keepLinks(j.links); const now = jget(Q, {}), mine = now[cx.guide] || {}; for (const e of edits) if (mine[e.id] && mine[e.id].t <= t0) delete mine[e.id]; ls.set(Q, JSON.stringify(now));
      if (j.changes?.length) cx.apply(j.changes); const revs = jget(REV, {}); revs[cx.guide] = j.rev || rev; ls.set(REV, JSON.stringify(revs)); state.err = ''; last = Date.now(); break; } }
  catch (e) { state.err = e.pass ? '' : e.message; }
  finally { busy = state.busy = false; tell(); if (again) { again = false; accSync(); } } }
export async function accLinks() { try { const { j } = await call(''); keepLinks(j.links); state.err = ''; } catch (e) { state.err = e.pass ? '' : e.message; } tell(); return state.links; }
// الربط: MyAnimeList ينتقل إلى صفحة موافقته ثم يعود إلى هنا، وSIMKL يعطي رمزاً تُوافق عليه في صفحته وتنتظره الصفحة
export async function accLink(svc) { const { j } = await call('/link', { svc }); if (j.url && !j.code) { location.href = j.url; return { away: true }; } return j; }
export async function accPoll(svc) { const { j } = await call('/poll', { svc }); if (j.done) { await accLinks(); accSync({ force: true }); } return j; }
export async function accUnlink(svc) { const { j } = await call('/unlink', { svc }); keepLinks(j.links); tell(); return j; }
