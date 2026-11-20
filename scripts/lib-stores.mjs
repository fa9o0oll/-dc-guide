// متاجر الكمبيوتر ومشغّلاته لـ«ألعابي»: أين تُلعب اللعبة على الكمبيوتر، وهل هي مجانية الآن.
// هذا الملف الآن مسبار فقط (فروع العمل، GAMES_PROBE=1): يطبع عينات من المصادر المرشحة ليُعرف ما يصل من خوادم البناء وبأي شكل، قبل أن يُبنى عليها.
const UA = 'watch-guide-games/1.0 (+https://github.com/fa9o0oll/-dc-guide)';
const j = async (url, opt = {}) => { const t0 = Date.now();
  try { const r = await fetch(url, { ...opt, headers: { 'user-agent': UA, accept: 'application/json', ...(opt.headers || {}) }, signal: AbortSignal.timeout(opt.timeout || 25000) });
    const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 400); } return { status: r.status, ms: Date.now() - t0, body };
  } catch (e) { return { status: 0, ms: Date.now() - t0, body: String(e?.message || e) }; } };
const show = (t, x, n = 1600) => console.log(`stores probe ${t}: ${(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, n)}`);
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function probe(games) {
  const pc = games.filter(g => g.plats.includes('pc') || (g.also || []).includes('pc')), name = new Map();
  // 1) Steam: ما لا سعر له (مجاني؟ لم يصدر؟ أُزيل؟ محجوب في السعودية؟)
  const steam = pc.filter(g => g.ext.steam); for (const g of steam) name.set(g.ext.steam, g.title);
  const noPrice = [], failed = [];
  for (let i = 0; i < steam.length; i += 40) { const ids = steam.slice(i, i + 40).map(g => g.ext.steam), r = await j(`https://store.steampowered.com/api/appdetails?appids=${ids.join(',')}&cc=sa&filters=price_overview`);
    if (typeof r.body !== 'object' || !r.body) { show('steam batch failed', { status: r.status, body: r.body }); continue; }
    for (const id of ids) { const v = r.body[id]; if (!v?.success) failed.push(id); else if (Array.isArray(v.data) || !v.data?.price_overview) noPrice.push(id); else if (v.data.price_overview.final === 0) show('steam FREE NOW', [name.get(id), v.data.price_overview]); }
    await wait(400); }
  show('steam summary', { steam: steam.length, noPrice: noPrice.length, failed: failed.length });
  for (const id of [...noPrice, ...failed]) { const a = await j(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=sa&l=en`), d = a.body?.[id]?.data; let us = '';
    if (!a.body?.[id]?.success) { const b = await j(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en`), e = b.body?.[id]; us = ` | us: ${e?.success ? `ok free=${e.data?.is_free} price=${e.data?.price_overview?.final_formatted ?? '-'}` : 'fail ' + b.status}`; }
    show('steam odd', `${name.get(id)} #${id}: status=${a.status} success=${a.body?.[id]?.success} free=${d?.is_free} soon=${d?.release_date?.coming_soon} date=${d?.release_date?.date} type=${d?.type} pkgs=${(d?.packages || []).length}${us}`, 400); await wait(300); }

  // 2) GOG: كل ألعاب القائمة التي لها رقم
  { const rows = []; for (const g of pc.filter(g => g.ext.gog)) { const p = await j(`https://api.gog.com/products/${g.ext.gog}/prices?countryCode=SA`), sar = (p.body?._embedded?.prices || []).find(x => x.currency?.code === 'SAR') || (p.body?._embedded?.prices || [])[0];
      rows.push(`${g.title}=${p.status}:${sar ? sar.finalPrice + '/' + sar.basePrice : JSON.stringify(p.body).slice(0, 80)}`); await wait(150); }
    show('gog all', rows, 5000); }

  // 3) Microsoft: كل أرقام المتجر، وهل للعبة حزمة للكمبيوتر
  const ms = new Map(); for (const g of pc) for (const id of [g.ext.xbox, ...(g.ext.ms || [])]) if (/^[A-Z0-9]{12}$/.test(id || '')) ms.set(id, g.title);
  const pass = await j('https://catalog.gamepass.com/sigls/v2?id=fdd9e2a7-0fee-49f6-ad69-4354098401ff&language=en-us&market=SA'), passIds = new Set(Array.isArray(pass.body) ? pass.body.map(x => x.id) : []);
  const ids = [...ms.keys()], rows = [];
  for (let i = 0; i < ids.length; i += 20) { const r = await j(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids.slice(i, i + 20).join(',')}&market=SA&languages=en-us&MS-CV=DGU1mcuYo0WMMp+F.1`);
    for (const p of r.body?.Products || []) { const skus = p.DisplaySkuAvailabilities || [], deps = new Set(), gens = new Set();
      for (const s of skus) for (const k of s.Sku?.Properties?.Packages || []) { for (const d of k.PlatformDependencies || []) deps.add(d.PlatformName); if (k.PackageFormat) gens.add(k.PackageFormat); }
      const full = skus.find(s => s.Sku?.SkuType === 'full') || skus[0], buy = (full?.Availabilities || []).find(a => (a.Actions || []).includes('Purchase')), pr = buy?.OrderManagementData?.Price;
      rows.push(`${p.ProductId} ${p.LocalizedProperties?.[0]?.ProductTitle} | deps=${[...deps].join(',') || '-'} fmt=${[...gens].join(',') || '-'} xpa=${(p.Properties?.Attributes || []).some(a => a.Name === 'XPA')} pcpad=${(p.Properties?.Attributes || []).some(a => /^Pc/.test(a.Name))} skus=${skus.map(s => s.Sku?.SkuType).join('/')} price=${pr ? pr.ListPrice + '/' + pr.MSRP : '-'} pass=${passIds.has(p.ProductId)} | ${ms.get(p.ProductId)}`); }
    await wait(300); }
  show('ms ids', { games: new Set(ms.values()).size, ids: ids.length, products: rows.length, passPc: passIds.size });
  for (const r of rows) show('ms', r, 420);
  // ما في PC Game Pass باسم يطابق لعبة في القائمة ورقمه ليس في أرقامها (نسخة الكمبيوتر برقم آخر)
  { const norm = s => String(s || '').toLowerCase().replace(/[™®©]/g, '').replace(/\b(pc|windows( 10)?|for windows|standard edition|game preview)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim(), want = new Map(pc.map(g => [norm(g.title), g.title]));
    const rest = [...passIds].filter(id => !ms.has(id)), hits = [];
    for (let i = 0; i < rest.length; i += 20) { const r = await j(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${rest.slice(i, i + 20).join(',')}&market=SA&languages=en-us&MS-CV=DGU1mcuYo0WMMp+F.1`);
      for (const p of r.body?.Products || []) { const t = p.LocalizedProperties?.[0]?.ProductTitle; if (want.has(norm(t))) hits.push(`${p.ProductId} "${t}" => ${want.get(norm(t))}`); } await wait(200); }
    show('gamepass pc by title (id not in IGDB)', hits, 3000); }

  // 4) Epic: شكل أرقام IGDB مقابل أرقام العروض، وأسماء المسارات في القائمة
  { const r = await j('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=SA&allowCountries=SA'), els = r.body?.data?.Catalog?.searchStore?.elements || [];
    const slug = u => { const m = String(u || '').match(/\/(?:p|product|bundles)\/([^/?#]+)/); return m ? m[1] : ''; }, lib = pc.filter(g => g.ext.epic || g.sites.some(s => s.t === 'epic'));
    show('epic library slugs', lib.map(g => `${g.title}=${slug(g.sites.find(s => s.t === 'epic')?.url) || '?'}`), 4000);
    const hit = els.filter(e => lib.some(g => g.ext.epic === e.namespace || g.ext.epic === e.id)); show('epic ids matching promos', hit.map(e => e.title)); }
}
