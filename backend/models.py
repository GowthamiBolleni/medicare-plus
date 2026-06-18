from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, JSON
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    profile_image = Column(String, default="")
    health_score = Column(Integer, default=0)
    weight = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(String, default="")
    last_sos_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    medicines = relationship("Medicine", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="user", cascade="all, delete-orphan")
    health_metrics = relationship("HealthMetric", back_populates="user", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    family = relationship("FamilyMember", back_populates="user", cascade="all, delete-orphan")
    medical_history = relationship("MedicalHistory", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    sos_logs = relationship("SOSLog", back_populates="user", cascade="all, delete-orphan")
    medical_reports = relationship("MedicalReport", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("ReportAnalysis", back_populates="user", cascade="all, delete-orphan")

class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    dosage = Column(String, nullable=False) # e.g., "1 Tablet", "1 Capsule"
    instructions = Column(String, nullable=True) # e.g., "After Food", "Before Food"
    time = Column(String, nullable=False) # e.g., "08:00 AM"
    category = Column(String, default="Tablet") # Tablet, Capsule, Syrup, etc.
    status = Column(String, default="Upcoming") # Taken, Upcoming, Missed
    frequency = Column(String, default="Everyday") # Everyday, Alternate Days, Specific days list
    last_status_date = Column(Date, default=datetime.date.today)
    date_scheduled = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="medicines")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    hospital = Column(String, nullable=False) # e.g., "Apollo Hospital"
    doctor = Column(String, nullable=False) # e.g., "Dr. Sharma"
    specialty = Column(String, nullable=True) # e.g., "Cardiologist"
    date = Column(DateTime, nullable=False)
    time = Column(String, nullable=False)
    status = Column(String, default="Upcoming") # Upcoming, Completed
    description = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="appointments")

class HealthMetric(Base):
    __tablename__ = "health_metrics"

    id = Column(Integer, primary_key=True, index=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    heart_rate = Column(Integer, nullable=True)
    blood_sugar = Column(Integer, nullable=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="health_metrics")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    hospital = Column(String, nullable=False) # e.g., "Apollo Hospital"
    description = Column(String, nullable=True) # e.g., "Consultation"
    amount = Column(Float, nullable=False)
    date = Column(DateTime, nullable=False)
    file_path = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    confidence = Column(Integer, default=95, nullable=True)
    bill_file = Column(String, nullable=True)
    category = Column(String, default="Consultation")

    user = relationship("User", back_populates="expenses")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String, nullable=False) # "user" or "ai"
    content = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="messages")

class FamilyMember(Base):
    __tablename__ = "family"

    id = Column(Integer, primary_key=True)
    name = Column(String, index=True)
    relation = Column(String)
    phone = Column(String)
    is_emergency_contact = Column(Boolean, default=False)
    age = Column(Integer, nullable=True)
    health_score = Column(Integer, default=95)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="family")

class MedicalHistory(Base):
    __tablename__ = "medical_history"

    id = Column(Integer, primary_key=True)
    condition = Column(String)
    diagnosis_date = Column(Date)
    status = Column(String)
    notes = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="medical_history")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True)
    file_path = Column(String)
    report_type = Column(String, index=True)
    raw_text = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="reports")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    message = Column(String)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
    notification_type = Column(String, default="general")

    user = relationship("User", back_populates="notifications")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String)  # "user" or "ai"
    message = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chat_history")

class SOSLog(Base):
    __tablename__ = "sos_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String, nullable=False)
    sent_to = Column(String, nullable=False)
    status = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sos_logs")

class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    analysis_status = Column(String, default="Pending") # Pending, Completed, Failed

    user = relationship("User", back_populates="medical_reports")
    analysis = relationship("ReportAnalysis", back_populates="report", uselist=False, cascade="all, delete-orphan")

class ReportAnalysis(Base):
    __tablename__ = "report_analysis"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("medical_reports.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    summary = Column(String, nullable=True)
    abnormal_findings = Column(JSON, nullable=True)
    normal_findings = Column(JSON, nullable=True)
    recommendations = Column(JSON, nullable=True)
    health_score_impact = Column(Integer, default=0)
    gemini_response = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="analyses")
    report = relationship("MedicalReport", back_populates="analysis")
