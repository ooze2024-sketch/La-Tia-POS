# La Tia POS - Complete Integration Guide

## 🎯 Project Status - UPDATED

✅ **Complete Setup:**
- React frontend **NOW FULLY CONNECTED** to Laravel API service
- Laravel backend with all models, controllers, and routes
- MySQL database fully configured with schema and seeders
- All API services integrated with automatic token management
- Authentication system working
- CRUD operations connected to database

---

## 🚀 Full Stack Architecture

```
┌──────────────────────────┐
│  React Frontend (Vite)  │ (Port: 5173)
│  - AdminPage.tsx        │
│  - LoginPage.tsx        │
│  - API Services (6)     │
└────────┬─────────────────┘
         │ HTTP/JSON (axios)
         │ Token in headers
         ↓
┌──────────────────────────┐
│  Laravel REST API        │ (Port: 8000)
│  /api/v1                 │
│  - Auth endpoints        │
│  - Category routes       │
│  - Product routes        │
│  - Inventory routes      │
│  - Sales routes          │
│  - Dashboard routes      │
└────────┬─────────────────┘
         │ SQL
         ↓
┌──────────────────────────┐
│  MySQL Database          │
│  latia_pos               │
│  - users table           │
│  - categories table      │
│  - products table        │
│  - inventory_items table │
│  - sales table           │
└──────────────────────────┘
```

---

## 🔧 Configuration

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000/api/v1
```

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

---

## 📦 API Services

The frontend now includes 6 fully integrated API services:

### 1. **authService** - User Authentication
- `login(username, password)` - Authenticate user
- `logout()` - Clear session and token
- `getUser()` - Fetch current user info
- `getStoredUser()` - Get user from localStorage
- `isAuthenticated()` - Check auth status

### 2. **categoryService** - Category Management
- `getAll()` - Get all categories
- `getById(id)` - Get specific category
- `create(data)` - Create new category
- `update(id, data)` - Update category
- `delete(id)` - Delete category

### 3. **productService** - Product/Item Management
- `getAll()` - Get all products
- `getById(id)` - Get specific product
- `getByCategory(categoryId)` - Filter by category
- `create(data)` - Create new product
- `update(id, data)` - Update product
- `delete(id)` - Delete product

### 4. **inventoryService** - Inventory Management
- `getAll()` - Get all inventory items
- `getById(id)` - Get specific item
- `create(data)` - Add inventory item
- `update(id, data)` - Update quantity/details
- `delete(id)` - Remove inventory item
- `addMovement(id, data)` - Record stock movement

### 5. **saleService** - Sales Operations
- `getAll()` - Get all sales
- `getById(id)` - Get specific sale
- `create(data)` - Record new sale
- `getSalesByDateRange()` - Get sales in date range
- `getDailySales()` - Get today's sales
- `recordPayment()` - Record payment
- mutating calls automatically include `X-Idempotency-Key`

### Duplicate-Charge Enforcement (Backend Required)
Backend must enforce idempotency for `POST /sales` and `POST /sales/{id}/payment`:

- Read `X-Idempotency-Key` from request headers
- Hash and store key in `idempotency_keys.key_hash`
- Hash canonical request payload into `idempotency_keys.request_hash`
- Use unique guard on `(scope, key_hash)` to block races
- On exact replay (same key + same payload hash), return original response from `response_body`
- On key reuse with different payload hash, return conflict and do not create a second charge
- Persist replay attempts and decisions in `payment_replay_audit`

Recommended response behavior:

- `201/200` for first successful write
- `200` for exact replay with header `X-Idempotent-Replay: true`
- `409` for same key but mismatched payload
- `425` or `409` when the same key is currently processing/locked

Database support added in `database/01_schema.sql`:

- `idempotency_keys` table (key registry, request hash, stored response, expiry)
- `payments` constraints (`uq_payments_sale_idempotency`, `uq_payments_gateway_reference`)
- `payment_replay_audit` table for accepted/replayed/blocked outcomes

### 6. **dashboardService** - Dashboard Analytics
- `getStats()` - Get dashboard statistics
- `getSalesTrend()` - Get sales trends

### 7. **syncService** - Offline Queue Monitoring
- `getVersion()` - Get sync protocol/version info
- `getQueue({ status })` - List offline queue records
- `getSummary()` - Aggregate queue status counts
- `retryQueueItem(id)` - Retry failed or queued record
- `cancelQueueItem(id)` - Stop syncing a queue record
- `resolveConflict(id, data)` - Resolve conflict (`retry|cancel|force`)

### Offline Sync Backend Contract (Required)
To fully support offline cashier transaction syncing and admin-side recovery tools, add these backend routes:

- `GET /api/v1/sync/version`
- `GET /api/v1/sync/queue`
- `GET /api/v1/sync/queue/summary`
- `POST /api/v1/sync/queue/{id}/retry`
- `POST /api/v1/sync/queue/{id}/cancel`
- `POST /api/v1/sync/queue/{id}/resolve`

If these endpoints are missing, the admin app now shows a warning banner in the Offline Sync page instead of failing silently.

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
cd "C:\Users\User\Desktop\LatiaBackend"

# Install dependencies if not already done
composer install

# Run migrations if needed
php artisan migrate:fresh --seed

# Start the server
php artisan serve --host=127.0.0.1 --port=8000
```
✅ Output: `Server running on [http://127.0.0.1:8000]`

