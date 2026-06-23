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

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[database.get_db] = override_get_db

class TestNotificationsSystem(unittest.TestCase):
    def setUp(self):
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

        self.token = auth.create_access_token(data={"sub": "testnotifuser"})
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.patcher_trans.stop()
        self.patcher_ai.stop()
        self.patcher_fcm_single.stop()
        self.patcher_fcm_multi.stop()
        self.db.close()
        Base.metadata.drop_all(bind=engine)

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

        # Verify reminders written to history table
        history = self.db.query(models.NotificationHistory).filter(models.NotificationHistory.user_id == self.user.id).all()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].title, "💊 Medicine Reminder")
        self.assertIn("Amoxicillin", history[0].message)

if __name__ == "__main__":
    unittest.main()
