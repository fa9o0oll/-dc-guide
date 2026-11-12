// منطق قائمة الأفلام المشترك بين بناء البيانات (build-films.mjs) ودالة «أضف فيلم» (netlify/functions/add-film.mjs):
// قراءة سطر مكتوب بحرّية، مطابقته في TMDB، وتشكيل بيانات الفيلم بالصيغة التي يقرؤها الموقع.
export const COUNTRY = 'SA';
const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
const isYear = s => /^(18|19|20)\d\d$/.test(s) && +s <= new Date().getFullYear() + 5;

// «the hunt (2012)» أو «2012 the hunt» أو «the hunt ٢٠١٢» → { title, year }. عنوان هو نفسه رقم سنة («2012») يبقى عنواناً.
export function parseLine(raw) {
  let s = String(raw || '').replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/[()\[\]{}"“”«»]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(movie|film|فيلم|فلم)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const t = s.split(' '); let year = null;
  if (t.length > 1 && isYear(t[t.length - 1])) year = +t.pop();
  else if (t.length > 1 && isYear(t[0]) && !t.slice(1).some(x => /^\d+$/.test(x))) year = +t.shift();
  return { title: t.join(' ').replace(/^[\s\-–:،,]+|[\s\-–:،,]+$/g, ''), year };
}

export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9؀-ۿ]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const yearOf = c => +(c.release_date || c.first_air_date || '').slice(0, 4) || null;

// يرتّب مرشحي البحث: تطابق العنوان ثم قرب السنة ثم عدد الأصوات. sure = تطابق العنوان مع سنة في حدود ±1 (أو بلا سنة مطلوبة ومرشح واحد واضح).
export function rank(cands, title, year) {
  const want = norm(title);
  const scored = cands.map(c => {
    const names = [c.title, c.original_title, c.name, c.original_name].filter(Boolean).map(norm), y = yearOf(c);
    const exact = names.includes(want), starts = !exact && names.some(n => n.startsWith(want + ' ') || want.startsWith(n + ' '));
    const dy = year && y ? Math.abs(y - year) : null;
    const score = (exact ? 6 : starts ? 3 : 0) + (dy === 0 ? 4 : dy === 1 ? 3 : dy === null ? 0 : -Math.min(dy, 6)) + Math.log10(1 + (c.vote_count || 0)) + (c.popularity ? Math.min(c.popularity, 50) / 100 : 0);
    return { c, score, exact, dy };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0];
  const sure = !!top && top.exact && (year ? top.dy !== null && top.dy <= 1 : (!scored[1] || top.score - scored[1].score > 1.5));
  return { scored, top: top?.c || null, sure };
}

// يبحث عن عمل بالعنوان والسنة. يجرّب السنة نفسها، ثم بلا سنة (لأن تاريخ TMDB قد يكون سنة العرض التجاري لا المهرجان).
export async function search(tmdb, kind, title, year) {
  const yk = kind === 'tv' ? 'first_air_date_year' : 'year', seen = new Map();
  const run = async p => { for (const c of (await tmdb('/search/' + kind, { query: title, include_adult: false, ...p }).catch(() => ({}))).results || []) if (!seen.has(c.id)) seen.set(c.id, c); };
  if (year) await run({ [yk]: year });
  if (!year || ![...seen.values()].some(c => [c.title, c.original_title, c.name, c.original_name].filter(Boolean).map(norm).includes(norm(title)))) await run({});
  return rank([...seen.values()], title, year);
}

const pickAr = tr => { const a = (tr?.translations || []).filter(t => t.iso_639_1 === 'ar'), by = c => a.find(t => t.iso_3166_1 === c);
  const t = by('SA') || by('AE') || a[0]; return t ? { title: (t.data.title || t.data.name || '').trim() || null, overview: (t.data.overview || '').trim() || null } : {}; };
const provIds = (list, dict) => (list || []).map(p => { dict[p.provider_id] = { name: p.provider_name, logo: p.logo_path }; return p.provider_id; });

export const detailPath = (kind, id) => `/${kind}/${id}`;
export const detailParams = kind => ({ language: 'en-US', append_to_response: kind === 'tv' ? 'external_ids,watch/providers,content_ratings,aggregate_credits,translations' : 'external_ids,watch/providers,release_dates,credits,translations' });

// يحوّل رد TMDB التفصيلي إلى سجلّ الفيلم في الموقع. providers قاموس مشترك يُملأ بأسماء المنصات وشعاراتها.
export function shape(kind, d, providers = {}) {
  const ar = pickAr(d.translations), wp = d['watch/providers']?.results?.[COUNTRY] || null;
  const date = (kind === 'tv' ? d.first_air_date : d.release_date) || null, title = kind === 'tv' ? d.name : d.title, orig = kind === 'tv' ? d.original_name : d.original_title;
  const us = kind === 'tv' ? (d.content_ratings?.results || []).find(r => r.iso_3166_1 === 'US')?.rating
    : (d.release_dates?.results || []).find(r => r.iso_3166_1 === 'US')?.release_dates.map(x => x.certification).find(Boolean);
  const crew = d.credits?.crew || [], cast = kind === 'tv' ? d.aggregate_credits?.cast || [] : d.credits?.cast || [];
  const o = { id: (kind === 'tv' ? 't' : 'm') + d.id, tmdb: d.id, kind, title, orig: orig && orig !== title ? orig : undefined, titleAr: ar.title && ar.title !== title ? ar.title : undefined,
    year: date ? +date.slice(0, 4) : null, date, status: d.status || null, runtime: kind === 'tv' ? undefined : d.runtime || null,
    genres: (d.genres || []).map(g => g.id), lang: d.original_language || null, countries: (d.production_countries || []).map(c => c.iso_3166_1).slice(0, 3),
    rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null, votes: d.vote_count || 0, poster: d.poster_path || null, backdrop: d.backdrop_path || null,
    imdb: (kind === 'tv' ? d.external_ids?.imdb_id : d.imdb_id || d.external_ids?.imdb_id) || null, cert: us || undefined,
    directors: kind === 'tv' ? (d.created_by || []).map(p => p.name).slice(0, 3) : crew.filter(p => p.job === 'Director').map(p => p.name).slice(0, 3),
    cast: cast.slice(0, 5).map(p => p.name), overviewEn: (d.overview || '').trim() || null, overviewAr: ar.overview || undefined,
    col: d.belongs_to_collection?.id || undefined,
    prov: wp ? { link: wp.link || undefined, stream: provIds(wp.flatrate, providers), free: provIds([...(wp.free || []), ...(wp.ads || [])], providers), rent: provIds(wp.rent, providers), buy: provIds(wp.buy, providers) } : null };
  if (kind === 'tv') { o.seasons = d.number_of_seasons || null; o.episodes = d.number_of_episodes || null; o.lastDate = d.last_air_date || null; }
  return JSON.parse(JSON.stringify(o));
}

// أجزاء السلسلة مرتبة بتاريخ الصدور. الأجزاء التي لم يُعلن تاريخها تأتي آخراً.
export const shapeCollection = c => ({ id: c.id, name: c.name.replace(/\s+Collection$/i, ''), poster: c.poster_path || null, backdrop: c.backdrop_path || null,
  parts: (c.parts || []).map(p => ({ tmdb: p.id, title: p.title, date: p.release_date || null, year: p.release_date ? +p.release_date.slice(0, 4) : null, poster: p.poster_path || null, rating: p.vote_count ? Math.round(p.vote_average * 10) / 10 : null }))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) });
