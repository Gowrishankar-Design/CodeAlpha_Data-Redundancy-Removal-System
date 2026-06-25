# Data Redundancy Removal System — Full Stack

React frontend + FastAPI backend, with a persistent database, deployable on Vercel + Render.

## What's new in this version

- **Persistent storage.** Records used to live in a Python list in memory —
  gone the moment the backend restarted. They now live in a real SQL
  database (SQLite by default, or Postgres via one env var) and survive
  restarts, redeploys, and crashes.
- **Connection status indicator.** A dot in the header (and a banner when
  needed) shows whether the backend is online, waking up from sleep, or
  unreachable — so a slow free-tier cold start doesn't look like a bug.
- **Search + CSV export** on the records table.
- **Confirmation prompt** before wiping the database, since the data is
  now actually worth keeping.
- **Responsive layout** — the two-column view collapses to one column on
  narrow/mobile screens.
- A few small bug fixes (a status dot that rendered as a square instead of
  a circle, missing favicon/meta tags, keyboard focus styles).

---

## Project structure

```
drrs-fullstack/
├── backend/
│   ├── main.py            ← FastAPI app (all pipeline + API logic)
│   ├── database.py        ← SQLAlchemy engine/session setup
│   ├── models.py           ← ORM model for stored records
│   ├── requirements.txt    ← Python dependencies
│   ├── render.yaml          ← Render deployment config
│   └── .env.example        ← optional DATABASE_URL documentation
└── frontend/
    ├── public/
    │   ├── index.html
    │   └── favicon.svg
    ├── src/
    │   ├── App.js                    ← Main UI
    │   ├── api.js                    ← Axios API calls
    │   ├── hooks/useBackendStatus.js ← Backend connectivity polling
    │   ├── index.js
    │   ├── index.css
    │   └── components/
    │       ├── Pipeline.js       ← Live pipeline trace
    │       ├── RecordsTable.js   ← Database view (search + CSV export)
    │       └── ActivityLog.js    ← Submission history
    ├── package.json
    ├── vercel.json
    └── .env               ← Set your Render URL here
```

---

## How the persistence works

By default the backend stores everything in a SQLite file,
`backend/drrs.db`, created automatically the first time it runs. This
needs no setup and the data is genuinely still there the next time you
start the server — that's the actual fix for "the database disappears
when the backend closes."

If you deploy to Render's free tier, the filesystem is preserved across
sleep/wake cycles (the normal case when the service has been idle) but is
wiped on a fresh redeploy. If you want records to survive redeploys too,
point the backend at a real Postgres database instead — no code changes
needed, just set one environment variable:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Good free options for that connection string: [Neon](https://neon.tech),
[Supabase](https://supabase.com), or Render's own Postgres add-on. Without
it, SQLite is used automatically.

---

## Step 1 — Run locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Runs at http://localhost:8000
# Docs at http://localhost:8000/docs
```

A `drrs.db` file will appear in `backend/`. Stop the server, start it
again, and your records are still there.

### Frontend
```bash
cd frontend
npm install
npm start
# Runs at http://localhost:3000
```

---

## Step 2 — Deploy backend to Render

1. Go to https://render.com and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo (push this project first — see below)
4. Set these settings:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Runtime:** Python 3
5. *(Optional, for persistence across redeploys)* Add an environment
   variable `DATABASE_URL` pointing at a Postgres database (see above).
6. Click **Deploy**
7. Copy the URL — looks like `https://drrs-backend.onrender.com`

---

## Step 3 — Connect frontend to backend

Open `frontend/.env` and update:
```
REACT_APP_API_URL=https://drrs-backend.onrender.com
```

---

## Step 4 — Deploy frontend to Vercel

1. Go to https://vercel.com and sign up (free)
2. Click **Add New → Project**
3. Import your GitHub repo
4. Set **Root Directory** to `frontend`
5. Under **Environment Variables**, add:
   - Key: `REACT_APP_API_URL`
   - Value: `https://your-render-url.onrender.com`
6. Click **Deploy**

Done — your app is live.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/health` | DB-backed health check (used by the frontend's connection indicator) |
| POST | `/submit` | Submit a record for validation |
| GET | `/records` | List all accepted records (optional `?search=` query param) |
| GET | `/stats` | Total record count |
| DELETE | `/records` | Clear all records |

Interactive API docs: `https://your-render-url.onrender.com/docs`

---

## Publishing to GitHub

From the project's root folder (`drrs-fullstack/`):

```bash
git init
git add .
git commit -m "Initial commit: DRRS with persistent database"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

If you don't have a GitHub repo yet: go to https://github.com/new, create
an **empty** repository (don't check "Add a README"), then use the URL it
gives you in the `git remote add origin` command above.

To push future changes:
```bash
git add .
git commit -m "Describe your change"
git push
```

---

## Note on free tiers

Render's free tier spins down after 15 minutes of inactivity; the first
request after sleep takes up to ~30–50 seconds, which is exactly what the
frontend's connection banner is detecting and explaining when it appears.
The data itself is unaffected by sleeping — only a full redeploy without
an external `DATABASE_URL` would reset it.
