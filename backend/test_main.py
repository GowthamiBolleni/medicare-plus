import os
import unittest
import json
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["ENV"] = "test"  # set env to test

# Import app modules
import models
import schemas
import auth
import database
from database import Base
from main import app, get_db
from sqlalchemy.pool import StaticPool

# Set up test database (in-memory SQLite)
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

class TestMediCareApp(unittest.TestCase):
    def setUp(self):
        # Create schema
        Base.metadata.create_all(bind=engine)
        self.client = TestClient(app)
        self.db = TestingSessionLocal()
        
        # Start mocks for external services to prevent Hugging Face / Gemini network requests
        from unittest.mock import patch, MagicMock
        import numpy as np
        
        self.patcher_transformer = patch('sentence_transformers.SentenceTransformer')
        self.mock_transformer_class = self.patcher_transformer.start()
        self.mock_model = MagicMock()
        self.mock_model.encode.return_value = np.zeros((1, 384), dtype='float32')
        self.mock_transformer_class.return_value = self.mock_model
        
        self.patcher_ask_ai = patch('services.ai.ask_ai')
        self.mock_ask_ai = self.patcher_ask_ai.start()
        self.mock_ask_ai.return_value = "GENERAL_CHAT"
        
        # Create a default test user
        self.hashed_pw = auth.get_password_hash("TestPass123!")
        self.default_user = models.User(
            username="testuser",
            email="testuser@example.com",
            hashed_password=self.hashed_pw,
            full_name="Test User",
            age=25,
            gender="Male",
            height=175.0,
            weight=70.0,
            phone="+919876543210",
            health_score=80
        )
        self.db.add(self.default_user)
        self.db.commit()
        self.db.refresh(self.default_user)
        
        # Generate token for default user
        self.token = auth.create_access_token(data={"sub": "testuser"})
        self.headers = {"Authorization": f"Bearer {self.token}"}
 
    def tearDown(self):
        self.patcher_transformer.stop()
        self.patcher_ask_ai.stop()
        self.db.close()
        Base.metadata.drop_all(bind=engine)

    # ================= 1. AUTHENTICATION TESTS =================
    def test_auth_register_and_login(self):
        # Test Password Policy (less than 8 chars)
        res = self.client.post("/api/auth/register", json={
            "username": "newuser", "email": "new@example.com", "password": "abc", "full_name": "New User"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("Password must be at least 8 characters", res.json()["detail"])
        
        # Test Password Policy (no uppercase)
        res = self.client.post("/api/auth/register", json={
            "username": "newuser", "email": "new@example.com", "password": "password123!", "full_name": "New User"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("at least one uppercase letter", res.json()["detail"])

        # Test Successful Registration
        res = self.client.post("/api/auth/register", json={
            "username": "newuser", "email": "new@example.com", "password": "Password123!", "full_name": "New User",
            "age": 30, "gender": "Female", "height": 160.0, "weight": 55.0, "phone": "+919999999999"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["username"], "newuser")
        self.assertEqual(res.json()["email"], "new@example.com")
        self.assertEqual(res.json()["full_name"], "New User")
        
        # Test Duplicate Username
        res = self.client.post("/api/auth/register", json={
            "username": "newuser", "email": "other@example.com", "password": "Password123!", "full_name": "New User"
        })
        self.assertEqual(res.status_code, 400)
        
        # Test Successful Login
        res = self.client.post("/api/auth/login", json={
            "username": "newuser", "password": "Password123!"
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())
        self.assertEqual(res.json()["token_type"], "bearer")

        # Test Login Failure
        res = self.client.post("/api/auth/login", json={
            "username": "newuser", "password": "WrongPassword!"
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("Incorrect username or password", res.json()["detail"])

    # ================= 2. PROFILE MANAGEMENT TESTS =================
    def test_profile_endpoints(self):
        # Get profile
        res = self.client.get("/api/profile", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["username"], "testuser")
        self.assertEqual(res.json()["phone"], "+919876543210")
        
        # Update profile
        res = self.client.put("/api/profile", headers=self.headers, json={
            "full_name": "Updated Name", "weight": 72.5, "height": 176.0, "age": 26, "gender": "Male", "phone": "+918888888888"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["full_name"], "Updated Name")
        self.assertEqual(res.json()["weight"], 72.5)
        self.assertEqual(res.json()["height"], 176.0)
        self.assertEqual(res.json()["age"], 26)
        
        # Verify changes in db
        self.db.expire_all()
        user_db = self.db.query(models.User).filter(models.User.id == self.default_user.id).first()
        self.assertEqual(user_db.full_name, "Updated Name")
        self.assertEqual(user_db.weight, 72.5)

    # ================= 3. MEDICINE ENDPOINTS TESTS =================
    def test_medicine_management(self):
        # Add medicine
        res = self.client.post("/api/medicines", headers=self.headers, json={
            "name": "Vitamin D3", "dosage": "1 Capsule", "instructions": "After Breakfast", "time": "09:00 AM",
            "category": "Capsule", "status": "Upcoming", "frequency": "Everyday"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "Vitamin D3")
        self.assertEqual(res.json()["status"], "Upcoming")
        med_id = res.json()["id"]

        # List medicines
        res = self.client.get("/api/medicines", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)
        self.assertEqual(res.json()[0]["name"], "Vitamin D3")

        # Update medicine status (Taken)
        res = self.client.put(f"/api/medicines/{med_id}", headers=self.headers, json={"status": "Taken"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "Taken")
        
        # Verify in db
        med_db = self.db.query(models.Medicine).filter(models.Medicine.id == med_id).first()
        self.assertEqual(med_db.status, "Taken")

        # Delete medicine
        res = self.client.delete(f"/api/medicines/{med_id}", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.db.query(models.Medicine).count(), 0)

    # ================= 4. APPOINTMENT ENDPOINTS TESTS =================
    def test_appointment_management(self):
        # Add appointment
        date_str = (datetime.datetime.now() + datetime.timedelta(days=1)).isoformat()
        res = self.client.post("/api/appointments", headers=self.headers, json={
            "hospital": "City Dental Clinic", "doctor": "Dr. Smith", "specialty": "Dentist", "date": date_str,
            "time": "11:30 AM", "status": "Upcoming", "description": "Routine dental checkup"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["hospital"], "City Dental Clinic")
        self.assertEqual(res.json()["doctor"], "Dr. Smith")
        appt_id = res.json()["id"]

        # List appointments
        res = self.client.get("/api/appointments", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)
        
        # Update appointment status
        res = self.client.put(f"/api/appointments/{appt_id}", headers=self.headers, json={"status": "Completed"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "Completed")

        # Delete appointment
        res = self.client.delete(f"/api/appointments/{appt_id}", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.db.query(models.Appointment).count(), 0)

    # ================= 5. EMERGENCY & SOS TESTS =================
    def test_sos_endpoints(self):
        # Mock family emergency contact
        family_member = models.FamilyMember(
            name="Dad", relation="Father", phone="+919999988888", is_emergency_contact=True, user_id=self.default_user.id
        )
        self.db.add(family_member)
        self.db.commit()

        # Trigger SOS
        res = self.client.post("/api/emergency/sos", headers=self.headers, json={
            "latitude": 12.9716, "longitude": 77.5946
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "TRIGGERED")
        self.assertIn("Nearest Hospital", res.json()["message"])
        
        # Verify SOSLog entry is created with coords, hospital, conditions
        log_db = self.db.query(models.SOSLog).filter(models.SOSLog.user_id == self.default_user.id).first()
        self.assertIsNotNone(log_db)
        self.assertEqual(log_db.latitude, 12.9716)
        self.assertEqual(log_db.longitude, 77.5946)
        self.assertIsNotNone(log_db.nearest_hospital)

        # Trigger SOS again immediately to verify cooldown rate limiting
        res = self.client.post("/api/emergency/sos", headers=self.headers, json={
            "latitude": 12.9716, "longitude": 77.5946
        })
        # Cooldown returns status code 429 or status COOLDOWN depending on type of limit
        self.assertIn(res.status_code, [200, 429])
        if res.status_code == 200:
            self.assertEqual(res.json()["status"], "COOLDOWN")

    # ================= 6. MEDICAL HISTORY TESTS =================
    def test_medical_history(self):
        # Add history
        res = self.client.post("/api/medical-history", headers=self.headers, json={
            "condition": "Hypertension", "diagnosis_date": "2024-01-15", "status": "Active", "notes": "Takes daily medicines"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["condition"], "Hypertension")
        self.assertEqual(res.json()["status"], "Active")
        history_id = res.json()["id"]

        # List history
        res = self.client.get("/api/medical-history", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)

        # Delete history
        res = self.client.delete(f"/api/medical-history/{history_id}", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.db.query(models.MedicalHistory).count(), 0)

    # ================= 7. RAG INDEXING & SECTOR SEARCH TESTS =================
    def test_rag_and_intent_router(self):
        from services import rag_service, intent_router
        
        # Test text chunking
        text = "This is a clinical blood report. The hemoglobin level is 14.2 g/dL. Vitamin D level is 28 ng/mL which is slightly deficient."
        chunks = rag_service.chunk_text(text, chunk_size=10, overlap=2)
        self.assertTrue(len(chunks) > 0)
        
        # Seed embeddings in DB
        # Since we use mocked embeddings, let's write a mock embedding values list
        mock_embedding = [0.1] * 384
        embedding_record = models.ReportEmbedding(
            report_id=1,
            user_id=self.default_user.id,
            chunk_text="Hemoglobin level is 14.2 g/dL",
            embedding=mock_embedding
        )
        self.db.add(embedding_record)
        self.db.commit()

        # Retrieve relevant chunks using RAG
        results = rag_service.retrieve_relevant_chunks(self.db, self.default_user.id, "hemoglobin query", top_k=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["chunk_text"], "Hemoglobin level is 14.2 g/dL")

        # Test intent classifier fallback
        intent = intent_router.classify_intent("What is my vitamin D level?")
        self.assertIn(intent, intent_router.INTENTS)

    # ================= 8. PDF GENERATION TESTS =================
    def test_pdf_generation(self):
        from services import pdf_service
        
        # Create a mock ReportAnalysis instance
        analysis = models.ReportAnalysis(
            patient_name="Test Patient",
            patient_age=25,
            patient_gender="Male",
            report_date="19-Jun-2026",
            lab_name="City Lab",
            report_type="Blood Test",
            summary="Hemoglobin normal.",
            abnormal_findings=json.dumps(["Vitamin D deficiency"]),
            normal_findings=json.dumps(["Hemoglobin 14.2"]),
            recommendations=json.dumps(["Take Vitamin D daily"]),
            follow_up_suggestions=json.dumps(["Repeat test in 3 months"]),
            next_review_date="19-Sep-2026",
            health_score_impact=-5,
            risk_level="Mild",
            analysis_confidence=95
        )
        
        pdf_buffer = pdf_service.generate_report_pdf(analysis, "test_report.pdf")
        pdf_bytes = pdf_buffer.read()
        self.assertTrue(len(pdf_bytes) > 0)
        self.assertEqual(pdf_bytes[:4], b"%PDF") # Validate PDF signature

    # ================= 9. CHAT CONTEXT & BOT ENDPOINT TESTS =================
    def test_chat_response_endpoint(self):
        # Register a message in ChatHistory
        res = self.client.post("/api/chat", headers=self.headers, json={
            "content": "Hello! What is my name?"
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("content", res.json())
        self.assertEqual(res.json()["sender"], "ai")

if __name__ == "__main__":
    unittest.main()
