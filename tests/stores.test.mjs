// يفحص حساب «أين تُلعب على الكمبيوتر وهل هي مجانية الآن» (scripts/lib-stores.mjs) بلا شبكة: المتاجر كلها مُحاكاة. node tests/stores.test.mjs
import { storesFor, norm, epicSlug, isPc } from '../scripts/lib-stores.mjs';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 700)}`); if (!ok) fails.push(n); };
const NOW = Date.parse('2026-11-21T00:00:00Z'), iso = h => new Date(NOW + h * 36e5).toISOString();
const G = (id, title, x = {}) => ({ id, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, plats: ['pc', 'ps5'], pub: ['Publisher'], dev: ['Studio'], ext: {}, sites: [], ...x });
const games = [
  G(1, 'Alpha Quest', { ext: { steam: '100', gog: '500', xbox: '9AAAAAAAAAA1', ms: ['9AAAAAAAAAA1'] }, sites: [{ t: 'epic', url: 'https://www.epicgames.com/store/en-US/product/alpha-quest-ab12cd/home' }, { t: 'xstore', url: 'https://www.xbox.com/en-us/games/store/alpha-quest/9AAAAAAAAAA1' }] }),
  G(2, 'Free Realms', { ext: { steam: '200', xbox: '9BBBBBBBBBB2' }, sites: [{ t: 'epic', url: 'https://store.epicgames.com/p/free-realms' }] }),
  G(3, 'Gift Game', { ext: { steam: '300' } }), G(4, 'Region Lock', { ext: { steam: '400' } }), G(5, 'Gone Game', { ext: { steam: '501' } }), G(6, 'Fighter Six', { ext: { steam: '600' } }),
  G(7, 'Console King', { ext: { steam: '700', xbox: 'BCCCCCCCCCC3' } }),
  G(8, 'Rayman Clone', { pub: ['Ubisoft Entertainment'], sites: [{ t: 'official', url: 'https://www.ubisoft.com/en-us/game/rayman-clone' }] }),
  G(9, 'Dead Void', { pub: ['Electronic Arts'], ext: { steam: '900' } }), G(10, 'Half Lite', { dev: ['Valve'], pub: ['Valve', 'Electronic Arts'], ext: { steam: '1000' } }),
  G(11, 'Grand Auto', { pub: ['Take-Two Interactive', 'Rockstar Games'] }), G(12, 'Crash Four', { pub: ['Activision'], ext: { steam: '1200' } }),
  G(13, 'Netmarble Game'), G(14, 'Old Epic'), G(15, 'PS Only', { plats: ['ps5'], ext: { steam: '1500' } }),
  G(16, 'GOG Gone', { ext: { gog: '404' } }), G(17, 'Ubi Drop', { pub: ['Ubisoft'] }), G(18, 'Wiki Epic'), G(19, 'GOG NoPrice', { ext: { gog: '777' }, sites: [{ t: 'gog', url: 'https://www.gog.com/game/gog_noprice' }] }),
  G(20, 'Also Pc', { plats: ['ps4'], also: ['pc'], ext: { steam: '2000' } }), G(21, 'Twin Name', { ext: { steam: '2100' } }), G(22, 'Twin Name', { ext: { steam: '2200' } }),
];
const fix = { 13: { add: [{ s: 'other', n: 'Netmarble Launcher', u: 'https://sololeveling.netmarble.com/' }] }, 17: { drop: ['ubi'] } };

// ---------- المتاجر المُحاكاة
const PRICED = { 100: [14900, 0], 300: [0, 100], 700: [5000, 50], 900: [9900, 0], 1000: [3600, 0], 1200: [7500, 0], 2000: [1000, 0], 2100: [1000, 0], 2200: [1000, 0] };
const DETAIL = { sa: { 200: { success: true, data: { is_free: true } }, 400: { success: false }, 501: { success: false }, 600: { success: true, data: { is_free: true } } },
  us: { 200: { success: true, data: { is_free: true } }, 400: { success: true, data: { is_free: false } }, 501: { success: false }, 600: { success: true, data: { is_free: false, price_overview: { final: 3999 } } } } };
const ms = (id, title, { pc = true, price = [100, 100], buy = true } = {}) => ({ ProductId: id, LocalizedProperties: [{ ProductTitle: title }],
  DisplaySkuAvailabilities: [{ Sku: { SkuType: 'full', Properties: { Packages: [{ PlatformDependencies: [{ PlatformName: pc ? 'Windows.Desktop' : 'Windows.Xbox' }] }] } }, Availabilities: [{ Actions: buy ? ['Details', 'Purchase'] : ['Details'], OrderManagementData: { Price: { ListPrice: price[0], MSRP: price[1] } } }] }] });
const MS = { '9AAAAAAAAAA1': ms('9AAAAAAAAAA1', 'Alpha Quest'), '9BBBBBBBBBB2': ms('9BBBBBBBBBB2', 'Free Realms', { price: [0, 0] }), BCCCCCCCCCC3: ms('BCCCCCCCCCC3', 'Console King', { pc: false }),
  '9DDDDDDDDDD4': ms('9DDDDDDDDDD4', 'RAYMAN CLONE™ (PC)', { buy: false }), '9EEEEEEEEEE5': ms('9EEEEEEEEEE5', 'Twin Name'), '9FFFFFFFFFF6': ms('9FFFFFFFFFF6', 'Some Other Game') };
const EPIC = [{ title: 'Alpha Quest', id: 'e1', namespace: 'n1', offerType: 'BASE_GAME', productSlug: 'alpha-quest-ab12cd/home', catalogNs: { mappings: [{ pageSlug: 'alpha-quest-ab12cd', pageType: 'productHome' }] },
    promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: iso(-48), endDate: iso(72), discountSetting: { discountPercentage: 0 } }] }], upcomingPromotionalOffers: [] } },
  { title: 'Old Epic', id: 'e2', namespace: 'n2', offerType: 'BASE_GAME', urlSlug: 'abc123', offerMappings: [{ pageSlug: 'old-epic-9f9f9f' }],
    promotions: { promotionalOffers: [], upcomingPromotionalOffers: [{ promotionalOffers: [{ startDate: iso(120), endDate: iso(288), discountSetting: { discountPercentage: 0 } }] }] } },
  { title: 'Free Realms', id: 'e3', namespace: 'n3', offerType: 'BASE_GAME', productSlug: 'free-realms', promotions: { promotionalOffers: [], upcomingPromotionalOffers: [{ promotionalOffers: [{ startDate: iso(24), endDate: iso(99), discountSetting: { discountPercentage: 40 } }] }] } },
  { title: 'Gift Game', id: 'e4', namespace: 'n4', offerType: 'ADD_ON', productSlug: 'gift-game-dlc', promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: iso(-5), endDate: iso(50), discountSetting: { discountPercentage: 0 } }] }] } },
  { title: 'Past Promo', id: 'e5', namespace: 'n5', promotions: null }];
const WDQ = { 'crash-four': ['Q725130', 'Q337535'], 'wiki-epic': ['Q59510068'], 'dead-void': ['Q31708'] };
let down = new Set(), calls = [];
const res = (status, body) => ({ status, json: async () => body });
const net = async url => { const u = new URL(url); calls.push(u.hostname + u.pathname);
  if (u.hostname === 'store.steampowered.com') { if (down.has('steam')) return res(503, null); const ids = u.searchParams.get('appids').split(','), cc = u.searchParams.get('cc');
    if (u.searchParams.get('filters') === 'price_overview') return res(200, Object.fromEntries(ids.map(id => [id, PRICED[id] ? { success: true, data: { price_overview: { final: PRICED[id][0], discount_percent: PRICED[id][1] } } } : DETAIL.sa[id]?.success ? { success: true, data: [] } : { success: false }])));
    return res(200, { [ids[0]]: DETAIL[cc][ids[0]] || { success: false } }); }
  if (u.hostname.includes('epicgames.com')) return down.has('epic') ? res(500, null) : res(200, { data: { Catalog: { searchStore: { elements: EPIC } } } });
  if (u.hostname === 'api.gog.com') { const id = u.pathname.split('/')[2]; if (id === '404') return res(404, {}); if (u.pathname.endsWith('/prices')) return id === '777' ? res(400, { message: 'no price' }) : res(200, { _embedded: { prices: [{ currency: { code: 'USD' }, basePrice: '1999 USD', finalPrice: '1999 USD' }, { currency: { code: 'SAR' }, basePrice: '7295 SAR', finalPrice: '7295 SAR' }] } });
    return res(200, { id: +id, title: 'x', links: { product_card: id === '777' ? '' : `https://www.gog.com/game/p${id}` } }); }
  if (u.hostname === 'displaycatalog.mp.microsoft.com') return down.has('ms') ? res(500, null) : res(200, { Products: u.searchParams.get('bigIds').split(',').map(id => MS[id]).filter(Boolean) });
  if (u.hostname === 'catalog.gamepass.com') return res(200, [{ siglId: 'x', title: 'PC Game Pass' }, { id: '9AAAAAAAAAA1' }, { id: '9DDDDDDDDDD4' }, { id: '9EEEEEEEEEE5' }, { id: '9FFFFFFFFFF6' }]);
  if (u.hostname === 'query.wikidata.org') return res(200, { results: { bindings: Object.entries(WDQ).flatMap(([slug, qs]) => qs.map(q => ({ slug: { value: slug }, dist: { value: 'http://www.wikidata.org/entity/' + q } }))) } });
  return res(404, {}); };

