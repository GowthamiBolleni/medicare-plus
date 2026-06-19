import os
import sys
import time
import requests
import hashlib
from PIL import Image, ImageDraw
import fitz

BASE_URL = "http://127.0.0.1:8000/api"

def safe_print(msg):
    try:
        print(msg)
    except Exception:
        try:
            print(str(msg).encode('ascii', 'ignore').decode('ascii'))
        except Exception:
            pass

def call_analyze_endpoint_rate_limited(report_id, headers):
    safe_print("[RateLimit Check] Sleeping 1 second before invoking Gemini API...")
    time.sleep(1)
    return requests.post(f"{BASE_URL}/reports/{report_id}/analyze", headers=headers)

def call_chat_endpoint_rate_limited(report_id, payload, headers):
    safe_print("[RateLimit Check] Sleeping 1 second before invoking Gemini API for chat...")
    time.sleep(1)
    return requests.post(f"{BASE_URL}/reports/{report_id}/chat", json=payload, headers=headers)

def call_comparison_endpoint_rate_limited(headers):
    safe_print("[RateLimit Check] Sleeping 1 second before invoking Gemini API for comparison...")
    time.sleep(1)
    return requests.get(f"{BASE_URL}/reports/comparison", headers=headers)

def create_pdf_report(filename, text_content):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text_content)
    doc.save(filename)
    safe_print(f"[Setup] Created PDF report: {filename}")

