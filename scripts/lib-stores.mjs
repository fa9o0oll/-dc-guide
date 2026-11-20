// متاجر الكمبيوتر ومشغّلاته لـ«ألعابي»: أين تُلعب اللعبة على الكمبيوتر، وهل هي مجانية الآن. يُحسب في البناء لكل لعبة لها نسخة كمبيوتر:
//   • Steam: رقمها من IGDB، وحالها من واجهة المتجر بأسعار السعودية (cc=sa): مجانية اللعب، أو هدية (خصم كامل)، أو غير متاحة في متجر السعودية، أو أُزيلت
//   • Epic Games Store: رابطها من IGDB (أو Wikidata)، والهدايا الأسبوعية الحالية والقادمة من قائمة Epic لمتجر السعودية
//   • GOG: رقمها من IGDB، وصفحتها وسعرها بالريال من واجهة GOG
//   • Xbox (تطبيق Xbox وMicrosoft Store): أرقامها من IGDB، وهل لها حزمة للكمبيوتر وسعرها من فهرس Microsoft، وهل هي ضمن PC Game Pass
//     (ما في PC Game Pass برقم غير الذي في IGDB يُطابَق باسمه حين لا يحمل الاسم غير لعبة واحدة في القائمة)
//   • مشغّلات الناشرين (Ubisoft Connect، EA app، Rockstar Games Launcher، Battle.net): من اسم الناشر في IGDB أو من «يوزَّع عبر» في Wikidata
//   • data/games/pc.json: تصحيح باليد يضيف متجراً أو يحذفه للعبة بعينها
// ما تعذّر الوصول إليه من المصادر يبقى له ما كان في البناء السابق (opt.prev)، ولا يُمحى متجر لأن مصدره لم يُجب.
const UA = 'watch-guide-games/1.0 (+https://github.com/fa9o0oll/-dc-guide)';
export const STORES = ['steam', 'epic', 'gog', 'xbox', 'battlenet', 'ea', 'ubi', 'rockstar', 'itch', 'other'];
const HOME = { ubi: 'https://store.ubisoft.com/', ea: 'https://www.ea.com/games', rockstar: 'https://www.rockstargames.com/games', battlenet: 'https://shop.battle.net/' };
const OWN = { ubi: /(^|\.)(ubisoft|ubi)\.com$/, ea: /(^|\.)ea\.com$/, rockstar: /(^|\.)rockstargames\.com$/, battlenet: /(^|\.)(blizzard\.com|battle\.net|callofduty\.com)$/ };
// الناشر الذي له مشغّله: ألعابه على الكمبيوتر كلها فيه. Battle.net ليس هنا إلا لألعاب Blizzard نفسها، فألعاب Activision بعضها فيه وبعضها لا (يأتي من Wikidata أو من ملف التصحيح)
const RULES = [['ubi', /^ubisoft\b/i], ['ea', /^(electronic arts|ea (sports|games|originals))\b/i], ['rockstar', /^rockstar games\b/i], ['battlenet', /^blizzard entertainment\b/i]];
const WD = { Q725130: 'battlenet', Q94582474: 'ubi', Q7898372: 'ubi', Q31708: 'ea', Q121327575: 'ea', Q59510068: 'epic', Q1486288: 'gog' };
const PASS_PC = 'fdd9e2a7-0fee-49f6-ad69-4354098401ff';   // قائمة PC Game Pass في فهرس Game Pass