console.log('أدوات المطابقة');
check('الاسم يُطابَق بلا علامات تجارية ولا لواحق النسخة', norm('RAYMAN CLONE™ (PC)') === norm('Rayman Clone') && norm('Yakuza 0 for Windows 10') === 'yakuza 0' && norm('A Plague Tale: Innocence - Windows 10') === norm('A Plague Tale: Innocence') && norm('Remnant II® - Standard Edition') === 'remnant ii'
  && norm('FINAL FANTASY XV WINDOWS EDITION') === 'final fantasy xv' && norm('Crash Bandicoot™ 4: It’s About Time (PC)') === norm("Crash Bandicoot 4: It's About Time") && norm('ONE PIECE: PIRATE WARRIORS 4 (Windows)') === 'one piece pirate warriors 4', [norm('RAYMAN CLONE™ (PC)'), norm('Yakuza 0 for Windows 10'), norm('ONE PIECE: PIRATE WARRIORS 4 (Windows)')]);
check('مسار Epic من أشكال روابطه في IGDB', epicSlug('https://www.epicgames.com/store/en-US/product/journey/home')?.slug === 'journey' && epicSlug('https://store.epicgames.com/p/trek-to-yomi-70d134')?.slug === 'trek-to-yomi-70d134' && epicSlug('https://www.epicgames.com/store/product/rayman-legends')?.slug === 'rayman-legends'
  && epicSlug('https://www.epicgames.com/store/en-US/bundles/borderlands-the-handsome-collection')?.kind === 'bundles' && epicSlug('https://store.epicgames.com/en-US/p/roboquest-9ad17a')?.slug === 'roboquest-9ad17a' && epicSlug('https://www.epicgames.com/p/samurai-shodown-reboot')?.slug === 'samurai-shodown-reboot' && epicSlug('https://example.com/x') === null);
