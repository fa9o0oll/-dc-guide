// ثيم كل عالم في «أنمياتي»: لون أرضيته (bg) ولوناه المميِّزان (c1 وc2) ونقش جوّه (motif) ولمسته الخاصة إن كانت له (sig).
// العوالم الكبرى في قائمة صاحب الموقع (39) لها ثيم مصمم يدوياً هنا (قرارات تصميم لا بيانات)، وغيرها يأخذ ألوانه من أغلفة أعماله
// (لون الغلاف من AniList، ac في الكتالوج) ونقشه من تصنيف أعماله. يستعمله شريط السلاسل (توهج كل عالم بلونه) والبوابة (site/anime-gate.js).
// المفتاح رقم السلسلة (أصغر أرقام أعمالها في MyAnimeList، كما في الكتالوج).
export const THEMES = {
  5081:  { bg: '#0a0909', c1: '#efe9dc', c2: '#e0262f', motif: 'typo', sig: 'cards' },       // Monogatari: بطاقات Shaft النصية، أسود وأبيض وأحمر
  223:   { bg: '#150903', c1: '#ffa02e', c2: '#4d8dff', motif: 'rays', sig: 'ki' },          // Dragon Ball: هالة الطاقة
  21:    { bg: '#03111f', c1: '#f7c948', c2: '#ef4444', motif: 'waves', sig: 'sea' },        // One Piece: البحر وقبعة القش
  20:    { bg: '#140a04', c1: '#ff8a26', c2: '#3a7bff', motif: 'spiral' },                  // Naruto: الدوامة
  31964: { bg: '#071320', c1: '#3fd98a', c2: '#ffd23f', motif: 'halftone' },                // My Hero Academia: نقاط القصص المصورة
  37430: { bg: '#06131d', c1: '#62d4ff', c2: '#ffd46e', motif: 'embers' },                  // Tensei shitara Slime
  28121: { bg: '#0c0a19', c1: '#9bbcff', c2: '#ffcf6b', motif: 'gothic' },                  // DanMachi: أقواس الزنزانة
  527:   { bg: '#130707', c1: '#ff5a5a', c2: '#ffd84a', motif: 'stars' },                   // Pokémon
  23755: { bg: '#0f0a05', c1: '#ebb75d', c2: '#72c6ff', motif: 'embers' },                  // Nanatsu no Taizai
  16498: { bg: '#0c0d0b', c1: '#d6b07a', c2: '#5f8f5f', motif: 'steel' },                   // Shingeki no Kyojin: الأسوار
  20583: { bg: '#130803', c1: '#ff8f22', c2: '#f4f1ea', motif: 'rays' },                    // Haikyuu!!
  31478: { bg: '#07080f', c1: '#e3c27f', c2: '#7d98d8', motif: 'rain' },                    // Bungou Stray Dogs
  6702:  { bg: '#160706', c1: '#ff5f4c', c2: '#ffcf52', motif: 'embers' },                  // Fairy Tail
  39535: { bg: '#061017', c1: '#8fd6c9', c2: '#ecc56c', motif: 'horizon' },                 // Mushoku Tensei
  37999: { bg: '#15060c', c1: '#ff7396', c2: '#ffd36a', motif: 'diamonds' },                // Kaguya-sama
  269:   { bg: '#070707', c1: '#f3f0e9', c2: '#ff6b2c', motif: 'slash' },                   // Bleach
  38691: { bg: '#04120b', c1: '#6ee391', c2: '#cbb8ff', motif: 'crystal' },                 // Dr. Stone
  34599: { bg: '#04101a', c1: '#7fd6ea', c2: '#f2c876', motif: 'stars' },                   // Made in Abyss
  38000: { bg: '#0b0d0b', c1: '#ff5c50', c2: '#33c3a0', motif: 'check' },                   // Kimetsu no Yaiba: نقش المربعات
  30276: { bg: '#130f05', c1: '#ffd84d', c2: '#ff5050', motif: 'halftone' },                // One Punch Man
  918:   { bg: '#0a0c14', c1: '#cdd8ff', c2: '#ff7396', motif: 'halftone' },                // Gintama
  136:   { bg: '#05120a', c1: '#6fe38e', c2: '#ffd36a', motif: 'stars' },                   // Hunter x Hunter
  235:   { bg: '#060c1c', c1: '#5a93ff', c2: '#ff5252', motif: 'rain' },                    // Meitantei Conan
  665:   { bg: '#12061a', c1: '#cb78ff', c2: '#ffd84d', motif: 'menacing' },                // JoJo
  1575:  { bg: '#0d0614', c1: '#c473ff', c2: '#ff5276', motif: 'crystal' },                 // Code Geass
  30:    { bg: '#0a0612', c1: '#9466ff', c2: '#72ff84', motif: 'scan' },                    // Evangelion
  121:   { bg: '#140805', c1: '#ff7040', c2: '#f3c552', motif: 'circle' },                  // Fullmetal Alchemist: دائرة التحويل
  22319: { bg: '#0c0505', c1: '#ff4040', c2: '#f3f0e9', motif: 'gothic' },                  // Tokyo Ghoul
  33950: { bg: '#07090a', c1: '#62e08f', c2: '#ff5050', motif: 'embers' },                  // Black Clover
  40748: { bg: '#07070f', c1: '#8191ff', c2: '#ff5c7c', motif: 'slash' },                   // Jujutsu Kaisen
  31240: { bg: '#0b0a16', c1: '#ad91ff', c2: '#82d6fc', motif: 'gothic' },                  // Re:Zero
  4975:  { bg: '#0c0a06', c1: '#f2c47f', c2: '#82d6ff', motif: 'scan' },                    // Steins;Gate
  29803: { bg: '#08060f', c1: '#b791ff', c2: '#ffd06e', motif: 'gothic' },                  // Overlord
  11757: { bg: '#050b16', c1: '#6fc7ff', c2: '#ffb44a', motif: 'scan' },                    // Sword Art Online
  263:   { bg: '#120806', c1: '#ff6a4a', c2: '#f3f0e9', motif: 'rays' },                    // Hajime no Ippo
  4654:  { bg: '#070b18', c1: '#8fb2ff', c2: '#ffcf62', motif: 'crystal' },                 // Toaru Majutsu no Index
  356:   { bg: '#14060a', c1: '#e6b65c', c2: '#d2334a', motif: 'circle' },                  // Fate: دائرة الاستدعاء، بألوان دليله
  43:    { bg: '#04100f', c1: '#5ff2d0', c2: '#ff5c8a', motif: 'scan' },                    // Koukaku Kidoutai (Ghost in the Shell)
  1412:  { bg: '#150606', c1: '#ff5a48', c2: '#ffd84d', motif: 'halftone' },                // Lupin III: السترة الحمراء
};
// نقش الجو من تصنيفات العالم، بالأولوية: أول ما يوجد منها
const MOTIF = [[['Mecha', 'Space'], 'scan'], [['Sci-Fi', 'Time Travel'], 'crystal'], [['Sports', 'Team Sports', 'Combat Sports', 'Racing'], 'rays'],
  [['Mystery', 'Detective', 'Psychological', 'Suspense'], 'rain'], [['Horror', 'Gore', 'Vampire'], 'gothic'], [['Samurai', 'Historical', 'Martial Arts'], 'slash'],
  [['Romance', 'Love Polygon', 'Love Status Quo', 'Shoujo'], 'diamonds'], [['Comedy', 'Gag Humor', 'Parody'], 'halftone'], [['Music', 'Idols (Female)', 'Idols (Male)', 'Showbiz', 'Performing Arts'], 'stars'],
  [['Isekai', 'Fantasy', 'Mythology', 'Supernatural', 'Urban Fantasy', 'Mahou Shoujo'], 'embers'], [['Adventure'], 'horizon'], [['Slice of Life', 'Iyashikei', 'CGDCT'], 'sand'], [['Action', 'Shounen', 'Super Power'], 'bolts']];
