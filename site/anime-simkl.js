// الربط بـSIMKL من المتصفح مباشرة: دخول بالرمز (OAuth 2.0 device authorization)، ثم سحب قائمة الأنمي من الحساب.
// - معرّف التطبيق (client_id) عام بنص SIMKL نفسه في صفحة التطبيق: «Public · Safe on GitHub»، ولا سر لهذا النوع من التطبيقات.
// - رمز الدخول ورمز التجديد يبقيان في هذا المتصفح فقط (animeg.simkl): لا يُزامَنان، ولا يُكتبان في المستودع، ولا يُرسلان إلى غير api.simkl.com.
// - كل طلب يحمل client_id وapp-name وapp-version كما تطلب SIMKL (api.simkl.org/conventions/headers).
// - السحب الأول يطلب الأنمي فقط، مرة واحدة، ويحفظ لقطة /sync/activities لتُعرف بها التغييرات لاحقاً (api.simkl.org/guides/sync).
const CLIENT = '6c4e4c56c81ae9e92bb2470d2d296d4db7413c112d0b2671927225e8a43a738e', APP = { 'app-name': 'my-watch-guide', 'app-version': '1.0' };
const API = 'https://api.simkl.com', TOK = 'animeg.simkl', ACT = 'animeg.simkl.act', GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const url = (path, q = {}) => `${API}${path}?${new URLSearchParams({ ...q, client_id: CLIENT, ...APP })}`;
const form = o => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = (msg, code) => Object.assign(new Error(msg), { code });
async function call(u, init) { let r; try { r = await fetch(u, init); } catch { throw fail('تعذّر الوصول إلى SIMKL. تحقق من الاتصال وحاول ثانية.', 'network'); }
  let j = null; try { j = await r.json(); } catch {} return { ok: r.ok, status: r.status, j: j || {} }; }

export const simklToken = () => { const t = ls.get(TOK); return t?.access ? t : null; };
export const simklForget = () => { ls.del(TOK); ls.del(ACT); };
// رمز التجديد لا يتبدل عند التجديد (api.simkl.org/api-reference/oauth2-tokens)، فإن لم يُعده الرد يبقى الذي عندنا
const keepToken = (j, old) => { const t = { access: j.access_token, refresh: j.refresh_token || old?.refresh || null, exp: Date.now() + (+j.expires_in || 7 * 86400) * 1000 }; ls.set(TOK, t); return t; };

// 1) طلب رمز الربط: يعيد { device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }
export async function simklStart() { const { ok, j } = await call(url('/oauth2/device'), form({ client_id: CLIENT }));
  if (!ok || !j.device_code || !j.user_code) throw fail(j.error === 'invalid_client' ? 'SIMKL لم يتعرف على تطبيق الموقع.' : 'SIMKL لم يعطِ رمز ربط الآن. حاول بعد قليل.', j.error);
  return { ...j, until: Date.now() + (+j.expires_in || 900) * 1000 }; }
// 2) انتظار الموافقة: يسأل كل «interval» ثانية حتى يوافق صاحب الحساب أو تنتهي مهلة الرمز. alive: دالة تقول إن الانتظار ما زال مطلوباً
export async function simklPoll(s, alive = () => true) { let every = Math.max(2, +s.interval || 5) * 1000;
  while (Date.now() < s.until && alive()) { await wait(every); if (!alive()) return false;
    const { ok, j } = await call(url('/oauth2/token'), form({ grant_type: GRANT, client_id: CLIENT, device_code: s.device_code }));
    if (ok && j.access_token) { keepToken(j); return true; }
    if (j.error === 'slow_down') every += 5000; else if (j.error === 'access_denied') throw fail('رُفض الربط من صفحة SIMKL.', j.error); else if (j.error === 'expired_token') return false;
    else if (j.error && j.error !== 'authorization_pending') throw fail('SIMKL رفض الطلب: ' + j.error, j.error); }
  return false; }
