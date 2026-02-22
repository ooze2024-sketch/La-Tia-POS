# La Tia POS - Complete Integration Guide

## 🎯 Project Status

✅ **Complete Setup:**
- React frontend connected to Laravel API service
- Laravel backend with all models, controllers, and routes
- MySQL database fully configured with schema and seeders
- All files pushed to GitHub

---

## 🚀 Full Stack Architecture

```
┌─────────────────┐
│  React Frontend │ (Vite + TypeScript)
│  Port: 5173     │
└────────┬────────┘
         │ HTTP/JSON
         ↓
┌─────────────────┐
│ Laravel API     │ (REST API)
│ Port: 8000      │
└────────┬────────┘
         │ SQL
         ↓
┌─────────────────┐
│ MySQL Database  │
│ latia_pos       │
└─────────────────┘
```

---

## 🔧 Configuration Checklist

### Frontend (.env or hardcoded)
API endpoint: `http://localhost:8000/api/v1`

### Backend (.env)
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=latia_pos
DB_USERNAME=root
DB_PASSWORD=Nookie123
APP_KEY=base64:...  # Already set
```

### Database
- Host: `127.0.0.1:3306`
- Database: `latia_pos`
- User: `root`
- Password: `Nookie123`

---

## 🚦 Start Services (Complete Sequence)

### Step 1: Ensure MySQL is Running
```bash
# Windows - check services
Get-Service MySQL* | Start-Service

# Or verify connection
mysql -u root -pNookie123
```

### Step 2: Start Laravel Backend
```bash
cd "C:\Users\User\Desktop\LaTiaLaravel\backend"
php artisan serve --host=127.0.0.1 --port=8000
```
✅ Output: `Server running on [http://127.0.0.1:8000]`

### Step 3: Start React Frontend (in new terminal)
```bash
cd "c:\Users\User\Desktop\adminLaTiaPOS"
npm run dev
```
✅ Output: `VITE v... ready in ... ms`

### Step 4: Access Application
```
http://localhost:5173
```

---

## 🧪 Testing the Integration

### Quick API Test (Basic)
```bash
# Test Laravel is running
curl http://localhost:8000/api/user

# Expected: 401 Unauthorized (without token) or 500 if error
```

### Interactive Postman Test
1. Open Postman or Thunder Client
2. **POST** `http://localhost:8000/api/v1/auth/login`
3. **Body (raw JSON):**
   ```json
   {
     "username": "admin",
     "password_hash": "Nookie123"
   }
   ```
4. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Login successful",
     "data": {
       "user": {...},
       "token": "YOUR_JWT_TOKEN"
     }
   }
   ```

### Frontend Login Test
1. Open `http://localhost:5173`
2. Enter credentials:
   - Username: `admin`
   - Password: `Nookie123`
3. Click "Log In"
4. Should navigate to admin dashboard and load products/inventory from API

---

## 🐛 Troubleshooting

### Issue: "Cannot POST /api/v1/auth/login"
**Cause:** Routes not registered or Laravel not restarted after code changes

**Fix:**
```bash
cd "C:\Users\User\Desktop\LaTiaLaravel\backend"
php artisan route:list | grep auth
php artisan serve --force
```

### Issue: "500 Internal Server Error"
**Cause:** Database not seeded or Laravel app key not set

**Fix:**
```bash
php artisan config:cache
php artisan db:seed
php artisan serve --force
```

### Issue: "No database connection"
**Cause:** MySQL not running or wrong credentials in `.env`

**Fix:**
```bash
# Verify MySQL running
mysql -u root -pNookie123 -e "SELECT 1"

# Check .env is correct
cat .env | grep DB_

# Reseed if needed
php artisan migrate:refresh --seed
```

### Issue: Frontend shows "Login failed"
**Cause:** API not responding or CORS error

**Fix:**
1. Check Laravel is running: `http://localhost:8000`
2. Check network tab in browser for API response
3. Verify `.env` has correct MySQL credentials
4. Enable CORS in Laravel if needed:
   ```bash
   composer require fruitcake/laravel-cors
   php artisan vendor:publish --provider="Fruitcake\Cors\CorsServiceProvider"
   ```

### Issue: "Port 8000 already in use"
**Fix:**
```bash
# Kill existing process
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or use different port
php artisan serve --port=8001
```

---

## 🔄 Common Workflows

