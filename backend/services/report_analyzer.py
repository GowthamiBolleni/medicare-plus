import os
import re
import json
from PIL import Image
import pdfplumber
import pytesseract
import google.generativeai as genai

# Load .env file manually if python-dotenv is not installed
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ[k.strip()] = v.strip()
    except Exception as e:
        print(f"[ReportAnalyzer] Error loading .env file: {e}")

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    genai.configure(api_key=api_key)
    
    # Try initializing with stable versions
    try:
        return genai.GenerativeModel("gemini-2.5-flash")
    except Exception:
        try:
            return genai.GenerativeModel("gemini-1.5-flash")
        except Exception:
            return genai.GenerativeModel("gemini-pro")

def extract_text_from_pdf(filepath: str) -> str:
    text = ""
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"[ReportAnalyzer] pdfplumber failed: {e}")
    return text.strip()

def extract_text_from_image(filepath: str) -> str:
    text = ""
    try:
        img = Image.open(filepath)
        text = pytesseract.image_to_string(img)
    except Exception as e:
        print(f"[ReportAnalyzer] pytesseract failed: {e}")
    return text.strip()

def run_gemini_ocr_fallback(filepath: str) -> str:
    print("[ReportAnalyzer] Local extraction empty. Running Gemini OCR fallback...")
    try:
        model = get_gemini_client()
        with open(filepath, "rb") as f:
            file_bytes = f.read()
        
        # Determine mime type
        mime_type = "image/jpeg"
        if filepath.lower().endswith(".pdf"):
            mime_type = "application/pdf"
        elif filepath.lower().endswith(".png"):
            mime_type = "image/png"
            
        response = model.generate_content([
            "Extract all text from this medical report document exactly as it is written. "
            "Do not summarize or omit anything. Transcribe all text.",
            {"mime_type": mime_type, "data": file_bytes}
        ])
        if response.text:
            return response.text.strip()
    except Exception as e:
        print(f"[ReportAnalyzer] Gemini OCR fallback failed: {e}")
    return ""

def extract_report_text(filepath: str) -> str:
    text = ""
    if filepath.lower().endswith(".pdf"):
        text = extract_text_from_pdf(filepath)
    else:
        text = extract_text_from_image(filepath)
        
    # If the local extraction yields nothing, run the Gemini OCR fallback
    if not text.strip():
        text = run_gemini_ocr_fallback(filepath)
        
    return text.strip()

def analyze_report_with_gemini(report_text: str) -> dict:
    model = get_gemini_client()
    
    prompt = f"""
Analyze the following medical report.
Return JSON format only matching this schema exactly:
{{
  "summary": "Patient-friendly summary identifying the key findings, including a medical disclaimer.",
  "abnormal_findings": ["List of abnormal values with context", "e.g., Low Hemoglobin (10.2 g/dL)"],
  "normal_findings": ["List of normal values with context", "e.g., Blood Sugar (95 mg/dL)"],
  "recommendations": ["Educational recommendations only", "e.g., Increase iron-rich foods"],
  "health_score_impact": 0
}}

Instructions:
1. Identify all medical test results.
2. Compare against reference ranges (or standard reference ranges if not listed).
3. Mark each result as: Normal, High, Low.
4. Explain abnormalities in simple language.
5. Give educational recommendations only.
6. Never provide diagnosis.
7. Include a clear medical disclaimer inside the "summary" field.
8. Set "health_score_impact" to an appropriate integer:
   - For normal results, it should be 0.
   - For abnormal findings, assign a negative point deduction for each deficiency or abnormal value.
     Example deductions:
     - Low Hemoglobin: -5 points
     - Vitamin D Deficiency: -3 points
     - High Blood Pressure: -7 points
     - High Blood Sugar: -10 points
     - High Cholesterol: -5 points
     - Other abnormalities: -3 to -10 points based on severity.
     Calculate the sum of all deductions and set it as a negative integer for "health_score_impact" (e.g. -8).

Medical Report:
{report_text}
"""

    # We can request structured JSON response from Gemini
    # To be fully compatible and robust, we will request text and parse the JSON block.
    # gemini-2.5-flash and gemini-1.5-flash support JSON mode or structured outputs.
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result_text = response.text.strip()
    except Exception as e:
        print(f"[ReportAnalyzer] Gemini generation failed with response_mime_type, retrying general content: {e}")
        response = model.generate_content(prompt)
        result_text = response.text.strip()

    # Clean the response to ensure it's valid JSON
    # Remove markdown code blocks if present
    if result_text.startswith("```"):
        match = re.search(r"```json\s*(.*?)\s*```", result_text, re.DOTALL)
        if match:
            result_text = match.group(1).strip()
        else:
            match_any = re.search(r"```\s*(.*?)\s*```", result_text, re.DOTALL)
            if match_any:
                result_text = match_any.group(1).strip()

    try:
        analysis_data = json.loads(result_text)
    except json.JSONDecodeError as err:
        print(f"[ReportAnalyzer] JSON parsing error: {err}. Raw response: {result_text}")
        # Try to find a JSON block in the text
        json_match = re.search(r"(\{.*\})", result_text, re.DOTALL)
        if json_match:
            try:
                analysis_data = json.loads(json_match.group(1))
            except Exception:
                raise ValueError("Analysis currently unavailable. Please try again later.")
        else:
            raise ValueError("Analysis currently unavailable. Please try again later.")

    # Validate output schema
    required_keys = ["summary", "abnormal_findings", "normal_findings", "recommendations", "health_score_impact"]
    for key in required_keys:
        if key not in analysis_data:
            if key == "health_score_impact":
                analysis_data[key] = 0
            elif key in ["abnormal_findings", "normal_findings", "recommendations"]:
                analysis_data[key] = []
            else:
                analysis_data[key] = ""

    # Ensure impact is negative or zero
    if isinstance(analysis_data["health_score_impact"], (int, float)):
        analysis_data["health_score_impact"] = int(analysis_data["health_score_impact"])
        if analysis_data["health_score_impact"] > 0:
            analysis_data["health_score_impact"] = -analysis_data["health_score_impact"]
    else:
        analysis_data["health_score_impact"] = 0

    return analysis_data
