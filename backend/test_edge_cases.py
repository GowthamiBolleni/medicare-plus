import os
import sys
from unittest.mock import MagicMock

# Mock sentence_transformers to avoid protobuf version conflicts with tensorflow
sys.modules['sentence_transformers'] = MagicMock()

import unittest
import datetime
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment
os.environ["ENV"] = "test"

import models
import schemas
import auth
import database
from database import Base
from main import app, get_db, check_medicine_reminders_job
import services.ai as ai_service

# Setup in-memory sqlite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

class TestMedicareEdgeCases(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[database.get_db] = override_get_db

        Base.metadata.create_all(bind=engine)
        self.client = TestClient(app)
        self.db = TestingSessionLocal()

        # Mock sentence transformer & Gemini AI
        import numpy as np
        self.patcher_trans = patch('sentence_transformers.SentenceTransformer')
        self.mock_trans = self.patcher_trans.start()
        mock_model = MagicMock()
        mock_model.encode.return_value = np.zeros((1, 384), dtype='float32')
        self.mock_trans.return_value = mock_model

        self.patcher_ai = patch('services.ai.ask_ai')
        self.mock_ai = self.patcher_ai.start()
        self.mock_ai.return_value = "GENERAL_CHAT"

        # Mock FCM service
        self.patcher_fcm = patch('services.fcm_service.send_multicast_fcm_notification')
        self.mock_fcm = self.patcher_fcm.start()
        self.mock_fcm.return_value = True

        # Create a test user
        self.hashed_pw = auth.get_password_hash("TestPass123!")
        self.user = models.User(
            id=1,
            username="edgeuser",
            email="edgeuser@example.com",
            hashed_password=self.hashed_pw,
            full_name="Edge User",
            age=25,
            gender="Female",
            phone="+919999988888",
            health_score=85
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        # Add a mock HealthMetric to allow health score calculations
        self.metric = models.HealthMetric(
            user_id=self.user.id,
            systolic_bp=120,
            diastolic_bp=80,
            heart_rate=72,
            blood_sugar=100
        )
        self.db.add(self.metric)
        self.db.commit()

        self.token = auth.create_access_token(data={"sub": "edgeuser"})
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.patcher_trans.stop()
        self.patcher_ai.stop()
        self.patcher_fcm.stop()
        self.db.close()
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.clear()

    # ================= 1. MEDICINE SNOOZE LIMIT EDGE CASE =================
    def test_medicine_snooze_limit(self):
        med = models.Medicine(
            id=10, user_id=self.user.id, name="Med A", dosage="1 Tab", time="08:00 AM", category="Tablet"
        )
        log = models.MedicineLog(
            user_id=self.user.id, medicine_id=10, scheduled_time=datetime.datetime.now(), status="Upcoming", snooze_count=0
        )
        self.db.add_all([med, log])
        self.db.commit()

        # Snooze 3 times (succeeds)
        for i in range(1, 4):
            response = self.client.post(f"/api/medicines/logs/{log.id}/snooze", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["snooze_count"], i)

        # 4th snooze fails
        response = self.client.post(f"/api/medicines/logs/{log.id}/snooze", headers=self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Maximum snooze limit", response.json()["detail"])

    # ================= 2. MEDICINE CATCH-UP DOWNTIME EDGE CASE =================
    def test_missed_reminder_backlog_processing(self):
        med = models.Medicine(
            id=11, user_id=self.user.id, name="Med B", dosage="1 Tab", time="09:00 AM", category="Tablet"
        )
        # Log scheduled 5 hours ago, still "Upcoming" (downtime catch-up simulation)
        past_time = datetime.datetime.now() - datetime.timedelta(hours=5)
        log = models.MedicineLog(
            user_id=self.user.id, medicine_id=11, scheduled_time=past_time, status="Upcoming", snooze_count=0
        )
        self.db.add_all([med, log])
        self.db.commit()
        log_id = log.id

        # Run scheduler checking job to trigger missed detection
        with patch('main.Session', return_value=self.db), \
             patch('main.engine', engine):
            check_medicine_reminders_job()

        # Verify it caught up and marked it as Missed
        log_db = self.db.query(models.MedicineLog).filter(models.MedicineLog.id == log_id).first()
        self.assertEqual(log_db.status, "Missed")

        # Verify a warning was generated in notification history
        notif = self.db.query(models.NotificationHistory).filter(
            models.NotificationHistory.user_id == self.user.id,
            models.NotificationHistory.title == "⚠ Missed Medication"
        ).first()
        self.assertIsNotNone(notif)

    # ================= 3. HEALTH SCORE FLOOR CAP EDGE CASE =================
    def test_health_score_floor_cap(self):
        # Set user health score to 1
        self.user.health_score = 1
        self.db.commit()
        user_id = self.user.id

        med = models.Medicine(
            id=12, user_id=self.user.id, name="Med C", dosage="1 Tab", time="09:00 AM", category="Tablet"
        )
        self.db.add(med)
        
        # Log 45 missed medicines (penalty should be -90 points, so health score should cap at 0)
        for i in range(45):
            past_time = datetime.datetime.now() - datetime.timedelta(minutes=31 + i)
            log = models.MedicineLog(
                user_id=self.user.id, medicine_id=12, scheduled_time=past_time, status="Upcoming", snooze_count=0
            )
            self.db.add(log)
        self.db.commit()

        # Run scheduler
        with patch('main.Session', return_value=self.db), \
             patch('main.engine', engine):
            check_medicine_reminders_job()

        # Verify user score is 0, not negative
        user_db = self.db.query(models.User).filter(models.User.id == user_id).first()
        self.assertEqual(user_db.health_score, 0)

    # ================= 4. SOS NO CONTACTS EDGE CASE =================
    def test_sos_no_emergency_contacts(self):
        # Ensure family members count is zero for this user
        self.db.query(models.FamilyMember).filter(models.FamilyMember.user_id == self.user.id).delete()
        self.db.commit()

        # Trigger SOS
        sos_payload = {"latitude": 12.9716, "longitude": 77.5946}
        response = self.client.post("/api/emergency/sos", json=sos_payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "TRIGGERED")
        
        # Verify contacts list contains fallback dispatcher warning
        contacts = response.json()["contacts"]
        self.assertEqual(len(contacts), 1)
        self.assertIn("Emergency Dispatcher", contacts[0])

    # ================= 5. SOS COOLDOWN PROTECTION EDGE CASE =================
    @patch('services.notification_service.send_emergency_sms')
    def test_sos_abuse_cooldown_rate_limit(self, mock_sms):
        mock_sms.return_value = True
        
        # Trigger SOS first time (succeeds)
        payload = {"latitude": 12.9716, "longitude": 77.5946}
        response = self.client.post("/api/emergency/sos", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)

        # Clear notifications to bypass 5-min notification cooldown and force the 2-min abuse protection check
        self.db.query(models.Notification).delete()
        self.db.commit()

        # Trigger SOS second time immediately (should return 429 cooldown active)
        response2 = self.client.post("/api/emergency/sos", json=payload, headers=self.headers)
        self.assertEqual(response2.status_code, 429)
        self.assertIn("cooldown active", response2.json()["detail"])

    # ================= 6. APPOINTMENT DUPLICATE BOOKING EDGE CASE =================
    def test_appointment_duplicate_booking(self):
        date_str = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        payload = {
            "hospital": "City Hospital",
            "doctor": "Dr. Watson",
            "specialty": "General",
            "date": date_str,
            "time": "10:00 AM",
            "status": "Upcoming",
            "description": "Consultation"
        }
        # Book first time (succeeds)
        response = self.client.post("/api/appointments", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)

        # Book second time (fails with 400 due to duplicate detection)
        response2 = self.client.post("/api/appointments", json=payload, headers=self.headers)
        self.assertEqual(response2.status_code, 400)
        self.assertIn("already have an appointment scheduled", response2.json()["detail"])

    # ================= 7. EXPENSE NEGATIVE AMOUNT EDGE CASE =================
    def test_expense_negative_amount(self):
        # Try logging an expense with a negative amount (should fail)
        payload = {
            "hospital": "City Lab",
            "description": "Blood Test",
            "amount": -50.0,
            "date": datetime.datetime.now().isoformat(),
            "confidence": 95,
            "category": "Consultation"
        }
        response = self.client.post("/api/expenses", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Amount must be positive", response.json()["detail"])

    # ================= 8. CORRUPTED/EMPTY REPORT UPLOAD EDGE CASE =================
    def test_report_empty_upload(self):
        # Uploading an empty file (0 bytes) should be rejected
        import io
        empty_file = io.BytesIO(b"")
        files = {"file": ("empty.pdf", empty_file, "application/pdf")}
        response = self.client.post("/api/reports/upload", files=files, headers=self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("File is empty", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
