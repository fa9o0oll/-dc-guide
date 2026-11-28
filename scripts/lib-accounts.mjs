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
import { TRAKT, syncSeries as seriesCore } from './lib-trakt.mjs';

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
// والحالة في /sync/add-to-list لكل عمل في مدخله (to مع ids)، لا للطلب كله: SIMKL رفض to في رأس الطلب («Missed "to" parameter»)
export function simklOps(list) { const gone = [], add = [], unmark = [], move = [], rate = [], unrate = [];
  for (const { id, from, to: now_, movie } of list) { const ids = { mal: +id };
    if (!now_) { if (from) gone.push({ ids }); continue; }
    const p0 = from?.p || 0, p1 = now_.p || 0;
    if (!movie && p1 > p0) add.push({ ids, seasons: [{ number: 1, episodes: range(p0 + 1, p1) }] });
    if (!movie && p1 < p0) unmark.push({ ids, seasons: [{ number: 1, episodes: range(p1 + 1, p0) }] });
    if (now_.s !== from?.s && SK_OUT[now_.s]) move.push({ to: SK_OUT[now_.s], ids });
    if ((now_.r || 0) !== (from?.r || 0)) (now_.r ? rate : unrate).push(now_.r ? { ids, rating: now_.r } : { ids }); }
  return [gone.length && ['/sync/history/remove', { shows: gone }], unmark.length && ['/sync/history/remove', { shows: unmark }], add.length && ['/sync/history', { shows: add }],
    move.length && ['/sync/add-to-list', { shows: move }], rate.length && ['/sync/ratings', { shows: rate }], unrate.length && ['/sync/ratings/remove', { shows: unrate }]].filter(Boolean); }

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

// Trakt للمسلسلات (scripts/lib-trakt.mjs): يُربط كغيره، وتزامنه syncSeries لا syncAnime
SVC.trakt = TRAKT;
const ANIME = ['mal', 'simkl'];

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
// from: البوابة التي بدأت الربط (dc أو marvel لـTrakt)، فيعود إليها الرجوع بعد الموافقة
export async function linkStart(S, k, redirect, from = '') { const s = SVC[k]; if (!s) throw fail('svc', 'خدمة غير معروفة'); if (!s.ready()) throw fail('setup', `${s.name} لم يُجهَّز بعد`);
  if (s.kind === 'code') { const p = { state: rand(18), verifier: rand(64), until: now() + 15 * 60e3, from: /^[a-z]{2,10}$/.test(from) ? from : '' }; await S.set('pend/' + k, p); return { url: s.authUrl(p, redirect) }; }
  const p = await s.start(); await S.set('pend/' + k, p); return { code: p.code, url: p.url, every: p.every, until: p.until }; }
export async function linkCallback(S, k, code, state, redirect) { const p = await S.get('pend/' + k); if (!p || p.state !== state || p.until < now()) throw fail('state', 'انتهت مهلة الربط، ابدأه من جديد');
  const t = await SVC[k].exchange(code, p, redirect); await S.set('tok/' + k, t); await S.del('pend/' + k); return { from: p.from || '' }; }
export async function linkPoll(S, k) { const p = await S.get('pend/' + k); if (!p || p.until < now()) return { gone: true };
  const t = await SVC[k].poll(p); if (!t) return { wait: p.every }; await S.set('tok/' + k, t); await S.del('pend/' + k); return { done: true }; }
export async function unlink(S, k) { await S.del('tok/' + k); await S.del('pend/' + k); if (k === 'letterboxd') { const fl = await S.get('films'); if (fl) { fl.lb = { known: {}, wl: {} }; delete fl.err?.letterboxd; await S.set('films', fl); } return; }
  // Trakt: يُنسى ظله، فإن رُبط من جديد بدأ بمصالحة تجمع ولا تمحو (والمحور يبقى)
  if (k === 'trakt') { const se = await S.get('series'); if (se) { Object.assign(se, { sh: null, shOk: 0, mark: '', pend: {}, nf: {}, err: '', at: 0 }); await S.set('series', se); } return; } const st = await S.get('anime'); if (st) { delete st.shadow?.[k]; delete st.mark?.[k]; delete st.err?.[k]; await S.set('anime', st); } }
async function token(S, k) { let t = await S.get('tok/' + k); if (!t) return null;
  if (t.refresh && t.exp - now() < 10 * 60e3) { try { t = await SVC[k].refresh(t); await S.set('tok/' + k, t); } catch (e) { if (e.code === 'auth') { t.dead = 1; await S.set('tok/' + k, t); } } }
  return t.dead ? { dead: 1 } : t; }
