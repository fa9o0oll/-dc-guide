// خادم ربط الحسابات (E84): يربط «أنمياتي» بحسابَي MyAnimeList وSIMKL ربطاً واحداً يعمل من كل الأجهزة، ويزامن بالاتجاهين تلقائياً.
// - الرموز وحال المزامنة في Netlify Blobs (مخزن accounts) على الخادم وحده: لا تصل إلى المتصفح ولا إلى ملف ولا سجل.
// - «المحور» نسخة الخادم من سجل الأنمي: لكل عمل حالته وحلقاته وتقييمك { s, p, r }، ومتى تغيّر t ومن أين src (site أو mal أو simkl).
//   ولكل خدمة «ظلّها»: آخر ما نعرف أنها تحمله. السحب يقارن ما في الخدمة بظلها، فما اختلف تعديلٌ منك هناك يدخل المحور إن كان أحدث
//   مما فيه، والدفع يرسل إلى كل خدمة ما يخالف فيه المحورُ ظلَّها. فتعديل في MAL يصل SIMKL والموقع، وتعديل في الموقع يصل الاثنين.
// - أول مزامنة لخدمة تصالح بلا محو: لكل عمل يختلف يغلب الأبعد تقدّماً (كما في «اسحب سجلّي»)، وما في الخدمة وليس في سجلّك يدخله.
// - الإزالة لا تنتقل من خدمة إلا من سحب كامل، ولا أكثر من ثلاثة أعمال في مرة: غياب أعمال كثيرة دفعة واحدة خلل لا قرار منك.
// - ما يحتاجه الصفحة: ما تغيّر في المحور من الخدمات بعد رقم مراجعتها (rev)، فتطبّقه على سجلها وتزامنه مزامنتها المعتادة.
import { randomBytes } from 'node:crypto';
import { shapeSimkl } from '../site/anime-simkl.js';

export const SIMKL_ID = '6c4e4c56c81ae9e92bb2470d2d296d4db7413c112d0b2671927225e8a43a738e';   // عام بنص SIMKL (انظر site/anime-simkl.js)
// تطبيق watch-guide-sync في MyAnimeList (نوعه Other: بلا سر، فرقمه عام كرقم SIMKL)، ورابط رجوعه /api/accounts/callback/mal على موقع Netlify
export const MAL_ID = process.env.MAL_CLIENT_ID_SYNC || '403c3ea7cdcb21067ef1af69630599d4';
const SQ = `client_id=${SIMKL_ID}&app-name=my-watch-guide&app-version=1.0`;
const now = () => Date.now(), T = 9000;
const fail = (code, msg) => Object.assign(new Error(msg || code), { code });
const STATES = new Set(['watching', 'completed', 'hold', 'dropped', 'plan']);
export const val = x => x && STATES.has(x.s) ? { s: x.s, p: Math.max(0, Math.round(+x.p || 0)), r: Math.min(10, Math.max(0, Math.round(+x.r || 0))) } : null;
export const same = (a, b) => J(val(a)) === J(val(b));
const J = x => JSON.stringify(x);
// «الأبعد تقدّماً»: حلقات أكثر، أو الحلقات نفسها وقد أكمله هنا ولم يكمله هناك (والمتروك يبقى متروكاً)
export const ahead = (a, b) => (a.p || 0) > (b.p || 0) || ((a.p || 0) === (b.p || 0) && a.s === 'completed' && b.s !== 'completed' && b.s !== 'dropped');

async function req(url, init = {}) { let r;
  try { r = await fetch(url, { ...init, signal: AbortSignal.timeout(T) }); } catch { throw fail('net', 'تعذّر الاتصال'); }
  const text = await r.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text.slice(0, 160) }; }
  return { ok: r.ok, status: r.status, j }; }
const form = o => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const keep = (j, old) => ({ access: j.access_token, refresh: j.refresh_token || old?.refresh || null, exp: now() + (+j.expires_in || 3600) * 1000, scope: j.scope || old?.scope || '', at: old?.at || now() });
const why = j => j.message || j.error_description || j.error || j.raw || '';

