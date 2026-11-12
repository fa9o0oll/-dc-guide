// المزامنة الحيّة لسجل المشاهدة بين الأجهزة، عبر Firebase Realtime Database يملكها صاحب الموقع.
// - لا إعدادات في المستودع: صاحب الموقع يلصق firebaseConfig مرة واحدة في كل جهاز، ويُحفظ في متصفحه فقط (guides.fb).
// - كل علامة مشاهدة تُخزَّن وحدها في guides/<الدليل>/<المفتاح> = { v, t } و t طابع الخادم. الأحدث لكل علامة يغلب،
//   فلا يمحو جهازٌ ما علّمه جهاز آخر. الإلغاء يُكتب v:0 ولا يُحذف، حتى يصل الأجهزة الأخرى.
// - صيغة السجل المحلي لا تتغير. نحفظ بجانبه guides.sync: آخر ما اتفق عليه هذا الجهاز مع القاعدة لكل علامة [القيمة، الطابع]،
//   وبه نعرف ما تغيّر محلياً ولم يُرسل بعد، حتى لو تغيّر والمزامنة متوقفة أو الصفحة مغلقة.
// - كل صفحة تزامن الأدلة الثلاثة معاً، فالواجهة الرئيسية وكل دليل يقرآن سجلاً محدَّثاً دائماً.
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-', CFG = 'guides.fb', META = 'guides.sync', ROOT = 'guides';
const GUIDES = { dc: 'dcg.progress', fate: 'fateg.progress', films: 'filmsg.progress' };
const OK = { w: ['watched', 'watching', 'list', 'skip'], f: ['watched', 'next'] };
const RULE = '"guides": { ".read": "auth != null", ".write": "auth != null" }';
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const json = (k, d) => { try { return JSON.parse(ls.get(k)) ?? d; } catch { return d; } };

// السجل ⇄ علامات مسطّحة: w|العمل ← حالته، e|العمل|الموسم-الحلقة ← 1، f|الفيلم ← حالته. «درع الحرق» إعداد للجهاز ولا يُزامَن.
const blank = id => id === 'films' ? { films: {} } : { v: 1, works: {}, eps: {}, shield: true };
function flat(id, s) { const o = {};
  if (id === 'films') { for (const [k, v] of Object.entries(s.films || {})) if (v) o['f|' + k] = v; return o; }
  for (const [k, v] of Object.entries(s.works || {})) if (v) o['w|' + k] = v;
  for (const [w, eps] of Object.entries(s.eps || {})) for (const e of Object.keys(eps || {})) o[`e|${w}|${e}`] = 1;
  return o; }
function put(s, p, v) { const [k, a, b] = p.split('|');
  if (k === 'f') { s.films ||= {}; if (v) s.films[a] = v; else delete s.films[a]; }
  else if (k === 'w') { s.works ||= {}; if (v) s.works[a] = v; else delete s.works[a]; }
  else if (k === 'e') { s.eps ||= {}; if (v) (s.eps[a] ||= {})[b] = 1; else if (s.eps[a]) { delete s.eps[a][b]; if (!Object.keys(s.eps[a]).length) delete s.eps[a]; } } }