export async function linksOf(S) { const st = await S.get('anime') || {}, o = {}, fl = await S.get('films') || {}, lb = await S.get('tok/letterboxd');
  o.letterboxd = { on: !!lb, user: lb?.user || '', since: lb?.at || 0, ready: true, err: fl.err?.letterboxd || '', at: fl.at?.letterboxd || 0 };
  const se = await S.get('series') || {};
  for (const k of Object.keys(SVC)) { const t = await S.get('tok/' + k), p = await S.get('pend/' + k), from = k === 'trakt' ? { err: { trakt: se.err }, at: { trakt: se.at } } : st;
    o[k] = { on: !!t && !t.dead, dead: !!t?.dead, since: t?.at || 0, ready: SVC[k].ready(), waiting: !!p && p.until > now(), err: from.err?.[k] || '', at: from.at?.[k] || 0 }; }
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
// guide (E92): «أنمياتي» (anime، ومصدر تعديلاتها site) أو دليل Fate (fate). الدليل يتقدّم وحده: ما يرسله يُقبل إن كان أمام ما في المحور
// (عدد حلقات أكثر، أو ختمٌ، أو بدءٌ بعد «سأشاهده»)، ولا يزيل ولا يُنزل ولا يمسّ التقييم، و«ختمته» كامل حلقات العمل في MyAnimeList.
// والمحور لا يبدأ من سجلّه (يبدأ من «أنمياتي»). fresh: لا تُسحب الخدمات إن سُحبت قبل أقل من ذلك
const fwd = (v, cur) => !cur || ahead(v, cur) || (cur.s === 'plan' && v.s === 'watching');
export async function syncAnime(S, { guide = 'anime', edits = [], full = null, eps = null, build = '', since = 0, pull = true, budget = 40, deadline = 0, fresh = 0 } = {}) {
  const st = Object.assign(blank(), await S.get('anime') || {}), g = guide === 'fate' ? 'fate' : 'site';
  // المحور يبدأ من سجلّ الصفحة كله، ولا يبدأ من سجلّ فارغ (جهاز بلا سجلّ لا يمحو بحضوره شيئاً)
  if (!st.boot && !(g === 'site' && full && Object.keys(full).length)) return { needFull: g === 'site', needBoot: g !== 'site', rev: st.rev, changes: [] };
  if (full && !st.boot) { for (const [id, m] of Object.entries(full)) put(st, id, val(m), 0, 'site'); st.boot = now(); }
  if (eps) { st.eps = eps; st.build = build; }
  const fv = (id, e) => { const v = val({ ...e, r: st.items[id]?.r || 0 }), n = st.eps[id]; if (!v) return null; if (n > 0) v.p = v.s === 'completed' ? n : Math.min(v.p, n); else if (n < 0) v.p = v.s === 'completed' ? 1 : 0; return v; };
  const fput = (id, e, t) => { const v = fv(id, e), cur = val(st.items[id]); if (v && !same(cur, v) && fwd(v, cur)) put(st, id, v, Math.max(t, (st.items[id]?.t || 0) + 1), 'fate', true); };
  // وسجله كله (من كل جهاز مرة لكل ربط) لا يعيد عملاً أُزيل من حسابك صراحة، أما تعديله الجديد فيعيده (علّمته الآن)
  if (full && g === 'fate') for (const [id, m] of Object.entries(full)) if (/^\d+$/.test(id) && !(st.items[id] && !val(st.items[id]))) fput(id, m, 1);
  for (const e of edits) if (/^\d+$/.test(String(e.id))) { if (g === 'fate') fput(String(e.id), e, +e.t || now()); else put(st, String(e.id), val(e), +e.t || now(), 'site'); }
  // السحب من كل الخدمات أولاً ثم الدفع إليها كلها، فتعديل في إحداها يصل الأخرى في المزامنة نفسها
  const live = {}, oops = async (k, t, e) => { st.err[k] = e.code === 'auth' ? 'auth' : e.code === 'net' ? 'net' : String(e.message || 'خطأ').slice(0, 120); delete live[k]; if (e.code === 'auth') { t.dead = 1; await S.set('tok/' + k, t); } };
  for (const k of ANIME) { const t = await token(S, k); if (!t) continue; if (t.dead) { st.err[k] = 'auth'; continue; } live[k] = t;
    try { if ((pull && !(fresh && now() - (st.at[k] || 0) < fresh)) || !st.shadow[k]) { const R = await SVC[k].pull(t, st.mark[k], st.eps); if (!R.same) { merge(st, k, R); if (R.mark) st.mark[k] = R.mark; } } } catch (e) { await oops(k, t, e); } }
  for (const [k, t] of Object.entries(live)) { if (deadline && Date.now() > deadline) break; try { await pushTo(S, st, k, t, budget, deadline); st.err[k] = ''; st.at[k] = now(); } catch (e) { await oops(k, t, e); } }
  await S.set('anime', st);
  const changes = Object.entries(st.items).filter(([, h]) => h.rev > since && h.src !== g).map(([id, h]) => ({ id: +id, ...(val(h) || { s: null }), src: h.src }));
  return { rev: st.rev, changes, needEps: g === 'site' && !!build && st.build !== build }; }

// ---------- المسلسلات ↔ Trakt (E87، التفاصيل في scripts/lib-trakt.mjs): الرمز يُجدَّد هنا كغيره، وانتهاء الربط يُحفظ
export const syncSeries = (S, o) => seriesCore(S, { get: () => token(S, 'trakt'), kill: async t => { t.dead = 1; await S.set('tok/trakt', t); } }, o);

// ---------- الأفلام ↔ Letterboxd (E86). Letterboxd لا يسمح لأي موقع أن يكتب في حسابك (لا واجهة مفتوحة)، فالمزامنة نصفان:
// - منه إلى الموقع تلقائياً: يومياتك العامة (letterboxd.com/<اسمك>/rss/) فيها كل فيلم تسجله برقمه في TMDB، فيصير هنا «شاهدته».
// - ومن الموقع إليه: الصفحة تجهّز ملف استيراد بصيغته (tmdbID) لما شاهدته أو أضفته إلى «سأشاهده» ولم يصله، وترفعه أنت.
//   والخادم يحفظ ما يعرفه Letterboxd (ما ظهر في يومياتك وما نزّلته في ملف)، فلا يُعاد في الملف التالي.
// المحور هنا: لكل فيلم (رقمه في TMDB) حالته في الموقع s: watched أو next، ومتى تغيّرت ومن أين، كمحور الأنمي.
const LB_UA = 'Mozilla/5.0 (compatible; watch-guide/1.0)';
export const lbName = s => String(s || '').trim().replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '').toLowerCase();
export function parseLb(xml) { return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => { const x = m[1], g = re => (x.match(re) || [])[1] || '';
    return { tmdb: +g(/<tmdb:movieId>(\d+)<\/tmdb:movieId>/), date: g(/<letterboxd:watchedDate>([\d-]+)</), rating: +g(/<letterboxd:memberRating>([\d.]+)</) || 0, at: Date.parse(g(/<pubDate>([^<]+)</)) || 0 }; })
  .filter(i => i.tmdb); }
