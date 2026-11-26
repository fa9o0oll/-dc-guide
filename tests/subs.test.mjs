// يفحص حساب «ضمن Game Pass Ultimate أو PS Plus Deluxe الآن» (scripts/lib-subs.mjs) بلا شبكة: الكتالوجان مُحاكيان. node tests/subs.test.mjs
import { subsFor, psName, GP, PSL } from '../scripts/lib-subs.mjs';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 700)}`); if (!ok) fails.push(n); };
const G = (id, title, x = {}) => ({ id, title, year: 2020, plats: ['pc', 'xsx', 'ps5'], ext: {}, sites: [], ...x });
const games = [
  G(1, 'Halo Quest', { ext: { ms: ['9HALO0000001'] } }),
  G(2, 'Doom', { year: 1993, plats: ['pc'] }),
  G(3, 'Forza Track', { year: 2021, plats: ['xsx'] }),
  G(4, 'EA Racer', { ext: { ms: ['9EARACER0001'] } }),
  G(5, 'Leaving Game', { ext: { xbox: '9LEAVE000001' }, sites: [{ t: 'xstore', url: 'https://www.xbox.com/en-US/games/store/leaving-game/9LEAVE000001' }] }),
  G(6, 'Spider Hero', { year: 2018, plats: ['ps4'], ext: { psn: '111' } }),
  G(7, 'Ghost Isle', { plats: ['ps4', 'ps5'] }),
  G(8, 'Retro Bandit', { year: 1997, plats: ['ps1'] }),
  G(9, 'Monthly Hit', { ext: { psn: '444' } }),
  G(10, 'Twin Title'), G(11, 'Twin Title'),
  G(12, 'Both Lists', { ext: { psn: '555' } }),
  G(13, 'Prev Keeper', { ext: { ms: ['9PREV0000001'] } }),
  G(14, 'Nowhere Game', { ext: { ms: ['9NOWHERE0001'], psn: '999' } }),
  G(15, 'Future Saga', { ext: { ms: ['9COMING00001'] } }),
];
// ---------- الكتالوجان المُحاكيان
const SIGL = { console: ['9HALO0000001', '9FORZA000001', '9LEAVE000001', '9PREV0000001'], pc: ['9HALO0000001'], pc2: ['9HALO0000001', '9DOOM0000001'], all: ['9HALO0000001', '9FORZA000001', '9DOOM0000001', '9EARACER0001', '9LEAVE000001', '9PREV0000001'],
  eaA: ['9EARACER0001'], eaB: [], leaving: ['9LEAVE000001'], leavingPc: [], coming: ['9COMING00001'], comingPc: ['9COMING00001'] };
const prod = (id, title, year, plat = ['Windows.Xbox', 'Windows.Desktop']) => ({ ProductId: id, LocalizedProperties: [{ ProductTitle: title }], MarketProperties: [{ OriginalReleaseDate: `${year}-03-01T00:00:00.0000000Z` }],
  DisplaySkuAvailabilities: [{ Sku: { SkuType: 'full', Properties: { Packages: [{ PlatformDependencies: plat.map(p => ({ PlatformName: p })) }] } }, Availabilities: [] }] });
const MS = { '9HALO0000001': prod('9HALO0000001', 'Halo Quest', 2020), '9FORZA000001': prod('9FORZA000001', 'Forza Track Standard Edition', 2021, ['Windows.Xbox']), '9DOOM0000001': prod('9DOOM0000001', 'DOOM', 2016),
  '9EARACER0001': prod('9EARACER0001', 'EA Racer', 2020), '9LEAVE000001': prod('9LEAVE000001', 'Leaving Game', 2020), '9PREV0000001': prod('9PREV0000001', 'Prev Keeper', 2020), '9COMING00001': prod('9COMING00001', 'Future Saga', 2027) };
const ps = (conceptId, name, device, x = {}) => ({ conceptId, name, nameEn: name, conceptUrl: `https://store.playstation.com/en-sa/concept/${conceptId}`, device, ...x });
const PSD = { extra: [ps(111, 'Spider Hero', ['PS4', 'PS5']), ps(222, "Ghost Isle DIRECTOR'S CUT PS4 & PS5", ['PS4', 'PS5']), ps(333, 'Twin Title', ['PS5']), ps(555, 'Both Lists', ['PS5'])],
  ubi: [], deluxe: [ps(666, 'Retro Bandit (PS1)', ['PS4', 'PS5']), ps(555, 'Both Lists', ['PS4'])], month: [ps(444, 'Monthly Hit™', ['PS5'])] };
const json = (status, body) => ({ status, json: async () => body });
function mock({ gpDown = false, psDown = false } = {}) { return async url => {
  const u = new URL(url);
  if (u.host === 'catalog.gamepass.com') { if (gpDown) return json(503, null); const k = Object.keys(GP).find(k => GP[k] === u.searchParams.get('id')); return json(200, [{ siglId: GP[k], title: k }, ...(SIGL[k] || []).map(id => ({ id }))]); }
  if (u.host === 'displaycatalog.mp.microsoft.com') { if (gpDown) return json(503, null); return json(200, { Products: u.searchParams.get('bigIds').split(',').map(id => MS[id]).filter(Boolean) }); }
  if (u.host === 'www.playstation.com') { if (psDown) return json(503, null); const k = Object.keys(PSL).find(k => PSL[k] === u.searchParams.get('categoryList')); const list = PSD[k] || [];
    return json(200, [{ catalogKey: 'A', count: list.length, games: list.slice(0, 2) }, { catalogKey: 'B', count: 0, games: [] }, { catalogKey: 'C', count: list.length - 2, games: list.slice(2) }]); }
  return json(404, null); }; }

