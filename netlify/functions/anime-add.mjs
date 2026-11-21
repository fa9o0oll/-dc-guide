// دالة «أضف أنمي» في «أنمياتي» (/api/anime-add): تضيف عملاً ليس في «أنمياتي» إلى data/anime/list.json (أرقام MyAnimeList بترتيب قائمة صاحب الموقع) على main،
// بإيداع عنوانه يحمل [skip ci]: لا يعيد البناء ولا النشر الآن، وبناء الليل يسحب معلومات العمل وحلقاته فيظهر في القائمة. ما في «أنمياتي» أصلاً يدخل السجل من الصفحة بلا هذه الدالة.
// محمية بكلمة سر «أضف لعبة» (ADD_GAME_PASSWORD، وإن لم توجد فكلمة سر «أضف فيلماً» ADD_FILM_PASSWORD). GH_TOKEN رمز GitHub بصلاحية الكتابة على المستودع.
// المفاتيح تُقرأ من متغيرات Netlify ولا تُكتب في أي ملف. ولا يصل من سجل صاحب الموقع شيء: رقم العمل في MyAnimeList واسمه ونوعه وعدد حلقاته، كما يكتبها scripts/anime-list.mjs --add.
import { createHash, timingSafeEqual } from 'node:crypto';

const REPO = process.env.GH_REPO || 'fa9o0oll/-dc-guide', BRANCH = 'main', FILE = 'data/anime/list.json';
export const TYPES = ['TV', 'Movie', 'OVA', 'ONA', 'Special', 'TV Special', 'Music', 'PV', 'CM'];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const digest = x => createHash('sha256').update(String(x)).digest(), same = (a, b) => timingSafeEqual(digest(a), digest(b));
const wait = ms => new Promise(r => setTimeout(r, ms));
const password = () => process.env.ADD_GAME_PASSWORD || process.env.ADD_FILM_PASSWORD;
// كما في scripts/anime-list.mjs: سطر لكل عمل، وما ليس من ملف MyAnimeList يأخذ موضعه من ترتيب الأسماء الذي يرتب به MyAnimeList القائمة
const write = list => '[\n' + list.map(x => JSON.stringify(x)).join(',\n') + '\n]\n', up = s => String(s).toUpperCase();
export const place = (list, p) => { const i = list.findIndex(x => up(x.title) > up(p.title)); list.splice(i < 0 ? list.length : i, 0, p); return list; };

// يضيف العمل إلى القائمة في المستودع. يعيد true إن أُضيف، وfalse إن كان فيها. يعيد المحاولة إن تغيّر الملف بين القراءة والكتابة
export async function add(entry) {
  const file = `https://api.github.com/repos/${REPO}/contents/${FILE}`, gh = st => Object.assign(new Error('GitHub ' + st), { gh: st });
  const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'watch-guide-anime-add' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await fetch(`${file}?ref=${BRANCH}`, { headers }); if (!cur.ok) throw gh(cur.status);
    const j = await cur.json(); let list; try { list = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch {}
    if (!Array.isArray(list) || !list.length) throw Object.assign(new Error('list.json'), { broken: true });   // لا تُكتب قائمة فوق ملف لم يُقرأ
    if (list.some(x => +x.mal === entry.mal)) return false;
    const put = await fetch(file, { method: 'PUT', headers, body: JSON.stringify({ message: `anime: add ${entry.title} (#${entry.mal}) [skip ci]`, branch: BRANCH, sha: j.sha,
      content: Buffer.from(write(place(list, entry))).toString('base64') }) });
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
  const mal = +b.mal, title = String(b.title || '').replace(/[\p{C}<>"`\\]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);   // أسماء MyAnimeList فيها @ و☆ و【】 وغيرها
  const type = TYPES.includes(b.type) ? b.type : 'TV', eps = Number.isInteger(+b.eps) && +b.eps >= 0 && +b.eps <= 5000 ? +b.eps : 0;
  if (!Number.isInteger(mal) || mal <= 0 || mal > 9999999 || !title) return json(400, { error: 'طلب غير صالح.' });
  if (!process.env.GH_TOKEN) return json(500, { error: 'إعدادات الخادم ناقصة: GH_TOKEN غير موجود في Netlify.' });
  try { return json(200, { state: await add({ mal, title, type, eps }) ? 'added' : 'exists' }); }
  catch (e) { if (e.gh === 401 || e.gh === 403 || e.gh === 404) return json(502, { error: 'تعذّرت الإضافة في GitHub: الرمز GH_TOKEN غير صالح أو بلا صلاحية الكتابة على المستودع.' });
    if (e.broken) return json(502, { error: 'تعذّرت قراءة قائمة الأعمال في المستودع، فلم يُكتب شيء.' });
    console.error(e); return json(502, { error: 'تعذّرت الإضافة الآن. حاول بعد قليل.' }); }
};
export const config = { path: '/api/anime-add' };
