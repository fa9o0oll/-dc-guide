# ملاحظات لجلسات Claude في هذا المستودع

موقع شخصي بالعربية: أدلة مشاهدة ومكتبة ألعاب. الصفحات في `site/` (القاعة `/`، و`/dc/` و`/fate/` و`/films/` و`/games/`) بـJavaScript بلا إطار. يُنشر من `main` على Netlify وGitHub Pages.

## عبارات يقولها صاحب الموقع

- **«ترجم الجديد»**: نفّذ «دورة العمل» في `docs/GAMES-CARE.md` مرة واحدة، واكتب تقريرها كما يصفه آخر الدليل. تبدأ بـ`node scripts/games-care.mjs pending`، وطلبات زر «ترجمها لي» (الفرع `requests`، الملف `data/games/requests.json`) لها الأولوية. لا مهمة مجدولة لهذا: اختار أن تنتظر الطلبات حتى يقولها.

## النشر

1. `git checkout -- site/films/data site/fate/data site/dc/data site/games/data` (ملفات البناء يملكها روبوت البناء، ولا تُودَع).
2. `git pull --no-rebase --no-edit origin main`
3. الاختبارات: `export NODE_PATH=$(npm root -g)` ثم `node tests/<الاسم>.test.mjs`. ما مسّ ملفاً مشتركاً (`site/sync.js` مثلاً) تُشغَّل له كل المجموعات.
4. الدفع إلى `main` يشغّل البناء (`.github/workflows/`) والنشر. يُتابَع البناء حتى ينجح.

## حدود

- لا `git push --force`، ولا يودَع شيء تحت `site/*/data`.
- المفاتيح والأسرار يلصقها صاحب الموقع بنفسه، ولا تُقرأ ولا تُكتب في ملف ولا سجل.
- نصوص الصفحات عربية فصيحة، وأسماء الألعاب والأعمال بحروفها اللاتينية.
- كل طلب جديد وما نُفّذ منه يُضاف إلى `docs/REQUIREMENTS.md`.
