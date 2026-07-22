# InsightMD — AI Clinical Intelligence Copilot

A PoC clinical intelligence app for doctors: patient dashboard, AI copilots, knowledge assistant (PDF RAG), document import, and executive insights.

**Stack**

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI + SQLAlchemy |
| Database | PostgreSQL |
| Vector store | Qdrant (local or cloud) |
| AI | OpenAI (chat + embeddings) |

---

## Prerequisites

Install these before setup:

- **Node.js** 20+ and npm  
- **Python** 3.11+  
- **PostgreSQL** 14+  
- **Qdrant** (local Docker recommended, or Qdrant Cloud)  
- An **OpenAI API key** (for copilots and knowledge search)

Optional: Docker Desktop (easiest way to run Qdrant locally).

---

## Project structure

```text
AI-Clinical-Intelligence-Copilot/
├── Backend/          # FastAPI API
│   ├── app/
│   ├── scripts/      # e.g. seed_demo_user.py
│   ├── requirements.txt
│   └── .env          # create this (see below)
└── Frontend/         # React app
    ├── src/
    ├── package.json
    └── .env          # create this (see below)
```

---

## 1. Database (PostgreSQL)

### Create the database

```sql
CREATE DATABASE clinical_intelligence_copilot;
```

### Create tables

Run these in that database (schemas match the backend models):

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'doctor',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    age INT,
    gender VARCHAR(20),
    conditions TEXT,
    medications TEXT,
    allergies TEXT,
    last_visit DATE,
    recent_labs TEXT,
    risk_level VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    amount NUMERIC(10, 2),
    status VARCHAR(20),
    claim_date DATE
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    appointment_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,  -- completed | no_show | scheduled | cancelled
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
```

Seed `patients`, `claims`, and `appointments` with your own demo rows as needed.  
Appointment statuses used by Insights No-Show Trend: **`completed`** and **`no_show`**.

---

## 2. Qdrant (Knowledge Assistant)

### Option A — Local with Docker

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

Dashboard: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

### Option B — Qdrant Cloud

Use your cluster URL and API key in `Backend/.env` (`QDRANT_URL`, `QDRANT_API_KEY`).

The knowledge collection is created automatically on first PDF upload.

---

## 3. Backend setup

```bash
cd Backend
```

### Create a virtual environment

**Windows (PowerShell)**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Configure environment

Create `Backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=clinical_intelligence_copilot

# JWT
JWT_SECRET_KEY=change-me-to-a-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# CORS (must include your Vite origin)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# OpenAI
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Qdrant
QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=          # only if using Qdrant Cloud
QDRANT_COLLECTION_NAME=clinical_knowledge
QDRANT_VECTOR_SIZE=1536
QDRANT_TOP_K=8
```

### Seed the demo doctor user

With the venv active and `.env` configured:

```bash
python scripts/seed_demo_user.py
```

Default login:

| Field | Value |
|-------|--------|
| Email | `doctor@demo.com` |
| Password | `Demo@123` |

### Start the API

```bash
uvicorn app.main:app --reload --port 8000
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)  
- Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)  
- Health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 4. Frontend setup

Open a **second** terminal:

```bash
cd Frontend
npm install
```

### Configure environment

Create `Frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

If you expose the API via ngrok (or similar), set that URL instead and add the same origin to backend `CORS_ORIGINS`.

### Start the UI

```bash
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

---

## Quick start checklist

1. PostgreSQL running + database/tables created + sample patient/claim/appointment data  
2. Qdrant running on `6333` (or cloud configured)  
3. `Backend/.env` filled in (DB, JWT, OpenAI, Qdrant, CORS)  
4. Backend venv + `pip install -r requirements.txt`  
5. `python scripts/seed_demo_user.py`  
6. `uvicorn app.main:app --reload --port 8000`  
7. `Frontend/.env` with `VITE_API_BASE_URL=http://127.0.0.1:8000`  
8. `npm install` then `npm run dev` in `Frontend`  
9. Sign in with `doctor@demo.com` / `Demo@123`

---

## Features (after login)

| Area | What it does |
|------|----------------|
| **Dashboard** | Patient/claim summary cards, recent patients, floating AI Copilot |
| **Patients** | Searchable patient list + profile |
| **Patient Copilot** | Patient-specific clinical chat (SOAP, referral letter, etc.) |
| **Knowledge Assistant** | Chat over uploaded clinical PDFs (RAG via Qdrant) |
| **Import Documents** | Multi-PDF upload into the knowledge base |
| **Insights** | Revenue, no-show, claim denials, and risk charts with per-chart date filters |

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Frontend can’t reach API | `VITE_API_BASE_URL`, backend running on 8000, CORS includes `http://localhost:5173` |
| Login fails | Run `seed_demo_user.py`; confirm `users` table and DB credentials in `.env` |
| Knowledge upload / chat fails | Qdrant up; valid `OPENAI_API_KEY`; embeddings model matches `QDRANT_VECTOR_SIZE` (1536 for `text-embedding-3-small`) |
| No-show chart empty | Appointments need status `completed` or `no_show` (not `no show`) |
| Token expired / forced logout | Normal after `ACCESS_TOKEN_EXPIRE_MINUTES`; sign in again |

---

## Security notes

- Do **not** commit real `.env` files or API keys.  
- Change `JWT_SECRET_KEY` and DB password for any shared or production-like environment.  
- This project is a **demo / PoC**, not production-hardened clinical software.
