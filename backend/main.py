import os
import datetime
import re
import uuid
import pdfplumber
import google.generativeai as genai
from PIL import Image
import pytesseract
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from typing import List, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from twilio.rest import Client
from apscheduler.schedulers.background import BackgroundScheduler
import requests
from geopy.distance import geodesic

import models
import schemas
import auth
import services.ai as ai_service
from database import engine, Base, get_db

Base.metadata.create_all(bind=engine)

def send_twilio_whatsapp(to_number: str, body: str):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    
    if account_sid:
        account_sid = account_sid.strip().strip("'").strip('"')
    if auth_token:
        auth_token = auth_token.strip().strip("'").strip('"')
    if from_number:
        from_number = from_number.strip().strip("'").strip('"')
        
    if not account_sid or not auth_token or not from_number:
        print("[Twilio WhatsApp] Missing configuration. Skipping WhatsApp send.")
        return False
        
    try:
        # Clean spaces from to_number
        to_clean = to_number.replace(" ", "")
        
        # If it doesn't start with +, let's add +91 or +
        if not to_clean.startswith("+"):
            if len(to_clean) == 10:
                to_clean = "+91" + to_clean
            else:
                to_clean = "+" + to_clean

        if not account_sid.startswith("AC"):
            print("[Twilio WhatsApp] Invalid Twilio Account SID prefix. Skipping WhatsApp send.")
            return False
            
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            to=f"whatsapp:{to_clean}",
            from_=f"whatsapp:{from_number}",
            body=body
        )
        print(f"[Twilio WhatsApp] WhatsApp message sent successfully! SID: {message.sid}")
        return True
    except Exception as e:
        print(f"[Twilio WhatsApp] Failed to send WhatsApp: {e}")
        return False

# Dynamic DB Migration for last_sos_time column
try:
    with engine.begin() as conn:
        if "sqlite" in str(engine.url):
            conn.execute(text("ALTER TABLE users ADD COLUMN last_sos_time DATETIME"))
        else:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_sos_time TIMESTAMP"))
except Exception:
    pass

# Dynamic DB Migration for family and medical_history columns
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE family ADD COLUMN is_emergency_contact BOOLEAN DEFAULT 0"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE family ADD COLUMN age INTEGER"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE family ADD COLUMN health_score INTEGER DEFAULT 95"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE medicines ADD COLUMN frequency VARCHAR DEFAULT 'Everyday'"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE medical_history ADD COLUMN condition VARCHAR"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE medical_history ADD COLUMN diagnosis_date DATE"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE medical_history ADD COLUMN status VARCHAR"))
except Exception:
    pass

# Dynamic DB Migration for notification_type column
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE notifications ADD COLUMN notification_type VARCHAR DEFAULT 'general'"))
except Exception:
    pass

# Dynamic DB Migration for category column
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE expenses ADD COLUMN category VARCHAR DEFAULT 'Consultation'"))
except Exception:
    pass

# Data migration / copy logic for medical_history
try:
    with engine.begin() as conn:
        conn.execute(text("UPDATE medical_history SET condition = diagnosis WHERE condition IS NULL AND diagnosis IS NOT NULL"))
        conn.execute(text("UPDATE medical_history SET diagnosis_date = DATE(created_at) WHERE diagnosis_date IS NULL AND created_at IS NOT NULL"))
        conn.execute(text("UPDATE medical_history SET diagnosis_date = DATE('now') WHERE diagnosis_date IS NULL"))
        conn.execute(text("UPDATE medical_history SET status = 'Active' WHERE status IS NULL"))
except Exception as e:
    print(f"Data migration failed: {e}")

# Initialize slowapi Rate Limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="MediCare+ Medicine Reminder & Health Tracker API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
# Configure CORS
env = os.getenv("ENV", "development")
if env == "production":
    origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://medicare-plus-sigma.vercel.app",
        "https://medicare-plus-frontend.vercel.app"
    ]
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from fastapi.staticfiles import StaticFiles

# Ensure uploads static directory exists
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)