def create_image_report(filename, lines):
    img = Image.new('RGB', (600, 300), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        d.text((20, 20 + i*30), line, fill=(0, 0, 0))
    img.save(filename)
    safe_print(f"[Setup] Created image report: {filename}")

def cleanup_files(files):
    for f in files:
        if os.path.exists(f):
            os.remove(f)
    safe_print("[Cleanup] Temporary test files deleted.")

def run_tests():
    safe_print("=== STARTING ADVANCED AI MEDICAL REPORT ANALYSIS TEST SUITE ===")
    safe_print("Sleeping 1 second to clear sliding window from previous runs...")
    time.sleep(1)
    
    # Define test file names
    normal_pdf = "test_normal.pdf"
    mild_pdf = "test_mild.pdf"
    moderate_pdf = "test_moderate.pdf"
    critical_pdf = "test_critical.pdf"
    invoice_pdf = "test_invoice.pdf"
    oversized_pdf = "test_oversized.pdf"
    
    # 1. Create mock report files
    create_pdf_report(normal_pdf, """
    LABORATORY HEALTH RECORD - ALL NORMAL VALUES
    Patient Name: Gowthami Bolleni
    Age: 23
    Gender: Female
    Date: 10-Jan-2026
    Lab Name: City Care Diagnostic Center
    Report Type: Blood Test Report
    
    Test Parameter           Result       Reference Range      Status
    -----------------------------------------------------------------
    Hemoglobin               14.2 g/dL    12.0 - 15.5 g/dL     Normal
    Vitamin D (25-OH)        45.0 ng/mL   30.0 - 100.0 ng/mL   Normal
    Blood Glucose            92.0 mg/dL   70.0 - 100.0 mg/dL   Normal
    Blood Pressure           120/80 mmHg  90-120/60-80 mmHg    Normal
    """)

    create_pdf_report(mild_pdf, """
    LABORATORY HEALTH RECORD - MILD ABNORMALITIES
    Patient Name: Gowthami Bolleni
    Age: 23
    Gender: Female
    Date: 20-Feb-2026
    Lab Name: City Care Diagnostic Center
    Report Type: Blood Test Report
    
    Test Parameter           Result       Reference Range      Status
    -----------------------------------------------------------------
    Hemoglobin               14.1 g/dL    12.0 - 15.5 g/dL     Normal
    Vitamin D (25-OH)        24.0 ng/mL   30.0 - 100.0 ng/mL   Low
    Blood Glucose            93.0 mg/dL   70.0 - 100.0 mg/dL   Normal
    Blood Pressure           135/85 mmHg  90-120/60-80 mmHg    High
    """)

    create_pdf_report(moderate_pdf, """
    LABORATORY HEALTH RECORD - MODERATE ABNORMALITIES
    Patient Name: Gowthami Bolleni
    Age: 23
    Gender: Female
    Date: 15-Mar-2026
    Lab Name: City Care Diagnostic Center
    Report Type: Blood Test Report
    
    Test Parameter           Result       Reference Range      Status
    -----------------------------------------------------------------
    Hemoglobin               14.0 g/dL    12.0 - 15.5 g/dL     Normal
    Vitamin D (25-OH)        14.0 ng/mL   30.0 - 100.0 ng/mL   Low
    Blood Glucose            94.0 mg/dL   70.0 - 100.0 mg/dL   Normal
    Blood Pressure           120/80 mmHg  90-120/60-80 mmHg    Normal
    """)

    create_pdf_report(critical_pdf, """
    LABORATORY HEALTH RECORD - CRITICAL ABNORMALITIES
    Patient Name: Gowthami Bolleni
    Age: 23
    Gender: Female
    Date: 18-Jun-2026
    Lab Name: City Care Diagnostic Center
    Report Type: Blood Test Report
    
    Test Parameter           Result       Reference Range      Status
    -----------------------------------------------------------------
    Hemoglobin               7.5 g/dL     12.0 - 15.5 g/dL     Low
    Vitamin D (25-OH)        14.0 ng/mL   30.0 - 100.0 ng/mL   Low
    Blood Glucose            95.0 mg/dL   70.0 - 100.0 mg/dL   Normal
    Blood Pressure           150/95 mmHg  90-120/60-80 mmHg    High
    """)

    create_pdf_report(invoice_pdf, """
    INVOICE RECEIPT
    Apollo Pharmacy Store #12
    Items: Paracetamol 650mg - Qty: 2 - Rs 80
    Total Amount Paid: Rs 80
    """)

    with open(oversized_pdf, "wb") as f:
        f.seek(11 * 1024 * 1024)
        f.write(b"\0")
    safe_print(f"[Setup] Created oversized file: {oversized_pdf}")

    try:
        # Register and login test user
        timestamp = int(time.time())
        username = f"saas_user_{timestamp}"
        password = "SecurePassword123!"
        
        reg_data = {
            "username": username,
            "email": f"{username}@medicareplus.com",
            "password": password,
            "full_name": "Gowthami Bolleni",
            "age": 23,
            "gender": "Female",
            "phone": "+919999988888"
        }
        res = requests.post(f"{BASE_URL}/auth/register", json=reg_data)
        assert res.status_code == 200, "Registration failed"
        
        login_res = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        safe_print("Test user registered and logged in successfully.")

        # Log basic vitals to start base health score at 100
        requests.post(f"{BASE_URL}/health-metrics", json={
            "systolic_bp": 120, "diastolic_bp": 80, "heart_rate": 72, "blood_sugar": 90
        }, headers=headers)

        # TEST 1: Oversized Report Reject (> 10MB)
        safe_print("\n--- TEST 1: Oversized Report Rejection ---")
        with open(oversized_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (oversized_pdf, f, "application/pdf")}, headers=headers)
        safe_print(f"Status Code: {res.status_code}")
        assert res.status_code == 400, "Oversized file should be rejected"
        safe_print("PASSED: Oversized file rejected correctly.")

        # TEST 2: Incomplete/Invoice Report Reject
        safe_print("\n--- TEST 2: Incomplete Report Rejection ---")
        with open(invoice_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (invoice_pdf, f, "application/pdf")}, headers=headers)
        invoice_report = res.json()
        res_an = call_analyze_endpoint_rate_limited(invoice_report['id'], headers)
        safe_print(f"Status Code: {res_an.status_code}")
        assert res_an.status_code == 400, "Invoice should be rejected during analysis"
        assert "not enough medical information" in res_an.json()["detail"].lower()
        safe_print("PASSED: Incomplete report rejected during analysis.")

        # TEST 3: Normal Report Upload and Analysis
        safe_print("\n--- TEST 3: Normal Report Analysis ---")
        with open(normal_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (normal_pdf, f, "application/pdf")}, headers=headers)
        normal_report = res.json()
        res_an = call_analyze_endpoint_rate_limited(normal_report['id'], headers)
        safe_print(f"Status Code: {res_an.status_code}")
        assert res_an.status_code == 200
        normal_an = res_an.json()["analysis"]
        safe_print(f"Normal Vitals Score Impact: {normal_an['health_score_impact']}")
        assert normal_an["health_score_impact"] == 0, "Normal findings should have 0 score impact"
        assert normal_an["patient_name"].strip().lower() == "gowthami bolleni", "Should extract patient name"
        assert normal_an["patient_age"] == 23, "Should extract patient age"
        assert normal_an["patient_gender"].lower() == "female", "Should extract gender"
        assert "normal" in normal_an["confidence_level"].lower() or "high" in normal_an["confidence_level"].lower()
        assert normal_an["risk_level"] == "Low Risk", "Normal report should be classified as Low Risk"
        assert normal_an["risk_score"] < 35, "Normal risk score should be low"
        safe_print("PASSED: Normal report analyzed correctly with correct patient info & Low Risk.")

        # TEST 4: Duplicate Hash File Upload Rejection
        safe_print("\n--- TEST 4: Duplicate Hash Rejection ---")
        with open(normal_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (normal_pdf, f, "application/pdf")}, headers=headers)
        safe_print(f"Status Code: {res.status_code}")
        assert res.status_code == 400, "Duplicate file hash should be rejected"
        assert "already been uploaded" in res.json()["detail"].lower()
        safe_print("PASSED: Duplicate file hash rejected correctly.")

        # TEST 5: Mild Abnormalities Analysis
        safe_print("\n--- TEST 5: Mild Abnormalities Analysis ---")
        with open(mild_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (mild_pdf, f, "application/pdf")}, headers=headers)
        mild_report = res.json()
        res_an = call_analyze_endpoint_rate_limited(mild_report['id'], headers)
        safe_print(f"Status Code: {res_an.status_code}")
        assert res_an.status_code == 200
        mild_an = res_an.json()["analysis"]
        safe_print(f"Mild Abnormalities Vitals Score Impact: {mild_an['health_score_impact']}")
        assert mild_an["health_score_impact"] < 0, "Mild abnormalities should have negative impact"
        assert len(mild_an["health_score_impact_breakdown"]) > 0, "Should have breakdown deductions"
        # Check severity exists on abnormal parameters
        for finding in mild_an["abnormal_findings"]:
            assert "severity" in finding, "Abnormal findings must store severity in database"
            safe_print(f"Parameter: {finding['parameter']} | Status: {finding['status']} | Severity: {finding['severity']}")
        safe_print("PASSED: Mild abnormalities analyzed with severity badges.")

        # TEST 6: Moderate Abnormalities Analysis
        safe_print("\n--- TEST 6: Moderate Abnormalities Analysis ---")
        with open(moderate_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (moderate_pdf, f, "application/pdf")}, headers=headers)
        moderate_report = res.json()
        res_an = call_analyze_endpoint_rate_limited(moderate_report['id'], headers)
        safe_print(f"Status Code: {res_an.status_code}")
        assert res_an.status_code == 200
        moderate_an = res_an.json()["analysis"]
        safe_print(f"Moderate Report Risk Score: {moderate_an['risk_score']} | Risk Level: {moderate_an['risk_level']}")
        safe_print("PASSED: Moderate abnormalities analyzed correctly.")

        # TEST 7: Critical Abnormalities Analysis
        safe_print("\n--- TEST 7: Critical Abnormalities Analysis ---")
        with open(critical_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (critical_pdf, f, "application/pdf")}, headers=headers)
        critical_report = res.json()
        res_an = call_analyze_endpoint_rate_limited(critical_report['id'], headers)
        safe_print(f"Status Code: {res_an.status_code}")
        assert res_an.status_code == 200
        critical_an = res_an.json()["analysis"]
        safe_print(f"Critical Report Risk Score: {critical_an['risk_score']} | Risk Level: {critical_an['risk_level']}")
        assert critical_an["risk_level"] == "High Risk", "Critical report must be High Risk"
        # Verify expanded summaries exist
        assert critical_an["executive_summary"] is not None
        assert len(critical_an["key_findings"]) > 0
        assert len(critical_an["critical_findings"]) > 0
        assert len(critical_an["recommended_actions"]) > 0
        assert len(critical_an["follow_up_suggestions"]) > 0
        safe_print("PASSED: Critical abnormalities analyzed with High Risk score and expanded clinical summaries.")

        # TEST 8: Duplicate Patient & Date Analysis Rejection
        safe_print("\n--- TEST 8: Patient & Date Duplicate Rejection ---")
        # Create another normal report file with different content (to bypass file hash check)
        # but with the same Patient Name and Date (18-Jun-2026) as critical report.
        duplicate_pdf = "test_duplicate.pdf"
        create_pdf_report(duplicate_pdf, """
        LABORATORY HEALTH RECORD - ALL NORMAL VALUES (DIFFERENT CONTENT)
        Patient Name: Gowthami Bolleni
        Age: 23
        Gender: Female
        Date: 18-Jun-2026
        Lab Name: City Care Diagnostic Center
        Report Type: Blood Test Report
        
        Test Parameter           Result       Reference Range      Status
        -----------------------------------------------------------------
        Hemoglobin               14.5 g/dL    12.0 - 15.5 g/dL     Normal
        Vitamin D (25-OH)        46.0 ng/mL   30.0 - 100.0 ng/mL   Normal
        """)
        with open(duplicate_pdf, "rb") as f:
            res = requests.post(f"{BASE_URL}/reports/upload", files={"file": (duplicate_pdf, f, "application/pdf")}, headers=headers)
        duplicate_report = res.json()
        res_an = call_analyze_endpoint_rate_limited(duplicate_report['id'], headers)
        safe_print(f"Status Code: {res_an.status_code}")
        assert res_an.status_code == 400, "Should reject duplicate patient name and date analysis"
        assert "already exists" in res_an.json()["detail"].lower()
        safe_print("PASSED: Patient name & Date duplicate rejection verified.")
        os.remove(duplicate_pdf)

        # TEST 9: AI Chat Inside Report
        safe_print("\n--- TEST 9: AI Chat Inside Report ---")
        chat_payload = {"content": "Explain my low hemoglobin."}
        res = call_chat_endpoint_rate_limited(critical_report['id'], chat_payload, headers)
        safe_print(f"Status Code: {res.status_code}")
        assert res.status_code == 200
        chat_reply = res.json()
        safe_print(f"AI Chat Reply: {chat_reply['content']}")
        assert len(chat_reply["content"]) > 0, "AI must return context-aware answer"
        safe_print("PASSED: AI Chat inside report context verified.")

        # TEST 10: Historical Report Comparison & Trends
        safe_print("\n--- TEST 10: Historical Timeline & Trends ---")
        res = call_comparison_endpoint_rate_limited(headers)
        safe_print(f"Status Code: {res.status_code}")
        assert res.status_code == 200
        comparison = res.json()
        safe_print(f"Trends: {comparison['trends']}")
        safe_print(f"AI Comparison Summary: {comparison['summary']}")
        assert len(comparison["timeline"]) >= 2, "Timeline should combine multiple completed reports"
        assert "hemoglobin" in comparison["trends"]
        assert "vitamin_d" in comparison["trends"]
        safe_print("PASSED: Historical comparisons and trends verified.")

        # TEST 11: Security Auditing
        safe_print("\n--- TEST 11: Security Auditing ---")
        # Check if logs/audit.log contains records
        audit_log_path = "backend/logs/audit.log"
        assert os.path.exists(audit_log_path), "Audit log file should be created"
        with open(audit_log_path, "r", encoding="utf-8") as f:
            log_lines = f.readlines()
        safe_print(f"Audit log line count: {len(log_lines)}")
        has_upload = False
        has_analyze = False
        has_chat = False
        for line in log_lines:
            if "UPLOAD" in line:
                has_upload = True
            if "ANALYZE" in line:
                has_analyze = True
            if "CHAT" in line:
                has_chat = True
        assert has_upload and has_analyze and has_chat, "Audit log must contain UPLOAD, ANALYZE, and CHAT events"
        safe_print("PASSED: Security audit logs verified.")

        # Cleanup test reports from database
        safe_print("\nCleaning up database entries...")
        for r_id in [normal_report["id"], mild_report["id"], moderate_report["id"], critical_report["id"], invoice_report["id"], duplicate_report["id"]]:
            requests.delete(f"{BASE_URL}/reports/{r_id}", headers=headers)
        
    except Exception as e:
        safe_print(f"TEST RUN ERROR: {e}")
        cleanup_files([normal_pdf, mild_pdf, moderate_pdf, critical_pdf, invoice_pdf, oversized_pdf])
        sys.exit(1)
        
    cleanup_files([normal_pdf, mild_pdf, moderate_pdf, critical_pdf, invoice_pdf, oversized_pdf])
    safe_print("\n=== ALL UPGRADED REPORT ANALYSIS TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
