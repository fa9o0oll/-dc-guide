// استكشاف قوائم Game Pass الأخرى (القادمة قريباً، والمغادرة، والسحابة) في بناء فروع العمل وحده (GAMES_PROBE=1): يطبع ما يجده ولا يكتب شيئاً.
// القوائم الثابتة في scripts/lib-subs.mjs، وهذا يُحذف حين تكتمل
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const say = (...a) => console.log('subs-probe:', ...a);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
async function txt(u, h = {}) { try { const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.8', ...h }, signal: AbortSignal.timeout(30000), redirect: 'follow' }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: String(e?.message || e) }; } }
const scripts = (t, base) => [...new Set([...t.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m => { try { return new URL(m[1].replace(/&amp;/g, '&'), base).href; } catch { return null; } }).filter(Boolean))];

export async function probeSubs() {
  const page = 'https://www.xbox.com/en-US/xbox-game-pass/games', p = await txt(page), seen = new Map();
  for (const u of scripts(p.t, page).filter(u => /xgpcat|featuredGames|xcat/i.test(u))) { const s = await txt(u);
    for (const m of s.t.matchAll(UUID)) { const id = m[0].toLowerCase(); if (seen.has(id)) continue; seen.set(id, s.t.slice(Math.max(0, m.index - 90), m.index).replace(/\s+/g, ' ')); } }
  say(`xbox ids in catalog scripts: ${seen.size}`);
  for (const [id, before] of seen) { const r = await txt(`https://catalog.gamepass.com/sigls/v2?id=${id}&language=en-us&market=SA`, { accept: 'application/json' }); let j = null; try { j = JSON.parse(r.t); } catch {}
    if (!Array.isArray(j)) continue; const head = j.find(x => x.siglId) || {}; say(`sigl ${id} "${head.title || ''}" ${j.filter(x => x.id).length} ids :: …${before}`); }
}