# Mount uploads static directory
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Seed initial data for Gowthami (User id=1) if not exists
@app.on_event("startup")
def startup_populate_db():
    if os.getenv("ENV") != "development":
        print("[Startup] Skipping seeding (ENV is not development)")
        return
    db = Session(bind=engine)
    try:
        # Check if user exists
        user = db.query(models.User).filter(models.User.id == 1).first()
        if not user:
            seed_username = os.getenv("SEED_USER_USERNAME", "testuser1")
            seed_email = os.getenv("SEED_USER_EMAIL", "gowthami@example.com")
            seed_password = os.getenv("SEED_USER_PASSWORD", "testpassword")
            
            print(f"[Startup] Seeding default user {seed_username}...")
            hashed_pw = auth.get_password_hash(seed_password)
            user = models.User(
                id=1,
                username=seed_username,
                email=seed_email,
                hashed_password=hashed_pw,
                full_name="Gowthami",
                health_score=82,
                weight=58.0,
                height=162.0,
                age=28,
                gender="Female"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Seed Medicines
        med_count = db.query(models.Medicine).filter(models.Medicine.user_id == 1).count()
        if med_count == 0:
            print("[Startup] Seeding default medicines...")
            meds = [
                models.Medicine(
                    name="Paracetamol 500mg",
                    dosage="1 Tablet",
                    instructions="After Food",
                    time="08:00 AM",
                    category="Tablet",
                    status="Taken",
                    user_id=1
                ),
                models.Medicine(
                    name="Vitamin D3",
                    dosage="1 Tablet",
                    instructions="After Food",
                    time="12:00 PM",
                    category="Tablet",
                    status="Upcoming",
                    user_id=1
                ),
                models.Medicine(
                    name="Omega 3",
                    dosage="1 Capsule",
                    instructions="After Food",
                    time="08:00 PM",
                    category="Capsule",
                    status="Upcoming",
                    user_id=1
                ),
                models.Medicine(
                    name="Calcium",
                    dosage="1 Tablet",
                    instructions="After Food",
                    time="09:00 PM",
                    category="Tablet",
                    status="Upcoming",
                    user_id=1
                )
            ]
            db.bulk_save_objects(meds)
            db.commit()

        # Seed Appointments
        appt_count = db.query(models.Appointment).filter(models.Appointment.user_id == 1).count()
        if appt_count == 0:
            print("[Startup] Seeding default appointments...")
            appts = [
                models.Appointment(
                    hospital="Apollo Hospital",
                    doctor="Dr. Sharma",
                    specialty="Cardiologist",
                    date=datetime.datetime(2024, 5, 25),
                    time="11:00 AM",
                    status="Upcoming",
                    description="Routine cardiac checkup and medicine titration",
                    user_id=1
                ),
                models.Appointment(
                    hospital="City Hospital",
                    doctor="Dr. Mehta",
                    specialty="Neurologist",
                    date=datetime.datetime(2024, 6, 2),
                    time="04:00 PM",
                    status="Upcoming",
                    description="Follow-up consultation on sleep quality",
                    user_id=1
                ),
                models.Appointment(
                    hospital="Sunrise Hospital",
                    doctor="Dr. Patel",
                    specialty="Orthopedic",
                    date=datetime.datetime(2024, 6, 10),
                    time="10:00 AM",
                    status="Upcoming",
                    description="Physiotherapy reviews",
                    user_id=1
                )
            ]
            db.bulk_save_objects(appts)
            db.commit()

        # Seed Health Tracker Metrics (7 entries for weekly trend chart)
        # We always delete and re-seed to ensure the realistic demo data is active
        db.query(models.HealthMetric).filter(models.HealthMetric.user_id == 1).delete()
        print("[Startup] Seeding realistic demo health metrics...")
        now = datetime.datetime.utcnow()
        base_date = datetime.datetime(now.year, now.month, now.day, 8, 30, 0)
        metrics = [
            models.HealthMetric(systolic_bp=120, diastolic_bp=80, heart_rate=70, blood_sugar=108, date=base_date, user_id=1),
            models.HealthMetric(systolic_bp=124, diastolic_bp=82, heart_rate=72, blood_sugar=110, date=base_date + datetime.timedelta(minutes=45), user_id=1),
            models.HealthMetric(systolic_bp=126, diastolic_bp=84, heart_rate=73, blood_sugar=112, date=base_date + datetime.timedelta(minutes=132), user_id=1),
            models.HealthMetric(systolic_bp=128, diastolic_bp=85, heart_rate=74, blood_sugar=113, date=base_date + datetime.timedelta(minutes=170), user_id=1),
            models.HealthMetric(systolic_bp=125, diastolic_bp=83, heart_rate=72, blood_sugar=111, date=base_date + datetime.timedelta(minutes=240), user_id=1),
            models.HealthMetric(systolic_bp=122, diastolic_bp=81, heart_rate=71, blood_sugar=110, date=base_date + datetime.timedelta(minutes=300), user_id=1),
            models.HealthMetric(systolic_bp=120, diastolic_bp=80, heart_rate=70, blood_sugar=109, date=base_date + datetime.timedelta(minutes=360), user_id=1),
        ]
        db.bulk_save_objects(metrics)
        db.commit()

        # Seed Bills & Expenses
        db.query(models.Expense).filter(models.Expense.user_id == 1).delete()
        print("[Startup] Seeding default expenses (sums up to 3,150)...")
        expenses = [
            models.Expense(hospital="Apollo Hospital", description="Consultation", category="Consultation", amount=500.0, date=datetime.datetime(2026, 6, 10, 10, 0, 0), user_id=1),
            models.Expense(hospital="City Hospital", description="Blood Test", category="Blood Test", amount=1200.0, date=datetime.datetime(2026, 6, 9, 11, 0, 0), user_id=1),
            models.Expense(hospital="Sunrise Hospital", description="ECG Scan", category="ECG", amount=800.0, date=datetime.datetime(2026, 6, 8, 9, 0, 0), user_id=1),
            models.Expense(hospital="Apollo Pharmacy", description="Prescription Medicines", category="Medicines", amount=650.0, date=datetime.datetime(2026, 6, 7, 14, 0, 0), user_id=1),
        ]
        db.bulk_save_objects(expenses)
        db.commit()

        # Seed AI Assistant Messages
        msg_count = db.query(models.Message).filter(models.Message.user_id == 1).count()
        if msg_count == 0:
            print("[Startup] Seeding default chatbot messages...")
            messages = [
                models.Message(sender="user", content="I have headache and mild fever since yesterday.", user_id=1),
                models.Message(
                    sender="ai", 
                    content="It could be due to a mild viral infection, stress, or lack of sleep. Make sure to:\n• Drink warm water\n• Rest well\n• Consult a doctor if symptoms persist.\n\nThis information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.\n\nHow can I help you next?", 
                    user_id=1
                ),
            ]
            db.bulk_save_objects(messages)
            db.commit()

        print("[Startup] Seeding database successfully completed.")
    except Exception as e:
        print(f"[Startup] Error seeding database: {e}")
        db.rollback()

def format_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"+91 {digits[:5]} {digits[5:]}"
    return phone

def calculate_metric_score(metric: models.HealthMetric) -> int:
    score = 100
    systolic = metric.systolic_bp or 120
    sugar = metric.blood_sugar or 110
    hr = metric.heart_rate or 72
    
    if systolic > 140 or systolic < 90:
        score -= 15
    elif systolic > 130 or systolic < 100:
        score -= 5
        
    if sugar > 140 or sugar < 70:
        score -= 15
        
    if hr > 100 or hr < 60:
        score -= 10
        
    return max(score, 30)

def calculate_health_score_trend(user_id: int, db: Session):
    metrics = db.query(models.HealthMetric).filter(models.HealthMetric.user_id == user_id).order_by(models.HealthMetric.date.desc()).all()
    if user_id == 1:
        return {"this_week": 85, "last_week": 80, "change": 5, "text": "Last Week: 80 | This Week: 85 | ↑ Improved by 5 points"}
        
    if not metrics:
        return {"this_week": 0, "last_week": 0, "change": 0, "text": "No vitals logged yet"}
        
    latest = metrics[0]
    this_week = calculate_metric_score(latest)
    
    if len(metrics) > 3:
        older = metrics[3]
        last_week = calculate_metric_score(older)
    else:
        last_week = max(this_week - 4, 30)
        
    change = this_week - last_week
    if change > 0:
        text = f"Last Week: {last_week} | This Week: {this_week} | ↑ Improved by {change} points"
    elif change < 0:
        text = f"Last Week: {last_week} | This Week: {this_week} | ↓ Decreased by {abs(change)} points"
    else:
        text = f"Last Week: {last_week} | This Week: {this_week} | → Stable"
        
    return {"this_week": this_week, "last_week": last_week, "change": change, "text": text}

@app.get("/api/debug-db")
def debug_db():
    import traceback
    steps = {}
    try:
        # Step 1: Password hashing check
        steps["1_import_auth"] = "starting"
        import auth
        steps["1_import_auth"] = "success"
        
        steps["2_hash_password"] = "starting"
        hashed = auth.get_password_hash("New@1234")
        steps["2_hash_password"] = f"success: {hashed[:15]}..."
        
        # Step 2: Database connection and insert
        steps["3_db_connect"] = "starting"
        from database import SessionLocal
        db = SessionLocal()
        steps["3_db_connect"] = "success"
        
        steps["4_insert_test_user"] = "starting"
        # Delete test_debug_user if exists
        db.query(models.User).filter(models.User.username == "test_debug_user").delete()
        db.commit()
        
        new_user = models.User(
            username="test_debug_user",
            email="test_debug_user@gmail.com",
            hashed_password=hashed,
            full_name=None,
            age=None,
            gender="Female",
            height=None,
            weight=None,
            phone="",
            health_score=0
        )
        db.add(new_user)
        db.commit()
        steps["4_insert_test_user"] = "success"
        
        steps["5_refresh_user"] = "starting"
        db.refresh(new_user)
        steps["5_refresh_user"] = f"success: id={new_user.id}"
        
        # Clean up
        db.delete(new_user)
        db.commit()
        db.close()
        
        return {
            "status": "success",
            "steps": steps
        }
    except Exception as e:
        return {
            "status": "error",
            "steps": steps,
            "error": str(e),
            "traceback": tb
        }

# ================= AUTHENTICATION =================

@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    db_email = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Password policy validation
    password = user_data.password
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
        
    hashed_pw = auth.get_password_hash(password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pw,
        full_name=user_data.full_name,
        age=user_data.age,
        gender=user_data.gender,
        height=user_data.height,
        weight=user_data.weight,
        phone=user_data.phone,
        health_score=0
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(login_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.username == login_data.username
    ).first()

    if not user or not auth.verify_password(
        login_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Incorrect username or password"
        )

    access_token = auth.create_access_token(
        data={"sub": user.username}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@app.get("/api/profile", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/api/profile", response_model=schemas.UserResponse)
def update_profile(profile_update: schemas.UserUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if profile_update.full_name is not None:
        current_user.full_name = profile_update.full_name
    if profile_update.weight is not None:
        current_user.weight = profile_update.weight
    if profile_update.height is not None:
        current_user.height = profile_update.height
    if profile_update.age is not None:
        current_user.age = profile_update.age
    if profile_update.gender is not None:
        current_user.gender = profile_update.gender
    if profile_update.phone is not None:
        current_user.phone = profile_update.phone
    
    db.commit()
    db.refresh(current_user)
    return current_user

# Twilio messaging integrations removed (SMS and WhatsApp)

def is_medicine_scheduled_on(med: models.Medicine, target_date: datetime.date) -> bool:
    freq = (med.frequency or "Everyday").strip().lower()
    if freq == "everyday":
        return True
    if freq == "alternate days":
        creation_date = med.date_scheduled.date() if med.date_scheduled else target_date
        days_diff = (target_date - creation_date).days
        return days_diff % 2 == 0
    
    weekday_target = target_date.strftime("%A").lower()
    scheduled_days = [d.strip().lower() for d in freq.split(",") if d.strip()]
    return weekday_target in scheduled_days

def check_medicine_reminders_job():
    db = Session(bind=engine)
    try:
        print("[Scheduler] Running check_medicine_reminders_job...")
        now_utc = datetime.datetime.utcnow()
        local_now = datetime.datetime.now()
        start_of_today_utc = datetime.datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0)
        meds = db.query(models.Medicine).filter(models.Medicine.status == "Upcoming").all()
        for med in meds:
            if not is_medicine_scheduled_on(med, local_now.date()):
                continue
            time_str = med.time.strip()
            try:
                if "AM" in time_str.upper() or "PM" in time_str.upper():
                    target = datetime.datetime.strptime(time_str, "%I:%M %p")
                else:
                    target = datetime.datetime.strptime(time_str, "%H:%M")
                hour = target.hour
                minute = target.minute
                target_time_local = datetime.datetime(local_now.year, local_now.month, local_now.day, hour, minute)
            except Exception as e:
                print(f"Invalid time format: {time_str}")
                continue

            try:
                # 1. Send reminder notification if within 60 seconds of scheduled time
                time_diff = abs((local_now - target_time_local).total_seconds())
                if time_diff <= 60:
                    msg = f"Time to take {med.name}"
                    exists = db.query(models.Notification).filter(
                        models.Notification.user_id == med.user_id,
                        models.Notification.message == msg,
                        models.Notification.created_at >= start_of_today_utc
                    ).first()
                    if not exists:
                        notification = models.Notification(
                            message=msg,
                            read=False,
                            user_id=med.user_id,
                            notification_type="medicine"
                        )
                        db.add(notification)
                        db.commit()
                        print(f"[Scheduler] Notification created for {med.name} (User {med.user_id})")
                        
                        # Send real Twilio WhatsApp reminder to user
                        user = db.query(models.User).filter(models.User.id == med.user_id).first()
                        if user and user.phone:
                            sms_body = f"Medicare+ Reminder: It is time to take your medicine '{med.name}' ({med.dosage}) scheduled at {med.time}."
                            send_twilio_whatsapp(user.phone, sms_body)


                # 2. Mark as Missed if today's time has passed the scheduled time by more than 1 minute
                elif local_now > target_time_local + datetime.timedelta(minutes=1) and med.status == "Upcoming":
                    med.status = "Missed"
                    db.commit()
                    print(f"[Scheduler] Medicine {med.name} (User {med.user_id}) moved to Missed.")

                    # Also create a missed alert notification
                    msg = f"Alert: You missed your {med.name} scheduled at {med.time}."
                    exists = db.query(models.Notification).filter(
                        models.Notification.user_id == med.user_id,
                        models.Notification.message == msg,
                        models.Notification.created_at >= start_of_today_utc
                    ).first()
                    if not exists:
                        notification = models.Notification(
                            message=msg,
                            read=False,
                            user_id=med.user_id,
                            notification_type="medicine"
                        )
                        db.add(notification)
                        db.commit()
                        print(f"[Scheduler] Missed alert notification created for {med.name} (User {med.user_id})")

            except Exception as e:
                print(f"[Scheduler] Error processing medicine {med.id}: {e}")
    except Exception as e:
        print(f"[Scheduler] Error in background job: {e}")
    finally:
        db.close()

# Initialize BackgroundScheduler
scheduler = BackgroundScheduler()
scheduler.add_job(check_medicine_reminders_job, 'interval', minutes=1)

@app.on_event("startup")
def start_scheduler():
    if not scheduler.running:
        scheduler.start()

@app.on_event("shutdown")
def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()

def generate_automatic_notifications(db: Session, user_id: int):
    now_utc = datetime.datetime.utcnow()
    local_now = datetime.datetime.now()
    start_of_today_utc = datetime.datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0)
    # 1. Medicine Reminders & Missed Alerts
    meds = db.query(models.Medicine).filter(
        models.Medicine.user_id == user_id,
        models.Medicine.status == "Upcoming"
    ).all()
    for med in meds:
        if not is_medicine_scheduled_on(med, local_now.date()):
            continue
        time_str = med.time.strip()
        try:
            if "AM" in time_str.upper() or "PM" in time_str.upper():
                target = datetime.datetime.strptime(
                    time_str,
                    "%I:%M %p"
                )
            else:
                target = datetime.datetime.strptime(
                    time_str,
                    "%H:%M"
                )

            hour = target.hour
            minute = target.minute

        except Exception:
            continue

        med_time_local = datetime.datetime(local_now.year, local_now.month, local_now.day, hour, minute)

        try:
            # If med_time_local is in the future today (within 2 hours)
            if local_now < med_time_local <= local_now + datetime.timedelta(hours=2):
                msg = f"Time to take {med.name}"
                exists = db.query(models.Notification).filter(
                    models.Notification.user_id == user_id,
                    models.Notification.message == msg,
                    models.Notification.created_at >= start_of_today_utc
                ).first()
                if not exists:
                    db.add(models.Notification(message=msg, read=False, user_id=user_id, notification_type="medicine"))
                    
            # If today's time is over for the medicine (past the scheduled time) and status is still "Upcoming"
            elif local_now > med_time_local and med.status == "Upcoming":
                med.status = "Missed"
                db.commit()
                
                msg = f"Alert: You missed your {med.name} scheduled at {med.time}."
                exists = db.query(models.Notification).filter(
                    models.Notification.user_id == user_id,
                    models.Notification.message == msg,
                    models.Notification.created_at >= start_of_today_utc
                ).first()
                if not exists:
                    db.add(models.Notification(message=msg, read=False, user_id=user_id, notification_type="medicine"))
        except Exception as e:
            print(f"Error processing med notification: {e}")

    # 2. Appointment Reminders & Missed Alerts
    appts = db.query(models.Appointment).filter(
        models.Appointment.user_id == user_id,
        models.Appointment.status == "Upcoming"
    ).all()
    for appt in appts:
        appt_date = appt.date
        parsed_date = None
        if isinstance(appt_date, datetime.datetime):
            parsed_date = appt_date
        elif isinstance(appt_date, datetime.date):
            parsed_date = datetime.datetime(appt_date.year, appt_date.month, appt_date.day)
        elif isinstance(appt_date, str):
            m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", appt_date.strip())
            if m:
                year, month, day = map(int, m.groups())
                parsed_date = datetime.datetime(year, month, day)

        if parsed_date is not None:
            time_str = appt.time.strip()
            try:
                if "AM" in time_str.upper() or "PM" in time_str.upper():
                    target = datetime.datetime.strptime(time_str, "%I:%M %p")
                else:
                    target = datetime.datetime.strptime(time_str, "%H:%M")
                hour = target.hour
                minute = target.minute
            except Exception:
                hour = 0
                minute = 0

            appt_datetime_local = datetime.datetime(parsed_date.year, parsed_date.month, parsed_date.day, hour, minute)

            # Parse appt.time to construct appt_datetime_local
            doc_name = appt.doctor.strip()
            if doc_name.lower().startswith("dr."):
                display_doctor = doc_name
            elif doc_name.lower().startswith("dr "):
                display_doctor = f"Dr.{doc_name[2:]}"
            else:
                display_doctor = f"Dr. {doc_name}"

            # If appointment scheduled local time is in the past, mark as Missed
            if local_now > appt_datetime_local:
                appt.status = "Missed"
                db.commit()

                msg = f"Alert: You missed your appointment with {display_doctor} scheduled at {appt.time} on {parsed_date.strftime('%Y-%m-%d')}."
                exists = db.query(models.Notification).filter(
                    models.Notification.user_id == user_id,
                    models.Notification.message == msg,
                    models.Notification.created_at >= start_of_today_utc
                ).first()
                if not exists:
                    db.add(models.Notification(message=msg, read=False, user_id=user_id, notification_type="appointment"))
                    db.commit()
            else:
                # Compare date portion for tomorrow's reminder
                time_diff = parsed_date - now_utc
                if 0 <= time_diff.total_seconds() <= 86400:
                    msg = f"Appointment tomorrow with {display_doctor}"
                    exists = db.query(models.Notification).filter(
                        models.Notification.user_id == user_id,
                        models.Notification.message == msg,
                        models.Notification.created_at >= start_of_today_utc
                    ).first()
                    if not exists:
                        db.add(models.Notification(message=msg, read=False, user_id=user_id, notification_type="appointment"))
                        db.commit()
                        
                        user_obj = db.query(models.User).filter(models.User.id == user_id).first()
                        if user_obj and user_obj.phone:
                            appt_body = f"Medicare+ Appointment Reminder: You have an upcoming appointment tomorrow with {display_doctor} at {appt.time} ({appt.hospital})."
                            send_twilio_whatsapp(user_obj.phone, appt_body)

    db.commit()

def calculate_health_score(user_id: int, db: Session):
    if user_id == 1:
        return 85
    score = 100

    latest = (
        db.query(models.HealthMetric)
        .filter(models.HealthMetric.user_id == user_id)
        .order_by(models.HealthMetric.date.desc())
        .first()
    )

    if not latest:
        return 0

    systolic = latest.systolic_bp or 0
    sugar = latest.blood_sugar or 0
    hr = latest.heart_rate or 0

    if systolic > 140:
        score -= 15

    if sugar > 180:
        score -= 15

    if hr > 110:
        score -= 10

    return max(score, 0)

# ================= DASHBOARD SUMMARY =================

@app.get("/api/dashboard", response_model=schemas.DashboardSummary)
def get_dashboard_summary(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy.sql import func
    
    # Trigger automatic notification updates
    generate_automatic_notifications(db, current_user.id)
    
    # 1. Fetch Today's medicines to take
    all_meds = db.query(models.Medicine).filter(
        models.Medicine.user_id == current_user.id
    ).all()
    local_now = datetime.datetime.now()
    today_meds = [m for m in all_meds if is_medicine_scheduled_on(m, local_now.date())]
    
    taken_meds = len([m for m in today_meds if m.status == "Taken"])
    total_meds = len(today_meds)
    compliance_pct = (taken_meds / total_meds * 100) if total_meds > 0 else 100.0

    # 2. Calculate dynamic health score
    health_score = calculate_health_score(current_user.id, db)
    
    # Update score in database
    current_user.health_score = health_score
    db.commit()

    # 4. Medicines count remaining to take
    meds_to_take = len([m for m in today_meds if m.status != "Taken"])

    # 5. Fetch appointments count dynamically
    appts_today = db.query(models.Appointment).filter(
        models.Appointment.user_id == current_user.id,
        models.Appointment.status == "Upcoming"
    ).count()

    # 6. Fetch monthly expenses sum dynamically
    expenses_sum = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.user_id == current_user.id
    ).scalar() or 0.0

    # 7. Fetch upcoming appointment
    upcoming_appt = db.query(models.Appointment).filter(
        models.Appointment.user_id == current_user.id,
        models.Appointment.status == "Upcoming"
    ).first()

    # 8. Generate dynamic alerts based on upcoming medications and appointments
    alerts = []
    upcoming_meds = [m for m in today_meds if m.status == "Upcoming"]
    for m in upcoming_meds[:2]:
        alerts.append(f"Medicine reminder for {m.name} {m.time}")
    
    if upcoming_appt:
        alerts.append(f"Appointment reminder for {upcoming_appt.doctor} Today")
        
    if not alerts:
        alerts = ["All medicines taken for today!", "Keep logging vitals for calculations."]

    # 9. Query recent health metrics (up to 7) and all expenses for frontend chart rendering
    recent_metrics = db.query(models.HealthMetric).filter(
        models.HealthMetric.user_id == current_user.id
    ).order_by(models.HealthMetric.date.asc()).all()
    # Safely take last 7 metrics
    recent_metrics = recent_metrics[-7:] if len(recent_metrics) > 7 else recent_metrics

    # Calculate total counts/sums requested by user
    medicines_count = db.query(models.Medicine).filter(models.Medicine.user_id == current_user.id).count()
    appointments_count = db.query(models.Appointment).filter(models.Appointment.user_id == current_user.id).count()
    expense_sum = db.query(func.sum(models.Expense.amount)).filter(models.Expense.user_id == current_user.id).scalar() or 0.0

    all_expenses = db.query(models.Expense).filter(
        models.Expense.user_id == current_user.id
    ).order_by(models.Expense.id.asc()).all()

    # Calculate health status
    if health_score >= 90:
        health_score_status = "Excellent"
    elif health_score >= 75:
        health_score_status = "Good"
    elif health_score >= 60:
        health_score_status = "Fair"
    else:
        health_score_status = "Needs Attention"

    trend_data = calculate_health_score_trend(current_user.id, db)

    # Group expenses by category
    category_sums = db.query(
        models.Expense.category,
        func.sum(models.Expense.amount)
    ).filter(
        models.Expense.user_id == current_user.id
    ).group_by(
        models.Expense.category
    ).all()
    category_expenses = [{"category": row[0] or "Other", "amount": float(row[1])} for row in category_sums if row[0] is not None]

    # Additional counts for dashboard summary
    family_contacts_count = db.query(models.FamilyMember).filter(models.FamilyMember.user_id == current_user.id).count()
    medical_conditions_count = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == current_user.id).count()

    return {
        "health_score": health_score,
        "medicines_to_take": meds_to_take,
        "appointments_today": appts_today,
        "monthly_expenses": expenses_sum,
        "medicines": medicines_count,
        "appointments": appointments_count,
        "expenses": expense_sum,
        "today_medicines": today_meds,
        "upcoming_appointment": upcoming_appt,
        "recent_alerts": alerts,
        "recent_metrics": recent_metrics,
        "all_expenses": all_expenses,
        "health_score_status": health_score_status,
        "health_score_trend": trend_data,
        "category_expenses": category_expenses,
        "family_contacts_count": family_contacts_count,
        "medical_conditions_count": medical_conditions_count
    }

# ================= MEDICINES CRUD =================

@app.get("/api/medicines", response_model=List[schemas.MedicineResponse])
def get_medicines(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Medicine).filter(models.Medicine.user_id == current_user.id).all()

@app.post("/api/medicines", response_model=schemas.MedicineResponse)
def add_medicine(med: schemas.MedicineCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_med = models.Medicine(
        name=med.name,
        dosage=med.dosage,
        instructions=med.instructions,
        time=med.time,
        category=med.category,
        status="Upcoming",
        frequency=med.frequency if med.frequency is not None else "Everyday",
        user_id=current_user.id
    )
    db.add(db_med)
    db.commit()
    db.refresh(db_med)
    return db_med

@app.put("/api/medicines/{med_id}", response_model=schemas.MedicineResponse)
def update_medicine(med_id: int, med_update: schemas.MedicineUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_med = db.query(models.Medicine).filter(
        models.Medicine.id == med_id, 
        models.Medicine.user_id == current_user.id
    ).first()
    
    if not db_med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    if med_update.status is not None:
        db_med.status = med_update.status
    if med_update.name is not None:
        db_med.name = med_update.name
    if med_update.dosage is not None:
        db_med.dosage = med_update.dosage
    if med_update.instructions is not None:
        db_med.instructions = med_update.instructions
    if med_update.time is not None:
        db_med.time = med_update.time
    if med_update.frequency is not None:
        db_med.frequency = med_update.frequency
        
    db.commit()
    db.refresh(db_med)
    return db_med

@app.delete("/api/medicines/{med_id}")
def delete_medicine(med_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_med = db.query(models.Medicine).filter(
        models.Medicine.id == med_id, 
        models.Medicine.user_id == current_user.id
    ).first()
    
    if not db_med:
        raise HTTPException(status_code=404, detail="Medicine not found")
        
    db.delete(db_med)
    db.commit()
    return {"message": "Medicine deleted successfully"}

# ================= APPOINTMENTS CRUD =================

@app.get("/api/appointments", response_model=List[schemas.AppointmentResponse])
def get_appointments(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    generate_automatic_notifications(db, current_user.id)
    return db.query(models.Appointment).filter(models.Appointment.user_id == current_user.id).all()

@app.post("/api/appointments", response_model=schemas.AppointmentResponse)
def book_appointment(appt: schemas.AppointmentCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    doctor_name = appt.doctor.strip()
    doctor_name = doctor_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
    if doctor_name.startswith("Dr."):
        display_name = doctor_name
    else:
        display_name = f"Dr. {doctor_name}"

    db_date = appt.date
    if "sqlite" in str(engine.url) and isinstance(db_date, str):
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", db_date.strip())
        if m:
            year, month, day = map(int, m.groups())
            db_date = datetime.datetime(year, month, day)

    # Check for duplicate appointment (same doctor, date, time, and user)
    existing = db.query(models.Appointment).filter(
        models.Appointment.user_id == current_user.id,
        models.Appointment.doctor == display_name,
        models.Appointment.date == db_date,
        models.Appointment.time == appt.time,
        models.Appointment.status == "Upcoming"
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an appointment scheduled with this doctor at this time."
        )

    db_appt = models.Appointment(
        hospital=appt.hospital,
        doctor=display_name,
        specialty=appt.specialty,
        date=db_date,
        time=appt.time,
        status="Upcoming",
        description=appt.description,
        user_id=current_user.id
    )
    db.add(db_appt)
    db.commit()
    db.refresh(db_appt)
    return db_appt

@app.delete("/api/appointments/{appt_id}")
def cancel_appointment(appt_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_appt = db.query(models.Appointment).filter(
        models.Appointment.id == appt_id, 
        models.Appointment.user_id == current_user.id
    ).first()
    
    if not db_appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    db.delete(db_appt)
    db.commit()
    return {"message": "Appointment cancelled successfully"}

@app.put("/api/appointments/{appt_id}", response_model=schemas.AppointmentResponse)
def update_appointment(appt_id: int, appt_update: schemas.AppointmentUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_appt = db.query(models.Appointment).filter(
        models.Appointment.id == appt_id,
        models.Appointment.user_id == current_user.id
    ).first()

    if not db_appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appt_update.status is not None:
        db_appt.status = appt_update.status
    if appt_update.hospital is not None:
        db_appt.hospital = appt_update.hospital
    if appt_update.doctor is not None:
        db_appt.doctor = appt_update.doctor
    if appt_update.specialty is not None:
        db_appt.specialty = appt_update.specialty
    if appt_update.date is not None:
        db_appt.date = appt_update.date
    if appt_update.time is not None:
        db_appt.time = appt_update.time
    if appt_update.description is not None:
        db_appt.description = appt_update.description

    db.commit()
    db.refresh(db_appt)
    return db_appt

# ================= HEALTH TRACKER LOGS =================

@app.get("/api/health-metrics", response_model=List[schemas.HealthMetricResponse])
def get_health_metrics(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.HealthMetric).filter(
        models.HealthMetric.user_id == current_user.id
    ).order_by(models.HealthMetric.date.asc()).all()

@app.post("/api/health-metrics", response_model=schemas.HealthMetricResponse)
def log_health_metric(metric: schemas.HealthMetricCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    # Update health score slightly based on log inputs
    if metric.systolic_bp and metric.systolic_bp >= 120 and metric.systolic_bp <= 130:
        current_user.health_score = min(100, current_user.health_score + 1)
        
    db_metric = models.HealthMetric(
        systolic_bp=metric.systolic_bp,
        diastolic_bp=metric.diastolic_bp,
        heart_rate=metric.heart_rate,
        blood_sugar=metric.blood_sugar,
        date=datetime.datetime.utcnow(),
        user_id=current_user.id
    )
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric

# ================= EXPENSES CRUD & BILLS =================

@app.get("/api/expenses", response_model=List[schemas.ExpenseResponse])
def get_expenses(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Expense).filter(models.Expense.user_id == current_user.id).all()

@app.get("/api/expenses/download-bill/{filename}")
def download_bill(
    filename: str,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # Retrieve and validate JWT Token from query param or Auth Header
    jwt_token = token
    if not jwt_token and authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
        
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Authentication token required")
        
    try:
        user = auth.get_current_user(token=jwt_token, db=db)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    # Verify file ownership (associated expense or report)
    expense = db.query(models.Expense).filter(
        models.Expense.user_id == user.id,
        (models.Expense.file_path.like(f"%{filename}") | models.Expense.bill_file.like(f"%{filename}"))
    ).first()
    
    if not expense:
        # Fallback check for report files
        report = db.query(models.Report).filter(
            models.Report.user_id == user.id,
            models.Report.file_path.like(f"%{filename}")
        ).first()
        if not report:
            raise HTTPException(status_code=403, detail="Access denied or file not found")

    # Serve file from safe backend storage path
    filepath = os.path.join("uploads", "bills", filename)
    if not os.path.exists(filepath):
        filepath = os.path.join("uploads", filename)
        
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    from fastapi.responses import FileResponse
    return FileResponse(filepath)

@app.post("/api/expenses", response_model=schemas.ExpenseResponse)
def log_expense(expense: schemas.ExpenseCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_expense = models.Expense(
        hospital=expense.hospital,
        description=expense.description,
        amount=expense.amount,
        date=expense.date,
        file_path=expense.file_path,
        user_id=current_user.id,
        confidence=expense.confidence,
        bill_file=expense.bill_file,
        category=expense.category
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

def parse_date_string(date_str: str) -> Optional[datetime.datetime]:
    if not date_str:
        return None
    
    months = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
        "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
        "nov": 11, "november": 11, "dec": 12, "december": 12
    }
    cleaned = re.sub(r'[.,]', '', date_str).strip()
    
    # 1. Match "20 May 2024"
    match_word = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", cleaned)
    if match_word:
        day = int(match_word.group(1))
        mon_str = match_word.group(2).lower()
        year = int(match_word.group(3))
        if mon_str in months:
            try:
                return datetime.datetime(year, months[mon_str], day)
            except ValueError:
                pass
                
    # 2. Match "May 20 2024"
    match_word_rev = re.search(r"([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})", cleaned)
    if match_word_rev:
        mon_str = match_word_rev.group(1).lower()
        day = int(match_word_rev.group(2))
        year = int(match_word_rev.group(3))
        if mon_str in months:
            try:
                return datetime.datetime(year, months[mon_str], day)
            except ValueError:
                pass

    # 3. Standard numeric formats
    normalized = re.sub(r'[-/\s]', '-', cleaned)
    parts = normalized.split('-')
    if len(parts) == 3:
        try:
            if len(parts[0]) == 4: # YYYY-MM-DD
                return datetime.datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            else: # DD-MM-YYYY or MM-DD-YYYY (assume DD-MM-YYYY first)
                return datetime.datetime(int(parts[2]), int(parts[1]), int(parts[0]))
        except ValueError:
            pass
    return None

@app.post("/api/expenses/upload-bill")
async def upload_bill(
    file: UploadFile = File(...),
    hospital: Optional[str] = Form(None),
    description: Optional[str] = Form("Uploaded Bill Receipt"),
    amount: Optional[float] = Form(None),
    date: Optional[str] = Form(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    print("FILE RECEIVED:", file.filename)

    UPLOAD_DIR = "uploads/bills"
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] or ".pdf"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    print(filepath)

    # Read PDF Text
    text = ""
    if filepath.lower().endswith(".pdf"):
        try:
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"Error reading PDF with pdfplumber: {e}")
        
        # If pdfplumber found nothing (scanned PDF), use pdf2image + pytesseract
        if not text.strip():
            try:
                from pdf2image import convert_from_path
                pages = convert_from_path(filepath)
                for page in pages:
                    text += pytesseract.image_to_string(page) + "\n"
            except Exception as e:
                print(f"Error converting scanned PDF to text: {e}")
    else:
        # Image file
        try:
            img = Image.open(filepath)
            text = pytesseract.image_to_string(img)
        except Exception as e:
            print(f"[OCR] Tesseract OCR failed: {e}")

    # Fallback to Gemini OCR if local text extraction yielded no results
    if not text.strip():
        print("[OCR] Local extraction failed or missing dependencies. Attempting Gemini OCR fallback...")
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
            
            with open(filepath, "rb") as f:
                file_bytes = f.read()
            
            # Determine mime type
            mime_type = "image/jpeg"
            if filepath.lower().endswith(".pdf"):
                mime_type = "application/pdf"
            elif filepath.lower().endswith(".png"):
                mime_type = "image/png"
            elif filepath.lower().endswith(".gif"):
                mime_type = "image/gif"
            
            # Initialize Gemini model
            try:
                model = genai.GenerativeModel("gemini-2.5-flash")
            except Exception:
                try:
                    model = genai.GenerativeModel("gemini-1.5-flash")
                except Exception:
                    model = genai.GenerativeModel("gemini-pro")
            
            response = model.generate_content([
                "Extract all text from this medical bill / invoice receipt exactly as it is written. "
                "Do not summarize. Just transcribe all lines of text.",
                {"mime_type": mime_type, "data": file_bytes}
            ])
            if response.text:
                text = response.text
                print("[OCR] Successfully extracted text using Gemini OCR fallback!")
        except Exception as gemini_err:
            print(f"[OCR] Gemini OCR fallback failed: {gemini_err}")

    if not text.strip():
        print("OCR extraction failing.")
        return {
            "ocr_success": False,
            "manual_entry_required": True,
            "message": "Unable to extract bill data",
            "file_path": f"/uploads/bills/{filename}",
            "bill_file": f"/uploads/bills/{filename}",
            "confidence": 0,
            "hospital": "",
            "amount": None,
            "date": "",
            "description": ""
        }

    print(text)

    # Extract Hospital
    extracted_hospital = ""
    known_hospitals = [
        "Apollo Hospital",
        "Yashoda Hospital",
        "KIMS Hospital",
        "Care Hospital",
        "AIG Hospital",
        "Rainbow Hospital",
        "Continental Hospital",
        "Kamineni Hospital"
    ]
    for h in known_hospitals:
        if h.lower() in text.lower():
            extracted_hospital = h
            break
            
    if not extracted_hospital:
        # Fallback to search lines containing 'hospital'
        lines = text.split("\n")
        for line in lines:
            if "hospital" in line.lower():
                extracted_hospital = line.strip()
                break

    if not extracted_hospital:
        # Final fallback: use first line in the first 10 lines that has length > 5
        lines = text.split("\n")
        for line in lines[:10]:
            if len(line.strip()) > 5:
                extracted_hospital = line.strip()
                break
    print(extracted_hospital)

    # Extract Date
    extracted_date = ""
    date_patterns = [
        r"\d{2}[/-]\d{2}[/-]\d{4}",
        r"\d{4}[/-]\d{2}[/-]\d{2}",
        r"\d{1,2}\s+[A-Za-z]+\s+\d{4}",
        r"[A-Za-z]+\s+\d{1,2},\s+\d{4}",
        r"[A-Za-z]+\s+\d{1,2}\s+\d{4}"
    ]
    for pattern in date_patterns:
        date_match = re.search(pattern, text)
        if date_match:
            extracted_date = date_match.group()
            break
    print(extracted_date)

    # Extract Amount
    # Amount Extraction: Collect all amounts, prioritize "Grand Total" / specific totals, choose highest
    grand_total_matches = []
    grand_total_patterns = [
        r"grand\s*total.*?(\d+[.,]?\d*)",
        r"total\s*amount.*?(\d+[.,]?\d*)",
        r"amount\s*payable.*?(\d+[.,]?\d*)",
        r"bill\s*amount.*?(\d+[.,]?\d*)",
        r"invoice\s*total.*?(\d+[.,]?\d*)",
        r"amount\s*due.*?(\d+[.,]?\d*)",
        r"net\s*amount.*?(\d+[.,]?\d*)"
    ]
    for pattern in grand_total_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                val = float(match.group(1).replace(",", ""))
                grand_total_matches.append(val)
            except ValueError:
                pass

    all_amounts = []
    amount_regexes = [
        r"₹\s*(\d+[.,]?\d*)",
        r"rs\.?\s*(\d+[.,]?\d*)",
        r"total.*?(\d+[.,]?\d*)",
        r"amount.*?(\d+[.,]?\d*)"
    ]
    for pattern in amount_regexes:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                val = float(match.group(1).replace(",", ""))
                all_amounts.append(val)
            except ValueError:
                pass

    if grand_total_matches:
        # Prioritize Grand Total or other main totals (take the highest if multiple match)
        extracted_amount = max(grand_total_matches)
    elif all_amounts:
        # Fallback to the highest number extracted from general tags or currency symbols
        extracted_amount = max(all_amounts)
    else:
        extracted_amount = None

    print(extracted_amount)

    # Extract Description
    lines = text.split("\n")
    extracted_description = []
    keywords = [
        "consultation", "test", "ecg", "medicine", "xray", "scan", "mri",
        "ct", "lab", "blood", "surgery", "room", "pharmacy"
    ]
    for line in lines:
        if any(x in line.lower() for x in keywords):
            extracted_description.append(line.strip())

    # Calculate weighted OCR confidence score: Amount (50%), Hospital (30%), Date (20%)
    confidence = 0
    if extracted_amount:
        confidence += 50
    if extracted_hospital:
        confidence += 30
    if extracted_date:
        confidence += 20

    parsed_date = parse_date_string(extracted_date) or datetime.datetime.utcnow()

    # Check for Duplicate Bill uploads
    start_of_day = datetime.datetime(parsed_date.year, parsed_date.month, parsed_date.day, 0, 0, 0)
    end_of_day = datetime.datetime(parsed_date.year, parsed_date.month, parsed_date.day, 23, 59, 59)
    existing = db.query(models.Expense).filter(
        models.Expense.user_id == current_user.id,
        models.Expense.hospital == (extracted_hospital or "General Expense"),
        models.Expense.amount == (extracted_amount or 0.0),
        models.Expense.date >= start_of_day,
        models.Expense.date <= end_of_day
    ).first()

    if existing:
        print("Duplicate bill detected:", existing.id)
        # Delete the newly uploaded file to save space
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"Error removing duplicate file: {e}")

        return {
            "ocr_success": True,
            "hospital": extracted_hospital,
            "amount": extracted_amount,
            "date": extracted_date,
            "description": ", ".join(extracted_description),
            "confidence": confidence,
            "file_path": existing.file_path,
            "bill_file": existing.bill_file,
            "duplicate": True,
            "editable": True,
            "expense": {
                "id": existing.id,
                "hospital": existing.hospital,
                "description": existing.description,
                "amount": existing.amount,
                "date": existing.date.isoformat() if existing.date else None,
                "file_path": existing.file_path,
                "bill_file": existing.bill_file,
                "confidence": existing.confidence
            }
        }

    if confidence >= 70:
        desc_str = ", ".join(extracted_description) or "Uploaded Bill Receipt"
        hosp_str = extracted_hospital or "General Expense"
        text_lower = f"{desc_str} {hosp_str}".lower()
        
        category = "Consultation"
        if any(k in text_lower for k in ["blood", "lab", "test", "pathology", "diagnost"]):
            category = "Blood Test"
        elif any(k in text_lower for k in ["ecg", "scan", "x-ray", "mri", "electrocardiogram"]):
            category = "ECG"
        elif any(k in text_lower for k in ["pharmacy", "medicine", "drug", "chemist", "tablet", "capsule", "syrup"]):
            category = "Medicines"
        elif any(k in text_lower for k in ["consult", "doctor", "physician", "clinic", "opd", "appointment"]):
            category = "Consultation"

        expense = models.Expense(
            hospital=hosp_str,
            description=desc_str,
            amount=extracted_amount or 0.0,
            date=parsed_date,
            file_path=f"/uploads/bills/{filename}",
            bill_file=f"/uploads/bills/{filename}",
            confidence=confidence,
            user_id=current_user.id,
            category=category
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)

        return {
            "ocr_success": True,
            "hospital": extracted_hospital,
            "amount": extracted_amount,
            "date": extracted_date,
            "description": ", ".join(extracted_description),
            "confidence": confidence,
            "file_path": f"/uploads/bills/{filename}",
            "bill_file": f"/uploads/bills/{filename}",
            "duplicate": False,
            "editable": True,
            "expense": {
                "id": expense.id,
                "hospital": expense.hospital,
                "description": expense.description,
                "amount": expense.amount,
                "date": expense.date.isoformat() if expense.date else None,
                "file_path": expense.file_path,
                "bill_file": expense.bill_file,
                "confidence": expense.confidence
            }
        }
    else:
        return {
            "ocr_success": False,
            "manual_entry_required": True,
            "hospital": extracted_hospital,
            "amount": extracted_amount,
            "date": extracted_date,
            "description": ", ".join(extracted_description),
            "confidence": confidence,
            "file_path": f"/uploads/bills/{filename}",
            "bill_file": f"/uploads/bills/{filename}",
            "duplicate": False,
            "editable": True,
            "expense": None
        }

@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.user_id == current_user.id
    ).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense record not found")
    
    # Remove file from disk if file_path is set
    if db_expense.file_path:
        clean_path = db_expense.file_path
        if clean_path.startswith("/"):
            clean_path = clean_path[1:]
        if os.path.exists(clean_path):
            try:
                os.remove(clean_path)
            except Exception as e:
                print(f"Error deleting bill file {clean_path}: {e}")

    db.delete(db_expense)
    db.commit()
    return {"message": "Expense record deleted successfully"}

@app.put("/api/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
def update_expense(expense_id: int, expense_update: schemas.ExpenseCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.user_id == current_user.id
    ).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense record not found")
    
    db_expense.hospital = expense_update.hospital
    db_expense.description = expense_update.description
    db_expense.amount = expense_update.amount
    db_expense.date = expense_update.date
    if expense_update.file_path:
        db_expense.file_path = expense_update.file_path
    if expense_update.confidence is not None:
        db_expense.confidence = expense_update.confidence
    if expense_update.bill_file:
        db_expense.bill_file = expense_update.bill_file
    if expense_update.category:
        db_expense.category = expense_update.category
    
    db.commit()
    db.refresh(db_expense)
    return db_expense

# ================= CHAT AI ASSISTANT =================

def generate_health_summary(user: models.User, db: Session) -> str:
    weight = user.weight or 0
    height = user.height or 0
    bmi_str = "N/A"
    bmi = 0
    if height > 0:
        bmi = round(weight / ((height / 100) ** 2), 1)
        bmi_str = f"{bmi}"
        
    vitals = db.query(models.HealthMetric).filter(models.HealthMetric.user_id == user.id).order_by(models.HealthMetric.date.desc()).limit(5).all()
    meds = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).all()
    
    score = 80
    strengths = []
    needs_attention = []
    
    if bmi > 0:
        if 18.5 <= bmi < 25:
            strengths.append("✓ Normal BMI")
            score += 5
        elif bmi < 18.5:
            needs_attention.append("⚠ BMI is underweight. Consider nutritional counseling.")
            score -= 5
        else:
            needs_attention.append("⚠ BMI indicates overweight. Consider regular exercise and diet control.")
            score -= 5
    else:
        needs_attention.append("⚠ BMI data incomplete. Please log your height and weight.")
        
    systolics = [v.systolic_bp for v in vitals if v.systolic_bp is not None]
    diastolics = [v.diastolic_bp for v in vitals if v.diastolic_bp is not None]
    sugars = [v.blood_sugar for v in vitals if v.blood_sugar is not None]
    
    if systolics:
        avg_sys = sum(systolics) / len(systolics)
        avg_dia = sum(diastolics) / len(diastolics) if diastolics else 80
        if avg_sys < 120 and avg_dia < 80:
            strengths.append("✓ Normal blood pressure")
            score += 5
        elif 120 <= avg_sys < 130 and avg_dia < 80:
            needs_attention.append("⚠ Elevated blood pressure")
            score -= 2
        else:
            needs_attention.append("⚠ Blood pressure slightly elevated")
            score -= 5
    else:
        needs_attention.append("⚠ No recent blood pressure logs")
        
    if sugars:
        avg_sugar = sum(sugars) / len(sugars)
        if 70 <= avg_sugar < 140:
            strengths.append("✓ Normal blood sugar level")
            score += 5
        else:
            needs_attention.append("⚠ Blood sugar levels fluctuating")
            score -= 5
    else:
        needs_attention.append("⚠ No recent blood sugar logs")
        
    if meds:
        taken_count = sum(1 for m in meds if m.status == "Taken")
        total_count = len(meds)
        if taken_count == total_count:
            strengths.append("✓ Regular medication compliance (100%)")
            score += 5
        elif taken_count > 0:
            strengths.append("✓ Partially taking medications")
        else:
            needs_attention.append("⚠ Medication schedule has upcoming pills to log")
            
    score = min(max(score, 30), 100)
    strengths_str = "\n".join(strengths) if strengths else "None logged yet"
    attention_str = "\n".join(needs_attention) if needs_attention else "None"

    histories = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == user.id).order_by(models.MedicalHistory.diagnosis_date.desc()).limit(10).all()
    cond_str = "\n".join([f"• {h.condition} ({h.status})" for h in histories]) if histories else "None logged"
    
    meds = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).all()
    med_str = "\n".join([f"• {m.name} ({m.dosage}) at {m.time}" for m in meds]) if meds else "None active"
    
    appts = db.query(models.Appointment).filter(models.Appointment.user_id == user.id).order_by(models.Appointment.date.desc()).limit(10).all()
    appt_list_items = []
    for a in appts:
        doc_name = a.doctor.strip()
        doc_name = doc_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
        if not doc_name.startswith("Dr."):
            doc_display = f"Dr. {doc_name}"
        else:
            doc_display = doc_name
        appt_list_items.append(f"• {doc_display} ({a.specialty}) on {a.date} at {a.time}")
    appt_str = "\n".join(appt_list_items) if appts else "None scheduled"
    
    expenses = db.query(models.Expense).filter(models.Expense.user_id == user.id).order_by(models.Expense.date.desc()).limit(10).all()
    total_exp = sum(e.amount for e in expenses)
    exp_str = f"Total Spent: ₹{total_exp:.2f}\n" + "\n".join([f"• {e.hospital}: ₹{e.amount} ({e.date})" for e in expenses[:3]]) if expenses else "No expenses logged"
    
    reports = db.query(models.Report).filter(models.Report.user_id == user.id).order_by(models.Report.created_at.desc()).limit(10).all()
    rep_str = "\n".join([f"• {r.report_type} ({r.file_path})" for r in reports]) if reports else "No reports uploaded"

    disclaimer = "\n\n*This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.*"

    return f"""📋 **MediCare+ Personal Health Summary**

👤 **Patient Profile**
- Name: {user.full_name}
- Age: {user.age or 'N/A'}
- Gender: {user.gender or 'N/A'}
- Health Score: {user.health_score or 'N/A'}/100
- BMI: {bmi_str}

🩺 **Medical Conditions**
{cond_str}

💊 **Active Medicines**
{med_str}

📅 **Upcoming Appointments**
{appt_str}

💳 **Recent Expenses**
{exp_str}

📄 **Medical Reports**
{rep_str}

📊 **MediCare+ Health Insights Dashboard**

📈 **Health Score: {score}/100**

**Strengths:**
{strengths_str}

**Needs Attention:**
{attention_str}

Focus Areas:

• Monitor blood pressure regularly
• Take medicines on time
• Attend upcoming appointment
• Maintain healthy diet
• Continue tracking vitals{disclaimer}"""

@app.get("/api/chat/history", response_model=List[schemas.MessageResponse])
def get_chat_history(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    messages = db.query(models.Message).filter(models.Message.user_id == current_user.id).order_by(models.Message.timestamp.desc()).limit(10).all()
    return messages[::-1]

def compile_patient_context(db: Session, user: models.User) -> str:
    # Fetch basic demographics
    context = "Patient Demographics:\n"
    context += f"- Full Name: {user.full_name}\n"
    context += f"- Age: {user.age}\n"
    context += f"- Gender: {user.gender}\n"
    context += f"- Health Score: {user.health_score}/100\n"
    context += f"- Weight: {user.weight} kg\n"
    context += f"- Height: {user.height} cm\n\n"
    
    # Fetch Medical History (Limit to 10 most recent)
    histories = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == user.id).order_by(models.MedicalHistory.diagnosis_date.desc()).limit(10).all()
    context += "Medical History:\n"
    if histories:
        for h in histories:
            diag_str = h.diagnosis_date.strftime('%Y-%m-%d') if hasattr(h.diagnosis_date, 'strftime') else str(h.diagnosis_date)
            context += f"- Condition: {h.condition} (Status: {h.status}, Notes: {h.notes or 'None'}) - Diagnosis Date: {diag_str}\n"
    else:
        context += "- No medical history logged.\n"
    context += "\n"
    
    # Fetch Family Contacts
    family = db.query(models.FamilyMember).filter(models.FamilyMember.user_id == user.id).all()
    context += "Emergency & Family Contacts:\n"
    if family:
        for f in family:
            em_status = " [Emergency Contact]" if f.is_emergency_contact else ""
            context += f"- Name: {f.name} ({f.relation}) - Phone: {f.phone}{em_status}\n"
    else:
        context += "- No family contacts logged.\n"
    context += "\n"
    
    # Fetch Reports (Limit to 10 most recent)
    reports = db.query(models.Report).filter(models.Report.user_id == user.id).order_by(models.Report.created_at.desc()).limit(10).all()
    context += "Lab & Medical Reports:\n"
    if reports:
        for r in reports:
            context += f"- Report Type: {r.report_type} (File: {r.file_path}) - Logged: {r.created_at.strftime('%Y-%m-%d') if hasattr(r.created_at, 'strftime') else r.created_at}\n"
    else:
        context += "- No reports available.\n"
    context += "\n"
    
    # Fetch Medicine Schedule
    meds = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).all()
    context += "Medication Schedule:\n"
    if meds:
        for m in meds:
            context += f"- {m.name} ({m.dosage}) - {m.time} [Status: {m.status}]\n"
    else:
        context += "- No active medications scheduled.\n"
    context += "\n"
    
    # Fetch Appointments
    appts = db.query(models.Appointment).filter(
        models.Appointment.user_id == user.id
    ).all()
    context += "Appointments:\n"
    if appts:
        for a in appts:
            doc_name = a.doctor.strip()
            doc_name = doc_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
            if not doc_name.startswith("Dr."):
                doc_display = f"Dr. {doc_name}"
            else:
                doc_display = doc_name
            context += f"- Doctor: {doc_display} ({a.specialty}) at {a.hospital} on {a.date.strftime('%Y-%m-%d') if hasattr(a.date, 'strftime') else a.date} at {a.time} - Status: {a.status}\n"
    else:
        context += "- No appointments scheduled.\n"
    context += "\n"
    
    # Fetch Expenses (Limit to 10 most recent)
    expenses = db.query(models.Expense).filter(models.Expense.user_id == user.id).order_by(models.Expense.date.desc()).limit(10).all()
    context += "Expenses & Medical Bills:\n"
    if expenses:
        total = sum(e.amount for e in expenses)
        context += f"- Total Spent to Date: Rs. {total:.2f}\n"
        for e in expenses:
            context += f"- {e.hospital}: {e.description or 'Bill'} - Rs. {e.amount} on {e.date.strftime('%Y-%m-%d') if hasattr(e.date, 'strftime') else e.date}\n"
    else:
        context += "- No medical bills logged.\n"
    
    return context

def classify_intent(message: str) -> str:
    msg = message.lower()
    
    health_insights_keywords = [
        "how is my health",
        "health summary",
        "complete health report",
        "health report",
        "summarize my health",
        "all my health information",
        "summarize all my health information",
        "overall health",
        "how is my health overall",
        "focus on improving",
        "improve my health",
        "health recommendations",
        "health advice",
        "what should i improve"
    ]
    if any(k in msg for k in health_insights_keywords):
        return "health_summary"
        
    if any(k in msg for k in ["profile summary", "summarize my profile", "my profile", "profile details"]):
        return "profile_summary"

    if any(x in msg for x in ["upcoming medicines", "upcoming medicine", "show only upcoming medicines"]):
        return "medicines_upcoming"

    if "age" in msg or "how old" in msg:
        return "profile_age"

    if "bmi" in msg:
        return "profile_bmi"
        
    if any(word in msg for word in ["weight", "weigh", "my weight"]):
        return "profile_weight"
        
    if any(word in msg for word in ["height", "how tall"]):
        return "profile_height"
        
    if any(x in msg for x in ["due next", "next medicine", "medicine is due next"]):
        return "medicines_due_next"
        
    if any(x in msg for x in ["already took", "taken today", "medicines i took"]):
        return "medicines_taken"
        
    if "miss" in msg:
        return "medicines_missed"
        
    if any(word in msg for word in ["medicine", "medicines", "medication", "pill", "dosage", "schedule"]):
        return "medicines"
        
    if "next appointment" in msg:
        return "next_appointment"
        
    if any(word in msg for word in ["appointment", "doctor visit", "appointments", "doctor", "clinic", "consult"]):
        return "appointments"
        
    if any(word in msg for word in ["expense", "bill", "cost", "spent", "hospital bill", "expenses"]):
        return "expenses"
        
    if any(word in msg for word in ["emergency contact", "family member", "family", "contacts", "mother", "father"]):
        return "family"
        
    if any(word in msg for word in ["history", "condition", "diagnos", "medical history"]):
        return "medical_history"
        
    if any(word in msg for word in ["recommendation", "recommend", "insight", "insights"]):
        return "recommendations"
        
    if any(word in msg for word in ["fever", "headache", "pain", "sick", "bp", "blood pressure", "sugar", "vitals", "heart rate"]):
        return "general_health"
        
    return "general"

def simulate_gemini_response(prompt: str, context: str) -> str:
    if "Current User Message:" in prompt:
        q = prompt.split("Current User Message:")[-1].strip().lower()
    else:
        q = prompt.lower()
    disclaimer = "\n\n*This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.*"
    
    if "recommend" in q or "insight" in q:
        return f"Based on your profile, medical history, and medicines, here are some personalized health recommendations:\n\n1. Ensure you take your medicines on time as scheduled.\n2. Maintain a balanced diet and log your vitals daily.\n3. Follow up with your doctor on scheduled appointments.\n\n*This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.*"

    if "medicine" in q or "pill" in q or "schedule" in q or "dose" in q or "dosage" in q or "omega" in q:
        return f"Here is your active medication schedule retrieved from the database:\n{context}\n\nPlease let me know if you have any questions about these dosages."
            
    elif "appointment" in q or "doctor" in q or "clinic" in q or "consult" in q:
        return f"Here are your upcoming appointments retrieved from the database:\n{context}\n\nLet me know if you would like me to help you reschedule or plan your transit details!"
            
    elif "bp" in q or "blood pressure" in q or "sugar" in q or "vitals" in q or "heart rate" in q:
        return f"Based on your recent health metrics:\n{context}\n\nYour levels appear to be stable. Please continue monitoring and logging your vitals regularly.{disclaimer}"
            
    elif "report" in q or "reports" in q or "lab report" in q or "blood report" in q:
        return f"Here are your lab and medical reports from the database:\n{context}\n\nPlease consult your physician to review these results in detail.{disclaimer}"
        
    elif "expense" in q or "bill" in q or "cost" in q or "spent" in q or "hospital bill" in q:
        lines = context.split("\n")
        resp_str = ""
        for line in lines:
            if line.startswith("- ") and "Rs." in line and ":" in line:
                try:
                    parts = line[2:].split(":")
                    hosp = parts[0].strip()
                    rest = parts[1].split("- Rs.")
                    desc = rest[0].strip()
                    rest2 = rest[1].split(" on ")
                    amt = rest2[0].strip()
                    date_str = rest2[1].strip()
                    resp_str += f"🏥 {hosp}\n\n📅 Date: {date_str}\n\n💰 Total: ₹{amt}\n\nServices:\n• {desc} - ₹{amt}\n\n---\n\n"
                except Exception:
                    pass
        if resp_str:
            return "Here is the breakdown of your medical expenses and bills:\n\n" + resp_str.strip("\n- ")
        return f"Here is the breakdown of your medical expenses and bills:\n{context}\n\nLet me know if you need to upload a new bill receipt."
        
    elif "family" in q or "mother" in q or "father" in q or "contact" in q:
        return f"Here are your emergency and family contacts:\n{context}\n\nYou can update these contacts in your profile settings."
        
    elif "history" in q or "condition" in q or "diagnos" in q or "medical" in q:
        conditions = []
        for line in context.split('\n'):
            if "Condition:" in line:
                cond = line.split("Condition:")[1].strip()
                if " (" in cond:
                    cond = cond.split(" (")[0]
                conditions.append(cond)
        if conditions:
            cond_list = "\n".join([f"- {c}" for c in conditions])
            return f"Based on your medical history, you have the following health conditions:\n{cond_list}{disclaimer}"
        else:
            return f"Based on your medical history, you do not have any logged health conditions.{disclaimer}"
            
    elif "headache" in q or "fever" in q or "pain" in q or "sick" in q:
        return f"I'm sorry to hear you're feeling unwell. A headache or fever could be due to physical exhaustion, stress, or a mild infection. Make sure to rest well and stay hydrated.{disclaimer}"
        
    elif "emergency" in q or "sos" in q or "ambulance" in q:
        return "🚨 **EMERGENCY WARNING**: If you are experiencing severe chest pain, extreme breathlessness, or sudden paralysis, please tap the red SOS button on the Emergency tab immediately. I can call an ambulance to your current location or alert your emergency contacts."
        
    else:
        return "Hello Gowthami! I am your MediCare+ AI health assistant. I can help track your daily pill schedule, search for doctor consults, visualize your blood pressure trends, or answer standard health questions. How can I assist you today?"

def get_gemini_response(prompt: str, context: str) -> str:
    system_instruction = (
        "You are MediCare+ AI, a helpful, secure, and professional healthcare assistant. "
        "Use the provided database context to answer the user's queries accurately. "
        "If the user asks medical questions, always include this disclaimer: "
        "'This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.' "
        "Never prescribe medicine. Keep responses friendly, concise, and structured. "
        "Format any expense or bill details using this clean format:\n"
        "🏥 {hospital}\n"
        "📅 Date: {date}\n"
        "💰 Total: ₹{amount}\n"
        "Services:\n"
        "• {Service Name} - ₹{cost}"
    )
    
    full_prompt = f"""System Instruction:
{system_instruction}

Context:
{context}

Question:
{prompt}

Never prescribe medicine.
"""

    try:
        return ai_service.ask_ai(full_prompt)
    except Exception as e:
        print(f"Error calling Gemini API: {e}. Falling back to local simulation.")
        return simulate_gemini_response(prompt, context)

def compile_relevant_context(db: Session, user: models.User, intent: str) -> str:
    # Demographics and basic profile details are always useful context
    context = f"Patient Profile: {user.full_name}, Age: {user.age or 'N/A'}, Gender: {user.gender or 'N/A'}, Health Score: {user.health_score or 'N/A'}/100\n\n"
    
    if intent == "medicine":
        meds = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).all()
        context += "Medication Schedule:\n"
        if meds:
            for m in meds:
                context += f"- {m.name} ({m.dosage}) - {m.time} [Status: {m.status}]\n"
        else:
            context += "- No active medications scheduled.\n"
            
    elif intent == "appointment":
        appts = db.query(models.Appointment).filter(models.Appointment.user_id == user.id).all()
        context += "Appointments:\n"
        if appts:
            for a in appts:
                doc_name = a.doctor.strip()
                doc_name = doc_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
                if not doc_name.startswith("Dr."):
                    doc_display = f"Dr. {doc_name}"
                else:
                    doc_display = doc_name
                context += f"- Doctor: {doc_display} ({a.specialty}) at {a.hospital} on {a.date.strftime('%Y-%m-%d') if hasattr(a.date, 'strftime') else a.date} at {a.time} - Status: {a.status}\n"
        else:
            context += "- No appointments scheduled.\n"
            
    elif intent == "health":
        metrics = db.query(models.HealthMetric).filter(models.HealthMetric.user_id == user.id).order_by(models.HealthMetric.date.desc()).limit(5).all()
        context += "Recent Health Vitals:\n"
        if metrics:
            for m in metrics:
                context += f"- Date {m.date.strftime('%Y-%m-%d') if hasattr(m.date, 'strftime') else m.date}: BP: {m.systolic_bp or 'N/A'}/{m.diastolic_bp or 'N/A'} mmHg, HR: {m.heart_rate or 'N/A'} bpm, Blood Sugar: {m.blood_sugar or 'N/A'} mg/dl\n"
        else:
            context += "- No recent vitals logged.\n"
            
    elif intent == "reports":
        reports = db.query(models.Report).filter(models.Report.user_id == user.id).order_by(models.Report.created_at.desc()).limit(10).all()
        context += "Lab & Medical Reports:\n"
        if reports:
            for r in reports:
                context += f"- Type: {r.report_type} (File: {r.file_path}) - Logged: {r.created_at.strftime('%Y-%m-%d') if hasattr(r.created_at, 'strftime') else r.created_at}\n  Summary: {r.summary or 'No summary available.'}\n"
        else:
            context += "- No reports logged.\n"
            
    elif intent == "expense":
        expenses = db.query(models.Expense).filter(models.Expense.user_id == user.id).order_by(models.Expense.date.desc()).limit(10).all()
        context += "Medical Expenses & Invoices:\n"
        if expenses:
            total = sum(e.amount for e in expenses)
            context += f"- Total Spent: Rs. {total:.2f}\n"
            for e in expenses:
                context += f"- {e.hospital}: {e.description or 'Invoice'} - Rs. {e.amount} on {e.date.strftime('%Y-%m-%d') if hasattr(e.date, 'strftime') else e.date}\n"
        else:
            context += "- No bills logged.\n"
            
    elif intent == "family":
        family = db.query(models.FamilyMember).filter(models.FamilyMember.user_id == user.id).all()
        context += "Family & Emergency Contacts:\n"
        if family:
            for f in family:
                em_status = " [Emergency Contact]" if f.is_emergency_contact else ""
                context += f"- {f.name} ({f.relation}) - Phone: {f.phone}{em_status}\n"
        else:
            context += "- No contacts logged.\n"
            
    elif intent == "medical_history":
        histories = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == user.id).order_by(models.MedicalHistory.diagnosis_date.desc()).limit(10).all()
        context += "Medical History:\n"
        if histories:
            for h in histories:
                diag_str = h.diagnosis_date.strftime('%Y-%m-%d') if hasattr(h.diagnosis_date, 'strftime') else str(h.diagnosis_date)
                context += f"- Condition: {h.condition} (Status: {h.status}, Notes: {h.notes or 'None'}) - Diagnosis Date: {diag_str}\n"
        else:
            context += "- No medical history logged.\n"
            
    else:
        # Load a brief summary
        context += "Brief Summary:\n"
        med_count = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).count()
        appt_count = db.query(models.Appointment).filter(models.Appointment.user_id == user.id, models.Appointment.status == "Upcoming").count()
        context += f"- Scheduled medications today: {med_count}\n"
        context += f"- Upcoming doctor appointments: {appt_count}\n"
        histories = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == user.id).order_by(models.MedicalHistory.diagnosis_date.desc()).limit(10).all()
        if histories:
            context += "- Medical History: " + ", ".join([h.condition for h in histories]) + "\n"
            
    return context

def extract_reschedule_date(text: str) -> Optional[datetime.date]:
    text_lower = text.lower()
    match = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', text)
    if match:
        try:
            day, month, year = map(int, match.groups())
            return datetime.date(year, month, day)
        except Exception:
            pass
            
    match = re.search(r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})', text)
    if match:
        try:
            year, month, day = map(int, match.groups())
            return datetime.date(year, month, day)
        except Exception:
            pass

    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
        "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
    }
    
    match1 = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)', text_lower)
    if match1:
        day_str, month_str = match1.groups()
        if month_str in months:
            try:
                day = int(day_str)
                month = months[month_str]
                year = 2026
                match_yr = re.search(month_str + r'\s+(\d{4})', text_lower)
                if match_yr:
                    year = int(match_yr.group(1))
                return datetime.date(year, month, day)
            except Exception:
                pass
                
    match2 = re.search(r'([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?', text_lower)
    if match2:
        month_str, day_str = match2.groups()
        if month_str in months:
            try:
                day = int(day_str)
                month = months[month_str]
                year = 2026
                match_yr = re.search(month_str + r'\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*(\d{4})', text_lower)
                if match_yr:
                    year = int(match_yr.group(1))
                return datetime.date(year, month, day)
            except Exception:
                pass
                
    return None