// ---------- الخدمات: الربط والتجديد والسحب والدفع. السحب يعيد { items: { رقم MAL: { s, p, r, t } }, complete, mark }
const MAL_IN = { watching: 'watching', completed: 'completed', on_hold: 'hold', dropped: 'dropped', plan_to_watch: 'plan' };
const MAL_OUT = { watching: 'watching', completed: 'completed', hold: 'on_hold', dropped: 'dropped', plan: 'plan_to_watch' };
const SK_IN = { watching: 'watching', plantowatch: 'plan', hold: 'hold', completed: 'completed', dropped: 'dropped', notinteresting: 'dropped' };
const SK_OUT = { plan: 'plantowatch', watching: 'watching', completed: 'completed', hold: 'hold', dropped: 'dropped' };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => ({ number: a + i }));
// الأنمي بصيغة المسلسلات في SIMKL، والحلقات في الموسم 1 بترقيم AniDB. الترتيب: الإزالة، ثم الحلقات، ثم الحالة، ثم التقييم
export function simklOps(list) { const gone = [], add = [], unmark = [], to = {}, rate = [], unrate = [];
  for (const { id, from, to: now_, movie } of list) { const ids = { mal: +id };
    if (!now_) { if (from) gone.push({ ids }); continue; }
    const p0 = from?.p || 0, p1 = now_.p || 0;
    if (!movie && p1 > p0) add.push({ ids, seasons: [{ number: 1, episodes: range(p0 + 1, p1) }] });
    if (!movie && p1 < p0) unmark.push({ ids, seasons: [{ number: 1, episodes: range(p1 + 1, p0) }] });
    if (now_.s !== from?.s && SK_OUT[now_.s]) (to[SK_OUT[now_.s]] ||= []).push({ ids });
    if ((now_.r || 0) !== (from?.r || 0)) (now_.r ? rate : unrate).push(now_.r ? { ids, rating: now_.r } : { ids }); }
  return [gone.length && ['/sync/history/remove', { shows: gone }], unmark.length && ['/sync/history/remove', { shows: unmark }], add.length && ['/sync/history', { shows: add }],
    ...Object.entries(to).map(([t, shows]) => ['/sync/add-to-list', { to: t, shows }]), rate.length && ['/sync/ratings', { shows: rate }], unrate.length && ['/sync/ratings/remove', { shows: unrate }]].filter(Boolean); }