// رمز الدخول يعيش أسبوعاً، ورمز التجديد (180 يوماً تتجدد مع كل استعمال) يمدّه. إن تعذّر التجديد يُطلب الربط من جديد.
// الربط يطلب صلاحية القراءة وحدها (media:read، وهي ما يعطيه SIMKL حين لا يُطلب غيرها): الموقع يسحب ولا يكتب في الحساب
async function access() { let t = simklToken(); if (!t) throw fail('اربط حسابك في SIMKL أولاً.', 'no_token');
  if (t.exp - Date.now() < 3600e3 && t.refresh) { const { ok, j } = await call(url('/oauth2/token'), form({ grant_type: 'refresh_token', client_id: CLIENT, refresh_token: t.refresh })); if (ok && j.access_token) t = keepToken(j, t); }
  return t.access; }
async function api(path, q) { const tok = await access(), { ok, status, j } = await call(url(path, q), { headers: { Authorization: 'Bearer ' + tok } });
  if (status === 401) { ls.del(TOK); throw fail('انتهى ربط SIMKL على هذا الجهاز. اربطه من جديد.', 'unauthorized'); }
  if (!ok) throw fail(j.message || j.error_description || j.error || `SIMKL ${status}`, j.error || status); return j; }

const STATUS = { watching: 'watching', plantowatch: 'plan', hold: 'hold', completed: 'completed', dropped: 'dropped', notinteresting: 'dropped' };
const day = s => /^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : null;
// عنصر من /sync/all-items/anime ← سجل بصيغتنا. رقم MyAnimeList من ids.mal، وإن غاب فمن رقم SIMKL في كتالوج الموقع
export function shapeSimkl(it, bySimkl) { const sh = it.show || it.anime || it.movie || {}, ids = sh.ids || {}, id = +ids.mal || bySimkl.get(+ids.simkl) || 0, status = STATUS[it.status];
  if (!id || !status) return null;
  const when = (it.seasons || []).flatMap(s => (s.episodes || []).map(e => day(e.watched_at))).filter(Boolean).sort(), seen = +it.watched_episodes_count || 0;
  return { id, title: sh.title || '', status, watched: seen, score: Math.min(10, Math.max(0, Math.round(+it.user_rating || 0))),
    start: when[0] || null, finish: status === 'completed' ? when[when.length - 1] || day(it.last_watched_at) : null }; }
// 3) السحب: لقطة النشاط أولاً، ثم قائمة الأنمي كلها بحلقاتها وتواريخها. إن رفضها SIMKL لكثرة الحلقات تُطلب بلا حلقات
export async function simklPull(catalog) { const bySimkl = new Map(catalog.filter(a => a.sk).map(a => [a.sk, a.id]));
  const act = await api('/sync/activities'); let raw;
  try { raw = await api('/sync/all-items/anime', { extended: 'full', episode_watched_at: 'yes', include_all_episodes: 'original', memos: 'yes' }); }
  catch (e) { if (e.code === 'unauthorized' || e.code === 'network' || e.code === 'no_token') throw e; raw = await api('/sync/all-items/anime'); }
  const items = Array.isArray(raw) ? raw : raw?.anime || [], seen = new Map(); let unmatched = 0;
  for (const it of items) { const e = shapeSimkl(it, bySimkl); if (!e) { unmatched++; continue; } const was = seen.get(e.id); if (!was || e.watched > was.watched) seen.set(e.id, e); }
  const entries = [...seen.values()], n = s => entries.filter(e => e.status === s).length; ls.set(ACT, act);
  return { entries, matched: entries.length, unmatched, raw, totals: { all: entries.length, watching: n('watching'), completed: n('completed'), hold: n('hold'), dropped: n('dropped'), plan: n('plan'), episodes: entries.reduce((s, e) => s + e.watched, 0), scored: entries.filter(e => e.score).length } }; }
