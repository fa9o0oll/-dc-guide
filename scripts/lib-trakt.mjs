// المسلسلات ↔ Trakt (E87): حلقات المسلسلات في دليلَي DC ومارفل، ومسلسلات «قائمة أفلامي»، تتزامن بالاتجاهين مع حسابك في Trakt.
// - المحور series (في مخزن accounts نفسه): لكل مسلسل برقمه في TMDB حلقاته، لكل حلقة «الموسم-الحلقة» آخر حالها [1 شوهدت أو 0 أُزيلت، متى، من أين، rev]،
//   وقائمة المشاهدة l بالصيغة نفسها. كل حلقة تُحسم وحدها بالأحدث، فلا تمحو حلقةٌ عُلّمت هنا حلقةً عُلّمت هناك في الوقت نفسه.
// - ظلّ Trakt (sh): ما نعرف أنه فيه. السحب يقارن به: حلقة جديدة هناك تدخل المحور بوقت مشاهدتها، وحلقة غابت (من سحب كامل) أُزيلت هناك،
//   ولا تُنقل إزالة من أكثر من ثلاثة مسلسلات في مرة (غياب كثير دفعة واحدة خلل لا قرار منك). والدفع يرسل ما يخالف فيه المحورُ الظلَّ.
// - ما أُرسل ولم يظهر في Trakt بعد ربع ساعة لا يعرفه Trakt (ترقيم مختلف، أو حلقة خاصة لا يعيدها): يُترك فلا يُعاد كل مرة، ولا يُحسب إزالةً منك.
// - أول مزامنة تجمع ولا تمحو: ما شوهد في أحدهما يصير مشاهَداً في الاثنين. وما يُرسل بلا وقت معروف يأخذ تاريخ عرض الحلقة (released).
// - «شاهدته» على مسلسل في قائمة أفلامي يُرسل حلقاته المعروضة التي لم تُشاهد في Trakt (فلا تتكرر مشاهدة مسجّلة)، و«سأشاهده» قائمة المشاهدة،
//   وإزالة «شاهدته» من القائمة لا تمحو سجل Trakt. وما يكتمل في Trakt يصير «شاهدته» في القائمة.
// - المحور لا يحمل إلا مسلسلات الموقع (known: أرقامها في كل بوابة)، فلا يُسحب من Trakt ما ليس هنا.
// - واجهة Trakt منذ يوليو 2026 (trakt-api #775 و#681): سجل المشاهدة وقائمة المشاهدة صفحات، والحلقات لا تأتي إلا مع extended=progress (100 في الصفحة).
//   والكتابة طلب في الثانية على الأكثر.
// - الربط (developer.trakt.tv/docs/pkce): تطبيقنا watch-guide-sync من نوع PKCE بلا رمز سري. الموافقة في auth.trakt.tv ثم الرجوع إلى
//   /api/accounts/callback/trakt (كما سُجّل في التطبيق حرفاً بحرف)، والرمز يُبدَّل بالمتحقق S256 بلا سر. والرمز يعيش 7 أيام، ورمز التجديد لمرة واحدة:
//   كل تجديد يعطي زوجاً جديداً يُحفظ في الحال.
import { createHash } from 'node:crypto';
const API = 'https://api.trakt.tv', AUTH = 'https://auth.trakt.tv', UA = 'watch-guide/1.0', T = 9000;
const now = () => Date.now(), J = x => JSON.stringify(x), sleep = ms => new Promise(r => setTimeout(r, ms)), GAP = () => +process.env.TRAKT_GAP_MS || 1100;   // بين طلبات الكتابة (الاختبار يقصّرها)
const fail = (code, msg) => Object.assign(new Error(msg || code), { code });
// رقم التطبيق يلصقه صاحب الموقع في Netlify (TRAKT_CLIENT_ID)، ولا يُكتب في ملف. ولا رمز سرياً لتطبيق PKCE
export const traktId = () => process.env.TRAKT_CLIENT_ID || '';
export const traktRedirect = () => (process.env.URL || 'https://soft-gingersnap-fb1f77.netlify.app').replace(/\/$/, '') + '/api/accounts/callback/trakt';
const keep = (j, old) => ({ access: j.access_token, refresh: j.refresh_token || old?.refresh || null, exp: now() + (+j.expires_in || 7 * 86400) * 1000, scope: j.scope || '', at: old?.at || now() });
const s256 = v => createHash('sha256').update(v).digest('base64url');