console.log('psName');
check('strips "PS4 & PS5"', psName("Ghost Isle DIRECTOR'S CUT PS4 & PS5") === "Ghost Isle DIRECTOR'S CUT", psName("Ghost Isle DIRECTOR'S CUT PS4 & PS5"));
check('strips "(PS1)" and trademarks', psName('Retro Bandit™ (PS1)') === 'Retro Bandit', psName('Retro Bandit™ (PS1)'));
check('strips "(PlayStation®5)"', psName('Grand Auto V (PlayStation®5)') === 'Grand Auto V', psName('Grand Auto V (PlayStation®5)'));
check('keeps names that only contain digits', psName('Persona 5 Royal') === 'Persona 5 Royal', psName('Persona 5 Royal'));

console.log('subsFor');
const r = await subsFor(games, { fetch: mock(), pause: 0 }), at = id => r.rows.get(id) || {};
check('by id: console and PC', JSON.stringify(at(1).gp?.on) === '["xbox","pc"]' && !at(1).gp.ea && !at(1).gp.out && /9HALO0000001$/.test(at(1).gp.u), at(1));
check('by name: a new game of the same name and another year is not matched', !at(2).gp, at(2));
check('by name: its standard edition of the same year is matched (no separate catalog name)', JSON.stringify(at(3).gp?.on) === '["xbox"]' && !at(3).gp.n && /9FORZA000001$/.test(at(3).gp.u), at(3));
check('EA Play only: platforms from the product, marked ea', JSON.stringify(at(4).gp?.on) === '["xbox","pc"]' && at(4).gp.ea === 1, at(4));
check('leaving soon, link from IGDB kept', at(5).gp?.out === 1 && at(5).gp.u.includes('/en-US/games/store/leaving-game/'), at(5));
check('PS by concept: catalog with its platforms', at(6).ps?.k === 'extra' && JSON.stringify(at(6).ps.on) === '["ps4","ps5"]' && at(6).ps.u.endsWith('/concept/111'), at(6));
check('PS by name: an edition, platform suffix removed', at(7).ps?.k === 'extra' && at(7).ps.n === "Ghost Isle DIRECTOR'S CUT", at(7));
check('PS classics are Deluxe', at(8).ps?.k === 'deluxe', at(8));
check('PS monthly game', at(9).ps?.k === 'month' && !at(9).ps.n, at(9));
check('two games of one name are not matched by name', !at(10).ps && !at(11).ps, [at(10), at(11)]);
check('in the catalog and the classics: catalog first, platforms joined', at(12).ps?.k === 'extra' && JSON.stringify(at(12).ps.on) === '["ps5","ps4"]', at(12));
check('in neither', !r.rows.has(14), at(14));
check('coming soon: platforms from the coming lists, marked soon, not counted as included', at(15).gp?.soon === 1 && JSON.stringify(at(15).gp.on) === '["xbox","pc"]' && !at(15).gp.out, at(15));
check('meta counts', r.meta.n.gp === 5 && r.meta.n.ps === 5 && !r.meta.failed, r.meta);

// +18 (E75): checked like any other game, but the report names it by its number alone, with no title from either catalog
{ const AD = new Set([3, 7]), a = await subsFor(games.map(g => AD.has(g.id) ? { ...g, adult: 1 } : g), { fetch: mock(), pause: 0 }), txt = JSON.stringify(a.report);
  check('+18: rows as usual, report by number only', [...AD].every(id => JSON.stringify(a.rows.get(id)) === JSON.stringify(r.rows.get(id))) && !/Forza Track|Ghost Isle/i.test(txt) && '+18 #3' in a.report.games && '+18 #7' in a.report.games && /Halo Quest/.test(txt),
    [Object.keys(a.report.games), a.report.byTitle]); }
const prev = new Map([[13, { gp: { on: ['xbox'], u: 'x' } }], [6, { ps: { k: 'deluxe', on: [], u: 'old' } }], [14, { gp: { on: ['pc'], u: 'gone' } }]]);
const down = await subsFor(games, { fetch: mock({ gpDown: true }), pause: 0, prev });
check('Game Pass unreachable: previous rows kept, failure reported', down.rows.get(13)?.gp?.u === 'x' && down.rows.get(14)?.gp?.u === 'gone' && down.meta.failed.includes('gamepass'), [down.rows.get(13), down.meta]);
check('…while PS Plus is recomputed', down.rows.get(6)?.ps?.k === 'extra', down.rows.get(6));
const ok = await subsFor(games, { fetch: mock(), pause: 0, prev });
check('both reachable: a game that left is dropped', !ok.rows.get(14), ok.rows.get(14));

console.log(fails.length ? `\n${fails.length} failed` : '\nall passed'); process.exit(fails.length ? 1 : 0);
