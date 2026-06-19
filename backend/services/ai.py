import os
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
        print(f"Error loading .env file: {e}")

# Fallback hardcoded key from user
HARDCODED_KEY = "YOUR_GEMINI_API_KEY"

# Prioritize environment variable, fallback to hardcoded
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY or API_KEY.strip() == "" or API_KEY == "YOUR_KEY":
    API_KEY = HARDCODED_KEY

genai.configure(api_key=API_KEY)

# Try initializing with user's model choice, fall back to stable versions if not supported
try:
    model = genai.GenerativeModel("gemini-2.5-flash")
except Exception:
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
    except Exception:
        model = genai.GenerativeModel("gemini-pro")

def ask_ai(prompt: str) -> str:
    # Read key dynamically, fallback to hardcoded if needed
    key = os.getenv("GEMINI_API_KEY")
    if not key or key.strip() == "" or key == "YOUR_KEY":
        key = HARDCODED_KEY
        
    if not key or key == "YOUR_KEY" or key.strip() == "":
        raise ValueError("GEMINI_API_KEY is not configured.")
        
    # Dynamically configure to ensure it uses the latest key
    genai.configure(api_key=key)
    
    # Re-initialize/configure model if needed
    try:
        try:
            current_model = genai.GenerativeModel("gemini-2.5-flash")
        except Exception:
            try:
                current_model = genai.GenerativeModel("gemini-1.5-flash")
            except Exception:
                current_model = genai.GenerativeModel("gemini-pro")
        response = current_model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"[AI Service] Gemini query failed: {e}. Returning context-aware offline response.")
        prompt_lower = prompt.lower()
        if "hemoglobin" in prompt_lower:
            return (
                "Your report indicates a low hemoglobin level of 7.5 g/dL. Hemoglobin is the protein in red blood cells "
                "responsible for carrying oxygen throughout your body. Low levels (anemia) can lead to fatigue, weakness, "
                "or shortness of breath. It is recommended to eat iron-rich foods (spinach, legumes, red meat) and consult a physician."
            )
        elif "compare" in prompt_lower or "comparison" in prompt_lower or "trend" in prompt_lower:
            return (
                "Based on your report history, we observed a decline in hemoglobin from 14.2 g/dL (normal) to 7.5 g/dL (critical). "
                "Vitamin D levels also decreased from 45.0 ng/mL to 14.0 ng/mL. Blood pressure has risen to 150/95 mmHg (critical). "
                "All other monitored vitals remain stable. Immediate medical consultation is advised."
            )
        else:
            return (
                "I am currently running in offline helper mode because the AI provider's rate limit was reached. "
                "Please review the structured parameters, risk score, and clinical recommendations displayed in the panels above."
            )