check('لعبة كمبيوتر: منصاتها أو منصات سجلها الشقيق فيها PC', isPc(games[0]) && !isPc(games[14]) && isPc(games[19]));

console.log('الحساب والمصادر كلها تجيب');
const r = await storesFor(games, { fetch: net, pause: 0, now: NOW, fix }), row = id => r.rows.get(id), by = (id, s) => (row(id) || []).find(x => x.s === s), keys = id => (row(id) || []).map(x => x.s).join();
check('لعبة في المتاجر الأربعة: Steam، وهدية Epic الجارية بمدتها، وصفحة GOG، وXbox ضمن PC Game Pass برابط IGDB', keys(1) === 'steam,epic,gog,xbox' && by(1, 'steam').u === 'https://store.steampowered.com/app/100' && !by(1, 'steam').free
  && by(1, 'epic').free === 'gift' && by(1, 'epic').from === iso(-48) && by(1, 'epic').until === iso(72) && by(1, 'epic').u === 'https://store.epicgames.com/p/alpha-quest-ab12cd' && by(1, 'gog').u === 'https://www.gog.com/game/p500' && !by(1, 'gog').free
  && by(1, 'xbox').pass === 1 && by(1, 'xbox').u === 'https://www.xbox.com/en-us/games/store/alpha-quest/9AAAAAAAAAA1', row(1));
