# دليل عوالم DC

- `data/` مصدر البيانات المعتمد (أعمال بمعرّفات ثابتة، عوالم، إدراجات، ترتيب آروفيرس، جسور الريميك).
- `scripts/validate.mjs` فحص سلامة البيانات — يُشغَّل قبل أي نشر: `node scripts/validate.mjs`
- `scripts/migrate-legacy.mjs` التحويل من النسخة القديمة (للتوثيق).
- `legacy/index.html` آخر نسخة شغالة من بناء Gemini (مرجع، لا تُعدَّل).
- `docs/REQUIREMENTS.md` سجل الطلبات وحالتها.
