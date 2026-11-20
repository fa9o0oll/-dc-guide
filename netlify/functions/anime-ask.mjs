// دالة «ترجمها لي» في «أنمياتي» (/api/anime-ask): تسجّل طلب ترجمة نبذة عمل (about) أو حلقاته (eps) في data/anime/requests.json على فرع requests،
// لا على main، فلا يعيد بناء الموقع ولا نشره. المترجم (docs/GAMES-CARE.md، قسم «أنمياتي») يقرأ الفرع ويبدأ بما طُلب: node scripts/anime-care.mjs asked
// محمية بكلمة سر «أضف لعبة» (ADD_GAME_PASSWORD، وإن لم توجد فكلمة سر «أضف فيلماً» ADD_FILM_PASSWORD). GH_TOKEN رمز GitHub بصلاحية الكتابة على المستودع.
// المفاتيح تُقرأ من متغيرات Netlify ولا تُكتب في أي ملف. ولا يصل من سجل صاحب الموقع شيء: رقم العمل في MyAnimeList واسمه ونوع الطلب فقط.
import { createHash, timingSafeEqual } from 'node:crypto';

const REPO = process.env.GH_REPO || 'fa9o0oll/-dc-guide', BRANCH = 'main', REQ_BRANCH = 'requests', REQ_FILE = 'data/anime/requests.json', KEEP = 800;
export const WHAT = ['about', 'eps'];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const wait = ms => new Promise(r => setTimeout(r, ms));
const password = () => process.env.ADD_GAME_PASSWORD || process.env.ADD_FILM_PASSWORD;

// يكتب الطلب في ملف الطلبات على فرع requests (يُنشأ الفرع من رأس main إن لم يوجد). يعيد true إن سُجّل، وfalse إن كان مطلوباً من قبل.
// يعيد المحاولة إن تغيّر الملف بين القراءة والكتابة
export async function request(mal, what, title) {
  const api = `https://api.github.com/repos/${REPO}`, file = `${api}/contents/${REQ_FILE}`, gh = st => Object.assign(new Error('GitHub ' + st), { gh: st });
  const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'watch-guide-anime-ask' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await fetch(`${file}?ref=${REQ_BRANCH}`, { headers }); let doc = { ar: [] }, sha;
    if (cur.status === 200) { const j = await cur.json(); sha = j.sha; try { doc = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch {} if (!doc || !Array.isArray(doc.ar)) doc = { ar: [] }; }
    else if (cur.status === 404) {   // الملف غير موجود، أو الفرع نفسه
      const br = await fetch(`${api}/git/ref/heads/${REQ_BRANCH}`, { headers });
      if (br.status === 404) { const main = await fetch(`${api}/git/ref/heads/${BRANCH}`, { headers }); if (!main.ok) throw gh(main.status);
        const mk = await fetch(`${api}/git/refs`, { method: 'POST', headers, body: JSON.stringify({ ref: `refs/heads/${REQ_BRANCH}`, sha: (await main.json()).object.sha }) }); if (!mk.ok && mk.status !== 422) throw gh(mk.status); }
      else if (!br.ok) throw gh(br.status);
    } else throw gh(cur.status);
    if (doc.ar.some(x => +x.mal === mal && x.what === what)) return false;
    doc.ar = [...doc.ar, { mal, what, title, at: new Date().toISOString() }].slice(-KEEP);
    const put = await fetch(file, { method: 'PUT', headers, body: JSON.stringify({ message: `anime: translate ${what === 'eps' ? 'episodes of ' : ''}${title || '#' + mal}`, branch: REQ_BRANCH, ...(sha ? { sha } : {}), content: Buffer.from(JSON.stringify(doc, null, 1) + '\n').toString('base64') }) });
    if (put.ok) return true;
    if (put.status !== 409 && put.status !== 422) throw gh(put.status);
    await wait(400);
  }
  throw new Error('GitHub conflict');
}

export default async req => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!password()) return json(500, { error: 'إعدادات الخادم ناقصة: كلمة السر (ADD_GAME_PASSWORD أو ADD_FILM_PASSWORD) غير موجودة في Netlify.' });
  let b; try { b = await req.json(); } catch { return json(400, { error: 'طلب غير صالح.' }); }
  if (!b?.password || !same(b.password, password())) { await wait(700); return json(401, { error: 'password' }); }
  const mal = +b.mal, what = String(b.what || ''), title = String(b.title || '').replace(/[^\p{L}\p{N} .,:;!?'’&()+\-\/☆]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!Number.isInteger(mal) || mal <= 0 || mal > 9999999 || !WHAT.includes(what)) return json(400, { error: 'طلب غير صالح.' });
  if (!process.env.GH_TOKEN) return json(500, { error: 'إعدادات الخادم ناقصة: GH_TOKEN غير موجود في Netlify.' });
  try { return json(200, { state: await request(mal, what, title) ? 'asked' : 'exists' }); }
  catch (e) { if (e.gh === 401 || e.gh === 403 || e.gh === 404) return json(502, { error: 'تعذّر تسجيل الطلب في GitHub: الرمز GH_TOKEN غير صالح أو بلا صلاحية الكتابة على المستودع.' });
    console.error(e); return json(502, { error: 'تعذّر تسجيل الطلب الآن. حاول بعد قليل.' }); }
};
export const config = { path: '/api/anime-ask' };