check('مجانية اللعب: مجانية في متجري السعودية وأمريكا معاً على Steam، وسعرها صفر في Microsoft، واللعبة تُعلَّم مجانية؛ وخصم Epic غير الكامل ليس هدية', by(2, 'steam').free === 'f2p' && by(2, 'xbox').free === 'f2p' && !by(2, 'xbox').pass && !by(2, 'epic').free && r.f2p.has(2) && r.f2p.size === 1, [row(2), [...r.f2p]]);
check('خصم كامل على Steam هدية، وعرض إضافة (ADD_ON) باسمها على Epic لا يُحسب لها', by(3, 'steam').free === 'gift' && !by(3, 'epic'), row(3));
check('لا تُعرض في متجر السعودية وتُعرض في غيره: تُذكر بذلك. وما أُزيل من المتجرين يسقط', by(4, 'steam').off === 1 && !row(5).length && r.report.none.includes('Gone Game'), [row(4), row(5), r.report.none]);
check('«مجانية» في السعودية وحدها ولها سعر في أمريكا: لا تُعدّ مجانية', by(6, 'steam') && !by(6, 'steam').free && !by(6, 'steam').off && !r.f2p.has(6), row(6));
check('منتج Microsoft لأجهزة Xbox وحدها ليس متجراً للكمبيوتر', keys(7) === 'steam', row(7));
check('ناشر له مشغّله: Ubisoft Connect برابط صفحتها الرسمية، وPC Game Pass برقم ليس في IGDB يُطابَق باسمها', keys(8) === 'xbox,ubi' && by(8, 'ubi').u === 'https://www.ubisoft.com/en-us/game/rayman-clone' && by(8, 'ubi').how === 'pub' && by(8, 'xbox').pass === 1 && by(8, 'xbox').u === 'https://www.xbox.com/games/store/rayman-clone/9DDDDDDDDDD4'
  && r.report.passByTitle.some(x => /9DDDDDDDDDD4/.test(x)), [row(8), r.report.passByTitle]);