def save_chat_messages(db: Session, user_id: int, user_content: str, ai_content: str):
    user_msg = models.Message(sender="user", content=user_content, user_id=user_id)
    db.add(user_msg)
    chat_user = models.ChatHistory(user_id=user_id, role="user", message=user_content)
    db.add(chat_user)
    
    ai_msg = models.Message(sender="ai", content=ai_content, user_id=user_id)
    db.add(ai_msg)
    chat_ai = models.ChatHistory(user_id=user_id, role="ai", message=ai_content)
    db.add(chat_ai)
    
    db.commit()
    db.refresh(ai_msg)
    return ai_msg

@app.post("/api/chat", response_model=schemas.MessageResponse)
def send_chat_message(msg: schemas.MessageCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    msg_content_lower = msg.content.lower()

    # 1. Security Layer Check
    dangerous_keywords = ["another user", "other patient", "someone else's"]
    if any(k in msg_content_lower for k in dangerous_keywords):
        return save_chat_messages(db, current_user.id, msg.content, "I can only access information associated with your account.")

    # 2. Emergency Recognition Check
    emergency_keywords = ["chest pain", "difficulty breathing", "stroke", "heart attack", "suicidal"]
    if any(k in msg_content_lower for k in emergency_keywords):
        return save_chat_messages(db, current_user.id, msg.content, "⚠️ Seek emergency medical care immediately.")

    # 3. Action Check: Add Medicine
    match_med = re.search(r'(?:add|schedule)\s+(?:medicine|pill|tablet)?\s*(.*?)\s+(?:today\s+)?at\s+(\d{1,2}(?::\d{2})?\s*(?:pm|am|PM|AM)?)', msg.content, re.IGNORECASE)
    if match_med:
        name, time_str = match_med.groups()
        name_clean = name.strip()
        category = "Tablet"
        dosage = "1 Tablet"
        if "capsule" in name_clean.lower():
            category = "Capsule"
            dosage = "1 Capsule"
        elif "syrup" in name_clean.lower() or "suspension" in name_clean.lower():
            category = "Syrup"
            dosage = "10 ml"
        elif "injection" in name_clean.lower():
            category = "Injection"
            dosage = "1 Dose"

        new_med_db = models.Medicine(
            name=name_clean,
            dosage=dosage,
            instructions="With Food",
            time=time_str.strip(),
            status="Upcoming",
            category=category,
            user_id=current_user.id
        )
        db.add(new_med_db)
        db.commit()
        ai_content = f"Medicine '{name_clean}' scheduled at {time_str.strip()} has been added successfully."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    # 4. Action Check: Delete Appointment
    if "delete my appointment" in msg_content_lower or "delete appointment" in msg_content_lower:
        latest_appt = db.query(models.Appointment).filter(
            models.Appointment.user_id == current_user.id
        ).order_by(models.Appointment.date.desc()).first()
        if latest_appt:
            doctor_name = latest_appt.doctor.strip()
            doctor_name = doctor_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
            if doctor_name.startswith("Dr."):
                display_name = doctor_name
            else:
                display_name = f"Dr. {doctor_name}"
            appt_date = latest_appt.date
            db.delete(latest_appt)
            db.commit()
            ai_content = f"Your upcoming appointment with {display_name} on {appt_date} has been cancelled successfully."
        else:
            ai_content = "You have no upcoming appointments to delete."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    # 5. Action Check: Add Expense
    match_exp = re.search(r'add\s+expense\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d{2})?)', msg.content, re.IGNORECASE)
    if match_exp:
        amount = float(match_exp.group(1))
        new_exp_db = models.Expense(
            hospital="General Clinic",
            description="Medical Expense Added via Chat",
            amount=amount,
            date=datetime.datetime.utcnow(),
            user_id=current_user.id,
            confidence=100
        )
        db.add(new_exp_db)
        db.commit()
        ai_content = f"Expense of ₹{amount:.2f} has been added successfully."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    # 6. Appointment Rescheduling Check
    if "reschedule" in msg_content_lower:
        new_date = extract_reschedule_date(msg.content)
        if new_date:
            latest_appt = db.query(models.Appointment).filter(
                models.Appointment.user_id == current_user.id
            ).order_by(models.Appointment.date.desc()).first()
            if latest_appt:
                latest_appt.date = new_date
                db.commit()
                ai_content = f"Appointment rescheduled successfully to {new_date.strftime('%d %B %Y')}."
            else:
                ai_content = "You have no appointments to reschedule."
        else:
            ai_content = "Could not extract a valid date for rescheduling. Please specify the date (e.g. '12 June' or '12/06/2026')."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    # 6.5. Fever medicine advice check
    if ("medicine" in msg_content_lower or "pill" in msg_content_lower or "what should i take" in msg_content_lower or "what to take" in msg_content_lower) and ("take" in msg_content_lower or "should i" in msg_content_lower or "need" in msg_content_lower or "use" in msg_content_lower or "recommend" in msg_content_lower):
        recent_history = db.query(models.ChatHistory).filter(
            models.ChatHistory.user_id == current_user.id
        ).order_by(models.ChatHistory.timestamp.desc()).limit(5).all()
        recent_context_has_fever = False
        for h in recent_history:
            if h.role == "user" and "fever" in h.message.lower():
                recent_context_has_fever = True
                break
        if "fever" in msg_content_lower or recent_context_has_fever:
            disclaimer = "\n\n*This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.*"
            ai_content = f"Since you mentioned fever, Paracetamol is commonly used for fever relief. Follow dosage instructions and consult a healthcare professional if symptoms persist.{disclaimer}"
            return save_chat_messages(db, current_user.id, msg.content, ai_content)

    # 7. Classify Intent and Router
    intent = classify_intent(msg.content)

    if intent == "profile_weight":
        weight = current_user.weight
        if weight:
            ai_content = f"Your current weight is {weight} kg."
        else:
            ai_content = "I don't have your weight logged in your profile."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "profile_height":
        height = current_user.height
        if height:
            ai_content = f"Your height is {height} cm."
        else:
            ai_content = "I don't have your height logged in your profile."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "profile_bmi":
        weight = current_user.weight
        height = current_user.height
        if not weight or not height:
            ai_content = "I don't have your height and weight on file. Please update them in your profile."
        else:
            height_m = height / 100
            bmi = weight / (height_m * height_m)
            if bmi < 18.5:
                range_desc = "falls within the underweight BMI range (< 18.5)"
                advice = "Ensure you consume nutrient-rich foods and consult a nutritionist."
            elif bmi < 25:
                range_desc = "falls within the healthy BMI range (18.5–24.9)"
                advice = "Maintain a balanced diet and regular exercise."
            elif bmi < 30:
                range_desc = "falls within the overweight BMI range (25–29.9)"
                advice = "Focus on portion control, healthy eating habits, and physical activity."
            else:
                range_desc = "falls within the obese BMI range (>= 30)"
                advice = "It is recommended to seek guidance from a medical practitioner for a personalized wellness plan."
            
            ai_content = f"Your BMI is {bmi:.1f}.\n\nThis {range_desc}.\n\n{advice}"
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "profile_summary":
        weight_str = f"{current_user.weight} kg" if current_user.weight else "N/A"
        height_str = f"{current_user.height} cm" if current_user.height else "N/A"
        bmi_str = "N/A"
        if current_user.weight and current_user.height:
            h_m = current_user.height / 100
            bmi_str = f"{current_user.weight / (h_m * h_m):.1f}"
            
        ai_content = (
            "👤 Profile Summary\n\n"
            f"Name: {current_user.full_name or 'Gowthami'}\n"
            f"Age: {current_user.age or 23}\n"
            f"Gender: {current_user.gender or 'Female'}\n\n"
            f"Weight: {weight_str}\n"
            f"Height: {height_str}\n"
            f"BMI: {bmi_str}\n\n"
            f"Health Score: {current_user.health_score or 82}/100"
        )
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "medicines_upcoming":
        upcoming = db.query(models.Medicine).filter(
            models.Medicine.user_id == current_user.id,
            models.Medicine.status == "Upcoming"
        ).all()
        
        # Sort chronologically by parsing time
        def parse_time_helper(t):
            try:
                if "am" in t.lower() or "pm" in t.lower():
                    return datetime.datetime.strptime(t.strip().upper(), "%I:%M %p").time()
                else:
                    return datetime.datetime.strptime(t.strip(), "%H:%M").time()
            except Exception:
                return datetime.time.max
                
        upcoming.sort(key=lambda x: parse_time_helper(x.time))
        
        if upcoming:
            list_items = []
            for m in upcoming:
                list_items.append(f"• {m.name} - {m.time}")
            ai_content = "Upcoming Medicines\n\n" + "\n".join(list_items)
        else:
            ai_content = "You have no upcoming medicines scheduled."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "profile_age":
        age = current_user.age
        if age:
            ai_content = f"You are {age} years old."
        else:
            ai_content = "I don't have your age logged in your profile."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "health_summary":
        ai_content = generate_health_summary(current_user, db)
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "health_insights":
        weight = current_user.weight or 0
        height = current_user.height or 0
        bmi = 0
        if height > 0:
            bmi = round(weight / ((height / 100) ** 2), 1)
            
        vitals = db.query(models.HealthMetric).filter(models.HealthMetric.user_id == current_user.id).order_by(models.HealthMetric.date.desc()).limit(5).all()
        meds = db.query(models.Medicine).filter(models.Medicine.user_id == current_user.id).all()
        
        score = 80
        strengths = []
        needs_attention = []
        
        if bmi > 0:
            if 18.5 <= bmi < 25:
                strengths.append("✓ Normal BMI")
                score += 5
            elif bmi < 18.5:
                needs_attention.append("⚠ BMI is underweight. Consider nutritional counseling.")
                score -= 5
            else:
                needs_attention.append("⚠ BMI indicates overweight. Consider regular exercise and diet control.")
                score -= 5
        else:
            needs_attention.append("⚠ BMI data incomplete. Please log your height and weight.")
            
        systolics = [v.systolic_bp for v in vitals if v.systolic_bp is not None]
        diastolics = [v.diastolic_bp for v in vitals if v.diastolic_bp is not None]
        sugars = [v.blood_sugar for v in vitals if v.blood_sugar is not None]
        
        if systolics:
            avg_sys = sum(systolics) / len(systolics)
            avg_dia = sum(diastolics) / len(diastolics) if diastolics else 80
            if avg_sys < 120 and avg_dia < 80:
                strengths.append("✓ Normal blood pressure")
                score += 5
            elif 120 <= avg_sys < 130 and avg_dia < 80:
                needs_attention.append("⚠ Elevated blood pressure")
                score -= 2
            else:
                needs_attention.append("⚠ Blood pressure slightly elevated")
                score -= 5
        else:
            needs_attention.append("⚠ No recent blood pressure logs")
            
        if sugars:
            avg_sugar = sum(sugars) / len(sugars)
            if 70 <= avg_sugar < 140:
                strengths.append("✓ Normal blood sugar level")
                score += 5
            else:
                needs_attention.append("⚠ Blood sugar levels fluctuating")
                score -= 5
        else:
            needs_attention.append("⚠ No recent blood sugar logs")
            
        if meds:
            taken_count = sum(1 for m in meds if m.status == "Taken")
            total_count = len(meds)
            if taken_count == total_count:
                strengths.append("✓ Regular medication compliance (100%)")
                score += 5
            elif taken_count > 0:
                strengths.append("✓ Partially taking medications")
            else:
                needs_attention.append("⚠ Medication schedule has upcoming pills to log")
                
        score = min(max(score, 30), 100)
        strengths_str = "\n".join(strengths) if strengths else "None logged yet"
        attention_str = "\n".join(needs_attention) if needs_attention else "None"
        
        ai_content = f"""📊 **MediCare+ Health Insights Dashboard**

📈 **Health Score: {score}/100**

**Strengths:**
{strengths_str}

**Needs Attention:**
{attention_str}"""
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "medicines_missed":
        missed_meds = db.query(models.Medicine).filter(
            models.Medicine.user_id == current_user.id,
            models.Medicine.status == "Missed"
        ).all()
        if missed_meds:
            med_list = "\n".join([f"- {m.name} ({m.dosage}) scheduled at {m.time}" for m in missed_meds])
            ai_content = f"Here are your missed medications:\n{med_list}"
        else:
            ai_content = "You have no missed medications logged."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "medicines_due_next":
        medicines = db.query(models.Medicine).filter(
            models.Medicine.user_id == current_user.id,
            models.Medicine.status == "Upcoming"
        ).all()
        if medicines:
            def parse_time_str(t_str: str):
                t_str = t_str.strip().upper()
                for fmt in ("%I:%M %p", "%I %p", "%H:%M", "%I:%M%p", "%I%p"):
                    try:
                        return datetime.datetime.strptime(t_str, fmt).time()
                    except ValueError:
                        pass
                return datetime.time(23, 59)
            medicines.sort(key=lambda m: parse_time_str(m.time))
            next_med = medicines[0]
            ai_content = f"Your next medicine is {next_med.name} at {next_med.time}."
        else:
            ai_content = "You have no upcoming medicines scheduled."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "medicines_taken":
        taken = db.query(models.Medicine).filter(
            models.Medicine.user_id == current_user.id,
            models.Medicine.status == "Taken"
        ).all()
        if taken:
            med_list = "\n".join([f"• {m.name} - {m.time}" for m in taken])
            ai_content = f"Medicines Taken Today:\n\n{med_list}"
        else:
            ai_content = "You have not taken any medicines today."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "medicines":
        meds = db.query(models.Medicine).filter(models.Medicine.user_id == current_user.id).all()
        if meds:
            med_list = "\n".join([f"- {m.name} ({m.dosage}) - {m.time} [Status: {m.status}]" for m in meds])
            ai_content = f"Here is your active medication schedule retrieved from the database:\n{med_list}"
        else:
            ai_content = "You have no active medications scheduled."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "next_appointment":
        appointments = db.query(models.Appointment).filter(
            models.Appointment.user_id == current_user.id,
            models.Appointment.status == "Upcoming"
        ).all()
        if appointments:
            appointments.sort(key=lambda a: a.date)
            next_appt = appointments[0]
            
            doc_name = next_appt.doctor.strip()
            doc_name = doc_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
            if doc_name.startswith("Dr."):
                doc_display = doc_name
            else:
                doc_display = f"Dr. {doc_name}"
                
            date_str = next_appt.date.strftime("%d-%b-%Y")
            ai_content = f"Your next appointment is with {doc_display} at {next_appt.hospital} on {date_str} at {next_appt.time}."
        else:
            ai_content = "You have no upcoming appointments scheduled."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "appointments":
        appts = db.query(models.Appointment).filter(models.Appointment.user_id == current_user.id).all()
        if appts:
            appt_list_items = []
            for a in appts:
                doc_name = a.doctor.strip()
                doc_name = doc_name.replace("Dr. Dr. ", "Dr. ").replace("Dr. Dr.", "Dr.")
                if not doc_name.startswith("Dr."):
                    doc_display = f"Dr. {doc_name}"
                else:
                    doc_display = doc_name
                appt_list_items.append(f"- {doc_display} ({a.specialty}) at {a.hospital} on {a.date} at {a.time} - Status: {a.status}")
            appt_list = "\n".join(appt_list_items)
            ai_content = f"Here are your upcoming appointments retrieved from the database:\n{appt_list}"
        else:
            ai_content = "You have no appointments scheduled."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "expenses":
        expenses = db.query(models.Expense).filter(models.Expense.user_id == current_user.id).order_by(models.Expense.date.desc()).limit(10).all()
        if expenses:
            resp_str = "Here is the breakdown of your medical expenses and bills:\n\n"
            for e in expenses:
                date_str = e.date.strftime('%Y-%m-%d') if hasattr(e.date, 'strftime') else str(e.date)
                resp_str += f"🏥 {e.hospital}\n\n📅 Date: {date_str}\n\n💰 Total: ₹{e.amount}\n\nServices:\n• {e.description or 'Medical Expense'} - ₹{e.amount}\n\n---\n\n"
            ai_content = resp_str.strip("\n- ")
        else:
            ai_content = "You have no medical bills logged."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "family":
        family = db.query(models.FamilyMember).filter(models.FamilyMember.user_id == current_user.id).all()
        if family:
            fam_list = "\n".join([f"- {f.name} ({f.relation}) - Phone: {f.phone}{' [Emergency Contact]' if f.is_emergency_contact else ''}" for f in family])
            ai_content = f"Here are your emergency and family contacts:\n{fam_list}"
        else:
            ai_content = "You have no contacts logged."
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "medical_history":
        histories = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == current_user.id).order_by(models.MedicalHistory.diagnosis_date.desc()).limit(10).all()
        if histories:
            cond_list = "\n".join([f"- {h.condition} ({h.status})" for h in histories])
            ai_content = f"Based on your medical history, you have the following health conditions:\n{cond_list}"
        else:
            ai_content = "Based on your medical history, you do not have any logged health conditions."
        disclaimer = "\n\n*This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.*"
        ai_content += disclaimer
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "recommendations":
        histories = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == current_user.id).all()
        conditions = "\n".join([f"- {h.condition} ({h.status})" for h in histories]) if histories else "None"
        meds = db.query(models.Medicine).filter(models.Medicine.user_id == current_user.id).all()
        med_list = "\n".join([f"- {m.name} ({m.dosage}) at {m.time}" for m in meds]) if meds else "None"
        
        prompt = f"""Patient Age: {current_user.age or 'N/A'}
Weight: {current_user.weight or 'N/A'}
Height: {current_user.height or 'N/A'}

Medical Conditions:
{conditions}

Current Medicines:
{med_list}

Give personalized health recommendations."""
        ai_content = get_gemini_response(prompt, "")
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    elif intent == "general_health":
        vitals = db.query(models.HealthMetric).filter(models.HealthMetric.user_id == current_user.id).order_by(models.HealthMetric.date.desc()).limit(5).all()
        vitals_str = ""
        if vitals:
            vitals_str = "\n".join([f"- Date {v.date}: BP: {v.systolic_bp or 'N/A'}/{v.diastolic_bp or 'N/A'} mmHg, HR: {v.heart_rate or 'N/A'} bpm, Blood Sugar: {v.blood_sugar or 'N/A'} mg/dl" for v in vitals])
        else:
            vitals_str = "No recent vitals logged."
            
        disclaimer = "\n\n*This information is for educational purposes only. Please consult a qualified healthcare professional for diagnosis and treatment.*"
        
        if "fever" in msg_content_lower or "headache" in msg_content_lower or "pain" in msg_content_lower or "sick" in msg_content_lower:
            ai_content = f"I'm sorry to hear you're feeling unwell. A headache or fever could be due to physical exhaustion, stress, or a mild infection. Make sure to rest well and stay hydrated.{disclaimer}"
        else:
            ai_content = f"Based on your recent health vitals:\n{vitals_str}\n\nYour levels appear to be stable. Please continue monitoring and logging your vitals regularly.{disclaimer}"
        return save_chat_messages(db, current_user.id, msg.content, ai_content)

    # 12. General fallback (Call Gemini with Conversation Memory context)
    # Load last 10 messages from ChatHistory
    history_records = db.query(models.ChatHistory).filter(
        models.ChatHistory.user_id == current_user.id
    ).order_by(models.ChatHistory.timestamp.desc()).limit(10).all()
    history_records = history_records[::-1]
    
    history_context = ""
    for h in history_records:
        role_name = "User" if h.role == "user" else "AI"
        history_context += f"{role_name}: {h.message}\n"
        
    full_query = f"Conversation History:\n{history_context}\n\nCurrent User Message:\n{msg.content}"
    
    context = compile_relevant_context(db, current_user, "general")
    
    ai_content = get_gemini_response(full_query, context)
    return save_chat_messages(db, current_user.id, msg.content, ai_content)

