"""
Data Redundancy Removal System — FastAPI Backend
=================================================
Deploy on Render.com (or any Python host) as a web service.

Storage: persistent SQL database (SQLite file by default, or any
Postgres URL via the DATABASE_URL env var). Records survive backend
restarts, redeploys (with Postgres) and sleep/wake cycles — see
database.py and the README for details.
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from typing import Optional
import hashlib, os, re
from datetime import datetime, timezone

from database import get_db, init_db, engine
from models import RecordModel

app = FastAPI(title="Data Redundancy Removal System", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production to your Vercel domain
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RecordIn(BaseModel):
    name:       str
    email:      str
    department: str
    phone:      str = ""
    threshold:  float = 0.80   # client-configurable per request

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        v = " ".join(v.strip().split())
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[\w\.\+\-]+@[\w\-]+\.[a-z]{2,}$", v, re.I):
            raise ValueError(f"Invalid email: {v}")
        return v

    @field_validator("department")
    @classmethod
    def dept_not_empty(cls, v):
        v = v.strip().title()
        if not v:
            raise ValueError("Department is required")
        return v

    @field_validator("threshold")
    @classmethod
    def threshold_range(cls, v):
        if not 0 < v <= 1:
            raise ValueError("Threshold must be between 0 and 1")
        return v


class RecordOut(BaseModel):
    record_id:       str
    name:            str
    email:           str
    department:      str
    phone:           str
    timestamp:       str


class ValidationResponse(BaseModel):
    classification:   str          # UNIQUE | DUPLICATE | FALSE_POSITIVE
    similarity_score: float
    accepted:         bool
    reason:           str
    record:           Optional[RecordOut]
    matched_id:       Optional[str]
    pipeline:         list[dict]   # stage-by-stage trace for the UI


# ── Core logic ────────────────────────────────────────────────────────────────

def make_hash(name: str, email: str) -> str:
    return hashlib.sha256(f"{name.lower()}|{email}".encode()).hexdigest()

def make_id(name: str, email: str) -> str:
    return "REC-" + hashlib.sha1(f"{name}{email}".encode()).hexdigest()[:8].upper()

def levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            temp = dp[j]
            dp[j] = prev if a[i-1] == b[j-1] else 1 + min(prev, dp[j], dp[j-1])
            prev = temp
    return dp[n]

def similarity(a_name, a_email, b_name, b_email) -> float:
    def sim(s1, s2):
        if s1 == s2: return 1.0
        mx = max(len(s1), len(s2))
        return 1.0 - levenshtein(s1, s2) / mx if mx else 1.0
    return round(0.35 * sim(a_name.lower(), b_name.lower()) + 0.65 * sim(a_email, b_email), 4)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "Data Redundancy Removal System"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """Used by the frontend to detect a sleeping/cold-starting backend."""
    try:
        db.execute(select(func.count()).select_from(RecordModel))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {e}")


@app.get("/records", response_model=list[RecordOut])
def get_records(
    search: Optional[str] = Query(None, description="Filter by name, email, or department"),
    db: Session = Depends(get_db),
):
    q = db.query(RecordModel)
    if search:
        like = f"%{search.strip().lower()}%"
        q = q.filter(
            func.lower(RecordModel.name).like(like)
            | func.lower(RecordModel.email).like(like)
            | func.lower(RecordModel.department).like(like)
        )
    rows = q.order_by(RecordModel.timestamp.asc()).all()
    return [r.to_dict() for r in rows]


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(RecordModel.record_id)).scalar()
    return {"total": total}


@app.delete("/records")
def clear_records(db: Session = Depends(get_db)):
    db.query(RecordModel).delete()
    db.commit()
    return {"cleared": True}


@app.post("/submit", response_model=ValidationResponse)
def submit_record(data: RecordIn, db: Session = Depends(get_db)):
    pipeline = []

    # Stage 1 — Ingestion
    name  = data.name
    email = data.email
    dept  = data.department
    phone = re.sub(r"[^\d+]", "", data.phone)
    pipeline.append({"stage": "Ingestion", "status": "ok",
                     "message": f"Normalized: {name} | {email}"})

    # Stage 2 — Fingerprint
    h  = make_hash(name, email)
    rid = make_id(name, email)
    pipeline.append({"stage": "Fingerprint", "status": "ok",
                     "message": f"Hash: {h[:16]}..."})

    # Stage 3 — Validation
    existing = db.query(RecordModel).all()   # small dataset; fine to compare in Python

    exact_match  = None
    best_match   = None
    best_score   = 0.0

    exact_row = next((r for r in existing if r.name_hash == h), None)
    if exact_row:
        exact_match = exact_row
        best_score  = 1.0
        best_match  = exact_row

    if not exact_match:
        for rec in existing:
            sc = similarity(name, email, rec.name, rec.email)
            if sc > best_score:
                best_score = sc
                best_match = rec

    pipeline.append({"stage": "Validation", "status": "ok" if best_score < data.threshold else "warn",
                     "message": f"Best match: {best_score:.0%}" + (f" → {best_match.record_id}" if best_match else " → none")})

    # Stage 4 — Classify
    classification = "UNIQUE"
    accepted       = True
    reason         = "No sufficiently similar record found."
    matched_id     = None

    if best_match and best_score >= data.threshold:
        matched_id    = best_match.record_id
        dept_differs  = dept.lower() != best_match.department.lower()
        phone_differs = bool(phone and best_match.phone and phone != best_match.phone)

        if best_score == 1.0 and not dept_differs and not phone_differs:
            classification = "DUPLICATE"
            accepted       = False
            reason         = f"Exact duplicate of {matched_id}."
        elif dept_differs or phone_differs:
            classification = "FALSE_POSITIVE"
            accepted       = True
            reason         = (f"Similar to {matched_id} ({best_score:.0%}) but differs in "
                              + ("department" if dept_differs else "phone") + ". Accepted as unique.")
        else:
            classification = "DUPLICATE"
            accepted       = False
            reason         = f"Near-duplicate of {matched_id} ({best_score:.0%} similarity)."

    clf_status = "ok" if accepted else "fail"
    pipeline.append({"stage": "Classifier", "status": clf_status,
                     "message": f"{classification} — {reason}"})

    # Stage 5 — DB Write (persisted to disk/Postgres, not memory)
    new_record = None
    if accepted:
        row = RecordModel(
            record_id=rid, name=name, email=email, department=dept,
            phone=phone, name_hash=h, timestamp=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        new_record = row.to_dict()
        pipeline.append({"stage": "DB Write", "status": "ok",
                         "message": f"Committed {rid} to database"})
    else:
        pipeline.append({"stage": "DB Write", "status": "fail",
                         "message": "Write blocked — " + classification})

    return ValidationResponse(
        classification   = classification,
        similarity_score = best_score,
        accepted         = accepted,
        reason           = reason,
        record           = RecordOut(**new_record) if new_record else None,
        matched_id       = matched_id,
        pipeline         = pipeline,
    )