async function lbFetch(user) { let r; try { r = await fetch(`https://letterboxd.com/${encodeURIComponent(user)}/rss/`, { headers: { 'user-agent': LB_UA, accept: 'application/rss+xml, application/xml' }, signal: AbortSignal.timeout(T) }); }
  catch { throw fail('net', 'تعذّر الوصول إلى Letterboxd'); }
  if (r.status === 404) throw fail('gone', 'لا حساب في Letterboxd بهذا الاسم'); const text = await r.text();
  if (!r.ok || !/<rss[\s>]/.test(text)) throw fail('net', 'Letterboxd لم يعطِ يومياتك الآن'); return parseLb(text); }
export async function linkLetterboxd(S, name) { const user = lbName(name); if (!/^[a-z0-9_]{2,30}$/.test(user)) throw fail('user', 'اكتب اسمك في Letterboxd كما في رابط صفحتك');
  await lbFetch(user); await S.set('tok/letterboxd', { user, at: now() }); return { done: true, user }; }
const FILM = new Set(['watched', 'next']), fval = x => x && FILM.has(x.s) ? { s: x.s } : null;
const filmsBlank = () => ({ rev: 0, items: {}, lb: { known: {}, wl: {} }, err: {}, at: {} });
// edits/full بمفاتيح الصفحة (m رقم الفيلم في TMDB، والمسلسل t لا يدخل هنا: مكانه Trakt). يعيد ما تغيّر من Letterboxd بعد since، وما يعرفه Letterboxd
// guide (E90): قائمة أفلامي (films، ومصدر تعديلاتها site) أو دليل DC أو مارفل (أفلامهما). المحور واحد للبوابات الثلاث، فما تعلّمه في بوابة يصل
// الأخريين، وملف الاستيراد إلى Letterboxd (في قائمة أفلامي) يحمل أفلام الدليلين أيضاً. ولكل تعديل مصدره، فلا يعود إلى البوابة التي جاء منها
// fresh: لا تُقرأ اليوميات إن قُرئت قبل أقل من ذلك (الدليلان: دقيقتان، فلا يُطلب Letterboxd مع كل تعديل فيهما)
export async function syncFilms(S, { guide = 'films', edits = [], full = null, since = 0, pull = true, fresh = 0 } = {}) {
  const st = Object.assign(filmsBlank(), await S.get('films') || {}), t = await S.get('tok/letterboxd'), g = guide === 'films' ? 'site' : String(guide);
  const lbOut = () => t ? { user: t.user, known: Object.keys(st.lb.known).map(Number), wl: Object.keys(st.lb.wl).map(Number), err: st.err.letterboxd || '', at: st.at.letterboxd || 0 } : null;
  // يبدأ ولو من سجلّ فارغ: محور الأفلام لا يُرسل إلى Letterboxd شيئاً (الكتابة إليه ملف تنزّله)، فما يصل من يومياتك يُضاف ولا يمحو
  // والدليلان لا ينتظران سجلّهما: كل جهاز يرسله مرة لكل ربط (accounts.full) فيُجمع حين يصل
  if (g === 'site' && !st.boot && !full) return { needFull: true, rev: st.rev, changes: [], lb: lbOut() };
  const put = (id, v, when, src) => { const cur = st.items[id]; if (cur && cur.t > when) return; if (cur && J(fval(cur)) === J(v)) { cur.t = Math.max(cur.t, when); return; }
    if (!cur && !v) return; st.items[id] = { ...(v || { s: null }), t: when, src, rev: ++st.rev }; };
  if (full && g === 'site' && !st.boot) { for (const [k, s] of Object.entries(full)) if (/^m\d+$/.test(k)) put(k.slice(1), fval({ s }), 0, 'site'); st.boot = now(); }
  // سجل الدليل يُجمع إلى المحور (من كل جهاز مرة لكل ربط): يُضاف ما ليس فيه، و«شاهدته» يغلب «سأشاهده»، ولا يعود فيلمٌ أُزيلت علامته صراحة
  else if (full && g !== 'site') { for (const [k, s] of Object.entries(full)) { if (!/^m\d+$/.test(k) || !FILM.has(s)) continue; const id = k.slice(1), cur = st.items[id];
      if (!cur) st.items[id] = { s, t: 0, src: g, rev: ++st.rev }; else if (s === 'watched' && cur.s === 'next') Object.assign(cur, { s, src: g, rev: ++st.rev }); }
    (st.gb ||= {})[g] ||= now(); }
  for (const e of edits) { const k = String(e.id || ''); if (/^m\d+$/.test(k)) put(k.slice(1), fval(e), +e.t || now(), g); }
  if (t && pull && !(fresh && now() - (st.at.letterboxd || 0) < fresh)) { try { for (const i of await lbFetch(t.user)) { st.lb.known[i.tmdb] = 1; if (st.items[i.tmdb]?.s !== 'watched') put(String(i.tmdb), { s: 'watched' }, i.at || now(), 'letterboxd'); }
      st.err.letterboxd = ''; st.at.letterboxd = now(); }
    catch (e) { st.err.letterboxd = e.code === 'gone' ? 'gone' : 'net'; } }
  await S.set('films', st);
  const changes = Object.entries(st.items).filter(([, h]) => h.rev > since && h.src !== g).map(([id, h]) => ({ id: 'm' + id, s: h.s || null, src: h.src }));
  return { rev: st.rev, changes, lb: lbOut() }; }
// نزّلتَ ملف الاستيراد: ما فيه صار معروفاً لـLetterboxd (kind: watched أو next)، فلا يعود في الملف التالي
export async function filmsSent(S, kind, ids) { const st = Object.assign(filmsBlank(), await S.get('films') || {}), m = kind === 'next' ? st.lb.wl : st.lb.known;
  for (const id of ids || []) if (/^\d+$/.test(String(id))) m[id] = 1; await S.set('films', st); return { known: Object.keys(st.lb.known).length, wl: Object.keys(st.lb.wl).length }; }