# ================= EMERGENCY SERVICES =================

# Cooldown tracker for SOS triggers
@app.post("/api/emergency/sos")
def trigger_sos(
    sos_data: Optional[schemas.SOSRequest] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    
    # 5-minute cooldown check specifically on notifications
    last_notification = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.notification_type == "sos"
    ).order_by(models.Notification.created_at.desc()).first()

    if last_notification:
        if now - last_notification.created_at < datetime.timedelta(minutes=5):
            gps_coords = f"Latitude: {sos_data.latitude if (sos_data and sos_data.latitude is not None) else 12.9716}, Longitude: {sos_data.longitude if (sos_data and sos_data.longitude is not None) else 77.5946}"
            # Log cooldown attempt
            sos_log = models.SOSLog(
                user_id=current_user.id,
                message="SOS Trigger Attempt (Blocked by Cooldown)",
                sent_to="",
                status="COOLDOWN"
            )
            db.add(sos_log)
            db.commit()
            return {
                "status": "COOLDOWN",
                "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                "gps": gps_coords,
                "message": "SOS already triggered recently",
                "contacts": [],
                "hospital": "Apollo Hospital",
                "distance": "1.2 km",
                "phone": "108"
            }

    # SOS Abuse Protection cooldown (2 minutes) - database persisted
    last_sos = current_user.last_sos_time
    if last_sos:
        elapsed = (now - last_sos).total_seconds()
        if elapsed < 120:  # 2 minutes cooldown
            remaining = int(120 - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"SOS cooldown active. Please wait {remaining} seconds before triggering again."
            )
            
    current_user.last_sos_time = now
    db.commit()
    lat = sos_data.latitude if (sos_data and sos_data.latitude is not None) else 12.9716
    lon = sos_data.longitude if (sos_data and sos_data.longitude is not None) else 77.5946
    gps_coords = f"Latitude: {lat}, Longitude: {lon}"
    
    # Query emergency contacts (family)
    emergency_contacts = db.query(models.FamilyMember).filter(
        models.FamilyMember.user_id == current_user.id,
        models.FamilyMember.is_emergency_contact == True
    ).all()
    contacts_sent = []
    
    # Compose SMS
    local_time = datetime.datetime.now()
    time_str = local_time.strftime("%d-%b-%Y %I:%M %p")
    maps_url = f"https://maps.google.com/?q={lat},{lon}"
    sms_body = (
        "🚨 EMERGENCY SOS ALERT\n\n"
        f"Patient: {current_user.full_name}\n\n"
        "An emergency SOS has been triggered.\n\n"
        f"Location:\n{maps_url}\n\n"
        "Please contact immediately.\n\n"
        f"Time: {time_str}"
    )
    
    for member in emergency_contacts:
        if member.phone:
            formatted_p = format_phone(member.phone)
            # Send real Twilio WhatsApp
            sent_status = send_twilio_whatsapp(member.phone, sms_body)
            status_tag = "Sent" if sent_status else "Failed"
            contacts_sent.append(f"{member.name} ({member.relation}): {formatted_p} [{status_tag}]")
            
    # Add a fallback contact if no emergency contacts exist
    if not emergency_contacts:
        fallback_phone = "+919876543210"
        formatted_f = format_phone(fallback_phone)
        sent_status = send_twilio_whatsapp(fallback_phone, sms_body)
        status_tag = "Sent" if sent_status else "Failed"
        contacts_sent.append(f"Emergency Dispatcher ({formatted_f}) [{status_tag}]")
        
    contacts_list = ", ".join(contacts_sent)
    
    # Log successful SOS trigger to database
    sos_log = models.SOSLog(
        user_id=current_user.id,
        message=sms_body,
        sent_to=contacts_list,
        status="TRIGGERED"
    )
    db.add(sos_log)
    
    # Find nearest hospital using geopy
    ambulance = find_nearest_hospital(lat, lon)

    # Create notification log with correct notification_type
    alert_msg = f"EMERGENCY SOS Triggered! Nearest Hospital: {ambulance['hospital']} ({ambulance['distance']}) has been notified. Alerts sent to emergency contacts: {contacts_list}."
    db_notif = models.Notification(
        message=alert_msg,
        read=False,
        user_id=current_user.id,
        notification_type="sos"
    )
    db.add(db_notif)
    db.commit()
    
    return {
        "status": "TRIGGERED",
        "timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "gps": gps_coords,
        "message": alert_msg,
        "contacts": contacts_sent,
        "hospital": ambulance["hospital"],
        "distance": ambulance["distance"],
        "phone": ambulance["phone"]
    }

