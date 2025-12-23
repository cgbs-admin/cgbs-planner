
from datetime import datetime, timedelta, date, time
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

from sqlalchemy.orm import Session

import os
import shutil
from pathlib import Path
import requests


import models, schemas
from database import SessionLocal, engine, get_db
from passlib.context import CryptContext

# Make sure metadata is in sync (won't drop anything; only creates missing tables)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CGB Events Planner API")

BASE_DIR = Path(__file__).resolve().parent
ATTACHMENTS_DIR = BASE_DIR / "attachments"

SECRET_KEY = "CHANGE_THIS_TO_SOMETHING_RANDOM_AND_LONG"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")



pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_user_by_username(db: Session, username: str) -> models.User | None:
    return db.query(models.User).filter(models.User.username == username).first()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_username(db, username=username)
    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions",
        )
    return current_user


# Allow browser apps (like our React frontend) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # later we can restrict this to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/auth/login", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, form_data.username)
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/")
def root():
    return {"message": "CGBS Planner backend is running"}

def build_event_node(event: models.Event) -> dict:
    """
    Build a nested dict for an event, including its children,
    categories and planning levels.
    """
    node = {
        "id": event.id,
        "parent_id": event.parent_id,
        "title": event.title,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "preacher": event.preacher,
        "sermon_title": event.sermon_title,
        "remarks": event.remarks,
        "internal_notes": event.internal_notes,
        "clarification": event.clarification,
        "link": event.link,
        "categories": [
            {"id": c.id, "name": c.name} for c in event.categories
        ],
        "planning_levels": [
            {"id": l.id, "name": l.name} for l in event.planning_levels
        ],
        "children": [],
    }

    # Sort children safely by date, then time, then id.
    # We normalise None values so Python never has to compare None with datetime objects.
    def _child_sort_key(e: models.Event):
        sort_date = e.start_date or event.start_date or date.max
        sort_time = e.start_time or event.start_time or time.max
        return (sort_date, sort_time, e.id)

    children_sorted = sorted(event.children, key=_child_sort_key)

    node["children"] = [build_event_node(child) for child in children_sorted]
    return node


# ---- FIRST API ENDPOINTS ----

@app.get("/events", response_model=List[schemas.EventRead])
def list_events(db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    ):
    """
    Return all events (simple flat list for now).
    """
    events = db.query(models.Event).order_by(models.Event.start_date, models.Event.start_time).all()
    return events

@app.get("/events/tree")
def get_event_tree(db: Session = Depends(get_db)):
    """
    Return all top-level events (no parent) with their sub-events nested.
    """
    roots = (
        db.query(models.Event)
        .filter(models.Event.parent_id.is_(None))
        .order_by(models.Event.start_date, models.Event.start_time, models.Event.id)
        .all()
    )

    return [build_event_node(event) for event in roots]


@app.post("/events", response_model=schemas.EventRead)
def create_event(event_in: schemas.EventCreate, db: Session = Depends(get_db),
current_admin: models.User = Depends(get_current_admin),
):
    """
    Create a new event and attach categories / planning levels if IDs are provided.
    """
    data = event_in.dict()
    category_ids = data.pop("category_ids", [])
    planning_level_ids = data.pop("planning_level_ids", [])

    event = models.Event(**data)
    db.add(event)
    db.commit()
    db.refresh(event)

    # Attach categories
    if category_ids:
        event.categories = (
            db.query(models.Category)
            .filter(models.Category.id.in_(category_ids))
            .all()
        )

    # Attach planning levels
    if planning_level_ids:
        event.planning_levels = (
            db.query(models.PlanningLevel)
            .filter(models.PlanningLevel.id.in_(planning_level_ids))
            .all()
        )

    db.commit()
    db.refresh(event)
    return event


@app.get("/events/{event_id}", response_model=schemas.EventRead)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """
    Get a single event by ID.
    """
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@app.put("/events/{event_id}", response_model=schemas.EventRead)
def update_event(
    event_id: int,
    event_in: schemas.EventUpdate,
    db: Session = Depends(get_db),
):
    """
    Update an existing event.
    - Normal fields: only those you send will change.
    - category_ids / planning_level_ids:
        * None  => leave unchanged
        * []    => clear all
        * [ids] => replace with these
    """
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_in.dict(exclude_unset=True)

    category_ids = update_data.pop("category_ids", None)
    planning_level_ids = update_data.pop("planning_level_ids", None)

    # Simple fields
    for field, value in update_data.items():
        setattr(event, field, value)

    # Relations
    if category_ids is not None:
        event.categories = (
            db.query(models.Category)
            .filter(models.Category.id.in_(category_ids))
            .all()
            if category_ids
            else []
        )

    if planning_level_ids is not None:
        event.planning_levels = (
            db.query(models.PlanningLevel)
            .filter(models.PlanningLevel.id.in_(planning_level_ids))
            .all()
            if planning_level_ids
            else []
        )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event





