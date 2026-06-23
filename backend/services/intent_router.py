import os
import json
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import services.ai as ai_service
from services import rag_service

INTENTS = [
    "PROFILE_QUERY", "BMI_QUERY", "MEDICINE_QUERY", "MEDICINE_SCHEDULE_QUERY",
    "MISSED_MEDICINE_QUERY", "APPOINTMENT_QUERY", "REPORT_QUERY", "REPORT_COMPARISON_QUERY",
    "EXPENSE_QUERY", "EMERGENCY_QUERY", "HEALTH_SUMMARY_QUERY", "HEALTH_RECOMMENDATION_QUERY",
    "HEALTH_SCORE_QUERY", "GENERAL_MEDICAL_QUERY", "GENERAL_CHAT"
]

def classify_intent(message: str) -> str:
    """Classify the user message into one of the standard routing intents."""
    prompt = f"""
You are the intent router for the MediCare+ healthcare app.
Classify the user's query into EXACTLY one of the following intents:
PROFILE_QUERY (asking about their age, gender, name, weight, height, profile details)
BMI_QUERY (asking about BMI, height, weight calculation, obesity status, how to calculate BMI)
MEDICINE_QUERY (asking what medicines they take, dosage, instructions, names)
MEDICINE_SCHEDULE_QUERY (asking when to take medicine, frequency, scheduled times, times of doses)
MISSED_MEDICINE_QUERY (asking about missed medicines, skipped doses)
APPOINTMENT_QUERY (asking about scheduled doctor appointments, specialty, dates)
REPORT_QUERY (asking about a specific report, lab values, ocr analysis, hemoglobin, vitamin D)
REPORT_COMPARISON_QUERY (asking to compare reports, trends over time, previous results)
EXPENSE_QUERY (asking about monthly spending, expenses, hospital costs)
EMERGENCY_QUERY (asking about emergency contacts, SOS, triggering alerts)
HEALTH_SUMMARY_QUERY (asking about overall health status, dashboard analytics summary)
HEALTH_RECOMMENDATION_QUERY (asking for health advice, lifestyle changes, tips)
HEALTH_SCORE_QUERY (asking about health score, point deductions, current score)
GENERAL_MEDICAL_QUERY (asking general clinical questions not specific to their profile/reports)
GENERAL_CHAT (greeting, casual conversational remarks, thanking, saying bye)

Output ONLY the intent name in caps, with no other text, punctuation, or whitespace.

User Query: "{message}"
"""
    try:
        raw_intent = ai_service.ask_ai(prompt).strip().upper()
        # Clean potential formatting wrapper
        # Sort INTENTS by length descending to match longer, more specific intents first
        for intent in sorted(INTENTS, key=len, reverse=True):
            if intent in raw_intent:
                return intent
    except Exception as e:
        print(f"[Intent Router] Gemini classification failed: {e}")
    return "GENERAL_CHAT"

# ----------------- INTENT CONTEXT HANDLERS -----------------

def handle_profile_query(db: Session, user: models.User) -> dict:
    bmi = None
    if user.height and user.weight:
        h_m = user.height / 100
        bmi = round(user.weight / (h_m * h_m), 1)
        
    return {
        "full_name": user.full_name,
        "age": user.age,
        "gender": user.gender,
        "height_cm": user.height,
        "weight_kg": user.weight,
        "bmi": bmi,
        "phone": user.phone,
        "health_score": user.health_score
    }

def handle_bmi_query(db: Session, user: models.User) -> dict:
    profile = handle_profile_query(db, user)
    bmi = profile.get("bmi")
    category = "Unknown"
    if bmi:
        if bmi < 18.5: category = "Underweight"
        elif bmi < 25.0: category = "Normal weight"
        elif bmi < 30.0: category = "Overweight"
        else: category = "Obese"
    return {
        "height_cm": user.height,
        "weight_kg": user.weight,
        "bmi": bmi,
        "category": category,
        "advice": "Keep your BMI between 18.5 and 24.9 for healthy status."
    }

def handle_medicine_query(db: Session, user: models.User) -> dict:
    meds = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).all()
    logs = db.query(models.MedicineLog).filter(models.MedicineLog.user_id == user.id).all()
    taken_logs = [l for l in logs if l.status == "Taken"]
    missed_logs = [l for l in logs if l.status == "Missed"]
    
    return {
        "medicines": [
            {
                "name": m.name, "dosage": m.dosage, "instructions": m.instructions, 
                "category": m.category, "status": m.status, "frequency": m.frequency
            } for m in meds
        ],
        "adherence_statistics": {
            "adherence_score": user.adherence_score,
            "medicine_compliance_percentage": user.medicine_compliance_percentage,
            "total_logged_doses": len(logs),
            "taken_doses": len(taken_logs),
            "missed_doses": len(missed_logs)
        }
    }