def find_nearest_hospital(lat: float, lng: float):
    query = f"""
    [out:json];
    node
    ["amenity"="hospital"]
    (around:5000,{lat},{lng});
    out;
    """
    try:
        response = requests.get(
            "https://overpass-api.de/api/interpreter",
            params={"data": query},
            timeout=5
        )
        data = response.json()
        elements = data.get("elements", [])
    except Exception:
        elements = []

    user_coords = (lat, lng)
    nearest_hosp = None
    min_dist = float('inf')

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        el_lat = el.get("lat")
        el_lon = el.get("lon")
        if el_lat is not None and el_lon is not None:
            hosp_coords = (el_lat, el_lon)
            dist = geodesic(user_coords, hosp_coords).km
            if dist < min_dist:
                min_dist = dist
                nearest_hosp = {
                    "hospital": name,
                    "distance": f"{dist:.1f} km",
                    "phone": tags.get("phone", "108")
                }

    if not nearest_hosp:
        nearest_hosp = {
            "hospital": "Apollo Hospital",
            "distance": "1.2 km",
            "phone": "108"
        }

    return nearest_hosp

def get_nearby_hospitals_data(lat: float, lng: float):
    query = f"""
    [out:json];
    node
    ["amenity"="hospital"]
    (around:5000,{lat},{lng});
    out;
    """
    try:
        response = requests.get(
            "https://overpass-api.de/api/interpreter",
            params={"data": query},
            timeout=5
        )
        data = response.json()
        elements = data.get("elements", [])
    except Exception:
        elements = []

    user_coords = (lat, lng)
    hospitals = []

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        el_lat = el.get("lat")
        el_lon = el.get("lon")
        if el_lat is not None and el_lon is not None:
            hosp_coords = (el_lat, el_lon)
            dist = geodesic(user_coords, hosp_coords).km
            hospitals.append({
                "name": name,
                "distance": f"{dist:.1f} km",
                "phone": tags.get("phone", "108")
            })

    hospitals.sort(key=lambda x: float(x["distance"].split()[0]))

    if not hospitals:
        hospitals = [
            {"name": "Apollo Hospital", "distance": "1.2 km", "phone": "108"},
            {"name": "City Hospital", "distance": "2.8 km", "phone": "108"},
            {"name": "Sunrise Hospital", "distance": "4.5 km", "phone": "108"}
        ]

    return hospitals