### Step 3: Install Frontend Dependencies
```bash
cd "c:\Users\User\Desktop\adminLaTiaPOS"

# Install npm dependencies (including axios)
npm install
```

### Step 4: Start React Frontend (in new terminal)
```bash
cd "c:\Users\User\Desktop\adminLaTiaPOS"
npm run dev
```
✅ Output: `VITE v... ready in ... ms`

---

## ✅ Testing the Integration

### 1. Verify Backend is Running
```bash
# In your browser or terminal
curl http://localhost:8000/api/v1/categories
```
Should return JSON response (may need auth token)

### 2. Check Frontend Loads
Open `http://localhost:5173` in browser
You should see the login page

### 3. Test Login
- Navigate to login page
- Use test credentials from database
- On success, should redirect to admin page

### 4. Test Category Creation
1. Log in to admin panel
2. Go to Items Management
3. Add a new category
4. Should appear in the list immediately

### 5. Check API Calls
1. Open browser DevTools (F12)
2. Go to Network tab
3. Perform an action (create category, item, etc.)
4. Should see POST/GET requests to `http://localhost:8000/api/v1/...`

---

## 🔐 Authentication

### How It Works
1. User logs in with username/password
2. Backend validates against MySQL `users` table
3. Backend returns auth token
4. Frontend stores token in localStorage as `auth_token`
5. All subsequent requests include token in header

### Token Format
```
Authorization: Bearer <token>
```

### Create Demo User (if needed)
```sql
USE latia_pos;
INSERT INTO users (username, password_hash, email, full_name, role_id, is_active)
VALUES ('admin', HASH('password123'), 'admin@latia.com', 'Admin User', 1, 1);
```

---

## 🐛 Troubleshooting

### Problem: "Failed to connect to server"
**Solution:**
1. Verify MySQL is running
2. Check Laravel is running on port 8000
3. Verify database connection in backend .env
4. Check `.env` in frontend has correct API URL

### Problem: 401 Unauthorized
**Solution:**
1. Check user exists in database
2. Verify password is correct
3. Clear localStorage and try again
4. Check token is being stored properly

### Problem: API 404 errors
**Solution:**
1. Verify routes exist in `routes/api.php`
2. Check route prefix is `/api/v1`
3. Verify backend is running
4. Check spelling of route names

### Problem: Empty categories/products
**Solution:**
1. Run database migrations: `php artisan migrate:fresh --seed`
2. Check data in MySQL database:
   ```sql
   SELECT * FROM categories;
   SELECT * FROM products;
   ```
3. Verify API endpoints are returning data

### Problem: CORS Errors
**Solution:**
May need to configure CORS in Laravel (already should be handled by default)
Check if `fruitcake/laravel-cors` is installed

---

## 📝 Recent Changes

### Frontend Updates:
✅ Added axios library
✅ Created 6 API service modules
✅ Updated AdminPage.tsx with real API calls
✅ Updated LoginPage.tsx with backend authentication
✅ Added .env configuration
✅ Implemented automatic token management
✅ Added error handling and user feedback

### Services Added:
- `src/services/apiConfig.ts` - Axios configuration
- `src/services/authService.ts` - Authentication
- `src/services/categoryService.ts` - Categories
- `src/services/productService.ts` - Products
- `src/services/inventoryService.ts` - Inventory
- `src/services/saleService.ts` - Sales
- `src/services/dashboardService.ts` - Dashboard
- `src/services/index.ts` - Export all services

### Updated Components:
- `src/pages/LoginPage.tsx` - Real authentication
- `src/pages/AdminPage.tsx` - Real CRUD operations

---

## 🎯 What's Connected

| Feature | Status |
|---------|--------|
| User Authentication | ✅ Connected |
| Category Management | ✅ Connected |
| Product Management | ✅ Connected |
| Inventory Management | ✅ Connected |
| Stock Movements | ✅ Ready |
| Sales Recording | ✅ Ready |
| Dashboard Stats | ✅ Ready |
| User Logout | ✅ Connected |

---

## 📚 API Response Format

All endpoints follow this format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 🔍 Debugging Tips

1. **Check Network Requests:**
   - F12 > Network tab > Look for API calls
   - Check request/response headers and body

2. **Check Console Errors:**
   - F12 > Console tab > Look for errors
   - Click on error to see full details

3. **Check Backend Logs:**
   - Terminal where Laravel is running
   - Look for SQL errors or exceptions

4. **Check Database:**
   ```sql
   USE latia_pos;
   SHOW TABLES;
   SELECT * FROM categories;
   DESC users;
   ```

---

## 🚀 Next Steps

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