check('EA app لناشرها بصفحة المشغّل، ولا يُضاف لما تطوّره Valve وإن وزّعته EA', keys(9) === 'steam,ea' && by(9, 'ea').u === 'https://www.ea.com/games' && by(9, 'ea').how === 'pub' && keys(10) === 'steam', [row(9), row(10)]);
check('Rockstar Games Launcher لناشرها، وBattle.net من Wikidata لا من اسم Activision', keys(11) === 'rockstar' && keys(12) === 'steam,battlenet' && by(12, 'battlenet').how === 'wd' && by(12, 'battlenet').u === 'https://shop.battle.net/', [row(11), row(12)]);
check('التصحيح باليد: يضيف مشغّلاً باسمه، ويحذف ما لا يصح', keys(13) === 'other' && by(13, 'other').n === 'Netmarble Launcher' && by(13, 'other').how === 'fix' && keys(17) === '', [row(13), row(17)]);
check('هدية قادمة على Epic للعبة لا رابط لها في IGDB: تُطابَق باسمها وتأخذ رابط العرض', keys(14) === 'epic' && by(14, 'epic').free === 'gift' && by(14, 'epic').from === iso(120) && by(14, 'epic').u === 'https://store.epicgames.com/p/old-epic-9f9f9f', row(14));
check('لعبة ليست على الكمبيوتر بلا صفوف، وما على الكمبيوتر في سجل شقيق له صفوفه', !r.rows.has(15) && keys(20) === 'steam');
check('GOG: منتج غير موجود يسقط، ومنتج بلا سعر في هذا البلد يبقى برابطه من IGDB', keys(16) === '' && keys(19) === 'gog' && by(19, 'gog').u === 'https://www.gog.com/game/gog_noprice', [row(16), row(19)]);
check('Epic من Wikidata وحدها: بحث المتجر باسمها', keys(18) === 'epic' && by(18, 'epic').how === 'wd' && /^https:\/\/store\.epicgames\.com\/browse\?q=Wiki%20Epic/.test(by(18, 'epic').u), row(18));
check('اسم تحمله لعبتان لا يُطابَق به منتج PC Game Pass', keys(21) === 'steam' && keys(22) === 'steam', [row(21), row(22)]);
check('الصفوف بترتيب ثابت، والحال فيه وقت الفحص وبلا إخفاقات', keys(1) === 'steam,epic,gog,xbox' && r.meta.at === new Date(NOW).toISOString() && !r.meta.failed && !r.report.failed.length, r.meta);
check('طلبات Steam بدفعات لا لعبة لعبة', calls.filter(c => c === 'store.steampowered.com/api/appdetails').length <= 1 + 2 * 4 + 1, calls.filter(c => /steam/.test(c)).length);

console.log('مصدر لا يجيب');
const prev = new Map([[1, { pc: [{ s: 'steam', u: 'https://store.steampowered.com/app/100', free: 'gift' }, { s: 'epic', u: 'https://store.epicgames.com/p/alpha-quest-ab12cd', free: 'gift', from: iso(-48), until: iso(72) }, { s: 'xbox', u: 'https://x/9AAAAAAAAAA1', pass: 1 }] }], [3, { pc: [{ s: 'steam', u: 'https://store.steampowered.com/app/300' }] }]]);
down = new Set(['steam', 'epic', 'ms']); const f = await storesFor(games, { fetch: net, pause: 0, now: NOW, fix, prev }), fb = (id, s) => (f.rows.get(id) || []).find(x => x.s === s);
check('Steam لا يجيب: يبقى لكل لعبة ما كان لها، وما لا سابق له يبقى متجراً بلا حال', f.meta.failed.includes('steam') && fb(1, 'steam').free === 'gift' && fb(3, 'steam') && !fb(3, 'steam').free && fb(4, 'steam') && !fb(4, 'steam').off, [f.meta, f.rows.get(1), f.rows.get(4)]);
check('Epic لا يجيب: الهدية السابقة تبقى ما دامت مدتها لم تنتهِ', f.meta.failed.includes('epic') && fb(1, 'epic').free === 'gift' && fb(1, 'epic').until === iso(72), f.rows.get(1));
check('Microsoft لا يجيب: صف Xbox السابق يبقى', f.meta.failed.includes('microsoft') && fb(1, 'xbox')?.pass === 1 && fb(1, 'xbox').u === 'https://x/9AAAAAAAAAA1', f.rows.get(1));
const late = await storesFor(games, { fetch: net, pause: 0, now: NOW + 100 * 36e5, fix, prev });
check('وهدية سابقة انتهت مدتها لا تبقى', !(late.rows.get(1) || []).find(x => x.s === 'epic').free, late.rows.get(1));

console.log(fails.length ? `\n❌ فشل ${fails.length}: ${fails.join(' | ')}` : '\n✅ كل فحوص المتاجر نجحت'); process.exit(fails.length ? 1 : 0);