const wait = ms => new Promise(r => setTimeout(r, ms));
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
// اسم للمطابقة: بلا علامات تجارية ولا لواحق النسخة («for Windows 10»، «(PC)»، «Standard Edition»)
export const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[™®©]/g, '').replace(/&/g, ' and ')
  .replace(/\((pc|windows|windows 10|win10)\)/g, ' ').replace(/[-–:]?\s*\b(for windows 10|for windows|windows 10 edition|windows edition|windows 10|standard edition)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
export const isPc = g => (g.plats || []).includes('pc') || (g.also || []).includes('pc');
export const epicSlug = u => { const m = String(u || '').match(/epicgames\.com\/(?:store\/)?(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?(p|product|bundles)\/([^/?#]+)/); return m ? { kind: m[1] === 'bundles' ? 'bundles' : 'p', slug: m[2] } : null; };
const epicUrl = u => { const s = epicSlug(u); return s ? `https://store.epicgames.com/${s.kind}/${s.slug}` : u; };
const slugify = t => norm(t).replace(/ /g, '-') || '-';
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

function client(opt) { const f = opt.fetch || fetch, pause = opt.pause ?? 500;
  return async (url, o = {}) => { for (let i = 0; ; i++) {
    try { const r = await f(url, { headers: { 'user-agent': UA, accept: 'application/json', ...(o.headers || {}) }, signal: AbortSignal.timeout(o.timeout || 25000) });
      if (r.status === 429 || r.status >= 500) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
      return { status: r.status, body: await r.json().catch(() => null) };
    } catch (e) { if (i >= (o.tries ?? 2)) return { status: e.status || 0, body: null, error: String(e?.message || e) }; await wait(pause * (i + 1) * 2); } } }; }

// ---------- Steam: رقم التطبيق ← {} (في المتجر) | {free:'f2p'} | {free:'gift'} | {off:1} (ليست في متجر السعودية) | null (أُزيلت). ما لم يُعرف لا يدخل الخريطة
async function steam(ids, get, pause) { const out = new Map(), odd = []; let ok = true;
  for (const part of chunks(ids, 40)) { const r = await get(`https://store.steampowered.com/api/appdetails?appids=${part.join(',')}&cc=sa&filters=price_overview`);
    if (r.status !== 200 || !r.body || typeof r.body !== 'object') { ok = false; continue; }
    for (const id of part) { const v = r.body[id], p = v?.success && !Array.isArray(v.data) ? v.data?.price_overview : null; if (p) out.set(id, p.final === 0 ? { free: 'gift' } : {}); else odd.push(id); }
    await wait(pause); }
  // ما لا سعر له: مجانية اللعب (في المتجرين السعودي والأمريكي معاً، فبعض ما لا يُباع في السعودية يظهر «مجاناً» فيها وحدها)، أو غير متاحة في السعودية، أو أُزيلت، أو تُباع ضمن حزمة
  const one = async (id, cc) => { const r = await get(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=${cc}&l=en`), v = r.body?.[id]; return r.status === 200 && v ? v : null; };
  for (const id of odd) { const sa = await one(id, 'sa'); await wait(pause / 2); if (!sa) { ok = false; continue; }
    if (sa.success && !sa.data?.is_free) { out.set(id, {}); continue; }
    const us = await one(id, 'us'); await wait(pause / 2); if (!us) { ok = false; continue; }
    out.set(id, sa.success ? (us.success && us.data?.is_free ? { free: 'f2p' } : {}) : us.success ? { off: 1 } : null); }
  return { out, ok, n: ids.length, odd: odd.length }; }

// ---------- Epic: الهدايا الحالية والقادمة في متجر السعودية (خصم كامل لمدة). كل عنصر: الاسم والمسارات والأرقام والمدد
async function epicFree(get) { const r = await get('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=SA&allowCountries=SA'), els = r.body?.data?.Catalog?.searchStore?.elements;
  if (r.status !== 200 || !Array.isArray(els)) return null;
  return els.map(e => { const maps = [...(e.catalogNs?.mappings || []), ...(e.offerMappings || [])], clean = s => String(s).replace(/\/home$/, '');
    const win = [...(e.promotions?.promotionalOffers || []), ...(e.promotions?.upcomingPromotionalOffers || [])].flatMap(p => p.promotionalOffers || [])
      .filter(o => o.discountSetting?.discountPercentage === 0 && o.startDate && o.endDate).map(o => ({ from: o.startDate, until: o.endDate })).sort((a, b) => a.from < b.from ? -1 : 1);
    const page = maps.find(m => m.pageType === 'productHome')?.pageSlug || maps[0]?.pageSlug || (e.productSlug ? clean(e.productSlug) : '');
    return { title: e.title || '', ns: e.namespace || '', id: e.id || '', type: e.offerType || '', slugs: [...new Set([e.productSlug, e.urlSlug, ...maps.map(m => m.pageSlug)].filter(Boolean).map(clean))], win,
      url: page ? `https://store.epicgames.com/${e.offerType === 'BUNDLE' ? 'bundles' : 'p'}/${page}` : '' }; }).filter(x => x.win.length); }
// المدة التي تهم الآن: الجارية، وإلا أقرب قادمة
const windowAt = (win, now) => win.find(w => Date.parse(w.from) <= now && now < Date.parse(w.until)) || win.find(w => Date.parse(w.from) > now) || null;

// ---------- GOG: رقم المنتج ← {u, free?} | null (ليس في المتجر)
async function gog(ids, get, pause) { const out = new Map(); let ok = true;
  for (const id of ids) { const a = await get(`https://api.gog.com/products/${id}`); await wait(pause / 3);
    if (a.status === 404) { out.set(id, null); continue; } if (a.status !== 200 || !a.body) { ok = false; continue; }
    const row = { u: a.body.links?.product_card || '' }, p = await get(`https://api.gog.com/products/${id}/prices?countryCode=SA`); await wait(pause / 3);
    if (p.status === 200) { const list = p.body?._embedded?.prices || [], x = list.find(q => q.currency?.code === 'SAR') || list[0], fin = parseInt(x?.finalPrice), base = parseInt(x?.basePrice);
      if (x && fin === 0) row.free = base > 0 ? 'gift' : 'f2p'; } else if (p.status !== 400 && p.status !== 404) ok = false;   // 400: منتج بلا سعر في هذا البلد (صفحته باقية)
    out.set(id, row); }
  return { out, ok, n: ids.length }; }

// ---------- Microsoft: المنتجات بأرقامها (حزمة للكمبيوتر؟ تُشترى؟ سعرها)، وقائمة PC Game Pass
const msProduct = p => { const skus = p.DisplaySkuAvailabilities || [], full = skus.find(s => s.Sku?.SkuType === 'full') || skus[0], buy = (full?.Availabilities || []).find(a => (a.Actions || []).includes('Purchase') && a.OrderManagementData?.Price), pr = buy?.OrderManagementData?.Price;
  return { id: p.ProductId, title: p.LocalizedProperties?.[0]?.ProductTitle || '', pc: skus.some(s => (s.Sku?.Properties?.Packages || []).some(k => (k.PlatformDependencies || []).some(d => d.PlatformName === 'Windows.Desktop'))),
    price: pr ? { list: pr.ListPrice, msrp: pr.MSRP } : null }; };
async function msCatalog(ids, get, pause) { const out = new Map(); let ok = true;
  for (const part of chunks(ids, 20)) { const r = await get(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${part.join(',')}&market=SA&languages=en-us&MS-CV=DGU1mcuYo0WMMp+F.1`);
    if (r.status !== 200 || !Array.isArray(r.body?.Products)) { ok = false; continue; } for (const p of r.body.Products) out.set(p.ProductId, msProduct(p)); await wait(pause / 2); }
  return { out, ok }; }
async function gamePass(get) { const r = await get(`https://catalog.gamepass.com/sigls/v2?id=${PASS_PC}&language=en-us&market=SA`); return r.status === 200 && Array.isArray(r.body) ? new Set(r.body.map(x => x.id).filter(Boolean)) : null; }

// ---------- Wikidata: «يوزَّع عبر» (P750) لكل لعبة برقم IGDB النصي (P5794)
async function wikidata(slugs, get) { const out = new Map();
  for (const part of chunks(slugs, 150)) { const q = `SELECT ?slug ?dist WHERE { VALUES ?slug { ${part.map(s => JSON.stringify(s)).join(' ')} } ?g wdt:P5794 ?slug; wdt:P750 ?dist. }`;
    const r = await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { accept: 'application/sparql-results+json' }, timeout: 60000 });
    if (r.status !== 200 || !r.body?.results) return null;
    for (const b of r.body.results.bindings) { const s = b.slug.value; if (!out.has(s)) out.set(s, new Set()); out.get(s).add(b.dist.value.split('/').pop()); } }
  return out; }

// ---------- الجمع. يعيد: rows (رقم اللعبة ← صفوف متاجرها مرتبة)، f2p (ألعاب مجانية اللعب)، meta (متى فُحصت وأي المصادر أجاب)، report (للمراجعة)
// الصف: { s: المتجر, u: الرابط, free?: 'f2p' | 'gift', from?, until? (مدة الهدية), pass?: 1 (ضمن PC Game Pass), off?: 1 (ليست في متجر السعودية), how?: 'pub' | 'wd' | 'fix' (من أين عُرف حين ليس من المتجر نفسه), n?: الاسم (للمتاجر الأخرى) }
export async function storesFor(games, opt = {}) {
  const get = client(opt), pause = opt.pause ?? 400, now = opt.now ?? Date.now(), log = opt.log || (() => {}), prev = opt.prev || new Map(), fix = opt.fix || {};
  const pc = games.filter(isPc), old = (id, s) => (prev.get(id)?.pc || []).find(r => r.s === s) || null, failed = [];
  const site = (g, t) => (g.sites || []).find(s => s.t === t)?.url || '';
  const msIds = g => [...new Set([g.ext?.xbox, ...(g.ext?.ms || [])].filter(x => /^[A-Z0-9]{12}$/.test(x || '')))];

  const [st, ep, gg, wd, pass] = await Promise.all([
    steam([...new Set(pc.map(g => g.ext?.steam).filter(Boolean))], get, pause), epicFree(get),
    gog([...new Set(pc.map(g => g.ext?.gog).filter(Boolean))].map(String), get, pause), wikidata(pc.map(g => g.slug).filter(Boolean), get), gamePass(get)]);
  if (!st.ok) failed.push('steam'); if (!ep) failed.push('epic'); if (!gg.ok) failed.push('gog'); if (!wd) failed.push('wikidata'); if (!pass) failed.push('gamepass');
  // Microsoft: أرقام القائمة، ثم ما في PC Game Pass وليس من أرقامها (ليُطابَق باسمه)
  const own = new Map(); for (const g of pc) for (const id of msIds(g)) own.set(id, g.id);
  const cat = await msCatalog([...own.keys()], get, pause); if (!cat.ok) failed.push('microsoft');
  const byName = new Map(), dup = new Set(); for (const g of pc) { const k = norm(g.title); if (byName.has(k)) dup.add(k); byName.set(k, g); }
  const passByTitle = new Map(), titled = [];
  if (pass) { const rest = await msCatalog([...pass].filter(id => !own.has(id)), get, pause); if (!rest.ok) failed.push('gamepass-titles');
    for (const p of rest.out.values()) { const k = norm(p.title), g = byName.get(k); if (g && !dup.has(k)) { passByTitle.set(g.id, p); titled.push(`${p.id} "${p.title}" → ${g.title}`); } } }

  const rows = new Map(), f2p = new Set(), report = { at: new Date(now).toISOString(), failed, games: {}, passByTitle: titled, none: [], steam: { n: st.n, odd: st.odd }, epicFree: (ep || []).map(e => `${e.title}: ${e.win.map(w => w.from.slice(0, 10) + '→' + w.until.slice(0, 10)).join(', ')}`) };
  for (const g of pc) { const list = [], add = r => { if (r && !list.some(x => x.s === r.s && r.s !== 'other')) list.push(r); }, dist = wd?.get(g.slug) || new Set(), viaWd = k => [...dist].some(q => WD[q] === k), f = fix[g.id] || {};
    // Steam
    if (g.ext?.steam) { const id = String(g.ext.steam), u = `https://store.steampowered.com/app/${id}`;
      if (st.out.has(id)) { const v = st.out.get(id); if (v) add({ s: 'steam', u, ...v }); } else add(old(g.id, 'steam') || { s: 'steam', u }); }
    // Epic: الرابط من IGDB أو من عرض مجاني يطابق اسمها، ثم Wikidata (بلا رابط دقيق: بحث المتجر)
    { const slug = epicSlug(site(g, 'epic'))?.slug, hit = (ep || []).find(e => (slug && e.slugs.includes(slug)) || (g.ext?.epic && (e.ns === g.ext.epic || e.id === g.ext.epic)) || (e.type !== 'ADD_ON' && e.type !== 'DLC' && norm(e.title) === norm(g.title)));
      const w = hit ? windowAt(hit.win, now) : null, gift = w ? { free: 'gift', from: w.from, until: w.until } : {};
      if (site(g, 'epic')) add({ s: 'epic', u: epicUrl(site(g, 'epic')), ...gift }); else if (hit && w && hit.url) add({ s: 'epic', u: hit.url, ...gift });
      else if (g.ext?.epic || viaWd('epic')) add({ s: 'epic', u: `https://store.epicgames.com/browse?q=${encodeURIComponent(g.title)}&sortBy=relevancy&sortDir=DESC`, ...(g.ext?.epic ? {} : { how: 'wd' }) });
      if (!ep) { const o = old(g.id, 'epic'), r = list.find(x => x.s === 'epic'); if (o?.free && r && Date.parse(o.until) > now) Object.assign(r, { free: o.free, from: o.from, until: o.until }); } }
    // GOG
    if (g.ext?.gog) { const id = String(g.ext.gog);
      if (gg.out.has(id)) { const v = gg.out.get(id); if (v) add({ s: 'gog', u: v.u || site(g, 'gog') || `https://www.gog.com/games?query=${encodeURIComponent(g.title)}`, ...(v.free ? { free: v.free } : {}) }); }
      else add(old(g.id, 'gog') || (site(g, 'gog') ? { s: 'gog', u: site(g, 'gog') } : null)); }
    else if (site(g, 'gog')) add({ s: 'gog', u: site(g, 'gog') }); else if (viaWd('gog')) add({ s: 'gog', u: `https://www.gog.com/games?query=${encodeURIComponent(g.title)}`, how: 'wd' });
    // Xbox: منتج له حزمة كمبيوتر ويُشترى، أو ضمن PC Game Pass (برقمه أو باسمه)
    { const mine = msIds(g).map(id => cat.out.get(id)).filter(Boolean), inPass = p => !!pass?.has(p.id), best = mine.filter(p => p.pc && (p.price || inPass(p))).sort((a, b) => inPass(b) - inPass(a))[0] || passByTitle.get(g.id);
      if (best) { const x = site(g, 'xstore'), u = x && x.toUpperCase().includes(best.id) ? x : `https://www.xbox.com/games/store/${slugify(best.title || g.title)}/${best.id}`;
        add({ s: 'xbox', u, ...(inPass(best) || passByTitle.get(g.id) === best ? { pass: 1 } : {}), ...(best.price && best.price.list === 0 ? { free: best.price.msrp > 0 ? 'gift' : 'f2p' } : {}) }); }
      else if (!cat.ok || !pass || failed.includes('gamepass-titles')) add(old(g.id, 'xbox')); }   // مصدر لم يُجب: يبقى ما كان
    // مشغّلات الناشرين: من اسم الناشر، أو من Wikidata
    for (const [k, re] of RULES) { const pubs = g.pub || [], valve = [...pubs, ...(g.dev || [])].some(n => /^valve\b/i.test(n));   // ما تطوّره Valve وتنشره على Steam يُوزَّع في المتاجر باسم ناشر آخر (Half-Life 2)
      if (pubs.some(n => re.test(n)) && !valve) add({ s: k, u: OWN[k].test(host(site(g, 'official'))) ? site(g, 'official') : HOME[k], how: 'pub' }); }
    for (const k of ['battlenet', 'ubi', 'ea']) if (viaWd(k)) add({ s: k, u: OWN[k].test(host(site(g, 'official'))) ? site(g, 'official') : HOME[k], how: 'wd' });
    // التصحيح باليد
    for (const s of f.drop || []) { const i = list.findIndex(r => r.s === s); if (i >= 0) list.splice(i, 1); }
    for (const a of f.add || []) { const i = list.findIndex(r => r.s === a.s && a.s !== 'other'); if (i >= 0) list.splice(i, 1); list.push({ s: a.s, u: a.u, ...(a.n ? { n: a.n } : {}), how: 'fix' }); }
    list.sort((a, b) => STORES.indexOf(a.s) - STORES.indexOf(b.s));
    if (list.some(r => r.free === 'f2p')) f2p.add(g.id);
    rows.set(g.id, list); if (!list.length) report.none.push(g.title);
    report.games[g.title] = list.map(r => r.s + (r.n ? `(${r.n})` : '') + (r.free ? ':' + r.free + (r.until ? '→' + r.until.slice(0, 10) : '') : '') + (r.pass ? ':pass' : '') + (r.off ? ':off' : '') + (r.how ? '~' + r.how : '')).join(' ') || '—'; }
  const count = k => [...rows.values()].filter(l => l.some(r => r.s === k)).length;
  log(`stores: ${pc.length} PC games: steam ${count('steam')}, epic ${count('epic')}, gog ${count('gog')}, xbox ${count('xbox')} (${[...rows.values()].filter(l => l.some(r => r.pass)).length} in PC Game Pass, ${titled.length} matched by title), publisher launchers ${['ubi', 'ea', 'rockstar', 'battlenet'].map(k => `${k} ${count(k)}`).join(', ')}; free to play ${f2p.size}, gifts ${[...rows.values()].filter(l => l.some(r => r.free === 'gift')).length}, not in the Saudi store ${[...rows.values()].filter(l => l.some(r => r.off)).length}, with no store ${report.none.length}${failed.length ? '; FAILED: ' + failed.join(', ') : ''}`);
  return { rows, f2p, meta: { at: report.at, ...(failed.length ? { failed } : {}) }, report };
}
