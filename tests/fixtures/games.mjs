// بيانات ألعاب للفحص بشكل ما يبنيه scripts/build-games.mjs، ومواعيد ما لم يصدر محسوبة من اليوم (فلا تتقادم):
// سلسلة God of War بترتيب قصة رسمي، وGTA VI بموعد محدد (عدّ تنازلي)، وSilksong بربع سنة (بلا عدّ)، ولعبة بلا غلاف، واقتباسات بأرقام TMDB.
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), Y = new Date().getFullYear();
const L = (id, title, date, extra = {}) => ({ id, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, date, prec: date ? 'd' : 'tbd', human: null, year: date ? +date.slice(0, 4) : null, cover: 'c' + id, type: 'main', status: date && date <= day(0) ? 'released' : date ? 'upcoming' : 'tba', plats: ['ps5'], hype: 0, ...extra });
const gow = [L(549, 'God of War', '2005-03-22', { plats: ['ps2'] }), L(550, 'God of War II', '2007-03-13', { plats: ['ps2'] }), L(551, 'God of War: Chains of Olympus', '2008-03-04', { plats: ['psp'] }),
  L(552, 'God of War III', '2010-03-16', { plats: ['ps3'] }), L(553, 'God of War: Ghost of Sparta', '2010-11-02', { plats: ['psp'] }), L(554, 'God of War: Ascension', '2013-03-12', { plats: ['ps3'] }),
  L(19560, 'God of War', '2018-04-20', { plats: ['ps4', 'pc'] }), L(112875, 'God of War Ragnarök', '2022-11-09', { plats: ['ps5', 'ps4', 'pc'] })];
const gta = [L(1020, 'Grand Theft Auto V', '2013-09-17', { plats: ['ps5', 'xsx', 'pc', 'ps4', 'xone'] }), L(136625, 'Grand Theft Auto VI', day(40), { plats: ['ps5', 'xsx'], hype: 900 })];
const hk = [L(14593, 'Hollow Knight', '2017-02-24', { plats: ['pc', 'switch', 'ps4', 'xone'] }), { ...L(115289, 'Hollow Knight: Silksong', `${Y + 1}-03-31`, { plats: ['pc', 'switch', 'switch2'] }), prec: 'q', human: `Q1 ${Y + 1}`, status: 'upcoming' }];
const tlou = [L(1009, 'The Last of Us', '2013-06-14', { plats: ['ps3'] }), L(26192, 'The Last of Us Part II', '2020-06-19', { plats: ['ps4'] }), L(205780, 'The Last of Us Part I', '2022-09-02', { plats: ['ps5', 'pc'], type: 'remake' })];
const G = (base, x) => ({ ...base, titleAr: '', alt: [], early: undefined, art: 'a' + base.id, shots: ['s' + base.id + 'a', 's' + base.id + 'b', 's' + base.id + 'c'], dates: base.plats.map(p => ({ p, date: base.date, human: '' })),
  genres: ['مغامرة'], themes: ['أكشن'], modes: ['لاعب واحد'], persp: ['منظور الشخص الثالث'], dev: ['Studio'], pub: ['Publisher'], summary: `${base.title} is a game.`, story: '', critic: 85, criticN: 40, users: 82, usersN: 900,
  ttb: { h: 20, n: 30, c: 55, count: 300 }, series: [], franchises: [], rel: {}, ext: {}, sites: [], igdb: 'https://www.igdb.com/games/' + base.slug, wd: 'Q1', universe: null, from: [], into: [], videos: [], ...x });