export const SVC = {
  mal: { name: 'MyAnimeList', kind: 'code',
    ready: () => !!MAL_ID,
    authUrl: (p, redirect) => `https://myanimelist.net/v1/oauth2/authorize?${new URLSearchParams({ response_type: 'code', client_id: MAL_ID, state: p.state, redirect_uri: redirect, code_challenge: p.verifier, code_challenge_method: 'plain' })}`,
    async exchange(code, p, redirect) { const { ok, j } = await req('https://myanimelist.net/v1/oauth2/token', form({ client_id: MAL_ID, grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: p.verifier }));
      if (!ok || !j.access_token) throw fail('auth', why(j) || 'MyAnimeList رفض الربط'); return keep(j); },
    async refresh(t) { const { ok, j } = await req('https://myanimelist.net/v1/oauth2/token', form({ client_id: MAL_ID, grant_type: 'refresh_token', refresh_token: t.refresh }));
      if (!ok || !j.access_token) throw fail('auth', why(j)); return keep(j, t); },
    async pull(t) { let url = 'https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status&limit=1000&nsfw=true'; const items = {};
      for (let n = 0; url && n < 20; n++) { const { ok, status, j } = await req(url, { headers: { Authorization: 'Bearer ' + t.access } });
        if (status === 401) throw fail('auth', 'انتهى الربط'); if (!ok) throw fail('svc', why(j) || 'MyAnimeList ' + status);
        for (const d of j.data || []) { const L = d.list_status || {}, s = MAL_IN[L.status]; if (s && d.node?.id) items[d.node.id] = { s, p: +L.num_episodes_watched || 0, r: +L.score || 0, t: Date.parse(L.updated_at) || 0 }; }
        url = j.paging?.next || null; }
      return { items, complete: !url }; },
    // كل عمل طلب واحد بقيمه كلها (لا فرق يُحسب): الحالة والحلقات والتقييم، أو حذفه من القائمة
    async push(t, list, deadline) { const done = [];
      for (const { id, to } of list) { if (deadline && Date.now() > deadline) break; const u = `https://api.myanimelist.net/v2/anime/${id}/my_list_status`, h = { Authorization: 'Bearer ' + t.access };
        const { ok, status, j } = to ? await req(u, { method: 'PATCH', headers: { ...h, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ status: MAL_OUT[to.s], num_watched_episodes: String(to.p || 0), score: String(to.r || 0) }) })
          : await req(u, { method: 'DELETE', headers: h });
        if (status === 401) throw Object.assign(fail('auth', 'انتهى الربط'), { done });
        if (ok || (!to && status === 404)) done.push(id); else if (status >= 500 || status === 429) break; }
      return done; } },
  simkl: { name: 'SIMKL', kind: 'device', ready: () => true,
    async start() { const { ok, j } = await req(`https://api.simkl.com/oauth2/device?${SQ}`, form({ client_id: SIMKL_ID, scope: 'media:read media:write' }));
      if (!ok || !j.device_code) throw fail('svc', why(j) || 'SIMKL لم يعطِ رمز ربط');
      return { device: j.device_code, code: j.user_code, url: j.verification_uri_complete || j.verification_uri || 'https://simkl.com/pin', every: Math.max(2, +j.interval || 5), until: now() + (+j.expires_in || 900) * 1000 }; },
    async poll(p) { const { ok, j } = await req(`https://api.simkl.com/oauth2/token?${SQ}`, form({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: SIMKL_ID, device_code: p.device }));
      if (ok && j.access_token) { if (!/(^|\s)media:write(\s|$)/.test(j.scope || '')) throw fail('scope', 'لم يُمنح الإذن بالكتابة'); return keep(j); }
      if (j.error === 'authorization_pending' || j.error === 'slow_down') return null; throw fail(j.error === 'access_denied' ? 'denied' : 'svc', why(j)); },
    async refresh(t) { const { ok, j } = await req(`https://api.simkl.com/oauth2/token?${SQ}`, form({ grant_type: 'refresh_token', client_id: SIMKL_ID, refresh_token: t.refresh }));
      if (!ok || !j.access_token) throw fail('auth', why(j)); return keep(j, t); },
    // /sync/activities أولاً: إن لم يتغير شيء في الأنمي منذ آخر سحب فلا يُطلب السجل كله
    async pull(t, mark, eps) { const h = { headers: { Authorization: 'Bearer ' + t.access } }, a = await req(`https://api.simkl.com/sync/activities?${SQ}`, h);
      if (a.status === 401) throw fail('auth', 'انتهى الربط'); if (!a.ok) throw fail('svc', why(a.j));
      const m = a.j?.anime?.all || a.j?.all || ''; if (m && m === mark) return { same: true };
      const { ok, status, j } = await req(`https://api.simkl.com/sync/all-items/anime?${SQ}`, h); if (status === 401) throw fail('auth'); if (!ok) throw fail('svc', why(j));
      // eps: عدد حلقات كل عمل من كتالوج الصفحة (والفيلم -1)، فلا يزيد ما يأتي من SIMKL على حلقات العمل (SIMKL يجمع أحياناً أجزاء في مدخل)
      const by = new Map(Object.entries(eps || {}).map(([id, n]) => [+id, { eps: n < 0 ? 1 : n, ord: 0 }])), cx = { by, bySimkl: new Map(), bulk: new Set() }, items = {}, list = Array.isArray(j) ? j : j?.anime || [];
      for (const it of list) { const e = shapeSimkl(it, cx); if (e && (!items[e.id] || e.watched > items[e.id].p)) items[e.id] = { s: e.status, p: e.watched || 0, r: e.score || 0, t: 0 }; }
      return { items, complete: true, mark: m }; },
    async push(t, list) { const h = { Authorization: 'Bearer ' + t.access, 'content-type': 'application/json' };
      for (const [path, body] of simklOps(list)) { const { ok, status, j } = await req(`https://api.simkl.com${path}?${SQ}`, { method: 'POST', headers: h, body: J(body) });
        if (status === 401 || status === 403) throw fail('auth', 'لم يقبل الكتابة بهذا الربط'); if (!ok) throw fail('svc', why(j) || 'SIMKL ' + status); }
      return list.map(x => x.id); } },
};

// ---------- المخزن: S = { get(k), set(k, v), del(k), lock(), unlock() } فوق Netlify Blobs (أو مخزن في الذاكرة للاختبار)
export async function blobStore(name = 'accounts') { const { getStore } = await import('@netlify/blobs'); const b = getStore({ name, consistency: 'strong' });
  return { get: k => b.get(k, { type: 'json' }), set: (k, v) => b.setJSON(k, v), del: k => b.delete(k),
    async lock() { for (let i = 0; i < 2; i++) { const w = await b.setJSON('lock', { until: now() + 25000 }, { onlyIfNew: true }); if (w.modified) return true;
        const l = await b.get('lock', { type: 'json' }); if (l && l.until > now()) return false; await b.delete('lock'); } return false; },
    unlock: () => b.delete('lock') }; }
