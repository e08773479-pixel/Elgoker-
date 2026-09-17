# Malak | ملك — Social Platform

هذا المشروع هو النسخة الأساسية الكبيرة القابلة للنشر على GitHub Pages، مع واجهة RTL متجاوبة للموبايل والكمبيوتر وربط Supabase.

## الملفات
- `index.html` الواجهة.
- `css/style.css` التصميم Responsive.
- `js/config.js` بيانات اتصال Supabase.
- `js/app.js` المصادقة، المنشورات، الإعجابات، التعليقات، القصص، البحث، المتابعة، المحادثات، والمجموعات.
- `database/supabase.sql` مخطط قاعدة البيانات وسياسات RLS وStorage وRealtime.

## تشغيله على GitHub
1. أنشئ مشروع Supabase.
2. افتح SQL Editor والصق `database/supabase.sql` ثم نفذه.
3. من Project Settings > API خذ Project URL وAnon key.
4. ضع القيمتين داخل `js/config.js`.
5. ارفع مجلد المشروع إلى GitHub.
6. فعّل GitHub Pages.
7. في Supabase Authentication > URL Configuration ضع رابط GitHub Pages في Site URL وRedirect URLs.
8. لتسجيل Google فعّل Google Provider وأضف بيانات OAuth الخاصة بك في Supabase.

## مهم
لا يوجد مفتاح خدمة Service Role داخل المشروع. المفتاح الموجود في الواجهة يجب أن يكون Anon/Publishable key فقط.
تسجيل الهاتف يحتاج تفعيل Phone Provider وSMS في Supabase، وبعدها يمكن إضافة شاشة OTP الكاملة.
