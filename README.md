# SME Expense Tracker — Full Stack

A Nigerian SME finance tracker built to satisfy the SD-08 project brief.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- API: REST
- Currency: Nigerian Naira (₦)

## MVP
- Add income and expenses
- Categories
- Edit/delete transactions
- Dashboard totals
- Search/filter
- Monthly reports
- Responsive mobile UI
- PostgreSQL persistence
- REST API

## Project structure
```
sme-expense-tracker-fullstack/
  frontend/
  backend/
```

## 1. Create PostgreSQL database

Create a PostgreSQL database with a provider such as Neon, Supabase, Render PostgreSQL, or a local PostgreSQL installation.

Set:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

## 2. Run backend
```
cd backend
npm install
npm run dev
```

The API runs on `http://localhost:5000`.

## 3. Run frontend
In another terminal:
```
cd frontend
npm install
npm run dev
```

The frontend runs on the Vite URL shown by the terminal.

## API endpoints
- GET `/api/health`
- GET `/api/categories`
- GET `/api/transactions`
- POST `/api/transactions`
- PUT `/api/transactions/:id`
- DELETE `/api/transactions/:id`
- GET `/api/summary`

## Environment variables
Backend `.env`:
```
PORT=5000
DATABASE_URL=your_postgresql_connection_string
CLIENT_URL=http://localhost:5173
```

## Deployment
Recommended:
- PostgreSQL: Neon or Render PostgreSQL
- Backend: Render
- Frontend: Vercel

Set the frontend `VITE_API_URL` to the deployed backend URL plus `/api`.

## Note on authentication
The supplied SD-08 brief explicitly requires entries, categories, reports and deployment; it does not list authentication as a core MVP feature. Authentication can therefore be added as a post-MVP enhancement if your assessor requests it.