export function memStore(seed = {}) { const m = new Map(Object.entries(seed).map(([k, v]) => [k, J(v)]));
  return { m, get: async k => m.has(k) ? JSON.parse(m.get(k)) : null, set: async (k, v) => { m.set(k, J(v)); }, del: async k => { m.delete(k); },
    lock: async () => { if (m.has('lock') && JSON.parse(m.get('lock')).until > now()) return false; m.set('lock', J({ until: now() + 25000 })); return true; }, unlock: async () => { m.delete('lock'); } }; }

// ---------- الربط
const rand = n => randomBytes(n).toString('base64url');
export async function linkStart(S, k, redirect) { const s = SVC[k]; if (!s) throw fail('svc', 'خدمة غير معروفة'); if (!s.ready()) throw fail('setup', `${s.name} لم يُجهَّز بعد`);
  if (s.kind === 'code') { const p = { state: rand(18), verifier: rand(64), until: now() + 15 * 60e3 }; await S.set('pend/' + k, p); return { url: s.authUrl(p, redirect) }; }
  const p = await s.start(); await S.set('pend/' + k, p); return { code: p.code, url: p.url, every: p.every, until: p.until }; }
export async function linkCallback(S, k, code, state, redirect) { const p = await S.get('pend/' + k); if (!p || p.state !== state || p.until < now()) throw fail('state', 'انتهت مهلة الربط، ابدأه من جديد');
  const t = await SVC[k].exchange(code, p, redirect); await S.set('tok/' + k, t); await S.del('pend/' + k); return true; }
export async function linkPoll(S, k) { const p = await S.get('pend/' + k); if (!p || p.until < now()) return { gone: true };
  const t = await SVC[k].poll(p); if (!t) return { wait: p.every }; await S.set('tok/' + k, t); await S.del('pend/' + k); return { done: true }; }
export async function unlink(S, k) { await S.del('tok/' + k); await S.del('pend/' + k); const st = await S.get('anime'); if (st) { delete st.shadow?.[k]; delete st.mark?.[k]; delete st.err?.[k]; await S.set('anime', st); } }
async function token(S, k) { let t = await S.get('tok/' + k); if (!t) return null;
  if (t.refresh && t.exp - now() < 10 * 60e3) { try { t = await SVC[k].refresh(t); await S.set('tok/' + k, t); } catch (e) { if (e.code === 'auth') { t.dead = 1; await S.set('tok/' + k, t); } } }
  return t.dead ? { dead: 1 } : t; }
export async function linksOf(S) { const st = await S.get('anime') || {}, o = {};
  for (const k of Object.keys(SVC)) { const t = await S.get('tok/' + k), p = await S.get('pend/' + k);
    o[k] = { on: !!t && !t.dead, dead: !!t?.dead, since: t?.at || 0, ready: SVC[k].ready(), waiting: !!p && p.until > now(), err: st.err?.[k] || '', at: st.at?.[k] || 0 }; }
  return o; }

// ---------- المزامنة. edits: تعديلات الصفحة [{ id, s, p, r, t }]. full: سجل الصفحة كله لأول مرة. eps: عدد حلقات كل عمل (من كتالوج الصفحة)
// since: آخر rev وصل الصفحة. يعيد { rev, changes: ما تغيّر من الخدمات بعد since، needFull }
const blank = () => ({ rev: 0, items: {}, shadow: {}, mark: {}, err: {}, at: {}, eps: {} });
function put(st, id, v, t, src, force) { const cur = st.items[id];
  if (cur && !force && cur.t > t) return false; if (cur && same(cur, v)) { cur.t = Math.max(cur.t, t); return false; }
  if (!cur && !v) return false; st.items[id] = { ...(v || { s: null }), t, src, rev: ++st.rev }; return true; }
