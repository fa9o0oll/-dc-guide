// المزامنة المجدولة لربط الحسابات (E84): كل نصف ساعة، والموقع مغلق: ما عدّلته في MyAnimeList يصل SIMKL والعكس، ويصل الموقع حين يُفتح.
// ويومياتك في Letterboxd تُقرأ معها (E86).
// المنطق في scripts/lib-accounts.mjs، والقفل يمنع تداخلها مع مزامنة تطلبها الصفحة في اللحظة نفسها.
import { blobStore, syncAnime, syncFilms } from '../../scripts/lib-accounts.mjs';

export default async () => { const S = await blobStore(); if (!await S.lock()) return;
  try { await syncAnime(S, { pull: true, budget: 60, deadline: Date.now() + 20000 }); await syncFilms(S, { pull: true }); }
  finally { await S.unlock(); } };
export const config = { schedule: '*/30 * * * *' };
