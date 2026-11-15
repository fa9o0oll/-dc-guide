// عميل IGDB المشترك بين البناء (GitHub Actions) ودالة «أضف لعبة» (Netlify): رمز دخول تطبيق تويتش يُطلب ويُحفظ في الذاكرة
// حتى قرب انتهائه، والطلبات بلغة Apicalypse، بحد IGDB: أربعة طلبات في الثانية وثمانية مفتوحة على الأكثر.
// المفاتيح: IGDB_CLIENT_ID وIGDB_CLIENT_SECRET (تطبيق في لوحة مطوري تويتش، نوعه Confidential).
export const IMG = 'https://images.igdb.com/igdb/image/upload/';
// المفتاحان كما لُصقا، بلا مسافة أو سطر جديد زائد في طرفيهما (يحدث كثيراً عند النسخ)
const ID = () => String(process.env.IGDB_CLIENT_ID || '').trim(), SECRET = () => String(process.env.IGDB_CLIENT_SECRET || '').trim();
export const hasIgdb = () => !!(ID() && SECRET());
let token = null, until = 0;
async function auth() {
  if (token && Date.now() < until) return token;
  const u = new URL('https://id.twitch.tv/oauth2/token');
  u.search = new URLSearchParams({ client_id: ID(), client_secret: SECRET(), grant_type: 'client_credentials' });
  const r = await fetch(u, { method: 'POST' });
  // رد تويتش يقول السبب بلا أسرار: «invalid client» (المعرّف خطأ) أو «invalid client secret» (السر خطأ أو أُلغي بسر أحدث)
  if (!r.ok) throw new Error(`twitch auth ${r.status}: ${(await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)}`);
  const j = await r.json(); token = j.access_token; until = Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000;
  return token;
}
// طابور بسيط: لا يبدأ أكثر من أربعة طلبات في كل ثانية، ولا يُفتح أكثر من ثمانية معاً
const starts = [], waiting = []; let open = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function slot() {
  for (;;) { const now = Date.now(); while (starts.length && now - starts[0] >= 1000) starts.shift();
    if (starts.length < 4 && open < 8) { starts.push(now); open++; return; }
    await sleep(starts.length >= 4 ? 1000 - (now - starts[0]) + 5 : 40); }
}
// استعلام واحد. 429 (تجاوز الحد) يُعاد بعد انتظار، و401 يجدد الرمز مرة. المكان في الطابور يُترك قبل الإعادة،
// فلا تنتظر الإعادات أماكن تحجزها هي نفسها
export async function igdb(endpoint, body, tries = 4) {
  for (let attempt = 0; ; attempt++) {
    await slot(); let r;
    try { r = await fetch('https://api.igdb.com/v4/' + endpoint, { method: 'POST', headers: { 'Client-ID': ID(), Authorization: `Bearer ${await auth()}`, Accept: 'application/json' }, body }); }
    finally { open--; }
    if (r.status === 429 && attempt < tries) { await sleep(1100 * (attempt + 1)); continue; }
    if (r.status === 401 && attempt < tries) { token = null; continue; }
    if (!r.ok) throw new Error(`igdb ${endpoint} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
}
// كل النتائج لاستعلام طويل القائمة (where id = (...)) بأجزاء من 500
export async function igdbAll(endpoint, fields, ids, extra = '') {
  const out = [], list = [...new Set(ids)].filter(Boolean);
  await Promise.all(Array.from({ length: Math.ceil(list.length / 400) }, (_, i) => list.slice(i * 400, i * 400 + 400)).map(async part =>
    out.push(...await igdb(endpoint, `fields ${fields}; where id = (${part.join(',')})${extra}; limit 500;`))));
  return out;
}
// نص آمن داخل استعلام: علامات التنصيص والشرطة المائلة
export const quote = s => '"' + String(s).replace(/["\\]/g, ' ').trim() + '"';
// السنة والتاريخ من طابع IGDB (ثوانٍ)
export const ymd = t => t ? new Date(t * 1000).toISOString().slice(0, 10) : null;
export const year = t => t ? new Date(t * 1000).getUTCFullYear() : null;
