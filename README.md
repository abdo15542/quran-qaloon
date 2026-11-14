# Quran Qaloon — تسميع القرآن، قالون عن نافع

تطبيق ويب (React + Vite) لتسميع القرآن برواية قالون عن نافع، محوّل إلى أندرويد عبر Capacitor.

- 114 سورة، 8 قراءات، 20 قارئًا
- تشغيل صوتي، بحث في الآيات، أذكار، تسبيح، ختمة، تحميلات دون اتصال
- تصحيح التجويد بالميكروفون (Web Speech API — يعمل في المتصفح، ولا يعمل داخل WebView أندرويد)

## البناء

```sh
pnpm install
PORT=5173 BASE_PATH='./' pnpm --filter @workspace/quran-qaloon run build
pnpm --filter @workspace/quran-qaloon exec cap sync android
```

## بناء APK عبر GitHub Actions

أضف ملف `.github/workflows/android.yml` (انظر `upload-guide.md` في ملفات المشروع)، ثم شغّل الـ workflow من تبويب Actions. الـ APK يظهر في Artifacts باسم `quran-qaloon-debug-apk` (نسخة debug).

النص والصوت من الإنترنت (api.alquran.cloud وشبكات mp3quran / quranicaudio) ما لم تكن السورة محمّلة مسبقًا.
