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
        current_model = genai.GenerativeModel("gemini-2.5-flash")
    except Exception:
        try:
            current_model = genai.GenerativeModel("gemini-1.5-flash")
        except Exception:
            current_model = genai.GenerativeModel("gemini-pro")
            
    response = current_model.generate_content(prompt)
    return response.text