def handle_medicine_schedule_query(db: Session, user: models.User) -> dict:
    meds = db.query(models.Medicine).filter(models.Medicine.user_id == user.id).all()
    schedule = {}
    for m in meds:
        schedule.setdefault(m.time, []).append({
            "name": m.name, "dosage": m.dosage, "instructions": m.instructions
        })
    return {"schedule": schedule}

def handle_missed_medicine_query(db: Session, user: models.User) -> dict:
    missed_logs = db.query(models.MedicineLog).filter(
        models.MedicineLog.user_id == user.id,
        models.MedicineLog.status == "Missed"
    ).all()
    return {
        "missed_count": len(missed_logs),
        "missed_medicines": [
            {
                "name": l.medicine.name if l.medicine else "Medicine",
                "dosage": l.medicine.dosage if l.medicine else "",
                "scheduled_time": str(l.scheduled_time),
                "status": "Missed"
            }
            for l in missed_logs
        ]
    }

def handle_appointment_query(db: Session, user: models.User) -> dict:
    apps = db.query(models.Appointment).filter(models.Appointment.user_id == user.id).all()
    return {
        "appointments": [
            {
                "hospital": a.hospital, "doctor": a.doctor, "specialty": a.specialty,
                "date": str(a.date), "time": a.time, "status": a.status
            } for a in apps
        ]
    }

def handle_report_query(db: Session, user: models.User, query: str) -> dict:
    # Use RAG to fetch relevant chunks
    chunks = rag_service.retrieve_relevant_chunks(db, user.id, query, top_k=4)
    # Also fetch metadata of completed reports
    reports = db.query(models.MedicalReport).filter(
        models.MedicalReport.user_id == user.id,
        models.MedicalReport.analysis_status == "Completed"
    ).all()
    return {
        "relevant_chunks": [c["chunk_text"] for c in chunks],
        "completed_reports": [
            {
                "id": r.id, "file_name": r.file_name, "uploaded_at": str(r.uploaded_at),
                "patient": r.analysis.patient_name if r.analysis else None,
                "date": r.analysis.report_date if r.analysis else None
            } for r in reports
        ]
    }

def handle_report_comparison_query(db: Session, user: models.User) -> dict:
    # Fetch comparison timeline
    reports = db.query(models.MedicalReport).filter(
        models.MedicalReport.user_id == user.id,
        models.MedicalReport.analysis_status == "Completed"
    ).all()
    
    analyzed = [r.analysis for r in reports if r.analysis]
    # Simple parse dates for sorting
    def get_date_key(analysis):
        try:
            return datetime.datetime.strptime(analysis.report_date, "%d-%b-%Y")
        except Exception:
            return analysis.created_at or datetime.datetime.now()
            
    analyzed.sort(key=get_date_key)
    
    timeline = []
    for a in analyzed:
        timeline.append({
            "date": a.report_date,
            "patient": a.patient_name,
            "category": a.report_category,
            "risk_score": a.risk_score,
            "risk_level": a.risk_level,
            "score_impact": a.health_score_impact
        })
    return {"comparison_timeline": timeline}

def handle_expense_query(db: Session, user: models.User) -> dict:
    exps = db.query(models.Expense).filter(models.Expense.user_id == user.id).all()
    total = sum(e.amount for e in exps)
    cats = {}
    for e in exps:
        cats[e.category] = cats.get(e.category, 0.0) + e.amount
    return {
        "total_spending": total,
        "expenses_by_category": cats,
        "recent_expenses": [
            {"hospital": e.hospital, "category": e.category, "amount": e.amount, "date": str(e.date)}
            for e in exps[-5:]
        ]
    }

def handle_emergency_query(db: Session, user: models.User) -> dict:
    family = db.query(models.FamilyMember).filter(
        models.FamilyMember.user_id == user.id,
        models.FamilyMember.is_emergency_contact == True
    ).all()
    sos_logs = db.query(models.SOSLog).filter(models.SOSLog.user_id == user.id).all()
    return {
        "emergency_contacts": [{"name": f.name, "relation": f.relation, "phone": f.phone} for f in family],
        "sos_logs_count": len(sos_logs),
        "last_sos_time": str(user.last_sos_time) if user.last_sos_time else None
    }