// ما يأتي من القاعدة بيانات لا أكثر: لا نقبل إلا القيم المعروفة، وما عداها يُعامل كأنه إلغاء
const clean = (p, v) => p[0] === 'e' ? (v ? 1 : undefined) : OK[p[0]]?.includes(v) ? v : undefined;
const valid = p => /^(f\|[^|]+|w\|[^|]+|e\|[^|]+\|\d+-\d+)$/.test(p);
// مفاتيح Firebase لا تقبل . # $ [ ] /
const enc = p => p.replace(/[.#$\[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
const dec = k => k.replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

let fb = null, app = null, state = 'off', problem = '', online = true;
const last = {}, sent = {}, handlers = new Set();

function reconcile(id) {
  if (!fb || !last[id]) return;
  const meta = json(META, {}); if (meta.db !== fb.url) { meta.db = fb.url; meta.g = {}; } const m = (meta.g ||= {})[id] ||= {};
  const raw = ls.get(GUIDES[id]); let s; try { s = JSON.parse(raw); } catch {} if (!s || typeof s !== 'object') s = blank(id);
  const cur = flat(id, s), remote = {}, push = {}, out = sent[id] ||= {}; let changed = false, noted = false;
  for (const [k, r] of Object.entries(last[id])) { const p = dec(k); if (r && typeof r === 'object' && valid(p)) remote[p] = r; }
  for (const p of new Set([...Object.keys(cur), ...Object.keys(m), ...Object.keys(remote)])) {
    const lv = cur[p], known = m[p], bv = known ? known[0] || undefined : undefined, r = remote[p], rv = r ? clean(p, r.v) : undefined, rt = r ? +r.t || 0 : 0;
    if (lv !== bv) { // تغيير على هذا الجهاز لم تتفق عليه القاعدة بعد
      if (r && rv === lv) { m[p] = [lv || 0, rt]; delete out[p]; noted = true; }
      else if (state !== 'err' && out[p] !== (lv || 0)) { push[enc(p)] = { v: lv || 0, t: fb.serverTimestamp() }; out[p] = lv || 0; }
    } else if (r && rv === lv) { if (!known || known[1] !== rt) { m[p] = [rv || 0, rt]; noted = true; } // متفقان: نثبّت طابع الخادم (يصل أولاً تقديرياً ثم مؤكداً)
    } else if (r && rt > (known ? known[1] : 0)) { put(s, p, rv); changed = true; m[p] = [rv || 0, rt]; } // الجهاز لم يغيّرها، وفي القاعدة ما هو أحدث
  }
  if (changed) { if (raw && ls.get(GUIDES[id] + '.presync') == null) ls.set(GUIDES[id] + '.presync', raw); // نسخة من السجل كما كان قبل أول دمج
    ls.set(GUIDES[id], JSON.stringify(s)); }
  if (noted || changed) ls.set(META, JSON.stringify(meta));
  if (changed) for (const h of handlers) { try { h(id); } catch (e) { console.error(e); } }
  const keys = Object.keys(push);
  // كتابة رُفضت: تبقى العلامة على الجهاز، ونعيدها «غير مُرسلة» لتُرسل عند نجاح المزامنة لاحقاً
  if (keys.length) fb.update(fb.ref(fb.d, `${ROOT}/${id}`), push).catch(e => { const mt = json(META, {}), g = mt.g?.[id] || {}; for (const k of keys) { delete out[dec(k)]; delete g[dec(k)]; } ls.set(META, JSON.stringify(mt)); fail(e); });
}

// بعد كل حفظ محلي: يُرسل ما تغيّر (إن كانت المزامنة تعمل؛ وإلا يبقى الفرق محفوظاً حتى تعمل)
export function touch(id) { try { reconcile(id); } catch (e) { console.error(e); } }

const cfgOf = () => { const c = json(CFG, null); return c && c.apiKey && c.projectId && c.databaseURL ? c : null; };
export const parseCfg = s => { const g = k => { const m = String(s || '').match(new RegExp(k + '["\']?\\s*[:=]\\s*["\']([^"\']+)')); return m ? m[1].trim() : ''; };
  return { apiKey: g('apiKey'), authDomain: g('authDomain'), databaseURL: g('databaseURL'), projectId: g('projectId'), appId: g('appId') }; };
const within = (p, ms, msg) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(msg)), ms))]);

function explain(e) { const c = String(e?.code || ''), m = String(e?.message || e || '');
  if (/permission/i.test(c + m)) return { text: 'القاعدة رفضت الوصول إلى المسار guides. أضف هذا السطر داخل rules في قواعد Realtime Database، ثم فعّل المزامنة من جديد:', code: RULE };
  if (/operation-not-allowed|admin-restricted/.test(c)) return { text: 'تسجيل الدخول المجهول غير مفعّل في مشروع Firebase. فعّله من Authentication ثم Sign-in method ثم Anonymous.' };
  if (/api-key|invalid-api/.test(c + m)) return { text: 'مفتاح المشروع غير صحيح. الصق firebaseConfig كاملاً من جديد.' };
  if (/network|Failed to fetch|import|module/i.test(c + m)) return { text: 'تعذّر الوصول إلى Firebase. تحقق من الاتصال، وإن كان في المتصفح مانع إعلانات فاستثنِ هذا الموقع.' };
  return { text: 'تعذّرت المزامنة: ' + m }; }
function fail(e) { console.error('[sync]', e); problem = explain(e); state = 'err'; paint(); }

async function start(cfg) {
  state = 'wait'; problem = ''; paint();
  try {
    const [A, U, D] = await within(Promise.all([import(SDK + 'app.js'), import(SDK + 'auth.js'), import(SDK + 'database.js')]), 20000, 'network: انتهت مهلة تحميل المكتبة');
    app = A.initializeApp(cfg, 'guides-sync'); app.kill = () => A.deleteApp(app);
    await within(U.signInAnonymously(U.getAuth(app)), 20000, 'network: انتهت مهلة التوثيق');
    const d = D.getDatabase(app);
    fb = { d, url: cfg.databaseURL, ref: D.ref, update: D.update, serverTimestamp: D.serverTimestamp };
    D.onValue(D.ref(d, '.info/connected'), s => { online = !!s.val(); paint(); });
    for (const id of Object.keys(GUIDES)) D.onValue(D.ref(d, `${ROOT}/${id}`), snap => { last[id] = snap.val() || {}; if (state !== 'err') { state = 'on'; paint(); } try { reconcile(id); } catch (e) { console.error(e); } }, fail);
  } catch (e) { fail(e); }
}
async function stop() { ls.del(CFG); try { await app?.kill(); } catch {} location.reload(); }

