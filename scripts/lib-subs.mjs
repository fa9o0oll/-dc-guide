// اشتراكات «ألعابي»: هل اللعبة ضمن Xbox Game Pass Ultimate أو PlayStation Plus Deluxe الآن (اشتراكا صاحب الموقع، وهما أعلى فئتين في السعودية).
// يُحسب في البناء لكل لعبة، بلا مفاتيح، من الكتالوجين نفسيهما لمتجر السعودية:
//   • Game Pass: قوائم كتالوج Game Pass (catalog.gamepass.com/sigls، market=SA): ألعاب الأجهزة، وألعاب الكمبيوتر (قائمتان)، وEA Play (قائمتان)،
//     والقائمة الجامعة «كل الألعاب»، و«تغادر قريباً». تُطابَق بأرقام Microsoft Store التي في IGDB، ثم بالاسم من فهرس Microsoft حين لا يطابق الاسم
//     غير لعبة واحدة في القائمة. والسحابة ليست هنا: قائمتها فارغة في السعودية. ومنصات ما في EA Play والقائمة الجامعة من حزم المنتج في الفهرس
//   • PS Plus: قوائم playstation.com لمتجر السعودية (bin/imagic/gameslist?locale=en-sa): كتالوج الألعاب وكلاسيكيات Ubisoft+ (من Extra فما فوق)،
//     والكلاسيكيات (Deluxe)، وألعاب الشهر (كل الفئات، تُضاف إلى المكتبة خلال شهرها). تُطابَق برقم «المفهوم» في PlayStation Store (من IGDB)، ثم بالاسم
//     (الاسم نفسه أو بطبعة منه، بلا لواحق المنصة) حين لا يطابق غير لعبة واحدة في القائمة
// ما لم يُجب من المصدرين يبقى له ما كان في البناء السابق (opt.prev)، فلا يُمحى اشتراك لأن مصدره لم يُجب.
import { client, msCatalog, norm, sameGame, slugify } from './lib-stores.mjs';

export const GP = { console: 'f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e', pc: 'fdd9e2a7-0fee-49f6-ad69-4354098401ff', pc2: '609d944c-d395-4c0a-9ea4-e9f39b52c1ad',
  all: '97c6c862-d28a-4907-a3d5-c401f2296a53', eaA: 'b8900d09-a491-44cc-916e-32b5acae621b', eaB: '1d33fbb9-b895-4732-a8ca-a55c8b99fa2c', leaving: '393f05bf-e596-4ef6-9487-6d4fa0eab987' };
export const PSL = { extra: 'plus-games-list', ubi: 'ubisoft-classics-list', deluxe: 'plus-classics-list', month: 'plus-monthly-games-list' };
const PS_RANK = ['extra', 'ubi', 'month', 'deluxe'];   // لعبة في أكثر من قائمة: أبقاها في الكتالوج أولاً
const PLAT = { PS5: 'ps5', PS4: 'ps4', PS3: 'ps3', PS2: 'ps2', PS1: 'ps1', PSONE: 'ps1', PSP: 'psp', PSVITA: 'vita', VITA: 'vita', PSVR: 'psvr', PSVR2: 'psvr2' };
const wait = ms => new Promise(r => setTimeout(r, ms));
// المطابقة بالاسم: الاسم نفسه وسنته قريبة من سنتها (لا تُطابَق «Doom» القديمة بـ«DOOM» الجديدة)، أو طبعة منه صدرت معها أو بعدها (إعادة إصدار مثلاً)
const named = (g, name, year) => { if (!sameGame(g.title, name)) return false; const gy = +g.year || 0; if (!gy || !year) return true; return norm(name) === norm(g.title) ? Math.abs(year - gy) <= 2 : year >= gy - 1; };
const psYear = x => +String(x.releaseDate ?? x.releasedate ?? x.release_date ?? x.date ?? '').slice(0, 4) || 0;

async function sigl(id, get) { const r = await get(`https://catalog.gamepass.com/sigls/v2?id=${id}&language=en-us&market=SA`);
  return r.status === 200 && Array.isArray(r.body) ? { title: r.body.find(x => x.siglId)?.title || '', ids: r.body.map(x => x.id).filter(x => /^[A-Z0-9]{12}$/.test(x || '')) } : null; }
async function psList(key, get) { const r = await get(`https://www.playstation.com/bin/imagic/gameslist?locale=en-sa&categoryList=${key}`, { timeout: 45000 });
  return r.status === 200 && Array.isArray(r.body) ? r.body.flatMap(x => Array.isArray(x?.games) ? x.games : []) : null; }