def handle_health_summary_query(db: Session, user: models.User) -> dict:
    adherence = user.adherence_score if user.adherence_score is not None else 100.0
    
    apps = handle_appointment_query(db, user).get("appointments", [])
    apps_done = len([a for a in apps if a["status"] == "Completed"])
    apps_total = len(apps)
    compliance = round((apps_done / apps_total * 100), 1) if apps_total else 100.0
    
    history = db.query(models.MedicalHistory).filter(models.MedicalHistory.user_id == user.id).all()
    
    # Also fetch today's medication log count, taken, upcoming, missed
    local_today = datetime.datetime.now().date()
    start_of_today = datetime.datetime.combine(local_today, datetime.time.min)
    end_of_today = datetime.datetime.combine(local_today, datetime.time.max)
    today_logs = db.query(models.MedicineLog).filter(
        models.MedicineLog.user_id == user.id,
        models.MedicineLog.scheduled_time >= start_of_today,
        models.MedicineLog.scheduled_time <= end_of_today
    ).all()
    
    today_taken = len([l for l in today_logs if l.status == "Taken"])
    today_missed = len([l for l in today_logs if l.status == "Missed"])
    today_upcoming = len([l for l in today_logs if l.status in ("Upcoming", "Snoozed")])
    
    return {
        "health_score": user.health_score,
        "medicine_adherence_percent": adherence,
        "medicine_compliance_percentage": user.medicine_compliance_percentage if user.medicine_compliance_percentage is not None else 100.0,
        "today_medicines_summary": {
            "total": len(today_logs),
            "taken": today_taken,
            "missed": today_missed,
            "upcoming": today_upcoming
        },
        "appointment_compliance_percent": compliance,
        "active_medical_conditions": [h.condition for h in history if h.status == "Active"]
    }

def handle_health_recommendation_query(db: Session, user: models.User) -> dict:
    summary = handle_health_summary_query(db, user)
    # Gather reports recommendations
    reports = db.query(models.MedicalReport).filter(
        models.MedicalReport.user_id == user.id,
        models.MedicalReport.analysis_status == "Completed"
    ).all()
    all_recs = []
    for r in reports:
        if r.analysis and r.analysis.recommendations:
            # handle list or string
            recs = r.analysis.recommendations
            if isinstance(recs, str):
                try:
                    recs = json.loads(recs)
                except Exception:
                    recs = [recs]
            all_recs.extend(recs)
            
    return {
        "health_score": user.health_score,
        "conditions": summary.get("active_medical_conditions", []),
        "extracted_recommendations": list(set(all_recs))[:6]
    }

def handle_health_score_query(db: Session, user: models.User) -> dict:
    # Get report impacts
    reports = db.query(models.MedicalReport).filter(
        models.MedicalReport.user_id == user.id,
        models.MedicalReport.analysis_status == "Completed"
    ).all()
    deductions = {}
    for r in reports:
        if r.analysis and r.analysis.health_score_impact_breakdown:
            breakdown = r.analysis.health_score_impact_breakdown
            if isinstance(breakdown, str):
                try:
                    breakdown = json.loads(breakdown)
                except Exception:
                    breakdown = {}
            if isinstance(breakdown, dict):
                deductions.update(breakdown)
                
    return {
        "current_score": user.health_score,
        "deductions_breakdown": deductions
    }

# ----------------- CONTEXT BUILDER -----------------

def get_intent_context(db: Session, user: models.User, intent: str, query: str) -> str:
    """Invokes the specific context handler and compiles a structured JSON context string."""
    context_data = {"intent": intent, "timestamp": datetime.datetime.now().isoformat()}
    
    if intent == "PROFILE_QUERY":
        context_data["profile"] = handle_profile_query(db, user)
    elif intent == "BMI_QUERY":
        context_data["bmi_details"] = handle_bmi_query(db, user)
    elif intent == "MEDICINE_QUERY":
        context_data["medicine_details"] = handle_medicine_query(db, user)
    elif intent == "MEDICINE_SCHEDULE_QUERY":
        context_data["schedule_details"] = handle_medicine_schedule_query(db, user)
    elif intent == "MISSED_MEDICINE_QUERY":
        context_data["missed_details"] = handle_missed_medicine_query(db, user)
    elif intent == "APPOINTMENT_QUERY":
        context_data["appointment_details"] = handle_appointment_query(db, user)
    elif intent == "REPORT_QUERY":
        context_data["report_details"] = handle_report_query(db, user, query)
    elif intent == "REPORT_COMPARISON_QUERY":
        context_data["comparison_details"] = handle_report_comparison_query(db, user)
    elif intent == "EXPENSE_QUERY":
        context_data["expense_details"] = handle_expense_query(db, user)
    elif intent == "EMERGENCY_QUERY":
        context_data["emergency_details"] = handle_emergency_query(db, user)
    elif intent == "HEALTH_SUMMARY_QUERY":
        context_data["health_summary"] = handle_health_summary_query(db, user)
    elif intent == "HEALTH_RECOMMENDATION_QUERY":
        context_data["recommendation_details"] = handle_health_recommendation_query(db, user)
    elif intent == "HEALTH_SCORE_QUERY":
        context_data["health_score_details"] = handle_health_score_query(db, user)
    else:
        # GENERAL_CHAT or GENERAL_MEDICAL_QUERY
        # Return generic basic profile to keep general chat somewhat aware
        context_data["basic_profile"] = {
            "name": user.full_name,
            "age": user.age,
            "gender": user.gender,
            "health_score": user.health_score
        }
        
    return json.dumps(context_data, indent=2)