// ---------- الألوان: من لون الغلاف إلى لون مميِّز فاتح يُقرأ على أرضية داكنة، وأرضية داكنة من درجته
const hsl = hex => { const n = parseInt(hex, 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
const css = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const dist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const cache = new WeakMap();
export function themeOf(w, by, genres = []) { if (cache.has(w)) return cache.get(w); let t = THEMES[w.id];
  if (!t) { const order = w.story || w.ids, head = by.get(w.head), cols = order.map(id => by.get(id)?.ac).filter(Boolean), first = head?.ac || cols[0];
    let c1 = '#7fd4ff', c2 = '#ff6f91', bg = '#0e1028';
    if (first) { const [h, s0] = hsl(first), s = Math.min(.92, Math.max(.55, s0));
      if (s0 < .14) { c1 = '#ece6da'; bg = '#0b0b0f'; } else { c1 = css(h, s, .7); bg = css(h, Math.min(.5, s0 * .7 + .1), .075); }
      const other = cols.map(hsl).filter(([hh, ss]) => ss > .25 && dist(hh, h) >= 35).sort((x, y) => dist(y[0], h) - dist(x[0], h))[0];
      c2 = other ? css(other[0], Math.min(.9, Math.max(.6, other[1])), .66) : css((h + 150) % 360, .75, .66); }
    // النقش من تصنيفات أعمال العالم كلها: الأكثر حضوراً في المجموعة الأعلى أولوية
    const count = new Map(); for (const id of order) for (const g of by.get(id)?.g || []) { const n = genres[g]; if (n) count.set(n, (count.get(n) || 0) + 1); }
    const motif = MOTIF.find(([names]) => names.some(n => count.has(n)))?.[1] || 'stars';
    t = { bg, c1, c2, motif }; }
  cache.set(w, t); return t; }
export const themeVars = t => `--bg:${t.bg};--c1:${t.c1};--c2:${t.c2}`;
