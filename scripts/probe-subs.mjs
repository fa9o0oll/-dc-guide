// استكشاف مصادر الاشتراكات لـ«ألعابي» (Game Pass Ultimate وPS Plus) في بناء فروع العمل وحدها (GAMES_PROBE=1): يطبع ما يجده ولا يكتب شيئاً.
// يُحذف حين تثبت المصادر في scripts/lib-subs.mjs
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const say = (...a) => console.log('subs-probe:', ...a);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
async function txt(u, h = {}) { try { const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.8', ...h }, signal: AbortSignal.timeout(30000), redirect: 'follow' }); return { s: r.status, t: await r.text(), u: r.url }; } catch (e) { return { s: 0, t: String(e?.message || e) }; } }
const around = (t, re, n = 4, w = 150) => { const out = [], r = new RegExp(re, 'gi'); let m; while ((m = r.exec(t)) && out.length < n) out.push(t.slice(Math.max(0, m.index - w), m.index + w).replace(/\s+/g, ' ')); return out; };
const scripts = (t, base) => [...new Set([...t.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m => { try { return new URL(m[1].replace(/&amp;/g, '&'), base).href; } catch { return null; } }).filter(Boolean))];

export async function probeSubs() {
  // ---------- Xbox: قوائم Game Pass (sigls) من صفحات xbox.com وملفات سكربتها، ثم اسم كل قائمة وعددها في متجر السعودية
  const found = new Set(['f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e', 'fdd9e2a7-0fee-49f6-ad69-4354098401ff', '29a81209-df6f-41fd-a528-2ae6b91f719c', '609d944c-d395-4c0a-9ea4-e9f39b52c1ad', 'b8900d09-a491-44cc-916e-32b5acae621b', '1d33fbb9-b895-4732-a8ca-a55c8b99fa2c', '393f05bf-e596-4ef6-9487-6d4fa0eab987']);
  for (const page of ['https://www.xbox.com/en-US/xbox-game-pass/games', 'https://www.xbox.com/en-US/xbox-game-pass/ultimate', 'https://www.xbox.com/ar-SA/xbox-game-pass/games']) {
    const p = await txt(page), ids = [...new Set((p.t.match(UUID) || []).map(x => x.toLowerCase()))];
    say(`xbox page ${page} -> ${p.s} ${p.t.length}b, ${ids.length} uuids, sigl: ${around(p.t, 'sigl', 3, 120).join(' || ').slice(0, 900)}`);
    for (const id of ids.slice(0, 40)) found.add(id);
    const js = scripts(p.t, page); say(`xbox page scripts ${js.length}: ${js.slice(0, 30).map(u => u.split('/').pop()).join(' ')}`);
    for (const u of js.slice(0, 30)) { const s = await txt(u); if (!/sigl/i.test(s.t)) continue;
      const near = around(s.t, 'sigl', 12, 220).join(' || '), got = [...new Set((near.match(UUID) || []).map(x => x.toLowerCase()))];
      say(`xbox script ${u.split('/').pop()} (${s.t.length}b) sigl uuids: ${got.join(' ')} :: ${near.slice(0, 1500)}`); for (const id of got) found.add(id); } }
  for (const id of found) for (const market of ['SA', 'US']) {
    const r = await txt(`https://catalog.gamepass.com/sigls/v2?id=${id}&language=en-us&market=${market}`, { accept: 'application/json' }); let j = null; try { j = JSON.parse(r.t); } catch {}
    if (!Array.isArray(j)) { say(`sigl ${id} ${market}: ${r.s} ${r.t.slice(0, 120)}`); continue; }
    const head = j.find(x => x.siglId) || {}, n = j.filter(x => x.id).length; say(`sigl ${id} ${market}: ${r.s} "${head.title || ''}" — ${String(head.description || '').slice(0, 120)} — ${n} ids, first ${j.filter(x => x.id).slice(0, 3).map(x => x.id).join(',')}`);
    if (market === 'SA' && n) break; }

  // ---------- PlayStation: صفحة ألعاب PS Plus في السعودية، وما تستدعيه من بيانات، ثم واجهة المتجر (categoryGridRetrieve)
  const psPage = 'https://www.playstation.com/en-sa/ps-plus/games/', ps = await txt(psPage), cats = new Set();
  say(`ps page ${ps.s} ${ps.t.length}b; ` + ['gameslist', 'imagic', 'categoryList', 'GAME_CATALOG', 'CLASSICS_CATALOG', 'graphql', 'categoryId', 'data-api', 'json'].map(k => `${k}: ${around(ps.t, k, 2, 130).join(' || ')}`).join(' ### ').slice(0, 3500));
  for (const id of (ps.t.match(UUID) || []).map(x => x.toLowerCase())) cats.add(id);
  const pjs = scripts(ps.t, psPage); say(`ps page scripts ${pjs.length}: ${pjs.slice(0, 30).map(u => u.split('/').pop()).join(' ')}`);
  for (const u of pjs.slice(0, 30)) { const s = await txt(u); const hit = ['gameslist', 'imagic', 'categoryList', 'GAME_CATALOG', 'categoryGridRetrieve', 'sha256Hash'].filter(k => s.t.includes(k)); if (!hit.length) continue;
    say(`ps script ${u.split('/').pop()} (${s.t.length}b) has ${hit.join(',')}: ${hit.map(k => around(s.t, k, 3, 200).join(' || ')).join(' ### ').slice(0, 2500)}`); for (const id of (s.t.match(UUID) || []).slice(0, 30)) cats.add(id.toLowerCase()); }
  for (const cl of ['plus-games-list', 'plus-classics-list', 'plus-monthly-games-list', 'ps-plus-games-list', 'game-catalog']) for (const loc of ['en-sa', 'en-us']) {
    const r = await txt(`https://www.playstation.com/bin/imagic/gameslist?locale=${loc}&categoryList=${cl}`, { accept: 'application/json' }); say(`ps gameslist ${loc} ${cl}: ${r.s} ${r.t.length}b ${r.t.slice(0, 300).replace(/\s+/g, ' ')}`); }
  for (const id of ['05a2d027-cedc-4ac0-abeb-8fc26fec7180', '3f772501-f6f8-49b7-abac-874a88ca4897', 'dc464929-edee-48a5-bcd3-1e6f5250ae80', '3a7006fe-e26f-49fe-87e5-4473d7ed0fb2', '44d8bb20-653e-431e-8ad0-c0a365f68d2f']) cats.add(id);
  for (const id of [...cats].slice(0, 40)) for (const hash of ['9845afc0dbaab4965f6563fffc703f588c8e76792000e8610843b8d3ee9c4c09', '4ce7d410a4db2c8b635a48c1dcec375906ff63b19dadd87e073f8fd0c0481d35']) {
    const v = { id, pageArgs: { size: 24, offset: 0 }, sortBy: null, filterBy: [], facetOptions: [] }, e = { persistedQuery: { version: 1, sha256Hash: hash } };
    const r = await txt(`https://web.np.playstation.com/api/graphql/v1/op?operationName=categoryGridRetrieve&variables=${encodeURIComponent(JSON.stringify(v))}&extensions=${encodeURIComponent(JSON.stringify(e))}`, { 'x-psn-store-locale-override': 'en-SA', 'content-type': 'application/json', accept: 'application/json' });
    let j = null; try { j = JSON.parse(r.t); } catch {} const g = j?.data?.categoryGridRetrieve;
    say(`ps grid ${id} ${hash.slice(0, 6)}: ${r.s} ${g ? `total ${g.pageInfo?.totalCount} :: ${(g.products || []).slice(0, 4).map(p => `${p.name} [${(p.platforms || []).join('/')}] ${p.id || ''}`).join(' | ')}` : r.t.slice(0, 200).replace(/\s+/g, ' ')}`);
    if (g) { say(`ps grid ${id} keys: ${Object.keys(g).join(',')} product keys: ${Object.keys(g.products?.[0] || {}).join(',')}`); break; } }
}