async function call(path, { method = 'GET', body, tok, base = API } = {}) { let r;
  try { r = await fetch(base + path, { method, body: body ? J(body) : undefined, signal: AbortSignal.timeout(T),
    headers: { 'content-type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': traktId(), 'user-agent': UA, ...(tok ? { authorization: 'Bearer ' + tok.access } : {}) } }); }
  catch { throw fail('net', 'تعذّر الاتصال بـTrakt'); }
  const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  return { ok: r.ok, status: r.status, j, pages: +(r.headers.get('x-pagination-page-count') || 0) }; }
// كل الصفحات: تتوقف عند آخر صفحة يقولها Trakt، أو عند صفحة فارغة (وقد يطبّق حداً أصغر مما طُلب). until: وقت يتوقف عنده فيعود ناقصاً
async function paged(path, tok, limit, until = 0) { const list = [];
  for (let page = 1; page <= 80; page++) { if (until && now() > until) return { list, complete: false };
    const { ok, status, j, pages } = await call(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=${limit}`, { tok });
    if (status === 401) throw fail('auth', 'انتهى الربط'); if (!ok) throw fail('svc', 'Trakt ' + status);
    const a = Array.isArray(j) ? j : []; list.push(...a); if (!a.length || (pages && page >= pages)) return { list, complete: true }; }
  return { list, complete: false }; }

// سجل المشاهدة بصيغتيه (الصيغة القديمة، وextended=progress: كل حلقة معروضة وcompleted). يعيد { رقم TMDB: { e: { 'م-ح': وقت }, u: [معروضة لم تُشاهد], n: عدد المعروض } }
export function parseWatched(list) { const items = {};
  for (const it of list || []) { const show = it.show || it, id = +show?.ids?.tmdb; if (!id) continue; const e = {}, u = [], t0 = Date.parse(it.last_watched_at) || 1;
    for (const s of it.seasons || []) for (const ep of s.episodes || []) { const sn = +s.number, en = +ep.number; if (!Number.isInteger(sn) || !Number.isInteger(en)) continue;
      const seen = ep.completed === true || (ep.completed === undefined && (+ep.plays > 0 || !!ep.last_watched_at));
      if (seen) e[`${sn}-${en}`] = Date.parse(ep.last_watched_at) || t0; else if (ep.completed === false) u.push(`${sn}-${en}`); }
    items[id] = { e, u, n: +(show.aired_episodes ?? it.aired_episodes ?? 0) || 0 }; }
  return items; }

export const TRAKT = { name: 'Trakt', kind: 'code', ready: () => !!traktId(),
  authUrl: (p, redirect) => `${AUTH}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: traktId(), redirect_uri: redirect, state: p.state, code_challenge: s256(p.verifier), code_challenge_method: 'S256' })}`,
  async exchange(code, p, redirect) { const { ok, j } = await call('/oauth/token', { base: AUTH, method: 'POST', body: { code, client_id: traktId(), redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: p.verifier } });
    if (!ok || !j?.access_token) throw fail('auth', j?.error_description || j?.error || 'Trakt رفض الربط'); return keep(j); },
  // رمز التجديد لمرة واحدة: رفضه (400 أو 401) انتهاء ربط، وغيره عطل عابر يُعاد بعده
  async refresh(t) { const { ok, status, j } = await call('/oauth/token', { base: AUTH, method: 'POST', body: { refresh_token: t.refresh, client_id: traktId(), redirect_uri: traktRedirect(), grant_type: 'refresh_token' } });
    if (ok && j?.access_token) return keep(j, t); throw fail(status === 400 || status === 401 ? 'auth' : 'net', 'Trakt ' + status); },
  // last_activities أولاً: إن لم يتغير شيء منذ آخر سحب فلا يُطلب السجل كله
  async pull(tok, mark, until = 0) { const a = await call('/sync/last_activities', { tok }); if (a.status === 401) throw fail('auth', 'انتهى الربط'); if (!a.ok) throw fail('svc', 'Trakt ' + a.status);
    const m = String(a.j?.all || ''); if (m && m === mark) return { same: true };
    const w = await paged('/sync/watched/shows?extended=progress', tok, 100, until), l = await paged('/sync/watchlist/shows', tok, 250, until), items = parseWatched(w.list);
    for (const x of l.list) { const id = +x.show?.ids?.tmdb; if (id) (items[id] ||= { e: {}, u: [], n: 0 }).l = Date.parse(x.listed_at) || 1; }
    return { items, complete: w.complete && l.complete, mark: w.complete && l.complete ? m : '' }; },
  // ops: [[المسار، الجسم، الوسم]]. يعيد ما تمّ [{ tag, nf }] (nf: ما لم يعرفه Trakt)، ويتوقف عند deadline
  async push(tok, ops, deadline = 0) { const done = [];
    for (const [path, body, tag] of ops) { if (deadline && now() > deadline) break; if (done.length) await sleep(GAP());
      const { ok, status, j } = await call(path, { method: 'POST', body, tok });
      if (status === 401 || status === 403) throw Object.assign(fail('auth', 'لم يقبل الكتابة بهذا الربط'), { done });
      if (status === 429) break; if (!ok) throw Object.assign(fail('svc', 'Trakt ' + status), { done });
      done.push({ tag, nf: j?.not_found || {} }); }
    return done; } };

// ---------- المحور
// sh: ظل Trakt، وshOk: سُحب منه سحب كامل مرة (قبله لا يُرسل شيء: سحب ناقص قد يوهم أن حلقات مشاهدة هناك ليست فيه، فتتكرر مشاهدتها)
export const seriesBlank = () => ({ rev: 0, items: {}, sh: null, shOk: 0, pend: {}, nf: {}, pa: {}, known: {}, kb: {}, boot: {}, mark: '', err: '', at: 0 });
// f: «م-ح» أو l. الأحدث يغلب، وما لم يُعرف لا يُزال
export function sPut(st, id, f, v, t, src) { const it = st.items[id] ||= { e: {} }, cur = f === 'l' ? it.l : it.e[f];
  if (cur && cur[1] > t) return false; if (cur && cur[0] === v) { if (t > cur[1]) cur[1] = t; return false; }
  if (!cur && !v) return false; const x = [v, t, src, ++st.rev]; if (f === 'l') it.l = x; else it.e[f] = x; return true; }
const EP = /^\d+-\d+$/;
// سجل البوابة كله أول مرة: دليلا DC ومارفل { tvرقم: { e: [حلقات]، l } }، وقائمة أفلامي { tرقم: watched أو next }. يجمع ولا يمحو
export function bootFrom(st, g, full) { for (const [k, v] of Object.entries(full || {})) { let m = /^tv(\d+)$/.exec(k);
    if (m && v && typeof v === 'object') { for (const ep of v.e || []) if (EP.test(ep)) sPut(st, m[1], ep, 1, 0, g); if (v.l) sPut(st, m[1], 'l', 1, 0, g); continue; }
    if ((m = /^t(\d+)$/.exec(k))) { if (v === 'watched') st.pa[m[1]] ||= 1; else if (v === 'next') sPut(st, m[1], 'l', 1, 0, g); } } }
// تعديل من الصفحة: tvرقم|م-ح أو tvرقم|l مع on، أو tرقم مع s (قائمة أفلامي)
export function applyEdit(st, g, e) { const k = String(e?.id || ''), t = +e?.t || now(); let m;
  if ((m = /^tv(\d+)\|(\d+-\d+|l)$/.exec(k))) return sPut(st, m[1], m[2], e.on ? 1 : 0, t, g);
  if ((m = /^t(\d+)$/.exec(k))) { if (e.s === 'watched') st.pa[m[1]] = t; else delete st.pa[m[1]]; sPut(st, m[1], 'l', e.s === 'next' ? 1 : 0, t, g); } }
const knownAll = st => new Set(Object.values(st.known).flat().map(String));
// السحب الناقص (انتهى وقته) يُدخل ما وصل من إضافات وحدها: لا إزالة، ولا حكم على مسلسل لم يصل
// ومسلسل لم يدخل الظل بعد (أول مزامنة له) يجمع ولا يمحو: ما شوهد في Trakt يصير مشاهَداً ولو أُزيلت علامته هنا قبل الربط
export function sMerge(st, R) { const K = knownAll(st), sh = st.sh ||= { e: {}, l: {} }, gone = [], t1 = now();
  for (const id of K) { const r = R.items[id]; if (!r && !R.complete) continue; const first = !sh.e[id], re = r?.e || {}, se = sh.e[id] ||= {};
    if (r) { const it = st.items[id] ||= { e: {} }; it.n = r.n || it.n || 0; it.u = r.u || []; } else if (st.items[id]) delete st.items[id].u;   // لا سجل له في Trakt: يُرسل كاملاً
    for (const [k, t] of Object.entries(re)) { delete st.pend[id + '|' + k]; delete st.nf[id + '|' + k]; if (se[k]) continue; se[k] = 1;
      const cur = st.items[id]?.e?.[k]; sPut(st, id, k, 1, first && cur && !cur[0] ? cur[1] + 1 : t, 'trakt'); }
    for (const k of Object.keys(se)) if (!re[k]) gone.push([id, k]);
    if (r?.l && !sh.l[id]) { sh.l[id] = 1; const cur = st.items[id]?.l; sPut(st, id, 'l', 1, first && cur && !cur[0] ? cur[1] + 1 : r.l, 'trakt'); }
    else if (!r?.l && sh.l[id]) gone.push([id, 'l']); }
  // ما أُرسل ولم يظهر بعد ربع ساعة: لا يعرفه Trakt
  for (const [key, t] of Object.entries(st.pend)) { const [id, k] = key.split('|'); if (R.items[id]?.e?.[k]) delete st.pend[key]; else if (t1 - t > 15 * 60e3) { delete st.pend[key]; st.nf[key] = 1; } }
  const shows = new Set(gone.map(([id]) => id)), total = Object.values(sh.e).filter(o => Object.keys(o).length).length;
  if (R.complete && Object.keys(R.items).length && shows.size <= Math.min(3, Math.max(1, Math.floor(total / 10))))
    for (const [id, k] of gone) { if (k === 'l') delete sh.l[id]; else delete sh.e[id][k]; sPut(st, id, k, 0, t1, 'trakt'); }
  if (R.complete) st.shOk = 1; }
// ما يُرسل إلى Trakt: ما يخالف فيه المحورُ الظلَّ، وطلبات «شاهدته» من قائمة أفلامي. cap: أكثر الحلقات في المرة
export function sOps(st, cap = 500) { const sh = st.sh, add = new Map(), rem = new Map(), plan = { add: [], rem: [], wa: [], wr: [], all: [], part: [] }, A = (m, id) => m.get(id) || m.set(id, []).get(id);
  const watchedHere = (id, se) => Object.keys(se).filter(k => !k.startsWith('0-')).length;
  // مسلسل لا يُعرف حاله في Trakt بعد (لم يدخل الظل من سحب) لا يُرسل له شيء، فلا تتكرر مشاهدة مسجّلة هناك
  for (const id of Object.keys(st.pa)) { const it = st.items[id], se = sh.e[id]; if (!se) continue;
    if (it?.n && watchedHere(id, se) >= it.n) { delete st.pa[id]; continue; }   // مكتمل في Trakt أصلاً
    if (it?.u?.length) { for (const k of it.u) if (!se[k] && !st.pend[id + '|' + k] && !st.nf[id + '|' + k]) { A(add, id).push([k, 1]); plan.add.push([id, k]); } plan.part.push(id); }
    else if (!st.nf[id + '|all']) plan.all.push(id); else delete st.pa[id]; }
  const whole = new Set(plan.all); let n = 0;
  for (const [id, it] of Object.entries(st.items)) { const se = sh.e[id]; if (!se) continue;
    for (const [k, v] of Object.entries(it.e)) { const key = id + '|' + k; if (n >= cap || st.nf[key] || st.pend[key]) continue;
      if (v[0] && !se[k] && !whole.has(id) && !plan.add.some(([a, b]) => a === id && b === k)) { A(add, id).push([k, v[1]]); plan.add.push([id, k]); n++; }
      else if (!v[0] && se[k]) { A(rem, id).push([k]); plan.rem.push([id, k]); n++; } }
    if (it.l && !st.nf[id + '|l']) { if (it.l[0] && !sh.l[id]) plan.wa.push(id); else if (!it.l[0] && sh.l[id]) plan.wr.push(id); } }
  const seasons = eps => { const by = new Map(); for (const [k, t] of eps) { const [s, e] = k.split('-').map(Number); A(by, s).push(t === undefined ? { number: e } : { number: e, watched_at: t > 1e12 ? new Date(t).toISOString() : 'released' }); }
    return [...by].sort((a, b) => a[0] - b[0]).map(([number, episodes]) => ({ number, episodes })); };
  const ids = id => ({ ids: { tmdb: +id } }), ops = [];
  if (add.size || plan.all.length) ops.push(['/sync/history', { shows: [...[...add].map(([id, eps]) => ({ ...ids(id), seasons: seasons(eps) })), ...plan.all.map(id => ({ ...ids(id), watched_at: 'released' }))] }, 'add']);
  if (rem.size) ops.push(['/sync/history/remove', { shows: [...rem].map(([id, eps]) => ({ ...ids(id), seasons: seasons(eps) })) }, 'rem']);
  if (plan.wa.length) ops.push(['/sync/watchlist', { shows: plan.wa.map(ids) }, 'wa']);
  if (plan.wr.length) ops.push(['/sync/watchlist/remove', { shows: plan.wr.map(ids) }, 'wr']);
  return { ops, plan }; }
// بعد الإرسال: ما أُضيف ينتظر ظهوره في السحب القادم (pend)، وما لم يعرفه Trakt يُترك (nf)
export function sDone(st, plan, done) { const t1 = now();
  for (const { tag, nf } of done) { const no = new Set((nf?.shows || []).map(x => String(x?.ids?.tmdb || '')));
    if (tag === 'add') { for (const [id, k] of plan.add) { if (no.has(id)) st.nf[id + '|' + k] = 1; else st.pend[id + '|' + k] = t1; }
      for (const id of [...plan.all, ...plan.part]) { delete st.pa[id]; if (no.has(id)) st.nf[id + '|all'] = 1; } }
    if (tag === 'rem') for (const [id, k] of plan.rem) delete st.sh.e[id]?.[k];
    if (tag === 'wa') for (const id of plan.wa) { if (no.has(id)) st.nf[id + '|l'] = 1; else st.sh.l[id] = 1; }
    if (tag === 'wr') for (const id of plan.wr) delete st.sh.l[id]; } }
// «أكملته»: حلقاته المعروضة كلها (بلا الخاصة) مشاهَدة
const isDone = it => !!it?.n && Object.entries(it.e).filter(([k, v]) => v[0] && !k.startsWith('0-')).length >= it.n;
// ما تغيّر لبوابة بعد since من غيرها: { id، e: حلقات شوهدت، x: حلقات أُزيلت، l، done }. قائمة أفلامي بمفاتيحها (tرقم)
export function sChanges(st, g, since) { const K = new Set((st.known[g] || []).map(String)), out = [];
  for (const [id, it] of Object.entries(st.items)) { if (!K.has(id)) continue; const e = [], x = []; let l = null, any = false;
    for (const [k, v] of Object.entries(it.e)) if (v[3] > since && v[2] !== g) { (v[0] ? e : x).push(k); any = true; }
    if (it.l && it.l[3] > since && it.l[2] !== g) { l = it.l[0]; any = true; }
    if (any) out.push({ id: g === 'films' ? 't' + id : +id, e, x, l, done: isDone(it) }); }
  return out; }

// tok: { get() الرمز بعد تجديده إن لزم، kill(t) انتهى الربط }. guide: dc أو marvel أو films، أو لا شيء (المزامنة الدورية)
export async function syncSeries(S, tok, { guide = '', edits = [], full = null, known = null, build = '', since = 0, pull = true, deadline = 0 } = {}) {
  const st = Object.assign(seriesBlank(), await S.get('series') || {}), g = guide;
  // مسلسلات جديدة على المحور تُسحب حالها من Trakt قبل أي إرسال (السحب لا يكتفي بأن Trakt لم يتغير)
  if (g) { if (Array.isArray(known)) { const was = new Set(st.known[g] || []), now_ = [...new Set(known.map(Number).filter(n => n > 0))]; if (now_.some(n => !was.has(n))) st.mark = ''; st.known[g] = now_; st.kb[g] = build; }
    // سجل كل جهاز يُجمع مرة لكل ربط (الصفحة ترسله): بوقت صفر لا يغلب تعديلاً صريحاً بعده، فلا ضرر من تكراره، ولا يضيع ما في جهاز لم يكن أول من زامن
    if (full) { bootFrom(st, g, full); st.boot[g] ||= now(); }
    for (const e of edits) applyEdit(st, g, e); }
  const t = await tok.get(); if (!g && !t) return { rev: st.rev, changes: [] };   // المزامنة الدورية وTrakt غير مربوط: لا شيء يُكتب
  if (t?.dead) st.err = 'auth';
  else if (t) { try { if ((pull || !st.sh) && knownAll(st).size) { const R = await TRAKT.pull(t, st.sh ? st.mark : '', deadline ? deadline - 2500 : 0); if (!R.same) { sMerge(st, R); st.mark = R.mark; } }
      if (st.shOk) { const { ops, plan } = sOps(st); if (ops.length) { let done; try { done = await TRAKT.push(t, ops, deadline); } catch (e) { sDone(st, plan, e.done || []); throw e; } sDone(st, plan, done); } }
      st.err = ''; st.at = now(); }
    catch (e) { const dead = e.code === 'auth' && t.exp > now();   // رمز انتهى وقته وتعذّر تجديده الآن: عطل عابر لا انتهاء ربط
      st.err = dead ? 'auth' : e.code === 'auth' || e.code === 'net' ? 'net' : String(e.message || 'خطأ').slice(0, 120); if (dead) await tok.kill(t); } }
  await S.set('series', st);
  return { rev: st.rev, changes: g ? sChanges(st, g, +since || 0) : [], needAll: !!g && !st.boot[g], needKnown: !!g && st.kb[g] !== build }; }