function merge(st, k, R) { const sh = st.shadow[k], items = R.items;
  if (!sh) { // أول مزامنة لهذه الخدمة: مصالحة بلا محو
    for (const [id, r] of Object.entries(items)) { const h = val(st.items[id]);
      if (!h) put(st, id, val(r), r.t || 1, k); else if (!same(h, r) && ahead(r, h)) put(st, id, val(r), Math.max(st.items[id].t + 1, r.t || 0), k, true); }
    st.shadow[k] = Object.fromEntries(Object.entries(items).map(([id, r]) => [id, val(r)])); return; }
  const ids = new Set([...Object.keys(items), ...Object.keys(sh)]), gone = [...ids].filter(id => !items[id] && sh[id]);
  const dropOk = R.complete && Object.keys(items).length > 0 && gone.length <= Math.min(3, Math.max(1, Math.floor(Object.keys(sh).length / 10)));
  for (const id of ids) { const r = val(items[id]), was = sh[id] || null; if (same(r, was)) continue;
    if (!r) { if (dropOk) { put(st, id, null, now(), k); delete sh[id]; } continue; }
    put(st, id, r, items[id].t || now(), k); sh[id] = r; } }
async function pushTo(S, st, k, t, budget, deadline) { const sh = st.shadow[k] ||= {}, list = [];
  for (const [id, h] of Object.entries(st.items)) { const v = val(h), was = sh[id] || null; if (same(v, was)) continue; if (!v && !was) continue;
    list.push({ id: +id, from: was, to: v, movie: st.eps[id] < 0 }); if (list.length >= budget) break; }
  if (!list.length) return 0; let done = [];
  try { done = await SVC[k].push(t, list, deadline); } catch (e) { done = e.done || []; for (const id of done) { const x = list.find(y => y.id === id); if (x.to) sh[id] = x.to; else delete sh[id]; } throw e; }
  for (const id of done) { const x = list.find(y => y.id === +id); if (x.to) sh[id] = x.to; else delete sh[id]; }
  return done.length; }

// budget: أكثر ما يُرسل إلى خدمة في المرة، وdeadline: وقت يتوقف عنده الإرسال ويُحفظ ما تم (والباقي في المرة القادمة)، فلا تتجاوز الدالة مهلتها
export async function syncAnime(S, { edits = [], full = null, eps = null, build = '', since = 0, pull = true, budget = 40, deadline = 0 } = {}) {
  const st = Object.assign(blank(), await S.get('anime') || {});
  // المحور يبدأ من سجلّ الصفحة كله، ولا يبدأ من سجلّ فارغ (جهاز بلا سجلّ لا يمحو بحضوره شيئاً)
  if (!st.boot && !(full && Object.keys(full).length)) return { needFull: true, rev: st.rev, changes: [] };
  if (full && !st.boot) { for (const [id, m] of Object.entries(full)) put(st, id, val(m), 0, 'site'); st.boot = now(); }
  if (eps) { st.eps = eps; st.build = build; }
  for (const e of edits) if (/^\d+$/.test(String(e.id))) put(st, String(e.id), val(e), +e.t || now(), 'site');
  // السحب من كل الخدمات أولاً ثم الدفع إليها كلها، فتعديل في إحداها يصل الأخرى في المزامنة نفسها
  const live = {}, oops = async (k, t, e) => { st.err[k] = e.code === 'auth' ? 'auth' : e.code === 'net' ? 'net' : String(e.message || 'خطأ').slice(0, 120); delete live[k]; if (e.code === 'auth') { t.dead = 1; await S.set('tok/' + k, t); } };
  for (const k of Object.keys(SVC)) { const t = await token(S, k); if (!t) continue; if (t.dead) { st.err[k] = 'auth'; continue; } live[k] = t;
    try { if (pull || !st.shadow[k]) { const R = await SVC[k].pull(t, st.mark[k], st.eps); if (!R.same) { merge(st, k, R); if (R.mark) st.mark[k] = R.mark; } } } catch (e) { await oops(k, t, e); } }
  for (const [k, t] of Object.entries(live)) { if (deadline && Date.now() > deadline) break; try { await pushTo(S, st, k, t, budget, deadline); st.err[k] = ''; st.at[k] = now(); } catch (e) { await oops(k, t, e); } }
  await S.set('anime', st);
  const changes = Object.entries(st.items).filter(([, h]) => h.rev > since && h.src !== 'site').map(([id, h]) => ({ id: +id, ...(val(h) || { s: null }), src: h.src }));
  return { rev: st.rev, changes, needEps: !!build && st.build !== build }; }
