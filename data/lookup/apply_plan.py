# يطبّق خطة E91 على كتالوج DC: الأعمال والإدراجات والنبذات والعالمان الجديدان (ليغو والعروض القصيرة). يُشغَّل مرة واحدة من جذر المستودع.
import json, re, glob, os
R = lambda p: json.load(open(p, encoding='utf-8'))
def W(p, o, ind=2): open(p, 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False, indent=ind) + '\n')
plan = []
for f in sorted(glob.glob('data/lookup/plan*.py')):
    ns = {}; exec(open(f, encoding='utf-8').read(), ns)
    for k, v in ns.items():
        if re.fullmatch(r'B\d', k): plan += v
det = {(('tv' if r['k'] == 'tv' else 'mv') + str(r['id'])): r for r in R('data/lookup/dc-details-result.json')}
IND_T = 1
works, P, U, T = R('data/works.json'), R('data/placements.json'), R('data/universes.json'), R('data/translations/works.json')
have = {w['id'] for w in works}
fix = {'arrow:the-flash-chronicles-of-cisco-2016': 'dc-s-legends-of-tomorrow-2016', 'arrow:freedom-fighters-the-ray-2017': 'the-flash-chronicles-of-cisco-2016'}
# العالمان الجديدان، كما في دليل مارفل
newU = [
 {"id": "lego", "section": "القسم 20", "name": "ليغو دي سي", "nameEn": "LEGO DC", "serial": False, "status": "أعمال منفردة", "color": "#ffd21a", "motif": "diamonds", "description": "أفلام وحلقات خاصة بشخصيات ليغو، كوميدية وتناسب العائلة."},
 {"id": "shorts", "section": "القسم 21", "name": "عروض قصيرة", "nameEn": "Shorts & Web Series", "serial": False, "status": "أعمال منفردة", "color": "#86b8ff", "motif": "spiral", "description": "أفلام وحلقات قصيرة لا تتجاوز دقائق: عروض DC Showcase، وفقرات DC Nation، وما عُرض على الإنترنت، والحلقات الخاصة الساخرة."},
]
for u in newU:
    if not any(x['id'] == u['id'] for x in U): U.append(u)
year_of = {w['id']: w.get('year') or 0 for w in works}
date_of = {}
# ما يُدرج بعد عمل من الخطة نفسها ينتظر حتى يُدرج ذاك (Cisco قبل The Ray في آروفيرس)
order, placed_ids, pending = [], set(), list(plan)
while pending:
    nxt = []
    for e in pending:
        tgt = fix.get(f'{e[1]}:{e[4]}', e[8])
        if tgt and tgt not in have and tgt not in placed_ids: nxt.append(e); continue
        order.append(e); placed_ids.add(e[4])
    if len(nxt) == len(pending): raise SystemExit('ترتيب مستحيل: ' + ', '.join(e[4] for e in nxt))
    pending = nxt
for key, uni, kind, medium, wid, title, year, qual, after, note, ov in order:
    if wid in have: raise SystemExit('معرّف موجود: ' + wid)
    d = det[key]; tmdb = d['id']; imdb = d.get('imdb')
    w = {"id": wid, "title": title, "year": year, "kind": kind, "medium": medium, "ids": ({"imdb": imdb} if imdb else {}) | {"tmdb": tmdb}, "idsVerified": True}
    works.append(w); have.add(wid); year_of[wid] = year; date_of[wid] = d.get('d') or f'{year}-12-31'
    T[wid] = ov
    group = [p for p in P if p['universe'] == uni]; group.sort(key=lambda p: p['position'])
    serial = next(x for x in U if x['id'] == uni)['serial']
    after = fix.get(f'{uni}:{wid}', after)
    if serial:
        i = next(j for j, p in enumerate(group) if p['work'] == after) + 1
        pos = i + 1
        for p in group[i:]:
            p['position'] += 1; p['label'] = re.sub(r'^\d+', str(p['position']), p['label'])
        P.append({"universe": uni, "work": wid, "position": pos, "label": f"{pos} ({qual})" if qual else str(pos), "note": note})
    else:
        # منفرد: بترتيب الصدور (السنة ثم التاريخ)، والقادم يبقى في آخره
        key_new = (year, date_of[wid])
        i = len(group)
        for j, p in enumerate(group):
            if p['label'].startswith('قادم') or (year_of.get(p['work'], 0), date_of.get(p['work'], f"{year_of.get(p['work'], 0)}-07-01")) > key_new: i = j; break
        for p in group[i:]: p['position'] += 1
        label = f'منفرد ({year})' if uni == 'early_st' else 'منفرد'
        P.append({"universe": uni, "work": wid, "position": i + 1, "label": label, "note": note})
W('data/works.json', works); W('data/placements.json', P); W('data/universes.json', U); W('data/translations/works.json', T, IND_T)
# هوية العالمين الجديدين في الصفحة
th = open('site/themes-dc.js', encoding='utf-8').read()
if "  lego:" not in th:
    th = th.replace("  anim_mv_st:", "  lego:       { bg: '#170c02', c1: '#ffd21a', c2: '#ff4a3d', motif: 'diamonds', key: 'lego-dc-comics-super-heroes-justice-league-attack-of-the-legion-of-doom-2015' },\n  shorts:     { bg: '#0a1020', c1: '#86b8ff', c2: '#ffd24a', motif: 'spiral',   key: 'dc-showcase-batman-death-in-the-family-2020' },\n  anim_mv_st:", 1)
    open('site/themes-dc.js', 'w', encoding='utf-8').write(th)
print('added', len(plan), 'works; universes', len(U))