// منصات المدخل في قائمة PlayStation، أياً كان اسم حقلها
const psPlats = x => [...new Set([].concat(x.device ?? x.devices ?? x.platforms ?? x.platform ?? []).map(p => PLAT[String(p).toUpperCase().replace(/[^A-Z0-9]/g, '')]).filter(Boolean))];
// اسم المدخل بلا لواحق المنصة: «(PS4)»، «PS4 & PS5»، «PlayStation®5 Edition»
export const psName = s => String(s || '').replace(/[™®©]/g, '').replace(/\(\s*(?:ps\s?[1-5]|playstation\s?[1-5]|ps\s?vr2?|ps4\s*(?:&|and|\/)\s*ps5|ps5\s*(?:&|and|\/)\s*ps4)\s*\)/gi, ' ')
  .replace(/[-–:]?\s*\b(?:ps4\s*(?:&|and|\/)\s*ps5|ps5\s*(?:&|and|\/)\s*ps4|playstation\s?[45](?:\s*(?:&|and)\s*playstation\s?[45])?|ps\s?vr2?|ps[45])\b(?:\s*(?:edition|version))?/gi, ' ').replace(/\s+/g, ' ').trim();

// الجمع. يعيد: rows (رقم اللعبة ← { gp?, ps? })، meta (متى فُحصت وأي المصدرين لم يُجب، وعددهما)، report (للمراجعة)
// gp: { on: ['xbox', 'pc'], u: رابطها في متجر Xbox, ea?: 1 (عبر EA Play), out?: 1 (تغادر قريباً), n?: اسمها في الكتالوج حين يختلف }
// ps: { k: 'extra' | 'ubi' | 'deluxe' | 'month', on: ['ps5', 'ps4', …], u: صفحتها في PlayStation Store, n?: اسمها في الكتالوج حين يختلف }
export async function subsFor(games, opt = {}) {
  const get = client(opt), pause = opt.pause ?? 400, now = opt.now ?? Date.now(), log = opt.log || (() => {}), prev = opt.prev || new Map(), failed = [];
  const site = (g, t) => (g.sites || []).find(s => s.t === t)?.url || '';
  const msIds = g => [...new Set([g.ext?.xbox, ...(g.ext?.ms || []), site(g, 'xstore').split(/[/?#]/).filter(Boolean).pop()?.toUpperCase()].filter(x => /^[A-Z0-9]{12}$/.test(x || '')))];
  const report = { at: new Date(now).toISOString(), failed, lists: {}, games: {}, byTitle: [], sample: {} };

  // ---------- Game Pass
  const L = {}; for (const [k, id] of Object.entries(GP)) { L[k] = await sigl(id, get); report.lists['gp.' + k] = L[k] ? `${L[k].title} (${L[k].ids.length})` : 'FAILED'; await wait(pause / 2); }
  const gpOk = !!(L.console && (L.pc || L.pc2)), set = k => new Set(L[k]?.ids || []);
  const con = set('console'), pc = new Set([...set('pc'), ...set('pc2')]), ea = new Set([...set('eaA'), ...set('eaB')]), leaving = set('leaving');
  const every = new Set([...con, ...pc, ...ea, ...set('all')]);
  if (!gpOk) failed.push('gamepass');
  const cat = every.size ? await msCatalog([...every], get, pause) : { out: new Map(), ok: true }; if (!cat.ok) failed.push('gamepass-titles');
  const gpRow = (g, ids) => { const ps = ids.map(id => cat.out.get(id) || { id, title: '' }), on = new Set();
    for (const p of ps) { if (con.has(p.id)) on.add('xbox'); if (pc.has(p.id)) on.add('pc'); if (!con.has(p.id) && !pc.has(p.id)) { if (p.con) on.add('xbox'); if (p.pc) on.add('pc'); } }
    const best = ps.find(p => con.has(p.id) || pc.has(p.id)) || ps[0], x = site(g, 'xstore'), name = best.title && norm(best.title) !== norm(g.title) ? best.title : '';
    return { on: ['xbox', 'pc'].filter(k => on.has(k)), u: x && x.toUpperCase().includes(best.id) ? x : `https://www.xbox.com/games/store/${slugify(best.title || g.title)}/${best.id}`,
      ...(ps.some(p => ea.has(p.id)) && !ps.some(p => (con.has(p.id) || pc.has(p.id)) && !ea.has(p.id)) ? { ea: 1 } : {}), ...(ps.some(p => leaving.has(p.id)) ? { out: 1 } : {}), ...(name ? { n: name } : {}) }; };
  // بالاسم: منتج في الكتالوج لا يحمل رقمه أحد من القائمة، واسمه اسم لعبة واحدة فيها (أو طبعة منها)
  const own = new Set(games.flatMap(msIds)), gpByName = new Map();
  for (const p of cat.out.values()) { if (own.has(p.id) || !p.title) continue; const hit = games.filter(g => named(g, p.title, p.year)); if (hit.length === 1) { const l = gpByName.get(hit[0].id) || []; l.push(p.id); gpByName.set(hit[0].id, l); } }

  // ---------- PS Plus
  const P = {}; for (const [k, key] of Object.entries(PSL)) { P[k] = await psList(key, get); report.lists['ps.' + k] = P[k] ? String(P[k].length) : 'FAILED'; if (P[k]?.[0]) report.sample[k] = P[k][0]; await wait(pause / 2); }
  const psOk = !!(P.extra && P.deluxe); if (!psOk) failed.push('psplus');
  const psEntries = PS_RANK.flatMap(k => (P[k] || []).map(x => ({ ...x, k })));
  const byConcept = new Map(); for (const x of psEntries) { const c = String(x.conceptId ?? ''); if (c) (byConcept.get(c) || byConcept.set(c, []).get(c)).push(x); }   // المفهوم الواحد قد يكون في أكثر من قائمة
  const psRow = (g, list) => { list = [...list].sort((a, b) => PS_RANK.indexOf(a.k) - PS_RANK.indexOf(b.k)); const x = list[0], name = x.nameEn || x.name || '', clean = psName(name);
    return { k: x.k, on: [...new Set(list.flatMap(psPlats))], u: x.conceptUrl || (x.conceptId ? `https://store.playstation.com/en-sa/concept/${x.conceptId}` : ''), ...(clean && norm(clean) !== norm(g.title) ? { n: clean } : {}) }; };
  const psByName = new Map();
  for (const grp of [...byConcept.values(), ...psEntries.filter(x => x.conceptId == null).map(x => [x])]) { const names = [...new Set(grp.flatMap(x => [x.nameEn, x.name]).map(psName).filter(Boolean))];
    const hit = games.filter(g => names.some(n => named(g, n, psYear(grp[0])))); if (hit.length !== 1) continue; const l = psByName.get(hit[0].id) || []; l.push(...grp); psByName.set(hit[0].id, l); }

  // ---------- لكل لعبة
  const rows = new Map();
  for (const g of games) { const row = {}, old = prev.get(g.id) || {}, how = {};
    { const mine = msIds(g).filter(id => every.has(id)), byN = gpByName.get(g.id) || [];
      if (mine.length) row.gp = gpRow(g, mine); else if (byN.length) { row.gp = gpRow(g, byN); how.gp = 1; report.byTitle.push(`gp ${byN.join(',')} "${cat.out.get(byN[0])?.title}" → ${g.title}`); }
      else if (!gpOk && old.gp) row.gp = old.gp; }   // الكتالوج لم يُجب: يبقى ما كان
    { const c = g.ext?.psn && byConcept.get(String(g.ext.psn)), byN = psByName.get(g.id) || [];
      if (c) row.ps = psRow(g, [...c, ...byN.filter(x => !c.includes(x))]); else if (byN.length) { row.ps = psRow(g, byN); how.ps = 1; report.byTitle.push(`ps ${byN.map(x => x.conceptId).join(',')} "${byN[0].nameEn || byN[0].name}" → ${g.title}`); }
      else if (!psOk && old.ps) row.ps = old.ps; }
    if (row.gp || row.ps) rows.set(g.id, row);
    const gpT = row.gp ? `gp:${row.gp.on.join('+') || '?'}${row.gp.ea ? ':ea' : ''}${row.gp.out ? ':leaving' : ''}${how.gp ? '~title' : ''}${row.gp.n ? `(${row.gp.n})` : ''}` : '', psT = row.ps ? `ps:${row.ps.k}:${row.ps.on.join('+') || '?'}${how.ps ? '~title' : ''}${row.ps.n ? `(${row.ps.n})` : ''}` : '';
    report.games[g.title] = [gpT, psT].filter(Boolean).join(' ') || '—'; }
  const n = { gp: [...rows.values()].filter(r => r.gp).length, ps: [...rows.values()].filter(r => r.ps).length };
  log(`subs: ${games.length} games: Game Pass ${n.gp} (${[...rows.values()].filter(r => r.gp?.out).length} leaving soon, ${[...rows.values()].filter(r => r.gp?.ea).length} via EA Play), PS Plus ${n.ps} (${PS_RANK.map(k => `${k} ${[...rows.values()].filter(r => r.ps?.k === k).length}`).join(', ')}); lists ${Object.entries(report.lists).map(([k, v]) => `${k} ${v}`).join(', ')}${failed.length ? '; FAILED: ' + failed.join(', ') : ''}`);
  return { rows, meta: { at: report.at, n, ...(failed.length ? { failed } : {}) }, report };
}