// ---------- الواجهة: زر الحالة في كل صفحة (data-sync-open مع data-sync-label)، ونافذة الإعداد
export function syncLabel() { return state === 'on' ? (online ? 'المزامنة تعمل' : 'المزامنة: بلا اتصال الآن') : state === 'wait' ? 'المزامنة: جارٍ الاتصال…' : state === 'err' ? 'المزامنة متعثّرة' : 'المزامنة بين الأجهزة'; }
const CSS = `#gsync{--sa:var(--c1,var(--acc,#ffc23d));box-sizing:border-box;width:min(560px,calc(100vw - 20px));max-height:min(92dvh,780px);margin:auto;padding:0;border:1px solid color-mix(in srgb,var(--sa) 45%,#000);border-radius:16px;background:#14110d;color:#f6efe2;overflow:hidden;font-size:1rem;line-height:1.75;text-align:start}
#gsync::backdrop{background:rgba(4,3,2,.74)}
#gsync *{box-sizing:border-box}
#gsync .gs{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin:0;padding:22px clamp(14px,4vw,26px) 22px;max-height:inherit;overflow-y:auto}
#gsync h2{margin:0;padding-inline-end:48px;font-size:1.45rem;line-height:1.35;font-weight:700;color:#fff}
#gsync p{margin:0}
#gsync .gs-state{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--sa)}
#gsync .gs-state::before{content:"";width:10px;height:10px;border-radius:50%;background:currentColor;flex:none}
#gsync[data-state=off] .gs-state{color:#a89f8e}
#gsync[data-state=err] .gs-state{color:#ff8f7a}
#gsync[data-state=on] .gs-state{color:#86d6b6}
#gsync .gs-dim{color:#b8ae9b;font-size:.9rem}
#gsync label{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;font-size:.92rem;color:#d9cfbd}
#gsync textarea,#gsync input{width:100%;min-width:0;margin:0;padding:10px 12px;border-radius:10px;border:1px solid #4a3f2c;background:#1e1912;color:#fff;font:inherit;font-size:.86rem;line-height:1.6;direction:ltr;text-align:left}
#gsync textarea{min-height:112px;resize:vertical}
#gsync input{height:46px}
#gsync :is(textarea,input):focus-visible,#gsync button:focus-visible{outline:2px solid var(--sa);outline-offset:2px}
#gsync button{font:inherit;cursor:pointer;min-height:46px;padding:8px 18px;border-radius:10px;font-weight:700;border:1px solid var(--sa);background:var(--sa);color:#17110a}
#gsync button.gs-quiet{background:transparent;color:#f6efe2;border-color:#5a4d36}
#gsync button.gs-x{position:absolute;top:10px;inset-inline-end:10px;min-height:0;width:44px;height:44px;padding:0;border-radius:50%;background:#221c14;color:#f6efe2;border-color:#4a3f2c;font-size:1.1rem;line-height:1}
#gsync .gs-err{padding:10px 12px;border-radius:10px;border:1px solid #7a3a30;background:#2a1512;color:#ffd0c6;font-size:.92rem}
#gsync .gs-err code{display:block;margin-top:8px;padding:8px 10px;border-radius:8px;background:#160b09;color:#fff;font-size:.8rem;direction:ltr;text-align:left;overflow-wrap:anywhere;user-select:all}
#gsync [hidden]{display:none}`;
let dlg = null;
function build() {
  document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);
  document.body.insertAdjacentHTML('beforeend', `<dialog id="gsync" aria-labelledby="gsync-h"><div class="gs">
    <button type="button" class="gs-x" data-gs="close" aria-label="إغلاق">✕</button>
    <h2 id="gsync-h">المزامنة بين الأجهزة</h2>
    <p class="gs-state" data-gs="state"></p>
    <div class="gs-err" data-gs="err" hidden></div>
    <div class="gs" style="padding:0;overflow:visible" data-gs="setup">
      <p>تقدّمك محفوظ الآن في هذا المتصفح فقط. بعد التفعيل يُحفظ في قاعدة بيانات <bdi dir="ltr">Firebase</bdi> خاصة بك، وكل علامة تضعها تصل أجهزتك الأخرى في لحظتها، في الأدلة الثلاثة.</p>
      <label><span>1. الصق <bdi dir="ltr">firebaseConfig</bdi> كاملاً</span><textarea data-gs="cfg" spellcheck="false" autocomplete="off" placeholder='apiKey: "…", projectId: "…", databaseURL: "…"'></textarea></label>
      <label><span>2. رابط قاعدة البيانات (يُملأ تلقائياً إن كان في النص)</span><input data-gs="url" type="url" spellcheck="false" autocomplete="off" placeholder="https://…-default-rtdb.….firebasedatabase.app"></label>
      <button type="button" data-gs="on">فعّل المزامنة</button>
      <p class="gs-dim">الإعداد يُحفظ في هذا المتصفح فقط، وتكرّره مرة واحدة في كل جهاز. تقدّمك الحالي لا يُمسح: ما على الجهاز وما في القاعدة يُدمجان.</p>
    </div>
    <div class="gs" style="padding:0;overflow:visible" data-gs="running">
      <p>كل علامة مشاهدة تُرسل فوراً وتصل أجهزتك الأخرى في لحظتها. والجهاز الذي يُفتح بعد انقطاع يأخذ ما فاته ويرسل ما عُلّم عليه.</p>
      <button type="button" class="gs-quiet" data-gs="off">أوقف المزامنة على هذا الجهاز</button>
      <p class="gs-dim">الإيقاف يُبقي تقدّمك على هذا الجهاز كما هو، ولا يمسح شيئاً من القاعدة.</p>
    </div>
  </div></dialog>`);
  dlg = document.getElementById('gsync'); const q = k => dlg.querySelector(`[data-gs="${k}"]`);
  q('cfg').addEventListener('input', () => { const c = parseCfg(q('cfg').value); if (c.databaseURL) q('url').value = c.databaseURL; });
  dlg.addEventListener('click', async e => { const b = e.target.closest('[data-gs]'); if (e.target === dlg) return dlg.close(); if (!b) return;
    if (b.dataset.gs === 'close') dlg.close();
    else if (b.dataset.gs === 'off') stop();
    else if (b.dataset.gs === 'on') { const c = q('cfg').value.trim() ? parseCfg(q('cfg').value) : cfgOf() || {}; if (q('url').value.trim()) c.databaseURL = q('url').value.trim().replace(/\/+$/, '');
      if (!c.apiKey || !c.projectId || !c.databaseURL) { problem = { text: 'الإعداد ناقص. تأكد أن النص فيه apiKey وprojectId، وأن رابط قاعدة البيانات مكتوب.' }; return paint(); }
      try { await app?.kill(); } catch {} app = null; fb = null; for (const k of Object.keys(last)) { delete last[k]; delete sent[k]; }
      if (!ls.set(CFG, JSON.stringify(c))) { problem = { text: 'تعذّر الحفظ في هذا المتصفح.' }; return paint(); }
      q('cfg').value = ''; start(c); } });
}
function paint() {
  for (const el of document.querySelectorAll('[data-sync-label]')) el.textContent = syncLabel();
  for (const el of document.querySelectorAll('[data-sync-open]')) el.dataset.syncState = state;
  if (!dlg) return; const q = k => dlg.querySelector(`[data-gs="${k}"]`), running = state === 'on' || state === 'wait';
  dlg.dataset.state = state;
  q('state').textContent = 'الحالة: ' + (state === 'on' ? (online ? 'تعمل' : 'بلا اتصال الآن، وتُستكمل عند عودته') : state === 'wait' ? 'جارٍ الاتصال…' : state === 'err' ? 'متعثّرة' : 'متوقفة');
  q('setup').hidden = running; q('running').hidden = !running;
  const er = q('err'); er.hidden = !problem; er.textContent = problem?.text || ''; if (problem?.code) er.insertAdjacentHTML('beforeend', `<code>${problem.code.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</code>`);
}
export function openSync() { if (!dlg) build(); if (state !== 'err') problem = ''; paint(); if (!dlg.open) dlg.showModal(); }

// onChange(id) يُستدعى بعد أن يُكتب في السجل المحلي تغيير جاء من جهاز آخر: على الصفحة أن تعيد قراءة سجلها وترسمه
let wired = false;
export function initSync(onChange) {
  if (onChange) handlers.add(onChange);
  if (wired) return paint(); wired = true;
  document.addEventListener('click', e => { if (e.target.closest('[data-sync-open]')) { e.preventDefault(); openSync(); } });
  paint(); const c = cfgOf(); if (c) start(c);
  addEventListener('online', async () => { const c = cfgOf(); if (state !== 'err' || !c) return; try { await app?.kill(); } catch {} app = null; fb = null; start(c); }); // تعثّر التحميل بلا إنترنت: نعيد المحاولة عند عودته
}
