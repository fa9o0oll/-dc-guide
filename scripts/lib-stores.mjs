// متاجر الكمبيوتر ومشغّلاته لـ«ألعابي»: أين تُلعب اللعبة على الكمبيوتر، وهل هي مجانية الآن.
// هذا الملف الآن مسبار فقط (فروع العمل، GAMES_PROBE=1): يطبع عينات من المصادر المرشحة ليُعرف ما يصل من خوادم البناء وبأي شكل، قبل أن يُبنى عليها.
const UA = 'watch-guide-games/1.0 (+https://github.com/fa9o0oll/-dc-guide)';
const j = async (url, opt = {}) => { const t0 = Date.now();
  try { const r = await fetch(url, { ...opt, headers: { 'user-agent': UA, accept: 'application/json', ...(opt.headers || {}) }, signal: AbortSignal.timeout(opt.timeout || 25000) });
    const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 400); } return { status: r.status, ms: Date.now() - t0, body };
  } catch (e) { return { status: 0, ms: Date.now() - t0, body: String(e?.message || e) }; } };
const show = (t, x, n = 1600) => console.log(`stores probe ${t}: ${(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, n)}`);
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o && k in o).map(k => [k, o[k]]));

export async function probe(games) {
  const pc = games.filter(g => g.plats.includes('pc') || (g.also || []).includes('pc')), by = t => pc.find(g => g.title === t);
  show('library', { games: games.length, pc: pc.length, steam: pc.filter(g => g.ext.steam).length, epic: pc.filter(g => g.ext.epic).length, gog: pc.filter(g => g.ext.gog).length, xbox: pc.filter(g => g.ext.xbox).length });

  // 1) Steam: التفاصيل الكاملة لتطبيق واحد، والأسعار دفعةً
  const steamIds = pc.map(g => g.ext.steam).filter(Boolean);
  for (const [name, id] of [['paid', by("Dragon's Dogma II")?.ext.steam || '2054970'], ['f2p', by('Destiny 2')?.ext.steam || '1085660']]) {
    const r = await j(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=sa&l=en`), d = r.body?.[id]?.data;
    show(`steam full ${name} ${id}`, { status: r.status, ms: r.ms, success: r.body?.[id]?.success, ...(d ? pick(d, ['type', 'name', 'is_free', 'price_overview', 'release_date', 'platforms', 'packages']) : { body: r.body }) }); }
  { const ids = steamIds.slice(0, 40), r = await j(`https://store.steampowered.com/api/appdetails?appids=${ids.join(',')}&cc=sa&filters=price_overview`);
    const rows = Object.entries(typeof r.body === 'object' && r.body ? r.body : {}).map(([id, v]) => [id, v.success, Array.isArray(v.data) ? 'no-price' : v.data?.price_overview ? `${v.data.price_overview.final_formatted} -${v.data.price_overview.discount_percent}%` : '?']);
    show(`steam prices x${ids.length}`, { status: r.status, ms: r.ms, n: rows.length, rows: rows.slice(0, 40), raw: typeof r.body === 'string' ? r.body : undefined }, 2600); }

  // 2) Epic: العروض المجانية الحالية والقادمة
  { const r = await j('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=SA&allowCountries=SA'), els = r.body?.data?.Catalog?.searchStore?.elements;
    show('epic free', { status: r.status, ms: r.ms, n: els?.length, body: els ? undefined : r.body });
    for (const e of els || []) show('epic free item', { title: e.title, id: e.id, ns: e.namespace, productSlug: e.productSlug, urlSlug: e.urlSlug, offerType: e.offerType, maps: (e.catalogNs?.mappings || []).map(m => m.pageSlug), offerMaps: (e.offerMappings || []).map(m => m.pageSlug),
      price: pick(e.price?.totalPrice || {}, ['discountPrice', 'originalPrice', 'currencyCode']), now: (e.promotions?.promotionalOffers || []).flatMap(p => p.promotionalOffers).map(o => [o.startDate, o.endDate, o.discountSetting?.discountPercentage]),
      next: (e.promotions?.upcomingPromotionalOffers || []).flatMap(p => p.promotionalOffers).map(o => [o.startDate, o.endDate, o.discountSetting?.discountPercentage]) }, 900);
    const sample = pc.filter(g => g.ext.epic).slice(0, 8).map(g => [g.title, g.ext.epic, g.sites.find(s => s.t === 'epic')?.url]); show('epic library ids', sample, 1800); }

  // 3) GOG: المنتج وسعره
  for (const g of pc.filter(g => g.ext.gog).slice(0, 3)) { const id = g.ext.gog;
    const a = await j(`https://api.gog.com/products/${id}?expand=description`), p = await j(`https://api.gog.com/products/${id}/prices?countryCode=SA`);
    show(`gog ${g.title} ${id}`, { status: a.status, ms: a.ms, ...(typeof a.body === 'object' ? pick(a.body, ['id', 'title', 'slug', 'is_secret', 'game_type', 'is_pre_order', 'links', 'purchase_link', 'content_system_compatibility', 'in_development']) : { body: a.body }), prices: { status: p.status, body: p.body?._embedded?.prices || p.body } }, 1400); }

  // 4) Microsoft Store: المنتجات بأرقامها (المنصات المسموحة والسعر)، وقائمة PC Game Pass
  const msIds = [...new Set(pc.map(g => g.ext.xbox).filter(x => /^[A-Z0-9]{12}$/.test(x || '')))];
  { const ids = msIds.slice(0, 20), r = await j(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${ids.join(',')}&market=SA&languages=en-us&MS-CV=DGU1mcuYo0WMMp+F.1`), ps = r.body?.Products;
    show(`ms catalog x${ids.length} of ${msIds.length}`, { status: r.status, ms: r.ms, n: ps?.length, body: ps ? undefined : r.body });
    for (const p of (ps || []).slice(0, 20)) { const av = (p.DisplaySkuAvailabilities || []).flatMap(s => s.Availabilities || []);
      show('ms product', { id: p.ProductId, title: p.LocalizedProperties?.[0]?.ProductTitle, kind: p.ProductKind, type: p.ProductType, cat: p.Properties?.Category, xpa: p.Properties?.XboxXPA, attrs: (p.Properties?.Attributes || []).map(a => a.Name).slice(0, 14),
        plats: [...new Set(av.flatMap(a => (a.Conditions?.ClientConditions?.AllowedPlatforms || []).map(x => x.PlatformName)))], prices: [...new Set(av.filter(a => (a.Actions || []).includes('Purchase')).map(a => `${a.OrderManagementData?.Price?.ListPrice}/${a.OrderManagementData?.Price?.MSRP} ${a.OrderManagementData?.Price?.CurrencyCode}`))].slice(0, 4),
        acts: [...new Set(av.flatMap(a => a.Actions || []))].slice(0, 10), skus: (p.DisplaySkuAvailabilities || []).length }, 900); }
    for (const [name, id] of [['pc', 'fdd9e2a7-0fee-49f6-ad69-4354098401ff'], ['console', 'f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e']]) { const g = await j(`https://catalog.gamepass.com/sigls/v2?id=${id}&language=en-us&market=SA`), list = Array.isArray(g.body) ? g.body.map(x => x.id).filter(Boolean) : [];
      show(`gamepass ${name}`, { status: g.status, ms: g.ms, n: list.length, inLibrary: pc.filter(x => list.includes(x.ext.xbox)).map(x => x.title).slice(0, 40), body: list.length ? undefined : g.body }, 1500); } }

  // 5) Wikidata: «يوزَّع عبر» (P750) لألعاب القائمة، ومعرّفات المتاجر
  { const slugs = pc.map(g => g.slug), rows = [];
    for (let i = 0; i < slugs.length; i += 120) { const q = `SELECT ?slug ?dist ?distLabel WHERE { VALUES ?slug { ${slugs.slice(i, i + 120).map(s => JSON.stringify(s)).join(' ')} } ?g wdt:P5794 ?slug; wdt:P750 ?dist. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
      const r = await j('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { accept: 'application/sparql-results+json' }, timeout: 60000 });
      if (!r.body?.results) { show('wikidata P750 failed', { status: r.status, body: r.body }); break; } for (const b of r.body.results.bindings) rows.push([b.slug.value, b.distLabel.value, b.dist.value.split('/').pop()]); }
    const count = new Map(); for (const [, l, q] of rows) count.set(`${l} (${q})`, (count.get(`${l} (${q})`) || 0) + 1);
    show('wikidata P750 distributors', [...count].sort((a, b) => b[1] - a[1]), 2400); show('wikidata P750 games covered', new Set(rows.map(r => r[0])).size + ' of ' + slugs.length);
    const of = s => rows.filter(r => r[0] === s).map(r => r[1]); for (const g of pc.filter(g => /Activision|Blizzard|Ubisoft|Electronic Arts|Rockstar|Xbox Game Studios|Microsoft/.test(g.pub.join(' '))).slice(0, 40)) show('wikidata P750 of', `${g.title} [${g.pub.join(', ')}] => ${of(g.slug).join(', ') || '—'}`, 400); }

  // 6) CheapShark: المتاجر التي يتابعها، وأسعار لعبة برقم Steam
  { const s = await j('https://www.cheapshark.com/api/1.0/stores'); show('cheapshark stores', { status: s.status, ms: s.ms, active: Array.isArray(s.body) ? s.body.filter(x => x.isActive).map(x => `${x.storeID}:${x.storeName}`) : s.body }, 1400);
    for (const g of [by("Dragon's Dogma II"), by('Destiny 2'), ...pc.filter(g => /Ubisoft|Electronic Arts|Activision|Blizzard/.test(g.pub.join(' ')) && g.ext.steam).slice(0, 5)].filter(Boolean)) {
      const a = await j(`https://www.cheapshark.com/api/1.0/games?steamAppID=${g.ext.steam}`), id = Array.isArray(a.body) ? a.body[0]?.gameID : null, d = id ? await j(`https://www.cheapshark.com/api/1.0/games?id=${id}`) : null;
      show(`cheapshark ${g.title}`, { status: a.status, found: Array.isArray(a.body) ? a.body.map(x => [x.gameID, x.external, x.cheapest]) : a.body, deals: d?.body?.deals?.map(x => `${x.storeID}:${x.price}/${x.retailPrice}`) }, 900); } }

  // 7) GamerPower: الهدايا الجارية على الكمبيوتر
  { const r = await j('https://www.gamerpower.com/api/giveaways?platform=pc&type=game'); show('gamerpower', { status: r.status, ms: r.ms, n: Array.isArray(r.body) ? r.body.length : 0, items: Array.isArray(r.body) ? r.body.slice(0, 12).map(x => [x.title, x.platforms, x.worth, x.end_date, x.open_giveaway_url]) : r.body }, 2600); }
}
