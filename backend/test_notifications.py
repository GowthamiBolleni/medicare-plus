import os
import sys
from unittest.mock import MagicMock
# Mock sentence_transformers to avoid protobuf version conflicts with tensorflow
sys.modules['sentence_transformers'] = MagicMock()

import unittest
import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test environment
os.environ["ENV"] = "test"

import models
import schemas
import auth
import database
from database import Base
from main import app, get_db, check_medicine_reminders_job
from sqlalchemy.pool import StaticPool

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

class TestNotificationsSystem(unittest.TestCase):
    def setUp(self):
        # Register dependency overrides
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[database.get_db] = override_get_db

        # Create tables
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

        # Mock FCM service to avoid actual network calls
        self.patcher_fcm_single = patch('services.fcm_service.send_fcm_notification')
        self.mock_fcm_single = self.patcher_fcm_single.start()
        self.mock_fcm_single.return_value = True

        self.patcher_fcm_multi = patch('services.fcm_service.send_multicast_fcm_notification')
        self.mock_fcm_multi = self.patcher_fcm_multi.start()
        self.mock_fcm_multi.return_value = True

        # Create a test user
        self.hashed_pw = auth.get_password_hash("TestPass123!")
        self.user = models.User(
            id=1,
            username="testnotifuser",
            email="testnotifuser@example.com",
            hashed_password=self.hashed_pw,
            full_name="Notifications User",
            age=30,
            gender="Male",
            phone="+919999988888",
            health_score=85
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        # Add a mock HealthMetric to ensure calculate_health_score returns base score instead of 0
        self.metric = models.HealthMetric(
            user_id=self.user.id,
            systolic_bp=120,
            diastolic_bp=80,
            heart_rate=72,
            blood_sugar=100
        )
        self.db.add(self.metric)
        self.db.commit()

        self.token = auth.create_access_token(data={"sub": "testnotifuser"})
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.patcher_trans.stop()
        self.patcher_ai.stop()
        self.patcher_fcm_single.stop()
        self.patcher_fcm_multi.stop()
        self.db.close()
        Base.metadata.drop_all(bind=engine)
        app.dependency_overrides.clear()

    def test_register_device_token(self):
        payload = {
            "device_token": "fcm-token-12345",
            "device_name": "Chrome Desktop"
        }
        response = self.client.post("/api/notifications/device-token", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["device_token"], "fcm-token-12345")
        self.assertEqual(data["device_name"], "Chrome Desktop")

        # Verify in database
        tokens = self.db.query(models.DeviceToken).filter(models.DeviceToken.user_id == self.user.id).all()
        self.assertEqual(len(tokens), 1)
        self.assertEqual(tokens[0].device_token, "fcm-token-12345")

    def test_notification_preferences(self):
        # 1. Fetch initial preferences
        response = self.client.get("/api/notifications/preferences", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        prefs = response.json()
        self.assertTrue(prefs["medicine_reminders_enabled"])
        self.assertTrue(prefs["sos_enabled"])

        # 2. Update preferences
        update_payload = {
            "medicine_reminders_enabled": False,
            "sos_enabled": False
        }
        response = self.client.put("/api/notifications/preferences", json=update_payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        updated_prefs = response.json()
        self.assertFalse(updated_prefs["medicine_reminders_enabled"])
        self.assertFalse(updated_prefs["sos_enabled"])
        self.assertTrue(updated_prefs["push_notifications_enabled"]) # Unchanged default

    def test_notification_history_management(self):
        # Add some mock history items
        notif1 = models.NotificationHistory(
            user_id=self.user.id,
            title="Reminder 1",
            message="Take Aspirin",
            type="medicine",
            read=False
        )
        notif2 = models.NotificationHistory(
            user_id=self.user.id,
            title="Alert 2",
            message="SOS Broadcasted",
            type="sos",
            read=False
        )
        self.db.add_all([notif1, notif2])
        self.db.commit()

        # 1. Get history
        response = self.client.get("/api/notifications/history", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        history = response.json()
        self.assertEqual(len(history), 2)

        # 2. Mark one as read
        notif_id = history[0]["id"]
        response = self.client.put(f"/api/notifications/history/{notif_id}/read", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["read"])

        # 3. Delete one
        response = self.client.delete(f"/api/notifications/history/{notif_id}", headers=self.headers)
        self.assertEqual(response.status_code, 200)

        # Confirm length is 1
        response = self.client.get("/api/notifications/history", headers=self.headers)
        self.assertEqual(len(response.json()), 1)

        # 4. Clear all
        response = self.client.delete("/api/notifications/history/clear-all", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        response = self.client.get("/api/notifications/history", headers=self.headers)
        self.assertEqual(len(response.json()), 0)

    def test_send_test_notification_flow(self):
        # Try test send without a token
        response = self.client.post("/api/notifications/test", headers=self.headers)
        self.assertEqual(response.status_code, 400) # Should fail due to no tokens

        # Register a token
        self.client.post("/api/notifications/device-token", json={"device_token": "token-test"}, headers=self.headers)

        # Now send test notification
        response = self.client.post("/api/notifications/test", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.mock_fcm_single.assert_called_once()
        
        # Verify it created a history log
        history = self.db.query(models.NotificationHistory).filter(models.NotificationHistory.user_id == self.user.id).all()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].title, "🔔 Test Notification")

    @patch('services.notification_service.send_emergency_sms')
    def test_sos_twilio_sandbox_success_and_fcm(self, mock_sms):
        mock_sms.return_value = True
        
        # Register a device token for user
        self.client.post("/api/notifications/device-token", json={"device_token": "patient-token"}, headers=self.headers)

        # Set up an emergency contact (Family member)
        contact = models.FamilyMember(
            user_id=self.user.id,
            name="John Family",
            relation="Brother",
            phone="+919999988888", # Success mock number
            is_emergency_contact=True
        )
        self.db.add(contact)
        self.db.commit()

        # Trigger SOS
        sos_payload = {"latitude": 12.9716, "longitude": 77.5946}
        response = self.client.post("/api/emergency/sos", json=sos_payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        
        # Verify FCM Multicast was called
        self.mock_fcm_multi.assert_called_once()
        
        # Verify contact status tag shows Sent
        contacts_outcome = response.json()["contacts"]
        self.assertTrue(any("Sent" in c for c in contacts_outcome))

    @patch('services.notification_service.send_emergency_sms')
    def test_sos_twilio_sandbox_failure(self, mock_sms):
        mock_sms.return_value = True

        # Set up emergency contact with simulated sandbox fail number
        contact = models.FamilyMember(
            user_id=self.user.id,
            name="Alice Friend",
            relation="Friend",
            phone="+910000000000", # Fail sandbox mock number
            is_emergency_contact=True
        )
        self.db.add(contact)
        self.db.commit()

        # Trigger SOS
        sos_payload = {"latitude": 12.9716, "longitude": 77.5946}
        response = self.client.post("/api/emergency/sos", json=sos_payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        
        # Verify contact status displays sandbox warning message gracefully
        contacts_outcome = response.json()["contacts"]
        self.assertTrue(any("WhatsApp delivery unavailable. Contact has not joined Twilio Sandbox." in c for c in contacts_outcome))

    def test_medicine_reminder_trigger_scheduler(self):
        # Create a medicine scheduled for now
        now_local = datetime.datetime.now()
        time_str = now_local.strftime("%I:%M %p") # e.g. "09:30 AM"
        
        med = models.Medicine(
            user_id=self.user.id,
            name="Amoxicillin",
            dosage="500mg",
            time=time_str,
            category="Capsule",
            status="Upcoming",
            frequency="Everyday",
            last_status_date=now_local.date()
        )
        self.db.add(med)
        
        # Add default preferences
        prefs = models.NotificationPreferences(
            user_id=self.user.id,
            medicine_reminders_enabled=True,
            push_notifications_enabled=True
        )
        self.db.add(prefs)
        self.db.commit()

        # Mock context database connection within the scheduler
        with patch('main.Session', return_value=self.db), \
             patch('main.engine', engine):
            # Run scheduler reminders check
            check_medicine_reminders_job()

        # Verify log record created in database
        logs = self.db.query(models.MedicineLog).filter(models.MedicineLog.user_id == self.user.id).all()
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].status, "Upcoming")
        self.assertEqual(logs[0].snooze_count, 0)

        # Verify reminders written to history table
        history = self.db.query(models.NotificationHistory).filter(models.NotificationHistory.user_id == self.user.id).all()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].title, "💊 Medicine Reminder")
        self.assertIn("Amoxicillin", history[0].message)
        self.assertEqual(history[0].medicine_log_id, logs[0].id)

    def test_medicine_log_interactive_actions_and_stats(self):
        # 1. Create a medicine log to interact with
        now_local = datetime.datetime.now()
        med = models.Medicine(
            id=2, user_id=self.user.id, name="Vitamin D", dosage="1 Tablet", time="08:00 AM", category="Tablet"
        )
        log = models.MedicineLog(
            user_id=self.user.id, medicine_id=2, scheduled_time=now_local, status="Upcoming", snooze_count=0
        )
        self.db.add_all([med, log])
        self.db.commit()

        # 2. Take medicine via endpoint
        response = self.client.post(f"/api/medicines/logs/{log.id}/take", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "Taken")
        self.assertIsNotNone(data["taken_time"])

        # Verify stats updated in DB
        self.db.refresh(self.user)
        self.assertEqual(self.user.adherence_score, 100.0)

        # Verify confirmation notification created
        notifs = self.db.query(models.NotificationHistory).filter(
            models.NotificationHistory.user_id == self.user.id,
            models.NotificationHistory.title == "✅ Medicine Taken"
        ).all()
        self.assertEqual(len(notifs), 1)

        # 3. Create another log to snooze
        log2 = models.MedicineLog(
            user_id=self.user.id, medicine_id=2, scheduled_time=now_local, status="Upcoming", snooze_count=0
        )
        self.db.add(log2)
        self.db.commit()

        # Snooze log
        response = self.client.post(f"/api/medicines/logs/{log2.id}/snooze", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data2 = response.json()
        self.assertEqual(data2["status"], "Snoozed")
        self.assertEqual(data2["snooze_count"], 1)
        self.assertIsNotNone(data2["next_reminder_time"])

        # Snooze again
        response = self.client.post(f"/api/medicines/logs/{log2.id}/snooze", headers=self.headers)
        self.assertEqual(response.json()["snooze_count"], 2)

        # Snooze third time
        response = self.client.post(f"/api/medicines/logs/{log2.id}/snooze", headers=self.headers)
        self.assertEqual(response.json()["snooze_count"], 3)

        # Max snooze check (4th attempt should fail)
        response = self.client.post(f"/api/medicines/logs/{log2.id}/snooze", headers=self.headers)
        self.assertEqual(response.status_code, 400)

        # 4. Dismiss log
        log3 = models.MedicineLog(
            user_id=self.user.id, medicine_id=2, scheduled_time=now_local, status="Upcoming", snooze_count=0
        )
        self.db.add(log3)
        self.db.commit()

        response = self.client.post(f"/api/medicines/logs/{log3.id}/dismiss", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "Missed")

    def test_missed_medicine_grace_period_and_health_score(self):
        # Create a log that was scheduled 31 minutes ago
        past_time = datetime.datetime.now() - datetime.timedelta(minutes=31)
        med = models.Medicine(
            id=3, user_id=self.user.id, name="Metformin", dosage="1000mg", time="09:00 AM", category="Tablet"
        )
        log = models.MedicineLog(
            user_id=self.user.id, medicine_id=3, scheduled_time=past_time, status="Upcoming", snooze_count=0
        )
        self.db.add_all([med, log])
        self.db.commit()
        log_id = log.id
        user_id = self.user.id

        # Save initial health score
        initial_score = self.user.health_score

        # Run scheduler checking job to trigger missed detection
        with patch('main.Session', return_value=self.db), \
             patch('main.engine', engine):
            check_medicine_reminders_job()

        # Verify log status moved to Missed
        log = self.db.query(models.MedicineLog).filter(models.MedicineLog.id == log_id).first()
        self.assertEqual(log.status, "Missed")

        # Verify missed notification generated
        notifs = self.db.query(models.NotificationHistory).filter(
            models.NotificationHistory.user_id == user_id,
            models.NotificationHistory.title == "⚠ Missed Medication"
        ).all()
        self.assertEqual(len(notifs), 1)

        # Verify health score penalty applied (-2 points)
        user = self.db.query(models.User).filter(models.User.id == user_id).first()
        self.assertEqual(user.health_score, initial_score - 2)

    def test_ai_compliance_query_routing(self):
        from services.intent_router import classify_intent, get_intent_context
        # Create some logs to verify context
        med = models.Medicine(
            id=4, user_id=self.user.id, name="Atorvastatin", dosage="10mg", time="10:00 PM", category="Tablet"
        )
        log1 = models.MedicineLog(
            user_id=self.user.id, medicine_id=4, scheduled_time=datetime.datetime.now(), status="Taken", snooze_count=0
        )
        log2 = models.MedicineLog(
            user_id=self.user.id, medicine_id=4, scheduled_time=datetime.datetime.now() - datetime.timedelta(days=1), status="Missed", snooze_count=0
        )
        self.db.add_all([med, log1, log2])
        self.db.commit()

        # Classify queries
        self.mock_ai.return_value = "MISSED_MEDICINE_QUERY"
        intent1 = classify_intent("Which medicines have I missed?")
        self.assertEqual(intent1, "MISSED_MEDICINE_QUERY")

        # Get intent context for missed medicines
        context = get_intent_context(self.db, self.user, "MISSED_MEDICINE_QUERY", "Which medicines have I missed?")
        import json
        context_data = json.loads(context)
        self.assertEqual(context_data["missed_details"]["missed_count"], 1)
        self.assertEqual(context_data["missed_details"]["missed_medicines"][0]["name"], "Atorvastatin")

if __name__ == "__main__":
    unittest.main()
