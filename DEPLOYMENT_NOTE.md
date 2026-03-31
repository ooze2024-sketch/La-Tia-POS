# La Tia POS Deployment Note

This note explains how to deploy your full stack:
- Admin web: `Desktop/adminLaTiaPOS` (Vite + React)
- Backend + DB: `Desktop/latiabackend` (Laravel + MySQL)
- Mobile cashier app: `Desktop/latia_cashier` (connects to same backend API)

## 1) Target Architecture (Production)

- Backend API + MySQL runs on a server
- Admin web is built and hosted as static files
- Mobile app talks to the same backend API over HTTPS

Suggested public endpoints:
- Admin web: `https://admin.latia.example.com`
- API: `https://api.latia.example.com`

## 2) Deploy Order (Important)

1. Deploy database
2. Deploy backend API
3. Deploy admin web with backend URL
4. Point mobile app to backend URL
5. Run smoke tests

## 3) Backend + Database Deployment (Laravel + MySQL)

## 3.1 Provision server

- Ubuntu server (or similar), with:
  - PHP 8.1+
  - Composer
  - MySQL 8+
  - Nginx
  - SSL (LetsEncrypt)

## 3.2 Deploy backend code

On server:

```bash
cd /var/www
sudo git clone <your-backend-repo-url> latiabackend
cd latiabackend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

Edit backend `.env` for production:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.latia.example.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=latia_pos
DB_USERNAME=<db_user>   
DB_PASSWORD=<db_password>
```

Initialize DB:

```bash
php artisan migrate --force
php artisan db:seed --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 3.3 Nginx + SSL

- Configure Nginx site root to Laravel `public` folder
- Enable HTTPS certificate
- Confirm API is reachable:

```bash
curl https://api.latia.example.com/api/v1/categories
```

Expected: JSON response (or auth response), not HTML error page.

## 4) Admin Web Deployment (Vite + React)

This repo already uses `VITE_API_URL` and `npm run build`.

On your admin project (`Desktop/adminLaTiaPOS`) in CI or local build machine:

```bash
npm install
```

Set production API URL before build:

```env
VITE_API_URL=https://api.latia.example.com/api/v1
```

Build:

```bash
npm run build
```

Deploy generated `dist/` folder to static hosting:
- Netlify / Vercel / Cloudflare Pages, or
- Nginx static host (for `admin.latia.example.com`)

If hosting on Nginx, use SPA fallback to `index.html`.

## 5) Mobile Cashier App Deployment (`latia_cashier`)

In the mobile app, set API base URL to production backend:

- Use `https://api.latia.example.com/api/v1`
- Do not use localhost for production builds

Then build and release by platform:

- Android:
  - Generate signed AAB/APK
  - Upload to Play Console (internal testing first)
- iOS (if applicable):
  - Archive in Xcode
  - Upload to App Store Connect / TestFlight

If the app uses a config file or env file, keep separate values for dev/staging/prod.

## 6) CORS and Auth Checklist

Backend must allow requests from:
- `https://admin.latia.example.com`
- mobile app origins/schemes as required by your framework

Auth/token behavior should match web + mobile:
- Login endpoint: `/api/v1/auth/login`
- Include bearer token on protected routes
- Verify logout and token expiration behavior

## 7) Production Smoke Test (All 3 apps)

After deploy:

1. API health
   - `GET /api/v1/categories` returns API JSON/auth response
2. Admin login
   - Can log in from `admin.latia.example.com`
3. Admin CRUD
   - Create category/product/inventory item successfully
4. Mobile login and sales flow
   - Cashier can log in and create transaction
5. Data consistency
   - New records from admin/mobile are visible across both clients

## 8) Suggested CI/CD (Simple)

- Backend pipeline:
  - test -> deploy -> `php artisan migrate --force`
- Admin pipeline:
  - build -> deploy `dist/`
- Mobile pipeline:
  - build signed artifact -> distribute to testers -> release

## 9) Rollback Plan

- Keep previous backend release and DB backups
- Keep previous admin `dist/` artifact
- If release fails:
  - rollback backend code
  - restore DB backup if migration broke data
  - redeploy previous admin build

## 10) Your Current Local-to-Prod Mapping

Local now:
- Backend: `http://localhost:8000`
- Admin API env: `VITE_API_URL=http://localhost:8000/api/v1`

Production should be:
- Backend: `https://api.latia.example.com`
- Admin API env: `VITE_API_URL=https://api.latia.example.com/api/v1`
- Mobile API base: `https://api.latia.example.com/api/v1`

---

If you want, I can also make a second note that is provider-specific (for example: DigitalOcean + Nginx + MySQL + Cloudflare Pages) with exact copy-paste commands.