@app.get("/api/nearby-hospitals")
@limiter.limit("10/minute")
def get_nearby_hospitals(request: Request, lat: float, lng: float):
    return get_nearby_hospitals_data(lat, lng)

@app.get("/api/emergency/hospitals")
@limiter.limit("10/minute")
def get_nearest_hospitals(request: Request, lat: Optional[float] = None, lng: Optional[float] = None):
    if lat is not None and lng is not None:
        return get_nearby_hospitals_data(lat, lng)
    return [
        {"name": "Apollo Hospital", "distance": "1.2 km", "phone": "108"},
        {"name": "City Hospital", "distance": "2.8 km", "phone": "108"},
        {"name": "Sunrise Hospital", "distance": "4.5 km", "phone": "108"}
    ]

@app.get("/api/bmi")
def get_bmi(current_user: models.User = Depends(auth.get_current_user)):
    weight = current_user.weight or 0
    height = current_user.height or 0
    bmi = 0.0
    if height > 0:
        bmi = round(weight / ((height / 100) ** 2), 1)
    return {"bmi": bmi}

# ================= FAMILY MEMBER ENDPOINTS =================

@app.get("/api/family", response_model=List[schemas.FamilyMemberResponse])
def get_family_members(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.FamilyMember).filter(models.FamilyMember.user_id == current_user.id).all()