### Restart Everything
```bash
# Terminal 1: Laravel backend
cd "C:\Users\User\Desktop\LaTiaLaravel\backend"
php artisan cache:clear
php artisan serve

# Terminal 2: React frontend
cd "c:\Users\User\Desktop\adminLaTiaPOS"
npm run dev
```

### Reset Database to Fresh State
```bash
# Clear and reseed
cd "C:\Users\User\Desktop\LaTiaLaravel\backend"
php artisan migrate:refresh --seed

# Verify users created
php artisan tinker
>>> App\Models\User::all();
```

### Test Sample Transaction
```bash
# Use Postman/Curl
POST http://localhost:8000/api/v1/sales
Authorization: Bearer <your_token>

Body:
{
  "user_id": 1,
  "items": [
    {
      "product_id": 1,
      "name": "Adobo",
      "quantity": 2,
      "unit_price": 25,
      "cost": 20
    }
  ],
  "payments": [
    {
      "method": "card",
      "amount": 50
    }
  ]
}
```

---

## 📊 Database Verification

### Check Database Connection
```bash
mysql -u root -pNookie123 latia_pos -e "
  SELECT COUNT(*) as users FROM users;
  SELECT COUNT(*) as products FROM products;
  SELECT COUNT(*) as sales FROM sales;
"
```

### View Sample Data
```bash
mysql -u root -pNookie123 latia_pos -e "
  SELECT id, username, role_id FROM users LIMIT 5;
  SELECT id, name, price FROM products LIMIT 5;
  SELECT * FROM payments LIMIT 5;
"
```

---

## 📁 Key Files & Locations

### Frontend
- **Login Page:** `src/pages/LoginPage.tsx` - Calls `authAPI.login()`
- **Admin Page:** `src/pages/AdminPage.tsx` - Loads data via API on mount
- **API Service:** `src/services/api.ts` - All API calls defined here
- **Run:** `npm run dev` (Port 5173)

### Backend
- **Routes:** `routes/api.php` - All endpoints (v1 prefix)
- **Controllers:** `app/Http/Controllers/Api/` - Request handlers
- **Models:** `app/Models/` - Eloquent models
- **Seeders:** `database/seeders/` - Sample data
- **Config:** `.env` - MySQL connection
- **Run:** `php artisan serve` (Port 8000)

### Database
- **Location:** `c:\Users\User\Desktop\adminLaTiaPOS\database\`
- **Schema:** `01_schema.sql`
- **Seeds:** `02_seed_data.sql`
- **Database:** `latia_pos`

---

## 🎯 Expected API Responses

### Successful Login
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "full_name": "Owner",
      "is_active": true,
      "role": {"id": 1, "name": "admin"}
    },
    "token": "123|abc..."
  }
}
```

### Get Products
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sku": "ADB-001",
      "name": "Adobo",
      "category_id": 1,
      "price": 25.00,
      "cost": 20.00
    },
    ...
  ]
}
```

### Get Today's Sales
```json
{
  "success": true,
  "data": {
    "sales": [...],
    "total_revenue": 500.00,
    "transaction_count": 5
  }
}
```

---

## ✅ Verification Checklist

- [ ] MySQL running (`mysql -u root -pNookie123`)
- [ ] Database exists (`mysql -e "USE latia_pos; SHOW TABLES;"`)
- [ ] Laravel server running (`http://localhost:8000 → works`)
- [ ] React server running (`http://localhost:5173 → loads`)
- [ ] Login works (enter admin/Nookie123)
- [ ] Products load in admin page
- [ ] API token stored in localStorage
- [ ] All endpoints responding with `{"success": true}`

---

## 🎉 You're Ready!

Your full-stack POS system is ready to use. Log in with:
- **Username:** admin
- **Password:** Nookie123

The frontend will automatically sync with the Laravel backend API. All changes are persisted to MySQL.

---

## 📞 Need Help?

Check the error output in:
1. **Laravel Terminal** - Shows API errors
2. **Browser Console** - Show frontend errors
3. **Browser Network Tab** - Shows API requests/responses
4. **Laravel Logs** - `storage/logs/laravel.log`

---

## 🔗 GitHub Repository

All code (frontend + backend) pushed to:
```
https://github.com/ooze2024-sketch/La-Tia-POS
```

Pull latest before making changes:
```bash
git pull origin main
```
