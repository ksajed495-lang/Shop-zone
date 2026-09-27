# Afghan Shop — Production Starter 🇦🇫

این پروژه یک پایهٔ واقعی برای فروشگاه آنلاین است:
- Node.js + Express
- PostgreSQL
- حساب کاربران و ورود امن با bcrypt + JWT در HttpOnly cookie
- نقش admin
- محصولات، موجودی و دسته‌بندی
- سفارش و order items
- داشبورد Admin
- آمادهٔ اتصال به درگاه پرداخت افغانستان
- واحد پول AFN

## راه‌اندازی محلی

1. Node.js نصب باشد.
2. PostgreSQL بسازید.
3. `.env.example` را به `.env` کپی کنید.
4. `DATABASE_URL` و `JWT_SECRET` را تنظیم کنید.
5. `ADMIN_EMAIL` و `ADMIN_PASSWORD` را تنظیم کنید.
6. اجرا:
   npm install
   node seed-admin.js
   npm start
7. مرورگر: http://localhost:3000

## پرداخت افغانستان

کد عمداً پرداخت جعلی را موفق اعلام نمی‌کند. برای پرداخت واقعی باید حساب تجاری/دسترسی API یک ارائه‌دهندهٔ مجاز را بگیرید و قرارداد API آن را در `POST /api/payments/create` و امضای webhook آن را در `/api/payments/webhook` پیاده کنید.

درگاه‌های افغانستان می‌توانند بر پایه AfPay/شبکه پرداخت ملی یا ارائه‌دهندگان مجاز باشند. APS زیر نظر Da Afghanistan Bank فعالیت می‌کند و AfPay را ارائه می‌دهد. برای HPP/API، ارائه‌دهنده‌ای مانند ShafafHub اعلام کرده که پس از بررسی کسب‌وکار و دسترسی API، hosted checkout و webhook ارائه می‌کند.

## استقرار

این پروژه برای سرویس‌های Node.js با PostgreSQL مناسب است. یک سرویس Web و یک PostgreSQL بسازید، متغیرهای `.env` را در پنل سرویس تنظیم کنید و command را `npm start` بگذارید.

## امنیت قبل از فروش واقعی

- `JWT_SECRET` طولانی و تصادفی باشد.
- رمز admin را فقط در environment تنظیم کنید و بعد از اولین راه‌اندازی تغییر دهید.
- HTTPS فعال باشد.
- rate limiting، CSRF مناسب برای معماری انتخابی، validation قوی و logging اضافه شود.
- کلیدهای پرداخت هرگز در frontend قرار نگیرند.
- webhook پرداخت باید با امضای رسمی provider بررسی شود.
