# BP Analytics — CRM & Live Ops Dashboard for BreakProtection

Production-grade CRM and live analytics dashboard for BreakProtection's 24 stores across India.

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, JWT auth
- **Database**: MySQL 8 / MariaDB 10.x (XAMPP for local dev)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts, TanStack Query, Zustand
- **Sync**: Google Sheets API v4 (stubbed until credentials provided)

## Prerequisites

- Python 3.11+
- Node.js 18+
- MariaDB/MySQL (via XAMPP or native install)

## Local Setup

### 1. Database

Start XAMPP MariaDB, then create the database:

```sql
CREATE DATABASE bp_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env with your database credentials
```

### 3. Seed Data

```bash
python scripts/seed.py
```

This creates:
- 7 roles (SuperAdmin, Admin, CEO, COO, Regional Manager, Team Leader, Store Staff, Viewer)
- ~60 permissions (14 resources x ~4-5 actions)
- SuperAdmin account: `admin@breakprotection.com` / `admin123`
- COO account: `coo@breakprotection.com` / `coo123`
- 6 Team Leaders with store access
- 24 stores (all INR)
- 5 currencies (INR, USD, GBP, AED, EUR)
- 10 KPI weights (summing to 1.00)
- 4 incentive bands (with Below Target placeholder)

### 4. Run Backend

```bash
uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173, proxies API calls to localhost:8000.

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

32 tests covering:
- KPI scoring engine (band resolution, weighted scores)
- Currency formatting (INR Lakh/Crore, Western K/M/B)
- Currency conversion logic
- Password hashing (bcrypt)
- JWT token creation/verification
- Permission checking logic

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Async MySQL connection string | `mysql+aiomysql://root:password@localhost:3306/bp_analytics` |
| `JWT_SECRET_KEY` | Secret for JWT signing | `change-me-to-a-random-secret` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token TTL | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token cookie TTL | `7` |
| `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` | Path to service account JSON | Empty (sync no-ops) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `BASE_REPORTING_CURRENCY` | Company-wide rollup currency | `INR` |
| `SMARTSERVICE_MCP_URL` | SmartService MCP endpoint | `https://smartserviceapitemp.azurewebsites.net/mcp` |
| `DEFAULT_TIMEZONE` | Server timezone | `Asia/Kolkata` |

## API Endpoints

### Auth
- `POST /api/v1/auth/login` — Login (returns JWT + refresh cookie)
- `POST /api/v1/auth/refresh` — Refresh access token
- `GET /api/v1/auth/me` — Current user + permissions
- `POST /api/v1/auth/logout` — Clear refresh cookie
- `POST /api/v1/auth/forgot-password` — Generate reset token
- `POST /api/v1/auth/set-password` — Set password via token

### Resources (CRUD)
- `/api/v1/stores` — Store management
- `/api/v1/submissions` — Daily submissions
- `/api/v1/leads` — Lead management + activities + lost reasons
- `/api/v1/campaigns` — Campaign management
- `/api/v1/tasks` — Task management
- `/api/v1/investments` — Investment tracking
- `/api/v1/users` — User management
- `/api/v1/roles` — Role + permission matrix
- `/api/v1/performance/scores` — KPI scores + incentive bands
- `/api/v1/reports/*` — Monthly summary, leaderboard, lost reasons, CSV export
- `/api/v1/dashboard` — CEO dashboard (KPIs, charts, trends)
- `/api/v1/currencies` — Currency + exchange rate management
- `/api/v1/sync/*` — Google Sheets sync (stubbed)
- `/api/v1/settings/*` — KPI weights, incentive bands, app settings

## Roles & Permissions

| Role | Dashboard | Stores | Operations | Leads | Tasks | Performance | Reports | Admin |
|---|---|---|---|---|---|---|---|---|
| SuperAdmin | Full | Full | Full | Full | Full | Full | Full | Full |
| Admin | Full | Full | Full | Full | Full | Full | Full | Full |
| CEO | View | View | View | View | View | View+Export | View | - |
| Team Leader | View | View | View+Edit | Create+Edit | Create+Edit | View | View | - |
| Store Staff | View | View | Create | Create | View | - | - | - |
| Viewer | View | View | View | View | View | View | View | - |

## Google Sheets Sync

### Setup (requires Abhin)

1. Create a Google Cloud project with Sheets API + Drive API enabled
2. Create a service account, download the JSON key
3. Set `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` in `.env`
4. Share each Google Sheet with the service account email as Viewer
5. Add sheet sources via Settings > Data Sync or the API

### Adding a New Sheet Source

```bash
curl -X POST http://localhost:8000/api/v1/sync/sources \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"label": "Daily Ops", "spreadsheet_id": "...", "tab_mappings": {...}}'
```

## Open Items (Section 0)

- [ ] Below Target incentive band values (placeholder: min=0, multiplier=1.0)
- [ ] Care+ Attachment Rate weight (currently 0.00 — confirm intentional)
- [ ] Google Sheets tab names and headers for all 3 sources
- [ ] Sheet #3: native Sheet or uploaded .xlsx?
- [ ] SmartService MCP API key
- [ ] Email sending scope for invite/reset flow
