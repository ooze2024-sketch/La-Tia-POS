# La-Tia-POS

## Development

The React frontend runs with Vite. The dev server is configured to proxy `/api` requests to the Laravel backend at `http://localhost:8000`.

Keep the backend running on port 8000 (e.g. `php artisan serve --port=8000`) when testing the UI so that cross‑origin CORS errors are avoided.