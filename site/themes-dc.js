// هوية كل عالم: لون الأرضية، لونان مميّزان، نقش الجو، والعمل الذي تؤخذ منه صورة العالم.
// هذه قرارات تصميم لا بيانات؛ الصور نفسها تأتي من كتالوج TMDB.
export const THEMES = {
  dcu:        { bg: '#07183a', c1: '#ffc23d', c2: '#4f96ff', motif: 'rays',     key: 'superman-2025' },
  dceu:       { bg: '#0b0f14', c1: '#c9a063', c2: '#6f8fae', motif: 'steel',    key: 'man-of-steel-2013' },
  reeves:     { bg: '#0d0606', c1: '#ee3b34', c2: '#8a98a6', motif: 'rain',     key: 'the-batman-2022' },
  nolan:      { bg: '#060b14', c1: '#f2a341', c2: '#3f7fc4', motif: 'beam',     key: 'the-dark-knight-2008' },
  joker:      { bg: '#08130f', c1: '#e3b53c', c2: '#d1423a', motif: 'stairs',   key: 'joker-2019' },
  burton:     { bg: '#0c0918', c1: '#b693ff', c2: '#f2d14b', motif: 'gothic',   key: 'batman-1989' },
  reeve:      { bg: '#05152e', c1: '#77ccff', c2: '#ef4a45', motif: 'crystal',  key: 'superman-1978' },
  arrow:      { bg: '#05140e', c1: '#37d683', c2: '#ffd84a', motif: 'bolts',    key: 'the-flash-2014' },
  titans:     { bg: '#0f091c', c1: '#aa74ff', c2: '#ff5f80', motif: 'slash',    key: 'titans-2018' },
  sandman:    { bg: '#09091d', c1: '#dcc48e', c2: '#7673ff', motif: 'sand',     key: 'the-sandman-2022' },
  dcau:       { bg: '#130505', c1: '#ff5446', c2: '#f6c453', motif: 'deco',     key: 'batman-the-animated-series-1992' },
  dcamu:      { bg: '#140904', c1: '#ff7f35', c2: '#ffd166', motif: 'embers',   key: 'justice-league-dark-apokolips-war-2020' },
  tomorrow:   { bg: '#05191b', c1: '#54e3c3', c2: '#ffb86b', motif: 'horizon',  key: 'superman-man-of-tomorrow-2020' },
  harley:     { bg: '#16050b', c1: '#ff4573', c2: '#ffd24a', motif: 'diamonds', key: 'harley-quinn-2019' },
  early_st:   { bg: '#161108', c1: '#e9b85f', c2: '#d15a45', motif: 'halftone', key: 'batman-1966' },
  movie_st:   { bg: '#130707', c1: '#ff6253', c2: '#f2c14e', motif: 'spiral',   key: 'watchmen-2009' },
  tv_st:      { bg: '#060f19', c1: '#57abff', c2: '#a8d8ff', motif: 'scan',     key: 'gotham-2014' },
  anim_tv_st: { bg: '#05140b', c1: '#5fe272', c2: '#c2ff96', motif: 'stars',    key: 'young-justice-2010' },
  anim_mv_st: { bg: '#150606', c1: '#ff4242', c2: '#ffa24a', motif: 'halftone', key: 'batman-under-the-red-hood-2010' },
};
// لون يميّز كل مسلسل في ترتيب آروفيرس، ليُعرف المسلسل من أول نظرة
export const SHOW_COLORS = {
  'arrow-2012': '#37d683', 'the-flash-2014': '#ff5a4a', 'constantine-2014': '#e0a83c', 'supergirl-2015': '#57abff',
  'dc-s-legends-of-tomorrow-2016': '#f1e3b0', 'black-lightning-2018': '#ffe14a', 'batwoman-2019': '#d6325a', 'stargirl-2020': '#ffb347', 'superman-and-lois-2021': '#c9d6ff',
};