@app.post("/events/{event_id}/attachment", response_model=schemas.EventRead)
def upload_event_attachment(
    event_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """Upload or replace a single attachment for an event.

    The file is stored on disk under the backend's `attachments` directory,
    and the relative filename is stored in the event's `attachments` field.
    """
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    ATTACHMENTS_DIR.mkdir(exist_ok=True)

    original_name = file.filename or "attachment"
    _, ext = os.path.splitext(original_name)
    filename = f"event_{event_id}{ext}"
    file_path = ATTACHMENTS_DIR / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    event.attachments = filename
    db.commit()
    db.refresh(event)
    return event





@app.post("/nextcloud/predigtreihe-attachment")
async def upload_predigtreihe_attachment(
    file: UploadFile = File(...),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Receive a file from the frontend, upload it to Nextcloud into the
    Predigtreihen folder and return a public read-only URL.
    """
    base_url = os.getenv("NEXTCLOUD_BASE_URL")
    username = os.getenv("NEXTCLOUD_USERNAME")
    password = os.getenv("NEXTCLOUD_PASSWORD")

    if not base_url or not username or not password:
        raise HTTPException(
            status_code=500,
            detail="Nextcloud configuration is missing on the server",
        )

    # Make sure base URL is well-formed
    base_url = base_url.rstrip("/")
    if not base_url.startswith("http"):
        raise HTTPException(
            status_code=500,
            detail="NEXTCLOUD_BASE_URL is invalid on the server",
        )

    # Ensure we only use the file name, no client-side path fragments
    original_name = file.filename or "attachment"
    safe_name = os.path.basename(original_name)

    # WebDAV upload target
    remote_folder = "/Gottesdienst/00_Orga/Predigtreihen"
    remote_path = f"{remote_folder}/{safe_name}"
    dav_url = f"{base_url}{remote_path}"

    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not read uploaded file",
        )

    # Step 1: upload the file via WebDAV (PUT)
    try:
        put_resp = requests.put(dav_url, data=file_bytes, auth=(username, password))
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach Nextcloud for upload: {exc}",
        )

    if put_resp.status_code not in (200, 201, 204):
        raise HTTPException(
            status_code=502,
            detail=f"Nextcloud upload failed with status {put_resp.status_code}",
        )

    # Step 2: create a public share link via OCS API
    # Derive the root base (without /remote.php/...) for OCS endpoint
    ocs_base = base_url.split("/remote.php")[0]
    share_url = f"{ocs_base}/ocs/v2.php/apps/files_sharing/api/v1/shares"

    headers = {
        "OCS-APIREQUEST": "true",
    }
    data = {
        "path": remote_path,
        "shareType": "3",      # public link
        "permissions": "1",    # read-only
    }

    try:
        share_resp = requests.post(
            share_url,
            auth=(username, password),
            headers=headers,
            data=data,
            params={"format": "json"},
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach Nextcloud for sharing: {exc}",
        )

    if share_resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Nextcloud share failed with status {share_resp.status_code}",
        )

    try:
        payload = share_resp.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Could not parse Nextcloud share response",
        )

    ocs = payload.get("ocs") or {}
    meta = ocs.get("meta") or {}
    data_obj = ocs.get("data") or {}

    # According to Nextcloud OCS docs, "data" can be either an object or an array.
    # Normalise to a single dict for easier handling.
    if isinstance(data_obj, list):
        if not data_obj:
            raise HTTPException(
                status_code=502,
                detail="Nextcloud share response did not contain any data items",
            )
        data_obj = data_obj[0] or {}

    if str(meta.get("statuscode")) not in ("100", "200"):
        message = meta.get("message") or "Unknown Nextcloud error"
        raise HTTPException(
            status_code=502,
            detail=f"Nextcloud share failed: {message}",
        )

    # Prefer the explicit URL field if present
    public_url = data_obj.get("url") or data_obj.get("link")

    # As a fallback, construct the URL from the share token if available
    if not public_url:
        token = data_obj.get("token")
        if token:
            # Example: https://cloud.example.com/index.php/s/<token>
            public_url = f"{ocs_base}/index.php/s/{token}"

    if not public_url:
        raise HTTPException(
            status_code=502,
            detail="Nextcloud did not return a public URL",
        )

    return {"url": public_url}


@app.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """
    Delete an event by ID.
    """
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()
    return {"detail": "Event deleted"}

# -----------------------------
# CATEGORY ENDPOINTS
# -----------------------------

# ---------- Category CRUD ----------

@app.get("/categories", response_model=List[schemas.CategoryRead])
def read_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
  categories = db.query(models.Category).offset(skip).limit(limit).all()
  return categories


@app.get("/categories/{category_id}", response_model=schemas.CategoryRead)
def read_category(category_id: int, db: Session = Depends(get_db)):
  category = db.query(models.Category).filter(models.Category.id == category_id).first()
  if category is None:
    raise HTTPException(status_code=404, detail="Category not found")
  return category


@app.post("/categories", response_model=schemas.CategoryRead)
def create_category(category_in: schemas.CategoryCreate, db: Session = Depends(get_db),
current_admin: models.User = Depends(get_current_admin),
):
  db_category = models.Category(
    name=category_in.name,
    symbol=category_in.symbol,
    color_hex=category_in.color_hex,
    description=category_in.description,
    godi_item=category_in.godi_item,
  )
  db.add(db_category)
  db.commit()
  db.refresh(db_category)
  return db_category


@app.put("/categories/{category_id}", response_model=schemas.CategoryRead)
def update_category(
  category_id: int,
  category_in: schemas.CategoryCreate,
  db: Session = Depends(get_db),
):
  db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
  if db_category is None:
    raise HTTPException(status_code=404, detail="Category not found")

  db_category.name = category_in.name
  db_category.symbol = category_in.symbol
  db_category.color_hex = category_in.color_hex
  db_category.description = category_in.description
  db_category.godi_item = category_in.godi_item

  db.commit()
  db.refresh(db_category)
  return db_category


@app.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
  db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
  if db_category is None:
    raise HTTPException(status_code=404, detail="Category not found")

  db.delete(db_category)
  db.commit()
  return None


# -----------------------------
# PLANNING LEVEL ENDPOINTS
# -----------------------------

# ---------- PlanningLevel CRUD ----------

@app.get("/planning-levels", response_model=List[schemas.PlanningLevelRead])
def read_planning_levels(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
  levels = db.query(models.PlanningLevel).offset(skip).limit(limit).all()
  return levels


@app.get("/planning-levels/{planning_level_id}", response_model=schemas.PlanningLevelRead)
def read_planning_level(planning_level_id: int, db: Session = Depends(get_db)):
  level = (
    db.query(models.PlanningLevel)
    .filter(models.PlanningLevel.id == planning_level_id)
    .first()
  )
  if level is None:
    raise HTTPException(status_code=404, detail="Planning level not found")
  return level


@app.post("/planning-levels", response_model=schemas.PlanningLevelRead)
def create_planning_level(
  level_in: schemas.PlanningLevelCreate,
  db: Session = Depends(get_db),
  current_admin: models.User = Depends(get_current_admin),
):
  db_level = models.PlanningLevel(name=level_in.name)
  db.add(db_level)
  db.commit()
  db.refresh(db_level)
  return db_level


@app.put("/planning-levels/{planning_level_id}", response_model=schemas.PlanningLevelRead)
def update_planning_level(
  planning_level_id: int,
  level_in: schemas.PlanningLevelCreate,
  db: Session = Depends(get_db),
):
  db_level = (
    db.query(models.PlanningLevel)
    .filter(models.PlanningLevel.id == planning_level_id)
    .first()
  )
  if db_level is None:
    raise HTTPException(status_code=404, detail="Planning level not found")

  db_level.name = level_in.name
  db.commit()
  db.refresh(db_level)
  return db_level


@app.delete("/planning-levels/{planning_level_id}", status_code=204)
def delete_planning_level(planning_level_id: int, db: Session = Depends(get_db)):
  db_level = (
    db.query(models.PlanningLevel)
    .filter(models.PlanningLevel.id == planning_level_id)
    .first()
  )
  if db_level is None:
    raise HTTPException(status_code=404, detail="Planning level not found")

  db.delete(db_level)
  db.commit()
  return None
# -----------------------------

# -----------------------------
# REPORTING CRUD (per-event visitor table)
# -----------------------------

@app.post("/reporting", response_model=schemas.ReportingRead)
def create_reporting_entry(
    reporting_in: schemas.ReportingCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Create a new reporting entry for a given event.

    While storing the visitor count, the API also checks for
    parallel events of specific categories and annotates the
    reporting row accordingly:

    - "Ferien"   -> reporting.vacation
    - "Feiertag" -> reporting.holiday
    - "Lobpreisabend" / "Special" at same date & time -> reporting.special
    """
    event = db.query(models.Event).filter(models.Event.id == reporting_in.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    vacation_title: str | None = None
    holiday_title: str | None = None
    special_titles: list[str] = []

    event_date = event.start_date
    event_time = event.start_time

    # Only try to detect parallel events when we have a date
    if event_date is not None:
        # Ferien / Feiertag: parallel means the Ferien/Feiertag period
        # includes the event date. We do the end-date check in Python
        # to avoid extra SQLAlchemy imports.
        overlapping_events = (
            db.query(models.Event)
            .filter(models.Event.id != event.id)
            .filter(models.Event.start_date <= event_date)
            .all()
        )

        for other in overlapping_events:
            # If other has an end_date before the event_date, skip it
            if other.end_date is not None and other.end_date < event_date:
                continue

            cat_names = {c.name for c in (other.categories or [])}

            if "Ferien" in cat_names and vacation_title is None:
                vacation_title = other.title

            if "Feiertag" in cat_names and holiday_title is None:
                holiday_title = other.title

        # Lobpreisabend / Special: same date AND same time
        if event_time is not None:
            same_dt_events = (
                db.query(models.Event)
                .filter(models.Event.id != event.id)
                .filter(models.Event.start_date == event_date)
                .filter(models.Event.start_time == event_time)
                .all()
            )

            for other in same_dt_events:
                cat_names = {c.name for c in (other.categories or [])}
                if "Lobpreisabend" in cat_names or "Special" in cat_names:
                    if other.title:
                        special_titles.append(other.title)

    # Remove duplicates while preserving order, then join by ", "
    if special_titles:
        seen: set[str] = set()
        deduped: list[str] = []
        for title in special_titles:
            if title not in seen:
                seen.add(title)
                deduped.append(title)
        special_value: str | None = ", ".join(deduped)
    else:
        special_value = None

    # If there is already a reporting entry for this event, update the latest one
    existing = (
        db.query(models.Reporting)
        .filter(models.Reporting.event_id == event.id)
        .order_by(models.Reporting.id.desc())
        .first()
    )

    if existing is not None:
        existing.event_title = event.title
        existing.event_date = event.start_date
        existing.event_start_time = event.start_time
        existing.visitor = reporting_in.visitor
        existing.vacation = (
            vacation_title if vacation_title is not None else reporting_in.vacation
        )
        existing.holiday = (
            holiday_title if holiday_title is not None else reporting_in.holiday
        )
        existing.special = special_value if special_value is not None else reporting_in.special

        db.commit()
        db.refresh(existing)
        return existing

    # Otherwise create a new reporting row
    reporting = models.Reporting(
        event_id=event.id,
        event_title=event.title,
        event_date=event.start_date,
        event_start_time=event.start_time,
        visitor=reporting_in.visitor,
        # Client-provided strings are currently ignored in favour of
        # automatic detection, but we fall back to them if no match
        # was found server-side.
        vacation=vacation_title if vacation_title is not None else reporting_in.vacation,
        holiday=holiday_title if holiday_title is not None else reporting_in.holiday,
        special=special_value if special_value is not None else reporting_in.special,
    )

    db.add(reporting)
    db.commit()
    db.refresh(reporting)
    return reporting


@app.get("/reporting/by-event/{event_id}", response_model=List[schemas.ReportingRead])
def list_reporting_for_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List all reporting entries for a single event, newest first.
    """
    entries = (
        db.query(models.Reporting)
        .filter(models.Reporting.event_id == event_id)
        .order_by(models.Reporting.id.desc())
        .all()
    )
    return entries


@app.post("/reporting/manual", response_model=schemas.ReportingRead)
def create_reporting_entry_manual(
    reporting_in: schemas.ReportingCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Create a new reporting entry manually from the reporting table UI.

    For manually entered rows, the Event-ID does not need to refer to a
    real Event. By default, we use 99 when the client does not provide
    a specific event_id. The fields date, start time and title are taken
    directly from the payload.
    """
    # Determine effective event_id (default 99 for manual rows)
    event_id = reporting_in.event_id or 99

    # Ensure we have a non-null title for the database (column is not nullable)
    title_value = reporting_in.event_title or ""

    reporting = models.Reporting(
        event_id=event_id,
        event_title=title_value,
        event_date=reporting_in.event_date,
        event_start_time=reporting_in.event_start_time,
        visitor=reporting_in.visitor,
        vacation=reporting_in.vacation,
        holiday=reporting_in.holiday,
        special=reporting_in.special,
    )

    db.add(reporting)
    db.commit()
    db.refresh(reporting)
    return reporting


@app.put("/reporting/{reporting_id}", response_model=schemas.ReportingRead)
def update_reporting_entry(
    reporting_id: int,
    reporting_in: schemas.ReportingUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Update a reporting entry from the reporting table UI.
    """
    reporting = (
        db.query(models.Reporting)
        .filter(models.Reporting.id == reporting_id)
        .first()
    )
    if reporting is None:
        raise HTTPException(status_code=404, detail="Reporting entry not found")

    if reporting_in.visitor is not None:
        reporting.visitor = reporting_in.visitor
    if reporting_in.event_title is not None:
        reporting.event_title = reporting_in.event_title
    if reporting_in.event_date is not None:
        reporting.event_date = reporting_in.event_date
    if reporting_in.event_start_time is not None:
        reporting.event_start_time = reporting_in.event_start_time
    if reporting_in.vacation is not None:
        reporting.vacation = reporting_in.vacation
    if reporting_in.holiday is not None:
        reporting.holiday = reporting_in.holiday
    if reporting_in.special is not None:
        reporting.special = reporting_in.special

    db.commit()
    db.refresh(reporting)
    return reporting


@app.delete("/reporting/{reporting_id}", status_code=204)
def delete_reporting_entry(
    reporting_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin),
):
    """
    Delete a reporting entry from the reporting table UI.
    """
    reporting = (
        db.query(models.Reporting)
        .filter(models.Reporting.id == reporting_id)
        .first()
    )
    if reporting is None:
        raise HTTPException(status_code=404, detail="Reporting entry not found")

    db.delete(reporting)
    db.commit()
    return None




# REPORTING ENDPOINTS
# -----------------------------

@app.get("/reports/visitors-by-title")
def report_visitors_by_title(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return simple visitor statistics per Event-Reporting-Eintrag.

    Die Daten basieren auf der neuen Reporting-Tabelle und enthalten:
    - date: ISO-String von reporting.event_date
    - title: event_title aus der Reporting-Tabelle
    - visitors: Besucherzahl aus reporting.visitor

    Die Datumsfilter (start_date / end_date) beziehen sich auf reporting.event_date.
    Wenn keine Filter gesetzt sind, werden alle Einträge zurückgegeben.
    """
    query = db.query(models.Reporting)

    if start_date is not None:
        query = query.filter(models.Reporting.event_date >= start_date.date())
    if end_date is not None:
        query = query.filter(models.Reporting.event_date <= end_date.date())

    # Sort by event_date (newest first) then event_start_time (latest first)
    query = query.order_by(
        models.Reporting.event_date.desc(),
        models.Reporting.event_start_time.desc(),
        models.Reporting.id.desc(),
    )
    entries = query.all()

    results: list[dict] = []
    for entry in entries:
        visitors = entry.visitor

        # Einträge ohne Besucherzahl überspringen
        if visitors is None:
            continue

        if entry.event_date is not None:
            date_str = entry.event_date.isoformat()
        else:
            date_str = ""

        # Build response object including all Reporting fields we care about.
        # Existing consumers (Chart) still use only date/title/visitors.
        results.append(
            {
                "id": entry.id,
                "event_id": entry.event_id,
                "date": date_str,
                "title": entry.event_title or "",
                "event_start_time": entry.event_start_time.isoformat() if entry.event_start_time else None,
                "visitors": int(visitors),
                "vacation": entry.vacation,
                "holiday": entry.holiday,
                "special": entry.special,
            }
        )

    return results