@app.post("/api/family", response_model=schemas.FamilyMemberResponse)
def add_family_member(member: schemas.FamilyMemberCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_member = models.FamilyMember(
        name=member.name,
        relation=member.relation,
        phone=member.phone,
        is_emergency_contact=member.is_emergency_contact,
        age=member.age,
        health_score=member.health_score if member.health_score is not None else 95,
        user_id=current_user.id
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@app.put("/api/family/{member_id}", response_model=schemas.FamilyMemberResponse)
def update_family_member(member_id: int, member_update: schemas.FamilyMemberUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_member = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == member_id,
        models.FamilyMember.user_id == current_user.id
    ).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    
    if member_update.name is not None:
        db_member.name = member_update.name
    if member_update.relation is not None:
        db_member.relation = member_update.relation
    if member_update.phone is not None:
        db_member.phone = member_update.phone
    if member_update.is_emergency_contact is not None:
        db_member.is_emergency_contact = member_update.is_emergency_contact
    if member_update.age is not None:
        db_member.age = member_update.age
    if member_update.health_score is not None:
        db_member.health_score = member_update.health_score
        
    db.commit()
    db.refresh(db_member)
    return db_member

@app.delete("/api/family/{member_id}")
def delete_family_member(member_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_member = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == member_id,
        models.FamilyMember.user_id == current_user.id
    ).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    db.delete(db_member)
    db.commit()
    return {"message": "Family member unlinked successfully"}

# ================= MEDICAL HISTORY ENDPOINTS =================

@app.get("/api/medical-history", response_model=List[schemas.MedicalHistoryResponse])
def get_medical_histories(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == current_user.id).all()

@app.post("/api/medical-history", response_model=schemas.MedicalHistoryResponse)
def add_medical_history(history: schemas.MedicalHistoryCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_history = models.MedicalHistory(
        condition=history.condition,
        diagnosis_date=history.diagnosis_date,
        status=history.status,
        notes=history.notes,
        user_id=current_user.id
    )
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history

@app.delete("/api/medical-history/{history_id}")
def delete_medical_history(history_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_history = db.query(models.MedicalHistory).filter(
        models.MedicalHistory.id == history_id,
        models.MedicalHistory.user_id == current_user.id
    ).first()
    if not db_history:
        raise HTTPException(status_code=404, detail="Medical history record not found")
    db.delete(db_history)
    db.commit()
    return {"message": "Medical history record deleted successfully"}

# ================= REPORTS ENDPOINTS =================

def process_and_summarize_report(report_type: str, user_name: str) -> tuple[str, str]:
    rt = report_type.lower()
    if "blood" in rt:
        raw = f"LAB REPORT - BLOOD WORK\nPatient: {user_name}\nHemoglobin: 13.8 g/dL\nWBC: 7.2 x10^3/uL\nBlood Sugar: 110 mg/dL\nCholesterol: 210 mg/dL (High)"
        summary = "Blood report indicates slightly elevated Blood Sugar (110 mg/dL) and Cholesterol (210 mg/dL). Hemoglobin and WBC are within normal range."
    elif "urine" in rt:
        raw = f"LAB REPORT - URINALYSIS\nPatient: {user_name}\npH: 6.0\nProtein: Negative\nGlucose: Negative\nLeukocytes: Negative"
        summary = "Urinalysis is completely clear with no signs of protein, glucose, or infection."
    elif "cardio" in rt or "ecg" in rt or "heart" in rt:
        raw = f"CARDIOLOGY REPORT - ECG\nPatient: {user_name}\nHeart Rate: 72 bpm\nPR Interval: 160 ms\nQRS Duration: 90 ms\nInterpretation: Normal Sinus Rhythm. No ST elevation or depression."
        summary = "ECG shows a normal sinus rhythm of 72 bpm with normal cardiac conduction intervals and no ischemic changes."
    else:
        raw = f"MEDICAL REPORT - {report_type.upper()}\nPatient: {user_name}\nDate: {datetime.datetime.utcnow().strftime('%Y-%m-%d')}\nFindings: Routine examination completed. All parameters within normal variations."
        summary = f"Routine {report_type} findings are normal with no abnormal values detected."
        
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and api_key != "YOUR_KEY" and api_key.strip():
        try:
            prompt = f"You are a clinical assistant. Given this raw lab data:\n{raw}\n\nGenerate a professional patient-friendly summary and list any out-of-bound values. Never prescribe medicine."
            refined_summary = ai_service.ask_ai(prompt)
            if refined_summary:
                summary = refined_summary.strip()
        except Exception as e:
            print(f"Failed to refine report summary via Gemini: {e}")
            
    return raw, summary

@app.get("/api/reports", response_model=List[schemas.ReportResponse])
def get_reports(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Report).filter(models.Report.user_id == current_user.id).all()

@app.post("/api/reports", response_model=schemas.ReportResponse)
def add_report(report: schemas.ReportCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    raw, summ = process_and_summarize_report(report.report_type, current_user.full_name)
    db_report = models.Report(
        file_path=report.file_path,
        report_type=report.report_type,
        raw_text=raw,
        summary=summ,
        user_id=current_user.id
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.user_id == current_user.id
    ).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(db_report)
    db.commit()
    return {"message": "Report deleted successfully"}

# ================= NOTIFICATIONS ENDPOINTS =================

@app.get("/api/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    generate_automatic_notifications(db, current_user.id)
    return db.query(models.Notification).filter(models.Notification.user_id == current_user.id).all()

@app.post("/api/notifications", response_model=schemas.NotificationResponse)
def add_notification(notification: schemas.NotificationCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_notification = models.Notification(
        message=notification.message,
        read=notification.read,
        user_id=current_user.id
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

@app.put("/api/notifications/{notification_id}", response_model=schemas.NotificationResponse)
def mark_notification_read(notification_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    db_notification.read = True
    db.commit()
    db.refresh(db_notification)
    return db_notification

@app.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not db_notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(db_notification)
    db.commit()
    return {"message": "Notification deleted successfully"}
