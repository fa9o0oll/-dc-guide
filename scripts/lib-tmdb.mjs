// عميل TMDB مشترك: يقرأ المفتاح من البيئة، يحدّ التوازي، ويعيد المحاولة عند 429. لا يطبع المفتاح أبداً.
const KEY = (process.env.TMDB_API_KEY || '').trim();
export const hasKey = () => KEY.length > 0;
const bearer = KEY.length > 40; // رمز القراءة الطويل يُرسل كترويسة، والمفتاح القصير كمعامل
let active = 0; const queue = [];
const slot = () => new Promise(r => { const go = () => { active++; r(); }; active < 8 ? go() : queue.push(go); });
const release = () => { active--; queue.shift()?.(); };
export async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  if (!bearer) u.searchParams.set('api_key', KEY);
  await slot();
  try {
    for (let attempt = 1; ; attempt++) {
      let res;
      try { res = await fetch(u, { headers: bearer ? { Authorization: 'Bearer ' + KEY } : {} }); }
      catch (e) { if (attempt >= 4) throw new Error(`network error on ${path}: ${e.cause?.code || e.name}`); await new Promise(r => setTimeout(r, 800 * attempt)); continue; }
      if (res.status === 429 && attempt < 6) { await new Promise(r => setTimeout(r, (+res.headers.get('retry-after') || 2) * 1000)); continue; }
      if (res.status >= 500 && attempt < 4) { await new Promise(r => setTimeout(r, 800 * attempt)); continue; }
      if (!res.ok) { const e = new Error(`TMDB ${res.status} on ${path}`); e.status = res.status; throw e; }
      return res.json();
    }
  } finally { release(); }
}
