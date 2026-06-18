from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
import datetime

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = ""

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None

class UserResponse(UserBase):
    id: int
    health_score: int
    profile_image: str
    bmi: Optional[float] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Medicine schemas
class MedicineBase(BaseModel):
    name: str
    dosage: str
    instructions: Optional[str] = "After Food"
    time: str
    category: Optional[str] = "Tablet"
    status: Optional[str] = "Upcoming"
    frequency: Optional[str] = "Everyday"
    last_status_date: Optional[datetime.date] = None

class MedicineCreate(MedicineBase):
    pass

class MedicineUpdate(BaseModel):
    status: Optional[str] = None
    name: Optional[str] = None
    dosage: Optional[str] = None
    instructions: Optional[str] = None
    time: Optional[str] = None
    frequency: Optional[str] = None

class MedicineResponse(MedicineBase):
    id: int
    user_id: int
    date_scheduled: datetime.datetime

    class Config:
        from_attributes = True

# Appointment schemas
class AppointmentBase(BaseModel):
    hospital: str
    doctor: str
    specialty: Optional[str] = None
    date: Any
    time: str
    status: Optional[str] = "Upcoming"
    description: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    hospital: Optional[str] = None
    doctor: Optional[str] = None
    specialty: Optional[str] = None
    date: Optional[Any] = None
    time: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None

class AppointmentResponse(AppointmentBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# HealthMetric schemas
class HealthMetricBase(BaseModel):
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    blood_sugar: Optional[int] = None

class HealthMetricCreate(HealthMetricBase):
    pass

class HealthMetricResponse(HealthMetricBase):
    id: int
    date: datetime.datetime
    user_id: int

    class Config:
        from_attributes = True

# Expense schemas
class ExpenseBase(BaseModel):
    hospital: str
    description: Optional[str] = "Consultation"
    amount: float
    date: datetime.datetime
    file_path: Optional[str] = None
    confidence: Optional[int] = 95
    bill_file: Optional[str] = None
    category: Optional[str] = "Consultation"

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseResponse(ExpenseBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Message schemas
class MessageBase(BaseModel):
    sender: Optional[str] = "user" # "user" or "ai"
    content: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    timestamp: datetime.datetime
    user_id: int

    class Config:
        from_attributes = True

# FamilyMember schemas
class FamilyMemberBase(BaseModel):
    name: str
    relation: str
    phone: str
    is_emergency_contact: bool = False
    age: Optional[int] = None
    health_score: Optional[int] = 95

class FamilyMemberCreate(FamilyMemberBase):
    pass

class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    phone: Optional[str] = None
    is_emergency_contact: Optional[bool] = None
    age: Optional[int] = None
    health_score: Optional[int] = None

class FamilyMemberResponse(FamilyMemberBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# MedicalHistory schemas
class MedicalHistoryBase(BaseModel):
    condition: str
    diagnosis_date: datetime.date
    status: str
    notes: Optional[str] = None

class MedicalHistoryCreate(MedicalHistoryBase):
    pass

class MedicalHistoryResponse(MedicalHistoryBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Report schemas
class ReportBase(BaseModel):
    file_path: str
    report_type: str
    raw_text: Optional[str] = None
    summary: Optional[str] = None

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: int
    created_at: datetime.datetime
    user_id: int

    class Config:
        from_attributes = True

# Notification schemas
class NotificationBase(BaseModel):
    message: str
    read: Optional[bool] = False
    created_at: Optional[datetime.datetime] = None
    notification_type: Optional[str] = "general"

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Dashboard summary sub-schemas
class HealthScoreTrend(BaseModel):
    this_week: int
    last_week: int
    change: int
    text: str

class ExpenseCategorySum(BaseModel):
    category: str
    amount: float

# Dashboard summary schema
class DashboardSummary(BaseModel):
    health_score: int
    medicines_to_take: int
    appointments_today: int
    monthly_expenses: float
    medicines: int
    appointments: int
    expenses: float
    today_medicines: List[MedicineResponse]
    upcoming_appointment: Optional[AppointmentResponse] = None
    recent_alerts: List[str]
    recent_metrics: List[HealthMetricResponse] = []
    all_expenses: List[ExpenseResponse] = []
    health_score_status: str
    health_score_trend: HealthScoreTrend
    category_expenses: List[ExpenseCategorySum] = []
    family_contacts_count: int
    medical_conditions_count: int

# SOS schemas
class SOSRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