export function fixture() {
  const series = {
    5: { name: 'God of War', slug: 'god-of-war', size: 12, members: gow, story: { order: [554, 551, 549, 553, 550, 552, 19560, 112875], note: 'ترتيب أحداث القصة كما يعرضه صنّاعها.', src: [{ name: 'PlayStation Blog', url: 'https://blog.playstation.com/' }] } },
    8: { name: 'Grand Theft Auto', slug: 'grand-theft-auto', size: 20, members: gta },
    9: { name: 'Hollow Knight', slug: 'hollow-knight', size: 2, members: hk },
    7: { name: 'The Last of Us', slug: 'the-last-of-us', size: 4, members: tlou },
  };
  const games = [
    G(gow[7], { series: [5], genres: ['مغامرة', 'تقمّص أدوار'], titleAr: 'إله الحرب: راغناروك', dev: ['Santa Monica Studio'], ttb: { h: 20, n: 26, c: 51, count: 640 }, rel: { dlcs: [L(260000, 'God of War Ragnarök: Valhalla', '2023-12-12', { type: 'dlc' })] },
      universe: { q: 'Q1', en: 'God of War universe', ar: '' }, into: [{ q: 'Q2', en: 'God of War', ar: '', kind: 'tv', tmdb: 't999001', year: 2027 }] }),
    G({ ...L(119133, 'Elden Ring', '2022-02-25', { plats: ['pc', 'ps5', 'xsx', 'ps4', 'xone'] }) }, { genres: ['تقمّص أدوار', 'مغامرة'], titleAr: 'إلدن رينغ', dev: ['FromSoftware'], ttb: { h: 52, n: 60, c: 133, count: 900 },
      rel: { expansions: [L(250616, 'Elden Ring: Shadow of the Erdtree', '2024-06-21', { type: 'expansion' })] } }),
    G({ ...L(1942, 'The Witcher 3: Wild Hunt', '2015-05-19', { plats: ['pc', 'ps4', 'xone', 'switch', 'ps5', 'xsx'] }) }, { genres: ['تقمّص أدوار'], titleAr: 'ذا ويتشر 3: الصيد البري', alt: ['TW3'], dev: ['CD Projekt RED'],
      from: [{ q: 'Q3', en: 'The Witcher', ar: 'الساحر', kind: 'novels', year: 1993 }], into: [{ q: 'Q4', en: 'The Witcher', ar: '', kind: 'tv', tmdb: 't71912', year: 2019 }, { q: 'Q5', en: 'Blade Runner 2049', ar: '', kind: 'film', tmdb: 'm335984', year: 2017 }] }),
    G({ ...L(117170, "Marvel's Spider-Man 2", '2023-10-20', { plats: ['ps5', 'pc'] }) }, { genres: ['أكشن', 'مغامرة'] }),
    G(gta[0], { series: [8], genres: ['أكشن', 'سباق'], alt: ['GTA V', 'GTA 5'] }),
    G(gta[1], { series: [8], genres: ['أكشن'], critic: null, users: null, ttb: null, summary: '' }),
    G(tlou[2], { series: [7], genres: ['أكشن', 'نجاة'], into: [{ q: 'Q6', en: 'The Last of Us', ar: 'ذا لاست أوف أس', kind: 'tv', tmdb: 't100088', year: 2023 }] }),
    G(hk[0], { series: [9], genres: ['منصات وقفز', 'مغامرة'], ttb: { h: 27, n: 40, c: 61, count: 400 } }),
    G({ ...L(11208, 'Minecraft', '2011-11-18', { plats: ['android', 'ios', 'pc', 'switch'] }) }, { genres: ['ساحة حرة'] }),
    G({ ...L(990001, 'Tiny Obscure Indie', '2021-05-01', { plats: ['pc'], cover: null }) }, { art: null, shots: [], genres: ['مستقلة'], critic: null, users: null, ttb: null }),
  ].map((g, i) => ({ ...g, ord: i, at: '2026-01-01T00:00:00Z' }));
  const plats = { ps5: { name: 'PlayStation 5', abbr: 'PS5', fam: 'ps' }, ps4: { name: 'PlayStation 4', abbr: 'PS4', fam: 'ps' }, ps3: { name: 'PlayStation 3', abbr: 'PS3', fam: 'ps' }, ps2: { name: 'PlayStation 2', abbr: 'PS2', fam: 'ps' },
    psp: { name: 'PlayStation Portable', abbr: 'PSP', fam: 'ps' }, pc: { name: 'PC (Microsoft Windows)', abbr: 'PC', fam: 'pc' }, xsx: { name: 'Xbox Series X|S', abbr: 'Xbox Series', fam: 'xbox' }, xone: { name: 'Xbox One', abbr: 'Xbox One', fam: 'xbox' },
    switch: { name: 'Nintendo Switch', abbr: 'Switch', fam: 'nin' }, switch2: { name: 'Nintendo Switch 2', abbr: 'Switch 2', fam: 'nin' }, android: { name: 'Android', abbr: 'Android', fam: 'mobile' }, ios: { name: 'iOS', abbr: 'iOS', fam: 'mobile' } };
  return { built: new Date().toISOString(), img: 'https://images.igdb.com/igdb/image/upload/', games, series, plats, franchises: {} };
}
// السجل المقابل: ختمت Ragnarök على PS5 وHollow Knight وGTA V، وألعب Elden Ring، وشاهدت Spider-Man 2 عند يوتيوبر
export const progress = { games: { 112875: { s: 'done', on: 'ps5', at: '2026-10-01', h: 45 }, 119133: { s: 'play', on: 'pc', at: '2026-11-10', h: 80 }, 117170: { s: 'seen', on: 'yt', at: '2026-09-01' },
  1020: { s: 'done', on: 'ps4', at: '2015-02-01', h: 70 }, 14593: { s: 'done', on: 'switch', at: '2024-05-01', h: 38 }, 1942: { s: 'new', at: '2026-01-02' } } };
// فهرس العناوين للاقتراحات
export const titles = { built: new Date().toISOString(), items: [[19560, 2018, 90, 9, 'God of War', 'إله الحرب'], [112875, 2022, 85, 9, 'God of War Ragnarök'], [119133, 2022, 92, 27, 'Elden Ring', 'إلدن رينغ'], [1942, 2015, 95, 15, 'The Witcher 3: Wild Hunt', 0, 'TW3'],
  [1020, 2013, 97, 11, 'Grand Theft Auto V', 0, 'GTA V|GTA 5'], [136625, 0, 70, 3, 'Grand Theft Auto VI', 0, 'GTA 6'], [11208, 2011, 96, 29, 'Minecraft', 'ماينكرافت'], [1009, 2013, 94, 1, 'The Last of Us'], [7346, 2017, 93, 4, 'The Legend of Zelda: Breath of the Wild']] };
